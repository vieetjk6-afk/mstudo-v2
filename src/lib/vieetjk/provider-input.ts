import { isBlockedIp } from "../inbox/bridge-protocol";
import {
  EFFORTS,
  MAX_PROVIDERS,
  type ChatProvider,
  type ProviderType,
  type PublicProvider,
  type StoredProvider,
} from "./provider-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   DANH SÁCH NGUỒN AI — phần logic THUẦN (đọc, kiểm, gộp, che khoá).

   Không `server-only`, không alias `@/`, không Supabase: chạy thẳng trong Node
   để kiểm thử (`npm run test:ai-providers`). Phần DB + mã hoá nằm ở
   provider-store.ts, phần gọi API ở providers.ts.

   Ba nơi khai nguồn AI, xếp theo thứ tự bot thử:
     1. Key RIÊNG của studio (trang Chatbox)       — studio tự trả tiền
     2. Key CHUNG do admin nhập (Quản trị hệ thống) — admin trả tiền
     3. CHAT_PROVIDERS / GEMINI_API_KEY trên Vercel — chỉ khi (2) để trống
   Key riêng hỏng/hết hạn mức thì bot rơi xuống key chung, nên studio nhập sai
   key cũng không làm tắt chatbox — và admin cũng không tốn hơn lúc studio chưa
   có key riêng.
   ═══════════════════════════════════════════════════════════════════════════ */

const TYPES: ProviderType[] = ["gemini", "openai", "anthropic", "responses"];

/**
 * Tên model người dùng dán vào — gỡ phần thừa hay dính theo khi chép từ tài
 * liệu của bên bán lại: `model gpt-5`, `model: "gpt-5"`, `model = 'gpt-5',`.
 * Tên model thật không bao giờ có dấu cách hay dấu nháy; để lọt là nhà cung
 * cấp báo "không có model" (one-api: 503 "No available channel for model
 * model gpt-5…") mà nhìn vào ô nhập khó nhận ra.
 */
export function cleanModel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^model(\s*[:=]\s*|\s+)/i, "")
    .replace(/^["'`]+|["'`,;]+$/g, "")
    .trim();
}

/** Đọc MỘT nguồn từ JSON tự do (biến môi trường / dữ liệu đã lưu). */
export function normalizeProvider(p: any): ChatProvider | null {
  const type = TYPES.includes(p?.type) ? (p.type as ProviderType) : null;
  const key = typeof p?.key === "string" ? p.key.trim() : "";
  if (!type || !key) return null;
  const model =
    cleanModel(p?.model) ||
    (type === "gemini" ? "gemini-flash-latest" : type === "anthropic" ? "claude-haiku-4-5" : "gpt-4o-mini");
  const baseUrl = typeof p?.baseUrl === "string" && p.baseUrl.trim() ? p.baseUrl.trim().replace(/\/+$/, "") : undefined;
  const effort = typeof p?.effort === "string" && p.effort.trim() ? p.effort.trim() : undefined;
  const label = typeof p?.label === "string" && p.label.trim() ? p.label.trim() : `${type}:${model}`;
  return { type, key, model, baseUrl, effort, label };
}

/** Mảng JSON → danh sách nguồn dùng được (bỏ qua mục hỏng). */
export function parseProviderList(raw: unknown): ChatProvider[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeProvider).filter((p): p is ChatProvider => !!p);
}

/**
 * Danh sách đã lưu trong DB (sau khi giải mã). Giữ NGUYÊN nhãn người dùng gõ —
 * kể cả rỗng — để đổi model xong nhãn tự đi theo thay vì kẹt tên model cũ.
 */
export function parseStoredList(raw: unknown): StoredProvider[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredProvider[] = [];
  for (const x of raw) {
    const p = normalizeProvider(x);
    const id = typeof x?.id === "string" && /^[a-z0-9]{1,32}$/i.test(x.id) ? x.id : "";
    if (!p || !id) continue;
    out.push({ ...p, id, label: typeof x?.label === "string" ? x.label.trim() : "" });
  }
  return out;
}

/** Điền nhãn mặc định (nhãn chỉ để đọc log máy chủ khi một nguồn hỏng). */
export function withLabels(list: StoredProvider[], prefix = ""): ChatProvider[] {
  return list.map((p) => ({
    type: p.type,
    key: p.key,
    model: p.model,
    baseUrl: p.baseUrl,
    effort: p.effort,
    label: prefix + (p.label || `${p.type}:${p.model}`),
  }));
}

