/**
 * Create a one-time sign-in link for an EmDash admin/editor on the self-hosted server.
 *
 * Passkeys only work on the domain where they were created, so after moving to the IT server the
 * old passkeys (made on the test site) stop working. Run this on the server, open the printed link
 * within 15 minutes, then go to Settings → Security → Register Passkey to create a passkey for the
 * new domain. Same token format as EmDash's emailed sign-in links (@emdash-cms/auth createMagicLinkUrl).
 *
 *   node scripts/admin-login-link.mjs <email> [site-url] [database]
 *   node scripts/admin-login-link.mjs --list            (show EmDash users)
 *
 * site-url defaults to $EMDASH_SITE_URL / $SITE_URL; database to $DATABASE_PATH or ./data/emdash.db.
 */
import { generateTokenWithHash } from "@emdash-cms/auth";
import { DatabaseSync } from "node:sqlite";

const [arg, siteArg, dbArg] = process.argv.slice(2);
const db = new DatabaseSync(dbArg || process.env.DATABASE_PATH || "./data/emdash.db");
const ROLES = { 10: "Subscriber", 20: "Contributor", 30: "Author", 40: "Editor", 50: "Admin" };

if (!arg || arg === "--list") {
	for (const u of db.prepare("SELECT email, name, role, disabled FROM users ORDER BY role DESC").all())
		console.log(`${u.email}\t${ROLES[u.role] || u.role}${u.disabled ? " (ปิดใช้งาน)" : ""}\t${u.name || ""}`);
	if (!arg) console.log("\nใช้: node scripts/admin-login-link.mjs <email> [site-url]");
	process.exit(0);
}

const site = siteArg || process.env.EMDASH_SITE_URL || process.env.SITE_URL;
if (!site) { console.error("ระบุที่อยู่เว็บ เช่น https://welfare.oag.go.th (หรือตั้ง EMDASH_SITE_URL)"); process.exit(1); }
const user = db.prepare("SELECT id, email FROM users WHERE lower(email) = lower(?)").get(arg);
if (!user) { console.error(`ไม่พบผู้ใช้ ${arg} — ดูรายชื่อด้วย --list`); process.exit(1); }

const { token, hash } = generateTokenWithHash();
const now = new Date();
db.prepare("INSERT INTO auth_tokens (hash, user_id, email, type, expires_at, created_at) VALUES (?, ?, ?, 'magic_link', ?, ?)")
	.run(hash, user.id, user.email, new Date(now.getTime() + 15 * 60_000).toISOString(), now.toISOString());
const url = new URL("/_emdash/api/auth/magic-link/verify", site);
url.searchParams.set("token", token);
console.log(`ลิงก์เข้าสู่ระบบของ ${user.email} (ใช้ได้ครั้งเดียว ภายใน 15 นาที):\n${url}`);
console.log("เข้าแล้วไปที่ Settings → Security → Register Passkey เพื่อสร้าง passkey ของโดเมนนี้");
