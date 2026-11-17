/* Kiểm thử "Sức khoẻ hệ thống" — phần luật và bộ bọc cron
 * (src/lib/system-runs.ts + src/lib/system-runs-rules.ts).
 *
 * Giữ các điều mà hỏng là theo dõi thành vô dụng hoặc thành spam:
 *   · 401 (sai CRON_SECRET) không ghi, không nhắc;
 *   · cron hỏng → ghi + nhắc admin ĐÚNG MỘT LẦN khi đổi trạng thái;
 *   · cron ném lỗi → ghi rồi NÉM LẠI; route tự báo (sao lưu) thì không báo đôi;
 *   · tóm tắt bị cắt nhỏ; /api/cron/zalo tách tên theo ?only=;
 *   · luật quá hạn, kể cả máy vừa cài (chưa có lượt nào → không đỏ);
 *   · chữ ký lỗi bỏ số / uuid; bộ hãm trong bộ nhớ; lỗi nhiễu bị bỏ qua;
 *   · chưa chạy migration → im lặng, không ném.
 *
 * Chạy: node --experimental-strip-types desktop/test/system-runs.mjs
 */
import { registerHooks } from "node:module";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

/* ── Supabase giả: bảng system_runs trong bộ nhớ ─────────────────────────── */
const T = { rows: [], missing: false, rpc: [], notes: [] };
let seq = 0;
// Giờ THẬT, không phải một ngày cố định: bộ bọc cron gọi alertStaleCrons(db)
// với Date.now() thật. Ngày cố định làm bài này đạt hôm viết rồi tự đỏ hai hôm
// sau (mọi cron giả bỗng "quá hạn" và gửi thêm thông báo).
const clock = { now: Date.now() };
const MISSING = { code: "PGRST205", message: "Could not find the table 'public.system_runs' in the schema cache" };
function runState() {
  const by = new Map();
  for (const r of T.rows) {
    const k = `${r.kind}|${r.name}`;
    const cur = by.get(k);
    if (!cur || r.started_at >= cur.started_at) by.set(k, r);
  }
  const runs = [...by.values()].map((r) => ({
    ...r,
    last_ok_at: T.rows.filter((o) => o.kind === r.kind && o.name === r.name && o.ok).map((o) => o.started_at).sort().pop() ?? null,
  }));
  const cron = T.rows.filter((r) => r.kind === "cron").map((r) => r.started_at).sort();
  return { first_run_at: cron[0] ?? null, runs };
}
globalThis.__stubAdmin = () => ({
  from: (table) => {
    const f = {};
    const q = {
      select: () => q,
      eq: (k, v) => ((f[k] = v), q),
      order: () => q,
      limit: () => q,
      then: (res) => {
        if (T.missing) return res({ data: null, error: MISSING });
        const rows = T.rows.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)).sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
        return res({ data: rows.slice(0, 1), error: null });
      },
      insert: async (row) => {
        if (T.missing) return { error: MISSING };
        if (table === "system_runs") T.rows.push({ ...row, id: ++seq, started_at: new Date(clock.now + seq).toISOString() });
        return { error: null };
      },
    };
    return q;
  },
  rpc: async (fn, args) => {
    T.rpc.push({ fn, args });
    if (T.missing) return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    if (fn === "system_run_state") return { data: runState(), error: null };
    if (fn === "log_system_error") return { data: { count: 1, is_new: T.rpc.filter((c) => c.fn === fn && c.args.p_signature === args.p_signature).length === 1 }, error: null };
    return { data: 0, error: null };
  },
});
globalThis.__notify = (kind, message, opts) => T.notes.push({ kind, message, opts });

const STUBS = {
  "server-only": "export {};",
  "@/lib/supabase/admin": "export const createAdminClient = () => globalThis.__stubAdmin();",
  "@/lib/notify-admin": "export const notifyAdmins = async (...a) => globalThis.__notify(...a);",
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in STUBS) return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
    return next(specifier, context);
  },
});

const R = await import("../../src/lib/system-runs-rules.ts");
const S = await import("../../src/lib/system-runs.ts");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const req = (url = "https://x/api/cron/reminders") => new Request(url);
const cronRows = (name) => T.rows.filter((r) => r.kind === "cron" && r.name === name);

/* ── 1. Bộ bọc cron ──────────────────────────────────────────────────────── */
const r401 = await S.withCronLog("reminders", async () => json({ error: "unauthorized" }, 401))(req());
ok("401 trả nguyên, không ghi, không nhắc", r401.status === 401 && T.rows.length === 0 && T.notes.length === 0);

