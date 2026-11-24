/* หลังบ้านร้านค้าสวัสดิการ (/shop-admin) — ย้ายมาจาก sao-welfare-shop
 * แอดมินใหญ่ = ผู้ใช้ EmDash ระดับ Admin; แอดมินย่อย = สมาชิกร้านที่แอดมินใหญ่ให้สิทธิ์ (เซิร์ฟเวอร์ตรวจสิทธิ์ทุกครั้ง หน้านี้แค่ซ่อนเมนู)
 * ข้อมูลสินค้าแก้ในหลังบ้าน EmDash */
const A = { user: null, settings: {}, stats: null, lastOrderId: null, lastVerifying: null, products: [] };
const NAV = [
  ['dashboard', 'layout-dashboard', 'ภาพรวม'],
  ['orders', 'receipt-text', 'คำสั่งซื้อ', 'orders_view'],
  ['reports', 'chart-column', 'รายงานยอดขาย', 'orders_view'],
  ['products', 'package', 'สินค้าและสต็อก', 'stock_manage'],
  ['stock', 'history', 'ประวัติสต็อก', 'stock_manage'],
  ['members', 'users', 'สมาชิก', 'members_view'],
  ['roster', 'file-up', 'อัปโหลดไฟล์', 'owner'],
  ['staff', 'user-cog', 'ผู้ดูแลร้าน', 'owner'],
  ['settings', 'settings', 'ตั้งค่าร้าน / การชำระเงิน', 'owner'],
  ['security', 'shield-check', 'บันทึกความปลอดภัย', 'owner'],
];
const can = (perm) => !perm || A.user.owner || (perm !== 'owner' && A.user.perms.includes(perm));
const AUDIT = {
  login_ok: ['เข้าสู่ระบบสำเร็จ', 'st-completed'], login_fail: ['รหัสผ่านผิด', 'st-pending_payment'], login_locked: ['บัญชีถูกล็อกชั่วคราว', 'st-cancelled'],
  register: ['สมัครสมาชิก', 'st-paid'], register_check_fail: ['ตรวจสิทธิ์สมัครสมาชิกไม่ผ่าน', 'st-pending_payment'], register_locked: ['ล็อกสิทธิ์สมัครสมาชิก (ผิด 3 ครั้ง)', 'st-cancelled'], register_unlock: ['ปลดล็อกสิทธิ์สมัครสมาชิก', 'st-paid'], roster_upload: ['อัปโหลดทะเบียนบุคลากร', 'st-preparing'],
  pw_reset_id_ok: ['ยืนยันตัวตนลืมรหัสผ่าน', 'st-verifying'], pw_reset_id_fail: ['ยืนยันตัวตนลืมรหัสไม่ผ่าน', 'st-pending_payment'], logout_all: ['ออกจากทุกอุปกรณ์', 'st-preparing'],
  pw_change: ['เปลี่ยนรหัสผ่าน', 'st-paid'], pw_change_fail: ['เปลี่ยนรหัสไม่สำเร็จ', 'st-pending_payment'],
  pw_reset_request: ['ขอลิงก์ลืมรหัสผ่าน', 'st-verifying'], pw_reset_unknown: ['ขอลืมรหัส (อีเมลไม่มีในระบบ)', 'st-cancelled'], pw_reset_done: ['ตั้งรหัสใหม่ผ่านลิงก์', 'st-paid'],
  admin_reset_pw: ['แอดมินรีเซ็ตรหัสผ่าน', 'st-verifying'], settings_change: ['แก้ไขการตั้งค่าร้าน', 'st-preparing'],
  staff_create: ['เพิ่มผู้ดูแลร้าน', 'st-verifying'], staff_update: ['แก้ไขสิทธิ์ผู้ดูแล', 'st-verifying'], staff_remove: ['ถอดสิทธิ์ผู้ดูแล', 'st-cancelled'],
};
async function pageSecurity(params) {
  const ev = params.get('event') || '', q = params.get('q') || '';
  const { logs, fails_24h } = await API.get(`/api/admin/audit?event=${encodeURIComponent(ev)}&q=${encodeURIComponent(q)}`);
  content(`<div class="admin-top"><div><h1>บันทึกความปลอดภัย</h1><div class="muted">การเข้าสู่ระบบ การเปลี่ยนรหัสผ่าน และการแก้ไขสำคัญ (300 รายการล่าสุด)</div></div></div>
    ${fails_24h >= 10 ? `<div class="alert alert-warn" style="margin-bottom:14px">${icon('shield-alert')}<div>24 ชั่วโมงที่ผ่านมามีการใส่รหัสผ่านผิด <b>${num(fails_24h)}</b> ครั้ง — อาจมีผู้พยายามเดารหัสผ่าน ระบบล็อกบัญชีให้อัตโนมัติแล้ว</div></div>` : ''}
    <div class="card">
      <form class="filters" id="sf">
        <select class="input" name="event"><option value="">ทุกเหตุการณ์</option>${Object.entries(AUDIT).map(([k, [l]]) => `<option value="${k}" ${k === ev ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input class="input grow" name="q" value="${esc(q)}" placeholder="ค้นหาชื่อผู้ใช้ / IP">
        <button class="btn btn-primary btn-sm">${icon('search')} ค้นหา</button>
      </form>
      <div class="table-wrap"><table class="table"><thead><tr><th>เวลา</th><th>เหตุการณ์</th><th>บัญชี</th><th>รายละเอียด</th><th>IP</th><th>อุปกรณ์</th></tr></thead><tbody>
      ${logs.map((l) => `<tr><td class="small nowrap">${thDate(l.created_at)}</td><td><span class="badge ${AUDIT[l.event]?.[1] || ''}">${esc(AUDIT[l.event]?.[0] || l.event)}</span></td>
        <td class="small">${esc(l.email || '-')}</td><td class="small">${esc(l.detail || '')}</td><td class="small mono">${esc(l.ip || '')}</td>
        <td class="small muted" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l.ua || '')}">${esc(l.ua || '')}</td></tr>`).join('')
        || `<tr><td colspan="6" class="empty">ยังไม่มีบันทึก</td></tr>`}
      </tbody></table></div></div>`);
  $('#sf').onsubmit = (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); Object.keys(d).forEach((k) => !d[k] && delete d[k]); location.hash = 'security' + (Object.keys(d).length ? '?' + new URLSearchParams(d) : ''); };
}
const content = (html) => { $('#content').innerHTML = html; refreshIcons(); };
const loading = () => content('<div class="spinner"></div>');

/* ---------- login ---------- */
const authPage = (inner) => `<div style="min-height:100vh;display:grid;place-items:center;padding:20px;background:linear-gradient(140deg,#0f2a5c,#1d4185)">
    <div class="card card-pad stack" style="width:100%;max-width:440px;padding:30px">
      <div class="center"><img src="/logo.png" alt="" width="72" height="72" style="margin:0 auto 10px;display:block"><h1>หลังบ้านร้านค้า</h1><p class="muted" style="margin:2px 0 0">สำหรับเจ้าหน้าที่สวัสดิการ</p></div>
      ${inner}
    </div></div>`;
async function logout() {
  try { await API.post('/api/auth/logout'); } catch {}
  // แอดมินใหญ่เข้าด้วยบัญชี EmDash (Passkey) ต้องออกจาก EmDash ด้วย
  if (A.user?.emdash) {
    try { await fetch('/_emdash/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-EmDash-Request': '1' } }); } catch {}
  }
  location.href = '/shop-admin';
}
function renderLogin(msg) {
  window.onhashchange = null;
  $('#root').innerHTML = authPage(`
      ${msg ? `<div class="alert alert-warn small">${icon('shield-alert')}<div>${esc(msg)}</div></div>` : ''}
      <form id="staff-login" class="stack">
        <label class="field"><span>ชื่อผู้ใช้</span><input name="email" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
        <label class="field"><span>รหัสผ่าน</span><input name="password" type="password" required autocomplete="current-password"></label>
        <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('log-in')} เข้าสู่ระบบผู้ดูแลร้าน</button>
      </form>
      <p class="center small"><a href="/member#/forgot">ลืมรหัสผ่าน</a></p>
      <div class="side-sep" style="background:var(--line)"></div>
      <p class="small muted center" style="margin:0">แอดมินใหญ่ใช้บัญชีหลังบ้านเว็บไซต์ (ระดับ Admin)</p>
      <a class="btn btn-light btn-block" href="/_emdash/admin">เข้าสู่ระบบหลังบ้านเว็บไซต์</a>
      <p class="center small"><a href="/">กลับหน้าเว็บไซต์</a></p>`);
  refreshIcons();
  const f = $('#staff-login');
  mountCaptcha(f).then((cap) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(f.querySelector('[type=submit]'), async () => {
        try {
          await API.post('/api/auth/login', { email: f.email.value.trim(), password: f.password.value, captcha: cap.token() });
          location.reload();
        } catch (err) { cap.reset(); toast(err.message, 'bad'); }
      });
    };
  });
}

/** รหัสผ่านชั่วคราวใช้ได้ครั้งแรกเท่านั้น เซิร์ฟเวอร์จะไม่ให้ใช้งานหลังบ้านจนกว่าจะเปลี่ยนรหัส */
function renderMustChange() {
  $('#root').innerHTML = authPage(`
      <div class="alert alert-info small">${icon('key-round')}<div>กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</div></div>
      <form id="must-change" class="stack">
        <label class="field"><span>รหัสผ่านชั่วคราว</span><input name="old_password" type="password" required autocomplete="current-password"></label>
        <label class="field"><span>รหัสผ่านใหม่</span><input name="new_password" type="password" required autocomplete="new-password"></label>
        <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input name="confirm" type="password" required autocomplete="new-password"></label>
        <button type="submit" class="btn btn-gold btn-lg btn-block">${icon('save')} บันทึกรหัสผ่าน</button>
      </form>
      <button class="btn btn-light btn-block" id="mc-out">ออกจากระบบ</button>`);
  refreshIcons();
  const f = $('#must-change');
  passwordMeter(f.new_password, () => A.user.email);
  $('#mc-out').onclick = logout;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (!passwordOk(d.new_password, A.user.email)) return toast('รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขทุกข้อ', 'bad');
    if (d.new_password !== d.confirm) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'bad');
    await withBusy(f.querySelector('[type=submit]'), async () => {
      try {
        const { user } = await API.get('/api/auth/me');
        await API.put('/api/auth/me', { ...user, old_password: d.old_password, new_password: d.new_password });
        location.reload();
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/* ---------- layout ---------- */
function shell() {
  const links = (cls) => NAV.filter(([, , , perm]) => can(perm)).map(([k, ic, lbl]) => `<a class="side-link ${cls}" href="#${k}" data-nav="${k}">${icon(ic)} <span>${lbl}</span><span class="pill" data-pill="${k}" hidden></span></a>`).join('');
  // เปลี่ยนรหัสผ่านของตัวเอง: เฉพาะบัญชีร้าน (อีเมล/รหัสผ่าน) · แอดมินใหญ่ใช้บัญชี EmDash ซึ่งไม่มีรหัสผ่านให้เปลี่ยนที่นี่
  const pwLink = A.user.emdash ? '' : `<a class="side-link" href="#" data-change-pw>${icon('key-round')} <span>เปลี่ยนรหัสผ่าน</span></a>`;
  $('#root').innerHTML = `<div class="admin-body">
    <aside class="sidebar">
      <a class="side-brand" href="#dashboard"><img src="/logo.png" alt="" width="40" height="40"><span><b>${esc(A.settings.shop_name || 'ร้านค้าสวัสดิการ สตง.')}</b><small>หลังบ้านร้านค้า</small></span></a>
      ${links('')}
      <div class="side-sep"></div>
      <a class="side-link" href="/shop" target="_blank">${icon('store')} <span>ดูหน้าร้าน</span></a>
      ${A.user.emdash ? `<a class="side-link" href="/_emdash/admin/content/products">${icon('package-plus')} <span>เพิ่ม/แก้ไขสินค้า (EmDash)</span></a>
      <a class="side-link" href="/_emdash/admin">${icon('layout-template')} <span>หลังบ้านเว็บไซต์</span></a>` : ''}
      <div class="small" style="padding:14px 13px;opacity:.7">${esc(A.user.name)}<br>${esc(A.user.email)}<br>${A.user.emdash ? 'แอดมินใหญ่' : A.user.owner ? 'แอดมินร้านค้า (ทุกสิทธิ์)' : 'ผู้ดูแลร้าน'}</div>
      ${pwLink}
      <a class="side-link" href="#" data-logout>${icon('log-out')} <span>ออกจากระบบ</span></a>
    </aside>
    <div>
      <nav class="mobile-admin-nav">${links('')}${pwLink}<a class="side-link" href="#" data-logout>${icon('log-out')} <span>ออกจากระบบ</span></a></nav>
      <div class="admin-main" id="content"></div>
    </div></div>`;
  refreshIcons();
}
function setActive(k) { $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === k)); }
function setPill(k, n) { $$(`[data-pill="${k}"]`).forEach((p) => { p.hidden = !n; p.textContent = n; }); }

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) {
    e.preventDefault();
    return logout();
  }
  if (e.target.closest('[data-change-pw]')) {
    e.preventDefault();
    return changePasswordForm();
  }
});

/** เปลี่ยนรหัสผ่านของตัวเอง (บัญชีร้าน) — เงื่อนไขรหัสเดียวกับตอนตั้งรหัสครั้งแรก · บันทึกในบันทึกความปลอดภัย */
function changePasswordForm() {
  const m = openModal(`<div class="modal-head"><h2>เปลี่ยนรหัสผ่าน</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <form id="cpw"><div class="modal-body stack">
      <div class="small muted">บัญชี <b>${esc(A.user.email)}</b></div>
      <label class="field"><span>รหัสผ่านปัจจุบัน</span><input name="old_password" type="password" required autocomplete="current-password"></label>
      <label class="field"><span>รหัสผ่านใหม่</span><input name="new_password" type="password" required autocomplete="new-password"></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input name="confirm" type="password" required autocomplete="new-password"></label>
    </div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary">${icon('save')} บันทึกรหัสผ่านใหม่</button></div></form>`);
  const f = $('#cpw', m);
  passwordMeter(f.new_password, () => A.user.email);
  enhancePasswords(m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (!passwordOk(d.new_password, A.user.email)) return toast('รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขทุกข้อ', 'bad');
    if (d.new_password !== d.confirm) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'bad');
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try {
        const { user } = await API.get('/api/auth/me');
        await API.put('/api/auth/me', { ...user, old_password: d.old_password, new_password: d.new_password });
        closeModal();
        toast('เปลี่ยนรหัสผ่านแล้ว ครั้งต่อไปให้ใช้รหัสผ่านใหม่', 'ok');
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/* ---------- แจ้งเตือนคำสั่งซื้อใหม่ ---------- */
// แจ้งในหน้าเว็บเท่านั้น (ไม่มีเสียง/การแจ้งเตือนของเบราว์เซอร์)
function alertAdmin(title, body) {
  toast(`${title} — ${body}`, 'ok');
}
async function pollStats(first) {
  try {
    const s = await API.get('/api/admin/stats');
    A.stats = s;
    if (!s.by_status) return; // บัญชีนี้ไม่มีสิทธิ์ดูคำสั่งซื้อ
    const v = s.by_status.verifying || 0;
    const toShip = (s.by_status.paid || 0) + (s.by_status.preparing || 0);
    setPill('orders', v + toShip);
    if (!first) {
      if (s.latest_order_id > A.lastOrderId) alertAdmin('🛒 มีคำสั่งซื้อใหม่', `${s.latest_order_id - A.lastOrderId} รายการ`, `orders/${s.latest_order_id}`);
      else if (v > A.lastVerifying) alertAdmin('💰 มีสลิปรอตรวจสอบ', `${v} รายการ`, 'orders?status=verifying');
    }
    A.lastOrderId = s.latest_order_id;
    A.lastVerifying = v;
    document.title = `${v + toShip ? `(${v + toShip}) ` : ''}ระบบหลังบ้าน | ${A.settings.shop_name || 'ร้านสวัสดิการ สตง.'}`;
  } catch {}
}

/* ---------- dashboard ---------- */
async function pageDashboard() {
  await pollStats(A.lastOrderId === null);
  const s = A.stats;
  const b = s.by_status || {};
  const stat = (lbl, ic, val, href, hl) => `<a class="card stat ${hl ? 'hl' : ''}" href="${href || '#dashboard'}"><span class="lbl">${icon(ic)} ${lbl}</span><span class="val">${val}</span></a>`;
  const orders = can('orders_view');
  const stock = can('stock_manage');
  content(`<div class="admin-top"><div><h1>ภาพรวม</h1><div class="muted">อัปเดตอัตโนมัติทุก 30 วินาที</div></div>${orders ? `<a class="btn btn-light" href="#orders">${icon('receipt-text')} ดูคำสั่งซื้อทั้งหมด</a>` : ''}</div>
    <div class="stats">
      ${orders ? `${stat('สลิปรอตรวจสอบ', 'search-check', num(b.verifying || 0), '#orders?status=verifying', b.verifying)}
      ${stat('ต้องจัดเตรียม/ส่ง', 'package', num((b.paid || 0) + (b.preparing || 0)), '#orders?status=to_ship', (b.paid || 0) + (b.preparing || 0))}
      ${stat('รอชำระเงิน', 'wallet', num(b.pending_payment || 0), '#orders?status=pending_payment')}
      ${stat('ยอดขายวันนี้', 'calendar-check', baht(s.today.sum), '#orders')}
      ${stat('ยอดขายเดือนนี้', 'calendar-range', baht(s.month.sum), '#orders')}
      ${stat('ยอดขายสะสม', 'trending-up', baht(s.total.sum), '#orders')}` : ''}
      ${can('members_view') ? stat('สมาชิกทั้งหมด', 'users', num(s.members), '#members') : ''}
    </div>
    <div class="grid-2">
      ${orders ? `<div class="card"><div class="card-head"><h3>คำสั่งซื้อล่าสุด</h3><a href="#orders">ทั้งหมด →</a></div>
        <div class="table-wrap"><table class="table"><tbody>${s.recent.map((o) => `<tr class="click" data-href="#orders/${o.id}">
          <td><b class="mono">${esc(o.order_no)}</b><div class="small muted">${esc(o.user_name)} · ${esc(o.user_department || '')}</div></td>
          <td>${statusBadge(o.status)}</td><td class="right mono">${baht(o.total)}</td></tr>`).join('') || '<tr><td class="muted center">ยังไม่มีคำสั่งซื้อ</td></tr>'}</tbody></table></div></div>` : ''}
      <div class="stack">
        ${stock ? `<div class="card"><div class="card-head"><h3>${icon('triangle-alert')} สินค้าใกล้หมด (≤ 5)</h3><a href="#products">ปรับสต็อก →</a></div>
          <div class="table-wrap"><table class="table"><tbody>${s.low_stock.map((p) => `<tr><td>${esc(p.name)}<div class="small muted">${esc(p.sku || '')}</div></td><td class="right"><b style="color:${p.stock ? 'var(--warn)' : 'var(--bad)'}">${num(p.stock)}</b> ${esc(p.unit)}</td></tr>`).join('') || '<tr><td class="muted">ไม่มี</td></tr>'}</tbody></table></div></div>` : ''}
        ${orders ? `<div class="card"><div class="card-head"><h3>${icon('trophy')} สินค้าขายดี</h3></div>
          <div class="table-wrap"><table class="table"><tbody>${s.top_products.map((p) => `<tr><td>${esc(p.name)}</td><td class="right">${num(p.qty)} ชิ้น</td><td class="right mono">${baht(p.sum)}</td></tr>`).join('') || '<tr><td class="muted">ยังไม่มีข้อมูล</td></tr>'}</tbody></table></div></div>` : ''}
      </div>
    </div>`);
}
document.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('button,a,input')) location.hash = tr.dataset.href; });

