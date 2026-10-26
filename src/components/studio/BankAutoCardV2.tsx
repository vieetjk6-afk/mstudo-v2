"use client";

import dynamic from "next/dynamic";
import { Check, ChevronRight, Copy, ExternalLink, Eye, EyeOff, Pause, Play, PlayCircle, RefreshCw, Zap } from "lucide-react";
import { Badge, Callout, Field, Section, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { vnd } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { BANK_TXN_STATUS_LABEL, BANK_TXN_NOTE_LABEL } from "@/lib/bank-reconcile";
import { SEPAY_SIGNUP_URL, useBankAuto, type BankTxn } from "./useBankAuto";

// Video hướng dẫn nặng, chỉ tải khi bấm "Xem video hướng dẫn" (xem BankAutoCard).
const SepayGuideVideo = dynamic(() => import("@/components/SepayGuideVideo"), { ssr: false });

/* ═══════════════════════════════════════════════════════════════════════════
   TỰ XÁC NHẬN CHUYỂN KHOẢN (SePay) — giao diện mới. Cùng logic với BankAutoCard
   (./useBankAuto): bật webhook, chép URL + khoá dán vào SePay, tạm dừng / đổi
   khoá, và gán tay các giao dịch không có mã đợt.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<BankTxn["status"], Tone> = {
  matched: "green",
  unmatched: "amber",
  mismatch: "red",
  ignored: "gray",
};

export default function BankAutoCardV2() {
  const b = useBankAuto();
  const { hook, busy } = b;
  const muted = { color: "var(--tx3)" } as const;

  return (
    <Section
      id="tu-xac-nhan"
      icon={Zap}
      title="Tự xác nhận chuyển khoản"
      desc={
        <>
          Nối tài khoản ngân hàng qua <b>SePay</b> (có gói miễn phí). Khách quét QR của đợt nào, tiền về là app tự ghi thu đúng
          đợt đó, báo cho bạn và nhắn Zalo xác nhận cọc cho khách.
        </>
      }
      actions={
        hook ? (
          <Badge tone={hook.enabled ? "green" : "gray"} dot>
            {hook.enabled ? "Đang bật" : "Tạm dừng"}
          </Badge>
        ) : undefined
      }
    >
      {b.toastNode}
      <div className="flex flex-col gap-4">
        <div>
          <button type="button" className={btn("ghost", "sm", "-ml-2")} onClick={() => b.setVideo((v) => !v)} aria-expanded={b.video}>
            <PlayCircle size={15} /> {b.video ? "Ẩn video hướng dẫn" : "Xem video hướng dẫn (1 phút)"}
          </button>
          {b.video && (
            <div className="mt-3 max-w-3xl">
              <SepayGuideVideo autoPlay />
              <a href="/huong-dan/sepay.mp4" download className="mt-2 inline-block text-[12px] underline" style={muted}>
                Tải video MP4 (gửi cho người làm cài đặt giúp bạn)
              </a>
            </div>
          )}
        </div>

        {b.loading ? (
          <p className="text-[13px]" style={muted}>Đang tải…</p>
        ) : b.missingFile ? (
          <Callout tone="amber" title="Database chưa có phần đối soát ngân hàng">
            Mở{" "}
            <a href="/api/setup-sql/doi-soat-ngan-hang" target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--ac)" }}>
              nội dung file {b.missingFile}
            </a>
            , chép toàn bộ, dán vào Supabase → SQL Editor rồi Run, sau đó tải lại trang.
          </Callout>
        ) : !hook ? (
          <div className="flex flex-col items-start gap-2">
            <button type="button" className={btn("soft")} disabled={busy === "enable"} onClick={() => b.act("enable")}>
              <Zap size={16} /> {busy === "enable" ? "Đang bật…" : "Bật tự xác nhận"}
            </button>
            <p className="text-[12.5px]" style={muted}>
              Bật xong sẽ có URL webhook và khoá để dán vào SePay. Chưa cấu hình SePay thì chưa có gì thay đổi.
            </p>
            <p className="text-[12.5px]" style={muted}>
              Chưa có tài khoản SePay?{" "}
              <a href={SEPAY_SIGNUP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline" style={{ color: "var(--ac)" }}>
                Đăng ký miễn phí <ExternalLink size={12} />
              </a>
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="URL webhook (dán vào SePay)" htmlFor="sepay-url">
                <div className="flex items-center gap-2">
                  <input id="sepay-url" className={`${inputCls} min-w-0 font-mono text-[12.5px]`} readOnly value={b.webhookUrl} onFocus={(e) => e.target.select()} />
                  <button type="button" className={iconBtn()} onClick={() => b.copy(b.webhookUrl, "url")} aria-label="Chép URL" title="Chép URL">
                    {b.copied === "url" ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="API Key (kiểu chứng thực: API Key)" htmlFor="sepay-key">
                <div className="flex items-center gap-1.5">
                  <input
                    id="sepay-key"
                    className={`${inputCls} min-w-0 font-mono text-[12.5px]`}
                    readOnly
                    type={b.showKey ? "text" : "password"}
                    value={hook.secret}
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className={iconBtn()} onClick={() => b.setShowKey((v) => !v)} aria-label={b.showKey ? "Ẩn khoá" : "Hiện khoá"} title={b.showKey ? "Ẩn khoá" : "Hiện khoá"}>
                    {b.showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className={iconBtn()} onClick={() => b.copy(hook.secret, "key")} aria-label="Chép khoá" title="Chép khoá">
                    {b.copied === "key" ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </Field>
            </div>

            <details className="group rounded-[12px] px-3.5 py-2.5" style={{ background: "var(--sf2)" }}>
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                <ChevronRight size={15} className="flex-none transition-transform group-open:rotate-90" style={muted} />
                Cách cài trên SePay (5 phút)
              </summary>
              <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                <li>
                  Đăng ký tại{" "}
                  <a href={SEPAY_SIGNUP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline" style={{ color: "var(--ac)" }}>
                    my.sepay.vn <ExternalLink size={12} />
                  </a>{" "}
                  và chọn gói Miễn phí.
                </li>
                <li>Liên kết tài khoản ngân hàng mà bạn đang dùng để nhận tiền (đúng số tài khoản trên QR của bảng giá).</li>
                <li>Vào <b>Tích hợp WebHooks</b> → <b>Thêm webhooks</b>. Sự kiện: <b>Có tiền vào</b>.</li>
                <li>Dán <b>URL webhook</b> ở trên. Kiểu chứng thực: <b>API Key</b>, rồi dán <b>API Key</b> ở trên.</li>
                <li>Bấm Thêm, rồi tự <b>chuyển thử 10.000đ</b> vào tài khoản đó: vài giây sau giao dịch hiện ở danh sách bên dưới là đã nối xong (bấm Bỏ qua).</li>
              </ol>
              <p className="mt-2 text-[12.5px]" style={muted}>
                Mọi mã QR của đợt thanh toán giờ có sẵn mã đợt (dạng <span className="font-mono">MS…</span>) ở đầu nội dung.
                Cọc giữ ngày dùng mã <span className="font-mono">COC-…</span> có sẵn. Khách sửa mất mã thì giao dịch vào danh sách chờ gán tay.
              </p>
            </details>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btn("secondary", "sm")} disabled={!!busy} onClick={() => b.act(hook.enabled ? "pause" : "resume", {}, "toggle")}>
                {hook.enabled ? <Pause size={14} /> : <Play size={14} />} {hook.enabled ? "Tạm dừng" : "Bật lại"}
              </button>
              <button
                type="button"
                className={btn("ghost", "sm")}
                disabled={!!busy}
                onClick={async () => {
                  if (!confirm("Đổi khoá? Khoá cũ hết hiệu lực ngay, bạn phải dán khoá mới vào SePay.")) return;
                  if (await b.act("rotate")) b.toast("Đã đổi khoá. Nhớ cập nhật trên SePay.");
                }}
              >
                <RefreshCw size={14} /> Đổi khoá
              </button>
              <span className="text-[12px]" style={muted}>
                {hook.last_event_at ? `Lần cuối SePay báo về: ${fmtDateTime(hook.last_event_at)}` : "SePay chưa báo giao dịch nào."}
              </span>
            </div>

            {/* ── Giao dịch gần đây ─────────────────────────────────────── */}
            <div className="flex flex-col gap-2.5 pt-4" style={{ borderTop: "1px solid var(--bd2)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-semibold">Giao dịch gần đây</p>
                {b.pending.length > 0 && <Badge tone="amber" dot>{b.pending.length} chờ bạn xử lý</Badge>}
              </div>
              {b.txns.length === 0 ? (
                <p className="text-[13px]" style={muted}>Chưa có giao dịch nào.</p>
              ) : (
                <ul className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
                  {b.txns.map((t, i) => {
                    const open = t.status === "unmatched" || t.status === "mismatch";
                    const depositUnder = !!t.booking_id && t.note === "deposit_under";
                    return (
                      <li key={t.id} className="px-3.5 py-3" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 basis-[240px]">
                            <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold">
                              <span className="v2-num" style={{ color: t.status === "ignored" ? "var(--tx2)" : "var(--gn)" }}>+{vnd(t.amount)}</span>
                              <span className="text-[12px] font-normal" style={muted}>
                                {fmtDateTime(t.txn_at || t.created_at)}
                                {t.gateway ? ` · ${t.gateway}` : ""}
                              </span>
                            </p>
                            <p className="truncate text-[12.5px]" style={{ color: "var(--tx2)" }} title={t.content || ""}>
                              {t.content || "(không có nội dung)"}
                            </p>
                            {t.note && BANK_TXN_NOTE_LABEL[t.note] && (
                              <p className="text-[12px]" style={muted}>{BANK_TXN_NOTE_LABEL[t.note]}</p>
                            )}
                          </div>
                          <div className="flex flex-none items-center gap-1.5">
                            {t.contract_id && (
                              <a href={`/dashboard/studio/contracts/${t.contract_id}?tab=pay`} className={btn("ghost", "sm")}>
                                Mở hợp đồng
                              </a>
                            )}
                            {t.booking_id && !t.contract_id && (
                              <a href="/dashboard/studio/bookings" className={btn("ghost", "sm")}>
                                Mở đặt lịch
                              </a>
                            )}
                            <Badge tone={STATUS_TONE[t.status]}>{BANK_TXN_STATUS_LABEL[t.status]}</Badge>
                          </div>
                        </div>
                        {open && depositUnder && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className={btn("secondary", "sm")}
                              disabled={!!busy}
                              onClick={async () => {
                                if (!confirm(`Nhận ${vnd(t.amount)} làm cọc giữ ngày? Mức cọc của yêu cầu đặt lịch sẽ đổi thành số này và được xác nhận.`)) return;
                                if (await b.act("accept_deposit", { txnId: t.id }, `dep-${t.id}`)) b.toast("Đã xác nhận cọc giữ ngày.");
                              }}
                            >
                              {busy === `dep-${t.id}` ? "Đang xác nhận…" : `Nhận ${vnd(t.amount)} làm cọc`}
                            </button>
                            <button type="button" className={btn("ghost", "sm")} disabled={!!busy} onClick={() => b.act("ignore", { txnId: t.id }, `ignore-${t.id}`)}>
                              Bỏ qua
                            </button>
                          </div>
                        )}
                        {open && !depositUnder && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <select
                              className={`${inputCls} min-w-0 flex-1 basis-[240px] sm:max-w-md`}
                              style={{ height: 32 }}
                              value={b.pick[t.id] || ""}
                              onChange={(e) => b.setPick((p) => ({ ...p, [t.id]: e.target.value }))}
                              aria-label="Chọn đợt để gán"
                            >
                              <option value="">Chọn đợt thanh toán để gán…</option>
                              {b.plans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {(p.contract?.client_name || p.contract?.title || "Hợp đồng")} · {p.label} · {vnd(p.amount)}
                                  {p.amount === t.amount ? " ✓ khớp tiền" : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={btn("secondary", "sm")}
                              disabled={!b.pick[t.id] || !!busy}
                              onClick={async () => {
                                if (await b.act("assign", { txnId: t.id, planId: b.pick[t.id] }, `assign-${t.id}`)) b.toast("Đã ghi thu vào đợt.");
                              }}
                            >
                              {busy === `assign-${t.id}` ? "Đang ghi…" : "Gán & ghi thu"}
                            </button>
                            <button type="button" className={btn("ghost", "sm")} disabled={!!busy} onClick={() => b.act("ignore", { txnId: t.id }, `ignore-${t.id}`)}>
                              Bỏ qua
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
