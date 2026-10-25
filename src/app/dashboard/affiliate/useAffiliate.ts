"use client";

import { useEffect, useState } from "react";
import { mainUrl } from "@/lib/hosts";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Affiliate (bản cũ AffiliateV1 trong page.tsx
   và bản mới AffiliateV2): tải mã giới thiệu + thống kê hoa hồng, chép / chia
   sẻ link. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Commission {
  id: string;
  referred_email: string | null;
  plan: string;
  cycle: string;
  sale_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã nhận",
  cancelled: "Đã huỷ",
};

/** Che bớt email người được giới thiệu: "ab***@gmail.com". */
export const maskEmail = (e: string) => e.replace(/(.{2}).+(@.+)/, "$1***$2");

/** CHỈ cho màn xem trước (/uipreview): có thì dùng số này, không gọi API. */
export type AffiliateSeed = {
  code: string | null;
  commissions: Commission[];
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
};

export function useAffiliate(seed?: AffiliateSeed) {
  const [code, setCode] = useState<string | null>(seed?.code ?? null);
  const [copied, setCopied] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>(seed?.commissions ?? []);
  const [totalEarned, setTotalEarned] = useState(seed?.totalEarned ?? 0);
  const [totalPaid, setTotalPaid] = useState(seed?.totalPaid ?? 0);
  const [totalPending, setTotalPending] = useState(seed?.totalPending ?? 0);
  const [loading, setLoading] = useState(!seed);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (seed) return;
    (async () => {
      const [codeRes, statsRes] = await Promise.all([
        fetch("/api/affiliate/code").then((r) => r.json()).catch(() => null),
        fetch("/api/affiliate/stats").then((r) => r.json()).catch(() => null),
      ]);
      if (codeRes?.code) setCode(codeRes.code);
      if (statsRes) {
        setCommissions(statsRes.commissions ?? []);
        setTotalEarned(statsRes.totalEarned ?? 0);
        setTotalPaid(statsRes.totalPaid ?? 0);
        setTotalPending(statsRes.totalPending ?? 0);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refLink = code ? `${mainUrl("/")}?ref=${code}` : "";

  function copyLink() {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareLink() {
    if (!refLink) return;
    if (navigator.share) {
      navigator.share({ title: "Giới thiệu mstudo", url: refLink });
    } else {
      copyLink();
    }
  }

  const visible = showAll ? commissions : commissions.slice(0, 5);

  return {
    code, copied, commissions, totalEarned, totalPaid, totalPending, loading,
    showAll, setShowAll, refLink, copyLink, shareLink, visible,
  };
}

export type AffiliateState = ReturnType<typeof useAffiliate>;
