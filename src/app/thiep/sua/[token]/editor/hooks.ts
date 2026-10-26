"use client";

import { useEffect, useRef, useState } from "react";
import { isShortMapLink, looksLikeUrl, parseMapInput, pickMapLink } from "@/lib/site-map";
import type { WeddingTimelineItem } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của các ô nhập trong trình sửa thiệp — bản cũ (./ui.tsx) và
   bản giao diện mới (./ui-v2.tsx) cùng gọi các hook dưới đây, chỉ khác phần vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Mốc gợi ý cho người chưa biết điền gì — chỉ đổ vào khi danh sách đang trống. */
export const TIMELINE_PRESET: WeddingTimelineItem[] = [
  { time: "17:30", label: "Đón khách" },
  { time: "18:00", label: "Cử hành hôn lễ" },
  { time: "18:30", label: "Khai tiệc" },
  { time: "20:00", label: "Giao lưu & chụp ảnh" },
];

export type UploadImage = (f: File) => Promise<string | null>;
export type UploadAudio = (f: File) => Promise<{ url?: string; error?: string }>;
export type ResolveMap = (url: string) => Promise<{ url?: string; error?: string }>;

/** Một ảnh: bấm nút → chọn file → tải lên → báo URL mới. */
export function useImagePick(onUpload: UploadImage, onChange: (url: string | null) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); const url = await onUpload(f); setBusy(false);
    if (url) onChange(url);
    if (ref.current) ref.current.value = "";
  };
  return { ref, busy, pick: () => ref.current?.click(), onInput };
}

/** Album ảnh: thêm nhiều ảnh một lượt, đổi chỗ, xoá. */
export function useGalleryPick(gallery: string[], onUpload: UploadImage, onChange: (g: string[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= gallery.length) return;
    const next = [...gallery];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(gallery.filter((_, j) => j !== i));
  const onInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setBusy(true);
    const urls: string[] = [];
    for (const f of files) { const url = await onUpload(f); if (url) urls.push(url); }
    setBusy(false);
    if (urls.length) onChange([...gallery, ...urls]);
    if (ref.current) ref.current.value = "";
  };
  return { ref, busy, pick: () => ref.current?.click(), onInput, move, remove };
}

/** Tải file nhạc: báo lỗi NGAY tại chỗ (không phải cuộn lên đầu trang). */
export function useAudioPick(onUpload: UploadAudio, onChange: (url: string | null) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const onInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLocalErr(null); setBusy(true);
    const r = await onUpload(f); setBusy(false);
    if (r.url) onChange(r.url); else setLocalErr(r.error || "Tải nhạc thất bại.");
    if (ref.current) ref.current.value = "";
  };
  const clear = () => { setLocalErr(null); onChange(null); };
  return { ref, busy, localErr, pick: () => ref.current?.click(), onInput, clear };
}

export type MapNote =
  | { kind: "busy" }
  | { kind: "error"; text: string }
  | { kind: "short"; link: string }
  | { kind: "pinned" }
  | { kind: "text" }
  | null;

/**
 * Ô dán link Google Maps. Rời ô thì bóc đúng đường link khỏi chữ dán kèm (nút
 * Chia sẻ của app gửi cả tên quán + địa chỉ), còn link rút gọn maps.app.goo.gl
 * thì nhờ server mở ra link đầy đủ — có toạ độ thì thiệp mới ghim đúng chỗ.
 */
