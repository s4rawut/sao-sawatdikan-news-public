/* ป้าย "สินค้าใหม่" และ "โปรโมชั่น" บนสินค้า — ใช้ร่วมกันใน ProductGrid และหน้าสินค้า
 * ป้ายโปรโมชั่นเป็นแค่ข้อความบอกช่วงวันที่ ไม่เปลี่ยนราคา (แอดมินปรับราคาเอง)
 * ทุกวันที่นับตามเวลาไทย (Asia/Bangkok) และนับรวมวันสุดท้าย */

const BKK_OFFSET = 7 * 3600e3;

/** วันที่ปัจจุบันตามเวลาไทย "YYYY-MM-DD" */
export const bangkokToday = (now = new Date()) => new Date(now.getTime() + BKK_OFFSET).toISOString().slice(0, 10);

/** ค่าวันที่จากฟิลด์ (ISO หรือ YYYY-MM-DD) -> "YYYY-MM-DD" ตามเวลาไทย; ว่าง/ผิดรูปแบบ -> "" */
export function bangkokDay(v) {
	if (!v) return "";
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const t = Date.parse(s);
	return Number.isNaN(t) ? "" : new Date(t + BKK_OFFSET).toISOString().slice(0, 10);
}

/** ติ๊ก "แสดงป้ายโปรโมชั่น" ไว้ (EmDash เก็บ boolean เป็น 1/0) */
export const promoBadgeOn = (p) => p?.promo_badge === true || p?.promo_badge === 1 || p?.promo_badge === "1";

/** แสดงป้าย "โปรโมชั่น" เมื่อ: ติ๊ก "แสดงป้ายโปรโมชั่น" ไว้ (แสดงจนกว่าจะเอาออก)
 * หรือวันนี้อยู่ในช่วงวันที่ (ไม่ใส่วันเริ่ม = เริ่มทันที, ไม่ใส่วันสิ้นสุด = ไม่มีกำหนด) */
export function promoActive(p, today = bangkokToday()) {
	if (promoBadgeOn(p)) return true;
	const start = bangkokDay(p?.promo_start);
	const end = bangkokDay(p?.promo_end);
	if (!start && !end) return false;
	if (start && today < start) return false;
	if (end && today > end) return false;
	return true;
}

/** แสดงป้าย "สินค้าใหม่" เมื่อ: ติ๊ก "สินค้าใหม่" ไว้ (แสดงจนกว่าจะเอาออก) หรือยังไม่เลยวันที่ "สินค้าใหม่ถึงวันที่" (รวมวันนั้น) */
export function isNewProduct(p, today = bangkokToday()) {
	if (p?.new_badge === true || p?.new_badge === 1 || p?.new_badge === "1") return true;
	const until = bangkokDay(p?.new_until);
	return !!until && today <= until;
}

/* ---- ราคาตามจำนวน (ราคาขั้นบันได) ----
 * เช่น ปกติ 1,200 · 50 ขึ้นไป 1,100 · 100 ขึ้นไป 1,000 · 200 ขึ้นไป 950 (ต่อชิ้น)
 * ซื้อถึงขั้นไหน ทุกชิ้นได้ราคาขั้นนั้น · นับจำนวนรวมของสินค้าเดียวกัน (ทุกสี/ไซส์)
 * ที่มา: ฟิลด์ price_tiers ("50=1100, 100=1000") + ฟิลด์เดิม bulk_qty/bulk_price (ขั้นเดียว) รวมกัน
 * ฝั่งตะกร้า (public/shop/member.js) คำนวณจากรายการขั้นที่ API ส่งไป ต้องใช้กติกาเดียวกัน */

/** แปลงข้อความ "50=1100, 100=1000" เป็น [{ qty, price }] (ยังไม่กรอง) */
export function parseTierText(text) {
	const out = [];
	// แบ่งที่ ; ขึ้นบรรทัดใหม่ หรือจุลภาคที่ตามด้วย "จำนวน=" เท่านั้น ราคาที่มีลูกน้ำ (1,000) จึงไม่ถูกตัดเป็น 1
	for (const part of String(text ?? "").split(/[;\n]+|,(?=\s*[\d,]+\s*[=:])/)) {
		const m = part.match(/^\s*([\d,]+)\s*[=:]\s*([\d,.]+)\s*$/);
		if (m) out.push({ qty: Number(m[1].replace(/,/g, "")), price: Number(m[2].replace(/,/g, "")) });
	}
	return out;
}

