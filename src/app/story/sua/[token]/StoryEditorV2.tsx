"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, CalendarDays, Check, ChevronDown, ChevronRight, Cloud, CloudOff, Copy, Download, Eye, EyeOff, ExternalLink,
  FolderOpen, Heart, ImageIcon, Loader2, Milestone, Palette, PenLine, Plus, Printer, QrCode, RefreshCw, Save, Share2, Trash2,
  Users, Video, type LucideIcon,
} from "lucide-react";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Badge, Callout, Empty, Field, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Switch, Tabs } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import type { StoryPage } from "@/lib/types";
import { ToastV2 } from "@/app/dashboard/studio/thiep/CreativeV2Parts";
import StoryRenderer, { type StoryPhoto } from "../../[slug]/StoryRenderer";
import { DevicePreviewV2 } from "../../../thiep/sua/[token]/editor/PreviewPaneV2";
import { storyUrl, useStoryEditor } from "./useStoryEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   TRÌNH SỬA LOVE STORY — giao diện mới (/story/sua/<token> khi customerUiV2
   bật). Cùng dữ liệu, cùng thao tác với StoryEditorV1 (logic chung ở
   ./useStoryEditor); khác ở cách sắp xếp:
     • Đầu trang thương hiệu studio + trạng thái lưu + MỘT nút chính: "Lưu" khi
       còn thay đổi, xong rồi thì "Chia sẻ" (ngăn kéo: link, mã QR tải / in).
     • Máy tính: cột trái các KHỐI gập mở (Cặp đôi · Dòng thời gian · Ảnh từ
       Drive · Khách gửi ảnh · Sự kiện & lời chúc); cột phải khung điện thoại
       xem trước trực tiếp bằng chính trang Love Story thật. Mốc thời gian sửa
       trong ngăn kéo.
     • Điện thoại: hai tab Sửa · Xem trước, thanh lưu dính đáy.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "edit" | "preview";
type SectionId = "couple" | "timeline" | "drive" | "guests" | "event";

/** Slug giả cho khung xem trước: lời chúc / ảnh khách gửi từ khung này không
 *  bao giờ rơi vào trang thật (API trả "không tìm thấy"). */
const PREVIEW_SLUG = "__xem-truoc__";
const muted: React.CSSProperties = { color: "var(--tx3)" };

export type StoryEditorSection = SectionId;

