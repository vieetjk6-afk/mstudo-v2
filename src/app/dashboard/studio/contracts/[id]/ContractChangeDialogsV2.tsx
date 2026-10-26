"use client";

import { useState } from "react";
import { AlertTriangle, Ban, CalendarClock, Check, CheckCircle2, Copy, Loader2 } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import ZaloSendButton from "@/components/ZaloSendButton";
import { Callout, Field, InfoList, btn, inputCls } from "@/components/v2/kit";
import { Modal, Segmented, Switch } from "@/components/v2/kit-client";
import { vnd, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { useCancelContract, useReschedule, type ContractChangeCommon, type RescheduleProps } from "./ContractChangeDialogs";

/* ═══════════════════════════════════════════════════════════════════════════
   DỜI LỊCH và HUỶ hợp đồng — giao diện mới. Cùng logic với hai hộp thoại bản
   cũ (useReschedule / useCancelContract, cùng route máy chủ); khác ở cách vẽ:
   ô nhập V2, công tắc thay ô tích, cảnh báo trùng lịch bằng Callout. Huỷ hỏi
   lại ngay trong hộp thoại (không dùng confirm() của trình duyệt). Xong việc
   thì chuyển sang bước "Báo khách" với tin soạn sẵn.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Bước cuối: báo khách bằng tin soạn sẵn. */
function DoneBody({ text, message }: { text: string; message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="green" icon={CheckCircle2}>
        <span style={{ color: "var(--tx)" }}>{text}</span>
      </Callout>
      <div>
        <p className="v2-label mb-1.5">Tin xác nhận gửi khách</p>
        <pre className="whitespace-pre-wrap rounded-[12px] p-3 text-[13px] leading-relaxed" style={{ background: "var(--sf2)", fontFamily: "inherit", color: "var(--tx2)" }}>
          {message}
        </pre>
      </div>
    </div>
  );
}

function DoneFooter({ message, p }: { message: string; p: ContractChangeCommon }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button type="button" className={btn("ghost")} onClick={p.onClose}>
        Xong
      </button>
      <button
        type="button"
        className={btn("secondary")}
        onClick={() => {
          navigator.clipboard?.writeText(message);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />} {copied ? "Đã chép" : "Chép tin"}
      </button>
      <ZaloSendButton
        phone={p.clientPhone}
        name={p.clientName}
        audience="client"
        contractId={p.contractId}
        message={message}
        label="Gửi Zalo cho khách"
        className={btn("primary")}
        friendsBtnClass={btn("secondary")}
        wrapClassName="w-auto"
      />
    </>
  );
}

// ── Dời lịch ────────────────────────────────────────────────────────────────
export function RescheduleDialogV2(props: RescheduleProps) {
  const { eventDate, eventTime, ...p } = props;
  const r = useReschedule(props);
  const conflict = r.check && (r.check.crewBusy.length > 0 || r.check.sameDay.length > 0);

  return (
    <Modal
      open
      onClose={p.onClose}
      icon={r.done ? CheckCircle2 : CalendarClock}
      title={r.done ? "Đã dời lịch" : "Dời lịch hợp đồng"}
      desc={r.done ? undefined : "Lịch thợ, lịch hẹn, hạn thu và Google Lịch đi theo ngày mới."}
      width={540}
      footer={
        r.done ? (
          <DoneFooter message={r.done.message} p={p} />
        ) : (
          <>
            <button type="button" className={btn("ghost")} onClick={p.onClose}>
              Thôi
            </button>
            <button type="button" className={btn("primary")} onClick={r.submit} disabled={r.busy || !r.date}>
              {r.busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />} {r.busy ? "Đang dời…" : "Dời lịch"}
            </button>
          </>
        )
      }
    >
      {r.done ? (
        <DoneBody {...r.done} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px]" style={{ background: "var(--sf2)" }}>
            <span style={{ color: "var(--tx2)" }}>Ngày hiện tại</span>
            <b>
              {eventDate ? fmtDate(eventDate) : "chưa có"}
              {eventTime ? ` · ${eventTime}` : ""}
            </b>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngày mới" htmlFor="rs-date">
              <DateInput id="rs-date" className={inputCls} value={r.date} onChange={r.setDate} />
            </Field>
            <Field label="Giờ mới" hint="Bỏ trống = giữ giờ cũ">
              <TimeInput className={inputCls} value={r.time} onChange={r.setTime} ariaLabel="Giờ mới" />
            </Field>
          </div>
          {r.check && conflict && (
            <Callout tone="amber" icon={AlertTriangle} title={`Ngày ${fmtDate(r.date)} đã có lịch`}>
              <ul className="mt-1 list-disc pl-5">
                {r.check.crewBusy.map((c, i) => (
                  <li key={`c${i}`}>
                    {c.name}: {c.what}
                  </li>
                ))}
                {r.check.sameDay.map((c) => (
                  <li key={c.id}>Hợp đồng khác: {c.client_name || c.title}</li>
                ))}
              </ul>
              <p className="mt-1">Vẫn dời được, nhưng nên đổi thợ hoặc báo họ trước.</p>
            </Callout>
          )}
          {r.check && !conflict && (
            <p className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--gn)" }}>
              <CheckCircle2 size={15} /> Thợ của hợp đồng rảnh ngày này.
            </p>
          )}
          <Field label="Lý do" htmlFor="rs-reason" hint="Lưu vào lịch sử hợp đồng.">
            <input id="rs-reason" className={inputCls} value={r.reason} onChange={(e) => r.setReason(e.target.value)} placeholder="Khách đổi ngày cưới, thời tiết…" />
          </Field>
          <Field label="Phí dời lịch" hint="0 = miễn phí. Có phí thì app thêm một hạng mục vào hợp đồng, khách trả qua các đợt như thường.">
            <MoneyInput className={inputCls} value={r.fee} onChange={r.setFee} ariaLabel="Phí dời lịch" placeholder="0" />
          </Field>
          <div className="flex flex-col rounded-[12px] px-3.5 py-1" style={{ border: "1px solid var(--bd)" }}>
            <Switch checked={r.shiftPlans} onChange={r.setShiftPlans} label="Dời hạn các đợt chưa thu" desc="Theo cùng số ngày với ngày chụp." />
            <Switch checked={r.moveAppts} onChange={r.setMoveAppts} label="Chuyển lịch hẹn của ngày chụp cũ" desc="Makeup, chụp… nằm đúng ngày cũ chuyển sang ngày mới." />
            <Switch checked={r.notifyCrew} onChange={r.setNotifyCrew} label="Báo Zalo cho thợ" desc="Nếu studio đã nối Zalo." />
          </div>
          {r.err && <Callout tone="red">{r.err}</Callout>}
        </div>
      )}
    </Modal>
  );
}

