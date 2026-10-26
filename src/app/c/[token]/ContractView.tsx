"use client";

import Link from "next/link";
import { fmtDate, fmtDateLunar, fmtDateTime } from "@/lib/date";
import { Lock, MapPin, Calendar, Send, Check, Printer, PenLine, Images, ImagePlus, Star, ListChecks, Package, Upload, Heart } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import ClientAddenda from "./ClientAddenda";
import CalendarButtons from "@/components/CalendarButtons";
import VietQRButton, { VietQR, instalmentNote } from "@/components/VietQR";
import { thiepUrl } from "@/lib/hosts";
import PortalVoucher from "./PortalVoucher";
import { PaidConfirmScreen } from "./PaidConfirm";
import ContractPrintDoc from "./ContractPrintDoc";
import { useContractPortal } from "./useContractPortal";
import {
  vnd,
  SHOOT_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  PRODUCT_STATUS_LABEL,
} from "@/lib/types";

/* Trang hợp đồng gửi khách — BẢN CŨ. Trạng thái và mọi thao tác nằm ở
   ./useContractPortal (dùng chung với ./ContractViewV2); file này chỉ vẽ. */

export default function ContractView({ token }: { token: string }) {
  const {
    phone, setPhone, contract, studioName, studioLogo, studioPhone,
    items, payments, milestones, gallery, selection, wedding, story, quoteOptions, chosenQuote,
    plan, expenses, tasks, products, addenda, loyalty, bank,
    paidReported, proofUploading, proofUrls, selectedPlanId, setSelectedPlanId,
    qrOpen, setQrOpen, paidNow, setPaidNow, qr, lang, setLang, t, loading, err,
    editMsg, setEditMsg, sending, sent, toast,
    signName, setSignName, setSignature, signing,
    messenger, setMessenger, msgrSaved, rating, setRating, reviewText, setReviewText, reviewSent,
    brief, setBrief, briefSent,
    fetchContract, unlock, sendEdit, reportPaid, uploadProof, chooseQuote, submitBrief, saveMessenger, sendReview, sign,
    itemsTotal, surcharge, printing, total, collected, balance, signed,
    nextDue, dueAmount, duePct, contractRef, dueNote, dueQr, unpaidPlan, termLines,
  } = useContractPortal(token);

  /* ── Khối dùng lại của trang khách (bản thiết kế "Hợp đồng gửi khách") ──
     Thẻ bo 14–16px, chỉ có viền, không đổ bóng; nhãn viết hoa 10.5px/800. */
  const sectionCls = "overflow-hidden rounded-[14px]";
  const sectionStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const headCls = "px-5 py-4 text-[10.5px] font-extrabold uppercase";
  const headStyle = { letterSpacing: ".7px", color: "var(--tx3)", borderBottom: "1px solid var(--bd2)" } as const;

  if (!contract) {
    return (
      <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
        <form onSubmit={unlock} className="w-full max-w-[400px] rounded-[16px] px-7 py-8 text-center" style={sectionStyle}>
          <div className="mb-1 flex justify-end">
            <button type="button" onClick={() => setLang(lang === "vi" ? "en" : "vi")} className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </div>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Lock size={21} />
          </span>
          <h1 className="mt-3.5 text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>{t("portalTitle")}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>{t("gatePrompt")}</p>
          <input
            className="mt-5 w-full rounded-[11px] px-3.5 py-3 text-center text-[15px] font-semibold tracking-wide"
            style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-label={t("phone")}
            placeholder={t("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {err && (
            <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-3.5 w-full rounded-[11px] py-3 text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {loading ? t("opening") : t("view")}
          </button>
        </form>
      </div>
    );
  }


  const st = CONTRACT_STATUS_TONE[contract.status];

  return (
    <>
      {paidNow && (
        <PaidConfirmScreen
          e={paidNow}
          lang={lang}
          studioName={studioName}
          contractRef={contract.code || contract.title}
          eventDate={contract.event_date}
          remaining={Math.max(0, balance)}
          onClose={() => setPaidNow(null)}
        />
      )}
      {/* Toast lỗi — nổi trên cùng, tự tắt sau vài giây (thay alert của trình duyệt) */}
      {toast && (
        <div
          className="no-print fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] shadow-lg"
          style={{ background: "var(--danger, #d66)", color: "#fff", maxWidth: "90vw" }}
          role="alert"
        >
          {toast}
        </div>
      )}
      {/* Bản trên màn hình (ẩn khi in) */}
      <div className="client-doc no-print min-h-screen">
        <div className="mx-auto flex max-w-[720px] flex-col gap-3.5 px-4 py-6 sm:px-5 sm:py-9">

          {/* Điều khiển phụ — không thuộc văn bản nên đứng ngoài, canh phải. */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setLang(lang === "vi" ? "en" : "vi")} className="flex-none text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
              {lang === "vi" ? "EN" : "VI"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex flex-none items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
            >
              <Printer size={14} /> {t("pdf")}
            </button>
          </div>

          {/* Đường dẫn sang TRANG RIÊNG của khách (cùng token, cùng mật khẩu là
              SĐT): bản hợp đồng này là văn bản để đọc và ký, còn trang kia là nơi
              theo dõi lịch trình, các đợt thanh toán và sản phẩm — và biến thành
              trang album khi hợp đồng hoàn thành. */}
          <Link
            href={`/portal/${token}`}
            className="flex items-center gap-3 rounded-[14px] px-4 py-3.5"
            style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}
          >
            <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf)", lineHeight: 0 }}>
              <ListChecks size={17} style={{ color: "var(--ac)" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold">
                {lang === "vi" ? "Trang theo dõi của bạn" : "Your tracking page"}
              </span>
              <span className="block text-[11.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {lang === "vi"
                  ? "Lịch trình hẹn, tiến độ thanh toán, sản phẩm và album ảnh"
                  : "Appointments, payment progress, products and your photo album"}
              </span>
            </span>
            <span className="flex-none text-[12.5px] font-bold" style={{ color: "var(--ac)" }}>
              {lang === "vi" ? "Mở →" : "Open →"}
            </span>
          </Link>

          {/* ══ Thẻ hợp đồng ═══════════════════════════════════════════════ */}
          <div className={sectionCls} style={sectionStyle}>

            {/* Đầu văn bản — thương hiệu studio canh giữa ngay trên nhãn văn
                bản, đúng đầu trang của bản thiết kế. */}
            <div className="px-5 py-7 text-center sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="flex items-center justify-center gap-2">
                {studioLogo ? (
                  <img src={studioLogo} alt={studioName} className="h-8 w-auto object-contain" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[13px] font-extrabold text-white" style={{ background: "var(--ac)" }}>
                    {studioName.trim().charAt(0).toUpperCase() || "S"}
                  </span>
                )}
                <span className="text-[16px] font-extrabold" style={{ letterSpacing: "-.4px" }}>{studioName}</span>
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase" style={{ letterSpacing: "1px", color: "var(--tx3)" }}>
                {lang === "vi" ? "Hợp đồng dịch vụ chụp ảnh" : "Photography service contract"}
              </p>
              <h1 className="mt-1.5 text-[24px] font-bold sm:text-[27px]" style={{ letterSpacing: "-.6px", textWrap: "pretty" }}>{contract.title}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {contract.code && (
                  <span className="text-[12px]" style={{ color: "var(--tx3)", fontFamily: "ui-monospace, monospace" }}>{contract.code}</span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold"
                  style={{ background: st.bg, color: st.fg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.fg }} />
                  {CONTRACT_STATUS_LABEL[contract.status]}
                </span>
              </div>
            </div>

            {/* Thông tin hai bên & buổi chụp */}
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Bên A · Studio" : "Party A · Studio"}</p>
                <p className="mt-1 text-[14px] font-semibold">{studioName}</p>
                {studioPhone && <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>{studioPhone}</p>}
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Bên B · Khách hàng" : "Party B · Client"}</p>
                <p className="mt-1 text-[14px] font-semibold">{contract.client_name || "—"}</p>
                <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>
                  {[contract.client_phone, contract.client_email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Ngày chụp" : "Shoot date"}</p>
                <p className="mt-1 text-[14px] font-semibold">{contract.event_date ? fmtDateLunar(contract.event_date) : "—"}</p>
                <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>
                  {contract.event_time || SHOOT_TYPE_LABEL[contract.shoot_type]}
                </p>
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Gói dịch vụ" : "Service"}</p>
                <p className="mt-1 text-[14px] font-semibold">{SHOOT_TYPE_LABEL[contract.shoot_type]}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="eyebrow">{lang === "vi" ? "Địa điểm" : "Location"}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[14px] font-semibold">
                  <MapPin size={15} style={{ flex: "none", marginTop: 3, color: "var(--tx3)" }} />
                  {contract.location || "—"}
                </p>
                {contract.event_date && (
                  <div className="mt-2">
                    <CalendarButtons compact event={{ date: contract.event_date, time: contract.event_time, title: contract.title, location: contract.location }} />
                  </div>
                )}
              </div>
            </div>

            {/* Nội dung dịch vụ */}
            <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <p className="eyebrow mb-2.5">{t("items")}</p>
              {items.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--tx3)" }}>{t("noItems")}</p>
              ) : (
                items.map((it) => {
                  const isDiscount = it.unit_price < 0;
                  return (
                    <div key={it.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{it.name}</p>
                        {it.description?.trim() && (
                          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                            {it.description.trim()}
                          </p>
                        )}
                        {!isDiscount && it.qty > 1 && (
                          <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                            {it.qty} × {vnd(it.unit_price)}
                          </p>
                        )}
                      </div>
                      <span
                        className="flex-none whitespace-nowrap text-[13px] font-bold"
                        style={{ color: isDiscount ? "var(--am)" : "var(--tx)" }}
                      >
                        {isDiscount ? `− ${vnd(Math.abs(it.qty * it.unit_price))}` : vnd(it.qty * it.unit_price)}
                      </span>
                    </div>
                  );
                })
              )}

              {surcharge > 0 && (
                <div className="flex justify-between py-1.5 pt-3 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>{lang === "vi" ? "Chi phí phát sinh" : "Surcharges"}</span>
                  <strong>{vnd(surcharge)}</strong>
                </div>
              )}
              {printing > 0 && (
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>{lang === "vi" ? "Chi phí in ấn" : "Printing"}</span>
                  <strong>{vnd(printing)}</strong>
                </div>
              )}

              <div className="flex items-baseline justify-between pt-3.5">
                <span className="text-[13.5px] font-bold">{lang === "vi" ? "Tổng cộng" : "Total"}</span>
                <span className="text-[22px] font-bold" style={{ letterSpacing: "-.6px", color: "var(--ac)" }}>{vnd(total)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                <span>
                  <span style={{ color: "var(--tx2)" }}>{t("paid")}: </span>
                  <b style={{ color: "var(--gn)" }}>{vnd(collected)}</b>
                </span>
                <span>
                  <span style={{ color: "var(--tx2)" }}>{t("remaining")}: </span>
                  <b style={{ color: balance > 0 ? "var(--am)" : "var(--gn)" }}>{vnd(balance)}</b>
                </span>
              </div>
            </div>

            {/* Lịch trình — ngay dưới hạng mục, để khách đọc gói dịch vụ xong là
                thấy luôn các buổi hẹn, trước phần thanh toán. */}
            {(contract.event_date || milestones.length > 0) && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <p className="eyebrow mb-1">{lang === "vi" ? "Lịch trình chi tiết" : "Schedule"}</p>
                {contract.event_date && (
                  <div className="flex flex-wrap items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Calendar size={16} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{lang === "vi" ? "Buổi chính" : "Main session"}{contract.title ? ` — ${contract.title}` : ""}</p>
                      {contract.location && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{contract.location}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx2)" }}>
                      {fmtDateLunar(contract.event_date)}{contract.event_time ? ` · ${contract.event_time}` : ""}
                    </span>
                    <CalendarButtons compact event={{ date: contract.event_date, time: contract.event_time, title: contract.title, location: contract.location }} />
                  </div>
                )}
                {milestones.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Calendar size={16} style={{ flex: "none", marginTop: 2, color: "var(--tx3)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{m.title}</p>
                      {m.note && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{m.note}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx2)" }}>
                      {fmtDateLunar(m.event_date)}{m.event_time ? ` · ${m.event_time}` : ""}
                    </span>
                    <CalendarButtons compact event={{ date: m.event_date, time: m.event_time, title: m.title, location: contract.location }} />
                  </div>
                ))}
              </div>
            )}

            {/* Cọc / chuyển khoản */}
            {balance > 0 && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                {/* Mã QR 96px bên trái, số tiền và hướng dẫn bên phải — đúng
                    khối "Cọc giữ lịch" của bản thiết kế. Bấm vào mã để phóng to
                    kèm nút chép số tài khoản / nội dung chuyển khoản. */}
                <div className="flex items-center gap-4 sm:gap-[18px]">
                  <div className="flex-none">
                    {dueQr ? (
                      <button onClick={() => setQrOpen(true)} aria-label={lang === "vi" ? "Phóng to mã QR" : "Enlarge QR"}>
                        <img
                          src={dueQr}
                          alt="VietQR"
                          width={96}
                          height={96}
                          className="h-24 w-24 rounded-[10px] bg-white object-contain"
                          style={{ border: "1px solid var(--bd)" }}
                        />
                      </button>
                    ) : (
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-[10px] p-2 text-center text-[10.5px] leading-tight"
                        style={{ border: "1px dashed var(--bd)", color: "var(--tx3)" }}
                      >
                        {lang === "vi" ? "Liên hệ studio để nhận số tài khoản" : "Ask the studio for details"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">
                      {nextDue ? nextDue.label : lang === "vi" ? "Còn phải thanh toán" : "Amount due"}
                      {duePct > 0 ? ` (${duePct}%)` : ""}
                    </p>
                    <p className="mt-1 text-[20px] font-bold" style={{ letterSpacing: "-.5px" }}>{vnd(dueAmount)}</p>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                      {lang === "vi"
                        ? `Quét mã để chuyển khoản.${dueAmount < balance ? ` Còn lại ${vnd(balance - dueAmount)} thanh toán ở các đợt sau.` : ""}`
                        : `Scan to transfer.${dueAmount < balance ? ` ${vnd(balance - dueAmount)} remains for later instalments.` : ""}`}
                    </p>
                    {nextDue?.due_date && (
                      <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--am)" }}>
                        {lang === "vi" ? "Hạn" : "Due"}: {fmtDate(nextDue.due_date)}
                      </p>
                    )}
                    {bank.account && (
                      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {[bank.name, bank.account, bank.holder].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Phóng to mã QR — chỗ duy nhất cần nút chép số tài khoản. */}
                {qrOpen && (
                  <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,.55)" }}
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}
                  >
                    <div className="w-full max-w-[320px] rounded-[16px] p-6" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                      <VietQR bank={bank} amount={dueAmount} addInfo={dueNote} />
                      <button
                        onClick={() => setQrOpen(false)}
                        className="mt-4 w-full rounded-[10px] py-2.5 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)" }}
                      >
                        {lang === "vi" ? "Đóng" : "Close"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Kế hoạch thanh toán */}
                {plan.length > 0 && (
                  <div className="mt-4">
                    <p className="eyebrow mb-2">{lang === "vi" ? "Kế hoạch thanh toán" : "Payment schedule"}</p>
                    {plan.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                        {p.paid
                          ? <Check size={16} style={{ flex: "none", color: "var(--gn)" }} />
                          : <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--am)" }} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{p.label}</p>
                          <p className="text-[11.5px]" style={{ color: p.paid ? "var(--gn)" : "var(--tx3)" }}>
                            {p.paid
                              ? `${lang === "vi" ? "Đã thanh toán" : "Paid"}${p.paid_at ? ` · ${fmtDate(p.paid_at)}` : ""}`
                              : p.due_date
                                ? `${lang === "vi" ? "Hạn" : "Due"} ${fmtDate(p.due_date)}`
                                : lang === "vi" ? "Chưa thanh toán" : "Pending"}
                          </p>
                        </div>
                        <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(p.amount)}</span>
                        {!p.paid && bank.bin && (
                          <VietQRButton bank={bank} amount={p.amount} addInfo={instalmentNote(contractRef, p.label, p.pay_code)} label="QR" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Gửi ảnh chuyển khoản */}
                <div className="mt-4">
                  <p className="eyebrow mb-2">{lang === "vi" ? "Đã chuyển khoản? Gửi ảnh cho studio" : "Transferred? Send the receipt"}</p>
                  {proofUrls.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {proofUrls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt="proof" className="h-16 w-16 rounded-[10px] object-cover" style={{ border: "1px solid var(--bd)" }} />
                        </a>
                      ))}
                    </div>
                  )}
                  {unpaidPlan.length > 0 && (
                    <select
                      className="mb-2 w-full rounded-[10px] px-3 py-2.5 text-[13px]"
                      style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                    >
                      <option value="">{lang === "vi" ? "— Chọn đợt thanh toán —" : "— Select instalment —"}</option>
                      {unpaidPlan.map((p) => (
                        <option key={p.id} value={p.id}>{p.label} · {vnd(p.amount)}</option>
                      ))}
                    </select>
                  )}
                  <label
                    className="relative block w-full cursor-pointer rounded-[12px] py-7 text-center"
                    style={{
                      border: `1.5px dashed ${proofUploading ? "var(--ac)" : "var(--bd)"}`,
                      background: proofUploading ? "var(--acS)" : "var(--sf2)",
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--ac)"; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = "";
                      const fl = e.dataTransfer.files?.[0];
                      if (fl && fl.type.startsWith("image/")) uploadProof(fl, selectedPlanId || undefined);
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      disabled={proofUploading}
                      onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadProof(fl, selectedPlanId || undefined); e.target.value = ""; }}
                    />
                    <Upload size={20} className="mx-auto mb-1.5" style={{ color: proofUploading ? "var(--ac)" : "var(--tx3)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: proofUploading ? "var(--ac)" : "var(--tx2)" }}>
                      {proofUploading
                        ? (lang === "vi" ? "Đang tải lên…" : "Uploading…")
                        : (lang === "vi" ? "Kéo ảnh vào đây hoặc bấm để chọn" : "Drag a photo here or tap to select")}
                    </p>
                    {!proofUploading && (
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {lang === "vi" ? "Ảnh chuyển khoản · tối đa 10MB" : "Bank transfer screenshot · max 10MB"}
                      </p>
                    )}
                  </label>
                  {paidReported ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>
                      <Check size={15} /> {lang === "vi" ? "Đã thông báo, studio sẽ đối soát." : "Notified — the studio will reconcile."}
                    </p>
                  ) : (
                    <button
                      onClick={reportPaid}
                      className="mt-2 w-full rounded-[10px] py-2.5 text-[12.5px] font-semibold"
                      style={{ border: "1px solid var(--bd)" }}
                    >
                      {lang === "vi" ? "Tôi đã chuyển khoản (không có ảnh)" : "I have transferred (no screenshot)"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Voucher ưu đãi: ngay dưới phần thanh toán, trên điều khoản — chỗ khách
                đang cân nhắc tiền nhất, để lời mời "ký & cọc nhận voucher" dễ thấy. */}
            {loyalty && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <PortalVoucher l={loyalty} studioName={studioName} clientName={contract.client_name} />
              </div>
            )}

            {/* Điều khoản chính */}
            {termLines.length > 0 && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <p className="eyebrow mb-2.5">{t("terms")}</p>
                {termLines.slice(0, 6).map((line, i) => (
                  <div key={i} className="flex gap-2.5 py-1">
                    <Check size={15} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{line}</span>
                  </div>
                ))}
                {termLines.length > 6 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer list-none text-[11.5px] font-bold" style={{ color: "var(--ac)" }}>
                      {lang === "vi" ? `Xem đầy đủ ${termLines.length} điều khoản` : `Read all ${termLines.length} terms`}
                    </summary>
                    <div className="mt-2">
                      {termLines.slice(6).map((line, i) => (
                        <div key={i} className="flex gap-2.5 py-1">
                          <Check size={15} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                          <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{line}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Ký hợp đồng */}
            <div className="px-5 py-6 sm:px-7" style={{ background: "var(--sf2)" }}>
              <p className="eyebrow mb-2">{lang === "vi" ? "Bên A · Studio" : "Party A · Studio"}</p>
              <div className="mb-4 flex items-center gap-3">
                {contract.studio_signature ? (
                  <img src={contract.studio_signature} alt="Chữ ký của studio" className="h-12 rounded bg-white p-1" />
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--tx3)" }}>{lang === "vi" ? "Studio chưa ký" : "Not signed yet"}</span>
                )}
                <span className="text-[13px] font-semibold">{contract.studio_signed_name || studioName}</span>
              </div>

              <p className="eyebrow mb-2">{lang === "vi" ? "Bên B · Khách hàng" : "Party B · Client"}</p>
              {signed ? (
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                    <Check size={16} /> {t("signedOn")} {fmtDateTime(contract.client_signed_at!)}
                  </p>
                  {contract.client_signature && (
                    <img src={contract.client_signature} alt="Chữ ký" className="mt-2.5 h-16 rounded bg-white p-1" />
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-3 text-center text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    {t("signAgree")}
                  </p>
                  <input
                    className="w-full rounded-[11px] px-3.5 py-3 text-[13.5px]"
                    style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx)" }}
                    placeholder={t("signerName")}
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                  <div className="mt-3">
                    <p className="eyebrow mb-1.5">{t("signature")}</p>
                    <SignaturePad onChange={setSignature} />
                  </div>
                  {err && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
                  <button
                    onClick={sign}
                    disabled={signing}
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14.5px] font-bold disabled:opacity-60"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <PenLine size={19} /> {signing ? t("signing") : t("sign")}
                  </button>
                </>
              )}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 rounded-[11px] py-2.5 text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                >
                  {t("pdf")}
                </button>
                <a
                  href={studioPhone ? `tel:${studioPhone}` : "#edit-request"}
                  className="flex-1 rounded-[11px] py-2.5 text-center text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                >
                  {lang === "vi" ? "Hỏi studio" : "Ask the studio"}
                </a>
              </div>
            </div>
          </div>

          {/* ══ Khối phụ ═══════════════════════════════════════════════════ */}

          {/* Phụ lục: thêm/bớt dịch vụ sau khi đã ký — khách ký thì mới cộng tiền. */}
          <ClientAddenda token={token} phone={phone} lang={lang} addenda={addenda} onSigned={() => fetchContract(phone)} />

          {/* Chọn gói dịch vụ */}
          {quoteOptions.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{t("quoteTitle")}</p>
              <div className="grid gap-2.5 px-5 py-4 sm:grid-cols-2">
                {quoteOptions.map((o) => {
                  const isChosen = chosenQuote === o.id;
                  return (
                    <div
                      key={o.id}
                      className="rounded-[12px] p-4"
                      style={{ background: isChosen ? "var(--acS)" : "var(--sf2)", border: `1px solid ${isChosen ? "var(--ac)" : "var(--bd)"}` }}
                    >
                      <p className="text-[14px] font-bold">{o.name}</p>
                      <p className="mt-0.5 text-[18px] font-bold" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(o.price)}</p>
                      {o.description && <p className="mt-1.5 whitespace-pre-wrap text-[12px]" style={{ color: "var(--tx2)" }}>{o.description}</p>}
                      <button
                        onClick={() => chooseQuote(o.id)}
                        disabled={isChosen}
                        className="mt-3 w-full rounded-[10px] py-2.5 text-[12.5px] font-bold"
                        style={isChosen
                          ? { border: "1px solid var(--ac)", color: "var(--ac)" }
                          : { background: "var(--ac)", color: "#fff" }}
                      >
                        {isChosen ? `✓ ${t("chosen")}` : t("choose")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Album chọn ảnh / album giao */}
          {selection && (
            <a href={`/a/${selection.slug}`} target="_blank" rel="noreferrer" className={`${sectionCls} flex items-center gap-3 px-5 py-4`} style={sectionStyle}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                {selection.phase === "delivery" ? <Images size={20} /> : <ImagePlus size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{selection.phase === "delivery" ? t("viewPhotos") : t("pickPhotos")}</p>
                <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {selection.title} · {selection.phase === "delivery" ? t("viewPhotosSub") : t("pickPhotosSub")}
                </p>
              </div>
              <span className="flex-none text-[13px] font-bold" style={{ color: "var(--ac)" }}>{t("open")}</span>
            </a>
          )}

          {gallery && (
            <a href={`/album/${gallery.slug}`} target="_blank" rel="noreferrer" className={`${sectionCls} flex items-center gap-3 px-5 py-4`} style={sectionStyle}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Images size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{t("viewPhotos")}</p>
                <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{gallery.title} · {t("viewPhotosSub")}</p>
              </div>
              <span className="flex-none text-[13px] font-bold" style={{ color: "var(--ac)" }}>{t("open")}</span>
            </a>
          )}

          {/* Quà tặng: thiệp cưới & love story */}
          {wedding && (
            <div className={`${sectionCls} px-5 py-4`} style={sectionStyle}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
                  <Heart size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">🎁 Thiệp cưới online tặng bạn</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Studio tặng bạn một thiệp cưới online — bạn tự điền thông tin, chọn ảnh &amp; chia sẻ cho khách mời.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={thiepUrl(`/sua/${wedding.edit_token}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                  <PenLine size={15} /> Chỉnh sửa thiệp của tôi
                </a>
                {wedding.published && (
                  <a href={thiepUrl(`/${wedding.slug}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                    <Images size={15} /> Xem thiệp
                  </a>
                )}
              </div>
            </div>
          )}

          {story && (
            <div className={`${sectionCls} px-5 py-4`} style={sectionStyle}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
                  <Heart size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">💞 Trang Love Story tặng bạn</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Trang chia sẻ khoảnh khắc — bạn điền nội dung &amp; dán link folder ảnh/video Google Drive của mình.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/story/sua/${story.edit_token}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                  <PenLine size={15} /> Chỉnh sửa trang của tôi
                </a>
                {story.published && (
                  <a href={`/story/${story.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                    <Images size={15} /> Xem trang
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tiến độ công việc */}
          {tasks.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <ListChecks size={17} style={{ color: "var(--ac)" }} />
                <p className="text-[14px] font-bold">{lang === "vi" ? "Tiến độ công việc" : "Progress"}</p>
                <span className="ml-auto rounded-[20px] px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                  {tasks.filter((x) => x.done).length}/{tasks.length}
                </span>
              </div>
              <div className="px-5 py-3">
                {tasks.map((tk) => (
                  <div key={tk.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px]" style={{ border: "1px solid var(--bd)", background: tk.done ? "var(--gn)" : "transparent" }}>
                      {tk.done && <Check size={13} color="#fff" />}
                    </span>
                    <span className="text-[13px]" style={{ color: tk.done ? "var(--tx3)" : "var(--tx)", textDecoration: tk.done ? "line-through" : "none" }}>
                      {tk.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sản phẩm đính kèm */}
          {products.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{lang === "vi" ? "Sản phẩm đính kèm" : "Products"}</p>
              <div className="px-5 py-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Package size={16} style={{ flex: "none", color: "var(--tx3)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{p.name}{p.qty > 1 ? ` ×${p.qty}` : ""}</p>
                      <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {PRODUCT_STATUS_LABEL[p.status as keyof typeof PRODUCT_STATUS_LABEL] || p.status}
                      </p>
                    </div>
                    {p.cost > 0 && <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(p.cost * (p.qty || 1))}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chi phí phát sinh */}
          {expenses.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{lang === "vi" ? "Chi phí phát sinh" : "Extra costs"}</p>
              <div className="px-5 py-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{e.title}</p>
                      {e.spent_at && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{fmtDate(e.spent_at)}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brief buổi chụp */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("briefTitle")}</p>
            <div className="px-5 py-4">
              <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("briefPrompt")}</p>
              <div className="space-y-2.5">
                <input className="input w-full" placeholder={t("briefConcept")} value={brief.concept} onChange={(e) => setBrief((p) => ({ ...p, concept: e.target.value }))} />
                <input className="input w-full" placeholder={t("briefOutfit")} value={brief.outfit} onChange={(e) => setBrief((p) => ({ ...p, outfit: e.target.value }))} />
                <input className="input w-full" placeholder={t("briefRefs")} value={brief.refs} onChange={(e) => setBrief((p) => ({ ...p, refs: e.target.value }))} />
                <textarea className="input min-h-[70px] w-full" placeholder={t("briefNote")} value={brief.note} onChange={(e) => setBrief((p) => ({ ...p, note: e.target.value }))} />
                <button
                  onClick={submitBrief}
                  className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold"
                  style={{ background: "var(--ac)", color: "#fff" }}
                >
                  {briefSent ? <Check size={15} /> : null} {briefSent ? t("briefSaved") : t("briefSave")}
                </button>
              </div>
            </div>
          </div>

          {/* Đánh giá studio */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("review")}</p>
            <div className="px-5 py-4">
              {reviewSent ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {t("reviewThanks")}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("reviewPrompt")}</p>
                  <div className="mb-3 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRating(n)} aria-label={`${n} sao`}>
                        <Star size={26} style={{ color: n <= rating ? "var(--am)" : "var(--tx3)" }} fill={n <= rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <textarea className="input min-h-[80px] w-full" placeholder={t("reviewPh")} value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
                  <button
                    onClick={sendReview}
                    disabled={!rating && !reviewText.trim()}
                    className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Star size={15} /> {t("sendReview")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Link Messenger */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("messenger")}</p>
            <div className="px-5 py-4">
              <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("messengerPrompt")}</p>
              <div className="flex flex-wrap gap-2">
                <input className="input min-w-[200px] flex-1" placeholder="m.me/… hoặc facebook.com/…" value={messenger} onChange={(e) => setMessenger(e.target.value)} />
                <button onClick={saveMessenger} className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                  {msgrSaved ? <Check size={15} /> : null} {msgrSaved ? t("saved") : t("saveLink")}
                </button>
              </div>
            </div>
          </div>

          {/* Yêu cầu chỉnh sửa */}
          <div id="edit-request" className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("editReq")}</p>
            <div className="px-5 py-4">
              {sent ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {t("editSent")}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("editPrompt")}</p>
                  <textarea className="input min-h-[90px] w-full" placeholder={t("editPh")} value={editMsg} onChange={(e) => setEditMsg(e.target.value)} />
                  <button
                    onClick={sendEdit}
                    disabled={sending || !editMsg.trim()}
                    className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Send size={15} /> {sending ? t("sending") : t("send")}
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="pb-2 text-center text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {t("updated")}: {fmtDateTime(contract.updated_at)}
          </p>
        </div>
      </div>

      {/* Print-only formal document (black on white) */}
      <ContractPrintDoc
        contract={contract}
        studioName={studioName}
        studioLogo={studioLogo}
        studioPhone={studioPhone}
        bank={bank}
        items={items}
        products={products}
        payments={payments}
        plan={plan}
        milestones={milestones}
        itemsTotal={itemsTotal}
        surcharge={surcharge}
        printing={printing}
        total={total}
        collected={collected}
        balance={balance}
        qr={qr}
      />
    </>
  );
}
