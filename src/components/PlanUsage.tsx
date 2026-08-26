"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import Link from "next/link";
import { Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_LABEL, effectivePlan, type Plan } from "@/lib/plans";

interface Usage {
  used: number;
  limit: number | null; // null = unlimited
  pro: boolean;
  plan: Plan;
  expiresAt: string | null;
}

export default function PlanUsage({ showUpgrade = true }: { showUpgrade?: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, monthly_album_limit, plan, plan_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("album_creations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());

      const isAdmin = profile?.role === "admin";
      const plan = isAdmin ? "studio" : effectivePlan(profile?.plan as Plan, profile?.plan_expires_at);

      setUsage({
        used: count ?? 0,
        limit: isAdmin ? null : profile?.monthly_album_limit ?? null,
        pro: plan !== "free",
        plan,
        expiresAt: plan === "free" ? null : profile?.plan_expires_at ?? null,
      });
    })();
  }, []);

  // Giữ chỗ đúng chiều cao trong lúc tải để lưới album không bị nhảy (CLS).
  if (!usage) {
    return (
      <div
        className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-3.5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        aria-hidden="true"
      >
        <span className="skeleton h-8 w-8 rounded-lg" />
        <span className="skeleton h-4 w-52 max-w-[60%] rounded" />
      </div>
    );
  }

  const reached = usage.limit != null && usage.used >= usage.limit;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3.5"
      style={{ background: "var(--surface)", border: `1px solid ${reached ? "var(--gold)" : "var(--border)"}` }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--surface2)", color: "var(--gold)" }}>
        {usage.pro ? <Crown size={16} /> : <Sparkles size={16} />}
      </span>
      <div className="text-sm">
        <span className="font-medium">Gói {PLAN_LABEL[usage.plan]}</span>
        <span style={{ color: "var(--text2)" }}>
          {" · "}
          {usage.limit == null
            ? `Đã tạo ${usage.used} album tháng này · không giới hạn`
            : `Đã tạo ${usage.used}/${usage.limit} album trong tháng này`}
        </span>
        {usage.expiresAt && (
          <span style={{ color: "var(--text3)" }}> · Hết hạn {fmtDate(usage.expiresAt)}</span>
        )}
      </div>
      {showUpgrade && !usage.pro && (
        <Link
          href="/dashboard/upgrade"
          className="ml-auto rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--gold)", color: "#1a1205" }}
        >
          Nâng cấp
        </Link>
      )}
    </div>
  );
}
