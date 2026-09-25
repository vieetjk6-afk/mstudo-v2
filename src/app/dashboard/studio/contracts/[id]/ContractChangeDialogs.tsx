"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Ban, X, AlertTriangle, Check } from "lucide-react";
import { Modal } from "@/components/studio/Modal";
import MoneyInput from "@/components/MoneyInput";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import ZaloSendButton from "@/components/ZaloSendButton";
import { vnd, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import type { CancelPolicy, CancelQuote } from "@/lib/contract-cancel";

/**
 * Hai hộp thoại cho hai thao tác lớn trên hợp đồng: DỜI LỊCH và HUỶ.
 *
 * Cả hai đi qua route máy chủ (/api/studio/contracts/[id]/…) vì mỗi thao tác còn
 * kéo theo lịch thợ, lịch hẹn, hạn thu, Google Lịch. Xong việc, hộp thoại đổi
 * sang bước "Báo khách" với tin nhắn soạn sẵn: studio tự bấm gửi, vì huỷ / dời
 * là chuyện đã nói với khách trước, tin này chỉ để xác nhận bằng chữ.
 */

type Common = {
  contractId: string;
  clientName: string | null;
  clientPhone: string | null;
  onClose: () => void;
  /**
   * Gọi khi thao tác đã ghi xong, kèm giá trị MỚI của hợp đồng. Màn hợp đồng phải
   * đặt ngay các giá trị này vào form: form tự lưu cả ngày lẫn trạng thái, để giá
   * trị cũ trong form là lần tự lưu sau ghi đè mất việc vừa làm.
   */
  onDone: (patch: { event_date?: string; event_time?: string; status?: "cancelled" }) => void;
};

function Head({ icon, title, onClose, tone = "var(--ac)" }: { icon: React.ReactNode; title: string; onClose: () => void; tone?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: "1px solid var(--bd)" }}>
      <span style={{ color: tone }}>{icon}</span>
      <h2 id="contract-change-title" className="text-[16px] font-bold">{title}</h2>
      <button onClick={onClose} className="ml-auto p-1" aria-label="Đóng" style={{ color: "var(--tx3)" }}><X size={18} /></button>
    </div>
  );
}

function Done({ text, message, clientPhone, clientName, contractId, onClose }: {
  text: string; message: string; clientPhone: string | null; clientName: string | null; contractId: string; onClose: () => void;
}) {
  return (
    <div className="space-y-3 px-5 py-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--gn)" }}><Check size={16} /> {text}</p>
      <div>
        <p className="mb-1 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>Tin xác nhận gửi khách</p>
        <pre className="whitespace-pre-wrap rounded-[10px] p-3 text-[13px]" style={{ background: "var(--sf2)", fontFamily: "inherit" }}>{message}</pre>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ZaloSendButton phone={clientPhone} name={clientName} audience="client" contractId={contractId} message={message} label="Gửi Zalo cho khách" className="act-btn act-btn-primary" wrapClassName="" />
        <button onClick={() => navigator.clipboard?.writeText(message)} className="act-btn">Chép tin</button>
        <button onClick={onClose} className="act-btn ml-auto">Xong</button>
      </div>
    </div>
  );
}

