/* หน้าสมาชิกร้านค้าสวัสดิการ (/member) — ตะกร้า สั่งซื้อ ชำระเงิน บัญชีผู้ใช้
 * หน้ารายการสินค้าเป็นหน้า Astro (/shop); ตะกร้าใช้ localStorage คีย์ sao_cart ร่วมกัน */
const state = { user: null, settings: {}, cart: [] };
let pageTimer = null;

/* ---------- cart (เก็บในเครื่องผู้ใช้) ---------- */
function loadCart() { try { state.cart = JSON.parse(localStorage.getItem('sao_cart') || '[]'); } catch { state.cart = []; } }
function saveCart() { try { localStorage.setItem('sao_cart', JSON.stringify(state.cart)); } catch {} renderNav(); }
const cartCount = () => state.cart.reduce((s, i) => s + i.qty, 0);
/** หนึ่งบรรทัดในตะกร้า = สินค้า + แบบย่อย (สี/ไซส์) */
const lineKey = (i) => `${i.id}:${i.variant_id || ''}`;
const lineName = (i) => (i.variant ? `${i.name} (${i.variant})` : i.name);
/* ---------- หน่วยงาน สตง. (dropdown สมัครสมาชิก / ข้อมูลส่วนตัว) ---------- */
const DEPARTMENTS = [
  ["ส่วนกลาง", [
    "สำนักอำนวยการคณะกรรมการตรวจเงินแผ่นดิน",
    "สำนักผู้ว่าการตรวจเงินแผ่นดิน",
    "สำนักวิชาการและให้คำปรึกษาการตรวจเงินแผ่นดิน",
    "สำนักกำกับและส่งเสริมการตรวจเงินแผ่นดิน",
    "สำนักวินัยการเงินการคลัง",
    "สำนักกฎหมาย",
    "สำนักคดี",
    "สำนักการต่างประเทศ",
    "สำนักวิจัย",
    "สำนักนโยบายและแผนการตรวจเงินแผ่นดิน",
    "สำนักประชาสัมพันธ์และสื่อสารองค์กร",
    "สำนักการเงินและการคลัง",
    "สำนักบริหารงานกลาง",
    "สำนักบริหารทรัพยากรบุคคล",
    "สำนักตรวจสอบภายใน",
    "สำนักควบคุมและประกันคุณภาพการตรวจเงินแผ่นดิน",
    "สถาบันพัฒนาการตรวจเงินแผ่นดิน",
    "ศูนย์ดิจิทัลและนวัตกรรมการตรวจเงินแผ่นดิน",
    "สำนักตรวจสอบระบบสารสนเทศ",
    "สำนักตรวจสอบโครงการขนาดใหญ่",
    "สำนักตรวจเงินแผ่นดินที่ 1",
    "สำนักตรวจเงินแผ่นดินที่ 2",
    "สำนักตรวจเงินแผ่นดินที่ 3",
    "สำนักตรวจเงินแผ่นดินที่ 4",
    "สำนักตรวจเงินแผ่นดินที่ 5",
    "สำนักตรวจเงินแผ่นดินที่ 6",
    "สำนักตรวจเงินแผ่นดินที่ 7",
    "สำนักตรวจเงินแผ่นดินที่ 8",
    "สำนักตรวจเงินแผ่นดินที่ 9",
    "สำนักตรวจเงินแผ่นดินที่ 10",
    "สำนักตรวจเงินแผ่นดินที่ 11",
    "สำนักตรวจเงินแผ่นดินที่ 12",
    "สำนักตรวจเงินแผ่นดินที่ 13",
    "สำนักตรวจเงินแผ่นดินที่ 14",
    "สำนักตรวจเงินแผ่นดินที่ 15",
    "สำนักตรวจเงินแผ่นดินที่ 16",
    "สำนักตรวจเงินแผ่นดินที่ 17",
    "สำนักตรวจเงินแผ่นดินที่ 18",
    "สำนักตรวจเงินแผ่นดินที่ 19",
    "สำนักตรวจเงินแผ่นดินที่ 20",
    "สำนักตรวจเงินแผ่นดินที่ 21",
    "สำนักตรวจเงินแผ่นดินที่ 22",
    "สำนักตรวจสอบการปฏิบัติตามกฎหมายที่ 1",
    "สำนักตรวจสอบการปฏิบัติตามกฎหมายที่ 2",
    "สำนักตรวจสอบการปฏิบัติตามกฎหมายที่ 3",
    "สำนักตรวจสอบผลสัมฤทธิ์และประสิทธิภาพการดำเนินงานที่ 1",
    "สำนักตรวจสอบผลสัมฤทธิ์และประสิทธิภาพการดำเนินงานที่ 2",
    "สำนักตรวจสอบผลสัมฤทธิ์และประสิทธิภาพการดำเนินงานที่ 3",
    "สำนักตรวจสอบผลสัมฤทธิ์และประสิทธิภาพการดำเนินงานที่ 4",
    "สำนักตรวจสอบผลสัมฤทธิ์และประสิทธิภาพการดำเนินงานที่ 5",
  ]],
  ["ส่วนภูมิภาค", [
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 1",
    "สำนักตรวจเงินแผ่นดินจังหวัดพระนครศรีอยุธยา",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครนายก",
    "สำนักตรวจเงินแผ่นดินจังหวัดสระบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดปราจีนบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดลพบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดอ่างทอง",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 2",
    "สำนักตรวจเงินแผ่นดินจังหวัดชลบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดฉะเชิงเทรา",
    "สำนักตรวจเงินแผ่นดินจังหวัดจันทบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดระยอง",
    "สำนักตรวจเงินแผ่นดินจังหวัดตราด",
    "สำนักตรวจเงินแผ่นดินจังหวัดสระแก้ว",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 3",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครปฐม",
    "สำนักตรวจเงินแผ่นดินจังหวัดนนทบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดสุพรรณบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรปราการ",
    "สำนักตรวจเงินแผ่นดินจังหวัดปทุมธานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรสาคร",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 4",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครราชสีมา",
    "สำนักตรวจเงินแผ่นดินจังหวัดชัยภูมิ",
    "สำนักตรวจเงินแผ่นดินจังหวัดบุรีรัมย์",
    "สำนักตรวจเงินแผ่นดินจังหวัดสุรินทร์",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 5",
    "สำนักตรวจเงินแผ่นดินจังหวัดอุบลราชธานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดอำนาจเจริญ",
    "สำนักตรวจเงินแผ่นดินจังหวัดศรีสะเกษ",
    "สำนักตรวจเงินแผ่นดินจังหวัดยโสธร",
    "สำนักตรวจเงินแผ่นดินจังหวัดมุกดาหาร",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครพนม",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 6",
    "สำนักตรวจเงินแผ่นดินจังหวัดอุดรธานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดหนองบัวลำภู",
    "สำนักตรวจเงินแผ่นดินจังหวัดสกลนคร",
    "สำนักตรวจเงินแผ่นดินจังหวัดหนองคาย",
    "สำนักตรวจเงินแผ่นดินจังหวัดบึงกาฬ",
    "สำนักตรวจเงินแผ่นดินจังหวัดเลย",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 7",
    "สำนักตรวจเงินแผ่นดินจังหวัดขอนแก่น",
    "สำนักตรวจเงินแผ่นดินจังหวัดกาฬสินธุ์",
    "สำนักตรวจเงินแผ่นดินจังหวัดร้อยเอ็ด",
    "สำนักตรวจเงินแผ่นดินจังหวัดมหาสารคาม",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 8",
    "สำนักตรวจเงินแผ่นดินจังหวัดเชียงใหม่",
    "สำนักตรวจเงินแผ่นดินจังหวัดลำพูน",
    "สำนักตรวจเงินแผ่นดินจังหวัดเชียงราย",
    "สำนักตรวจเงินแผ่นดินจังหวัดแม่ฮ่องสอน",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 9",
    "สำนักตรวจเงินแผ่นดินจังหวัดลำปาง",
    "สำนักตรวจเงินแผ่นดินจังหวัดน่าน",
    "สำนักตรวจเงินแผ่นดินจังหวัดแพร่",
    "สำนักตรวจเงินแผ่นดินจังหวัดพะเยา",
    "สำนักตรวจเงินแผ่นดินจังหวัดอุตรดิตถ์",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 10",
    "สำนักตรวจเงินแผ่นดินจังหวัดพิษณุโลก",
    "สำนักตรวจเงินแผ่นดินจังหวัดสุโขทัย",
    "สำนักตรวจเงินแผ่นดินจังหวัดตาก",
    "สำนักตรวจเงินแผ่นดินจังหวัดเพชรบูรณ์",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 11",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครสวรรค์",
    "สำนักตรวจเงินแผ่นดินจังหวัดกำแพงเพชร",
    "สำนักตรวจเงินแผ่นดินจังหวัดชัยนาท",
    "สำนักตรวจเงินแผ่นดินจังหวัดอุทัยธานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดพิจิตร",
    "สำนักตรวจเงินแผ่นดินจังหวัดสิงห์บุรี",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 12",
    "สำนักตรวจเงินแผ่นดินจังหวัดเพชรบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดประจวบคีรีขันธ์",
    "สำนักตรวจเงินแผ่นดินจังหวัดราชบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดกาญจนบุรี",
    "สำนักตรวจเงินแผ่นดินจังหวัดสมุทรสงคราม",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 13",
    "สำนักตรวจเงินแผ่นดินจังหวัดสุราษฎร์ธานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดพังงา",
    "สำนักตรวจเงินแผ่นดินจังหวัดภูเก็ต",
    "สำนักตรวจเงินแผ่นดินจังหวัดระนอง",
    "สำนักตรวจเงินแผ่นดินจังหวัดชุมพร",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 14",
    "สำนักตรวจเงินแผ่นดินจังหวัดนครศรีธรรมราช",
    "สำนักตรวจเงินแผ่นดินจังหวัดกระบี่",
    "สำนักตรวจเงินแผ่นดินจังหวัดตรัง",
    "สำนักตรวจเงินแผ่นดินจังหวัดพัทลุง",
    "สำนักงานการตรวจเงินแผ่นดินภูมิภาคที่ 15",
    "สำนักตรวจเงินแผ่นดินจังหวัดสงขลา",
    "สำนักตรวจเงินแผ่นดินจังหวัดปัตตานี",
    "สำนักตรวจเงินแผ่นดินจังหวัดสตูล",
    "สำนักตรวจเงินแผ่นดินจังหวัดยะลา",
    "สำนักตรวจเงินแผ่นดินจังหวัดนราธิวาส",
  ]],
];
/** ช่อง "สำนัก" แบบพิมพ์ค้นหาได้ — ค่าที่ส่งอยู่ใน hidden input name="department"
 * เลือกได้เฉพาะชื่อในรายการ (หรือเว้นว่าง); ค่าเดิมที่ไม่อยู่ในรายการ (สมัครก่อนมี dropdown) ยังคงไว้ */
