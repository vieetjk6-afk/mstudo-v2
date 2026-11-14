/* Kiểm thử bộ đếm chống dò mật khẩu khi CHƯA có Upstash (src/lib/rate-limit.ts).
 *
 * Vì sao. Không cấu hình Upstash thì trước đây cả cửa dò mật khẩu album / SĐT
 * hợp đồng cũng chỉ đếm trong bộ nhớ từng máy chủ serverless — gửi dồn là lọt.
 * Nay bucket failClosed đếm trong Postgres (hàm rate_limit_hit). Bài này giữ:
 *   · bucket failClosed hỏi Postgres, vượt giới hạn thì chặn;
 *   · bucket thường KHÔNG tốn lượt gọi DB nào;
 *   · chưa chạy migration → lùi về bộ nhớ, và không hỏi lại mỗi lượt;
 *   · DB lỗi ở cửa nhạy cảm → chặn (failClosed), không mở toang;
 *   · có Upstash → không đụng Postgres;
 *   · khoá gửi xuống DB đã băm (không chứa IP thô).
 *
 * Chạy: node --experimental-strip-types desktop/test/rate-limit-pg.mjs
 */
import { registerHooks } from "node:module";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

const calls = [];
const counts = new Map();
globalThis.__rpc = { mode: "ok" };
globalThis.__stubAdmin = () => ({
  rpc: async (fn, args) => {
    calls.push({ fn, args });
    if (globalThis.__rpc.mode === "missing") return { data: null, error: { code: "PGRST202", message: "Could not find the function public.rate_limit_hit" } };
    if (globalThis.__rpc.mode === "error") return { data: null, error: { code: "57014", message: "timeout" } };
    const n = (counts.get(args.p_key) ?? 0) + 1;
    counts.set(args.p_key, n);
    return { data: n, error: null };
  },
});

const STUBS = {
  "server-only": "export {};",
  "next/server": "export const NextResponse = { json: (b, i) => ({ body: b, status: i?.status ?? 200 }) };",
  "@/lib/supabase/admin": "export const createAdminClient = () => globalThis.__stubAdmin();",
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in STUBS) return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
    return next(specifier, context);
  },
});

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const { durableAllowed, rateLimitMode } = await import("../../src/lib/rate-limit.ts");

// 1) failClosed → Postgres, chặn khi vượt
const r1 = [];
for (let i = 0; i < 4; i++) r1.push(await durableAllowed("album-pw:abc:1.2.3.4", 3, 60_000, true));
ok("cửa nhạy cảm đếm trong Postgres: 3 lượt qua, lượt 4 bị chặn", r1.join() === "true,true,true,false", r1.join());
ok("khoá gửi xuống DB đã băm, không chứa IP / token thô", calls.every((c) => !/1\.2\.3\.4|abc/.test(c.args.p_key) && c.args.p_key.length <= 32));
ok("cửa sổ gửi xuống tính bằng giây", calls[0]?.args.p_window_seconds === 60);

// 2) bucket thường → không gọi DB
const before = calls.length;
await durableAllowed("chat:1.2.3.4", 100, 60_000, false);
ok("bucket thường (chống spam) không tốn lượt gọi DB", calls.length === before);

// 3) DB lỗi ở cửa nhạy cảm → chặn
globalThis.__rpc.mode = "error";
ok("DB lỗi ở cửa nhạy cảm → chặn tạm, không mở toang", (await durableAllowed("c-portal:t:9.9.9.9", 20, 60_000, true)) === false);

// 4) chưa chạy migration → bộ nhớ, và thôi hỏi lại
globalThis.__rpc.mode = "missing";
const m1 = await durableAllowed("gallery-pw:x:5.5.5.5", 2, 60_000, true);
const n1 = calls.length;
const m2 = await durableAllowed("gallery-pw:x:5.5.5.5", 2, 60_000, true);
const m3 = await durableAllowed("gallery-pw:x:5.5.5.5", 2, 60_000, true);
ok("chưa chạy SQL → vẫn giới hạn bằng bộ nhớ (2 qua, lượt 3 chặn)", m1 && m2 && !m3);
ok("…và không gọi lại hàm thiếu ở mỗi lượt", calls.length === n1);
ok("trang Quản trị báo 'memory' khi chưa chạy SQL", (await rateLimitMode()) === "memory");
globalThis.__rpc.mode = "ok";
ok("chạy SQL xong → trang Quản trị thấy 'postgres' ngay", (await rateLimitMode()) === "postgres");

// 5) có Upstash → không đụng Postgres
process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
process.env.UPSTASH_REDIS_REST_TOKEN = "t";
globalThis.fetch = async () => ({ ok: true, json: async () => [{ result: 1 }, { result: 1 }] });
const b5 = calls.length;
ok("có Upstash → dùng Upstash", (await durableAllowed("album-pw:z:7.7.7.7", 3, 60_000, true)) === true && calls.length === b5);
ok("trang Quản trị báo 'upstash'", (await rateLimitMode()) === "upstash");

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
