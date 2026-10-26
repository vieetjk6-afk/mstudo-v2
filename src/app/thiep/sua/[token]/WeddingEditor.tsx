"use client";

import { useState } from "react";
import {
  Heart, Save, Eye, EyeOff, Check, Loader2, ExternalLink, Gift, Users, CalendarDays, Type,
  Music, LayoutTemplate, FolderOpen, Lock, Image as ImageIcon, MessageCircleHeart, AlertCircle,
  Copy, Send, ArrowLeft,
} from "lucide-react";
import GuestManager from "./GuestManager";
import PreviewPane from "./editor/PreviewPane";
import TemplateGallery from "./editor/TemplateGallery";
import {
  AlbumPicker, AudioUpload, BankEditor, Card, EventsEditor, Field, GalleryEditor, GuestsPasswordField, MapLinkInput,
  ImageUpload, ResponsesLock, TimelineEditor, Toggle, inp,
} from "./editor/ui";
import { deriveWedding, useWeddingEditor, type EditorEmbed, type TodoKey } from "./useWeddingEditor";

export type { EditorEmbed };

/* Trình sửa thiệp cưới /thiep/sua/<token>. Logic (tải, lưu, tải ảnh/nhạc…) ở
   ./useWeddingEditor — bản cũ dưới đây (WeddingEditorV1) và bản giao diện mới
   (./WeddingEditorV2) dùng chung; page.tsx chọn bản theo customerUiV2. */

