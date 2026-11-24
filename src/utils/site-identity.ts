/** Resolved media reference from getSiteSettings() */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface BlogSiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
	favicon?: MediaReference;
}

const DEFAULT_SITE_TITLE = "สวัสดิการ สตง.";
const DEFAULT_SITE_TAGLINE =
	"ข่าวสารและสิทธิประโยชน์สวัสดิการ สำหรับบุคลากรสำนักงานการตรวจเงินแผ่นดิน";
/** English line under the Thai name in the masthead */
const SITE_SUBTITLE = "Welfare · State Audit Office of the Kingdom of Thailand";

/** Seal shown when no logo is uploaded in the admin */
export const DEFAULT_LOGO = "/logo.png";
/** Footer: contact details and site status (edit to match the real office) */
export const CONTACT = {
	/** ชื่อหน่วยงานตัวหนาในส่วนท้าย และในบรรทัดสงวนลิขสิทธิ์ */
	org: "สวัสดิการ สำนักงานการตรวจเงินแผ่นดิน",
	address:
		"สำนักงานการตรวจเงินแผ่นดิน เลขที่ 9 ถนนพระรามที่ 6 แขวงพญาไท เขตพญาไท กรุงเทพมหานคร 10400",
	phone: "0 2271 8000 ต่อ 8203 หรือ 1206",
	email: "welfare@example.go.th",
};
/** ลิงก์นโยบายในส่วนท้าย (ใช้หน้านโยบายของ สตง.) */
export const POLICY_LINKS = [
	{
		label: "นโยบายเว็บไซต์",
		href: "https://www.audit.go.th/th/%E0%B8%99%E0%B9%82%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%A2%E0%B9%80%E0%B8%A7%E0%B9%87%E0%B8%9A%E0%B9%84%E0%B8%8B%E0%B8%95%E0%B9%8C%E0%B8%82%E0%B8%AD%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%95%E0%B8%A3%E0%B8%A7%E0%B8%88%E0%B9%80%E0%B8%87%E0%B8%B4%E0%B8%99%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%94%E0%B8%B4%E0%B8%99",
	},
	{
		label: "นโยบายคุ้มครองข้อมูลส่วนบุคคล",
		href: "https://www.audit.go.th/th/%E0%B8%99%E0%B9%82%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%A2%E0%B8%84%E0%B8%B8%E0%B9%89%E0%B8%A1%E0%B8%84%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%9A%E0%B8%B8%E0%B8%84%E0%B8%84%E0%B8%A5",
	},
];
/** Footer: show the contact email next to the phone (hidden for now — set true to show it again) */
export const SHOW_FOOTER_EMAIL = false;

/** Pill under the footer description; set to "" to hide it */
export const SITE_STATUS = "";


export function resolveBlogSiteIdentity(settings?: BlogSiteIdentitySettings) {
	return {
		siteTitle: settings?.title ?? DEFAULT_SITE_TITLE,
		siteTagline: settings?.tagline ?? DEFAULT_SITE_TAGLINE,
		siteSubtitle: SITE_SUBTITLE,
		siteLogo: settings?.logo?.url ? settings.logo : null,
	};
}
