"use client";

import { useEffect, useState } from "react";

/* Phần LOGIC dùng chung của thẻ "Lưu trữ nội dung người dùng · Google Drive"
   (bản cũ AdminDriveCard và khối tương ứng trong SystemV2): đọc trạng thái kết
   nối Drive của admin, ngắt kết nối. */

export type DriveStatus = { configured: boolean; connected: boolean; ok: boolean; error: string | null; lastUploadError: string | null };

/** `seed`: CHỈ cho màn xem trước (/uipreview) — có thì không gọi API. */
export function useAdminDrive(seed?: DriveStatus) {
  const [state, setState] = useState<DriveStatus | null>(seed ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seed) return;
    fetch("/api/admin/drive/status")
      .then((r) => r.json())
      .then((d) => setState({ configured: !!d.configured, connected: !!d.connected, ok: !!d.ok, error: d.error ?? null, lastUploadError: d.lastUploadError ?? null }))
      .catch(() => setState({ configured: false, connected: false, ok: false, error: null, lastUploadError: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    if (!confirm("Ngắt kết nối Drive? Upload mới sẽ quay lại lưu trên Supabase.")) return;
    setBusy(true);
    await fetch("/api/admin/drive/status", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setState((s) => (s ? { ...s, connected: false, ok: false } : s));
  }

  return { state, busy, disconnect };
}

export type AdminDriveState = ReturnType<typeof useAdminDrive>;
