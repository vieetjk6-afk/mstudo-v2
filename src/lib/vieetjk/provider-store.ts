import "server-only";
import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJSON, encryptJSON } from "@/lib/zalo/crypto";
import { isBlockedIp } from "@/lib/inbox/bridge-protocol";
import { collectText, loadEnvProviders, requestProvider } from "./providers";
import { mergeProviderInput, parseStoredList, pickProviders, toPublic, withLabels } from "./provider-input";
import type { ChatProvider, PublicProvider, StoredProvider } from "./provider-types";

/* ═══════════════════════════════════════════════════════════════════════════
   NƠI LƯU API KEY AI — trang quản trị (key chung) & trang Chatbox (key riêng).

   Bảng admin_ai_providers / studio_ai_providers (migrations/ai_providers.sql)
   chỉ service-role đọc được, và cột `providers` còn mã hoá thêm một lớp. Trình
   duyệt chỉ bao giờ nhận bản đã che khoá (toPublic).

   Thứ tự bot thử nằm ở pickProviders (provider-input.ts): key riêng → key
   chung → biến môi trường.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ProviderScope = { kind: "shared" } | { kind: "studio"; ownerId: string };

/** Vì sao danh sách đọc ra rỗng dù có thể đã lưu — để trang quản trị nói thẳng. */
export type StoreError = "missing_table" | "decrypt_failed" | "db_error";

type ReadResult = { list: StoredProvider[]; error: StoreError | null };

const EMPTY: ReadResult = { list: [], error: null };

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /admin_ai_providers|studio_ai_providers/.test(error.message || "")
  );
}

async function readScope(scope: ProviderScope): Promise<ReadResult> {
  const db = createAdminClient();
  const { data, error } =
    scope.kind === "shared"
      ? await db.from("admin_ai_providers").select("providers").eq("id", 1).maybeSingle()
      : await db.from("studio_ai_providers").select("providers").eq("owner_id", scope.ownerId).maybeSingle();
  if (error) return { list: [], error: isMissingTable(error) ? "missing_table" : "db_error" };
  const blob = (data?.providers as string | null | undefined) ?? null;
  if (!blob) return EMPTY;
  // Giải mã hỏng = khoá mã hoá trên máy chủ đã đổi (ZALO_SESSION_SECRET /
  // OAUTH_STATE_SECRET / service-role key). Không đoán: báo để nhập lại.
  const raw = decryptJSON<unknown>(blob);
  if (raw === null) return { list: [], error: "decrypt_failed" };
  return { list: parseStoredList(raw), error: null };
}

async function writeScope(scope: ProviderScope, list: StoredProvider[]): Promise<StoreError | null> {
  const db = createAdminClient();
  const providers = list.length ? encryptJSON(list) : null;
  const updated_at = new Date().toISOString();
  const { error } =
    scope.kind === "shared"
      ? await db.from("admin_ai_providers").upsert({ id: 1, providers, updated_at }, { onConflict: "id" })
      : await db
          .from("studio_ai_providers")
          .upsert({ owner_id: scope.ownerId, providers, updated_at }, { onConflict: "owner_id" });
  if (!error) return null;
  return isMissingTable(error) ? "missing_table" : "db_error";
}

/**
 * Danh sách nguồn AI cho một lượt trả lời, theo đúng thứ tự bot thử.
 * `ownerId` = studio đang được phục vụ; không có thì chỉ dùng key chung.
 * Không bao giờ ném lỗi: DB hỏng thì vẫn còn biến môi trường.
 */
export async function loadProviders(ownerId?: string | null): Promise<ChatProvider[]> {
  const [own, shared] = await Promise.all([
    ownerId ? readScope({ kind: "studio", ownerId }).catch(() => EMPTY) : Promise.resolve(EMPTY),
    readScope({ kind: "shared" }).catch(() => EMPTY),
  ]);
  return pickProviders({
    own: withLabels(own.list, "riêng/"),
    sharedDb: withLabels(shared.list),
    env: loadEnvProviders(),
  });
}

export interface ProviderSettings {
  providers: PublicProvider[];
  error: StoreError | null;
  /** Số nguồn khai bằng biến môi trường (chỉ trả cho admin). */
  envCount?: number;
  /** Số nguồn chung đang dùng được (trả cho studio — không lộ chi tiết). */
  sharedCount?: number;
}

export async function getProviderSettings(scope: ProviderScope): Promise<ProviderSettings> {
  const mine = await readScope(scope);
  if (scope.kind === "shared") {
    return { providers: toPublic(mine.list), error: mine.error, envCount: loadEnvProviders().length };
  }
  const shared = await readScope({ kind: "shared" }).catch(() => EMPTY);
  const sharedCount = shared.list.length || loadEnvProviders().length;
  return { providers: toPublic(mine.list), error: mine.error, sharedCount };
}

const newId = () => crypto.randomBytes(6).toString("hex");

const STORE_ERROR_TEXT: Record<StoreError, string> = {
  missing_table: "Chưa chạy migration ai_providers.sql trên Supabase (SQL Editor).",
  decrypt_failed: "",
  db_error: "Không lưu được vào cơ sở dữ liệu. Thử lại sau ít phút.",
};

