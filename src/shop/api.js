/**
 * ร้านสวัสดิการ สตง. — API ฝั่งสมาชิก (ย้ายมาจาก sao-welfare-shop)
 * ทำงานใน Worker เดียวกับ EmDash ใช้ D1 ก้อนเดียวกัน: ตารางของร้านขึ้นต้นด้วย shop_
 * สินค้าคือ collection "products" ของ EmDash (ตาราง ec_products) — ตัดสต็อกที่ตารางนั้นโดยตรง
 */

import { kvBucket } from "../storage/kv-bucket.js";
import { PICKUP_POINTS, isRegionalPickup } from "./pickup.js";
import { parseTierText, planNote, priceBundles, priceTiers, productPlan, tierText, unitPrice } from "./pricing.js";
import { HOURS_DEFAULTS, parseDays } from "./hours.js";

export const STATUS_LABEL = {
  pending_payment: 'รอชำระเงิน',
  verifying: 'รอตรวจสอบการชำระเงิน',
  paid: 'ชำระเงินเรียบร้อย',
  preparing: 'กำลังจัดเตรียมสินค้า',
  shipped: 'พร้อมให้รับสินค้า',
  // ส่วนภูมิภาค: ส่งทางไปรษณีย์ แล้วผู้ซื้อชำระค่าส่งให้ผู้ส่งสินค้า (บัญชีแยกจากร้าน)
  received: 'ได้รับสินค้าแล้ว (รอแจ้งค่าส่งไปรษณีย์)',
  postage_due: 'รอชำระค่าส่งไปรษณีย์',
  postage_verifying: 'รอตรวจสอบค่าส่งไปรษณีย์',
  completed: 'ได้รับสินค้าแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

export const DEFAULT_SETTINGS = {
  shop_name: 'ร้านค้าสวัสดิการ สตง.',
  shop_tagline: 'ร้านค้าสวัสดิการ สำนักงานการตรวจเงินแผ่นดิน',
  bank_name: '',
  bank_account_no: '',
  bank_account_name: '',
  promptpay_id: '',
  allow_delivery: '0', // ไม่มีบริการจัดส่งถึงบ้าน: รับเองที่ส่วนกลางหรือสำนักงานภูมิภาค (PICKUP_POINTS)
  shipping_fee: '0',
  pickup_location: 'รับสินค้าได้ในวันและเวลาราชการ หลังได้รับแจ้งว่าสินค้าพร้อมให้รับ',
  admin_notify_email: '',
  // สินค้าหมวด "สินค้าอื่นๆ" ไม่ขายผ่านระบบ: หน้าเว็บแสดงช่องทางสั่งซื้อนี้แทนปุ่มหยิบใส่ตะกร้า
  others_line_url: '',
  others_phone: '',
  auto_cancel_hours: '48',
  // ข้อมูลติดต่อร้าน แสดงใต้ชื่อหน้า "ร้านค้าสวัสดิการ" (หลายบรรทัด · เบอร์โทรกดโทรได้)
  shop_contact: '',
  // '1' = พักการส่งอีเมลทั้งหมด (แจ้งคำสั่งซื้อ สถานะ รีเซ็ตรหัสผ่าน) — เปิด/ปิดได้ในหน้าตั้งค่าร้าน
  mail_paused: '0',
  // บัญชีรับค่าส่งไปรษณีย์ (ของผู้ส่งสินค้า แยกจากบัญชีร้าน) — ค่าเริ่มต้นตอนแจ้งยอดค่าส่ง แก้ได้ทุกคำสั่งซื้อ
  postage_account: '',
  postage_bank_name: '',
  postage_account_no: '',
  postage_account_name: '',
  postage_promptpay: '',
  // ที่อยู่สำหรับส่งไปรษณีย์ของแต่ละสำนักงานส่วนภูมิภาค: JSON {"ชื่อจุดรับ": "ที่อยู่"} — ผู้ขายกำหนดเองในหน้าตั้งค่าร้าน
  pickup_addresses: '{}',
  // สถานะเปิด/ปิดร้าน (src/shop/hours.js) — อัตโนมัติตามวันเวลาทำการ หรือผู้ขายกำหนดเอง
  ...HOURS_DEFAULTS,
  // ที่อยู่ผู้ส่ง มุมซ้ายบนของใบปะหน้าพัสดุ
  label_sender: 'สวัสดิการสำนักงานการตรวจเงินแผ่นดิน\nถนนพระรามที่ 6 แขวงพญาไท เขตพญาไท กรุงเทพฯ 10400', // เบอร์โทรผู้ส่งตั้งในหลังบ้านร้าน → ตั้งค่า
};
const PRIVATE_SETTINGS = ['admin_notify_email', 'postage_account', 'postage_bank_name', 'postage_account_no', 'postage_account_name', 'postage_promptpay', 'pickup_addresses'];
/** บัญชีรับค่าส่งไปรษณีย์ (ของผู้ส่งสินค้า แยกจากบัญชีร้าน) เป็นข้อความหลายบรรทัด สำหรับแจ้งผู้ซื้อ */
const postageAccountText = (s) => [
  s.postage_bank_name && `ธนาคาร ${s.postage_bank_name}`,
  s.postage_account_no && `เลขที่บัญชี ${s.postage_account_no}`,
  s.postage_account_name && `ชื่อบัญชี ${s.postage_account_name}`,
  s.postage_promptpay && `พร้อมเพย์ ${s.postage_promptpay}`,
].filter(Boolean).join('\n') || s.postage_account || '';
const pickupAddresses = (s) => { try { const o = JSON.parse(s.pickup_addresses || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
/** จุดรับสินค้า: src/shop/pickup.js (ส่วนกลาง + ส่วนภูมิภาค) */
export { PICKUP_POINTS };
/** ข้อมูลบัญชีรับเงิน: ระหว่างโหมดทดสอบการชำระเงินจะไม่ส่งออกไปที่หน้าเว็บหรืออีเมลเลย */
const PAYMENT_SETTINGS = ['bank_name', 'bank_account_no', 'bank_account_name', 'promptpay_id'];
/** SHOP_PAYMENT_MODE=demo (ตั้งใน .env): แสดง QR ตัวอย่างแทนบัญชีจริง เพื่อทดสอบระบบโดยไม่เปิดเผยชื่อและเลขบัญชี */
export const isPaymentDemo = (env) => String(env.SHOP_PAYMENT_MODE || '').toLowerCase() === 'demo';

/* ไฟล์ที่สมาชิกอัปโหลดได้ (สลิป): เฉพาะ JPG/PNG ไม่เกิน 1.5 MB — หน้าเว็บย่อรูปเป็น JPG ให้ก่อนส่ง
 * ต้องตรงกับ SLIP_UPLOAD ใน public/shop/common.js (ฝั่งหน้าเว็บตรวจซ้ำอีกชั้น) */
const MAX_FILE = 1_500_000;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const IMAGE_EXT = { jpg: 'jpg', jpeg: 'jpg', png: 'png' };
const EMAIL_RE = /^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const SESSION_HOURS = 24 * 7; // สมาชิก: 7 วัน
const RESET_TTL_MIN = 30; // ลิงก์รีเซ็ตรหัสผ่านมีอายุ 30 นาที
const MAX_BODY = 3_000_000;
/** ชื่อผู้ใช้: a-z 0-9 . _ - ยาว 4–32 ตัว ขึ้นต้นด้วยตัวอักษรหรือตัวเลข (บัญชีเดิมที่สมัครด้วยอีเมลยังใช้อีเมลเป็นชื่อผู้ใช้) */
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{3,31}$/;
/** เทียบชื่อแบบไม่สนช่องว่าง/จุด และคำนำหน้าแบบย่อ เช่น "น.ส. สมหญิง  ใจดี" = "นางสาวสมหญิง ใจดี" */
function nameKey(v) {
  let t = String(v ?? '').normalize('NFC').replace(/[\s\u200b\u00a0.]/g, '');
  for (const [a, b] of [['นส', 'นางสาว'], ['ว่าที่รต', 'ว่าที่ร้อยตรี'], ['วาที่รต', 'ว่าที่ร้อยตรี']]) {
    if (t.startsWith(a) && !t.startsWith(b)) { t = b + t.slice(a.length); break; }
  }
  return t;
}
const fullNameOf = (b) => [clean(b.prefix, 40) + clean(b.first_name, 60), clean(b.last_name, 60)].filter(Boolean).join(' ');
const cleanMail = (v) => String(v ?? '').replace(/[\s\u200b\u00a0]/g, '').toLowerCase().slice(0, 120);
/** วันเกิด "YYYY-MM-DD" (ค.ศ.) ที่เป็นวันจริง · ไม่ถูกต้อง = '' */
function isoDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] > 1900 ? m[0] : '';
}
/** ค่าที่เก็บแทนวันเกิด: SHA-256 ของ "อีเมล|YYYY-MM-DD" — หน้าหลังบ้านคำนวณแบบเดียวกันตอนอ่านไฟล์ (admin.js dobHash)
 * จึงไม่ต้องเก็บวันเกิดจริงไว้ในระบบ */
const dobHash = (email, iso) => sha256(`${email}|${iso}`);
const REG_FAIL_MSG = 'ข้อมูลไม่ตรงกับรายชื่อบุคลากร กรุณาตรวจสอบอีเมลสำนักงานและวันเดือนปีเกิด';
const REG_MAX_FAILS = 3;
const REG_LOCKED_MSG = 'สิทธิ์ของท่านถูกล็อก เนื่องจากกรอกข้อมูลไม่ถูกต้องครบ 3 ครั้ง กรุณาติดต่อเจ้าหน้าที่สวัสดิการเพื่อปลดล็อก';
/** ตรวจสิทธิ์สมัครสมาชิก: อีเมลสำนักงาน + วันเดือนปีเกิด กับรายชื่อบุคลากรที่อัปโหลด · ผ่าน = แถวในรายชื่อ
 * กันการไล่เดา: วันเกิดผิดครบ 3 ครั้งต่อรายชื่อ = ล็อกจนเจ้าหน้าที่ปลดล็อก (POST /admin/roster/unlock)
 * · ผิดรวมทั้งระบบเกิน 200 ครั้งต่อชั่วโมง ปิดการตรวจชั่วคราว · อีเมลที่ไม่มีในรายชื่อจำกัดต่อเครือข่าย (regv:<ip>) */
async function checkRoster(env, req, b) {
  const email = cleanMail(b.office_email);
  const dob = isoDate(b.birth_date);
  if (!EMAIL_RE.test(email)) fail(400, 'กรุณากรอกอีเมลสำนักงานให้ถูกต้อง');
  if (!dob) fail(400, 'กรุณาเลือกวันเดือนปีเกิดให้ครบ');
  const any = await env.DB.prepare('SELECT 1 AS x FROM shop_roster_mail WHERE dob_hash IS NOT NULL LIMIT 1').first();
  if (!any) fail(503, 'ระบบยังไม่มีรายชื่อบุคลากร กรุณาติดต่อเจ้าหน้าที่สวัสดิการ');
  if ((await peekLimit(env, 'regv-fail:all')).count >= 200) fail(429, 'ระบบปิดการตรวจสอบสิทธิ์ชั่วคราว กรุณาลองใหม่ภายหลัง หรือติดต่อเจ้าหน้าที่สวัสดิการ');
  const r = await env.DB.prepare('SELECT * FROM shop_roster_mail WHERE email = ?').bind(email).first();
  if (r?.locked_at) fail(423, REG_LOCKED_MSG);
  if (!r || !r.dob_hash || r.dob_hash !== (await dobHash(email, dob))) {
    try { await hitLimit(env, 'regv-fail:all', 1e9, 3600); } catch {}
    await audit(env, req, 'register_check_fail', { email }); // ไม่บันทึกวันเกิดที่กรอก
    if (!r) fail(400, REG_FAIL_MSG);
    // นับครั้งที่ผิดของรายชื่อนี้ ครบ 3 = ล็อก
    const u = await env.DB.prepare(
      `UPDATE shop_roster_mail SET check_fails = check_fails + 1,
         locked_at = CASE WHEN check_fails + 1 >= ? THEN datetime('now') ELSE locked_at END
       WHERE email = ? RETURNING check_fails, locked_at`
    ).bind(REG_MAX_FAILS, email).first();
    if (u?.locked_at) {
      await audit(env, req, 'register_locked', { email });
      fail(423, REG_LOCKED_MSG);
    }
    fail(400, `${REG_FAIL_MSG} (เหลือโอกาสอีก ${REG_MAX_FAILS - (u?.check_fails || 0)} ครั้ง ก่อนสิทธิ์ถูกล็อก)`);
  }
  if (r.check_fails) await env.DB.prepare('UPDATE shop_roster_mail SET check_fails = 0 WHERE email = ?').bind(email).run();
  if (await env.DB.prepare('SELECT id FROM shop_members WHERE office_email = ? AND closed_at IS NULL').bind(email).first())
    fail(409, 'อีเมลสำนักงานนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ หากจำชื่อผู้ใช้หรือรหัสผ่านไม่ได้ ใช้ “ลืมรหัสผ่าน”');
  return r;
}
/** "นายสมชาย ใจดี" → { first: "นายสมชาย", last: "ใจดี" } */
function splitName(full) {
  const t = String(full ?? '').trim().split(/\s+/);
  return { first: t[0] || '', last: t.slice(1).join(' ') };
}

/** สินค้าที่ขายได้ = เผยแพร่แล้ว และไม่อยู่ในถังขยะ */
const LIVE_PRODUCT = `status = 'published' AND deleted_at IS NULL`;
/** หมวดที่สั่งซื้อผ่าน LINE/โทรศัพท์เท่านั้น — ตรงกับ OTHER_CATEGORY ใน src/utils/shop.ts */
const OTHER_CATEGORY = 'สินค้าอื่นๆ';

class HttpError extends Error {
  constructor(status, message, headers, extra) { super(message); this.status = status; this.headers = headers; this.extra = extra; }
}
/** extra = ฟิลด์เพิ่มในคำตอบ JSON เช่น { need_email: true } */
export const fail = (status, message, headers, extra) => { throw new HttpError(status, message, headers, extra); };
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...headers },
  });
export const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ schema */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS shop_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    department TEXT DEFAULT '',
    address TEXT DEFAULT '',
    password_changed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS shop_sessions (token TEXT PRIMARY KEY, member_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_sessions_member ON shop_sessions(member_id)`,
  `CREATE TABLE IF NOT EXISTS shop_password_resets (
    token_hash TEXT PRIMARY KEY, member_id INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    used_at INTEGER, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS shop_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shop_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER, email TEXT, event TEXT NOT NULL,
    detail TEXT, ip TEXT, ua TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS shop_settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS shop_stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, delta INTEGER NOT NULL, balance INTEGER,
    reason TEXT, ref TEXT, admin TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_shop_stock_logs_product ON shop_stock_logs(product_id)`,
  // ตัดสต็อกแบบ "ทั้งหมดหรือไม่เลย": แทรกยอดคงเหลือหลังหักลงตารางนี้ก่อน ถ้าติดลบ CHECK จะล้มทั้งชุด
  `CREATE TABLE IF NOT EXISTS shop_stock_guard (balance INTEGER NOT NULL CHECK (balance >= 0))`,
  `CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    member_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    subtotal REAL NOT NULL,
    shipping_fee REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    delivery_method TEXT NOT NULL DEFAULT 'pickup',
    recipient_name TEXT, phone TEXT, address TEXT, note TEXT,
    slip_key TEXT, slip_uploaded_at TEXT, paid_at TEXT, tracking_no TEXT, admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_shop_orders_member ON shop_orders(member_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status)`,
  `CREATE TABLE IF NOT EXISTS shop_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id TEXT, sku TEXT,
    name TEXT NOT NULL, unit TEXT, price REAL NOT NULL, qty INTEGER NOT NULL, line_total REAL NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id)`,
  `CREATE TABLE IF NOT EXISTS shop_order_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, status TEXT NOT NULL, note TEXT,
    by_member INTEGER, by_admin TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_shop_order_logs_order ON shop_order_logs(order_id)`,
  // แอดมินย่อย: สมาชิกร้านที่แอดมินใหญ่ให้สิทธิ์เฉพาะเรื่อง (ถอดสิทธิ์ = ลบแถว บัญชีสมาชิกยังอยู่)
  `CREATE TABLE IF NOT EXISTS shop_staff (
    member_id INTEGER PRIMARY KEY, perms TEXT NOT NULL DEFAULT '[]', must_change_password INTEGER NOT NULL DEFAULT 0,
    created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  // แบบย่อยของสินค้า (สี/ไซส์) แต่ละแบบมีสต็อกของตัวเอง; สต็อกของสินค้า = ผลรวมของทุกแบบ (sync ทุกครั้งที่เปลี่ยน)
  // CHECK ทำให้การตัดสต็อกที่จะติดลบล้มทั้งชุด (transaction) เหมือน shop_stock_guard
  `CREATE TABLE IF NOT EXISTS shop_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, color TEXT NOT NULL DEFAULT '', size TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (product_id, color, size))`,
  `CREATE INDEX IF NOT EXISTS idx_shop_variants_product ON shop_variants(product_id)`,
  // (เดิม) ทะเบียนตามเลขประจำตัวข้าราชการ — เลิกใช้แล้ว เก็บไว้ไม่ให้ข้อมูลเดิมหาย
  `CREATE TABLE IF NOT EXISTS shop_roster (
    emp_id TEXT PRIMARY KEY, full_name TEXT NOT NULL, name_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  // รายชื่อบุคลากรที่ผู้ดูแลอัปโหลดจากไฟล์ Excel (no, name, email): ใช้ตรวจสิทธิ์ตอนสมัครสมาชิก
  `CREATE TABLE IF NOT EXISTS shop_roster_mail (
    email TEXT PRIMARY KEY, no TEXT, full_name TEXT NOT NULL, name_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];
/** คอลัมน์ที่เพิ่มภายหลังในตารางที่มีอยู่แล้ว — ADD COLUMN ซ้ำจะ error จึงตรวจจาก PRAGMA ก่อน */
const MIGRATIONS = [
  ['shop_order_items', 'variant_id', 'INTEGER'],
  ['shop_order_items', 'variant', 'TEXT'],
  ['shop_stock_logs', 'variant_id', 'INTEGER'],
  ['shop_stock_logs', 'variant', 'TEXT'],
  ['shop_orders', 'pickup_point', 'TEXT'],
  ['shop_members', 'closed_at', 'TEXT'],
  // เลขประจำตัวข้าราชการที่ใช้สมัคร (1 เลข = 1 บัญชี) · คอลัมน์ email เก็บ "ชื่อผู้ใช้" ที่ใช้เข้าสู่ระบบ (บัญชีเดิมคืออีเมล)
  ['shop_members', 'emp_id', 'TEXT'],
  // อีเมลสำนักงานที่ใช้สมัคร (1 อีเมล = 1 บัญชี)
  ['shop_members', 'office_email', 'TEXT'],
  // รายชื่อบุคลากร: ใช้ตรวจสิทธิ์สมัครสมาชิก (เลขบัตรประชาชน 4 ตัวท้าย + ปีเกิด พ.ศ.) — ไม่เก็บเลขบัตรเต็ม/วันเกิดเต็ม
  // (เลิกใช้) เลขบัตร 4 ตัวท้าย + ปีเกิด — คงคอลัมน์ไว้ ไม่มีข้อมูลใหม่เขียนลง
  ['shop_roster_mail', 'id_last4', 'TEXT'],
  ['shop_roster_mail', 'birth_year', 'TEXT'],
  // ตรวจสิทธิ์สมัครสมาชิก: SHA-256 ของ "อีเมล|วันเกิด YYYY-MM-DD" (ไม่เก็บวันเกิดจริง)
  ['shop_roster_mail', 'dob_hash', 'TEXT'],
  // ตรวจสิทธิ์ผิดครบ 3 ครั้ง = ล็อกรายชื่อนั้น จนเจ้าหน้าที่ปลดล็อกในหลังบ้านร้าน (หน้าอัปโหลดไฟล์)
  ['shop_roster_mail', 'check_fails', 'INTEGER NOT NULL DEFAULT 0'],
  ['shop_roster_mail', 'locked_at', 'TEXT'],
  // ค่าส่งไปรษณีย์ (ส่วนภูมิภาค)
  ['shop_orders', 'postage_amount', 'REAL'],
  ['shop_orders', 'postage_account', 'TEXT'],
  ['shop_orders', 'postage_receipt_key', 'TEXT'],
  ['shop_orders', 'postage_billed_at', 'TEXT'],
  ['shop_orders', 'postage_slip_key', 'TEXT'],
  ['shop_orders', 'postage_slip_at', 'TEXT'],
  ['shop_orders', 'postage_paid_at', 'TEXT'],
  // ราคาแบบชุด: ข้อความอธิบายการคิดราคาของรายการ เช่น "โปรโมชั่น: ชุด 3 ชิ้น ฿100 + 1 ชิ้น ชิ้นละ ฿50"
  ['shop_order_items', 'promo_note', 'TEXT'],
];
/* จำแค่ "ทำเสร็จแล้ว" เป็น boolean ห้ามเก็บ Promise ข้ามคำขอ: Workers ไม่ยอมให้คำขอหนึ่งรอ Promise ที่คำขออื่นสร้าง
 * (error "This promise was created by a request that has since ended") ซึ่งเคยทำให้ API ร้านค้า error 500 สลับกับสำเร็จ
 * ถ้าหลายคำขอเริ่มพร้อมกันอาจรันซ้ำได้ แต่ทุกคำสั่งรันซ้ำได้ปลอดภัย (IF NOT EXISTS / ข้ามคอลัมน์ที่มีแล้ว) */
let schemaDone = false;
export async function ensureSchema(env) {
  if (schemaDone) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  for (const [table, col, type] of MIGRATIONS) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    if (results.some((c) => c.name === col)) continue;
    try {
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e?.message || e) + String(e?.cause?.message || ''))) throw e;
    }
  }
  schemaDone = true;
}

