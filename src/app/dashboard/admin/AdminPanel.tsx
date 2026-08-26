"use client";

import { useMemo, useState } from "react";
import { fmtDate } from "@/lib/date";
import { UserPlus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { planExpiry, planProfilePatch, type Plan } from "@/lib/plans";
import {
  activityLevel,
  lastActiveLabel,
  ACTIVITY_LABEL,
  ACTIVITY_TONE,
  type ActivityLevel,
} from "@/lib/activity";
import type { DiscountCode, Profile, UpgradeRequest } from "@/lib/types";
import UpgradeRequests from "./UpgradeRequests";
import DiscountCodes from "./DiscountCodes";

/** Thứ tự hiện dải số liệu: nhóm cần gọi điện trước đứng trước. */
const LEVEL_ORDER: ActivityLevel[] = ["active", "idle", "dormant", "lost", "never"];

export default function AdminPanel({
  profiles,
  albumCounts = {},
  contractCounts = {},
  upgrades = [],
  codes = [],
}: {
  profiles: Profile[];
  /** Số album theo owner_id — đếm sống ở server, xem page.tsx. */
  albumCounts?: Record<string, number>;
  /** Số hợp đồng theo owner_id. */
  contractCounts?: Record<string, number>;
  /** Yêu cầu nâng cấp gói (gồm cả đơn chờ duyệt chuyển khoản). */
  upgrades?: UpgradeRequest[];
  codes?: DiscountCode[];
}) {
  const { t } = useLang();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  /** Lọc theo mức hoạt động — "" = xem tất cả. */
  const [level, setLevel] = useState<ActivityLevel | "">("");

  // Chỉ đếm CHỦ tài khoản (studio_owner_id = null): nhân viên là tài khoản con
  // của một studio, đếm cả họ thì số "bao nhiêu studio đang dùng" bị thổi lên.
  const owners = useMemo(() => rows.filter((p) => !p.studio_owner_id), [rows]);

  const stats = useMemo(() => {
    const by: Record<ActivityLevel, number> = { never: 0, active: 0, idle: 0, dormant: 0, lost: 0 };
    for (const p of owners) by[activityLevel(p.last_active_at)]++;
    return by;
  }, [owners]);

  const visible = useMemo(
    () => (level ? rows.filter((p) => !p.studio_owner_id && activityLevel(p.last_active_at) === level) : rows),
    [rows, level],
  );

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

  async function removeUser(p: Profile) {
    if (!window.confirm(t("confirmDeleteUser").replace("{email}", p.email))) return;
    setRows((r) => r.filter((x) => x.id !== p.id));
    const res = await fetch(`/api/admin/photographers?id=${p.id}`, { method: "DELETE" });
    if (!res.ok) flash(t("error"));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/photographers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) return flash(data.error ?? t("error"));
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
  }

  return (
    <div className="animate-fade-in">
      <h1 className="mb-8 text-2xl font-light text-accent">{t("photographers")}</h1>

      {msg && (
        <div className="mb-6 rounded-md border border-accent-gold/30 bg-accent-gold/10 px-4 py-2 text-sm text-accent-gold">
          {msg}
        </div>
      )}

      {/* Create */}
      <form
        onSubmit={createUser}
        className="card mb-8 grid grid-cols-1 gap-3 p-5 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <input
          required
          type="email"
          className="input"
          placeholder={t("email")}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          required
          type="text"
          className="input"
          placeholder={t("fullName")}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <input
          required
          type="password"
          minLength={6}
          className="input"
          placeholder={t("password")}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button disabled={creating} className="btn-primary whitespace-nowrap">
          <UserPlus size={15} /> {t("createUser")}
        </button>
      </form>

      {/* ── Dải theo dõi hoạt động ─────────────────────────────────────────
          Chỉ tính CHỦ tài khoản, vì mỗi studio là một khách hàng. Bấm một ô để
          lọc bảng bên dưới xuống đúng nhóm đó — nhóm "Ngủ đông"/"Đã bỏ" chính
          là danh sách cần gọi lại. */}
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">Hoạt động tài khoản</h2>
          <span className="text-xs" style={{ color: "var(--text3)" }}>
            {owners.length} studio · đo bằng lần cuối mở khu quản lý
          </span>
          {level && (
            <button onClick={() => setLevel("")} className="ml-auto text-xs font-semibold" style={{ color: "var(--accent)" }}>
              Bỏ lọc
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LEVEL_ORDER.map((lv) => {
            const on = level === lv;
            const tone = ACTIVITY_TONE[lv];
            return (
              <button
                key={lv}
                onClick={() => setLevel(on ? "" : lv)}
                className="rounded-[12px] px-3 py-2.5 text-left"
                style={{
                  background: on ? tone.bg : "var(--surface2)",
                  border: `1px solid ${on ? tone.fg : "var(--border)"}`,
                }}
              >
                <span className="tnum block text-[20px] font-bold leading-none" style={{ color: tone.fg }}>
                  {stats[lv]}
                </span>
                <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text2)" }}>
                  {ACTIVITY_LABEL[lv]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-accent-muted">
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">{t("plan")}</th>
              <th className="px-4 py-3">Hoạt động</th>
              <th className="px-4 py-3">Album</th>
              <th className="px-4 py-3">Hợp đồng</th>
              <th className="px-4 py-3">{t("role")}</th>
              <th className="px-4 py-3">{t("active")}</th>
              <th className="px-4 py-3">{t("monthlyLimit")}</th>
              <th className="px-4 py-3">{t("canZip")}</th>
              <th className="px-4 py-3">{t("canNotes")}</th>
              <th className="px-4 py-3">{t("gallery")}</th>
              <th className="px-4 py-3">WM Pro</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-ink-850/60">
                <td className="px-4 py-3">
                  <div className="text-accent">{p.full_name}</div>
                  <div className="text-xs text-accent-muted">{p.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input px-2 py-1 text-xs"
                    value={p.plan === "free" ? "free" : p.plan_cycle === "trial" ? `trial-${p.plan}` : `${p.plan}-${p.plan_cycle ?? "month"}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "free") setPlan(p, "free", "month");
                      else if (v.startsWith("trial-")) setTrialPlan(p, v.slice(6) as Plan);
                      else {
                        const [pl, cy] = v.split("-");
                        setPlan(p, pl as Plan, cy as "month" | "year");
                      }
                    }}
                  >
                    <option value="free">{t("planFree")}</option>
                    <option value="basic-month">Basic · {t("cycleMonth")}</option>
                    <option value="basic-year">Basic · {t("cycleYear")}</option>
                    <option value="photographer-month">Photographer · {t("cycleMonth")}</option>
                    <option value="photographer-year">Photographer · {t("cycleYear")}</option>
                    <option value="photographer_plus-month">Photographer Plus · {t("cycleMonth")}</option>
                    <option value="photographer_plus-year">Photographer Plus · {t("cycleYear")}</option>
                    <option value="studio-month">Studio · {t("cycleMonth")}</option>
                    <option value="studio-year">Studio · {t("cycleYear")}</option>
                    <optgroup label="Dùng thử (miễn phí)">
                      <option value="trial-basic">Basic · thử 30 ngày</option>
                      <option value="trial-photographer">Photographer · thử 30 ngày</option>
                      <option value="trial-photographer_plus">Photographer Plus · thử 30 ngày</option>
                      <option value="trial-studio">Studio · thử 7 ngày</option>
                    </optgroup>
                  </select>
                  {p.plan !== "free" && p.plan_expires_at && (
                    <div className="mt-1 text-[10px]" style={{ color: "var(--text3)" }}>
                      {p.plan_cycle === "trial" ? "Dùng thử" : t("expiresShort")}: {fmtDate(p.plan_expires_at)}
                    </div>
                  )}
                </td>

                {/* Hoạt động: nhãn mức + lần cuối mở + số ngày đã dùng.
                    Nhân viên không có mức riêng — hoạt động của họ đã dồn vào
                    mốc thời gian của chủ studio (xem api/activity/ping). */}
                <td className="px-4 py-3">
                  {p.studio_owner_id ? (
                    <span className="text-[11px]" style={{ color: "var(--text3)" }}>
                      Nhân viên
                    </span>
                  ) : (
                    (() => {
                      const lv = activityLevel(p.last_active_at);
                      const tone = ACTIVITY_TONE[lv];
                      return (
                        <>
                          <span
                            className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {ACTIVITY_LABEL[lv]}
                          </span>
                          <div className="mt-1 whitespace-nowrap text-[10px]" style={{ color: "var(--text3)" }}>
                            {lastActiveLabel(p.last_active_at)}
                            {p.active_days > 0 ? ` · ${p.active_days} ngày dùng` : ""}
                          </div>
                        </>
                      );
                    })()
                  )}
                </td>

                {/* Album & hợp đồng gắn theo owner_id, nên dòng nhân viên luôn
                    bằng 0 — hiện "—" để khỏi đọc nhầm là studio đó chưa làm gì. */}
                <td className="tnum px-4 py-3">
                  {p.studio_owner_id ? <span style={{ color: "var(--text3)" }}>—</span> : (albumCounts[p.id] ?? 0)}
                </td>
                <td className="tnum px-4 py-3">
                  {p.studio_owner_id ? <span style={{ color: "var(--text3)" }}>—</span> : (contractCounts[p.id] ?? 0)}
                </td>

                <td className="px-4 py-3">
                  <select
                    className="input px-2 py-1 text-xs"
                    value={p.role}
                    onChange={(e) =>
                      update(p, { role: e.target.value as Profile["role"] })
                    }
                  >
                    <option value="photographer">photographer</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={p.is_active}
                    onChange={(e) => update(p, { is_active: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    className="input w-20 px-2 py-1 text-xs"
                    placeholder="∞"
                    value={p.monthly_album_limit ?? ""}
                    onChange={(e) =>
                      update(p, {
                        monthly_album_limit:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={p.can_zip}
                    onChange={(e) => update(p, { can_zip: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={p.can_notes}
                    onChange={(e) => update(p, { can_notes: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={p.can_galleries}
                    onChange={(e) => update(p, { can_galleries: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={p.can_watermark_pro}
                    onChange={(e) => update(p, { can_watermark_pro: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => removeUser(p)} className="rounded-md p-1.5 hover:bg-red-500/10" style={{ color: "var(--danger)" }} title={t("deleteAccount")} aria-label={t("deleteAccount")}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Nâng cấp gói: yêu cầu chờ duyệt & mã giảm giá. Dọn từ "Cấu hình mstudo"
          sang đây vì cả hai đều là việc làm TRÊN một tài khoản — duyệt xong là
          xem ngay gói của họ ở bảng trên, không phải nhảy màn. */}
      <div className="mt-8 space-y-4">
        <UpgradeRequests initial={upgrades} />
        <DiscountCodes initial={codes} />
      </div>
    </div>
  );
}
