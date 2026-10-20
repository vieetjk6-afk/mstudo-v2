/* Kiểm thử danh sách nguồn AI nhập trong trang quản trị (src/lib/vieetjk/provider-input.ts).
 *
 * Vì sao đáng test: trình duyệt KHÔNG BAO GIỜ nhận lại khoá đầy đủ, nên mỗi lần
 * lưu, máy chủ phải tự ghép khoá cũ vào đúng mục. Ghép nhầm là key của nguồn
 * này chạy sang nguồn kia (hoặc mất key) mà màn hình vẫn báo "Đã lưu". Và địa
 * chỉ API là URL người dùng gõ mà máy chủ tự gọi kèm API key — chặn sai là SSRF.
 */
import {
  mergeProviderInput,
  parseStoredList,
  pickProviders,
  maskKey,
  toPublic,
  checkBaseUrl,
  withLabels,
  parseProviderList,
} from "../../src/lib/vieetjk/provider-input.ts";
import { classifyProviderError, keyAlert } from "../../src/lib/vieetjk/provider-alert-rules.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};

let n = 0;
const newId = () => `id${++n}`;

const saved = [
  { id: "aaa", type: "anthropic", key: "sk-ant-api03-SECRET-1111", model: "claude-haiku-5-5", effort: "low", label: "" },
  { id: "bbb", type: "gemini", key: "AIzaSyGEMINI-SECRET-2222", model: "gemini-flash-latest", label: "Gemini free" },
];

/* ── Ghép khoá cũ ───────────────────────────────────────────────────────── */
{
  // Đổi thứ tự + để trống ô khoá → mỗi mục giữ đúng khoá của nó.
  const r = mergeProviderInput(
    saved,
    [
      { id: "bbb", type: "gemini", model: "gemini-flash-latest", key: "" },
      { id: "aaa", type: "anthropic", model: "claude-sonnet-5-5", key: "", effort: "medium" },
    ],
    newId
  );
  check("lưu thành công", r.ok, true);
  check("đảo thứ tự giữ đúng khoá", r.list.map((p) => [p.id, p.key]), [
    ["bbb", "AIzaSyGEMINI-SECRET-2222"],
    ["aaa", "sk-ant-api03-SECRET-1111"],
  ]);
  check("đổi model vẫn giữ khoá", r.list[1].model, "claude-sonnet-5-5");
}
{
  // Nhập khoá mới → thay khoá cũ.
  const r = mergeProviderInput(saved, [{ id: "aaa", type: "anthropic", model: "claude-haiku-5-5", key: " sk-ant-NEW-9999 " }], newId);
  check("khoá mới thay khoá cũ (đã trim)", r.list[0].key, "sk-ant-NEW-9999");
}
{
  // Mục mới không có khoá → lỗi rõ ràng, chỉ đúng số thứ tự.
  const r = mergeProviderInput(saved, [{ id: "aaa", type: "anthropic", model: "m", key: "" }, { type: "openai", model: "gpt-4o-mini", key: "" }], newId);
  check("mục mới thiếu khoá bị chặn", r, { ok: false, error: "Nguồn #2: chưa nhập API key." });
}
{
  // id lạ (không có trong danh sách đã lưu) → không được mượn khoá ai cả.
  const r = mergeProviderInput(saved, [{ id: "zzz", type: "openai", model: "x", key: "" }], newId);
  check("id lạ không mượn được khoá", r.ok, false);
}
{
  // Hai mục cùng gửi một id (copy/dán) → chỉ mục đầu giữ khoá cũ.
  const r = mergeProviderInput(
    saved,
    [
      { id: "aaa", type: "anthropic", model: "m1", key: "" },
      { id: "aaa", type: "anthropic", model: "m2", key: "" },
    ],
    newId
  );
  check("id trùng: mục thứ hai phải nhập khoá", r, { ok: false, error: "Nguồn #2: chưa nhập API key." });
}
{
  const r = mergeProviderInput(saved, [{ type: "openai", model: "gpt-4o-mini", key: "sk-abc def" }], newId);
  check("khoá có dấu cách bị chặn", r.ok, false);
  check("loại lạ bị chặn", mergeProviderInput([], [{ type: "llama", model: "x", key: "k" }], newId).ok, false);
  check("thiếu model bị chặn", mergeProviderInput([], [{ type: "openai", model: " ", key: "k" }], newId).ok, false);
  check("mức suy nghĩ lạ bị chặn", mergeProviderInput([], [{ type: "anthropic", model: "x", key: "k", effort: "ultra" }], newId).ok, false);
  check("quá 10 nguồn bị chặn", mergeProviderInput([], Array(11).fill({ type: "openai", model: "x", key: "k" }), newId).ok, false);
  check("không phải mảng bị chặn", mergeProviderInput([], { type: "openai" }, newId).ok, false);
}
{
  const r = mergeProviderInput([], [{ type: "openai", model: "x", key: "k", baseUrl: "https://openrouter.ai/api/v1/" }], newId);
  check("địa chỉ API bỏ dấu / cuối", r.list[0].baseUrl, "https://openrouter.ai/api/v1");
  check("mục mới được cấp id", typeof r.list[0].id === "string" && r.list[0].id.length > 0, true);
  check("nhãn trống giữ trống (để tự đi theo model)", r.list[0].label, "");
}

