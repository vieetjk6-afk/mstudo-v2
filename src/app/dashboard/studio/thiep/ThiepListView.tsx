"use client";

import Link from "next/link";
import { Heart, ExternalLink, Pencil, Copy, Check, Download, FileSpreadsheet, Users, FileText, Plus, Loader2, QrCode, Printer, X } from "lucide-react";
import ThiepTabs from "@/components/studio/ThiepTabs";
import { thiepUrl } from "@/lib/hosts";
import { weddingEditMessage } from "@/lib/share-messages";
import { getTemplateMeta } from "../../../thiep/[slug]/templates";
import { useUiV2 } from "@/components/v2/UiV2Context";
import ThiepListV2 from "./ThiepListV2";
import { useThiepList, type ThiepListProps } from "./useThiepList";

export type { InvitationRow } from "./useThiepList";

/** Bản mới khi bật giao diện mới — đổi KIỂU component, không rẽ nhánh sau hook. */
export default function ThiepListView(props: ThiepListProps) {
  return useUiV2() ? <ThiepListV2 {...props} /> : <ThiepListV1 {...props} />;
}

function ThiepListV1({ rows, ownerId, studio }: ThiepListProps) {
  const { copied, exporting, creating, err, qr, setQr, openQr, printQr, createNew, copy, exportGuests } = useThiepList({ ownerId, studio });

  return (
    <div>
      <ThiepTabs />
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Heart style={{ color: "#d96e8f" }} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-medium">Thiệp cưới online</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Quản lý thiệp cưới tặng khách & danh sách khách mời (RSVP).</p>
        </div>
        <button onClick={createNew} disabled={creating} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tạo thiệp cưới mới
        </button>
      </header>

      {err && <p className="mb-4 rounded-lg bg-[var(--rdS)] px-3 py-2 text-sm text-[var(--rd)]">{err}</p>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Heart className="mx-auto mb-3" style={{ color: "var(--text3)" }} />
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            Chưa có thiệp cưới nào. Bấm <b>“Tạo thiệp cưới mới”</b> ở trên, hoặc mở một hợp đồng rồi bấm “🎁 Tạo thiệp cưới tặng khách”.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = thiepUrl(`/sua/${r.edit_token}`);
            const viewUrl = thiepUrl(`/${r.slug}`);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{couple}</p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      Mẫu: {getTemplateMeta(r.template).label} ·{" "}
                      <span style={{ color: r.published ? "var(--s-green)" : "var(--text3)" }}>{r.published ? "Đang hiển thị" : "Nháp"}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rdS)] px-3 py-1 text-sm text-[var(--rd)]">
                    <Users size={13} /> {r.rsvp_count} RSVP
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <a href={viewUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><ExternalLink size={13} /> Xem</a>
                  <a href={editUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><Pencil size={13} /> Mở trình sửa</a>
                  <button onClick={() => copy(weddingEditMessage(editUrl), `edit-${r.id}`)} className="btn-ghost px-2.5 py-1.5 text-xs">
                    {copied === `edit-${r.id}` ? <Check size={13} /> : <Copy size={13} />} {copied === `edit-${r.id}` ? "Đã chép lời nhắn" : "Chép link sửa kèm lời nhắn"}
                  </button>
                  <button onClick={() => openQr(couple, viewUrl)} className="btn-ghost px-2.5 py-1.5 text-xs">
                    <QrCode size={13} /> Mã QR / In
                  </button>
                  <button onClick={() => exportGuests(r, "xlsx")} disabled={exporting === r.id} className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50">
                    <FileSpreadsheet size={13} /> {exporting === r.id ? "Đang xuất…" : "Xuất DS khách (Excel)"}
                  </button>
                  <button onClick={() => exportGuests(r, "csv")} disabled={exporting === r.id} className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50" title="Bản CSV cho công cụ khác">
                    <Download size={13} /> CSV
                  </button>
                  {r.contract_id && (
                    <Link href={`/dashboard/studio/contracts/${r.contract_id}`} className="btn-ghost px-2.5 py-1.5 text-xs"><FileText size={13} /> Hợp đồng</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-subtle bg-surface p-6 text-center text-fg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{qr.couple}</p>
              <button onClick={() => setQr(null)} aria-label="Đóng" className="text-accent-faint hover:text-fg"><X size={18} /></button>
            </div>
            {/* Ảnh QR có nền trắng nướng sẵn — giữ khung trắng để quét được ở chế độ tối. */}
            <img src={qr.img} alt="QR" className="mx-auto my-3 h-56 w-56 rounded bg-white" />
            <p className="mb-4 break-all text-[11px] text-accent-faint">{qr.url}</p>
            <div className="flex justify-center gap-2">
              <a href={qr.img} download={`qr-${qr.couple}.png`} className="btn-ghost px-3 py-2 text-xs"><Download size={14} /> Tải ảnh</a>
              <button onClick={printQr} className="btn-primary px-3 py-2 text-xs"><Printer size={14} /> In mã QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
