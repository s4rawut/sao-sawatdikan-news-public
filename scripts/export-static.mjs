/**
 * ดึงหน้าเว็บทั้งหมดเป็นไฟล์ HTML นิ่ง (static) พร้อม CSS รูป ฟอนต์ — ใช้เป็น "หน้ากาก" ให้ IT นำไปวาง
 * ระบบที่ต้องใช้เซิร์ฟเวอร์ (สมัครสมาชิก ตะกร้า สั่งซื้อ ค้นหา หลังบ้าน) จะไม่ทำงานในไฟล์นิ่ง
 *
 * ใช้:  SITE_GATE_COOKIE=<ค่าคุกกี้ __Host-site_gate> node scripts/export-static.mjs [ปลายทาง]
 *       (ไม่มีรหัสเข้าเว็บ = ไม่ต้องใส่ SITE_GATE_COOKIE)
 * ลิงก์ในไฟล์เป็นแบบ relative จึงเปิดจากโฟลเดอร์ใดก็ได้ หรือวางบนเว็บเซิร์ฟเวอร์ใดก็ได้
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

const ORIGIN = process.env.SITE_ORIGIN || "http://127.0.0.1:4321"; // เว็บที่จะดึง (เซิร์ฟเวอร์ที่รันอยู่)
const OUT = process.argv[2] || "exports/static-site";
const COOKIE = process.env.SITE_GATE_COOKIE ? `__Host-site_gate=${process.env.SITE_GATE_COOKIE}` : "";
// ไม่ดึง: หลังบ้าน API หน้าเข้ารหัสเว็บ และไฟล์ที่สร้างตามคำขอ
const SKIP = [/^\/_emdash\/(?!api\/media\/file\/)/, /^\/api\//, /^\/shop-admin/, /^\/site-login/, /^\/_server-islands/, /^\/rss\.xml/];
const EXT_BY_TYPE = {
	"text/css": ".css", "application/javascript": ".js", "text/javascript": ".js", "image/png": ".png", "image/jpeg": ".jpg",
	"image/webp": ".webp", "image/avif": ".avif", "image/gif": ".gif", "image/svg+xml": ".svg", "image/x-icon": ".ico",
	"font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf", "application/pdf": ".pdf", "application/json": ".json",
};

const headers = { "user-agent": "static-export", ...(COOKIE ? { cookie: COOKIE } : {}) };
const pages = new Map(); // key (path?query) -> local file
const assets = new Map(); // key -> local file (หรือ Promise ระหว่างดึง)
const queue = [];
let failed = 0;

const keyOf = (u) => u.pathname + u.search;
const skip = (u) => u.origin !== ORIGIN || SKIP.some((re) => re.test(u.pathname));
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const decode = (p) => { try { return decodeURIComponent(p); } catch { return p; } };

/** ไฟล์ของหน้า: /a/b → a/b/index.html · /a?x=1 → a/__x-1/index.html */
function pageFile(u) {
	let p = decode(u.pathname).replace(/^\/+|\/+$/g, "");
	if (u.search) p = posix.join(p, "__" + decode(u.search.slice(1)).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "-").slice(0, 80));
	return posix.join(p, "index.html");
}
/** ไฟล์ของ asset: มีนามสกุลและไม่มี query = ใช้ path เดิม · อื่นๆ = _assets/<hash>.<ext> */
function assetFile(u, type) {
	const p = decode(u.pathname).replace(/^\/+/, "");
	if (!u.search && /\.[a-z0-9]{2,5}$/i.test(p)) return p;
	return posix.join("_assets", hash(keyOf(u)) + (EXT_BY_TYPE[type?.split(";")[0].trim()] || ""));
}
/** ลิงก์ relative จากไฟล์ from ไปไฟล์ to (เข้ารหัสทีละส่วน) */
const rel = (from, to) => posix.relative(posix.dirname(from), to).split("/").map(encodeURIComponent).join("/") || "./";

async function get(u) {
	for (let i = 0; i < 3; i++) {
		try {
			const r = await fetch(u, { headers, redirect: "follow" });
			if (r.ok) return r;
			if (r.status === 404) return null;
		} catch {}
		await new Promise((r) => setTimeout(r, 800 * (i + 1)));
	}
	return null;
}

async function asset(raw, base) {
	let u;
	try { u = new URL(raw, base); } catch { return null; }
	if (u.origin !== ORIGIN || skip(u)) return null;
	u.hash = "";
	const key = keyOf(u);
	if (!assets.has(key)) {
		assets.set(key, (async () => {
			const r = await get(u);
			if (!r) { failed++; console.warn("  ✗ asset", key); return null; }
			const type = r.headers.get("content-type") || "";
			const file = assetFile(u, type);
			let body = Buffer.from(await r.arrayBuffer());
			if (type.includes("text/css")) body = Buffer.from(await rewriteCss(body.toString("utf8"), u, file));
			mkdirSync(dirname(join(OUT, file)), { recursive: true });
			writeFileSync(join(OUT, file), body);
			return file;
		})());
	}
	return assets.get(key);
}

