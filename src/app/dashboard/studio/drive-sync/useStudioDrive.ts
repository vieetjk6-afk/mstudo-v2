"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC màn Đồng bộ Google Drive — dùng chung cho bản cũ (StudioDriveCard) và
   bản giao diện mới (StudioDriveV2): tình trạng kết nối, số máy chạy MStudo
   Desktop, mẫu thư mục, tạo thư mục cho hợp đồng còn thiếu, ngắt kết nối.
   Cùng các route /api/studio/drive/*, /api/desktop/devices,
   /api/studio/contract-drive. Hai bản chỉ khác ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type DriveRole = "selection" | "delivery" | null;
export type DriveNode = { name: string; role?: DriveRole; excluded?: boolean };
export type DriveTemplate = { photo: DriveNode[]; video: DriveNode[] };
export type DriveStatus = { configured: boolean; connected: boolean; rootFolderName: string; rootCreated: boolean; template: DriveTemplate };

export const ROLE_LABEL: Record<string, string> = { selection: "Album chọn ảnh", delivery: "Gallery giao khách", none: "Chỉ sao lưu" };

export function useStudioDrive() {
  const [foldersBusy, setFoldersBusy] = useState(false);
  const [foldersMsg, setFoldersMsg] = useState<string | null>(null);

  /** Tạo cây thư mục cho mọi hợp đồng đã chốt còn thiếu. */
  async function makeAllFolders() {
    setFoldersBusy(true);
    setFoldersMsg(null);
    try {
      const r = await fetch("/api/studio/contract-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean; error?: string; created?: number; failed?: number; done?: boolean; firstError?: string | null; pending?: number;
      };
      if (!r.ok || !j.ok) {
        setFoldersMsg(j.error ?? "Không tạo được thư mục.");
        return;
      }
      setFoldersMsg(
        j.pending === 0
          ? "Mọi hợp đồng đã chốt đều có thư mục rồi."
          : `Đã tạo ${j.created ?? 0} thư mục` +
              (j.failed ? ` · ${j.failed} hợp đồng lỗi (${j.firstError ?? ""})` : "") +
              (j.done === false ? " · còn dở, bấm lại để chạy tiếp" : "."),
      );
    } catch (e) {
      setFoldersMsg(`Không tạo được: ${(e as Error)?.message || e}`);
    } finally {
      setFoldersBusy(false);
    }
  }

  const [state, setState] = useState<DriveStatus | null>(null);
  const [tpl, setTpl] = useState<DriveTemplate | null>(null);
  const [rootName, setRootName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [flash, setFlash] = useState("");
  // Số máy đang chạy MStudo Desktop (null = chưa biết / API không trả) — để bước
  // 3 của hướng dẫn tự đánh dấu xong khi studio đã cài và kết nối app.
  const [devices, setDevices] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/studio/drive/status")
      .then((r) => r.json())
      .then((d: DriveStatus) => {
        setState(d);
        setTpl(d.template);
        setRootName(d.rootFolderName || "MStudo");
      })
      .catch(() => setState({ configured: false, connected: false, rootFolderName: "MStudo", rootCreated: false, template: { photo: [], video: [] } }));
    fetch("/api/desktop/devices")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { devices?: { revoked_at: string | null }[] } | null) => {
        if (j?.devices) setDevices(j.devices.filter((d) => !d.revoked_at).length);
      })
      .catch(() => {});
    // Thông báo sau khi quay lại từ Google.
    const q = new URLSearchParams(window.location.search).get("drive");
    if (q === "connected") setFlash("Đã kết nối Google Drive!");
    else if (q === "forbidden") setFlash("Chỉ CHỦ studio (gói Studio) mới kết nối được Drive đồng bộ hợp đồng.");
    else if (q === "notconfigured") setFlash("Máy chủ chưa bật kết nối Google Drive. Hãy liên hệ quản trị.");
    else if (q === "error") setFlash("Kết nối Drive không thành công — thử lại.");
  }, []);

  async function disconnect() {
    if (!confirm("Ngắt kết nối Drive? Ảnh/video đã tải lên vẫn còn trên Drive; hợp đồng mới sẽ ngừng tự đồng bộ.")) return;
    setBusy(true);
    await fetch("/api/studio/drive/status", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setState((s) => (s ? { ...s, connected: false } : s));
  }

  async function saveTemplate() {
    if (!tpl) return;
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch("/api/studio/drive/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: tpl, rootFolderName: rootName }),
      });
      const d: DriveStatus = await r.json();
      setState(d);
      setTpl(d.template);
      setRootName(d.rootFolderName || "MStudo");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      /* */
    }
    setBusy(false);
  }

  function editNode(group: "photo" | "video", i: number, patch: Partial<DriveNode>) {
    setTpl((t) => {
      if (!t) return t;
      const arr = [...t[group]];
      arr[i] = { ...arr[i], ...patch };
      return { ...t, [group]: arr };
    });
  }
  function addNode(group: "photo" | "video") {
    setTpl((t) => (t ? { ...t, [group]: [...t[group], { name: "", role: null, excluded: false }] } : t));
  }
  function removeNode(group: "photo" | "video", i: number) {
    setTpl((t) => (t ? { ...t, [group]: t[group].filter((_, k) => k !== i) } : t));
  }

  /** Mẫu thư mục / thư mục gốc đã sửa mà chưa lưu (so với bản máy chủ trả về). */
  const dirty =
    !!state && !!tpl && (JSON.stringify(tpl) !== JSON.stringify(state.template) || rootName !== (state.rootFolderName || "MStudo"));
  /** Bỏ các thay đổi chưa lưu, về đúng bản máy chủ đang giữ. */
  function resetTemplate() {
    if (!state) return;
    setTpl(state.template);
    setRootName(state.rootFolderName || "MStudo");
  }

  return {
    foldersBusy, foldersMsg, makeAllFolders,
    state, tpl, rootName, setRootName, busy, saved, flash, devices,
    disconnect, saveTemplate, editNode, addNode, removeNode, dirty, resetTemplate,
  };
}
