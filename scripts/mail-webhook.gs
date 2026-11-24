/**
 * ตัวส่งอีเมลของร้านค้าสวัสดิการ — วางใน Google Apps Script (script.google.com) ของ Gmail ที่จะใช้ส่ง
 *
 * เว็บไซต์ (src/shop/api.js → sendMail) จะ POST มาที่นี่: { secret, to, subject, html }
 * แล้วสคริปต์นี้ส่งอีเมลออกจาก Gmail บัญชีนั้น
 *
 * ตั้งค่า:
 *   1. วางโค้ดนี้ (ห้ามใส่รหัสลับในโค้ด) แล้วไปที่ Project Settings (รูปเฟือง) → Script Properties
 *      → Add script property:  MAIL_WEBHOOK_SECRET = ค่าเดียวกับ MAIL_WEBHOOK_SECRET ของเว็บ
 *   2. Deploy → New deployment → Web app
 *        Execute as: Me   ·   Who has access: Anyone
 *   3. นำ Web app URL (ลงท้าย /exec) ไปตั้งเป็น MAIL_WEBHOOK_URL ของเว็บ
 *
 * โควตา Gmail ทั่วไปประมาณ 100 ผู้รับต่อวัน (Google Workspace ประมาณ 1,500)
 */
// รหัสลับอ่านจาก Script Properties เท่านั้น ไม่ฝังไว้ในโค้ด
const SECRET = PropertiesService.getScriptProperties().getProperty('MAIL_WEBHOOK_SECRET') || '';
const SENDER_NAME = 'ร้านค้าสวัสดิการ สตง.';

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad json' });
  }
  if (!SECRET || !safeEqual(String(body.secret || ''), SECRET)) return reply({ ok: false, error: 'forbidden' });

  const to = String(body.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reply({ ok: false, error: 'bad recipient' });
  // อีเมลทดสอบ (เช่น @example.com) ส่งไม่ถึงใครอยู่แล้ว ข้ามไปเพื่อไม่เปลืองโควตา
  if (/@(example\.(com|org|net)|closed\.invalid|saoth\.test)$/i.test(to)) return reply({ ok: true, skipped: true });

  MailApp.sendEmail({
    to: to,
    subject: String(body.subject || '').slice(0, 250),
    htmlBody: String(body.html || ''),
    name: SENDER_NAME,
  });
  return reply({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
}

/** เปรียบเทียบรหัสลับแบบใช้เวลาเท่ากันเสมอ (กันการเดาทีละตัวอักษรจากเวลาตอบกลับ) */
function safeEqual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** กด Run ฟังก์ชันนี้หนึ่งครั้งในหน้าแก้โค้ด เพื่ออนุญาตให้สคริปต์ส่งอีเมล (และทดสอบส่งหาตัวเอง) */
function testSend() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'ทดสอบระบบแจ้งเตือนร้านค้าสวัสดิการ', 'ถ้าได้รับอีเมลนี้ แปลว่าตั้งค่าสำเร็จ');
}
