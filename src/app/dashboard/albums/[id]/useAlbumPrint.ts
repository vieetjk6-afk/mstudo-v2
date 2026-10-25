"use client";

import { useMemo, useRef, useState } from "react";
import type { AlbumPrintInfo } from "./AlbumPrintPanel";

/* Phần LOGIC dùng chung của thẻ "Ảnh in tặng" (bản cũ AlbumPrintPanel và bản
   mới AlbumPrintPanelV2): số ảnh in tặng của album lẻ (tự lưu), chép ảnh vào
   thư mục "Ảnh in" trên Drive, cho khách chọn lại. */

export type CopyResult = { folderUrl: string; copied: number; skipped: number; failed: { name: string }[] };

export function useAlbumPrint({
  albumId,
  info,
  photos,
}: {
  albumId: string;
  info: AlbumPrintInfo;
  photos: { id: string; drive_file_id: string }[];
}) {
  const driveOf = useMemo(() => new Map(photos.map((p) => [p.id, p.drive_file_id])), [photos]);
  const [copiedAt, setCopiedAt] = useState(info.copiedAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needConnect, setNeedConnect] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  // Album lẻ: số ảnh in tặng nhập ngay ở đây, tự lưu.
  const [albumQuota, setAlbumQuota] = useState(info.albumQuota > 0 ? String(info.albumQuota) : "");
  const [quotaSaved, setQuotaSaved] = useState<"idle" | "saving" | "saved">("idle");
  const quotaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quota = Math.max(info.contractQuota, Number(albumQuota) || 0);

  function changeQuota(v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 3);
    setAlbumQuota(clean);
    if (quotaTimer.current) clearTimeout(quotaTimer.current);
    quotaTimer.current = setTimeout(async () => {
      setQuotaSaved("saving");
      setErr(null);
      try {
        const res = await fetch(`/api/albums/${albumId}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "quota", quota: Number(clean) || 0 }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error) {
          setQuotaSaved("idle");
          setErr(d.error || "Chưa lưu được số ảnh in.");
          return;
        }
        setQuotaSaved("saved");
        setTimeout(() => setQuotaSaved("idle"), 1500);
      } catch {
        setQuotaSaved("idle");
        setErr("Mất kết nối, chưa lưu được số ảnh in.");
      }
    }, 700);
  }

  const n = info.picks.length;

  async function call(action: "copy" | "unlock") {
    setBusy(true);
    setErr(null);
    setNeedConnect(false);
    try {
      const res = await fetch(`/api/albums/${albumId}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.error === "not_connected") {
        setNeedConnect(true);
        return;
      }
      if (!res.ok || d.error) {
        setErr(d.error || "Không thực hiện được, thử lại sau.");
        return;
      }
      if (action === "unlock") {
        setCopiedAt(null);
        setResult(null);
      } else {
        setResult({ folderUrl: d.folderUrl, copied: d.copied ?? 0, skipped: d.skipped ?? 0, failed: d.failed ?? [] });
        if (d.copiedAt) setCopiedAt(d.copiedAt);
      }
    } catch {
      setErr("Mất kết nối, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return { driveOf, copiedAt, busy, err, needConnect, result, albumQuota, quotaSaved, quota, changeQuota, n, call };
}
