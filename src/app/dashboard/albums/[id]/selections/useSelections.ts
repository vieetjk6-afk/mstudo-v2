"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stripExtension } from "@/lib/drive";
import { triggerDownload } from "@/lib/download";
import type { Album, Dislike, Photo, Selection } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn "Lựa chọn của khách" (bản cũ SelectionsView và
   bản mới SelectionsV2): cập nhật trực tiếp khi khách chọn, gom theo mã chọn,
   chép/tải danh sách, ghi chú của studio, ảnh khách không thích + xoá trên
   Drive. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Group {
  sessionId: string;
  clientName: string | null;
  createdAt: string;
  items: Selection[];
}

export type SelectionsProps = {
  album: Album;
  selections: Selection[];
  dislikes: Dislike[];
  photos: Photo[];
};

export function useSelections({ album, selections, dislikes, photos }: SelectionsProps) {
  const supabase = createClient();
  const fileIdByPhoto = useMemo(
    () => new Map(photos.map((p) => [p.id, p.drive_file_id])),
    [photos]
  );

  const [rows, setRows] = useState<Selection[]>(selections);
  const [disRows, setDisRows] = useState<Dislike[]>(dislikes);
  const [copied, setCopied] = useState<string | null>(null);
  const [live, setLive] = useState(false);

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
    // Gom sự kiện: mỗi lần khách lưu, server xoá rồi ghi lại CẢ bộ lựa chọn →
    // 300 ảnh đã chọn là ~600 sự kiện liền nhau. Tải lại một lần sau khi yên
    // 500ms thay vì 600 lượt tải toàn bộ.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void refetch(); }, 500);
    };
    // HAI channel riêng, không gộp binding: một channel chỉ join được khi MỌI
    // binding hợp lệ. DB chưa chạy migration album_dislikes.sql thì binding
    // `dislikes` làm hỏng cả channel — mất luôn cập nhật trực tiếp của
    // selections (tính năng đã có từ trước). Tách ra thì phần nào lỗi phần đó.
    const channel = supabase
      .channel(`selections-${album.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "selections", filter: `album_id=eq.${album.id}` },
        schedule
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const disChannel = supabase
      .channel(`dislikes-${album.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dislikes", filter: `album_id=eq.${album.id}` },
        schedule
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
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


  return {
    fileIdByPhoto, rows, disRows, copied, live, groups,
    picked, setPicked, confirming, setConfirming, permanent, setPermanent, deleting, delMsg, delFailed, driveConn,
    dislikeItems, pickedItems, togglePick, copyDislikeList, exportDislikeList, deleteDisliked,
    saveNote, copyList, exportList,
  };
}