function departmentPicker(current = '', required = false) {
  return `<div class="field full dept-field">
    <span id="dept-label">สำนัก <span class="muted" style="font-weight:400">(สำนักตามมอบหมายงาน)</span>${required ? ' <em>*</em>' : ''}</span>
    <div class="dept-combo">
      <input type="text" class="dept-search" role="combobox" aria-labelledby="dept-label" aria-autocomplete="list"
        aria-expanded="false" aria-controls="dept-list" autocomplete="off" spellcheck="false"
        placeholder="พิมพ์ค้นหา หรือเลือกสำนัก" value="${esc(current)}"${required ? ' aria-required="true"' : ''}>
      <input type="hidden" name="department" value="${esc(current)}">
      <ul class="dept-list" id="dept-list" role="listbox" aria-labelledby="dept-label" hidden></ul>
    </div>
  </div>`;
}
function mountDepartmentPicker(form) {
  const box = form.querySelector('.dept-combo');
  if (!box) return;
  const input = box.querySelector('.dept-search');
  const hidden = box.querySelector('[name=department]');
  const list = box.querySelector('.dept-list');
  const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
  const all = DEPARTMENTS.flatMap(([, items]) => items);
  let shown = [];
  let active = -1;

  const setActive = (i) => {
    active = i;
    list.querySelectorAll('[role=option]').forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    const li = list.querySelector(`#dept-opt-${i}`);
    if (li) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    // ข้อความเท่ากับค่าที่เลือกอยู่ = ยังไม่ได้พิมพ์ค้นหา → แสดงทั้งหมด
    const q = input.value === hidden.value ? '' : norm(input.value);
    shown = [];
    let html = '';
    for (const [group, items] of DEPARTMENTS) {
      const hit = !q || norm(group).includes(q) ? items : items.filter((v) => norm(v).includes(q));
      if (!hit.length) continue;
      html += `<li class="dept-group" role="presentation">${esc(group)}</li>`;
      for (const v of hit) {
        html += `<li role="option" id="dept-opt-${shown.length}" data-i="${shown.length}" aria-selected="false">${esc(v)}</li>`;
        shown.push(v);
      }
    }
    list.innerHTML = html || '<li class="dept-empty" role="presentation">ไม่พบสำนักที่ค้นหา</li>';
    const cur = shown.indexOf(hidden.value);
    setActive(cur >= 0 ? cur : q ? 0 : -1);
  };
  const open = () => { if (list.hidden) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } render(); };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const choose = (v) => { hidden.value = v; input.value = v; close(); };

  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', open);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) return open();
      if (!shown.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0 ? (step > 0 ? 0 : shown.length - 1) : (active + step + shown.length) % shown.length);
    } else if (e.key === 'Enter' && !list.hidden) {
      e.preventDefault(); // ไม่ส่งฟอร์มขณะกำลังเลือก
      if (active >= 0) choose(shown[active]);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault(); input.value = hidden.value; close();
    }
  });
  // mousedown + preventDefault: เลือกได้ก่อนช่องค้นหาเสีย focus
  list.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const li = e.target.closest('[role=option]');
    if (li) choose(shown[+li.dataset.i]);
  });
  input.addEventListener('blur', () => {
    const t = input.value.trim();
    if (!t) hidden.value = '';
    else if (all.includes(t)) hidden.value = t;
    input.value = hidden.value; // พิมพ์ไม่ครบ/ไม่ตรงรายการ → กลับเป็นค่าที่เลือกไว้
    close();
  });
}
/* ---------- shell ---------- */
const accountBar = () => (state.user ? `<nav class="account-bar" aria-label="บัญชีของฉัน">
    <a class="btn btn-light btn-sm" href="#/cart">${icon('shopping-cart')} ตะกร้าสินค้า${cartCount() ? ` <span class="cart-pill">${cartCount()}</span>` : ''}</a>
    <a class="btn btn-light btn-sm" href="#/orders">${icon('receipt-text')} คำสั่งซื้อของฉัน</a>
    <a class="btn btn-light btn-sm" href="#/profile">${icon('user-round')} ข้อมูลส่วนตัว</a>
    <button type="button" class="btn btn-light btn-sm" data-logout>${icon('log-out')} ออกจากระบบ</button>
  </nav>` : '');
const view = (html) => { $('#app').innerHTML = accountBar() + html; refreshIcons(); };
function renderNav() {
  window.dispatchEvent(new CustomEvent('shop:changed', { detail: { user: state.user, count: cartCount() } }));
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) {
    await API.post('/api/auth/logout').catch(() => {});
    state.user = null; renderNav(); toast('ออกจากระบบแล้ว');
    if (location.hash.startsWith('#/login')) router(); else location.hash = '#/login';
  }
});
function requireLogin(next) {
  if (state.user) return true;
  location.hash = `#/login?next=${encodeURIComponent(next)}`;
  toast('กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนสั่งซื้อ');
  return false;
}

async function refreshCartFromServer() {
  if (!state.cart.length) return [];
  const { products } = await API.get(`/api/products?ids=${state.cart.map((i) => i.id).join(',')}`);
  const map = new Map(products.map((p) => [p.id, p]));
  const notes = [];
  state.cart = state.cart.filter((i) => {
    const p = map.get(i.id);
    if (!p) { notes.push(`"${lineName(i)}" ไม่มีจำหน่ายแล้ว จึงนำออกจากตะกร้า`); return false; }
    // สินค้าที่แยกสี/ไซส์ ใช้สต็อกของแบบที่เลือก
    let stock = p.stock, variant = null;
    if (p.variants?.length) {
      const v = p.variants.find((x) => x.id === Number(i.variant_id));
      if (!v) { notes.push(`"${p.name}" กรุณาเลือกสี/ไซส์ใหม่ จึงนำออกจากตะกร้า`); return false; }
      stock = v.stock; variant = v.label;
    } else if (i.variant_id) { i.variant_id = null; }
    const label = variant ? `${p.name} (${variant})` : p.name;
    if (stock <= 0) { notes.push(`"${label}" สินค้าหมด จึงนำออกจากตะกร้า`); return false; }
    if (i.qty > stock) { notes.push(`"${label}" เหลือเพียง ${stock} ${p.unit} ปรับจำนวนให้แล้ว`); i.qty = stock; }
    if (i.price !== p.price) notes.push(`"${label}" ราคาเปลี่ยนเป็น ${baht(p.price)}`);
    Object.assign(i, { price: p.price, tiers: p.tiers || [], bundles: p.bundles || [], name: p.name, slug: p.slug, stock, unit: p.unit, variant });
    delete i.bulk_qty; delete i.bulk_price; // รูปแบบเก่า (ขั้นเดียว) ใช้ tiers แทนแล้ว
    return true;
  });
  saveCart();
  return notes;
}
/* ราคาตามจำนวน (ขั้นบันได): นับรวมทุกสี/ไซส์ของสินค้าเดียวกัน ซื้อถึงขั้นไหน ทุกชิ้นได้ราคาขั้นนั้น
 * i.tiers = [{qty, price}] จาก API (เรียงจำนวนน้อยไปมาก) — กติกาเดียวกับ src/shop/pricing.js (unitPrice)
 * เซิร์ฟเวอร์คำนวณซ้ำตอนสั่งซื้อเสมอ ต้องแก้คู่กัน */
const productQty = (id) => state.cart.reduce((s, x) => s + (x.id === id ? x.qty : 0), 0);
const tiersOf = (i) => (Array.isArray(i.tiers) ? i.tiers : []);
const tierFor = (i) => tiersOf(i).reduce((hit, t) => (productQty(i.id) >= t.qty ? t : hit), null);
const bulkReached = (i) => !!tierFor(i);
const unitPriceOf = (i) => tierFor(i)?.price ?? i.price;
/* ราคาแบบชุด (เช่น 3 ชิ้น 100): จัดชุดจากจำนวนรวมของสินค้าให้ราคาถูกที่สุด แล้วแบ่งยอดให้แต่ละสี/ไซส์ตามจำนวน
 * กติกาเดียวกับ bundlePlan / POST /orders ใน src/shop — ต้องแก้คู่กัน */
