"use client";

import { useState } from "react";
import {
  CheckCircle2, CloudUpload, Download, Eye, FolderInput, Image as ImageIcon, ImagePlus, Lock, Minimize2, RotateCcw,
  Save, Search, Share2, Stamp, FileImage, Type, ZoomIn, ZoomOut,
} from "lucide-react";
import { stripExtension } from "@/lib/drive";
import { triggerDownload } from "@/lib/download";
import { formatExt, formatBytes, type OutputFormat, type WmPosition } from "@/lib/compress";
import { PLATFORMS, presetsFor, ratioLabel } from "@/lib/social-presets";
import { Badge, Callout, Empty, Field, Progress, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Segmented, Switch } from "@/components/v2/kit-client";
import { useCompressTool, POS_OPTIONS, FIT_OPTIONS, GOALS, BUDGETS, type SourceKind, type ToolPanelProps } from "./useCompressTool";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   NÉN ẢNH · CHUẨN MXH · WATERMARK · ĐỔI ĐỊNH DẠNG — giao diện mới. Cùng logic
   với ToolPanel (./useCompressTool); khác ở cách sắp xếp:
     • Cột trái: thẻ "Ảnh cần xử lý" (kéo-thả / chọn ảnh, thư mục, link Drive,
       Google Drive ghi lại) → xem thử trước/sau → danh sách kết quả.
     • Cột phải (dính khi cuộn): mọi tuỳ chọn của công cụ đang mở + MỘT nút
       chính "Nén N ảnh" ở cuối. Điện thoại: thứ tự ảnh → tuỳ chọn → kết quả.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIM_OPTIONS = [0, 4000, 3000, 2560, 2048, 1920, 1600, 1280, 1080];
const WM_DIM_OPTIONS = [0, 4000, 2560, 2048, 1920, 1600, 1280, 1080];
const dimLabel = (v: number) => (v ? `${v} px` : "Giữ nguyên");

const OPTION_TITLE: Record<ToolPanelProps["tool"], { title: string; icon: typeof Share2 }> = {
  social: { title: "Khổ chuẩn mạng xã hội", icon: Share2 },
  compress: { title: "Thiết lập nén", icon: Minimize2 },
  watermark: { title: "Watermark", icon: Stamp },
  convert: { title: "Đổi định dạng", icon: FileImage },
};

