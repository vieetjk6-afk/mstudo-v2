"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkImageFile, compressToLimit } from "@/lib/image";
import { thiepUrl } from "@/lib/hosts";
import { lunarText } from "@/lib/lunar";
import type { WeddingConfig, WeddingInvitation, WeddingRsvp } from "@/lib/types";
import type { Wish } from "../../[slug]/WeddingRenderer";
import { TEMPLATE_ALIASES, getTemplateMeta } from "../../[slug]/templates";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC của trình sửa thiệp cưới (/thiep/sua/<token>) — dùng chung cho bản cũ
   (WeddingEditorV1 trong ./WeddingEditor.tsx) và bản giao diện mới
   (./WeddingEditorV2.tsx): tải thiệp + phản hồi, sửa nháp trong bộ nhớ, lưu /
   xuất bản, tải ảnh, tải nhạc, mở link bản đồ rút gọn, nhắc trước khi rời trang.
   ═══════════════════════════════════════════════════════════════════════════ */

type Loaded = {
  invitation: { id: string; slug: string; template: string; config: WeddingConfig; published: boolean };
  rsvps: WeddingRsvp[];
  /** Chế độ Quà cưới: danh sách khách nằm ở kế hoạch cưới — link tới đó. */
  planner_href?: string | null;
};

/**
 * Trình sửa thiệp NHÚNG trong kế hoạch cưới (chế độ Quà cưới). Danh sách khách
 * là của kế hoạch: tab Khách mời ở đây chỉ còn lời mời, xem trước theo tên, và
 * đường sang danh sách đó.
 */
export type EditorEmbed = {
  /** Về kế hoạch cưới. */
  onBack: () => void;
  /** Sang tab Khách mời của kế hoạch. */
  onOpenGuests: () => void;
  /** Tên khách trong kế hoạch — để xem trước thiệp ghi tên một khách. */
  guestNames: string[];
  /** Báo còn thay đổi chưa lưu — trang kế hoạch hỏi lại trước khi rời. */
  onDirty?: (dirty: boolean) => void;
};

/** Mục còn thiếu để thiệp trông "đủ" — mỗi bản giao diện tự nối sang tab / khối của mình. */
export type TodoKey = "names" | "date" | "cover" | "portraits" | "gallery" | "events";