export default function StoryEditorV2({
  token, brand, initialView = "edit", initialSection = "couple",
}: {
  token: string;
  brand: StudioBrandInfo;
  /** Tab / khối mở sẵn (màn xem trước dùng; trang thật để mặc định). */
  initialView?: View;
  initialSection?: SectionId | null;
}) {
  const s = useStoryEditor(token);
  const { cfg, patch, save, saving, saved, dirty, published, err } = s;
  const { theme } = useTheme();
  const [view, setView] = useState<View>(initialView);
  const [open, setOpen] = useState<SectionId | null>(initialSection);
  const [editing, setEditing] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errClosed, setErrClosed] = useState<string | null>(null);

  // Khung xem trước dựng chính trang Love Story — trang đó hỏi tên khách ở lần
  // mở đầu; điền sẵn một tên cho slug xem trước để hộp hỏi tên không che khung.
  useEffect(() => {
    try { localStorage.setItem(`story_guest_${PREVIEW_SLUG}`, "Khách xem thử"); } catch { /* ignore */ }
  }, []);

  // Có link folder Drive → đọc ảnh một lần để khung xem trước có ảnh thật.
  const ready = s.status === "ready";
  const folder = cfg?.drive_folder;
  const { photos, loadingPhotos, loadPhotos } = s;
  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    if (!ready || autoLoaded || !folder || photos !== null || loadingPhotos) return;
    setAutoLoaded(true);
    void loadPhotos();
  }, [ready, autoLoaded, folder, photos, loadingPhotos, loadPhotos]);

  if (s.status === "loading" || s.status === "notfound" || !cfg) {
    return (
      <CustomerRootV2 theme={theme}>
        <CustomerHeaderV2 brand={brand} sub="Love Story của bạn" />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          {s.status === "loading" ? (
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--ac)" }} />
          ) : (
            <div className="v2-card w-full max-w-[440px]">
              <Empty icon={Heart} title="Không tìm thấy trang Love Story này" hint="Link có thể đã hết hạn. Nhắn studio để nhận link sửa mới." />
            </div>
          )}
        </div>
      </CustomerRootV2>
    );
  }

  const publicUrl = storyUrl(`/story/${s.slug}`);
  const couple = [cfg.groom_name, cfg.bride_name].filter(Boolean).join(" & ");
  const timeline = s.timeline;
  const cur = editing != null ? timeline[editing] ?? null : null;
  const showErr = err && err !== errClosed ? err : null;

  const focusSection = (id: SectionId) => {
    setView("edit");
    setOpen(id);
    setTimeout(() => {
      const el = document.getElementById(`muc-${id}`);
      if (el && el.getBoundingClientRect().top < 120) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };
  const toggle = (id: SectionId) => (open === id ? setOpen(null) : focusSection(id));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* trình duyệt chặn clipboard */ }
  }

  const saveState: { label: string; tone: "amber" | "green" | "gray" | "red"; icon?: LucideIcon } = saving
    ? { label: "Đang lưu…", tone: "gray" }
    : showErr
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
        <Share2 size={16} /> Chia sẻ
      </button>
    );

  const menu = (
    <Menu
      label="Thêm thao tác với trang Love Story"
      width={250}
      items={[
        { label: "Mở trang thật", hint: "Như khách thấy (bản đã lưu)", icon: ExternalLink, href: publicUrl, external: true },
        { label: copied ? "Đã chép link" : "Chép link trang", icon: copied ? Check : Copy, onClick: () => void copyLink() },
        { label: "Mã QR chia sẻ", hint: "Tải ảnh hoặc in", icon: QrCode, onClick: () => setShareOpen(true) },
        "divider",
        published
          ? { label: "Ẩn trang", hint: "Khách mở link sẽ không thấy", icon: EyeOff, onClick: () => void save(false), disabled: saving }
          : { label: "Xuất bản", hint: "Lưu và cho khách mở được", icon: Eye, onClick: () => void save(true), disabled: saving },
      ]}
    />
  );

  const addMilestone = () => { s.addTl(); setEditing(timeline.length); };

  const sec = (id: SectionId, icon: LucideIcon, title: string, summary: React.ReactNode, body: React.ReactNode) => (
    <EdSection key={id} id={id} icon={icon} title={title} summary={summary} open={open === id} onToggle={() => toggle(id)}>
      {body}
    </EdSection>
  );

  // Ảnh cho khung xem trước: ảnh Drive đã đọc + ảnh khách gửi đã duyệt (như trang thật).
  const previewPhotos: StoryPhoto[] = (photos ?? []).map((p) => ({ id: p.id, url: p.url, thumb: p.thumb }));
  const previewGuestPhotos: StoryPhoto[] = s.uploads.filter((u) => u.approved).map((u) => ({
    id: u.drive_file_id, url: `/api/img?id=${u.drive_file_id}&w=1080`, thumb: `/api/img?id=${u.drive_file_id}&w=400`, isVideo: u.is_video, guestName: u.guest_name || undefined,
  }));
  const draft: StoryPage = {
    id: "preview", owner_id: "", contract_id: null, slug: PREVIEW_SLUG, edit_token: "", config: cfg, published, created_at: "", updated_at: "",
  };

  const editPane = (
    <Stack gap={14}>
      <div className="v2-card v2-card-pad flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={published ? "green" : "gray"} dot>{published ? "Đang hiển thị" : "Bản nháp"}</Badge>
          <p className="order-3 min-w-0 basis-full text-[13.5px] sm:order-none sm:flex-[1_1_200px] sm:basis-auto" style={{ color: "var(--tx2)" }}>
            {published ? "Khách mở link là thấy trang (bản đã lưu)." : "Khách chưa mở được trang — xuất bản khi đã sẵn sàng."}
          </p>
          <button type="button" onClick={() => void save(!published)} disabled={saving} className={btn(published ? "ghost" : "secondary", "sm", "ml-auto")}>
            {published ? <><EyeOff size={15} /> Ẩn trang</> : <><Eye size={15} /> Xuất bản</>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Link trang Love Story" className={`${inputCls} min-w-0 flex-1 !text-[13px]`} style={{ background: "var(--sf2)" }} />
          <button type="button" onClick={() => void copyLink()} className={iconBtn()} aria-label="Chép link" title="Chép link" style={copied ? { color: "var(--gn)" } : undefined}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button type="button" onClick={() => setShareOpen(true)} className={iconBtn()} aria-label="Mã QR chia sẻ" title="Mã QR chia sẻ">
            <QrCode size={16} />
          </button>
        </div>
      </div>

      {s.driveMsg && <Callout tone="blue" icon={Cloud}>{s.driveMsg}</Callout>}

      {sec("couple", Heart, "Cặp đôi & lời giới thiệu", couple || "Chưa điền tên hai bạn", (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên chú rể"><input className={inputCls} value={cfg.groom_name ?? ""} onChange={(e) => patch({ groom_name: e.target.value })} /></Field>
            <Field label="Tên cô dâu"><input className={inputCls} value={cfg.bride_name ?? ""} onChange={(e) => patch({ bride_name: e.target.value })} /></Field>
          </div>
          <Field label="Ảnh đại diện" hint="Dán đường link ảnh (URL).">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx3)" }}>
                {cfg.cover_url ? <img src={cfg.cover_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} />}
              </span>
              <input className={`${inputCls} min-w-0 flex-1`} value={cfg.cover_url ?? ""} onChange={(e) => patch({ cover_url: e.target.value || undefined })} placeholder="https://…" aria-label="Link ảnh đại diện" />
            </div>
          </Field>
          <Field label="Câu mở đầu"><input className={inputCls} value={cfg.tagline ?? ""} onChange={(e) => patch({ tagline: e.target.value })} placeholder="Chuyện tình của chúng mình 💕" /></Field>
          <Field label="Nội dung chia sẻ"><textarea className={inputCls} rows={5} value={cfg.story ?? ""} onChange={(e) => patch({ story: e.target.value })} /></Field>
        </>
      ))}

      {sec("timeline", Milestone, "Dòng thời gian", timeline.length ? `${timeline.length} mốc · ${timeline.map((t) => t.title).filter(Boolean).slice(0, 2).join(", ") || "chưa đặt tên"}` : "Chưa có mốc nào", (
        <>
          {timeline.length > 0 ? (
            <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              {timeline.map((t, i) => (
                <button
                  key={s.tlKeys[i] ?? `tl-init-${i}`}
                  type="button"
                  onClick={() => setEditing(i)}
                  className="v2-row v2-row-link w-full text-left"
                  style={{ padding: "10px 14px" }}
                >
                  <span className="flex w-[52px] flex-none flex-col items-center rounded-[10px] py-1" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    <span className="text-[10.5px] font-semibold uppercase">{t.date ? `Th${Number(t.date.slice(5, 7)) || ""}` : "Mốc"}</span>
                    <span className="v2-num text-[13px] font-bold">{t.date ? t.date.slice(0, 4) : i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="v2-row-title block">{t.title || <span style={muted}>Mốc chưa đặt tên</span>}</span>
                    <span className="v2-row-sub block">{[t.date ? fmtDate(t.date) : null, t.text].filter(Boolean).join(" · ") || "Bấm để thêm ngày và nội dung"}</span>
                  </span>
                  <ChevronRight size={16} className="flex-none" style={muted} />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px]" style={muted}>Những cột mốc của hai bạn: lần đầu gặp nhau, lời tỏ tình, ngày cầu hôn…</p>
          )}
          <div>
            <button type="button" onClick={addMilestone} className={btn("secondary", "sm")}><Plus size={15} /> Thêm mốc</button>
          </div>
        </>
      ))}

      {sec("drive", FolderOpen, "Ảnh & video từ Google Drive", cfg.drive_folder ? (photos ? `${photos.length} ảnh từ Drive` : "Đã có link folder") : "Chưa có link folder Drive", (
        <>
          <p className="text-[12.5px]" style={muted}>Dán link folder Google Drive (đặt chia sẻ “Bất kỳ ai có đường liên kết”). Ảnh/video sẽ tự hiển thị — bạn giữ toàn quyền trên Drive của mình.</p>
          <Field label="Link folder Drive">
            <input className={inputCls} value={cfg.drive_folder ?? ""} onChange={(e) => patch({ drive_folder: e.target.value || undefined })} placeholder="https://drive.google.com/drive/folders/…" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void loadPhotos()} disabled={loadingPhotos || !cfg.drive_folder} className={btn("secondary", "sm")}>
              {loadingPhotos ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Xem trước ảnh từ Drive
            </button>
            {photos && <span className="text-[12.5px]" style={muted}>{photos.length} ảnh</span>}
          </div>
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {photos.slice(0, 18).map((p) => (
                <img key={p.id} src={p.thumb} alt="" className="aspect-square w-full rounded-[8px] object-cover" loading="lazy" style={{ background: "var(--sf2)" }} />
              ))}
            </div>
          )}
          {photos && photos.length === 0 && (
            <Callout tone="amber" icon={FolderOpen}>Chưa đọc được ảnh — kiểm tra link folder đã chia sẻ công khai chưa.</Callout>
          )}
          <Field label="Link video (YouTube hoặc Drive)" hint="Không bắt buộc">
            <input className={inputCls} value={cfg.video_url ?? ""} onChange={(e) => patch({ video_url: e.target.value || undefined })} placeholder="https://youtube.com/…" />
          </Field>
        </>
      ))}

      {sec("guests", Users, "Khách gửi ảnh & video", s.driveConnected ? `Đã nối Drive · ${cfg.guest_upload ? "đang cho khách gửi" : "chưa bật"}${s.uploads.length ? ` · ${s.uploads.length} tệp` : ""}` : "Chưa nối Google Drive", (
        <>
          <p className="text-[12.5px]" style={muted}>
            Kết nối Google Drive của bạn để khách mời chụp / tải ảnh &amp; video ngay trên trang. File lưu vào thư mục
            <b> “mstudo · Story khách gửi”</b> trong Drive của bạn — bạn toàn quyền quản lý.
          </p>
          {s.driveConnected ? (
            <Callout
              tone="green"
              icon={Cloud}
              title="Đã kết nối Google Drive"
              action={<button type="button" onClick={() => void s.disconnectDrive()} className={btn("ghost", "sm")}><CloudOff size={15} /> Ngắt kết nối</button>}
            />
          ) : (
            <a href={`/api/story/drive/connect?token=${token}`} className={btn("secondary", "md", "self-start")}>
              <Cloud size={16} /> Nối Google Drive của bạn
            </a>
          )}
          <Switch
            checked={cfg.guest_upload === true}
            onChange={(v) => patch({ guest_upload: v })}
            disabled={!s.driveConnected}
            label="Cho phép khách gửi ảnh & video trên trang story"
            desc={s.driveConnected ? undefined : "Cần kết nối Google Drive trước khi bật tính năng này."}
          />
          {s.uploads.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold">Khách đã gửi ({s.uploads.length}) <span className="font-normal" style={muted}>· bấm thùng rác để gỡ khỏi trang</span></p>
              <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-5">
                {s.uploads.map((u) => (
                  <div key={u.id} className="flex min-w-0 flex-col gap-1">
                    <div className="relative aspect-square overflow-hidden rounded-[10px]" style={{ background: "var(--sf2)" }}>
                      {u.is_video ? (
                        <div className="flex h-full w-full items-center justify-center" style={muted}><Video size={20} /></div>
                      ) : (
                        <img src={`/api/img?id=${u.drive_file_id}&w=300`} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                      <button
                        type="button"
                        onClick={() => void s.deleteUpload(u.id)}
                        aria-label={`Gỡ ${u.is_video ? "video" : "ảnh"} của ${u.guest_name || "khách"}`}
                        title="Gỡ khỏi trang"
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[7px] text-white"
                        style={{ background: "rgba(20,18,15,.72)" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <span className="truncate text-[11.5px]" style={muted}>{u.guest_name || "Khách"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ))}

      {sec("event", CalendarDays, "Sự kiện & lời chúc", [cfg.event_label, cfg.event_date ? fmtDate(cfg.event_date) : null, cfg.wishes_enabled !== false ? "nhận lời chúc" : "tắt lời chúc"].filter(Boolean).join(" · "), (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tên sự kiện"><input className={inputCls} value={cfg.event_label ?? ""} onChange={(e) => patch({ event_label: e.target.value })} placeholder="Lễ Thành Hôn" /></Field>
            <Field label="Ngày"><input type="date" className={inputCls} value={(cfg.event_date ?? "").slice(0, 10)} onChange={(e) => patch({ event_date: e.target.value })} /></Field>
            <Field label="Địa điểm"><input className={inputCls} value={cfg.event_venue ?? ""} onChange={(e) => patch({ event_venue: e.target.value })} /></Field>
          </div>
          <Switch checked={cfg.wishes_enabled !== false} onChange={(v) => patch({ wishes_enabled: v })} label="Cho khách gửi lời chúc" />
          <Field label="Màu nhấn">
            <label className="flex h-[var(--v2-h)] w-fit cursor-pointer items-center gap-2 rounded-[var(--v2-r)] px-2.5" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
              <Palette size={15} style={muted} />
              <input type="color" aria-label="Màu nhấn" className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0" value={cfg.accent || "#d0687a"} onChange={(e) => patch({ accent: e.target.value })} />
              <span className="v2-num text-[12.5px]" style={{ color: "var(--tx2)" }}>{cfg.accent || "#d0687a"}</span>
            </label>
          </Field>
        </>
      ))}
    </Stack>
  );

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={brand}
        sub={couple ? `Love Story · ${couple}` : "Love Story của bạn"}
        right={
          <>
            <span className="hidden sm:inline-flex"><Badge tone={saveState.tone} dot={!saveState.icon} icon={saveState.icon}>{saveState.label}</Badge></span>
            {menu}
            <span className="hidden lg:inline-flex">{primary()}</span>
          </>
        }
      />

      <div className="sticky top-[60px] z-20 lg:hidden" style={{ background: "var(--bg)" }}>
        <div className="mx-auto max-w-[1080px] px-4">
          <Tabs<View>
            label="Trình sửa Love Story"
            value={view}
            onChange={setView}
            options={[
              { value: "edit", label: "Sửa", icon: PenLine },
              { value: "preview", label: "Xem trước", icon: Eye },
            ]}
          />
        </div>
      </div>

      <main
        className="mx-auto w-full max-w-[1080px] pb-28 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 lg:pb-10 lg:pt-6"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        <div className={`min-w-0 ${view === "preview" ? "hidden lg:block" : ""}`}>
          {showErr && (
            <div className="mb-4">
              <Callout tone="red" icon={AlertCircle} title="Có lỗi" action={<button type="button" onClick={() => setErrClosed(showErr)} className={btn("ghost", "sm")}>Đóng</button>}>{showErr}</Callout>
            </div>
          )}
          {editPane}
        </div>

        <aside className={`v2-card overflow-hidden lg:sticky lg:top-[84px] lg:block lg:h-[calc(100dvh-108px)] ${view === "preview" ? "block h-[calc(100dvh-206px)] min-h-[420px]" : "hidden"}`}>
          <DevicePreviewV2 openUrl={publicUrl} openLabel="Mở trang Love Story thật ở tab mới">
            {(nonce) => (
              <StoryRenderer
                key={nonce}
                story={draft}
                photos={previewPhotos}
                guestPhotos={previewGuestPhotos}
                wishes={[]}
                guestUploadEnabled={cfg.guest_upload === true}
              />
            )}
          </DevicePreviewV2>
        </aside>
      </main>

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
            <p className="truncate text-[12px]" style={muted}>{needSave ? "Bấm Lưu để khách thấy bản mới" : published ? "Trang đang hiển thị cho khách" : "Trang đang là bản nháp"}</p>
          </div>
          {primary("flex-none")}
        </div>
      </div>

      {/* Sửa một mốc thời gian */}
      <Drawer
        open={cur != null}
        onClose={() => setEditing(null)}
        title={cur?.title || "Mốc mới"}
        desc="Một cột mốc trên dòng thời gian của hai bạn."
        footer={
          <>
            <button type="button" onClick={() => { if (editing != null) { s.delTl(editing); setEditing(null); } }} className={btn("danger", "md", "mr-auto")}>
              <Trash2 size={16} /> Xoá mốc
            </button>
            <button type="button" onClick={() => setEditing(null)} className={btn("primary")}><Check size={16} /> Xong</button>
          </>
        }
      >
        {cur && editing != null ? (
          <div className="flex flex-col gap-4">
            <Field label="Ngày">
              <input type="date" className={inputCls} value={(cur.date ?? "").slice(0, 10)} onChange={(e) => s.upTl(editing, { date: e.target.value })} />
            </Field>
            <Field label="Tiêu đề">
              <input className={inputCls} value={cur.title ?? ""} onChange={(e) => s.upTl(editing, { title: e.target.value })} placeholder="VD: Lần đầu gặp nhau" />
            </Field>
            <Field label="Nội dung">
              <textarea className={inputCls} rows={5} value={cur.text ?? ""} onChange={(e) => s.upTl(editing, { text: e.target.value })} placeholder="Kể lại khoảnh khắc ấy…" />
            </Field>
          </div>
        ) : null}
      </Drawer>

      {/* Chia sẻ: link + mã QR */}
      <Drawer open={shareOpen} onClose={() => setShareOpen(false)} title="Chia sẻ Love Story" desc="Gửi link cho bạn bè, hoặc in mã QR đặt ở bàn đón khách để khách quét xem & gửi ảnh.">
        <div className="flex flex-col gap-5">
          {!published && (
            <Callout
              tone="amber"
              icon={EyeOff}
              title="Trang đang là bản nháp"
              action={<button type="button" onClick={() => void save(true)} disabled={saving} className={btn("secondary", "sm")}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Xuất bản</button>}
            >
              Khách mở link sẽ chưa thấy trang cho tới khi bạn xuất bản.
            </Callout>
          )}
          <Field label="Link trang">
            <div className="flex gap-2">
              <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1`} aria-label="Link trang" />
              <button type="button" onClick={() => void copyLink()} className={btn("secondary")}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Đã chép" : "Chép"}
              </button>
            </div>
          </Field>
          <a href={publicUrl} target="_blank" rel="noreferrer" className={btn("secondary", "md", "self-start")}>
            <ExternalLink size={16} /> Mở trang thật
          </a>
          <div className="flex flex-col items-center gap-3 rounded-[14px] p-4 text-center" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            <p className="self-start text-[14px] font-semibold">Mã QR chia sẻ</p>
            {s.qrImg ? (
              <>
                <img src={s.qrImg} alt="Mã QR trang Love Story" className="h-52 w-52 rounded-[12px] p-2" style={{ background: "#fff", border: "1px solid var(--bd)" }} />
                <p className="break-all text-[11.5px]" style={muted}>{publicUrl}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a href={s.qrImg} download={`qr-lovestory-${s.slug}.png`} className={btn("secondary", "sm")}><Download size={15} /> Tải ảnh</a>
                  <button type="button" onClick={s.printQr} className={btn("secondary", "sm")}><Printer size={15} /> In mã QR</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12.5px]" style={muted}>In ra để khách quét xem trang &amp; gửi ảnh.</p>
                <button type="button" onClick={() => void s.genQr()} disabled={s.qrBusy} className={btn("soft")}>
                  {s.qrBusy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />} Tạo mã QR
                </button>
              </>
            )}
          </div>
        </div>
      </Drawer>

      {copied && !shareOpen ? <ToastV2>Đã chép link Love Story</ToastV2> : null}
    </CustomerRootV2>
  );
}

function EdSection({
  id, icon: Icon, title, summary, open, onToggle, children,
}: {
  id: SectionId;
  icon: LucideIcon;
  title: string;
  summary: React.ReactNode;
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