export default function ToolPanelV2(props: ToolPanelProps) {
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
    pickLocal, addLocalFiles, pickLocalFolder, loadDrive, pickFromDrive, pickWatermarkImage,
    preset, budgetBytes, switchPlatform, switchPreset, maxSharpness, socialPlan, tooSmall, cropPct,
    effectiveWmType, outputFormat, run, downloadZip, saveToFolder,
    totalOriginal, totalNew, savedPct, runLabel,
  } = useCompressTool(props);

  const [dragOver, setDragOver] = useState(false);
  const writesToDrive = usesQuota && isPicker;
  const processedWord = tool === "convert" ? "Đã đổi" : tool === "social" ? "Chuẩn MXH" : tool === "watermark" ? "Đã gắn" : "Đã nén";
  const OptIcon = OPTION_TITLE[tool].icon;

  const sourceOptions: { value: SourceKind; label: React.ReactNode }[] = [
    { value: "local", label: "Máy tính" },
    { value: "link", label: "Link Drive" },
    ...(allowPicker ? [{ value: "picker" as SourceKind, label: "Google Drive (ghi lại)" }] : []),
  ];

  // Vị trí trên lưới 2 cột (máy tính): cột phải là tuỳ chọn, dính suốt chiều cao.
  const hasPreview = !!(preview && previewSrc);

  /* ── Khối: ảnh cần xử lý ───────────────────────────────────── */
  const sourceCard = (
    <Section
      title="Ảnh cần xử lý"
      icon={ImagePlus}
      className="lg:col-start-1 lg:row-start-1"
      actions={items.length ? <Badge tone="brand">{items.length} ảnh</Badge> : undefined}
    >
      <div className="flex flex-col gap-3">
        <div>
          <Segmented value={source} onChange={switchSource} label="Nguồn ảnh" options={sourceOptions} />
        </div>

        {source === "local" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addLocalFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className="flex flex-col items-center justify-center rounded-[14px] px-4 py-8 text-center transition-colors"
            style={{
              border: `1.5px dashed ${dragOver ? "var(--ac)" : "var(--bdS)"}`,
              background: dragOver ? "var(--acS)" : "var(--sf2)",
            }}
          >
            <span className="v2-section-icon" style={{ width: 44, height: 44 }}>
              <ImagePlus size={21} />
            </span>
            <p className="mt-3 text-[14.5px] font-semibold">{items.length ? srcLabel : "Kéo thả ảnh vào đây"}</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              JPG, PNG, WebP, HEIC… — xử lý ngay trên máy, ảnh không tải lên máy chủ.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className={btn("secondary")}>
                <ImageIcon size={16} /> {items.length ? "Chọn ảnh khác" : "Chọn ảnh"}
              </button>
              <button type="button" onClick={pickLocalFolder} className={btn("secondary")}>
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
          </div>
        ) : null}

        {source === "link" ? (
          <Field label="Link thư mục Drive" htmlFor="cmp-drive" hint="Thư mục phải chia sẻ công khai (Bất kỳ ai có đường liên kết).">
            <div className="flex gap-2">
              <input id="cmp-drive" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={inputCls} />
              <button type="button" onClick={loadDrive} disabled={loadingDrive || !driveUrl.trim()} className={btn("secondary", "md", "flex-none disabled:opacity-50")}>
                <Search size={15} /> {loadingDrive ? "Đang tải…" : "Tải ảnh"}
              </button>
            </div>
          </Field>
        ) : null}

        {source === "picker" ? (
          <div className="flex flex-col items-center rounded-[14px] px-4 py-6 text-center" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            <button type="button" onClick={pickFromDrive} disabled={picking} className={btn("secondary", "md", "disabled:opacity-50")}>
              <CloudUpload size={16} /> {picking ? "Đang mở Drive…" : "Chọn từ Google Drive"}
            </button>
            <p className="mt-2 max-w-[460px] text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Đăng nhập Google, chọn ảnh hoặc thư mục (kể cả Drive riêng tư). Kết quả tự ghi lại lên Drive theo tuỳ chọn bên cạnh.
            </p>
          </div>
        ) : null}

        {driveError ? <p className="text-[13px]" style={{ color: "var(--rd)" }}>{driveError}</p> : null}
        {srcLabel && source !== "local" ? (
          <p className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
            <CheckCircle2 size={15} style={{ color: "var(--gn)" }} /> {srcLabel}
          </p>
        ) : null}
      </div>
    </Section>
  );

  /* ── Khối: tuỳ chọn + nút chính ────────────────────────────── */
  const optionsCard = (
    <section className="v2-card lg:sticky lg:top-4 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
      <header className="v2-section-head">
        <span className="v2-section-icon"><OptIcon size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">{OPTION_TITLE[tool].title}</h3>
        </div>
      </header>
      <div className="v2-card-pad flex flex-col gap-4">
        {tool === "social" ? (
          <>
            <Field label="Nền tảng">
              <Choice
                cols={3}
                value={platform}
                onChange={switchPlatform}
                options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </Field>
            <Field label="Khổ đăng" htmlFor="cmp-preset">
              <select id="cmp-preset" value={presetId} onChange={(e) => switchPreset(e.target.value)} className={inputCls}>
                {presetsFor(platform).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <div className="rounded-[10px] px-3 py-2.5 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                <p>
                  <b style={{ color: "var(--tx)" }}>{preset.w}×{preset.h}px</b> · tỉ lệ {ratioLabel(preset.w, preset.h)} · {formatExt(preset.format).toUpperCase()} q{Math.round(preset.quality * 100)}
                  {preset.maxBytes > 0 ? <> · dưới {formatBytes(preset.maxBytes)}</> : null}
                </p>
                <p className="mt-0.5" style={{ color: "var(--tx3)" }}>{preset.note}</p>
              </div>
            </Field>
            <Field label="Ảnh không đúng tỉ lệ khung thì" hint={FIT_OPTIONS.find((o) => o.v === fit)?.hint}>
              <Choice cols={3} value={fit} onChange={setFit} options={FIT_OPTIONS.map((o) => ({ value: o.v, label: o.label }))} />
            </Field>
            {fit === "pad" ? (
              <Field label="Màu viền" htmlFor="cmp-pad">
                <select id="cmp-pad" value={padColor} onChange={(e) => setPadColor(e.target.value)} className={inputCls}>
                  <option value="#ffffff">Trắng</option>
                  <option value="#000000">Đen</option>
                  <option value="#f2f2f2">Xám nhạt</option>
                </select>
              </Field>
            ) : null}
            <Range
              label="Chất lượng"
              value={socialQ}
              display={`${socialQ}`}
              min={70}
              max={100}
              onChange={setSocialQ}
              note={`Mức chuẩn của khổ này: ${Math.round(preset.quality * 100)}`}
              extra={
                <button type="button" onClick={maxSharpness} className={btn("ghost", "sm")} title="Chất lượng 96 và bỏ trần dung lượng — nét nhất, file nặng hơn">
                  Nét tối đa
                </button>
              }
            />
            {socialQ > Math.round(preset.quality * 100) && budgetBytes > 0 ? (
              <p className="-mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                Còn trần {formatBytes(budgetBytes)} nên công cụ sẽ tự hạ lại cho vừa. Muốn giữ đúng mức này: Trần dung lượng → Không đặt trần.
              </p>
            ) : null}
            <Range label="Làm nét sau khi thu nhỏ" value={sharpen} display={`${sharpen}%`} min={0} max={80} onChange={setSharpen} note="Bù phần nét mất khi mạng xã hội nén lại." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Trần dung lượng" htmlFor="cmp-budget">
                <select id="cmp-budget" value={budget} onChange={(e) => setBudget(+e.target.value)} className={inputCls}>
                  {BUDGETS.map((b) => (
                    <option key={b.v} value={b.v}>{b.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Định dạng" htmlFor="cmp-sfmt">
                <select id="cmp-sfmt" value={socialFormat} onChange={(e) => setSocialFormat(e.target.value as OutputFormat)} className={inputCls}>
                  <option value="image/jpeg">JPEG (ảnh chụp)</option>
                  <option value="image/png">PNG (đồ hoạ, chữ)</option>
                </select>
              </Field>
            </div>
            {tooSmall ? (
              <Callout tone="amber">
                Ảnh gốc nhỏ hơn khung chuẩn nên bản xuất chỉ đạt <b>{socialPlan ? `${socialPlan.canvas.w}×${socialPlan.canvas.h}` : ""}</b> — vẫn đúng tỉ lệ, không bị phóng to thành mờ.
              </Callout>
            ) : null}
            {fit === "cover" && cropPct >= 8 ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Khổ này cắt bỏ khoảng <b>{cropPct}%</b> ảnh gốc (cắt giữa). Muốn giữ trọn ảnh: chọn “Giữ nguyên tỉ lệ” hoặc “Thêm viền”.
              </p>
            ) : null}
            {preview?.overBudget ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Ảnh nhiều chi tiết nên vẫn nặng hơn trần {formatBytes(budgetBytes)} dù đã hạ chất lượng hết mức — cứ đăng bình thường.
              </p>
            ) : null}
            {isPicker ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Bản chuẩn MXH luôn lưu thành <b>file mới</b> (đuôi <code>_{preset.id}</code>) trên Drive — ảnh gốc giữ nguyên.
              </p>
            ) : null}
          </>
        ) : null}

        {tool === "compress" ? (
          <>
            <Field label="Mục tiêu" hint={GOALS.find((g) => g.v === quality)?.hint ?? "Đang dùng mức tự đặt bên dưới."}>
              <Choice
                cols={3}
                value={GOALS.some((g) => g.v === quality) ? quality : -1}
                onChange={(v) => {
                  setQuality(v);
                  setCompressSharpen(true);
                  resetOutputs();
                }}
                options={GOALS.map((g) => ({ value: g.v, label: g.label }))}
              />
            </Field>
            <Range label="Chất lượng" value={quality} display={`${quality}`} min={40} max={100} onChange={setQuality} note="Cao = nét hơn, nặng hơn." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kích thước tối đa" htmlFor="cmp-dim">
                <select id="cmp-dim" value={maxDim} onChange={(e) => setMaxDim(+e.target.value)} className={inputCls}>
                  {DIM_OPTIONS.map((v) => (
                    <option key={v} value={v}>{dimLabel(v)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Định dạng" htmlFor="cmp-fmt">
                <select id="cmp-fmt" value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className={inputCls}>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP (nhẹ hơn)</option>
                </select>
              </Field>
            </div>
            <p className="-mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>
              Chỉ muốn giảm kích thước px mà không mất nét: chọn “Giữ nét tối đa” rồi đặt Kích thước tối đa.
            </p>
            {quality >= 92 && format === "image/jpeg" ? (
              <Callout
                tone="blue"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("image/webp");
                      resetOutputs();
                    }}
                    className={btn("secondary", "sm")}
                  >
                    Đổi sang WebP
                  </button>
                }
              >
                Nét như mức này mà file nhẹ khoảng một nửa: xuất WebP. Facebook, Instagram, Zalo đều nhận.
              </Callout>
            ) : null}
            <Switch
              checked={compressSharpen}
              onChange={setCompressSharpen}
              label="Làm nét sau khi thu nhỏ"
              desc="Chống ảnh mềm khi thu nhỏ nhiều. Đăng mạng xã hội thì dùng tab Chuẩn mạng xã hội."
            />
            {isPicker ? (
              <Field label="Sau khi nén, ghi lên Drive">
                <Choice
                  cols={2}
                  value={writeMode}
                  onChange={setWriteMode}
                  options={[
                    { value: "new", label: "Lưu bản mới (_nen)" },
                    { value: "overwrite", label: "Ghi đè bản gốc" },
                  ]}
                />
                {writeMode === "overwrite" ? (
                  <p className="text-[12px]" style={{ color: "var(--rd)" }}>Ghi đè giữ nguyên tên & link nhưng không hoàn tác được.</p>
                ) : null}
              </Field>
            ) : null}
          </>
        ) : null}

        {tool === "convert" ? (
          <Field label="Chuyển sang định dạng" htmlFor="cmp-target" hint="Giữ chất lượng cao. Đầu vào HEIC/RAW có thể không đọc được tuỳ trình duyệt.">
            <Choice
              cols={3}
              value={targetFormat}
              onChange={setTargetFormat}
              options={[
                { value: "image/jpeg" as OutputFormat, label: "JPEG" },
                { value: "image/png" as OutputFormat, label: "PNG" },
                { value: "image/webp" as OutputFormat, label: "WebP" },
              ]}
            />
          </Field>
        ) : null}

        {tool === "watermark" ? (
          <>
            <Field label="Loại watermark" hint={pro ? undefined : "Watermark bằng logo cần tài khoản nâng cấp."}>
              <Choice
                cols={2}
                value={effectiveWmType}
                onChange={(v) => (v === "text" || pro) && setWmType(v)}
                options={[
                  { value: "text" as const, label: <><Type size={14} /> Chữ</> },
                  { value: "image" as const, label: <>{pro ? <ImageIcon size={14} /> : <Lock size={13} />} Ảnh / Logo</>, disabled: !pro },
                ]}
              />
            </Field>
            {effectiveWmType === "text" ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                  <Field label="Chữ watermark" htmlFor="cmp-wmtext">
                    <input id="cmp-wmtext" value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="Tên studio" className={inputCls} />
                  </Field>
                  <Field label="Màu chữ" htmlFor="cmp-wmcolor">
                    <select id="cmp-wmcolor" value={wmColor} onChange={(e) => setWmColor(e.target.value as "white" | "black")} className={inputCls}>
                      <option value="white">Trắng</option>
                      <option value="black">Đen</option>
                    </select>
                  </Field>
                </div>
                <Range label="Cỡ chữ" value={wmTextScale} display={`${wmTextScale}%`} min={2} max={12} onChange={setWmTextScale} />
              </>
            ) : (
              <>
                <Field label="Logo">
                  <button type="button" onClick={() => wmFileInput.current?.click()} className={btn("secondary", "md", "w-full justify-start")}>
                    <ImageIcon size={16} style={{ color: "var(--ac)" }} />
                    <span className="min-w-0 flex-1 truncate text-left">{wmImgName || "Chọn ảnh watermark (PNG trong suốt)"}</span>
                    {wmImgName ? <span className="text-[12px]" style={{ color: "var(--tx3)" }}>Đổi</span> : null}
                  </button>
                  <input ref={wmFileInput} type="file" accept="image/*" hidden onChange={pickWatermarkImage} />
                </Field>
                <Range label="Kích cỡ logo" value={wmImageScale} display={`${wmImageScale}%`} min={5} max={60} onChange={setWmImageScale} />
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vị trí" htmlFor="cmp-wmpos">
                <select id="cmp-wmpos" value={wmPos} onChange={(e) => setWmPos(e.target.value as WmPosition)} className={inputCls}>
                  {POS_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Định dạng xuất" htmlFor="cmp-wmfmt">
                <select id="cmp-wmfmt" value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className={inputCls}>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG</option>
                </select>
              </Field>
            </div>
            <Range label="Độ mờ" value={wmOpacity} display={`${wmOpacity}%`} min={5} max={100} onChange={setWmOpacity} />
            <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--bd)" }}>
              {pro ? (
                <>
                  <Range label="Nén kèm — chất lượng" value={quality} display={`${quality}`} min={40} max={100} onChange={setQuality} />
                  <Field label="Kích thước tối đa" htmlFor="cmp-wmdim">
                    <select id="cmp-wmdim" value={maxDim} onChange={(e) => setMaxDim(+e.target.value)} className={inputCls}>
                      {WM_DIM_OPTIONS.map((v) => (
                        <option key={v} value={v}>{dimLabel(v)}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <p className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  <Lock size={14} className="mt-0.5 flex-none" /> Nén kèm watermark dành cho tài khoản nâng cấp. Tài khoản miễn phí xuất ở chất lượng cao mặc định.
                </p>
              )}
            </div>
          </>
        ) : null}

        {/* Nút chính duy nhất của màn */}
        <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--bd)" }}>
          <button type="button" onClick={run} disabled={items.length === 0 || busy || outOfQuota} className={btn("primary", "lg", "w-full disabled:opacity-50")}>
            <OptIcon size={17} />
            {busy && progress ? `Đang xử lý… ${progress.done}/${progress.total}` : `${runLabel}${items.length ? ` ${items.length} ảnh` : ""}`}
          </button>
          <p className="text-center text-[12px]" style={{ color: outOfQuota ? "var(--am)" : "var(--tx3)" }}>
            {items.length === 0
              ? "Chọn ảnh ở khối “Ảnh cần xử lý” trước."
              : activeQuota
                ? activeQuota.unlimited
                  ? "Không giới hạn lượt"
                  : isPicker
                    ? `Lượt nén lên Drive: ${activeQuota.used}/${activeQuota.limit}`
                    : `Lượt nén tháng này: ${activeQuota.used}/${activeQuota.limit}`
                : "Không tính lượt"}
          </p>
        </div>
      </div>
    </section>
  );

  /* ── Khối: xem thử trước/sau ───────────────────────────────── */
  const previewCard =
    preview && previewSrc ? (
      <Section
        title={`Xem thử — ${preview.label}`}
        icon={Eye}
        className="lg:col-start-1 lg:row-start-2"
        actions={
          <Segmented
            size="sm"
            value={showOriginal ? "orig" : "out"}
            onChange={(v) => setShowOriginal(v === "orig")}
            label="So sánh"
            options={[
              { value: "orig", label: "Gốc" },
              { value: "out", label: processedWord },
            ]}
          />
        }
      >
        <div
          className="relative max-h-[60vh] overflow-auto rounded-[12px]"
          style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
          onWheel={(e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            setZoom((z) => Math.min(8, Math.max(1, +(z + (e.deltaY < 0 ? 0.4 : -0.4)).toFixed(2))));
          }}
        >
          <img
            src={showOriginal ? previewSrc.origUrl : preview.url}
            alt="Xem thử"
            style={{ width: `${zoom * 100}%`, maxWidth: "none", display: "block", margin: "0 auto", imageRendering: zoom > 2 ? "pixelated" : "auto" }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className={iconBtn()} aria-label="Thu nhỏ" title="Thu nhỏ"><ZoomOut size={16} /></button>
            <span className="v2-num w-12 text-center text-[13px]" style={{ color: "var(--tx2)" }}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))} className={iconBtn()} aria-label="Phóng to" title="Phóng to"><ZoomIn size={16} /></button>
            <button type="button" onClick={() => setZoom(1)} className={iconBtn()} aria-label="Đặt lại thu phóng" title="Đặt lại"><RotateCcw size={15} /></button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Badge tone="gray">Gốc {previewSrc.img.naturalWidth}×{previewSrc.img.naturalHeight} · {formatBytes(preview.origSize)}</Badge>
            <Badge tone="blue">
              Ra {preview.w}×{preview.h} · {formatBytes(preview.newSize)}
              {tool === "social" ? ` · ${formatExt(outputFormat).toUpperCase()} q${Math.round(preview.quality * 100)}` : tool === "convert" ? ` · .${formatExt(outputFormat)}` : ""}
            </Badge>
            {tool !== "convert" && preview.origSize > 0 && preview.newSize < preview.origSize ? (
              <Badge tone="green">Giảm {Math.round((1 - preview.newSize / preview.origSize) * 100)}%</Badge>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>Bấm Gốc / {processedWord} để so sánh. Ctrl + lăn chuột để phóng to.</p>
      </Section>
    ) : null;

  /* ── Khối: kết quả ─────────────────────────────────────────── */
  const resultsCard = (
    <Section
      title="Kết quả"
      icon={CheckCircle2}
      className={hasPreview ? "lg:col-start-1 lg:row-start-3" : "lg:col-start-1 lg:row-start-2"}
      desc={
        results.length > 0 && tool !== "convert"
          ? `${formatBytes(totalOriginal)} → ${formatBytes(totalNew)} · ${savedPct >= 0 ? `giảm ${savedPct}%` : `tăng ${-savedPct}%`}`
          : results.length > 0
            ? `${results.length} ảnh đã đổi định dạng`
            : undefined
      }
      actions={
        results.length > 0 && !writesToDrive ? (
          <>
            {fsSupported ? (
              <button type="button" onClick={saveToFolder} className={btn("secondary", "sm")}>
                <Save size={14} /> Lưu vào thư mục
              </button>
            ) : null}
            <button type="button" onClick={downloadZip} className={btn("secondary", "sm")}>
              <Download size={14} /> Tải ZIP ({results.length})
            </button>
          </>
        ) : undefined
      }
      flush={results.length > 0}
    >
      {busy && progress ? (
        <div className={results.length > 0 ? "v2-card-pad" : "mb-4"}>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold">Đang xử lý</span>
            <span className="v2-num" style={{ color: "var(--tx2)" }}>{progress.done}/{progress.total}</span>
          </div>
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>Giữ nguyên tab này cho tới khi xong.</p>
        </div>
      ) : null}
      {quotaMsg || writeMsg || savingMsg ? (
        <div className={`flex flex-col gap-2 ${results.length > 0 ? "v2-card-pad pb-0" : "mb-4"}`}>
          {quotaMsg ? <Callout tone="amber" title={quotaMsg} /> : null}
          {writeMsg ? <Callout tone="green" icon={CloudUpload} title={writeMsg} /> : null}
          {savingMsg ? <Callout tone="green" icon={Save} title={savingMsg} /> : null}
        </div>
      ) : null}

      {results.length === 0 ? (
        busy ? null : (
          <Empty
            compact
            icon={Minimize2}
            title={items.length === 0 ? "Chưa có ảnh nào" : `Sẵn sàng xử lý ${items.length} ảnh`}
            hint={items.length === 0 ? "Chọn ảnh ở trên, chỉnh tuỳ chọn bên cạnh rồi bấm nút xử lý." : "Bấm nút xử lý ở khối tuỳ chọn — kết quả hiện tại đây."}
          />
        )
      ) : (
        <ul className={quotaMsg || writeMsg || savingMsg ? "mt-3" : ""}>
          {results.map((r) => {
            const pct = r.originalSize > 0 ? Math.round((1 - r.newSize / r.originalSize) * 100) : 0;
            return (
              <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-[13px]" style={{ borderTop: "1px solid var(--bd)" }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={r.name}>{stripExtension(r.name)}</span>
                  <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>
                    {formatBytes(r.originalSize)} → {formatBytes(r.newSize)} · .{formatExt(outputFormat)}
                  </span>
                </span>
                {tool !== "convert" ? (
                  pct > 0 ? <Badge tone="green">−{pct}%</Badge> : <Badge tone="gray">—</Badge>
                ) : null}
                {!writesToDrive ? (
                  <button type="button" onClick={() => triggerDownload(r.blob, r.out)} className={iconBtn()} title="Tải ảnh này" aria-label="Tải ảnh này">
                    <Download size={16} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] xl:grid-cols-[minmax(0,1fr)_400px]">
      {sourceCard}
      {optionsCard}
      {previewCard}
      {resultsCard}
    </div>
  );
}

/* ── Ô chọn dạng lưới nút (nhiều lựa chọn hơn Segmented, xuống dòng được) ── */
function Choice<T extends string | number>({
  value,
  onChange,
  options,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  cols?: 2 | 3;
}) {
  return (
    <div className={`grid gap-1.5 ${cols === 2 ? "grid-cols-2" : options.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-center text-[13px] font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={
              on
                ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid var(--ac)", fontWeight: 650 }
                : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Thanh trượt có nhãn + giá trị ───────────────────────────────────────── */
function Range({
  label,
  value,
  display,
  min,
  max,
  onChange,
  note,
  extra,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
  note?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="v2-field">
      <div className="flex items-center justify-between gap-2">
        <span className="v2-label">
          {label}: <span className="v2-num" style={{ color: "var(--ac)" }}>{display}</span>
        </span>
        {extra}
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" style={{ accentColor: "var(--ac)" }} aria-label={label} />
      {note ? <p className="v2-field-hint">{note}</p> : null}
    </div>
  );
}