/** Lưu cả danh sách (thứ tự = thứ tự ưu tiên). Ô khoá trống = giữ khoá cũ. */
export async function saveProviderSettings(
  scope: ProviderScope,
  input: unknown
): Promise<{ ok: true; providers: PublicProvider[] } | { ok: false; error: string }> {
  const current = await readScope(scope);
  if (current.error === "missing_table" || current.error === "db_error") {
    return { ok: false, error: STORE_ERROR_TEXT[current.error] };
  }
  // decrypt_failed → coi như chưa lưu gì: mục cũ phải nhập lại khoá mới lưu được.
  const merged = mergeProviderInput(current.list, input, newId);
  if (!merged.ok) return merged;
  // Bot gọi các địa chỉ này mỗi lượt chat — chặn ngay từ lúc lưu tên miền trỏ vào IP nội bộ.
  for (const [i, p] of merged.list.entries()) {
    const dnsErr = await hostError(p.baseUrl);
    if (dnsErr) return { ok: false, error: `Nguồn #${i + 1}: ${dnsErr}` };
  }
  const err = await writeScope(scope, merged.list);
  if (err) return { ok: false, error: STORE_ERROR_TEXT[err] || "Không lưu được." };
  return { ok: true, providers: toPublic(merged.list) };
}

export type TestResult = { ok: true; ms: number; sample: string } | { ok: false; error: string };

/** Lời nhắn dễ hiểu theo mã lỗi HTTP, ghép với câu báo lỗi của nhà cung cấp. */
function httpHint(status: number): string {
  if (status === 401 || status === 403) return "Sai API key, hoặc key không có quyền dùng model này.";
  if (status === 404) return "Sai tên model hoặc sai địa chỉ API.";
  if (status === 402) return "Tài khoản AI hết tiền / chưa nạp tiền.";
  if (status === 429) return "Hết hạn mức hoặc gọi quá nhiều — thử lại sau, hoặc nạp thêm tiền.";
  if (status >= 500) return "Máy chủ nhà cung cấp đang lỗi — thử lại sau.";
  return "Nhà cung cấp từ chối yêu cầu.";
}

/** CHỈ lấy `error.message` dạng JSON — không chép thân phản hồi thô (xem bridge.ts). */
async function apiErrorMessage(res: Response): Promise<string> {
  try {
    const raw = (await res.text()).slice(0, 4000);
    const j = JSON.parse(raw);
    const m = j?.error?.message ?? (Array.isArray(j) ? j[0]?.error?.message : undefined) ?? j?.message;
    return typeof m === "string" ? m.slice(0, 200) : "";
  } catch {
    return "";
  }
}

/** Tên miền phân giải ra IP nội bộ → không gọi (chặn SSRF qua DNS). */
async function hostError(baseUrl: string | undefined): Promise<string | null> {
  if (!baseUrl) return null;
  const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (!addrs.length) return "Không phân giải được tên miền của địa chỉ API.";
    if (addrs.some((a) => isBlockedIp(a.address))) return "Địa chỉ API không được trỏ vào địa chỉ nội bộ.";
    return null;
  } catch {
    return "Không phân giải được tên miền của địa chỉ API.";
  }
}

/**
 * Nút "Thử": gửi một câu chào thật tới nguồn đang nhập (CHƯA cần lưu). Ô khoá
 * trống thì dùng khoá đã lưu của mục cùng `id`.
 */
export async function testProviderInput(scope: ProviderScope, input: unknown): Promise<TestResult> {
  const current = await readScope(scope);
  const merged = mergeProviderInput(current.list, [input], newId);
  if (!merged.ok) return { ok: false, error: merged.error.replace(/^Nguồn #1: /, "") };
  const [p] = withLabels(merged.list);

  const dnsErr = await hostError(p.baseUrl);
  if (dnsErr) return { ok: false, error: dnsErr };

  const started = Date.now();
  try {
    const res = await requestProvider(
      p,
      "Bạn đang được kiểm tra kết nối. Trả lời thật ngắn bằng tiếng Việt.",
      [{ role: "user", content: "Xin chào! Hãy chào lại bằng đúng một câu ngắn." }],
      // Không đi theo chuyển hướng: địa chỉ đã kiểm có thể 302 sang địa chỉ nội bộ.
      { signal: AbortSignal.timeout(25_000), redirect: "manual" }
    );
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, error: `Địa chỉ API trả chuyển hướng (${res.status}) — kiểm tra lại địa chỉ.` };
    }
    if (!res.ok) {
      const msg = await apiErrorMessage(res);
      return { ok: false, error: `${httpHint(res.status)} (HTTP ${res.status}${msg ? `: ${msg}` : ""})` };
    }
    const { text, reason } = await collectText(res, p);
    if (!text) return { ok: false, error: `Kết nối được nhưng AI không trả chữ nào${reason ? ` (${reason})` : ""}.` };
    return { ok: true, ms: Date.now() - started, sample: text.slice(0, 160) };
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, error: "Quá 25 giây không có trả lời." };
    return { ok: false, error: "Không kết nối được tới địa chỉ API." };
  }
}
