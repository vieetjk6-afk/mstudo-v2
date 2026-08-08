"use client";

import { useEffect, useState } from "react";
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

/**
 * `strip` (mặc định) — một dòng gọn nằm trên lưới album.
 * `panel` — khối "Hạn mức đang dùng" của bản thiết kế (màn Gói phần mềm):
 *   icon nền nhạt + tên gói + các ô hạn mức có thanh tiến độ.
 */
export default function PlanUsage({
  showUpgrade = true,
  variant = "strip",
}: { showUpgrade?: boolean; variant?: "strip" | "panel" }) {
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

  if (variant === "panel") {
    const pct = usage.limit == null ? 0 : Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));
    const cells: { l: string; v: string; pct: number | null }[] = [
      {
        l: "Album tạo trong tháng",
        v: usage.limit == null ? `${usage.used} · không giới hạn` : `${usage.used}/${usage.limit}`,
        pct: usage.limit == null ? null : pct,
      },
      { l: "Gói đang dùng", v: PLAN_LABEL[usage.plan], pct: null },
      {
        l: "Hiệu lực đến",
        v: usage.expiresAt ? new Date(usage.expiresAt).toLocaleDateString("vi-VN") : "Không giới hạn",
        pct: null,
      },
    ];
    return (
      <div className="mb-3.5 rounded-[14px] px-[18px] py-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-[15px] flex items-center gap-[11px]">
          <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--brandSoft)", color: "var(--brand)", lineHeight: 0 }}>
            {usage.pro ? <Crown size={20} /> : <Sparkles size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Hạn mức đang dùng</p>
            <p className="mt-px text-[11.5px]" style={{ color: "var(--text3)" }}>
              Gói {PLAN_LABEL[usage.plan]}
              {usage.expiresAt ? ` · hết hạn ${new Date(usage.expiresAt).toLocaleDateString("vi-VN")}` : " · không giới hạn thời gian"}
            </p>
          </div>
          {reached ? (
            <span className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>
              Đã chạm hạn mức
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {cells.map((c) => (
            <div key={c.l}>
              <p className="text-[11.5px]" style={{ color: "var(--text3)" }}>{c.l}</p>
              <p className="tnum mb-[7px] mt-[3px] text-[13.5px] font-bold">{c.v}</p>
              {c.pct == null ? null : (
                <div className="h-[5px] overflow-hidden rounded-[4px]" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-[4px]" style={{ width: `${c.pct}%`, background: reached ? "var(--s-amber)" : "var(--brand)" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          <span style={{ color: "var(--text3)" }}> · Hết hạn {new Date(usage.expiresAt).toLocaleDateString("vi-VN")}</span>
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
