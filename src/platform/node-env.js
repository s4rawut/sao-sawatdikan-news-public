/**
 * Node.js stand-in for the "cloudflare:workers" module (self-hosted build only).
 *
 * astro.config.mjs aliases "cloudflare:workers" to this file when DEPLOY_TARGET=node, so code written for
 * Cloudflare (`import { env, waitUntil } from "cloudflare:workers"`) runs unchanged on a normal server:
 *   env.DB     → the SQLite file EmDash uses, through a D1-compatible wrapper (./d1-sqlite.js)
 *   env.MEDIA  → the uploads folder EmDash's local storage uses, through a small R2-like bucket (below)
 *   env.X      → process.env.X (secrets and settings: SITE_GATE_PASS, TELEGRAM_BOT_TOKEN, …)
 * It also starts the shop's hourly clean-up (expired sessions, unpaid orders).
 *
 * Paths come from DATABASE_PATH and UPLOADS_DIR — the same values astro.config.mjs gives EmDash.
 */
import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { D1Sqlite } from "./d1-sqlite.js";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/emdash.db";
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./data/uploads");

const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", svg: "image/svg+xml", pdf: "application/pdf", json: "application/json", txt: "text/plain" };
const typeOf = (key) => TYPES[key.split(".").pop()?.toLowerCase()] || "application/octet-stream";

/** Resolve a key inside UPLOADS_DIR (never outside it) */
function fileOf(key) {
	const p = path.resolve(UPLOADS_DIR, String(key).replace(/^\/+/, ""));
	if (!p.startsWith(UPLOADS_DIR + path.sep)) throw new Error("Invalid storage key");
	return p;
}
async function toBuffer(body) {
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	if (typeof body === "string") return Buffer.from(body);
	return Buffer.from(await new Response(body).arrayBuffer());
}

/** The part of the R2 bucket API the shop uses (put / get / head / delete / list), on a folder */
const localBucket = {
	async put(key, body, options = {}) {
		const file = fileOf(key);
		const buf = await toBuffer(body);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, buf);
		return { key, size: buf.length, uploaded: new Date(), etag: "", httpMetadata: { contentType: options.httpMetadata?.contentType || typeOf(key) } };
	},
	async get(key) {
		const file = fileOf(key);
		let stat;
		try { stat = await fs.stat(file); } catch { return null; }
		return {
			key, size: stat.size, uploaded: stat.mtime, etag: "", httpMetadata: { contentType: typeOf(key) },
			get body() { return Readable.toWeb(createReadStream(file)); },
			arrayBuffer: async () => { const b = await fs.readFile(file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
		};
	},
	async head(key) {
		try {
			const stat = await fs.stat(fileOf(key));
			return { key, size: stat.size, uploaded: stat.mtime, etag: "", httpMetadata: { contentType: typeOf(key) } };
		} catch { return null; }
	},
	async delete(keys) {
		await Promise.all([].concat(keys).map((k) => fs.unlink(fileOf(k)).catch(() => {})));
	},
	async list(options = {}) {
		const prefix = options.prefix || "";
		const dir = path.dirname(fileOf(prefix + "x"));
		let names = [];
		try { names = await fs.readdir(dir); } catch {}
		const base = path.relative(UPLOADS_DIR, dir).split(path.sep).filter(Boolean).join("/");
		const objects = names.map((n) => (base ? `${base}/${n}` : n)).filter((k) => k.startsWith(prefix)).map((key) => ({ key }));
		return { objects, truncated: false };
	},
};

let db;
export const env = new Proxy({}, {
	get(_, name) {
		if (name === "DB") return (db ??= new D1Sqlite(DATABASE_PATH));
		if (name === "MEDIA") return localBucket;
		return typeof name === "string" ? process.env[name] : undefined;
	},
	has(_, name) {
		return name === "DB" || name === "MEDIA" || (typeof name === "string" && name in process.env);
	},
});

/** On Workers this keeps the request alive for background work; on Node the process stays up anyway */
export function waitUntil(promise) {
	Promise.resolve(promise).catch((e) => console.error("[background]", e));
}

/* Shop clean-up once an hour (expired sessions, rate limits, auto-cancel unpaid orders with stock return).
 * Imported lazily so this module has no import cycle with the shop code. */
const g = globalThis;
if (!g.__shopScheduler) {
	g.__shopScheduler = setInterval(async () => {
		if (new Date().getUTCMinutes() !== 0) return;
		try {
			const { runShopScheduled } = await import("../shop/api.js");
			await runShopScheduled(env);
		} catch (e) {
			console.error("[shop scheduled]", e);
		}
	}, 60_000);
	g.__shopScheduler.unref?.();
}
