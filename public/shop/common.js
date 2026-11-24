/* ฟังก์ชันที่ใช้ร่วมกันทั้งหน้าสมาชิกและหลังบ้านร้านค้า (ย้ายมาจาก sao-welfare-shop) */
const API = {
  async req(method, path, data, isForm) {
    // API ของร้านอยู่ใต้ /api/shop ในเว็บ EmDash
    path = path.replace(/^\/api\//, '/api/shop/');
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (data !== undefined) {
      if (isForm) opt.body = data;
      else { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(data); }
    }
    let r;
    try { r = await fetch(path, opt); } catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'); }
    let j = null;
    try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error((j && j.error) || `เกิดข้อผิดพลาด (${r.status})`); e.status = r.status; e.data = j; throw e; }
    return j;
  },
  get: (p) => API.req('GET', p),
  post: (p, d = {}) => API.req('POST', p, d),
  put: (p, d = {}) => API.req('PUT', p, d),
  del: (p) => API.req('DELETE', p),
  form: (p, fd) => API.req('POST', p, fd, true),
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('th-TH');
const toDate = (s) => (s ? new Date(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')) : null);
const thDate = (s) => { const d = toDate(s); return d ? d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'; };
const thDay = (s) => { const d = toDate(s); return d ? d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }) : '-'; };
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const refreshIcons = () => { try { window.lucide && lucide.createIcons(); } catch {} enhancePasswords(); };

/* ---------- ปุ่มรูปตา: แสดง/ซ่อนรหัสผ่าน (ใส่ให้ทุกช่องรหัสผ่านอัตโนมัติ) ---------- */
const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>';
function enhancePasswords(root = document) {
  root.querySelectorAll('input[type=password]:not([data-eye])').forEach((inp) => {
    inp.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    btn.setAttribute('aria-label', 'แสดงรหัสผ่าน');
    btn.title = 'แสดงรหัสผ่าน';
    btn.innerHTML = EYE;
    btn.onclick = () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.title = show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
      btn.setAttribute('aria-label', btn.title);
      inp.focus();
    };
    wrap.appendChild(btn);
  });
}

/* ---------- นโยบายรหัสผ่าน (ตรงกับฝั่งเซิร์ฟเวอร์) + มาตรวัดความแข็งแรง ---------- */
const PW_RULES = [
  ['len', 'อย่างน้อย 8 ตัวอักษร', (p) => p.length >= 8 && p.length <= 128],
  ['lower', 'ตัวพิมพ์เล็ก (a-z)', (p) => /[a-z]/.test(p)],
  ['upper', 'ตัวพิมพ์ใหญ่ (A-Z)', (p) => /[A-Z]/.test(p)],
  ['digit', 'ตัวเลข (0-9)', (p) => /[0-9]/.test(p)],
  ['special', 'อักขระพิเศษ เช่น ! @ # $ %', (p) => /[^A-Za-z0-9]/.test(p)],
  ['repeat', 'ไม่ใช้ตัวเดียวกันซ้ำติดกันเกิน 3 ตัว', (p) => p && !/(.)\1{3,}/.test(p)],
  ['email', 'ไม่มีชื่อผู้ใช้อยู่ในรหัสผ่าน', (p, email) => { const l = String(email || '').split('@')[0].toLowerCase(); return p && !(l.length >= 4 && p.toLowerCase().includes(l)); }],
];
const passwordOk = (p, email) => PW_RULES.every(([, , fn]) => fn(p, email));
/** ติดมาตรวัดใต้ช่องรหัสผ่าน — getEmail คืนอีเมลปัจจุบันของฟอร์ม */
function passwordMeter(input, getEmail = () => '') {
  const box = document.createElement('div');
  box.className = 'pw-meter';
  (input.closest('.pw-wrap') || input).after(box);
  const draw = () => {
    const p = input.value, email = getEmail();
    const passed = PW_RULES.filter(([, , fn]) => fn(p, email)).length;
    const bonus = p.length >= 12 ? 1 : 0;
    const level = !p ? 0 : passed < 5 ? 1 : passed < PW_RULES.length ? 2 : 3 + bonus;
    const label = ['', 'อ่อนมาก', 'พอใช้', 'แข็งแรง', 'แข็งแรงมาก'][level];
    box.innerHTML = `<div class="pw-bar l${level}"><i></i><i></i><i></i><i></i></div>
      ${p ? `<div class="pw-label l${level}">ความปลอดภัย: <b>${label}</b>${level === 3 ? ' · ยาว 12 ตัวขึ้นไปจะปลอดภัยยิ่งขึ้น' : ''}</div>` : ''}
      <ul class="pw-rules">${PW_RULES.map(([k, t, fn]) => `<li class="${fn(p, email) ? 'ok' : ''}">${t}</li>`).join('')}</ul>`;
  };
  input.addEventListener('input', draw);
  draw();
  return { refresh: draw };
}

/** จุดรับสินค้า (ไม่มีจัดส่งถึงบ้าน) — ต้องตรงกับ src/shop/pickup.js
 * รับที่ส่วนภูมิภาค = ส่งทางไปรษณีย์ ผู้ซื้อชำระค่าส่งไปรษณีย์ให้ผู้ส่งสินค้าเพิ่มหลังได้รับสินค้า */
const PICKUP_CENTRAL = "สวัสดิการ สำนักงานการตรวจเงินแผ่นดิน (ส่วนกลาง)";
const PICKUP_GROUPS = [
  {
    "label": "ส่วนกลาง",
    "points": [
      "สวัสดิการ สำนักงานการตรวจเงินแผ่นดิน (ส่วนกลาง)"
    ]
  },
  {
    "label": "ภูมิภาคที่ 1",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 1",
      "สำนักตรวจเงินแผ่นดินจังหวัดพระนครศรีอยุธยา",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครนายก",
      "สำนักตรวจเงินแผ่นดินจังหวัดสระบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดปราจีนบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดลพบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดอ่างทอง"
    ]
  },
  {
    "label": "ภูมิภาคที่ 2",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 2",
      "สำนักตรวจเงินแผ่นดินจังหวัดชลบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดฉะเชิงเทรา",
      "สำนักตรวจเงินแผ่นดินจังหวัดจันทบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดระยอง",
      "สำนักตรวจเงินแผ่นดินจังหวัดตราด",
      "สำนักตรวจเงินแผ่นดินจังหวัดสระแก้ว"
    ]
  },
  {
    "label": "ภูมิภาคที่ 3",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 3",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครปฐม",
      "สำนักตรวจเงินแผ่นดินจังหวัดนนทบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดสุพรรณบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรปราการ",
      "สำนักตรวจเงินแผ่นดินจังหวัดปทุมธานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรสาคร"
    ]
  },
  {
    "label": "ภูมิภาคที่ 4",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 4",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครราชสีมา",
      "สำนักตรวจเงินแผ่นดินจังหวัดชัยภูมิ",
      "สำนักตรวจเงินแผ่นดินจังหวัดบุรีรัมย์",
      "สำนักตรวจเงินแผ่นดินจังหวัดสุรินทร์"
    ]
  },
  {
    "label": "ภูมิภาคที่ 5",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 5",
      "สำนักตรวจเงินแผ่นดินจังหวัดอุบลราชธานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดอำนาจเจริญ",
      "สำนักตรวจเงินแผ่นดินจังหวัดศรีสะเกษ",
      "สำนักตรวจเงินแผ่นดินจังหวัดยโสธร",
      "สำนักตรวจเงินแผ่นดินจังหวัดมุกดาหาร",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครพนม"
    ]
  },
  {
    "label": "ภูมิภาคที่ 6",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 6",
      "สำนักตรวจเงินแผ่นดินจังหวัดอุดรธานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดหนองบัวลำภู",
      "สำนักตรวจเงินแผ่นดินจังหวัดสกลนคร",
      "สำนักตรวจเงินแผ่นดินจังหวัดหนองคาย",
      "สำนักตรวจเงินแผ่นดินจังหวัดบึงกาฬ",
      "สำนักตรวจเงินแผ่นดินจังหวัดเลย"
    ]
  },
  {
    "label": "ภูมิภาคที่ 7",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 7",
      "สำนักตรวจเงินแผ่นดินจังหวัดขอนแก่น",
      "สำนักตรวจเงินแผ่นดินจังหวัดกาฬสินธุ์",
      "สำนักตรวจเงินแผ่นดินจังหวัดร้อยเอ็ด",
      "สำนักตรวจเงินแผ่นดินจังหวัดมหาสารคาม"
    ]
  },
  {
    "label": "ภูมิภาคที่ 8",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 8",
      "สำนักตรวจเงินแผ่นดินจังหวัดเชียงใหม่",
      "สำนักตรวจเงินแผ่นดินจังหวัดลำพูน",
      "สำนักตรวจเงินแผ่นดินจังหวัดเชียงราย",
      "สำนักตรวจเงินแผ่นดินจังหวัดแม่ฮ่องสอน"
    ]
  },
  {
    "label": "ภูมิภาคที่ 9",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 9",
      "สำนักตรวจเงินแผ่นดินจังหวัดลำปาง",
      "สำนักตรวจเงินแผ่นดินจังหวัดน่าน",
      "สำนักตรวจเงินแผ่นดินจังหวัดแพร่",
      "สำนักตรวจเงินแผ่นดินจังหวัดพะเยา",
      "สำนักตรวจเงินแผ่นดินจังหวัดอุตรดิตถ์"
    ]
  },
  {
    "label": "ภูมิภาคที่ 10",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 10",
      "สำนักตรวจเงินแผ่นดินจังหวัดพิษณุโลก",
      "สำนักตรวจเงินแผ่นดินจังหวัดสุโขทัย",
      "สำนักตรวจเงินแผ่นดินจังหวัดตาก",
      "สำนักตรวจเงินแผ่นดินจังหวัดเพชรบูรณ์"
    ]
  },
  {
    "label": "ภูมิภาคที่ 11",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 11",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครสวรรค์",
      "สำนักตรวจเงินแผ่นดินจังหวัดกำแพงเพชร",
      "สำนักตรวจเงินแผ่นดินจังหวัดชัยนาท",
      "สำนักตรวจเงินแผ่นดินจังหวัดอุทัยธานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดพิจิตร",
      "สำนักตรวจเงินแผ่นดินจังหวัดสิงห์บุรี"
    ]
  },
  {
    "label": "ภูมิภาคที่ 12",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 12",
      "สำนักตรวจเงินแผ่นดินจังหวัดเพชรบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดประจวบคีรีขันธ์",
      "สำนักตรวจเงินแผ่นดินจังหวัดราชบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดกาญจนบุรี",
      "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรสงคราม"
    ]
  },
  {
    "label": "ภูมิภาคที่ 13",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 13",
      "สำนักตรวจเงินแผ่นดินจังหวัดสุราษฎร์ธานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดพังงา",
      "สำนักตรวจเงินแผ่นดินจังหวัดภูเก็ต",
      "สำนักตรวจเงินแผ่นดินจังหวัดระนอง",
      "สำนักตรวจเงินแผ่นดินจังหวัดชุมพร"
    ]
  },
  {
    "label": "ภูมิภาคที่ 14",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 14",
      "สำนักตรวจเงินแผ่นดินจังหวัดนครศรีธรรมราช",
      "สำนักตรวจเงินแผ่นดินจังหวัดกระบี่",
      "สำนักตรวจเงินแผ่นดินจังหวัดตรัง",
      "สำนักตรวจเงินแผ่นดินจังหวัดพัทลุง"
    ]
  },
  {
    "label": "ภูมิภาคที่ 15",
    "points": [
      "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 15",
      "สำนักตรวจเงินแผ่นดินจังหวัดสงขลา",
      "สำนักตรวจเงินแผ่นดินจังหวัดปัตตานี",
      "สำนักตรวจเงินแผ่นดินจังหวัดสตูล",
      "สำนักตรวจเงินแผ่นดินจังหวัดยะลา",
      "สำนักตรวจเงินแผ่นดินจังหวัดนราธิวาส"
    ]
  }
];
const PICKUP_POINTS = PICKUP_GROUPS.flatMap((g) => g.points);
const isRegionalPickup = (p) => !!p && p !== PICKUP_CENTRAL;
/** "ส่วนกลาง" / "ภูมิภาคที่ 3" / "จังหวัดนครปฐม" สำหรับตาราง */
const pickupShort = (p) => (!p ? 'รับเอง' : p.includes('(ส่วนกลาง)') ? 'ส่วนกลาง' : p.replace('สำนักงานการตรวจเงินแผ่นดิน', '').replace('สำนักตรวจเงินแผ่นดิน', '').trim());
/** <option> จุดรับสินค้าแบ่งกลุ่มตามภูมิภาค */
const pickupOptions = (selected = '') => PICKUP_GROUPS.map((g) => `<optgroup label="${esc(g.label)}">${g.points.map((p) => `<option value="${esc(p)}" ${p === selected ? 'selected' : ''}>${esc(p)}</option>`).join('')}</optgroup>`).join('');

