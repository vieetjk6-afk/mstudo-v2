"use client";

import { useEffect, useRef, useState } from "react";
import type { BankInfo } from "@/components/VietQR";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import type { UpgradePaymentStatus } from "@/lib/upgrade-payment";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của trang thanh toán gói (bản cũ PaymentView và bản
   mới PaymentViewV2): hỏi lại trạng thái đơn theo nhịp, nút "Tôi đã chuyển
   khoản", chép nội dung chuyển khoản. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PaymentProps = {
  id: string;
  plan: string | null;
  cycle: "month" | "year";
  amount: number;
  code: string | null;
  initialStatus: UpgradePaymentStatus;
  initialNote: string | null;
  bank: BankInfo;
  /** mstudo đã nối SePay (SEPAY_MSTUDO_KEY): tiền về là gói tự nâng, không cần admin. */
  autoConfirm?: boolean;
};

export function usePayment({ id, plan, cycle, amount, code, initialStatus, initialNote, bank, autoConfirm = false }: PaymentProps) {
  const [status, setStatus] = useState<UpgradePaymentStatus>(initialStatus);
  const [note, setNote] = useState<string | null>(initialNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const declaredOnce = useRef(initialStatus === "awaiting_confirm");

  const planLabel = plan ? PLAN_LABEL[plan as Plan] ?? plan : "gói dịch vụ";
  const cycleLabel = cycle === "year" ? "1 năm" : "1 tháng";

  // Admin xác nhận ở máy khác, không có gì đẩy về trang này — hỏi lại 20 giây
  // một lần trong lúc studio còn đang chờ, để màn hình tự chuyển sang "đã nâng
  // cấp" thay vì bắt họ tải lại trang xem đã xong chưa. Xong (paid) thì dừng.
  //
  // CHỈ hỏi khi tab đang HIỆN, và hỏi ngay lúc người dùng quay lại: một tab bỏ
  // quên mà cứ gõ cửa 20 giây/lần là hơn 4.000 request mỗi ngày cho màn hình
  // không ai nhìn — đúng bài học đã ghi ở trang album của khách.
  //
  // Có SePay thì tiền về là gói tự nâng trong vài giây, nên hỏi dày hơn (6 giây)
  // và hỏi cả khi studio CHƯA bấm "Tôi đã chuyển": phần lớn người dùng quét QR
  // xong là chờ, không bấm gì thêm.
  useEffect(() => {
    const waiting = status === "awaiting_confirm" || (autoConfirm && status === "none");
    if (!waiting) return;
    let stopped = false;
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/upgrade-payment?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then((x) => x.json());
        if (!stopped && r?.ok && r.status && r.status !== status) {
          setStatus(r.status);
          setNote(r.reviewNote ?? null);
        }
      } catch {
        /* mất mạng một nhịp — lần sau hỏi lại */
      }
    };
    const t = setInterval(ask, autoConfirm ? 6_000 : 20_000);
    document.addEventListener("visibilitychange", ask);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [id, status, autoConfirm]);

  async function declare() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/upgrade-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).then((x) => x.json());
      if (r?.ok) {
        declaredOnce.current = true;
        setStatus("awaiting_confirm");
        setNote(null);
      } else {
        setErr(r?.error === "already_paid" ? "Đơn này đã được xác nhận rồi." : "Không gửi được, thử lại nhé.");
      }
    } catch {
      setErr("Lỗi mạng, thử lại nhé.");
    }
    setBusy(false);
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Không có tài khoản nhận tiền thì studio KHÔNG có gì để chuyển — để nút bấm
  // được chỉ tạo ra một đơn "chờ xác nhận" mà chẳng có khoản tiền nào tồn tại,
  // rồi admin ngồi dò một giao dịch không có thật.
  const payable = amount > 0 && !!bank.bin && !!bank.account;

  return { status, note, busy, err, copied, planLabel, cycleLabel, declare, copyCode, payable };
}

export type PaymentState = ReturnType<typeof usePayment>;
