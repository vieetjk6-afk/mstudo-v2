"use client";

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, ExternalLink, FolderOpen, ImagePlus, Loader2, Lock, MapPin, Music,
  Plus, Trash2, Upload,
} from "lucide-react";
import { Callout, Empty, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Modal } from "@/components/v2/kit-client";
import { BANKS } from "@/lib/banks";
import { fmtDate } from "@/lib/date";
import { isMusicPageLink, parseYoutubeMusic } from "@/lib/youtube-music";
import type { WeddingBank, WeddingEventBlock, WeddingTimelineItem } from "@/lib/types";
import {
  TIMELINE_PRESET, useAlbumPhotos, useAudioPick, useGalleryPick, useImagePick, useMapLink, usePasswordField, useStableKeys,
  useUnlock, type ResolveMap, type UploadAudio, type UploadImage,
} from "./hooks";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô NHẬP của trình sửa thiệp — GIAO DIỆN MỚI. Cùng logic với ./ui.tsx (bản cũ,
   logic chung ở ./hooks), vẽ bằng bộ khối V2: Field, inputCls, nút btn().
   ═══════════════════════════════════════════════════════════════════════════ */

const muted: React.CSSProperties = { color: "var(--tx3)" };

/** Ô nhập chữ nối thẳng một trường — đỡ lặp `className` / `onChange`. */
export function TextV2({
  value, onChange, placeholder, area = false, rows, type, ariaLabel,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  area?: boolean;
  rows?: number;
  type?: string;
  ariaLabel?: string;
}) {
  return area ? (
    <textarea className={inputCls} rows={rows ?? 3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
  ) : (
    <input type={type} className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
  );
}

/* ── Một ảnh ─────────────────────────────────────────────────────────────── */
export function ImageV2({
  current, onUpload, onChange, hint, square = true,
}: {
  current?: string;
  onUpload: UploadImage;
  onChange: (url: string | null) => void;
  hint?: React.ReactNode;
  /** false = khung ngang (ảnh bìa, ảnh bản đồ). */
  square?: boolean;
}) {
  const { ref, busy, pick, onInput } = useImagePick(onUpload, onChange);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label={current ? "Đổi ảnh" : "Tải ảnh"}
        className={`relative flex flex-none items-center justify-center overflow-hidden rounded-[12px] ${square ? "h-[72px] w-[72px]" : "h-[72px] w-[108px]"}`}
        style={current ? { background: "var(--sf2)", border: "1px solid var(--bd)" } : { background: "var(--sf2)", border: "1.5px dashed var(--bd)", color: "var(--tx3)" }}
      >
        {current ? <img src={current} alt="" className="h-full w-full object-cover" /> : busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={20} />}
        {current && busy ? (
          <span className="absolute inset-0 flex items-center justify-center text-white" style={{ background: "rgba(0,0,0,.4)" }}>
            <Loader2 size={18} className="animate-spin" />
          </span>
        ) : null}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={onInput} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={pick} disabled={busy} className={btn("secondary", "sm")}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {current ? "Đổi ảnh" : "Tải ảnh lên"}
          </button>
          {current ? (
            <button type="button" onClick={() => onChange(null)} className={iconBtn()} aria-label="Xoá ảnh" title="Xoá ảnh" style={{ color: "var(--rd)" }}>
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
        {hint ? <p className="text-[12px]" style={muted}>{hint}</p> : null}
      </div>
    </div>
  );
}

/* ── Album ảnh ───────────────────────────────────────────────────────────── */
export function GalleryV2({
  gallery, onUpload, onChange, onOpenAlbum,
}: {
  gallery: string[];
  onUpload: UploadImage;
  onChange: (g: string[]) => void;
  /** Lấy ảnh từ album cưới (studio đã giao) — không có thì ẩn nút. */
  onOpenAlbum?: () => void;
}) {
  const { ref, busy, pick, onInput, move, remove } = useGalleryPick(gallery, onUpload, onChange);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={pick} disabled={busy} className={btn("secondary", "sm")}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Tải ảnh từ máy
        </button>
        {onOpenAlbum ? (
          <button type="button" onClick={onOpenAlbum} className={btn("soft", "sm")}>
            <FolderOpen size={15} /> Lấy từ album cưới
          </button>
        ) : null}
        <span className="text-[12.5px]" style={muted}>{gallery.length ? `${gallery.length} ảnh` : "Chưa có ảnh"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4">
        {gallery.map((url, i) => (
          <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-[10px]" style={{ background: "var(--sf2)" }}>
            <img src={url} alt="" className="block h-full w-full object-cover" />
            <span className="absolute left-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 text-[11px] font-bold text-white" style={{ background: "rgba(20,18,15,.72)" }}>
              {i + 1}
            </span>
            <button
              type="button"
              aria-label={`Xoá ảnh ${i + 1}`}
              title="Xoá ảnh"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[7px] text-white"
              style={{ background: "rgba(20,18,15,.72)" }}
            >
              <Trash2 size={12} />
            </button>
            {/* Đổi chỗ: luôn hiện (điện thoại không có hover). */}
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button type="button" aria-label="Chuyển lên trước" title="Chuyển lên trước" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-6 w-6 items-center justify-center rounded-[7px] text-white disabled:opacity-0" style={{ background: "rgba(20,18,15,.72)" }}>
                <ArrowLeft size={12} />
              </button>
              <button type="button" aria-label="Chuyển ra sau" title="Chuyển ra sau" disabled={i === gallery.length - 1} onClick={() => move(i, 1)} className="flex h-6 w-6 items-center justify-center rounded-[7px] text-white disabled:opacity-0" style={{ background: "rgba(20,18,15,.72)" }}>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          aria-label="Thêm ảnh"
          onClick={pick}
          disabled={busy}
          className="flex aspect-square items-center justify-center rounded-[10px]"
          style={{ border: "1.5px dashed var(--bd)", color: "var(--tx3)", background: "var(--sf2)" }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={onInput} />
    </div>
  );
}

/* ── Link bản đồ ─────────────────────────────────────────────────────────── */
export function MapLinkV2({ value, onChange, resolve, placeholder }: { value: string; onChange: (v: string) => void; resolve: ResolveMap; placeholder?: string }) {
  const m = useMapLink(value, onChange, resolve);
  const n = m.note;
  return (
    <>
      <input className={inputCls} value={value} onChange={(e) => m.onInput(e.target.value)} onBlur={m.onBlur} placeholder={placeholder} aria-label="Link Google Maps" />
      {n ? (
        <p className="text-[12px]" style={{ color: n.kind === "error" ? "var(--am)" : n.kind === "pinned" ? "var(--gn)" : "var(--tx3)" }}>
          {n.kind === "busy" && (
            <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Đang lấy vị trí từ link…</span>
          )}
          {n.kind === "error" && n.text}
          {n.kind === "short" && (
            <>
              Link rút gọn —{" "}
              <button type="button" onClick={() => void m.lookup(n.link)} className="font-semibold underline" style={{ color: "var(--ac)" }}>lấy vị trí</button>{" "}
              để bản đồ ghim đúng chỗ.
            </>
          )}
          {n.kind === "pinned" && (
            <span className="inline-flex items-center gap-1"><Check size={13} /> Bản đồ ghim đúng vị trí theo link này.</span>
          )}
          {n.kind === "text" && "Đây là địa chỉ chữ, bản đồ có thể lệch — dán link từ nút Chia sẻ của Google Maps để ghim đúng chỗ."}
        </p>
      ) : null}
    </>
  );
}

/* ── Sự kiện cưới: danh sách + sửa trong ngăn kéo ────────────────────────── */
export function EventsV2({ events, onChange, resolveMap }: { events: WeddingEventBlock[]; onChange: (e: WeddingEventBlock[]) => void; resolveMap: ResolveMap }) {
  const { keys, add, remove } = useStableKeys(events.length, "ev");
  const [editing, setEditing] = useState<number | null>(null);
  const up = (i: number, p: Partial<WeddingEventBlock>) => onChange(events.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const addEvent = () => { add(); onChange([...events, { label: "" }]); setEditing(events.length); };
  const delEvent = (i: number) => { remove(i); onChange(events.filter((_, j) => j !== i)); setEditing(null); };
  const cur = editing != null ? events[editing] : null;

  return (
    <div className="flex flex-col gap-2">
      {events.length > 0 ? (
        <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
          {events.map((e, i) => {
            const when = [e.date ? fmtDate(e.date) : "", e.time].filter(Boolean).join(" · ");
            return (
              <button
                key={keys[i] ?? `ev-init-${i}`}
                type="button"
                onClick={() => setEditing(i)}
                className="v2-row v2-row-link w-full text-left"
                style={{ padding: "10px 14px" }}
              >
                <span className="v2-section-icon" style={{ width: 34, height: 34 }}><CalendarDays size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="v2-row-title block">{e.label || <span style={muted}>Sự kiện chưa đặt tên</span>}</span>
                  <span className="v2-row-sub block">{[when || "Chưa có ngày giờ", e.venue].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight size={16} className="flex-none" style={muted} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[12.5px]" style={muted}>Chưa có sự kiện nào.</p>
      )}
      <div>
        <button type="button" onClick={addEvent} className={btn("secondary", "sm")}>
          <Plus size={15} /> Thêm sự kiện
        </button>
      </div>

      <Drawer
        open={cur != null}
        onClose={() => setEditing(null)}
        title={cur?.label || "Sự kiện mới"}
        desc="Vu quy · Tân hôn · Tiệc cưới… Thiệp hiện theo đúng thứ tự bạn thêm."
        footer={
          <>
            <button type="button" onClick={() => editing != null && delEvent(editing)} className={btn("danger", "md", "mr-auto")}>
              <Trash2 size={16} /> Xoá sự kiện
            </button>
            <button type="button" onClick={() => setEditing(null)} className={btn("primary")}>
              <Check size={16} /> Xong
            </button>
          </>
        }
      >
        {cur && editing != null ? (
          <div className="flex flex-col gap-4">
            <Field label="Tên sự kiện">
              <TextV2 value={cur.label} onChange={(v) => up(editing, { label: v })} placeholder="Lễ Vu Quy / Tiệc cưới…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày">
                <input type="date" className={inputCls} value={(cur.date ?? "").slice(0, 10)} onChange={(ev) => up(editing, { date: ev.target.value })} />
              </Field>
              <Field label="Giờ">
                <TextV2 value={cur.time} onChange={(v) => up(editing, { time: v })} placeholder="VD 11:00" />
              </Field>
            </div>
            <Field label="Tên địa điểm">
              <TextV2 value={cur.venue} onChange={(v) => up(editing, { venue: v })} placeholder="Tư gia nhà gái / Nhà hàng…" />
            </Field>
            <Field label="Địa chỉ">
              <TextV2 value={cur.address} onChange={(v) => up(editing, { address: v })} placeholder="Số nhà, đường, phường, thành phố" />
            </Field>
            <Field label="Link Google Maps (không bắt buộc)">
              <MapLinkV2 value={cur.map_url ?? ""} onChange={(v) => up(editing, { map_url: v })} resolve={resolveMap} placeholder="Dán link từ nút Chia sẻ của Google Maps" />
            </Field>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

/* ── Lịch trình buổi tiệc ────────────────────────────────────────────────── */
export function TimelineV2({ items, onChange }: { items: WeddingTimelineItem[]; onChange: (t: WeddingTimelineItem[]) => void }) {
  const up = (i: number, p: Partial<WeddingTimelineItem>) => onChange(items.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={`${inputCls} !w-[86px] flex-none`} value={t.time ?? ""} onChange={(e) => up(i, { time: e.target.value })} placeholder="17:30" aria-label="Giờ" />
          <input className={`${inputCls} min-w-0 flex-1`} value={t.label ?? ""} onChange={(e) => up(i, { label: e.target.value })} placeholder="Đón khách" aria-label="Việc" />
          <button type="button" aria-label="Xoá mốc" title="Xoá mốc" onClick={() => onChange(items.filter((_, j) => j !== i))} className={iconBtn()}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...items, { time: "", label: "" }])} className={btn("secondary", "sm")}>
          <Plus size={15} /> Thêm mốc
        </button>
        {items.length === 0 && (
          <button type="button" onClick={() => onChange(TIMELINE_PRESET)} className={btn("ghost", "sm")}>
            Điền mẫu gợi ý
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Tài khoản mừng cưới ─────────────────────────────────────────────────── */
export function BankV2({ title, bank, onChange }: { title: string; bank?: WeddingBank; onChange: (b: WeddingBank) => void }) {
  const b = bank ?? {};
  const up = (p: Partial<WeddingBank>) => onChange({ ...b, ...p });
  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] p-3.5" style={{ border: "1px solid var(--bd)", background: "var(--sf2)" }}>
      <p className="text-[13px] font-semibold">{title}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <select
          className={inputCls}
          aria-label={`Ngân hàng — ${title}`}
          value={b.bin ?? ""}
          onChange={(e) => {
            const sel = BANKS.find((x) => x.bin === e.target.value);
            up({ bin: e.target.value || undefined, name: sel?.name });
          }}
        >
          <option value="">— Chọn ngân hàng —</option>
          {BANKS.map((x) => <option key={x.bin} value={x.bin}>{x.name}</option>)}
        </select>
        <input className={inputCls} value={b.account ?? ""} onChange={(e) => up({ account: e.target.value })} placeholder="Số tài khoản" aria-label={`Số tài khoản — ${title}`} />
      </div>
      <input className={inputCls} value={b.holder ?? ""} onChange={(e) => up({ holder: e.target.value })} placeholder="Tên chủ tài khoản" aria-label={`Tên chủ tài khoản — ${title}`} />
    </div>
  );
}

/* ── Khoá phản hồi bằng mật khẩu ─────────────────────────────────────────── */
export function ResponsesLockV2({ expected, onUnlock }: { expected: string; onUnlock: () => void }) {
  const { entry, change, wrong, submit } = useUnlock(expected, onUnlock);
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] px-4 py-6 text-center" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
      <span className="v2-section-icon"><Lock size={17} /></span>
      <p className="max-w-[34ch] text-[13.5px]" style={{ color: "var(--tx2)" }}>Danh sách phản hồi &amp; lời chúc đang được bảo vệ. Nhập mật khẩu để xem.</p>
      <div className="flex w-full max-w-[320px] gap-2">
        <input
          type="password" value={entry} autoComplete="off" aria-label="Mật khẩu xem phản hồi"
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Mật khẩu" className={`${inputCls} min-w-0 flex-1`}
        />
        <button type="button" onClick={submit} className={btn("secondary")}>Xem</button>
      </div>
      {wrong && <p className="text-[12.5px]" style={{ color: "var(--rd)" }}>Mật khẩu chưa đúng.</p>}
    </div>
  );
}

/* ── Mật khẩu trang xem riêng ────────────────────────────────────────────── */
export function GuestsPasswordV2({ value, onChange, guestsUrl }: { value?: string; onChange: (v?: string) => void; guestsUrl: string }) {
  const { locked, entry, change, wrong, submit } = usePasswordField(value);

  if (locked) {
    return (
      <Field label="Mật khẩu hiện tại" hint={wrong ? undefined : "Đã đặt mật khẩu. Nhập đúng mật khẩu hiện tại để sửa hoặc xoá."} error={wrong ? "Mật khẩu hiện tại chưa đúng." : undefined}>
        <div className="flex gap-2">
          <input
            type="password" value={entry} autoComplete="off" aria-label="Mật khẩu hiện tại"
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="Mật khẩu hiện tại" className={`${inputCls} min-w-0 flex-1`}
          />
          <button type="button" onClick={submit} className={btn("secondary")}>
            <Lock size={15} /> Mở khoá để sửa
          </button>
        </div>
      </Field>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Mật khẩu mở trang xem riêng" hint="Để trống = tắt trang này.">
        <input className={inputCls} value={value ?? ""} autoComplete="off" onChange={(e) => onChange(e.target.value || undefined)} placeholder="VD: 20122025" />
      </Field>
      {(value ?? "").trim() && (
        <Callout tone="blue" title="Link trang xem riêng (nhớ bấm Lưu trước khi chia sẻ)">
          <a href={guestsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-medium underline" style={{ color: "var(--ac)" }}>
            {guestsUrl} <ExternalLink size={12} className="flex-none" />
          </a>
        </Callout>
      )}
    </div>
  );
}

/* ── Nhạc nền: tải file + nghe thử ───────────────────────────────────────── */
export function AudioV2({ onUpload, onChange, currentUrl }: { onUpload: UploadAudio; onChange: (url: string | null) => void; currentUrl?: string }) {
  const { ref, busy, localErr, pick, onInput, clear } = useAudioPick(onUpload, onChange);
  const yt = parseYoutubeMusic(currentUrl);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac" hidden onChange={onInput} />
        <button type="button" onClick={pick} disabled={busy} className={btn("secondary", "sm")}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Music size={15} />} {busy ? "Đang tải nhạc…" : "Tải file nhạc (≤10MB)"}
        </button>
        {currentUrl ? (
          <button type="button" onClick={clear} className={btn("ghost", "sm")} style={{ color: "var(--rd)" }}>
            <Trash2 size={15} /> Bỏ nhạc
          </button>
        ) : null}
      </div>
      {/* Phản hồi NGAY tại đây để không phải cuộn lên đầu trang mới thấy. */}
      {localErr && <Callout tone="red">{localErr}</Callout>}
      {currentUrl && !localErr && (yt ? (
        <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: "var(--gnS)" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>Đã nhận link YouTube — nghe thử:</p>
          <iframe
            src={`https://www.youtube.com/embed/${yt.id}?start=${yt.start}&rel=0&playsinline=1`}
            title="Nghe thử nhạc nền"
            allow="autoplay; encrypted-media"
            className="aspect-video w-full rounded-[8px]"
          />
          <p className="text-[12px]" style={{ color: "var(--tx2)" }}>Khung trên báo “Video không xem được” / “chủ sở hữu đã tắt phát trên trang web khác” thì thiệp cũng không phát được — chọn bản khác (lyric, cover, audio).</p>
        </div>
      ) : isMusicPageLink(currentUrl) ? (
        <Callout tone="amber">Link này là trang nghe nhạc chứ không phải file nhạc nên thiệp không phát được. Hãy dán link YouTube hoặc tải file mp3 lên.</Callout>
      ) : (
        <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: "var(--gnS)" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>Đã có nhạc nền — nghe thử:</p>
          <audio src={currentUrl} controls preload="none" className="w-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Chọn ảnh từ album cưới (hộp thoại) ──────────────────────────────────── */
export function AlbumPickerV2({ token, existing, onClose, onAdd }: { token: string; existing: string[]; onClose: () => void; onAdd: (urls: string[]) => void }) {
  const { photos, sel, have, toggle } = useAlbumPhotos(token, existing);
  return (
    <Modal
      open
      onClose={onClose}
      title="Chọn ảnh từ album cưới của bạn"
      desc="Bấm để chọn nhiều ảnh, ảnh đã có trong thiệp bị làm mờ."
      icon={FolderOpen}
      width={760}
      footer={
        <>
          <span className="mr-auto self-center text-[13px]" style={muted}>{sel.size} ảnh đã chọn</span>
          <button type="button" onClick={onClose} className={btn("secondary")}>Huỷ</button>
          <button type="button" onClick={() => onAdd(Array.from(sel))} disabled={sel.size === 0} className={btn("primary")}>
            <Plus size={16} /> Thêm vào thiệp
          </button>
        </>
      }
    >
      {photos === null ? (
        <div className="flex justify-center py-14" style={muted}><Loader2 className="animate-spin" /></div>
      ) : photos.length === 0 ? (
        <Empty compact icon={FolderOpen} title="Chưa có album ảnh nào" hint="Chưa có album ảnh nào được liên kết với hợp đồng của bạn." />
      ) : (
        <div className="grid max-h-[56vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
          {photos.map((p) => {
            const added = have.has(p.url);
            const picked = sel.has(p.url);
            return (
              <button
                key={p.id}
                type="button"
                disabled={added}
                onClick={() => toggle(p.url)}
                aria-pressed={picked}
                className="relative aspect-square overflow-hidden rounded-[10px] disabled:opacity-40"
                style={{ boxShadow: picked ? "0 0 0 2px var(--ac)" : undefined, background: "var(--sf2)" }}
              >
                <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                {(picked || added) && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--ac)" }}>
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Nhãn nhỏ "đã có / còn thiếu" ở đầu mỗi khối. */
export function MapPinNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px]" style={muted}>
      <MapPin size={13} className="mt-[1px] flex-none" /> {children}
    </p>
  );
}