/* ---------------------------------------------------------------- variants */
/** "สีดำ / ไซส์ M" */
export const variantLabel = (v) => [v.color, v.size && `ไซส์ ${v.size}`].filter(Boolean).join(' / ');
/** สต็อกรวมของสินค้าที่มีแบบย่อย = ผลรวมสต็อกทุกแบบ */
const syncProductStock = (env, pid) =>
  env.DB.prepare(`UPDATE ec_products SET stock = (SELECT COALESCE(SUM(stock), 0) FROM shop_variants WHERE product_id = ?) WHERE id = ?`).bind(pid, pid);
/** Map product_id -> แบบย่อยทั้งหมด (เรียงตามลำดับที่ตั้งไว้) */
async function variantsByProduct(env, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const { results } = await env.DB.prepare(
    `SELECT id, product_id, color, size, stock FROM shop_variants WHERE product_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort, id`
  ).bind(...ids).all();
  for (const v of results) {
    if (!map.has(v.product_id)) map.set(v.product_id, []);
    map.get(v.product_id).push({ id: v.id, color: v.color, size: v.size, stock: v.stock, label: variantLabel(v) });
  }
  return map;
}
const isCheckError = (e) => /CHECK constraint/i.test(String(e?.message || e) + String(e?.cause?.message || ''));

/* ------------------------------------------------------------------ router */
const routes = [];
const on = (method, pattern, handler, auth) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, auth });

/** แอดมินใหญ่ = ผู้ใช้ EmDash ระดับ Admin (50) */
export const OWNER_ROLE = 50;
/** สิทธิ์ที่มอบให้แอดมินย่อยได้ ส่วนตั้งค่าร้าน จัดการผู้ดูแล รีเซ็ตรหัส และบันทึกความปลอดภัย สงวนไว้ให้แอดมินใหญ่ */
export const STAFF_PERMS = {
  orders_view: 'ดูคำสั่งซื้อ สลิป และยอดขาย',
  orders_payment: 'ตรวจสลิปและยืนยันการชำระเงิน',
  orders_fulfill: 'จัดเตรียมและส่งมอบสินค้า',
  orders_cancel: 'ยกเลิกคำสั่งซื้อและคืนสต็อก',
  orders_export: 'ส่งออกข้อมูลคำสั่งซื้อ',
  stock_manage: 'ดูสินค้าและปรับสต็อก',
  members_view: 'ดูรายชื่อสมาชิก',
  shop_owner: 'แอดมินร้านค้า — จัดการได้ทุกอย่าง (ตั้งค่าร้าน ผู้ดูแลร้าน บันทึกความปลอดภัย ย้อนสถานะ)',
};
const staffName = (staff) => staff.name || staff.email;
const can = (staff, perm) => staff.owner || (perm !== 'owner' && staff.perms.includes(perm));
const requirePerm = (staff, perm) => { if (!can(staff, perm)) fail(403, 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้'); };

/** ผู้ที่เรียกหลังบ้านร้าน: แอดมินใหญ่ (ผู้ใช้ EmDash) หรือแอดมินย่อย (สมาชิกที่อยู่ใน shop_staff) — ตรวจจากฐานข้อมูลทุกครั้ง เพื่อให้ถอดสิทธิ์มีผลทันที */
async function resolveStaff(req, env, emdashUser) {
  if (emdashUser?.role >= OWNER_ROLE) {
    return { owner: true, emdash: true, name: emdashUser.name, email: emdashUser.email, perms: Object.keys(STAFF_PERMS), must_change: false };
  }
  const member = await getMember(req, env);
  const row = member && (await env.DB.prepare('SELECT perms, must_change_password FROM shop_staff WHERE member_id = ?').bind(member.id).first());
  if (!row) {
    if (member || emdashUser) fail(403, 'บัญชีนี้ไม่มีสิทธิ์จัดการร้านค้า กรุณาติดต่อแอดมินใหญ่');
    fail(401, 'กรุณาเข้าสู่ระบบหลังบ้านร้านค้าก่อน');
  }
  const perms = JSON.parse(row.perms);
  // สิทธิ์ shop_owner = แอดมินร้านค้าที่เข้าด้วยอีเมล/รหัสผ่าน ทำได้ทุกอย่างในหลังบ้านร้าน (แต่ไม่ใช่หลังบ้านเว็บไซต์ EmDash)
  return { owner: perms.includes('shop_owner'), emdash: false, member_id: member.id, name: member.name, email: member.email, perms, must_change: !!row.must_change_password };
}

/** เรียกจาก src/pages/api/shop/[...path].ts — staff คือผู้ใช้ EmDash ที่ล็อกอินอยู่ (ถ้ามี), cms คือ EmDash runtime (locals.emdash) */
export async function handleShopApi(req, env, ctx, staff, cms) {
  const url = new URL(req.url);
  try {
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY) fail(413, 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป');
    if (!['GET', 'HEAD'].includes(req.method)) {
      // กัน CSRF: คำสั่งที่เปลี่ยนข้อมูลต้องมาจากเว็บนี้เท่านั้น
      const origin = req.headers.get('origin');
      const site = req.headers.get('sec-fetch-site');
      let bad = false;
      if (origin) { try { bad = new URL(origin).host !== url.host; } catch { bad = true; } }
      else if (site && !['same-origin', 'none'].includes(site)) bad = true;
      if (bad) fail(403, 'ไม่อนุญาตให้เรียกจากเว็บไซต์อื่น');
    }
    await ensureSchema(env);
    const path = url.pathname.replace(/^\/api\/shop/, '') || '/';
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      if (r.auth?.startsWith('staff')) {
        const actor = await resolveStaff(req, env, staff);
        if (actor.must_change && path !== '/admin/me') fail(403, 'กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน');
        const perm = r.auth.split(':')[1];
        if (perm) requirePerm(actor, perm);
        return await r.handler({ req, env, ctx, url, params: m.groups || {}, staff: actor, cms, emdashUser: staff });
      }
      const user = await getMember(req, env);
      if (r.auth && !user) fail(401, 'กรุณาเข้าสู่ระบบก่อน');
      return await r.handler({ req, env, ctx, url, params: m.groups || {}, user });
    }
    fail(404, 'ไม่พบ API ที่เรียก');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status, e.headers || {});
    console.error(e && e.stack ? e.stack : e);
    return json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' }, 500);
  }
}

async function readJson(req) {
  try { return (await req.json()) || {}; } catch { fail(400, 'รูปแบบข้อมูลไม่ถูกต้อง'); }
}

/* -------------------------------------------------------------- auth utils */
const enc = new TextEncoder();
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${toHex(salt)}$${toHex(await pbkdf2(pw, salt))}`;
}
async function verifyPassword(pw, stored) {
  const [, s, h] = String(stored).split('$');
  if (!s || !h) return false;
  const got = toHex(await pbkdf2(pw, fromHex(s)));
  let diff = got.length ^ h.length;
  for (let i = 0; i < Math.min(got.length, h.length); i++) diff |= got.charCodeAt(i) ^ h.charCodeAt(i);
  return diff === 0;
}
const sha256 = async (s) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
const randomToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
const clientIp = (req) => req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'local';
const maskEmail = (e) => String(e).replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => a + '•••' + b);

// คุกกี้: บน HTTPS ใช้ชื่อ __Host- (ผูกกับโดเมนนี้เท่านั้น, ต้อง Secure) + HttpOnly (JavaScript อ่านไม่ได้)
const cookieName = (url) => (url.protocol === 'https:' ? '__Host-shop_sid' : 'shop_sid');
function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function sessionCookie(token, maxAge, url) {
  return `${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;
}

export async function getMember(req, env) {
  const token = getCookie(req, '__Host-shop_sid') || getCookie(req, 'shop_sid');
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT m.*, s.token AS session_hash FROM shop_sessions s JOIN shop_members m ON m.id = s.member_id WHERE s.token = ? AND s.expires_at > ?')
    .bind(await sha256(token), Date.now()).first();
}
const publicUser = (u) => u && ({ id: u.id, email: u.email, username: u.email, emp_id: u.emp_id || '', office_email: u.office_email || '', name: u.name, phone: u.phone, department: u.department, address: u.address });

async function startSession(env, url, user) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO shop_sessions (token, member_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), user.id, Date.now() + SESSION_HOURS * 3600e3).run();
  return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(token, SESSION_HOURS * 3600, url) });
}

/* ---------- นโยบายรหัสผ่าน ----------
 * ตรวจเฉพาะเงื่อนไขที่แสดงบนหน้าจอ (PW_RULES ใน public/shop/common.js) — ตั้งครบตามเงื่อนไขแล้วต้องผ่านเสมอ
 * (เลิกตรวจ "รหัสเคยรั่วไหล" / รายการรหัสยอดนิยม / ชื่อในรหัส เพราะผู้ใช้ไม่เห็นเงื่อนไขเหล่านี้ล่วงหน้า) */
function passwordProblems(pw, username = '') {
  const p = [];
  if (pw.length < 8) p.push('ต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (pw.length > 128) p.push('ต้องไม่เกิน 128 ตัวอักษร');
  if (!/[a-z]/.test(pw)) p.push('ต้องมีตัวพิมพ์เล็ก (a-z)');
  if (!/[A-Z]/.test(pw)) p.push('ต้องมีตัวพิมพ์ใหญ่ (A-Z)');
  if (!/[0-9]/.test(pw)) p.push('ต้องมีตัวเลข (0-9)');
  if (!/[^A-Za-z0-9]/.test(pw)) p.push('ต้องมีอักขระพิเศษ เช่น ! @ # $ % & *');
  if (/(.)\1{3,}/.test(pw)) p.push('ห้ามใช้ตัวอักษรเดียวกันซ้ำติดกันเกิน 3 ตัว');
  const local = String(username).split('@')[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) p.push('ห้ามมีชื่อผู้ใช้อยู่ในรหัสผ่าน');
  return p;
}
async function assertStrongPassword(pw, username) {
  const p = passwordProblems(pw, username);
  if (p.length) fail(400, 'รหัสผ่านยังไม่ตรงตามเงื่อนไข: ' + p.join(', '));
}

/* ---------- จำกัดความถี่ (กันเดารหัสผ่าน / บอท) ---------- */
async function hitLimit(env, key, limit, windowSec, message) {
  const now = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare(
    `INSERT INTO shop_rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
                                    reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
     RETURNING count, reset_at`
  ).bind(key, now + windowSec, now, now).first();
  if (r.count > limit) {
    const wait = Math.max(1, r.reset_at - now);
    fail(429, message || `ทำรายการถี่เกินไป กรุณารอ ${Math.ceil(wait / 60)} นาทีแล้วลองใหม่`, { 'retry-after': String(wait) });
  }
}
async function peekLimit(env, key) {
  const r = await env.DB.prepare('SELECT count, reset_at FROM shop_rate_limits WHERE key = ? AND reset_at > ?').bind(key, Math.floor(Date.now() / 1000)).first();
  return r || { count: 0, reset_at: 0 };
}
const clearLimit = (env, key) => env.DB.prepare('DELETE FROM shop_rate_limits WHERE key = ?').bind(key).run();

/* ---------- Cloudflare Turnstile (กันบอท) — เปิดใช้เมื่อตั้งค่า TURNSTILE_SECRET ---------- */
async function verifyCaptcha(env, req, token) {
  if (!env.TURNSTILE_SECRET) return;
  if (!token) fail(400, 'กรุณายืนยันว่าคุณไม่ใช่บอท');
  const fd = new FormData();
  fd.append('secret', env.TURNSTILE_SECRET);
  fd.append('response', String(token));
  fd.append('remoteip', clientIp(req));
  let ok = false;
  try { ok = (await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd })).json()).success; } catch {}
  if (!ok) fail(400, 'การยืนยันว่าไม่ใช่บอทไม่ผ่าน กรุณาลองใหม่');
}

/* ---------- บันทึกเหตุการณ์ความปลอดภัย ---------- */
async function audit(env, req, event, user, detail) {
  try {
    await env.DB.prepare('INSERT INTO shop_audit_logs (member_id, email, event, detail, ip, ua) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user?.id ?? null, user?.email ?? null, event, detail ? String(detail).slice(0, 500) : null, req ? clientIp(req) : null,
        req ? String(req.headers.get('user-agent') || '').slice(0, 200) : null).run();
  } catch (e) { console.warn('audit failed', e); }
}
const DUMMY_HASH = 'pbkdf2$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';

/* ---------------------------------------------------------- file storage */
// สลิปเก็บใน R2 ก้อนเดียวกับรูปของ EmDash (binding MEDIA) ใต้โฟลเดอร์ shop/
/** ชนิดไฟล์จาก "ลายเซ็น" (magic bytes) จริงของเนื้อไฟล์ — ไม่เชื่อชื่อไฟล์หรือชนิดที่เบราว์เซอร์ส่งมา */
function sniffImage(bytes) {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  // PNG: ลายเซ็น 8 ไบต์ + chunk แรกต้องเป็น IHDR
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 16 && PNG.every((x, i) => b[i] === x) && String.fromCharCode(...b.slice(12, 16)) === 'IHDR') return 'png';
  return null;
}
/** ไฟล์ "สองหน้า" (polyglot) ที่ซ่อน HTML/สคริปต์ไว้ในรูป — ปฏิเสธถ้าพบส่วนหัวของเอกสารเว็บหรือโค้ด */
const ACTIVE_CONTENT = /<\s*(script|html|svg|iframe|object|embed|body|\?php)|javascript:/i;