async function rewriteCss(css, base, file) {
	const urls = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]).filter((x) => !x.startsWith("data:"));
	const map = new Map();
	for (const x of new Set(urls)) { const f = await asset(x, base); if (f) map.set(x, rel(file, f)); }
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, x) => (map.has(x) ? `url("${map.get(x)}")` : m));
}

function enqueuePage(u) {
	u.hash = "";
	const key = keyOf(u);
	if (pages.has(key) || skip(u)) return;
	pages.set(key, pageFile(u));
	queue.push(u);
}

async function crawlPage(u) {
	const file = pages.get(keyOf(u));
	const r = await get(u);
	if (!r) { failed++; console.warn("  ✗ page", keyOf(u)); return; }
	if (!(r.headers.get("content-type") || "").includes("text/html")) {
		// ลิงก์ไปไฟล์ (PDF ฯลฯ): เก็บเป็น asset แทน
		pages.delete(keyOf(u));
		await asset(u.href, u);
		return;
	}
	let html = await r.text();
	const final = new URL(r.url);

	// ลิงก์หน้าอื่น
	for (const m of html.matchAll(/<a\b[^>]*?\shref=(["'])(.*?)\1/gi)) {
		try { const v = new URL(m[2].replace(/&amp;/g, "&"), final); if (v.origin === ORIGIN && !/\.(pdf|jpe?g|png|webp|docx?|xlsx?|zip)$/i.test(v.pathname)) enqueuePage(v); else if (v.origin === ORIGIN) await asset(v.href, final); } catch {}
	}
	// asset: src, srcset, <link href>, style="url()", ไฟล์แนบ
	const refs = new Set();
	for (const m of html.matchAll(/\s(?:src|poster|data-src)=(["'])(.*?)\1/gi)) refs.add(m[2]);
	for (const m of html.matchAll(/\ssrcset=(["'])(.*?)\1/gi)) for (const part of m[2].split(",")) refs.add(part.trim().split(/\s+/)[0]);
	for (const m of html.matchAll(/<link\b[^>]*?\shref=(["'])(.*?)\1[^>]*>/gi)) if (!/rel=["']?(canonical|alternate)/i.test(m[0])) refs.add(m[2]);
	// url() ใน style= อาจเข้ารหัสเครื่องหมายคำพูดเป็น &quot; · ข้าม data: (ฝังในหน้าอยู่แล้ว)
	for (const m of html.matchAll(/url\(\s*(?:&quot;|['"])?([^'")&]+?)(?:&quot;|['"])?\s*\)/g)) if (!m[1].startsWith("data:")) refs.add(m[1]);
	for (const m of html.matchAll(/<a\b[^>]*?\shref=(["'])(.*?)\1/gi)) if (/\.(pdf|jpe?g|png|webp|docx?|xlsx?|zip)(\?|$)/i.test(m[2])) refs.add(m[2]);
	const amap = new Map();
	await Promise.all([...refs].map(async (x) => {
		const f = await asset(x.replace(/&amp;/g, "&"), final);
		if (f) amap.set(x, rel(file, f));
	}));

	// เขียนลิงก์ใหม่เป็น relative
	const toLocal = (val) => {
		if (amap.has(val)) return amap.get(val);
		try {
			const v = new URL(val.replace(/&amp;/g, "&"), final);
			if (v.origin !== ORIGIN) return val;
			const target = pages.get(keyOf(new URL(v.pathname + v.search, ORIGIN)));
			if (target) return rel(file, target) + v.hash;
		} catch {}
		return val;
	};
	html = html
		.replace(/(\s(?:href|src|poster|data-src)=)(["'])(.*?)\2/gi, (m, a, q, v) => (v.startsWith("#") || v.startsWith("data:") || v.startsWith("mailto:") || v.startsWith("tel:") ? m : `${a}${q}${toLocal(v)}${q}`))
		.replace(/(\ssrcset=)(["'])(.*?)\2/gi, (m, a, q, v) => `${a}${q}${v.split(",").map((p) => { const [x, ...d] = p.trim().split(/\s+/); return [toLocal(x), ...d].join(" "); }).join(", ")}${q}`)
		.replace(/url\(\s*(?:&quot;|['"])?([^'")&]+?)(?:&quot;|['"])?\s*\)/g, (m, x) => (amap.has(x) ? `url('${amap.get(x)}')` : m));
	mkdirSync(dirname(join(OUT, file)), { recursive: true });
	writeFileSync(join(OUT, file), html);
	console.log("  ✓", decode(keyOf(u)));
}

enqueuePage(new URL("/", ORIGIN));
for (const extra of ["/posts", "/shop", "/search", "/member", "/404"]) enqueuePage(new URL(extra, ORIGIN));
while (queue.length) {
	const batch = queue.splice(0, 4);
	await Promise.all(batch.map(crawlPage));
}
await Promise.all([...assets.values()]);
console.log(`\nเสร็จ: ${pages.size} หน้า · ${assets.size} ไฟล์ประกอบ · ไม่สำเร็จ ${failed} · โฟลเดอร์ ${OUT}`);