/* ---------- Cloudflare Turnstile (ยืนยันว่าไม่ใช่บอท) — แสดงเมื่อแอดมินตั้งค่าไว้ ---------- */
const SEC = { turnstile_site_key: '', mail_enabled: false };
let turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  turnstileLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = res; s.onerror = () => rej(new Error('โหลดระบบยืนยันไม่สำเร็จ'));
    document.head.appendChild(s);
  });
  return turnstileLoading;
}
/** ใส่กล่องยืนยันในฟอร์ม คืนค่า { token(), reset() } */
async function mountCaptcha(form) {
  if (!SEC.turnstile_site_key) return { token: () => '', reset() {} };
  const el = document.createElement('div');
  el.className = 'captcha-box';
  const submit = form.querySelector('button[type=submit], button:not([type])');
  form.insertBefore(el, submit);
  try { await loadTurnstile(); } catch (e) { el.textContent = e.message; return { token: () => '', reset() {} }; }
  const id = turnstile.render(el, { sitekey: SEC.turnstile_site_key, language: 'th', theme: 'light' });
  return { token: () => turnstile.getResponse(id) || '', reset: () => turnstile.reset(id) };
}

const STATUS = {
  pending_payment: { label: 'รอชำระเงิน', icon: 'wallet' },
  verifying: { label: 'รอตรวจสอบการชำระ', icon: 'search-check' },
  paid: { label: 'ชำระเงินแล้ว', icon: 'badge-check' },
  preparing: { label: 'กำลังจัดเตรียมสินค้า', icon: 'package' },
  shipped: { label: 'พร้อมให้รับสินค้า', icon: 'package-check' },
  received: { label: 'ลูกค้าได้รับสินค้าแล้ว', icon: 'package-open' },
  postage_due: { label: 'รอชำระค่าส่งไปรษณีย์', icon: 'mailbox' },
  postage_verifying: { label: 'รอตรวจสอบค่าส่งไปรษณีย์', icon: 'search-check' },
  completed: { label: 'ได้รับสินค้าแล้ว', icon: 'circle-check-big' },
  cancelled: { label: 'ยกเลิกแล้ว', icon: 'circle-x' },
};
/** ลำดับสถานะทั้งหมด (ตรงกับ FLOW ใน src/shop/api.js) — ส่วนกลางข้ามขั้นค่าส่งไปรษณีย์ */
const FLOW = ['pending_payment', 'verifying', 'paid', 'preparing', 'shipped', 'received', 'postage_due', 'postage_verifying', 'completed'];
const POSTAGE_STATES = ['postage_due', 'postage_verifying'];
/** ขั้นที่มีเฉพาะคำสั่งซื้อส่วนภูมิภาค */
const REGIONAL_STATES = ['received', 'postage_due', 'postage_verifying'];
/** ขั้นที่คำสั่งซื้อนี้ต้องผ่าน: ส่วนภูมิภาคมีขั้นค่าส่งไปรษณีย์เพิ่ม */
const flowFor = (o) => FLOW.filter((s) => o.is_regional || !REGIONAL_STATES.includes(s));
/** ชื่อสถานะของคำสั่งซื้อ: ส่วนภูมิภาคที่ส่งแล้ว = "ส่งทางไปรษณีย์แล้ว" */
const statusLabelFor = (o, s = o.status) => (o.is_regional && s === 'shipped' ? 'ส่งทางไปรษณีย์แล้ว' : o.is_regional && s === 'completed' ? 'เสร็จสมบูรณ์' : STATUS[s]?.label || s);
/** ป้ายสถานะ · ส่ง o มาด้วยเพื่อใช้ชื่อเฉพาะของคำสั่งซื้อส่วนภูมิภาค ("ส่งทางไปรษณีย์แล้ว") */
const statusBadge = (s, o) => `<span class="badge st-${esc(s)}">${esc(o ? statusLabelFor(o, s) : STATUS[s]?.label || s)}</span>`;

