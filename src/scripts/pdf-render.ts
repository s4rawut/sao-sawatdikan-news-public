// Draws every page of a PDF into `container` with PDF.js (pinned, served from /vendor so it works without internet).
// Works on phones too, where browsers have no in-page PDF viewer.
// Pages are sized up front and drawn as they scroll into view, sharp on high-DPI screens.
const CDN = new URL("/vendor/pdfjs-4.10.38", location.origin).href;

type PdfDoc = {
	numPages: number;
	getPage(n: number): Promise<{
		getViewport(o: { scale: number }): { width: number; height: number };
		render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
	}>;
	destroy(): Promise<void>;
};

let lib: Promise<any> | undefined;
function pdfjs() {
	lib ??= import(/* @vite-ignore */ `${CDN}/build/pdf.min.mjs`).then((m) => {
		m.GlobalWorkerOptions.workerSrc = `${CDN}/build/pdf.worker.min.mjs`;
		return m;
	});
	return lib;
}

export interface RenderedPdf {
	numPages: number;
	/** stop drawing and free the document (call when the viewer closes) */
	destroy(): void;
}

/** `scrollRoot` is the element that scrolls (null = the page) */
export async function renderPdf(url: string, container: HTMLElement, scrollRoot: Element | null = null): Promise<RenderedPdf> {
	const m = await pdfjs();
	const pdf: PdfDoc = await m.getDocument({
		url,
		cMapUrl: `${CDN}/cmaps/`,
		cMapPacked: true,
		standardFontDataUrl: `${CDN}/standard_fonts/`,
	}).promise;

	const first = await pdf.getPage(1);
	const base = first.getViewport({ scale: 1 });
	const boxes: HTMLElement[] = [];
	for (let n = 1; n <= pdf.numPages; n++) {
		const box = document.createElement("div");
		box.className = "pdf-page";
		box.style.aspectRatio = `${base.width} / ${base.height}`;
		box.dataset.page = String(n);
		box.setAttribute("aria-label", `หน้า ${n}`);
		container.append(box);
		boxes.push(box);
	}

	let stopped = false;
	const draw = async (box: HTMLElement) => {
		if (box.dataset.drawn || stopped) return;
		box.dataset.drawn = "1";
		const page = await pdf.getPage(Number(box.dataset.page));
		const unit = page.getViewport({ scale: 1 });
		box.style.aspectRatio = `${unit.width} / ${unit.height}`;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const viewport = page.getViewport({ scale: (box.clientWidth / unit.width) * dpr });
		const canvas = document.createElement("canvas");
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);
		box.append(canvas);
		await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
	};

	const io = new IntersectionObserver(
		(entries) => entries.forEach((e) => e.isIntersecting && draw(e.target as HTMLElement)),
		{ root: scrollRoot, rootMargin: "600px 0px" },
	);
	boxes.forEach((b) => io.observe(b));

	return {
		numPages: pdf.numPages,
		destroy() {
			stopped = true;
			io.disconnect();
			pdf.destroy().catch(() => {});
		},
	};
}