const TABS = [
  { id: "mau", label: "Mẫu thiệp", icon: LayoutTemplate },
  { id: "capdoi", label: "Cặp đôi", icon: Heart },
  { id: "ngay", label: "Ngày & địa điểm", icon: CalendarDays },
  { id: "anh", label: "Ảnh", icon: ImageIcon },
  { id: "noidung", label: "Nội dung", icon: Type },
  { id: "khach", label: "Khách mời & link riêng", icon: Users },
  { id: "qua", label: "Quà & nhạc", icon: Gift },
  { id: "phanhoi", label: "Phản hồi", icon: MessageCircleHeart },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Mục còn thiếu → tab có ô để điền mục đó. */
const TODO_TAB: Record<TodoKey, TabId> = {
  names: "capdoi", date: "ngay", cover: "anh", portraits: "capdoi", gallery: "anh", events: "ngay",
};

export default function WeddingEditor({ token, embed }: { token: string; embed?: EditorEmbed }) {
  return <WeddingEditorV1 token={token} embed={embed} />;
}

function WeddingEditorV1({ token, embed }: { token: string; embed?: EditorEmbed }) {
  const w = useWeddingEditor(token, embed);
  const {
    cfg, template, published, rsvps, status, saving, saved, dirty, err, albumOpen, setAlbumOpen, setResponsesUnlocked,
    previewGuest, setPreviewGuest, refreshRsvps, patch, pickTemplate, save, uploadImage, resolveMap, uploadAudio, draft, previewWishes, back,
  } = w;
  const [tab, setTab] = useState<TabId>("mau");
  const [previewOpen, setPreviewOpen] = useState(false);   // chỉ dùng trên màn hình hẹp

  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center text-stone-500"><Loader2 className="animate-spin" /></div>;
  }
  if (status === "notfound" || !cfg) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-stone-600">
        <div>
          <Heart className="mx-auto mb-3 text-stone-400" /><p>Không tìm thấy thiệp cưới này. Link có thể đã hết hạn.</p>
          {embed && (
            <button onClick={embed.onBack} className="mt-4 inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-sm">
              <ArrowLeft size={15} /> Về kế hoạch cưới
            </button>
          )}
        </div>
      </div>
    );
  }

  const d = deriveWedding(w, cfg, embed);
  const { publicUrl, guestsUrl, absBase, autoLunar, attendingCount, responsesLocked, meta, combo, guestNames } = d;
  const openGuests = d.openPlannerGuests ?? (() => setTab("khach"));

  // Nhắc những mục còn thiếu để thiệp trông "đủ" — bấm là nhảy sang đúng tab.
  const todo: { label: string; tab: TabId }[] = d.todo.map((t) => ({ label: t.label, tab: TODO_TAB[t.key] }));

  const preview = (
    <PreviewPane inv={draft} wishes={previewWishes} guest={previewGuest} storyUrl={cfg.story_url} publicUrl={publicUrl} />
  );

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800">
      {/* ── Thanh trên cùng ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {embed && (
              <button onClick={back} className="inline-flex flex-none items-center gap-1 rounded-full border border-stone-300 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-100" aria-label="Về kế hoạch cưới">
                <ArrowLeft size={15} /> <span className="hidden sm:inline">Kế hoạch cưới</span>
              </button>
            )}
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
                  <Icon size={14} /> {t.id === "khach" && combo ? "Khách mời" : t.label}
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

            {/*
              * GỬI THIỆP — khối này hiện ở MỌI tab, không nằm trong tab nào.
              * Trước đây link chung chỉ là dòng chữ xám nhỏ trên thanh đầu và bị
              * ẩn hẳn trên điện thoại (class sm:flex), còn link riêng từng khách
              * thì nằm trong tab thứ sáu phải vuốt ngang mới thấy — mở thiệp
              * xong không biết lấy link ở đâu mà gửi.
              */}
            <ShareBox
              publicUrl={absBase}
              guestCount={guestNames.length}
              onOpenGuests={combo ? openGuests : () => setTab("khach")}
              combo={combo}
            />

            {/* ── MẪU THIỆP ───────────────────────────────────────────── */}
            {tab === "mau" && (
              <>
                <Card title="Chọn mẫu thiệp" icon={<LayoutTemplate size={16} />} hint="Bấm một mẫu để xem ngay ở khung bên cạnh. Đổi thoải mái — chỉ khi bấm “Lưu” mới áp dụng cho khách.">
                  <TemplateGallery value={template} onChange={pickTemplate} cover={cfg.cover_url} bride={cfg.bride_name || "Cô dâu"} groom={cfg.groom_name || "Chú rể"} />
                </Card>
                <Card
                  title="Màu & phông chữ" icon={<Type size={16} />}
                  hint={meta.color
                    ? "Chọn một màu — cả tấm thiệp (nền, thẻ, chữ, màn mở thiệp) tự phối theo màu đó."
                    : meta.group === "phone" ? "Mẫu thiệp điện thoại dùng bộ phông riêng của mẫu; màu nhấn vẫn áp dụng được." : undefined}
                >
                  {meta.color && (
                    <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label={meta.color.label}>
                      {meta.color.swatches.map((sw) => {
                        const on = (cfg.accent || meta.color!.default).toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex} type="button" role="radio" aria-checked={on} title={sw.name}
                            onClick={() => patch({ accent: sw.hex === meta.color!.default ? undefined : sw.hex })}
                            className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition ${on ? "border-stone-800 bg-stone-50 font-semibold text-stone-900" : "border-stone-200 text-stone-600 hover:border-stone-400"}`}
                          >
                            <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: sw.hex }} />
                            {sw.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-5">
                    <Field label={meta.color ? `${meta.color.label} (tự chọn)` : "Màu nhấn"}>
                      <div className="flex items-center gap-2">
                        <input type="color" aria-label={meta.color?.label || "Màu nhấn"} className="h-9 w-16 rounded border border-stone-300" value={cfg.accent || meta.color?.default || meta.accent} onChange={(e) => patch({ accent: e.target.value })} />
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
                      <Field label="Vài dòng giới thiệu (không bắt buộc)"><textarea className={`${inp} min-h-[60px]`} value={cfg.bride_bio ?? ""} onChange={(e) => patch({ bride_bio: e.target.value })} placeholder="Cô gái dịu dàng, luôn mang đến sự ấm áp…" /></Field>
                    </div>
                    <div className="space-y-2 rounded-lg border border-stone-200 p-3">
                      <p className="text-sm font-medium text-rose-700">Chú rể</p>
                      <Field label="Vai vế"><input className={inp} value={cfg.groom_role ?? ""} onChange={(e) => patch({ groom_role: e.target.value })} placeholder="Út nam" /></Field>
                      <Field label="Cha mẹ (không bắt buộc)"><input className={inp} value={cfg.groom_subtitle ?? ""} onChange={(e) => patch({ groom_subtitle: e.target.value })} placeholder="Con Ông … và Bà …" /></Field>
                      <Field label="Ảnh chân dung"><ImageUpload current={cfg.groom_photo} onUpload={uploadImage} onChange={(url) => patch({ groom_photo: url || undefined })} /></Field>
                      <Field label="Vài dòng giới thiệu (không bắt buộc)"><textarea className={`${inp} min-h-[60px]`} value={cfg.groom_bio ?? ""} onChange={(e) => patch({ groom_bio: e.target.value })} placeholder="Chàng trai điềm đạm, người bạn đồng hành đáng tin cậy…" /></Field>
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
                    <Field label="Địa chỉ nhà trai (không bắt buộc)"><input className={inp} value={cfg.groom_home ?? ""} onChange={(e) => patch({ groom_home: e.target.value })} placeholder="Ba Đình, Hà Nội" /></Field>
                    <Field label="Địa chỉ nhà gái (không bắt buộc)"><input className={inp} value={cfg.bride_home ?? ""} onChange={(e) => patch({ bride_home: e.target.value })} placeholder="Đống Đa, Hà Nội" /></Field>
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
                    <Field label="Ngày âm lịch (không bắt buộc)" hint={autoLunar && !(cfg.lunar_date ?? "").trim() ? `Tự tính: ${autoLunar}` : undefined}>
                      <div className="flex gap-2">
                        <input className={inp} value={cfg.lunar_date ?? ""} onChange={(e) => patch({ lunar_date: e.target.value })} placeholder={autoLunar || "Nhằm ngày 12/11 Âm lịch"} />
                        {autoLunar && cfg.lunar_date !== autoLunar && (
                          <button type="button" onClick={() => patch({ lunar_date: autoLunar })} className="flex-none rounded-lg border border-stone-300 px-2.5 text-xs text-stone-600 hover:bg-stone-100" title="Điền ngày âm tính từ ngày cưới">Tự điền</button>
                        )}
                      </div>
                    </Field>
                    <Field label="Giờ đón khách"><input className={inp} value={cfg.reception_time ?? ""} onChange={(e) => patch({ reception_time: e.target.value })} placeholder="Đón khách từ 17:30" /></Field>
                  </div>
                </Card>

                <Card title="Lịch trình buổi tiệc" icon={<CalendarDays size={16} />} hint="Các mốc trong ngày tiệc: đón khách, làm lễ, khai tiệc… Các mẫu Đỏ đô, Đêm sao, Khung vòm hiện thành dòng thời gian.">
                  <TimelineEditor items={cfg.timeline ?? []} onChange={(timeline) => patch({ timeline })} />
                </Card>

                <Card title="Sự kiện cưới" icon={<CalendarDays size={16} />} hint="Vu quy · Tân hôn · Tiệc cưới… Thiệp hiện theo đúng thứ tự bạn thêm.">
                  <EventsEditor events={cfg.events ?? []} onChange={(events) => patch({ events })} resolveMap={resolveMap} />
                </Card>

                <Card title="Địa điểm chính" icon={<Heart size={16} />} hint="Để trống sẽ tự lấy theo sự kiện cuối cùng có địa chỉ (thường là tiệc cưới).">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tên địa điểm"><input className={inp} value={cfg.venue_name ?? ""} onChange={(e) => patch({ venue_name: e.target.value })} placeholder="Trung tâm tiệc cưới Lavender" /></Field>
                    <Field label="Địa chỉ"><input className={inp} value={cfg.venue_address ?? ""} onChange={(e) => patch({ venue_address: e.target.value })} placeholder="88 Nguyễn Huệ, Q.1, TP.HCM" /></Field>
                  </div>
                  <Field label="Link Google Maps (nút “Chỉ đường”)" hint="Có link hoặc địa chỉ là thiệp tự hiện bản đồ.">
                    <MapLinkInput value={cfg.map_url ?? ""} onChange={(v) => patch({ map_url: v })} resolve={resolveMap} placeholder="Dán link từ nút Chia sẻ của Google Maps" />
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
                <Card
                  title={combo ? "Khách mời" : "Khách mời (link & QR riêng)"}
                  icon={<Users size={16} />}
                  hint={combo
                    ? undefined
                    : "Mỗi khách có một link riêng, mở ra thiệp ghi đúng tên họ bằng chữ viết tay. Khách xác nhận tham dự trên thiệp thì trạng thái hiện ngay cạnh tên — chỉ bạn xem được ở đây."}
                >
                  <Field label="Lời mời (hiện phía trên tên khách)">
                    <input className={inp} value={cfg.guest_greeting ?? ""} onChange={(e) => patch({ guest_greeting: e.target.value })} placeholder="Trân trọng kính mời" />
                  </Field>
                  <Field label="Xem trước với tên khách">
                    <select className={inp} value={previewGuest} onChange={(e) => setPreviewGuest(e.target.value)}>
                      <option value="">— Không hiện tên khách —</option>
                      {[...new Set(guestNames)].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                  {combo ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm">
                      <p className="font-medium text-rose-800">Danh sách khách dùng chung với Kế hoạch cưới</p>
                      <p className="mt-1 text-xs leading-relaxed text-stone-600">
                        Thêm khách ở tab <b>Khách mời</b> của kế hoạch là có ngay link thiệp + mã QR ghi tên người đó. Khách bấm xác nhận trên thiệp thì trạng thái, số người và số bàn trong danh sách tự cập nhật.
                      </p>
                      <button onClick={openGuests} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white">
                        <Users size={15} /> {guestNames.length ? `Mở danh sách ${guestNames.length} khách` : "Mở danh sách khách"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {responsesLocked && <ResponsesLock expected={(cfg.guests_password ?? "").trim()} onUnlock={() => setResponsesUnlocked(true)} />}
                      <GuestManager baseUrl={absBase} accent={cfg.accent || meta.accent} guests={cfg.guests ?? []} onChange={(guests) => patch({ guests })} rsvps={responsesLocked ? null : rsvps} onRefresh={refreshRsvps} />
                      <p className="text-xs text-stone-400">Nhớ bấm <b>“Lưu”</b> sau khi thêm/bớt khách.</p>
                    </>
                  )}
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
                  <Field label="Link YouTube, link file nhạc (mp3) hoặc tải file nhạc lên">
                    <input className={inp} value={cfg.music_url ?? ""} onChange={(e) => patch({ music_url: e.target.value || undefined })} placeholder="https://youtu.be/… hoặc https://…/nhac.mp3" />
                  </Field>
                  <p className="text-xs text-stone-400">Mẹo: muốn bỏ đoạn dạo đầu, mở YouTube trên máy tính, bấm Chia sẻ → tích “Bắt đầu tại” rồi sao chép link.</p>
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
                  {responsesLocked ? (
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

/**
 * Hộp "Gửi thiệp cho khách": link chung để gửi cả nhóm, và lối đi thẳng tới
 * link riêng của từng khách. Đặt ngoài mọi tab vì đây là việc cặp đôi làm
 * NHIỀU NHẤT sau khi soạn xong — không nên bắt họ đi tìm.
 */
function ShareBox({ publicUrl, guestCount, onOpenGuests, combo = false }: { publicUrl: string; guestCount: number; onOpenGuests: () => void; combo?: boolean }) {
  // publicUrl ở đây là bản TUYỆT ĐỐI (absBase): link dán sang Zalo/Facebook mà
  // chỉ có "/thiep/..." thì người nhận bấm vào không ra đâu cả.
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* trình duyệt chặn clipboard thì khách vẫn bôi đen chép tay được */ }
  }
  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
      <h2 className="flex items-center gap-2 font-medium text-rose-800"><Send size={16} /> Gửi thiệp cho khách</h2>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-stone-500">Link chung — gửi cho cả nhóm, đăng Zalo/Facebook</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={publicUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
          />
          <button onClick={copy} className="inline-flex flex-none items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white">
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép link"}
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex flex-none items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-600">
            <ExternalLink size={15} /> Mở thử
          </a>
        </div>
      </div>

      <div className="mt-4 border-t border-rose-200 pt-3">
        <p className="text-xs font-medium text-stone-500">Link riêng từng khách — thiệp mở ra ghi đúng tên người nhận</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={onOpenGuests} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700">
            <Users size={15} /> {guestCount > 0 ? `Xem ${guestCount} link riêng` : "Tạo link riêng cho từng khách"}
          </button>
          {guestCount === 0 && (
            <span className="text-xs text-stone-500">
              {combo ? "Thêm khách ở tab Khách mời của kế hoạch cưới là có ngay link + mã QR riêng." : "Nhập tên khách là có ngay link + mã QR riêng cho từng người."}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
