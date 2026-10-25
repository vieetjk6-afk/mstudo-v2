"use client";

import { useEffect, useRef, useState } from "react";
import { stripExtension } from "@/lib/drive";
import { triggerDownload } from "@/lib/download";
import {
  overwriteDriveFile,
  createDriveFile,
  getDriveParent,
  DriveAuthError,
} from "@/lib/drive-write";
import {
  pickerConfigured,
  openDrivePicker,
  listFolderImages,
  fetchDriveBytes,
  fetchPublicDriveBytes,
} from "@/lib/google-picker";
import {
  compressImage,
  loadImageFromBlob,
  planFrame,
  outName,
  formatExt,
  type OutputFormat,
  type WmPosition,
  type WatermarkOptions,
  type CompressOptions,
  type FitMode,
} from "@/lib/compress";
import {
  PLATFORMS,
  presetsFor,
  findPreset,
  type PlatformId,
} from "@/lib/social-presets";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của công cụ Nén ảnh / Chuẩn MXH / Watermark / Đổi định
   dạng — bản cũ <ToolPanel/> và bản mới <ToolPanelV2/>: nguồn ảnh (máy, link
   Drive, Google Drive Picker), tuỳ chọn, xem thử trực tiếp, chạy + hạn mức,
   ghi lại Drive, tải ZIP / lưu thư mục. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Tool = "compress" | "watermark" | "convert" | "social";

interface Q {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}
export interface QuotaState {
  basic: Q;
  picker: Q;
}

export interface SourceItem {
  key: string;
  name: string;
  driveId?: string;
  file?: File;
}
export interface DoneItem {
  key: string;
  name: string;
  out: string;
  driveId?: string;
  originalSize: number;
  newSize: number;
  blob: Blob;
}

export type SourceKind = "local" | "link" | "picker";

const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;

export const POS_OPTIONS: { v: WmPosition; label: string }[] = [
  { v: "bottom-right", label: "Góc dưới phải" },
  { v: "bottom-left", label: "Góc dưới trái" },
  { v: "top-right", label: "Góc trên phải" },
  { v: "top-left", label: "Góc trên trái" },
  { v: "bottom-center", label: "Giữa dưới" },
  { v: "center", label: "Chính giữa" },
  { v: "tile", label: "Lát kín (chéo)" },
];

export const FIT_OPTIONS: { v: FitMode; label: string; hint: string }[] = [
  { v: "contain", label: "Giữ nguyên tỉ lệ", hint: "Không cắt ảnh — cạnh dài vừa khung chuẩn." },
  { v: "cover", label: "Cắt vừa khung", hint: "Cắt giữa cho đúng tỉ lệ chuẩn, ảnh ra đúng khung." },
  { v: "pad", label: "Thêm viền", hint: "Giữ trọn ảnh, chèn viền cho đủ đúng kích thước khung." },
];

/**
 * Ba mục tiêu của việc nén, đặt sẵn cho đỡ phải đoán con số.
 *
 * "Giữ nét tối đa" là mức dành cho việc CHỈ muốn giảm kích thước (px) mà không
 * muốn mất nét: ảnh nhỏ lại nhưng từng điểm ảnh vẫn giữ gần hết chi tiết, nên
 * file không nhỏ đi nhiều — đó là cái giá của độ nét.
 */
export const GOALS: { v: number; label: string; hint: string }[] = [
  { v: 96, label: "Giữ nét tối đa", hint: "Chỉ giảm kích thước, gần như không mất nét. File giảm ít." },
  { v: 88, label: "Cân bằng", hint: "Nét gần như nguyên bản, file nhẹ hơn rõ rệt. Dùng cho hầu hết việc." },
  { v: 76, label: "Nhẹ nhất", hint: "Ưu tiên dung lượng — chỉ dùng khi cần gửi nhanh qua mạng yếu." },
];