/* ── Chặn địa chỉ nội bộ ────────────────────────────────────────────────── */
check("https công khai hợp lệ", checkBaseUrl("https://api.meta.ai/v1"), { ok: true, value: "https://api.meta.ai/v1" });
check("để trống = mặc định của hãng", checkBaseUrl(""), { ok: true });
check("bỏ query string", checkBaseUrl("https://api.x.ai/v1?a=1#b").value, "https://api.x.ai/v1");
for (const bad of [
  "http://api.openai.com/v1",
  "https://localhost/v1",
  "https://127.0.0.1/v1",
  "https://169.254.169.254/latest",
  "https://10.0.0.5/v1",
  "https://[::1]/v1",
  "https://[::ffff:127.0.0.1]/v1",
  "https://db.internal/v1",
  "https://user:pass@api.openai.com/v1",
  "api.openai.com",
]) {
  check(`chặn ${bad}`, checkBaseUrl(bad).ok, false);
}

/* ── Thứ tự bot thử ─────────────────────────────────────────────────────── */
const A = { type: "anthropic", key: "a", model: "m", label: "a" };
const B = { type: "gemini", key: "b", model: "m", label: "b" };
const E = { type: "gemini", key: "e", model: "m", label: "e" };
check("key riêng → key chung", pickProviders({ own: [A], sharedDb: [B], env: [E] }).map((p) => p.key), ["a", "b"]);
check("key chung trống → biến môi trường", pickProviders({ own: [A], sharedDb: [], env: [E] }).map((p) => p.key), ["a", "e"]);
check("không có key riêng → chỉ key chung", pickProviders({ own: [], sharedDb: [B], env: [E] }).map((p) => p.key), ["b"]);
check("không có gì → rỗng", pickProviders({ own: [], sharedDb: [], env: [] }), []);

/* ── Đọc dữ liệu đã lưu / che khoá ──────────────────────────────────────── */
check(
  "bỏ mục hỏng khi đọc DB",
  parseStoredList([...saved, { id: "ccc", type: "openai", model: "x" }, { type: "openai", key: "k", model: "x" }, null]).map((p) => p.id),
  ["aaa", "bbb"]
);
check("nhãn mặc định khi dùng", withLabels(parseStoredList(saved), "riêng/").map((p) => p.label), [
  "riêng/anthropic:claude-haiku-5-5",
  "riêng/Gemini free",
]);
check("che khoá dài", maskKey("sk-ant-api03-SECRET-1111"), "sk-ant…1111");
check("che hết khoá ngắn", maskKey("abc123"), "••••");
check("bản gửi trình duyệt không có khoá", toPublic(saved).some((p) => "key" in p || JSON.stringify(p).includes("SECRET")), false);

/* ── CHAT_PROVIDERS trên Vercel vẫn đọc như cũ ──────────────────────────── */
check(
  "biến môi trường cũ",
  parseProviderList([{ type: "gemini", key: "AIza" }, { type: "openai", key: "sk", model: "deepseek/deepseek-chat", baseUrl: "https://openrouter.ai/api/v1/" }, { type: "x" }]).map((p) => [p.type, p.model, p.baseUrl ?? null]),
  [
    ["gemini", "gemini-flash-latest", null],
    ["openai", "deepseek/deepseek-chat", "https://openrouter.ai/api/v1"],
  ]
);

