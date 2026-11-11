"use client";

import { useMemo, useState } from "react";
import { Download, LoaderCircle, Share2 } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import type { CollageDoc } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { canvasToJpeg, loadImage, pageSlides, renderPage } from "@/lib/collage/render";
import { loadCollageFonts } from "@/lib/collage/text-layout";
import { docFontKeys } from "@/lib/collage/lockups";
import { triggerDownload } from "@/lib/download";
import { Sheet } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   TẢI ẢNH GHÉP về máy — hai bước như ứng dụng Albumi trên điện thoại:
     1. "Tạo ảnh": vẽ từng layout ra JPEG đúng khổ mạng xã hội.
     2. "Lưu / Chia sẻ": mở bảng Chia sẻ của điện thoại (iPhone chỉ cho mở bảng
        này ngay sau một lần chạm — nên phải là lần bấm riêng) → Lưu ảnh, hoặc
        gửi thẳng Zalo / Messenger / Facebook. Máy tính thì tải về (nhiều ảnh
        gói thành một file .zip ngay trên máy, không qua máy chủ).
   ═══════════════════════════════════════════════════════════════════════════ */

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "anh-ghep"
  );
}

/** Byte ảnh cùng miền cho canvas (Drive không gửi CORS nên phải đi qua proxy). */
export const rawImageUrl = (driveId: string, w: number) => `/api/img?id=${encodeURIComponent(driveId)}&w=${w}&raw=1`;

export default function ExportSheet({
  doc,
  pageIdx,
  driveOf,
  rawSrc = rawImageUrl,
  watermark,
  baseName,
  onClose,
}: {
  doc: CollageDoc;
  pageIdx: number;
  driveOf: (id: string) => string | undefined;
  rawSrc?: (driveId: string, w: number) => string;
  watermark: string | null;
  baseName: string;
  onClose: () => void;
}) {
  const many = doc.pages.length > 1;
  const imagesOf = (pages: CollageDoc["pages"]) => pages.reduce((n, p) => n + pageSlides(p), 0);
  const [scope, setScope] = useState<"page" | "all">(many ? "all" : "page");
  const [hd, setHd] = useState(false);
  const [files, setFiles] = useState<File[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const f = formatById(doc.formatId);
  const base = `${slugify(baseName)}-ghep`;

  // Ảnh nguồn cùng miền (raw=1) để canvas đọc được điểm ảnh; mỗi ảnh/cỡ tải một lần.
  const getImage = useMemo(() => {
    const cache = new Map<string, Promise<HTMLImageElement>>();
    return (photoId: string, w: number) => {
      const d = driveOf(photoId);
      if (!d) return Promise.reject(new Error("no_photo"));
      const key = `${d}@${w}`;
      let pr = cache.get(key);
      if (!pr) {
        pr = loadImage(rawSrc(d, w));
        cache.set(key, pr);
      }
      return pr;
    };
  }, [driveOf, rawSrc]);

  const reset = () => {
    setFiles(null);
    setMsg(null);
  };

  async function make() {
    if (progress) return;
    reset();
    const pages = scope === "all" ? doc.pages : [doc.pages[pageIdx]];
    const total = imagesOf(pages);
    setProgress({ done: 0, total });
    try {
      // Chỉ nạp phông bộ này dùng (đo chữ đúng phông trước khi vẽ).
      await loadCollageFonts(docFontKeys({ pages }));
      const out: File[] = [];
      // Đánh số liền mạch qua mọi ảnh — carousel N slide là N ảnh, đúng thứ tự đăng.
      let n = scope === "all" ? 0 : imagesOf(doc.pages.slice(0, pageIdx));
      for (const page of pages) {
        for (let sl = 0; sl < pageSlides(page); sl++) {
          const canvas = await renderPage(doc, page, { scale: hd ? 2 : 1, getImage, watermark }, Date.now(), sl);
          const blob = await canvasToJpeg(canvas, 0.92);
          n++;
          out.push(new File([blob], `${base}-${String(n).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
          setProgress({ done: out.length, total });
        }
      }
      setFiles(out);
    } catch {
      setMsg({ ok: false, text: "Chưa tạo được ảnh — bạn kiểm tra mạng rồi thử lại." });
    } finally {
      setProgress(null);
    }
  }

  async function share() {
    if (!files?.length) return;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files })) {
      try {
        await nav.share({ files, title: baseName });
        setMsg({ ok: true, text: "Xong! Trên iPhone chọn “Lưu ảnh” để đưa vào Thư viện ảnh." });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        // Bảng chia sẻ lỗi (webview Zalo / Facebook) → tải về như máy tính.
      }
    }
    if (files.length === 1) {
      triggerDownload(files[0], files[0].name);
    } else {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      files.forEach((x) => zip.file(x.name, x));
      triggerDownload(await zip.generateAsync({ type: "blob" }), `${base}.zip`);
    }
    setMsg({ ok: true, text: files.length > 1 ? `Đã tải ${files.length} ảnh (gói trong file .zip).` : "Đã tải ảnh về máy." });
  }

  const k = hd ? 2 : 1;
  return (
    <Sheet
      title="Tải ảnh ghép"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost", "lg")}>
            Đóng
          </button>
          {files ? (
            <button type="button" onClick={share} className={btn("primary", "lg", "flex-1")}>
              <Share2 size={17} /> Lưu / Chia sẻ {files.length > 1 ? `${files.length} ảnh` : "ảnh"}
            </button>
          ) : (
            <button type="button" onClick={make} disabled={!!progress} className={btn("primary", "lg", "flex-1")}>
              {progress ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}
              {progress ? `Đang tạo ${progress.done}/${progress.total}…` : "Tạo ảnh"}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-3">
        {many ? (
          <div role="group" aria-label="Tải trang nào" className="grid grid-cols-2 gap-2">
            {(
              [
                ["page", `Layout ${pageIdx + 1}${pageSlides(doc.pages[pageIdx]) > 1 ? ` · ${pageSlides(doc.pages[pageIdx])} ảnh` : ""}`],
                ["all", `Cả bộ · ${imagesOf(doc.pages)} ảnh`],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={scope === v}
                onClick={() => {
                  setScope(v);
                  reset();
                }}
                className="h-11 rounded-[12px] text-[14px] font-semibold"
                style={scope === v ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <Switch
          checked={hd}
          onChange={(v) => {
            setHd(v);
            reset();
          }}
          label="Nét cao (gấp đôi điểm ảnh)"
          desc="Hợp Facebook. Instagram tự thu về 1080 px nên không cần."
        />
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {f.label} · {f.w * k}×{f.h * k} px · JPEG{watermark ? " · có watermark của studio" : ""}
        </p>
        {msg ? (
          <p className="text-[13px] font-medium" style={{ color: msg.ok ? "var(--gn)" : "var(--rd)" }}>
            {msg.text}
          </p>
        ) : files ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Ảnh đã sẵn sàng. Trên điện thoại, bảng Chia sẻ có “Lưu ảnh” để đưa vào Thư viện, hoặc gửi thẳng Zalo, Messenger, Facebook.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
