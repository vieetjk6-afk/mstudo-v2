import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { notifyAdmins } from "@/lib/notify-admin";
import {
  adminDriveConfigured,
  adminDriveConnected,
  listAdminDriveBackups,
  pruneAdminDriveBackups,
  uploadAdminDriveBackup,
  type BackupFile,
} from "@/lib/mstudo-drive";
import { BACKUP_EXCLUDED, BACKUP_TABLES, backupFileName, orderKeysFor, rowForBackup } from "./backup-tables";

/* ═══════════════════════════════════════════════════════════════════════════
   SAO LƯU TOÀN HỆ THỐNG — dựng file JSON (nén gzip) từ mọi bảng trong
   BACKUP_TABLES. Dùng cho cả nút "Tải bản sao lưu" lẫn cron sao lưu tự động.

   Ghi theo DÒNG CHẢY (stream) từng trang 1000 dòng thay vì gom cả DB vào một
   chuỗi rồi JSON.stringify: bộ nhớ chỉ giữ một trang + phần đã nén, và file tải
   về không vướng trần 4,5 MB thân phản hồi của Vercel.

   Khuôn file giữ nguyên như bản 1 ({ kind, data: { bảng: [dòng…] } }) để mọi
   file cũ vẫn khôi phục được; bản 2 thêm counts / missing / errors ở CUỐI file
   (chỉ biết sau khi đọc xong).
   ═══════════════════════════════════════════════════════════════════════════ */

const PAGE = 1000;

export type BackupSummary = {
  counts: Record<string, number>;
  /** Bảng chưa có ở database này (chưa chạy migration) — không phải lỗi. */
  missing: string[];
  /** Bảng đọc dở dang vì lỗi — bản sao lưu THIẾU dữ liệu của bảng này. */
  errors: Record<string, string>;
  totalRows: number;
};

type Db = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
type PgErr = { code?: string; message?: string } | null;

class TableReadError extends Error {
  pg: PgErr;
  constructor(pg: PgErr) {
    super(pg?.message || "lỗi đọc bảng");
    this.pg = pg;
  }
}

/** Một lượt đọc, thử lại 1 lần nếu lỗi thoáng qua (mạng, PostgREST bận). */
async function fetchPage(build: () => PromiseLike<{ data: unknown; error: PgErr }>): Promise<Row[]> {
  let res = await build();
  if (res.error && phanLoaiLoi(res.error) === "khac") {
    await new Promise((r) => setTimeout(r, 1500));
    res = await build();
  }
  if (res.error) throw new TableReadError(res.error);
  return (res.data as Row[] | null) ?? [];
}

/**
 * Đọc trọn một bảng theo từng trang.
 *
 * Khoá đơn → phân trang theo khoá (`id > dòng cuối`): ổn định, và không bắt
 * Postgres bỏ qua N dòng mỗi trang như OFFSET. Khoá kép → OFFSET có ORDER BY.
 * Dừng khi trang RỖNG chứ không phải khi trang < 1000 dòng — nếu project đặt
 * max_rows của API thấp hơn 1000 thì điều kiện cũ cắt cụt bảng mà không báo.
 */
async function* readTable(db: Db, table: string): AsyncGenerator<Row[]> {
  const keys = orderKeysFor(table);
  if (keys.length === 1) {
    const key = keys[0];
    let last: unknown = undefined;
    for (;;) {
      let page: Row[];
      try {
        page = await fetchPage(() => {
          let q = db.from(table).select("*").order(key, { ascending: true }).limit(PAGE);
          if (last !== undefined) q = q.gt(key, last as string);
          return q;
        });
      } catch (e) {
        // Bảng ở database cũ không có cột khoá như mong đợi → đọc kiểu OFFSET.
        if (last === undefined && e instanceof TableReadError && phanLoaiLoi(e.pg) === "thieu-cot") {
          yield* readTableByOffset(db, table, []);
          return;
        }
        throw e;
      }
      if (page.length === 0) return;
      yield page;
      last = page[page.length - 1][key];
      if (last === undefined || last === null) {
        throw new TableReadError({ message: `cột khoá ${key} rỗng — dừng để không đọc lặp` });
      }
    }
  }
  yield* readTableByOffset(db, table, keys);
}

async function* readTableByOffset(db: Db, table: string, keys: readonly string[]): AsyncGenerator<Row[]> {
  let from = 0;
  for (;;) {
    const page = await fetchPage(() => {
      let q = db.from(table).select("*");
      for (const k of keys) q = q.order(k, { ascending: true });
      return q.range(from, from + PAGE - 1);
    });
    if (page.length === 0) return;
    yield page;
    from += page.length;
  }
}