/* ── Key hết tiền / hỏng → báo đúng người; lỗi thoáng qua thì im ─────────── */
// Thân lỗi thật (rút gọn) của từng nhà cung cấp.
const ERR = {
  claudeCredit: '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
  claudeRate: '{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}',
  claudeOverloaded: '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
  claudeAuth: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
  openaiQuota: '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}',
  openaiRate: '{"error":{"message":"Rate limit reached for gpt-4o-mini on requests per min (RPM): Limit 3. Please try again in 20s.","type":"requests","code":"rate_limit_exceeded"}}',
  openrouter: '{"error":{"message":"Insufficient credits. Add more using https://openrouter.ai/credits","code":402}}',
  deepseek: '{"error":{"message":"Insufficient Balance","type":"unknown_error"}}',
  geminiMinute: '[{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. Please retry in 41s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}]}}]',
  geminiDay: '[{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}]',
  geminiBadKey: '[{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}]',
};
check(
  "nhận ra hết tiền / key hỏng",
  [
    classifyProviderError("anthropic", 400, ERR.claudeCredit),
    classifyProviderError("anthropic", 402, ""),
    classifyProviderError("anthropic", 401, ERR.claudeAuth),
    classifyProviderError("openai", 429, ERR.openaiQuota),
    classifyProviderError("openai", 402, ERR.openrouter),
    classifyProviderError("openai", 402, ERR.deepseek),
    classifyProviderError("gemini", 429, ERR.geminiDay),
    classifyProviderError("gemini", 400, ERR.geminiBadKey),
    classifyProviderError("responses", 403, ""),
  ],
  ["no_credit", "no_credit", "bad_key", "no_credit", "no_credit", "no_credit", "no_credit", "bad_key", "bad_key"]
);
check(
  "lỗi thoáng qua thì không báo",
  [
    classifyProviderError("anthropic", 429, ERR.claudeRate),
    classifyProviderError("anthropic", 529, ERR.claudeOverloaded),
    classifyProviderError("openai", 429, ERR.openaiRate),
    classifyProviderError("gemini", 429, ERR.geminiMinute),
    classifyProviderError("openai", 500, "billing"),
    classifyProviderError("openai", 404, '{"error":{"message":"The model `gpt-9` does not exist"}}'),
    classifyProviderError("openai", 200, ""),
  ],
  [null, null, null, null, null, null, null]
);

const shared = { type: "anthropic", key: "sk-ant-api03-SECRET-9876", model: "claude-haiku-5-5", label: "Claude chính", scope: "shared" };
const own = { ...shared, label: "riêng/Claude studio", scope: "studio" };
const env = { type: "gemini", key: "AIzaSyENV-SECRET-5555", model: "gemini-flash-latest", label: "gemini", scope: "env" };
{
  const a = keyAlert({ provider: shared, status: 400, body: ERR.claudeCredit });
  check("key chung → báo admin, trỏ trang Hệ thống", [a.audience, a.kind, a.url], ["admins", "ai_key_shared", "/dashboard/admin/system"]);
  check("thông báo nêu đúng key mà không lộ key", [a.message.includes("Claude chính"), a.message.includes("sk-ant…9876"), a.message.includes("SECRET")], [true, true, false]);
  check("thông báo không đổi giữa các lần (khoá chống báo trùng)", keyAlert({ provider: shared, status: 400, body: ERR.claudeCredit.replace("Billing", "billing") }).message, a.message);
}
{
  const a = keyAlert({ provider: own, status: 401, body: ERR.claudeAuth });
  check("key riêng → báo chủ studio, trỏ trang Chatbox", [a.audience, a.kind, a.url], ["studio", "ai_key_own", "/dashboard/studio/chatbox"]);
  check("bỏ tiền tố riêng/ khỏi tên", [a.message.includes("“Claude studio”"), a.message.includes("riêng/")], [true, false]);
}
{
  const a = keyAlert({ provider: env, status: 429, body: ERR.geminiDay });
  check("key trong biến môi trường → báo admin", [a.audience, a.message.includes("biến môi trường Vercel")], ["admins", true]);
}
check("lỗi thoáng qua → không có thông báo", keyAlert({ provider: shared, status: 529, body: ERR.claudeOverloaded }), null);

if (fail) {
  console.log(`\n${fail} kiểm thử lỗi`);
  process.exit(1);
}
console.log("\nTất cả kiểm thử đều qua.");