/* ---------- orders ---------- */
const ORDER_TABS = [['', 'ทั้งหมด'], ['verifying', 'รอตรวจสลิป'], ['to_ship', 'ต้องจัดเตรียม'], ['pending_payment', 'รอชำระ'], ['preparing', 'กำลังเตรียม'], ['shipped', 'พร้อมให้รับ'], ['completed', 'สำเร็จ'], ['cancelled', 'ยกเลิก']];
async function pageOrders(params) {
  const f = { status: params.get('status') || '', q: params.get('q') || '', pickup: params.get('pickup') || '', from: params.get('from') || '', to: params.get('to') || '' };
  const qs = new URLSearchParams(f).toString();
  const { orders } = await API.get(`/api/admin/orders?${qs}`);
  const b = A.stats?.by_status || {};
  const tabN = (k) => (k === 'to_ship' ? (b.paid || 0) + (b.preparing || 0) : k ? b[k] || 0 : '');
  const sum = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  content(`<div class="admin-top"><div><h1>คำสั่งซื้อ</h1><div class="muted">${num(orders.length)} รายการ · ยอดรวม ${baht(sum)}</div></div>
      ${can('orders_export') ? `<button class="btn btn-light" id="export">${icon('file-down')} ส่งออก Excel</button>` : ''}</div>
    <div class="card">
      <div class="tabs">${ORDER_TABS.map(([k, l]) => `<button class="tab ${f.status === k ? 'active' : ''}" data-st="${k}">${l}${tabN(k) ? `<span class="n">${tabN(k)}</span>` : ''}</button>`).join('')}</div>
      <form class="filters" id="of">
        <input class="input grow" name="q" placeholder="ค้นหาเลขคำสั่งซื้อ ชื่อ อีเมล เบอร์โทร หน่วยงาน" value="${esc(f.q)}" style="min-width:220px">
        <select class="input" name="pickup" aria-label="จุดรับสินค้า"><option value="">ทุกจุดรับสินค้า</option>${pickupOptions(f.pickup)}</select>
        <span class="small muted">จาก</span> <span data-thdate="from" data-optional data-value="${esc(f.from)}"></span>
        <span class="small muted">ถึง</span> <span data-thdate="to" data-optional data-value="${esc(f.to)}"></span>
        <button class="btn btn-primary btn-sm">${icon('search')} ค้นหา</button>
      </form>
      <div class="table-wrap"><table class="table"><thead><tr><th>เลขที่ / วันที่</th><th>ผู้สั่งซื้อ</th><th>สินค้า</th><th>รับสินค้า</th><th class="right">ยอดเงิน</th><th>สถานะ</th></tr></thead>
      <tbody>${orders.map((o) => `<tr class="click" data-href="#orders/${o.id}">
        <td class="nowrap"><b class="mono">${esc(o.order_no)}</b><div class="small muted">${thDate(o.created_at)}</div></td>
        <td><b>${esc(o.user_name)}</b><div class="small muted">${esc(o.user_department || '')}</div><div class="small muted">${esc(o.phone || '')}</div></td>
        <td class="small" style="max-width:280px">${esc(o.item_names || '')}</td>
        <td class="small nowrap">${o.delivery_method === 'delivery' ? '🚚 จัดส่ง' : '🏢 ' + esc(pickupShort(o.pickup_point))}</td>
        <td class="right mono nowrap"><b>${baht(o.total)}</b></td>
        <td>${statusBadge(o.status)}${o.has_slip && o.status === 'verifying' ? `<div class="small" style="color:var(--purple)">มีสลิป</div>` : ''}${o.has_postage_slip && o.status === 'postage_verifying' ? `<div class="small" style="color:var(--purple)">มีสลิปค่าส่ง</div>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="6" class="empty">${icon('inbox')}ไม่พบคำสั่งซื้อ</td></tr>`}</tbody></table></div>
    </div>`);
  const go = (patch) => { const n = { ...f, ...patch }; Object.keys(n).forEach((k) => !n[k] && delete n[k]); location.hash = 'orders' + (Object.keys(n).length ? '?' + new URLSearchParams(n) : ''); };
  thDatePickers($('#of'));
  $$('[data-st]').forEach((t) => (t.onclick = () => go({ status: t.dataset.st })));
  $('#of').onsubmit = (e) => { e.preventDefault(); go(Object.fromEntries(new FormData(e.target))); };
  if ($('#export')) $('#export').onclick = async () => {
    const { rows } = await API.get(`/api/admin/orders/export?${qs}`);
    if (!rows.length) return toast('ไม่มีข้อมูลให้ส่งออก', 'bad');
    // 1 แถว = สินค้า 1 รายการ — ค่าระดับคำสั่งซื้อ (ค่าจัดส่ง/ยอดคำสั่งซื้อ) ใส่เฉพาะแถวแรกของแต่ละคำสั่งซื้อ
    // เพื่อให้ SUM ใน Excel ไม่นับซ้ำ
    const seen = new Set();
    const data = rows.map((r) => {
      const first = !seen.has(r.order_no);
      seen.add(r.order_no);
      return {
      'เลขที่คำสั่งซื้อ': r.order_no, 'วันที่สั่ง': thDate(r.created_at), 'สถานะ': STATUS[r.status]?.label || r.status,
      'ผู้สั่งซื้อ': r.user_name, 'ชื่อผู้ใช้/อีเมล': r.user_email, 'หน่วยงาน': r.user_department, 'ผู้รับ': r.recipient_name, 'โทร': r.phone,
      'การรับสินค้า': r.delivery_method === 'delivery' ? 'จัดส่ง' : 'รับเอง', 'จุดรับสินค้า': r.pickup_point || '', 'หมายเหตุ': r.note,
      'รหัสสินค้า': r.sku, 'สินค้า': r.name, 'หน่วย': r.unit, 'ราคา': r.price, 'จำนวน': r.qty, 'รวม': r.line_total,
      'ค่าจัดส่ง': first ? r.shipping_fee : '', 'ยอดคำสั่งซื้อ': first ? r.total : '', 'ชำระเมื่อ': r.paid_at ? thDate(r.paid_at) : '', 'เลขพัสดุ': r.tracking_no || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0]).map((k) => ({ wch: Math.max(10, k.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'คำสั่งซื้อ');
    XLSX.writeFile(wb, `คำสั่งซื้อ_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
}

async function pageOrderDetail(id) {
  const { order: o, postage_default_account: postageDefault = '', pickup_address: pickupAddress = '', label_sender: labelSender = '' } = await API.get(`/api/admin/orders/${id}`);
  // ตรงกับกติกาฝั่งเซิร์ฟเวอร์: ห้ามทำรายการกับคำสั่งซื้อของตัวเอง และขั้นชำระเงินกับขั้นจัดส่งใช้สิทธิ์คนละตัว
  const ownOrder = !!A.user.member_id && A.user.member_id === o.member_id;
  const validMove = (to) => {
    if (FLOW.indexOf(to) > FLOW.indexOf(o.status)) return true;
    if (to === 'pending_payment') return o.status === 'verifying';
    return A.user.owner;
  };
  const allowed = (to) => {
    if (ownOrder || o.status === 'cancelled') return false;
    if (to === 'cancelled') return o.status === 'completed' ? A.user.owner : can('orders_cancel');
    if (!validMove(to)) return false;
    if (to === 'received' && !o.is_regional) return false;
    const touchesPayment = ['pending_payment', 'verifying', 'paid'].includes(to) || ['pending_payment', 'verifying'].includes(o.status);
    return can(touchesPayment ? 'orders_payment' : 'orders_fulfill');
  };
  // เปลี่ยนสถานะด้วยปุ่มตามขั้นตอนเท่านั้น (ไม่มีเมนูเลือกสถานะเอง) · ยกเลิกอยู่ใน "ตัวเลือกเพิ่มเติม"
  const canCancel = allowed('cancelled');
  const shipLabel = o.is_regional ? 'ส่งทางไปรษณีย์แล้ว' : o.delivery_method === 'pickup' ? 'พร้อมให้รับสินค้า' : 'จัดส่งแล้ว';
  const canPostage = o.is_regional && !ownOrder && can('orders_fulfill');
  const actions = ({
    pending_payment: [['verifying', 'ลูกค้าแจ้งชำระแล้ว', 'btn-light']],
    verifying: [['paid', '✓ ยืนยันยอดเงินถูกต้อง', 'btn-ok'], ['pending_payment', 'สลิปไม่ถูกต้อง (ให้แนบใหม่)', 'btn-danger']],
    paid: [['preparing', 'เริ่มจัดเตรียมสินค้า', 'btn-primary'], ['shipped', shipLabel, 'btn-light']],
    preparing: [['shipped', shipLabel, 'btn-primary']],
    // ส่วนภูมิภาค: หลังส่งไปรษณีย์ ใช้ฟอร์ม "แจ้งยอดค่าส่งไปรษณีย์" แทนการปิดงาน
    shipped: o.is_regional ? [['received', 'ลูกค้าได้รับสินค้าแล้ว', 'btn-ok']] : [['completed', 'ลูกค้าได้รับสินค้าแล้ว', 'btn-ok']],
    received: [],
    completed: [],
    cancelled: [],
  }[o.status] || []).filter(([to]) => allowed(to));
  content(`<p><a href="#orders">${icon('arrow-left')} คำสั่งซื้อทั้งหมด</a></p>
    <div class="admin-top"><div><div class="small muted">คำสั่งซื้อ</div><h1 class="mono">${esc(o.order_no)}</h1><div class="muted small">สั่งเมื่อ ${thDate(o.created_at)}</div></div>
      <div class="row">${statusBadge(o.status, o)}${o.is_regional ? `<button class="btn btn-light btn-sm" id="print-label">${icon('mail')} พิมพ์ใบปะหน้าพัสดุ</button>` : ''}<button class="btn btn-light btn-sm" id="print">${icon('printer')} พิมพ์ใบจัดส่ง</button></div></div>
    <div class="grid-2">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>รายการสินค้าที่ต้องจัดส่ง</h3><span class="muted small">${num(o.items.reduce((s, i) => s + i.qty, 0))} ชิ้น</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>สินค้า</th><th class="right">ราคา</th><th class="right">จำนวน</th><th class="right">รวม</th></tr></thead><tbody>
            ${o.items.map((i) => `<tr><td><b>${esc(i.name)}</b><div class="small muted">${esc(i.sku || '')}</div>${i.promo_note ? `<div class="small" style="color:var(--ok)">${esc(i.promo_note)}</div>` : ''}</td><td class="right mono">${baht(i.price)}</td><td class="right"><b style="font-size:1.1rem">${i.qty}</b> ${esc(i.unit || '')}</td><td class="right mono">${baht(i.line_total)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="card-pad" style="padding-top:6px">
            ${o.shipping_fee > 0 ? `<div class="summary-row"><span>ค่าจัดส่ง</span><span>${baht(o.shipping_fee)}</span></div>` : ''}
            <div class="summary-row total"><span>ยอดที่ต้องได้รับ</span><span>${baht(o.total)}</span></div>
          </div>
        </div>
        <div class="card card-pad stack">
          <h3>${icon('receipt')} สลิปการโอนเงิน</h3>
          ${o.has_slip ? `<div class="small muted">แนบเมื่อ ${thDate(o.slip_uploaded_at)}</div><a href="/api/shop/admin/orders/${o.id}/slip" target="_blank"><img class="slip-img" src="/api/shop/admin/orders/${o.id}/slip?t=${encodeURIComponent(o.slip_uploaded_at || '')}" alt="สลิป"></a>
             <div class="alert alert-info small">${icon('info')}<div>ตรวจสอบว่ายอดเงิน <b>${baht(o.total)}</b> เข้าบัญชีจริง ก่อนกด “ยืนยันยอดเงินถูกต้อง”</div></div>` : '<div class="muted">ยังไม่มีการแนบสลิป</div>'}
        </div>
        ${o.is_regional ? `<div class="card card-pad stack" id="postage-card">
          <h3>${icon('mailbox')} ค่าส่งไปรษณีย์ (ส่วนภูมิภาค)</h3>
          ${o.postage_amount ? `<dl class="kv"><dt>ยอดค่าส่ง</dt><dd><b>${baht(o.postage_amount)}</b>${o.postage_paid_at ? ` <span class="badge st-completed">ได้รับเงินแล้ว</span>` : ''}</dd>
            <dt>บัญชีรับเงิน</dt><dd style="white-space:pre-line">${esc(o.postage_account || '-')}</dd>
            <dt>แจ้งยอดเมื่อ</dt><dd>${thDate(o.postage_billed_at)}</dd></dl>` : `<div class="muted small">ยังไม่ได้แจ้งค่าส่งไปรษณีย์ · แจ้งได้หลังจากกด “ลูกค้าได้รับสินค้าแล้ว”</div>`}
          ${o.has_postage_receipt ? `<a href="/api/shop/admin/orders/${o.id}/postage-receipt" target="_blank" class="small">${icon('receipt')} ดูใบเสร็จไปรษณีย์</a>` : ''}
          ${o.has_postage_slip ? `<div class="small muted">ผู้ซื้อแนบสลิปค่าส่งเมื่อ ${thDate(o.postage_slip_at)}</div><a href="/api/shop/admin/orders/${o.id}/postage-slip" target="_blank"><img class="slip-img" src="/api/shop/admin/orders/${o.id}/postage-slip?t=${encodeURIComponent(o.postage_slip_at || '')}" alt="สลิปค่าส่ง"></a>` : ''}
          ${o.status === 'postage_verifying' && canPostage ? `<div class="alert alert-info small">${icon('info')}<div>ตรวจสอบว่ายอด <b>${baht(o.postage_amount)}</b> เข้าบัญชีผู้ส่งสินค้าครบถ้วน ก่อนกดยืนยัน</div></div>
            <label class="field"><span>ข้อความถึงผู้สั่งซื้อ (จำเป็นเมื่อสลิปไม่ถูกต้อง)</span><input id="pc-note" placeholder="เช่น ยอดโอนไม่ครบ"></label>
            <div class="status-actions"><button class="btn btn-ok" data-postage-ok="1">✓ ได้รับเงินค่าส่งไปรษณีย์เรียบร้อยแล้ว</button><button class="btn btn-danger" data-postage-ok="0">สลิปค่าส่งไม่ถูกต้อง</button></div>` : ''}
          ${['received', 'postage_due', 'postage_verifying'].includes(o.status) && canPostage ? `<details ${o.status === 'received' ? 'open' : ''}><summary class="small" style="cursor:pointer;font-weight:600">${o.postage_amount ? 'แก้ไขยอด / ใบเสร็จ / บัญชี' : 'แจ้งยอดค่าส่งไปรษณีย์'}</summary>
            <form id="postage-bill" class="stack" style="margin-top:10px">
              <label class="field"><span>ยอดค่าส่งไปรษณีย์ (บาท) <em>*</em></span><input name="amount" type="number" min="0" step="0.01" required value="${esc(o.postage_amount ?? '')}"></label>
              <label class="field"><span>บัญชีรับค่าส่ง (ของผู้ส่งสินค้า แยกจากบัญชีร้าน) <em>*</em></span><textarea name="account" rows="3" required placeholder="ธนาคาร / เลขที่บัญชี / ชื่อบัญชี หรือพร้อมเพย์">${esc(o.postage_account || postageDefault)}</textarea></label>
              <div class="field"><span>รูปใบเสร็จค่าส่งไปรษณีย์ ${o.has_postage_receipt ? '(เลือกใหม่ถ้าจะเปลี่ยน)' : '<em>*</em>'}</span>
                <label class="file-pick" data-file-pick><input name="receipt" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden>
                  <img class="file-pick__preview" alt="" hidden><span class="file-pick__icon">${icon('image-up')}</span>
                  <span class="file-pick__text"><b data-file-title>กดเพื่อเลือกรูปใบเสร็จ หรือลากรูปมาวาง</b><small class="muted" data-file-name>JPG / PNG · ระบบย่อรูปให้อัตโนมัติ</small></span></label></div>
              <label class="field"><span>ข้อความถึงผู้สั่งซื้อ (ถ้ามี)</span><input name="note" placeholder="เช่น ส่ง EMS เลขพัสดุ …"></label>
              <button class="btn btn-primary">${icon('send')} แจ้งยอดค่าส่งไปยังผู้สั่งซื้อ</button>
            </form></details>` : ''}
        </div>` : ''}
      </div>
      <div class="stack">
        ${ownOrder ? `<div class="alert alert-warn small">${icon('shield-alert')}<div>นี่คือคำสั่งซื้อของคุณเอง กรุณาให้ผู้ดูแลคนอื่นดำเนินการ</div></div>` : ''}
        ${actions.length || canCancel ? `<div class="card card-pad stack">
          <h3>${icon('list-checks')} ดำเนินการ</h3>
          <label class="field"><span>ข้อความถึงผู้สั่งซื้อ (${SEC.mail_enabled ? 'ส่งทางอีเมล และแสดงในหน้าคำสั่งซื้อ' : 'แสดงในหน้าคำสั่งซื้อของลูกค้า'})</span><textarea id="st-note" placeholder="เช่น สลิปยอดไม่ตรง / นัดรับสินค้าวันศุกร์ เวลา 13.00 น."></textarea></label>
          ${o.delivery_method === 'delivery' && can('orders_fulfill') ? `<label class="field"><span>เลขพัสดุ (ถ้ามี)</span><input id="st-track" value="${esc(o.tracking_no || '')}"></label>` : ''}
          <div class="status-actions">${actions.map(([s, l, c]) => `<button class="btn ${c}" data-to="${s}">${l}</button>`).join('')}</div>
          ${canCancel ? `<details><summary class="small muted" style="cursor:pointer">ตัวเลือกเพิ่มเติม</summary>
            <div class="row" style="margin-top:10px"><button class="btn btn-danger btn-sm" data-to="cancelled">${icon('x')} ยกเลิก + คืนสต็อก</button></div></details>` : ''}
        </div>` : ''}
        <div class="card card-pad stack">
          <h3>${icon('user-round')} ผู้สั่งซื้อ</h3>
          <dl class="kv">
            <dt>ชื่อ</dt><dd><b>${esc(o.user_name)}</b></dd>
            ${o.user_email.includes('@') ? `<dt>อีเมล</dt><dd><a href="mailto:${esc(o.user_email)}">${esc(o.user_email)}</a></dd>` : `<dt>ชื่อผู้ใช้</dt><dd>${esc(o.user_email)}</dd>`}
            <dt>หน่วยงาน</dt><dd>${esc(o.user_department || '-')}</dd>
            <dt>ผู้รับ</dt><dd>${esc(o.recipient_name)} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></dd>
            <dt>การรับสินค้า</dt><dd>${o.delivery_method === 'delivery' ? `<b>จัดส่ง</b><br>${esc(o.address)}` : o.is_regional ? `<b>ส่วนภูมิภาค (ส่งทางไปรษณีย์)</b><br>${esc(o.pickup_point || '-')}${pickupAddress ? `<div class="small" style="white-space:pre-line;margin-top:4px">${esc(pickupAddress)}</div>` : `<div class="small" style="color:var(--warn)">ยังไม่ได้ตั้งที่อยู่สำนักงานนี้ (ตั้งค่าร้าน → ที่อยู่สำนักงานส่วนภูมิภาค)</div>`}` : `<b>รับเองที่</b><br>${esc(o.pickup_point || '-')}`}</dd>
            ${o.note ? `<dt>หมายเหตุ</dt><dd>${esc(o.note)}</dd>` : ''}
            ${o.tracking_no ? `<dt>เลขพัสดุ</dt><dd>${esc(o.tracking_no)}</dd>` : ''}
          </dl>
        </div>
        <div class="card card-pad"><h3 style="margin-bottom:12px">${icon('history')} ประวัติ</h3>
          <ul class="log">${o.logs.slice().reverse().map((l) => `<li><b>${esc(STATUS[l.status]?.label || l.status)}</b><div class="small muted">${thDate(l.created_at)}${l.by_name ? ' · ' + esc(l.by_name) : ' · ระบบ'}</div>${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}</li>`).join('')}</ul></div>
      </div>
    </div>`);
  const change = async (status, btn) => {
    const note = $('#st-note')?.value.trim() || '';
    if (status === 'cancelled' && !(await confirmBox('ยกเลิกคำสั่งซื้อนี้ และคืนสินค้าเข้าสต็อก?', 'ยกเลิกคำสั่งซื้อ', true))) return;
    if (status === 'pending_payment' && o.status === 'verifying' && !note) { $('#st-note').focus(); return toast('กรุณาระบุเหตุผลในช่องข้อความ เพื่อแจ้งผู้สั่งซื้อ', 'bad'); }
    if (status === 'completed' && o.is_regional && !o.postage_paid_at && !note) { $('#st-note').focus(); return toast('คำสั่งซื้อส่วนภูมิภาคยังไม่ได้รับค่าส่งไปรษณีย์ หากจะปิดงานโดยไม่เก็บค่าส่ง กรุณาระบุเหตุผลในช่องข้อความ', 'bad'); }
    await withBusy(btn, async () => {
      try {
        await API.post(`/api/admin/orders/${o.id}/status`, { status, note, tracking_no: $('#st-track')?.value });
        toast(`อัปเดตเป็น “${STATUS[status].label}” แล้ว${SEC.mail_enabled ? ' ระบบกำลังส่งอีเมลแจ้งผู้สั่งซื้อ' : ' (ระบบอีเมลยังปิด ลูกค้าจะเห็นเมื่อเปิดหน้าคำสั่งซื้อ)'}`, 'ok');
        pollStats(); pageOrderDetail(id);
      } catch (e) { toast(e.message, 'bad'); }
    });
  };
  $$('[data-to]').forEach((b) => (b.onclick = () => change(b.dataset.to, b)));
  // แจ้งยอดค่าส่งไปรษณีย์ (ยอด + บัญชีผู้ส่งสินค้า + รูปใบเสร็จ)
  const bill = $('#postage-bill');
  if (bill) {
    filePicker($('[data-file-pick]', bill));
    bill.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(bill.querySelector('.btn-primary'), async () => {
        try {
          const fd = new FormData(bill);
          const file = bill.receipt.files[0];
          fd.delete('receipt');
          if (file) fd.append('receipt', await resizeImage(file, 1600, 0.85), 'receipt.jpg');
          await API.form(`/api/admin/orders/${o.id}/postage`, fd);
          toast('แจ้งยอดค่าส่งไปรษณีย์แล้ว ผู้สั่งซื้อจะเห็นในหน้าคำสั่งซื้อ', 'ok');
          pollStats(); pageOrderDetail(id);
        } catch (err) { toast(err.message, 'bad'); }
      });
    };
  }
  // ผู้ส่งสินค้ายืนยัน / ปฏิเสธสลิปค่าส่งไปรษณีย์
  $$('[data-postage-ok]').forEach((b) => (b.onclick = async () => {
    const ok = b.dataset.postageOk === '1';
    const note = $('#pc-note')?.value.trim() || '';
    if (!ok && !note) { $('#pc-note').focus(); return toast('กรุณาระบุเหตุผลที่สลิปค่าส่งไม่ถูกต้อง', 'bad'); }
    if (ok && !(await confirmBox(`ยืนยันว่าได้รับเงินค่าส่งไปรษณีย์ ${baht(o.postage_amount)} ครบถ้วนแล้ว? คำสั่งซื้อจะเสร็จสิ้น`, 'ยืนยันได้รับเงิน'))) return;
    await withBusy(b, async () => {
      try {
        await API.post(`/api/admin/orders/${o.id}/postage-confirm`, { ok, note });
        toast(ok ? 'ได้รับเงินค่าส่งไปรษณีย์แล้ว คำสั่งซื้อเสร็จสิ้น' : 'แจ้งผู้สั่งซื้อให้แนบสลิปค่าส่งใหม่แล้ว', 'ok');
        pollStats(); pageOrderDetail(id);
      } catch (err) { toast(err.message, 'bad'); }
    });
  }));
  $('#print').onclick = () => {
    $('#print-area').innerHTML = `<div style="font-family:Sarabun,sans-serif">
      <h2 style="margin:0">${esc(A.settings.shop_name)} — ใบจัดส่งสินค้า</h2>
      <p>เลขที่ <b>${esc(o.order_no)}</b> · วันที่ ${thDate(o.created_at)} · ${STATUS[o.status].label}</p>
      <p><b>ผู้รับ:</b> ${esc(o.recipient_name)} โทร ${esc(o.phone)}<br><b>หน่วยงาน:</b> ${esc(o.user_department || '-')}<br>
      <b>จุดรับสินค้า:</b> ${o.delivery_method === 'delivery' ? 'จัดส่ง — ' + esc(o.address) : esc(o.pickup_point || 'รับเอง')}${o.is_regional && pickupAddress ? `<br><b>ที่อยู่จัดส่ง:</b> ${esc(pickupAddress).replace(/\n/g, '<br>')}` : ''}${o.note ? `<br><b>หมายเหตุ:</b> ${esc(o.note)}` : ''}</p>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6"><tr><th>#</th><th>รหัส</th><th>สินค้า</th><th>จำนวน</th><th>ราคา</th><th>รวม</th><th>✓</th></tr>
      ${o.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.sku || '')}</td><td>${esc(i.name)}${i.promo_note ? `<br><small>${esc(i.promo_note)}</small>` : ''}</td><td align="center">${i.qty} ${esc(i.unit || '')}</td><td align="right">${baht(i.price)}</td><td align="right">${baht(i.line_total)}</td><td></td></tr>`).join('')}
      <tr><td colspan="5" align="right"><b>ยอดรวม</b></td><td align="right"><b>${baht(o.total)}</b></td><td></td></tr></table>
      <p style="margin-top:40px">ผู้จัดสินค้า ............................................ &nbsp;&nbsp;&nbsp; ผู้รับสินค้า ............................................ &nbsp; วันที่ ................</p></div>`;
    window.print();
  };
  // ใบปะหน้าพัสดุ (ส่วนภูมิภาค) A4 แนวนอน: ผู้ส่งมุมซ้ายบน · ผู้รับค่อนไปทางขวาล่าง
  // เปิดหน้าต่างให้ตรวจ/แก้/เพิ่มข้อความก่อนพิมพ์ (ค่าเริ่มต้น: ผู้ส่งจากหน้าตั้งค่าร้าน, ผู้รับจากคำสั่งซื้อ + ที่อยู่สำนักงาน)
  if ($('#print-label')) $('#print-label').onclick = () => {
    const recipient = [o.recipient_name, o.phone && `โทร ${o.phone}`, o.pickup_point, pickupAddress].filter(Boolean).join('\n');
    const m = openModal(`<div class="modal-head"><h2>พิมพ์ใบปะหน้าพัสดุ (A4 แนวนอน)</h2><button class="x-btn" data-close>${icon('x')}</button></div>
      <form class="modal-body stack" id="lblf">
        ${pickupAddress ? '' : `<div class="alert alert-warn small">${icon('triangle-alert')}<div>ยังไม่ได้ตั้งที่อยู่ของ “${esc(o.pickup_point || '')}” ในหน้าตั้งค่าร้าน · พิมพ์ที่อยู่เพิ่มในช่องผู้รับได้เลย</div></div>`}
        <label class="field"><span>ผู้ส่ง (มุมซ้ายบน)</span><textarea name="sender" rows="4">${esc(labelSender || A.settings.shop_name || '')}</textarea></label>
        <label class="field"><span>ผู้รับ (ค่อนไปทางขวาล่าง) · บรรทัดแรกพิมพ์ตัวใหญ่</span><textarea name="recipient" rows="6">${esc(recipient)}</textarea></label>
        <label class="field"><span>ข้อมูลเพิ่มเติม (ถ้ามี · พิมพ์ใต้กรอบผู้รับ)</span><textarea name="extra" rows="2" placeholder="เช่น ระวังแตก / ห้ามพับ / จำนวน 2 กล่อง"></textarea></label>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="items" checked style="width:auto"> พิมพ์เลขคำสั่งซื้อและรายการสินค้า (ตัวเล็ก มุมซ้ายล่าง)</label>
        <p class="small muted" style="margin:0">ในหน้าต่างพิมพ์ เลือกกระดาษ A4 และแนวนอน (Landscape)</p>
      </form>
      <div class="modal-foot"><button class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary" id="lbl-print">${icon('printer')} พิมพ์</button></div>`, { wide: true });
    $('#lbl-print', m).onclick = () => {
      const f = $('#lblf', m);
      const lines = (t) => esc(t.trim()).replace(/\n/g, '<br>');
      const [first, ...rest] = f.recipient.value.trim().split('\n');
      const extra = f.extra.value.trim();
      $('#print-area').innerHTML = `<style>@page{size:A4 landscape;margin:0}@media print{body.shop-app>*:not(#print-area){display:none!important}.shop-app #print-area{padding:0;position:static}}</style>
        <div style="font-family:Sarabun,sans-serif;position:relative;width:297mm;height:205mm;box-sizing:border-box;padding:14mm 16mm;color:#000;overflow:hidden">
          <div style="font-size:15pt;line-height:1.55;max-width:150mm">
            <div style="font-size:12pt;font-weight:700;letter-spacing:.5px;margin-bottom:2mm">ผู้ส่ง</div>${lines(f.sender.value)}</div>
          <div style="position:absolute;left:115mm;right:20mm;top:84mm">
            <div style="border:2px solid #000;border-radius:4mm;padding:9mm 11mm">
              <div style="font-size:14pt;font-weight:700;letter-spacing:.5px">ผู้รับ</div>
              <div style="font-size:26pt;font-weight:700;margin-top:2mm;line-height:1.3">${esc(first || '')}</div>
              <div style="font-size:19pt;margin-top:2mm;line-height:1.55">${lines(rest.join('\n'))}</div></div>
            ${extra ? `<div style="font-size:16pt;font-weight:700;margin-top:4mm;line-height:1.5">${lines(extra)}</div>` : ''}</div>
          ${f.items.checked ? `<div style="position:absolute;left:16mm;bottom:12mm;font-size:10pt;color:#333;max-width:90mm">คำสั่งซื้อ ${esc(o.order_no)}<br>${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</div>` : ''}</div>`;
      closeModal();
      window.print();
    };
  };
}

/* ---------- products ---------- */
async function pageProducts(params) {
  const { products } = await API.get('/api/admin/products');
  A.products = products;
  const q = (params.get('q') || '').toLowerCase();
  const list = q ? products.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q)) : products;
  content(`<div class="admin-top"><div><h1>สินค้าและสต็อก</h1><div class="muted">${num(products.filter((p) => p.status === 'published').length)} รายการที่แสดงหน้าร้าน · สต็อกรวม ${num(products.reduce((s, p) => s + p.stock, 0))} ชิ้น</div></div>
      <button class="btn btn-gold" id="add-product">${icon('plus')} เพิ่มสินค้าใหม่</button></div>
    <div class="alert alert-info small" style="margin-bottom:14px">${icon('info')}<div>สินค้าที่เพิ่มจากหน้านี้จะขึ้นในหลังบ้านเว็บไซต์ (EmDash) ทันที · แก้ไขชื่อ รูป ราคา โปรโมชั่น และรายละเอียดภายหลังได้ในหลังบ้านเว็บไซต์ · ปรับสต็อกที่หน้านี้เพื่อให้มีประวัติการเคลื่อนไหวทุกครั้ง</div></div>
    <div class="card">
      <form class="filters" id="pf"><input class="input grow" name="q" value="${esc(q)}" placeholder="ค้นหารหัส ชื่อ หมวดหมู่"><button class="btn btn-primary btn-sm">${icon('search')} ค้นหา</button></form>
      <div class="table-wrap"><table class="table"><thead><tr><th style="width:60px">รูป</th><th>รหัส / ชื่อสินค้า</th><th>หมวดหมู่</th><th class="right">ราคา</th><th class="right">คงเหลือ</th><th class="right">ขายแล้ว</th><th>สถานะ</th><th></th></tr></thead>
      <tbody>${list.map((p) => `<tr style="${p.status === 'published' ? '' : 'opacity:.55'}">
        <td>${p.image_url ? `<button type="button" class="thumb-zoom" data-zoom-img="${esc(p.image_url)}" data-zoom-title="${esc(p.name)}" title="กดเพื่อดูรูปขยาย" aria-label="ขยายรูป ${esc(p.name)}"><img class="thumb-sm" src="${esc(p.image_url)}" alt="" loading="lazy"></button>` : `<span class="thumb-sm" style="display:grid;place-items:center;color:var(--muted)">${icon('image')}</span>`}</td>
        <td><b>${esc(p.name)}</b><div class="small muted mono">${esc(p.sku || '')}</div></td>
        <td class="small">${esc(p.category || '-')}</td>
        <td class="right mono">${baht(p.price)}</td>
        <td class="right nowrap"><b style="font-size:1.05rem;color:${p.stock <= 0 ? 'var(--bad)' : p.stock <= 5 ? 'var(--warn)' : 'var(--text)'}">${num(p.stock)}</b> <span class="small muted">${esc(p.unit || '')}</span>
          ${p.variants.length ? `<div class="small muted">รวม ${num(p.variants.length)} แบบ (สี/ไซส์)</div>` : ''}
          <div class="row" style="gap:4px;justify-content:flex-end"><button class="btn btn-light btn-xs" data-stock="${esc(p.id)}">${icon('arrow-up-down')} ปรับสต็อก</button>
          <button class="btn btn-light btn-xs" data-variants="${esc(p.id)}" title="แยกสต็อกตามสี/ไซส์">${icon('swatch-book')} สี/ไซส์</button></div></td>
        <td class="right">${num(p.sold)}</td>
        <td>${p.status === 'published' ? '<span class="badge st-completed">แสดง</span>' : '<span class="badge st-cancelled">ฉบับร่าง</span>'}</td>
        <td class="nowrap"><button class="btn btn-light btn-xs" data-edit-product="${esc(p.id)}">${icon('pencil')} แก้ไข</button>
          <button class="btn btn-light btn-xs" data-del-product="${esc(p.id)}" title="ลบสินค้า (เลิกขาย)" style="color:var(--bad)">${icon('trash-2')} ลบ</button></td></tr>`).join('')
        || `<tr><td colspan="8" class="empty">${icon('package-open')}ยังไม่มีสินค้า — กด “เพิ่มสินค้า”</td></tr>`}</tbody></table></div>
    </div>`);
  $('#pf').onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); location.hash = 'products' + (v ? '?q=' + encodeURIComponent(v) : ''); };
  $$('[data-stock]').forEach((b) => (b.onclick = () => {
    const p = A.products.find((x) => x.id === b.dataset.stock);
    p.variants.length ? variantsForm(p) : stockForm(p);
  }));
  $$('[data-variants]').forEach((b) => (b.onclick = () => variantsForm(A.products.find((p) => p.id === b.dataset.variants))));
  $('#add-product').onclick = () => productForm();
  $$('[data-edit-product]').forEach((b) => (b.onclick = () => productForm(A.products.find((p) => p.id === b.dataset.editProduct))));
  $$('[data-zoom-img]').forEach((b) => (b.onclick = () => zoomImage(b.dataset.zoomImg, b.dataset.zoomTitle)));
  $$('[data-del-product]').forEach((b) => (b.onclick = () => deleteProduct(A.products.find((p) => p.id === b.dataset.delProduct), b)));
}

