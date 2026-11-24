const bahtFormat = new Intl.NumberFormat("th-TH", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

/** ฿1,234 or ฿99.50 */
export const baht = (n: number | null | undefined) => `฿${bahtFormat.format(n ?? 0)}`;

/** หมวดของสินค้าสวัสดิการเดิม: ไม่แสดงในหน้าแรกและหน้าร้านค้า แต่ขายได้จากหน้า "อื่นๆ" (/pages/others) */
export const OTHER_CATEGORY = "สินค้าอื่นๆ";
