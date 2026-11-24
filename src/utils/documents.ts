/** Media-library storage key of a PDF: "<ULID>.pdf" (direct upload) or "<ULID>.<ULID>.pdf" (signed upload from the admin) */
export const PDF_KEY = /^[0-9A-Za-z]{26}(?:\.[0-9A-Za-z]{26})?\.pdf$/;

type FileValue = { url?: string; src?: string; mimeType?: string; meta?: { storageKey?: unknown } } | null | undefined;

/**
 * Link for a file field: PDFs open the viewer page (/documents/view/<key>), which has a download button;
 * anything else falls back to `fallback` (the public media URL).
 */
export function documentHref(file: unknown, fallback: string): string {
	const f = file as FileValue;
	const key = typeof f?.meta?.storageKey === "string" ? f.meta.storageKey : "";
	return PDF_KEY.test(key) ? `/documents/view/${key}` : fallback;
}
