"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { referralBookingUrl } from "@/lib/referral";
import type { StudioReferral } from "@/lib/types";

/* Phần LOGIC dùng chung của sổ "Khách giới thiệu khách" — bản cũ
   ReferralsPanel và bản mới ReferralsV2 chỉ khác nhau ở cách vẽ. */
export function useReferrals(rows: StudioReferral[], bookingUrl: string | null) {
  const supabase = createClient();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function setStatus(id: string, status: StudioReferral["status"]) {
    setBusy(id);
    const patch: Record<string, unknown> = { status };
    if (status === "granted") patch.granted_at = new Date().toISOString();
    await supabase.from("studio_referrals").update(patch).eq("id", id);
    setList((p) => p.map((r) => (r.id === id ? { ...r, status, granted_at: status === "granted" ? new Date().toISOString() : r.granted_at } : r)));
    setBusy(null);
  }

  function copyLink(phone: string) {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(referralBookingUrl(bookingUrl, phone));
    setCopied(phone);
    setTimeout(() => setCopied(null), 1600);
  }

  const owed = list.filter((r) => r.status === "earned").reduce((s, r) => s + (r.reward_amount || 0), 0);

  return { list, busy, copied, setStatus, copyLink, owed };
}