function placeholderImg(text) {
  const t = esc((text || 'สินค้า').slice(0, 14));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1ede3"/><stop offset="1" stop-color="#e3dccb"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><g fill="none" stroke="#b9ae92" stroke-width="6" stroke-linejoin="round"><path d="M100 120l50-25 50 25v60l-50 25-50-25z"/><path d="M100 120l50 25 50-25M150 145v60"/></g><text x="150" y="250" font-family="Sarabun,Tahoma,sans-serif" font-size="20" fill="#8f8467" text-anchor="middle">${t}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const productImg = (p) => p.image || placeholderImg(p.name);

function toast(msg, type = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'shop-app'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = icon(type === 'bad' ? 'circle-alert' : 'circle-check') + `<span>${esc(msg)}</span>`;
  box.appendChild(el);
  refreshIcons();
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, type === 'bad' ? 5000 : 3000);
}

function openModal(html, opts = {}) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg shop-app';
  bg.id = 'modal';
  bg.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg && !opts.sticky) closeModal(); });
  document.body.appendChild(bg);
  document.body.style.overflow = 'hidden';
  refreshIcons();
  return bg;
}
function closeModal() { $('#modal')?.remove(); document.body.style.overflow = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });

function confirmBox(message, okText = 'ยืนยัน', danger = false) {
  return new Promise((resolve) => {
    const m = openModal(`<div class="modal-body" style="padding:26px"><h3 style="margin-bottom:10px">${esc(message)}</h3></div>
      <div class="modal-foot"><button class="btn btn-light" data-no>ยกเลิก</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okText)}</button></div>`);
    $('[data-yes]', m).onclick = () => { closeModal(); resolve(true); };
    $('[data-no]', m).onclick = () => { closeModal(); resolve(false); };
  });
}

