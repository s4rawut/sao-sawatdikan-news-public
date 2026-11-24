/** สถานะเปิด/ปิดร้านค้าสวัสดิการ (เวลาประเทศไทย)
 * shop_hours_mode: 'auto' = ตามวันเวลาทำการ · 'open' / 'closed' = ผู้ขายกำหนดเอง
 * shop_override_until: YYYY-MM-DD (ไม่บังคับ) — พ้นวันนี้แล้วกลับเป็นอัตโนมัติ */
export const HOURS_DEFAULTS = {
  shop_hours_mode: 'auto',
  shop_override_until: '',
  shop_status_note: '',
  shop_open_days: '1,2,3,4,5', // 0 = อาทิตย์ … 6 = เสาร์
  shop_open_time: '09:00',
  shop_close_time: '16:30',
};
export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const toMin = (t, d) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(t || '').trim()); return m ? +m[1] * 60 + +m[2] : d; };
const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}.${String(min % 60).padStart(2, '0')}`;
export const parseDays = (s) => [...new Set(String(s ?? '').split(',').map((x) => +x).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();

/** "จันทร์ – ศุกร์" หรือ "จันทร์, พุธ, ศุกร์" */
export function daysLabel(days) {
  if (!days.length) return '-';
  const run = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  return run && days.length > 2 ? `${DAY_NAMES[days[0]]} – ${DAY_NAMES[days[days.length - 1]]}` : days.map((d) => DAY_NAMES[d]).join(', ');
}

export function shopStatus(settings = {}, now = new Date()) {
  const s = { ...HOURS_DEFAULTS, ...Object.fromEntries(Object.entries(settings).filter(([, v]) => v != null)) };
  const bkk = new Date(now.getTime() + 7 * 3600e3); // อ่านค่าด้วย getUTC* = เวลาไทย
  const today = bkk.toISOString().slice(0, 10);
  const dow = bkk.getUTCDay();
  const minute = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  const days = parseDays(s.shop_open_days);
  const openMin = toMin(s.shop_open_time, 540);
  const closeMin = toMin(s.shop_close_time, 990);
  const hoursLabel = `${daysLabel(days)} เวลา ${fmt(openMin)} – ${fmt(closeMin)} น.`;
  const note = String(s.shop_status_note || '').trim();

  const manual = (s.shop_hours_mode === 'open' || s.shop_hours_mode === 'closed')
    && (!s.shop_override_until || s.shop_override_until >= today);
  if (manual) {
    const open = s.shop_hours_mode === 'open';
    return { open, manual: true, hoursLabel, note, detail: open ? 'วันนี้หน้าร้านเปิด' : 'วันนี้หน้าร้านปิด' };
  }

  const openDay = days.includes(dow);
  const open = openDay && minute >= openMin && minute < closeMin;
  let detail;
  if (open) detail = `เปิดถึง ${fmt(closeMin)} น.`;
  else if (openDay && minute < openMin) detail = `วันนี้เปิด ${fmt(openMin)} น.`;
  else {
    // วันทำการถัดไป
    let next = null;
    for (let i = 1; i <= 7 && next == null; i++) if (days.includes((dow + i) % 7)) next = i;
    detail = next == null ? '' : `เปิดอีกครั้ง${next === 1 ? 'พรุ่งนี้' : `วัน${DAY_NAMES[(dow + next) % 7]}`} ${fmt(openMin)} น.`;
  }
  return { open, manual: false, hoursLabel, note, detail };
}