/** ขั้นราคาที่ใช้ได้ของสินค้า เรียงจากจำนวนน้อยไปมาก: จำนวนตั้งแต่ 2 และราคาต่ำกว่าราคาปกติ (จำนวนซ้ำ ใช้ราคาที่ถูกกว่า) */
export function priceTiers(p) {
	const base = Number(p?.price);
	const list = parseTierText(p?.price_tiers);
	if (p?.bulk_qty != null && p?.bulk_price != null) list.push({ qty: Number(p.bulk_qty), price: Number(p.bulk_price) });
	const byQty = new Map();
	for (const t of list) {
		if (!Number.isInteger(t.qty) || t.qty < 2 || !(t.price > 0) || !(t.price < base)) continue;
		if (!byQty.has(t.qty) || t.price < byQty.get(t.qty)) byQty.set(t.qty, Math.round(t.price * 100) / 100);
	}
	return [...byQty].map(([qty, price]) => ({ qty, price })).sort((a, b) => a.qty - b.qty);
}

/** "50=1100, 100=1000" — รูปแบบที่เก็บในฟิลด์ price_tiers */
export const tierText = (tiers) => tiers.map((t) => `${t.qty}=${t.price}`).join(", ");

/** สินค้านี้มีราคาตามจำนวน */
export const hasBulkPrice = (p) => priceTiers(p).length > 0;

/** ขั้นที่ได้เมื่อซื้อรวม totalQty ชิ้น (ไม่ถึงขั้นไหน = null) */
export function reachedTier(p, totalQty) {
	let hit = null;
	for (const t of priceTiers(p)) if (totalQty >= t.qty) hit = t;
	return hit;
}

/** ราคาต่อชิ้นเมื่อซื้อรวม totalQty ชิ้น */
export const unitPrice = (p, totalQty) => reachedTier(p, totalQty)?.price ?? (Number(p?.price) || 0);

/* ---- ราคาแบบชุด (โปรโมชั่น) ----
 * เช่น ปกติชิ้นละ 50 · 3 ชิ้น 100 · 5 ชิ้น 150 (ราคารวมของชุด) — ฟิลด์ price_bundles ("3=100, 5=150")
 * ระบบจัดชุดให้ราคารวมถูกที่สุดเอง: 4 ชิ้น = ชุด 3 ชิ้น + 1 ชิ้น = 150 · 8 ชิ้น = ชุด 5 + ชุด 3 = 250
 * นับรวมทุกสี/ไซส์ของสินค้าเดียวกัน · ชิ้นที่ไม่เข้าชุดคิดราคาต่อชิ้น (ตามขั้นราคาตามจำนวนถ้ามี)
 * ฝั่งตะกร้า (public/shop/member.js: bundlePlan) ใช้กติกาเดียวกัน ต้องแก้คู่กัน */
export function priceBundles(p) {
	const base = Number(p?.price);
	const byQty = new Map();
	for (const t of parseTierText(p?.price_bundles)) {
		// ชุดต้องถูกกว่าซื้อแยกชิ้นในราคาปกติ
		if (!Number.isInteger(t.qty) || t.qty < 2 || !(t.price > 0) || !(t.price < base * t.qty)) continue;
		const total = Math.round(t.price * 100) / 100;
		if (!byQty.has(t.qty) || total < byQty.get(t.qty)) byQty.set(t.qty, total);
	}
	return [...byQty].map(([qty, total]) => ({ qty, total })).sort((a, b) => a.qty - b.qty);
}

/** จัดชุดให้ราคารวมต่ำสุดสำหรับ qty ชิ้น (คิดเป็นสตางค์กันทศนิยมเพี้ยน)
 * → { total, singles (จำนวนชิ้นที่คิดราคาต่อชิ้น), parts: [{ qty, total, count }] (ชุดใหญ่ก่อน) } */
