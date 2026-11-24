/**
 * ด่านรหัสผ่านทั้งเว็บ: ให้เฉพาะบุคลากรภายในที่รู้ชื่อผู้ใช้/รหัสผ่านเข้าดูได้ (ช่วงทดสอบระบบ)
 *
 * - ชื่อผู้ใช้และรหัสผ่านตั้งใน .env: SITE_GATE_USER / SITE_GATE_PASS
 *   ไม่ได้ตั้ง = ปิดด่าน (เว็บเปิดตามปกติ)
 * - เข้าสำเร็จแล้วจำในคุกกี้ 30 วัน · เปลี่ยนรหัสผ่าน = คุกกี้เดิมใช้ไม่ได้ ทุกคนต้องใส่รหัสใหม่
 * - ยกเว้น /_emdash (หลังบ้าน EmDash มีระบบล็อกอินของตัวเอง และ CLI/MCP เรียก API ด้วย bearer token)
 */
import { env } from "cloudflare:workers";

export const GATE_PATH = "/site-login";
const COOKIE_DAYS = 30;
const EXEMPT_FILES = new Set(["/favicon.png", "/logo.png", "/robots.txt"]);

interface GateEnv {
	SITE_GATE_USER?: string;
	SITE_GATE_PASS?: string;
}
const creds = () => {
	const e = env as unknown as GateEnv;
	const user = (e.SITE_GATE_USER ?? "").trim();
	const pass = e.SITE_GATE_PASS ?? "";
	return user && pass ? { user, pass } : null;
};

export const gateEnabled = () => creds() !== null;

/** หน้าที่ไม่ต้องผ่านด่าน */
export const isGateExempt = (path: string) =>
	path === GATE_PATH || path.startsWith("/_emdash") || path.startsWith("/_astro/") || EXEMPT_FILES.has(path);

