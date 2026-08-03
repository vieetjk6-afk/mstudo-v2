"use client";

import { useEffect, useState } from "react";
import {
  Link as LinkIcon, Copy, Check, Phone, FilePlus, Archive, MessageCircle,
  CheckCircle, XCircle, Pencil, Trash2, X, Save, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { studioUrl } from "@/lib/hosts";
import { nextContractCode, DEFAULT_TASKS } from "@/lib/contract-code";
import { fullClauseText } from "@/lib/contract-clauses";
import { messengerUrl } from "@/components/MessengerButton";
import { vnd, type StudioBooking } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import DateInput from "@/components/DateInput";
import { useRouter } from "next/navigation";

type BookingStatus = "new" | "accepted" | "pending" | "declined" | "handled" | "archived";

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

interface EditState {
  id: string;
  name: string;
  phone: string;
  service: string;
  preferred_date: string;
  note: string;
  facebook: string;
}

export default function BookingsView({
  ownerId,
  token,
  tokenSaved = true,
  initial,
  studioHost = null,
}: {
  ownerId: string;
  token: string;
  tokenSaved?: boolean;
  initial: StudioBooking[];
  studioHost?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState<StudioBooking[]>(initial);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState(() => studioUrl(studioHost, `/book/${token}`));
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Đóng modal sửa bằng phím Esc.
  useEffect(() => {
    if (!editState) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditState(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editState]);

  useEffect(() => {
    setBookingUrl(studioHost ? studioUrl(studioHost, `/book/${token}`) : `${window.location.origin}/book/${token}`);
  }, [token, studioHost]);

  async function updateStatus(id: string, status: BookingStatus) {
    setBusy(id);
    await supabase.from("studio_bookings").update({ status }).eq("id", id);
    setList((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    setBusy(null);
  }

  async function deleteBooking(id: string) {
    if (!confirm("Xoá yêu cầu này? Không thể khôi phục.")) return;
    await supabase.from("studio_bookings").delete().eq("id", id);
    setList((p) => p.filter((b) => b.id !== id));
  }

  async function saveEdit() {
    if (!editState) return;
    setEditBusy(true);
    const patch = {
      name: editState.name.trim(),
      phone: editState.phone.trim(),
      service: editState.service.trim() || null,
      preferred_date: editState.preferred_date || null,
      note: editState.note.trim() || null,
      facebook: editState.facebook.trim() || null,
    };
    await supabase.from("studio_bookings").update(patch).eq("id", editState.id);
    setList((p) => p.map((b) => b.id === editState.id ? { ...b, ...patch } : b));
    setEditBusy(false);
    setEditState(null);
  }

  async function toContract(b: StudioBooking) {
    setBusy(b.id);
    const ct = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
    const code = await nextContractCode(supabase, ownerId);
    const note = [b.note, fullClauseText()].filter(Boolean).join("\n\n");
    const { data, error } = await supabase
      .from("studio_contracts")
      .insert({
        owner_id: ownerId,
        code,
        title: b.service ? `${b.service} — ${b.name}` : `Hợp đồng — ${b.name}`,
        client_name: b.name,
        client_phone: b.phone,
        client_messenger: b.facebook || null,
        event_date: b.preferred_date,
        note,
        client_token: ct,
      })
      .select("id")
      .single();
    if (error || !data) { setBusy(null); alert("Không tạo được hợp đồng: " + (error?.message || "")); return; }
    if (b.package_name) {
      await supabase.from("contract_items").insert({ contract_id: data.id, name: b.package_name, qty: 1, unit_price: b.package_price || 0, position: 0 });
    }
    await supabase.from("contract_tasks").insert(DEFAULT_TASKS.map((label, position) => ({ contract_id: data.id, label, position })));
    await supabase.from("studio_bookings").update({ status: "handled" }).eq("id", b.id);
    router.push(`/dashboard/studio/contracts/${data.id}`);
  }

  // "Tất cả" bỏ qua mục đã lưu trữ (xem riêng ở tab "Lưu trữ").
  const filtered = filterStatus === "all"
    ? list.filter((b) => b.status !== "archived")
    : list.filter((b) => b.status === filterStatus);

  const counts = list.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-in">

      {/* Share link */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <LinkIcon size={16} style={{ color: "var(--text3)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--text3)" }}>
            Link đặt lịch — chia sẻ cho khách / gắn lên Facebook
          </p>
          <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{bookingUrl}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { navigator.clipboard?.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
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
              <div className="flex items-start gap-3">
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
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--text3)" }}>{new Date(b.created_at).toLocaleString("vi-VN")}</p>
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
                      onClick={() => setEditState({
                        id: b.id,
                        name: b.name,
                        phone: b.phone,
                        service: b.service ?? "",
                        preferred_date: b.preferred_date ?? "",
                        note: b.note ?? "",
                        facebook: b.facebook ?? "",
                      })}
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