export function bundlePlan(unit, bundles, qty) {
	const u = Math.round(Number(unit) * 100);
	const cost = [0];
	const pick = [-1];
	for (let n = 1; n <= qty; n++) {
		let best = cost[n - 1] + u;
		let how = -1;
		bundles.forEach((b, i) => {
			if (b.qty > n) return;
			const c = cost[n - b.qty] + Math.round(b.total * 100);
			if (c < best) { best = c; how = i; }
		});
		cost.push(best);
		pick.push(how);
	}
	const counts = new Map();
	let singles = 0;
	for (let n = qty; n > 0; ) {
		const h = pick[n];
		if (h < 0) { singles++; n--; }
		else { counts.set(h, (counts.get(h) || 0) + 1); n -= bundles[h].qty; }
	}
	const parts = [...counts].map(([i, count]) => ({ ...bundles[i], count })).sort((a, b) => b.qty - a.qty);
	return { total: cost[qty] / 100, singles, parts };
}

/** ราคารวมของสินค้า p เมื่อซื้อรวม qty ชิ้น (ราคาตามจำนวน + ราคาแบบชุด) */
export const productPlan = (p, qty) => bundlePlan(unitPrice(p, qty), priceBundles(p), qty);

const thNum = (n) => Number(n).toLocaleString("th-TH");
/** "ชุด 3 ชิ้น ฿100 ×1 + 1 ชิ้น ฿50" — แสดงในรายการสั่งซื้อ (ไม่มีชุด = "") */
export function planNote(plan, unit, unitName = "ชิ้น") {
	if (!plan.parts.length) return "";
	const parts = plan.parts.map((b) => `ชุด ${thNum(b.qty)} ${unitName} ฿${thNum(b.total)}${b.count > 1 ? ` ×${b.count}` : ""}`);
	if (plan.singles) parts.push(`${thNum(plan.singles)} ${unitName} ${unitName}ละ ฿${thNum(unit)}`);
	return `โปรโมชั่น: ${parts.join(" + ")}`;
}
/** ป้ายสั้นบนการ์ด: "โปร 3 ชิ้น ฿100 · 5 ชิ้น ฿150" */
export function bundleLabel(p) {
	const b = priceBundles(p);
	if (!b.length) return "";
	const u = p.unit || "ชิ้น";
	return `โปร ${b.map((x) => `${thNum(x.qty)} ${u} ฿${thNum(x.total)}`).join(" · ")}`;
}
/** ป้ายสั้นบนการ์ด: "ซื้อ 20 ชิ้นขึ้นไป ชิ้นละ ฿65" / หลายขั้น: "ซื้อ 50 เหรียญขึ้นไป เหรียญละ ฿1,100 · ยิ่งซื้อมากยิ่งถูก" */
export function bulkLabel(p) {
	const tiers = priceTiers(p);
	if (!tiers.length) return "";
	const u = p.unit || "ชิ้น";
	const first = `ซื้อ ${thNum(tiers[0].qty)} ${u}ขึ้นไป ${u}ละ ฿${thNum(tiers[0].price)}`;
	return tiers.length > 1 ? `${first} · ยิ่งซื้อมากยิ่งถูก` : first;
}

const thShort = (day, year = false) =>
	new Date(`${day}T00:00:00Z`).toLocaleDateString("th-TH", {
		day: "numeric",
		month: "short",
		...(year ? { year: "numeric" } : {}),
		timeZone: "UTC",
	});

/** ข้อความช่วงโปรโมชั่น เช่น "1–15 ธ.ค." / "28 พ.ย. – 5 ธ.ค." / "ถึง 15 ธ.ค."
 * year: true = ต่อท้ายปี พ.ศ. เช่น "1–15 ธ.ค. 2569" (ใช้ในหน้ารายละเอียดสินค้า) */
export function promoRangeLabel(p, { year = false } = {}) {
	const start = bangkokDay(p?.promo_start);
	const end = bangkokDay(p?.promo_end);
	if (start && end) {
		if (start.slice(0, 7) === end.slice(0, 7)) {
			const [d2, ...rest] = thShort(end, year).split(" ");
			return `${Number(start.slice(8))}–${d2} ${rest.join(" ")}`;
		}
		const sameYear = start.slice(0, 4) === end.slice(0, 4);
		return `${thShort(start, year && !sameYear)} – ${thShort(end, year)}`;
	}
	if (end) return `ถึง ${thShort(end, year)}`;
	if (start) return `ตั้งแต่ ${thShort(start, year)}`;
	return "";
}