async function saveUpload(env, file, folder) {
  if (!file || typeof file === 'string') fail(400, 'กรุณาเลือกไฟล์รูปภาพ');
  // 1) ขนาด
  if (!file.size) fail(400, 'ไฟล์ว่างเปล่า');
  if (file.size > MAX_FILE) fail(400, 'ไฟล์ใหญ่เกินไป (ไม่เกิน 1.5 MB)');
  // 2) นามสกุลไฟล์ (ถ้ามีชื่อไฟล์) และ MIME type ที่ส่งมา ต้องเป็น JPG/PNG
  const name = String(file.name || '');
  const nameExt = name.includes('.') ? IMAGE_EXT[name.split('.').pop().toLowerCase()] : undefined;
  if (name.includes('.') && !nameExt) fail(400, 'รองรับเฉพาะไฟล์ .jpg .jpeg หรือ .png');
  const mimeExt = IMAGE_TYPES[String(file.type || '').toLowerCase()];
  if (!mimeExt) fail(400, 'รองรับเฉพาะไฟล์รูปภาพ JPG หรือ PNG');
  // 3) เนื้อไฟล์จริงต้องเป็นชนิดเดียวกับที่ประกาศ (กันเปลี่ยนนามสกุลไฟล์สคริปต์/PDF ให้เป็น .png)
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_FILE) fail(400, 'ไฟล์ใหญ่เกินไป (ไม่เกิน 1.5 MB)');
  const bytes = new Uint8Array(buf);
  const real = sniffImage(bytes);
  if (!real || real !== mimeExt || (nameExt && nameExt !== real)) fail(400, 'ไฟล์ไม่ใช่รูปภาพ JPG/PNG ที่ถูกต้อง');
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  if (ACTIVE_CONTENT.test(head)) fail(400, 'ไฟล์ไม่ใช่รูปภาพ JPG/PNG ที่ถูกต้อง');
  // 4) ตั้งชื่อใหม่เป็นรหัสสุ่ม เก็บใน object storage (ไม่ใช่โฟลเดอร์ของเว็บ จึงไม่มีทางถูกรันเป็นโค้ด)
  const key = `shop/${folder}/${crypto.randomUUID()}.${real}`;
  await kvBucket(env.MEDIA).put(key, buf, { httpMetadata: { contentType: real === 'png' ? 'image/png' : 'image/jpeg' } });
  return key;
}
/** ส่งไฟล์สลิปกลับแบบปลอดภัย: บังคับชนิดไฟล์ ห้ามเดาชนิด และห้ามรันสคริปต์ใดๆ แม้ไฟล์จะถูกดัดแปลง */
const slipResponse = (f) => new Response(f.body, {
  headers: {
    'content-type': /^image\/(jpeg|png)$/.test(f.type) ? f.type : 'application/octet-stream',
    'content-disposition': 'inline; filename="slip"',
    'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  },
});
export async function getFile(env, key) {
  const o = key && (await kvBucket(env.MEDIA).get(key));
  return o ? { body: o.body, type: o.httpMetadata?.contentType || 'application/octet-stream' } : null;
}
const deleteFile = (env, key) => (key ? kvBucket(env.MEDIA).delete(key) : undefined);

/* -------------------------------------------------------------- settings */
const isMailPaused = async (env) =>
  (await env.DB.prepare(`SELECT value FROM shop_settings WHERE key = 'mail_paused'`).first())?.value === '1';
/** มีบริการส่งอีเมล (ตั้งค่าไว้) และไม่ได้พักไว้ */
const mailConfigured = (env) => !!(env.MAIL_WEBHOOK_URL || (env.RESEND_API_KEY && env.MAIL_FROM));

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM shop_settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value ?? '';
  return s;
}
const publicSettings = (s, env) =>
  Object.fromEntries(Object.entries(s).filter(([k]) => !PRIVATE_SETTINGS.includes(k) && !(isPaymentDemo(env) && PAYMENT_SETTINGS.includes(k))));
/** ที่เก็บสลิปเป็นข้อมูลภายใน: ไม่ส่งชื่อไฟล์ออกไป (หน้าเว็บใช้ has_slip และ API ที่ตรวจสิทธิ์แล้วเท่านั้น) */
const publicOrder = (o) => {
  const { slip_key, postage_receipt_key, postage_slip_key, ...rest } = o;
  return rest;
};

/* ------------------------------------------------------------ email/notify */
const siteUrl = (env, origin) => (env.SITE_URL || origin || '').replace(/\/$/, '');
const memberUrl = (base, hash) => `${base}/member#/${hash}`;
const adminOrderUrl = (base, id) => `${base}/shop-admin#orders/${id}`;

export async function sendMail(env, to, subject, html) {
  // บัญชีที่สมัครด้วยชื่อผู้ใช้ไม่มีอีเมล
  if (!to || !EMAIL_RE.test(String(to).toLowerCase())) return;
  try {
    if (await isMailPaused(env)) return;
    if (env.MAIL_WEBHOOK_URL) {
      // Google Apps Script (ส่งผ่าน Gmail ของร้าน)
      const r = await fetch(env.MAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: env.MAIL_WEBHOOK_SECRET || '', to, subject, html }),
      });
      if (!r.ok) console.warn('mail webhook', r.status);
    } else if (env.RESEND_API_KEY && env.MAIL_FROM) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }),
      });
      if (!r.ok) console.warn('resend', r.status, await r.text());
    }
  } catch (e) {
    console.warn('sendMail failed', e);
  }
}
async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.warn('telegram failed', e);
  }
}
function mailLayout(s, title, inner, link, linkText) {
  return `<div style="font-family:Tahoma,'Sarabun',sans-serif;background:#f6f4ef;padding:24px;color:#1d2433">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e1d8">
    <div style="background:#0f2a5c;color:#fff;padding:18px 22px;border-bottom:4px solid #c9a227">
      <div style="font-size:18px;font-weight:bold">${esc(s.shop_name)}</div>
      <div style="font-size:13px;opacity:.85">${esc(s.shop_tagline)}</div>
    </div>
    <div style="padding:22px;font-size:15px;line-height:1.7">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f2a5c">${esc(title)}</h2>
      ${inner}
      ${link ? `<p style="margin-top:20px"><a href="${esc(link)}" style="background:#0f2a5c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(linkText || 'ดูรายละเอียด')}</a></p>` : ''}
    </div>
    <div style="padding:12px 22px;background:#faf8f3;color:#5f6b7f;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ</div>
  </div></div>`;
}
function itemsTable(o) {
  const rows = (o.items || []).map((i) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.name)} × ${i.qty}${i.promo_note ? `<br><small style="color:#15803d">${esc(i.promo_note)}</small>` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">฿${money(i.line_total)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
  ${o.shipping_fee > 0 ? `<tr><td style="padding:6px 0">ค่าจัดส่ง</td><td style="text-align:right">฿${money(o.shipping_fee)}</td></tr>` : ''}
  <tr><td style="padding:8px 0;font-weight:bold">ยอดรวม</td><td style="text-align:right;font-weight:bold;color:#0f2a5c">฿${money(o.total)}</td></tr></table>`;
}
const adminTarget = (env, s) => s.admin_notify_email || String(env.ADMIN_EMAILS || '').split(/[,\s]+/).filter(Boolean)[0] || '';

async function notifyNewOrder(env, o, s, origin) {
  const base = siteUrl(env, origin);
  const pay = isPaymentDemo(env) ? 'ระบบอยู่ระหว่างทดสอบ ยังไม่รับชำระเงินจริง' : [s.bank_name && `ธนาคาร: ${esc(s.bank_name)}`, s.bank_account_no && `เลขที่บัญชี: <b>${esc(s.bank_account_no)}</b>`,
    s.bank_account_name && `ชื่อบัญชี: ${esc(s.bank_account_name)}`, s.promptpay_id && `พร้อมเพย์: <b>${esc(s.promptpay_id)}</b>`].filter(Boolean).join('<br>');
  await Promise.allSettled([
    sendMail(env, o.user_email, `[${s.shop_name}] ได้รับคำสั่งซื้อ ${o.order_no} — รอชำระเงิน`, mailLayout(s, 'ขอบคุณสำหรับคำสั่งซื้อ',
      `<p>เรียน คุณ${esc(o.user_name)}<br>เลขที่คำสั่งซื้อ <b>${esc(o.order_no)}</b></p>${itemsTable(o)}
       <p style="margin-top:16px"><b>วิธีชำระเงิน</b><br>${pay || 'สแกน QR ในหน้าคำสั่งซื้อ'}</p>
       <p>เมื่อโอนแล้ว กรุณาแนบสลิปในหน้าคำสั่งซื้อ ระบบจะแจ้งสถานะให้ทราบทางอีเมลนี้</p>`,
      memberUrl(base, `order/${o.order_no}`), 'ชำระเงิน / แนบสลิป')),
    sendMail(env, adminTarget(env, s), `🛒 คำสั่งซื้อใหม่ ${o.order_no} — ฿${money(o.total)}`, mailLayout(s, 'มีคำสั่งซื้อใหม่',
      `<p>ผู้สั่ง: <b>${esc(o.user_name)}</b> (${esc(o.user_email)})<br>หน่วยงาน: ${esc(o.user_department || '-')}<br>โทร: ${esc(o.phone)}<br>
       การรับสินค้า: ${o.delivery_method === 'delivery' ? 'จัดส่ง — ' + esc(o.address) : 'รับเองที่ ' + esc(o.pickup_point || '-')}</p>${itemsTable(o)}`,
      adminOrderUrl(base, o.id), 'เปิดในหลังบ้าน')),
    sendTelegram(env, `🛒 คำสั่งซื้อใหม่ ${o.order_no}\nผู้สั่ง: ${o.user_name} (${o.user_department || '-'})\n` +
      (o.items || []).map((i) => `• ${i.name} × ${i.qty}`).join('\n') + `\nยอดรวม ฿${money(o.total)}\n${adminOrderUrl(base, o.id)}`),
  ]);
}
async function notifySlip(env, o, s, origin) {
  const base = siteUrl(env, origin);
  await Promise.allSettled([
    sendMail(env, adminTarget(env, s), `💰 แนบสลิปแล้ว ${o.order_no} — รอตรวจสอบ ฿${money(o.total)}`,
      mailLayout(s, 'ลูกค้าแนบสลิปการโอนเงิน', `<p>คำสั่งซื้อ <b>${esc(o.order_no)}</b><br>ผู้สั่ง: ${esc(o.user_name)} (${esc(o.user_email)})<br>ยอดที่ต้องได้รับ: <b>฿${money(o.total)}</b></p>`,
        adminOrderUrl(base, o.id), 'ตรวจสอบสลิป')),
    sendTelegram(env, `💰 แนบสลิปแล้ว ${o.order_no}\nผู้สั่ง: ${o.user_name}\nยอด ฿${money(o.total)} — รอตรวจสอบ\n${adminOrderUrl(base, o.id)}`),
  ]);
}
export async function notifyStatus(env, o, s, origin, note) {
  const base = siteUrl(env, origin);
  const extra = [
    note && `<p>หมายเหตุจากเจ้าหน้าที่: ${esc(note)}</p>`,
    o.status === 'shipped' && o.delivery_method === 'pickup' && `<p>สถานที่รับสินค้า: <b>${esc(o.pickup_point || '')}</b><br>${esc(s.pickup_location)}</p>`,
    o.tracking_no && `<p>เลขพัสดุ: <b>${esc(o.tracking_no)}</b></p>`,
    o.status === 'postage_due' && `<p>ค่าส่งไปรษณีย์ที่ต้องชำระ: <b>฿${money(o.postage_amount)}</b><br>โอนเข้าบัญชีผู้ส่งสินค้า: ${esc(o.postage_account || '')}<br>แล้วแนบสลิปในหน้าคำสั่งซื้อ</p>`,
  ].filter(Boolean).join('');
  await sendMail(env, o.user_email, `[${s.shop_name}] คำสั่งซื้อ ${o.order_no}: ${STATUS_LABEL[o.status]}`,
    mailLayout(s, `สถานะคำสั่งซื้อ: ${STATUS_LABEL[o.status]}`,
      `<p>เรียน คุณ${esc(o.user_name)}<br>คำสั่งซื้อเลขที่ <b>${esc(o.order_no)}</b> มีการอัปเดตสถานะเป็น <b style="color:#0f2a5c">${esc(STATUS_LABEL[o.status])}</b></p>${extra}${itemsTable(o)}`,
      memberUrl(base, `order/${o.order_no}`), 'ดูสถานะคำสั่งซื้อ'));
}

const thNow = () => new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
async function sendResetMail(env, s, user, token, req, origin) {
  const link = memberUrl(siteUrl(env, origin), `reset?token=${token}`);
  await sendMail(env, user.email, `[${s.shop_name}] ตั้งรหัสผ่านใหม่`, mailLayout(s, 'คำขอตั้งรหัสผ่านใหม่',
    `<p>เรียน คุณ${esc(user.name)}</p><p>มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชี <b>${esc(user.email)}</b> เมื่อ ${esc(thNow())} น. (IP: ${esc(clientIp(req))})</p>
     <p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ <b>ลิงก์ใช้ได้ครั้งเดียว ภายใน ${RESET_TTL_MIN} นาที</b></p>
     <p style="color:#b42318">หากคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ และห้ามส่งต่อลิงก์นี้ให้ผู้อื่น</p>`, link, 'ตั้งรหัสผ่านใหม่'));
}
async function sendPasswordChangedMail(env, s, user, req, origin) {
  await sendMail(env, user.email, `[${s.shop_name}] รหัสผ่านของคุณถูกเปลี่ยนแล้ว`, mailLayout(s, 'แจ้งเตือน: รหัสผ่านถูกเปลี่ยน',
    `<p>เรียน คุณ${esc(user.name)}</p><p>รหัสผ่านของบัญชี <b>${esc(user.email)}</b> ถูกเปลี่ยนเมื่อ ${esc(thNow())} น. (IP: ${esc(clientIp(req))}) และระบบได้ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว</p>
     <p style="color:#b42318"><b>หากคุณไม่ได้เป็นผู้เปลี่ยน</b> กรุณากด “ลืมรหัสผ่าน” เพื่อตั้งใหม่ทันที และแจ้งเจ้าหน้าที่สวัสดิการ</p>`,
    memberUrl(siteUrl(env, origin), 'forgot'), 'ลืมรหัสผ่าน / ตั้งใหม่'));
}

/* ----------------------------------------------------------------- orders */
function makeOrderNo() {
  const d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(2, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(4));
  return `SAO${d}-${[...r].map((b) => chars[b % chars.length]).join('')}`;
}
export async function loadOrder(env, idOrNo) {
  const o = await env.DB.prepare(
    `SELECT o.*, m.email AS user_email, m.name AS user_name, m.department AS user_department
     FROM shop_orders o JOIN shop_members m ON m.id = o.member_id WHERE o.id = ? OR o.order_no = ?`
  ).bind(/^\d+$/.test(String(idOrNo)) ? Number(idOrNo) : -1, String(idOrNo)).first();
  if (!o) return null;
  const [items, logs] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM shop_order_items WHERE order_id = ? ORDER BY id').bind(o.id),
    env.DB.prepare(`SELECT l.*, COALESCE(l.by_admin, m.name) AS by_name FROM shop_order_logs l
                    LEFT JOIN shop_members m ON m.id = l.by_member WHERE l.order_id = ? ORDER BY l.id`).bind(o.id),
  ]);
  o.items = items.results;
  o.logs = logs.results;
  o.has_slip = !!o.slip_key;
  o.is_regional = isRegionalPickup(o.pickup_point);
  o.has_postage_receipt = !!o.postage_receipt_key;
  o.has_postage_slip = !!o.postage_slip_key;
  return o;
}
async function ownOrder(env, user, id) {
  const o = await loadOrder(env, id);
  if (!o || o.member_id !== user.id) fail(404, 'ไม่พบคำสั่งซื้อ');
  return o;
}
/** ยกเลิกและคืนสต็อก — by = { member } หรือ { admin } */
export async function cancelOrder(env, o, by, note) {
  const r = await env.DB.prepare(`UPDATE shop_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status != 'cancelled'`).bind(o.id).run();
  if (!r.meta.changes) return false;
  const stmts = [];
  for (const it of o.items) {
    if (!it.product_id) continue;
    if (it.variant_id) {
      stmts.push(env.DB.prepare('UPDATE shop_variants SET stock = stock + ? WHERE id = ?').bind(it.qty, it.variant_id));
      stmts.push(syncProductStock(env, it.product_id));
      stmts.push(env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, variant_id, variant, delta, balance, reason, ref, admin)
                                 SELECT ?, id, ?, ?, stock, 'cancel', ?, ? FROM shop_variants WHERE id = ?`)
        .bind(it.product_id, it.variant, it.qty, o.order_no, by.admin ?? null, it.variant_id));
      continue;
    }
    stmts.push(env.DB.prepare(`UPDATE ec_products SET stock = COALESCE(stock, 0) + ? WHERE id = ?`).bind(it.qty, it.product_id));
    stmts.push(env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref, admin) SELECT id, ?, stock, 'cancel', ?, ? FROM ec_products WHERE id = ?`)
      .bind(it.qty, o.order_no, by.admin ?? null, it.product_id));
  }
  stmts.push(env.DB.prepare(`INSERT INTO shop_order_logs (order_id, status, note, by_member, by_admin) VALUES (?, 'cancelled', ?, ?, ?)`)
    .bind(o.id, note || 'ยกเลิกคำสั่งซื้อ', by.member ?? null, by.admin ?? null));
  await env.DB.batch(stmts);
  o.status = 'cancelled';
  return true;
}

/* ================================================================= ROUTES */

/* ---- auth ---- */
/* สมัครสมาชิก 2 ขั้น: (1) ตรวจอีเมลสำนักงาน + วันเดือนปีเกิด กับรายชื่อบุคลากร
 * (2) แสดงชื่อ-นามสกุลจากรายชื่อ ตั้งชื่อผู้ใช้ (เริ่มต้น = ส่วนหน้า @ ของอีเมลสำนักงาน) รหัสผ่าน เบอร์โทร
 * ขั้น 2 ตรวจรายชื่อซ้ำทุกครั้ง (ไม่เชื่อผลจากหน้าเว็บ) */
const suggestUsername = (email) => String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32);
on('POST', '/auth/register/verify', async ({ req, env }) => {
  const b = await readJson(req);
  await hitLimit(env, `regv:${clientIp(req)}`, 20, 3600, 'ตรวจสอบข้อมูลถี่เกินไปจากเครือข่ายนี้ กรุณารอ 1 ชั่วโมง');
  const r = await checkRoster(env, req, b);
  const { first, last } = splitName(r.full_name);
  return json({ ok: true, name: r.full_name, first_name: first, last_name: last, username: suggestUsername(r.email) });
});

on('POST', '/auth/register', async ({ req, env, url }) => {
  const b = await readJson(req);
  await hitLimit(env, `reg:${clientIp(req)}`, 10, 3600, 'สมัครสมาชิกถี่เกินไปจากเครือข่ายนี้ กรุณารอสักครู่');
  await verifyCaptcha(env, req, b.captcha);
  const r = await checkRoster(env, req, b);
  const username = clean(b.username, 40).toLowerCase();
  if (!USERNAME_RE.test(username)) fail(400, 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือ . _ - ยาว 4–32 ตัว');
  const phone = clean(b.phone, 20);
  if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ''))) fail(400, 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
  const password = String(b.password || '');
  await assertStrongPassword(password, username, r.full_name);
  if (await env.DB.prepare('SELECT id FROM shop_members WHERE email = ?').bind(username).first()) fail(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว กรุณาตั้งชื่อผู้ใช้อื่น');
  const user = await env.DB.prepare(
    `INSERT INTO shop_members (email, password_hash, name, phone, department, address, office_email, password_changed_at) VALUES (?, ?, ?, ?, '', '', ?, datetime('now')) RETURNING *`
  ).bind(username, await hashPassword(password), r.full_name, phone, r.email).first();
  await audit(env, req, 'register', user, `อีเมลสำนักงาน ${r.email}`);
  return startSession(env, url, user);
});

