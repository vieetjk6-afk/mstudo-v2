"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryConfig, StoryTimelineItem } from "@/lib/types";
import { escapeHtml } from "@/lib/html-escape";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC trình sửa Love Story (/story/sua/<token>) — dùng chung cho bản cũ
   (StoryEditorV1 trong ./StoryEditor.tsx) và bản giao diện mới
   (./StoryEditorV2.tsx): tải trang, sửa nháp, lưu / xuất bản, xem trước ảnh
   từ Drive, nối / ngắt Google Drive, gỡ ảnh khách gửi, mã QR (tải / in).
   ═══════════════════════════════════════════════════════════════════════════ */

export type StoryUpload = { id: string; drive_file_id: string; guest_name: string; is_video: boolean; approved: boolean; created_at: string };
type Loaded = { story: { id: string; slug: string; config: StoryConfig; published: boolean }; uploads: StoryUpload[]; drive_connected: boolean };
export type StoryDrivePhoto = { id: string; name: string; url: string; thumb: string };

// Love Story is served on whatever host the couple opened the editor from
// (mstudo.com or the studio's own subdomain/custom domain).
export const storyUrl = (path: string) => (typeof window !== "undefined" ? `${window.location.origin}${path}` : path);

export function useStoryEditor(token: string) {
  const [cfg, setCfg] = useState<StoryConfig | null>(null);
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** Có sửa mà chưa lưu (bản giao diện mới hiện trạng thái này; bản cũ không dùng). */
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photos, setPhotos] = useState<StoryDrivePhoto[] | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploads, setUploads] = useState<StoryUpload[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/story/${token}`);
    if (!res.ok) { setStatus("notfound"); return; }
    const d = (await res.json()) as Loaded;
    setCfg(d.story.config || {});
    setSlug(d.story.slug);
    setPublished(d.story.published);
    setUploads(d.uploads || []);
    setDriveConnected(!!d.drive_connected);
    setStatus("ready");
  }, [token]);

  useEffect(() => { reload().catch(() => setStatus("notfound")); }, [reload]);

  // Feedback after returning from the Google OAuth connect flow.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("drive");
    if (q === "connected") setDriveMsg("Đã kết nối Google Drive của bạn 🎉");
    else if (q === "error") setDriveMsg("Kết nối Google Drive chưa thành công, hãy thử lại.");
    if (q) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const patch = useCallback((p: Partial<StoryConfig>) => { setCfg((c) => ({ ...(c ?? {}), ...p })); setDirty(true); }, []);

  // Key ỔN ĐỊNH cho từng mốc timeline — client-only, KHÔNG lưu vào config.
  // Trước đây dùng index làm key: xoá một mốc GIỮA khiến React gán lại ô nhập
  // theo vị trí (mất focus, đang gõ tiếng Việt nhảy sang dòng khác). Mảng key
  // song song này chỉ đổi khi thêm/xoá mốc, giữ nguyên khi sửa nội dung.
  const tlKeyId = useRef(0);
  const [tlKeys, setTlKeys] = useState<string[]>([]);
  const tlSeeded = useRef(false);
  useEffect(() => {
    if (tlSeeded.current || !cfg) return;
    tlSeeded.current = true;
    setTlKeys((cfg.timeline ?? []).map(() => `tl-${tlKeyId.current++}`));
  }, [cfg]);

  async function save(nextPub?: boolean) {
    if (!cfg) return;
    setSaving(true); setErr(null);
    const willPub = nextPub ?? published;
    const res = await fetch(`/api/story/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg, published: willPub }) });
    setSaving(false);
    if (!res.ok) { setErr("Lưu không thành công."); return; }
    setPublished(willPub); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  async function loadPhotos() {
    setLoadingPhotos(true);
    const res = await fetch(`/api/story/${token}/photos`);
    const d = res.ok ? await res.json() : { photos: [] };
    setLoadingPhotos(false);
    setPhotos(d.photos || []);
    if (d.error === "no_api_key") setErr("Máy chủ chưa cấu hình GOOGLE_API_KEY để đọc Drive.");
  }

  async function disconnectDrive() {
    if (!confirm("Ngắt kết nối Google Drive? Khách sẽ không thể gửi ảnh/video nữa (ảnh đã gửi vẫn nằm trên Drive của bạn).")) return;
    await fetch(`/api/story/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect_drive" }) });
    setDriveConnected(false);
  }

  async function deleteUpload(id: string) {
    await fetch(`/api/story/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_upload", uploadId: id }) });
    setUploads((u) => u.filter((x) => x.id !== id));
  }

  async function genQr() {
    setQrBusy(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const img = await QRCode.toDataURL(storyUrl(`/story/${slug}`), { margin: 1, width: 640, color: { dark: "#a9527f", light: "#ffffff" } });
      setQrImg(img);
    } finally { setQrBusy(false); }
  }
  function printQr() {
    if (!qrImg) return;
    // Thoát HTML trước khi ghi vào cửa sổ in: cửa sổ mở bằng window.open("") kế
    // thừa origin của trang này, nên tên tự nhập không được phép thành thẻ HTML.
    const couple = escapeHtml([cfg?.groom_name, cfg?.bride_name].filter(Boolean).join(" & ") || "Love Story");
    const w = window.open("", "_blank", "width=520,height=680"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${couple}</title><style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#a9527f}h1{font-size:26px;margin:0 0 4px}p{color:#8c847d;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}.u{font-size:12px;word-break:break-all}</style></head><body><h1>${couple}</h1><p>Quét mã để xem &amp; gửi ảnh Love Story</p><img alt="Mã QR trang Love Story" src="${escapeHtml(qrImg)}"/><p class="u">${escapeHtml(storyUrl(`/story/${slug}`))}</p><script>window.onload=()=>window.print()</script></body></html>`);
  }

  const timeline = cfg?.timeline ?? [];
  const upTl = (i: number, p: Partial<StoryTimelineItem>) => patch({ timeline: timeline.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  // Thêm/xoá mốc phải cập nhật CẢ mảng key song song để key luôn khớp mốc.
  const addTl = () => { setTlKeys((k) => [...k, `tl-${tlKeyId.current++}`]); patch({ timeline: [...timeline, {}] }); };
  const delTl = (i: number) => { setTlKeys((k) => k.filter((_, j) => j !== i)); patch({ timeline: timeline.filter((_, j) => j !== i) }); };

  return {
    cfg, slug, published, status, saving, saved, dirty, err, photos, loadingPhotos, uploads, driveConnected, driveMsg,
    qrImg, qrBusy, tlKeys, timeline, patch, save, loadPhotos, disconnectDrive, deleteUpload, genQr, printQr, upTl, addTl, delTl,
  };
}
