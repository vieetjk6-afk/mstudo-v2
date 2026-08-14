"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Download,
  Check,
  Wifi,
  HardDriveDownload,
  HeartOff,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { buildZip, triggerDownload } from "@/lib/download";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import type { Album, Dislike, Photo, Selection } from "@/lib/types";

interface Group {
  sessionId: string;
  clientName: string | null;
  createdAt: string;
  items: Selection[];
}

export default function SelectionsView({
  album,
  selections,
  dislikes,
  photos,
}: {
  album: Album;
  selections: Selection[];
  dislikes: Dislike[];
  photos: Photo[];
}) {
  const { t } = useLang();
  const supabase = createClient();
  const fileIdByPhoto = useMemo(
    () => new Map(photos.map((p) => [p.id, p.drive_file_id])),
    [photos]
  );

  const [rows, setRows] = useState<Selection[]>(selections);
  const [disRows, setDisRows] = useState<Dislike[]>(dislikes);
  const [copied, setCopied] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  // Live updates: refetch whenever the customer's selection changes.
  useEffect(() => {
    async function refetch() {
      const [{ data }, { data: dis }] = await Promise.all([
        supabase
          .from("selections")
          .select("*")
          .eq("album_id", album.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("dislikes")
          .select("*")
          .eq("album_id", album.id)
          .order("created_at", { ascending: true }),
      ]);
      if (data) setRows(data as Selection[]);
      if (dis) setDisRows(dis as Dislike[]);
    }
    // HAI channel riêng, không gộp binding: một channel chỉ join được khi MỌI
    // binding hợp lệ. DB chưa chạy migration album_dislikes.sql thì binding
    // `dislikes` làm hỏng cả channel — mất luôn cập nhật trực tiếp của
    // selections (tính năng đã có từ trước). Tách ra thì phần nào lỗi phần đó.
    const channel = supabase
      .channel(`selections-${album.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "selections", filter: `album_id=eq.${album.id}` },
        () => refetch()
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const disChannel = supabase
      .channel(`dislikes-${album.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dislikes", filter: `album_id=eq.${album.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(disChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.id]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of rows) {
      if (!map.has(s.session_id)) {
        map.set(s.session_id, {
          sessionId: s.session_id,
          clientName: s.client_name,
          createdAt: s.created_at,
          items: [],
        });
      }
      map.get(s.session_id)!.items.push(s);
    }
    return [...map.values()];
  }, [rows]);

  // ── Ảnh khách không thích ────────────────────────────────────────
  // Studio tick những ảnh muốn bỏ rồi xoá thẳng trên link Drive gốc (mặc định
  // vào Thùng rác Drive để còn phục hồi được).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [delFailed, setDelFailed] = useState<{ name: string; error: string }[]>([]);
  const [driveConn, setDriveConn] = useState<{ configured: boolean; connected: boolean } | null>(null);

  // Mọi ảnh không thích được tick sẵn — trường hợp thường gặp là xoá cả danh sách.
  useEffect(() => {
    setPicked(new Set(disRows.map((d) => d.photo_id)));
  }, [disRows]);

  useEffect(() => {
    if (disRows.length === 0) return;
    fetch("/api/filter/drive/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDriveConn({ configured: !!d.configured, connected: !!d.connected }))
      .catch(() => {});
  }, [disRows.length]);

  const dislikeItems = useMemo(
    () => disRows.map((d) => ({ ...d, fileId: fileIdByPhoto.get(d.photo_id) })),
    [disRows, fileIdByPhoto]
  );
  const pickedItems = useMemo(() => dislikeItems.filter((d) => picked.has(d.photo_id)), [dislikeItems, picked]);

  function togglePick(photoId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function copyDislikeList() {
    navigator.clipboard.writeText(dislikeItems.map((d) => stripExtension(d.photo_name)).join("\n"));
    setCopied("dislikes");
    setTimeout(() => setCopied(null), 2000);
  }

  function exportDislikeList() {
    const text = dislikeItems
      .map((d) => stripExtension(d.photo_name) + (d.client_note ? ` — ${d.client_note}` : ""))
      .join("\n");
    triggerDownload(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `${album.slug}-anh-khong-thich.txt`
    );
  }

  const deleteDisliked = useCallback(async () => {
    if (pickedItems.length === 0 || deleting) return;
    setDeleting(true);
    setDelMsg(null);
    setDelFailed([]);
    try {
      const res = await fetch("/api/filter/delete-from-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: album.id,
          photoIds: pickedItems.map((d) => d.photo_id),
          permanent,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || d?.error) {
        setDelMsg(d?.error || "Không xoá được trên Drive.");
      } else {
        const removed: string[] = d.removedPhotoIds ?? [];
        setDisRows((prev) => prev.filter((r) => !removed.includes(r.photo_id)));
        setRows((prev) => prev.filter((r) => !removed.includes(r.photo_id)));
        setDelFailed(Array.isArray(d.failed) ? d.failed : []);
        setDelMsg(
          `Đã ${d.permanent ? "xoá hẳn" : "chuyển vào Thùng rác Drive"} ${d.deleted}/${pickedItems.length} ảnh` +
            `${d.failed?.length ? ` · ${d.failed.length} ảnh không xoá được` : ""}.`
        );
        setConfirming(false);
      }
    } catch {
      setDelMsg("Mất kết nối khi xoá trên Drive.");
    }
    setDeleting(false);
  }, [album.id, deleting, permanent, pickedItems]);

  async function saveNote(id: string, note: string) {
    setRows((r) =>
      r.map((s) => (s.id === id ? { ...s, photographer_note: note } : s))
    );
    await supabase
      .from("selections")
      .update({ photographer_note: note || null })
      .eq("id", id);
  }

  function copyList(group: Group) {
    const text = group.items
      .map((i) => stripExtension(i.photo_name))
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(group.sessionId);
    setTimeout(() => setCopied(null), 2000);
  }

  function exportList(group: Group) {
    // Filename without extension, plus the customer/photographer note if any.
    const text = group.items
      .map((i) => {
        const note = i.client_note || i.photographer_note;
        return stripExtension(i.photo_name) + (note ? ` — ${note}` : "");
      })
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${album.slug}-${group.clientName || group.sessionId.slice(0, 6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Download the customer-selected photos as a ZIP of ORIGINAL files from Drive
  // (full quality, no resize/watermark).
  async function downloadOriginalsZip(group: Group) {
    const items = group.items
      .map((i) => ({ fileId: fileIdByPhoto.get(i.photo_id), name: i.photo_name }))
      .filter((i): i is { fileId: string; name: string } => Boolean(i.fileId));
    if (items.length === 0) return;

    setZipping(group.sessionId);
    setZipProgress({ done: 0, total: items.length });
    try {
      const blob = await buildZip(items, {
        original: true,
        onProgress: (done, total) => setZipProgress({ done, total }),
      });
      const name = group.clientName || group.sessionId.slice(0, 6);
      triggerDownload(blob, `${album.slug}-${name}-goc.zip`);
    } catch {
      // ignore — user can retry
    } finally {
      setZipping(null);
      setZipProgress(null);
    }
  }

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
                    // eslint-disable-next-line @next/next/no-img-element
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
                  <button
                    onClick={() => downloadOriginalsZip(g)}
                    disabled={zipping !== null}
                    className="btn-ghost text-xs"
                    title="Tải ZIP các ảnh khách chọn ở chất lượng gốc từ Drive"
                  >
                    <HardDriveDownload size={13} />{" "}
                    {zipping === g.sessionId
                      ? zipProgress
                        ? `Đang tải ${zipProgress.done}/${zipProgress.total}…`
                        : "Đang tải…"
                      : "Tải ZIP ảnh gốc"}
                  </button>
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
                          // eslint-disable-next-line @next/next/no-img-element
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
