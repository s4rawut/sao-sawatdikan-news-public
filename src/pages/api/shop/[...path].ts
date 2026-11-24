import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";
import { handleShopApi } from "../../../shop/api.js";

export const prerender = false;

/**
 * The EmDash runtime, so the shop back office can create products and upload images through EmDash
 * itself (revisions, search index and media records, like admin-made ones).
 * EmDash only puts the full runtime on locals.emdash for requests signed in to its own admin; shop staff
 * sign in with shop accounts, so fall back to the runtime singleton the EmDash middleware has already
 * initialised for this request (globalThis[Symbol.for("emdash:runtime-holder")], see
 * emdash/dist/astro/middleware.mjs). This is internal to EmDash: re-check it after upgrading emdash.
 * Permission checks stay in the shop router (staff:stock_manage).
 */
const RUNTIME_HOLDER = Symbol.for("emdash:runtime-holder");
function cmsRuntime(locals: App.Locals) {
	const full = locals.emdash as { handleContentCreate?: unknown } | undefined;
	if (full?.handleContentCreate) return full;
	return (globalThis as Record<symbol, { instance?: unknown } | undefined>)[RUNTIME_HOLDER]?.instance;
}

/** Every /api/shop/* request goes to the shop router; the signed-in EmDash user (if any) is shop staff */
export const ALL: APIRoute = ({ request, locals }) =>
	handleShopApi(request, env, { waitUntil }, locals.user, cmsRuntime(locals));
