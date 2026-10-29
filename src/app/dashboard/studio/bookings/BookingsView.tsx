"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import {
  Link as LinkIcon, Copy, Check, Phone, FilePlus, Archive, MessageCircle,
  CheckCircle, XCircle, Pencil, Trash2, X, Save, ExternalLink, Landmark,
} from "lucide-react";
import { DEPOSIT_STATUS_LABEL } from "@/lib/booking-deposit";
import { Panel, EmptyState } from "@/components/studio/ui";
import { messengerUrl } from "@/components/MessengerButton";
import { vnd } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/date";
import DateInput from "@/components/DateInput";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useBookings, editStateOf, type BookingsProps } from "./useBookings";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const BookingsV2 = dynamic(() => import("./BookingsV2"));

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  new:      { label: "Mới",     color: "var(--s-blue)", bg: "var(--s-blueS)" },
  accepted: { label: "Đã nhận", color: "var(--s-green)", bg: "var(--s-greenS)" },
  pending:  { label: "Chờ",     color: "var(--s-amber)", bg: "var(--s-amberS)" },
  declined: { label: "Từ chối", color: "var(--s-red)", bg: "var(--s-redS)" },
  handled:  { label: "Đã xử lý",color: "var(--s-green)", bg: "var(--s-greenS)" },
  archived: { label: "Lưu trữ", color: "var(--text3)", bg: "var(--surface2)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: "var(--text3)", bg: "var(--surface2)" };
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
        color: s.color, background: s.bg, whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function BookingsView(props: BookingsProps) {
  return useUiV2() ? <BookingsV2 {...props} /> : <BookingsViewV1 {...props} />;
}

function BookingsViewV1(props: BookingsProps) {
  const {
    list, copied, copyLink, busy, bookingUrl, editState, setEditState, editBusy, filterStatus, setFilterStatus,
    updateStatus, confirmDeposit, deleteBooking, saveEdit, toContract, filtered, counts,
  } = useBookings(props);
  const { tokenSaved = true } = props;

  // Đóng modal sửa bằng phím Esc.
  useEffect(() => {
    if (!editState) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditState(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editState, setEditState]);

  return (
    <div className="page-in">

      {/* Share link */}
      {/* Điện thoại: nhãn + link một hàng, hai nút xuống hàng dưới. Để cùng
          hàng thì nhãn dài bị ép vỡ năm dòng cạnh hai nút. */}
      <div className="card mb-5 flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <LinkIcon size={16} className="hidden sm:block" style={{ color: "var(--text3)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--text3)" }}>
            Link đặt lịch — chia sẻ cho khách / gắn lên Facebook
          </p>
          <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{bookingUrl}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copyLink}
            className="btn-ghost px-3 py-2 text-xs gap-1.5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
          </button>
          <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs gap-1.5">
            <ExternalLink size={13} /> Xem form
          </a>
        </div>
      </div>

      {!tokenSaved && (
        <div className="mb-4 rounded-xl p-4" style={{ border: "1px solid var(--s-red)", background: "var(--s-redS)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--s-red)" }}>Không lưu được mã đặt lịch.</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text2)" }}>
            Kiểm tra biến <code>SUPABASE_SERVICE_ROLE_KEY</code> trên Vercel và cột <code>booking_token</code> trong bảng <code>profiles</code>.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      {list.length > 0 && (
        <div role="tablist" aria-label="Lọc yêu cầu đặt lịch" className="mb-3.5 flex flex-wrap gap-[3px] self-start rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)", width: "fit-content" }}>
          {[
            { key: "all", label: "Tất cả", count: list.length },
            { key: "new", label: "Mới", count: counts.new ?? 0 },
            { key: "accepted", label: "Đã nhận", count: counts.accepted ?? 0 },
            { key: "declined", label: "Từ chối", count: counts.declined ?? 0 },
            { key: "handled", label: "Đã xử lý", count: counts.handled ?? 0 },
            { key: "archived", label: "Lưu trữ", count: counts.archived ?? 0 },
          ].map((f) => {
            const on = filterStatus === f.key;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={on}
                onClick={() => setFilterStatus(f.key)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
                style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
              >
                {f.label}
                {f.count > 0 && <span className="text-[11px] font-bold opacity-75">{f.count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Booking list */}
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={MessageCircle}
            title={list.length === 0 ? "Chưa có yêu cầu đặt lịch nào" : "Không có yêu cầu nào ở nhóm này"}
            hint={list.length === 0 ? "Chia sẻ link đặt lịch ở trên để khách gửi yêu cầu thẳng vào đây." : "Chuyển sang nhóm khác hoặc bỏ bộ lọc."}
          />
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="card p-4 transition-colors"
              style={{ borderLeft: b.status === "new" ? "3px solid var(--am)" : b.status === "accepted" ? "3px solid var(--gn)" : b.status === "declined" ? "3px solid var(--rd)" : undefined }}
            >
              {/* Trên điện thoại XẾP DỌC: trước đây hàng nút (shrink-0) giữ chỗ
                  cứng nên cột thông tin bị bóp còn non nửa màn — tên khách vỡ
                  hai dòng, dòng cọc vỡ giữa mã, mà bên phải thì trống trơn. */}
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-[15px]">{b.name}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--text3)" }}>
                    <span className="flex items-center gap-1"><Phone size={11} /> {b.phone}</span>
                    {b.service && <span>Dịch vụ: {b.service}</span>}
                    {b.preferred_date && <span>Ngày: {fmtDate(b.preferred_date)}</span>}
                  </div>
                  {b.package_name && (
                    <p className="mt-1 text-xs" style={{ color: "var(--brand, var(--accent))" }}>
                      Gói: {b.package_name}{b.package_price ? ` · ${vnd(b.package_price)}` : ""}
                    </p>
                  )}
                  {b.facebook && (
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text3)" }}>
                      FB: <a href={messengerUrl(b.facebook)} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--text2)" }}>{b.facebook}</a>
                    </p>
                  )}
                  {b.note && <p className="mt-1.5 text-sm rounded-lg px-3 py-2" style={{ background: "var(--surface2)", color: "var(--text2)" }}>{b.note}</p>}

                  {/* Cọc giữ ngày. "Khách báo đã chuyển" KHÁC "đã nhận" — ảnh
                      chụp chuyển khoản làm giả được, nên studio phải tự đối
                      chiếu sao kê rồi bấm xác nhận. */}
                  {b.deposit_status && b.deposit_status !== "none" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <Landmark size={13} style={{ color: "var(--text3)" }} />
                      <span className="text-xs">
                        Cọc {b.deposit_amount ? vnd(b.deposit_amount) : ""}
                        {b.deposit_code ? ` · ${b.deposit_code}` : ""}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: b.deposit_status === "confirmed" ? "var(--s-greenS)" : b.deposit_status === "paid" ? "var(--s-blueS)" : "var(--s-amberS)",
                          color: b.deposit_status === "confirmed" ? "var(--s-green)" : b.deposit_status === "paid" ? "var(--s-blue)" : "var(--s-amber)",
                        }}
                      >
                        {DEPOSIT_STATUS_LABEL[b.deposit_status]}
                      </span>
                      {b.deposit_proof_url && (
                        <a href={b.deposit_proof_url} target="_blank" rel="noreferrer" className="text-[11px] underline" style={{ color: "var(--text2)" }}>
                          Xem biên lai
                        </a>
                      )}
                      {b.deposit_status === "paid" && (
                        <button
                          onClick={() => confirmDeposit(b.id)}
                          disabled={busy === b.id}
                          className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                          style={{ background: "var(--s-greenS)", color: "var(--s-green)" }}
                        >
                          Đã đối chiếu — xác nhận
                        </button>
                      )}
                    </div>
                  )}

                  {b.voucher_code && (
                    <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--brand, var(--accent))" }}>
                      🎁 Dùng voucher <span className="font-mono">{b.voucher_code}</span> — tự áp khi tạo hợp đồng
                    </p>
                  )}
                  {b.referrer_phone && (
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--brand, var(--accent))" }}>
                      Được giới thiệu bởi {b.referrer_phone}
                    </p>
                  )}

                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--text3)" }}>{fmtDateTime(b.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col gap-1.5 items-end">
                  {/* Accept/Decline for new bookings */}
                  {(b.status === "new" || b.status === "pending") && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateStatus(b.id, "accepted")}
                        disabled={busy === b.id}
                        title="Nhận"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={{ background: "var(--s-greenS)", color: "var(--s-green)" }}
                      >
                        <CheckCircle size={13} /> Nhận
                      </button>
                      <button
                        onClick={() => updateStatus(b.id, "declined")}
                        disabled={busy === b.id}
                        title="Từ chối"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={{ background: "var(--s-redS)", color: "var(--s-red)" }}
                      >
                        <XCircle size={13} /> Từ chối
                      </button>
                    </div>
                  )}

                  {/* Create contract (accepted or handled) */}
                  {(b.status === "accepted" || b.status === "new") && (
                    <button
                      onClick={() => toContract(b)}
                      disabled={!!busy}
                      className="btn-primary px-3 py-1.5 text-xs gap-1.5"
                    >
                      <FilePlus size={13} /> {busy === b.id ? "Đang tạo…" : "Tạo HĐ"}
                    </button>
                  )}

                  {/* Edit / Delete */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditState(editStateOf(b))}
                      title="Sửa"
                      aria-label="Sửa yêu cầu đặt lịch"
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: "var(--surface2)", color: "var(--text2)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => updateStatus(b.id, "archived")}
                      title="Lưu trữ"
                      aria-label="Lưu trữ yêu cầu"
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: "var(--surface2)", color: "var(--text2)" }}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      onClick={() => deleteBooking(b.id)}
                      title="Xoá"
                      aria-label="Xoá yêu cầu"
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: "var(--s-redS)", color: "var(--s-red)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editState && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditState(null)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl p-6 shadow-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Sửa yêu cầu đặt lịch</h2>
              <button
                onClick={() => setEditState(null)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "var(--surface2)", color: "var(--text2)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Họ tên *</label>
                <input
                  className="input w-full"
                  value={editState.name}
                  onChange={(e) => setEditState((s) => s ? { ...s, name: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Điện thoại *</label>
                <input
                  className="input w-full"
                  value={editState.phone}
                  onChange={(e) => setEditState((s) => s ? { ...s, phone: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Dịch vụ</label>
                <input
                  className="input w-full"
                  value={editState.service}
                  onChange={(e) => setEditState((s) => s ? { ...s, service: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Ngày mong muốn</label>
                <DateInput
                  value={editState.preferred_date}
                  onChange={(v) => setEditState((s) => s ? { ...s, preferred_date: v } : s)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Facebook / Messenger</label>
                <input
                  className="input w-full"
                  value={editState.facebook}
                  onChange={(e) => setEditState((s) => s ? { ...s, facebook: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text3)" }}>Ghi chú</label>
                <textarea
                  className="input w-full resize-none"
                  rows={3}
                  value={editState.note}
                  onChange={(e) => setEditState((s) => s ? { ...s, note: e.target.value } : s)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditState(null)} className="btn-ghost">Huỷ</button>
              <button
                onClick={saveEdit}
                disabled={editBusy || !editState.name.trim() || !editState.phone.trim()}
                className="btn-primary gap-1.5"
              >
                <Save size={14} /> {editBusy ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