const good = await S.withCronLog("reminders", async () => json({ ok: true, sent: 3, pushed: 0 }))(req());
ok("lượt tốt: ghi một dòng ok kèm tóm tắt + thời lượng", cronRows("reminders").length === 1 && cronRows("reminders")[0].ok === true && cronRows("reminders")[0].detail.sent === 3 && cronRows("reminders")[0].duration_ms >= 0);
ok("…thân phản hồi vẫn đọc được sau khi bọc", (await good.json()).sent === 3);
ok("…lượt tốt không nhắc ai", T.notes.length === 0);

const bad = S.withCronLog("reminders", async () => json({ ok: false, error: "Resend 500" }, 500));
const rb = await bad(req());
ok("lượt hỏng (500): trả nguyên mã, ghi ok=false", rb.status === 500 && cronRows("reminders").at(-1).ok === false && cronRows("reminders").at(-1).detail.status === 500);
ok("…nhắc admin một lần, có push và link #suc-khoe", T.notes.length === 1 && T.notes[0].kind === "info" && T.notes[0].opts.push === true && T.notes[0].opts.url === "/dashboard/admin/system#suc-khoe" && /Resend 500/.test(T.notes[0].message), JSON.stringify(T.notes));
await bad(req());
await bad(req());
ok("hỏng tiếp các đêm sau: vẫn ghi, KHÔNG nhắc lại", cronRows("reminders").length === 4 && T.notes.length === 1);
await S.withCronLog("reminders", async () => json({ ok: true }))(req());
await bad(req());
ok("tốt lại rồi hỏng lần nữa → nhắc lại (đổi trạng thái)", T.notes.length === 2);

let rethrown = null;
try {
  await S.withCronLog("automations", async () => {
    throw new Error("bùm");
  })(req());
} catch (e) {
  rethrown = e;
}
ok("handler ném lỗi → ghi ok=false rồi NÉM LẠI đúng lỗi đó", rethrown?.message === "bùm" && cronRows("automations")[0]?.ok === false && cronRows("automations")[0].detail.error === "bùm");
ok("…lượt đầu tiên đã hỏng (chưa có lượt trước) cũng nhắc", T.notes.length === 3 && /Việc tự động theo hợp đồng/.test(T.notes[2].message));

const n0 = T.notes.length;
await S.withCronLog("backup", async () => json({ ok: false, error: "Drive" }, 500), { notify: false })(req());
ok("notify:false (sao lưu tự báo) → ghi nhưng không báo đôi", cronRows("backup").length === 1 && T.notes.length === n0);
ok("…sau lượt sao lưu thì gọi dọn nhật ký", T.rpc.some((c) => c.fn === "prune_system_logs"));

const zalo = S.withCronLog((r) => R.zaloCronName(r.url), async () => json({ ok: true }));
await zalo(req("https://x/api/cron/zalo?only=money"));
await zalo(req("https://x/api/cron/zalo?only=work"));
await zalo(req("https://x/api/cron/zalo?only=khac"));
ok("zalo: tên theo ?only= → zalo:money / zalo:work / zalo", cronRows("zalo:money").length === 1 && cronRows("zalo:work").length === 1 && cronRows("zalo").length === 1);

const big = { ok: true, list: Array.from({ length: 500 }, (_, i) => ({ id: i, note: "x".repeat(100) })), text: "y".repeat(5000), n: 7 };
await S.withCronLog("cleanup-proofs", async () => json(big))(req());
const d = cronRows("cleanup-proofs")[0].detail;
ok("tóm tắt bị cắt nhỏ (≤ 2 KB) mà vẫn giữ số liệu", JSON.stringify(d).length <= 2000 && d.n === 7 && d.text.length <= 200, `${JSON.stringify(d).length} byte`);
ok("thân không phải JSON → giữ một đoạn chữ ngắn", R.summarizeText("<html>" + "a".repeat(900)).text.length <= 300);
const wide = R.summarizeBody(Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`k${i}`, "z".repeat(190)])));
ok("nhiều trường dài → vẫn ≤ 2 KB và đánh dấu đã cắt", JSON.stringify(wide).length <= 2000 && wide.truncated === true);

/* ── 2. Chưa chạy migration: im lặng ─────────────────────────────────────── */
T.missing = true;
const before = T.notes.length;
const rm = await S.withCronLog("reminders", async () => json({ ok: false }, 500))(req());
ok("chưa có bảng: cron vẫn trả kết quả, không ném, không nhắc", rm.status === 500 && T.notes.length === before);
const calls = T.rpc.length;
await S.withCronLog("reminders", async () => json({ ok: true }))(req());
ok("…và thôi gõ cửa database ở lượt sau", T.rpc.length === calls);
ok("ghi lỗi khi chưa có hàm → null, không ném", (await S.logSystemError({ source: "server", message: "x", path: "/a" })) === null);
T.missing = false;
await S.loadRunState(globalThis.__stubAdmin()); // admin vừa chạy SQL → mở lại

