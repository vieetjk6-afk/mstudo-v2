"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  CopyCheck,
  Download,
  ExternalLink,
  FileText,
  FolderInput,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  HardDrive,
  ImageOff,
  Link2,
  Search,
  Sparkles,
} from "lucide-react";
import AiFilterPanel from "@/components/AiFilterPanel";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import {
  Badge,
  Callout,
  Card,
  Empty,
  Field,
  PageHead,
  Progress,
  Section,
  Stack,
  btn,
  inputCls,
} from "@/components/v2/kit";
import { Menu, Segmented, Switch } from "@/components/v2/kit-client";
import {
  norm,
  useFilterTool,
  type FilterToolOptions,
} from "@/components/useFilterTool";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   LỌC ẢNH KHÁCH CHỌN — giao diện mới (chỉ ở trang /dashboard/filter; popup
   FilterDialog vẫn dùng bản cũ vì nó nằm ngoài khung giao diện mới). Cùng
   logic với FilterTool (./useFilterTool); khác ở cách sắp xếp:
     • Hai thẻ bước đặt cạnh nhau: ① Mã ảnh khách chọn (lấy từ album hoặc dán
       tay, đếm mã hợp lệ, chép mã theo 4 kiểu) · ② Thư mục ảnh gốc & nơi lưu
       (máy tính hoặc Drive, thư mục con, loại file).
     • MỘT nút lớn "Bắt đầu lọc N mã ảnh…" — chép ảnh khớp sang nơi lưu.
     • Tiến độ + kết quả gom về một khối dưới cùng: số khớp / không thấy,
       lưới ảnh, danh sách mã không tìm thấy.
   ═══════════════════════════════════════════════════════════════════════════ */

type CodeMode = "full" | "digits";
type CopyFmt = "lines" | "comma" | "space" | "ext";

const COPY_FMTS: { v: CopyFmt; label: string }[] = [
  { v: "lines", label: "Xuống dòng" },
  { v: "comma", label: "Dấu phẩy" },
  { v: "space", label: "Dấu cách" },
  { v: "ext", label: "Có đuôi file" },
];

/** "IMG_0012" → "0012" — nhóm số cuối cùng trong tên (đa số máy ảnh đánh số ở cuối). */
function lastDigits(name: string) {
  return name.match(/\d+/g)?.pop() ?? name;
}