on('POST', '/auth/login', async ({ req, env, url }) => {
  const b = await readJson(req);
  const email = clean(b.email, 100).toLowerCase();
  const ip = clientIp(req);
  await hitLimit(env, `login-ip:${ip}`, 30, 900, 'พยายามเข้าสู่ระบบถี่เกินไปจากเครือข่ายนี้ กรุณารอ 15 นาที');
  // ล็อกบัญชีชั่วคราว 15 นาที เมื่อใส่รหัสผิดครบ 5 ครั้ง
  const fails = await peekLimit(env, `login-fail:${email}`);
  if (fails.count >= 5) {
    const mins = Math.ceil((fails.reset_at - Date.now() / 1000) / 60);
    await audit(env, req, 'login_locked', { email });
    fail(429, `บัญชีนี้ถูกล็อกชั่วคราวเพราะใส่รหัสผ่านผิดหลายครั้ง กรุณาลองใหม่ใน ${mins} นาที หรือใช้ “ลืมรหัสผ่าน”`);
  }
  await verifyCaptcha(env, req, b.captcha);
  const user = await env.DB.prepare('SELECT * FROM shop_members WHERE email = ?').bind(email).first();
  // ตรวจรหัสเสมอ แม้ไม่มีบัญชี เพื่อไม่ให้เดาได้จากเวลาตอบกลับว่าอีเมลไหนมีอยู่ในระบบ
  const ok = await verifyPassword(String(b.password || ''), user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    try { await hitLimit(env, `login-fail:${email}`, 1e9, 900); } catch {}
    await audit(env, req, 'login_fail', user || { email });
    const left = 5 - (fails.count + 1);
    fail(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (left > 0 && left <= 2 ? ` (เหลือโอกาสอีก ${left} ครั้งก่อนบัญชีถูกล็อกชั่วคราว)` : ''));
  }
  await clearLimit(env, `login-fail:${email}`);
  await audit(env, req, 'login_ok', user);
  return startSession(env, url, user);
});

on('POST', '/auth/logout', async ({ env, url, user }) => {
  if (user) await env.DB.prepare('DELETE FROM shop_sessions WHERE token = ?').bind(user.session_hash).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, url) });
});

on('POST', '/auth/logout-all', async ({ req, env, url, user }) => {
  await env.DB.prepare('DELETE FROM shop_sessions WHERE member_id = ?').bind(user.id).run();
  await audit(env, req, 'logout_all', user);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, url) });
}, 'user');

on('GET', '/auth/me', async ({ user }) => json({ user: publicUser(user) }));

on('PUT', '/auth/me', async ({ req, env, ctx, url, user }) => {
  const b = await readJson(req);
  // ชื่อของสมาชิกที่สมัครด้วยเลขประจำตัวข้าราชการมาจากทะเบียน แก้เองไม่ได้
  const name = user.emp_id || user.office_email ? user.name : clean(b.name, 100);
  if (!name) fail(400, 'กรุณากรอกชื่อ-นามสกุล');
  if (b.new_password) {
    await hitLimit(env, `pwchange:${user.id}`, 5, 900);
    if (!(await verifyPassword(String(b.old_password || ''), user.password_hash))) {
      await audit(env, req, 'pw_change_fail', user);
      fail(400, 'รหัสผ่านเดิมไม่ถูกต้อง');
    }
    const np = String(b.new_password);
    if (np === String(b.old_password)) fail(400, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    await assertStrongPassword(np, user.email, name);
    await env.DB.batch([
      env.DB.prepare(`UPDATE shop_members SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`).bind(await hashPassword(np), user.id),
      // ออกจากระบบทุกอุปกรณ์อื่น ยกเว้นเครื่องที่กำลังใช้
      env.DB.prepare('DELETE FROM shop_sessions WHERE member_id = ? AND token != ?').bind(user.id, user.session_hash),
      env.DB.prepare('UPDATE shop_staff SET must_change_password = 0 WHERE member_id = ?').bind(user.id),
    ]);
    await audit(env, req, 'pw_change', user);
    ctx.waitUntil(getSettings(env).then((s) => sendPasswordChangedMail(env, s, user, req, url.origin)));
  }
  const u = await env.DB.prepare('UPDATE shop_members SET name = ?, phone = ?, department = ?, address = ? WHERE id = ? RETURNING *')
    // หน้าข้อมูลส่วนตัวไม่มีช่องสำนักแล้ว: ไม่ส่งมา = คงค่าเดิม
    .bind(name, clean(b.phone, 20), 'department' in b ? clean(b.department, 150) : user.department || '', 'address' in b ? clean(b.address, 500) : user.address || '', user.id).first();
  return json({ user: publicUser(u) });
}, 'user');

/* ---- ปิดบัญชี (สมาชิกทำเอง) ----
 * ประวัติคำสั่งซื้อต้องเก็บไว้ตรวจสอบบัญชี จึงไม่ลบแถวสมาชิก แต่ล้างข้อมูลติดต่อ เปลี่ยนอีเมลเป็นค่าที่ใช้ไม่ได้
 * (อีเมลเดิมสมัครใหม่ได้) และทำให้รหัสผ่านใช้ไม่ได้อีก — ชื่อและหน่วยงานคงไว้ให้คำสั่งซื้อเก่ายังอ่านรู้เรื่อง */
export const CLOSE_ACCOUNT_PHRASE = 'ต้องการปิดบัญชีนี้';
on('POST', '/auth/close-account', async ({ req, env, url, user }) => {
  const b = await readJson(req);
  if (String(b.confirm || '').trim() !== CLOSE_ACCOUNT_PHRASE) fail(400, `กรุณาพิมพ์ “${CLOSE_ACCOUNT_PHRASE}” ให้ถูกต้อง`);
  if (await env.DB.prepare('SELECT member_id FROM shop_staff WHERE member_id = ?').bind(user.id).first())
    fail(409, 'บัญชีนี้เป็นผู้ดูแลร้าน กรุณาให้แอดมินใหญ่ถอดสิทธิ์ก่อนปิดบัญชี');
  const open = await env.DB.prepare(`SELECT COUNT(*) AS n FROM shop_orders WHERE member_id = ? AND status NOT IN ('completed', 'cancelled')`).bind(user.id).first();
  if (open.n) fail(409, `ยังมีคำสั่งซื้อที่ยังไม่เสร็จสิ้น ${open.n} รายการ กรุณารับสินค้าหรือยกเลิกคำสั่งซื้อก่อนปิดบัญชี`);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shop_members SET email = ?, password_hash = '!closed', phone = '', address = '', emp_id = NULL, office_email = NULL, closed_at = datetime('now') WHERE id = ?`)
      .bind(`closed-${user.id}-${randomToken().slice(0, 8)}@closed.invalid`, user.id),
    env.DB.prepare('DELETE FROM shop_sessions WHERE member_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM shop_password_resets WHERE member_id = ?').bind(user.id),
  ]);
  await audit(env, req, 'account_closed', user);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, url) });
}, 'user');

/* ---- ลืมรหัสผ่าน ---- */
on('POST', '/auth/forgot', async ({ req, env, ctx, url }) => {
  const b = await readJson(req);
  const email = clean(b.email, 100).toLowerCase();
  await hitLimit(env, `forgot-ip:${clientIp(req)}`, 10, 3600);
  await verifyCaptcha(env, req, b.captcha);
  const reply = json({ ok: true, message: 'หากอีเมลนี้เป็นสมาชิก ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์สแปม) ลิงก์ใช้ได้ภายใน 30 นาที' });
  if (!EMAIL_RE.test(email)) return reply;
  const user = await env.DB.prepare('SELECT * FROM shop_members WHERE email = ?').bind(email).first();
  // ตอบเหมือนกันเสมอ ไม่บอกว่าอีเมลมีในระบบหรือไม่ (กันการไล่เช็คอีเมลสมาชิก)
  if (!user) { await audit(env, req, 'pw_reset_unknown', { email }); return reply; }
  try { await hitLimit(env, `forgot-user:${user.id}`, 3, 3600); } catch { return reply; }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shop_password_resets WHERE member_id = ?').bind(user.id),
    env.DB.prepare('INSERT INTO shop_password_resets (token_hash, member_id, expires_at, ip) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), user.id, Date.now() + RESET_TTL_MIN * 60e3, clientIp(req)),
  ]);
  await audit(env, req, 'pw_reset_request', user);
  ctx.waitUntil(getSettings(env).then((s) => sendResetMail(env, s, user, token, req, url.origin)));
  return reply;
});

/* ---- ลืมรหัสผ่าน (สมาชิกที่สมัครด้วยอีเมลสำนักงาน) ----
 * ยืนยันด้วยอีเมลสำนักงาน + คำนำหน้า ชื่อ นามสกุล + เบอร์โทรที่ใช้สมัคร แล้วออกโทเค็นตั้งรหัสใหม่ (อายุ 30 นาที) ให้หน้าเว็บใช้ต่อทันที
 * ผิดครบ 5 ครั้งต่ออีเมล ล็อก 1 ชั่วโมง · ตอบข้อความเดียวกันทุกกรณีที่ไม่ผ่าน */
on('POST', '/auth/forgot/verify', async ({ req, env }) => {
  const b = await readJson(req);
  await hitLimit(env, `forgotv-ip:${clientIp(req)}`, 10, 3600, 'ยืนยันตัวตนถี่เกินไปจากเครือข่ายนี้ กรุณารอ 1 ชั่วโมง');
  await verifyCaptcha(env, req, b.captcha);
  const mail = cleanMail(b.office_email);
  if (!EMAIL_RE.test(mail) || !clean(b.prefix, 40) || !clean(b.first_name, 60) || !clean(b.last_name, 60) || !clean(b.phone, 20)) fail(400, 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
  const fails = await peekLimit(env, `forgotv-fail:${mail}`);
  if (fails.count >= 5) fail(429, 'ยืนยันตัวตนผิดหลายครั้ง กรุณาลองใหม่ใน 1 ชั่วโมง หรือติดต่อเจ้าหน้าที่สวัสดิการ');
  const m = await env.DB.prepare('SELECT * FROM shop_members WHERE office_email = ? AND closed_at IS NULL').bind(mail).first();
  const digits = (v) => String(v ?? '').replace(/\D/g, '');
  const ok = m && m.name && nameKey(m.name) === nameKey(fullNameOf(b)) && digits(m.phone).length >= 9 && digits(m.phone) === digits(b.phone);
  if (!ok) {
    try { await hitLimit(env, `forgotv-fail:${mail}`, 1e9, 3600); } catch {}
    await audit(env, req, 'pw_reset_id_fail', m || { email: mail });
    fail(400, 'ข้อมูลไม่ตรงกับบัญชีสมาชิก กรุณาตรวจสอบอีเมลสำนักงาน คำนำหน้าชื่อ ชื่อ นามสกุล และเบอร์โทรศัพท์ที่ใช้สมัคร');
  }
  await clearLimit(env, `forgotv-fail:${mail}`);
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shop_password_resets WHERE member_id = ?').bind(m.id),
    env.DB.prepare('INSERT INTO shop_password_resets (token_hash, member_id, expires_at, ip) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), m.id, Date.now() + RESET_TTL_MIN * 60e3, clientIp(req)),
  ]);
  await audit(env, req, 'pw_reset_id_ok', m);
  return json({ token, username: m.email });
});

async function findReset(env, token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
  return env.DB.prepare(`SELECT r.*, m.email, m.name FROM shop_password_resets r JOIN shop_members m ON m.id = r.member_id
                         WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ?`).bind(await sha256(token), Date.now()).first();
}

on('POST', '/auth/reset/check', async ({ req, env }) => {
  const b = await readJson(req);
  await hitLimit(env, `reset-ip:${clientIp(req)}`, 30, 900);
  const r = await findReset(env, b.token);
  if (!r) fail(400, 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่');
  return json({ ok: true, email: maskEmail(r.email), email_full: r.email, name: r.name });
});

on('POST', '/auth/reset', async ({ req, env, ctx, url }) => {
  const b = await readJson(req);
  await hitLimit(env, `reset-ip:${clientIp(req)}`, 30, 900);
  const r = await findReset(env, b.token);
  if (!r) fail(400, 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่');
  const pw = String(b.password || '');
  await assertStrongPassword(pw, r.email, r.name);
  const user = await env.DB.prepare('SELECT * FROM shop_members WHERE id = ?').bind(r.member_id).first();
  if (await verifyPassword(pw, user.password_hash)) fail(400, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
  await env.DB.batch([
    env.DB.prepare(`UPDATE shop_members SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`).bind(await hashPassword(pw), r.member_id),
    env.DB.prepare('UPDATE shop_password_resets SET used_at = ? WHERE token_hash = ?').bind(Date.now(), r.token_hash),
    env.DB.prepare('DELETE FROM shop_password_resets WHERE member_id = ? AND used_at IS NULL').bind(r.member_id),
    env.DB.prepare('DELETE FROM shop_sessions WHERE member_id = ?').bind(r.member_id), // ออกจากระบบทุกอุปกรณ์
    env.DB.prepare('UPDATE shop_staff SET must_change_password = 0 WHERE member_id = ?').bind(r.member_id),
    env.DB.prepare('DELETE FROM shop_rate_limits WHERE key = ?').bind(`login-fail:${r.email}`), // ปลดล็อกบัญชี
  ]);
  await audit(env, req, 'pw_reset_done', user);
  ctx.waitUntil(getSettings(env).then((s) => sendPasswordChangedMail(env, s, user, req, url.origin)));
  return json({ ok: true });
});

/* ---- ข้อมูลร้าน + ราคา/สต็อกล่าสุดของสินค้าในตะกร้า ---- */
on('GET', '/settings', async ({ env }) => {
  const s = await getSettings(env);
  const paused = s.mail_paused === '1';
  return json({
    settings: publicSettings(s, env),
    security: {
      payment_demo: isPaymentDemo(env),
      turnstile_site_key: env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY || '' : '',
      mail_enabled: mailConfigured(env) && !paused,
      mail_paused: mailConfigured(env) && paused,
    },
  });
});

on('GET', '/products', async ({ env, url }) => {
  const ids = clean(url.searchParams.get('ids'), 4000).split(',').filter((x) => /^[0-9A-Z]{26}$/.test(x)).slice(0, 100);
  if (!ids.length) return json({ products: [] });
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title AS name, price, bulk_qty, bulk_price, price_tiers, price_bundles, COALESCE(stock, 0) AS stock, unit, sku FROM ec_products
     WHERE ${LIVE_PRODUCT} AND id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  const variants = await variantsByProduct(env, results.map((p) => p.id));
  // price = ราคาปกติ; tiers = ขั้นราคาตามจำนวน [{qty, price}] ตะกร้าคำนวณด้วยกติกาเดียวกับ POST /orders
  return json({
    products: results.map(({ bulk_qty, bulk_price, price_tiers, price_bundles, ...p }) => ({
      ...p,
      tiers: priceTiers({ ...p, bulk_qty, bulk_price, price_tiers }),
      bundles: priceBundles({ ...p, price_bundles }),
      variants: variants.get(p.id) || [],
    })),
  });
});

/* ---- orders (member) ---- */
on('POST', '/orders', async ({ req, env, ctx, url, user }) => {
  const b = await readJson(req);
  await hitLimit(env, `order:${user.id}`, 30, 3600, 'สร้างคำสั่งซื้อถี่เกินไป กรุณารอสักครู่');
  const s = await getSettings(env);
  // รายการในตะกร้าแยกตามสินค้า + แบบย่อย (สี/ไซส์)
  const want = new Map();
  for (const it of Array.isArray(b.items) ? b.items : []) {
    const id = String(it.product_id || '');
    const vid = it.variant_id == null || it.variant_id === '' ? 0 : parseInt(it.variant_id, 10);
    const qty = parseInt(it.qty, 10);
    if (!/^[0-9A-Z]{26}$/.test(id) || !(vid >= 0) || !(qty > 0) || qty > 999) fail(400, 'จำนวนสินค้าไม่ถูกต้อง');
    const key = `${id}:${vid}`;
    want.set(key, { id, vid, qty: (want.get(key)?.qty || 0) + qty });
  }
  if (!want.size) fail(400, 'ยังไม่มีสินค้าในตะกร้า');
  if (want.size > 100) fail(400, 'จำนวนรายการสินค้ามากเกินไป');

  const ids = [...new Set([...want.values()].map((w) => w.id))];
  const { results: prods } = await env.DB.prepare(
    `SELECT id, title AS name, price, bulk_qty, bulk_price, price_tiers, price_bundles, COALESCE(stock, 0) AS stock, unit, sku, category FROM ec_products WHERE ${LIVE_PRODUCT} AND id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  // ราคาพิเศษเมื่อซื้อครบ: นับจำนวนรวมของสินค้าเดียวกันทุกสี/ไซส์ แล้วคิดราคาต่อชิ้นที่เซิร์ฟเวอร์ (ไม่เชื่อราคาจากตะกร้า)
  const totalQty = new Map();
  for (const w of want.values()) totalQty.set(w.id, (totalQty.get(w.id) || 0) + w.qty);
  // ราคาแบบชุด: จัดชุดจากจำนวนรวม แล้วแบ่งยอดให้แต่ละสี/ไซส์ตามสัดส่วนจำนวน (เศษสตางค์ไปอยู่รายการสุดท้าย)
  for (const p of prods) {
    const q = totalQty.get(p.id) || 0;
    p.plan = productPlan(p, q);
    p.price = unitPrice(p, q);
    p.note = planNote(p.plan, p.price, p.unit || 'ชิ้น') || null;
    p.left = { qty: q, total: p.plan.total };
  }
  const other = prods.find((p) => String(p.category || '').trim() === OTHER_CATEGORY);
  if (other) fail(409, `สินค้า "${other.name}" สั่งซื้อผ่าน LINE หรือโทรศัพท์เท่านั้น กรุณานำออกจากตะกร้า`);
  const byId = new Map(prods.map((p) => [p.id, p]));
  const variants = await variantsByProduct(env, ids);
  const lines = [];
  let subtotal = 0;
  for (const { id, vid, qty } of want.values()) {
    const p = byId.get(id);
    if (!p) fail(409, 'มีสินค้าบางรายการไม่พร้อมจำหน่ายแล้ว กรุณาตรวจสอบตะกร้าอีกครั้ง');
    const vs = variants.get(id);
    let v = null;
    if (vs) {
      v = vs.find((x) => x.id === vid);
      if (!v) fail(409, `กรุณาเลือกสี/ไซส์ของ "${p.name}" ใหม่อีกครั้ง`);
      if (v.stock < qty) fail(409, `สินค้า "${p.name}" (${v.label}) คงเหลือเพียง ${v.stock} ${p.unit || ''}`);
    } else if (p.stock < qty) fail(409, `สินค้า "${p.name}" คงเหลือเพียง ${p.stock} ${p.unit || ''}`);
    // รายการสุดท้ายของสินค้านี้รับยอดที่เหลือทั้งหมด ผลรวมทุกรายการจึงเท่ากับราคาชุดพอดี
    const lt = qty === p.left.qty ? round2(p.left.total) : round2((p.left.total * qty) / p.left.qty);
    p.left = { qty: p.left.qty - qty, total: p.left.total - lt };
    subtotal += lt;
    lines.push({ p, v, qty, lt });
  }
  subtotal = round2(subtotal);
  // ไม่มีจัดส่งถึงบ้าน: ทุกคำสั่งซื้อรับเองที่จุดรับสินค้าที่เลือก
  const delivery = 'pickup';
  const shipping = 0;
  const pickupPoint = clean(b.pickup_point, 120);
  if (!PICKUP_POINTS.includes(pickupPoint)) fail(400, 'กรุณาเลือกจุดรับสินค้า');
  const total = round2(subtotal + shipping);
  const recipient = clean(b.recipient_name, 100) || user.name;
  const phone = clean(b.phone, 20) || user.phone || '';
  const address = '';
  if (!phone) fail(400, 'กรุณากรอกเบอร์โทรศัพท์ติดต่อ');

  const orderNo = makeOrderNo();
  const OID = '(SELECT id FROM shop_orders WHERE order_no = ?)';
  const stmts = [];
  // ด่านแรกของชุด: ถ้าสินค้าตัวไหนจะติดลบ CHECK ของ shop_stock_guard ทำให้ทั้งชุดถูกยกเลิก (transaction)
  for (const { p, v, qty } of lines) {
    if (v) stmts.push(env.DB.prepare('UPDATE shop_variants SET stock = stock - ? WHERE id = ?').bind(qty, v.id)); // CHECK กันติดลบ
    else stmts.push(env.DB.prepare(`INSERT INTO shop_stock_guard (balance) SELECT COALESCE(stock, 0) - ? FROM ec_products WHERE id = ?`).bind(qty, p.id));
  }
  stmts.push(env.DB.prepare('DELETE FROM shop_stock_guard'));
  stmts.push(env.DB.prepare(`INSERT INTO shop_orders (order_no, member_id, status, subtotal, shipping_fee, total, delivery_method, pickup_point, recipient_name, phone, address, note)
                             VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(orderNo, user.id, subtotal, shipping, total, delivery, pickupPoint, recipient, phone, address, clean(b.note, 500)));
  for (const { p, v, qty, lt } of lines) {
    // ชื่อในรายการสั่งซื้อรวมสี/ไซส์ไว้ด้วย หน้าคำสั่งซื้อ อีเมล และไฟล์ส่งออกจึงแสดงได้ทันที
    stmts.push(env.DB.prepare(`INSERT INTO shop_order_items (order_id, product_id, variant_id, variant, sku, name, unit, price, qty, line_total, promo_note) VALUES (${OID}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderNo, p.id, v?.id ?? null, v?.label ?? null, p.sku, v ? `${p.name} (${v.label})` : p.name, p.unit, p.price, qty, lt, p.note));
    if (v) {
      stmts.push(syncProductStock(env, p.id));
      stmts.push(env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, variant_id, variant, delta, balance, reason, ref) SELECT ?, id, ?, ?, stock, 'order', ? FROM shop_variants WHERE id = ?`)
        .bind(p.id, v.label, -qty, orderNo, v.id));
      continue;
    }
    stmts.push(env.DB.prepare(`UPDATE ec_products SET stock = COALESCE(stock, 0) - ? WHERE id = ?`).bind(qty, p.id));
    stmts.push(env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref) SELECT id, ?, stock, 'order', ? FROM ec_products WHERE id = ?`)
      .bind(-qty, orderNo, p.id));
  }
  stmts.push(env.DB.prepare(`INSERT INTO shop_order_logs (order_id, status, note, by_member) VALUES (${OID}, 'pending_payment', 'สร้างคำสั่งซื้อ', ?)`).bind(orderNo, user.id));
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (isCheckError(e)) fail(409, 'สต็อกสินค้าไม่เพียงพอ (อาจมีผู้สั่งซื้อพร้อมกัน) กรุณาตรวจสอบตะกร้าแล้วลองใหม่');
    throw e;
  }
  const o = await loadOrder(env, orderNo);
  ctx.waitUntil(notifyNewOrder(env, o, s, url.origin));
  return json({ order: publicOrder(o) });
}, 'user');