/* ── 3. Quá hạn ──────────────────────────────────────────────────────────── */
const H = 3600_000;
const now = Date.parse("2026-11-15T12:00:00Z");
const iso = (h) => new Date(now - h * H).toISOString();
const daily = R.CRONS.find((c) => c.name === "reminders");
const weekly = R.CRONS.find((c) => c.name === "cleanup-wedding-photos");
ok("bản kê khớp vercel.json: 8 việc, một việc theo tuần", R.CRONS.length === 8 && weekly.intervalHours === 168 && R.CRONS.filter((c) => c.intervalHours === 24).length === 7);
ok("ngày: tốt 50 giờ trước → chưa quá hạn; 52 giờ → quá hạn (2×24+3)", !R.isCronStale(daily, iso(50), iso(900), now) && R.isCronStale(daily, iso(52), iso(900), now));
ok("tuần: 300 giờ → chưa; 340 giờ → quá hạn (2×168+3)", !R.isCronStale(weekly, iso(300), iso(900), now) && R.isCronStale(weekly, iso(340), iso(900), now));
ok("máy vừa cài (chưa lượt nào của bất kỳ cron nào) → không gì quá hạn", R.cronHealth({ first_run_at: null, runs: [] }, now).every((c) => !c.stale && c.last === null));
ok("mới theo dõi 5 giờ: việc chưa chạy lần nào CHƯA quá hạn", !R.isCronStale(daily, null, iso(5), now));
ok("theo dõi đã 60 giờ mà việc ngày chưa từng chạy tốt → quá hạn", R.isCronStale(daily, null, iso(60), now) && !R.isCronStale(weekly, null, iso(60), now));
const hl = R.cronHealth({ first_run_at: iso(900), runs: [
  { kind: "cron", name: "reminders", ok: false, detail: { error: "Resend 500" }, duration_ms: 1200, started_at: iso(2), last_ok_at: iso(70) },
  { kind: "cron", name: "backup", ok: true, detail: { ok: true, rows: 12, removed: 0 }, duration_ms: 900, started_at: iso(3), last_ok_at: iso(3) },
  { kind: "sql", name: "cap-nhat.sql", ok: true, detail: {}, duration_ms: 1, started_at: iso(1), last_ok_at: iso(1) },
] }, now);
const hr = hl.find((c) => c.name === "reminders");
ok("ghép trạng thái: lượt cuối, câu lỗi, lần tốt gần nhất, quá hạn", hr.last.ok === false && hr.last.summary === "Resend 500" && hr.lastOkAt === iso(70) && hr.stale === true);
ok("…dòng tóm tắt chỉ nêu số khác 0", hl.find((c) => c.name === "backup").last.summary === "rows 12");

/* ── 4. Nhắc quá hạn: mỗi ngày một lần ───────────────────────────────────── */
T.rows = [
  { id: 1, kind: "cron", name: "backup", ok: true, detail: null, duration_ms: 1, started_at: new Date(clock.now - 1 * H).toISOString() },
  { id: 2, kind: "cron", name: "reminders", ok: true, detail: null, duration_ms: 1, started_at: new Date(clock.now - 80 * H).toISOString() },
];
T.notes = [];
await S.alertStaleCrons(globalThis.__stubAdmin(), clock.now);
ok("có việc quá hạn → nhắc admin, nêu tên việc", T.notes.length === 1 && /QUÁ HẠN/.test(T.notes[0].message) && /Email nhắc việc/.test(T.notes[0].message) && T.notes[0].opts.push === true, JSON.stringify(T.notes));
await S.alertStaleCrons(globalThis.__stubAdmin(), clock.now + 2 * H);
ok("gọi lại trong ngày → không nhắc lần hai (dấu kind='alert')", T.notes.length === 1 && T.rows.some((r) => r.kind === "alert"));
await S.alertStaleCrons(globalThis.__stubAdmin(), clock.now + 25 * H);
ok("hôm sau vẫn quá hạn → nhắc lại", T.notes.length === 2);
T.rows = [];
T.notes = [];
await S.alertStaleCrons(globalThis.__stubAdmin(), clock.now);
ok("chưa có lượt nào → không nhắc", T.notes.length === 0);

