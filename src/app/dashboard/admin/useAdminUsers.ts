"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { planExpiry, planProfilePatch, type Plan } from "@/lib/plans";
import { activityLevel, type ActivityLevel } from "@/lib/activity";
import type { Profile } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của bảng "Người dùng & studio" (bản cũ AdminPanel và
   bản mới AdminPanelV2): danh sách tài khoản, lọc theo mức hoạt động / tìm,
   đổi gói (kèm dùng thử), đổi quyền & giới hạn, tạo / xoá tài khoản. Hai bản
   chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Thứ tự hiện dải số liệu: nhóm cần gọi điện trước đứng trước. */
export const LEVEL_ORDER: ActivityLevel[] = ["active", "idle", "dormant", "lost", "never"];

/** Số hàng dựng ra mỗi lần — chặn nổ DOM khi có hàng nghìn tài khoản. */
export const PAGE = 100;

/** Giá trị ô chọn gói của một tài khoản: "free" | "trial-<gói>" | "<gói>-<chu kỳ>". */
export const planValue = (p: Profile) =>
  p.plan === "free" ? "free" : p.plan_cycle === "trial" ? `trial-${p.plan}` : `${p.plan}-${p.plan_cycle ?? "month"}`;

export function useAdminUsers(profiles: Profile[]) {
  const { t } = useLang();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  /** Lọc theo mức hoạt động — "" = xem tất cả. */
  const [level, setLevel] = useState<ActivityLevel | "">("");
  /** Tìm theo email/tên — giúp admin lọc nhanh thay vì dựng cả bảng. */
  const [q, setQ] = useState("");
  const [shownCount, setShownCount] = useState(PAGE);

  // Chỉ đếm CHỦ tài khoản (studio_owner_id = null): nhân viên là tài khoản con
  // của một studio, đếm cả họ thì số "bao nhiêu studio đang dùng" bị thổi lên.
  const owners = useMemo(() => rows.filter((p) => !p.studio_owner_id), [rows]);

  const stats = useMemo(() => {
    const by: Record<ActivityLevel, number> = { never: 0, active: 0, idle: 0, dormant: 0, lost: 0 };
    for (const p of owners) by[activityLevel(p.last_active_at)]++;
    return by;
  }, [owners]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (level && (p.studio_owner_id || activityLevel(p.last_active_at) !== level)) return false;
      if (needle) {
        const hay = `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, level, q]);

  // Chỉ dựng PAGE hàng đầu; phần còn lại nạp thêm khi bấm "Xem thêm". Trước đây
  // dựng toàn bộ tài khoản (mỗi hàng nhiều ô select/input) nên bảng nặng dần
  // tuyến tính theo số khách.
  const shown = useMemo(() => visible.slice(0, shownCount), [visible, shownCount]);

  /** Gõ ô tìm: lọc lại và quay về trang đầu. */
  function search(v: string) {
    setQ(v);
    setShownCount(PAGE);
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  async function update(p: Profile, patch: Partial<Profile>) {
    const next = { ...p, ...patch };
    setRows((r) => r.map((x) => (x.id === p.id ? next : x)));
    const res = await fetch("/api/admin/photographers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, ...patch }),
    });
    if (!res.ok) flash(t("error"));
  }

  // Assign a plan with a billing cycle (sets auto-expiry server-side).
  // Xem trước cùng công thức server: mua theo năm được tặng thêm 30 ngày.
  async function setPlan(p: Profile, plan: Plan, cycle: "month" | "year") {
    const expires: string | null = plan === "free" ? null : planExpiry(cycle);
    const patch: Partial<Profile> = {
      ...planProfilePatch(plan),
      plan_cycle: plan === "free" ? null : cycle,
      plan_expires_at: expires,
    };
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    const res = await fetch("/api/admin/photographers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, plan, cycle }),
    });
    if (!res.ok) flash(t("error"));
  }

  // Cấp dùng thử miễn phí (Studio 7 ngày / Basic·Photographer 30 ngày). Admin ghi đè.
  async function setTrialPlan(p: Profile, plan: Plan) {
    const days = plan === "studio" ? 7 : 30;
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    const patch: Partial<Profile> = { ...planProfilePatch(plan), plan_cycle: "trial", plan_expires_at: expires };
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    const res = await fetch("/api/admin/photographers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, trial_plan: plan }),
    });
    if (!res.ok) flash(t("error"));
  }

  /** Áp một giá trị của ô chọn gói (xem planValue). */
  function applyPlanValue(p: Profile, v: string) {
    if (v === "free") setPlan(p, "free", "month");
    else if (v.startsWith("trial-")) setTrialPlan(p, v.slice(6) as Plan);
    else {
      const [pl, cy] = v.split("-");
      setPlan(p, pl as Plan, cy as "month" | "year");
    }
  }

  /** Xoá tài khoản (hỏi lại trước). Trả true khi đã xoá khỏi danh sách. */
  async function removeUser(p: Profile) {
    if (!window.confirm(t("confirmDeleteUser").replace("{email}", p.email))) return false;
    setRows((r) => r.filter((x) => x.id !== p.id));
    const res = await fetch(`/api/admin/photographers?id=${p.id}`, { method: "DELETE" });
    if (!res.ok) flash(t("error"));
    return true;
  }

  /** Tạo tài khoản từ `form`. Trả true khi tạo được (bản mới đóng ngăn kéo theo kết quả này). */
  async function createUser(e?: React.FormEvent) {
    e?.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/photographers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      flash(data.error ?? t("error"));
      return false;
    }
    setRows((r) => [
      ...r,
      {
        id: data.id,
        email: form.email,
        full_name: form.full_name || form.email,
        role: "photographer",
        max_albums: null,
        monthly_album_limit: 5,
        can_zip: false,
        can_notes: false,
        can_galleries: false,
        compress_daily_limit: 2,
        compress_picker_limit: 1,
        can_watermark_pro: false,
        plan: "free",
        plan_cycle: null,
        plan_expires_at: null,
        trial_used_at: null,
        studio_owner_id: null,
        studio_role: null,
        is_active: true,
        // Tài khoản vừa tạo chưa từng mở app — để null/0 để nó rơi đúng vào nhóm
        // "Chưa từng mở" thay vì trông như đang hoạt động.
        last_active_at: null,
        last_active_day: null,
        active_days: 0,
        visit_count: 0,
        created_at: new Date().toISOString(),
      },
    ]);
    setForm({ email: "", password: "", full_name: "" });
    flash(t("saved"));
    return true;
  }

  return {
    t, rows, msg, creating, form, setForm, level, setLevel, q, search, shownCount, setShownCount,
    owners, stats, visible, shown, update, setPlan, setTrialPlan, applyPlanValue, removeUser, createUser,
  };
}

export type AdminUsersState = ReturnType<typeof useAdminUsers>;