function bundlePlan(unit, bundles, qty) {
  const u = Math.round(Number(unit) * 100), cost = [0], pick = [-1];
  for (let n = 1; n <= qty; n++) {
    let best = cost[n - 1] + u, how = -1;
    bundles.forEach((b, k) => { if (b.qty <= n) { const c = cost[n - b.qty] + Math.round(b.total * 100); if (c < best) { best = c; how = k; } } });
    cost.push(best); pick.push(how);
  }
  const counts = new Map(); let singles = 0;
  for (let n = qty; n > 0;) { const h = pick[n]; if (h < 0) { singles++; n--; } else { counts.set(h, (counts.get(h) || 0) + 1); n -= bundles[h].qty; } }
  return { total: cost[qty] / 100, singles, parts: [...counts].map(([k, count]) => ({ ...bundles[k], count })).sort((a, b) => b.qty - a.qty) };
}
const bundlesOf = (i) => (Array.isArray(i.bundles) ? i.bundles : []);
const planOf = (i) => bundlePlan(unitPriceOf(i), bundlesOf(i), productQty(i.id));
/** ยอดของรายการ: ไม่มีราคาชุด = ราคาต่อชิ้น × จำนวน · มีราคาชุด = แบ่งยอดรวมของสินค้าตามสัดส่วน (รายการสุดท้ายรับเศษ) */
function lineTotal(i) {
  if (!bundlesOf(i).length) return unitPriceOf(i) * i.qty;
  const same = state.cart.filter((x) => x.id === i.id);
  let left = planOf(i).total, qLeft = productQty(i.id);
  for (const x of same) {
    const lt = x.qty === qLeft ? Math.round(left * 100) / 100 : Math.round((left * x.qty / qLeft) * 100) / 100;
    if (x === i) return lt;
    left -= lt; qLeft -= x.qty;
  }
  return unitPriceOf(i) * i.qty;
}
/** "ชุด 3 ชิ้น ฿100 + 1 ชิ้น ชิ้นละ ฿50" */
function planText(i) {
  const pl = planOf(i);
  if (!pl.parts.length) return '';
  const u = i.unit || 'ชิ้น';
  const parts = pl.parts.map((b) => `ชุด ${num(b.qty)} ${u} ${baht(b.total)}${b.count > 1 ? ` ×${b.count}` : ''}`);
  if (pl.singles) parts.push(`${num(pl.singles)} ${u} ${u}ละ ${baht(unitPriceOf(i))}`);
  return parts.join(' + ');
}
/** ข้อความโปรโมชั่นแบบชุดในตะกร้า (แสดงครั้งเดียวต่อสินค้า ที่รายการแรกของสินค้านั้น) */
const bundleNote = (i) => {
  const bs = bundlesOf(i);
  if (!bs.length || state.cart.find((x) => x.id === i.id) !== i) return '';
  const qty = productQty(i.id), txt = planText(i), next = bs.find((b) => b.qty > qty);
  const got = txt ? `<div class="small" style="color:var(--ok)">ได้ราคาโปรโมชั่น: ${esc(txt)}${state.cart.filter((x) => x.id === i.id).length > 1 ? ' (รวมทุกสี/ไซส์)' : ''}</div>` : '';
  const more = !txt && next ? `<div class="small" style="color:#9a3412">ซื้อครบ ${num(next.qty)} ${esc(i.unit)} ราคา ${baht(next.total)} (ซื้อเพิ่มอีก ${num(next.qty - qty)} ${esc(i.unit)})</div>` : '';
  return got + more;
};
/** ข้อความใต้สินค้าในตะกร้า: ได้ราคาขั้นไหนแล้ว / ซื้อเพิ่มอีกกี่ชิ้นถึงขั้นถัดไป */
const bulkNote = (i) => {
  const tiers = tiersOf(i);
  if (!tiers.length) return '';
  const qty = productQty(i.id), hit = tierFor(i), next = tiers.find((t) => t.qty > qty);
  const got = hit ? `<div class="small" style="color:var(--ok)">ได้ราคาพิเศษ ${baht(hit.price)} / ${esc(i.unit)} (ซื้อครบ ${num(hit.qty)})</div>` : '';
  const more = next ? `<div class="small" style="color:#9a3412">ซื้อเพิ่มอีก ${num(next.qty - qty)} ${esc(i.unit)} ได้ราคา ${esc(i.unit)}ละ ${baht(next.price)}</div>` : '';
  return got + more;
};
const cartSubtotal = () => state.cart.reduce((s, i) => s + lineTotal(i), 0);

async function pageCart() {
  const notes = await refreshCartFromServer();
  if (!state.cart.length) {
    return view(`<div class="card empty">${icon('shopping-cart')}<div class="head" style="font-size:1.2rem">ตะกร้าของคุณยังว่างอยู่</div><p>เลือกสินค้าที่ต้องการแล้วกด “หยิบใส่ตะกร้า”</p><a class="btn btn-primary" href="/shop">เลือกซื้อสินค้า</a></div>`);
  }
  view(`<div class="page-title"><h1>ตะกร้าสินค้า</h1></div>
    ${notes.length ? `<div class="alert alert-warn" style="margin-bottom:14px">${icon('info')}<div>${notes.map(esc).join('<br>')}</div></div>` : ''}
    <div class="grid-2">
      <div class="card">${state.cart.map((i) => `
        <div class="cart-line">
          <a class="thumb" href="/shop/${esc(i.slug)}"><img src="${productImg(i)}" alt=""></a>
          <div><a class="head" style="font-weight:500;font-size:1rem;color:var(--text)" href="/shop/${esc(i.slug)}">${esc(i.name)}</a>
            ${i.variant ? `<div class="small"><span class="badge st-preparing">${esc(i.variant)}</span></div>` : ''}
            <div class="small muted">${bulkReached(i) ? `<s>${baht(i.price)}</s> ${baht(unitPriceOf(i))}` : baht(i.price)} / ${esc(i.unit)} · คงเหลือ ${num(i.stock)}</div>${bulkNote(i)}${bundleNote(i)}</div>
          <div class="line-end row" style="gap:14px">
            <div class="qty"><button data-dec="${esc(lineKey(i))}">−</button><input type="number" data-set="${esc(lineKey(i))}" value="${i.qty}" min="1" max="${i.stock}"><button data-inc="${esc(lineKey(i))}">+</button></div>
            <b class="mono" style="min-width:90px;text-align:right">${baht(lineTotal(i))}</b>
            <button class="x-btn" data-rm="${esc(lineKey(i))}" title="ลบ">${icon('trash-2')}</button>
          </div>
        </div>`).join('')}</div>
      <div class="card card-pad">
        <h3 style="margin-bottom:10px">สรุปคำสั่งซื้อ</h3>
        <div class="summary-row"><span>จำนวนสินค้า</span><span>${num(cartCount())} ชิ้น</span></div>
        <div class="summary-row total"><span>ยอดรวม</span><span>${baht(cartSubtotal())}</span></div>
        <a class="btn btn-gold btn-lg btn-block" style="margin-top:16px" href="#/checkout">${icon('credit-card')} ดำเนินการสั่งซื้อ</a>
        <a class="btn btn-light btn-block" style="margin-top:10px" href="/shop">เลือกซื้อสินค้าต่อ</a>
      </div>
    </div>`);
  const setQty = (key, q) => {
    const i = state.cart.find((x) => lineKey(x) === key);
    if (!i) return;
    if (q > i.stock) { toast(`มีสินค้าคงเหลือเพียง ${i.stock} ${i.unit}`, 'bad'); q = i.stock; }
    i.qty = Math.max(1, q);
    saveCart(); pageCart();
  };
  $('#app').onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inc) setQty(t.dataset.inc, state.cart.find((x) => lineKey(x) === t.dataset.inc).qty + 1);
    if (t.dataset.dec) setQty(t.dataset.dec, state.cart.find((x) => lineKey(x) === t.dataset.dec).qty - 1);
    if (t.dataset.rm) { state.cart = state.cart.filter((x) => lineKey(x) !== t.dataset.rm); saveCart(); pageCart(); }
  };
  $$('[data-set]').forEach((inp) => (inp.onchange = () => setQty(inp.dataset.set, parseInt(inp.value) || 1)));
}