export function useWeddingEditor(token: string, embed?: EditorEmbed) {
  const [cfg, setCfg] = useState<WeddingConfig | null>(null);
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState("classic");
  const [published, setPublished] = useState(false);
  const [rsvps, setRsvps] = useState<WeddingRsvp[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [responsesUnlocked, setResponsesUnlocked] = useState(false);
  const [previewGuest, setPreviewGuest] = useState("");
  const [plannerHref, setPlannerHref] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/thiep/${token}`);
      if (!res.ok) { setStatus("notfound"); return; }
      const data = (await res.json()) as Loaded;
      // Mẫu cũ đã gộp (vd. "vom-navy" → "vom"): đổi sang tên mới, giữ đúng màu cũ.
      const alias = TEMPLATE_ALIASES[data.invitation.template];
      const loadedCfg = data.invitation.config || {};
      setCfg(alias && !loadedCfg.accent ? { ...loadedCfg, accent: alias.color } : loadedCfg);
      setSlug(data.invitation.slug);
      setTemplate(alias?.name || data.invitation.template || "classic");
      setPublished(data.invitation.published);
      setRsvps(data.rsvps || []);
      setPlannerHref(data.planner_href ?? null);
      setStatus("ready");
    })().catch(() => setStatus("notfound"));
  }, [token]);

  // Tải lại phản hồi mới nhất (khách vừa xác nhận) mà không mất phần đang sửa.
  const refreshRsvps = useCallback(async () => {
    const res = await fetch(`/api/thiep/${token}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as Loaded;
    setRsvps(data.rsvps || []);
  }, [token]);

  const patch = useCallback((p: Partial<WeddingConfig>) => {
    setCfg((c) => ({ ...(c ?? {}), ...p }));
    setDirty(true);
  }, []);

  const pickTemplate = useCallback((name: string) => { setTemplate(name); setDirty(true); }, []);

  const onDirty = embed?.onDirty;
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);

  // Nhắc trước khi rời trang khi còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(nextPublished?: boolean) {
    if (!cfg) return;
    setSaving(true);
    setErr(null);
    const willPublish = nextPublished ?? published;
    try {
      const res = await fetch(`/api/thiep/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg, published: willPublish, template }),
      });
      if (!res.ok) { setErr("Lưu không thành công, thử lại nhé."); return; }
      setPublished(willPublish);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Mạng lỗi: báo lỗi thay vì kẹt nút Lưu/Xuất bản ở trạng thái disabled.
      setErr("Lưu không thành công, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const check = checkImageFile(file);
    if (!check.ok) { setErr(check.error); return null; }
    let blob: Blob = file;
    try {
      // Nén ảnh xuống ≤ 1MB trước khi tải lên.
      const dataUrl = await compressToLimit(file, 1024 * 1024);
      const b = await (await fetch(dataUrl)).blob();
      if (b.size > 0) blob = b;
    } catch { /* fall back to original */ }
    const fd = new FormData();
    fd.append("file", new File([blob], "photo.webp", { type: blob.type || "image/webp" }));
    const res = await fetch(`/api/thiep/${token}/upload`, { method: "POST", body: fd });
    if (!res.ok) { setErr("Tải ảnh thất bại."); return null; }
    return ((await res.json()) as { url: string }).url;
  }

  // Link Google Maps rút gọn (maps.app.goo.gl) → server mở ra link đầy đủ có toạ độ.
  async function resolveMap(url: string): Promise<{ url?: string; error?: string }> {
    try {
      const r = await fetch(`/api/thiep/${token}/map`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }),
      });
      const j = (await r.json().catch(() => null)) as { url?: string; error?: string } | null;
      return r.ok && j?.url ? { url: j.url } : { error: j?.error || "Không lấy được vị trí từ link này." };
    } catch {
      return { error: "Mất kết nối, thử lại nhé." };
    }
  }

  // Tải nhạc THẲNG lên Supabase Storage qua URL ký sẵn (không qua serverless →
  // không vướng trần body ~4.5MB của Vercel, vốn là lý do file nhạc lớn báo lỗi).
  async function uploadAudio(file: File): Promise<{ url?: string; error?: string }> {
    if (file.size > 10 * 1024 * 1024) return { error: "File nhạc quá lớn (tối đa 10MB)." };
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    let signed: { path: string; token: string; publicUrl: string };
    try {
      const r = await fetch(`/api/thiep/${token}/audio-upload-url`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ext }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        if (j?.error === "not_found") return { error: "Phiên chỉnh sửa đã hết hạn, tải lại trang giúp mình nhé." };
        return { error: "Không tạo được phiên tải nhạc" + (j?.error ? ` (${j.error})` : ".") };
      }
      signed = await r.json();
    } catch {
      return { error: "Mất kết nối khi tải nhạc, thử lại nhé." };
    }
    const AUDIO_MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", weba: "audio/webm" };
    const contentType = file.type || AUDIO_MIME[ext] || "audio/mpeg";
    try {
      const supabase = createClient();
      const { error } = await supabase.storage.from("wedding-photos").uploadToSignedUrl(signed.path, signed.token, file, { contentType });
      if (error) return { error: "Tải nhạc thất bại (" + error.message + ")" };
    } catch (e) {
      return { error: "Tải nhạc thất bại (" + ((e as Error)?.message || e) + ")" };
    }
    // Nhờ server chuyển file sang Drive admin rồi xoá bản trên Supabase. Hỏng
    // thì thôi — URL Supabase ở trên vẫn dùng tốt.
    try {
      const r = await fetch(`/api/thiep/${token}/audio-finalize`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: signed.path }),
      });
      if (r.ok) {
        const j = (await r.json()) as { url?: string | null };
        if (j.url) return { url: j.url };
      }
    } catch { /* giữ URL Supabase */ }
    return { url: signed.publicUrl };
  }

  // Thiệp "nháp trong bộ nhớ" để khung xem trước dựng lại đúng thứ đang sửa.
  const draft = useMemo(() => ({
    id: "preview", owner_id: "", contract_id: null, slug: slug || "xem-truoc", edit_token: token,
    template, config: cfg ?? {}, published, created_at: "", updated_at: "",
  }) as WeddingInvitation, [slug, token, template, cfg, published]);

  const previewWishes: Wish[] = useMemo(
    () => rsvps.filter((r) => r.wish && r.guest_name).slice(0, 12).map((r) => ({ guest_name: r.guest_name, wish: r.wish as string, created_at: r.created_at })),
    [rsvps],
  );

  // Rời trình sửa (chỉ khi nhúng trong kế hoạch cưới): hỏi lại nếu chưa lưu.
  const back = () => {
    if (dirty && !window.confirm("Thiệp còn thay đổi chưa lưu. Rời đi và bỏ các thay đổi đó?")) return;
    embed?.onBack();
  };

  return {
    cfg, slug, template, published, rsvps, status, saving, saved, dirty, err, setErr,
    albumOpen, setAlbumOpen, responsesUnlocked, setResponsesUnlocked, previewGuest, setPreviewGuest, plannerHref,
    refreshRsvps, patch, pickTemplate, save, uploadImage, resolveMap, uploadAudio, draft, previewWishes, back,
  };
}

export type WeddingEditorState = ReturnType<typeof useWeddingEditor>;

/**
 * Các giá trị suy ra khi thiệp đã tải xong (link công khai, việc còn thiếu,
 * đang khoá phản hồi…). Hàm thường — gọi SAU khi đã chắc `cfg` có.
 */
export function deriveWedding(w: WeddingEditorState, cfg: WeddingConfig, embed?: EditorEmbed) {
  const publicUrl = thiepUrl(`/${w.slug}`);
  const guestsUrl = thiepUrl(`/${w.slug}/khach`);
  const absBase = publicUrl.startsWith("http") ? publicUrl : (typeof window !== "undefined" ? window.location.origin + publicUrl : publicUrl);
  const autoLunar = lunarText(cfg.wedding_date);
  const attendingCount = w.rsvps.filter((r) => r.attending).reduce((s, r) => s + (r.num_guests || 0), 0);
  // Cặp đôi đặt mật khẩu "trang xem riêng" → phản hồi (cả trạng thái trong danh sách khách) khoá đến khi nhập đúng.
  const responsesLocked = !!(cfg.guests_password ?? "").trim() && !w.responsesUnlocked;
  const meta = getTemplateMeta(w.template);
  // Quà cưới: khách mời là danh sách của kế hoạch cưới, không phải `cfg.guests`.
  const combo = !!embed || !!w.plannerHref;
  const guestNames = embed ? embed.guestNames : (cfg.guests ?? []).filter(Boolean);
  const plannerHref = w.plannerHref;
  /** Sang danh sách khách của kế hoạch cưới (null = khách nằm ngay trong thiệp). */
  const openPlannerGuests: (() => void) | null = embed
    ? embed.onOpenGuests
    : plannerHref ? () => { window.location.href = plannerHref; } : null;

  // Nhắc những mục còn thiếu để thiệp trông "đủ".
  const todo: { key: TodoKey; label: string }[] = [
    ...(cfg.groom_name && cfg.bride_name ? [] : [{ key: "names" as TodoKey, label: "Tên cô dâu & chú rể" }]),
    ...(cfg.wedding_date ? [] : [{ key: "date" as TodoKey, label: "Ngày cưới" }]),
    ...(cfg.cover_url ? [] : [{ key: "cover" as TodoKey, label: "Ảnh bìa" }]),
    // Mọi mẫu điện thoại đều có khối chân dung cô dâu — chú rể; thiếu ảnh thì
    // khối đó chỉ còn chữ lồng, nên nhắc ngay ở danh sách việc cần làm.
    ...(cfg.bride_photo && cfg.groom_photo ? [] : [{ key: "portraits" as TodoKey, label: "Ảnh chân dung cô dâu & chú rể" }]),
    ...((cfg.gallery ?? []).length ? [] : [{ key: "gallery" as TodoKey, label: "Album ảnh cưới" }]),
    ...((cfg.events ?? []).length ? [] : [{ key: "events" as TodoKey, label: "Ít nhất một sự kiện" }]),
  ];

  return { publicUrl, guestsUrl, absBase, autoLunar, attendingCount, responsesLocked, meta, combo, guestNames, openPlannerGuests, todo };
}
