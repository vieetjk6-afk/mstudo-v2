"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FolderInput, Loader2, Printer, RotateCcw } from "lucide-react";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { fmtDate } from "@/lib/date";
import { PRINT_FOLDER_NAME } from "@/lib/album-print-rules";

/** Ảnh in khách đã gửi + số ảnh hợp đồng tặng — page.tsx dựng. */
export type AlbumPrintInfo = {
  quota: number;
  picks: { photo_id: string; photo_name: string }[];
  sentAt: string | null;
  copiedAt: string | null;
};

type CopyResult = { folderUrl: string; copied: number; skipped: number; failed: { name: string }[] };

/**
 * Thẻ "Ảnh in tặng" ở tab Giao khách: xem ảnh khách chọn để in, chép tên file,
 * và chép ảnh vào thư mục "Ảnh in" nằm TRONG thư mục Drive giao file hoàn thiện
 * (xem /api/albums/[id]/print).
 */
export default function AlbumPrintPanel({
  albumId,
  info,
  photos,
  hasDeliveryFolder,
}: {
  albumId: string;
  info: AlbumPrintInfo;
  photos: { id: string; drive_file_id: string }[];
  hasDeliveryFolder: boolean;
}) {
  const driveOf = useMemo(() => new Map(photos.map((p) => [p.id, p.drive_file_id])), [photos]);
  const [copiedAt, setCopiedAt] = useState(info.copiedAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needConnect, setNeedConnect] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const [namesCopied, setNamesCopied] = useState(false);

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

  async function copyNames() {
    const text = info.picks.map((p) => stripExtension(p.photo_name)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNamesCopied(true);
      setTimeout(() => setNamesCopied(false), 1800);
    } catch {
      window.prompt("Copy danh sách tên ảnh in:", text);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}>
          <Printer size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-accent">
            Ảnh in tặng khách{info.quota > 0 ? ` · ${info.quota} ảnh` : ""}
          </p>
          <p className="text-xs" style={{ color: "var(--text3)" }}>
            {n === 0
              ? "Khách chưa gửi ảnh in. Ở album giao khách, khách bấm “Chọn ảnh in”, chọn rồi gửi cho studio — studio nhận thông báo."
              : `Khách đã gửi ${n}${info.quota > 0 ? `/${info.quota}` : ""} ảnh${info.sentAt ? ` · ngày ${fmtDate(info.sentAt)}` : ""}.` +
                (copiedAt ? ` Đã chuyển đi in ngày ${fmtDate(copiedAt)} — khách không sửa được nữa.` : "")}
          </p>
        </div>
      </div>

      {n > 0 && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {info.picks.map((p) => {
              const f = driveOf.get(p.photo_id);
              return (
                <figure key={p.photo_id} className="min-w-0">
                  <div className="aspect-square overflow-hidden rounded-md" style={{ background: "var(--surface2)" }}>
                    {f && <img src={thumbnailUrl(f, 240)} alt={p.photo_name} loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <figcaption className="mt-0.5 truncate text-[10.5px]" style={{ color: "var(--text3)" }} title={p.photo_name}>
                    {stripExtension(p.photo_name)}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => call("copy")}
              disabled={busy || !hasDeliveryFolder}
              className="btn-primary px-3.5 py-2 text-[13px] disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderInput size={15} />}
              {busy ? "Đang chép…" : `Copy vào thư mục “${PRINT_FOLDER_NAME}” trên Drive`}
            </button>
            <button type="button" onClick={copyNames} className="btn-ghost px-3 py-2 text-[13px]">
              {namesCopied ? <Check size={15} /> : <Copy size={15} />} {namesCopied ? "Đã copy" : "Copy tên file"}
            </button>
            {copiedAt && (
              <button type="button" onClick={() => call("unlock")} disabled={busy} className="btn-ghost px-3 py-2 text-[13px]">
                <RotateCcw size={15} /> Cho khách chọn lại
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
            {hasDeliveryFolder
              ? `Tạo thư mục “${PRINT_FOLDER_NAME}” ngay trong thư mục Drive giao file hoàn thiện rồi chép ảnh vào. Bấm lại nhiều lần không tạo ảnh trùng.`
              : "Chưa có link Drive giao file hoàn thiện — lưu link ở mục trên trước."}
          </p>
        </>
      )}

      {needConnect && (
        <div className="mt-3 rounded-[10px] p-3 text-[12.5px]" style={{ background: "color-mix(in srgb, var(--s-amber) 12%, transparent)" }}>
          <p style={{ color: "var(--s-amber)" }}>
            Cần kết nối Google Drive một lần (dùng chung với công cụ Lọc ảnh) để app được tạo thư mục và chép ảnh.
            Đăng nhập đúng tài khoản Google sở hữu thư mục giao khách.
          </p>
          <a href="/api/filter/drive/connect" className="btn-primary mt-2 inline-flex px-3 py-1.5 text-[12.5px]">
            Kết nối Google Drive
          </a>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--text3)" }}>
            Kết nối xong, quay lại album này và bấm copy lần nữa.
          </p>
        </div>
      )}
      {err && <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>{err}</p>}
      {result && (
        <div className="mt-3 rounded-[10px] p-3 text-[12.5px]" style={{ background: "color-mix(in srgb, var(--s-green) 12%, transparent)", color: "var(--s-green)" }}>
          <p>
            Đã chép {result.copied} ảnh{result.skipped ? ` (bỏ qua ${result.skipped} ảnh đã có)` : ""} vào thư mục “{PRINT_FOLDER_NAME}”.
            {result.failed.length > 0 && ` ${result.failed.length} ảnh lỗi — bấm copy lại để thử tiếp.`}
          </p>
          <a href={result.folderUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold underline">
            Mở thư mục “{PRINT_FOLDER_NAME}” <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
