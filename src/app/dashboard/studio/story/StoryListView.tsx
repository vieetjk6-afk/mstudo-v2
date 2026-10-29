"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Heart, ExternalLink, Pencil, Copy, Check, Users, FileText, Plus, Loader2, QrCode, Printer, X } from "lucide-react";
import ThiepTabs from "@/components/studio/ThiepTabs";
import { studioUrl } from "@/lib/hosts";
import { storyEditMessage } from "@/lib/share-messages";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useStoryList, type StoryListProps } from "./useStoryList";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const StoryListV2 = dynamic(() => import("./StoryListV2"));

export type { StoryRow } from "./useStoryList";

/** Bản mới khi bật giao diện mới — đổi KIỂU component, không rẽ nhánh sau hook. */
export default function StoryListView(props: StoryListProps) {
  return useUiV2() ? <StoryListV2 {...props} /> : <StoryListV1 {...props} />;
}

function StoryListV1({ rows, ownerId, studioHost }: StoryListProps) {
  const { copied, creating, err, qr, setQr, copy, createNew, openQr, printQr } = useStoryList({ ownerId, studioHost });

  return (
    <div>
      <ThiepTabs />
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Heart style={{ color: "#d0687a" }} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-medium">Trang Love Story</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Trang chia sẻ khoảnh khắc (ảnh/video từ Google Drive của khách) + sổ lời chúc.</p>
        </div>
        <button onClick={createNew} disabled={creating} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tạo Love Story mới
        </button>
      </header>
      {err && <p className="mb-4 rounded-lg bg-[var(--rdS)] px-3 py-2 text-sm text-[var(--rd)]">{err}</p>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Heart className="mx-auto mb-3" style={{ color: "var(--text3)" }} />
          <p className="text-sm" style={{ color: "var(--text2)" }}>Chưa có trang nào. Bấm <b>“Tạo Love Story mới”</b> để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = studioUrl(studioHost, `/story/sua/${r.edit_token}`);
            const viewUrl = studioUrl(studioHost, `/story/${r.slug}`);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{couple}</p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      <span style={{ color: r.published ? "var(--s-green)" : "var(--text3)" }}>{r.published ? "Đang hiển thị" : "Nháp"}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rdS)] px-3 py-1 text-sm text-[var(--rd)]"><Users size={13} /> {r.wish_count} lời chúc</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <a href={viewUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><ExternalLink size={13} /> Xem</a>
                  <a href={editUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><Pencil size={13} /> Mở trình sửa</a>
                  <button onClick={() => copy(storyEditMessage(editUrl), `e-${r.id}`)} className="btn-ghost px-2.5 py-1.5 text-xs">{copied === `e-${r.id}` ? <Check size={13} /> : <Copy size={13} />} {copied === `e-${r.id}` ? "Đã chép lời nhắn" : "Chép link sửa kèm lời nhắn"}</button>
                  <button onClick={() => openQr(couple, viewUrl)} className="btn-ghost px-2.5 py-1.5 text-xs"><QrCode size={13} /> Mã QR / In</button>
                  {r.contract_id && <Link href={`/dashboard/studio/contracts/${r.contract_id}`} className="btn-ghost px-2.5 py-1.5 text-xs"><FileText size={13} /> Hợp đồng</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-subtle bg-surface p-6 text-center text-fg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-medium">{qr.couple}</p><button onClick={() => setQr(null)} aria-label="Đóng" className="text-accent-faint hover:text-fg"><X size={18} /></button></div>
            {/* Ảnh QR có nền trắng nướng sẵn — giữ khung trắng để quét được ở chế độ tối. */}
            <img src={qr.img} alt="QR" className="mx-auto my-3 h-56 w-56 rounded bg-white" />
            <p className="mb-4 break-all text-[11px] text-accent-faint">{qr.url}</p>
            <div className="flex justify-center gap-2">
              <a href={qr.img} download={`qr-${qr.couple}.png`} className="btn-ghost px-3 py-2 text-xs">Tải ảnh</a>
              <button onClick={printQr} className="btn-primary px-3 py-2 text-xs"><Printer size={14} /> In mã QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
