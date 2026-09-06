"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart, Save, Eye, Plus, Trash2, Image as ImageIcon, Check, Loader2, ExternalLink, Gift, Users,
  Music, LayoutTemplate, FolderOpen, X, Lock,
} from "lucide-react";
import { BANKS } from "@/lib/banks";
import { createClient } from "@/lib/supabase/client";
import { checkImageFile, compressToLimit } from "@/lib/image";
import { thiepUrl } from "@/lib/hosts";
import { WEDDING_TEMPLATE_LIST } from "../../[slug]/templates";
import GuestManager from "./GuestManager";
import type { WeddingBank, WeddingConfig, WeddingEventBlock, WeddingRsvp } from "@/lib/types";

type Loaded = {
  invitation: { id: string; slug: string; template: string; config: WeddingConfig; published: boolean };
  rsvps: WeddingRsvp[];
};

type AlbumPhoto = { id: string; name: string; url: string; thumb: string };

export default function WeddingEditor({ token }: { token: string }) {
  const [cfg, setCfg] = useState<WeddingConfig | null>(null);
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState("classic");
  const [published, setPublished] = useState(false);
  const [rsvps, setRsvps] = useState<WeddingRsvp[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [responsesUnlocked, setResponsesUnlocked] = useState(false); // mở khoá xem danh sách phản hồi trong trang sửa

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

  const patch = useCallback((p: Partial<WeddingConfig>) => setCfg((c) => ({ ...(c ?? {}), ...p })), []);

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
  // Trả về { url } hoặc { error } để hiện NGAY tại mục nhạc.
  async function uploadAudio(file: File): Promise<{ url?: string; error?: string }> {
    if (file.size > 10 * 1024 * 1024) return { error: "File nhạc quá lớn (tối đa 10MB)." };
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    // 1) Xin URL ký sẵn (request nhỏ, không dính trần body).
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
    // 2) Đẩy file thẳng lên Storage bằng token ký sẵn.
    const AUDIO_MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", weba: "audio/webm" };
    const contentType = file.type || AUDIO_MIME[ext] || "audio/mpeg";
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("wedding-photos")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType });
      if (error) return { error: "Tải nhạc thất bại (" + error.message + ")" };
    } catch (e) {
      return { error: "Tải nhạc thất bại (" + ((e as Error)?.message || e) + ")" };
    }
    // 3) Nhờ server chuyển file sang Drive admin rồi xoá bản trên Supabase (đỡ
    //    tốn dung lượng). Hỏng thì thôi — URL Supabase ở trên vẫn dùng tốt.
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
  // URL tuyệt đối để tạo QR (trên single-host thiepUrl trả về đường dẫn tương đối).
  const absBase = publicUrl.startsWith("http") ? publicUrl : (typeof window !== "undefined" ? window.location.origin + publicUrl : publicUrl);
  const attendingCount = rsvps.filter((r) => r.attending).reduce((s, r) => s + (r.num_guests || 0), 0);

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-800">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-rose-700">
            <Heart size={18} /> Thiệp cưới của bạn
          </div>
          <div className="flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">
              <Eye size={14} /> Xem
            </a>
            <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
              {saved ? "Đã lưu" : "Lưu"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {/* Publish banner */}
        <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">{published ? "Thiệp đang hiển thị công khai" : "Thiệp đang ở chế độ nháp"}</p>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-rose-600 underline">
              {publicUrl} <ExternalLink size={12} />
            </a>
          </div>
          <button
            onClick={() => save(!published)}
            disabled={saving}
            className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${published ? "border border-stone-300" : "bg-rose-600 text-white"}`}
          >
            {published ? "Ẩn thiệp" : "Xuất bản thiệp"}
          </button>
        </div>

        {/* Template */}
        <Section title="Mẫu thiệp" icon={<LayoutTemplate size={16} />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEDDING_TEMPLATE_LIST.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setTemplate(t.name)}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${template === t.name ? "border-rose-500 ring-2 ring-rose-100" : "border-stone-300 hover:border-rose-300"}`}
              >
                <span className="block font-medium">{t.label.split(" (")[0]}</span>
                <span className="text-xs text-stone-400">{t.label.includes("(") ? t.label.split("(")[1].replace(")", "") : ""}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400">Chọn mẫu rồi bấm “Lưu” để áp dụng. Màu &amp; phông bên dưới sẽ ghi đè lên mẫu.</p>
        </Section>

        {/* Cover */}
        <Section title="Trang bìa" icon={<ImageIcon size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên chú rể"><input className={inp} value={cfg.groom_name ?? ""} onChange={(e) => patch({ groom_name: e.target.value })} /></Field>
            <Field label="Tên cô dâu"><input className={inp} value={cfg.bride_name ?? ""} onChange={(e) => patch({ bride_name: e.target.value })} /></Field>
          </div>
          <Field label="Ngày cưới">
            <input type="date" className={inp} value={(cfg.wedding_date ?? "").slice(0, 10)} onChange={(e) => patch({ wedding_date: e.target.value })} />
          </Field>
          <Field label="Lời mở đầu (câu trích dẫn)">
            <input className={inp} value={cfg.cover_quote ?? ""} onChange={(e) => patch({ cover_quote: e.target.value })} placeholder="Yêu nhau từ cái nhìn đầu tiên…" />
          </Field>
          <Field label="Ảnh bìa">
            <ImageUpload current={cfg.cover_url} onUpload={uploadImage} onChange={(url) => patch({ cover_url: url || undefined })} />
          </Field>
        </Section>

        {/* Story */}
        <Section title="Chuyện tình yêu" icon={<Heart size={16} />}>
          <textarea className={`${inp} min-h-[120px]`} value={cfg.story ?? ""} onChange={(e) => patch({ story: e.target.value })} placeholder="Kể câu chuyện của hai bạn…" />
        </Section>

        {/* Events */}
        <Section title="Sự kiện cưới" icon={<Heart size={16} />}>
          <EventsEditor events={cfg.events ?? []} onChange={(events) => patch({ events })} />
        </Section>

        {/* Gallery */}
        <Section title="Album ảnh cưới" icon={<ImageIcon size={16} />}>
          <button
            type="button"
            onClick={() => setAlbumOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
          >
            <FolderOpen size={15} /> Lấy ảnh từ album cưới của bạn
          </button>
          <GalleryEditor gallery={cfg.gallery ?? []} onUpload={uploadImage} onChange={(gallery) => patch({ gallery })} />
        </Section>

        {/* Gift */}
        <Section title="Hộp mừng cưới" icon={<Gift size={16} />}>
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
        </Section>

        {/* Hồ sơ & chi tiết (mẫu "Ngọt ngào" dùng đầy đủ; mẫu khác bỏ qua nếu trống) */}
        <Section title="Cô dâu, chú rể & chi tiết" icon={<Heart size={16} />}>
          <Field label="Địa điểm ngắn (hiện ở bìa)"><input className={inp} value={cfg.location ?? ""} onChange={(e) => patch({ location: e.target.value })} placeholder="Hà Nội, Việt Nam" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-stone-200 p-3">
              <p className="text-sm font-medium text-rose-700">Cô dâu</p>
              <Field label="Vai vế"><input className={inp} value={cfg.bride_role ?? ""} onChange={(e) => patch({ bride_role: e.target.value })} placeholder="Trưởng nữ" /></Field>
              <Field label="Cha mẹ — không bắt buộc (có nhập mới hiện trong thiệp)"><input className={inp} value={cfg.bride_subtitle ?? ""} onChange={(e) => patch({ bride_subtitle: e.target.value })} placeholder="Con Ông … và Bà …" /></Field>
              <Field label="Ảnh chân dung"><ImageUpload current={cfg.bride_photo} onUpload={uploadImage} onChange={(url) => patch({ bride_photo: url || undefined })} /></Field>
            </div>
            <div className="space-y-2 rounded-lg border border-stone-200 p-3">
              <p className="text-sm font-medium text-rose-700">Chú rể</p>
              <Field label="Vai vế"><input className={inp} value={cfg.groom_role ?? ""} onChange={(e) => patch({ groom_role: e.target.value })} placeholder="Út nam" /></Field>
              <Field label="Cha mẹ — không bắt buộc (có nhập mới hiện trong thiệp)"><input className={inp} value={cfg.groom_subtitle ?? ""} onChange={(e) => patch({ groom_subtitle: e.target.value })} placeholder="Con Ông … và Bà …" /></Field>
              <Field label="Ảnh chân dung"><ImageUpload current={cfg.groom_photo} onUpload={uploadImage} onChange={(url) => patch({ groom_photo: url || undefined })} /></Field>
            </div>
          </div>
          <Field label="Link Google Maps (nút Chỉ đường)"><input className={inp} value={cfg.map_url ?? ""} onChange={(e) => patch({ map_url: e.target.value })} placeholder="https://maps.google.com/…" /></Field>
          <div>
            <span className="mb-1 block text-xs font-medium text-stone-500">Màu trang phục (Dress code)</span>
            <div className="flex flex-wrap items-center gap-2">
              {(cfg.dress_code ?? []).map((col, i) => (
                <span key={i} className="relative">
                  <input type="color" value={col} onChange={(e) => { const d = [...(cfg.dress_code ?? [])]; d[i] = e.target.value; patch({ dress_code: d }); }} className="h-9 w-9 rounded-full border border-stone-300" />
                  <button type="button" onClick={() => patch({ dress_code: (cfg.dress_code ?? []).filter((_, k) => k !== i) })} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">×</button>
                </span>
              ))}
              <button type="button" onClick={() => patch({ dress_code: [...(cfg.dress_code ?? []), "#c98a86"] })} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"><Plus size={13} /> Thêm màu</button>
            </div>
          </div>
          <Field label="Ghi chú dress code"><input className={inp} value={cfg.dress_code_note ?? ""} onChange={(e) => patch({ dress_code_note: e.target.value })} placeholder="Mong quý khách mặc theo tông màu trên…" /></Field>
          <Field label="Lời cảm ơn (cuối thiệp)"><textarea className={`${inp} min-h-[70px]`} value={cfg.thanks_note ?? ""} onChange={(e) => patch({ thanks_note: e.target.value })} placeholder="Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại 💛" /></Field>
          <Field label="Ảnh phần cảm ơn"><ImageUpload current={cfg.thanks_photo} onUpload={uploadImage} onChange={(url) => patch({ thanks_photo: url || undefined })} /></Field>
        </Section>

        {/* Sổ lưu bút (lời chúc) — tuỳ chọn ẩn/hiện trên thiệp */}
        <Section title="Sổ lưu bút (lời chúc)" icon={<Heart size={16} />}>
          <Toggle checked={cfg.guestbook_enabled !== false} onChange={(v) => patch({ guestbook_enabled: v })} label="Hiện Sổ lưu bút (lời chúc của khách) trên thiệp" />
          <p className="text-xs text-stone-400">Tắt để ẩn danh sách lời chúc khỏi thiệp; khách vẫn gửi được lời chúc (nếu bật RSVP) và bạn vẫn xem trong phần phản hồi bên dưới. Ngoài ra, khi đã đặt mật khẩu “Trang xem riêng”, Sổ lưu bút cũng tự ẩn khỏi thiệp công khai.</p>
        </Section>

        {/* RSVP */}
        <Section title="Xác nhận tham dự (RSVP)" icon={<Users size={16} />}>
          <Toggle checked={cfg.rsvp_enabled !== false} onChange={(v) => patch({ rsvp_enabled: v })} label="Cho phép khách xác nhận & gửi lời chúc" />
          <Field label="Lời nhắn RSVP (không bắt buộc)">
            <input className={inp} value={cfg.rsvp_note ?? ""} onChange={(e) => patch({ rsvp_note: e.target.value })} placeholder="Vui lòng phản hồi trước ngày…" />
          </Field>
          <Field label="Link Love Story (để trống sẽ tự lấy theo hợp đồng nếu có)">
            <input className={inp} value={cfg.story_url ?? ""} onChange={(e) => patch({ story_url: e.target.value })} placeholder="https://…/story/… hoặc /story/ten-cua-ban" />
          </Field>
          <p className="text-xs text-stone-400">Nút “Xem Love Story” sẽ hiện ở cuối thiệp (cạnh phần xác nhận tham dự) khi có link.</p>
          {(cfg.guests_password ?? "").trim() && !responsesUnlocked ? (
            <ResponsesLock expected={(cfg.guests_password ?? "").trim()} onUnlock={() => setResponsesUnlocked(true)} />
          ) : (
            <div className="mt-3 rounded-lg bg-stone-100 p-3 text-sm">
              <p className="mb-2 font-medium">{rsvps.length} phản hồi · {attendingCount} khách sẽ tham dự</p>
              <div className="max-h-64 space-y-2 overflow-auto">
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
        </Section>

        {/* Khách mời — link + QR cá nhân hóa */}
        <Section title="Khách mời (link & QR riêng)" icon={<Users size={16} />}>
          <Field label="Lời mời (hiện phía trên tên khách trong thiệp)">
            <input className={inp} value={cfg.guest_greeting ?? ""} onChange={(e) => patch({ guest_greeting: e.target.value })} placeholder="Trân trọng kính mời" />
          </Field>
          <GuestManager baseUrl={absBase} accent={cfg.accent || "#b08968"} guests={cfg.guests ?? []} onChange={(guests) => patch({ guests })} />
          <p className="text-xs text-stone-400">Tên khách hiển thị bằng <b>font viết tay</b> trong thiệp. Nhớ bấm <b>“Lưu”</b> sau khi thêm/bớt khách.</p>
        </Section>

        {/* Style */}
        <Section title="Màu sắc & phông chữ" icon={<Heart size={16} />}>
          <div className="flex flex-wrap items-center gap-5">
            <Field label="Màu nhấn">
              <input type="color" className="h-9 w-16 rounded border border-stone-300" value={cfg.accent || "#b08968"} onChange={(e) => patch({ accent: e.target.value })} />
            </Field>
            <Field label="Phông chữ">
              <select className={inp} value={cfg.font || "serif"} onChange={(e) => patch({ font: e.target.value as "serif" | "sans" })}>
                <option value="serif">Cổ điển (serif)</option>
                <option value="sans">Hiện đại (sans)</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Music */}
        <Section title="Nhạc nền" icon={<Music size={16} />}>
          <Field label="Link nhạc (mp3) hoặc tải file nhạc lên">
            <input className={inp} value={cfg.music_url ?? ""} onChange={(e) => patch({ music_url: e.target.value || undefined })} placeholder="https://…/nhac.mp3" />
          </Field>
          <AudioUpload onUpload={uploadAudio} onChange={(url) => patch({ music_url: url || undefined })} currentUrl={cfg.music_url} />
          {cfg.music_url && <Toggle checked={cfg.music_autoplay ?? false} onChange={(v) => patch({ music_autoplay: v })} label="Thử tự phát khi khách mở thiệp (trình duyệt có thể chặn)" />}
        </Section>

        {/* Trang xem riêng cho gia đình (bảo mật danh sách khách + lời chúc) */}
        <Section title="Trang xem riêng (danh sách & lời chúc)" icon={<Lock size={16} />}>
          <p className="text-sm" style={{ color: "#6a6459" }}>
            Đặt mật khẩu để mở một trang <b>chỉ đọc</b> gồm danh sách khách phản hồi (RSVP) và toàn bộ lời chúc.
            Chia sẻ link + mật khẩu này cho người thân — họ xem được mà không cần link chỉnh sửa. Để trống nếu không dùng.
          </p>
          <GuestsPasswordField value={cfg.guests_password} onChange={(v) => patch({ guests_password: v })} guestsUrl={guestsUrl} />
        </Section>
      </main>

      {albumOpen && <AlbumPicker token={token} existing={cfg.gallery ?? []} onClose={() => setAlbumOpen(false)} onAdd={(urls) => { patch({ gallery: [...(cfg.gallery ?? []), ...urls] }); setAlbumOpen(false); }} />}
    </div>
  );
}

// ── Shared field styling ─────────────────────────────────────────────────
const inp = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 font-medium text-stone-700">{icon} {title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-rose-600" />
      {label}
    </label>
  );
}