on('GET', '/orders', async ({ env, user }) => {
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.order_no, o.status, o.total, o.delivery_method, o.pickup_point, o.created_at, o.updated_at,
       (SELECT SUM(qty) FROM shop_order_items WHERE order_id = o.id) AS item_count,
       (SELECT group_concat(name, ', ') FROM shop_order_items WHERE order_id = o.id) AS item_names
     FROM shop_orders o WHERE o.member_id = ? ORDER BY o.id DESC LIMIT 200`
  ).bind(user.id).all();
  return json({ orders: results });
}, 'user');

on('GET', '/orders/:id', async ({ env, user, params }) => json({ order: publicOrder(await ownOrder(env, user, params.id)) }), 'user');

on('POST', '/orders/:id/slip', async ({ req, env, ctx, url, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  if (!['pending_payment', 'verifying'].includes(o.status)) fail(400, 'คำสั่งซื้อนี้ไม่อยู่ในสถานะที่แนบสลิปได้');
  await hitLimit(env, `slip:${user.id}`, 20, 3600);
  const form = await req.formData();
  const key = await saveUpload(env, form.get('slip'), 'slips');
  const note = clean(form.get('note'), 300);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shop_orders SET slip_key = ?, slip_uploaded_at = datetime('now'), status = 'verifying', updated_at = datetime('now') WHERE id = ?`).bind(key, o.id),
    env.DB.prepare(`INSERT INTO shop_order_logs (order_id, status, note, by_member) VALUES (?, 'verifying', ?, ?)`).bind(o.id, 'แนบสลิปการโอนเงิน' + (note ? ` — ${note}` : ''), user.id),
  ]);
  if (o.slip_key) ctx.waitUntil(deleteFile(env, o.slip_key));
  const updated = await loadOrder(env, o.id);
  ctx.waitUntil(getSettings(env).then((s) => notifySlip(env, updated, s, url.origin)));
  return json({ order: publicOrder(updated) });
}, 'user');

on('GET', '/orders/:id/slip', async ({ env, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  const f = await getFile(env, o.slip_key);
  if (!f) fail(404, 'ยังไม่มีสลิป');
  return slipResponse(f);
}, 'user');

/* ผู้ซื้อ (ส่วนภูมิภาค): ดูใบเสร็จค่าส่ง และแนบสลิปค่าส่งไปรษณีย์ที่โอนให้ผู้ส่งสินค้า */
on('GET', '/orders/:id/postage-receipt', async ({ env, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  const f = await getFile(env, o.postage_receipt_key);
  if (!f) fail(404, 'ยังไม่มีใบเสร็จค่าส่ง');
  return slipResponse(f);
}, 'user');

on('GET', '/orders/:id/postage-slip', async ({ env, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  const f = await getFile(env, o.postage_slip_key);
  if (!f) fail(404, 'ยังไม่มีสลิปค่าส่ง');
  return slipResponse(f);
}, 'user');

on('POST', '/orders/:id/postage-slip', async ({ req, env, ctx, url, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  if (!['postage_due', 'postage_verifying'].includes(o.status)) fail(400, 'คำสั่งซื้อนี้ยังไม่มีการแจ้งค่าส่งไปรษณีย์');
  await hitLimit(env, `slip:${user.id}`, 20, 3600);
  const form = await req.formData();
  const key = await saveUpload(env, form.get('slip'), 'postage-slips');
  const note = clean(form.get('note'), 300);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shop_orders SET postage_slip_key = ?, postage_slip_at = datetime('now'), status = 'postage_verifying', updated_at = datetime('now') WHERE id = ?`).bind(key, o.id),
    postageLog(env, o.id, 'postage_verifying', 'แนบสลิปค่าส่งไปรษณีย์' + (note ? ` — ${note}` : ''), null, user.id),
  ]);
  if (o.postage_slip_key) ctx.waitUntil(deleteFile(env, o.postage_slip_key));
  const updated = await loadOrder(env, o.id);
  const base = siteUrl(env, url.origin);
  ctx.waitUntil(sendTelegram(env, `📮 แนบสลิปค่าส่งไปรษณีย์ ${o.order_no}\nผู้สั่ง: ${o.user_name}\nยอด ฿${money(o.postage_amount)} — รอผู้ส่งสินค้ายืนยัน\n${adminOrderUrl(base, o.id)}`));
  return json({ order: publicOrder(updated) });
}, 'user');

on('POST', '/orders/:id/cancel', async ({ env, ctx, url, user, params }) => {
  const o = await ownOrder(env, user, params.id);
  if (!['pending_payment', 'verifying'].includes(o.status)) fail(400, 'คำสั่งซื้อนี้ชำระเงินแล้ว หากต้องการยกเลิกกรุณาติดต่อเจ้าหน้าที่');
  await cancelOrder(env, o, { member: user.id }, 'ผู้สั่งซื้อยกเลิกเอง');
  const updated = await loadOrder(env, o.id);
  ctx.waitUntil(getSettings(env).then((s) => notifyStatus(env, updated, s, url.origin)));
  return json({ order: publicOrder(updated) });
}, 'user');

/* ================================================================== ADMIN (เจ้าหน้าที่) */
const FLOW = ['pending_payment', 'verifying', 'paid', 'preparing', 'shipped', 'received', 'postage_due', 'postage_verifying', 'completed'];
const PAID = ['paid', 'preparing', 'shipped', 'received', 'postage_due', 'postage_verifying', 'completed'];
/** เข้าได้เฉพาะผ่าน API ค่าส่งไปรษณีย์ (ต้องมียอด ใบเสร็จ และบัญชี) — เปลี่ยนสถานะทั่วไปไปที่นี่ไม่ได้ */
const POSTAGE_STATES = ['postage_due', 'postage_verifying'];
const paidIn = `('${PAID.join("','")}')`;

/**
 * เดินหน้าได้เสมอ ส่วนการย้อนเป็นการแก้ไขข้อผิดพลาด จึงให้เฉพาะแอดมินใหญ่พร้อมเหตุผล
 * ย้อนกลับไป "รอชำระเงิน" ได้ทางเดียวคือปฏิเสธสลิป เพราะสถานะนี้ถูกยกเลิกอัตโนมัติและคืนสต็อกได้
 */
function assertTransition(from, to, staff, note) {
  if (from === to || FLOW.indexOf(to) > FLOW.indexOf(from)) return;
  if (to === 'pending_payment') {
    if (from === 'verifying') return;
    fail(400, 'คำสั่งซื้อนี้ย้อนกลับไปรอชำระเงินโดยตรงไม่ได้ กรุณาย้อนเป็น “รอตรวจสอบการชำระ” แล้วกด “สลิปไม่ถูกต้อง”');
  }
  if (!staff.owner) fail(403, 'การย้อนสถานะทำได้เฉพาะแอดมินใหญ่');
  if (!note) fail(400, 'กรุณาระบุเหตุผลที่ย้อนสถานะ');
}

on('GET', '/admin/me', async ({ staff }) => json({
  user: { name: staffName(staff), email: staff.email, owner: staff.owner, emdash: !!staff.emdash, member_id: staff.member_id ?? null, perms: staff.perms, must_change: staff.must_change },
}), 'staff');

on('GET', '/admin/stats', async ({ env, staff }) => {
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [byStatus, today, month, total, members, low, top, recent, latest] = await env.DB.batch([
    q('SELECT status, COUNT(*) AS n FROM shop_orders GROUP BY status'),
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS sum FROM shop_orders WHERE status IN ${paidIn} AND date(created_at,'+7 hours') = date('now','+7 hours')`),
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS sum FROM shop_orders WHERE status IN ${paidIn} AND strftime('%Y-%m', created_at,'+7 hours') = strftime('%Y-%m','now','+7 hours')`),
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS sum FROM shop_orders WHERE status IN ${paidIn}`),
    q(`SELECT COUNT(*) AS n FROM shop_members`),
    q(`SELECT id, sku, title AS name, COALESCE(stock, 0) AS stock, unit FROM ec_products WHERE ${LIVE_PRODUCT} AND COALESCE(stock, 0) <= 5 ORDER BY stock, title LIMIT 15`),
    q(`SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS sum FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' GROUP BY oi.product_id ORDER BY qty DESC LIMIT 5`),
    q(`SELECT o.id, o.order_no, o.status, o.total, o.created_at, m.name AS user_name, m.department AS user_department
       FROM shop_orders o JOIN shop_members m ON m.id = o.member_id ORDER BY o.id DESC LIMIT 8`),
    q('SELECT COALESCE(MAX(id),0) AS id FROM shop_orders'),
  ]);
  // ส่งเฉพาะตัวเลขที่บัญชีนี้มีสิทธิ์เห็น
  return json({
    ...(can(staff, 'orders_view') && {
      by_status: Object.fromEntries(byStatus.results.map((r) => [r.status, r.n])),
      today: today.results[0], month: month.results[0], total: total.results[0],
      top_products: top.results, recent: recent.results, latest_order_id: latest.results[0].id,
    }),
    ...(can(staff, 'members_view') && { members: members.results[0].n }),
    ...(can(staff, 'stock_manage') && { low_stock: low.results }),
  });
}, 'staff');

