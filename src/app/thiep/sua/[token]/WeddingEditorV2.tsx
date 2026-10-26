"use client";

import { useState } from "react";
import {
  AlertCircle, ArrowLeft, CalendarDays, Check, ChevronDown, ClipboardList, Copy, Eye, EyeOff, ExternalLink, Gift, Heart,
  Image as ImageIcon, LayoutTemplate, Loader2, Lock, MessageCircleHeart, Music, Palette, PenLine, Save, Send, Type, Users,
  type LucideIcon,
} from "lucide-react";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Badge, Callout, Empty, Field, Progress, Section, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Switch, Tabs } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { ToastV2 } from "@/app/dashboard/studio/thiep/CreativeV2Parts";
import GuestManagerV2, { RsvpListV2 } from "./GuestManagerV2";
import PreviewPaneV2 from "./editor/PreviewPaneV2";
import TemplatePickerV2, { CurrentTemplateV2 } from "./editor/TemplatePickerV2";
import {
  AlbumPickerV2, AudioV2, BankV2, EventsV2, GalleryV2, GuestsPasswordV2, ImageV2, MapLinkV2, ResponsesLockV2, TextV2, TimelineV2,
} from "./editor/ui-v2";
import { deriveWedding, useWeddingEditor, type EditorEmbed, type TodoKey } from "./useWeddingEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   TRÌNH SỬA THIỆP CƯỚI — giao diện mới (/thiep/sua/<token> khi customerUiV2
   bật). Cùng dữ liệu, cùng thao tác với WeddingEditorV1 (logic chung ở
   ./useWeddingEditor); khác ở cách sắp xếp:
     • Đầu trang thương hiệu studio + trạng thái lưu + MỘT nút chính: "Lưu" khi
       còn thay đổi, xong rồi thì "Gửi khách mời" (ngăn kéo: link chung, xuất
       bản, đường sang link riêng từng khách).
     • Máy tính: cột trái hai tab Sửa thiệp · Khách mời; cột phải khung điện
       thoại xem trước trực tiếp (giữ nguyên bộ dựng thiệp thật).
     • Sửa thiệp: thẻ trạng thái (đang hiển thị / nháp, link thiệp, còn thiếu
       gì) rồi các KHỐI gập mở — Cô dâu & chú rể · Ngày giờ & địa điểm · Lời mời
       · Ảnh · Nhạc · Mẫu thiệp · Dặn dò · Quà mừng cưới · Xác nhận & lời chúc.
       Mẫu thiệp chọn trong ngăn kéo; sự kiện cưới sửa trong ngăn kéo.
     • Điện thoại: ba tab Sửa · Xem trước · Khách mời, thanh lưu dính đáy.
   Phần trang trí nghệ thuật (mẫu thiệp) KHÔNG vẽ lại — chỉ dựng trong khung.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "edit" | "preview" | "guests";
type SectionId = "couple" | "date" | "invite" | "photos" | "music" | "template" | "guide" | "gift" | "rsvp";

/** Mục còn thiếu → khối có ô để điền mục đó. */
const TODO_SECTION: Record<TodoKey, SectionId> = {
  names: "couple", portraits: "couple", date: "date", events: "date", cover: "photos", gallery: "photos",
};
/** Số mục "nên có" để thiệp trông đủ (khớp danh sách việc còn thiếu). */
const TODO_TOTAL = 6;

const muted: React.CSSProperties = { color: "var(--tx3)" };

export type WeddingEditorView = View;
export type WeddingEditorSection = SectionId;