async function pageCheckout() {
  if (!requireLogin('#/checkout')) return;
  await refreshCartFromServer();
  if (!state.cart.length) { location.hash = '#/cart'; return; }
  const s = state.settings, u = state.user;
  let lastPoint = '';
  try { lastPoint = localStorage.getItem('sao_pickup') || ''; } catch {}
  view(`<div class="page-title"><h1>ยืนยันการสั่งซื้อ</h1></div>
    <form class="grid-2" id="co">
      <div class="stack">
        <div class="card card-pad stack">
          <h3>${icon('map-pin')} จุดรับสินค้า</h3>
          <div class="small muted">ไม่มีบริการจัดส่งถึงบ้าน · บุคลากรส่วนกลางรับที่สวัสดิการ สตง. · บุคลากรส่วนภูมิภาคเลือกสำนักงานของตน (ส่งทางไปรษณีย์)</div>
          <label class="field"><span>เลือกจุดรับสินค้า <em>*</em></span><select class="input" name="pickup_point" required>
            <option value="">— เลือกจุดรับสินค้า —</option>
            ${pickupOptions(PICKUP_POINTS.includes(lastPoint) ? lastPoint : '')}
          </select></label>
          <div class="regional-note" id="regional-note" hidden>${icon('mailbox')}<div><b>รับสินค้าที่ส่วนภูมิภาค: สินค้าจะส่งทางไปรษณีย์</b><br>คุณต้อง<b>ชำระค่าส่งไปรษณีย์เพิ่ม</b>หลังจากได้รับสินค้าแล้ว ผู้ส่งสินค้าจะแจ้งยอดพร้อมใบเสร็จไปรษณีย์ในหน้าคำสั่งซื้อ ให้โอนเข้าบัญชีของผู้ส่งสินค้า (แยกจากบัญชีร้านค้าสวัสดิการ) แล้วแนบสลิป</div></div>
          ${s.pickup_location ? `<div class="small muted">${esc(s.pickup_location)}</div>` : ''}
        </div>
        <div class="card card-pad">
          <h3 style="margin-bottom:14px">${icon('user-round')} ข้อมูลผู้รับ</h3>
          <div class="form-grid">
            <label class="field"><span>ชื่อผู้รับ <em>*</em></span><input name="recipient_name" required value="${esc(u.name)}"></label>
            <label class="field"><span>เบอร์โทรศัพท์ <em>*</em></span><input name="phone" required inputmode="tel" value="${esc(u.phone)}"></label>
            <label class="field full"><span>หมายเหตุถึงเจ้าหน้าที่</span><textarea name="note" placeholder="เช่น ไซซ์เสื้อ สีที่ต้องการ หรือช่วงเวลาที่สะดวกรับ"></textarea></label>
          </div>
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:10px">รายการสินค้า</h3>
        ${state.cart.map((i) => `<div class="summary-row"><span>${esc(lineName(i))} × ${i.qty}${bulkReached(i) ? ` <span class="small" style="color:var(--ok)">(ราคาพิเศษ ${baht(unitPriceOf(i))})</span>` : ''}${bundleNote(i) && planText(i) ? `<div class="small" style="color:var(--ok)">โปรโมชั่น: ${esc(planText(i))}</div>` : ''}</span><span class="mono">${baht(lineTotal(i))}</span></div>`).join('')}
        <div class="hr"></div>
        <div class="summary-row"><span>รวมค่าสินค้า</span><span>${baht(cartSubtotal())}</span></div>
        <div class="summary-row total"><span>ยอดที่ต้องชำระ</span><span id="grand">${baht(cartSubtotal())}</span></div>
        <div class="alert alert-info small" style="margin-top:14px">${icon('info')}<div>หลังกดยืนยัน ระบบจะแสดง QR พร้อมเพย์ / เลขบัญชีสำหรับโอนเงิน และให้แนบสลิป ${u.email.includes('@') ? `ระบบจะแจ้งสถานะไปที่ <b>${esc(u.email)}</b>` : 'ติดตามสถานะได้ที่เมนู “คำสั่งซื้อของฉัน”'}</div></div>
        <button class="btn btn-gold btn-lg btn-block" style="margin-top:16px" type="submit">${icon('check')} ยืนยันการสั่งซื้อ</button>
      </div>
    </form>`);
  const form = $('#co');
  // แสดงหมายเหตุค่าส่งไปรษณีย์เมื่อเลือกรับที่ส่วนภูมิภาค
  const showRegional = () => { $('#regional-note').hidden = !isRegionalPickup(form.pickup_point.value); };
  form.pickup_point.addEventListener('change', showRegional);
  showRegional();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    if (isRegionalPickup(fd.pickup_point) && !(await confirmBox('รับสินค้าที่ส่วนภูมิภาค: สินค้าจะส่งทางไปรษณีย์ และคุณต้องชำระค่าส่งไปรษณีย์เพิ่มหลังจากได้รับสินค้าแล้ว ยืนยันการสั่งซื้อ?', 'ยืนยันการสั่งซื้อ'))) return;
    try { localStorage.setItem('sao_pickup', fd.pickup_point); } catch {}
    const btn = form.querySelector('[type=submit]');
    await withBusy(btn, async () => {
      try {
        const { order } = await API.post('/api/orders', { ...fd, items: state.cart.map((i) => ({ product_id: i.id, variant_id: i.variant_id || null, qty: i.qty })) });
        state.cart = []; saveCart();
        toast('สั่งซื้อเรียบร้อย กรุณาชำระเงิน', 'ok');
        location.hash = `#/order/${order.order_no}`;
      } catch (err) { toast(err.message, 'bad'); if (err.status === 409) setTimeout(() => (location.hash = '#/cart'), 1200); }
    });
  };
}

function timeline(o) {
  const status = o.status;
  if (status === 'cancelled') return '';
  const steps = flowFor(o);
  const idx = steps.indexOf(status);
  return `<div class="timeline">${steps.map((s, i) => `<div class="tl-step ${i < idx || status === 'completed' ? 'done' : i === idx ? 'current' : ''}">
      <div class="tl-dot">${icon(i < idx || status === 'completed' ? 'check' : STATUS[s].icon)}</div>${esc(statusLabelFor(o, s))}</div>`).join('')}</div>`;
}

/** QR ที่หน้าชำระเงินจะแสดง: โหมดทดสอบใช้ข้อความธรรมดา (สแกนได้ แต่แอปธนาคารจะไม่รับเป็นการโอน) */
// ASCII only: qrcode.min.js 1.0.0 miscounts Thai (UTF-8) text and throws "code length overflow"
const payQrText = (o) => (SEC.payment_demo ? `TEST ONLY - NOT A REAL PAYMENT - SAO Welfare Shop - Order ${o.order_no}` : state.settings.promptpay_id ? promptPayPayload(state.settings.promptpay_id, o.total) : null);
function paymentPanel(o) {
  const s = state.settings;
  const payload = payQrText(o);
  const qr = !payload ? ''
    : SEC.payment_demo ? `<div class="qr-frame"><div class="pp-head" style="background:#8a6c12">QR ตัวอย่าง · ระบบทดสอบ</div><div id="qr"></div><div class="small muted" style="margin-top:8px">ใช้ทดลองเท่านั้น สแกนแล้วจะเห็นข้อความ “TEST ONLY - NOT A REAL PAYMENT” แอปธนาคารจะไม่รับเป็นการโอน</div></div>`
    : `<div class="qr-frame"><div class="pp-head">PromptPay · พร้อมเพย์</div><div id="qr"></div><div class="small muted" style="margin-top:8px">สแกนด้วยแอปธนาคารใดก็ได้</div></div>`;
  const bank = [
    s.bank_name && `<div class="bank-line"><span class="muted">ธนาคาร</span><b>${esc(s.bank_name)}</b></div>`,
    s.bank_account_no && `<div class="bank-line"><span class="muted">เลขที่บัญชี</span><span class="row" style="gap:6px"><b class="mono" style="font-size:1.1rem">${esc(s.bank_account_no)}</b><button type="button" class="btn btn-light btn-xs" data-copy="${esc(s.bank_account_no.replace(/\D/g, ''))}">${icon('copy')} คัดลอก</button></span></div>`,
    s.bank_account_name && `<div class="bank-line"><span class="muted">ชื่อบัญชี</span><b>${esc(s.bank_account_name)}</b></div>`,
    s.promptpay_id && `<div class="bank-line"><span class="muted">พร้อมเพย์</span><b class="mono">${esc(s.promptpay_id)}</b></div>`,
  ].filter(Boolean).join('');
  return `<div class="card card-pad stack" id="pay">
    <h3>${icon('qr-code')} ชำระเงิน</h3>
    ${o.status === 'verifying' ? `<div class="alert alert-ok">${icon('clock-4')}<div>ได้รับสลิปแล้ว เจ้าหน้าที่กำลังตรวจสอบ หากแนบผิด สามารถแนบใหม่ได้ด้านล่าง</div></div>` : ''}
    <div class="pay-box">
      ${qr}
      <div class="stack">
        <div><div class="muted small">ยอดที่ต้องชำระ</div><div class="amount-big">${baht(o.total)}</div></div>
        ${SEC.payment_demo ? `<div class="alert alert-warn small">${icon('flask-conical')}<div><b>ระบบอยู่ระหว่างทดสอบ ยังไม่รับชำระเงินจริง</b><br>ไม่ต้องโอนเงิน ทดลองแนบรูปใดก็ได้แทนสลิปเพื่อดูขั้นตอนถัดไป</div></div>`
          : bank || (!qr ? '<div class="alert alert-warn">ร้านยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาติดต่อเจ้าหน้าที่</div>' : '')}
      </div>
    </div>
    <form id="slip-form" class="stack">
      <label class="upload-drop"><input type="file" name="slip" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden>
        <div id="slip-ph">${icon('image-up')}<div><b>แตะเพื่อแนบรูปสลิปการโอนเงิน</b></div><div class="small muted">เฉพาะไฟล์ JPG / PNG · ระบบจะย่อรูปให้ไม่เกิน 1.5 MB อัตโนมัติ</div></div>
        <img id="slip-prev" hidden alt="">
      </label>
      <label class="field"><span>หมายเหตุ (ถ้ามี)</span><input name="note" placeholder="เช่น โอนจากบัญชีชื่อ… เวลา…"></label>
      <button class="btn btn-primary btn-lg btn-block" type="submit" disabled>${icon('send')} ส่งสลิปการชำระเงิน</button>
    </form>
  </div>`;
}