function orderFilters(url) {
  const where = [];
  const args = [];
  const status = clean(url.searchParams.get('status'), 30);
  const q = clean(url.searchParams.get('q'), 100);
  const from = clean(url.searchParams.get('from'), 10);
  const to = clean(url.searchParams.get('to'), 10);
  const pickup = clean(url.searchParams.get('pickup'), 120);
  if (pickup) { where.push('o.pickup_point = ?'); args.push(pickup); }
  if (status === 'to_ship') where.push(`o.status IN ('paid','preparing')`);
  else if (status) { where.push('o.status = ?'); args.push(status); }
  if (q) { where.push('(o.order_no LIKE ? OR m.name LIKE ? OR m.email LIKE ? OR o.phone LIKE ? OR m.department LIKE ?)'); args.push(...Array(5).fill(`%${q}%`)); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push(`date(o.created_at,'+7 hours') >= ?`); args.push(from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push(`date(o.created_at,'+7 hours') <= ?`); args.push(to); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

on('GET', '/admin/orders', async ({ env, url }) => {
  const f = orderFilters(url);
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.order_no, o.status, o.total, o.delivery_method, o.pickup_point, o.phone, o.created_at, o.updated_at, o.slip_key IS NOT NULL AS has_slip, o.postage_slip_key IS NOT NULL AS has_postage_slip, o.postage_amount,
       m.name AS user_name, m.email AS user_email, m.department AS user_department,
       (SELECT SUM(qty) FROM shop_order_items WHERE order_id = o.id) AS item_count,
       (SELECT group_concat(name || ' ×' || qty, ', ') FROM shop_order_items WHERE order_id = o.id) AS item_names
     FROM shop_orders o JOIN shop_members m ON m.id = o.member_id ${f.sql} ORDER BY o.id DESC LIMIT 500`
  ).bind(...f.args).all();
  return json({ orders: results });
}, 'staff:orders_view');

on('GET', '/admin/orders/export', async ({ env, url }) => {
  const f = orderFilters(url);
  const { results } = await env.DB.prepare(
    `SELECT o.order_no, o.created_at, o.status, m.name AS user_name, m.email AS user_email, m.department AS user_department,
       o.recipient_name, o.phone, o.delivery_method, o.pickup_point, o.address, o.note, oi.sku, oi.name, oi.unit, oi.price, oi.qty, oi.line_total,
       o.shipping_fee, o.total, o.paid_at, o.tracking_no
     FROM shop_orders o JOIN shop_members m ON m.id = o.member_id JOIN shop_order_items oi ON oi.order_id = o.id ${f.sql} ORDER BY o.id DESC, oi.id`
  ).bind(...f.args).all();
  return json({ rows: results });
}, 'staff:orders_export');

/** รายงานยอดขาย: นับเฉพาะคำสั่งซื้อที่ชำระเงินแล้ว (paid → completed) ตามวันที่สั่งซื้อ เวลาไทย */
const REPORT_GROUP = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
on('GET', '/admin/reports', async ({ env, url }) => {
  const group = Object.hasOwn(REPORT_GROUP, url.searchParams.get('group')) ? url.searchParams.get('group') : 'day';
  const day = (v, d) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : d);
  const from = day(url.searchParams.get('from'), '2000-01-01');
  const to = day(url.searchParams.get('to'), '2999-12-31');
  if (from > to) fail(400, 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
  const fmt = REPORT_GROUP[group]; // ค่าคงที่จาก allowlist ด้านบน ไม่ใช่ข้อมูลผู้ใช้
  const inRange = `o.status IN ${paidIn} AND date(o.created_at, '+7 hours') BETWEEN ? AND ?`;
  const q = (sql) => env.DB.prepare(sql).bind(from, to);
  const [periods, products, pickup, summary] = await env.DB.batch([
    q(`SELECT strftime('${fmt}', o.created_at, '+7 hours') AS period, COUNT(*) AS orders, COUNT(DISTINCT o.member_id) AS buyers,
         COALESCE(SUM(o.total), 0) AS total,
         COALESCE(SUM((SELECT SUM(qty) FROM shop_order_items WHERE order_id = o.id)), 0) AS items
       FROM shop_orders o WHERE ${inRange} GROUP BY period ORDER BY period`),
    q(`SELECT oi.sku, oi.name, oi.unit, SUM(oi.qty) AS qty, SUM(oi.line_total) AS total, COUNT(DISTINCT o.id) AS orders
       FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id WHERE ${inRange}
       GROUP BY COALESCE(oi.product_id, oi.name), oi.name ORDER BY total DESC, qty DESC`),
    q(`SELECT COALESCE(NULLIF(o.pickup_point, ''), '-') AS pickup_point, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS total
       FROM shop_orders o WHERE ${inRange} GROUP BY 1 ORDER BY total DESC`),
    q(`SELECT COUNT(*) AS orders, COUNT(DISTINCT o.member_id) AS buyers, COALESCE(SUM(o.total), 0) AS total,
         COALESCE(SUM((SELECT SUM(qty) FROM shop_order_items WHERE order_id = o.id)), 0) AS items
       FROM shop_orders o WHERE ${inRange}`),
  ]);
  return json({ group, from, to, summary: summary.results[0], periods: periods.results, products: products.results, pickup: pickup.results });
}, 'staff:orders_view');

on('GET', '/admin/orders/:id', async ({ env, params }) => {
  const o = await loadOrder(env, params.id);
  if (!o) fail(404, 'ไม่พบคำสั่งซื้อ');
  // บัญชีรับค่าส่งไปรษณีย์ค่าเริ่มต้น (ตั้งค่าร้าน) สำหรับเติมฟอร์มแจ้งค่าส่ง
  const s = o.is_regional ? await getSettings(env) : null;
  const postage_default_account = s ? postageAccountText(s) : '';
  const pickup_address = s ? String(pickupAddresses(s)[o.pickup_point] || '') : '';
  return json({ order: publicOrder(o), postage_default_account, pickup_address, label_sender: s ? s.label_sender : "" });
}, 'staff:orders_view');

on('GET', '/admin/orders/:id/slip', async ({ env, params }) => {
  const o = await loadOrder(env, params.id);
  const f = o && (await getFile(env, o.slip_key));
  if (!f) fail(404, 'ยังไม่มีสลิป');
  return slipResponse(f);
}, 'staff:orders_view');

on('POST', '/admin/orders/:id/status', async ({ req, env, ctx, url, staff, params }) => {
  const b = await readJson(req);
  const status = clean(b.status, 30);
  const note = clean(b.note, 500);
  const o = await loadOrder(env, params.id);
  if (!o) fail(404, 'ไม่พบคำสั่งซื้อ');
  if (o.status === 'cancelled') fail(400, 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว (คืนสต็อกแล้ว) ไม่สามารถเปลี่ยนสถานะได้');
  // แบ่งหน้าที่: ห้ามอนุมัติคำสั่งซื้อของตัวเอง
  if (staff.member_id && staff.member_id === o.member_id) fail(403, 'ไม่สามารถดำเนินการกับคำสั่งซื้อของตัวเองได้ กรุณาให้ผู้ดูแลคนอื่นดำเนินการ');
  if (status === 'cancelled') {
    requirePerm(staff, 'orders_cancel');
    if (o.status === 'completed') {
      if (!staff.owner) fail(403, 'คำสั่งซื้อที่สำเร็จแล้ว ยกเลิกได้เฉพาะแอดมินใหญ่');
      if (!note) fail(400, 'กรุณาระบุเหตุผลที่ยกเลิกคำสั่งซื้อที่สำเร็จแล้ว');
    }
    await cancelOrder(env, o, { admin: staffName(staff) }, note || 'ยกเลิกโดยเจ้าหน้าที่');
  } else {
    if (!FLOW.includes(status)) fail(400, 'สถานะไม่ถูกต้อง');
    if (POSTAGE_STATES.includes(status)) fail(400, 'การแจ้งค่าส่งไปรษณีย์ ใช้ปุ่ม “แจ้งยอดค่าส่งไปรษณีย์” ในหน้าคำสั่งซื้อ');
    const touchesPayment = ['pending_payment', 'verifying', 'paid'].includes(status) || ['pending_payment', 'verifying'].includes(o.status);
    // แยกหน้าที่: ขั้นตอนการเงินต้องมีสิทธิ์ตรวจการชำระเงิน และขั้นจัดเตรียม/ส่งมอบต้องมีสิทธิ์จัดส่ง
    // (ข้ามขั้นจาก "รอชำระ" ไป "ส่งแล้ว" จึงต้องมีทั้งสองสิทธิ์)
    if (touchesPayment) requirePerm(staff, 'orders_payment');
    if (['preparing', 'shipped', 'received', 'completed'].includes(status)) requirePerm(staff, 'orders_fulfill');
    if (status === 'received' && !o.is_regional) fail(400, 'สถานะนี้ใช้กับคำสั่งซื้อส่วนภูมิภาคเท่านั้น');
    // ข้ามขั้นค่าส่งไปรษณีย์ (เช่น ไม่เก็บค่าส่ง) ต้องมีเหตุผล
    if (status === 'completed' && o.is_regional && !o.postage_paid_at && !note) fail(400, 'คำสั่งซื้อส่วนภูมิภาคยังไม่ได้รับค่าส่งไปรษณีย์ หากจะปิดงานโดยไม่เก็บค่าส่ง กรุณาระบุเหตุผล');
    if (status === 'pending_payment' && o.status === 'verifying' && !note) fail(400, 'กรุณาระบุเหตุผลที่สลิปไม่ถูกต้อง เพื่อแจ้งผู้สั่งซื้อ');
    assertTransition(o.status, status, staff, note);
    const tracking = b.tracking_no !== undefined && can(staff, 'orders_fulfill') ? clean(b.tracking_no, 100) : o.tracking_no;
    await env.DB.batch([
      env.DB.prepare(`UPDATE shop_orders SET status = ?, tracking_no = ?, admin_note = COALESCE(NULLIF(?, ''), admin_note),
          paid_at = CASE WHEN ? NOT IN ${paidIn} THEN NULL WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
          updated_at = datetime('now') WHERE id = ?`).bind(status, tracking, note, status, o.id),
      env.DB.prepare('INSERT INTO shop_order_logs (order_id, status, note, by_admin) VALUES (?, ?, ?, ?)').bind(o.id, status, note || null, staffName(staff)),
    ]);
  }
  const updated = await loadOrder(env, o.id);
  if (b.notify !== false) ctx.waitUntil(getSettings(env).then((s) => notifyStatus(env, updated, s, url.origin, note)));
  return json({ order: publicOrder(updated) });
}, 'staff');

/* ================================================ ค่าส่งไปรษณีย์ (รับสินค้าที่ส่วนภูมิภาค)
 * 1) ส่งพัสดุ (shipped) -> ลูกค้าได้รับสินค้า (received) -> แจ้งยอดค่าส่ง + รูปใบเสร็จไปรษณีย์ + บัญชีผู้ส่งสินค้า -> postage_due
 * 2) ผู้ซื้อโอนเข้าบัญชีผู้ส่งสินค้า แล้วแนบสลิป -> postage_verifying
 * 3) ผู้ส่งสินค้ายืนยันว่าได้รับเงินครบ -> completed (หรือปฏิเสธพร้อมเหตุผล -> กลับไป postage_due)
 * เงินค่าส่งไม่ใช่รายได้ร้าน: ไม่รวมในยอดขาย/รายงาน (total ไม่เปลี่ยน) และไม่เกี่ยวกับสต็อก */
const postageLog = (env, id, status, note, staff, memberId) =>
  env.DB.prepare('INSERT INTO shop_order_logs (order_id, status, note, by_admin, by_member) VALUES (?, ?, ?, ?, ?)')
    .bind(id, status, note || null, staff ? staffName(staff) : null, memberId ?? null);

on('POST', '/admin/orders/:id/postage', async ({ req, env, ctx, url, staff, params }) => {
  const o = await loadOrder(env, params.id);
  if (!o) fail(404, 'ไม่พบคำสั่งซื้อ');
  if (!o.is_regional) fail(400, 'คำสั่งซื้อนี้รับสินค้าที่ส่วนกลาง ไม่มีค่าส่งไปรษณีย์');
  if (staff.member_id && staff.member_id === o.member_id) fail(403, 'ไม่สามารถดำเนินการกับคำสั่งซื้อของตัวเองได้ กรุณาให้ผู้ดูแลคนอื่นดำเนินการ');
  if (!['received', 'postage_due', 'postage_verifying'].includes(o.status)) fail(400, 'แจ้งค่าส่งไปรษณีย์ได้หลังจากกด “ลูกค้าได้รับสินค้าแล้ว”');
  const form = await req.formData();
  const amount = round2(Number(clean(form.get('amount'), 20)));
  if (!(amount > 0) || amount > 100000) fail(400, 'กรุณากรอกยอดค่าส่งไปรษณีย์ให้ถูกต้อง');
  const account = clean(form.get('account'), 500);
  if (!account) fail(400, 'กรุณากรอกบัญชีสำหรับรับค่าส่ง (ธนาคาร เลขบัญชี ชื่อบัญชี)');
  const file = form.get('receipt');
  const hasNew = file && typeof file === 'object' && file.size > 0;
  if (!hasNew && !o.postage_receipt_key) fail(400, 'กรุณาแนบรูปใบเสร็จค่าส่งไปรษณีย์');
  const key = hasNew ? await saveUpload(env, file, 'postage') : o.postage_receipt_key;
  const note = clean(form.get('note'), 300);
  await env.DB.batch([
    env.DB.prepare(`UPDATE shop_orders SET status = 'postage_due', postage_amount = ?, postage_account = ?, postage_receipt_key = ?,
        postage_billed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(amount, account, key, o.id),
    postageLog(env, o.id, 'postage_due', `แจ้งค่าส่งไปรษณีย์ ฿${money(amount)}` + (note ? ` — ${note}` : ''), staff),
  ]);
  if (hasNew && o.postage_receipt_key) ctx.waitUntil(deleteFile(env, o.postage_receipt_key));
  const updated = await loadOrder(env, o.id);
  ctx.waitUntil(getSettings(env).then((s) => notifyStatus(env, updated, s, url.origin, note)));
  return json({ order: publicOrder(updated) });
}, 'staff:orders_fulfill');

on('POST', '/admin/orders/:id/postage-confirm', async ({ req, env, ctx, url, staff, params }) => {
  const b = await readJson(req);
  const o = await loadOrder(env, params.id);
  if (!o) fail(404, 'ไม่พบคำสั่งซื้อ');
  if (staff.member_id && staff.member_id === o.member_id) fail(403, 'ไม่สามารถดำเนินการกับคำสั่งซื้อของตัวเองได้ กรุณาให้ผู้ดูแลคนอื่นดำเนินการ');
  if (o.status !== 'postage_verifying') fail(400, 'คำสั่งซื้อนี้ยังไม่มีสลิปค่าส่งไปรษณีย์ให้ตรวจสอบ');
  const note = clean(b.note, 300);
  if (b.ok) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE shop_orders SET status = 'completed', postage_paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(o.id),
      postageLog(env, o.id, 'completed', 'ได้รับเงินค่าส่งไปรษณีย์ครบถ้วนแล้ว' + (note ? ` — ${note}` : ''), staff),
    ]);
  } else {
    if (!note) fail(400, 'กรุณาระบุเหตุผลที่สลิปค่าส่งไม่ถูกต้อง เพื่อแจ้งผู้สั่งซื้อ');
    await env.DB.batch([
      env.DB.prepare(`UPDATE shop_orders SET status = 'postage_due', updated_at = datetime('now') WHERE id = ?`).bind(o.id),
      postageLog(env, o.id, 'postage_due', `สลิปค่าส่งไม่ถูกต้อง: ${note}`, staff),
    ]);
  }
  const updated = await loadOrder(env, o.id);
  ctx.waitUntil(getSettings(env).then((s) => notifyStatus(env, updated, s, url.origin, note)));
  return json({ order: publicOrder(updated) });
}, 'staff:orders_fulfill');

on('GET', '/admin/orders/:id/postage-receipt', async ({ env, params }) => {
  const o = await loadOrder(env, params.id);
  const f = o && (await getFile(env, o.postage_receipt_key));
  if (!f) fail(404, 'ยังไม่มีใบเสร็จค่าส่ง');
  return slipResponse(f);
}, 'staff:orders_view');

on('GET', '/admin/orders/:id/postage-slip', async ({ env, params }) => {
  const o = await loadOrder(env, params.id);
  const f = o && (await getFile(env, o.postage_slip_key));
  if (!f) fail(404, 'ยังไม่มีสลิปค่าส่ง');
  return slipResponse(f);
}, 'staff:orders_view');

/* ---- สินค้า: แก้ข้อมูลสินค้าในหลังบ้าน EmDash; ที่นี่ดูยอดขายและปรับสต็อกพร้อมบันทึกประวัติ ---- */
/** URL รูปจากช่องรูปของ EmDash (JSON ที่มี meta.storageKey) — ใช้แสดงรูปย่อในหลังบ้าน */
function mediaUrl(raw) {
  try {
    const key = JSON.parse(raw || 'null')?.meta?.storageKey;
    return typeof key === 'string' && /^[\w.\-\/]+$/.test(key) ? '/_emdash/api/media/file/' + key.split('/').map(encodeURIComponent).join('/') : '';
  } catch { return ''; }
}

