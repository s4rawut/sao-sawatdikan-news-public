import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

/** Visitor counter for the footer: one row per day (Bangkok time). */
const SCHEMA = `CREATE TABLE IF NOT EXISTS site_visits (
	day TEXT PRIMARY KEY,
	count INTEGER NOT NULL DEFAULT 0
)`;

const bangkokDay = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

async function counts(db: D1Database, day: string) {
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN day = ?1 THEN count END), 0) AS today,
				COALESCE(SUM(CASE WHEN substr(day, 1, 7) = substr(?1, 1, 7) THEN count END), 0) AS month,
				COALESCE(SUM(count), 0) AS total
			FROM site_visits`,
		)
		.bind(day)
		.first<{ today: number; month: number; total: number }>();
	return row ?? { today: 0, month: 0, total: 0 };
}

const json = (data: unknown) =>
	new Response(JSON.stringify(data), {
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

/** POST {new: true} counts this browser once for today; either way returns the totals. */
export const POST: APIRoute = async ({ request, url }) => {
	// Only this site's own pages may count a visit (stops other sites inflating the counter)
	const origin = request.headers.get("origin");
	const site = request.headers.get("sec-fetch-site");
	if ((origin && origin !== url.origin) || (!origin && site && site !== "same-origin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const db = env.DB;
	const day = bangkokDay();
	await db.prepare(SCHEMA).run();
	const body = (await request.json().catch(() => ({}))) as { new?: boolean };
	if (body.new) {
		await db
			.prepare(
				"INSERT INTO site_visits (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1",
			)
			.bind(day)
			.run();
	}
	return json({ day, ...(await counts(db, day)) });
};