/** Trần dung lượng chọn được (byte). -1 = theo khuyến nghị của khổ đang chọn. */
export const BUDGETS: { v: number; label: string }[] = [
  { v: -1, label: "Theo chuẩn nền tảng (khuyên dùng)" },
  { v: 500 * 1024, label: "≤ 500 KB (mạng chậm)" },
  { v: 1024 * 1024, label: "≤ 1 MB" },
  { v: 2 * 1024 * 1024, label: "≤ 2 MB" },
  { v: 0, label: "Không đặt trần (nét tối đa)" },
];

export type ToolPanelProps = {
  tool: Tool;
  pro: boolean;
  ensureDriveToken: (force?: boolean) => Promise<string>;
  quota: QuotaState | null;
  consumeQuota: (kind: "basic" | "picker") => Promise<{ ok: boolean; status: number; data: any }>;
};

export function useCompressTool({ tool, pro, ensureDriveToken, quota, consumeQuota }: ToolPanelProps) {
  // Tab "Chuẩn MXH" cũng là một lượt nén: dùng chung hạn mức với tab Nén ảnh.
  const usesQuota = tool === "compress" || tool === "social";
  const allowPicker = usesQuota && pickerConfigured;

  const [source, setSource] = useState<SourceKind>("local");
  const [items, setItems] = useState<SourceItem[]>([]);
  const [srcLabel, setSrcLabel] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // Drive link
  const [driveUrl, setDriveUrl] = useState("");
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Compress options
  const [quality, setQuality] = useState(92);
  const [maxDim, setMaxDim] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  // Convert option
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("image/webp");
  // Picker write mode
  const [writeMode, setWriteMode] = useState<"overwrite" | "new">("new");

  // Chuẩn mạng xã hội
  const [platform, setPlatform] = useState<PlatformId>("facebook");
  const [presetId, setPresetId] = useState<string>(presetsFor("facebook")[0].id);
  const [fit, setFit] = useState<FitMode>(presetsFor("facebook")[0].fit);
  const [padColor, setPadColor] = useState("#ffffff");
  const [sharpen, setSharpen] = useState(35);
  const [budget, setBudget] = useState(-1);
  const [socialFormat, setSocialFormat] = useState<OutputFormat>("image/jpeg");
  const [socialQ, setSocialQ] = useState(Math.round(presetsFor("facebook")[0].quality * 100));
  // Nén thường: làm nét sau khi thu nhỏ (mặc định bật — chống ảnh mờ khi đăng).
  const [compressSharpen, setCompressSharpen] = useState(true);

  // Watermark options
  const [wmType, setWmType] = useState<"text" | "image">("text");
  const [wmText, setWmText] = useState("");
  const [wmColor, setWmColor] = useState<"white" | "black">("white");
  const [wmPos, setWmPos] = useState<WmPosition>("bottom-right");
  const [wmOpacity, setWmOpacity] = useState(35);
  const [wmTextScale, setWmTextScale] = useState(4);
  const [wmImageScale, setWmImageScale] = useState(22);
  const [wmImg, setWmImg] = useState<HTMLImageElement | null>(null);
  const [wmImgName, setWmImgName] = useState("");
  const wmFileInput = useRef<HTMLInputElement>(null);

  // Processing / results
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<DoneItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [writeMsg, setWriteMsg] = useState<string | null>(null);

  // Preview (live)
  const [previewSrc, setPreviewSrc] = useState<
    { key: string; img: HTMLImageElement; origSize: number; label: string; origUrl: string } | null
  >(null);
  const [preview, setPreview] = useState<
    {
      url: string;
      origSize: number;
      newSize: number;
      label: string;
      w: number;
      h: number;
      quality: number;
      overBudget: boolean;
    } | null
  >(null);
  const [zoom, setZoom] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);

  const isPicker = source === "picker";
  const activeQuota = usesQuota ? (isPicker ? quota?.picker : quota?.basic) : null;
  const outOfQuota = !!activeQuota && !activeQuota.unlimited && (activeQuota.remaining ?? 0) <= 0;
  const [fsSupported] = useState(
    typeof window !== "undefined" && "showDirectoryPicker" in window
  );

  // ── Sources ──────────────────────────────────────────────────
  function resetOutputs() {
    setResults([]);
    setPreview(null);
    setWriteMsg(null);
    setSavingMsg(null);
  }

  function pickLocal(e: React.ChangeEvent<HTMLInputElement>) {
    addLocalFiles(Array.from(e.target.files ?? []));
  }
  /** Nhận một loạt file trên máy (từ ô chọn file hoặc kéo-thả của bản mới). */
  function addLocalFiles(all: File[]) {
    const files = all.filter((f) => IMG_RE.test(f.name));
    setItems(files.map((file, i) => ({ key: `${i}-${file.name}`, name: file.name, file })));
    setSrcLabel(`${files.length} ảnh đã chọn (xử lý cục bộ, không upload)`);
    resetOutputs();
  }

  async function pickLocalFolder() {
    // Chrome/Edge: native folder picker; otherwise fall back to <input webkitdirectory>.
    if (fsSupported) {
      try {
        const dir = await (window as any).showDirectoryPicker({ id: "vk-img-src" });
        const files: SourceItem[] = [];
        let i = 0;
        for await (const entry of dir.values()) {
          if (entry.kind === "file" && IMG_RE.test(entry.name)) {
            const file = await entry.getFile();
            files.push({ key: `${i++}-${entry.name}`, name: entry.name, file });
          }
        }
        setItems(files);
        setSrcLabel(`${dir.name} · ${files.length} ảnh (xử lý cục bộ, không upload)`);
        resetOutputs();
      } catch {
        /* cancelled */
      }
    } else {
      folderInput.current?.click();
    }
  }

  async function loadDrive() {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      const res = await fetch("/api/drive/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: driveUrl }),
      });
      const data = await res.json();
      if (data.error) {
        setDriveError(data.error);
        setItems([]);
      } else {
        setItems((data.files ?? []).map((f: any) => ({ key: f.id, name: f.name, driveId: f.id })));
        setSrcLabel(`${(data.files ?? []).length} ảnh từ Drive`);
        resetOutputs();
      }
    } catch {
      setDriveError("Không tải được danh sách từ Drive.");
    }
    setLoadingDrive(false);
  }

  async function pickFromDrive() {
    if (picking) return;
    setPicking(true);
    setDriveError(null);
    try {
      const token = await ensureDriveToken();
      const picked = await openDrivePicker(token);
      if (picked.length === 0) {
        setPicking(false);
        return;
      }
      const files: SourceItem[] = [];
      for (const p of picked) {
        if (p.isFolder) {
          const kids = await listFolderImages(token, p.id);
          files.push(...kids.map((f) => ({ key: f.id, name: f.name, driveId: f.id })));
        } else {
          files.push({ key: p.id, name: p.name, driveId: p.id });
        }
      }
      const seen = new Set<string>();
      const uniq = files.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
      setItems(uniq);
      setSrcLabel(`${uniq.length} ảnh từ Google Drive (đã cấp quyền ghi)`);
      resetOutputs();
    } catch (e: any) {
      const detail = e?.message || e?.type || "";
      setDriveError(
        detail === "drive_unauthorized"
          ? "Cần cấp lại quyền Google Drive."
          : `Không mở được Google Drive${detail ? ` (lỗi: ${detail})` : ""}. Kiểm tra cấu hình Google.`
      );
    }
    setPicking(false);
  }

  async function pickWatermarkImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await loadImageFromBlob(file);
      setWmImg(img);
      setWmImgName(file.name);
    } catch {
      setWmImg(null);
      setWmImgName("");
    }
  }

  // ── Chuẩn mạng xã hội ────────────────────────────────────────
  const preset = findPreset(presetId);
  const budgetBytes = budget === -1 ? preset.maxBytes : budget;

  function switchPlatform(id: PlatformId) {
    const first = presetsFor(id)[0];
    setPlatform(id);
    setPresetId(first.id);
    setFit(first.fit);
    setSocialQ(Math.round(first.quality * 100));
    resetOutputs();
  }
  function switchPreset(id: string) {
    const p = findPreset(id);
    setPresetId(id);
    setFit(p.fit);
    setSocialQ(Math.round(p.quality * 100));
    resetOutputs();
  }
  /** Nét tối đa: kéo chất lượng lên cao và BỎ trần dung lượng, vì trần dung
   *  lượng chính là thứ kéo chất lượng tụt xuống lại. */
  function maxSharpness() {
    setSocialQ(96);
    setBudget(0);
    resetOutputs();
  }

  // Ảnh gốc đủ pixel cho khung chuẩn hay không, và cắt mất bao nhiêu — tính
  // trước để cảnh báo, vì phóng to ảnh nhỏ chính là nguyên nhân "ảnh bị vỡ".
  const socialPlan =
    tool === "social" && previewSrc
      ? planFrame(
          previewSrc.img.naturalWidth,
          previewSrc.img.naturalHeight,
          { width: preset.w, height: preset.h, fit, padColor },
          false
        )
      : null;
  const tooSmall =
    !!socialPlan &&
    (fit === "cover"
      ? socialPlan.canvas.w < preset.w
      : Math.max(socialPlan.dest.w, socialPlan.dest.h) < Math.max(preset.w, preset.h));
  const cropPct =
    socialPlan && fit === "cover" && previewSrc
      ? Math.round(
          (1 -
            (socialPlan.src.w * socialPlan.src.h) /
              (previewSrc.img.naturalWidth * previewSrc.img.naturalHeight)) *
            100
        )
      : 0;

  // ── Per-tool processing options ──────────────────────────────
  // Free accounts: image/logo watermark is a pro feature — fall back to text.
  const effectiveWmType: "text" | "image" = pro ? wmType : "text";

  function buildWatermark(): WatermarkOptions {
    return {
      type: effectiveWmType,
      position: wmPos,
      opacity: wmOpacity / 100,
      text: wmText,
      color: wmColor,
      textScale: wmTextScale / 100,
      image: wmImg,
      imageScale: wmImageScale / 100,
    };
  }
  function optionsFor(): CompressOptions {
    if (tool === "social")
      return {
        quality: socialQ / 100,
        maxDim: 0,
        format: socialFormat,
        watermark: null,
        frame: { width: preset.w, height: preset.h, fit, padColor },
        allowUpscale: false, // thà ra nhỏ hơn khung còn hơn phóng to thành mờ
        sharpen: sharpen / 100,
        maxBytes: budgetBytes,
      };
    if (tool === "compress")
      return {
        quality: quality / 100,
        maxDim,
        format,
        watermark: null,
        sharpen: compressSharpen ? 0.3 : 0,
      };
    if (tool === "watermark")
      // Free accounts can't compress in the watermark tab: keep high quality, no resize.
      return pro
        ? { quality: quality / 100, maxDim, format, watermark: buildWatermark() }
        : { quality: 0.92, maxDim: 0, format, watermark: buildWatermark() };
    return { quality: 0.95, maxDim: 0, format: targetFormat, watermark: null }; // convert
  }
  const outputFormat = tool === "convert" ? targetFormat : tool === "social" ? socialFormat : format;

  async function getBlob(it: SourceItem, fetchW: number): Promise<Blob> {
    if (it.file) return it.file;
    if (it.driveId) {
      if (source === "picker") {
        const token = await ensureDriveToken();
        return fetchDriveBytes(token, it.driveId);
      }
      // Thử tải ảnh gốc THẲNG từ Drive API (có CORS, 0 byte qua Vercel) trước.
      const direct = await fetchPublicDriveBytes(it.driveId);
      if (direct) return direct;
      // raw=1: cần chính byte ảnh (nén + watermark bằng canvas) nên phải giữ
      // cùng miền, không để /api/img 302 sang Google (Drive không gửi CORS).
      const res = await fetch(`/api/img?id=${encodeURIComponent(it.driveId)}&w=${fetchW}&raw=1`);
      return res.blob();
    }
    throw new Error("no_source");
  }

  // ── Live preview (first image; no quota, no Drive write) ─────
  // Load the source image once when the first item changes…
  useEffect(() => {
    const it = items[0];
    if (!it) {
      setPreviewSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blob = await getBlob(it, 5000);
        const img = await loadImageFromBlob(blob);
        if (cancelled) return;
        const origUrl = URL.createObjectURL(blob);
        setPreviewSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.origUrl);
          return { key: it.key, img, origSize: blob.size, label: stripExtension(it.name), origUrl };
        });
      } catch {
        if (!cancelled) setPreviewSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items[0]?.key, source]);

  // …and recompute the preview (debounced) whenever options change.
  useEffect(() => {
    if (!previewSrc) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await compressImage(previewSrc.img, optionsFor());
        if (cancelled) return;
        const url = URL.createObjectURL(r.blob);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return {
            url,
            origSize: previewSrc.origSize,
            newSize: r.blob.size,
            label: previewSrc.label,
            w: r.width,
            h: r.height,
            quality: r.quality,
            overBudget: r.overBudget,
          };
        });
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSrc, quality, maxDim, format, targetFormat, tool, wmType, wmText, wmColor, wmPos, wmOpacity, wmTextScale, wmImageScale, wmImg, compressSharpen, presetId, fit, padColor, sharpen, budget, socialFormat, socialQ]);

  // ── Main run ─────────────────────────────────────────────────
  async function writeOneToDrive(tok: string, r: DoneItem) {
    // Tab chuẩn MXH luôn lưu bản mới: bản đã cắt/thu nhỏ theo khổ mạng xã hội
    // không thể thay cho ảnh gốc.
    if (writeMode === "overwrite" && tool !== "social") {
      await overwriteDriveFile(tok, r.driveId!, r.blob);
    } else {
      const { parentId } = await getDriveParent(tok, r.driveId!);
      if (!parentId) throw new Error("no_parent");
      const suffix = tool === "social" ? `_${preset.id}` : "_nen";
      await createDriveFile(tok, parentId, `${stripExtension(r.name)}${suffix}.${formatExt(outputFormat)}`, r.blob);
    }
  }

  async function run() {
    if (items.length === 0 || busy) return;
    if (tool === "watermark" && effectiveWmType === "image" && !wmImg) {
      alert("Hãy chọn ảnh watermark trước.");
      return;
    }
    setQuotaMsg(null);
    setWriteMsg(null);

    // Quota only applies to the compress-like tools (nén / chuẩn MXH).
    if (usesQuota) {
      const kind = isPicker ? "picker" : "basic";
      const { ok, status, data } = await consumeQuota(kind);
      if (status === 401) {
        setQuotaMsg("Bạn cần đăng nhập để dùng công cụ này.");
        return;
      }
      if (!ok) {
        const lim = kind === "picker" ? data?.picker?.limit : data?.basic?.limit;
        setQuotaMsg(
          kind === "picker"
            ? `Bạn đã dùng hết lượt nén qua Google Drive (${lim ?? 1}). Nâng cấp gói để dùng thêm.`
            : `Bạn đã dùng hết lượt nén tháng này (${lim ?? 5}). Nâng cấp gói để nén không giới hạn.`
        );
        return;
      }
    }

    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: items.length });
    const opts = optionsFor();
    const fetchW = opts.maxDim > 0 ? opts.maxDim : 5000;
    const out: DoneItem[] = [];
    let written = 0;
    let token = "";
    if (usesQuota && isPicker) {
      try {
        token = await ensureDriveToken();
      } catch {
        setWriteMsg("Cần cấp quyền Google Drive.");
        setBusy(false);
        setProgress(null);
        return;
      }
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const blob = await getBlob(it, fetchW);
        const img = await loadImageFromBlob(blob);
        const r = await compressImage(img, opts);
        const done: DoneItem = {
          key: it.key,
          name: it.name,
          out: outName(it.name, outputFormat),
          driveId: it.driveId,
          originalSize: blob.size,
          newSize: r.blob.size,
          blob: r.blob,
        };
        out.push(done);
        // Picker compress: write back to Drive automatically (no extra prompt).
        if (usesQuota && isPicker && it.driveId) {
          try {
            await writeOneToDrive(token, done);
            written++;
          } catch (e) {
            if (e instanceof DriveAuthError) {
              token = await ensureDriveToken(true);
              await writeOneToDrive(token, done);
              written++;
            }
          }
        }
      } catch {
        /* skip failed file */
      }
      setProgress({ done: i + 1, total: items.length });
    }

    setResults(out);
    setProgress(null);
    setBusy(false);
    if (usesQuota && isPicker) {
      setWriteMsg(
        tool === "social"
          ? `Đã xuất & lưu ${written}/${items.length} bản chuẩn ${
              PLATFORMS.find((p) => p.id === platform)?.label ?? "MXH"
            } (đuôi _${preset.id}) vào Drive, ảnh gốc giữ nguyên.`
          : writeMode === "overwrite"
          ? `Đã nén & ghi đè ${written}/${items.length} ảnh lên Drive (giữ nguyên tên & link).`
          : `Đã nén & lưu ${written}/${items.length} bản mới (đuôi _nen) vào Drive.`
      );
    }
  }

  // ── Output (local/link only) ─────────────────────────────────
  async function downloadZip() {
    if (results.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const r of results) zip.file(r.out, r.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(
      blob,
      tool === "convert"
        ? "anh-doi-dinh-dang.zip"
        : tool === "watermark"
        ? "anh-watermark.zip"
        : tool === "social"
        ? `anh-${platform}-${preset.w}x${preset.h}.zip`
        : "anh-da-nen.zip"
    );
  }
  async function saveToFolder() {
    if (results.length === 0) return;
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "vk-img-dest", mode: "readwrite" });
      setSavingMsg("Đang lưu…");
      let done = 0;
      for (const r of results) {
        const fh = await dir.getFileHandle(r.out, { create: true });
        const w = await fh.createWritable();
        await w.write(r.blob);
        await w.close();
        done++;
        setSavingMsg(`Đang lưu… ${done}/${results.length}`);
      }
      setSavingMsg(`Đã lưu ${done}/${results.length} ảnh vào “${dir.name}”.`);
    } catch {
      setSavingMsg(null);
    }
  }

  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalNew = results.reduce((s, r) => s + r.newSize, 0);
  const savedPct = totalOriginal > 0 ? Math.round((1 - totalNew / totalOriginal) * 100) : 0;

  const runLabel =
    tool === "watermark"
      ? "Gắn watermark"
      : tool === "convert"
      ? "Chuyển đổi"
      : tool === "social"
      ? isPicker
        ? "Xuất chuẩn MXH & ghi lên Drive"
        : "Xuất chuẩn MXH"
      : isPicker
      ? "Nén & ghi lên Drive"
      : "Nén ảnh";

  /** Đổi nguồn ảnh: xoá danh sách + kết quả của nguồn cũ. */
  function switchSource(key: SourceKind) {
    setSource(key);
    setItems([]);
    setSrcLabel("");
    resetOutputs();
  }

  return {
    usesQuota, allowPicker, source, switchSource, items, srcLabel, fileInput, folderInput,
    driveUrl, setDriveUrl, loadingDrive, driveError, picking,
    quality, setQuality, maxDim, setMaxDim, format, setFormat, targetFormat, setTargetFormat, writeMode, setWriteMode,
    platform, presetId, fit, setFit, padColor, setPadColor, sharpen, setSharpen, budget, setBudget,
    socialFormat, setSocialFormat, socialQ, setSocialQ, compressSharpen, setCompressSharpen,
    wmType, setWmType, wmText, setWmText, wmColor, setWmColor, wmPos, setWmPos, wmOpacity, setWmOpacity,
    wmTextScale, setWmTextScale, wmImageScale, setWmImageScale, wmImgName, wmFileInput,
    progress, results, busy, savingMsg, quotaMsg, writeMsg,
    previewSrc, preview, zoom, setZoom, showOriginal, setShowOriginal,
    isPicker, activeQuota, outOfQuota, fsSupported, resetOutputs,
    pickLocal, addLocalFiles, pickLocalFolder, loadDrive, pickFromDrive, pickWatermarkImage,
    preset, budgetBytes, switchPlatform, switchPreset, maxSharpness, socialPlan, tooSmall, cropPct,
    effectiveWmType, outputFormat, run, downloadZip, saveToFolder,
    totalOriginal, totalNew, savedPct, runLabel,
  };
}

export type CompressToolState = ReturnType<typeof useCompressTool>;