on('GET', '/admin/products', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.sku, p.title AS name, p.price, COALESCE(p.stock, 0) AS stock, p.unit, p.category, p.status, p.image,
       p.description, p.new_until, p.new_badge, p.promo_badge, p.promo_start, p.promo_end, p.bulk_qty, p.bulk_price, p.price_tiers, p.price_bundles,
       (SELECT COALESCE(SUM(oi.qty),0) FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id AND o.status != 'cancelled') AS sold
     FROM ec_products p WHERE p.deleted_at IS NULL ORDER BY (p.status = 'published') DESC, p.category, p.title`
  ).all();
  const variants = await variantsByProduct(env, results.map((p) => p.id));
  const sold = await env.DB.prepare(
    `SELECT oi.variant_id, COALESCE(SUM(oi.qty), 0) AS n FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
     WHERE oi.variant_id IS NOT NULL AND o.status != 'cancelled' GROUP BY oi.variant_id`
  ).all();
  const soldBy = new Map(sold.results.map((r) => [r.variant_id, r.n]));
  return json({
    products: results.map(({ image, ...p }) => ({ ...p, image_url: mediaUrl(image), variants: (variants.get(p.id) || []).map((v) => ({ ...v, sold: soldBy.get(v.id) || 0 })) })),
  });
}, 'staff:stock_manage');

/* ---- เพิ่มสินค้าใหม่จากหลังบ้านร้าน ----
 * สร้างผ่าน EmDash runtime (handleContentCreate / handleMediaUpload) ไม่เขียน SQL ตรง สินค้าจึงขึ้นในหลังบ้านใหญ่ทันที
 * พร้อมประวัติการแก้ไข ดัชนีค้นหา และรูปในคลังสื่อ เหมือนเพิ่มจาก EmDash เอง */
const PRODUCT_IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PRODUCT_IMAGE = 5_000_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toBase64 = (buf) => {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};

/** อ่านและตรวจฟอร์มสินค้า (ใช้ทั้งเพิ่มและแก้ไข) — ช่องที่เว้นว่างได้คืนค่า null (ตอนแก้ไข = ล้างค่าเดิม) */
async function readProductForm(req, env, editingId = null) {
  let fd;
  try { fd = await req.formData(); } catch { fail(400, 'รูปแบบข้อมูลไม่ถูกต้อง'); }
  const str = (k, max) => clean(fd.get(k), max);
  const money = (k) => { const v = str(k, 20); if (v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? round2(n) : NaN; };
  // ฟิลด์ datetime ของ EmDash ต้องเป็น ISO เต็ม: เก็บเป็นเที่ยงคืนเวลาไทยของวันนั้น (pricing.js แปลงกลับเป็นวันไทยได้ตรงวัน)
  const day = (k, label) => {
    const v = str(k, 10);
    if (!v) return null;
    const t = DATE_RE.test(v) ? Date.parse(`${v}T00:00:00+07:00`) : NaN;
    if (Number.isNaN(t)) fail(400, `${label}ไม่ถูกต้อง`);
    return new Date(t).toISOString();
  };

  const title = str('title', 200);
  if (!title) fail(400, 'กรุณากรอกชื่อสินค้า');
  const price = money('price');
  if (price === null || Number.isNaN(price)) fail(400, 'กรุณากรอกราคาให้ถูกต้อง');
  const unit = str('unit', 30) || 'ชิ้น';
  const category = str('category', 100) || null;
  if (category === OTHER_CATEGORY) fail(400, `หมวด "${OTHER_CATEGORY}" ใช้กับสินค้าสวัสดิการเดิม กรุณาเลือกหมวดอื่น`);
  const sku = str('sku', 60) || null;
  if (sku && (await env.DB.prepare('SELECT 1 FROM ec_products WHERE sku = ? AND deleted_at IS NULL AND id != ?').bind(sku, editingId || '').first()))
    fail(409, `รหัสสินค้า "${sku}" มีอยู่แล้ว`);

  // ราคาตามจำนวน (ไม่บังคับ): หน้าฟอร์มส่งเป็นข้อความ "50=1100, 100=1000" — ตรวจทุกขั้นแล้วเก็บแบบเรียงจำนวน
  const tierInput = parseTierText(str('price_tiers', 1000));
  const seenQty = new Set();
  for (const t of tierInput) {
    if (!Number.isInteger(t.qty) || t.qty < 2 || t.qty > 100000) fail(400, `จำนวนขั้นราคา "${t.qty}" ต้องเป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป`);
    if (!(t.price > 0)) fail(400, `กรุณากรอกราคาของขั้น ${t.qty} ชิ้นขึ้นไป`);
    if (!(t.price < price)) fail(400, `ราคาขั้น ${t.qty} ชิ้นขึ้นไป (฿${t.price}) ต้องต่ำกว่าราคาปกติ`);
    if (seenQty.has(t.qty)) fail(400, `ขั้นราคา ${t.qty} ชิ้นขึ้นไป ซ้ำกัน`);
    seenQty.add(t.qty);
  }
  if (tierInput.length > 10) fail(400, 'ขั้นราคาได้ไม่เกิน 10 ขั้น');
  // ราคาแบบชุด (ไม่บังคับ): "3=100, 5=150" = 3 ชิ้นราคารวม 100 บาท
  const bundleInput = parseTierText(str('price_bundles', 1000));
  const seenBundle = new Set();
  for (const t of bundleInput) {
    if (!Number.isInteger(t.qty) || t.qty < 2 || t.qty > 10000) fail(400, `จำนวนในชุด "${t.qty}" ต้องเป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป`);
    if (!(t.price > 0)) fail(400, `กรุณากรอกราคารวมของชุด ${t.qty} ชิ้น`);
    if (!(t.price < price * t.qty)) fail(400, `ราคาชุด ${t.qty} ชิ้น (฿${t.price}) ต้องถูกกว่าซื้อแยกชิ้น (฿${round2(price * t.qty)})`);
    if (seenBundle.has(t.qty)) fail(400, `ราคาชุด ${t.qty} ชิ้น ซ้ำกัน`);
    seenBundle.add(t.qty);
  }
  if (bundleInput.length > 10) fail(400, 'ราคาแบบชุดได้ไม่เกิน 10 ชุด');
  const bundles = bundleInput.map((t) => ({ qty: t.qty, price: round2(t.price) })).sort((a, b) => a.qty - b.qty);
  const tiers = tierInput.map((t) => ({ qty: t.qty, price: round2(t.price) })).sort((a, b) => a.qty - b.qty);
  const newUntil = day('new_until', 'วันที่สิ้นสุดป้ายสินค้าใหม่');
  // ป้ายโปรโมชั่น: แค่บอกช่วงวันที่ ไม่เปลี่ยนราคา
  const promoStart = day('promo_start', 'วันเริ่มโปรโมชั่น');
  const promoEnd = day('promo_end', 'วันสิ้นสุดโปรโมชั่น');
  if (promoStart && promoEnd && promoEnd < promoStart) fail(400, 'วันสิ้นสุดโปรโมชั่นต้องไม่ก่อนวันเริ่ม');

  const file = fd.get('image');
  return {
    fields: {
      title, price, unit, category, sku,
      description: str('description', 5000) || null,
      new_until: newUntil,
      // ติ๊ก = แสดงป้ายสินค้าใหม่ทันทีจนกว่าจะเอาออก (ไม่ขึ้นกับวันที่)
      new_badge: str('new_badge', 1) === '1',
      // เก็บทุกขั้นใน price_tiers และล้างฟิลด์ขั้นเดียวแบบเดิม (ฟอร์มรวมค่าเดิมมาเป็นแถวให้แล้ว)
      price_tiers: tiers.length ? tierText(tiers) : null,
      price_bundles: bundles.length ? tierText(bundles) : null,
      bulk_qty: null, bulk_price: null,
      // ติ๊ก = แสดงป้ายโปรโมชั่นทันทีจนกว่าจะเอาออก (ไม่ขึ้นกับวันที่)
      promo_badge: str('promo_badge', 1) === '1',
      promo_start: promoStart, promo_end: promoEnd,
    },
    status: str('status', 10) === 'draft' ? 'draft' : 'published',
    stockRaw: str('stock', 10),
    file: file && typeof file === 'object' && file.size > 0 ? file : null,
    removeImage: str('remove_image', 1) === '1',
  };
}

/** อัปโหลดรูปสินค้าเข้าคลังสื่อ EmDash → { image (ค่าสำหรับฟิลด์ image), uploadedId (ลบทิ้งได้ถ้าบันทึกไม่สำเร็จ) } */
async function uploadProductImage(cms, file, title, sku, emdashUser) {
  const ext = PRODUCT_IMAGE_TYPES[file.type];
  if (!ext) fail(400, 'รูปสินค้ารองรับเฉพาะ JPG, PNG หรือ WebP');
  if (file.size > MAX_PRODUCT_IMAGE) fail(400, 'รูปสินค้าใหญ่เกิน 5 MB');
  const up = await cms.handleMediaUpload({
    filename: `${sku || 'product'}-${Date.now()}.${ext}`,
    base64: toBase64(await file.arrayBuffer()),
    contentType: file.type,
    alt: title,
    maxUploadSize: MAX_PRODUCT_IMAGE,
    ...(emdashUser?.id ? { authorId: emdashUser.id } : {}),
  });
  if (!up.success) fail(400, `อัปโหลดรูปไม่สำเร็จ: ${up.error?.message || 'ไม่ทราบสาเหตุ'}`);
  const m = up.data.item;
  return {
    // รูปซ้ำกับที่มีในคลังแล้ว (deduplicated) เป็นของเดิม ห้ามลบ
    uploadedId: up.data.deduplicated ? null : m.id,
    image: {
      id: m.id, provider: 'local', filename: m.filename, mimeType: m.mimeType,
      ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}),
      ...(m.blurhash ? { blurhash: m.blurhash } : {}), ...(m.dominantColor ? { dominantColor: m.dominantColor } : {}),
      alt: title, meta: { storageKey: m.storageKey },
    },
  };
}
const contentError = (res, what) => {
  const issues = res.error?.details?.issues;
  return `${what}ไม่สำเร็จ: ${issues?.length ? issues.map((i) => i.message).join(', ') : res.error?.message || 'ไม่ทราบสาเหตุ'}`;
};
const actorOf = (emdashUser) => (emdashUser?.id ? { actor: { id: emdashUser.id, role: emdashUser.role, source: 'api' } } : {});

on('POST', '/admin/products', async ({ req, env, staff, cms, emdashUser }) => {
  if (!cms?.handleContentCreate) fail(503, 'ระบบจัดการเนื้อหาไม่พร้อมใช้งาน กรุณาลองใหม่');
  const form = await readProductForm(req, env);
  const stock = form.stockRaw === '' ? 0 : parseInt(form.stockRaw, 10);
  if (!(stock >= 0) || stock > 1_000_000) fail(400, 'จำนวนเริ่มต้นไม่ถูกต้อง');
  const { title, sku } = form.fields;
  const img = form.file ? await uploadProductImage(cms, form.file, title, sku, emdashUser) : null;

  // ตอนสร้างไม่ต้องส่งช่องว่าง (null)
  const data = Object.fromEntries(Object.entries({ ...form.fields, stock, image: img?.image ?? null }).filter(([, v]) => v !== null));
  // slug ห้ามซ้ำ แม้กับสินค้าในถังขยะ (ลบของเก่าแล้วเพิ่มใหม่ชื่อเดิมได้): สร้างจากชื่อเอง ถ้าซ้ำต่อท้าย -2, -3, …
  const base = title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
  // ไม่ใช้ LIKE: D1 ปฏิเสธ pattern ยาว ("LIKE or GLOB pattern too complex") ซึ่งชื่อภาษาไทยยาวถึงได้ง่าย
  const { results: taken } = await env.DB.prepare(`SELECT slug FROM ec_products WHERE slug = ?1 OR substr(slug, 1, length(?1) + 1) = ?1 || '-'`).bind(base).all();
  const used = new Set(taken.map((r) => r.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  const res = await cms.handleContentCreate('products', {
    data, status: form.status, slug,
    ...(emdashUser?.id ? { authorId: emdashUser.id } : {}), ...actorOf(emdashUser),
  });
  if (!res.success) {
    if (img?.uploadedId && cms.handleMediaDelete) await cms.handleMediaDelete(img.uploadedId).catch(() => {});
    fail(400, contentError(res, 'บันทึกสินค้า'));
  }
  const item = res.data.item;
  if (stock > 0) {
    await env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref, admin) VALUES (?, ?, ?, 'adjust', ?, ?)`)
      .bind(item.id, stock, stock, 'ยอดเริ่มต้นเมื่อเพิ่มสินค้า', staffName(staff)).run();
  }
  return json({ product: { id: item.id, slug: item.slug, status: item.status, title } });
}, 'staff:stock_manage');

/* ---- แก้ไขรายละเอียดสินค้า ----
 * บันทึกผ่าน EmDash (handleContentUpdate) จึงมีประวัติการแก้ไขในหลังบ้านใหญ่ · สินค้าที่เผยแพร่อยู่ EmDash เก็บการแก้เป็นฉบับร่าง
 * จึงกดเผยแพร่ต่อให้ทันที (หรือยกเลิกเผยแพร่ถ้าเลือกเก็บเป็นฉบับร่าง)
 * สต็อกไม่แก้ที่นี่ (ใช้ "ปรับสต็อก" เพื่อมีประวัติ) แต่ส่งค่าสต็อกปัจจุบันไปด้วย กันฉบับร่างเขียนทับสต็อกที่ถูกตัดไประหว่างนั้น */
on('POST', '/admin/products/:id', async ({ req, env, params, cms, emdashUser }) => {
  if (!cms?.handleContentUpdate || !cms?.handleContentPublish) fail(503, 'ระบบจัดการเนื้อหาไม่พร้อมใช้งาน กรุณาลองใหม่');
  const cur = await env.DB.prepare('SELECT id, status, image FROM ec_products WHERE id = ? AND deleted_at IS NULL').bind(params.id).first();
  if (!cur) fail(404, 'ไม่พบสินค้า หรือถูกลบไปแล้ว');
  const form = await readProductForm(req, env, cur.id);
  const img = form.file ? await uploadProductImage(cms, form.file, form.fields.title, form.fields.sku, emdashUser) : null;

  const data = { ...form.fields };
  if (img) data.image = img.image;
  else if (form.removeImage) data.image = null;
  // อ่านสต็อกล่าสุดก่อนบันทึกทันที (อาจถูกตัดจากคำสั่งซื้อระหว่างเปิดฟอร์ม)
  data.stock = (await env.DB.prepare('SELECT COALESCE(stock, 0) AS s FROM ec_products WHERE id = ?').bind(cur.id).first()).s;

  const res = await cms.handleContentUpdate('products', cur.id, { data, ...actorOf(emdashUser) });
  if (!res.success) {
    if (img?.uploadedId && cms.handleMediaDelete) await cms.handleMediaDelete(img.uploadedId).catch(() => {});
    fail(400, contentError(res, 'บันทึกการแก้ไข'));
  }
  const pub = form.status === 'published'
    ? await cms.handleContentPublish('products', cur.id)
    : cur.status === 'published' ? await cms.handleContentUnpublish('products', cur.id) : { success: true };
  if (!pub.success) fail(400, contentError(pub, form.status === 'published' ? 'เผยแพร่การแก้ไข' : 'ยกเลิกการแสดงหน้าร้าน'));
  const after = await env.DB.prepare('SELECT status, slug FROM ec_products WHERE id = ?').bind(cur.id).first();
  return json({ product: { id: cur.id, slug: after.slug, status: after.status, title: form.fields.title } });
}, 'staff:stock_manage');

/* ---- ลบสินค้า (เลิกขาย) ----
 * ใช้ handleContentDelete ของ EmDash = ย้ายไปถังขยะ กู้คืนได้ในหลังบ้านใหญ่ ไม่ลบแถวทิ้ง
 * หน้าร้านและการสั่งซื้อรับเฉพาะสินค้าที่ยังไม่ถูกลบ (LIVE_PRODUCT) ส่วนคำสั่งซื้อเก่าเก็บชื่อ/ราคาไว้ในรายการสั่งซื้อเอง ประวัติจึงไม่หาย
 * ถ้ายังมีคำสั่งซื้อที่ยังไม่จบ ตอบ 409 ก่อน ให้ยืนยันอีกครั้ง (?force=1) */
on('DELETE', '/admin/products/:id', async ({ env, url, staff, params, cms }) => {
  if (!cms?.handleContentDelete) fail(503, 'ระบบจัดการเนื้อหาไม่พร้อมใช้งาน กรุณาลองใหม่');
  const p = await env.DB.prepare('SELECT id, title FROM ec_products WHERE id = ? AND deleted_at IS NULL').bind(params.id).first();
  if (!p) fail(404, 'ไม่พบสินค้า หรือถูกลบไปแล้ว');
  const open = await env.DB.prepare(
    `SELECT COUNT(DISTINCT o.id) AS n FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
     WHERE oi.product_id = ? AND o.status NOT IN ('completed', 'cancelled')`
  ).bind(p.id).first();
  if (open.n && url.searchParams.get('force') !== '1') {
    return json({ error: `สินค้านี้ยังมีคำสั่งซื้อที่ยังไม่เสร็จสิ้น ${open.n} รายการ`, code: 'open_orders', open_orders: open.n }, 409);
  }
  const res = await cms.handleContentDelete('products', p.id);
  if (!res.success) fail(400, `ลบสินค้าไม่สำเร็จ: ${res.error?.message || 'ไม่ทราบสาเหตุ'}`);
  await env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref, admin) SELECT id, 0, COALESCE(stock, 0), 'adjust', ?, ? FROM ec_products WHERE id = ?`)
    .bind('ลบสินค้า (ย้ายไปถังขยะ)', staffName(staff), p.id).run();
  return json({ ok: true });
}, 'staff:stock_manage');

/** เพิ่มแบบย่อย: ส่งรายการสีและไซส์ ระบบสร้างทุกคู่ที่ยังไม่มี (สีหรือไซส์ว่างได้ แต่ต้องมีอย่างน้อยหนึ่งอย่าง) */
on('POST', '/admin/products/:id/variants', async ({ req, env, staff, params }) => {
  const b = await readJson(req);
  const list = (x) => [...new Set((Array.isArray(x) ? x : String(x || '').split(',')).map((v) => clean(v, 40)).filter(Boolean))];
  const colors = list(b.colors), sizes = list(b.sizes);
  if (!colors.length && !sizes.length) fail(400, 'กรุณาระบุสีหรือไซส์อย่างน้อยหนึ่งอย่าง');
  const stock = Math.max(0, parseInt(b.stock, 10) || 0);
  const p = await env.DB.prepare('SELECT id, COALESCE(stock, 0) AS stock FROM ec_products WHERE id = ? AND deleted_at IS NULL').bind(params.id).first();
  if (!p) fail(404, 'ไม่พบสินค้า');
  const had = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(sort), -1) AS last FROM shop_variants WHERE product_id = ?').bind(p.id).first();
  const combos = (colors.length ? colors : ['']).flatMap((c) => (sizes.length ? sizes : ['']).map((z) => [c, z]));
  if (had.n + combos.length > 200) fail(400, 'จำนวนแบบย่อยมากเกินไป');
  const stmts = combos.map(([c, z], i) =>
    env.DB.prepare('INSERT OR IGNORE INTO shop_variants (product_id, color, size, stock, sort) VALUES (?, ?, ?, ?, ?)').bind(p.id, c, z, stock, had.last + 1 + i));
  stmts.push(syncProductStock(env, p.id));
  // สต็อกรวมเปลี่ยนจากการนับแบบเดิมเป็นผลรวมของแบบย่อย — บันทึกส่วนต่างไว้ตรวจย้อนหลัง
  stmts.push(env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref, admin)
                             SELECT id, COALESCE(stock, 0) - ?, stock, 'adjust', 'แยกสต็อกตามสี/ไซส์', ? FROM ec_products WHERE id = ? AND COALESCE(stock, 0) != ?`)
    .bind(p.stock, staffName(staff), p.id, p.stock));
  await env.DB.batch(stmts);
  return json({ variants: (await variantsByProduct(env, [p.id])).get(p.id) || [] });
}, 'staff:stock_manage');

/** ลบแบบย่อยได้เมื่อสต็อกเป็น 0 เท่านั้น เพื่อไม่ให้ของหายจากบัญชีโดยไม่มีประวัติ */
on('DELETE', '/admin/products/:id/variants/:vid', async ({ env, params }) => {
  const v = await env.DB.prepare('SELECT id, stock FROM shop_variants WHERE id = ? AND product_id = ?').bind(parseInt(params.vid, 10) || 0, params.id).first();
  if (!v) fail(404, 'ไม่พบแบบย่อยนี้');
  if (v.stock > 0) fail(400, 'กรุณาปรับสต็อกของแบบนี้เป็น 0 ก่อนลบ');
  await env.DB.batch([env.DB.prepare('DELETE FROM shop_variants WHERE id = ?').bind(v.id), syncProductStock(env, params.id)]);
  return json({ ok: true });
}, 'staff:stock_manage');

on('POST', '/admin/products/:id/stock', async ({ req, env, staff, params }) => {
  const b = await readJson(req);
  const qty = parseInt(b.qty, 10);
  const mode = ['add', 'remove', 'set'].includes(b.mode) ? b.mode : 'add';
  if (!(qty >= 0) || (mode !== 'set' && qty === 0)) fail(400, 'จำนวนไม่ถูกต้อง');
  const p = await env.DB.prepare('SELECT id, COALESCE(stock, 0) AS stock FROM ec_products WHERE id = ? AND deleted_at IS NULL').bind(params.id).first();
  if (!p) fail(404, 'ไม่พบสินค้า');
  const reasonOf = () => clean(b.reason, 200) || (mode === 'set' ? 'ปรับยอดตามการตรวจนับ' : mode === 'add' ? 'รับสินค้าเข้า' : 'ตัดสต็อก');
  const variantCount = (await env.DB.prepare('SELECT COUNT(*) AS n FROM shop_variants WHERE product_id = ?').bind(p.id).first()).n;
  if (variantCount) {
    // สินค้าที่แยกสี/ไซส์ ปรับสต็อกทีละแบบ แล้วสต็อกรวมคำนวณใหม่จากผลรวม
    const v = await env.DB.prepare('SELECT id, color, size, stock FROM shop_variants WHERE id = ? AND product_id = ?').bind(parseInt(b.variant_id, 10) || 0, p.id).first();
    if (!v) fail(400, 'กรุณาเลือกสี/ไซส์ที่ต้องการปรับสต็อก');
    const vd = mode === 'add' ? qty : mode === 'remove' ? -qty : qty - v.stock;
    if (v.stock + vd < 0) fail(400, `สต็อกคงเหลือ ${v.stock} ไม่พอให้ตัดออก ${qty}`);
    if (vd === 0) return json({ ok: true });
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE shop_variants SET stock = stock + ? WHERE id = ?').bind(vd, v.id),
        syncProductStock(env, p.id),
        env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, variant_id, variant, delta, balance, reason, ref, admin)
                        SELECT ?, id, ?, ?, stock, 'adjust', ?, ? FROM shop_variants WHERE id = ?`)
          .bind(p.id, variantLabel(v), vd, reasonOf(), staffName(staff), v.id),
      ]);
    } catch (e) {
      if (isCheckError(e)) fail(409, 'สต็อกไม่พอ (อาจมีการสั่งซื้อเข้ามาพร้อมกัน)');
      throw e;
    }
    return json({ ok: true });
  }
  const delta = mode === 'add' ? qty : mode === 'remove' ? -qty : qty - p.stock;
  if (p.stock + delta < 0) fail(400, `สต็อกคงเหลือ ${p.stock} ไม่พอให้ตัดออก ${qty}`);
  if (delta === 0) return json({ ok: true });
  const reason = clean(b.reason, 200) || (mode === 'set' ? 'ปรับยอดตามการตรวจนับ' : mode === 'add' ? 'รับสินค้าเข้า' : 'ตัดสต็อก');
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO shop_stock_guard (balance) SELECT COALESCE(stock, 0) + ? FROM ec_products WHERE id = ?`).bind(delta, p.id),
      env.DB.prepare('DELETE FROM shop_stock_guard'),
      env.DB.prepare(`UPDATE ec_products SET stock = COALESCE(stock, 0) + ? WHERE id = ?`).bind(delta, p.id),
      env.DB.prepare(`INSERT INTO shop_stock_logs (product_id, delta, balance, reason, ref, admin) SELECT id, ?, stock, 'adjust', ?, ? FROM ec_products WHERE id = ?`)
        .bind(delta, reason, staffName(staff), p.id),
    ]);
  } catch (e) {
    if (/CHECK constraint/i.test(String(e?.message || e) + String(e?.cause?.message || ''))) fail(409, 'สต็อกไม่พอ (อาจมีการสั่งซื้อเข้ามาพร้อมกัน)');
    throw e;
  }
  return json({ ok: true });
}, 'staff:stock_manage');

