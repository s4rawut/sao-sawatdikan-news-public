import react from "@astrojs/react";
import { fileURLToPath } from "node:url";
import { defineConfig, fontProviders, sessionDrivers } from "astro/config";
import { resolve } from "node:path";
import emdash, { local } from "emdash/astro";

/**
 * The site runs as a Node.js server: SQLite file + uploads folder on the server's disk (docs/self-hosting.md).
 * "cloudflare:workers" (how the shop code reads env.DB / env.MEDIA / settings) is aliased to
 * src/platform/node-env.js. DEPLOY_TARGET=cloudflare is only used by the developer's own test copy.
 */
const NODE = process.env.DEPLOY_TARGET !== "cloudflare";

let adapter, database, storage;
if (NODE) {
	const { default: node } = await import("@astrojs/node");
	const { sqlite } = await import("emdash/db");
	adapter = node({ mode: "standalone" });
	database = sqlite({ url: `file:${process.env.DATABASE_PATH || "./data/emdash.db"}` });
	storage = local({ directory: process.env.UPLOADS_DIR || "./data/uploads", baseUrl: "/_emdash/api/media/file" });
} else {
	const { default: cloudflare } = await import("@astrojs/cloudflare");
	const { d1 } = await import("@emdash-cms/cloudflare");
	adapter = cloudflare();
	database = d1({ binding: "DB", session: "auto", coalesce: true });
	// R2 adapter that also accepts a KV namespace as MEDIA (the test deploy has no R2): src/storage/kv-bucket.js
	storage = {
		entrypoint: fileURLToPath(new URL("./src/storage/media-storage.js", import.meta.url)),
		config: { binding: "MEDIA" },
	};
}

export default defineConfig({
	output: "server",
	adapter,
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	...(NODE && {
		// Behind the IT reverse proxy, Astro only trusts the public host (Host / X-Forwarded-Host) when it is
		// listed here; otherwise every request looks like "localhost" and form posts fail the origin checks.
		// Built from SITE_URL (the public address) + ALLOWED_HOSTS (extra hostnames, comma-separated) at build time.
		// ALLOWED_HOSTS=* (the ready-made container image) trusts the host the reverse proxy sends, so one image
		// works for any domain; the proxy must then set Host / X-Forwarded-Host itself (docs/self-hosting.md).
		security: {
			allowedDomains: (process.env.ALLOWED_HOSTS || "").split(",").some((v) => v.trim() === "*")
				? [{}]
				: [process.env.EMDASH_SITE_URL || process.env.SITE_URL, ...(process.env.ALLOWED_HOSTS || "").split(",")]
						.map((v) => String(v || "").trim())
						.filter(Boolean)
						.map((v) => (v.includes("://") ? new URL(v) : { hostname: v }))
						.map((u) => (u.protocol ? { hostname: u.hostname, protocol: u.protocol.replace(":", "") } : { hostname: u.hostname })),
		},
		// Sign-in sessions (EmDash admin) kept with the other data, so a rebuild/redeploy doesn't sign everyone out
		session: { driver: sessionDrivers.fsLite({ base: resolve(process.env.SESSIONS_DIR || "./data/sessions") }) },
		vite: {
			resolve: {
				alias: { "cloudflare:workers": fileURLToPath(new URL("./src/platform/node-env.js", import.meta.url)) },
			},
		},
	}),
	integrations: [
		react(),
		emdash({
			database,
			storage,
			// Security policy: media-library uploads (staff only, Passkey login) are capped at 20 MB
			// (EmDash default is 50 MB) so scanned regulation PDFs fit; KV allows up to 25 MiB per value.
			// Image fields accept only JPEG/PNG (allowedMimeTypes on each field). Member slips: 1.5 MB (src/shop/api.js).
			maxUploadSize: 20 * 1024 * 1024,
			// Self-hosted: the client IP comes from the reverse proxy's header (rate limits on sign-in)
			...(NODE && { trustedProxyHeaders: (process.env.TRUSTED_PROXY_HEADERS || "x-real-ip").split(",").map((h) => h.trim()).filter(Boolean) }),
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "IBM Plex Sans Thai Looped",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			subsets: ["thai", "latin"],
			fallbacks: ["Tahoma", "sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
