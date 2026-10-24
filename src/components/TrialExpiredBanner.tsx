"use client";

import Link from "next/link";
import { useState } from "react";
import { X, Crown } from "lucide-react";

interface Props {
  /** Plan that expired (e.g. "studio") */
  expiredPlan: string;
}

export default function TrialExpiredBanner({ expiredPlan }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const label = expiredPlan === "studio" ? "Studio" : expiredPlan.charAt(0).toUpperCase() + expiredPlan.slice(1);

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
      style={{ background: "rgba(214,164,74,.16)", borderBottom: "1px solid rgba(214,164,74,.3)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Crown size={15} style={{ color: "#d6a44a", flexShrink: 0 }} />
        <span style={{ color: "#d6a44a" }}>
          Thời gian dùng thử gói <b>{label}</b> đã kết thúc.
        </span>
        <Link
          href="/dashboard/upgrade"
          className="shrink-0 rounded-full px-3 py-0.5 text-xs font-bold"
          style={{ background: "#d6a44a", color: "#0c0c0d" }}
        >
          Nâng cấp ngay
        </Link>
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Đóng" title="Đóng" style={{ color: "#d6a44a", flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
