"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart, Save, Eye, EyeOff, Check, Loader2, ExternalLink, Gift, Users, CalendarDays, Type,
  Music, LayoutTemplate, FolderOpen, Lock, Image as ImageIcon, MessageCircleHeart, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkImageFile, compressToLimit } from "@/lib/image";
import { thiepUrl } from "@/lib/hosts";
import type { WeddingConfig, WeddingInvitation, WeddingRsvp } from "@/lib/types";
import type { Wish } from "../../[slug]/WeddingRenderer";
import { getTemplateMeta } from "../../[slug]/templates";
import GuestManager from "./GuestManager";
import PreviewPane from "./editor/PreviewPane";
import TemplateGallery from "./editor/TemplateGallery";
import {
  AlbumPicker, AudioUpload, BankEditor, Card, EventsEditor, Field, GalleryEditor, GuestsPasswordField,
  ImageUpload, ResponsesLock, Toggle, inp,
} from "./editor/ui";

type Loaded = {
  invitation: { id: string; slug: string; template: string; config: WeddingConfig; published: boolean };
  rsvps: WeddingRsvp[];
};

const TABS = [
  { id: "mau", label: "Mẫu thiệp", icon: LayoutTemplate },
  { id: "capdoi", label: "Cặp đôi", icon: Heart },
  { id: "ngay", label: "Ngày & địa điểm", icon: CalendarDays },
  { id: "anh", label: "Ảnh", icon: ImageIcon },
  { id: "noidung", label: "Nội dung", icon: Type },
  { id: "khach", label: "Khách mời", icon: Users },
  { id: "qua", label: "Quà & nhạc", icon: Gift },
  { id: "phanhoi", label: "Phản hồi", icon: MessageCircleHeart },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WeddingEditor({ token }: { token: string }) {
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
  const [tab, setTab] = useState<TabId>("mau");
  const [previewOpen, setPreviewOpen] = useState(false);   // chỉ dùng trên màn hình hẹp
  const [previewGuest, setPreviewGuest] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/thiep/${token}`);
      if (!res.ok) { setStatus("notfound"); return; }
      const data = (await res.json()) as Loaded;
      setCfg(data.invitation.config || {});
      setSlug(data.invitation.slug);
      setTemplate(data.invitation.template || "classic");
      setPublished(data.invitation.published);
      setRsvps(data.rsvps || []);
      setStatus("ready");
    })().catch(() => setStatus("notfound"));
  }, [token]);

  const patch = useCallback((p: Partial<WeddingConfig>) => {
    setCfg((c) => ({ ...(c ?? {}), ...p }));
    setDirty(true);
  }, []);

  const pickTemplate = useCallback((name: string) => { setTemplate(name); setDirty(true); }, []);

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

  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center text-stone-500"><Loader2 className="animate-spin" /></div>;
  }
  if (status === "notfound" || !cfg) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-stone-600">
        <div><Heart className="mx-auto mb-3 text-stone-400" /><p>Không tìm thấy thiệp cưới này. Link có thể đã hết hạn.</p></div>
      </div>
    );
  }

  const publicUrl = thiepUrl(`/${slug}`);
  const guestsUrl = thiepUrl(`/${slug}/khach`);
  const absBase = publicUrl.startsWith("http") ? publicUrl : (typeof window !== "undefined" ? window.location.origin + publicUrl : publicUrl);
  const attendingCount = rsvps.filter((r) => r.attending).reduce((s, r) => s + (r.num_guests || 0), 0);
  const meta = getTemplateMeta(template);

  // Nhắc những mục còn thiếu để thiệp trông "đủ" — bấm là nhảy sang đúng tab.
  const todo: { label: string; tab: TabId }[] = [
    ...(cfg.groom_name && cfg.bride_name ? [] : [{ label: "Tên cô dâu & chú rể", tab: "capdoi" as TabId }]),
    ...(cfg.wedding_date ? [] : [{ label: "Ngày cưới", tab: "ngay" as TabId }]),
    ...(cfg.cover_url ? [] : [{ label: "Ảnh bìa", tab: "anh" as TabId }]),
    ...((cfg.events ?? []).length ? [] : [{ label: "Ít nhất một sự kiện", tab: "ngay" as TabId }]),
  ];

  const preview = (
    <PreviewPane inv={draft} wishes={previewWishes} guest={previewGuest} storyUrl={cfg.story_url} publicUrl={publicUrl} />
  );

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800">
      {/* ── Thanh trên cùng ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-rose-700">
              <Heart size={17} className="flex-none" />
              <span className="truncate">Thiệp cưới của bạn</span>
              {dirty && <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Chưa lưu</span>}
            </div>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1 truncate text-xs text-stone-400 hover:text-rose-600 sm:flex">
              {publicUrl} <ExternalLink size={11} />
            </a>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              onClick={() => setPreviewOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-sm lg:hidden"
            >
              {previewOpen ? <><EyeOff size={14} /> Sửa</> : <><Eye size={14} /> Xem trước</>}
            </button>
            <button
              onClick={() => save(!published)}
              disabled={saving}
              className={`hidden rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50 sm:inline-flex ${published ? "border border-stone-300 text-stone-600" : "bg-stone-800 text-white"}`}
            >
              {published ? "Ẩn thiệp" : "Xuất bản"}
            </button>
            <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
              {saved ? "Đã lưu" : "Lưu"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
        {/* ── Cột trái: form ────────────────────────────────────────────── */}
        <div className={`flex-1 lg:max-w-[58%] ${previewOpen ? "hidden lg:block" : ""}`}>
          {/* Thanh tab cuộn ngang trên điện thoại */}
          <nav className="sticky top-[53px] z-20 -mx-0 flex gap-1 overflow-x-auto border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${on ? "bg-rose-600 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </nav>

          <div className="space-y-4 px-3 py-4 sm:px-4">
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

            {/* Trạng thái xuất bản + việc còn thiếu */}
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {published ? "✅ Thiệp đang hiển thị công khai" : "📝 Thiệp đang ở chế độ nháp"}
                </p>
                <button onClick={() => save(!published)} disabled={saving} className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${published ? "border border-stone-300" : "bg-rose-600 text-white"}`}>
                  {published ? "Ẩn thiệp" : "Xuất bản thiệp"}
                </button>
              </div>
              {todo.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle size={14} className="flex-none" />
                  <span>Còn thiếu:</span>
                  {todo.map((t) => (
                    <button key={t.label} onClick={() => setTab(t.tab)} className="rounded-full bg-white px-2 py-0.5 font-medium underline decoration-amber-300">
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── MẪU THIỆP ───────────────────────────────────────────── */}
            {tab === "mau" && (
              <>
                <Card title="Chọn mẫu thiệp" icon={<LayoutTemplate size={16} />} hint="Bấm một mẫu để xem ngay ở khung bên cạnh. Đổi thoải mái — chỉ khi bấm “Lưu” mới áp dụng cho khách.">
                  <TemplateGallery value={template} onChange={pickTemplate} cover={cfg.cover_url} bride={cfg.bride_name || "Cô dâu"} groom={cfg.groom_name || "Chú rể"} />
                </Card>
                <Card title="Màu & phông chữ" icon={<Type size={16} />} hint={meta.group === "phone" ? "Mẫu thiệp điện thoại dùng bộ phông riêng của mẫu; màu nhấn vẫn áp dụng được." : undefined}>
                  <div className="flex flex-wrap items-end gap-5">
                    <Field label="Màu nhấn">
                      <div className="flex items-center gap-2">
                        <input type="color" aria-label="Màu nhấn" className="h-9 w-16 rounded border border-stone-300" value={cfg.accent || meta.accent} onChange={(e) => patch({ accent: e.target.value })} />
                        {cfg.accent && <button type="button" onClick={() => patch({ accent: undefined })} className="text-xs text-stone-500 underline">Dùng màu gốc của mẫu</button>}
                      </div>
                    </Field>
                    {meta.group === "long" && (
                      <Field label="Phông chữ">
                        <select className={inp} value={cfg.font || "serif"} onChange={(e) => patch({ font: e.target.value as "serif" | "sans" })}>
                          <option value="serif">Cổ điển (serif)</option>
                          <option value="sans">Hiện đại (sans)</option>
                        </select>
                      </Field>
                    )}
                  </div>
                </Card>
              </>
            )}

            {/* ── CẶP ĐÔI ─────────────────────────────────────────────── */}
            {tab === "capdoi" && (
              <>
                <Card title="Cô dâu & chú rể" icon={<Heart size={16} />}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tên cô dâu"><input className={inp} value={cfg.bride_name ?? ""} onChange={(e) => patch({ bride_name: e.target.value })} placeholder="Phương Nhi" /></Field>
                    <Field label="Tên chú rể"><input className={inp} value={cfg.groom_name ?? ""} onChange={(e) => patch({ groom_name: e.target.value })} placeholder="Anh Tuấn" /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-stone-200 p-3">
                      <p className="text-sm font-medium text-rose-700">Cô dâu</p>
                      <Field label="Vai vế"><input className={inp} value={cfg.bride_role ?? ""} onChange={(e) => patch({ bride_role: e.target.value })} placeholder="Trưởng nữ" /></Field>
                      <Field label="Cha mẹ (không bắt buộc)"><input className={inp} value={cfg.bride_subtitle ?? ""} onChange={(e) => patch({ bride_subtitle: e.target.value })} placeholder="Con Ông … và Bà …" /></Field>
                      <Field label="Ảnh chân dung"><ImageUpload current={cfg.bride_photo} onUpload={uploadImage} onChange={(url) => patch({ bride_photo: url || undefined })} /></Field>
                    </div>
                    <div className="space-y-2 rounded-lg border border-stone-200 p-3">
                      <p className="text-sm font-medium text-rose-700">Chú rể</p>
                      <Field label="Vai vế"><input className={inp} value={cfg.groom_role ?? ""} onChange={(e) => patch({ groom_role: e.target.value })} placeholder="Út nam" /></Field>
                      <Field label="Cha mẹ (không bắt buộc)"><input className={inp} value={cfg.groom_subtitle ?? ""} onChange={(e) => patch({ groom_subtitle: e.target.value })} placeholder="Con Ông … và Bà …" /></Field>
                      <Field label="Ảnh chân dung"><ImageUpload current={cfg.groom_photo} onUpload={uploadImage} onChange={(url) => patch({ groom_photo: url || undefined })} /></Field>
                    </div>
                  </div>
                </Card>

                <Card title="Hai họ" icon={<Users size={16} />} hint="Hiện thành hai cột “Nhà trai · Nhà gái” trên các mẫu thiệp điện thoại. Mỗi người một dòng.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nhà trai">
                      <textarea className={`${inp} min-h-[70px]`} value={cfg.groom_family ?? ""} onChange={(e) => patch({ groom_family: e.target.value })} placeholder={"Ông Vũ Đình Hải\nBà Lê Thị Mai"} />
                    </Field>
                    <Field label="Nhà gái">
                      <textarea className={`${inp} min-h-[70px]`} value={cfg.bride_family ?? ""} onChange={(e) => patch({ bride_family: e.target.value })} placeholder={"Ông Đặng Văn Sơn\nBà Trịnh Thu Hà"} />
                    </Field>
                  </div>
                </Card>
              </>
            )}

            {/* ── NGÀY & ĐỊA ĐIỂM ─────────────────────────────────────── */}
            {tab === "ngay" && (
              <>
                <Card title="Ngày cưới" icon={<CalendarDays size={16} />} hint="Ngày này chạy đồng hồ đếm ngược trên thiệp.">
                  <Field label="Ngày cưới">
                    <input type="date" className={inp} value={(cfg.wedding_date ?? "").slice(0, 10)} onChange={(e) => patch({ wedding_date: e.target.value })} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Ngày âm lịch (không bắt buộc)"><input className={inp} value={cfg.lunar_date ?? ""} onChange={(e) => patch({ lunar_date: e.target.value })} placeholder="Nhằm ngày 12/11 Âm lịch" /></Field>
                    <Field label="Giờ đón khách"><input className={inp} value={cfg.reception_time ?? ""} onChange={(e) => patch({ reception_time: e.target.value })} placeholder="Đón khách từ 17:30" /></Field>
                  </div>
                </Card>

                <Card title="Sự kiện cưới" icon={<CalendarDays size={16} />} hint="Vu quy · Tân hôn · Tiệc cưới… Thiệp hiện theo đúng thứ tự bạn thêm.">
                  <EventsEditor events={cfg.events ?? []} onChange={(events) => patch({ events })} />
                </Card>

                <Card title="Địa điểm chính" icon={<Heart size={16} />} hint="Để trống sẽ tự lấy theo sự kiện cuối cùng có địa chỉ (thường là tiệc cưới).">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tên địa điểm"><input className={inp} value={cfg.venue_name ?? ""} onChange={(e) => patch({ venue_name: e.target.value })} placeholder="Trung tâm tiệc cưới Lavender" /></Field>
                    <Field label="Địa chỉ"><input className={inp} value={cfg.venue_address ?? ""} onChange={(e) => patch({ venue_address: e.target.value })} placeholder="88 Nguyễn Huệ, Q.1, TP.HCM" /></Field>
                  </div>
                  <Field label="Link Google Maps (nút “Chỉ đường”)" hint="Có link hoặc địa chỉ là thiệp tự hiện bản đồ.">
                    <input className={inp} value={cfg.map_url ?? ""} onChange={(e) => patch({ map_url: e.target.value })} placeholder="https://maps.google.com/…" />
                  </Field>
                  <Field label="Ảnh chụp bản đồ (tuỳ chọn — thay cho bản đồ nhúng)">
                    <ImageUpload current={cfg.map_image} onUpload={uploadImage} onChange={(url) => patch({ map_image: url || undefined })} />
                  </Field>
                  <Field label="Địa điểm ngắn hiện ở bìa"><input className={inp} value={cfg.location ?? ""} onChange={(e) => patch({ location: e.target.value })} placeholder="Hà Nội, Việt Nam" /></Field>
                </Card>
              </>
            )}

            {/* ── ẢNH ─────────────────────────────────────────────────── */}
            {tab === "anh" && (
              <>
                <Card title="Ảnh bìa" icon={<ImageIcon size={16} />}>
                  <ImageUpload current={cfg.cover_url} onUpload={uploadImage} onChange={(url) => patch({ cover_url: url || undefined })} />
                </Card>
                <Card
                  title="Album ảnh cưới"
                  icon={<ImageIcon size={16} />}
                  hint="Mẫu thiệp điện thoại dùng ảnh theo thứ tự: 1–2 là hai ô ảnh phụ, 3–5 là album cuối thiệp. Thêm từ 6 ảnh để hiện đủ các khối."
                >
                  <button
                    type="button"
                    onClick={() => setAlbumOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                  >
                    <FolderOpen size={15} /> Lấy ảnh từ album cưới của bạn
                  </button>
                  <GalleryEditor gallery={cfg.gallery ?? []} onUpload={uploadImage} onChange={(gallery) => patch({ gallery })} />
                </Card>
                <Card title="Ảnh lời cảm ơn" icon={<ImageIcon size={16} />}>
                  <ImageUpload current={cfg.thanks_photo} onUpload={uploadImage} onChange={(url) => patch({ thanks_photo: url || undefined })} />
                </Card>
              </>
            )}

            {/* ── NỘI DUNG ────────────────────────────────────────────── */}
            {tab === "noidung" && (
              <>
                <Card title="Lời mở đầu" icon={<Type size={16} />}>
                  <Field label="Câu trích dẫn ở bìa">
                    <input className={inp} value={cfg.cover_quote ?? ""} onChange={(e) => patch({ cover_quote: e.target.value })} placeholder="Yêu nhau từ cái nhìn đầu tiên…" />
                  </Field>
                </Card>
                <Card title="Chuyện tình yêu" icon={<Heart size={16} />}>
                  <textarea className={`${inp} min-h-[120px]`} value={cfg.story ?? ""} onChange={(e) => patch({ story: e.target.value })} placeholder="Kể câu chuyện của hai bạn…" />
                </Card>
                <Card title="Dặn dò khách mời" icon={<Users size={16} />} hint="Bốn ô này hiện thành lưới nhỏ trên thiệp; bỏ trống ô nào thì ô đó ẩn đi.">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-stone-500">Màu trang phục (Dress code)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {(cfg.dress_code ?? []).map((col, i) => (
                        <span key={i} className="relative">
                          <input type="color" aria-label={`Màu ${i + 1}`} value={col} onChange={(e) => { const d = [...(cfg.dress_code ?? [])]; d[i] = e.target.value; patch({ dress_code: d }); }} className="h-9 w-9 rounded-full border border-stone-300" />
                          <button type="button" aria-label="Bỏ màu" onClick={() => patch({ dress_code: (cfg.dress_code ?? []).filter((_, k) => k !== i) })} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">×</button>
                        </span>
                      ))}
                      <button type="button" onClick={() => patch({ dress_code: [...(cfg.dress_code ?? []), "#c98a86"] })} className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs">+ Thêm màu</button>
                    </div>
                  </div>
                  <Field label="Ghi chú dress code"><input className={inp} value={cfg.dress_code_note ?? ""} onChange={(e) => patch({ dress_code_note: e.target.value })} placeholder="Kem · hồng sen" /></Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Hashtag"><input className={inp} value={cfg.hashtag ?? ""} onChange={(e) => patch({ hashtag: e.target.value })} placeholder="#NhiVeNhaTuan" /></Field>
                    <Field label="Gửi xe"><input className={inp} value={cfg.parking_note ?? ""} onChange={(e) => patch({ parking_note: e.target.value })} placeholder="Hầm B2, miễn phí" /></Field>
                  </div>
                  <Field label="Hotline lễ tân"><input className={inp} value={cfg.hotline ?? ""} onChange={(e) => patch({ hotline: e.target.value })} placeholder="0903 221 118 (chị Hạnh)" /></Field>
                </Card>
                <Card title="Lời kết" icon={<Type size={16} />}>
                  <Field label="Câu kết cuối thiệp"><input className={inp} value={cfg.closing_line ?? ""} onChange={(e) => patch({ closing_line: e.target.value })} placeholder="Hân hạnh được đón tiếp" /></Field>
                  <Field label="Lời cảm ơn"><textarea className={`${inp} min-h-[70px]`} value={cfg.thanks_note ?? ""} onChange={(e) => patch({ thanks_note: e.target.value })} placeholder="Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại 💛" /></Field>
                </Card>
              </>
            )}

            {/* ── KHÁCH MỜI ───────────────────────────────────────────── */}
            {tab === "khach" && (
              <>
                <Card title="Khách mời (link & QR riêng)" icon={<Users size={16} />} hint="Mỗi khách có một link riêng, mở ra thiệp ghi đúng tên họ bằng chữ viết tay.">
                  <Field label="Lời mời (hiện phía trên tên khách)">
                    <input className={inp} value={cfg.guest_greeting ?? ""} onChange={(e) => patch({ guest_greeting: e.target.value })} placeholder="Trân trọng kính mời" />
                  </Field>
                  <Field label="Xem trước với tên khách">
                    <select className={inp} value={previewGuest} onChange={(e) => setPreviewGuest(e.target.value)}>
                      <option value="">— Không hiện tên khách —</option>
                      {(cfg.guests ?? []).filter(Boolean).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                  <GuestManager baseUrl={absBase} accent={cfg.accent || meta.accent} guests={cfg.guests ?? []} onChange={(guests) => patch({ guests })} />
                  <p className="text-xs text-stone-400">Nhớ bấm <b>“Lưu”</b> sau khi thêm/bớt khách.</p>
                </Card>

                <Card title="Trang xem riêng (danh sách & lời chúc)" icon={<Lock size={16} />} hint="Đặt mật khẩu để mở một trang chỉ đọc gồm danh sách khách phản hồi và toàn bộ lời chúc — chia sẻ cho người thân mà không đưa link chỉnh sửa.">
                  <GuestsPasswordField value={cfg.guests_password} onChange={(v) => patch({ guests_password: v })} guestsUrl={guestsUrl} />
                </Card>
              </>
            )}

            {/* ── QUÀ & NHẠC ──────────────────────────────────────────── */}
            {tab === "qua" && (
              <>
                <Card title="Hộp mừng cưới" icon={<Gift size={16} />}>
                  <Toggle checked={cfg.gift_enabled ?? false} onChange={(v) => patch({ gift_enabled: v })} label="Hiển thị mã QR mừng cưới" />
                  {cfg.gift_enabled && (
                    <div className="mt-3 space-y-4">
                      <Field label="Lời nhắn (không bắt buộc)">
                        <input className={inp} value={cfg.gift_note ?? ""} onChange={(e) => patch({ gift_note: e.target.value })} placeholder="Sự hiện diện của bạn là món quà quý giá nhất…" />
                      </Field>
                      <BankEditor title="Tài khoản chú rể" bank={cfg.groom_bank} onChange={(b) => patch({ groom_bank: b })} />
                      <BankEditor title="Tài khoản cô dâu" bank={cfg.bride_bank} onChange={(b) => patch({ bride_bank: b })} />
                    </div>
                  )}
                </Card>
                <Card title="Nhạc nền" icon={<Music size={16} />}>
                  <Field label="Link nhạc (mp3) hoặc tải file nhạc lên">
                    <input className={inp} value={cfg.music_url ?? ""} onChange={(e) => patch({ music_url: e.target.value || undefined })} placeholder="https://…/nhac.mp3" />
                  </Field>
                  <AudioUpload onUpload={uploadAudio} onChange={(url) => patch({ music_url: url || undefined })} currentUrl={cfg.music_url} />
                  {cfg.music_url && <Toggle checked={cfg.music_autoplay ?? false} onChange={(v) => patch({ music_autoplay: v })} label="Thử tự phát khi khách mở thiệp (trình duyệt có thể chặn)" />}
                </Card>
              </>
            )}

            {/* ── PHẢN HỒI ────────────────────────────────────────────── */}
            {tab === "phanhoi" && (
              <>
                <Card title="Xác nhận tham dự (RSVP)" icon={<Users size={16} />}>
                  <Toggle checked={cfg.rsvp_enabled !== false} onChange={(v) => patch({ rsvp_enabled: v })} label="Cho phép khách xác nhận & gửi lời chúc" />
                  <Field label="Lời nhắn RSVP (không bắt buộc)">
                    <input className={inp} value={cfg.rsvp_note ?? ""} onChange={(e) => patch({ rsvp_note: e.target.value })} placeholder="Vui lòng phản hồi trước ngày…" />
                  </Field>
                  <Toggle checked={cfg.guestbook_enabled !== false} onChange={(v) => patch({ guestbook_enabled: v })} label="Hiện Sổ lưu bút (lời chúc của khách) trên thiệp" />
                  <p className="text-xs text-stone-400">Tắt để ẩn danh sách lời chúc khỏi thiệp; khách vẫn gửi được. Khi đã đặt mật khẩu “Trang xem riêng”, Sổ lưu bút cũng tự ẩn khỏi thiệp công khai.</p>
                </Card>

                <Card title="Love Story" icon={<Heart size={16} />}>
                  <Field label="Link Love Story (để trống sẽ tự lấy theo hợp đồng nếu có)">
                    <input className={inp} value={cfg.story_url ?? ""} onChange={(e) => patch({ story_url: e.target.value })} placeholder="https://…/story/… hoặc /story/ten-cua-ban" />
                  </Field>
                  <p className="text-xs text-stone-400">Nút “Xem Love Story” hiện ở cuối thiệp khi có link.</p>
                </Card>

                <Card title={`Phản hồi của khách (${rsvps.length})`} icon={<MessageCircleHeart size={16} />}>
                  {(cfg.guests_password ?? "").trim() && !responsesUnlocked ? (
                    <ResponsesLock expected={(cfg.guests_password ?? "").trim()} onUnlock={() => setResponsesUnlocked(true)} />
                  ) : (
                    <div className="rounded-lg bg-stone-100 p-3 text-sm">
                      <p className="mb-2 font-medium">{rsvps.length} phản hồi · {attendingCount} khách sẽ tham dự</p>
                      <div className="max-h-72 space-y-2 overflow-auto">
                        {rsvps.map((r) => (
                          <div key={r.id} className="rounded-md bg-white p-2 text-sm">
                            <span className="font-medium">{r.guest_name}</span>{" "}
                            <span className={r.attending ? "text-green-600" : "text-stone-400"}>
                              {r.attending ? `· tham dự (${r.num_guests})` : "· không dự"}
                            </span>
                            {r.wish && <p className="mt-0.5 text-stone-600">“{r.wish}”</p>}
                          </div>
                        ))}
                        {rsvps.length === 0 && <p className="text-stone-400">Chưa có phản hồi nào.</p>}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Cột phải: xem trước trực tiếp ───────────────────────────────
            Một khung xem trước duy nhất: màn rộng thì dính bên phải, màn hẹp
            thì nút "Xem trước" trải nó ra cả trang (không dựng khung thứ hai
            để khỏi chạy hai iframe cùng lúc). */}
        <aside
          className={`border-stone-200 bg-white lg:sticky lg:inset-auto lg:z-auto lg:block lg:h-[calc(100vh-53px)] lg:w-[42%] lg:border-l ${
            previewOpen ? "fixed inset-x-0 bottom-0 top-[53px] z-20 block" : "hidden"
          }`}
        >
          {preview}
        </aside>
      </div>

      {albumOpen && (
        <AlbumPicker
          token={token}
          existing={cfg.gallery ?? []}
          onClose={() => setAlbumOpen(false)}
          onAdd={(urls) => { patch({ gallery: [...(cfg.gallery ?? []), ...urls] }); setAlbumOpen(false); }}
        />
      )}
    </div>
  );
}
