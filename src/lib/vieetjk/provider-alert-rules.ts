import { maskKey } from "./provider-input";
import { AI_KEY_ADMIN_URL, AI_KEY_STUDIO_URL, type ChatProvider } from "./provider-types";

/* ═══════════════════════════════════════════════════════════════════════════
   BÁO KEY AI HẾT TIỀN / HỎNG — phần logic THUẦN (đọc lỗi, soạn thông báo).

   Bot tự chuyển sang nguồn kế tiếp khi một key lỗi, nên key hết tiền có thể
   nằm im hàng tuần mà không ai biết — cho tới khi nguồn cuối cùng cũng cạn và
   chatbox chỉ còn trả "Trợ lý đang hơi bận". Ở đây quyết định lỗi nào CẦN
   NGƯỜI RA TAY (nạp tiền, thay key) để báo, còn lỗi thoáng qua (gọi quá dồn
   dập, máy chủ nhà cung cấp quá tải) thì bỏ qua.

   Phần gửi (DB + push, chống báo trùng) nằm ở provider-alert.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

export type KeyProblem = "no_credit" | "bad_key";

/** Một lần gọi nguồn AI bị từ chối — `body` là thân phản hồi lỗi (đã cắt ngắn). */
export type ProviderFailure = { provider: ChatProvider; status: number; body: string };

/**
 * Hết tiền / hết hạn mức trả phí, theo câu báo của từng nhà cung cấp:
 *   Claude 400 "Your credit balance is too low…" (hoặc 402 billing_error) ·
 *   OpenAI 429 code insufficient_quota · OpenRouter 402 "Insufficient credits" ·
 *   DeepSeek 402 "Insufficient Balance".
 */
const NO_CREDIT =
  /credit balance (is )?too low|billing_error|insufficient[ _-]?(quota|credits?|balance|funds)|out of credits|payment required/i;

/** OpenAI hết quota trả phí. Gemini dùng ĐÚNG câu này cho cả hạn mức từng phút nên chỉ áp cho nguồn khác Gemini. */
const OPENAI_QUOTA = /exceeded your current quota/i;

/** Gemini hết hạn mức của CẢ NGÀY (QuotaFailure …PerDay…). Hạn mức từng phút tự hồi sau vài giây, không báo. */
const GEMINI_DAILY = /per ?day/i;

const BAD_KEY =
  /api[ _-]?key[ _-]?(not valid|invalid|expired)|API_KEY_INVALID|invalid[ _-]api[ _-]?key|invalid x-api-key|incorrect api key/i;

/**
 * Lỗi này có cần admin / chủ studio ra tay không. null = lỗi thoáng qua hoặc
 * không phải chuyện của key (gọi dồn dập 429, máy chủ 5xx/529, sai model 404…).
 */
export function classifyProviderError(type: ChatProvider["type"], status: number, body: string): KeyProblem | null {
  if (status < 400 || status >= 500) return null;
  const b = body || "";
  if (status === 402 || NO_CREDIT.test(b)) return "no_credit";
  if (type === "gemini") {
    if (status === 429 && GEMINI_DAILY.test(b)) return "no_credit";
  } else if (OPENAI_QUOTA.test(b)) {
    return "no_credit";
  }
  if (status === 401 || status === 403 || BAD_KEY.test(b)) return "bad_key";
  return null;
}

export type KeyAlert = {
  /** "admins": key chung / biến môi trường · "studio": key riêng của studio. */
  audience: "admins" | "studio";
  kind: "ai_key_shared" | "ai_key_own";
  title: string;
  /** Câu thông báo — cũng là khoá chống báo trùng, nên KHÔNG chứa gì thay đổi theo từng lần gọi. */
  message: string;
  url: string;
};

const PROBLEM_TEXT: Record<KeyProblem, string> = {
  no_credit: "đã hết tiền / hết hạn mức",
  bad_key: "không còn dùng được (sai key, bị khoá hoặc hết hạn)",
};

/** Thông báo cho một lần gọi lỗi, hoặc null khi lỗi không cần ai ra tay. */
export function keyAlert(f: ProviderFailure): KeyAlert | null {
  const problem = classifyProviderError(f.provider.type, f.status, f.body);
  if (!problem) return null;
  const p = f.provider;
  const name = p.label.replace(/^riêng\//, "") || `${p.type}:${p.model}`;
  // Nhận ra đúng key nào mà không lộ key: loại · model · khoá đã che.
  const which = `“${name}” (${p.type} · ${p.model} · ${maskKey(p.key)})`;
  const what = `${PROBLEM_TEXT[problem]} — HTTP ${f.status}`;
  const fix = problem === "no_credit" ? "Nạp thêm tiền hoặc thay key khác" : "Thay key mới";

  if (p.scope === "studio") {
    return {
      audience: "studio",
      kind: "ai_key_own",
      title: "Key AI riêng cần xử lý",
      message: `Key AI riêng của studio ${which} ${what}. ${fix} ở trang Chatbox › Key AI riêng. Trong lúc chờ, bot tự chuyển sang nguồn dự phòng nếu còn.`,
      url: AI_KEY_STUDIO_URL,
    };
  }
  const where =
    p.scope === "env"
      ? `Key AI trong biến môi trường Vercel (CHAT_PROVIDERS / GEMINI_API_KEY) ${which}`
      : `Key AI chung ${which}`;
  const place =
    p.scope === "env"
      ? `${fix} ở Quản trị › Hệ thống › Nhà cung cấp AI (key nhập ở đó được dùng thay biến môi trường).`
      : `${fix} ở Quản trị › Hệ thống › Nhà cung cấp AI.`;
  return {
    audience: "admins",
    kind: "ai_key_shared",
    title: "Key AI cần nạp thêm",
    message: `${where} ${what}. ${place}`,
    url: AI_KEY_ADMIN_URL,
  };
}
