import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify-admin";
import {
  createThrottle,
  cronHealth,
  errorSignature,
  isNoise,
  normalizePath,
  summarizeBody,
  summarizeText,
  CRONS,
  type RunState,
} from "./system-runs-rules.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   NHẬT KÝ VẬN HÀNH (supabase/migrations/he_thong_van_hanh.sql): lượt chạy cron,
   lỗi máy chủ / trình duyệt, và lời nhắc admin khi có thứ hỏng.

   Luật chung của file này: theo dõi KHÔNG BAO GIỜ được làm hỏng việc đang được
   theo dõi. Mọi lượt ghi là "được thì tốt", nuốt mọi lỗi; database chưa chạy
   migration thì im lặng và thôi hỏi lại trong 10 phút.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HEALTH_URL = "/dashboard/admin/system#suc-khoe";

type Db = ReturnType<typeof createAdminClient>;
type PgErr = { code?: string | null; message?: string | null } | null;

let missingUntil = 0;
/** Bảng / hàm chưa có (chưa chạy SQL)? Nhớ lại để không gõ cửa mỗi lượt. */
export function isMissing(e: PgErr): boolean {
  if (!e) return false;
  const hit =
    ["42P01", "PGRST205", "PGRST202", "42883"].includes(e.code ?? "") ||
    /could not find the (table|function)|does not exist/i.test(e.message ?? "");
  if (hit) missingUntil = Date.now() + 10 * 60_000;
  return hit;
}
const knownMissing = () => Date.now() < missingUntil;

export type RunInput = {
  kind: "cron" | "sql" | "deploy" | "alert";
  name: string;
  ok: boolean;
  detail?: unknown;
  durationMs?: number | null;
};

/** Ghi một lượt chạy. Không ném lỗi; trả false khi không ghi được. */
export async function recordRun(run: RunInput, db?: Db): Promise<boolean> {
  if (knownMissing()) return false;
  try {
    const { error } = await (db ?? createAdminClient()).from("system_runs").insert({
      kind: run.kind,
      name: run.name.slice(0, 80),
      ok: run.ok,
      detail: summarizeBody(run.detail),
      duration_ms: run.durationMs == null ? null : Math.max(0, Math.round(run.durationMs)),
    });
    if (error) isMissing(error);
    return !error;
  } catch {
    return false;
  }
}

/** Trạng thái các lượt chạy (hàm system_run_state). null = chưa chạy SQL / lỗi. */
export async function loadRunState(db: Db): Promise<RunState | null> {
  try {
    const { data, error } = await db.rpc("system_run_state");
    if (error) {
      isMissing(error);
      return null;
    }
    const d = data as RunState | null;
    if (!d || !Array.isArray(d.runs)) return null;
    missingUntil = 0; // admin vừa chạy SQL thì ghi lại được ngay, không chờ 10 phút
    return d;
  } catch {
    return null;
  }
}

const labelOf = (name: string) => CRONS.find((c) => c.name === name)?.label ?? name;

/**
 * Nhắc admin MỖI NGÀY MỘT LẦN khi có việc tự động quá hạn. Gọi sau mỗi lượt
 * cron: bình thường nó rơi vào lượt sao lưu (cron đầu tiên của đêm), còn nếu
 * chính lượt sao lưu chết thì cron kế tiếp vẫn nhắc. Dấu "đã nhắc" là một dòng
 * kind='alert' nên dùng chung được giữa các máy chủ serverless.
 */
export async function alertStaleCrons(db: Db, now = Date.now()): Promise<void> {
  const state = await loadRunState(db);
  if (!state) return;
  const sent = state.runs.find((r) => r.kind === "alert" && r.name === "cron-stale");
  if (sent && now - Date.parse(sent.started_at) < 20 * 3600_000) return;
  const stale = cronHealth(state, now).filter((c) => c.stale);
  if (stale.length === 0) return;
  if (!(await recordRun({ kind: "alert", name: "cron-stale", ok: false, detail: { crons: stale.map((c) => c.name) } }, db))) return;
  await notifyAdmins(
    "info",
    `${stale.length} việc tự động QUÁ HẠN chưa chạy: ${stale.map((c) => c.label).join(", ")}.`,
    { push: true, url: HEALTH_URL },
  );
}

type Handler<R extends Request, C> = (req: R, ctx: C) => Promise<Response> | Response;

/**
 * Bọc một route cron để mỗi lượt chạy để lại MỘT dòng trong system_runs.
 *
 *   • 401 (sai CRON_SECRET) KHÔNG ghi: ai cũng gọi được URL này, ghi là cho
 *     người lạ quyền làm đầy bảng và bắn thông báo.
 *   • ok = không ném lỗi và mã < 400. Ném lỗi thì ghi xong vẫn NÉM LẠI.
 *   • Hỏng thì nhắc admin — chỉ khi lượt trước đó tốt hoặc chưa có (đổi trạng
 *     thái); cron hỏng mỗi đêm không nhắc mỗi đêm. `notify: false` cho route
 *     đã tự báo lỗi của nó (sao lưu) để không báo đôi.
 *   • Ghi XONG mới trả lời: máy chủ serverless đóng băng ngay sau phản hồi.
 */