// ── Dời lịch ────────────────────────────────────────────────────────────────
export function RescheduleDialog({ eventDate, eventTime, ...p }: Common & { eventDate: string | null; eventTime: string | null }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState(0);
  const [shiftPlans, setShiftPlans] = useState(true);
  const [moveAppts, setMoveAppts] = useState(true);
  const [notifyCrew, setNotifyCrew] = useState(true);
  const [check, setCheck] = useState<{ crewBusy: { name: string; what: string }[]; sameDay: { id: string; title: string; client_name: string | null }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; message: string } | null>(null);

  // Chọn ngày xong là kiểm tra trùng lịch ngay, trước khi bấm dời.
  useEffect(() => {
    setCheck(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let alive = true;
    fetch(`/api/studio/contracts/${p.contractId}/reschedule?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setCheck({ crewBusy: j.crewBusy ?? [], sameDay: j.sameDay ?? [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [date, p.contractId]);

  async function submit() {
    setErr(null);
    if (!date) return setErr("Chọn ngày mới.");
    setBusy(true);
    const r = await fetch(`/api/studio/contracts/${p.contractId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newDate: date, newTime: time, reason, fee, shiftPlans, moveAppointments: moveAppts, notifyCrew }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      const m: Record<string, string> = {
        same_date: "Ngày giờ mới trùng với ngày giờ hiện tại.",
        missing_migration: "Cần chạy supabase/huy-doi-lich.sql trên Supabase trước.",
        forbidden: "Bạn không có quyền dời lịch hợp đồng này.",
        cancelled: "Hợp đồng đã huỷ, không dời lịch được.",
      };
      return setErr(m[j.error] || j.message || "Không dời được, thử lại.");
    }
    const bits = [
      j.shiftedPlans ? `dời hạn ${j.shiftedPlans} đợt thu` : "",
      j.movedAppts ? `${j.movedAppts} lịch hẹn` : "",
      j.movedCrew ? `lịch ${j.movedCrew} thợ` : "",
      j.crewNotified ? `đã báo Zalo ${j.crewNotified} thợ` : "",
    ].filter(Boolean);
    setDone({ text: `Đã dời sang ${fmtDate(date)}${time ? ` · ${time}` : ""}${bits.length ? ` · ${bits.join(", ")}` : ""}.`, message: j.clientMessage });
    p.onDone({ event_date: date, event_time: time || eventTime || "" });
  }

  return (
    <Modal onClose={p.onClose} labelledBy="contract-change-title">
      <Head icon={<CalendarClock size={18} />} title="Dời lịch hợp đồng" onClose={p.onClose} />
      {done ? (
        <Done {...done} clientPhone={p.clientPhone} clientName={p.clientName} contractId={p.contractId} onClose={p.onClose} />
      ) : (
        <div className="space-y-3.5 overflow-y-auto px-5 py-4">
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
            Ngày hiện tại: <b>{eventDate ? fmtDate(eventDate) : "chưa có"}{eventTime ? ` · ${eventTime}` : ""}</b>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ngày mới</label>
              <DateInput value={date} onChange={setDate} />
            </div>
            <div>
              <label className="label">Giờ mới (bỏ trống = giữ giờ cũ)</label>
              <TimeInput value={time} onChange={setTime} />
            </div>
          </div>
          {check && (check.crewBusy.length > 0 || check.sameDay.length > 0) && (
            <div className="rounded-[10px] p-3 text-[12.5px]" style={{ background: "var(--amS)", color: "var(--am)" }}>
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Ngày {fmtDate(date)} đã có lịch</p>
              <ul className="mt-1 list-disc pl-5">
                {check.crewBusy.map((c, i) => <li key={`c${i}`}>{c.name}: {c.what}</li>)}
                {check.sameDay.map((c) => <li key={c.id}>Hợp đồng khác: {c.client_name || c.title}</li>)}
              </ul>
              <p className="mt-1">Vẫn dời được, nhưng nên đổi thợ hoặc báo họ trước.</p>
            </div>
          )}
          {check && check.crewBusy.length === 0 && check.sameDay.length === 0 && (
            <p className="text-[12px]" style={{ color: "var(--gn)" }}>✓ Thợ của hợp đồng rảnh ngày này.</p>
          )}
          <div>
            <label className="label">Lý do (lưu vào lịch sử)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Khách đổi ngày cưới, thời tiết…" />
          </div>
          <div>
            <label className="label">Phí dời lịch (0 = miễn phí)</label>
            <MoneyInput value={fee} onChange={setFee} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>Có phí thì app thêm một hạng mục vào hợp đồng, khách trả qua các đợt như thường.</p>
          </div>
          <div className="space-y-1.5 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={shiftPlans} onChange={(e) => setShiftPlans(e.target.checked)} /> Dời hạn các đợt chưa thu theo cùng số ngày</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={moveAppts} onChange={(e) => setMoveAppts(e.target.checked)} /> Chuyển lịch hẹn nằm đúng ngày chụp cũ (makeup, chụp) sang ngày mới</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={notifyCrew} onChange={(e) => setNotifyCrew(e.target.checked)} /> Báo Zalo cho thợ (nếu đã nối Zalo)</label>
          </div>
          {err && <p className="text-[13px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={p.onClose} className="act-btn">Thôi</button>
            <button onClick={submit} disabled={busy || !date} className="act-btn act-btn-primary">
              <CalendarClock size={15} /> {busy ? "Đang dời…" : "Dời lịch"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Huỷ hợp đồng ────────────────────────────────────────────────────────────
export function CancelDialog(p: Common) {
  const [info, setInfo] = useState<{ collected: number; policy: CancelPolicy; quote: CancelQuote } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [refund, setRefund] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; message: string } | null>(null);

  useEffect(() => {
    fetch(`/api/studio/contracts/${p.contractId}/cancel`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setLoadErr(j.error === "forbidden" ? "Chỉ chủ studio được huỷ hợp đồng (vì có hoàn tiền)." : "Không tải được thông tin.");
        setInfo(j);
        setRefund(j.quote?.refund ?? 0);
      })
      .catch(() => setLoadErr("Lỗi mạng, thử lại."));
  }, [p.contractId]);

  async function submit() {
    if (!info) return;
    setErr(null);
    if (!confirm(`Huỷ hợp đồng${refund > 0 ? ` và ghi hoàn ${vnd(refund)} cho khách` : ""}? Các đợt chưa thu sẽ bị bỏ, lịch thợ được gỡ.`)) return;
    setBusy(true);
    const r = await fetch(`/api/studio/contracts/${p.contractId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refund, method, reason }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      const m: Record<string, string> = {
        bad_refund: `Số hoàn phải từ 0 tới ${vnd(info.collected)} (số đã thu).`,
        missing_migration: "Cần chạy supabase/huy-doi-lich.sql trên Supabase trước khi ghi hoàn tiền.",
        already_cancelled: "Hợp đồng đã huỷ từ trước.",
      };
      return setErr(m[j.error] || j.message || "Không huỷ được, thử lại.");
    }
    setDone({
      text: j.refund > 0 ? `Đã huỷ · đã ghi hoàn ${vnd(j.refund)} · studio giữ ${vnd(j.kept)}.` : `Đã huỷ · studio giữ ${vnd(j.kept)}.`,
      message: j.clientMessage,
    });
    p.onDone({ status: "cancelled" });
  }

  const q = info?.quote;
  return (
    <Modal onClose={p.onClose} labelledBy="contract-change-title">
      <Head icon={<Ban size={18} />} title="Huỷ hợp đồng" onClose={p.onClose} tone="var(--rd)" />
      {done ? (
        <Done {...done} clientPhone={p.clientPhone} clientName={p.clientName} contractId={p.contractId} onClose={p.onClose} />
      ) : loadErr ? (
        <p className="px-5 py-4 text-[13px]" style={{ color: "var(--rd)" }}>{loadErr}</p>
      ) : !info || !q ? (
        <p className="px-5 py-4 text-[13px]" style={{ color: "var(--tx3)" }}>Đang tính…</p>
      ) : (
        <div className="space-y-3.5 overflow-y-auto px-5 py-4">
          <div className="rounded-[10px] p-3 text-[13px]" style={{ background: "var(--sf2)" }}>
            <p>Khách đã thanh toán: <b>{vnd(info.collected)}</b></p>
            <p className="mt-1" style={{ color: "var(--tx2)" }}>
              {q.daysBefore == null ? "Hợp đồng chưa có ngày chụp" : q.daysBefore >= 0 ? `Còn ${q.daysBefore} ngày tới ngày chụp` : `Ngày chụp đã qua ${-q.daysBefore} ngày`}
              {" · "}theo chính sách: hoàn <b>{q.pct}%</b> = <b>{vnd(q.refund)}</b>
            </p>
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Chính sách hiện tại: huỷ trước ≥ {info.policy.earlyDays} ngày hoàn {info.policy.earlyPct}%, muộn hơn hoàn {info.policy.latePct}%. Đổi ở Dịch vụ &amp; điều khoản → Chính sách studio.
            </p>
          </div>
          <div>
            <label className="label">Số tiền hoàn cho khách (sửa được)</label>
            <MoneyInput value={refund} onChange={(n) => setRefund(Math.max(0, Math.min(info.collected, n)))} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[0, q.refund, info.collected].filter((v, i, a) => a.indexOf(v) === i && v >= 0).map((v) => (
                <button key={v} type="button" onClick={() => setRefund(v)} className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ border: "1px solid var(--bd)", color: "var(--tx2)" }}>
                  {v === 0 ? "Không hoàn" : v === info.collected ? `Hoàn toàn bộ · ${vnd(v)}` : `Theo chính sách · ${vnd(v)}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--tx2)" }}>Studio giữ lại (phí huỷ): <b>{vnd(Math.max(0, info.collected - refund))}</b></p>
          </div>
          {refund > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span style={{ color: "var(--tx3)" }}>Hoàn bằng:</span>
              {(["transfer", "cash"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className="rounded-full px-2.5 py-1"
                  style={{ border: `1px solid ${method === m ? "var(--gn)" : "var(--bd)"}`, background: method === m ? "var(--gnS)" : "transparent", color: method === m ? "var(--gn)" : "var(--tx2)" }}>
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="label">Lý do huỷ</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Khách đổi kế hoạch, hoãn cưới…" />
          </div>
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
            Huỷ sẽ: ghi khoản hoàn (trừ vào doanh thu), bỏ các đợt chưa thu, gỡ lịch thợ, huỷ lịch hẹn chưa diễn ra, gỡ khỏi Google Lịch.
          </p>
          {err && <p className="text-[13px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={p.onClose} className="act-btn">Thôi</button>
            <button onClick={submit} disabled={busy} className="act-btn act-btn-danger">
              <Ban size={15} /> {busy ? "Đang huỷ…" : "Huỷ hợp đồng"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
