"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import Link from "next/link";
import { Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_LABEL, effectivePlan, type Plan } from "@/lib/plans";
import type { PlanUsageData } from "@/lib/plan-usage";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { Badge, Progress, btn } from "@/components/v2/kit";

type Usage = PlanUsageData;

/**
 * `initial`: số liệu máy chủ đã tính sẵn (getPlanUsage ở @/lib/plan-usage) — có
 * thì hiện ngay, KHÔNG chạy ba truy vấn nối đuôi ở trình duyệt nữa. Chỗ nào chưa
 * truyền (trang tạo album, trang nâng cấp) vẫn tự tải như cũ.
 */
function usePlanUsage(initial: PlanUsageData | null): Usage | null {
  const [loaded, setUsage] = useState<Usage | null>(null);
  // Số của máy chủ luôn thắng (router.refresh() đưa số mới xuống qua prop).
  const usage = initial ?? loaded;

  useEffect(() => {
    if (initial) return;
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
  }, [initial]);
  return usage;
}

type Props = { showUpgrade?: boolean; initial?: PlanUsageData | null };

export default function PlanUsage(props: Props) {
  return useUiV2() ? <PlanUsageV2 {...props} /> : <PlanUsageV1 {...props} />;
}

function PlanUsageV1({ showUpgrade = true, initial = null }: Props) {
  const usage = usePlanUsage(initial);

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

/** Giao diện mới: một thẻ gọn — gói đang dùng, số album tháng này (kèm thanh
 *  tiến độ khi gói có hạn mức) và nút nâng cấp. Không có lề dưới riêng: màn V2
 *  xếp khối bằng <Stack>. */
function PlanUsageV2({ showUpgrade = true, initial = null }: Props) {
  const usage = usePlanUsage(initial);

  if (!usage) {
    return (
      <div className="v2-card flex items-center gap-3 px-4 py-3.5 sm:px-5" aria-hidden="true">
        <span className="skeleton h-9 w-9 rounded-[10px]" />
        <span className="skeleton h-4 w-52 max-w-[60%] rounded" />
      </div>
    );
  }

  const reached = usage.limit != null && usage.used >= usage.limit;
  const Icon = usage.pro ? Crown : Sparkles;

  return (
    <div
      className="v2-card flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5 sm:px-5"
      style={reached ? { borderColor: "color-mix(in srgb, var(--am) 45%, var(--bd))" } : undefined}
    >
      <span className="v2-stat-icon" style={{ width: 36, height: 36, color: "var(--ac)", background: "var(--acS)" }}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[14px] font-semibold">Gói {PLAN_LABEL[usage.plan]}</p>
          {reached ? <Badge tone="amber" dot>Hết lượt tạo album tháng này</Badge> : null}
          {usage.expiresAt ? <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Hết hạn {fmtDate(usage.expiresAt)}</span> : null}
        </div>
        <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
          {usage.limit == null
            ? `Đã tạo ${usage.used} album tháng này · không giới hạn`
            : `Đã tạo ${usage.used}/${usage.limit} album trong tháng này`}
        </p>
        {usage.limit != null && usage.limit > 0 ? (
          <div className="mt-2 max-w-[360px]">
            <Progress value={(usage.used / usage.limit) * 100} tone={reached ? "amber" : "brand"} />
          </div>
        ) : null}
      </div>
      {showUpgrade && !usage.pro && (
        <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
          <Crown size={14} /> Nâng cấp
        </Link>
      )}
    </div>
  );
}
