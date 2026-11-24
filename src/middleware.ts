import { defineMiddleware } from "astro:middleware";
import { isShopPrivateMedia, privateMediaNotFound } from "./shop/private-media";
import { GATE_PATH, gateEnabled, gateRedirect, handleGate, hasGatePass, isGateExempt } from "./site-gate";

export const onRequest = defineMiddleware(async (context, next) => {
	const { request, url } = context;
	// Keep payment slips off EmDash's public media route (see src/shop/private-media.ts)
	if (isShopPrivateMedia(url.pathname)) return privateMediaNotFound();

	// ด่านรหัสผ่านทั้งเว็บ ให้เฉพาะคนภายในเข้าดู (src/site-gate.ts) — ปิดอยู่ถ้าไม่ได้ตั้ง secret
	if (gateEnabled()) {
		if (url.pathname === GATE_PATH) return handleGate(request, url);
		if (!isGateExempt(url.pathname) && !(await hasGatePass(request, url))) return gateRedirect(request, url);
	}
	return next();
});
