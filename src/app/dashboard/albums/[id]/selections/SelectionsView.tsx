"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, Check, Wifi, HardDriveDownload } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { buildZip, triggerDownload } from "@/lib/download";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import type { Album, Photo, Selection } from "@/lib/types";

interface Group {
  sessionId: string;
  clientName: string | null;
  createdAt: string;
  items: Selection[];
}

export default function SelectionsView({
  album,
  selections,
  photos,
}: {
  album: Album;
  selections: Selection[];
  photos: Photo[];
}) {
  const { t } = useLang();
  const supabase = createClient();
  const fileIdByPhoto = useMemo(
    () => new Map(photos.map((p) => [p.id, p.drive_file_id])),
    [photos]
  );

  const [rows, setRows] = useState<Selection[]>(selections);
  const [copied, setCopied] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  // Live updates: refetch whenever the customer's selection changes.
  useEffect(() => {
    async function refetch() {
      const { data } = await supabase
        .from("selections")
        .select("*")
        .eq("album_id", album.id)
        .order("created_at", { ascending: true });
      if (data) setRows(data as Selection[]);
    }
    const channel = supabase
      .channel(`selections-${album.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "selections", filter: `album_id=eq.${album.id}` },
        () => refetch()
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
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