/** ค่าส่งไปรษณีย์ (รับที่ส่วนภูมิภาค): ยอด ใบเสร็จไปรษณีย์ บัญชีผู้ส่งสินค้า และฟอร์มแนบสลิป */
function postagePanel(o) {
  const verifying = o.status === 'postage_verifying';
  const rejected = o.status === 'postage_due' && o.logs.length && /สลิปค่าส่งไม่ถูกต้อง/.test(o.logs[o.logs.length - 1].note || '') ? o.logs[o.logs.length - 1] : null;
  return `<div class="card card-pad stack" id="postage">
    <h3>${icon('mailbox')} ชำระค่าส่งไปรษณีย์</h3>
    ${verifying ? `<div class="alert alert-ok">${icon('clock-4')}<div>ส่งสลิปค่าส่งแล้ว รอผู้ส่งสินค้ายืนยันการรับเงิน หากแนบผิด สามารถแนบใหม่ได้ด้านล่าง</div></div>` : ''}
    ${rejected ? `<div class="alert alert-bad">${icon('triangle-alert')}<div><b>สลิปค่าส่งยังไม่ผ่าน:</b> ${esc(rejected.note.replace(/^สลิปค่าส่งไม่ถูกต้อง:\s*/, ''))} — กรุณาแนบสลิปใหม่</div></div>` : ''}
    <div class="regional-note">${icon('info')}<div>ค่าส่งไปรษณีย์โอนเข้า<b>บัญชีของผู้ส่งสินค้า</b> ซึ่งแยกจากบัญชีร้านค้าสวัสดิการ</div></div>
    <div><div class="muted small">ยอดค่าส่งไปรษณีย์ที่ต้องชำระ</div><div class="amount-big">${baht(o.postage_amount)}</div></div>
    <div><div class="muted small">โอนเข้าบัญชี</div><div style="white-space:pre-line"><b>${esc(o.postage_account || '-')}</b></div></div>
    ${o.has_postage_receipt ? `<a class="btn btn-light btn-sm" href="/api/shop/orders/${o.id}/postage-receipt" target="_blank">${icon('receipt')} ดูใบเสร็จค่าส่งไปรษณีย์</a>` : ''}
    <form id="postage-form" class="stack">
      <label class="upload-drop"><input type="file" name="slip" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden>
        <div id="postage-ph">${icon('image-up')}<div><b>แตะเพื่อแนบรูปสลิปค่าส่งไปรษณีย์</b></div><div class="small muted">เฉพาะไฟล์ JPG / PNG · ระบบจะย่อรูปให้อัตโนมัติ</div></div>
        <img id="postage-prev" hidden alt="">
      </label>
      <label class="field"><span>หมายเหตุ (ถ้ามี)</span><input name="note" placeholder="เช่น โอนจากบัญชีชื่อ… เวลา…"></label>
      <button class="btn btn-primary btn-lg btn-block" type="submit" disabled>${icon('send')} ส่งสลิปค่าส่งไปรษณีย์</button>
    </form>
  </div>`;
}

async function pageOrder(no) {
  if (!requireLogin(`#/order/${no}`)) return;
  const { order: o } = await API.get(`/api/orders/${encodeURIComponent(no)}`);
  const canPay = ['pending_payment', 'verifying'].includes(o.status);
  const payPostage = o.is_regional && ['postage_due', 'postage_verifying'].includes(o.status);
  const rejected = o.status === 'pending_payment' && o.logs.length > 1 && o.logs[o.logs.length - 1].status === 'pending_payment' ? o.logs[o.logs.length - 1] : null;
  view(`<p><a href="#/orders">${icon('arrow-left')} คำสั่งซื้อทั้งหมด</a></p>
    <div class="card" style="margin-bottom:20px">
      <div class="card-head"><div><div class="small muted">เลขที่คำสั่งซื้อ</div><h2 class="mono">${esc(o.order_no)}</h2><div class="small muted">สั่งเมื่อ ${thDate(o.created_at)}</div></div>${statusBadge(o.status, o)}</div>
      ${o.status === 'cancelled' ? `<div class="card-pad"><div class="alert alert-bad">${icon('circle-x')}<div>คำสั่งซื้อนี้ถูกยกเลิกแล้ว ${esc(o.logs[o.logs.length - 1]?.note || '')}</div></div></div>` : timeline(o)}
      ${rejected?.note ? `<div class="card-pad" style="padding-top:0"><div class="alert alert-bad">${icon('triangle-alert')}<div><b>สลิปยังไม่ผ่านการตรวจสอบ:</b> ${esc(rejected.note)} — กรุณาแนบสลิปใหม่</div></div></div>` : ''}
      ${o.status === 'shipped' ? `<div class="card-pad" style="padding-top:0"><div class="alert alert-ok">${icon('truck')}<div>${o.is_regional ? `ส่งสินค้าทางไปรษณีย์ไปที่ <b>${esc(o.pickup_point)}</b> แล้ว · เมื่อได้รับสินค้า ผู้ส่งสินค้าจะยืนยันการรับ แล้วแจ้งยอดค่าส่งไปรษณีย์ในหน้านี้` : o.delivery_method === 'pickup' ? `สินค้าพร้อมให้รับแล้ว ที่ <b>${esc(o.pickup_point || state.settings.pickup_location)}</b>` : 'จัดส่งสินค้าแล้ว'}${o.tracking_no ? ` · เลขพัสดุ <b>${esc(o.tracking_no)}</b>` : ''}</div></div></div>` : ''}
      ${o.status === 'received' ? `<div class="card-pad" style="padding-top:0"><div class="alert alert-ok">${icon('package-open')}<div>ได้รับสินค้าแล้ว · รอผู้ส่งสินค้าแจ้งยอดค่าส่งไปรษณีย์ พร้อมใบเสร็จและเลขบัญชีสำหรับโอน</div></div></div>` : ''}
      ${o.status === 'postage_due' ? `<div class="card-pad" style="padding-top:0"><div class="alert alert-warn">${icon('mailbox')}<div>ผู้ส่งสินค้าแจ้งค่าส่งไปรษณีย์ <b>${baht(o.postage_amount)}</b> แล้ว กรุณาโอนเงินและแนบสลิปด้านล่าง</div></div></div>` : ''}
    </div>
    <div class="grid-2">
      <div class="stack">
        ${canPay ? paymentPanel(o) : ''}
        ${payPostage ? postagePanel(o) : ''}
        <div class="card">
          <div class="card-head"><h3>รายการสินค้า</h3></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>สินค้า</th><th class="right">ราคา</th><th class="right">จำนวน</th><th class="right">รวม</th></tr></thead><tbody>
            ${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="small muted">${esc(i.sku || '')}</div>${i.promo_note ? `<div class="small" style="color:var(--ok)">${esc(i.promo_note)}</div>` : ''}</td><td class="right mono">${baht(i.price)}</td><td class="right">${i.qty} ${esc(i.unit || '')}</td><td class="right mono">${baht(i.line_total)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="card-pad" style="padding-top:8px">
            ${o.shipping_fee > 0 ? `<div class="summary-row"><span>ค่าจัดส่ง</span><span>${baht(o.shipping_fee)}</span></div>` : ''}
            <div class="summary-row total"><span>ยอดรวม</span><span>${baht(o.total)}</span></div>
          </div>
        </div>
      </div>
      <div class="stack">
        <div class="card card-pad stack">
          <h3>${icon('package')} การรับสินค้า</h3>
          <div>${o.delivery_method === 'delivery' ? `<b>จัดส่งตามที่อยู่</b><div class="small muted">${esc(o.address)}</div>` : `<b>${esc(o.pickup_point || 'รับสินค้าด้วยตนเอง')}</b><div class="small muted">${esc(state.settings.pickup_location)}</div>`}</div>
          <div class="small">ผู้รับ: ${esc(o.recipient_name)} · โทร ${esc(o.phone)}</div>
          ${o.note ? `<div class="small">หมายเหตุ: ${esc(o.note)}</div>` : ''}
          ${o.is_regional ? `<div class="small" style="color:#9a3412">${icon('mailbox')} ส่งทางไปรษณีย์ · ชำระค่าส่งไปรษณีย์เพิ่มหลังได้รับสินค้า${o.postage_amount ? ` (${baht(o.postage_amount)}${o.postage_paid_at ? ' ชำระแล้ว' : ''})` : ''}</div>` : ''}
          ${o.has_slip ? `<a class="btn btn-light btn-sm" href="/api/shop/orders/${o.id}/slip" target="_blank">${icon('receipt')} ดูสลิปที่แนบ</a>` : ''}
          ${o.has_postage_slip ? `<a class="btn btn-light btn-sm" href="/api/shop/orders/${o.id}/postage-slip" target="_blank">${icon('receipt')} ดูสลิปค่าส่งที่แนบ</a>` : ''}
        </div>
        <div class="card card-pad">
          <h3 style="margin-bottom:14px">${icon('history')} ประวัติสถานะ</h3>
          <ul class="log">${o.logs.slice().reverse().map((l) => `<li><b>${esc(STATUS[l.status]?.label || l.status)}</b><div class="small muted">${thDate(l.created_at)}</div>${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}</li>`).join('')}</ul>
        </div>
        ${canPay ? `<button class="btn btn-danger btn-block" id="cancel-order">${icon('x')} ยกเลิกคำสั่งซื้อ</button>` : ''}
      </div>
    </div>`);

  if (canPay) {
    const payload = payQrText(o);
    // A QR that fails to draw must never take the order page (slip upload, cancel) down with it
    if (payload && window.QRCode) {
      try { new QRCode($('#qr'), { text: payload, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); }
      catch (err) { console.warn('QR', err); $('#qr').textContent = 'แสดง QR ไม่ได้'; }
    }
    const form = $('#slip-form');
    let blob = null;
    form.slip.onchange = async () => {
      const f = form.slip.files[0];
      if (!f) return;
      try {
        blob = await resizeImage(f, 1400, 0.85);
        const prev = $('#slip-prev');
        prev.src = URL.createObjectURL(blob); prev.hidden = false; $('#slip-ph').hidden = true;
        form.querySelector('[type=submit]').disabled = false;
      } catch (e) { toast(e.message, 'bad'); }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!blob) return toast('กรุณาเลือกรูปสลิป', 'bad');
      const fd = new FormData();
      fd.append('slip', blob, 'slip.jpg');
      fd.append('note', form.note.value);
      await withBusy(form.querySelector('[type=submit]'), async () => {
        try { await API.form(`/api/orders/${o.id}/slip`, fd); toast('ส่งสลิปเรียบร้อย รอเจ้าหน้าที่ตรวจสอบ', 'ok'); pageOrder(no); }
        catch (err) { toast(err.message, 'bad'); }
      });
    };
    $('#cancel-order').onclick = async () => {
      if (!(await confirmBox('ต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?', 'ยกเลิกคำสั่งซื้อ', true))) return;
      try { await API.post(`/api/orders/${o.id}/cancel`); toast('ยกเลิกคำสั่งซื้อแล้ว'); pageOrder(no); } catch (err) { toast(err.message, 'bad'); }
    };
  }
  if (payPostage) {
    const pf = $('#postage-form');
    let pblob = null;
    pf.slip.onchange = async () => {
      const f = pf.slip.files[0];
      if (!f) return;
      try {
        pblob = await resizeImage(f, 1400, 0.85);
        const prev = $('#postage-prev');
        prev.src = URL.createObjectURL(pblob); prev.hidden = false; $('#postage-ph').hidden = true;
        pf.querySelector('[type=submit]').disabled = false;
      } catch (e) { toast(e.message, 'bad'); }
    };
    pf.onsubmit = async (e) => {
      e.preventDefault();
      if (!pblob) return toast('กรุณาเลือกรูปสลิปค่าส่งไปรษณีย์', 'bad');
      const fd = new FormData();
      fd.append('slip', pblob, 'postage-slip.jpg');
      fd.append('note', pf.note.value);
      await withBusy(pf.querySelector('[type=submit]'), async () => {
        try { await API.form(`/api/orders/${o.id}/postage-slip`, fd); toast('ส่งสลิปค่าส่งไปรษณีย์แล้ว รอผู้ส่งสินค้ายืนยัน', 'ok'); pageOrder(no); }
        catch (err) { toast(err.message, 'bad'); }
      });
    };
  }
  // อัปเดตสถานะอัตโนมัติทุก 30 วินาที
  if (!['completed', 'cancelled'].includes(o.status)) {
    pageTimer = setInterval(async () => {
      if (document.hidden || $('#slip-prev:not([hidden])') || $('#postage-prev:not([hidden])')) return;
      try { const r = await API.get(`/api/orders/${o.id}`); if (r.order.status !== o.status) { toast(`สถานะอัปเดต: ${STATUS[r.order.status].label}`, 'ok'); router(); } } catch {}
    }, 30000);
  }
}

