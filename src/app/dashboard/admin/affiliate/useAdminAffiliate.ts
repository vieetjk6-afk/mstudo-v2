"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Quản lý Affiliate" (bản cũ trong page.tsx và bản
   mới AdminAffiliateV2): tải hoa hồng + tỉ lệ, đổi trạng thái một khoản, lưu
   tỉ lệ hoa hồng theo gói. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AdminCommission {
  id: string;
  referrer_id: string;
  referred_email: string | null;
  plan: string;
  cycle: string;
  sale_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
  note: string | null;
  referrer: { full_name: string | null; email: string | null } | null;
}

export type Rates = { basic: number; photographer: number; photographer_plus: number; studio: number };
export const RATE_PLANS = ["basic", "photographer", "photographer_plus", "studio"] as const;

/** CHỈ cho màn xem trước (/uipreview): có thì dùng số này, không gọi API. */
export type AdminAffiliateSeed = { commissions: AdminCommission[]; rates: Rates };

export function useAdminAffiliate(seed?: AdminAffiliateSeed) {
  const [commissions, setCommissions] = useState<AdminCommission[]>(seed?.commissions ?? []);
  const [loading, setLoading] = useState(!seed);
  const [rates, setRates] = useState<Rates>(seed?.rates ?? { basic: 10, photographer: 10, photographer_plus: 10, studio: 10 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (seed) return;
    fetch("/api/affiliate/admin")
      .then((r) => r.json())
      .then((d) => {
        setCommissions(d.commissions ?? []);
        if (d.settings) {
          setRates({
            basic: d.settings.affiliate_commission_basic ?? 10,
            photographer: d.settings.affiliate_commission_photographer ?? 10,
            photographer_plus: d.settings.affiliate_commission_photographer_plus ?? 10,
            studio: d.settings.affiliate_commission_studio ?? 10,
          });
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/affiliate/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setCommissions((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: status as AdminCommission["status"], paid_at: status === "paid" ? new Date().toISOString() : null } : c)
    );
  }

  async function saveRates() {
    setSaving(true);
    await fetch("/api/affiliate/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rates),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const totalPending = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.commission_amount, 0);

  return { commissions, loading, rates, setRates, saving, saved, updateStatus, saveRates, totalPending, totalPaid };
}

export type AdminAffiliateState = ReturnType<typeof useAdminAffiliate>;