export default function FilterToolV2(props: FilterToolOptions) {
  const t = useFilterTool(props);
  const {
    photoSource,
    setPhotoSource,
    fsSupported,
    driveUrl,
    setDriveUrl,
    driveFiles,
    loadingDrive,
    driveError,
    driveNote,
    loadDrive,
    localFiles,
    localNote,
    scanningLocal,
    pickSourceFolder,
    pickSourceInput,
    fileInput,
    folderInput,
    destDir,
    destName,
    pickDest,
    destSub,
    setDestSub,
    copying,
    copyMsg,
    copyDone,
    copyProgress,
    copyToDest,
    openDestFolder,
    mode,
    setMode,
    pasteText,
    setPasteText,
    albums,
    albumId,
    albumNames,
    loadAlbum,
    copied,
    zipProgress,
    thumbs,
    newFolderName,
    setNewFolderName,
    driveCopying,
    driveCopyMsg,
    driveCopyLink,
    driveConn,
    copyToDrive,
    filterQuota,
    filterMsg,
    aiOpen,
    setAiOpen,
    ensureFilterUse,
    sourceFiles,
    wantedNames,
    wantedSet,
    matched,
    fmt,
    setFmt,
    availableExts,
    shown,
    notFound,
    GRID_PAGE,
    setGridLimit,
    gridShown,
    copyMatched,
    exportMatched,
    zipMatched,
  } = t;

  // ── Chép mã (bước ①) ───────────────────────────────────────────
  const [codeMode, setCodeMode] = useState<CodeMode>("full");
  const [justCopied, setJustCopied] = useState<CopyFmt | null>(null);
  useEffect(() => {
    if (!justCopied) return;
    const id = setTimeout(() => setJustCopied(null), 1600);
    return () => clearTimeout(id);
  }, [justCopied]);

  /** Mã duy nhất theo luật ghép (giữ thứ tự khách gửi). */
  const codes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of wantedNames) {
      const k = norm(n);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(stripExtension(n));
    }
    return out;
  }, [wantedNames]);

  async function copyCodes(f: CopyFmt) {
    if (codes.length === 0) return;
    let text: string;
    if (f === "ext") {
      // Tên file thật lấy từ kết quả ghép → tính một lượt lọc như "Copy" ở kết quả.
      if (matched.length > 0 && !(await ensureFilterUse())) return;
      const byKey = new Map<string, string[]>();
      for (const m of matched)
        byKey.set(norm(m.name), [...(byKey.get(norm(m.name)) ?? []), m.name]);
      text = codes.flatMap((c) => byKey.get(norm(c)) ?? [c]).join("\n");
    } else {
      const list = codeMode === "digits" ? codes.map(lastDigits) : codes;
      text = list.join(f === "lines" ? "\n" : f === "comma" ? ", " : " ");
    }
    try {
      await navigator.clipboard.writeText(text);
      setJustCopied(f);
    } catch {
      /* trình duyệt chặn clipboard */
    }
  }

  // ── Nút chính ─────────────────────────────────────────────────
  const isLocal = photoSource === "local";
  const busy = copying || driveCopying || zipProgress !== null;
  const subName = destSub.trim();
  const [useSub, setUseSub] = useState(false);
  function toggleSub(v: boolean) {
    setUseSub(v);
    setDestSub(v ? subName || "Ảnh lọc" : "");
  }

  const driveReady = !!driveConn?.configured && !!driveConn?.connected;
  const needsDriveConnect =
    !isLocal && !!driveConn?.configured && !driveConn?.connected;
  const blocker =
    wantedSet.size === 0
      ? "Nhập hoặc chọn danh sách mã ảnh ở bước ① trước."
      : sourceFiles.length === 0
        ? isLocal
          ? "Chọn thư mục ảnh gốc ở bước ② trước."
          : "Dán link Drive và bấm “Tải ảnh” ở bước ② trước."
        : matched.length === 0
          ? "Chưa có ảnh nào trong nguồn khớp với danh sách mã."
          : shown.length === 0
            ? "Không có file nào đúng loại file đã chọn ở bước ②."
            : !isLocal && driveConn && !driveConn.configured
              ? "Máy chủ chưa bật chép sang Drive — dùng “Xuất .txt” ở phần kết quả, hoặc chuyển nguồn sang Máy tính."
              : null;

  async function start() {
    if (busy || blocker) return;
    if (isLocal) {
      if (!fsSupported) return zipMatched();
      if (!destDir) {
        const dir = await pickDest();
        if (dir) await copyToDest(dir);
        return;
      }
      return copyToDest();
    }
    if (driveReady) return copyToDrive();
  }

  const where = isLocal ? "từ máy tính" : "từ Google Drive";
  const primaryLabel = busy
    ? copyProgress
      ? `Đang chép ${copyProgress.done}/${copyProgress.total} ảnh…`
      : zipProgress !== null
        ? `Đang nén ZIP… ${zipProgress}%`
        : "Đang chép sang Drive…"
    : `Bắt đầu lọc ${wantedSet.size || ""} mã ảnh ${where}`.replace("  ", " ");
  const outLabel = isLocal
    ? fsSupported
      ? destDir
        ? `sẽ chép vào “${destName}${subName ? `/${subName}` : ""}”`
        : "bấm để chọn thư mục lưu rồi chép luôn"
      : "trình duyệt này sẽ tải về file ZIP"
    : `sẽ chép vào thư mục “${newFolderName.trim() || "Ảnh lọc"}” trên Drive`;

  const quotaOut =
    !!filterQuota &&
    !filterQuota.unlimited &&
    (filterQuota.remaining ?? 0) <= 0;

  return (
    <Stack>
      <PageHead
        desc="Khách gửi danh sách mã ảnh — công cụ tách đúng những ảnh đó ra một thư mục riêng để bạn mang đi chỉnh."
        actions={
          <>
            {filterQuota && !filterQuota.unlimited ? (
              <Badge
                tone={quotaOut ? "amber" : "gray"}
                title="Mỗi lần ra một bộ kết quả mới tính một lượt"
              >
                Lượt lọc tháng này {filterQuota.used}/{filterQuota.limit}
              </Badge>
            ) : null}
            <Link href="/dashboard/tools" className={btn("ghost", "sm")}>
              <ArrowLeft size={15} /> Công cụ ảnh
            </Link>
          </>
        }
      />

      {/* ── Hai bước đặt cạnh nhau ─────────────────────────────── */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <StepCard
          no={1}
          title="Mã ảnh khách chọn để lọc"
          desc="Lấy thẳng từ lượt chọn của khách trong album, hoặc dán danh sách khách gửi qua tin nhắn."
        >
          <Field label="Lấy mã từ">
            <div>
              <Segmented
                value={mode}
                onChange={setMode}
                label="Nguồn danh sách mã"
                options={[
                  { value: "album", label: "Album khách chọn" },
                  { value: "paste", label: "Tự dán mã" },
                ]}
              />
            </div>
          </Field>

          {mode === "album" ? (
            <Field
              label="Album"
              htmlFor="flt-album"
              hint={
                albums.length === 0
                  ? "Chưa có album nào đang ở giai đoạn chọn ảnh."
                  : "Chỉ hiện album đang ở giai đoạn khách chọn ảnh."
              }
            >
              <select
                id="flt-album"
                className={inputCls}
                value={albumId}
                onChange={(e) => loadAlbum(e.target.value)}
              >
                <option value="">— Chọn album của khách —</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <div className="v2-field">
            <div className="flex items-center justify-between gap-2">
              <label className="v2-label" htmlFor="flt-codes">
                {mode === "album" ? "Mã khách đã chọn" : "Danh sách mã"}
              </label>
              <Badge
                tone={wantedSet.size ? "green" : "gray"}
                dot={!!wantedSet.size}
              >
                {wantedSet.size} mã hợp lệ
              </Badge>
            </div>
            {mode === "paste" ? (
              <textarea
                id="flt-codes"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  "Mỗi dòng một mã, hoặc cách nhau bằng dấu phẩy:\nIMG_0012\nIMG_0045, IMG_0108\n(không cần đuôi .jpg)"
                }
                className={`${inputCls} resize-y font-mono text-[13px]`}
                style={{ minHeight: 188 }}
                spellCheck={false}
              />
            ) : (
              <textarea
                id="flt-codes"
                readOnly
                value={albumNames.join("\n")}
                placeholder={
                  albumId
                    ? "Khách chưa chọn ảnh nào."
                    : "Chọn album ở trên để lấy danh sách mã."
                }
                className={`${inputCls} resize-y font-mono text-[13px]`}
                style={{ background: "var(--sf2)", minHeight: 188 }}
              />
            )}
          </div>

          <div
            className="rounded-[12px] p-3"
            style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold">
                Chép mã để dán vào Lightroom / Bridge
              </p>
              <Segmented
                size="sm"
                value={codeMode}
                onChange={setCodeMode}
                label="Kiểu mã khi chép"
                options={[
                  { value: "full", label: "Chữ và số" },
                  { value: "digits", label: "Chỉ lấy số" },
                ]}
              />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COPY_FMTS.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => copyCodes(f.v)}
                  disabled={codes.length === 0}
                  className={btn(
                    "secondary",
                    "sm",
                    "w-full disabled:opacity-50",
                  )}
                  title={
                    f.v === "ext"
                      ? "Dùng tên file thật trong nguồn ảnh (kể cả RAW + JPG)"
                      : undefined
                  }
                >
                  {justCopied === f.v ? (
                    <Check
                      size={14}
                      className="flex-none"
                      style={{ color: "var(--gn)" }}
                    />
                  ) : (
                    <Copy size={14} className="flex-none" />
                  )}
                  {justCopied === f.v ? "Đã chép" : f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
              {codeMode === "digits" ? "Chỉ lấy số: IMG_0012 → 0012. " : ""}
              “Có đuôi file” lấy tên file thật trong thư mục ảnh gốc.
            </p>
          </div>
        </StepCard>

        <StepCard
          no={2}
          title={
            isLocal
              ? "Cấu hình thư mục trên máy tính"
              : "Cấu hình thư mục trên Google Drive"
          }
          desc="Thư mục chứa TOÀN BỘ ảnh của buổi chụp — quét luôn các thư mục con bên trong."
        >
          <Field label="Ảnh gốc nằm ở">
            <div>
              <Segmented
                value={photoSource}
                onChange={setPhotoSource}
                label="Nguồn ảnh"
                options={[
                  {
                    value: "local",
                    label: (
                      <>
                        <HardDrive size={14} /> Máy tính
                      </>
                    ),
                  },
                  {
                    value: "drive",
                    label: (
                      <>
                        <Link2 size={14} /> Google Drive
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </Field>

          {isLocal ? (
            <>
              <Field label="Thư mục ảnh gốc">
                <button
                  type="button"
                  onClick={pickSourceFolder}
                  disabled={scanningLocal}
                  className={btn(
                    "secondary",
                    "md",
                    "w-full justify-start disabled:opacity-50",
                  )}
                >
                  <FolderInput size={16} style={{ color: "var(--ac)" }} />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {scanningLocal
                      ? "Đang quét thư mục…"
                      : localFiles.length
                        ? `${localFiles.length} ảnh đã quét — chọn thư mục khác`
                        : "Chọn thư mục nguồn"}
                  </span>
                </button>
                {/* webkitdirectory: chọn thư mục gốc là lấy luôn file trong thư mục con. */}
                <input
                  ref={folderInput}
                  type="file"
                  multiple
                  hidden
                  onChange={pickSourceInput}
                  {...({
                    webkitdirectory: "",
                    directory: "",
                    mozdirectory: "",
                  } as any)}
                />
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={pickSourceInput}
                />
                <div className="flex flex-col items-start gap-1">
                  {localNote ? (
                    <p
                      className="min-w-0 flex-1 text-[12.5px]"
                      style={{
                        color: localFiles.length ? "var(--tx2)" : "var(--am)",
                      }}
                    >
                      {localNote}
                    </p>
                  ) : (
                    <p
                      className="min-w-0 flex-1 text-[12px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      Ảnh không tải lên đâu cả — xử lý ngay trên máy này.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="text-[12px] font-medium underline"
                    style={{ color: "var(--tx3)" }}
                  >
                    hoặc chọn từng ảnh
                  </button>
                </div>
              </Field>

              {fsSupported ? (
                <Field label="Lưu ảnh đã lọc vào">
                  <button
                    type="button"
                    onClick={() => pickDest()}
                    className={btn("secondary", "md", "w-full justify-start")}
                  >
                    <FolderOutput size={16} style={{ color: "var(--ac)" }} />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {destName ? destName : "Chọn thư mục đích"}
                    </span>
                    {destName ? (
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: "var(--tx3)" }}
                      >
                        Đổi
                      </span>
                    ) : null}
                  </button>
                  <div
                    className="rounded-[12px] px-3 py-2.5"
                    style={{ border: "1px solid var(--bd)" }}
                  >
                    <Switch
                      checked={useSub}
                      onChange={toggleSub}
                      label="Tạo thư mục con cho ảnh đã lọc"
                      desc="Không lẫn với file đang có trong thư mục đích."
                    />
                    {useSub ? (
                      <input
                        value={destSub}
                        onChange={(e) => setDestSub(e.target.value)}
                        placeholder="Ảnh lọc"
                        aria-label="Tên thư mục con"
                        className={`${inputCls} mt-2.5`}
                      />
                    ) : null}
                  </div>
                </Field>
              ) : (
                <Callout
                  tone="amber"
                  title="Trình duyệt này không chép thẳng ra thư mục được"
                >
                  Dùng Chrome hoặc Edge trên máy tính để chép sang thư mục đích.
                  Ở đây, nút lọc sẽ tải về một file ZIP.
                </Callout>
              )}
            </>
          ) : (
            <>
              <Field
                label="Link thư mục Drive"
                htmlFor="flt-drive"
                error={driveError ?? undefined}
              >
                <div className="flex gap-2">
                  <input
                    id="flt-drive"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/…"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => loadDrive()}
                    disabled={loadingDrive || !driveUrl.trim()}
                    className={btn(
                      "secondary",
                      "md",
                      "flex-none disabled:opacity-50",
                    )}
                  >
                    <Search size={15} />{" "}
                    {loadingDrive ? "Đang tải…" : "Tải ảnh"}
                  </button>
                </div>
                {driveNote ? (
                  <p
                    className="text-[12.5px]"
                    style={{
                      color: driveFiles.length ? "var(--tx2)" : "var(--am)",
                    }}
                  >
                    {driveNote}
                  </p>
                ) : null}
              </Field>

              {driveConn?.configured ? (
                driveConn.connected ? (
                  <Field
                    label="Tên thư mục ảnh đã lọc"
                    htmlFor="flt-newfolder"
                    hint={
                      <>
                        Máy chủ tự tạo thư mục này ngay trong thư mục gốc rồi
                        chép ảnh vào — không tải về máy. Thư mục cùng tên đã có
                        thì dùng lại, bỏ qua ảnh đã chép.{" "}
                        <a
                          href="/api/filter/drive/connect"
                          className="underline"
                        >
                          Kết nối tài khoản khác
                        </a>
                      </>
                    }
                  >
                    <input
                      id="flt-newfolder"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Ảnh lọc"
                      className={inputCls}
                    />
                  </Field>
                ) : (
                  <Callout
                    tone="blue"
                    icon={FolderPlus}
                    title="Kết nối Google Drive một lần"
                    action={
                      <a
                        href="/api/filter/drive/connect"
                        className={btn("secondary", "sm")}
                      >
                        Kết nối
                      </a>
                    }
                  >
                    Sau đó bấm lọc là chép tự động, không đăng nhập lại. Dùng
                    tài khoản có quyền chỉnh sửa link ảnh gốc. Google báo “app
                    chưa được xác minh” thì bấm Nâng cao → Tiếp tục.
                  </Callout>
                )
              ) : null}
            </>
          )}

          <Field label="Loại file cần lấy">
            <div>
              <Segmented
                value={
                  fmt === "all" || fmt === "raw" || fmt === "image"
                    ? fmt
                    : ("" as string)
                }
                onChange={setFmt}
                label="Loại file"
                options={[
                  {
                    value: "all",
                    label: (
                      <span>
                        Tất cả
                        <span className="hidden sm:inline">
                          &nbsp;(RAW & JPG)
                        </span>
                      </span>
                    ),
                  },
                  { value: "raw", label: "Chỉ RAW" },
                  { value: "image", label: "Chỉ JPG/PNG" },
                ]}
              />
            </div>
          </Field>
        </StepCard>
      </div>

      {/* ── Lối phụ: AI tự tìm ảnh hỏng (gập lại mặc định) ─────── */}
      {aiOpen ? (
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-end px-3 pt-2">
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              className={btn("ghost", "sm")}
            >
              <ChevronUp size={15} /> Thu gọn
            </button>
          </div>
          <AiFilterPanel
            sourceFiles={sourceFiles}
            sourceLabel={
              isLocal
                ? `${localFiles.length} ảnh trong thư mục trên máy`
                : `${driveFiles.length} ảnh từ link Drive`
            }
            albumId={albumId || undefined}
            onUseNames={(names) => {
              setMode("paste");
              setPasteText(names.join("\n"));
            }}
          />
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="v2-card v2-card-link flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span className="v2-section-icon">
            <Sparkles size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">
              Chưa có danh sách của khách? Lọc ảnh bằng AI
            </span>
            <span
              className="block text-[12.5px]"
              style={{ color: "var(--tx3)" }}
            >
              Máy tự tìm ảnh nhoè, chụp lỡ, bấm liên tiếp từ nguồn ở bước ② rồi
              đưa danh sách vào bước ①.
            </span>
          </span>
          <ChevronDown
            size={17}
            style={{ color: "var(--tx3)", flex: "none" }}
          />
        </button>
      )}

      {/* ── Nút chính ─────────────────────────────────────────── */}
      <div>
        {needsDriveConnect ? (
          <a
            href="/api/filter/drive/connect"
            className={btn("primary", "lg", "w-full")}
            style={{ height: 52 }}
          >
            <FolderPlus size={18} /> Kết nối Google Drive để bắt đầu lọc
          </a>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy || !!blocker || quotaOut}
            className={btn("primary", "lg", "w-full disabled:opacity-50")}
            style={{ height: 52, fontSize: 15.5 }}
          >
            <CopyCheck size={19} /> {primaryLabel}
          </button>
        )}
        <p
          className="mt-2 text-center text-[12.5px]"
          style={{ color: blocker || quotaOut ? "var(--am)" : "var(--tx3)" }}
        >
          {quotaOut
            ? "Đã hết lượt lọc của tháng này — nâng cấp gói để lọc không giới hạn."
            : (blocker ?? `Tìm thấy ${shown.length} file khớp · ${outLabel}`)}
        </p>
      </div>

      {/* ── Tiến độ & thông báo ───────────────────────────────── */}
      {filterMsg ? <Callout tone="amber" title={filterMsg} /> : null}
      {copyProgress ? (
        <Card>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold">
              Đang chép ảnh sang thư mục đích
            </span>
            <span className="v2-num" style={{ color: "var(--tx2)" }}>
              {copyProgress.done}/{copyProgress.total}
            </span>
          </div>
          <Progress
            value={
              copyProgress.total
                ? (copyProgress.done / copyProgress.total) * 100
                : 0
            }
          />
          <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
            Giữ nguyên tab này cho tới khi xong.
          </p>
        </Card>
      ) : null}
      {zipProgress !== null ? (
        <Card>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold">Đang nén file ZIP</span>
            <span className="v2-num" style={{ color: "var(--tx2)" }}>
              {zipProgress}%
            </span>
          </div>
          <Progress value={zipProgress} />
        </Card>
      ) : null}
      {copyMsg && !copyProgress ? (
        <Callout
          tone={copyDone ? "green" : "amber"}
          icon={copyDone ? CopyCheck : undefined}
          title={copyMsg}
          action={
            copyDone && !copying ? (
              <button
                type="button"
                onClick={openDestFolder}
                className={btn("secondary", "sm")}
              >
                <FolderOpen size={15} /> Mở thư mục
              </button>
            ) : undefined
          }
        />
      ) : null}
      {driveCopyMsg && !isLocal ? (
        <Callout
          tone={driveCopyLink ? "green" : "blue"}
          title={driveCopyMsg}
          action={
            driveCopyLink && !driveCopying ? (
              <a
                href={driveCopyLink}
                target="_blank"
                rel="noopener noreferrer"
                className={btn("secondary", "sm")}
              >
                <ExternalLink size={15} /> Mở trên Drive
              </a>
            ) : undefined
          }
        />
      ) : null}

      {/* ── Kết quả ───────────────────────────────────────────── */}
      <Section
        title="Kết quả lọc"
        desc={
          sourceFiles.length === 0
            ? "Hiện ngay khi có danh sách mã và thư mục ảnh gốc."
            : `${shown.length} file khớp${notFound.length ? ` · ${notFound.length} mã không tìm thấy` : ""} · nguồn có ${sourceFiles.length} ảnh`
        }
      >
        {matched.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={fmt}
              onChange={(e) => setFmt(e.target.value)}
              className={inputCls}
              style={{ flex: "1 1 0", minWidth: 0, maxWidth: 240, height: 32, fontSize: 13 }}
              aria-label="Lọc theo đuôi file"
            >
              <option value="all">Mọi định dạng</option>
              <option value="image">Ảnh thường (JPG/PNG…)</option>
              <option value="raw">RAW máy ảnh</option>
              {availableExts.map((x) => (
                <option key={x} value={x}>
                  .{x.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={copyMatched}
              disabled={shown.length === 0}
              className={btn("secondary", "sm", "ml-auto disabled:opacity-50")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} Chép tên
            </button>
            <Menu
              items={[
                {
                  label: "Xuất danh sách .txt",
                  icon: FileText,
                  onClick: exportMatched,
                  disabled: shown.length === 0,
                },
                ...(isLocal
                  ? [
                      {
                        label:
                          zipProgress !== null
                            ? `Đang nén… ${zipProgress}%`
                            : "Tải ZIP ảnh đã lọc",
                        icon: Download,
                        onClick: zipMatched,
                        disabled: shown.length === 0 || zipProgress !== null,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        ) : null}
        {sourceFiles.length > 0 && wantedSet.size > 0 ? (
          <div className="mb-4 grid grid-cols-3 gap-2">
            <MiniStat label="Mã cần lọc" value={wantedSet.size} />
            <MiniStat
              label="Đã tìm thấy"
              value={wantedSet.size - notFound.length}
              tone="var(--gn)"
            />
            <MiniStat
              label="Không thấy"
              value={notFound.length}
              tone={notFound.length ? "var(--am)" : undefined}
            />
          </div>
        ) : null}

        {shown.length === 0 ? (
          <Empty
            compact
            icon={sourceFiles.length === 0 ? ClipboardList : ImageOff}
            title={
              sourceFiles.length === 0
                ? "Chưa có ảnh để đối chiếu"
                : matched.length === 0
                  ? "Chưa có ảnh nào khớp danh sách"
                  : "Không có file đúng loại đã chọn"
            }
            hint={
              sourceFiles.length === 0
                ? "Làm hai bước ở trên — kết quả hiện ra ngay, chưa chép gì cho tới khi bạn bấm nút lọc."
                : matched.length === 0
                  ? "Kiểm tra lại mã khách gửi có đúng tên file trong thư mục không."
                  : "Đổi “Loại file cần lấy” ở bước ② sang Tất cả."
            }
          />
        ) : (
          <div className="grid items-start gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(92px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(128px,1fr))]">
            {gridShown.map((f) => (
              <figure
                key={f.key}
                className="overflow-hidden rounded-[10px]"
                style={{
                  background: "var(--sf2)",
                  border: "1px solid var(--bd)",
                }}
              >
                <div
                  className="relative flex aspect-square items-center justify-center"
                  style={{ color: "var(--tx3)" }}
                >
                  {f.driveId || thumbs[f.key] ? (
                    <img
                      src={
                        f.driveId ? thumbnailUrl(f.driveId, 400) : thumbs[f.key]
                      }
                      alt={f.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1">
                      <FileText size={24} />
                      <span className="text-[11px] font-semibold uppercase">
                        {f.name.split(".").pop()}
                      </span>
                    </span>
                  )}
                </div>
                <figcaption
                  className="truncate px-2 py-1.5 text-[11.5px]"
                  style={{ color: "var(--tx2)" }}
                  title={f.dir ? `${f.dir}/${f.name}` : f.name}
                >
                  {stripExtension(f.name)}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {gridShown.length < shown.length ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setGridLimit((n) => n + GRID_PAGE)}
              className={btn("secondary", "sm")}
            >
              Xem thêm ảnh ({shown.length - gridShown.length} còn lại)
            </button>
          </div>
        ) : null}

        {notFound.length > 0 ? (
          <div className="mt-4">
            <Callout
              tone="amber"
              title={`Không tìm thấy trong nguồn ảnh (${notFound.length})`}
            >
              <p className="mt-0.5 break-words font-mono text-[12.5px] leading-relaxed">
                {notFound.join(", ")}
              </p>
            </Callout>
          </div>
        ) : null}
      </Section>
    </Stack>
  );
}

/** Thẻ một bước: số tròn màu chủ đạo + tên bước + mô tả, rồi các ô. */
function StepCard({
  no,
  title,
  desc,
  children,
}: {
  no: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="v2-card flex h-full min-w-0 flex-col">
      <header className="v2-section-head">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-bold"
          style={{ background: "var(--ac)", color: "#fff" }}
          aria-hidden
        >
          {no}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">{title}</h3>
          <p className="v2-section-desc">{desc}</p>
        </div>
      </header>
      <div className="v2-card-pad flex flex-1 flex-col gap-4">{children}</div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div
      className="rounded-[10px] px-3 py-2.5"
      style={{ background: "var(--sf2)" }}
    >
      <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
        {label}
      </p>
      <p
        className="v2-num text-[20px] font-bold leading-tight"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