const cookieName = (url: URL) => (url.protocol === "https:" ? "__Host-site_gate" : "site_gate");
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** ค่าคุกกี้ = HMAC ของชื่อผู้ใช้+รหัสผ่าน (เปลี่ยนรหัส = ค่าใหม่) ไม่เก็บรหัสผ่านในคุกกี้ */
async function gateToken(user: string, pass: string) {
	const key = await crypto.subtle.importKey("raw", enc.encode(`${user}\n${pass}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return hex(await crypto.subtle.sign("HMAC", key, enc.encode("sao-welfare-site-gate-v1")));
}

/** เทียบสตริงแบบใช้เวลาเท่ากัน กันการเดาทีละตัวอักษรจากเวลาตอบ */
function safeEqual(a: string, b: string) {
	let diff = a.length ^ b.length;
	for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	return diff === 0;
}

const readCookie = (req: Request, name: string) =>
	(req.headers.get("cookie") ?? "")
		.split(/;\s*/)
		.map((c) => c.split("="))
		.find(([k]) => k === name)?.[1] ?? "";

export async function hasGatePass(req: Request, url: URL) {
	const c = creds();
	if (!c) return true;
	const got = readCookie(req, cookieName(url));
	return !!got && safeEqual(got, await gateToken(c.user, c.pass));
}

/** ปลายทางหลังเข้าสำเร็จ: เฉพาะ path ภายในเว็บ (กันการพาไปเว็บอื่น) */
const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith(GATE_PATH) ? v : "/");

/** คำขอที่ยังไม่ผ่านด่าน: หน้าเว็บพาไปหน้าใส่รหัส · คำขออื่น (API, ไฟล์) ตอบ 401 */
export function gateRedirect(req: Request, url: URL) {
	const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
	if (req.method === "GET" && wantsHtml) {
		const next = encodeURIComponent(url.pathname + url.search);
		return new Response(null, { status: 302, headers: { location: `${GATE_PATH}?next=${next}`, "cache-control": "no-store" } });
	}
	return new Response(JSON.stringify({ error: "กรุณาเข้าสู่เว็บไซต์ด้วยรหัสผ่านก่อน" }), {
		status: 401,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
}

/** หน้าใส่รหัส (GET) และตรวจรหัส (POST) */
export async function handleGate(req: Request, url: URL) {
	const c = creds();
	if (!c) return new Response(null, { status: 302, headers: { location: "/" } });
	if (req.method === "POST") {
		const form = await req.formData().catch(() => null);
		const user = String(form?.get("user") ?? "").trim();
		const pass = String(form?.get("pass") ?? "");
		const next = safeNext(String(form?.get("next") ?? ""));
		const ok = safeEqual(user.toLowerCase(), c.user.toLowerCase()) && safeEqual(pass, c.pass);
		if (!ok) {
			await new Promise((r) => setTimeout(r, 600)); // ชะลอการเดารหัส
			return gatePage(next, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
		}
		const secure = url.protocol === "https:" ? "; Secure" : "";
		return new Response(null, {
			status: 303,
			headers: {
				location: next,
				"cache-control": "no-store",
				"set-cookie": `${cookieName(url)}=${await gateToken(c.user, c.pass)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_DAYS * 86400}${secure}`,
			},
		});
	}
	return gatePage(safeNext(url.searchParams.get("next")));
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function gatePage(next: string, error = "", status = 200) {
	const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>เข้าสู่เว็บไซต์ — สวัสดิการ สตง.</title>
<link rel="icon" type="image/png" href="/favicon.png">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;font-family:"IBM Plex Sans Thai","Sarabun","Noto Sans Thai",system-ui,sans-serif;background:linear-gradient(160deg,#0b1f47,#1d4185);color:#1d2433}
.card{width:100%;max-width:400px;background:#fff;border-radius:18px;padding:32px 28px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.brand img{width:56px;height:56px;border-radius:50%}
.brand b{display:block;font-size:1.25rem;color:#0f2a5c}
.brand span{font-size:.85rem;color:#5f6b7f}
h1{margin:0 0 6px;font-size:1.15rem;color:#0f2a5c}
p{margin:0 0 18px;color:#5f6b7f;font-size:.95rem;line-height:1.6}
label{display:block;margin-bottom:14px;font-weight:600;font-size:.92rem}
input{display:block;width:100%;margin-top:6px;padding:11px 13px;border:1px solid #d8d3c6;border-radius:10px;font:inherit;font-size:1rem}
input:focus{outline:3px solid rgba(29,65,133,.25);border-color:#1d4185}
button{width:100%;margin-top:6px;padding:12px;border:0;border-radius:10px;background:#0f2a5c;color:#fff;font:inherit;font-size:1rem;font-weight:700;cursor:pointer}
button:hover{background:#1d4185}
.err{margin-bottom:14px;padding:10px 12px;border-radius:10px;background:#fdecea;color:#b42318;font-size:.92rem}
.foot{margin-top:18px;text-align:center;font-size:.8rem;color:#8a93a3}
</style></head><body>
<main class="card">
<div class="brand"><img src="/logo.png" alt=""><div><b>สวัสดิการ สตง.</b><span>สำนักงานการตรวจเงินแผ่นดิน</span></div></div>
<h1>เข้าสู่เว็บไซต์</h1>
<p>เว็บไซต์อยู่ระหว่างทดสอบ เปิดให้เฉพาะบุคลากรภายใน กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน</p>
${error ? `<div class="err" role="alert">${escHtml(error)}</div>` : ""}
<form method="post" action="${GATE_PATH}">
<input type="hidden" name="next" value="${escHtml(next)}">
<label>ชื่อผู้ใช้<input name="user" autocomplete="username" autocapitalize="none" required autofocus></label>
<label>รหัสผ่าน<input name="pass" type="password" autocomplete="current-password" required></label>
<button type="submit">เข้าสู่เว็บไซต์</button>
</form>
<div class="foot">ระบบจะจำการเข้าสู่ระบบไว้ ${COOKIE_DAYS} วันในเบราว์เซอร์นี้</div>
</main></body></html>`;
	return new Response(html, {
		status,
		headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
	});
}