/** ดูรูปสินค้าขยายเต็มจอ (คลิกพื้นหลัง ปุ่ม × หรือ Esc เพื่อปิด) */
function zoomImage(src, title) {
  let box = $('#img-zoom');
  if (!box) {
    box = document.createElement('dialog');
    box.id = 'img-zoom';
    box.className = 'img-zoom';
    box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="img-zoom__close" aria-label="ปิด">${icon('x')}</button>`;
    document.body.append(box);
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.img-zoom__close')) box.close(); });
    refreshIcons();
  }
  const img = box.querySelector('img');
  // ขยายให้เต็มพื้นที่จอตามสัดส่วนรูป แม้ไฟล์ต้นฉบับจะเล็ก
  img.onload = () => {
    const ratio = img.naturalWidth / img.naturalHeight || 1;
    img.style.width = `${Math.round(Math.min(innerWidth * 0.92, (innerHeight * 0.86) * ratio))}px`;
  };
  img.src = src;
  img.alt = title || '';
  box.querySelector('figcaption').textContent = title || '';
  box.showModal();
}

/** ลบสินค้า = ย้ายไปถังขยะของหลังบ้านเว็บไซต์ (กู้คืนได้) · ประวัติคำสั่งซื้อเดิมยังอยู่ครบ */
async function deleteProduct(p, btn) {
  if (!p) return;
  if (!confirm(`ลบสินค้า "${p.name}" ออกจากร้าน?\n\n• สินค้าจะหายจากหน้าร้านทันที และสั่งซื้อไม่ได้อีก\n• ประวัติคำสั่งซื้อเดิมยังอยู่ครบ\n• กู้คืนได้จากถังขยะในหลังบ้านเว็บไซต์`)) return;
  await withBusy(btn, async () => {
    try {
      try {
        await API.del(`/api/admin/products/${encodeURIComponent(p.id)}`);
      } catch (err) {
        if (err.status !== 409) throw err;
        if (!confirm(`${err.message}\n\nคำสั่งซื้อเหล่านั้นยังดำเนินการต่อได้ตามปกติ (ยกเลิกแล้วสต็อกคืนได้) ยืนยันลบสินค้านี้?`)) return;
        await API.del(`/api/admin/products/${encodeURIComponent(p.id)}?force=1`);
      }
      toast('ลบสินค้าแล้ว', 'ok');
      router();
    } catch (err) { toast(err.message, 'bad'); }
  });
}

/** ค่าวันที่ในฐานข้อมูล (ISO) -> "YYYY-MM-DD" ตามเวลาไทย สำหรับช่อง <input type="date"> */
const bkkDateInput = (v) => {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? '' : new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
};

/* ---------- ตัวเลือกรูป: กดหรือลากรูปมาวาง แสดงรูปตัวอย่างก่อนบันทึก ---------- */
function filePicker(box) {
  if (!box) return;
  const input = box.querySelector('input[type=file]');
  const preview = box.querySelector('.file-pick__preview');
  const ic = box.querySelector('.file-pick__icon');
  const title = box.querySelector('[data-file-title]');
  const name = box.querySelector('[data-file-name]');
  let url = null;
  const show = () => {
    const file = input.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) { toast('รองรับเฉพาะไฟล์ JPG หรือ PNG', 'bad'); input.value = ''; return; }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    preview.src = url; preview.hidden = false; ic.hidden = true;
    title.textContent = 'รูปใหม่ · กดเพื่อเปลี่ยนอีกครั้ง';
    name.textContent = `${file.name} (${(file.size / 1048576).toFixed(1)} MB)`;
    const rm = box.closest('form')?.querySelector('[name=remove_image]');
    if (rm) rm.checked = false;
  };
  input.addEventListener('change', show);
  // ลากไฟล์มาวาง
  ['dragenter', 'dragover'].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => box.addEventListener(ev, () => box.classList.remove('is-drag')));
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!e.dataTransfer?.files?.length) return;
    input.files = e.dataTransfer.files;
    show();
  });
}

/** ขั้นราคาเดิมของสินค้าสำหรับเติมฟอร์ม: ฟิลด์ price_tiers ("50=1100, 100=1000") + ราคาพิเศษขั้นเดียวแบบเก่า (bulk_qty/bulk_price)
 * การแบ่งข้อความตรงกับ parseTierText ใน src/shop/pricing.js */
function productTiers(p) {
  if (!p) return [];
  const list = [];
  for (const part of String(p.price_tiers || '').split(/[;\n]+|,(?=\s*[\d,]+\s*[=:])/)) {
    const m = part.match(/^\s*([\d,]+)\s*[=:]\s*([\d,.]+)\s*$/);
    if (m) list.push({ qty: Number(m[1].replace(/,/g, '')), price: Number(m[2].replace(/,/g, '')) });
  }
  if (p.bulk_qty != null && p.bulk_price != null && !list.some((t) => t.qty === Number(p.bulk_qty))) list.push({ qty: Number(p.bulk_qty), price: Number(p.bulk_price) });
  return list.sort((a, b) => a.qty - b.qty);
}

/** ฟอร์มสินค้า: ไม่ส่ง p = เพิ่มสินค้าใหม่ · ส่ง p = แก้ไขสินค้านั้น — บันทึกผ่าน EmDash จึงอัปเดตในหลังบ้านเว็บไซต์ทันที */
function productForm(p = null) {
  const edit = !!p;
  const v = (k) => esc(p?.[k] ?? '');
  const cats = [...new Set(A.products.map((x) => (x.category || '').trim()).filter((c) => c && c !== 'สินค้าอื่นๆ'))].sort();
  const published = !edit || p.status === 'published';
  const m = openModal(`<div class="modal-head"><h2>${edit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <form id="apf"><div class="modal-body stack">
      <label class="field"><span>ชื่อสินค้า <em>*</em></span><input name="title" required maxlength="200" value="${v('name')}" ${edit ? '' : 'autofocus'}></label>
      <div class="form-grid">
        <label class="field"><span>รหัสสินค้า</span><input name="sku" maxlength="60" placeholder="เช่น SAO-POLO-01" value="${v('sku')}"></label>
        <label class="field"><span>หมวดหมู่</span><input name="category" maxlength="100" list="apf-cats" placeholder="เลือกหรือพิมพ์หมวดใหม่" value="${v('category')}"><datalist id="apf-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>ราคา (บาท) <em>*</em></span><input name="price" type="number" min="0" step="0.01" required value="${v('price')}"></label>
        <label class="field"><span>หน่วยนับ</span><input name="unit" maxlength="30" value="${edit ? v('unit') : 'ชิ้น'}"></label>
        ${edit
          ? `<div class="field"><span>จำนวนคงเหลือ</span><div style="padding:8px 0"><b>${num(p.stock)}</b> ${esc(p.unit || '')} <span class="small muted">· แก้ที่ปุ่ม “ปรับสต็อก” เพื่อให้มีประวัติ</span></div></div>`
          : `<label class="field"><span>จำนวนเริ่มต้น</span><input name="stock" type="number" min="0" step="1" value="0"></label>`}
        <div class="field full" style="border:1px solid var(--line);border-radius:12px;padding:12px">
          <span><b>ป้ายสินค้าใหม่</b> (ไม่บังคับ)</span>
          <label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="new_badge" value="1" ${p && (p.new_badge === 1 || p.new_badge === true) ? 'checked' : ''} style="width:auto;margin-top:4px"><span><b>สินค้าใหม่</b><br><small class="muted">ติ๊ก = ขึ้นป้าย “สินค้าใหม่” สีแดง ที่มุมซ้ายบนของสินค้าทันที จนกว่าจะเอาเครื่องหมายออก</small></span></label>
          <div style="margin-top:6px"><span class="small muted">หรือให้ป้ายหายเองหลังวันที่:</span><span data-thdate="new_until" data-optional data-value="${bkkDateInput(p?.new_until)}"></span></div>
        </div>
      </div>
      <label class="field"><span>รายละเอียด</span><textarea name="description" maxlength="5000" rows="3" placeholder="เช่น สี ไซส์ วัสดุ">${v('description')}</textarea></label>
      <div class="field"><span>รูปสินค้า</span>
        <label class="file-pick" data-file-pick>
          <input name="image" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden>
          <img class="file-pick__preview" alt="" ${edit && p.image_url ? `src="${esc(p.image_url)}"` : 'hidden'}>
          <span class="file-pick__icon" ${edit && p.image_url ? 'hidden' : ''}>${icon('image-up')}</span>
          <span class="file-pick__text"><b data-file-title>${edit && p.image_url ? 'รูปปัจจุบัน · กดเพื่อเปลี่ยนรูป' : 'กดเพื่อเลือกรูปสินค้า หรือลากรูปมาวาง'}</b><small class="muted" data-file-name>JPG / PNG · ระบบย่อรูปให้อัตโนมัติ</small></span>
        </label>
        ${edit && p.image_url ? `<label class="small" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" name="remove_image" value="1" style="width:auto"> ลบรูปนี้ออก (ไม่มีรูปสินค้า)</label>` : ''}</div>
      <fieldset class="stack" style="border:1px solid var(--line);border-radius:12px;padding:12px">
        <legend class="small" style="padding:0 6px"><b>ราคาตามจำนวนที่สั่งซื้อ</b> (ไม่บังคับ)</legend>
        <div id="tier-rows" class="stack" style="gap:8px"></div>
        <div><button type="button" class="btn btn-light btn-sm" id="tier-add">${icon('plus')} เพิ่มขั้นราคา</button></div>
        <input type="hidden" name="price_tiers">
        <div class="small muted">เช่น ราคาปกติ 1,200 · 50 ชิ้นขึ้นไป 1,100 · 100 ชิ้นขึ้นไป 1,000 (ต่อชิ้น) · ลูกค้าซื้อถึงขั้นไหน ทุกชิ้นได้ราคาขั้นนั้น (นับรวมทุกสี/ไซส์) · ลบทุกแถว = ไม่มีราคาพิเศษ</div>
      </fieldset>
      <fieldset class="stack" style="border:1px solid var(--line);border-radius:12px;padding:12px">
        <legend class="small" style="padding:0 6px"><b>ราคาโปรโมชั่นแบบชุด</b> (ไม่บังคับ)</legend>
        <div id="bundle-rows" class="stack" style="gap:8px"></div>
        <div><button type="button" class="btn btn-light btn-sm" id="bundle-add">${icon('plus')} เพิ่มราคาชุด</button></div>
        <input type="hidden" name="price_bundles">
        <div class="small muted">เช่น ราคาปกติชิ้นละ 50 · 3 ชิ้น 100 บาท · 5 ชิ้น 150 บาท (ราคารวมของชุด) · ระบบจัดชุดให้ลูกค้าได้ราคาถูกที่สุดเอง เช่น ซื้อ 4 ชิ้น = ชุด 3 ชิ้น + 1 ชิ้น = 150 บาท (นับรวมทุกสี/ไซส์) · ลบทุกแถว = ไม่มีราคาชุด</div>
      </fieldset>
      <fieldset class="stack" style="border:1px solid var(--line);border-radius:12px;padding:12px">
        <legend class="small" style="padding:0 6px"><b>ป้ายโปรโมชั่น</b> (ไม่บังคับ)</legend>
        <label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="promo_badge" value="1" ${p && (p.promo_badge === 1 || p.promo_badge === true) ? 'checked' : ''} style="width:auto;margin-top:4px"><span><b>แสดงป้ายโปรโมชั่น</b><br><small class="muted">ติ๊ก = ขึ้นป้าย “โปรโมชั่น” ที่มุมซ้ายบนของสินค้าทันที จนกว่าจะเอาเครื่องหมายออก</small></span></label>
        <div class="small muted" style="margin-top:4px">หรือตั้งช่วงวันที่ ให้ป้ายขึ้นเองเฉพาะช่วงนั้น (หน้ารายละเอียดสินค้าจะบอกระยะเวลาโปรโมชั่นด้วย):</div>
        <div class="form-grid">
          <div class="field"><span>เริ่มวันที่</span><span data-thdate="promo_start" data-optional data-value="${bkkDateInput(p?.promo_start)}"></span></div>
          <div class="field"><span>ถึงวันที่</span><span data-thdate="promo_end" data-optional data-value="${bkkDateInput(p?.promo_end)}"></span></div>
        </div>
        <div class="small muted">ป้ายโปรโมชั่นไม่เปลี่ยนราคาให้อัตโนมัติ (ปรับราคาเองที่ช่องราคา หรือใช้ราคาตามจำนวน / ราคาแบบชุดด้านบน)</div>
      </fieldset>
      <div class="row" style="gap:8px">
        <label class="radio-card grow"><input type="radio" name="status" value="published" ${published ? 'checked' : ''}><div><b>แสดงหน้าร้าน</b></div></label>
        <label class="radio-card grow"><input type="radio" name="status" value="draft" ${published ? '' : 'checked'}><div><b>เก็บเป็นฉบับร่าง (ซ่อน)</b></div></label>
      </div>
    </div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary">${icon('save')} ${edit ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า'}</button></div></form>`);
  const f = $('#apf', m);
  filePicker($('[data-file-pick]', m));
  thDatePickers(m); // ปฏิทินไทยตัวเดียวกับหน้ารายงาน
  // แถวขั้นราคา: ค่าเดิมของสินค้า (รวมราคาพิเศษขั้นเดียวแบบเก่า) หรือแถวว่าง 1 แถวสำหรับสินค้าใหม่
  const rows = $('#tier-rows', m);
  const addTierRow = (t = {}) => {
    rows.insertAdjacentHTML('beforeend', `<div class="row tier-row" style="gap:8px;align-items:center">
      <input class="input" type="number" min="2" step="1" placeholder="จำนวน เช่น 50" value="${esc(t.qty ?? '')}" data-tier-qty style="max-width:150px">
      <span class="small muted nowrap">${esc(f.unit.value || 'ชิ้น')}ขึ้นไป ราคา</span>
      <input class="input" type="number" min="0" step="0.01" placeholder="บาท/ชิ้น" value="${esc(t.price ?? '')}" data-tier-price style="max-width:150px">
      <button type="button" class="btn btn-light btn-xs" data-tier-del title="ลบขั้นนี้">${icon('trash-2')}</button></div>`);
    refreshIcons();
  };
  const existing = productTiers(p);
  (existing.length ? existing : [{}]).forEach(addTierRow);
  $('#tier-add', m).onclick = () => addTierRow();
  // แถวราคาแบบชุด: "3=100, 5=150" = 3 ชิ้น ราคารวม 100 บาท
  const brows = $('#bundle-rows', m);
  const addBundleRow = (t = {}) => {
    brows.insertAdjacentHTML('beforeend', `<div class="row bundle-row" style="gap:8px;align-items:center">
      <input class="input" type="number" min="2" step="1" placeholder="จำนวน เช่น 3" value="${esc(t.qty ?? '')}" data-bundle-qty style="max-width:150px">
      <span class="small muted nowrap">${esc(f.unit.value || 'ชิ้น')} ราคารวม</span>
      <input class="input" type="number" min="0" step="0.01" placeholder="บาท" value="${esc(t.price ?? '')}" data-bundle-price style="max-width:150px">
      <span class="small muted nowrap">บาท</span>
      <button type="button" class="btn btn-light btn-xs" data-bundle-del title="ลบชุดนี้">${icon('trash-2')}</button></div>`);
    refreshIcons();
  };
  const oldBundles = [];
  for (const part of String(p?.price_bundles || '').split(/[;\n]+|,(?=\s*[\d,]+\s*[=:])/)) {
    const mm = part.match(/^\s*([\d,]+)\s*[=:]\s*([\d,.]+)\s*$/);
    if (mm) oldBundles.push({ qty: Number(mm[1].replace(/,/g, '')), price: Number(mm[2].replace(/,/g, '')) });
  }
  (oldBundles.length ? oldBundles : [{}]).forEach(addBundleRow);
  $('#bundle-add', m).onclick = () => addBundleRow();
  brows.onclick = (e) => { const b = e.target.closest('[data-bundle-del]'); if (b) b.closest('.bundle-row').remove(); };
  rows.onclick = (e) => { const b = e.target.closest('[data-tier-del]'); if (b) b.closest('.tier-row').remove(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    // รวมแถวที่กรอกเป็นข้อความ "50=1100, 100=1000" (แถวว่างทั้งสองช่องข้ามไป) — เซิร์ฟเวอร์ตรวจซ้ำทุกขั้น
    f.price_tiers.value = $$('.tier-row', rows)
      .map((r) => [r.querySelector('[data-tier-qty]').value.trim(), r.querySelector('[data-tier-price]').value.trim()])
      .filter(([q, pr]) => q || pr)
      .map(([q, pr]) => `${q || 0}=${pr || 0}`)
      .join(', ');
    f.price_bundles.value = $$('.bundle-row', brows)
      .map((r) => [r.querySelector('[data-bundle-qty]').value.trim(), r.querySelector('[data-bundle-price]').value.trim()])
      .filter(([q, pr]) => q || pr)
      .map(([q, pr]) => `${q || 0}=${pr || 0}`)
      .join(', ');
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try {
        const fd = new FormData(f);
        const file = f.image.files[0];
        fd.delete('image');
        // ย่อรูปเป็น JPG ก่อนส่ง (รูปจากกล้องมือถือมักใหญ่หลาย MB)
        if (file) fd.append('image', await resizeImage(file, 1600, 0.88), 'product.jpg');
        const { product } = await API.form(edit ? `/api/admin/products/${encodeURIComponent(p.id)}` : '/api/admin/products', fd);
        toast(edit
          ? (product.status === 'draft' ? 'บันทึกแล้ว (เป็นฉบับร่าง ไม่แสดงหน้าร้าน)' : 'บันทึกการแก้ไขแล้ว หน้าร้านอัปเดตแล้ว')
          : (product.status === 'draft' ? 'บันทึกสินค้าเป็นฉบับร่างแล้ว' : 'เพิ่มสินค้าแล้ว และแสดงหน้าร้านแล้ว'), 'ok');
        closeModal();
        router();
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/** สินค้าที่แยกสี/ไซส์: ดูสต็อกทีละแบบ ปรับ เพิ่ม และลบแบบย่อย */
function variantsForm(p) {
  const vs = p.variants;
  const m = openModal(`<div class="modal-head"><h2>สต็อกตามสี/ไซส์</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <div class="modal-body stack">
      <div><b>${esc(p.name)}</b><div class="small muted">สต็อกรวม <b>${num(p.stock)}</b> ${esc(p.unit || '')}${vs.length ? ' — คำนวณจากผลรวมของทุกแบบ' : ''}</div></div>
      ${vs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>แบบ</th><th class="right">คงเหลือ</th><th class="right">ขายแล้ว</th><th></th></tr></thead><tbody>
        ${vs.map((v) => `<tr><td>${esc(v.label)}</td>
          <td class="right"><b style="color:${v.stock <= 0 ? 'var(--bad)' : v.stock <= 5 ? 'var(--warn)' : 'var(--text)'}">${num(v.stock)}</b></td>
          <td class="right">${num(v.sold)}</td>
          <td class="right nowrap"><button class="btn btn-light btn-xs" data-vstock="${v.id}">${icon('arrow-up-down')} ปรับ</button>
            ${v.stock <= 0 ? `<button class="btn btn-light btn-xs" data-vdel="${v.id}" title="ลบแบบนี้">${icon('trash-2')}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`
      : `<div class="alert alert-info small">${icon('info')}<div>สินค้านี้ยังนับสต็อกรวมเป็นก้อนเดียว เมื่อเพิ่มสี/ไซส์ ระบบจะนับสต็อกแยกทีละแบบ และสต็อกรวมจะเท่ากับผลรวมของทุกแบบ (ยอดเดิม ${num(p.stock)} จะถูกแทนที่)</div></div>`}
      <form id="vf" class="stack" style="border-top:1px solid var(--line);padding-top:12px">
        <b>เพิ่มสี/ไซส์</b>
        <label class="field"><span>สี (คั่นด้วยจุลภาค ไม่มีให้เว้นว่าง)</span><input name="colors" placeholder="เช่น ดำ, กรมท่า, เทา, ขาว"></label>
        <label class="field"><span>ไซส์ (คั่นด้วยจุลภาค ไม่มีให้เว้นว่าง)</span><input name="sizes" placeholder="เช่น S, M, L, XL, XXL"></label>
        <label class="field"><span>สต็อกเริ่มต้นของแต่ละแบบ</span><input name="stock" type="number" min="0" step="1" value="0"></label>
        <div class="small muted">ระบบสร้างทุกคู่ของสีและไซส์ที่ยังไม่มี เช่น 4 สี × 5 ไซส์ = 20 แบบ</div>
        <div><button class="btn btn-primary btn-sm">${icon('plus')} เพิ่ม</button></div>
      </form>
    </div>`);
  $$('[data-vstock]', m).forEach((b) => (b.onclick = () => stockForm(p, vs.find((v) => v.id === Number(b.dataset.vstock)))));
  $$('[data-vdel]', m).forEach((b) => (b.onclick = async () => {
    const v = vs.find((x) => x.id === Number(b.dataset.vdel));
    if (!confirm(`ลบแบบ "${v.label}" ออกจากสินค้านี้?`)) return;
    try { await API.req('DELETE', `/api/admin/products/${p.id}/variants/${v.id}`); toast('ลบแล้ว', 'ok'); await reopenVariants(p.id); }
    catch (err) { toast(err.message, 'bad'); }
  }));
  const f = $('#vf', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try { await API.post(`/api/admin/products/${p.id}/variants`, Object.fromEntries(new FormData(f))); toast('เพิ่มสี/ไซส์แล้ว', 'ok'); await reopenVariants(p.id); }
      catch (err) { toast(err.message, 'bad'); }
    });
  };
}
/** โหลดสินค้าใหม่แล้วเปิดหน้าต่างสี/ไซส์ของสินค้าเดิมอีกครั้ง */
async function reopenVariants(id) {
  closeModal();
  await router();
  const p = A.products?.find((x) => x.id === id);
  if (p) variantsForm(p);
}

function stockForm(p, v) {
  const cur = v ? v.stock : p.stock;
  const m = openModal(`<div class="modal-head"><h2>ปรับสต็อก</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <form id="sf"><div class="modal-body stack">
      <div class="row"><div><b>${esc(p.name)}</b>${v ? `<div><span class="badge st-preparing">${esc(v.label)}</span></div>` : ''}<div class="small muted">คงเหลือปัจจุบัน <b>${num(cur)}</b> ${esc(p.unit)}</div></div></div>
      <div class="row" style="gap:8px">
        <label class="radio-card grow"><input type="radio" name="mode" value="add" checked><div><b>รับเข้า (+)</b></div></label>
        <label class="radio-card grow"><input type="radio" name="mode" value="remove"><div><b>ตัดออก (−)</b></div></label>
        <label class="radio-card grow"><input type="radio" name="mode" value="set"><div><b>กำหนดยอดใหม่</b></div></label>
      </div>
      <label class="field"><span>จำนวน (${esc(p.unit)})</span><input name="qty" type="number" min="0" step="1" required autofocus></label>
      <label class="field"><span>เหตุผล / อ้างอิง</span><input name="reason" placeholder="เช่น รับของล็อตใหม่, ชำรุด, ตรวจนับประจำเดือน"></label>
      <div class="alert alert-info small" id="sf-prev">${icon('calculator')}<div>ยอดหลังปรับ: <b>${num(cur)}</b></div></div>
    </div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary">${icon('save')} บันทึก</button></div></form>`);
  const f = $('#sf', m);
  const calc = () => {
    const q = parseInt(f.qty.value) || 0, mode = f.mode.value;
    const after = mode === 'add' ? cur + q : mode === 'remove' ? cur - q : q;
    $('#sf-prev', m).innerHTML = `${icon('calculator')}<div>ยอดหลังปรับ: <b style="color:${after < 0 ? 'var(--bad)' : 'inherit'}">${num(after)}</b> ${esc(p.unit)}</div>`;
    refreshIcons();
  };
  f.oninput = calc;
  f.onsubmit = async (e) => {
    e.preventDefault();
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try {
        await API.post(`/api/admin/products/${p.id}/stock`, { ...Object.fromEntries(new FormData(f)), variant_id: v?.id });
        toast('ปรับสต็อกแล้ว', 'ok');
        if (v) await reopenVariants(p.id); else { closeModal(); router(); }
      }
      catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/* ---------- stock logs ---------- */
const REASON = { adjust: 'ปรับสต็อก', order: 'สั่งซื้อ (ตัดสต็อก)', cancel: 'ยกเลิก (คืนสต็อก)' };
async function pageStock() {
  const { logs } = await API.get('/api/admin/stock-logs');
  content(`<div class="admin-top"><div><h1>ประวัติการเคลื่อนไหวสต็อก</h1><div class="muted">300 รายการล่าสุด — ทุกการตัด/เพิ่ม/คืนสต็อกถูกบันทึกไว้</div></div></div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>วันที่</th><th>สินค้า</th><th>ประเภท</th><th class="right">เปลี่ยนแปลง</th><th class="right">คงเหลือ</th><th>อ้างอิง</th><th>โดย</th></tr></thead><tbody>
    ${logs.map((l) => `<tr><td class="small nowrap">${thDate(l.created_at)}</td><td>${esc(l.name || '(ลบแล้ว)')}<div class="small muted">${esc(l.sku || '')}</div></td>
      <td class="small">${REASON[l.reason] || esc(l.reason)}</td>
      <td class="right mono"><b style="color:${l.delta > 0 ? 'var(--ok)' : 'var(--bad)'}">${l.delta > 0 ? '+' : ''}${num(l.delta)}</b></td>
      <td class="right mono">${num(l.balance)}</td><td class="small">${l.ref && /^SAO/.test(l.ref) ? `<a href="#orders?q=${esc(l.ref)}">${esc(l.ref)}</a>` : esc(l.ref || '')}</td><td class="small">${esc(l.admin || (l.reason === 'order' ? 'ลูกค้า' : 'ระบบ'))}</td></tr>`).join('')
      || `<tr><td colspan="7" class="empty">ยังไม่มีข้อมูล</td></tr>`}
    </tbody></table></div></div>`);
}

/* ---------- members ---------- */
async function pageMembers(params) {
  const { users } = await API.get('/api/admin/members');
  const q = (params.get('q') || '').toLowerCase();
  const list = q ? users.filter((u) => `${u.name} ${u.email} ${u.office_email || ''} ${u.emp_id || ''} ${u.department} ${u.phone}`.toLowerCase().includes(q)) : users;
  content(`<div class="admin-top"><div><h1>สมาชิก</h1><div class="muted">${num(users.length)} บัญชี</div></div></div>
    <div class="card">
      <form class="filters" id="mf"><input class="input grow" name="q" value="${esc(q)}" placeholder="ค้นหาชื่อ ชื่อผู้ใช้ อีเมล หน่วยงาน เบอร์โทร"><button class="btn btn-primary btn-sm">${icon('search')} ค้นหา</button></form>
      <div class="table-wrap"><table class="table"><thead><tr><th>ชื่อ / ชื่อผู้ใช้</th><th>หน่วยงาน</th><th>โทร</th><th class="right">คำสั่งซื้อ</th><th class="right">ยอดซื้อ (ชำระแล้ว)</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.closed_at ? ` <span class="badge">ปิดบัญชีแล้ว</span>` : ''}<div class="small muted">${u.closed_at ? `ปิดบัญชีเมื่อ ${thDay(u.closed_at)}` : esc(u.email)}</div>${u.office_email ? `<div class="small muted">${esc(u.office_email)}</div>` : u.emp_id ? `<div class="small muted">เลขประจำตัว <span class="mono">${esc(u.emp_id)}</span></div>` : ''}<div class="small muted">สมัคร ${thDay(u.created_at)}</div></td>
        <td class="small">${esc(u.department || '-')}</td><td class="small nowrap">${esc(u.phone || '-')}</td>
        <td class="right"><a href="#orders?q=${encodeURIComponent(u.email)}">${num(u.order_count)}</a></td><td class="right mono">${baht(u.spent)}</td>
        <td class="nowrap">${A.user.owner && !u.closed_at ? `<button class="btn btn-light btn-xs" data-reset="${u.id}" data-name="${esc(u.name)}">${icon('key-round')} รีเซ็ตรหัส</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`);
  $('#mf').onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); location.hash = 'members' + (v ? '?q=' + encodeURIComponent(v) : ''); };
  $$('[data-reset]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox(`รีเซ็ตรหัสผ่านของ ${b.dataset.name}?`, 'รีเซ็ตรหัสผ่าน'))) return;
    try {
      const { password } = await API.post(`/api/admin/members/${b.dataset.reset}/reset-password`);
      showTempPassword(b.dataset.name, password, 'แล้วให้เปลี่ยนรหัสใหม่ที่เมนู “ข้อมูลส่วนตัว”');
    } catch (e) { toast(e.message, 'bad'); }
  }));
}
function showTempPassword(name, password, hint) {
  openModal(`<div class="modal-head"><h2>รหัสผ่านชั่วคราว</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <div class="modal-body stack"><p>แจ้งรหัสนี้ให้ <b>${esc(name)}</b> ${esc(hint)}</p>
    <div class="row"><b class="mono" style="font-size:1.6rem;letter-spacing:2px">${esc(password)}</b><button class="btn btn-light btn-sm" data-copy="${esc(password)}">${icon('copy')} คัดลอก</button></div>
    <div class="alert alert-warn small">${icon('triangle-alert')}<div>รหัสนี้จะแสดงครั้งเดียวเท่านั้น</div></div></div>`, { sticky: true });
}

/* ---------- อัปโหลดไฟล์ทะเบียนบุคลากร (DPIS) ---------- */
/** อ่านไฟล์ .xlsx โดยไม่ใช้ไลบรารี: แตก zip ด้วย DecompressionStream แล้วอ่านชีตแรก คืนค่า [[A, B, C, …], ...] (10 คอลัมน์แรก) เป็นข้อความ */
async function readXlsx(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ไฟล์นี้ไม่ใช่ Excel (.xlsx)');
  const files = {};
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0, n = dv.getUint16(eocd + 10, true); i < n; i++) {
    const nlen = dv.getUint16(p + 28, true);
    files[new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  const read = async (name) => {
    const f = files[name];
    if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = buf.subarray(start, start + f.size);
    if (f.method === 0) return new TextDecoder().decode(data);
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
  const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
  const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  // ชีตแรกตามลำดับใน workbook
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try {
    const wb = xml(await read('xl/workbook.xml'));
    const rid = tags(wb, 'sheet')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = tags(xml(await read('xl/_rels/workbook.xml.rels')), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) sheetPath = rel.getAttribute('Target').replace(/^\/?(xl\/)?/, 'xl/');
  } catch {}
  const sst = await read('xl/sharedStrings.xml');
  const strings = sst ? tags(xml(sst), 'si').map((si) => tags(si, 't').map((t) => t.textContent).join('')) : [];
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error('ไม่พบชีตในไฟล์');
  const rows = [];
  for (const row of tags(xml(sheet), 'row')) {
    const out = [];
    for (const c of tags(row, 'c')) {
      const col = (c.getAttribute('r') || '').replace(/\d+/g, '');
      const idx = col.length === 1 ? col.charCodeAt(0) - 65 : -1;
      if (idx < 0 || idx > 9) continue;
      const type = c.getAttribute('t');
      const v = tags(c, 'v')[0]?.textContent ?? '';
      let val = type === 's' ? strings[Number(v)] ?? '' : type === 'inlineStr' ? tags(c, 't').map((t) => t.textContent).join('') : v;
      if (!type || type === 'n') { if (/e/i.test(val) && isFinite(Number(val))) val = BigInt(Math.round(Number(val))).toString(); }
      out[idx] = String(val).trim();
    }
    rows.push(Array.from({ length: 10 }, (_, k) => out[k] ?? ''));
  }
  return rows;
}
/** .xlsx / .xls ด้วย SheetJS (โหลดไว้ในหน้า /shop-admin) — ถ้าโหลดไม่ได้ใช้ตัวอ่าน .xlsx ด้านบนแทน */
async function readExcel(file) {
  if (!window.XLSX) {
    if (/\.xls$/i.test(file.name)) throw new Error('อ่านไฟล์ .xls ไม่ได้ในขณะนี้');
    return readXlsx(file);
  }
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const cell = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : BigInt(Math.round(v)).toString()) : String(v ?? '').trim());
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).map((r) => Array.from({ length: 10 }, (_, k) => cell(r[k])));
}
/** CSV (UTF-8 หรือภาษาไทยแบบ Windows-874) */
async function readCsv(file) {
  const bytes = await file.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = new TextDecoder('windows-874').decode(bytes); }
  return text.replace(/^﻿/, '').split(/\r?\n/).map((line) => {
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    return Array.from({ length: 10 }, (_, k) => String(cells[k] ?? '').trim());
  });
}

/** วันเกิดเป็น "YYYY-MM-DD" (ค.ศ.) จากค่าในไฟล์: วันที่ของ Excel (ตัวเลข), "15/03/2530", "15-03-1987", "2530-03-15",
 * "15 มี.ค. 2530", "15 มีนาคม 2530" · ปี พ.ศ. (> 2400) แปลงเป็น ค.ศ. · อ่านไม่ได้ = '' */
const TH_MON = ['ม.ค', 'ก.พ', 'มี.ค', 'เม.ย', 'พ.ค', 'มิ.ย', 'ก.ค', 'ส.ค', 'ก.ย', 'ต.ค', 'พ.ย', 'ธ.ค'];
const TH_MON_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function birthDateISO(v) {
  let t = String(v ?? '').trim();
  if (!t) return '';
  let y, m, d;
  if (/^\d{4,6}(\.\d+)?$/.test(t)) { // เลขวันที่ของ Excel
    const dt = new Date(Math.round((Number(t) - 25569) * 86400000));
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else {
    let mm = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // ปี-เดือน-วัน
    if (mm) [y, m, d] = [+mm[1], +mm[2], +mm[3]];
    else if ((mm = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) [d, m, y] = [+mm[1], +mm[2], +mm[3]]; // วัน/เดือน/ปี
    else if ((mm = t.match(/^(\d{1,2})\s*([ก-๙.]+)\s*(\d{4})/))) { // 15 มี.ค. 2530 / 15 มีนาคม 2530
      const name = mm[2].replace(/\.$/, '');
      const k = TH_MON_FULL.findIndex((n) => n === name) + 1 || TH_MON.findIndex((n) => n === name || n.replace('.', '') === name.replace('.', '')) + 1;
      [d, m, y] = [+mm[1], k, +mm[3]];
    } else return '';
  }
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!m || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** SHA-256 ของ "อีเมล|YYYY-MM-DD" — ต้องตรงกับ dobHash ใน src/shop/api.js (วันเกิดจริงไม่ออกจากเครื่องนี้) */
async function dobHash(email, iso) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${email}|${iso}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const MASK = '<span class="mono muted">xxxxxx</span>';

async function pageRoster(params) {
  const q = params.get('q') || '';
  const r = await API.get('/api/admin/roster' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  content(`<div class="admin-top"><div><h1>อัปโหลดไฟล์รายชื่อบุคลากร</h1><div class="muted">ใช้ตรวจสอบสิทธิ์ตอนสมัครสมาชิก (อีเมลสำนักงาน + วันเดือนปีเกิด)</div></div></div>
    <div class="grid-2">
      <div class="card card-pad stack">
        <h3>${icon('file-spreadsheet')} อัปโหลดไฟล์ Excel</h3>
        <div class="alert alert-info small">${icon('info')}<div>คอลัมน์ <b>ลำดับ</b> · <b>ชื่อ-สกุล</b> (คำนำหน้าชื่อ ชื่อ นามสกุล) · <b>วันเดือนปีเกิด</b> · <b>อีเมล</b> (อีเมลสำนักงาน)<br>ใช้ชีตแรกของไฟล์ · มีแถวหัวตาราง ระบบหาคอลัมน์ให้เอง (ไม่มีหัวตาราง = คอลัมน์ A–D ตามลำดับนี้) · วันเกิดแบบ 15/03/2530, 15 มี.ค. 2530 หรือช่องวันที่ของ Excel · รองรับ .xlsx .xls และ .csv</div></div>
        <div class="alert alert-ok small">${icon('shield-check')}<div><b>ข้อมูลส่วนบุคคล:</b> ระบบอ่านไฟล์ในเครื่องนี้ แล้วส่งขึ้นเซิร์ฟเวอร์เฉพาะ ลำดับ ชื่อ-สกุล และอีเมล · วันเกิดถูกแปลงเป็นรหัสที่ย้อนกลับไม่ได้ก่อนส่ง ระบบไม่เก็บวันเกิดจริง</div></div>
        <label class="file-pick"><input type="file" id="roster-file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>
          <span class="file-pick__icon">${icon('file-spreadsheet')}</span>
          <span class="file-pick__text"><b>กดเพื่อเลือกไฟล์ Excel</b><small class="muted" id="roster-fname">.xlsx .xls หรือ .csv</small></span></label>
        <div id="roster-preview"></div>
      </div>
      <div class="card card-pad stack">
        <h3>${icon('users')} รายชื่อในระบบตอนนี้</h3>
        <div class="row" style="gap:24px">
          <div><div class="small muted">รายชื่อทั้งหมด</div><b style="font-size:1.6rem">${num(r.total)}</b></div>
          <div><div class="small muted">สมัครสมาชิกแล้ว</div><b style="font-size:1.6rem">${num(r.registered)}</b></div>
          <div><div class="small muted">ถูกล็อก</div><b style="font-size:1.6rem;color:${r.locked ? 'var(--bad)' : 'inherit'}">${num(r.locked || 0)}</b></div>
          <div><div class="small muted">อัปโหลดล่าสุด</div><b>${r.updated_at ? thDay(r.updated_at) : '-'}</b></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <form class="filters" id="rqf"><input class="input grow" name="q" value="${esc(q)}" placeholder="ค้นหาชื่อ อีเมล หรือลำดับ"><button class="btn btn-primary btn-sm">${icon('search')} ค้นหา</button></form>
      <div class="table-wrap"><table class="table"><thead><tr><th>ลำดับ</th><th>ชื่อ-สกุล</th><th>วันเดือนปีเกิด</th><th>อีเมล</th><th>สมัครสมาชิก</th></tr></thead><tbody>
      ${r.rows.map((x) => `<tr><td class="mono">${esc(x.no || '')}</td><td>${esc(x.full_name)}</td>
        <td>${x.has_check ? MASK : '<span class="small" style="color:var(--bad)">ไม่มีข้อมูล</span>'}</td>
        <td class="small">${esc(x.email)}</td><td class="small">${x.locked_at ? `<span class="badge st-cancelled">ถูกล็อก</span> <button class="btn btn-light btn-xs" data-unlock="${esc(x.email)}" data-name="${esc(x.full_name)}">${icon('lock-open')} ปลดล็อก</button>` : x.username ? `<span class="badge st-completed">สมัครแล้ว</span> <span class="muted">${esc(x.username)}</span>` : '<span class="muted">-</span>'}</td></tr>`).join('')
        || `<tr><td colspan="5" class="empty">${icon('file-spreadsheet')}${q ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีรายชื่อ — อัปโหลดไฟล์ Excel ด้านบน'}</td></tr>`}
      </tbody></table></div>
      ${r.total > r.rows.length && !q ? `<p class="small muted" style="padding:0 16px 12px">แสดง ${num(r.rows.length)} รายการแรก · ใช้ช่องค้นหาเพื่อดูรายชื่ออื่น</p>` : ''}
    </div>`);
  $('#rqf').onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); location.hash = 'roster' + (v ? '?q=' + encodeURIComponent(v) : ''); };
  // ปลดล็อกการตรวจสิทธิ์สมัครสมาชิก (กรอกวันเกิดผิดครบ 3 ครั้ง)
  $$('[data-unlock]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox(`ปลดล็อกสิทธิ์สมัครสมาชิกของ ${b.dataset.name}? (ควรยืนยันตัวตนกับเจ้าของก่อน)`, 'ปลดล็อก'))) return;
    try { await API.post('/api/admin/roster/unlock', { email: b.dataset.unlock }); toast('ปลดล็อกแล้ว สมัครสมาชิกได้อีกครั้ง', 'ok'); pageRoster(params); }
    catch (err) { toast(err.message, 'bad'); }
  }));
  $('#roster-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('#roster-fname').textContent = file.name;
    const box = $('#roster-preview');
    box.innerHTML = '<p class="small muted">กำลังอ่านไฟล์…</p>';
    let raw;
    try { raw = /\.csv$/i.test(file.name) ? await readCsv(file) : await readExcel(file); }
    catch (err) { box.innerHTML = `<div class="alert alert-bad small">${icon('circle-alert')}<div>อ่านไฟล์ไม่ได้: ${esc(err.message)}<br>ลองเปิดไฟล์ใน Excel แล้วบันทึกเป็น .xlsx อีกครั้ง</div></div>`; return refreshIcons(); }
    // หาคอลัมน์จากแถวหัวตาราง ถ้ามี · ไม่มี = A no, B name, C วันเกิด, D email
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    let col = { no: 0, name: 1, dob: 2, email: 3 };
    const head = raw.findIndex((r) => r.some((c) => /^(e-?mail|อีเมล)/.test(norm(c))));
    if (head >= 0 && head < 10) {
      const h = raw[head].map(norm);
      const find = (re, d) => { const k = h.findIndex((c) => re.test(c)); return k >= 0 ? k : d; };
      col = {
        no: find(/^(no\.?|ลำดับ|ที่)$/, 0),
        email: find(/^(e-?mail|อีเมล)/, 3),
        dob: find(/(วัน.*เกิด|เกิด|birth|dob)/, 2),
        name: find(/^(name|ชื่อ)/, 1),
      };
    }
    const rows = [], skipped = [], dup = new Set(), seen = new Set();
    let noCheck = 0;
    raw.forEach((r, i) => {
      if (i === head) return;
      const no = String(r[col.no] ?? '').trim(), name = String(r[col.name] ?? '').replace(/\s+/g, ' ').trim();
      const email = String(r[col.email] ?? '').replace(/[\s​ ]/g, '').toLowerCase();
      if (!no && !name && !email) return;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) { skipped.push([i + 1, name, email]); return; }
      const dob = birthDateISO(r[col.dob]);
      if (!dob) noCheck++;
      if (seen.has(email)) dup.add(email);
      seen.add(email); rows.push([no, name, email, dob]);
    });
    // วันเกิด → SHA-256("อีเมล|YYYY-MM-DD") ก่อนส่ง (วันเกิดจริงไม่ออกจากเครื่องนี้)
    for (const row of rows) row[3] = row[3] ? await dobHash(row[2], row[3]) : '';
    box.innerHTML = rows.length ? `<div class="stack" style="gap:10px">
        <div class="alert alert-ok small">${icon('file-check')}<div>พบรายชื่อ <b>${num(seen.size)}</b> คน${skipped.length ? ` · ข้าม ${num(skipped.length)} แถว (หัวตารางหรือไม่มีชื่อ-สกุล/อีเมล)` : ''}${dup.size ? ` · อีเมลซ้ำ ${num(dup.size)} รายการ (ใช้แถวล่าสุด)` : ''}</div></div>
        ${noCheck ? `<div class="alert alert-warn small">${icon('triangle-alert')}<div>${num(noCheck)} คน ไม่มีวันเดือนปีเกิด หรือรูปแบบวันที่อ่านไม่ได้ · คนกลุ่มนี้จะสมัครสมาชิกไม่ได้จนกว่าจะแก้ไฟล์</div></div>` : ''}
        <div class="table-wrap" style="max-height:220px"><table class="table"><thead><tr><th>ลำดับ</th><th>ชื่อ-สกุล</th><th>วันเดือนปีเกิด</th><th>อีเมล</th></tr></thead><tbody>
          ${rows.slice(0, 8).map(([a, b, c, h]) => `<tr><td class="mono">${esc(a)}</td><td>${esc(b)}</td><td>${h ? MASK : '<span class="small" style="color:var(--bad)">อ่านไม่ได้</span>'}</td><td class="small">${esc(c)}</td></tr>`).join('')}
          ${rows.length > 8 ? `<tr><td colspan="4" class="small muted">… และอีก ${num(rows.length - 8)} แถว</td></tr>` : ''}</tbody></table></div>
        ${skipped.length ? `<details class="small"><summary class="muted" style="cursor:pointer">ดูแถวที่ข้าม</summary>${skipped.slice(0, 20).map(([n, a, b]) => `<div>แถว ${n}: ${esc(a || '-')} | ${esc(b || '-')}</div>`).join('')}</details>` : ''}
        <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="radio" name="rmode" value="replace" checked style="width:auto;margin-top:3px"><span><b>แทนที่รายชื่อเดิมทั้งหมด</b> (แนะนำ เมื่อได้ไฟล์รายชื่อล่าสุด)</span></label>
        <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="radio" name="rmode" value="append" style="width:auto;margin-top:3px"><span><b>เพิ่ม / อัปเดต</b> เฉพาะรายชื่อในไฟล์นี้ (รายชื่อเดิมยังอยู่)</span></label>
        <p class="small muted" style="margin:0">สมาชิกที่สมัครไว้แล้วยังใช้งานได้ตามปกติ ไม่ว่าจะเลือกแบบใด</p>
        <button class="btn btn-gold" id="roster-save">${icon('upload')} บันทึกรายชื่อ ${num(seen.size)} คน</button></div>`
      : `<div class="alert alert-bad small">${icon('circle-alert')}<div>ไม่พบรายชื่อในไฟล์ · ต้องมีคอลัมน์ ลำดับ, ชื่อ-สกุล, วันเดือนปีเกิด และอีเมล</div></div>`;
    refreshIcons();
    if (!rows.length) return;
    $('#roster-save').onclick = async (ev) => {
      const btn = ev.currentTarget; // เก็บไว้ก่อน await (หลังจากนั้น currentTarget เป็น null)
      const mode = $('[name=rmode]:checked').value;
      if (mode === 'replace' && r.total && !(await confirmBox(`แทนที่รายชื่อเดิม ${num(r.total)} คน ด้วยรายชื่อใหม่ ${num(seen.size)} คน?`, 'แทนที่รายชื่อ'))) return;
      await withBusy(btn, async () => {
        try {
          // ส่งเฉพาะ ลำดับ, ชื่อ-สกุล, อีเมล และรหัสวันเกิด (hash)
          const res = await API.post('/api/admin/roster', { rows, mode, file: file.name });
          toast(`บันทึกรายชื่อ ${num(res.count)} คนแล้ว`, 'ok');
          pageRoster(new URLSearchParams());
        } catch (err) { toast(err.message, 'bad'); }
      });
    };
  };
}

/* ---------- ผู้ดูแลร้าน (แอดมินย่อย) ---------- */
const permChecks = (labels, selected = []) => Object.entries(labels).map(([k, l]) => `<label class="radio-card"><input type="checkbox" name="perm" value="${esc(k)}" ${selected.includes(k) ? 'checked' : ''}><div><b>${esc(l)}</b></div></label>`).join('');
const checkedPerms = (form) => $$('input[name=perm]:checked', form).map((i) => i.value);

async function pageStaff() {
  const { staff, perm_labels: labels } = await API.get('/api/admin/staff');
  content(`<div class="admin-top"><div><h1>ผู้ดูแลร้าน</h1><div class="muted">${num(staff.length)} บัญชี · เข้าใช้ได้เฉพาะหลังบ้านร้าน และทำได้เฉพาะสิทธิ์ที่เลือก</div></div>
      <button class="btn btn-gold" id="add-staff">${icon('user-plus')} เพิ่มผู้ดูแล</button></div>
    <div class="alert alert-info small" style="margin-bottom:14px">${icon('info')}<div>ตั้งค่าร้านและบัญชีรับเงิน การจัดการผู้ดูแล การรีเซ็ตรหัส และบันทึกความปลอดภัย เป็นสิทธิ์ของแอดมินใหญ่เท่านั้น · ผู้ดูแลเข้าสู่ระบบที่ <b>/shop-admin</b></div></div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>ชื่อ / ชื่อผู้ใช้</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead><tbody>
    ${staff.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="small muted">${esc(s.email)}</div><div class="small muted">${esc([s.phone, s.department].filter(Boolean).join(' · '))}</div></td>
      <td class="small">${s.perms.map((p) => esc(labels[p] || p)).join('<br>')}</td>
      <td>${s.must_change_password ? '<span class="badge st-pending_payment">รอเปลี่ยนรหัส</span>' : '<span class="badge st-completed">ใช้งานได้</span>'}</td>
      <td class="nowrap">${s.member_id === A.user.member_id ? '<span class="small muted">บัญชีของคุณ</span>' : `<button class="btn btn-light btn-xs" data-edit="${s.member_id}">${icon('pencil')} แก้สิทธิ์</button>
        <button class="btn btn-light btn-xs" data-staff-reset="${s.member_id}">${icon('key-round')} รีเซ็ตรหัส</button>
        <button class="btn btn-danger btn-xs" data-remove="${s.member_id}">${icon('user-x')} ถอดสิทธิ์</button>`}</td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">${icon('users')}ยังไม่มีผู้ดูแลร้าน — กด “เพิ่มผู้ดูแล”</td></tr>`}
    </tbody></table></div></div>`);
  const find = (id) => staff.find((s) => String(s.member_id) === id);
  $('#add-staff').onclick = () => staffAddForm(labels);
  $$('[data-edit]').forEach((b) => (b.onclick = () => staffEditForm(find(b.dataset.edit), labels)));
  $$('[data-remove]').forEach((b) => (b.onclick = async () => {
    const s = find(b.dataset.remove);
    if (!(await confirmBox(`ถอดสิทธิ์ผู้ดูแลของ ${s.name}? บัญชียังซื้อสินค้าได้ตามปกติ`, 'ถอดสิทธิ์', true))) return;
    try { await API.del(`/api/admin/staff/${s.member_id}`); toast('ถอดสิทธิ์แล้ว', 'ok'); pageStaff(); } catch (e) { toast(e.message, 'bad'); }
  }));
  $$('[data-staff-reset]').forEach((b) => (b.onclick = async () => {
    const s = find(b.dataset.staffReset);
    if (!(await confirmBox(`รีเซ็ตรหัสผ่านของ ${s.name}?`, 'รีเซ็ตรหัสผ่าน'))) return;
    try {
      const { password } = await API.post(`/api/admin/members/${s.member_id}/reset-password`);
      showTempPassword(s.name, password, 'ระบบจะให้ตั้งรหัสใหม่เมื่อเข้าสู่ระบบ');
      pageStaff();
    } catch (e) { toast(e.message, 'bad'); }
  }));
}

function staffAddForm(labels) {
  const m = openModal(`<div class="modal-head"><h2>เพิ่มผู้ดูแลร้าน</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <form id="staff-add"><div class="modal-body stack">
      <label class="field"><span>ชื่อผู้ใช้ <em>*</em></span><input name="username" required autofocus autocapitalize="none" spellcheck="false" maxlength="100">
        <small>ภาษาอังกฤษ ตัวเลข หรือ . _ - ยาว 4–32 ตัว · ถ้าเป็นชื่อผู้ใช้ของสมาชิกที่มีอยู่แล้ว ระบบจะเพิ่มสิทธิ์ให้บัญชีเดิมและใช้รหัสผ่านเดิม</small></label>
      <label class="field"><span>ชื่อ-นามสกุล <em>*</em> <span class="small muted" style="font-weight:400">(บัญชีใหม่)</span></span><input name="name"></label>
      <label class="field"><span>เบอร์โทรศัพท์</span><input name="phone" inputmode="tel"></label>
      <label class="field"><span>หน่วยงาน <span class="small muted" style="font-weight:400">(ถ้าไม่มีไม่ต้องใส่)</span></span><input name="department"></label>
      <div class="stack" style="gap:8px"><b>สิทธิ์ <em>*</em></b>${permChecks(labels)}</div>
    </div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary">${icon('save')} สร้างผู้ดูแล</button></div></form>`);
  const f = $('#staff-add', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const perms = checkedPerms(f);
    if (!perms.length) return toast('กรุณาเลือกสิทธิ์อย่างน้อย 1 รายการ', 'bad');
    const d = Object.fromEntries(new FormData(f));
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try {
        const r = await API.post('/api/admin/staff', { username: d.username.trim().toLowerCase(), name: d.name, phone: d.phone, department: d.department, perms });
        closeModal();
        await pageStaff();
        if (r.password) showTempPassword(r.name, r.password, 'เพื่อเข้าสู่ระบบครั้งแรกที่ /shop-admin ระบบจะให้ตั้งรหัสใหม่ทันที');
        else toast(`เพิ่มสิทธิ์ให้ ${r.name} แล้ว ใช้รหัสผ่านเดิมของบัญชีนี้`, 'ok');
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
}

function staffEditForm(s, labels) {
  const m = openModal(`<div class="modal-head"><h2>แก้สิทธิ์ ${esc(s.name)}</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <form id="staff-edit"><div class="modal-body stack" style="gap:8px">${permChecks(labels, s.perms)}</div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-primary">${icon('save')} บันทึก</button></div></form>`);
  const f = $('#staff-edit', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const perms = checkedPerms(f);
    if (!perms.length) return toast('กรุณาเลือกสิทธิ์อย่างน้อย 1 รายการ หรือใช้ปุ่มถอดสิทธิ์', 'bad');
    await withBusy(f.querySelector('.btn-primary'), async () => {
      try { await API.put(`/api/admin/staff/${s.member_id}`, { perms }); closeModal(); toast('บันทึกสิทธิ์แล้ว มีผลทันที', 'ok'); pageStaff(); }
      catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/* ---------- settings ---------- */
async function pageSettings() {
  const { settings: s } = await API.get('/api/admin/settings');
  A.settings = s;
  const ppOk = s.promptpay_id && promptPayPayload(s.promptpay_id, 1);
  let addrs = {};
  try { addrs = JSON.parse(s.pickup_addresses || '{}') || {}; } catch {}
  content(`<div class="admin-top"><div><h1>ตั้งค่าร้าน / การชำระเงิน</h1></div></div>
    <form id="setf" class="grid-2">
      <div class="stack">
        <div class="card card-pad"><h3 style="margin-bottom:14px">${icon('store')} ข้อมูลร้าน</h3><div class="form-grid">
          <label class="field full"><span>ชื่อร้าน</span><input name="shop_name" value="${esc(s.shop_name)}"></label>
          <label class="field full"><span>คำอธิบายร้าน</span><input name="shop_tagline" value="${esc(s.shop_tagline)}"></label>
          <label class="field full"><span>ข้อมูลติดต่อร้าน (แสดงใต้ชื่อหน้าร้านค้าสวัสดิการ)</span><textarea name="shop_contact" rows="4" placeholder="เช่น ชื่อผู้ติดต่อ เบอร์โทร วันและเวลาทำการ">${esc(s.shop_contact || '')}</textarea><small>ขึ้นบรรทัดใหม่ได้ · เว้นว่าง = ไม่แสดง</small></label>
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:14px">${icon('landmark')} บัญชีรับเงิน</h3><div class="form-grid">
          <label class="field"><span>ธนาคาร</span><input name="bank_name" value="${esc(s.bank_name)}" list="banks"><datalist id="banks"><option>ธนาคารกรุงไทย<option>ธนาคารกรุงเทพ<option>ธนาคารกสิกรไทย<option>ธนาคารไทยพาณิชย์<option>ธนาคารกรุงศรีอยุธยา<option>ธนาคารทหารไทยธนชาต<option>ธนาคารออมสิน<option>ธ.ก.ส.</datalist></label>
          <label class="field"><span>เลขที่บัญชี</span><input name="bank_account_no" value="${esc(s.bank_account_no)}"></label>
          <label class="field full"><span>ชื่อบัญชี</span><input name="bank_account_name" value="${esc(s.bank_account_name)}"></label>
          <label class="field full"><span>พร้อมเพย์ (เบอร์มือถือ 10 หลัก หรือ เลขประจำตัว 13 หลัก)</span><input name="promptpay_id" value="${esc(s.promptpay_id)}" inputmode="numeric">
            <small>${s.promptpay_id ? (ppOk ? '✓ ระบบสร้าง QR พร้อมยอดเงินให้ลูกค้าอัตโนมัติ' : '⚠ รูปแบบไม่ถูกต้อง') : 'ถ้ากรอก ระบบจะสร้าง QR ที่ระบุยอดเงินของแต่ละคำสั่งซื้อให้อัตโนมัติ'}</small></label>
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:6px">${icon('mailbox')} บัญชีรับค่าส่งไปรษณีย์ (ส่วนภูมิภาค)</h3>
          <p class="small muted" style="margin:0 0 12px">บัญชีของผู้ส่งสินค้า แยกจากบัญชีร้านค้าสวัสดิการ · ระบบเติมให้อัตโนมัติตอนแจ้งยอดค่าส่ง (แก้ได้ทุกคำสั่งซื้อ)</p><div class="form-grid">
          <label class="field"><span>ธนาคาร</span><input name="postage_bank_name" value="${esc(s.postage_bank_name || '')}" list="banks"></label>
          <label class="field"><span>เลขที่บัญชี</span><input name="postage_account_no" value="${esc(s.postage_account_no || '')}"></label>
          <label class="field full"><span>ชื่อบัญชี</span><input name="postage_account_name" value="${esc(s.postage_account_name || '')}"></label>
          <label class="field full"><span>พร้อมเพย์ (ถ้ามี)</span><input name="postage_promptpay" value="${esc(s.postage_promptpay || '')}" inputmode="numeric"></label>
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:6px">${icon('map-pin')} ที่อยู่สำนักงานส่วนภูมิภาค (สำหรับส่งไปรษณีย์)</h3>
          <p class="small muted" style="margin:0 0 12px">ใช้พิมพ์ใบปะหน้าพัสดุ: ชื่อ-สกุลและเบอร์โทรตามที่ผู้ซื้อแจ้ง + ที่อยู่ของสำนักงานที่ตั้งไว้ที่นี่ · ตั้งแล้ว ${num(Object.keys(addrs).filter((k) => addrs[k]).length)} จาก ${num(PICKUP_POINTS.length - 1)} แห่ง</p>
          <input type="hidden" name="pickup_addresses">
          <div class="stack" style="gap:8px">${PICKUP_GROUPS.filter((g) => g.label !== 'ส่วนกลาง').map((g) => `<details class="addr-group"><summary><b>${esc(g.label)}</b> <span class="small muted">(${g.points.filter((p) => addrs[p]).length}/${g.points.length})</span></summary>
            <div class="stack" style="gap:10px;margin-top:10px">${g.points.map((p) => `<label class="field"><span>${esc(p)}</span><textarea rows="2" data-addr="${esc(p)}" placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์">${esc(addrs[p] || '')}</textarea></label>`).join('')}</div></details>`).join('')}</div>
        </div>
        <div class="card card-pad"><h3 style="margin-bottom:14px">${icon('truck')} การรับสินค้า</h3><div class="form-grid">
          <label class="field full"><span>ข้อความแนะนำการรับสินค้า (แสดงใต้จุดรับสินค้า)</span><textarea name="pickup_location">${esc(s.pickup_location)}</textarea>
            <small>ไม่มีบริการจัดส่งถึงบ้าน ผู้สั่งเลือกรับที่ส่วนกลาง หรือสำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 1–15</small></label>
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:14px">${icon('message-circle')} ช่องทางสั่งซื้อสินค้าหมวด “อื่นๆ”</h3><div class="form-grid">
          <label class="field full"><span>ลิงก์ LINE</span><input name="others_line_url" value="${esc(s.others_line_url)}" placeholder="https://line.me/ti/p/... หรือ https://lin.ee/...">
            <small>สินค้าในหมวด “สินค้าอื่นๆ” ไม่ขายผ่านระบบร้านค้า หน้าเว็บจะแสดงปุ่ม LINE และเบอร์โทรนี้แทนปุ่มหยิบใส่ตะกร้า</small></label>
          <label class="field full"><span>เบอร์โทรศัพท์ติดต่อ</span><input name="others_phone" value="${esc(s.others_phone)}" placeholder="เช่น 02-271-8000 ต่อ 1234"></label>
        </div></div>
      </div>
      <div class="stack">
        <div class="card card-pad"><h3 style="margin-bottom:6px">${icon('clock')} เวลาเปิด-ปิดร้าน</h3>
          <p class="small muted" style="margin:0 0 12px">แสดงป้าย “หน้าร้านเปิด / หน้าร้านปิด” ที่หน้าร้านค้าสวัสดิการ</p><div class="form-grid">
          <div class="field full"><span>สถานะร้าน</span>
            ${[['auto', 'อัตโนมัติ ตามวันและเวลาทำการด้านล่าง'], ['open', 'กำหนดเอง: ร้านเปิด'], ['closed', 'กำหนดเอง: ร้านปิด']].map(([v, t]) => `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="radio" name="shop_hours_mode" value="${v}" ${(s.shop_hours_mode || 'auto') === v ? 'checked' : ''} style="width:auto"> ${t}</label>`).join('')}</div>
          <div class="field full" id="override-until" ${(s.shop_hours_mode || 'auto') === 'auto' ? 'hidden' : ''}><span>ใช้สถานะที่กำหนดเองถึงวันที่</span><div><span data-thdate="shop_override_until" data-optional data-value="${esc(s.shop_override_until || '')}"></span></div>
            <small>พ้นวันที่นี้แล้วกลับเป็นอัตโนมัติ · ไม่ระบุ = ใช้จนกว่าจะเปลี่ยนกลับเป็นอัตโนมัติ</small></div>
          <label class="field full"><span>ข้อความเพิ่มเติม (ถ้ามี)</span><input name="shop_status_note" value="${esc(s.shop_status_note || '')}" placeholder="เช่น ปิดวันหยุดนักขัตฤกษ์ / ปิดตรวจนับสต็อก"></label>
          <div class="field full"><span>วันทำการ</span><div class="row" style="gap:6px 14px">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => `<label style="display:flex;gap:5px;align-items:center;font-weight:400"><input type="checkbox" data-open-day="${i}" ${String(s.shop_open_days ?? '1,2,3,4,5').split(',').includes(String(i)) ? 'checked' : ''} style="width:auto"> ${d}</label>`).join('')}</div></div>
          <label class="field"><span>เวลาเปิด</span><input type="time" name="shop_open_time" value="${esc(s.shop_open_time || '09:00')}" required></label>
          <label class="field"><span>เวลาปิด</span><input type="time" name="shop_close_time" value="${esc(s.shop_close_time || '16:30')}" required></label>
          <input type="hidden" name="shop_open_days">
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:6px">${icon('mail')} ที่อยู่ผู้ส่ง (ใบปะหน้าพัสดุ)</h3>
          <p class="small muted" style="margin:0 0 12px">พิมพ์ที่มุมซ้ายบนของใบปะหน้าพัสดุ (A4 แนวนอน)</p><div class="form-grid">
          <label class="field full"><span>ชื่อ เบอร์โทร และที่อยู่ผู้ส่ง</span><textarea name="label_sender" rows="4">${esc(s.label_sender || '')}</textarea><small>ขึ้นบรรทัดใหม่ได้</small></label>
        </div></div>
        <div class="card card-pad"><h3 style="margin-bottom:14px">${icon('bell')} การแจ้งเตือน</h3><div class="form-grid">
          <label class="field full" style="flex-direction:row;align-items:flex-start;gap:10px"><input type="hidden" name="mail_paused" value="0"><input type="checkbox" name="mail_paused" value="1" ${s.mail_paused === '1' ? 'checked' : ''} style="width:auto;margin-top:4px"><span><b>พักการส่งอีเมลทั้งหมด</b><br><small class="muted">ไม่ส่งอีเมลแจ้งคำสั่งซื้อ สถานะ และลิงก์รีเซ็ตรหัสผ่าน จนกว่าจะเอาเครื่องหมายออก (Telegram ยังแจ้งตามปกติ)</small></span></label>
          <label class="field full"><span>อีเมลผู้รับแจ้งเตือนคำสั่งซื้อใหม่</span><input name="admin_notify_email" type="email" value="${esc(s.admin_notify_email)}" placeholder="เว้นว่าง = ใช้อีเมลแรกใน ADMIN_EMAILS"></label>
          <label class="field full"><span>ยกเลิกอัตโนมัติถ้าไม่ชำระภายใน (ชั่วโมง)</span><input name="auto_cancel_hours" type="number" min="0" value="${esc(s.auto_cancel_hours)}"><small>0 = ไม่ยกเลิกอัตโนมัติ · เมื่อยกเลิก ระบบจะคืนสินค้าเข้าสต็อก</small></label>
        </div></div>
        <button class="btn btn-gold btn-lg btn-block" type="submit">${icon('save')} บันทึกการตั้งค่า</button>
      </div>
    </form>`);
  const f = $('#setf');
  thDatePickers(f);
  $$('[name=shop_hours_mode]', f).forEach((r) => { r.onchange = () => { $('#override-until').hidden = f.shop_hours_mode.value === 'auto'; }; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    f.shop_open_days.value = $$('[data-open-day]:checked', f).map((c) => c.dataset.openDay).join(',');
    if (!f.shop_open_days.value) return toast('เลือกวันทำการอย่างน้อย 1 วัน', 'bad');
    if (f.shop_open_time.value >= f.shop_close_time.value) return toast('เวลาปิดร้านต้องหลังเวลาเปิดร้าน', 'bad');
    // รวมที่อยู่สำนักงานทุกช่องเป็น JSON เดียว
    f.pickup_addresses.value = JSON.stringify(Object.fromEntries($$('[data-addr]', f).map((t) => [t.dataset.addr, t.value.trim()]).filter(([, v]) => v)));
    const d = Object.fromEntries(new FormData(f));
    if (d.promptpay_id && !promptPayPayload(d.promptpay_id, 1)) return toast('เลขพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลข 13 หลัก', 'bad');
    await withBusy(f.querySelector('[type=submit]'), async () => {
      try { await API.put('/api/admin/settings', d); toast('บันทึกแล้ว', 'ok'); pageSettings(); } catch (err) { toast(err.message, 'bad'); }
    });
  };
}

/* ---------- รายงานยอดขาย ---------- */
const bkkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
const REPORT_GROUPS = { day: 'รายวัน', month: 'รายเดือน', year: 'รายปี' };
function reportDefaults(group) {
  const t = bkkToday();
  return { day: [t.slice(0, 8) + '01', t], month: [t.slice(0, 5) + '01-01', t], year: ['2020-01-01', t] }[group];
}
function periodLabel(p, group) {
  if (group === 'year') return 'พ.ศ. ' + (Number(p) + 543);
  const d = new Date(group === 'month' ? p + '-01T00:00:00Z' : p + 'T00:00:00Z');
  return d.toLocaleDateString('th-TH', group === 'month'
    ? { timeZone: 'UTC', month: 'long', year: 'numeric' }
    : { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
/** เติมช่วงที่ไม่มียอดขายเป็น 0 (รายวัน/รายเดือน) ให้เห็นครบทุกวัน/ทุกเดือนในช่วงที่เลือก */
function fillPeriods(rows, group, from, to) {
  if (group === 'year') return rows;
  const by = new Map(rows.map((r) => [r.period, r]));
  const out = [];
  const d = new Date(from + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z');
  if (group === 'month') d.setUTCDate(1);
  while (d <= end && out.length < 800) {
    const k = d.toISOString().slice(0, group === 'month' ? 7 : 10);
    out.push(by.get(k) || { period: k, orders: 0, buyers: 0, items: 0, total: 0 });
    if (group === 'month') d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
async function pageReports(params) {
  const group = REPORT_GROUPS[params.get('group')] ? params.get('group') : 'day';
  const [dFrom, dTo] = reportDefaults(group);
  const from = params.get('from') || dFrom, to = params.get('to') || dTo;
  const r = await API.get(`/api/admin/reports?group=${group}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const rows = fillPeriods(r.periods, group, r.from, r.to);
  const max = Math.max(1, ...rows.map((x) => x.total));
  const s = r.summary;
  const head = group === 'day' ? 'วันที่' : group === 'month' ? 'เดือน' : 'ปี';
  const range = `${thDay(from + ' 00:00:00')} – ${thDay(to + ' 00:00:00')}`;
  const stat = (label, value) => `<div class="card card-pad"><div class="muted small">${label}</div><b style="font-size:1.45rem">${value}</b></div>`;
  content(`<div class="admin-top"><div><h1>รายงานยอดขาย</h1><div class="muted">นับเฉพาะคำสั่งซื้อที่ชำระเงินแล้ว ตามวันที่สั่งซื้อ · ${esc(range)}</div></div>
      <div class="row" style="gap:8px"><button class="btn btn-light" id="rp-print">${icon('printer')} พิมพ์</button>
      <button class="btn btn-primary" id="rp-xlsx">${icon('file-down')} ส่งออก Excel</button></div></div>
    <div class="card card-pad" style="margin-bottom:14px">
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">${Object.entries(REPORT_GROUPS).map(([k, l]) => `<button class="btn btn-sm ${k === group ? 'btn-primary' : 'btn-light'}" data-group="${k}">${l}</button>`).join('')}</div>
      <form class="filters" id="rf"><span class="small">ตั้งแต่</span> <span data-thdate="from" data-value="${esc(from)}"></span>
        <span class="small">ถึง</span> <span data-thdate="to" data-value="${esc(to)}"></span>
        <button class="btn btn-primary btn-sm">${icon('search')} แสดงรายงาน</button>
        <button type="button" class="btn btn-light btn-sm" data-quick="today">วันนี้</button>
        <button type="button" class="btn btn-light btn-sm" data-quick="month">เดือนนี้</button>
        <button type="button" class="btn btn-light btn-sm" data-quick="year">ปีนี้</button></form>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
      ${stat('ยอดขายรวม', baht(s.total))}${stat('คำสั่งซื้อ', num(s.orders))}${stat('จำนวนสินค้า (ชิ้น)', num(s.items))}${stat('ผู้ซื้อ (คน)', num(s.buyers))}
    </div>
    <div class="card" style="margin-bottom:14px"><div class="card-pad" style="padding-bottom:0"><h2 style="margin:0">สรุปยอด${REPORT_GROUPS[group]}</h2></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>${head}</th><th class="right">คำสั่งซื้อ</th><th class="right">ชิ้น</th><th class="right">ผู้ซื้อ</th><th class="right">ยอดขาย</th><th style="width:28%"></th></tr></thead>
      <tbody>${rows.map((x) => `<tr style="${x.orders ? '' : 'color:var(--muted)'}"><td class="nowrap">${esc(periodLabel(x.period, group))}</td>
        <td class="right">${num(x.orders)}</td><td class="right">${num(x.items)}</td><td class="right">${num(x.buyers)}</td><td class="right mono"><b>${baht(x.total)}</b></td>
        <td><div style="height:10px;border-radius:5px;background:#1d4185;width:${(x.total / max * 100).toFixed(1)}%"></div></td></tr>`).join('')
        || `<tr><td colspan="6" class="empty">${icon('chart-column')}ไม่มียอดขายในช่วงนี้</td></tr>`}</tbody>
      ${rows.length ? `<tfoot><tr><th>รวม</th><th class="right">${num(s.orders)}</th><th class="right">${num(s.items)}</th><th class="right">${num(s.buyers)}</th><th class="right mono">${baht(s.total)}</th><th></th></tr></tfoot>` : ''}</table></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
      <div class="card"><div class="card-pad" style="padding-bottom:0"><h2 style="margin:0">ยอดขายตามสินค้า</h2></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>สินค้า</th><th class="right">จำนวน</th><th class="right">ยอดขาย</th></tr></thead>
        <tbody>${r.products.map((p) => `<tr><td><b>${esc(p.name)}</b><div class="small muted mono">${esc(p.sku || '')}</div></td><td class="right nowrap">${num(p.qty)} <span class="small muted">${esc(p.unit || '')}</span></td><td class="right mono">${baht(p.total)}</td></tr>`).join('')
          || '<tr><td colspan="3" class="empty">ไม่มีข้อมูล</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-pad" style="padding-bottom:0"><h2 style="margin:0">ยอดขายตามจุดรับสินค้า</h2></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>จุดรับสินค้า</th><th class="right">คำสั่งซื้อ</th><th class="right">ยอดขาย</th></tr></thead>
        <tbody>${r.pickup.map((p) => `<tr><td>${esc(p.pickup_point === '-' ? '-' : pickupShort(p.pickup_point))}</td><td class="right">${num(p.orders)}</td><td class="right mono">${baht(p.total)}</td></tr>`).join('')
          || '<tr><td colspan="3" class="empty">ไม่มีข้อมูล</td></tr>'}</tbody></table></div></div>
    </div>`);
  thDatePickers($('#rf'));
  const go = (n) => { location.hash = 'reports?' + new URLSearchParams(n); };
  $$('[data-group]').forEach((b) => (b.onclick = () => go({ group: b.dataset.group })));
  $('#rf').onsubmit = (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); go({ group, from: d.from || dFrom, to: d.to || dTo }); };
  $$('[data-quick]').forEach((b) => (b.onclick = () => {
    const t = bkkToday(), k = b.dataset.quick;
    go(k === 'today' ? { group: 'day', from: t, to: t } : k === 'month' ? { group: 'day', from: t.slice(0, 8) + '01', to: t } : { group: 'month', from: t.slice(0, 5) + '01-01', to: t });
  }));
  $('#rp-print').onclick = () => {
    const t = (cols, list, foot) => `<table style="width:100%;border-collapse:collapse;margin:6px 0 14px" border="1" cellpadding="5"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${list.join('') || `<tr><td colspan="${cols.length}" align="center">ไม่มีข้อมูล</td></tr>`}${foot || ''}</table>`;
    $('#print-area').innerHTML = `<div style="font-family:Sarabun,sans-serif">
      <h2 style="margin:0">${esc(A.settings.shop_name || 'ร้านค้าสวัสดิการ สตง.')} — รายงานยอดขาย${REPORT_GROUPS[group]}</h2>
      <p>ช่วงวันที่ ${esc(range)} · นับเฉพาะคำสั่งซื้อที่ชำระเงินแล้ว · พิมพ์เมื่อ ${thDate(new Date().toISOString())}</p>
      <p><b>ยอดขายรวม ${baht(s.total)}</b> · ${num(s.orders)} คำสั่งซื้อ · ${num(s.items)} ชิ้น · ผู้ซื้อ ${num(s.buyers)} คน</p>
      ${t([head, 'คำสั่งซื้อ', 'ชิ้น', 'ผู้ซื้อ', 'ยอดขาย'], rows.map((x) => `<tr><td>${esc(periodLabel(x.period, group))}</td><td align="right">${num(x.orders)}</td><td align="right">${num(x.items)}</td><td align="right">${num(x.buyers)}</td><td align="right">${baht(x.total)}</td></tr>`),
        `<tr><td><b>รวม</b></td><td align="right"><b>${num(s.orders)}</b></td><td align="right"><b>${num(s.items)}</b></td><td align="right"><b>${num(s.buyers)}</b></td><td align="right"><b>${baht(s.total)}</b></td></tr>`)}
      <h3 style="margin:0">ยอดขายตามสินค้า</h3>
      ${t(['รหัส', 'สินค้า', 'จำนวน', 'ยอดขาย'], r.products.map((p) => `<tr><td>${esc(p.sku || '')}</td><td>${esc(p.name)}</td><td align="right">${num(p.qty)} ${esc(p.unit || '')}</td><td align="right">${baht(p.total)}</td></tr>`))}
      <h3 style="margin:0">ยอดขายตามจุดรับสินค้า</h3>
      ${t(['จุดรับสินค้า', 'คำสั่งซื้อ', 'ยอดขาย'], r.pickup.map((p) => `<tr><td>${esc(p.pickup_point)}</td><td align="right">${num(p.orders)}</td><td align="right">${baht(p.total)}</td></tr>`))}
    </div>`;
    window.print();
  };
  $('#rp-xlsx').onclick = () => {
    if (!window.XLSX) return toast('โหลดตัวส่งออก Excel ไม่สำเร็จ ลองรีเฟรชหน้า', 'bad');
    const sheet = (data) => { const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 'ไม่มีข้อมูล': '' }]); ws['!cols'] = Object.keys(data[0] || { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 6) })); return ws; };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([
      ...rows.map((x) => ({ [head]: periodLabel(x.period, group), 'คำสั่งซื้อ': x.orders, 'จำนวนชิ้น': x.items, 'ผู้ซื้อ': x.buyers, 'ยอดขาย (บาท)': x.total })),
      { [head]: 'รวม', 'คำสั่งซื้อ': s.orders, 'จำนวนชิ้น': s.items, 'ผู้ซื้อ': s.buyers, 'ยอดขาย (บาท)': s.total },
    ]), 'สรุป' + REPORT_GROUPS[group]);
    XLSX.utils.book_append_sheet(wb, sheet(r.products.map((p) => ({ 'รหัสสินค้า': p.sku || '', 'สินค้า': p.name, 'หน่วย': p.unit || '', 'จำนวน': p.qty, 'คำสั่งซื้อ': p.orders, 'ยอดขาย (บาท)': p.total }))), 'ตามสินค้า');
    XLSX.utils.book_append_sheet(wb, sheet(r.pickup.map((p) => ({ 'จุดรับสินค้า': p.pickup_point, 'คำสั่งซื้อ': p.orders, 'ยอดขาย (บาท)': p.total }))), 'ตามจุดรับสินค้า');
    XLSX.writeFile(wb, `รายงานยอดขาย${REPORT_GROUPS[group]}_${from}_ถึง_${to}.xlsx`);
  };
}

/* ---------- ปฏิทินเลือกวันที่ภาษาไทย (ชื่อเดือนไทย ปี พ.ศ.) ----------
 * ช่อง <input type="date"> แสดงตามภาษาของเบราว์เซอร์ เลยใช้ตัวนี้แทน
 * ใช้: <span data-thdate="from" data-value="2026-11-01"></span> แล้วเรียก thDatePickers(root)
 *      เพิ่ม data-optional ถ้าเว้นว่างได้ (แสดง "ไม่ระบุ" และมีปุ่มล้าง)
 * ค่าที่ส่งในฟอร์มยังเป็น YYYY-MM-DD (ช่อง hidden ชื่อตาม data-thdate) */
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const thShortDate = (v) => { const [y, m, d] = v.split('-').map(Number); return `${d} ${TH_MONTHS_SHORT[m - 1]} ${y + 543}`; };

function thDatePickers(root = document) {
  if (!document.getElementById('thdp-css')) {
    const st = document.createElement('style');
    st.id = 'thdp-css';
    st.textContent = `.thdp{position:relative;display:inline-block}
.thdp-btn{min-width:150px;justify-content:space-between;gap:8px;display:inline-flex;align-items:center;cursor:pointer;text-align:left}
.thdp-pop{position:absolute;z-index:50;top:calc(100% + 6px);left:0;background:#fff;border:1px solid #e4e1d8;border-radius:12px;box-shadow:0 10px 30px rgba(15,42,92,.18);padding:10px;width:300px}
.thdp-head{display:flex;align-items:center;gap:4px;margin-bottom:8px}
.shop-app .thdp-head select{flex:1 1 auto;min-width:0;width:auto;padding:5px 2px 5px 6px;border:1px solid #e4e1d8;border-radius:8px;font:inherit;font-size:.9rem;background:#fff}
.shop-app .thdp-head select[data-y]{flex:0 0 80px}
.thdp-nav{border:0;background:#f1ede3;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;line-height:1}
.thdp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
.thdp-grid b{font-size:.75rem;color:#6b7486;font-weight:600;padding:4px 0}
.thdp-grid button{border:0;background:none;border-radius:8px;padding:7px 0;cursor:pointer;font:inherit;font-size:.9rem;color:#1d2433}
.thdp-grid button:hover{background:#e8eef9}
.thdp-grid button.sel{background:#0f2a5c;color:#fff}
.thdp-grid button.today{box-shadow:inset 0 0 0 1.5px #c9a227}
.thdp-foot{display:flex;justify-content:space-between;margin-top:8px}
.thdp-foot button{border:0;background:none;color:#1d4185;cursor:pointer;font:inherit;font-size:.85rem;padding:4px 6px}`;
    document.head.appendChild(st);
  }
  root.querySelectorAll('[data-thdate]').forEach((host) => {
    const name = host.dataset.thdate;
    const optional = 'optional' in host.dataset;
    let value = host.dataset.value || (optional ? '' : bkkToday());
    host.className = 'thdp';
    host.innerHTML = `<input type="hidden" name="${esc(name)}" value="${esc(value)}"><button type="button" class="input thdp-btn"><span></span>${icon('calendar')}</button>`;
    const hidden = host.querySelector('input'), btn = host.querySelector('button'), label = btn.querySelector('span');
    const set = (v) => { value = v; hidden.value = v; label.textContent = v ? thShortDate(v) : 'ไม่ระบุ'; label.style.color = v ? '' : 'var(--muted)'; };
    set(value);
    let pop = null, viewY, viewM;
    const close = () => { pop?.remove(); pop = null; document.removeEventListener('mousedown', outside); };
    const outside = (e) => { if (!host.contains(e.target)) close(); };
    const draw = () => {
      const today = bkkToday();
      const first = new Date(Date.UTC(viewY, viewM, 1)).getUTCDay();
      const days = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate();
      const thisYear = Number(today.slice(0, 4));
      const years = [];
      for (let y = thisYear + 20; y >= 2020; y--) years.push(y);
      if (!years.includes(viewY)) years.push(viewY);
      pop.innerHTML = `<div class="thdp-head"><button type="button" class="thdp-nav" data-step="-1" aria-label="เดือนก่อน">‹</button>
          <select data-m>${TH_MONTHS.map((m, i) => `<option value="${i}" ${i === viewM ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select data-y>${years.map((y) => `<option value="${y}" ${y === viewY ? 'selected' : ''}>${y + 543}</option>`).join('')}</select>
          <button type="button" class="thdp-nav" data-step="1" aria-label="เดือนถัดไป">›</button></div>
        <div class="thdp-grid">${TH_WEEKDAYS.map((w) => `<b>${w}</b>`).join('')}${'<span></span>'.repeat(first)}
          ${Array.from({ length: days }, (_, i) => { const v = ymd(viewY, viewM, i + 1); return `<button type="button" data-d="${v}" class="${v === value ? 'sel' : ''} ${v === today ? 'today' : ''}">${i + 1}</button>`; }).join('')}</div>
        <div class="thdp-foot"><button type="button" data-d="${today}">วันนี้</button>${optional ? '<button type="button" data-d="">ล้าง</button>' : ''}<button type="button" data-close>ปิด</button></div>`;
      pop.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => { viewM += Number(b.dataset.step); if (viewM < 0) { viewM = 11; viewY--; } if (viewM > 11) { viewM = 0; viewY++; } draw(); }));
      pop.querySelector('[data-m]').onchange = (e) => { viewM = Number(e.target.value); draw(); };
      pop.querySelector('[data-y]').onchange = (e) => { viewY = Number(e.target.value); draw(); };
      pop.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { set(b.dataset.d); close(); }));
      pop.querySelector('[data-close]').onclick = close;
    };
    btn.onclick = () => {
      if (pop) return close();
      const base = value || bkkToday();
      [viewY, viewM] = [Number(base.slice(0, 4)), Number(base.slice(5, 7)) - 1];
      pop = document.createElement('div');
      pop.className = 'thdp-pop';
      host.appendChild(pop);
      draw();
      // ไม่ให้ล้นขอบจอด้านขวาบนมือถือ
      const r = pop.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) pop.style.left = `${Math.min(0, window.innerWidth - 8 - r.right)}px`;
      document.addEventListener('mousedown', outside);
    };
  });
  refreshIcons();
}

/* ---------- router ---------- */
async function router() {
  const [path, qs] = (location.hash.slice(1) || 'dashboard').split('?');
  const params = new URLSearchParams(qs || '');
  const [k, id] = path.split('/');
  const entry = NAV.find(([key]) => key === k);
  const page = entry && can(entry[3]) ? k : 'dashboard';
  setActive(page);
  loading();
  window.scrollTo(0, 0);
  try {
    if (page === 'orders' && id) await pageOrderDetail(id);
    else await ({ dashboard: pageDashboard, orders: pageOrders, reports: pageReports, products: pageProducts, stock: pageStock, members: pageMembers, roster: pageRoster, staff: pageStaff, settings: pageSettings, security: pageSecurity }[page])(params);
  } catch (e) { fail(e); }
}
function fail(e) {
  // 401 = หลุดจากระบบ/ถูกถอดสิทธิ์ · 403 = ยังเป็นผู้ดูแลแต่สิทธิ์เรื่องนี้ถูกเปลี่ยนไปแล้ว
  if (e.status === 401) return renderLogin(e.message);
  content(`<div class="card empty">${icon('circle-alert')}<div class="head">${esc(e.message)}</div>${e.status === 403 ? '<p class="small muted">หากเพิ่งมีการเปลี่ยนสิทธิ์ กรุณาโหลดหน้าใหม่</p>' : ''}</div>`);
}

async function boot() {
  const { settings } = await API.get('/api/settings').catch(() => ({ settings: {} }));
  A.settings = settings;
  shell();
  await pollStats(true);
  setInterval(() => pollStats(false), 30000);
  window.onhashchange = router;
  router();
}
(async () => {
  const pub = await API.get('/api/settings').catch(() => ({}));
  Object.assign(SEC, pub.security || {});
  try {
    A.user = (await API.get('/api/admin/me')).user;
  } catch (e) {
    return renderLogin(e.status === 403 ? e.message : '');
  }
  if (A.user.must_change) return renderMustChange();
  boot();
})();