async function* jsonChunks(db: Db, generatedBy: string, summary: BackupSummary): AsyncGenerator<string> {
  yield `{"kind":"mstudo-full-backup","version":2,"generated_at":${JSON.stringify(new Date().toISOString())},` +
    `"generated_by":${JSON.stringify(generatedBy)},"excluded":${JSON.stringify(BACKUP_EXCLUDED)},"data":{`;
  let firstTable = true;
  for (const table of BACKUP_TABLES) {
    yield `${firstTable ? "" : ","}${JSON.stringify(table)}:[`;
    firstTable = false;
    let n = 0;
    try {
      for await (const page of readTable(db, table)) {
        let s = "";
        for (const r of page) {
          s += (n === 0 ? "" : ",") + JSON.stringify(rowForBackup(table, r));
          n++;
        }
        yield s;
      }
    } catch (e) {
      const pg = e instanceof TableReadError ? e.pg : { message: (e as Error)?.message };
      if (phanLoaiLoi(pg) === "thieu-bang") summary.missing.push(table);
      else summary.errors[table] = pg?.message || "lỗi không rõ";
    }
    yield "]";
    summary.counts[table] = n;
    summary.totalRows += n;
  }
  yield `},"counts":${JSON.stringify(summary.counts)},"missing":${JSON.stringify(summary.missing)},` +
    `"errors":${JSON.stringify(summary.errors)}}`;
}

/**
 * Dòng byte gzip của bản sao lưu. `summary` chỉ đầy đủ SAU KHI dòng đã đọc hết.
 */
export function backupGzipStream(generatedBy: string): { stream: ReadableStream<Uint8Array>; summary: BackupSummary } {
  const summary: BackupSummary = { counts: {}, missing: [], errors: {}, totalRows: 0 };
  const it = jsonChunks(createAdminClient(), generatedBy, summary);
  const enc = new TextEncoder();
  const json = new ReadableStream<BufferSource>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(value));
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
  return { stream: json.pipeThrough(new CompressionStream("gzip")), summary };
}

/* ─── Sao lưu tự động lên Drive admin ──────────────────────────────────────── */

/** Giữ bao nhiêu bản trên Drive (mặc định 14 ngày gần nhất). */
export function backupKeep(): number {
  const n = Number(process.env.SYSTEM_BACKUP_KEEP);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 90) : 14;
}

/**
 * Bao nhiêu ngày sao lưu một lần (mặc định 1 = mỗi ngày). Mỗi bản sao lưu đọc
 * TOÀN BỘ database qua API — tính vào egress của Supabase (gói Free 5 GB/tháng).
 * Database lớn thì đặt 2–3 để giảm egress mà vẫn có bản sao đều đặn.
 */
export function backupEveryDays(): number {
  const n = Number(process.env.SYSTEM_BACKUP_EVERY_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 30) : 1;
}

export type AutoBackupResult =
  | { ok: true; skipped: true; reason: string; latest: BackupFile | null }
  | { ok: true; skipped: false; file: BackupFile; summary: BackupSummary; removed: number; ms: number }
  | { ok: false; error: string };

const fmtMb = (b: number) => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 2 : 1)} MB`;

/**
 * Chạy MỘT lượt sao lưu lên Drive admin rồi dọn bản cũ.
 * `force` = bấm tay: bỏ qua luật "đã có bản đủ mới".
 */
export async function runAutoBackup(opts: { force: boolean; by: string }): Promise<AutoBackupResult> {
  if (!adminDriveConfigured()) return { ok: false, error: "Chưa cấu hình Google OAuth (biến môi trường)." };
  if (!(await adminDriveConnected())) return { ok: false, error: "Chưa kết nối Google Drive của admin." };

  try {
    if (!opts.force) {
      const files = await listAdminDriveBackups();
      const latest = files?.[0] ?? null;
      // Trừ hao 3 giờ: cron Vercel không chạy đúng phút, lượt hôm qua có thể muộn hơn hôm nay.
      const minAgeMs = backupEveryDays() * 24 * 3600 * 1000 - 3 * 3600 * 1000;
      if (latest && Date.now() - Date.parse(latest.createdTime) < minAgeMs) {
        return { ok: true, skipped: true, reason: "đã có bản sao lưu đủ mới", latest };
      }
    }

    const t0 = Date.now();
    const { stream, summary } = backupGzipStream(opts.by);
    const buf = Buffer.from(await new Response(stream).arrayBuffer());
    const tables = Object.keys(summary.counts).length;
    const desc =
      `Sao lưu toàn hệ thống mstudo — ${summary.totalRows.toLocaleString("vi-VN")} dòng / ${tables} bảng` +
      (Object.keys(summary.errors).length ? ` — LỖI: ${Object.keys(summary.errors).join(", ")}` : "") +
      `. Khôi phục: Quản trị hệ thống → Khôi phục → chọn file này.`;
    const file = await uploadAdminDriveBackup(buf, backupFileName(new Date()), desc);
    const removed = await pruneAdminDriveBackups(backupKeep()).catch(() => 0);
    return { ok: true, skipped: false, file, summary, removed, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}

/** Báo admin khi lượt sao lưu tự động hỏng hoặc thiếu bảng. Thành công thì im lặng. */
export async function reportAutoBackup(res: AutoBackupResult): Promise<void> {
  const url = "/dashboard/admin/system#sao-luu";
  if (!res.ok) {
    await notifyAdmins("info", `Sao lưu tự động KHÔNG chạy được: ${res.error}`, { push: true, url });
    return;
  }
  if (res.skipped) return;
  const bad = Object.keys(res.summary.errors);
  if (bad.length) {
    await notifyAdmins(
      "info",
      `Sao lưu tự động đã lưu ${res.file.name} (${fmtMb(res.file.size)}) nhưng THIẾU dữ liệu bảng: ${bad.join(", ")}.`,
      { push: true, url },
    );
  }
}