on('GET', '/admin/stock-logs', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT l.*, p.sku, p.title || COALESCE(' (' || l.variant || ')', '') AS name, p.unit FROM shop_stock_logs l LEFT JOIN ec_products p ON p.id = l.product_id ORDER BY l.id DESC LIMIT 300`
  ).all();
  return json({ logs: results });
}, 'staff:stock_manage');

/* ---- สมาชิก ---- */
on('GET', '/admin/members', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.email, m.emp_id, m.office_email, m.name, m.phone, m.department, m.created_at, m.closed_at,
       (SELECT COUNT(*) FROM shop_orders o WHERE o.member_id = m.id AND o.status != 'cancelled') AS order_count,
       (SELECT COALESCE(SUM(total),0) FROM shop_orders o WHERE o.member_id = m.id AND o.status IN ${paidIn}) AS spent
     FROM shop_members m ORDER BY m.id DESC`
  ).all();
  return json({ users: results });
}, 'staff:members_view');

// รหัสชั่วคราวผ่านนโยบายรหัสผ่าน: ตัวใหญ่ ตัวเล็ก ตัวเลข อักขระพิเศษ
function tempPassword() {
  const pick = (set, n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => set[x % set.length]).join('');
  return `${pick('ABCDEFGHJKMNPQRSTUVWXYZ', 2)}${pick('abcdefghjkmnpqrstuvwxyz', 4)}-${pick('23456789', 4)}${pick('!@#$%&*', 1)}`;
}

on('POST', '/admin/members/:id/reset-password', async ({ req, env, staff, params }) => {
  const id = Number(params.id);
  const pw = tempPassword();
  // บัญชีที่ปิดแล้วเปิดกลับด้วยการรีเซ็ตรหัสไม่ได้
  const target = await env.DB.prepare(`UPDATE shop_members SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ? AND closed_at IS NULL RETURNING id, email`)
    .bind(await hashPassword(pw), id).first();
  if (!target) fail(404, 'ไม่พบสมาชิก');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shop_sessions WHERE member_id = ?').bind(id),
    env.DB.prepare('DELETE FROM shop_rate_limits WHERE key = ?').bind(`login-fail:${target.email}`),
    env.DB.prepare('UPDATE shop_staff SET must_change_password = 1 WHERE member_id = ?').bind(id),
  ]);
  await audit(env, req, 'admin_reset_pw', { email: staff.email }, target.email);
  return json({ password: pw });
}, 'staff:owner');

/* ---- รายชื่อบุคลากร (no, name, email) สำหรับตรวจตอนสมัครสมาชิก ---- */
on('GET', '/admin/roster', async ({ env, url }) => {
  const q = clean(url.searchParams.get('q'), 100);
  const like = `%${q}%`;
  const [stats, list] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total, MAX(created_at) AS updated_at,
      (SELECT COUNT(*) FROM shop_members m WHERE m.office_email IS NOT NULL AND m.closed_at IS NULL AND m.office_email IN (SELECT email FROM shop_roster_mail)) AS registered,
      (SELECT COUNT(*) FROM shop_roster_mail WHERE locked_at IS NOT NULL) AS locked
      FROM shop_roster_mail`),
    env.DB.prepare(`SELECT r.no, r.email, r.full_name, (r.dob_hash IS NOT NULL) AS has_check, r.locked_at, m.email AS username, m.created_at AS registered_at FROM shop_roster_mail r
      LEFT JOIN shop_members m ON m.office_email = r.email AND m.closed_at IS NULL
      ${q ? 'WHERE r.email LIKE ? OR r.full_name LIKE ? OR r.no LIKE ?' : ''} ORDER BY (r.locked_at IS NULL), r.rowid LIMIT 300`).bind(...(q ? [like, like, like] : [])),
  ]);
  return json({ ...stats.results[0], rows: list.results });
}, 'staff:owner');

/** ปลดล็อกการตรวจสิทธิ์สมัครสมาชิกของรายชื่อหนึ่ง (กรอกวันเกิดผิดครบ 3 ครั้ง) */
on('POST', '/admin/roster/unlock', async ({ req, env, staff }) => {
  const email = cleanMail((await readJson(req)).email);
  const row = await env.DB.prepare('UPDATE shop_roster_mail SET check_fails = 0, locked_at = NULL WHERE email = ? RETURNING email').bind(email).first();
  if (!row) fail(404, 'ไม่พบรายชื่อนี้');
  await audit(env, req, 'register_unlock', { email: staff.email }, email);
  return json({ ok: true });
}, 'staff:owner');

/** rows = [[no, name, email, dob_hash], ...] — หน้าหลังบ้านอ่านไฟล์ในเบราว์เซอร์ แล้วส่งมาเฉพาะค่าเหล่านี้
 * (วันเกิดจริงไม่ถูกส่งขึ้นเซิร์ฟเวอร์ — ส่งมาเป็น SHA-256 ของ "อีเมล|YYYY-MM-DD") */
on('POST', '/admin/roster', async ({ req, env, staff }) => {
  const b = await readJson(req);
  if (!Array.isArray(b.rows)) fail(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
  if (b.rows.length > 30000) fail(400, 'รายชื่อมากเกินไป (สูงสุด 30,000 รายการ)');
  const seen = new Map();
  for (const row of b.rows) {
    const no = clean(row?.[0], 20);
    const name = clean(row?.[1], 150).replace(/\s+/g, ' ');
    const email = cleanMail(row?.[2]);
    const hash = String(row?.[3] ?? '').toLowerCase();
    if (!EMAIL_RE.test(email) || !name) continue;
    seen.set(email, [no, name, /^[0-9a-f]{64}$/.test(hash) ? hash : null]); // อีเมลซ้ำ: ใช้แถวล่าสุด
  }
  if (!seen.size) fail(400, 'ไม่พบรายชื่อในไฟล์ (คอลัมน์ ลำดับ, ชื่อ-สกุล, วันเดือนปีเกิด, อีเมล)');
  const replace = b.mode !== 'append';
  // แทนที่ทั้งหมด = ลบเฉพาะคนที่ไม่อยู่ในไฟล์ใหม่ (คนเดิมคงสถานะล็อก/จำนวนครั้งที่ผิดไว้)
  const stmts = replace ? [env.DB.prepare(`DELETE FROM shop_roster_mail WHERE email NOT IN (SELECT value FROM json_each(?))`).bind(JSON.stringify([...seen.keys()]))] : [];
  // ส่งเป็น JSON ทีละ 5,000 แถวต่อคำสั่ง (D1 จำกัดจำนวนคำสั่งและพารามิเตอร์ต่อคำขอ)
  const all = [...seen].map(([email, [no, name, hash]]) => [email, no, name, nameKey(name), hash]);
  for (let i = 0; i < all.length; i += 5000) {
    stmts.push(env.DB.prepare(`INSERT INTO shop_roster_mail (email, no, full_name, name_key, dob_hash)
      SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'), json_extract(value, '$[4]') FROM json_each(?) WHERE true
      ON CONFLICT(email) DO UPDATE SET no = excluded.no, full_name = excluded.full_name, name_key = excluded.name_key, dob_hash = excluded.dob_hash, created_at = datetime('now')`)
      .bind(JSON.stringify(all.slice(i, i + 5000))));
  }
  // D1 batch = transaction เดียว: แทนที่ทั้งหมดหรือไม่เปลี่ยนเลย
  await env.DB.batch(stmts);
  await audit(env, req, 'roster_upload', { email: staff.email }, `${replace ? 'แทนที่' : 'เพิ่ม/อัปเดต'} ${seen.size} รายการ${b.file ? ` จาก ${clean(b.file, 120)}` : ''}`);
  return json({ ok: true, count: seen.size, replaced: replace });
}, 'staff:owner');

/* ---- ผู้ดูแลร้าน (แอดมินย่อย): แอดมินใหญ่เท่านั้น ---- */
function cleanPerms(value) {
  const perms = [...new Set(Array.isArray(value) ? value : [])].filter((p) => Object.hasOwn(STAFF_PERMS, p));
  if (!perms.length) fail(400, 'กรุณาเลือกสิทธิ์อย่างน้อย 1 รายการ');
  return perms;
}

on('GET', '/admin/staff', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT s.member_id, s.perms, s.must_change_password, s.created_by, s.created_at, m.name, m.email, m.phone, m.department
     FROM shop_staff s JOIN shop_members m ON m.id = s.member_id ORDER BY s.created_at DESC`
  ).all();
  return json({ staff: results.map((r) => ({ ...r, perms: JSON.parse(r.perms) })), perm_labels: STAFF_PERMS });
}, 'staff:owner');

on('POST', '/admin/staff', async ({ req, env, staff }) => {
  const b = await readJson(req);
  // ชื่อผู้ใช้ใหม่ หรือชื่อผู้ใช้/อีเมลของสมาชิกที่มีอยู่แล้ว
  const email = clean(b.username ?? b.email, 100).toLowerCase();
  if (!USERNAME_RE.test(email) && !EMAIL_RE.test(email)) fail(400, 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือ . _ - ยาว 4–32 ตัว');
  const perms = cleanPerms(b.perms);
  let member = await env.DB.prepare('SELECT id, email, name FROM shop_members WHERE email = ?').bind(email).first();
  let password = null;
  if (member) {
    if (await env.DB.prepare('SELECT member_id FROM shop_staff WHERE member_id = ?').bind(member.id).first()) fail(409, 'ชื่อผู้ใช้นี้เป็นผู้ดูแลร้านอยู่แล้ว');
  } else {
    const name = clean(b.name, 100);
    if (!name) fail(400, 'กรุณากรอกชื่อ-นามสกุล');
    password = tempPassword();
    member = await env.DB.prepare(
      `INSERT INTO shop_members (email, password_hash, name, phone, department, password_changed_at) VALUES (?, ?, ?, ?, ?, datetime('now')) RETURNING id, email, name`
    ).bind(email, await hashPassword(password), name, clean(b.phone, 20), clean(b.department, 150)).first();
  }
  await env.DB.prepare('INSERT INTO shop_staff (member_id, perms, must_change_password, created_by) VALUES (?, ?, ?, ?)')
    .bind(member.id, JSON.stringify(perms), password ? 1 : 0, staff.email).run();
  await audit(env, req, 'staff_create', { email: staff.email }, `${email}: ${perms.join(', ')}`);
  return json({ member_id: member.id, name: member.name, password });
}, 'staff:owner');

on('PUT', '/admin/staff/:id', async ({ req, env, staff, params }) => {
  if (Number(params.id) === staff.member_id) fail(400, 'แก้สิทธิ์ของบัญชีตัวเองไม่ได้');
  const perms = cleanPerms((await readJson(req)).perms);
  const row = await env.DB.prepare(`UPDATE shop_staff SET perms = ?, updated_at = datetime('now') WHERE member_id = ? RETURNING member_id`)
    .bind(JSON.stringify(perms), Number(params.id)).first();
  if (!row) fail(404, 'ไม่พบผู้ดูแลร้าน');
  const m = await env.DB.prepare('SELECT email FROM shop_members WHERE id = ?').bind(row.member_id).first();
  await audit(env, req, 'staff_update', { email: staff.email }, `${m?.email}: ${perms.join(', ')}`);
  return json({ ok: true });
}, 'staff:owner');

on('DELETE', '/admin/staff/:id', async ({ req, env, staff, params }) => {
  if (Number(params.id) === staff.member_id) fail(400, 'ถอดสิทธิ์บัญชีตัวเองไม่ได้');
  const row = await env.DB.prepare('DELETE FROM shop_staff WHERE member_id = ? RETURNING member_id').bind(Number(params.id)).first();
  if (!row) fail(404, 'ไม่พบผู้ดูแลร้าน');
  const m = await env.DB.prepare('SELECT email FROM shop_members WHERE id = ?').bind(row.member_id).first();
  await audit(env, req, 'staff_remove', { email: staff.email }, m?.email);
  return json({ ok: true });
}, 'staff:owner');

on('GET', '/admin/audit', async ({ env, url }) => {
  const ev = clean(url.searchParams.get('event'), 40);
  const q = clean(url.searchParams.get('q'), 100);
  const where = [], args = [];
  if (ev) { where.push('event = ?'); args.push(ev); }
  if (q) { where.push('(email LIKE ? OR ip LIKE ? OR detail LIKE ?)'); args.push(...Array(3).fill(`%${q}%`)); }
  const [list, fails] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM shop_audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).bind(...args),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM shop_audit_logs WHERE event IN ('login_fail','login_locked') AND created_at > datetime('now','-1 day')`),
  ]);
  return json({ logs: list.results, fails_24h: fails.results[0].n });
}, 'staff:owner');

/* ---- ตั้งค่าร้าน ---- */
on('GET', '/admin/settings', async ({ env }) => json({ settings: await getSettings(env) }), 'staff:owner');

on('PUT', '/admin/settings', async ({ req, env, staff }) => {
  const b = await readJson(req);
  const before = await getSettings(env);
  const changed = Object.keys(DEFAULT_SETTINGS).filter((k) => k in b && String(b[k] ?? '').trim() !== before[k]);
  if (changed.length) await audit(env, req, 'settings_change', { email: staff.email }, changed.join(', '));
  if ('pickup_addresses' in b) {
    let addr = {};
    try { addr = JSON.parse(String(b.pickup_addresses || '{}')); } catch { fail(400, 'รูปแบบที่อยู่สำนักงานไม่ถูกต้อง'); }
    if (!addr || typeof addr !== 'object' || Array.isArray(addr)) fail(400, 'รูปแบบที่อยู่สำนักงานไม่ถูกต้อง');
    // เก็บเฉพาะจุดรับที่มีจริง และที่อยู่ไม่ว่าง
    b.pickup_addresses = JSON.stringify(Object.fromEntries(Object.entries(addr)
      .filter(([k, v]) => PICKUP_POINTS.includes(k) && String(v || '').trim())
      .map(([k, v]) => [k, clean(v, 500)])));
  }
  if ('shop_hours_mode' in b && !['auto', 'open', 'closed'].includes(b.shop_hours_mode)) fail(400, 'สถานะร้านไม่ถูกต้อง');
  if ('shop_override_until' in b && b.shop_override_until && !/^\d{4}-\d{2}-\d{2}$/.test(b.shop_override_until)) fail(400, 'วันที่ไม่ถูกต้อง');
  for (const k of ['shop_open_time', 'shop_close_time']) {
    if (k in b && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b[k]))) fail(400, 'เวลาเปิด/ปิดร้านไม่ถูกต้อง (เช่น 09:00)');
  }
  if ('shop_open_time' in b && 'shop_close_time' in b && b.shop_open_time >= b.shop_close_time) fail(400, 'เวลาปิดร้านต้องหลังเวลาเปิดร้าน');
  if ('shop_open_days' in b) b.shop_open_days = parseDays(b.shop_open_days).join(',');
  const maxLen = (k) => (k === 'pickup_addresses' ? 80000 : 2000);
  const stmts = Object.keys(DEFAULT_SETTINGS).filter((k) => k in b).map((k) =>
    env.DB.prepare('INSERT INTO shop_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, clean(b[k], maxLen(k))));
  if (stmts.length) await env.DB.batch(stmts);
  return json({ settings: await getSettings(env) });
}, 'staff:owner');

/* ------------------------------------------------------------- scheduled */
/** เรียกจาก cron ของ Worker: ล้างข้อมูลหมดอายุ และยกเลิกคำสั่งซื้อที่ไม่ชำระเกินเวลา (คืนสต็อก) */
export async function runShopScheduled(env) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shop_sessions WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('DELETE FROM shop_password_resets WHERE expires_at < ?').bind(Date.now() - 86400e3),
    env.DB.prepare('DELETE FROM shop_rate_limits WHERE reset_at < ?').bind(Math.floor(Date.now() / 1000)),
    env.DB.prepare(`DELETE FROM shop_audit_logs WHERE created_at < datetime('now', '-365 days')`),
  ]);
  const s = await getSettings(env);
  const hours = parseInt(s.auto_cancel_hours, 10);
  if (!(hours > 0)) return;
  // นับจากการเปลี่ยนสถานะล่าสุด ไม่ใช่วันสั่งซื้อ เพื่อให้ลูกค้าที่ถูกปฏิเสธสลิปมีเวลาแนบใหม่เต็มช่วงเวลา
  const { results } = await env.DB.prepare(
    `SELECT id FROM shop_orders WHERE status = 'pending_payment' AND updated_at < datetime('now', ?) LIMIT 50`
  ).bind(`-${hours} hours`).all();
  for (const r of results) {
    const o = await loadOrder(env, r.id);
    if (o && (await cancelOrder(env, o, {}, `ยกเลิกอัตโนมัติ: ไม่ได้ชำระเงินภายใน ${hours} ชั่วโมง`))) {
      await notifyStatus(env, await loadOrder(env, o.id), s, env.SITE_URL || '', `ไม่ได้ชำระเงินภายใน ${hours} ชั่วโมง ระบบจึงยกเลิกคำสั่งซื้อและคืนสินค้าเข้าสต็อก`);
    }
  }
}
