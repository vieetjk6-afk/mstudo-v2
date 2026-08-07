"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/date";
import { UserPlus, Trash2, Users, UserCheck, CreditCard, Sparkles, ChevronDown, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { planExpiry, planProfilePatch, PLAN_LABEL, type Plan } from "@/lib/plans";
import { avatarColor, initials } from "@/lib/avatar";
import { Panel, PanelHead, Pill, TONE, type ToneKey } from "@/components/studio/ui";
import type { Profile } from "@/lib/types";

export default function AdminPanel({ profiles }: { profiles: Profile[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  /* Bảng 10 cột của bản cũ vỡ trên mọi màn dưới 1400px — bản thiết kế dùng danh
     sách dòng, quyền chi tiết nằm trong phần bung ra của dòng đang chọn. */
  const [expanded, setExpanded] = useState<string | null>(null);

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
        created_at: new Date().toISOString(),
      },
    ]);
    setForm({ email: "", password: "", full_name: "" });
    flash(t("saved"));
  }

  /* ── KPI: bốn con số của bản thiết kế, tính ngay từ danh sách ────────── */
  const paid = rows.filter((p) => p.plan !== "free" && p.plan_cycle !== "trial").length;
  const trial = rows.filter((p) => p.plan_cycle === "trial").length;
  const kpis: { icon: LucideIcon; tone: ToneKey; v: string; l: string }[] = [
    { icon: Users, tone: "brand", v: String(rows.length), l: "Tài khoản" },
    { icon: UserCheck, tone: "green", v: String(rows.filter((p) => p.is_active).length), l: "Đang hoạt động" },
    { icon: CreditCard, tone: "blue", v: String(paid), l: "Gói trả phí" },
    { icon: Sparkles, tone: "amber", v: String(trial), l: "Đang dùng thử" },
  ];

  /* Quyền chi tiết — bày trong phần bung ra của từng dòng, không phải 10 cột. */
  const PERMS: [keyof Profile, string][] = [
    ["can_zip", t("canZip")],
    ["can_notes", t("canNotes")],
    ["can_galleries", t("gallery")],
    ["can_watermark_pro", "WM Pro"],
  ];

  return (
    <div className="page-in flex flex-col gap-3.5">
      {msg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-[12px] px-4 py-2 text-[13px] font-semibold" style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {kpis.map((k) => (
          <Panel key={k.l} className="px-4 py-[15px]">
            <span className="inline-block rounded-[9px] p-[7px]" style={{ background: TONE[k.tone].soft, color: TONE[k.tone].fg, lineHeight: 0 }}>
              <k.icon size={19} />
            </span>
            <p className="tnum mt-[11px] text-[22px] font-bold" style={{ letterSpacing: "-.6px" }}>{k.v}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{k.l}</p>
          </Panel>
        ))}
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ══ Tài khoản & phân quyền ══════════════════════════════════════ */}
        <Panel>
          <PanelHead icon={Users} tone="brand" title={t("photographers")} count={`${rows.length}`} note="Bấm một dòng để mở quyền chi tiết" />

          {rows.map((p) => {
            const open = expanded === p.id;
            const isTrial = p.plan_cycle === "trial";
            return (
              <div key={p.id} style={{ borderTop: "1px solid var(--bd2)" }}>
                <button
                  onClick={() => setExpanded(open ? null : p.id)}
                  className="flex w-full items-center gap-3 px-[18px] py-3 text-left"
                  style={{ background: open ? "var(--sf2)" : "transparent" }}
                >
                  <span
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: avatarColor(p.full_name || p.email) }}
                  >
                    {initials(p.full_name || p.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{p.full_name || p.email}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{p.email}</p>
                  </div>
                  <Pill tone={p.plan === "free" ? "gray" : isTrial ? "amber" : "blue"}>
                    {p.plan === "free" ? t("planFree") : `${PLAN_LABEL[p.plan as Plan] ?? p.plan}${isTrial ? " · thử" : ""}`}
                  </Pill>
                  <Pill tone={p.role === "admin" ? "brand" : "gray"}>{p.role}</Pill>
                  <Pill tone={p.is_active ? "green" : "red"} dot>{p.is_active ? t("active") : "Khoá"}</Pill>
                  <ChevronDown
                    size={17}
                    className="flex-none"
                    style={{ color: "var(--tx3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .14s" }}
                  />
                </button>

                {open && (
                  <div className="grid gap-3 px-[18px] pb-4 pt-1 sm:grid-cols-2" style={{ background: "var(--sf2)" }}>
                    <div>
                      <label className="label mb-1 block uppercase">{t("plan")}</label>
                      <select
                        className="input w-full text-[12.5px]"
                        value={p.plan === "free" ? "free" : isTrial ? `trial-${p.plan}` : `${p.plan}-${p.plan_cycle ?? "month"}`}
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
                        <p className="tnum mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                          {isTrial ? "Dùng thử" : t("expiresShort")}: {fmtDate(p.plan_expires_at)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label mb-1 block uppercase">{t("role")}</label>
                      <select
                        className="input w-full text-[12.5px]"
                        value={p.role}
                        onChange={(e) => update(p, { role: e.target.value as Profile["role"] })}
                      >
                        <option value="photographer">photographer</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="label mb-1 block uppercase">{t("monthlyLimit")}</label>
                      <input
                        type="number"
                        min={0}
                        className="input w-full text-[12.5px]"
                        placeholder="∞ (không giới hạn)"
                        value={p.monthly_album_limit ?? ""}
                        onChange={(e) => update(p, { monthly_album_limit: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="label mb-1 block uppercase">Quyền</label>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                          <input type="checkbox" className="h-4 w-4" checked={p.is_active} onChange={(e) => update(p, { is_active: e.target.checked })} />
                          {t("active")}
                        </label>
                        {PERMS.map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={Boolean(p[key])}
                              onChange={(e) => update(p, { [key]: e.target.checked } as Partial<Profile>)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => removeUser(p)}
                      className="flex w-fit items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                      style={{ background: "var(--rdS)", color: "var(--rd)" }}
                    >
                      <Trash2 size={14} /> {t("deleteAccount")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </Panel>

        {/* ══ Mời thành viên ══════════════════════════════════════════════ */}
        <Panel>
          <PanelHead icon={UserPlus} tone="green" title={t("createUser")} />
          <form onSubmit={createUser} className="flex flex-col gap-2.5 p-4">
            <p className="text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Tài khoản tạo ở đây vào thẳng gói Miễn phí, 5 album/tháng — nâng gói ở danh sách bên cạnh.
            </p>
            <div>
              <label className="label mb-1 block uppercase">{t("email")}</label>
              <input required type="email" className="input w-full" placeholder="ten@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label mb-1 block uppercase">{t("fullName")}</label>
              <input required type="text" className="input w-full" placeholder="Họ và tên" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label mb-1 block uppercase">{t("password")}</label>
              <input required type="password" minLength={6} className="input w-full" placeholder="Tối thiểu 6 ký tự" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <button
              disabled={creating}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <UserPlus size={16} /> {creating ? "Đang tạo…" : t("createUser")}
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
