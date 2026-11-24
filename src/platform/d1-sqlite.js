/**
 * D1-compatible wrapper over Node's built-in SQLite (node:sqlite), for the self-hosted (Node.js) build.
 *
 * The shop code and a few pages were written against Cloudflare D1:
 *   env.DB.prepare(sql).bind(...args).first() / .all() / .run() / .raw()
 *   env.DB.batch([stmt, ...])   — all-or-nothing (one transaction)
 *   env.DB.exec(sql)
 * This module gives the same surface on a SQLite file, so that code runs unchanged on a normal server.
 * It opens the same database file EmDash uses (WAL mode, so both connections can work side by side).
 */
import { DatabaseSync } from "node:sqlite";

/** D1 accepts booleans and undefined; node:sqlite does not */
const toParam = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
/** Statements that return rows (SELECT, PRAGMA, WITH … SELECT, anything with RETURNING) */
const returnsRows = (sql) => /^\s*(select|pragma|with|values)\b/i.test(sql) || /\breturning\b/i.test(sql);

class Statement {
	constructor(db, sql, params = []) {
		this.db = db;
		this.sql = sql;
		this.params = params;
	}
	bind(...args) {
		return new Statement(this.db, this.sql, args.map(toParam));
	}
	#stmt() {
		return this.db.cache(this.sql);
	}
	/** Runs the statement; returns D1's result shape */
	#exec() {
		const stmt = this.#stmt();
		if (returnsRows(this.sql)) {
			const results = stmt.all(...this.params);
			const changes = /^\s*(insert|update|delete|replace)\b/i.test(this.sql) ? results.length : 0;
			return { results, success: true, meta: { changes, last_row_id: 0, rows_read: results.length, rows_written: changes } };
		}
		const r = stmt.run(...this.params);
		return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid), rows_written: Number(r.changes) } };
	}
	async first(column) {
		const row = this.#stmt().get(...this.params) ?? null;
		if (row && column !== undefined) return row[column] ?? null;
		return row;
	}
	async all() {
		return this.#exec();
	}
	async run() {
		return this.#exec();
	}
	async raw(options = {}) {
		const stmt = this.#stmt();
		stmt.setReturnArrays?.(true);
		try {
			const rows = stmt.all(...this.params);
			if (options.columnNames) return [stmt.columns().map((c) => c.name), ...rows];
			return rows;
		} finally {
			stmt.setReturnArrays?.(false);
		}
	}
	/** Used by batch(): synchronous, inside the caller's transaction */
	execSync() {
		return this.#exec();
	}
}

export class D1Sqlite {
	constructor(file) {
		this.db = new DatabaseSync(file);
		this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
		this.statements = new Map();
	}
	cache(sql) {
		let s = this.statements.get(sql);
		if (!s) {
			s = this.db.prepare(sql);
			if (this.statements.size > 500) this.statements.clear();
			this.statements.set(sql, s);
		}
		return s;
	}
	prepare(sql) {
		return new Statement(this, sql);
	}
	/** All statements in one transaction: any error rolls every statement back (like D1) */
	async batch(statements) {
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const out = statements.map((s) => s.execSync());
			this.db.exec("COMMIT");
			return out;
		} catch (e) {
			try { this.db.exec("ROLLBACK"); } catch {}
			throw e;
		}
	}
	async exec(sql) {
		this.db.exec(sql);
		return { count: 0, duration: 0 };
	}
	/** D1 sessions API is not needed on one server */
	withSession() {
		return this;
	}
}