/* ── 5. Chữ ký lỗi, nhiễu, bộ hãm ────────────────────────────────────────── */
const sig = (m, p) => R.errorSignature("TypeError", m, p);
ok("cùng lỗi khác id / số / uuid → cùng chữ ký",
  sig("Contract 1234 not found for owner 3f2b1c9a-1111-4222-8333-abcdefabcdef", "/api/contracts/55/pay?token=abc") ===
  sig("Contract 9 not found for owner 00000000-aaaa-4bbb-8ccc-000000000000", "/api/contracts/77812/pay"));
ok("khác thông báo hoặc khác route → khác chữ ký", sig("a failed", "/x") !== sig("b failed", "/x") && sig("a failed", "/x") !== sig("a failed", "/y") && R.errorSignature("RangeError", "a", "/x") !== R.errorSignature("TypeError", "a", "/x"));
ok("chữ ký ngắn, chỉ hex", /^[0-9a-f]{16}$/.test(sig("x", "/y")));
ok("chỉ lấy dòng đầu, bỏ chuỗi trong nháy", R.normalizeMessage('Cannot read "abc" of 12\n  at secret') === "Cannot read <s> of <n>");
ok("đường dẫn: bỏ query string, đoạn là id → [id]", R.normalizePath("/portal/9f8a7b6c5d4e3f2a1b0c/x?phone=0901234567#a") === "/portal/[id]/x" && R.stripQuery("/a?token=1") === "/a");
ok("nhiễu: notFound / redirect của Next", R.isNoise({ digest: "NEXT_REDIRECT;replace;/login;307;" }, "/a") && R.isNoise({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }, "/a") && R.isNoise({ digest: "NEXT_NOT_FOUND" }, "/a"));
ok("nhiễu: request bị huỷ", R.isNoise({ name: "AbortError", message: "x" }, "/a") && R.isNoise({ code: "ECONNRESET" }, "/a") && R.isNoise(new Error("The operation was aborted"), "/a"));
ok("nhiễu: mọi thứ dưới /api/cron/", R.isNoise(new Error("x"), "/api/cron/reminders?only=1"));
ok("lỗi thật thì KHÔNG bị coi là nhiễu", !R.isNoise(new TypeError("x is undefined"), "/dashboard") && !R.isNoise({ digest: "2837461" , message: "boom" }, "/a"));

const allow = R.createThrottle();
ok("bộ hãm: cùng chữ ký 1 lần / 60 giây", allow("a", 0) && !allow("a", 59_000) && allow("a", 61_000));
const a2 = R.createThrottle();
let passed = 0;
for (let i = 0; i < 50; i++) if (a2(`s${i}`, 1000 + i)) passed++;
ok("bộ hãm: cả máy tối đa 20 lượt ghi / phút", passed === 20 && a2("moi", 62_000));

/* ── 6. onRequestError: ghi, hãm, nhắc khi MỚI ───────────────────────────── */
T.rpc = [];
T.notes = [];
const ctx = { routePath: "/api/contracts/[id]", routeType: "route" };
await S.captureRequestError(new TypeError("x is undefined"), { path: "/api/contracts/12?token=bi-mat", method: "POST", headers: { cookie: "sb=1" } }, ctx);
const call = T.rpc.find((c) => c.fn === "log_system_error");
ok("lỗi máy chủ → gọi log_system_error với route, không query string", call?.args.p_source === "server" && call.args.p_path === "/api/contracts/[id]" && call.args.p_message === "x is undefined");
ok("…mẫu lưu kèm KHÔNG có cookie / header / token", !/cookie|sb=1|bi-mat/.test(JSON.stringify(call?.args)));
ok("…lỗi mới → nhắc admin (push)", T.notes.length === 1 && T.notes[0].opts.push === true && /x is undefined/.test(T.notes[0].message));
await S.captureRequestError(new TypeError("x is undefined"), { path: "/api/contracts/13", method: "POST" }, ctx);
ok("cùng lỗi ngay sau đó → bị hãm, không ghi lần hai", T.rpc.filter((c) => c.fn === "log_system_error").length === 1);
await S.captureRequestError({ digest: "NEXT_REDIRECT;x" }, { path: "/a" }, {});
await S.captureRequestError(new Error("boom"), { path: "/api/cron/backup" }, {});
ok("nhiễu và lỗi dưới /api/cron/ → không ghi", T.rpc.filter((c) => c.fn === "log_system_error").length === 1);
globalThis.__stubAdmin = () => {
  throw new Error("database chết");
};
let threw = false;
try {
  await S.captureRequestError(new Error("khac han"), { path: "/z" }, {});
} catch {
  threw = true;
}
ok("ghi lỗi mà chính nó hỏng → nuốt, không ném", !threw);

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
