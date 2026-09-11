"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Lock, Music, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { BANKS } from "@/lib/banks";
import type { WeddingBank, WeddingEventBlock } from "@/lib/types";

// Các ô nhập dùng chung cho trình chỉnh sửa thiệp cưới. Tách khỏi WeddingEditor
// để phần khung (2 cột: form ↔ xem trước) đọc được trong một màn hình.

export const inp = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

export function Card({ title, icon, hint, children }: { title: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-medium text-stone-700">{icon} {title}</h2>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-rose-600" />
      {label}
    </label>
  );
}

export function ImageUpload({ current, onUpload, onChange }: { current?: string; onUpload: (f: File) => Promise<string | null>; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {current && <img src={current} alt="" className="h-16 w-16 rounded-lg object-cover" />}
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

export function GalleryEditor({ gallery, onUpload, onChange }: { gallery: string[]; onUpload: (f: File) => Promise<string | null>; onChange: (g: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= gallery.length) return;
    const next = [...gallery];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {gallery.map((url, i) => (
          <div key={`${url}-${i}`} className="group relative">
            <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-medium text-white">{i + 1}</span>
            <button type="button" aria-label="Xoá ảnh" onClick={() => onChange(gallery.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100">
              <Trash2 size={12} />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
              <button type="button" aria-label="Chuyển lên trước" onClick={() => move(i, -1)} className="rounded bg-black/60 px-1.5 text-xs text-white">←</button>
              <button type="button" aria-label="Chuyển ra sau" onClick={() => move(i, 1)} className="rounded bg-black/60 px-1.5 text-xs text-white">→</button>
            </div>
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

export function EventsEditor({ events, onChange }: { events: WeddingEventBlock[]; onChange: (e: WeddingEventBlock[]) => void }) {
  const up = (i: number, p: Partial<WeddingEventBlock>) => onChange(events.map((e, j) => (j === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={i} className="rounded-lg border border-stone-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <input className={`${inp} max-w-[60%]`} value={e.label ?? ""} onChange={(ev) => up(i, { label: ev.target.value })} placeholder="Lễ Vu Quy / Tiệc cưới…" />
            <button type="button" aria-label="Xoá sự kiện" onClick={() => onChange(events.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-500"><Trash2 size={16} /></button>
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

export function BankEditor({ title, bank, onChange }: { title: string; bank?: WeddingBank; onChange: (b: WeddingBank) => void }) {
  const b = bank ?? {};
  const up = (p: Partial<WeddingBank>) => onChange({ ...b, ...p });
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <p className="mb-2 text-xs font-medium text-stone-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={inp}
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
export function ResponsesLock({ expected, onUnlock }: { expected: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = () => (entry.trim() === expected ? onUnlock() : setWrong(true));
  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
      <Lock size={18} className="mx-auto mb-2 text-stone-400" />
      <p className="mx-auto max-w-xs text-sm" style={{ color: "#6a6459" }}>Danh sách phản hồi &amp; lời chúc đang được bảo vệ. Nhập mật khẩu để xem.</p>
      <div className="mx-auto mt-3 flex max-w-xs gap-2">
        <input
          type="password" value={entry} autoComplete="off" aria-label="Mật khẩu xem phản hồi"
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
export function GuestsPasswordField({ value, onChange, guestsUrl }: { value?: string; onChange: (v?: string) => void; guestsUrl: string }) {
  const [initial] = useState((value ?? "").trim());
  const [locked, setLocked] = useState(!!(value ?? "").trim());
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);

  if (locked) {
    return (
      <div>
        <p className="mb-2 text-sm" style={{ color: "#6a6459" }}>Đã đặt mật khẩu. Nhập đúng mật khẩu hiện tại để sửa hoặc xoá.</p>
        <div className="flex gap-2">
          <input
            type="password" value={entry} autoComplete="off" aria-label="Mật khẩu hiện tại"
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

export function AudioUpload({ onUpload, onChange, currentUrl }: { onUpload: (f: File) => Promise<{ url?: string; error?: string }>; onChange: (url: string | null) => void; currentUrl?: string }) {
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

type AlbumPhoto = { id: string; name: string; url: string; thumb: string };

/** Modal: pick photos from the couple's own album (linked to the contract). */
export function AlbumPicker({ token, existing, onClose, onAdd }: { token: string; existing: string[]; onClose: () => void; onAdd: (urls: string[]) => void }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <p className="font-medium">Chọn ảnh từ album cưới của bạn</p>
          <button onClick={onClose} aria-label="Đóng" className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
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