async function pageOrders() {
  if (!requireLogin('#/orders')) return;
  const { orders } = await API.get('/api/orders');
  view(`<div class="page-title"><h1>คำสั่งซื้อของฉัน</h1></div>
    ${orders.length ? `<div class="card">${orders.map((o) => `
      <a class="order-card" href="#/order/${esc(o.order_no)}">
        <div><div class="row" style="gap:10px"><b class="mono">${esc(o.order_no)}</b>${statusBadge(o.status)}</div>
          <div class="small muted" style="margin-top:4px">${esc(o.item_names || '')}</div>
          <div class="small muted">${thDate(o.created_at)} · ${num(o.item_count)} ชิ้น</div></div>
        <div class="right"><div class="price">${baht(o.total)}</div>${o.status === 'pending_payment' ? '<span class="small" style="color:var(--warn)">กดเพื่อชำระเงิน →</span>' : ''}</div>
      </a>`).join('')}</div>`
      : `<div class="card empty">${icon('receipt-text')}<div class="head" style="font-size:1.1rem">ยังไม่มีคำสั่งซื้อ</div><p><a class="btn btn-primary" href="/shop">เริ่มเลือกซื้อสินค้า</a></p></div>`}`);
}

function pageLogin(params) {
  const next = params.get('next') || '#/orders';
  if (state.user) { location.hash = next; return; }
  const presetUser = params.get('u') || '';
  view(`<div class="auth-wrap"><div class="card card-pad stack">
    <div class="center"><img src="/logo.png" alt="" width="64" height="64" style="margin:0 auto 10px;display:block"><h1>เข้าสู่ระบบ</h1><p class="muted" style="margin:4px 0 0">สมาชิกร้านค้าสวัสดิการ</p></div>
    <form id="login" class="stack">
      <label class="field"><span>ชื่อผู้ใช้</span><input name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(presetUser)}"></label>
      <label class="field"><span class="row between"><span>รหัสผ่าน</span><a class="small" style="font-weight:400" href="#/forgot">ลืมรหัสผ่าน?</a></span><input name="password" type="password" required autocomplete="current-password"></label>
      <div id="login-err"></div>
      <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('log-in')} เข้าสู่ระบบ</button>
    </form>
    <p class="center small muted">ยังไม่เป็นสมาชิก? <a href="#/register?next=${encodeURIComponent(next)}">สมัครสมาชิก</a></p>
  </div></div>`);
  const f = $('#login');
  if (presetUser) f.password.focus();
  mountCaptcha(f).then((cap) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(f.querySelector('[type=submit]'), async () => {
        try {
          const { user } = await API.post('/api/auth/login', { ...Object.fromEntries(new FormData(f)), captcha: cap.token() });
          state.user = user; renderNav(); toast(`ยินดีต้อนรับ คุณ${user.name}`, 'ok'); location.hash = next;
        } catch (err) {
          cap.reset();
          $('#login-err').innerHTML = `<div class="alert alert-bad small">${icon('shield-alert')}<div>${esc(err.message)}</div></div>`; refreshIcons();
        }
      });
    };
  });
}

function pageForgot() {
  view(`<div class="auth-wrap" style="max-width:560px"><div class="card card-pad stack">
    <div class="center"><h1>ลืมรหัสผ่าน</h1><p class="muted" style="margin:4px 0 0">ยืนยันตัวตนเพื่อตั้งรหัสผ่านใหม่</p></div>
    <form id="fgi" class="form-grid">
      <label class="field"><span>อีเมลสำนักงาน <span class="muted" style="font-weight:400">(example@oag.go.th)</span> <em>*</em></span><input name="office_email" type="email" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="example@oag.go.th" maxlength="120"></label>
      <label class="field"><span>คำนำหน้าชื่อ <em>*</em></span><input name="prefix" required autocomplete="off" placeholder="เช่น นาย นาง นางสาว"></label>
      <label class="field full"><span>ชื่อ <em>*</em></span><input name="first_name" required autocomplete="given-name"></label>
      <label class="field full"><span>นามสกุล <em>*</em></span><input name="last_name" required autocomplete="family-name"></label>
      <label class="field full"><span>เบอร์โทรศัพท์ที่ใช้สมัคร <em>*</em></span><input name="phone" required inputmode="tel" placeholder="08xxxxxxxx" autocomplete="tel"></label>
      <button type="submit" class="btn btn-primary btn-lg btn-block full">${icon('shield-check')} ยืนยันตัวตน</button>
    </form>
    <p class="small muted" style="margin:0">ถ้าเปลี่ยนเบอร์โทรศัพท์ไปแล้วหรือยืนยันไม่ผ่าน กรุณาติดต่อเจ้าหน้าที่สวัสดิการเพื่อรีเซ็ตรหัสผ่าน</p>
    <details class="small"><summary class="muted" style="cursor:pointer">บัญชีเดิมที่สมัครด้วยอีเมล</summary>
      ${SEC.mail_enabled ? '' : `<div class="alert alert-warn small" style="margin-top:10px">${icon('info')}<div>ขณะนี้ระบบยังไม่ได้เปิดการส่งอีเมล หากไม่ได้รับลิงก์ กรุณาติดต่อเจ้าหน้าที่สวัสดิการเพื่อรีเซ็ตรหัสผ่าน</div></div>`}
      <form id="fg" class="stack" style="margin-top:10px">
        <label class="field"><span>อีเมล</span><input name="email" type="email" required autocomplete="email" placeholder="name@example.com"></label>
        <button type="submit" class="btn btn-light btn-block">${icon('mail')} ส่งลิงก์ตั้งรหัสผ่านใหม่</button>
      </form>
      <div id="fg-msg"></div></details>
    <p class="center small"><a href="#/login">← กลับไปเข้าสู่ระบบ</a></p>
  </div></div>`);
  const fi = $('#fgi');
  mountCaptcha(fi).then((cap) => {
    fi.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(fi.querySelector('[type=submit]'), async () => {
        try {
          const r = await API.post('/api/auth/forgot/verify', { ...Object.fromEntries(new FormData(fi)), captcha: cap.token() });
          await pageReset(new URLSearchParams({ token: r.token }), true);
        } catch (err) { cap.reset(); toast(err.message, 'bad'); }
      });
    };
  });
  const f = $('#fg');
  mountCaptcha(f).then((cap) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(f.querySelector('[type=submit]'), async () => {
        try {
          const r = await API.post('/api/auth/forgot', { email: f.email.value.trim(), captcha: cap.token() });
          f.hidden = true;
          $('#fg-msg').innerHTML = `<div class="alert alert-ok">${icon('mail-check')}<div>${esc(r.message)}</div></div>`; refreshIcons();
        } catch (err) { cap.reset(); toast(err.message, 'bad'); }
      });
    };
  });
}

