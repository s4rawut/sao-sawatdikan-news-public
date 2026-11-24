/**
 * Build the self-hosted (Node.js) version: DEPLOY_TARGET=node + settings from .env (SITE_URL, ALLOWED_HOSTS, paths).
 * Works the same on Linux and Windows.   npm run build
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DEPLOY_TARGET = "node";
if (!process.env.EMDASH_SITE_URL && !process.env.SITE_URL) console.warn("⚠ ยังไม่ได้ตั้ง SITE_URL ใน .env — การส่งฟอร์มผ่านโดเมนจริงจะถูกปฏิเสธ (ดู docs/self-hosting.md)");
const r = spawnSync(process.execPath, ["node_modules/astro/bin/astro.mjs", "build"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