// ── Huỷ hợp đồng ────────────────────────────────────────────────────────────
export function CancelDialogV2(p: ContractChangeCommon) {
  const c = useCancelContract(p);
  const [ask, setAsk] = useState(false);
  const { info } = c;
  const q = info?.quote;

  const footer = c.done ? (
    <DoneFooter message={c.done.message} p={p} />
  ) : !info || !q ? (
    <button type="button" className={btn("ghost")} onClick={p.onClose}>
      Đóng
    </button>
  ) : ask ? (
    <>
      <button type="button" className={btn("ghost")} onClick={() => setAsk(false)} disabled={c.busy}>
        Quay lại
      </button>
      <button
        type="button"
        className={btn("danger")}
        disabled={c.busy}
        onClick={async () => {
          await c.submit();
          setAsk(false);
        }}
      >
        {c.busy ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} {c.busy ? "Đang huỷ…" : "Xác nhận huỷ"}
      </button>
    </>
  ) : (
    <>
      <button type="button" className={btn("ghost")} onClick={p.onClose}>
        Thôi
      </button>
      <button type="button" className={btn("danger")} onClick={() => setAsk(true)} disabled={c.busy}>
        <Ban size={16} /> Huỷ hợp đồng
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={() => (c.busy ? undefined : p.onClose())}
      icon={c.done ? CheckCircle2 : Ban}
      title={c.done ? "Đã huỷ hợp đồng" : ask ? "Huỷ hợp đồng này?" : "Huỷ hợp đồng"}
      desc={c.done ? undefined : ask ? c.confirmText.replace(/^[^?]*\?\s*/, "") : "Chọn số tiền hoàn cho khách rồi xác nhận."}
      width={540}
      footer={footer}
    >
      {c.done ? (
        <DoneBody {...c.done} />
      ) : c.loadErr ? (
        <Callout tone="red" icon={AlertTriangle}>
          {c.loadErr}
        </Callout>
      ) : !info || !q ? (
        <p className="flex items-center gap-2 text-[13.5px]" style={{ color: "var(--tx3)" }}>
          <Loader2 size={15} className="animate-spin" /> Đang tính…
        </p>
      ) : ask ? (
        <div className="flex flex-col gap-3">
          <InfoList
            items={[
              { label: "Hoàn cho khách", value: <span className="v2-num" style={{ color: c.refund > 0 ? "var(--rd)" : undefined }}>{vnd(c.refund)}</span> },
              ...(c.refund > 0 ? [{ label: "Hoàn bằng", value: PAYMENT_METHOD_LABEL[c.method] }] : []),
              { label: "Studio giữ lại", value: <span className="v2-num">{vnd(Math.max(0, info.collected - c.refund))}</span> },
              ...(c.reason.trim() ? [{ label: "Lý do", value: c.reason.trim() }] : []),
            ]}
          />
          {c.err && <Callout tone="red">{c.err}</Callout>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
            <InfoList
              items={[
                { label: "Khách đã thanh toán", value: <span className="v2-num">{vnd(info.collected)}</span> },
                {
                  label: "Ngày chụp",
                  value:
                    q.daysBefore == null ? "Chưa có ngày chụp" : q.daysBefore >= 0 ? `Còn ${q.daysBefore} ngày` : `Đã qua ${-q.daysBefore} ngày`,
                },
                {
                  label: "Theo chính sách",
                  value: (
                    <span className="v2-num">
                      hoàn {q.pct}% = {vnd(q.refund)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
          <p className="-mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
            Chính sách hiện tại: huỷ trước ≥ {info.policy.earlyDays} ngày hoàn {info.policy.earlyPct}%, muộn hơn hoàn {info.policy.latePct}%. Đổi ở Dịch vụ &amp;
            điều khoản → Chính sách studio.
          </p>
          <Field label="Số tiền hoàn cho khách" hint={<>Studio giữ lại (phí huỷ): <b className="v2-num">{vnd(Math.max(0, info.collected - c.refund))}</b></>}>
            <MoneyInput className={inputCls} value={c.refund} onChange={(n) => c.setRefund(Math.max(0, Math.min(info.collected, n)))} ariaLabel="Số tiền hoàn" />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[0, q.refund, info.collected]
                .filter((v, i, a) => a.indexOf(v) === i && v >= 0)
                .map((v) => {
                  const on = c.refund === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => c.setRefund(v)}
                      aria-pressed={on}
                      className="rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "transparent", color: on ? "var(--ac)" : "var(--tx2)" }}
                    >
                      {v === 0 ? "Không hoàn" : v === info.collected ? `Hoàn toàn bộ · ${vnd(v)}` : `Theo chính sách · ${vnd(v)}`}
                    </button>
                  );
                })}
            </div>
          </Field>
          {c.refund > 0 && (
            <Field label="Hoàn bằng">
              <Segmented<PaymentMethod>
                label="Cách hoàn tiền"
                value={c.method}
                onChange={c.setMethod}
                options={(["transfer", "cash"] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
              />
            </Field>
          )}
          <Field label="Lý do huỷ" htmlFor="cc-reason">
            <input id="cc-reason" className={inputCls} value={c.reason} onChange={(e) => c.setReason(e.target.value)} placeholder="Khách đổi kế hoạch, hoãn cưới…" />
          </Field>
          <Callout tone="amber" icon={AlertTriangle}>
            Huỷ sẽ: ghi khoản hoàn (trừ vào doanh thu), bỏ các đợt chưa thu, gỡ lịch thợ, huỷ lịch hẹn chưa diễn ra, gỡ khỏi Google Lịch.
          </Callout>
          {c.err && <Callout tone="red">{c.err}</Callout>}
        </div>
      )}
    </Modal>
  );
}
