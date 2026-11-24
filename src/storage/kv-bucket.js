/**
 * Lets a Workers KV namespace stand in for an R2 bucket.
 *
 * The test deployment has no R2 (it needs a card on the Cloudflare account),
 * so its MEDIA binding is a KV namespace instead. This wraps it in the small
 * part of the R2Bucket API that EmDash's storage adapter and the shop use:
 * put / get / head / delete / list. Local dev keeps its real R2 bucket, which
 * passes through untouched.
 *
 * Limits that come with KV: 25 MB per file, and on the free plan 1,000 writes
 * a day. Fine for a test site; switch back to R2 for production.
 */

/** True for an R2 bucket, false for a KV namespace */
const isR2 = (binding) => typeof binding?.createMultipartUpload === "function";

const toBytes = async (body) => {
	if (body instanceof ArrayBuffer) return body;
	if (ArrayBuffer.isView(body)) return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
	return new Response(body).arrayBuffer();
};

function objectFrom(key, meta, bytes) {
	const httpMetadata = { contentType: meta?.contentType, cacheControl: meta?.cacheControl };
	const base = {
		key,
		size: meta?.size ?? bytes?.byteLength ?? 0,
		uploaded: new Date(meta?.uploaded ?? 0),
		etag: meta?.etag ?? "",
		httpMetadata,
	};
	if (!bytes) return base;
	return {
		...base,
		get body() {
			return new Response(bytes).body;
		},
		arrayBuffer: async () => bytes,
	};
}

export function kvBucket(kv) {
	if (!kv || isR2(kv)) return kv;
	return {
		async put(key, body, options = {}) {
			const bytes = await toBytes(body);
			const meta = {
				contentType: options.httpMetadata?.contentType,
				cacheControl: options.httpMetadata?.cacheControl,
				size: bytes.byteLength,
				uploaded: Date.now(),
				etag: crypto.randomUUID(),
			};
			await kv.put(key, bytes, { metadata: meta });
			return objectFrom(key, meta);
		},
		async get(key, options) {
			// KV can't read part of a value; failing here makes EmDash fall back to a full read
			if (options?.range) throw new Error("KV storage does not support byte ranges");
			const { value, metadata } = await kv.getWithMetadata(key, { type: "arrayBuffer" });
			return value === null ? null : objectFrom(key, metadata, value);
		},
		async head(key) {
			// list() returns metadata without reading the value, but it is eventually consistent:
			// a file written seconds ago (EmDash confirms right after the upload) may not be listed yet
			const { keys } = await kv.list({ prefix: key, limit: 1 });
			const hit = keys.find((k) => k.name === key);
			if (hit) return objectFrom(key, hit.metadata);
			// so on a miss, ask for the key itself: get() sees this location's own recent writes.
			// Stream type, cancelled straight away, so the file body is not read.
			const { value, metadata } = await kv.getWithMetadata(key, { type: "stream" });
			if (value === null) return null;
			await value.cancel();
			return objectFrom(key, metadata);
		},
		async delete(keys) {
			await Promise.all([].concat(keys).map((k) => kv.delete(k)));
		},
		async list(options = {}) {
			const r = await kv.list({ prefix: options.prefix, limit: options.limit, cursor: options.cursor });
			return {
				objects: r.keys.map((k) => objectFrom(k.name, k.metadata)),
				truncated: !r.list_complete,
				cursor: r.list_complete ? undefined : r.cursor,
			};
		},
	};
}