async function pageReset(params, fromIdCheck = false) {
  const token = params.get('token') || '';
  // เอา token ออกจากแถบที่อยู่ทันที (กันหลุดผ่านประวัติเบราว์เซอร์/การแชร์หน้าจอ) · มาจากการยืนยันด้วยเลขประจำตัว token ไม่เคยอยู่ในแถบที่อยู่
  if (!fromIdCheck) history.replaceState(null, '', location.pathname + '#/reset');
  let info;
  try { info = await API.post('/api/auth/reset/check', { token }); }
  catch (e) {
    return view(`<div class="auth-wrap"><div class="card card-pad stack center">${icon('link-2-off')}<h2>ลิงก์ใช้ไม่ได้</h2><p class="muted">${esc(e.message)}</p>
      <a class="btn btn-primary" href="#/forgot">ขอลิงก์ใหม่</a></div></div>`);
  }
  view(`<div class="auth-wrap"><div class="card card-pad stack">
    <div><h1>ตั้งรหัสผ่านใหม่</h1><p class="muted" style="margin:4px 0 0">${info.email_full.includes('@') ? `บัญชี ${esc(info.email)}` : `ชื่อผู้ใช้ของคุณ: <b class="mono">${esc(info.email_full)}</b>`}</p></div>
    <form id="rs" class="stack">
      <input type="text" name="username" autocomplete="username" value="${esc(info.email_full)}" hidden>
      <label class="field"><span>รหัสผ่านใหม่</span><input name="password" type="password" required autocomplete="new-password"></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input name="password2" type="password" required autocomplete="new-password"></label>
      <button type="submit" class="btn btn-gold btn-lg btn-block">${icon('key-round')} บันทึกรหัสผ่านใหม่</button>
      <div id="rs-err" aria-live="polite"></div>
    </form>
  </div></div>`);
  const f = $('#rs');
  passwordMeter(f.password, () => info.email_full);
  // แจ้งปัญหาใต้ปุ่มให้เห็นชัด (ไม่ใช้แค่ป้ายแจ้งเตือนที่หายเอง)
  const showErr = (msg) => {
    $('#rs-err').innerHTML = msg ? `<div class="alert alert-bad">${icon('circle-alert')}<div>${esc(msg)}</div></div>` : '';
    refreshIcons();
  };
  f.oninput = () => showErr('');
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!passwordOk(f.password.value, info.email_full)) return showErr('รหัสผ่านยังไม่ผ่านเงื่อนไขทุกข้อ');
    if (f.password.value !== f.password2.value) return showErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    await withBusy(f.querySelector('[type=submit]'), async () => {
      try {
        await API.post('/api/auth/reset', { token, password: f.password.value });
        state.user = null; renderNav();
        // หน้ายืนยันว่าบันทึกแล้ว + ปุ่มไปเข้าสู่ระบบ (เติมชื่อผู้ใช้ให้)
        view(`<div class="auth-wrap"><div class="card card-pad stack center">
          <div class="done-badge">${icon('circle-check-big')}</div>
          <h1>บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว</h1>
          <p class="muted" style="margin:0">ใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที · ระบบออกจากระบบทุกอุปกรณ์ที่เคยเข้าไว้แล้ว</p>
          <div class="done-user">ชื่อผู้ใช้ <b class="mono">${esc(info.email_full)}</b></div>
          <a class="btn btn-primary btn-lg btn-block" href="#/login?u=${encodeURIComponent(info.email_full)}">${icon('log-in')} เข้าสู่ระบบ</a>
        </div></div>`);
      } catch (err) {
        // ลิงก์/การยืนยันหมดอายุ: บอกให้ยืนยันตัวตนใหม่
        showErr(/หมดอายุ|ถูกใช้ไปแล้ว/.test(err.message) ? 'หมดเวลาตั้งรหัสผ่าน (30 นาที) กรุณากด “ลืมรหัสผ่าน” แล้วยืนยันตัวตนอีกครั้ง' : err.message);
      }
    });
  };
}

/* สมัครสมาชิก 2 ขั้น: (1) ตรวจอีเมลสำนักงาน + คำนำหน้า ชื่อ นามสกุล กับรายชื่อบุคลากร  (2) ตั้งชื่อผู้ใช้ รหัสผ่าน เบอร์โทร */
/** ถามสำนักตอนสมัครสมาชิก (ปิดไว้ก่อน · เปิดใช้: true แล้วตั้ง REGISTER_ASK_DEPARTMENT ใน src/shop/api.js ให้ตรงกัน) */
const REGISTER_ASK_DEPARTMENT = false;
/** เลือกวันเดือนปีเกิด (ปี พ.ศ.) — select 3 ช่อง ไม่ขึ้นกับรูปแบบวันที่ของเบราว์เซอร์ */
const TH_MONTHS_SHORT_DOB = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function dobPicker() {
  const now = new Date().getFullYear() + 543;
  const opt = (v, t) => `<option value="${v}">${t}</option>`;
  return `<div style="display:grid;grid-template-columns:1fr 1.2fr 1.3fr;gap:8px">
    <select class="input" name="dob_d" required aria-label="วันที่">${opt('', 'วัน')}${Array.from({ length: 31 }, (_, i) => opt(i + 1, i + 1)).join('')}</select>
    <select class="input" name="dob_m" required aria-label="เดือน">${opt('', 'เดือน')}${TH_MONTHS_SHORT_DOB.map((m, i) => opt(i + 1, m)).join('')}</select>
    <select class="input" name="dob_y" required aria-label="ปี พ.ศ.">${opt('', 'ปี พ.ศ.')}${Array.from({ length: 70 }, (_, i) => opt(now - 17 - i, now - 17 - i)).join('')}</select>
  </div>`;
}
function pageRegister(params) {
  const next = params.get('next') || '#/orders';
  if (state.user) { location.hash = next; return; }
  view(`<div class="auth-wrap" style="max-width:640px"><div class="card card-pad stack">
    <div><h1>สมัครสมาชิก</h1><p class="muted" style="margin:4px 0 0">สำหรับบุคลากร สตง. · ตรวจสอบสิทธิ์ด้วยอีเมลสำนักงานและวันเดือนปีเกิด</p></div>
    <ol class="reg-steps"><li class="on" id="rs1"><b>1</b> ตรวจสอบสิทธิ์</li><li id="rs2"><b>2</b> ตั้งชื่อผู้ใช้และรหัสผ่าน</li></ol>
    <form id="reg1" class="form-grid">
      <label class="field full"><span>อีเมลสำนักงาน <span class="muted" style="font-weight:400">(example@oag.go.th)</span> <em>*</em></span><input name="office_email" type="email" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="example@oag.go.th" maxlength="120"></label>
      <div class="field full"><span>วันเดือนปีเกิด <em>*</em></span>${dobPicker()}</div>
      <p class="small muted full" style="margin:0">ใช้ได้ 1 บัญชีต่อ 1 อีเมลสำนักงาน · วันเกิดใช้ตรวจสอบสิทธิ์เท่านั้น</p>
      <button type="submit" class="btn btn-primary btn-lg btn-block full">${icon('shield-check')} ตรวจสอบสิทธิ์</button>
    </form>
    <div id="reg2-wrap" hidden>
      <div class="alert alert-ok small" style="margin-bottom:14px">${icon('badge-check')}<div>ยืนยันสิทธิ์แล้ว · <a href="#" id="reg-back">แก้ไข</a></div></div>
      <form id="reg" class="form-grid">
        <label class="field"><span>ชื่อ <span class="muted" style="font-weight:400">(ตามรายชื่อบุคลากร)</span></span><input id="reg-first" class="locked-input" readonly tabindex="-1" title="ชื่อแสดงตามรายชื่อบุคลากร แก้ไขไม่ได้"></label>
        <label class="field"><span>นามสกุล <span class="muted" style="font-weight:400">(ตามรายชื่อบุคลากร)</span></span><input id="reg-last" class="locked-input" readonly tabindex="-1" title="นามสกุลแสดงตามรายชื่อบุคลากร แก้ไขไม่ได้"></label>
        <label class="field full"><span>ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ) <em>*</em></span><input name="username" required minlength="4" maxlength="32" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{3,31}">
          <small>ระบบตั้งให้ตามชื่ออีเมลสำนักงานในเบื้องต้น เปลี่ยนเป็นชื่ออื่นได้ตามต้องการ · ภาษาอังกฤษ ตัวเลข หรือ . _ - ยาว 4–32 ตัว</small></label>
        <label class="field"><span>รหัสผ่าน <em>*</em></span><input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label>
        <label class="field"><span>ยืนยันรหัสผ่าน <em>*</em></span><input name="password2" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label>
        <label class="field full"><span>เบอร์โทรศัพท์ <em>*</em></span><input name="phone" required inputmode="tel" placeholder="08xxxxxxxx" autocomplete="tel"></label>
        ${REGISTER_ASK_DEPARTMENT ? departmentPicker('', true) : ''}
        <button type="submit" class="btn btn-gold btn-lg btn-block full">${icon('user-plus')} สมัครสมาชิก</button>
      </form>
    </div>
    <p class="center small muted">เป็นสมาชิกอยู่แล้ว? <a href="#/login?next=${encodeURIComponent(next)}">เข้าสู่ระบบ</a></p>
  </div></div>`);
  const f1 = $('#reg1'), f = $('#reg');
  let who = null; // ข้อมูลที่ตรวจผ่านแล้ว (ส่งซ้ำในขั้น 2 ให้เซิร์ฟเวอร์ตรวจอีกครั้ง)
  const step = (n) => {
    f1.hidden = n !== 1; $('#reg2-wrap').hidden = n !== 2;
    $('#rs1').classList.toggle('on', n === 1); $('#rs2').classList.toggle('on', n === 2);
  };
  f1.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f1));
    // วัน/เดือน/ปี พ.ศ. → "YYYY-MM-DD" ค.ศ.
    d.birth_date = `${Number(d.dob_y) - 543}-${String(d.dob_m).padStart(2, '0')}-${String(d.dob_d).padStart(2, '0')}`;
    delete d.dob_d; delete d.dob_m; delete d.dob_y;
    await withBusy(f1.querySelector('[type=submit]'), async () => {
      try {
        const r = await API.post('/api/auth/register/verify', d);
        who = d;
        $('#reg-first').value = r.first_name; $('#reg-last').value = r.last_name;
        // ชื่อผู้ใช้เริ่มต้น = ส่วนหน้า @ ของอีเมลสำนักงาน (แก้ได้)
        if (!f.username.value) f.username.value = r.username || '';
        f.username.dispatchEvent(new Event('input'));
        step(2); f.username.focus();
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
  $('#reg-back').onclick = (e) => { e.preventDefault(); step(1); };
  mountDepartmentPicker(f);
  const meter = passwordMeter(f.password, () => f.username.value.trim().toLowerCase());
  f.username.addEventListener('input', meter.refresh);
  mountCaptcha(f).then((cap) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      d.username = d.username.trim().toLowerCase();
      if (!passwordOk(d.password, d.username)) { f.password.focus(); return toast('รหัสผ่านยังไม่ผ่านเงื่อนไขทุกข้อ', 'bad'); }
      if (d.password !== d.password2) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'bad');
      if (REGISTER_ASK_DEPARTMENT && !d.department) { f.querySelector('.dept-search').focus(); return toast('กรุณาเลือกสำนัก (สำนักตามมอบหมายงาน)', 'bad'); }
      delete d.password2;
      await withBusy(f.querySelector('[type=submit]'), async () => {
        try {
          const { user } = await API.post('/api/auth/register', { ...who, ...d, captcha: cap.token() });
          state.user = user; renderNav(); toast('สมัครสมาชิกเรียบร้อย', 'ok'); location.hash = next;
        } catch (err) { cap.reset(); toast(err.message, 'bad'); }
      });
    };
  });
}

