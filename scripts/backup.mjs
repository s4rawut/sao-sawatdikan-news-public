/**
 * Back up the self-hosted site while it runs: SQLite database (online backup, safe with WAL) + uploads folder.
 *
 *   npm run backup            → <BACKUP_DIR>/<YYYY-MM-DD_HHMM>/{emdash.db, uploads/}
 *
 * Run it daily from cron / a systemd timer (docs/self-hosting.md). Keeps the newest BACKUP_KEEP copies (default 14).
 * Copy the backup folder to another machine as well; a backup on the same disk does not survive a disk failure.
 */
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

const DB = resolve(process.env.DATABASE_PATH || "./data/emdash.db");
const UPLOADS = resolve(process.env.UPLOADS_DIR || "./data/uploads");
const OUT = resolve(process.env.BACKUP_DIR || "./backups");
const KEEP = Number(process.env.BACKUP_KEEP || 14);

const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 16).replace(" ", "_").replace(":", "");
const dir = join(OUT, stamp);
mkdirSync(dir, { recursive: true });

const src = new DatabaseSync(DB, { readOnly: true });
await backup(src, join(dir, "emdash.db"));
src.close();
cpSync(UPLOADS, join(dir, "uploads"), { recursive: true });

const all = readdirSync(OUT).filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort();
for (const old of all.slice(0, Math.max(0, all.length - KEEP))) rmSync(join(OUT, old), { recursive: true, force: true });
console.log(`สำรองข้อมูลแล้ว: ${dir} (เก็บไว้ ${Math.min(all.length, KEEP)} ชุดล่าสุด)`);