async function withBusy(btn, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-inline">กำลังดำเนินการ…</span>';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; refreshIcons(); }
}

/** ย่อรูปก่อนอัปโหลด (ลดขนาดไฟล์ ให้โหลดเร็ว) — คืนค่า Blob JPEG */
/** ไฟล์ที่สมาชิกอัปโหลดได้ — ต้องตรงกับ MAX_FILE / IMAGE_TYPES ใน src/shop/api.js (ฝั่ง API ตรวจซ้ำทุกครั้ง) */
const SLIP_UPLOAD = {
  types: ['image/jpeg', 'image/png'],
  ext: /\.(jpe?g|png)$/i,
  maxInput: 15_000_000, // รูปจากกล้องมือถือก่อนย่อ
  maxUpload: 1_500_000, // หลังย่อ ต้องไม่เกินที่ API รับ
};
function checkImageFile(file) {
  if (!file) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  if (!SLIP_UPLOAD.types.includes(file.type) || (file.name && !SLIP_UPLOAD.ext.test(file.name))) throw new Error('รองรับเฉพาะไฟล์ .jpg .jpeg หรือ .png');
  if (file.size > SLIP_UPLOAD.maxInput) throw new Error('ไฟล์ใหญ่เกินไป กรุณาเลือกรูปที่เล็กกว่านี้');
}