function pageProfile() {
  if (!requireLogin('#/profile')) return;
  const u = state.user;
  view(`<div class="auth-wrap" style="max-width:640px"><div class="card card-pad stack">
    <h1>ข้อมูลส่วนตัว</h1>
    <form id="pf" class="form-grid">
      <label class="field${u.office_email || u.emp_id ? '' : ' full'}"><span>${u.username.includes('@') ? 'ชื่อผู้ใช้ (อีเมล)' : 'ชื่อผู้ใช้'}</span><input value="${esc(u.username)}" disabled></label>
      ${u.office_email ? `<label class="field"><span>อีเมลสำนักงาน</span><input value="${esc(u.office_email)}" disabled></label>` : u.emp_id ? `<label class="field"><span>เลขประจำตัวข้าราชการ</span><input value="${esc(u.emp_id)}" disabled></label>` : ''}
      <label class="field"><span>ชื่อ-นามสกุล <em>*</em></span><input name="name" required value="${esc(u.name)}" ${u.office_email || u.emp_id ? 'disabled title="ชื่อตามรายชื่อบุคลากร"' : ''}></label>
      <label class="field"><span>เบอร์โทรศัพท์</span><input name="phone" value="${esc(u.phone)}"></label>
      <div class="full hr" style="margin:4px 0"></div>
      <h3 class="full">${icon('key-round')} เปลี่ยนรหัสผ่าน <span class="small muted" style="font-weight:400">(กรอกเฉพาะเมื่อต้องการเปลี่ยน)</span></h3>
      <label class="field full"><span>รหัสผ่านเดิม</span><input name="old_password" type="password" autocomplete="current-password"></label>
      <label class="field full"><span>รหัสผ่านใหม่</span><input name="new_password" type="password" maxlength="128" autocomplete="new-password"></label>
      <button type="submit" class="btn btn-primary btn-block full">${icon('save')} บันทึก</button>
    </form>
    <div class="hr"></div>
    <div class="row between"><div><b>ออกจากระบบทุกอุปกรณ์</b><div class="small muted">ใช้เมื่อสงสัยว่ามีคนอื่นเข้าบัญชีของคุณ หรือลืมออกจากระบบที่เครื่องอื่น</div></div>
      <button class="btn btn-danger" id="logout-all">${icon('log-out')} ออกจากทุกอุปกรณ์</button></div>
    <div class="hr"></div>
    <div class="row between"><div><b>ปิดบัญชี</b><div class="small muted">ลบข้อมูลติดต่อและเข้าสู่ระบบด้วยบัญชีนี้ไม่ได้อีก ประวัติคำสั่งซื้อยังเก็บไว้ให้เจ้าหน้าที่ตรวจสอบ</div></div>
      <button class="btn btn-danger" id="close-account">${icon('user-x')} ปิดบัญชี</button></div>
  </div></div>`);
  const f = $('#pf');
  mountDepartmentPicker(f);
  passwordMeter(f.new_password, () => u.email);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (d.new_password) {
      if (!d.old_password) return toast('กรุณากรอกรหัสผ่านเดิม', 'bad');
      if (!passwordOk(d.new_password, u.email)) return toast('รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขทุกข้อ', 'bad');
    } else delete d.old_password;
    await withBusy(f.querySelector('[type=submit]'), async () => {
      try {
        const { user } = await API.put('/api/auth/me', d);
        state.user = user; renderNav();
        toast(d.new_password ? 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นถูกออกจากระบบทั้งหมด' : 'บันทึกแล้ว', 'ok');
        f.old_password.value = f.new_password.value = ''; f.new_password.dispatchEvent(new Event('input'));
      } catch (err) { toast(err.message, 'bad'); }
    });
  };
  $('#logout-all').onclick = async () => {
    if (!(await confirmBox('ออกจากระบบทุกอุปกรณ์ รวมถึงเครื่องนี้?', 'ออกจากทุกอุปกรณ์', true))) return;
    await API.post('/api/auth/logout-all').catch(() => {});
    state.user = null; renderNav(); toast('ออกจากระบบทุกอุปกรณ์แล้ว'); location.hash = '#/login';
  };
  $('#close-account').onclick = () => closeAccountDialog();
}

const CLOSE_PHRASE = 'ต้องการปิดบัญชีนี้';
function closeAccountDialog() {
  const m = openModal(`<div class="modal-head"><h2>${icon('user-x')} ปิดบัญชีสมาชิก</h2><button class="x-btn" data-close>${icon('x')}</button></div>
    <div class="modal-body stack">
      <div class="alert alert-bad small">${icon('triangle-alert')}<div><b>ปิดแล้วเปิดกลับไม่ได้</b> ระบบจะลบอีเมลและเบอร์โทรออกจากบัญชี และเข้าสู่ระบบด้วยบัญชีนี้ไม่ได้อีก หากต้องการใช้งานภายหลังต้องสมัครสมาชิกใหม่</div></div>
      <label class="field"><span>พิมพ์ <b>“${CLOSE_PHRASE}”</b> เพื่อยืนยัน</span><input class="input" id="ca-input" autocomplete="off" placeholder="${CLOSE_PHRASE}"></label>
    </div>
    <div class="modal-foot"><button class="btn btn-light" data-close>ยกเลิก</button><button class="btn btn-danger" id="ca-yes" disabled>${icon('user-x')} ปิดบัญชีถาวร</button></div>`);
  const input = $('#ca-input', m), yes = $('#ca-yes', m);
  input.oninput = () => (yes.disabled = input.value.trim() !== CLOSE_PHRASE);
  setTimeout(() => input.focus(), 30);
  yes.onclick = async () => {
    await withBusy(yes, async () => {
      try {
        await API.post('/api/auth/close-account', { confirm: input.value.trim() });
        closeModal();
        state.user = null; state.cart = []; saveCart(); renderNav();
        toast('ปิดบัญชีเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ', 'ok');
        location.hash = '#/login';
      } catch (err) { toast(err.message, 'bad'); yes.disabled = input.value.trim() !== CLOSE_PHRASE; }
    });
  };
}

/* ---------- router ---------- */
const routes = [
  [/^#\/?$/, () => { location.hash = state.user ? '#/orders' : '#/login'; }],
  [/^#\/cart$/, pageCart],
  [/^#\/checkout$/, pageCheckout],
  [/^#\/login$/, pageLogin],
  [/^#\/register$/, pageRegister],
  [/^#\/forgot$/, pageForgot],
  [/^#\/reset$/, pageReset],
  [/^#\/orders$/, pageOrders],
  [/^#\/order\/([\w-]+)$/, pageOrder],
  [/^#\/profile$/, pageProfile],
];
async function router() {
  clearInterval(pageTimer);
  $('#app').onclick = null;
  const [path, qs] = (location.hash || '#/').split('?');
  const params = new URLSearchParams(qs || '');
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    window.scrollTo(0, 0);
    try { await fn(...m.slice(1), params); }
    catch (e) {
      if (e.status === 401) { state.user = null; renderNav(); location.hash = `#/login?next=${encodeURIComponent(location.hash)}`; return; }
      // ลิงก์จากอีเมลเปิดคำสั่งซื้อของบัญชีอื่น (เช่น เครื่องนี้ล็อกอินบัญชีเจ้าหน้าที่ค้างอยู่)
      if (e.status === 404 && fn === pageOrder && state.user) {
        view(`<div class="card empty">${icon('user-round-x')}<div class="head">คำสั่งซื้อนี้ไม่ได้อยู่ในบัญชีที่เข้าสู่ระบบอยู่</div>
          <p class="muted">ตอนนี้คุณเข้าสู่ระบบด้วย <b>${esc(state.user.email)}</b><br>คำสั่งซื้อนี้เป็นของบัญชีอื่น กรุณาเข้าสู่ระบบด้วยบัญชีที่สั่งซื้อ</p>
          <p class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" id="switch-acct">${icon('log-in')} เข้าสู่ระบบด้วยบัญชีอื่น</button>
          <a class="btn btn-light" href="#/orders">คำสั่งซื้อของฉัน</a></p></div>`);
        const back = location.hash;
        $('#switch-acct').onclick = async () => {
          await API.post('/api/auth/logout').catch(() => {});
          state.user = null; renderNav();
          location.hash = `#/login?next=${encodeURIComponent(back)}`;
        };
        return;
      }
      view(`<div class="card empty">${icon('circle-alert')}<div class="head">${esc(e.message)}</div><p><a class="btn btn-light" href="/shop">กลับหน้าร้าน</a></p></div>`);
    }
    return;
  }
  view(`<div class="card empty">${icon('map-pin-off')}<div class="head">ไม่พบหน้าที่ต้องการ</div><p><a class="btn btn-light" href="/shop">กลับหน้าร้าน</a></p></div>`);
}

(async function init() {
  loadCart();
  const [s, me] = await Promise.all([API.get('/api/settings').catch(() => ({ settings: {} })), API.get('/api/auth/me').catch(() => ({ user: null }))]);
  state.settings = s.settings || {};
  Object.assign(SEC, s.security || {});
  state.user = me.user;
  renderNav();
  window.addEventListener('hashchange', router);
  router();
})();