function ImageUpload({ current, onUpload, onChange }: { current?: string; onUpload: (f: File) => Promise<string | null>; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {current && (
        <img src={current} alt="" className="h-16 w-16 rounded-lg object-cover" />
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); const url = await onUpload(f); setBusy(false);
        if (url) onChange(url);
        if (ref.current) ref.current.value = "";
      }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} {current ? "Đổi ảnh" : "Tải ảnh"}
      </button>
      {current && <button type="button" onClick={() => onChange(null)} className="text-stone-400 hover:text-red-500"><Trash2 size={16} /></button>}
    </div>
  );
}

function GalleryEditor({ gallery, onUpload, onChange }: { gallery: string[]; onUpload: (f: File) => Promise<string | null>; onChange: (g: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {gallery.map((url, i) => (
          <div key={i} className="group relative">
            <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <button type="button" onClick={() => onChange(gallery.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-stone-300 text-stone-400 hover:border-rose-300 hover:text-rose-400 disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={async (e) => {
        const files = Array.from(e.target.files ?? []); if (!files.length) return;
        setBusy(true);
        const urls: string[] = [];
        for (const f of files) { const url = await onUpload(f); if (url) urls.push(url); }
        setBusy(false);
        if (urls.length) onChange([...gallery, ...urls]);
        if (ref.current) ref.current.value = "";
      }} />
    </div>
  );
}

function EventsEditor({ events, onChange }: { events: WeddingEventBlock[]; onChange: (e: WeddingEventBlock[]) => void }) {
  const up = (i: number, p: Partial<WeddingEventBlock>) => onChange(events.map((e, j) => (j === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={i} className="rounded-lg border border-stone-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <input className={`${inp} max-w-[60%]`} value={e.label ?? ""} onChange={(ev) => up(i, { label: ev.target.value })} placeholder="Lễ Vu Quy / Tiệc cưới…" />
            <button type="button" onClick={() => onChange(events.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="date" className={inp} value={(e.date ?? "").slice(0, 10)} onChange={(ev) => up(i, { date: ev.target.value })} />
            <input className={inp} value={e.time ?? ""} onChange={(ev) => up(i, { time: ev.target.value })} placeholder="Giờ (vd 11:00)" />
            <input className={inp} value={e.venue ?? ""} onChange={(ev) => up(i, { venue: ev.target.value })} placeholder="Tên địa điểm" />
            <input className={inp} value={e.address ?? ""} onChange={(ev) => up(i, { address: ev.target.value })} placeholder="Địa chỉ" />
          </div>
          <input className={`${inp} mt-2`} value={e.map_url ?? ""} onChange={(ev) => up(i, { map_url: ev.target.value })} placeholder="Link Google Maps (không bắt buộc)" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...events, { label: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 hover:border-rose-300 hover:text-rose-500">
        <Plus size={14} /> Thêm sự kiện
      </button>
    </div>
  );
}

function BankEditor({ title, bank, onChange }: { title: string; bank?: WeddingBank; onChange: (b: WeddingBank) => void }) {
  const b = bank ?? {};
  const up = (p: Partial<WeddingBank>) => onChange({ ...b, ...p });
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <p className="mb-2 text-xs font-medium text-stone-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={inp}
          value={b.bin ?? ""}
          onChange={(e) => {
            const sel = BANKS.find((x) => x.bin === e.target.value);
            up({ bin: e.target.value || undefined, name: sel?.name });
          }}
        >
          <option value="">— Chọn ngân hàng —</option>
          {BANKS.map((x) => <option key={x.bin} value={x.bin}>{x.name}</option>)}
        </select>
        <input className={inp} value={b.account ?? ""} onChange={(e) => up({ account: e.target.value })} placeholder="Số tài khoản" />
      </div>
      <input className={`${inp} mt-2`} value={b.holder ?? ""} onChange={(e) => up({ holder: e.target.value })} placeholder="Tên chủ tài khoản" />
    </div>
  );
}

/**
 * Khoá khối "danh sách phản hồi + lời chúc" NGAY trong trang chỉnh sửa: khi cặp
 * đôi đã đặt mật khẩu, phải nhập đúng mới xem (mở khoá một lần cho phiên này).
 */
function ResponsesLock({ expected, onUnlock }: { expected: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = () => (entry.trim() === expected ? onUnlock() : setWrong(true));
  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
      <Lock size={18} className="mx-auto mb-2 text-stone-400" />
      <p className="mx-auto max-w-xs text-sm" style={{ color: "#6a6459" }}>Danh sách phản hồi & lời chúc đang được bảo vệ. Nhập mật khẩu để xem.</p>
      <div className="mx-auto mt-3 flex max-w-xs gap-2">
        <input
          type="password" value={entry} autoComplete="off"
          onChange={(e) => { setEntry(e.target.value); setWrong(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Mật khẩu" className={`${inp} flex-1`}
        />
        <button type="button" onClick={submit} className="flex-none rounded-lg bg-rose-600 px-4 text-sm font-medium text-white">Xem</button>
      </div>
      {wrong && <p className="mt-2 text-sm text-red-600">Mật khẩu chưa đúng.</p>}
    </div>
  );
}

/**
 * Mật khẩu "trang xem riêng". Nếu đã có mật khẩu từ trước → KHOÁ: muốn sửa/xoá
 * phải nhập ĐÚNG mật khẩu hiện tại (mở khoá một lần cho phiên chỉnh sửa này).
 */
function GuestsPasswordField({ value, onChange, guestsUrl }: { value?: string; onChange: (v?: string) => void; guestsUrl: string }) {
  const [initial] = useState((value ?? "").trim());        // mật khẩu lúc mở trình chỉnh sửa
  const [locked, setLocked] = useState(!!(value ?? "").trim());
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);

  if (locked) {
    return (
      <div>
        <p className="mb-2 text-sm" style={{ color: "#6a6459" }}>Đã đặt mật khẩu. Nhập đúng mật khẩu hiện tại để sửa hoặc xoá.</p>
        <div className="flex gap-2">
          <input
            type="password" value={entry} autoComplete="off"
            onChange={(e) => { setEntry(e.target.value); setWrong(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (entry.trim() === initial ? setLocked(false) : setWrong(true)); } }}
            placeholder="Mật khẩu hiện tại" className={`${inp} flex-1`}
          />
          <button type="button" onClick={() => (entry.trim() === initial ? setLocked(false) : setWrong(true))} className="flex-none rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium" style={{ color: "#6a6459" }}>Mở khoá để sửa</button>
        </div>
        {wrong && <p className="mt-2 text-sm text-red-600">Mật khẩu hiện tại chưa đúng.</p>}
      </div>
    );
  }

  return (
    <div>
      <Field label="Mật khẩu mở trang xem riêng (để trống = tắt trang này)">
        <input className={inp} value={value ?? ""} autoComplete="off" onChange={(e) => onChange(e.target.value || undefined)} placeholder="VD: 20122025" />
      </Field>
      {(value ?? "").trim() && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="text-xs font-medium" style={{ color: "#6a6459" }}>Link trang xem riêng (nhớ bấm Lưu trước khi chia sẻ):</div>
          <a href={guestsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-sm text-rose-600 underline">
            {guestsUrl} <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

function AudioUpload({ onUpload, onChange, currentUrl }: { onUpload: (f: File) => Promise<{ url?: string; error?: string }>; onChange: (url: string | null) => void; currentUrl?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input ref={ref} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setLocalErr(null); setBusy(true);
          const r = await onUpload(f); setBusy(false);
          if (r.url) onChange(r.url); else setLocalErr(r.error || "Tải nhạc thất bại.");
          if (ref.current) ref.current.value = "";
        }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />} {busy ? "Đang tải nhạc…" : "Tải file nhạc (≤10MB)"}
        </button>
        {currentUrl && <button type="button" onClick={() => { setLocalErr(null); onChange(null); }} className="text-stone-400 hover:text-red-500"><Trash2 size={16} /></button>}
      </div>
      {/* Phản hồi NGAY tại đây để không phải cuộn lên đầu trang mới thấy. */}
      {localErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{localErr}</p>}
      {currentUrl && !localErr && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-green-700">Đã có nhạc nền — nghe thử:</p>
          <audio src={currentUrl} controls preload="none" className="w-full" />
        </div>
      )}
    </div>
  );
}

/** Modal: pick photos from the couple's own album (linked to the contract). */
function AlbumPicker({ token, existing, onClose, onAdd }: { token: string; existing: string[]; onClose: () => void; onAdd: (urls: string[]) => void }) {
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
    setSel((s) => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <p className="font-medium">Chọn ảnh từ album cưới của bạn</p>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {photos === null && <div className="grid place-items-center py-16 text-stone-400"><Loader2 className="animate-spin" /></div>}
          {photos !== null && photos.length === 0 && (
            <p className="py-12 text-center text-sm text-stone-500">Chưa có album ảnh nào được liên kết với hợp đồng của bạn.</p>
          )}
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((p) => {
                const added = have.has(p.url);
                const picked = sel.has(p.url);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={added}
                    onClick={() => toggle(p.url)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 ${picked ? "border-rose-500" : "border-transparent"} disabled:opacity-40`}
                  >
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                    {(picked || added) && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white"><Check size={12} /></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
          <span className="text-sm text-stone-500">{sel.size} ảnh đã chọn</span>
          <button onClick={() => onAdd(Array.from(sel))} disabled={sel.size === 0} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Thêm vào thiệp
          </button>
        </div>
      </div>
    </div>
  );
}
