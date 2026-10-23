"use client";

import { useState } from "react";
import PlannerView, { type PlannerTab } from "@/app/portal/[token]/ke-hoach/PlannerView";
import type { PlannerPayload } from "@/app/portal/[token]/ke-hoach/types";
import { applyPlanOp, autoLinks, newPlan, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";

/**
 * Kế hoạch cưới của khách (/portal/<token>/ke-hoach) bằng dữ liệu giả. Bấm được
 * thật: thao tác đi qua chính `applyPlanOp` như trang thật, chỉ không gửi lên
 * máy chủ.
 *
 * Dữ liệu cố ý khó: tên đôi dài, khoản tiền 9 chữ số, ngân sách bị vượt, việc
 * đã quá hạn, lịch hẹn studio chen vào giữa lịch trình khách tự lập.
 */
export function KeHoachCuoiDemo({ tab = "tasks", variant }: { tab?: PlannerTab; variant?: "no-date" | "locked" }) {
  const today = "2026-10-23";
  const [plan, setPlan] = useState<WeddingPlanData>(() => {
    const p = newPlan({ weddingDate: variant === "no-date" ? null : "2027-01-16" });
    p.budget_total = 280_000_000;
    p.tasks = p.tasks.map((t, i) => (i < 6 ? { ...t, done: i !== 3 } : t));
    p.budget = p.budget.map((b) =>
      b.cat === "party" ? { ...b, estimate: 185_000_000, paid: 50_000_000 }
        : b.cat === "outfit" ? { ...b, name: "Váy cưới cô dâu (2 bộ) + áo dài lễ gia tiên + vest chú rể may đo", estimate: 32_500_000 }
          : b.cat === "ring" ? { ...b, estimate: 41_000_000, paid: 41_000_000 }
            : b,
    );
    p.day = variant === "no-date" ? [] : [
      { id: "d1", time: "05:00", title: "Trang điểm, làm tóc cô dâu", place: "Nhà gái — 12 Nguyễn Trãi, P. Bến Thành, Q.1", who: "Chị Mai makeup" },
      { id: "d2", time: "08:30", title: "Nhà trai đến — lễ gia tiên nhà gái (lễ vu quy)", place: "Nhà gái" },
      { id: "d3", time: "10:00", title: "Rước dâu về nhà trai", who: "Anh Tuấn lo xe" },
      { id: "d4", time: "", title: "Chụp ảnh với họ hàng nhà trai (chờ chốt giờ)" },
      { id: "d5", time: "18:00", title: "Đón khách, chụp ảnh với khách mời", place: "Trung tâm tiệc cưới Riverside Palace" },
    ];
    return p;
  });

  const data: PlannerPayload = {
    enabled: true,
    contract: { title: "Phóng sự cưới + prewedding Đà Lạt", client_name: "Nguyễn Hoàng Bảo Ngọc & Trần Đình Minh Khôi", event_date: "2026-11-02", status: "approved" },
    studio_name: "Mây Studio",
    studio_phone: "0909000000",
    plan,
    updated_at: "2026-10-22T09:00:00Z",
    auto: autoLinks({
      studioName: "Mây Studio",
      signed: true,
      shot: false,
      invitation: { published: false, href: "#" },
      album: null,
      total: 28_900_000,
      paid: 8_670_000,
    }),
    studio_line: { name: "Gói của Mây Studio", estimate: 28_900_000, paid: 8_670_000 },
    studio_day: variant === "no-date" ? [] : [{ id: "s1", time: "07:30", title: "Ê-kíp chụp có mặt", place: "Nhà gái", studio: true }],
    guests: variant === "no-date" ? null : { total: 186, attending: 92, people: 141, replies: 104, href: "#" },
    plan_locked: variant === "locked",
  };

  function onOp(op: PlanOp) {
    const r = applyPlanOp(plan, op);
    if (r.ok) setPlan(r.plan);
  }

  return <PlannerView data={data} plan={plan} today={today} backHref="#" onOp={onOp} saving="saved" initialTab={tab} />;
}