async function resizeImage(file, max = 1280, quality = 0.85) {
  checkImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('เปิดไฟล์รูปไม่ได้ (ลองบันทึกเป็น JPG/PNG ก่อน)')); i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let q = quality, blob;
    do { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); q -= 0.1; } while (blob && blob.size > 1_300_000 && q > 0.3);
    if (!blob || blob.size > SLIP_UPLOAD.maxUpload) throw new Error('ย่อรูปให้เล็กพอไม่ได้ (ไม่เกิน 1.5 MB) กรุณาเลือกรูปอื่น');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- PromptPay QR (มาตรฐาน EMVCo / Thai QR Payment) ---------- */
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function promptPayPayload(id, amount) {
  const f = (tag, val) => tag + String(val.length).padStart(2, '0') + val;
  const target = String(id || '').replace(/\D/g, '');
  let acc;
  if (target.length === 10 && target.startsWith('0')) acc = f('01', '0066' + target.slice(1)); // เบอร์มือถือ
  else if (target.length === 13) acc = f('02', target); // เลขประจำตัวประชาชน / เลขผู้เสียภาษี
  else if (target.length === 15) acc = f('03', target); // e-Wallet
  else return null;
  const amt = Number(amount) > 0 ? f('54', Number(amount).toFixed(2)) : '';
  const payload = f('00', '01') + f('01', amt ? '12' : '11') + f('29', f('00', 'A000000677010111') + acc) + f('53', '764') + amt + f('58', 'TH') + '6304';
  return payload + crc16(payload);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว', 'ok'); }
  catch { prompt('คัดลอกข้อความนี้', text); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy); });
