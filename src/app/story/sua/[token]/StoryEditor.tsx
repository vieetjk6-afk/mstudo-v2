"use client";

import { Heart, Save, Eye, Loader2, Check, ExternalLink, Plus, Trash2, FolderOpen, RefreshCw, Cloud, CloudOff, Video, Users, QrCode, Printer, Download } from "lucide-react";
import { storyUrl, useStoryEditor } from "./useStoryEditor";

/* Trình sửa Love Story /story/sua/<token>. Logic ở ./useStoryEditor — bản cũ
   dưới đây (StoryEditorV1) và bản giao diện mới (./StoryEditorV2) dùng chung;
   page.tsx chọn bản theo customerUiV2. */

export default function StoryEditor({ token }: { token: string }) {
  return <StoryEditorV1 token={token} />;
}

function StoryEditorV1({ token }: { token: string }) {
  const {
    cfg, slug, published, status, saving, saved, err, photos, loadingPhotos, uploads, driveConnected, driveMsg,
    qrImg, qrBusy, tlKeys, timeline, patch, save, loadPhotos, disconnectDrive, deleteUpload, genQr, printQr, upTl, addTl, delTl,
  } = useStoryEditor(token);

  if (status === "loading") return <div className="grid min-h-screen place-items-center text-stone-400"><Loader2 className="animate-spin" /></div>;
  if (status === "notfound" || !cfg) return <div className="grid min-h-screen place-items-center px-6 text-center text-stone-600"><p>Không tìm thấy trang Love Story này.</p></div>;

  const publicUrl = storyUrl(`/story/${slug}`);
  const inp = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-800">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-rose-700"><Heart size={18} /> Love Story của bạn</div>
          <div className="flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"><Eye size={14} /> Xem</a>
            <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />} {saved ? "Đã lưu" : "Lưu"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">{published ? "Đang hiển thị công khai" : "Đang ở chế độ nháp"}</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-600 underline">{publicUrl} <ExternalLink size={12} /></a>
          </div>
          <button onClick={() => save(!published)} disabled={saving} className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${published ? "border border-stone-300" : "bg-rose-600 text-white"}`}>
            {published ? "Ẩn trang" : "Xuất bản"}
          </button>
        </div>

        {/* Mã QR để chia sẻ & in */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-medium text-stone-700"><QrCode size={16} /> Mã QR chia sẻ</p>
              <p className="text-xs text-stone-500">In ra để khách quét xem trang &amp; gửi ảnh.</p>
            </div>
            {!qrImg && (
              <button onClick={genQr} disabled={qrBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">
                {qrBusy ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Tạo mã QR
              </button>
            )}
          </div>
          {qrImg && (
            <div className="mt-4 flex flex-col items-center">
              <img src={qrImg} alt="Mã QR" className="h-52 w-52 rounded-lg border border-stone-200" />
              <p className="mt-2 break-all text-center text-[11px] text-stone-400">{publicUrl}</p>
              <div className="mt-3 flex gap-2">
                <a href={qrImg} download={`qr-lovestory-${slug}.png`} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-xs hover:bg-stone-100"><Download size={13} /> Tải ảnh</a>
                <button onClick={printQr} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white"><Printer size={13} /> In mã QR</button>
              </div>
            </div>
          )}
        </div>

        <Section title="Thông tin cặp đôi">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên chú rể"><input className={inp} value={cfg.groom_name ?? ""} onChange={(e) => patch({ groom_name: e.target.value })} /></Field>
            <Field label="Tên cô dâu"><input className={inp} value={cfg.bride_name ?? ""} onChange={(e) => patch({ bride_name: e.target.value })} /></Field>
          </div>
          <Field label="Ảnh đại diện (URL)"><input className={inp} value={cfg.cover_url ?? ""} onChange={(e) => patch({ cover_url: e.target.value || undefined })} placeholder="https://…" /></Field>
          <Field label="Câu mở đầu"><input className={inp} value={cfg.tagline ?? ""} onChange={(e) => patch({ tagline: e.target.value })} placeholder="Chuyện tình của chúng mình 💕" /></Field>
          <Field label="Nội dung chia sẻ"><textarea className={`${inp} min-h-[110px]`} value={cfg.story ?? ""} onChange={(e) => patch({ story: e.target.value })} /></Field>
        </Section>

        <Section title="Ảnh & video từ Google Drive của bạn">
          <p className="text-xs text-stone-500">Dán link folder Google Drive (đặt chia sẻ “Bất kỳ ai có đường liên kết”). Ảnh/video sẽ tự hiển thị — bạn giữ toàn quyền trên Drive của mình.</p>
          <Field label="Link folder Drive"><input className={inp} value={cfg.drive_folder ?? ""} onChange={(e) => patch({ drive_folder: e.target.value || undefined })} placeholder="https://drive.google.com/drive/folders/…" /></Field>
          <div className="flex items-center gap-2">
            <button onClick={loadPhotos} disabled={loadingPhotos || !cfg.drive_folder} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">
              {loadingPhotos ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Xem trước ảnh từ Drive
            </button>
            {photos && <span className="text-xs text-stone-500">{photos.length} ảnh</span>}
          </div>
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {photos.slice(0, 18).map((p) => (
                <img key={p.id} src={p.thumb} alt="" className="aspect-square w-full rounded object-cover" loading="lazy" />
              ))}
            </div>
          )}
          {photos && photos.length === 0 && <p className="text-xs text-stone-400"><FolderOpen size={12} className="inline" /> Chưa đọc được ảnh — kiểm tra link folder đã chia sẻ công khai chưa.</p>}
          <Field label="Link video (YouTube hoặc Drive) — không bắt buộc"><input className={inp} value={cfg.video_url ?? ""} onChange={(e) => patch({ video_url: e.target.value || undefined })} placeholder="https://youtube.com/…" /></Field>
        </Section>

        <Section title="Cho khách gửi ảnh / story (lưu vào Drive của bạn)">
          <p className="text-xs text-stone-500">
            Kết nối Google Drive của bạn để khách mời có thể chụp/tải ảnh &amp; video ngay trên trang. File sẽ được lưu vào một thư mục
            <b> “mstudo · Story khách gửi”</b> trong Drive của bạn — bạn toàn quyền quản lý.
          </p>
          {driveMsg && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{driveMsg}</p>}

          {driveConnected ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Cloud size={16} /> Đã kết nối Google Drive
              <button onClick={disconnectDrive} className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"><CloudOff size={12} /> Ngắt kết nối</button>
            </div>
          ) : (
            <a href={`/api/story/drive/connect?token=${token}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-300 hover:bg-stone-50">
              <Cloud size={16} /> Nối Google Drive của bạn
            </a>
          )}

          <label className={`flex items-center gap-2 text-sm ${!driveConnected ? "opacity-50" : ""}`}>
            <input type="checkbox" className="h-4 w-4 accent-rose-600" disabled={!driveConnected} checked={cfg.guest_upload === true} onChange={(e) => patch({ guest_upload: e.target.checked })} />
            <Users size={15} /> Cho phép khách gửi ảnh &amp; video trên trang story
          </label>
          {!driveConnected && <p className="text-xs text-stone-400">Cần kết nối Google Drive trước khi bật tính năng này.</p>}

          {uploads.length > 0 && (
            <div className="pt-1">
              <p className="mb-2 text-xs font-medium text-stone-500">Khách đã gửi ({uploads.length}) — nhấn để gỡ khỏi trang</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {uploads.map((u) => (
                  <div key={u.id} className="group relative aspect-square overflow-hidden rounded bg-stone-100">
                    {u.is_video ? (
                      <div className="grid h-full w-full place-items-center text-stone-400"><Video size={20} /></div>
                    ) : (
                      <img src={`/api/img?id=${u.drive_file_id}&w=300`} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                    <button onClick={() => deleteUpload(u.id)} title={u.guest_name || "Gỡ"} className="absolute right-0.5 top-0.5 rounded bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Dòng thời gian (timeline)">
          <div className="space-y-3">
            {timeline.map((t, i) => (
              <div key={tlKeys[i] ?? `tl-init-${i}`} className="rounded-lg border border-stone-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <input type="date" className={`${inp} max-w-[45%]`} value={(t.date ?? "").slice(0, 10)} onChange={(e) => upTl(i, { date: e.target.value })} />
                  <button onClick={() => delTl(i)} className="text-stone-400 hover:text-red-500" aria-label="Xoá mốc thời gian" title="Xoá mốc thời gian"><Trash2 size={16} /></button>
                </div>
                <input className={`${inp} mb-2`} value={t.title ?? ""} onChange={(e) => upTl(i, { title: e.target.value })} placeholder="Tiêu đề (vd: Lần đầu gặp nhau)" />
                <textarea className={inp} value={t.text ?? ""} onChange={(e) => upTl(i, { text: e.target.value })} placeholder="Nội dung" rows={2} />
              </div>
            ))}
            <button onClick={addTl} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500"><Plus size={14} /> Thêm mốc</button>
          </div>
        </Section>

        <Section title="Sự kiện & lời chúc">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tên sự kiện"><input className={inp} value={cfg.event_label ?? ""} onChange={(e) => patch({ event_label: e.target.value })} placeholder="Lễ Thành Hôn" /></Field>
            <Field label="Ngày"><input type="date" className={inp} value={(cfg.event_date ?? "").slice(0, 10)} onChange={(e) => patch({ event_date: e.target.value })} /></Field>
            <Field label="Địa điểm"><input className={inp} value={cfg.event_venue ?? ""} onChange={(e) => patch({ event_venue: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-rose-600" checked={cfg.wishes_enabled !== false} onChange={(e) => patch({ wishes_enabled: e.target.checked })} /> Cho khách gửi lời chúc</label>
          <Field label="Màu nhấn"><input type="color" className="h-9 w-16 rounded border border-stone-300" value={cfg.accent || "#d0687a"} onChange={(e) => patch({ accent: e.target.value })} /></Field>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-stone-200 bg-white p-4"><h2 className="mb-3 font-medium text-stone-700">{title}</h2><div className="space-y-3">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>{children}</label>;
}
