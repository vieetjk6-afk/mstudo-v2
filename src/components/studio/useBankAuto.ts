"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/studio/Toast";

/* Trạng thái + thao tác của thẻ "Tự xác nhận chuyển khoản" (SePay) — dùng chung
   cho bản cũ (BankAutoCard) và bản giao diện mới (BankAutoCardV2). Xem ghi chú
   đầu BankAutoCard.tsx. */

/**
 * Link đăng ký SePay. mstudo là đối tác giới thiệu của SePay: đặt link giới
 * thiệu mặc định là của mstudo (gcid=1028); NEXT_PUBLIC_SEPAY_REF_URL chỉ để
 * đổi sang link khác mà không phải sửa code.
 */
export const SEPAY_SIGNUP_URL = process.env.NEXT_PUBLIC_SEPAY_REF_URL || "https://my.sepay.vn/register?gcid=1028";

export type BankHook = { secret: string; enabled: boolean; last_event_at: string | null; created_at: string };
export type BankTxn = {
  id: string;
  amount: number;
  content: string | null;
  gateway: string | null;
  txn_at: string | null;
  created_at: string;
  status: "matched" | "unmatched" | "mismatch" | "ignored";
  note: string | null;
  contract_id: string | null;
  booking_id: string | null;
};
export type BankOpenPlan = {
  id: string;
  label: string;
  amount: number;
  due_date: string | null;
  contract: { id: string; code: string | null; title: string; client_name: string | null } | null;
};

export function useBankAuto() {
  const { toast, toastNode } = useToast();
  const [loading, setLoading] = useState(true);
  const [missingFile, setMissingFile] = useState<string | null>(null);
  const [hook, setHook] = useState<BankHook | null>(null);
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [plans, setPlans] = useState<BankOpenPlan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");
  const [video, setVideo] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/studio/bank-hook", { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLoading(false);
    if (j.missing) return setMissingFile(j.file || "supabase/doi-soat-ngan-hang.sql");
    if (!r?.ok) return;
    setHook(j.hook ?? null);
    setTxns(j.txns ?? []);
    setPlans(j.plans ?? []);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  async function act(action: string, extra: Record<string, string> = {}, key = action) {
    setBusy(key);
    const r = await fetch("/api/studio/bank-hook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (j.missing) return setMissingFile(j.file || "supabase/doi-soat-ngan-hang.sql");
    if (!r?.ok) {
      const msg: Record<string, string> = {
        already_paid: "Đợt này vừa được đánh dấu thu rồi.",
        already_matched: "Giao dịch này đã ghi thu.",
        write_failed: "Không ghi được lần thu. Sổ kỳ này đã khoá?",
        deposit_done: "Cọc giữ ngày này đã được xác nhận rồi.",
      };
      toast(msg[j.error] || "Không thực hiện được, thử lại sau.");
      return false;
    }
    await load();
    return true;
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const webhookUrl = origin ? `${origin}/api/bank/sepay` : "/api/bank/sepay";
  const pending = txns.filter((t) => t.status === "unmatched" || t.status === "mismatch");

  return {
    toast, toastNode, loading, missingFile, hook, txns, plans, busy, showKey, setShowKey, copied, pick, setPick,
    video, setVideo, act, copy, webhookUrl, pending,
  };
}
