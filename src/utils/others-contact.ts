import { env } from "cloudflare:workers";

/** How to order "สินค้าอื่นๆ" (not sold through the shop): set under shop-admin → ตั้งค่า,
 * or per product (legacy_products fields contact_line / contact_phone / contact_name) */
export interface OthersContact {
	lineUrl: string;
	/** LINE ID to show on the button, e.g. "@saoshop" (empty when only a link was given) */
	lineId?: string;
	phone: string;
	/** who to contact, e.g. "คุณสมศรี ฝ่ายสวัสดิการ" */
	name?: string;
}

/** LINE value from the admin -> link + shown ID
 * "https://lin.ee/abc" -> link as-is · "@saoshop" -> official account link · "somsri" -> personal ID link */
export function lineContact(value: string | null | undefined): { lineUrl: string; lineId: string } {
	const v = (value ?? "").trim();
	if (!v) return { lineUrl: "", lineId: "" };
	// only real web links, so a pasted value can never become a javascript: link
	if (/^https:\/\/\S+$/i.test(v)) return { lineUrl: v, lineId: "" };
	const id = v.replace(/^line\s*(id)?\s*[:：]?\s*/i, "");
	if (!/^@?[\w.\-]{2,40}$/.test(id)) return { lineUrl: "", lineId: "" };
	return {
		lineUrl: id.startsWith("@")
			? `https://line.me/R/ti/p/${encodeURIComponent(id)}`
			: `https://line.me/ti/p/~${encodeURIComponent(id)}`,
		lineId: id,
	};
}

/** Contact for one "สินค้าอื่นๆ" item: its own LINE/phone if set, otherwise the shop-wide one */
export async function getProductContact(p: {
	contact_line?: string | null;
	contact_phone?: string | null;
	contact_name?: string | null;
}): Promise<OthersContact> {
	const line = lineContact(p.contact_line);
	const phone = (p.contact_phone ?? "").trim();
	const name = (p.contact_name ?? "").trim();
	if (line.lineUrl || phone) return { ...line, phone, name };
	return { ...(await getOthersContact()), name };
}

export async function getOthersContact(): Promise<OthersContact> {
	let rows: { key: string; value: string }[] = [];
	try {
		const r = await env.DB.prepare(
			"SELECT key, value FROM shop_settings WHERE key IN ('others_line_url', 'others_phone')",
		).all<{ key: string; value: string }>();
		rows = r.results;
	} catch {
		// shop tables are created on the first shop API call
	}
	const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
	// ลิงก์ https หรือ LINE ID (@xxx) — lineContact ไม่ยอมให้กลายเป็นลิงก์ javascript:
	return { ...lineContact(get("others_line_url")), phone: get("others_phone") };
}

/** "02-271-8000 ต่อ 1234" -> "tel:022718000" (the part before any extension) */
export const telHref = (phone: string) => `tel:${phone.split(/ต่อ|ext|#|,/i)[0].replace(/[^\d+]/g, "")}`;
