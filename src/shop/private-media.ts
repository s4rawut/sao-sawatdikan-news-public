/**
 * Payment slips live in the same R2 bucket as site images (under "shop/"), and EmDash's
 * public media route serves any key in that bucket. Slips are personal financial data, so
 * they may only be served through the shop API, which checks who is asking.
 *
 * Checked in src/middleware.ts on every request.
 */
const MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

export function isShopPrivateMedia(pathname: string): boolean {
	if (!pathname.startsWith(MEDIA_FILE_PREFIX)) return false;
	let key = pathname.slice(MEDIA_FILE_PREFIX.length);
	// Decode repeatedly so "shop%2F…" or double-encoded keys are caught too
	for (let i = 0; i < 4; i++) {
		let next: string;
		try {
			next = decodeURIComponent(key);
		} catch {
			return true;
		}
		if (next === key) break;
		key = next;
	}
	return /^[\\/]*shop[\\/]/i.test(key);
}

export const privateMediaNotFound = () =>
	new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