export function withCronLog<R extends Request, C = unknown>(
  name: string | ((req: R) => string),
  handler: Handler<R, C>,
  opts: { notify?: boolean } = {},
): (req: R, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const t0 = Date.now();
    let res: Response | undefined;
    let thrown: unknown;
    try {
      res = await handler(req, ctx);
    } catch (e) {
      thrown = e;
    }
    if (res?.status !== 401) {
      try {
        const cron = typeof name === "function" ? name(req) : name;
        let detail: Record<string, unknown> | null;
        if (res) {
          detail = summarizeText(await res.clone().text().catch(() => ""));
          if (res.status >= 400) detail = { status: res.status, ...(detail ?? {}) };
        } else {
          detail = { error: String((thrown as Error)?.message ?? thrown).slice(0, 500), thrown: true };
        }
        await afterRun(cron, !!res && res.status < 400, detail, Date.now() - t0, opts.notify !== false);
      } catch {
        /* theo dõi hỏng thì thôi — không đụng tới kết quả của cron */
      }
    }
    if (!res) throw thrown;
    return res;
  };
}

async function afterRun(cron: string, ok: boolean, detail: Record<string, unknown> | null, ms: number, notify: boolean) {
  if (knownMissing()) return;
  const db = createAdminClient();
  // Lượt TRƯỚC phải đọc trước khi ghi lượt này. Không đọc được thì coi như
  // "không biết" và không nhắc — thà sót một lời nhắc còn hơn nhắc mỗi đêm.
  let changed = false;
  if (!ok && notify) {
    const { data, error } = await db
      .from("system_runs")
      .select("ok")
      .eq("kind", "cron")
      .eq("name", cron)
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    if (error) isMissing(error);
    else changed = !data?.length || data[0].ok === true;
  }
  const saved = await recordRun({ kind: "cron", name: cron, ok, detail, durationMs: ms }, db);
  if (!saved) return;
  if (changed) {
    const why = typeof detail?.error === "string" ? detail.error : detail?.status ? `HTTP ${detail.status}` : "";
    await notifyAdmins("info", `Việc tự động "${labelOf(cron)}" vừa LỖI${why ? `: ${String(why).slice(0, 200)}` : ""}.`, {
      push: true,
      url: HEALTH_URL,
    });
  }
  await alertStaleCrons(db);
  // Dọn nhật ký cũ mỗi đêm một lần là đủ.
  if (cron === "backup") {
    try {
      await db.rpc("prune_system_logs");
    } catch {
      /* dọn không được thì đêm mai dọn */
    }
  }
}

/* ─── Lỗi ───────────────────────────────────────────────────────────────── */

export type ErrorInput = {
  source: "server" | "client";
  name?: string;
  message: string;
  path: string;
  sample?: Record<string, unknown>;
};

/** Cộng dồn một lỗi vào system_errors. Trả { isNew } hoặc null khi không ghi được. */
export async function logSystemError(e: ErrorInput): Promise<{ isNew: boolean; count: number } | null> {
  if (knownMissing()) return null;
  try {
    const path = normalizePath(e.path);
    const { data, error } = await createAdminClient().rpc("log_system_error", {
      p_signature: errorSignature(`${e.source}:${e.name ?? "Error"}`, e.message, path),
      p_source: e.source,
      p_message: e.message.split("\n")[0].slice(0, 300),
      p_path: path,
      p_sample: e.sample ?? null,
    });
    if (error) {
      isMissing(error);
      return null;
    }
    const d = data as { count?: number; is_new?: boolean } | null;
    return { isNew: !!d?.is_new, count: Number(d?.count) || 0 };
  } catch {
    return null;
  }
}

const allow = createThrottle();

/**
 * Phần thân của onRequestError (src/instrumentation.ts). Không bao giờ ném:
 * lỗi phát sinh TRONG LÚC ghi lỗi bị nuốt tại đây nên không thể ghi tiếp chính nó.
 */
export async function captureRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string; routeType?: string },
): Promise<void> {
  try {
    const path = request?.path || "";
    if (isNoise(err, path)) return;
    const e = (err ?? {}) as { name?: unknown; message?: unknown; stack?: unknown; digest?: unknown };
    const name = typeof e.name === "string" && e.name ? e.name : "Error";
    const message = typeof e.message === "string" && e.message ? e.message : String(err).slice(0, 300);
    // Chữ ký theo ROUTE (/app/x/[id]) chứ không theo URL cụ thể.
    const route = context?.routePath || path;
    if (!allow(errorSignature(`server:${name}`, message, route))) return;
    const stackTop = typeof e.stack === "string" ? e.stack.split("\n").slice(1, 3).map((l) => l.trim().slice(0, 200)) : [];
    const r = await logSystemError({
      source: "server",
      name,
      message,
      path: route,
      sample: {
        method: request?.method ?? null,
        type: context?.routeType ?? null,
        digest: typeof e.digest === "string" ? e.digest.slice(0, 40) : null,
        stack: stackTop,
      },
    });
    if (r?.isNew) {
      await notifyAdmins("info", `Lỗi máy chủ mới: ${message.split("\n")[0].slice(0, 160)} — ${normalizePath(route)}`, {
        push: true,
        url: HEALTH_URL,
      });
    }
  } catch {
    /* nuốt: ghi lỗi mà sinh lỗi thì dừng ở đây */
  }
}
