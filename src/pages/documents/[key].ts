import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { PDF_KEY } from "../../utils/documents";

export const prerender = false;

/**
 * Serves an uploaded PDF from the media library.
 * EmDash's own media route always forces a download for PDFs, so the site links here instead.
 *
 *   /documents/<key>              clicked link (a page load): sent on to the viewer page /documents/view/<key>
 *   /documents/<key>?raw=1        the PDF itself, shown inline (viewer, "open in new tab", embeds)
 *   /documents/<key>?download=1   the PDF as a download, under its original file name
 *
 * Only keys of ready PDFs in the media library are served, so backups and other
 * objects sharing the bucket stay unreachable. There is deliberately no
 * `Content-Security-Policy: sandbox` here: it stops Chrome's PDF viewer loading.
 */

const notFound = () => new Response("Not found", { status: 404 });

export const GET: APIRoute = async ({ params, request, url, locals, redirect }) => {
	const key = params.key;
	const storage = locals.emdash?.storage;
	if (!key || !PDF_KEY.test(key) || !storage) return notFound();

	const download = url.searchParams.has("download");
	const raw = url.searchParams.has("raw");
	// A plain link click is a top-level page load: show the viewer page first.
	// fetch() from the viewer, iframes and <embed> send a different Sec-Fetch-Dest and get the file.
	if (!download && !raw && request.headers.get("sec-fetch-dest") === "document") {
		return redirect(`/documents/view/${key}`, 302);
	}

	const media = await env.DB.prepare(
		"SELECT filename FROM media WHERE storage_key = ? AND mime_type = 'application/pdf' AND status = 'ready'",
	)
		.bind(key)
		.first<{ filename: string }>();
	if (!media) return notFound();

	const file = await storage.download(key).catch(() => null);
	if (!file) return notFound();

	const headers: Record<string, string> = {
		"Content-Type": "application/pdf",
		"Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.filename)}`,
		"Cache-Control": "public, max-age=300",
		"X-Content-Type-Options": "nosniff",
		Vary: "Sec-Fetch-Dest",
	};
	if (file.size) headers["Content-Length"] = String(file.size);

	return new Response(file.body, { headers });
};
