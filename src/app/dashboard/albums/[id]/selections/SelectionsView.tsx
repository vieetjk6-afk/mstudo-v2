"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Download,
  Check,
  Wifi,
  HeartOff,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import { useUiV2 } from "@/components/v2/UiV2Context";
import SelectionsV2 from "./SelectionsV2";
import { useSelections, type SelectionsProps } from "./useSelections";

/** Giao diện mới có bản riêng (SelectionsV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function SelectionsView(props: SelectionsProps) {
  return useUiV2() ? <SelectionsV2 {...props} /> : <SelectionsViewV1 {...props} />;
}

function SelectionsViewV1({
  album,
  selections,
  dislikes,
  photos,
}: SelectionsProps) {
  const { t } = useLang();
  const {
    fileIdByPhoto, copied, live, groups,
    picked, setPicked, confirming, setConfirming, permanent, setPermanent, deleting, delMsg, delFailed, driveConn,
    dislikeItems, pickedItems, togglePick, copyDislikeList, exportDislikeList, deleteDisliked,
    saveNote, copyList, exportList,
  } = useSelections({ album, selections, dislikes, photos });

  // Download the customer-selected photos as a ZIP of ORIGINAL files from Drive
  // (full quality, no resize/watermark).

  return (
    <div className="animate-fade-in">
      <Link
        href={`/dashboard/albums/${album.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-accent-muted hover:text-accent"
      >
        <ArrowLeft size={15} /> {t("back")}
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-light text-accent">
          {t("customerSelections")} — {album.title}
        </h1>
        {live && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: "color-mix(in srgb,#3fbf7f 14%,transparent)", color: "#5fd29a" }}
          >
            <Wifi size={12} /> Trực tiếp
          </span>
        )}
        {/* Mở POPUP công cụ Lọc ảnh với sẵn danh sách khách chọn + nguồn Drive
            của album — chọn lọc trên Drive hoặc trên máy tính ngay tại chỗ. */}
        <FilterPhotosButton albumId={album.id} albumTitle={album.title} className="btn-primary ml-auto" />
      </div>

      {/* ── Ảnh khách không thích ──────────────────────────────────────
          Khách bấm "không thích" trong album → ảnh vào đây. Studio xoá thẳng
          các file này trên link Drive gốc nếu khách yêu cầu. */}
      {dislikeItems.length > 0 && (
        <div
          className="card mb-8 p-6"
          style={{ borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)" }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-medium" style={{ color: "var(--danger)" }}>
                <HeartOff size={16} /> Ảnh khách không thích
              </h3>
              <p className="text-xs text-accent-muted">
                {dislikeItems.length} ảnh · khách yêu cầu bỏ khỏi album · đã chọn {pickedItems.length} ảnh để xoá
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyDislikeList} className="btn-ghost text-xs">
                {copied === "dislikes" ? (
                  <>
                    <Check size={13} /> {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy size={13} /> {t("copyList")}
                  </>
                )}
              </button>
              <button onClick={exportDislikeList} className="btn-ghost text-xs">
                <Download size={13} /> {t("exportList")}
              </button>
              <button
                onClick={() => setPicked(new Set(picked.size === dislikeItems.length ? [] : dislikeItems.map((d) => d.photo_id)))}
                className="btn-ghost text-xs"
              >
                <Check size={13} /> {picked.size === dislikeItems.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
              <button
                onClick={() => setConfirming((v) => !v)}
                disabled={pickedItems.length === 0}
                className="btn-ghost text-xs disabled:opacity-40"
                style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)" }}
                title="Xoá các ảnh này trên link Drive gốc"
              >
                <Trash2 size={13} /> Xoá {pickedItems.length} ảnh trên Drive
              </button>
            </div>
          </div>

          {/* Xác nhận — xoá trên Drive không phải việc hoàn tác được bằng một cú
              bấm, nên luôn hỏi lại và mặc định chỉ chuyển vào Thùng rác. */}
          {confirming && (
            <div
              className="mb-4 rounded-xl p-4"
              style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}
            >
              <p className="mb-2 flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--danger)" }}>
                <AlertTriangle size={14} /> Xoá {pickedItems.length} ảnh khỏi link Drive gốc của album?
              </p>
              <p className="mb-3 text-[12.5px] text-accent-muted">
                Ảnh cũng bị bỏ khỏi album nên khách không còn thấy nữa. Tài khoản Google đã kết nối phải là{" "}
                <b>chủ sở hữu</b> các file đó — file của người khác sẽ báo lỗi và được giữ nguyên.
              </p>
              <label className="mb-3 flex items-center gap-2 text-[12.5px] text-accent-muted">
                <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
                Xoá hẳn, không đưa vào Thùng rác{" "}
                <span style={{ color: "var(--danger)" }}>(không phục hồi được)</span>
              </label>

              {driveConn && !driveConn.connected ? (
                <>
                  <a href="/api/filter/drive/connect" className="btn-primary">
                    Kết nối Google Drive (1 lần)
                  </a>
                  <p className="mt-1.5 text-[11.5px] text-accent-muted">
                    Kết nối <b>một lần duy nhất</b> bằng tài khoản Google sở hữu link ảnh gốc — sau đó xoá/copy đều tự động, không cần đăng nhập lại.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={deleteDisliked}
                    disabled={deleting || pickedItems.length === 0}
                    className="btn-primary text-xs disabled:opacity-40"
                    style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }}
                  >
                    <Trash2 size={13} />{" "}
                    {deleting
                      ? "Đang xoá…"
                      : permanent
                        ? `Xoá hẳn ${pickedItems.length} ảnh`
                        : `Chuyển ${pickedItems.length} ảnh vào Thùng rác Drive`}
                  </button>
                  <button onClick={() => setConfirming(false)} className="btn-ghost text-xs">
                    Huỷ
                  </button>
                </div>
              )}
            </div>
          )}

          {delMsg && (
            <p className="mb-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "var(--surface2)", color: "var(--gold)" }}>
              {delMsg}{" "}
              {!permanent && (
                <a
                  href="https://drive.google.com/drive/trash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline"
                  style={{ color: "var(--accent)" }}
                >
                  <ExternalLink size={12} /> Mở Thùng rác Drive
                </a>
              )}
            </p>
          )}
          {delFailed.length > 0 && (
            <div className="mb-3 rounded-lg p-3 text-[12px]" style={{ background: "var(--surface2)" }}>
              <p className="mb-1 font-medium" style={{ color: "var(--danger)" }}>
                Không xoá được ({delFailed.length}):
              </p>
              <ul className="space-y-0.5 text-accent-muted">
                {delFailed.slice(0, 12).map((f) => (
                  <li key={f.name}>
                    {stripExtension(f.name)} — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dislikeItems.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer gap-3 rounded-md border border-ink-800 p-2"
                style={
                  picked.has(item.photo_id)
                    ? { borderColor: "color-mix(in srgb, var(--danger) 55%, transparent)" }
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={picked.has(item.photo_id)}
                  onChange={() => togglePick(item.photo_id)}
                  className="mt-1 self-start"
                />
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-ink-850">
                  {item.fileId && (
                    <img
                      src={thumbnailUrl(item.fileId, 160)}
                      alt={item.photo_name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-accent">{item.photo_name}</p>
                  {item.client_note && (
                    <p
                      className="mt-1 rounded px-2 py-1 text-[11px] leading-snug"
                      style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
                      title={item.client_note}
                    >
                      “{item.client_note}”
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card py-16 text-center text-accent-muted">
          {t("noSelections")}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.sessionId} className="card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-accent">
                    {g.clientName ||
                      (g.sessionId === "shared"
                        ? "Lựa chọn của khách"
                        : `${t("session")} ${g.sessionId.slice(0, 8)}`)}
                  </h3>
                  <p className="text-xs text-accent-muted">
                    {g.items.length} {t("photos")} ·{" "}
                    {new Date(g.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyList(g)} className="btn-ghost text-xs">
                    {copied === g.sessionId ? (
                      <>
                        <Check size={13} /> {t("copied")}
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> {t("copyList")}
                      </>
                    )}
                  </button>
                  <button onClick={() => exportList(g)} className="btn-ghost text-xs">
                    <Download size={13} /> {t("exportList")}
                  </button>
                  {/* Nút "Tải ZIP ảnh gốc" đã gỡ: nó kéo TỪNG file gốc (~11 MB)
                      qua /api/img, một album 300 tấm ≈ 3,3 GB băng thông Vercel
                      mỗi lần bấm. Lọc ảnh chép thẳng file giữa hai thư mục Drive
                      nên tốn 0 byte và cũng nhanh hơn nhiều. */}
                  <FilterPhotosButton
                    albumId={album.id}
                    albumTitle={album.title}
                    className="btn-ghost text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((item) => {
                  const fileId = fileIdByPhoto.get(item.photo_id);
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-md border border-ink-800 p-2"
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-ink-850">
                        {fileId && (
                          <img
                            src={thumbnailUrl(fileId, 160)}
                            alt={item.photo_name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-accent">
                          {item.photo_name}
                        </p>
                        {item.client_note && (
                          <p
                            className="mt-1 rounded px-2 py-1 text-[11px] leading-snug"
                            style={{
                              background: "color-mix(in srgb, var(--gold) 12%, transparent)",
                              color: "var(--gold)",
                            }}
                            title={item.client_note}
                          >
                            “{item.client_note}”
                          </p>
                        )}
                        <input
                          defaultValue={item.photographer_note ?? ""}
                          placeholder={t("addNote")}
                          onBlur={(e) => saveNote(item.id, e.target.value)}
                          className="input mt-1 px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
