"use client";

import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, AlertCircle, Crown, Clock, QrCode } from "lucide-react";
import { VietQR } from "@/components/VietQR";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { UPGRADE_PAYMENT_LABEL, type UpgradePaymentStatus } from "@/lib/upgrade-payment";
import PaymentViewV2 from "./PaymentViewV2";
import { usePayment, type PaymentProps } from "./usePayment";

const TONE: Record<UpgradePaymentStatus, { fg: string; soft: string }> = {
  none: { fg: "var(--tx3)", soft: "var(--sf2)" },
  awaiting_confirm: { fg: "var(--am)", soft: "var(--amS)" },
  paid: { fg: "var(--gn)", soft: "var(--gnS)" },
  failed: { fg: "var(--rd)", soft: "var(--rdS)" },
};

/** Trang thanh toán: giao diện mới (PaymentViewV2) hay bản cũ — xem UiV2Context. */
export default function PaymentView(props: PaymentProps) {
  return useUiV2() ? <PaymentViewV2 {...props} /> : <PaymentViewV1 {...props} />;
}

function PaymentViewV1(props: PaymentProps) {
  const { amount, code, bank, autoConfirm = false } = props;
  // Logic dùng chung với bản mới — xem ./usePayment.
  const { status, note, busy, err, copied, planLabel, cycleLabel, declare, copyCode, payable } = usePayment(props);

  const tone = TONE[status];

  return (
    <div className="page-in mx-auto max-w-xl">
      <Link href="/dashboard/upgrade" className="mb-5 inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text2)" }}>
        <ArrowLeft size={15} /> Về trang gói dịch vụ
      </Link>

      <div className="mb-5">
        <p className="eyebrow mb-1.5">Thanh toán</p>
        <h1 className="font-serif text-[clamp(24px,4vw,34px)] font-medium leading-tight">
          Gói {planLabel} · {cycleLabel}
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text2)" }}>
          {autoConfirm ? (
            <>
              Quét mã QR bên dưới (giữ nguyên số tiền &amp; nội dung). Tiền về là gói được <b>nâng tự động</b> sau vài
              giây, trang này tự cập nhật.
            </>
          ) : (
            <>
              Chuyển khoản đúng số tiền &amp; nội dung bên dưới, rồi bấm <b>Tôi đã chuyển khoản</b>.
              Bên mình đối chiếu sao kê và nâng gói cho bạn.
            </>
          )}
        </p>
      </div>

      {/* Trạng thái đơn — luôn hiện, kể cả khi chưa chuyển. */}
      <div className="mb-5 flex items-center gap-2.5 rounded-2xl p-3.5" style={{ background: tone.soft, border: `1px solid ${tone.fg}33` }}>
        {/* "Chờ chuyển khoản" KHÔNG dùng vòng xoay: đây là trạng thái đang chờ
            NGƯỜI DÙNG hành động, không phải trang đang tải — một vòng xoay đứng
            im ở đó chỉ làm studio tưởng máy treo. */}
        {status === "paid" ? <Crown size={18} style={{ color: tone.fg }} />
          : status === "failed" ? <AlertCircle size={18} style={{ color: tone.fg }} />
          : status === "awaiting_confirm" ? <Clock size={18} style={{ color: tone.fg }} />
          : <QrCode size={18} style={{ color: tone.fg }} />}
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold" style={{ color: tone.fg }}>{UPGRADE_PAYMENT_LABEL[status]}</p>
          {status === "awaiting_confirm" && (
            <p className="text-[12px]" style={{ color: "var(--text2)" }}>
              Bên mình sẽ xác nhận sau khi thấy tiền trong sao kê. Trang này tự cập nhật, bạn không cần chờ ở đây.
            </p>
          )}
          {status === "paid" && (
            <p className="text-[12px]" style={{ color: "var(--text2)" }}>Gói đã được kích hoạt — tải lại trang để dùng ngay các tính năng mới.</p>
          )}
          {status === "failed" && (
            <p className="text-[12px]" style={{ color: "var(--text2)" }}>
              {note || "Bên mình chưa nhận được tiền. Kiểm tra lại nội dung chuyển khoản rồi báo lại nhé."}
            </p>
          )}
        </div>
      </div>

      {status !== "paid" && (
        <div className="card p-6">
          {payable ? (
            <>
              <VietQR bank={bank} amount={amount} addInfo={code || ""} />
              {code && (
                <p className="mt-4 text-center text-[12px]" style={{ color: "var(--text3)" }}>
                  Ghi đúng nội dung{" "}
                  <button onClick={copyCode} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono font-semibold" style={{ background: "var(--surface2)", color: "var(--text)" }}>
                    {copied ? <Check size={11} /> : <Copy size={11} />} {code}
                  </button>{" "}
                  để bên mình đối chiếu được ngay.
                </p>
              )}
            </>
          ) : (
            <p className="text-center text-[13px]" style={{ color: "var(--text3)" }}>
              {amount > 0
                ? "MStudo chưa cấu hình tài khoản nhận thanh toán — nhắn nhóm Zalo hỗ trợ để được hướng dẫn chuyển khoản."
                : "Đơn này không cần thanh toán."}
            </p>
          )}

          <button
            onClick={declare}
            disabled={busy || !payable}
            className="btn-primary mt-6 w-full rounded-xl py-3 text-[14px] disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{" "}
            {busy ? "Đang gửi…" : status === "awaiting_confirm" ? "Báo lại là đã chuyển khoản" : "Tôi đã chuyển khoản"}
          </button>
          {err && <p className="mt-2 text-center text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>}
          <p className="mt-3 text-center text-[11.5px]" style={{ color: "var(--text3)" }}>
            Bấm nút này là <b>báo</b> đã chuyển — gói chỉ lên sau khi bên mình xác nhận đã nhận được tiền.
          </p>
        </div>
      )}
    </div>
  );
}