/** Thứ tự bot thử: key riêng → key chung (DB), hoặc biến môi trường nếu DB trống. */
export function pickProviders(src: { own: ChatProvider[]; sharedDb: ChatProvider[]; env: ChatProvider[] }): ChatProvider[] {
  return [...src.own, ...(src.sharedDb.length ? src.sharedDb : src.env)];
}

/** "sk-ant-api03-…xyz9" → "sk-ant…xyz9". Khoá ngắn thì che hết. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 12) return "••••";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export function toPublic(list: StoredProvider[]): PublicProvider[] {
  return list.map(({ key, ...p }) => ({ ...p, keyMask: maskKey(key) }));
}

/**
 * Địa chỉ API do người dùng gõ — máy chủ sẽ tự gọi tới nó, kèm API key, và nút
 * "Thử" còn đọc lại câu báo lỗi. Nên chỉ nhận HTTPS ra ngoài Internet, chặn
 * localhost và địa chỉ nội bộ (metadata đám mây 169.254.169.254…) như cầu nối
 * hộp thư (bridge-protocol). Tên miền phân giải ra IP nội bộ thì provider-store
 * kiểm thêm bằng DNS trước khi thử.
 */
export function checkBaseUrl(raw: string): { ok: true; value?: string } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true };
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, error: "địa chỉ API không hợp lệ (vd https://api.openai.com/v1)." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "địa chỉ API phải bắt đầu bằng https://" };
  if (url.username || url.password) return { ok: false, error: "địa chỉ API không được chứa tên đăng nhập/mật khẩu." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    isBlockedIp(host)
  ) {
    return { ok: false, error: "địa chỉ API không được trỏ vào địa chỉ nội bộ." };
  }
  // Bỏ query/hash: code tự nối /messages, /chat/completions… vào sau.
  return { ok: true, value: `${url.origin}${url.pathname}`.replace(/\/+$/, "") };
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Gộp danh sách người dùng gửi lên với danh sách đang lưu.
 *
 * Trình duyệt KHÔNG bao giờ nhận lại khoá đầy đủ, nên mục nào ô khoá để trống
 * mà mang `id` của một mục đã lưu thì giữ nguyên khoá cũ của mục đó. Mục mới
 * (không có id khớp) bắt buộc phải có khoá.
 */
export function mergeProviderInput(
  existing: StoredProvider[],
  input: unknown,
  newId: () => string
): { ok: true; list: StoredProvider[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Dữ liệu không hợp lệ." };
  if (input.length > MAX_PROVIDERS) return { ok: false, error: `Tối đa ${MAX_PROVIDERS} nguồn AI.` };

  const byId = new Map(existing.map((p) => [p.id, p]));
  const used = new Set<string>();
  const list: StoredProvider[] = [];

  for (let i = 0; i < input.length; i++) {
    const x: any = input[i] ?? {};
    const n = `Nguồn #${i + 1}`;
    const type = TYPES.includes(x.type) ? (x.type as ProviderType) : null;
    if (!type) return { ok: false, error: `${n}: chưa chọn loại.` };
    const model = cleanModel(str(x.model, 120));
    if (!model) return { ok: false, error: `${n}: chưa nhập tên model.` };
    if (/\s/.test(model)) {
      return { ok: false, error: `${n}: tên model không có dấu cách — chỉ nhập đúng tên, vd gpt-4o-mini.` };
    }
    const effort = str(x.effort, 10);
    if (effort && !(EFFORTS as readonly string[]).includes(effort)) {
      return { ok: false, error: `${n}: mức suy nghĩ không hợp lệ.` };
    }
    const url = checkBaseUrl(str(x.baseUrl, 300));
    if (!url.ok) return { ok: false, error: `${n}: ${url.error}` };

    // Hai mục cùng gửi một id (copy/dán) → chỉ mục đầu được giữ khoá cũ.
    const prev = typeof x.id === "string" && !used.has(x.id) ? byId.get(x.id) : undefined;
    const key = str(x.key, 500) || prev?.key || "";
    if (!key) return { ok: false, error: `${n}: chưa nhập API key.` };
    if (/\s/.test(key)) return { ok: false, error: `${n}: API key không được chứa dấu cách hay xuống dòng.` };

    const id = prev ? prev.id : newId();
    used.add(id);
    list.push({ id, type, key, model, baseUrl: url.value, effort: effort || undefined, label: str(x.label, 60) });
  }
  return { ok: true, list };
}