export default function WeddingEditorV2({
  token, embed, brand, initialView = "edit", initialSection = "couple",
}: {
  token: string;
  embed?: EditorEmbed;
  brand: StudioBrandInfo;
  /** Tab / khối mở sẵn (màn xem trước dùng; trang thật để mặc định). */
  initialView?: View;
  initialSection?: SectionId | null;
}) {
  const w = useWeddingEditor(token, embed);
  const { cfg, patch, uploadImage, resolveMap, save, saving, saved, dirty, published, err } = w;
  const { theme } = useTheme();
  const [view, setView] = useState<View>(initialView);
  const [open, setOpen] = useState<SectionId | null>(initialSection);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const backBtn = embed ? (
    <button type="button" onClick={w.back} className={btn("ghost", "sm")} aria-label="Về kế hoạch cưới" title="Về kế hoạch cưới">
      <ArrowLeft size={16} /> <span className="hidden sm:inline">Kế hoạch cưới</span>
    </button>
  ) : null;

  if (w.status === "loading" || w.status === "notfound" || !cfg) {
    return (
      <CustomerRootV2 theme={theme}>
        <CustomerHeaderV2 brand={brand} sub="Thiệp cưới của bạn" right={backBtn} />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          {w.status === "loading" ? (
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--ac)" }} />
          ) : (
            <div className="v2-card w-full max-w-[440px]">
              <Empty
                icon={Heart}
                title="Không tìm thấy thiệp cưới này"
                hint="Link có thể đã hết hạn. Nhắn studio để nhận link sửa thiệp mới."
                action={embed ? <button type="button" onClick={embed.onBack} className={btn("secondary")}><ArrowLeft size={16} /> Về kế hoạch cưới</button> : undefined}
              />
            </div>
          )}
        </div>
      </CustomerRootV2>
    );
  }

  const d = deriveWedding(w, cfg, embed);
  const { meta, combo, guestNames, responsesLocked } = d;
  const couple = [cfg.bride_name, cfg.groom_name].filter(Boolean).join(" & ");
  const missing = new Set(d.todo.map((t) => TODO_SECTION[t.key]));
  const doneCount = TODO_TOTAL - d.todo.length;

  /** Mở một khối (đóng khối khác) và cuộn tới nó; trên điện thoại chuyển về tab Sửa. */
  const focusSection = (id: SectionId) => {
    setView("edit");
    setOpen(id);
    setTimeout(() => {
      const el = document.getElementById(`muc-${id}`);
      if (el && el.getBoundingClientRect().top < 120) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };
  const toggle = (id: SectionId) => (open === id ? setOpen(null) : focusSection(id));
  const showGuests = () => (d.openPlannerGuests ? d.openPlannerGuests() : setView("guests"));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(d.absBase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* trình duyệt chặn clipboard thì khách vẫn bôi đen chép tay được */ }
  }

  /* ── Trạng thái lưu + nút chính ─────────────────────────────────────── */
  const saveState: { label: string; tone: "amber" | "green" | "gray" | "red"; icon?: LucideIcon } = saving
    ? { label: "Đang lưu…", tone: "gray" }
    : err
      ? { label: "Chưa lưu được", tone: "red" }
      : dirty
        ? { label: "Chưa lưu", tone: "amber" }
        : saved
          ? { label: "Đã lưu", tone: "green", icon: Check }
          : { label: "Đã lưu", tone: "gray", icon: Check };
  const needSave = dirty || saving;
  const primary = (extra = "") =>
    needSave ? (
      <button type="button" onClick={() => void save()} disabled={saving} className={btn("primary", "md", extra)}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    ) : (
      <button type="button" onClick={() => setShareOpen(true)} className={btn("primary", "md", extra)}>
        <Send size={16} /> Gửi khách mời
      </button>
    );

  const menu = (
    <Menu
      label="Thêm thao tác với thiệp"
      width={250}
      items={[
        { label: "Mở thiệp thật", hint: "Như khách thấy (bản đã lưu)", icon: ExternalLink, href: d.publicUrl, external: true },
        { label: copied ? "Đã chép link thiệp" : "Chép link thiệp", icon: copied ? Check : Copy, onClick: () => void copyLink() },
        "divider",
        published
          ? { label: "Ẩn thiệp", hint: "Khách mở link sẽ không thấy", icon: EyeOff, onClick: () => void save(false), disabled: saving }
          : { label: "Xuất bản thiệp", hint: "Lưu và cho khách mở được", icon: Eye, onClick: () => void save(true), disabled: saving },
        { label: "Trang xem riêng (mật khẩu)", icon: Lock, onClick: () => setView("guests") },
      ]}
    />
  );

  /* ── Khối gập mở ─────────────────────────────────────────────────────── */
  const sec = (id: SectionId, icon: LucideIcon, title: string, summary: React.ReactNode, body: React.ReactNode, required = false) => (
    <EdSection
      key={id}
      id={id}
      icon={icon}
      title={title}
      summary={summary}
      state={missing.has(id) ? "todo" : required ? "done" : null}
      open={open === id}
      onToggle={() => toggle(id)}
    >
      {body}
    </EdSection>
  );

  const eventsCount = (cfg.events ?? []).length;
  const gallery = cfg.gallery ?? [];
  const accentNow = cfg.accent || meta.color?.default || meta.accent;

  const editPane = (
    <Stack gap={14}>
      {/* Thẻ trạng thái: hiển thị hay nháp · link thiệp · còn thiếu gì */}
      <div className="v2-card v2-card-pad flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={published ? "green" : "gray"} dot>{published ? "Đang hiển thị" : "Bản nháp"}</Badge>
          <p className="order-3 min-w-0 basis-full text-[13.5px] sm:order-none sm:flex-[1_1_200px] sm:basis-auto" style={{ color: "var(--tx2)" }}>
            {published ? "Khách mở link là thấy thiệp (bản đã lưu)." : "Khách chưa mở được thiệp — xuất bản khi đã sẵn sàng."}
          </p>
          <button type="button" onClick={() => void save(!published)} disabled={saving} className={btn(published ? "ghost" : "secondary", "sm", "ml-auto")}>
            {published ? <><EyeOff size={15} /> Ẩn thiệp</> : <><Eye size={15} /> Xuất bản thiệp</>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={d.absBase} onFocus={(e) => e.currentTarget.select()} aria-label="Link thiệp" className={`${inputCls} min-w-0 flex-1 !text-[13px]`} style={{ background: "var(--sf2)" }} />
          <button type="button" onClick={() => void copyLink()} className={iconBtn()} aria-label="Chép link thiệp" title="Chép link thiệp" style={copied ? { color: "var(--gn)" } : undefined}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <a href={d.publicUrl} target="_blank" rel="noopener noreferrer" className={iconBtn()} aria-label="Mở thiệp thật ở tab mới" title="Mở thiệp thật ở tab mới">
            <ExternalLink size={16} />
          </a>
        </div>
        {d.todo.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>
            <Check size={14} strokeWidth={3} /> Thiệp đã đủ các mục chính
          </p>
        ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="font-semibold">Đã đủ {doneCount}/{TODO_TOTAL} mục chính</span>
            <span style={muted}>{Math.round((doneCount / TODO_TOTAL) * 100)}%</span>
          </div>
          <Progress value={(doneCount / TODO_TOTAL) * 100} tone="amber" />
          {d.todo.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px]" style={muted}>Còn thiếu:</span>
              {d.todo.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => focusSection(TODO_SECTION[t.key])}
                  className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                  style={{ background: "var(--amS)", color: "var(--am)" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {sec("couple", Heart, "Cô dâu & chú rể", couple || "Chưa điền tên hai bạn", (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên cô dâu"><TextV2 value={cfg.bride_name} onChange={(v) => patch({ bride_name: v })} placeholder="Phương Nhi" /></Field>
            <Field label="Tên chú rể"><TextV2 value={cfg.groom_name} onChange={(v) => patch({ groom_name: v })} placeholder="Anh Tuấn" /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SubBox title="Cô dâu">
              <Field label="Vai vế"><TextV2 value={cfg.bride_role} onChange={(v) => patch({ bride_role: v })} placeholder="Trưởng nữ" /></Field>
              <Field label="Cha mẹ" hint="Không bắt buộc"><TextV2 value={cfg.bride_subtitle} onChange={(v) => patch({ bride_subtitle: v })} placeholder="Con Ông … và Bà …" /></Field>
              <Field label="Ảnh chân dung"><ImageV2 current={cfg.bride_photo} onUpload={uploadImage} onChange={(url) => patch({ bride_photo: url || undefined })} /></Field>
              <Field label="Vài dòng giới thiệu" hint="Không bắt buộc"><TextV2 area rows={3} value={cfg.bride_bio} onChange={(v) => patch({ bride_bio: v })} placeholder="Cô gái dịu dàng, luôn mang đến sự ấm áp…" /></Field>
            </SubBox>
            <SubBox title="Chú rể">
              <Field label="Vai vế"><TextV2 value={cfg.groom_role} onChange={(v) => patch({ groom_role: v })} placeholder="Út nam" /></Field>
              <Field label="Cha mẹ" hint="Không bắt buộc"><TextV2 value={cfg.groom_subtitle} onChange={(v) => patch({ groom_subtitle: v })} placeholder="Con Ông … và Bà …" /></Field>
              <Field label="Ảnh chân dung"><ImageV2 current={cfg.groom_photo} onUpload={uploadImage} onChange={(url) => patch({ groom_photo: url || undefined })} /></Field>
              <Field label="Vài dòng giới thiệu" hint="Không bắt buộc"><TextV2 area rows={3} value={cfg.groom_bio} onChange={(v) => patch({ groom_bio: v })} placeholder="Chàng trai điềm đạm, người bạn đồng hành đáng tin cậy…" /></Field>
            </SubBox>
          </div>
          <SubHead title="Hai họ" hint="Hiện thành hai cột “Nhà trai · Nhà gái” trên các mẫu thiệp điện thoại. Mỗi người một dòng." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nhà trai"><TextV2 area rows={3} value={cfg.groom_family} onChange={(v) => patch({ groom_family: v })} placeholder={"Ông Vũ Đình Hải\nBà Lê Thị Mai"} /></Field>
            <Field label="Nhà gái"><TextV2 area rows={3} value={cfg.bride_family} onChange={(v) => patch({ bride_family: v })} placeholder={"Ông Đặng Văn Sơn\nBà Trịnh Thu Hà"} /></Field>
            <Field label="Địa chỉ nhà trai" hint="Không bắt buộc"><TextV2 value={cfg.groom_home} onChange={(v) => patch({ groom_home: v })} placeholder="Ba Đình, Hà Nội" /></Field>
            <Field label="Địa chỉ nhà gái" hint="Không bắt buộc"><TextV2 value={cfg.bride_home} onChange={(v) => patch({ bride_home: v })} placeholder="Đống Đa, Hà Nội" /></Field>
          </div>
        </>
      ), true)}

      {sec("date", CalendarDays, "Ngày giờ & địa điểm", [cfg.wedding_date ? `Cưới ${fmtDate(cfg.wedding_date)}` : "Chưa đặt ngày cưới", eventsCount ? `${eventsCount} sự kiện` : null, cfg.venue_name || null].filter(Boolean).join(" · "), (
        <>
          <Field label="Ngày cưới" hint="Ngày này chạy đồng hồ đếm ngược trên thiệp.">
            <input type="date" className={inputCls} value={(cfg.wedding_date ?? "").slice(0, 10)} onChange={(e) => patch({ wedding_date: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ngày âm lịch" hint={d.autoLunar && !(cfg.lunar_date ?? "").trim() ? `Tự tính: ${d.autoLunar}` : "Không bắt buộc"}>
              <div className="flex gap-2">
                <input className={`${inputCls} min-w-0 flex-1`} value={cfg.lunar_date ?? ""} onChange={(e) => patch({ lunar_date: e.target.value })} placeholder={d.autoLunar || "Nhằm ngày 12/11 Âm lịch"} aria-label="Ngày âm lịch" />
                {d.autoLunar && cfg.lunar_date !== d.autoLunar && (
                  <button type="button" onClick={() => patch({ lunar_date: d.autoLunar })} className={btn("secondary")} title="Điền ngày âm tính từ ngày cưới">Tự điền</button>
                )}
              </div>
            </Field>
            <Field label="Giờ đón khách"><TextV2 value={cfg.reception_time} onChange={(v) => patch({ reception_time: v })} placeholder="Đón khách từ 17:30" /></Field>
          </div>
          <SubHead title="Sự kiện cưới" hint="Vu quy · Tân hôn · Tiệc cưới… Bấm một sự kiện để sửa giờ, địa điểm, bản đồ." />
          <EventsV2 events={cfg.events ?? []} onChange={(events) => patch({ events })} resolveMap={resolveMap} />
          <SubHead title="Lịch trình buổi tiệc" hint="Đón khách, làm lễ, khai tiệc… Các mẫu Đỏ đô, Đêm sao, Khung vòm hiện thành dòng thời gian." />
          <TimelineV2 items={cfg.timeline ?? []} onChange={(timeline) => patch({ timeline })} />
          <SubHead title="Địa điểm chính" hint="Để trống sẽ tự lấy theo sự kiện cuối cùng có địa chỉ (thường là tiệc cưới)." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên địa điểm"><TextV2 value={cfg.venue_name} onChange={(v) => patch({ venue_name: v })} placeholder="Trung tâm tiệc cưới Lavender" /></Field>
            <Field label="Địa chỉ"><TextV2 value={cfg.venue_address} onChange={(v) => patch({ venue_address: v })} placeholder="88 Nguyễn Huệ, Q.1, TP.HCM" /></Field>
          </div>
          <Field label="Link Google Maps (nút “Chỉ đường”)">
            <MapLinkV2 value={cfg.map_url ?? ""} onChange={(v) => patch({ map_url: v })} resolve={resolveMap} placeholder="Dán link từ nút Chia sẻ của Google Maps" />
          </Field>
          <Field label="Ảnh chụp bản đồ" hint="Tuỳ chọn — thay cho bản đồ nhúng.">
            <ImageV2 square={false} current={cfg.map_image} onUpload={uploadImage} onChange={(url) => patch({ map_image: url || undefined })} />
          </Field>
          <Field label="Địa điểm ngắn hiện ở bìa"><TextV2 value={cfg.location} onChange={(v) => patch({ location: v })} placeholder="Hà Nội, Việt Nam" /></Field>
        </>
      ), true)}

      {sec("invite", Type, "Lời mời & nội dung", cfg.cover_quote || cfg.guest_greeting || "Lời mời, câu mở đầu, chuyện tình, lời cảm ơn", (
        <>
          <Field label="Lời mời (hiện phía trên tên khách)" hint="Thấy khi khách mở bằng link riêng ghi tên họ.">
            <TextV2 value={cfg.guest_greeting} onChange={(v) => patch({ guest_greeting: v })} placeholder="Trân trọng kính mời" />
          </Field>
          <Field label="Câu trích dẫn ở bìa"><TextV2 value={cfg.cover_quote} onChange={(v) => patch({ cover_quote: v })} placeholder="Yêu nhau từ cái nhìn đầu tiên…" /></Field>
          <Field label="Chuyện tình yêu"><TextV2 area rows={5} value={cfg.story} onChange={(v) => patch({ story: v })} placeholder="Kể câu chuyện của hai bạn…" /></Field>
          <Field label="Câu kết cuối thiệp"><TextV2 value={cfg.closing_line} onChange={(v) => patch({ closing_line: v })} placeholder="Hân hạnh được đón tiếp" /></Field>
          <Field label="Lời cảm ơn"><TextV2 area rows={3} value={cfg.thanks_note} onChange={(v) => patch({ thanks_note: v })} placeholder="Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại 💛" /></Field>
        </>
      ))}

      {sec("photos", ImageIcon, "Ảnh", [cfg.cover_url ? "Có ảnh bìa" : "Chưa có ảnh bìa", gallery.length ? `${gallery.length} ảnh album` : "chưa có album"].join(" · "), (
        <>
          <Field label="Ảnh bìa"><ImageV2 square={false} current={cfg.cover_url} onUpload={uploadImage} onChange={(url) => patch({ cover_url: url || undefined })} /></Field>
          <SubHead title="Album ảnh cưới" hint="Mẫu thiệp điện thoại dùng ảnh theo thứ tự: 1–2 là hai ô ảnh phụ, 3–5 là album cuối thiệp. Thêm từ 6 ảnh để hiện đủ các khối." />
          <GalleryV2 gallery={gallery} onUpload={uploadImage} onChange={(g) => patch({ gallery: g })} onOpenAlbum={() => w.setAlbumOpen(true)} />
          <Field label="Ảnh lời cảm ơn"><ImageV2 current={cfg.thanks_photo} onUpload={uploadImage} onChange={(url) => patch({ thanks_photo: url || undefined })} /></Field>
        </>
      ), true)}

      {sec("music", Music, "Nhạc nền", cfg.music_url ? (cfg.music_autoplay ? "Đã có nhạc · thử tự phát" : "Đã có nhạc nền") : "Chưa có nhạc", (
        <>
          <Field label="Link YouTube hoặc link file nhạc (mp3)" hint="Mẹo: muốn bỏ đoạn dạo đầu, mở YouTube trên máy tính, bấm Chia sẻ → tích “Bắt đầu tại” rồi sao chép link.">
            <input className={inputCls} value={cfg.music_url ?? ""} onChange={(e) => patch({ music_url: e.target.value || undefined })} placeholder="https://youtu.be/… hoặc https://…/nhac.mp3" />
          </Field>
          <AudioV2 onUpload={w.uploadAudio} onChange={(url) => patch({ music_url: url || undefined })} currentUrl={cfg.music_url} />
          {cfg.music_url && (
            <Switch checked={cfg.music_autoplay ?? false} onChange={(v) => patch({ music_autoplay: v })} label="Thử tự phát khi khách mở thiệp" desc="Trình duyệt có thể chặn — khách bấm nút nhạc là phát." />
          )}
        </>
      ))}

      {sec("template", LayoutTemplate, "Mẫu thiệp", `${meta.label} · ${meta.tagline}`, (
        <>
          <CurrentTemplateV2
            meta={meta}
            cover={cfg.cover_url}
            bride={cfg.bride_name || "Cô dâu"}
            groom={cfg.groom_name || "Chú rể"}
            action={<button type="button" onClick={() => setPickerOpen(true)} className={btn("secondary", "sm")}><LayoutTemplate size={15} /> Đổi mẫu</button>}
          />
          <SubHead
            title="Màu & phông chữ"
            hint={meta.color
              ? "Chọn một màu — cả tấm thiệp (nền, thẻ, chữ, màn mở thiệp) tự phối theo màu đó."
              : meta.group === "phone" ? "Mẫu thiệp điện thoại dùng bộ phông riêng của mẫu; màu nhấn vẫn áp dụng được." : undefined}
          />
          {meta.color && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={meta.color.label}>
              {meta.color.swatches.map((sw) => {
                const on = (cfg.accent || meta.color!.default).toLowerCase() === sw.hex.toLowerCase();
                return (
                  <button
                    key={sw.hex} type="button" role="radio" aria-checked={on} title={sw.name}
                    onClick={() => patch({ accent: sw.hex === meta.color!.default ? undefined : sw.hex })}
                    className="flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12.5px] font-medium"
                    style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, boxShadow: on ? "0 0 0 1px var(--ac)" : undefined, background: on ? "var(--acS)" : "var(--sf)" }}
                  >
                    <span className="h-6 w-6 rounded-full" style={{ background: sw.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
                    {sw.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <Field label={meta.color ? `${meta.color.label} (tự chọn)` : "Màu nhấn"}>
              <div className="flex items-center gap-2">
                <label className="flex h-[var(--v2-h)] cursor-pointer items-center gap-2 rounded-[var(--v2-r)] px-2.5" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
                  <Palette size={15} style={muted} />
                  <input type="color" aria-label={meta.color?.label || "Màu nhấn"} className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0" value={accentNow} onChange={(e) => patch({ accent: e.target.value })} />
                  <span className="v2-num text-[12.5px]" style={{ color: "var(--tx2)" }}>{accentNow}</span>
                </label>
                {cfg.accent && <button type="button" onClick={() => patch({ accent: undefined })} className={btn("ghost", "sm")}>Dùng màu gốc của mẫu</button>}
              </div>
            </Field>
            {meta.group === "long" && (
              <Field label="Phông chữ">
                <select className={inputCls} value={cfg.font || "serif"} onChange={(e) => patch({ font: e.target.value as "serif" | "sans" })}>
                  <option value="serif">Cổ điển (serif)</option>
                  <option value="sans">Hiện đại (sans)</option>
                </select>
              </Field>
            )}
          </div>
        </>
      ))}

      {sec("guide", ClipboardList, "Dặn dò khách mời", [cfg.dress_code?.length ? `${cfg.dress_code.length} màu trang phục` : null, cfg.hashtag || null, cfg.hotline ? "có hotline" : null].filter(Boolean).join(" · ") || "Dress code, hashtag, gửi xe, hotline", (
        <>
          <p className="text-[12.5px]" style={muted}>Bốn ô này hiện thành lưới nhỏ trên thiệp; bỏ trống ô nào thì ô đó ẩn đi.</p>
          <Field label="Màu trang phục (Dress code)">
            <div className="flex flex-wrap items-center gap-2.5">
              {(cfg.dress_code ?? []).map((col, i) => (
                <span key={i} className="relative">
                  <input type="color" aria-label={`Màu ${i + 1}`} value={col} onChange={(e) => { const dc = [...(cfg.dress_code ?? [])]; dc[i] = e.target.value; patch({ dress_code: dc }); }} className="h-9 w-9 cursor-pointer rounded-full border-0 p-0" style={{ boxShadow: "0 0 0 1px var(--bd)" }} />
                  <button type="button" aria-label="Bỏ màu" title="Bỏ màu" onClick={() => patch({ dress_code: (cfg.dress_code ?? []).filter((_, k) => k !== i) })} className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] text-white" style={{ background: "var(--rd)" }}>×</button>
                </span>
              ))}
              <button type="button" onClick={() => patch({ dress_code: [...(cfg.dress_code ?? []), "#c98a86"] })} className={btn("secondary", "sm")}>+ Thêm màu</button>
            </div>
          </Field>
          <Field label="Ghi chú dress code"><TextV2 value={cfg.dress_code_note} onChange={(v) => patch({ dress_code_note: v })} placeholder="Kem · hồng sen" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hashtag"><TextV2 value={cfg.hashtag} onChange={(v) => patch({ hashtag: v })} placeholder="#NhiVeNhaTuan" /></Field>
            <Field label="Gửi xe"><TextV2 value={cfg.parking_note} onChange={(v) => patch({ parking_note: v })} placeholder="Hầm B2, miễn phí" /></Field>
          </div>
          <Field label="Hotline lễ tân"><TextV2 value={cfg.hotline} onChange={(v) => patch({ hotline: v })} placeholder="0903 221 118 (chị Hạnh)" /></Field>
        </>
      ))}

      {sec("gift", Gift, "Quà mừng cưới", cfg.gift_enabled ? `Đang hiện mã QR · ${[cfg.groom_bank?.account, cfg.bride_bank?.account].filter(Boolean).length} tài khoản` : "Đang tắt", (
        <>
          <Switch checked={cfg.gift_enabled ?? false} onChange={(v) => patch({ gift_enabled: v })} label="Hiển thị mã QR mừng cưới" desc="Khách quét mã để chuyển khoản mừng cưới." />
          {cfg.gift_enabled && (
            <>
              <Field label="Lời nhắn" hint="Không bắt buộc"><TextV2 value={cfg.gift_note} onChange={(v) => patch({ gift_note: v })} placeholder="Sự hiện diện của bạn là món quà quý giá nhất…" /></Field>
              <BankV2 title="Tài khoản chú rể" bank={cfg.groom_bank} onChange={(b) => patch({ groom_bank: b })} />
              <BankV2 title="Tài khoản cô dâu" bank={cfg.bride_bank} onChange={(b) => patch({ bride_bank: b })} />
            </>
          )}
        </>
      ))}

      {sec("rsvp", MessageCircleHeart, "Xác nhận & lời chúc", [cfg.rsvp_enabled !== false ? "Khách xác nhận được" : "Tắt xác nhận", cfg.guestbook_enabled !== false ? "sổ lưu bút đang hiện" : "ẩn sổ lưu bút"].join(" · "), (
        <>
          <div className="flex flex-col">
            <Switch checked={cfg.rsvp_enabled !== false} onChange={(v) => patch({ rsvp_enabled: v })} label="Cho phép khách xác nhận & gửi lời chúc" />
            <Switch
              checked={cfg.guestbook_enabled !== false}
              onChange={(v) => patch({ guestbook_enabled: v })}
              label="Hiện Sổ lưu bút (lời chúc của khách) trên thiệp"
              desc="Tắt để ẩn lời chúc khỏi thiệp; khách vẫn gửi được. Đã đặt mật khẩu “Trang xem riêng” thì Sổ lưu bút cũng tự ẩn khỏi thiệp công khai."
            />
          </div>
          <Field label="Lời nhắn RSVP" hint="Không bắt buộc"><TextV2 value={cfg.rsvp_note} onChange={(v) => patch({ rsvp_note: v })} placeholder="Vui lòng phản hồi trước ngày…" /></Field>
          <Field label="Link Love Story" hint="Để trống sẽ tự lấy theo hợp đồng nếu có. Nút “Xem Love Story” hiện ở cuối thiệp khi có link.">
            <TextV2 value={cfg.story_url} onChange={(v) => patch({ story_url: v })} placeholder="https://…/story/… hoặc /story/ten-cua-ban" />
          </Field>
        </>
      ))}
    </Stack>
  );

  const previewGuestSelect = (
    <Field label="Xem trước với tên khách" hint="Khung xem trước hiện thiệp như khách này mở link riêng.">
      <select className={inputCls} value={w.previewGuest} onChange={(e) => w.setPreviewGuest(e.target.value)}>
        <option value="">— Không hiện tên khách —</option>
        {[...new Set(guestNames)].map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    </Field>
  );

  const guestsPane = (
    <Stack gap={14}>
      {combo ? (
        <Section icon={Users} title="Khách mời" desc="Danh sách khách dùng chung với Kế hoạch cưới.">
          <div className="flex flex-col gap-4">
            {previewGuestSelect}
            <Callout tone="brand" icon={Users} title="Thêm khách ở Kế hoạch cưới">
              Thêm khách ở tab Khách mời của kế hoạch là có ngay link thiệp + mã QR ghi tên người đó. Khách bấm xác nhận trên thiệp thì trạng thái, số người và số bàn tự cập nhật.
              <div className="mt-2.5">
                <button type="button" onClick={showGuests} className={btn("secondary", "sm")}>
                  <Users size={15} /> {guestNames.length ? `Mở danh sách ${guestNames.length} khách` : "Mở danh sách khách"}
                </button>
              </div>
            </Callout>
          </div>
        </Section>
      ) : (
        <>
          {responsesLocked && <ResponsesLockV2 expected={(cfg.guests_password ?? "").trim()} onUnlock={() => w.setResponsesUnlocked(true)} />}
          <GuestManagerV2
            baseUrl={d.absBase}
            accent={cfg.accent || meta.accent}
            guests={cfg.guests ?? []}
            onChange={(guests) => patch({ guests })}
            rsvps={responsesLocked ? null : w.rsvps}
            onRefresh={w.refreshRsvps}
          />
          {dirty && (
            <Callout tone="amber" icon={AlertCircle} action={<button type="button" onClick={() => void save()} disabled={saving} className={btn("secondary", "sm")}>Lưu ngay</button>}>
              Nhớ bấm <b>Lưu</b> sau khi thêm hoặc bớt khách — link riêng chỉ mở đúng tên khi đã lưu.
            </Callout>
          )}
          <div className="v2-card v2-card-pad">{previewGuestSelect}</div>
        </>
      )}

      <Section
        icon={MessageCircleHeart}
        title={`Phản hồi của khách (${w.rsvps.length})`}
        desc={responsesLocked ? "Đang khoá bằng mật khẩu trang xem riêng." : `${d.attendingCount} khách sẽ tham dự`}
        flush
      >
        {responsesLocked ? (
          combo ? (
            <div className="p-4 sm:p-5"><ResponsesLockV2 expected={(cfg.guests_password ?? "").trim()} onUnlock={() => w.setResponsesUnlocked(true)} /></div>
          ) : (
            <p className="flex items-center gap-2 px-5 py-4 text-[13px]" style={muted}><Lock size={14} /> Nhập mật khẩu ở đầu tab này để xem phản hồi và lời chúc.</p>
          )
        ) : (
          <RsvpListV2 rsvps={w.rsvps} />
        )}
      </Section>

      <Section icon={Lock} title="Trang xem riêng" desc="Đặt mật khẩu để mở trang chỉ đọc gồm danh sách khách phản hồi và toàn bộ lời chúc — chia sẻ cho người thân mà không đưa link chỉnh sửa.">
        <GuestsPasswordV2 value={cfg.guests_password} onChange={(v) => patch({ guests_password: v })} guestsUrl={d.guestsUrl} />
      </Section>
    </Stack>
  );

  const guestCount = combo ? guestNames.length : (cfg.guests ?? []).length;

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={brand}
        sub={couple ? `Thiệp cưới · ${couple}` : "Thiệp cưới của bạn"}
        right={
          <>
            {backBtn}
            <span className="hidden sm:inline-flex"><Badge tone={saveState.tone} dot={!saveState.icon} icon={saveState.icon}>{saveState.label}</Badge></span>
            {menu}
            <span className="hidden lg:inline-flex">{primary()}</span>
          </>
        }
      />

      {/* Điện thoại / máy tính bảng: ba tab dính dưới đầu trang. */}
      <div className="sticky top-[60px] z-20 lg:hidden" style={{ background: "var(--bg)" }}>
        <div className="mx-auto max-w-[1080px] px-4">
          <Tabs<View>
            label="Trình sửa thiệp"
            value={view}
            onChange={setView}
            options={[
              { value: "edit", label: "Sửa", icon: PenLine },
              { value: "preview", label: "Xem trước", icon: Eye },
              { value: "guests", label: "Khách mời", icon: Users, count: guestCount || undefined },
            ]}
          />
        </div>
      </div>

      <main
        className="mx-auto w-full max-w-[1080px] pb-28 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 lg:pb-10 lg:pt-6"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        <div className={`min-w-0 ${view === "preview" ? "hidden lg:block" : ""}`}>
          <div className="mb-4 hidden lg:block">
            <Tabs<"edit" | "guests">
              label="Trình sửa thiệp"
              value={view === "guests" ? "guests" : "edit"}
              onChange={setView}
              options={[
                { value: "edit", label: "Sửa thiệp", icon: PenLine },
                { value: "guests", label: "Khách mời & phản hồi", icon: Users, count: guestCount || undefined },
              ]}
            />
          </div>
          {err && (
            <div className="mb-4">
              <Callout tone="red" icon={AlertCircle} title="Có lỗi" action={<button type="button" onClick={() => w.setErr(null)} className={btn("ghost", "sm")}>Đóng</button>}>{err}</Callout>
            </div>
          )}
          {view === "guests" ? guestsPane : editPane}
        </div>

        {/* MỘT khung xem trước duy nhất: máy tính dính cột phải, điện thoại là
            tab "Xem trước" (không dựng khung thứ hai → không chạy hai iframe). */}
        <aside
          className={`v2-card overflow-hidden lg:sticky lg:top-[84px] lg:block lg:h-[calc(100dvh-108px)] ${view === "preview" ? "block h-[calc(100dvh-206px)] min-h-[420px]" : "hidden"}`}
        >
          <PreviewPaneV2 inv={w.draft} wishes={w.previewWishes} guest={w.previewGuest} storyUrl={cfg.story_url} publicUrl={d.publicUrl} />
        </aside>
      </main>

      {/* Thanh lưu dính đáy (điện thoại / máy tính bảng). */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
        style={{ background: "var(--topbar)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--bd)" }}
      >
        <div
          className="mx-auto flex max-w-[1080px] items-center gap-3 pt-2.5"
          style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))", paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold" style={{ color: saveState.tone === "amber" ? "var(--am)" : saveState.tone === "red" ? "var(--rd)" : saveState.tone === "green" ? "var(--gn)" : "var(--tx2)" }}>
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: "currentColor" }} /> {saveState.label}
            </p>
            <p className="truncate text-[12px]" style={muted}>{needSave ? "Bấm Lưu để khách thấy bản mới" : published ? "Thiệp đang hiển thị cho khách" : "Thiệp đang là bản nháp"}</p>
          </div>
          {primary("flex-none")}
        </div>
      </div>

      {/* Gửi khách mời: link chung, xuất bản, link riêng từng khách */}
      <Drawer
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Gửi thiệp cho khách"
        desc="Link chung gửi cả nhóm; link riêng mở ra thiệp ghi đúng tên người nhận."
      >
        <div className="flex flex-col gap-5">
          {!published && (
            <Callout
              tone="amber"
              icon={EyeOff}
              title="Thiệp đang là bản nháp"
              action={<button type="button" onClick={() => void save(true)} disabled={saving} className={btn("secondary", "sm")}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Xuất bản</button>}
            >
              Khách mở link sẽ chưa thấy thiệp cho tới khi bạn xuất bản.
            </Callout>
          )}
          <Field label="Link chung" hint="Gửi cho cả nhóm, đăng Zalo / Facebook.">
            <div className="flex gap-2">
              <input readOnly value={d.absBase} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1`} aria-label="Link chung" />
              <button type="button" onClick={() => void copyLink()} className={btn("secondary")}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Đã chép" : "Chép"}
              </button>
            </div>
          </Field>
          <a href={d.publicUrl} target="_blank" rel="noopener noreferrer" className={btn("secondary", "md", "self-start")}>
            <ExternalLink size={16} /> Mở thử như khách
          </a>
          <div className="flex flex-col gap-2 rounded-[14px] p-4" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            <p className="text-[14px] font-semibold">Link riêng từng khách</p>
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
              {guestCount > 0
                ? `Đã có ${guestCount} khách — mỗi người một link + mã QR ghi đúng tên.`
                : combo
                  ? "Thêm khách ở tab Khách mời của kế hoạch cưới là có ngay link + mã QR riêng."
                  : "Nhập tên khách là có ngay link + mã QR riêng cho từng người."}
            </p>
            <button type="button" onClick={() => { setShareOpen(false); showGuests(); }} className={btn("soft", "md", "self-start")}>
              <Users size={16} /> {guestCount > 0 ? `Xem ${guestCount} link riêng` : "Tạo link riêng cho từng khách"}
            </button>
          </div>
        </div>
      </Drawer>

      <TemplatePickerV2
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={w.template}
        onChange={w.pickTemplate}
        cover={cfg.cover_url}
        bride={cfg.bride_name || "Cô dâu"}
        groom={cfg.groom_name || "Chú rể"}
      />

      {w.albumOpen && (
        <AlbumPickerV2
          token={token}
          existing={gallery}
          onClose={() => w.setAlbumOpen(false)}
          onAdd={(urls) => { patch({ gallery: [...gallery, ...urls] }); w.setAlbumOpen(false); }}
        />
      )}

      {copied && !shareOpen ? <ToastV2>Đã chép link thiệp — dán gửi khách qua Zalo hoặc Messenger</ToastV2> : null}
    </CustomerRootV2>
  );
}

/* ── Khối gập mở của trình sửa ─────────────────────────────────────────── */
function EdSection({
  id, icon: Icon, title, summary, state, open, onToggle, children,
}: {
  id: SectionId;
  icon: LucideIcon;
  title: string;
  summary: React.ReactNode;
  state: "todo" | "done" | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`muc-${id}`} className="v2-card scroll-mt-[124px] overflow-hidden lg:scroll-mt-[84px]">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <span className="v2-section-icon"><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block truncate text-[12.5px]" style={muted}>{summary}</span>
        </span>
        {state === "todo" ? (
          <Badge tone="amber" dot>Còn thiếu</Badge>
        ) : state === "done" ? (
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }} title="Đã đủ">
            <Check size={14} strokeWidth={3} />
          </span>
        ) : null}
        <ChevronDown size={18} className="flex-none transition-transform" style={{ color: "var(--tx3)", transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 px-4 pb-5 pt-4 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Tiêu đề nhỏ chia nhóm ô trong một khối. */
function SubHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="-mb-1 pt-1">
      <p className="text-[13.5px] font-semibold">{title}</p>
      {hint ? <p className="mt-0.5 text-[12.5px]" style={muted}>{hint}</p> : null}
    </div>
  );
}

/** Ô viền nhẹ gom các trường của một người (cô dâu / chú rể). */
function SubBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[14px] p-3.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
      <p className="text-[13.5px] font-semibold" style={{ color: "var(--ac)" }}>{title}</p>
      {children}
    </div>
  );
}