export function useMapLink(value: string, onChange: (v: string) => void, resolve: ResolveMap) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Kết quả về SAU vài lần render → phải gọi bản onChange mới nhất: bản cũ còn
  // giữ danh sách sự kiện cũ, ghi vào là mất chỗ vừa sửa ở ô khác.
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; });

  async function lookup(link: string) {
    setBusy(true); setErr(null);
    const r = await resolve(link);
    setBusy(false);
    if (pickMapLink(latest.current.value) !== link) return; // đã dán link khác trong lúc chờ
    if (r.url) latest.current.onChange(r.url);
    else setErr(r.error || "Không lấy được vị trí từ link này.");
  }

  function onBlur() {
    const link = pickMapLink(value);
    if (link !== value) onChange(link);
    if (isShortMapLink(link)) void lookup(link);
  }

  const onInput = (v: string) => { setErr(null); onChange(v); };

  const v = value.trim();
  const target = v ? parseMapInput(v) : null;
  let note: MapNote = null;
  if (busy) note = { kind: "busy" };
  else if (err) note = { kind: "error", text: err };
  else if (v && isShortMapLink(v)) note = { kind: "short", link: pickMapLink(v) };
  else if (target?.kind === "coords" || target?.kind === "embed") note = { kind: "pinned" };
  else if (target?.kind === "query" && !looksLikeUrl(pickMapLink(v))) note = { kind: "text" };

  return { note, onBlur, onInput, lookup };
}

/**
 * Key ỔN ĐỊNH client-only cho từng dòng của một danh sách (không lưu vào
 * config). Dùng index làm key thì xoá dòng GIỮA khiến React gán lại các ô nhập
 * theo vị trí — mất focus, chữ đang gõ nhảy sang dòng khác. Mảng key song song
 * chỉ đổi khi thêm/xoá, giữ nguyên khi sửa nội dung.
 */
export function useStableKeys(length: number, prefix: string) {
  const keyId = useRef(0);
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length }, (_, i) => `${prefix}-${i}`));
  // Số dòng lệch số key (nạp bất đồng bộ từ ngoài) → dựng lại, giữ phần đầu.
  // CHỈ phụ thuộc độ dài: sửa nội dung không đổi số key, không cần dựng lại.
  useEffect(() => {
    if (keyId.current < length) keyId.current = Math.max(keyId.current, length);
    setKeys((prev) => (prev.length === length ? prev : Array.from({ length }, (_, i) => prev[i] ?? `${prefix}-${keyId.current++}`)));
  }, [length, prefix]);
  const add = () => setKeys((k) => [...k, `${prefix}-${keyId.current++}`]);
  const remove = (i: number) => setKeys((k) => k.filter((_, j) => j !== i));
  return { keys, add, remove };
}

/** Ô nhập mật khẩu để mở khoá (so với mật khẩu đã biết, ngay trên máy). */
export function useUnlock(expected: string, onUnlock: () => void) {
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = () => (entry.trim() === expected ? onUnlock() : setWrong(true));
  const change = (v: string) => { setEntry(v); setWrong(false); };
  return { entry, change, wrong, submit };
}

/**
 * Mật khẩu "trang xem riêng". Nếu đã có mật khẩu từ trước → KHOÁ: muốn sửa/xoá
 * phải nhập ĐÚNG mật khẩu hiện tại (mở khoá một lần cho phiên chỉnh sửa này).
 */
export function usePasswordField(value?: string) {
  const [initial] = useState((value ?? "").trim());
  const [locked, setLocked] = useState(!!(value ?? "").trim());
  const gate = useUnlock(initial, () => setLocked(false));
  return { locked, ...gate };
}

export type AlbumPhoto = { id: string; name: string; url: string; thumb: string };

/** Ảnh trong album cưới của cặp đôi (gắn với hợp đồng) để thêm vào thiệp. */
export function useAlbumPhotos(token: string, existing: string[]) {
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/thiep/${token}/album-photos`);
      const data = res.ok ? ((await res.json()) as { photos: AlbumPhoto[] }) : { photos: [] };
      setPhotos(data.photos);
    })().catch(() => setPhotos([]));
  }, [token]);

  const have = new Set(existing);
  function toggle(url: string) {
    setSel((s) => { const n = new Set(s); if (n.has(url)) n.delete(url); else n.add(url); return n; });
  }
  return { photos, sel, have, toggle };
}
