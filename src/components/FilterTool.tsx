"use client";

import {
  Link2,
  ListChecks,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Check,
  Search,
  HardDrive,
  FolderInput,
  FolderOutput,
  FolderOpen,
  FolderPlus,
  CopyCheck,
  ExternalLink,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import AiFilterPanel from "@/components/AiFilterPanel";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { useFilterTool } from "@/components/useFilterTool";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Công cụ Lọc ảnh dùng chung cho CẢ hai nơi:
 *  - trang đầy đủ /dashboard/filter (readQueryParams: nạp ?album= / ?drive=)
 *  - popup trong quản lý album (FilterDialog truyền thẳng albumId, compact)
 * Cùng một chức năng: chọn nguồn Drive hoặc nguồn trên máy tính rồi đối chiếu
 * với danh sách ảnh khách chọn / tự nhập.
 *
 * Toàn bộ logic nằm ở ./useFilterTool (dùng chung với bản giao diện mới
 * ./FilterToolV2 — trang /dashboard/filter vẽ bản đó khi bật giao diện mới).
 */
export default function FilterTool({
  albumId: albumIdProp,
  driveUrl: driveUrlProp,
  readQueryParams = false,
  compact = false,
}: {
  /** Mở sẵn với danh sách ảnh khách chọn của album này (dùng cho popup). */
  albumId?: string;
  /** Link thư mục Drive nạp sẵn (nếu không truyền sẽ lấy nguồn của album). */
  driveUrl?: string;
  /** Trang đầy đủ: nạp ?album= / ?drive= / ?driveconn= từ URL. */
  readQueryParams?: boolean;
  /** Bố cục gọn cho popup (padding nhỏ, 2 cột từ md). */
  compact?: boolean;
}) {
  const pad = compact ? "p-4" : "p-6";
  const {
    photoSource, setPhotoSource, fsSupported,
    driveUrl, setDriveUrl, driveFiles, loadingDrive, driveError, driveNote, loadDrive,
    localFiles, localNote, scanningLocal, pickSourceFolder, pickSourceInput, fileInput, folderInput,
    destDir, destName, pickDest, copying, copyMsg, copyDone, copyToDest, openDestFolder,
    mode, setMode, pasteText, setPasteText, albums, albumId, albumNames, loadAlbum,
    copied, zipProgress, thumbs,
    newFolderName, setNewFolderName, driveCopying, driveCopyMsg, driveCopyLink, driveConn, copyToDrive,
    filterQuota, filterMsg, aiOpen, setAiOpen,
    sourceFiles, matched, fmt, setFmt, availableExts, shown, notFound,
    GRID_PAGE, setGridLimit, gridShown,
    copyMatched, exportMatched, zipMatched,
  } = useFilterTool({ albumId: albumIdProp, driveUrl: driveUrlProp, readQueryParams });

  const srcTab = (key: "drive" | "local", label: string, Icon: typeof Link2) => (
    <button
      type="button"
      onClick={() => setPhotoSource(key)}
      className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
      style={photoSource === key ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div>
      {/* Ba bước của bản thiết kế: nguồn ảnh → danh sách cần lọc → nơi lưu.
          Kết quả tự cập nhật theo từng bước nên không cần nút "chạy". */}
      <div className="flex flex-col gap-3">
        <Step no={1} title="Nguồn ảnh" desc="Thư mục chứa TOÀN BỘ ảnh của buổi chụp — trên Google Drive hoặc ngay trên máy tính. Chọn thư mục gốc là quét luôn các thư mục con bên trong.">
          <div className="mb-3 flex gap-2">
            {srcTab("drive", "Google Drive", Link2)}
            {srcTab("local", "Máy tính", HardDrive)}
          </div>

          {photoSource === "drive" ? (
            <>
              <div className="flex gap-2.5">
                <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="input" />
                <button type="button" onClick={() => loadDrive()} disabled={loadingDrive || !driveUrl.trim()} className="btn-primary whitespace-nowrap">
                  <Search size={15} /> {loadingDrive ? "Đang tải…" : "Tải ảnh"}
                </button>
              </div>
              {driveError && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{driveError}</p>}
              {driveNote && (
                <p className="mt-3 text-[13px]" style={{ color: driveFiles.length ? "var(--text2)" : "var(--gold)" }}>
                  {driveNote}
                </p>
              )}

            </>
          ) : (
            <>
              <button
                type="button"
                onClick={pickSourceFolder}
                disabled={scanningLocal}
                className="btn-ghost w-full py-3 disabled:opacity-40"
              >
                <FolderInput size={16} /> {scanningLocal ? "Đang quét thư mục…" : "Chọn thư mục nguồn"}
              </button>
              {/* webkitdirectory: chọn thư mục gốc là lấy luôn file trong thư mục con. */}
              <input
                ref={folderInput}
                type="file"
                multiple
                hidden
                onChange={pickSourceInput}
                {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)}
              />
              <input ref={fileInput} type="file" multiple hidden onChange={pickSourceInput} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-2 text-[12px] underline"
                style={{ color: "var(--tx3)" }}
              >
                hoặc chọn từng ảnh
              </button>
              {localNote && (
                <p className="mt-2 text-[13px]" style={{ color: localFiles.length ? "var(--text2)" : "var(--gold)" }}>
                  {localNote}
                </p>
              )}

            </>
          )}
        </Step>

        {/* LỌC ẢNH BẰNG AI — đứng giữa bước 1 và bước 2 vì nó ĂN nguồn ảnh của
            bước 1 và ĐẺ RA danh sách của bước 2. Cố ý gập lại mặc định: ba bước
            của công cụ vẫn là lối đi chính (khách gửi danh sách tên ảnh), đây là
            lối phụ cho lúc studio muốn máy tự tìm ảnh nhoè & ảnh trùng. */}
        <div className="rounded-[14px]" style={aiOpen ? undefined : { background: "var(--sf)", border: "1px solid var(--bd)" }}>
          {aiOpen ? (
            <AiFilterPanel
              sourceFiles={sourceFiles}
              sourceLabel={photoSource === "drive" ? `${driveFiles.length} ảnh từ link Drive` : `${localFiles.length} ảnh trong thư mục trên máy`}
              compact={compact}
              albumId={albumId || undefined}
              onUseNames={(names) => {
                // Đưa thẳng vào ô "Tự nhập" của bước 2: từ đó mọi nút sẵn có
                // (chép sang thư mục / xoá khỏi Drive) hoạt động y như khi studio
                // dán danh sách của khách.
                setMode("paste");
                setPasteText(names.join("\n"));
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="flex w-full items-center gap-2.5 px-[18px] py-3.5 text-left"
            >
              <span
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full"
                style={{ background: "var(--acS)", color: "var(--ac)" }}
              >
                <Sparkles size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">Lọc ảnh bằng AI</span>
                <span className="block text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                  Để máy tự tìm ảnh nhoè, ảnh chụp lỡ và các chuỗi bấm liên tiếp — chạy trên máy này, không upload.
                </span>
              </span>
              <ChevronDown size={16} style={{ flex: "none", color: "var(--tx3)" }} />
            </button>
          )}
        </div>

        <Step no={2} title="Danh sách cần lọc" desc="Tên ảnh khách gửi — dán tay, hoặc lấy thẳng từ lượt chọn của một album.">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setMode("paste")} className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={mode === "paste" ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}>
              <ClipboardPaste size={14} /> Tự nhập
            </button>
            <button type="button" onClick={() => setMode("album")} className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={mode === "album" ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}>
              <ListChecks size={14} /> Từ lựa chọn khách
            </button>
          </div>

          {mode === "paste" ? (
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Mỗi dòng một tên ảnh, ví dụ:\nIMG_001\nIMG_045\n(không cần đuôi .jpg)"} className={`input resize-y ${compact ? "min-h-[120px]" : "min-h-[160px]"}`} />
          ) : (
            <>
              <select className="input" value={albumId} onChange={(e) => loadAlbum(e.target.value)}>
                <option value="">— Chọn album —</option>
                {albums.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
              </select>
              <p className="mt-3 text-[13px]" style={{ color: "var(--text2)" }}>
                {albumId ? `Khách đã chọn ${albumNames.length} ảnh.` : "Chọn album để lấy danh sách ảnh khách đã chọn."}
              </p>
            </>
          )}
        </Step>

        <Step
          no={3}
          title="Nơi lưu ảnh đã lọc"
          desc={photoSource === "drive"
            ? "Máy chủ tự tạo thư mục “Ảnh lọc” ngay trong thư mục gốc đang lọc rồi chép ảnh đã lọc vào — không phải tải về máy."
            : "Chọn thư mục đích rồi copy thẳng sang; ảnh không rời khỏi máy bạn."}
        >
          {photoSource === "drive" ? (
            driveFiles.length > 0 && driveConn?.configured ? (
      <div className="mt-4 rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text2)" }}>
                          <FolderPlus size={14} /> Copy ảnh đã lọc sang Drive (không tải về máy)
                        </p>

                        {driveConn.connected ? (
                          <>
                            <label className="mb-1 block text-[12px]" style={{ color: "var(--text3)" }}>Tên thư mục ảnh đã lọc</label>
                            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ảnh lọc" className="input" />
                            <button
                              type="button"
                              onClick={copyToDrive}
                              disabled={driveCopying || shown.length === 0}
                              className="btn-primary mt-2 w-full py-2.5 disabled:opacity-40"
                            >
                              <CopyCheck size={15} /> {driveCopying ? "Đang copy…" : `Copy ${shown.length} ảnh sang Drive`}
                            </button>
                            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                              Máy chủ <b>tự tạo thư mục “{newFolderName.trim() || "Ảnh lọc"}” ngay trong thư mục gốc đang lọc</b> rồi chép ảnh đã lọc vào — không cần đăng nhập lại. Thư mục cùng tên đã có thì dùng lại và bỏ qua ảnh đã chép lần trước. Cần link ảnh gốc mà tài khoản Drive đã kết nối có <b>quyền chỉnh sửa</b>.{" "}
                              <a href="/api/filter/drive/connect" className="underline" style={{ color: "var(--text3)" }}>Kết nối lại tài khoản khác</a>
                            </p>
                          </>
                        ) : (
                          <>
                            <a href="/api/filter/drive/connect" className="btn-primary w-full py-2.5">
                              <FolderPlus size={15} /> Kết nối Google Drive (1 lần)
                            </a>
                            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                              Kết nối Google Drive <b>một lần duy nhất</b> — sau đó bấm Copy là chép tự động, <b>không cần đăng nhập lại lần nào</b>. Hãy kết nối bằng tài khoản Google có <b>quyền chỉnh sửa</b> link ảnh gốc. Lần kết nối đầu Google hiện cảnh báo “app chưa được xác minh” → bấm <b>Nâng cao → Tiếp tục</b>.
                            </p>
                          </>
                        )}

                        {driveCopyMsg && (
                          <p className="mt-2 text-[12.5px]" style={{ color: "var(--gold)" }}>
                            {driveCopyMsg}
                          </p>
                        )}
                        {driveCopyLink && !driveCopying && (
                          <a href={driveCopyLink} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-2 w-full py-2.5">
                            <ExternalLink size={15} /> Mở thư mục đích trên Drive
                          </a>
                        )}
                      </div>
            ) : (
              <p className="rounded-[10px] px-3.5 py-3 text-[12.5px] leading-relaxed" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                {driveFiles.length === 0
                  ? "Tải ảnh từ link Drive ở bước 1 trước, rồi chọn nơi lưu tại đây."
                  : "Máy chủ chưa bật copy sang Drive (thiếu cấu hình Google) — tạm thời dùng nút “Xuất .txt” ở phần kết quả, hoặc chuyển nguồn sang “Máy tính” để copy thẳng ra thư mục."}
              </p>
            )
          ) : fsSupported ? (
                  <>
                    <button type="button" onClick={pickDest} className="btn-ghost mt-3 w-full py-3">
                      <FolderOutput size={16} /> Chọn thư mục đích {destName && `· ${destName}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToDest()}
                      disabled={!destDir || shown.length === 0 || copying}
                      className="btn-primary mt-3 w-full py-3 disabled:opacity-40"
                    >
                      <CopyCheck size={16} /> {copying ? "Đang copy…" : `Copy ${shown.length} ảnh sang thư mục đích`}
                    </button>
                    {copyMsg && <p className="mt-2 text-[13px]" style={{ color: "var(--gold)" }}>{copyMsg}</p>}
                    {copyDone && !copying && (
                      <button type="button" onClick={openDestFolder} className="btn-ghost mt-2 w-full py-2.5">
                        <FolderOpen size={15} /> Mở thư mục đích {destName && `· ${destName}`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-[12.5px]" style={{ color: "var(--text3)" }}>
                    Trình duyệt này không hỗ trợ copy trực tiếp ra thư mục. Hãy dùng <b>Chrome/Edge trên máy tính</b> để copy nguồn→đích, hoặc dùng nút “Tải ZIP” bên dưới.
                  </p>
                )}
        </Step>
      </div>

      {/* Kết quả */}
      <div className={`mt-3.5 card ${pad}`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-[14px] font-bold">Kết quả lọc · {shown.length} ảnh</h2>
          {/* Format filter */}
          <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="input w-auto px-2 py-1 text-xs">
            <option value="all">Mọi định dạng</option>
            <option value="image">Ảnh thường (JPG/PNG…)</option>
            <option value="raw">RAW máy ảnh</option>
            {availableExts.map((x) => (
              <option key={x} value={x}>.{x.toUpperCase()}</option>
            ))}
          </select>
          {notFound.length > 0 && (
            <span className="rounded-full px-2.5 py-1 text-[12px]" style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)" }}>
              {notFound.length} tên không tìm thấy
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={copyMatched} disabled={shown.length === 0} className="btn-ghost text-[13px] disabled:opacity-40">
              {copied ? <Check size={14} /> : <Copy size={14} />} Copy (không đuôi)
            </button>
            <button type="button" onClick={exportMatched} disabled={shown.length === 0} className="btn-ghost text-[13px] disabled:opacity-40">
              <FileText size={14} /> Xuất .txt
            </button>
            {/* Chỉ hiện khi ảnh nằm trên MÁY. Nguồn Drive dùng "Copy sang Drive"
                bên dưới — chép thẳng file giữa hai thư mục, không kéo ảnh về
                trình duyệt nên tốn 0 byte băng thông và nhanh hơn nhiều. */}
            {photoSource === "local" && (
              <button type="button" onClick={zipMatched} disabled={shown.length === 0 || zipProgress !== null} className="btn-primary text-[13px] disabled:opacity-40">
                <Download size={14} /> {zipProgress !== null ? `${zipProgress}%` : "Tải ZIP"}
              </button>
            )}
          </div>
        </div>

        {filterQuota && !filterQuota.unlimited && (
          <p className="mb-3 text-[12.5px]" style={{ color: (filterQuota.remaining ?? 0) <= 0 ? "var(--gold)" : "var(--text3)" }}>
            Lọc ảnh tháng này: <b style={{ color: "var(--text)" }}>{filterQuota.used}/{filterQuota.limit}</b> lần
          </p>
        )}
        {filterMsg && (
          <p className="mb-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", color: "var(--gold)" }}>
            {filterMsg}
          </p>
        )}

        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--text3)" }}>
            {sourceFiles.length === 0 ? "Chọn nguồn ảnh và nhập danh sách để bắt đầu lọc." : matched.length === 0 ? "Chưa có ảnh nào khớp danh sách." : "Không có file đúng định dạng đã chọn."}
          </p>
        ) : (
          <div className={`grid items-start gap-3 ${compact ? "[grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]" : "[grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]"}`}>
            {gridShown.map((f) => (
              <div key={f.key} className="overflow-hidden rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex aspect-square items-center justify-center" style={{ color: "var(--text3)" }}>
                  {f.driveId || thumbs[f.key] ? (
                    <img src={f.driveId ? thumbnailUrl(f.driveId, 400) : thumbs[f.key]} alt={f.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <FileText size={28} />
                  )}
                </div>
                <p
                  className="truncate px-2 py-1.5 text-[11px]"
                  style={{ color: "var(--text2)" }}
                  title={f.dir ? `${f.dir}/${f.name}` : f.name}
                >
                  {stripExtension(f.name)}
                </p>
              </div>
            ))}
          </div>
        )}
        {gridShown.length < shown.length && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setGridLimit((n) => n + GRID_PAGE)}
              className="rounded-lg px-4 py-2 text-[13px]"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
            >
              Xem thêm ảnh ({shown.length - gridShown.length} còn lại)
            </button>
          </div>
        )}

        {notFound.length > 0 && (
          <div className="mt-5 rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--gold)" }}>Không tìm thấy trong nguồn ảnh ({notFound.length}):</p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text2)" }}>{notFound.join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Một bước trong công cụ lọc — vòng tròn số + tên bước + mô tả, rồi phần điều
 *  khiển. Đúng khối bước của bản thiết kế, xếp dọc cho dễ đi theo thứ tự. */
function Step({ no, title, desc, children }: { no: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] px-[18px] py-4" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <div className="mb-3 flex items-center gap-3.5">
        <span
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold"
          style={{ background: "var(--acS)", color: "var(--ac)" }}
        >
          {no}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
