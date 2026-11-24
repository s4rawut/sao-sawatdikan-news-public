import { env } from "cloudflare:workers";

/** ข้อมูลติดต่อร้าน (หลังบ้านร้าน → ตั้งค่า → "ข้อมูลติดต่อร้าน") — ข้อความหลายบรรทัด */
export async function getShopContact(): Promise<string> {
	try {
		const row = await env.DB.prepare("SELECT value FROM shop_settings WHERE key = 'shop_contact'").first<{ value: string }>();
		return (row?.value ?? "").trim();
	} catch {
		// shop tables are created on the first shop API call
		return "";
	}
}

/** ค่าตั้งค่าร้านหลายคีย์ในครั้งเดียว (คีย์ที่ไม่มีในฐานข้อมูลจะไม่อยู่ในผลลัพธ์) */
export async function getShopSettings(keys: string[]): Promise<Record<string, string>> {
	try {
		const { results } = await env.DB.prepare(
			`SELECT key, value FROM shop_settings WHERE key IN (${keys.map(() => "?").join(",")})`,
		)
			.bind(...keys)
			.all<{ key: string; value: string }>();
		return Object.fromEntries(results.map((r) => [r.key, r.value]));
	} catch {
		return {};
	}
}

export type ContactPart = { text: string; tel?: string };

/** แบ่งบรรทัดเป็นข้อความกับเบอร์โทร เพื่อให้เบอร์ไทย (ขึ้นต้น 0, 9–10 หลัก) กดโทรได้
 * "02 271 8000 ต่อ 3205" -> tel:022718000 (ส่วนต่อแสดงเป็นข้อความ) · "08 1234 5678" -> tel:0812345678 */
export function contactParts(line: string): ContactPart[] {
	const parts: ContactPart[] = [];
	const re = /0\d(?:[\s-]?\d){7,8}(?!\d)/g;
	let last = 0;
	for (const m of line.matchAll(re)) {
		if (m.index! > last) parts.push({ text: line.slice(last, m.index) });
		parts.push({ text: m[0], tel: `tel:${m[0].replace(/\D/g, "")}` });
		last = m.index! + m[0].length;
	}
	if (last < line.length) parts.push({ text: line.slice(last) });
	return parts;
}
