"use client";

import {
  Link2,
  HardDrive,
  Search,
  FolderInput,
  Download,
  Image as ImageIcon,
  Type,
  Minimize2,
  Save,
  CloudUpload,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Share2,
} from "lucide-react";
import { stripExtension } from "@/lib/drive";
import { triggerDownload } from "@/lib/download";
import { formatExt, formatBytes, type OutputFormat, type WmPosition } from "@/lib/compress";
import { PLATFORMS, presetsFor, ratioLabel } from "@/lib/social-presets";
import {
  useCompressTool,
  POS_OPTIONS,
  FIT_OPTIONS,
  GOALS,
  BUDGETS,
  type SourceKind,
  type ToolPanelProps,
} from "./useCompressTool";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type { Tool, QuotaState } from "./useCompressTool";

/** Bản cũ của bảng công cụ. Toàn bộ logic ở ./useCompressTool (dùng chung với ./ToolPanelV2). */
export default function ToolPanel(props: ToolPanelProps) {
  const { tool, pro } = props;
  const {
    usesQuota, allowPicker, source, switchSource, items, srcLabel, fileInput, folderInput,
    driveUrl, setDriveUrl, loadingDrive, driveError, picking,
    quality, setQuality, maxDim, setMaxDim, format, setFormat, targetFormat, setTargetFormat, writeMode, setWriteMode,
    platform, presetId, fit, setFit, padColor, setPadColor, sharpen, setSharpen, budget, setBudget,
    socialFormat, setSocialFormat, socialQ, setSocialQ, compressSharpen, setCompressSharpen,
    setWmType, wmText, setWmText, wmColor, setWmColor, wmPos, setWmPos, wmOpacity, setWmOpacity,
    wmTextScale, setWmTextScale, wmImageScale, setWmImageScale, wmImgName, wmFileInput,
    progress, results, busy, savingMsg, quotaMsg, writeMsg,
    previewSrc, preview, zoom, setZoom, showOriginal, setShowOriginal,
    isPicker, activeQuota, outOfQuota, fsSupported, resetOutputs,
    pickLocal, pickLocalFolder, loadDrive, pickFromDrive, pickWatermarkImage,
    preset, budgetBytes, switchPlatform, switchPreset, maxSharpness, socialPlan, tooSmall, cropPct,
    effectiveWmType, outputFormat, run, downloadZip, saveToFolder,
    totalOriginal, totalNew, savedPct, runLabel,
  } = useCompressTool(props);

  // ── Source tab buttons ───────────────────────────────────────
  const srcTab = (key: SourceKind, label: string, Icon: typeof Link2) => (
    <button
      onClick={() => switchSource(key)}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]"
      style={source === key ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      {/* Source */}
      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <FolderInput size={16} style={{ color: "var(--ac)" }} /> Nguồn ảnh
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {srcTab("local", "Máy tính", HardDrive)}
          {srcTab("link", "Link Drive", Link2)}
          {allowPicker && srcTab("picker", "Google Drive (ghi lại)", CloudUpload)}
        </div>

        {source === "local" && (
          <>
            <div className="flex gap-2.5">
              <button onClick={() => fileInput.current?.click()} className="btn-ghost flex-1 py-3">
                <ImageIcon size={16} /> Chọn ảnh
              </button>
              <button onClick={pickLocalFolder} className="btn-ghost flex-1 py-3">
                <FolderInput size={16} /> Chọn thư mục
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={pickLocal} />
            <input
              ref={folderInput}
              type="file"
              hidden
              onChange={pickLocal}
              {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)}
            />
          </>
        )}

        {source === "link" && (
          <>
            <div className="flex gap-2.5">
              <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="input" />
              <button onClick={loadDrive} disabled={loadingDrive || !driveUrl.trim()} className="btn-primary whitespace-nowrap">
                <Search size={15} /> {loadingDrive ? "Đang tải…" : "Tải ảnh"}
              </button>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--text3)" }}>Folder phải chia sẻ <b>công khai</b> (Anyone with the link).</p>
          </>
        )}

        {source === "picker" && (
          <>
            <button onClick={pickFromDrive} disabled={picking} className="btn-primary w-full py-3 disabled:opacity-40">
              <CloudUpload size={16} /> {picking ? "Đang mở Drive…" : "Chọn từ Google Drive"}
            </button>
            <p className="mt-2 text-[12px]" style={{ color: "var(--text3)" }}>
              Đăng nhập Google của bạn, chọn ảnh/thư mục (kể cả Drive riêng tư). Kết quả nén sẽ tự ghi lại lên Drive theo lựa chọn bên dưới.
            </p>
          </>
        )}

        {driveError && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{driveError}</p>}
        {srcLabel && <p className="mt-3 text-[13px]" style={{ color: "var(--text2)" }}>{srcLabel}</p>}
      </div>

      {/* Options */}
      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          {tool === "social" ? (
            <Share2 size={16} style={{ color: "var(--ac)" }} />
          ) : (
            <Minimize2 size={16} style={{ color: "var(--ac)" }} />
          )}{" "}
          {tool === "watermark"
            ? "Watermark"
            : tool === "convert"
            ? "Đổi định dạng"
            : tool === "social"
            ? "Khổ chuẩn mạng xã hội"
            : "Thiết lập nén"}
        </h2>

        {tool === "social" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchPlatform(p.id)}
                  className="rounded-lg px-3 py-1.5 text-[13px]"
                  style={
                    platform === p.id
                      ? { background: "var(--accent)", color: "var(--accentInk)" }
                      : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Khổ đăng</label>
            <select value={presetId} onChange={(e) => switchPreset(e.target.value)} className="input">
              {presetsFor(platform).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            <div className="mt-2 rounded-lg p-3 text-[12.5px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              <p>
                Khung xuất: <b style={{ color: "var(--text)" }}>{preset.w}×{preset.h}px</b> · tỉ lệ {ratioLabel(preset.w, preset.h)} ·{" "}
                {formatExt(preset.format).toUpperCase()} chất lượng {Math.round(preset.quality * 100)}
                {preset.maxBytes > 0 && <> · dưới {formatBytes(preset.maxBytes)}</>}
              </p>
              <p className="mt-1" style={{ color: "var(--text3)" }}>{preset.note}</p>
            </div>

            <label className="mt-4 mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Ảnh không đúng tỉ lệ khung thì</label>
            <div className="flex flex-wrap gap-2">
              {FIT_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  onClick={() => setFit(o.v)}
                  title={o.hint}
                  className="rounded-lg px-3 py-1.5 text-[13px]"
                  style={
                    fit === o.v
                      ? { background: "var(--accent)", color: "var(--accentInk)" }
                      : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--text3)" }}>
              {FIT_OPTIONS.find((o) => o.v === fit)?.hint}
            </p>

            {fit === "pad" && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-[13px]" style={{ color: "var(--text2)" }}>Màu viền</label>
                <select value={padColor} onChange={(e) => setPadColor(e.target.value)} className="input w-auto px-2 py-1 text-xs">
                  <option value="#ffffff">Trắng</option>
                  <option value="#000000">Đen</option>
                  <option value="#f2f2f2">Xám nhạt</option>
                </select>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[13px]" style={{ color: "var(--text2)" }}>
                Chất lượng: <b style={{ color: "var(--text)" }}>{socialQ}</b>
                <span style={{ color: "var(--text3)" }}> (mức chuẩn của khổ này: {Math.round(preset.quality * 100)})</span>
              </label>
              <button
                onClick={maxSharpness}
                className="rounded-lg px-2.5 py-1 text-[12px]"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
                title="Chất lượng 96 và bỏ trần dung lượng — nét nhất, file nặng hơn"
              >
                Nét tối đa
              </button>
            </div>
            <input type="range" min={70} max={100} value={socialQ} onChange={(e) => setSocialQ(+e.target.value)} className="w-full accent-[var(--gold)]" />
            {socialQ > Math.round(preset.quality * 100) && budgetBytes > 0 && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--text3)" }}>
                Đang kéo chất lượng cao hơn mức chuẩn nhưng vẫn còn trần {formatBytes(budgetBytes)} — công cụ sẽ tự hạ lại cho vừa trần.
                Muốn giữ đúng mức này thì đặt <b>Trần dung lượng → Không đặt trần</b> (hoặc bấm “Nét tối đa”).
              </p>
            )}

            <label className="mt-4 block text-[13px]" style={{ color: "var(--text2)" }}>
              Làm nét sau khi thu nhỏ: <b style={{ color: "var(--text)" }}>{sharpen}%</b>
              <span style={{ color: "var(--text3)" }}> (bù phần nét mất khi mạng xã hội nén lại)</span>
            </label>
            <input type="range" min={0} max={80} value={sharpen} onChange={(e) => setSharpen(+e.target.value)} className="w-full accent-[var(--gold)]" />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Trần dung lượng</label>
                <select value={budget} onChange={(e) => setBudget(+e.target.value)} className="input">
                  {BUDGETS.map((b) => (
                    <option key={b.v} value={b.v}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Định dạng</label>
                <select value={socialFormat} onChange={(e) => setSocialFormat(e.target.value as OutputFormat)} className="input">
                  <option value="image/jpeg">JPEG (ảnh chụp — khuyên dùng)</option>
                  <option value="image/png">PNG (ảnh nhiều chữ, đồ hoạ)</option>
                </select>
              </div>
            </div>

            {tooSmall && (
              <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--amS)", color: "var(--am)" }}>
                Ảnh gốc nhỏ hơn khung chuẩn nên bản xuất chỉ đạt{" "}
                <b>{socialPlan ? `${socialPlan.canvas.w}×${socialPlan.canvas.h}` : ""}</b> — vẫn đúng tỉ lệ và không bị phóng to
                thành mờ, nhưng muốn nét tối đa thì nên lấy ảnh gốc lớn hơn.
              </p>
            )}
            {fit === "cover" && cropPct >= 8 && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
                Khổ này sẽ cắt bỏ khoảng <b>{cropPct}%</b> ảnh gốc (cắt giữa). Muốn giữ trọn ảnh thì chọn “Giữ nguyên tỉ lệ” hoặc “Thêm viền”.
              </p>
            )}
            {preview?.overBudget && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
                Ảnh nhiều chi tiết nên vẫn nặng hơn trần {formatBytes(budgetBytes)} dù đã hạ chất lượng hết mức — cứ đăng bình thường, chỉ là nền tảng sẽ nén thêm một chút.
              </p>
            )}

            {isPicker && (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--text3)" }}>
                Bản chuẩn MXH luôn được lưu thành <b>file mới</b> (đuôi <code>_{preset.id}</code>) trên Drive — ảnh gốc giữ nguyên.
              </p>
            )}
          </>
        )}

        {tool === "compress" && (
          <>
            <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Mục tiêu</label>
            <div className="mb-1 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.v}
                  onClick={() => {
                    setQuality(g.v);
                    setCompressSharpen(true);
                    resetOutputs();
                  }}
                  title={g.hint}
                  className="rounded-lg px-3 py-1.5 text-[13px]"
                  style={
                    quality === g.v
                      ? { background: "var(--accent)", color: "var(--accentInk)" }
                      : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }
                  }
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[12px]" style={{ color: "var(--text3)" }}>
              {GOALS.find((g) => g.v === quality)?.hint ??
                "Đang dùng mức tự đặt bên dưới."}{" "}
              Chỉ muốn <b>giảm kích thước px mà không mất nét</b>: chọn “Giữ nét tối đa” rồi đặt <b>Kích thước tối đa</b> bên dưới — ảnh nhỏ lại nhưng chi tiết giữ gần như nguyên, nên dung lượng cũng giảm ít.
            </p>
            <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>
              Chất lượng: <b style={{ color: "var(--text)" }}>{quality}</b>
              <span style={{ color: "var(--text3)" }}> (cao = nét hơn, nặng hơn)</span>
            </label>
            <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-[var(--gold)]" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Kích thước tối đa</label>
                <select value={maxDim} onChange={(e) => setMaxDim(+e.target.value)} className="input">
                  <option value={0}>Giữ nguyên</option>
                  <option value={4000}>4000 px</option>
                  <option value={3000}>3000 px</option>
                  <option value={2560}>2560 px</option>
                  <option value={2048}>2048 px</option>
                  <option value={1920}>1920 px</option>
                  <option value={1600}>1600 px</option>
                  <option value={1280}>1280 px</option>
                  <option value={1080}>1080 px</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Định dạng</label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="input">
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP (nhẹ hơn)</option>
                </select>
              </div>
            </div>
            {quality >= 92 && format === "image/jpeg" && (
              <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                Muốn nét như mức này mà file <b>nhẹ khoảng một nửa</b>: xuất <b>WebP</b> thay cho JPEG. Facebook, Instagram, Zalo và mọi trình duyệt hiện nay đều nhận WebP.
                <button
                  onClick={() => {
                    setFormat("image/webp");
                    resetOutputs();
                  }}
                  className="ml-2 rounded-md px-2 py-0.5 text-[12px]"
                  style={{ background: "var(--accent)", color: "var(--accentInk)" }}
                >
                  Đổi sang WebP
                </button>
              </p>
            )}
            <label className="mt-4 flex items-start gap-2 text-[13px]" style={{ color: "var(--text2)" }}>
              <input
                type="checkbox"
                checked={compressSharpen}
                onChange={(e) => setCompressSharpen(e.target.checked)}
                className="mt-0.5 accent-[var(--gold)]"
              />
              <span>
                Làm nét sau khi thu nhỏ
                <span style={{ color: "var(--text3)" }}> — chống ảnh mềm nét khi thu nhỏ nhiều. Cần đăng mạng xã hội thì dùng tab <b>Chuẩn mạng xã hội</b> để có đúng khổ.</span>
              </span>
            </label>
            {isPicker && (
              <div className="mt-4 rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--text2)" }}>Sau khi nén, ghi lên Drive:</p>
                <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
                  <input type="radio" name="wm" checked={writeMode === "new"} onChange={() => setWriteMode("new")} className="accent-[var(--gold)]" />
                  Lưu bản nén mới (đuôi <code>_nen</code>, giữ ảnh gốc)
                </label>
                <label className="mt-1.5 flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
                  <input type="radio" name="wm" checked={writeMode === "overwrite"} onChange={() => setWriteMode("overwrite")} className="accent-[var(--gold)]" />
                  <span style={{ color: "var(--gold)" }}>Ghi đè bản gốc</span> (không hoàn tác)
                </label>
              </div>
            )}
          </>
        )}

        {tool === "convert" && (
          <>
            <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Chuyển sang định dạng</label>
            <select value={targetFormat} onChange={(e) => setTargetFormat(e.target.value as OutputFormat)} className="input">
              <option value="image/jpeg">JPEG (.jpg)</option>
              <option value="image/png">PNG (.png)</option>
              <option value="image/webp">WebP (.webp)</option>
            </select>
            <p className="mt-2 text-[12px]" style={{ color: "var(--text3)" }}>
              Chuyển giữa JPEG / PNG / WebP, giữ chất lượng cao. (Đầu vào HEIC/RAW có thể không hỗ trợ tuỳ trình duyệt.)
            </p>
          </>
        )}

        {tool === "watermark" && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setWmType("text")} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]" style={effectiveWmType === "text" ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                <Type size={14} /> Chữ
              </button>
              <button
                onClick={() => pro && setWmType("image")}
                disabled={!pro}
                title={pro ? "" : "Tính năng dành cho tài khoản nâng cấp"}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
                style={effectiveWmType === "image" ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
              >
                <ImageIcon size={14} /> Ảnh / Logo {!pro && "🔒"}
              </button>
              {!pro && <span className="text-[12px]" style={{ color: "var(--text3)" }}>Watermark logo cần nâng cấp</span>}
            </div>
            {effectiveWmType === "text" ? (
              <>
                <input value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="Chữ watermark" className="input" />
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-[13px]" style={{ color: "var(--text2)" }}>Màu chữ</label>
                  <select value={wmColor} onChange={(e) => setWmColor(e.target.value as "white" | "black")} className="input w-auto px-2 py-1 text-xs">
                    <option value="white">Trắng</option>
                    <option value="black">Đen</option>
                  </select>
                </div>
                <label className="mt-3 block text-[13px]" style={{ color: "var(--text2)" }}>Cỡ chữ: <b style={{ color: "var(--text)" }}>{wmTextScale}%</b></label>
                <input type="range" min={2} max={12} value={wmTextScale} onChange={(e) => setWmTextScale(+e.target.value)} className="w-full accent-[var(--gold)]" />
              </>
            ) : (
              <>
                <button onClick={() => wmFileInput.current?.click()} className="btn-ghost w-full py-2.5">
                  <ImageIcon size={15} /> {wmImgName ? "Đổi ảnh watermark" : "Chọn ảnh watermark (PNG trong suốt)"}
                </button>
                <input ref={wmFileInput} type="file" accept="image/*" hidden onChange={pickWatermarkImage} />
                {wmImgName && <p className="mt-2 text-[12.5px]" style={{ color: "var(--text2)" }}>Logo: <b>{wmImgName}</b></p>}
                <label className="mt-3 block text-[13px]" style={{ color: "var(--text2)" }}>Kích cỡ logo: <b style={{ color: "var(--text)" }}>{wmImageScale}%</b></label>
                <input type="range" min={5} max={60} value={wmImageScale} onChange={(e) => setWmImageScale(+e.target.value)} className="w-full accent-[var(--gold)]" />
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Vị trí</label>
                <select value={wmPos} onChange={(e) => setWmPos(e.target.value as WmPosition)} className="input">
                  {POS_OPTIONS.map((o) => (<option key={o.v} value={o.v}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Định dạng xuất</label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="input">
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG</option>
                </select>
              </div>
            </div>
            <label className="mt-3 block text-[13px]" style={{ color: "var(--text2)" }}>Độ mờ: <b style={{ color: "var(--text)" }}>{wmOpacity}%</b></label>
            <input type="range" min={5} max={100} value={wmOpacity} onChange={(e) => setWmOpacity(+e.target.value)} className="w-full accent-[var(--gold)]" />

            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              {pro ? (
                <>
                  <label className="mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>
                    Nén kèm — chất lượng: <b style={{ color: "var(--text)" }}>{quality}</b>
                  </label>
                  <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-[var(--gold)]" />
                  <label className="mt-2 block text-[13px]" style={{ color: "var(--text2)" }}>Kích thước tối đa</label>
                  <select value={maxDim} onChange={(e) => setMaxDim(+e.target.value)} className="input">
                    <option value={0}>Giữ nguyên</option>
                    <option value={4000}>4000 px</option>
                    <option value={2560}>2560 px</option>
                    <option value={2048}>2048 px</option>
                    <option value={1920}>1920 px</option>
                    <option value={1600}>1600 px</option>
                    <option value={1280}>1280 px</option>
                    <option value={1080}>1080 px</option>
                  </select>
                </>
              ) : (
                <p className="text-[12.5px]" style={{ color: "var(--text3)" }}>
                  🔒 Nén ảnh kèm watermark là tính năng dành cho <b>tài khoản nâng cấp</b>. Tài khoản miễn phí xuất ở chất lượng cao mặc định.
                </p>
              )}
            </div>
          </>
        )}

        {activeQuota && (
          <p className="mt-4 text-[12px]" style={{ color: outOfQuota ? "var(--gold)" : "var(--text3)" }}>
            {activeQuota.unlimited
              ? "Không giới hạn"
              : isPicker
              ? `Nén lên Drive: ${activeQuota.used}/${activeQuota.limit}`
              : `Nén tháng này: ${activeQuota.used}/${activeQuota.limit} lượt`}
          </p>
        )}
      </div>

      {/* Live preview panel (first image) — compare original vs processed */}
      {preview && previewSrc && (
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <Eye size={16} style={{ color: "var(--ac)" }} /> Xem thử — {preview.label}
            </h3>
            {/* Gốc ⇄ Đã xử lý */}
            <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowOriginal(true)}
                className="px-3 py-1.5 text-[13px]"
                style={showOriginal ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", color: "var(--text2)" }}
              >
                Gốc
              </button>
              <button
                onClick={() => setShowOriginal(false)}
                className="px-3 py-1.5 text-[13px]"
                style={!showOriginal ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", color: "var(--text2)" }}
              >
                {tool === "convert" ? "Đã đổi" : tool === "social" ? "Chuẩn MXH" : "Đã nén"}
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[13px]" style={{ color: "var(--text2)" }}>
              <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className="rounded-md p-1.5" style={{ border: "1px solid var(--border)" }} title="Thu nhỏ" aria-label="Thu nhỏ"><ZoomOut size={15} /></button>
              <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))} className="rounded-md p-1.5" style={{ border: "1px solid var(--border)" }} title="Phóng to" aria-label="Phóng to"><ZoomIn size={15} /></button>
              <button onClick={() => setZoom(1)} className="rounded-md p-1.5" style={{ border: "1px solid var(--border)" }} title="Đặt lại" aria-label="Đặt lại thu phóng"><RotateCcw size={14} /></button>
            </div>
          </div>

          <div
            className="max-h-[65vh] overflow-auto rounded-lg"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            onWheel={(e) => {
              if (!e.ctrlKey) return;
              e.preventDefault();
              setZoom((z) => Math.min(8, Math.max(1, +(z + (e.deltaY < 0 ? 0.4 : -0.4)).toFixed(2))));
            }}
          >
            <img
              src={showOriginal ? previewSrc.origUrl : preview.url}
              alt="preview"
              style={{
                width: `${zoom * 100}%`,
                maxWidth: "none", // override Tailwind preflight (img{max-width:100%}) so zoom can exceed the container
                display: "block",
                margin: "0 auto",
                imageRendering: zoom > 2 ? "pixelated" : "auto",
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]" style={{ color: "var(--text2)" }}>
            <span>Đang xem: <b style={{ color: "var(--text)" }}>{showOriginal ? "Ảnh gốc" : tool === "convert" ? "Đã đổi định dạng" : tool === "social" ? "Bản chuẩn MXH" : "Đã nén"}</b></span>
            <span>
              Gốc: {previewSrc.img.naturalWidth}×{previewSrc.img.naturalHeight} · {formatBytes(preview.origSize)}
            </span>
            <span>
              Xuất ra: <b style={{ color: "var(--text)" }}>{preview.w}×{preview.h}</b>
              {tool === "social" && <> · {formatExt(outputFormat).toUpperCase()} q{Math.round(preview.quality * 100)}</>}
            </span>
            <span>Sau xử lý: <b style={{ color: "var(--text)" }}>{formatBytes(preview.newSize)}</b> {tool === "convert" && `(.${formatExt(outputFormat)})`}</span>
            {tool !== "convert" && preview.origSize > 0 && preview.newSize < preview.origSize && (
              <span style={{ color: "var(--gold)" }}>Giảm {Math.round((1 - preview.newSize / preview.origSize) * 100)}%</span>
            )}
            <span style={{ color: "var(--text3)" }}>
              Bấm <b>Gốc</b>/<b>{tool === "social" ? "Chuẩn MXH" : "Đã nén"}</b> để so sánh; phóng to để thấy rõ. (Ctrl + lăn chuột để zoom)
            </span>
          </div>
        </div>
      )}

      {/* Action + results */}
      <div className="card p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={items.length === 0 || busy || outOfQuota} className="btn-primary disabled:opacity-40">
            <Minimize2 size={15} />
            {busy && progress ? `Đang xử lý… ${progress.done}/${progress.total}` : `${runLabel} ${items.length || ""} ảnh`}
          </button>
          {results.length > 0 && !(usesQuota && isPicker) && (
            <>
              <button onClick={downloadZip} className="btn-ghost text-[13px]">
                <Download size={14} /> Tải ZIP ({results.length})
              </button>
              {fsSupported && (
                <button onClick={saveToFolder} className="btn-ghost text-[13px]">
                  <Save size={14} /> Lưu vào thư mục…
                </button>
              )}
            </>
          )}
          {results.length > 0 && tool !== "convert" && (
            <span className="ml-auto whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[12px] font-semibold" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
              {formatBytes(totalOriginal)} → {formatBytes(totalNew)} · {savedPct >= 0 ? `giảm ${savedPct}%` : `+${-savedPct}%`}
            </span>
          )}
        </div>

        {/* Hàng đợi xử lý — thanh tiến độ như bản thiết kế, thay vì chỉ đổi chữ trên nút. */}
        {busy && progress && (
          <div className="mb-3">
            <div className="h-[5px] overflow-hidden rounded-[4px]" style={{ background: "var(--bd2)" }}>
              <div
                className="h-full rounded-[4px] transition-[width]"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: "var(--ac)" }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Đang xử lý {progress.done}/{progress.total} ảnh — giữ nguyên tab này cho tới khi xong.
            </p>
          </div>
        )}

        {quotaMsg && (
          <p className="mb-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>{quotaMsg}</p>
        )}
        {writeMsg && <p className="mb-3 text-[13px]" style={{ color: "var(--gold)" }}>{writeMsg}</p>}
        {savingMsg && <p className="mb-3 text-[13px]" style={{ color: "var(--gold)" }}>{savingMsg}</p>}

        {results.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--text3)" }}>
            {items.length === 0 ? "Chọn nguồn ảnh để bắt đầu." : busy ? "Đang xử lý…" : `Sẵn sàng xử lý ${items.length} ảnh.`}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
            {results.map((r, i) => {
              const pct = r.originalSize > 0 ? Math.round((1 - r.newSize / r.originalSize) * 100) : 0;
              return (
                <div key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-[13px]" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text2)" }}>
                  <span className="min-w-0 flex-1 truncate" title={r.name} style={{ color: "var(--text)" }}>{stripExtension(r.name)}</span>
                  <span className="whitespace-nowrap" style={{ color: "var(--text3)" }}>{formatBytes(r.originalSize)} → {formatBytes(r.newSize)}</span>
                  {tool !== "convert" && (
                    <span className="w-14 whitespace-nowrap text-right" style={{ color: pct > 0 ? "var(--gold)" : "var(--text3)" }}>{pct > 0 ? `−${pct}%` : "—"}</span>
                  )}
                  {!(usesQuota && isPicker) && (
                    <button onClick={() => triggerDownload(r.blob, r.out)} className="rounded-md p-1.5" style={{ color: "var(--text2)" }} title="Tải ảnh này" aria-label="Tải ảnh này">
                      <Download size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
