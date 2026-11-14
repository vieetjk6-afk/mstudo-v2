"use client";

import { useCallback, useEffect, useState } from "react";

/* Phần LOGIC của khối "Sao lưu tự động" (bản cũ SystemPanel và bản mới
   SystemV2): đọc trạng thái + danh sách bản sao lưu trên Drive admin, nút
   "Sao lưu ngay". Cron chạy mỗi đêm — xem /api/cron/backup. */

export type AutoBackupFile = { id: string; name: string; size: number; createdTime: string; webViewLink: string | null };
export type AutoBackupStatus = {
  configured: boolean;
  connected: boolean;
  keep: number;
  everyDays: number;
  files: AutoBackupFile[];
  error: string | null;
};

export const fmtSize = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(b < 10 * 1048576 ? 2 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

/** Bản mới nhất cũ hơn chu kỳ + 1 ngày → cron có vấn đề, phải nói ra. */
export function isStale(s: AutoBackupStatus | null): boolean {
  const latest = s?.files[0];
  if (!s?.connected || !latest) return false;
  return Date.now() - Date.parse(latest.createdTime) > (s.everyDays + 1) * 24 * 3600 * 1000;
}

/** `seed`: CHỈ cho màn xem trước (/uipreview) — có thì không gọi API. */
export function useAutoBackup(seed?: AutoBackupStatus) {
  const [status, setStatus] = useState<AutoBackupStatus | null>(seed ?? null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/backup/auto", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setStatus({
        configured: !!d.configured,
        connected: !!d.connected,
        keep: Number(d.keep) || 14,
        everyDays: Number(d.everyDays) || 1,
        files: Array.isArray(d.files) ? d.files : [],
        error: d.error ?? null,
      });
    } catch (e) {
      setStatus({ configured: false, connected: false, keep: 14, everyDays: 1, files: [], error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (seed) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runNow() {
    if (running || seed) return;
    setRunning(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/backup/auto", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ tone: "red", text: `Sao lưu lỗi: ${d.error ?? `HTTP ${r.status}`}` });
      } else {
        const bad = Object.keys(d.errors ?? {});
        setMsg(
          bad.length
            ? { tone: "red", text: `Đã lưu ${d.file?.name} nhưng THIẾU dữ liệu bảng: ${bad.join(", ")}.` }
            : { tone: "green", text: `Đã lưu ${d.file?.name} (${fmtSize(Number(d.file?.size) || 0)}, ${Number(d.rows || 0).toLocaleString("vi-VN")} dòng) lên Drive.` },
        );
      }
      await load();
    } catch {
      setMsg({ tone: "red", text: "Lỗi kết nối khi sao lưu." });
    } finally {
      setRunning(false);
    }
  }

  return { status, running, msg, runNow };
}

export type AutoBackupState = ReturnType<typeof useAutoBackup>;
