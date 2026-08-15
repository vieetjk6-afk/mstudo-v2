"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Check, X, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead, EmptyState } from "@/components/studio/ui";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDate } from "@/lib/date";
import { vnd, type StudioReferral } from "@/lib/types";
import { REFERRAL_STATUS_LABEL, referralBookingUrl } from "@/lib/referral";

const TONE: Record<StudioReferral["status"], { fg: string; bg: string }> = {
  pending: { fg: "var(--am)", bg: "var(--amS)" },
  earned: { fg: "var(--gn)", bg: "var(--gnS)" },
  granted: { fg: "var(--tx3)", bg: "var(--sf2)" },
  cancelled: { fg: "var(--rd)", bg: "var(--rdS)" },
};

/**
 * Sổ khách giới thiệu khách.
 *
 * Vòng đời: khách mới đặt lịch kèm SĐT người giới thiệu → "Chờ khách chốt" →
 * studio chốt được hợp đồng thì bấm "Đã chốt" → tặng thưởng xong bấm "Đã tặng".
 * Cố ý KHÔNG tự chuyển sang "đã chốt": ghép một yêu cầu đặt lịch với hợp đồng
 * nào là việc studio biết, đoán máy móc theo SĐT sẽ ghép nhầm khi một khách có
 * nhiều hợp đồng.
 */
export default function ReferralsPanel({
  rows,
  bookingUrl,
}: {
  rows: StudioReferral[];
  /** Link đặt lịch gốc của studio; null khi studio chưa bật link đặt lịch. */
  bookingUrl: string | null;
}) {
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

  return (
    <Panel className="mt-3.5">
      <PanelHead
        icon={Gift}
        tone="green"
        title="Khách giới thiệu khách"
        count={list.length ? String(list.length) : undefined}
        note={owed > 0 ? `Cần tặng thưởng: ${vnd(owed)}` : undefined}
      />

      {list.length === 0 ? (
        <div className="p-2">
          <EmptyState
            icon={Gift}
            title="Chưa có lượt giới thiệu nào"
            hint={
              bookingUrl
                ? "Gửi link đặt lịch kèm SĐT của khách cũ để ghi nhận lượt giới thiệu. Bật mức thưởng trong Dịch vụ & điều khoản → Chính sách studio."
                : "Bật link đặt lịch ở mục Đặt lịch khách trước, rồi gửi kèm SĐT khách cũ."
            }
          />
        </div>
      ) : (
        <div className="px-2 pb-2">
          {list.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-2 py-[9px]">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold" style={avatarStyle(r.referrer_name || r.referrer_phone)}>
                {initials(r.referrer_name || r.referrer_phone)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold">
                  {r.referrer_name || r.referrer_phone} → {r.referred_name || r.referred_phone}
                </span>
                <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                  {fmtDate(r.created_at.slice(0, 10))}
                  {r.reward_amount > 0 ? ` · thưởng ${vnd(r.reward_amount)}` : ""}
                </span>
              </span>

              <span className="flex-none rounded-[20px] px-2.5 py-1 text-[11px] font-bold" style={{ background: TONE[r.status].bg, color: TONE[r.status].fg }}>
                {REFERRAL_STATUS_LABEL[r.status]}
              </span>

              <span className="flex flex-none items-center gap-1.5">
                {bookingUrl && (
                  <button
                    onClick={() => copyLink(r.referrer_phone)}
                    className="act-btn act-btn-auto"
                    title="Chép link đặt lịch có sẵn mã giới thiệu của khách này"
                  >
                    {copied === r.referrer_phone ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
                {r.status === "pending" && (
                  <button onClick={() => setStatus(r.id, "earned")} disabled={busy === r.id} className="act-btn act-btn-auto">
                    <Check size={13} /> Đã chốt
                  </button>
                )}
                {r.status === "earned" && (
                  <button onClick={() => setStatus(r.id, "granted")} disabled={busy === r.id} className="act-btn act-btn-auto">
                    <Gift size={13} /> Đã tặng
                  </button>
                )}
                {(r.status === "pending" || r.status === "earned") && (
                  <button onClick={() => setStatus(r.id, "cancelled")} disabled={busy === r.id} className="act-btn act-btn-auto" title="Không thành">
                    <X size={13} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="px-4 pb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>
        Mức thưởng và ưu đãi đặt trong{" "}
        <Link href="/dashboard/studio/services" className="font-semibold hover:underline" style={{ color: "var(--ac)" }}>
          Dịch vụ &amp; điều khoản → Chính sách studio
        </Link>
        .
      </p>
    </Panel>
  );
}
