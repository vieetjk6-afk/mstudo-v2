"use client";

import { useCallback, useEffect, useState } from "react";
import type { CronHealth } from "@/lib/system-runs-rules";
import type { tomTatThang } from "@/lib/luu-luong-rules";

export type UsageThang = ReturnType<typeof tomTatThang>;

/* Phần LOGIC của khối "Sức khoẻ hệ thống" (SystemV2): đọc /api/admin/health —
   lượt chạy các việc tự động, dung lượng, SQL tự chạy lúc deploy, lỗi 7 ngày. */

export type HealthStats = {
  db_bytes: number;
  storage_bytes: number;
  tables: { name: string; bytes: number; rows: number }[];
  buckets: { bucket: string; objects: number; bytes: number }[];
};
export type HealthError = { signature: string; source: "server" | "client"; message: string; path: string | null; count: number; lastAt: string };
export type SystemHealth = {
  migrated: boolean;
  setupSql: string | null;
  cronSecretSet: boolean;
  crons: CronHealth[];
  sql: { name: string; ok: boolean; at: string; durationMs: number | null; sha: string | null; gitSha: string | null; error: string | null } | null;
  stats: HealthStats | null;
  errors: HealthError[];
  /** Số loại lỗi đã bấm "Đã xử lý" (đang ẩn). */
  errorsResolved?: number;
  /** false = chưa có bảng system_error_resolved → ẩn nút "Đã xử lý". */
  canResolve?: boolean;
  limits: { dbBytes: number; storageBytes: number };
  /** Lưu lượng tháng này; null/thiếu = chưa chạy migration luu_luong.sql. */
  usage?: UsageThang | null;
};

export type CronStatus = "ok" | "fail" | "stale" | "never";
export const cronStatus = (c: CronHealth): CronStatus => (c.last && !c.last.ok ? "fail" : c.stale ? "stale" : c.last ? "ok" : "never");

/** Từ 80% trần là phải để ý, từ 92% là sắp bị khoá. */
export const usageTone = (used: number, limit: number) => (used >= limit * 0.92 ? "red" : used >= limit * 0.8 ? "amber" : "green") as "red" | "amber" | "green";

/** Những việc admin cần xem — rỗng nghĩa là mọi thứ bình thường. */
export function healthIssues(h: SystemHealth): string[] {
  const out: string[] = [];
  if (!h.migrated) return ["Chưa cập nhật cơ sở dữ liệu"];
  if (!h.cronSecretSet) out.push("Chưa đặt CRON_SECRET");
  for (const c of h.crons) {
    const st = cronStatus(c);
    if (st === "fail") out.push(`${c.label}: lỗi`);
    else if (st === "stale") out.push(`${c.label}: quá hạn`);
  }
  if (h.sql && !h.sql.ok) out.push("SQL tự chạy lúc deploy hỏng");
  if (h.stats) {
    if (usageTone(h.stats.db_bytes, h.limits.dbBytes) !== "green") out.push("Database gần đầy");
    if (usageTone(h.stats.storage_bytes, h.limits.storageBytes) !== "green") out.push("Lưu trữ file gần đầy");
  }
  if (h.usage) {
    if (h.usage.supabase.tiLe >= 0.8) out.push("Lưu lượng Supabase tháng này gần hết");
    else if (h.usage.supabase.tiLeDuBao >= 1) out.push("Lưu lượng Supabase có thể vượt hạn mức cuối tháng");
    for (const v of h.usage.vercel) if (v.tiLe != null && v.tiLe >= 0.8) out.push(`Vercel ${v.service} gần hết hạn mức`);
  }
  const server = h.errors.filter((e) => e.source === "server").length;
  if (server) out.push(`${server} loại lỗi máy chủ trong 7 ngày`);
  return out;
}

/** "3 giờ trước" — đủ để liếc là biết đêm qua có chạy không. */
export function ago(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  if (m < 48 * 60) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
}

/** `seed`: CHỈ cho màn xem trước (/uipreview) — có thì không gọi API. */
export function useSystemHealth(seed?: SystemHealth) {
  const [data, setData] = useState<SystemHealth | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (seed) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/health", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as SystemHealth);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [seed]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Đánh dấu lỗi "Đã xử lý": ẩn ngay trên màn hình (không chờ tải lại), rồi
   * ghi lên máy chủ. Ghi hỏng thì tải lại để lỗi hiện về như cũ.
   */
  const resolve = useCallback(
    async (signatures: string[]) => {
      if (!signatures.length) return;
      const an = new Set(signatures);
      setData((d) => (d ? { ...d, errors: d.errors.filter((e) => !an.has(e.signature)), errorsResolved: (d.errorsResolved ?? 0) + an.size } : d));
      if (seed) return;
      try {
        const r = await fetch("/api/admin/health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatures }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } catch {
        void reload();
      }
    },
    [seed, reload],
  );

  return { data, loading, failed, reload, resolve };
}

export type SystemHealthState = ReturnType<typeof useSystemHealth>;
