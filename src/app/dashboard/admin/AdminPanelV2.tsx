"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Lock, Search, Tag, Trash2, Unlock, UserPlus, UserRound, Users } from "lucide-react";
import { Avatar, Badge, Callout, Empty, Field, InfoList, PageHead, Stack, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Switch, Tabs } from "@/components/v2/kit-client";
import { ToastV2 } from "@/app/dashboard/studio/services/settings-v2";
import { fmtDate } from "@/lib/date";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import { activityLevel, lastActiveLabel, ACTIVITY_LABEL, ACTIVITY_TONE, type ActivityLevel } from "@/lib/activity";
import type { DiscountCode, Profile, UpgradeRequest } from "@/lib/types";
import DiscountCodesV2 from "./DiscountCodesV2";
import UpgradeRequestsV2 from "./UpgradeRequestsV2";
import { LEVEL_ORDER, PAGE, planValue, useAdminUsers, type AdminUsersState } from "./useAdminUsers";

/* ═══════════════════════════════════════════════════════════════════════════
   NGƯỜI DÙNG & STUDIO (admin) — giao diện mới. Cùng logic với AdminPanel (bản
   cũ, ./useAdminUsers + hai khối yêu cầu nâng cấp / mã giảm giá); khác ở cách
   sắp xếp:
     • Ba tab: Tài khoản · Yêu cầu nâng cấp (đếm đơn chờ duyệt) · Mã giảm giá.
       Đường dẫn #yeu-cau-nang-cap (thông báo "có yêu cầu nâng cấp") mở thẳng
       tab yêu cầu.
     • Tab Tài khoản: dải 5 mức hoạt động (bấm để lọc), một thanh lọc (tìm ·
       gói · loại tài khoản), bảng gọn 6 cột thay cho 13 cột đầy ô nhập.
     • Bấm một dòng mở NGĂN KÉO: đổi gói / dùng thử, vai trò, khoá đăng nhập,
       giới hạn album, 4 quyền — đổi là lưu ngay như bản cũ; xoá tài khoản.
     • Tạo tài khoản bằng ngăn kéo (nút chính ở đầu trang).
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "users" | "upgrades" | "codes";
type Kind = "all" | "owner" | "staff" | "admin";
const UPGRADE_HASH = "#yeu-cau-nang-cap";

const LEVEL_BADGE: Record<ActivityLevel, Tone> = { never: "gray", active: "green", idle: "amber", dormant: "red", lost: "red" };

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "free", label: "Miễn phí" },
  { value: "basic-month", label: "Basic · tháng" },
  { value: "basic-year", label: "Basic · năm" },
  { value: "photographer-month", label: "Photographer · tháng" },
  { value: "photographer-year", label: "Photographer · năm" },
  { value: "photographer_plus-month", label: "Photographer Plus · tháng" },
  { value: "photographer_plus-year", label: "Photographer Plus · năm" },
  { value: "studio-month", label: "Studio · tháng" },
  { value: "studio-year", label: "Studio · năm" },
];
const TRIAL_OPTIONS: { value: string; label: string }[] = [
  { value: "trial-basic", label: "Basic · thử 30 ngày" },
  { value: "trial-photographer", label: "Photographer · thử 30 ngày" },
  { value: "trial-photographer_plus", label: "Photographer Plus · thử 30 ngày" },
  { value: "trial-studio", label: "Studio · thử 7 ngày" },
];

const displayName = (p: Profile) => p.full_name || p.email;

export default function AdminPanelV2({
  profiles,
  albumCounts = {},
  contractCounts = {},
  upgrades = [],
  codes = [],
}: {
  profiles: Profile[];
  albumCounts?: Record<string, number>;
  contractCounts?: Record<string, number>;
  upgrades?: UpgradeRequest[];
  codes?: DiscountCode[];
}) {
  const s = useAdminUsers(profiles);
  const [tab, setTab] = useState<Tab>("users");
  const [creating, setCreating] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? s.rows.find((x) => x.id === peekId) ?? null : null;

  // Thông báo "có yêu cầu nâng cấp" trỏ tới /dashboard/admin#yeu-cau-nang-cap.
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === UPGRADE_HASH) setTab("upgrades");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const awaiting = upgrades.filter((u) => u.payment_status === "awaiting_confirm").length;

  return (
    <Stack>
      <PageHead
        desc="Tài khoản studio, gói đang dùng và mức độ hoạt động. Duyệt chuyển khoản nâng cấp và phát mã giảm giá."
        actions={
          tab === "users" ? (
            <button type="button" onClick={() => setCreating(true)} className={btn("primary")}>
              <UserPlus size={17} /> Tạo tài khoản
            </button>
          ) : null
        }
      />

      <Tabs<Tab>
        label="Phần quản trị"
        value={tab}
        onChange={setTab}
        options={[
          { value: "users", label: "Tài khoản", icon: Users, count: s.rows.length },
          { value: "upgrades", label: "Yêu cầu nâng cấp", icon: Crown, count: awaiting || undefined },
          { value: "codes", label: "Mã giảm giá", icon: Tag, count: codes.length },
        ]}
      />

      {/* Cả ba tab luôn được dựng (chỉ ẩn bằng CSS) để giữ nguyên trạng thái
          từng khối — duyệt xong một đơn rồi qua tab Tài khoản xem gói, quay lại
          vẫn thấy đúng dòng vừa duyệt. */}
      <div className={tab === "users" ? "flex flex-col gap-5" : "hidden"}>
        <ActivityStrip s={s} />
        <UsersTable s={s} albumCounts={albumCounts} contractCounts={contractCounts} onPeek={setPeekId} />
      </div>
      <div className={tab === "upgrades" ? "" : "hidden"}>
        <UpgradeRequestsV2 initial={upgrades} />
      </div>
      <div className={tab === "codes" ? "" : "hidden"}>
        <DiscountCodesV2 initial={codes} />
      </div>

      <UserDrawer
        s={s}
        p={peek}
        rows={s.rows}
        albums={peek ? albumCounts[peek.id] ?? 0 : 0}
        contracts={peek ? contractCounts[peek.id] ?? 0 : 0}
        onClose={() => setPeekId(null)}
      />
      <CreateUserDrawer s={s} open={creating} onClose={() => setCreating(false)} />
      <ToastV2>{s.msg}</ToastV2>
    </Stack>
  );
}

/* ── Dải mức hoạt động ────────────────────────────────────────────────── */

function ActivityStrip({ s }: { s: AdminUsersState }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="v2-section-title">Hoạt động tài khoản</p>
        <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {s.owners.length} studio · đo bằng lần cuối mở khu quản lý
        </span>
        {s.level ? (
          <button type="button" onClick={() => s.setLevel("")} className="ml-auto text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
            Bỏ lọc
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {LEVEL_ORDER.map((lv) => {
          const on = s.level === lv;
          const tone = ACTIVITY_TONE[lv];
          return (
            <button
              key={lv}
              type="button"
              aria-pressed={on}
              onClick={() => s.setLevel(on ? "" : lv)}
              className="v2-card v2-card-link flex flex-col items-start gap-1 px-4 py-3 text-left last:col-span-2 sm:last:col-span-1"
              style={on ? { background: tone.bg, borderColor: tone.fg, boxShadow: `0 0 0 1px ${tone.fg}` } : undefined}
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: tone.fg }} />
                {ACTIVITY_LABEL[lv]}
              </span>
              <span className="v2-num text-[22px] font-bold leading-none" style={{ color: s.stats[lv] ? tone.fg : "var(--tx3)" }}>
                {s.stats[lv]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bảng tài khoản ───────────────────────────────────────────────────── */

function planBadge(p: Profile) {
  const name = PLAN_LABEL[p.plan as Plan] ?? p.plan;
  if (p.plan === "free") return <Badge tone="gray">{name}</Badge>;
  if (p.plan_cycle === "trial") return <Badge tone="violet">{name} · thử</Badge>;
  return <Badge tone="brand">{name}</Badge>;
}
function planSub(p: Profile) {
  if (p.plan === "free" || !p.plan_expires_at) return null;
  const cycle = p.plan_cycle === "trial" ? "Dùng thử" : p.plan_cycle === "year" ? "Năm" : "Tháng";
  const late = new Date(p.plan_expires_at).getTime() < Date.now();
  return (
    <span style={late ? { color: "var(--rd)" } : undefined}>
      {cycle} · hết hạn {fmtDate(p.plan_expires_at)}
    </span>
  );
}
function activityCell(p: Profile) {
  if (p.studio_owner_id) return <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Nhân viên</span>;
  const lv = activityLevel(p.last_active_at);
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={LEVEL_BADGE[lv]} dot>{ACTIVITY_LABEL[lv]}</Badge>
      {lv !== "never" ? (
        <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--tx3)" }}>
          {lastActiveLabel(p.last_active_at)}
          {p.active_days > 0 ? ` · ${p.active_days} ngày dùng` : ""}
        </span>
      ) : null}
    </div>
  );
}

function UsersTable({
  s,
  albumCounts,
  contractCounts,
  onPeek,
}: {
  s: AdminUsersState;
  albumCounts: Record<string, number>;
  contractCounts: Record<string, number>;
  onPeek: (id: string) => void;
}) {
  const [plan, setPlan] = useState("all");
  const [kind, setKind] = useState<Kind>("all");

  // Lọc thêm theo gói / loại tài khoản trên kết quả của bộ lọc chung (mức hoạt
  // động + ô tìm), rồi mới cắt trang như bản cũ.
  const list = useMemo(
    () =>
      s.visible.filter((p) => {
        if (plan === "trial" ? p.plan_cycle !== "trial" || p.plan === "free" : plan !== "all" && p.plan !== plan) return false;
        if (kind === "owner" && (p.studio_owner_id || p.role === "admin")) return false;
        if (kind === "staff" && !p.studio_owner_id) return false;
        if (kind === "admin" && p.role !== "admin") return false;
        return true;
      }),
    [s.visible, plan, kind],
  );
  const shown = list.slice(0, s.shownCount);
  const filtering = plan !== "all" || kind !== "all";

  const rowMenu = (p: Profile) => (
    <Menu
      label={`Thao tác với ${displayName(p)}`}
      items={[
        { label: "Xem & sửa", icon: UserRound, onClick: () => onPeek(p.id) },
        p.is_active
          ? { label: "Khoá đăng nhập", icon: Lock, onClick: () => void s.update(p, { is_active: false }) }
          : { label: "Mở khoá đăng nhập", icon: Unlock, onClick: () => void s.update(p, { is_active: true }) },
        "divider",
        { label: s.t("deleteAccount"), icon: Trash2, danger: true, onClick: () => void s.removeUser(p) },
      ]}
    />
  );

  return (
    <div className="v2-card overflow-hidden">
      <div className="v2-card-pad flex flex-col gap-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Toolbar>
          <div className="min-w-[220px] flex-1">
            <SearchInput value={s.q} onChange={s.search} placeholder="Email / tên…" className="w-full" />
          </div>
          <select
            aria-label="Lọc theo gói"
            className={inputCls}
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              s.setShownCount(PAGE);
            }}
          >
            <option value="all">Mọi gói</option>
            {(["free", "basic", "photographer", "photographer_plus", "studio"] as Plan[]).map((x) => (
              <option key={x} value={x}>{PLAN_LABEL[x]}</option>
            ))}
            <option value="trial">Đang dùng thử</option>
          </select>
          <select
            aria-label="Lọc theo loại tài khoản"
            className={inputCls}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              s.setShownCount(PAGE);
            }}
          >
            <option value="all">Mọi loại</option>
            <option value="owner">Chủ studio</option>
            <option value="staff">Nhân viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </Toolbar>
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {list.length} tài khoản{s.level || filtering || s.q ? " khớp bộ lọc" : ""}
        </p>
      </div>

      {list.length === 0 ? (
        <Empty compact icon={Search} title="Không có tài khoản nào khớp" hint="Bỏ bớt bộ lọc hoặc gõ ít chữ hơn." />
      ) : (
        <>
          <div className="v2-table-wrap hidden md:block">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Gói</th>
                  <th>Hoạt động</th>
                  <th className="num">Album</th>
                  <th className="num">Hợp đồng</th>
                  <th>Đăng nhập</th>
                  <th style={{ width: 56 }} aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => onPeek(p.id)}>
                    <td style={{ maxWidth: 300 }}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={displayName(p)} size={36} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold">
                            <span className="truncate">{p.full_name || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên</span>}</span>
                            {p.role === "admin" ? <Badge tone="violet">Admin</Badge> : null}
                          </p>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        {planBadge(p)}
                        <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--tx3)" }}>{planSub(p)}</span>
                      </div>
                    </td>
                    <td>{activityCell(p)}</td>
                    {/* Album & hợp đồng gắn theo owner_id, nên dòng nhân viên luôn
                        bằng 0 — hiện "—" để khỏi đọc nhầm là studio đó chưa làm gì. */}
                    <td className="num">{p.studio_owner_id ? <span style={{ color: "var(--tx3)" }}>—</span> : albumCounts[p.id] ?? 0}</td>
                    <td className="num">{p.studio_owner_id ? <span style={{ color: "var(--tx3)" }}>—</span> : contractCounts[p.id] ?? 0}</td>
                    <td>{p.is_active ? <span className="text-[13px]" style={{ color: "var(--tx3)" }}>Được phép</span> : <Badge tone="red" dot>Đã khoá</Badge>}</td>
                    <td onClick={(e) => e.stopPropagation()}>{rowMenu(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {shown.map((p) => (
              <button key={p.id} type="button" onClick={() => onPeek(p.id)} className="v2-row v2-row-link w-full text-left">
                <Avatar name={displayName(p)} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title">{p.full_name || p.email}</p>
                  <p className="v2-row-sub">{p.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {planBadge(p)}
                    {p.studio_owner_id ? <Badge tone="gray">Nhân viên</Badge> : <Badge tone={LEVEL_BADGE[activityLevel(p.last_active_at)]} dot>{ACTIVITY_LABEL[activityLevel(p.last_active_at)]}</Badge>}
                    {p.role === "admin" ? <Badge tone="violet">Admin</Badge> : null}
                    {!p.is_active ? <Badge tone="red" dot>Đã khoá</Badge> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {shown.length < list.length ? (
            <button
              type="button"
              onClick={() => s.setShownCount((n) => n + PAGE)}
              className="flex w-full items-center justify-center py-3 text-[13px] font-semibold"
              style={{ borderTop: "1px solid var(--bd2)", color: "var(--ac)" }}
            >
              Xem thêm ({list.length - shown.length} tài khoản)
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ── Ngăn kéo chi tiết một tài khoản ─────────────────────────────────── */

function UserDrawer({
  s,
  p,
  rows,
  albums,
  contracts,
  onClose,
}: {
  s: AdminUsersState;
  p: Profile | null;
  rows: Profile[];
  albums: number;
  contracts: number;
  onClose: () => void;
}) {
  const owner = p?.studio_owner_id ? rows.find((x) => x.id === p.studio_owner_id) : null;
  return (
    <Drawer
      open={!!p}
      onClose={onClose}
      width={520}
      title="Chi tiết tài khoản"
      desc="Đổi gì cũng lưu ngay."
      footer={
        p ? (
          <>
            <button
              type="button"
              onClick={async () => {
                if (await s.removeUser(p)) onClose();
              }}
              className={btn("danger", "md", "mr-auto")}
            >
              <Trash2 size={16} /> {s.t("deleteAccount")}
            </button>
            <button type="button" onClick={onClose} className={btn("secondary")}>
              Xong
            </button>
          </>
        ) : null
      }
    >
      {p ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <Avatar name={displayName(p)} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{p.full_name || "Chưa đặt tên"}</p>
              <p className="truncate text-[13.5px]" style={{ color: "var(--tx2)" }}>{p.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {planBadge(p)}
                {p.role === "admin" ? <Badge tone="violet">Admin</Badge> : null}
                {p.studio_owner_id ? <Badge tone="gray">Nhân viên</Badge> : null}
                {p.is_active ? <Badge tone="green" dot>Được đăng nhập</Badge> : <Badge tone="red" dot>Đã khoá</Badge>}
              </div>
            </div>
          </div>

          {!p.studio_owner_id ? (
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Album", albums],
                ["Hợp đồng", contracts],
                ["Ngày dùng", p.active_days],
                ["Lượt mở", p.visit_count],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-[12px] px-2.5 py-2 text-center" style={{ background: "var(--sf2)" }}>
                  <p className="v2-num text-[18px] font-bold leading-tight">{v as number}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{k as string}</p>
                </div>
              ))}
            </div>
          ) : null}

          <Field label="Gói" hint={planSub(p) ?? "Không thời hạn"}>
            <select className={inputCls} value={planValue(p)} onChange={(e) => s.applyPlanValue(p, e.target.value)} aria-label={`Gói của ${displayName(p)}`}>
              {PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <optgroup label="Dùng thử (miễn phí)">
                {TRIAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </Field>

          <InfoList
            items={[
              ...(p.studio_owner_id
                ? [{ label: "Nhân viên của", value: owner ? owner.full_name || owner.email : "Studio khác" }]
                : [
                    { label: "Hoạt động", value: <Badge tone={LEVEL_BADGE[activityLevel(p.last_active_at)]} dot>{ACTIVITY_LABEL[activityLevel(p.last_active_at)]}</Badge> },
                    { label: "Lần cuối mở", value: lastActiveLabel(p.last_active_at) },
                  ]),
              { label: "Tạo tài khoản", value: fmtDate(p.created_at) },
            ]}
          />

          <div className="flex flex-col gap-3">
            <p className="v2-label">Quyền & giới hạn</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vai trò">
                <select className={inputCls} value={p.role} onChange={(e) => s.update(p, { role: e.target.value as Profile["role"] })}>
                  <option value="photographer">photographer</option>
                  <option value="admin">admin</option>
                </select>
              </Field>
              <Field label="Album / tháng" hint="Trống = không giới hạn">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder="∞"
                  value={p.monthly_album_limit ?? ""}
                  onChange={(e) => s.update(p, { monthly_album_limit: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="rounded-[12px] px-3.5 py-1" style={{ border: "1px solid var(--bd2)" }}>
              <Switch checked={p.is_active} onChange={(v) => s.update(p, { is_active: v })} label={s.t("active")} desc="Tắt là tài khoản không đăng nhập được nữa." />
              <Switch checked={p.can_zip} onChange={(v) => s.update(p, { can_zip: v })} label={s.t("canZip")} desc="Khách tải ảnh từ album." />
              <Switch checked={p.can_notes} onChange={(v) => s.update(p, { can_notes: v })} label={s.t("canNotes")} desc="Khách ghi chú trên ảnh." />
              <Switch checked={p.can_galleries} onChange={(v) => s.update(p, { can_galleries: v })} label={s.t("gallery")} desc="Gallery công khai trên trang chủ." />
              <Switch checked={p.can_watermark_pro} onChange={(v) => s.update(p, { can_watermark_pro: v })} label="WM Pro" desc="Watermark logo + nén kèm." />
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

/* ── Ngăn kéo tạo tài khoản ──────────────────────────────────────────── */

function CreateUserDrawer({ s, open, onClose }: { s: AdminUsersState; open: boolean; onClose: () => void }) {
  const { form, setForm } = s;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={s.t("createUser")}
      desc="Tài khoản mới ở gói Miễn phí, đăng nhập bằng email và mật khẩu đặt ở đây."
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button type="submit" form="admin-create-user" disabled={s.creating} className={btn("primary")}>
            <UserPlus size={16} /> {s.creating ? "Đang tạo…" : s.t("createUser")}
          </button>
        </>
      }
    >
      <form
        id="admin-create-user"
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          if (await s.createUser(e)) onClose();
        }}
      >
        <Field label={s.t("email")}>
          <input required type="email" autoComplete="off" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={s.t("fullName")}>
          <input required type="text" className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label={s.t("password")} hint="Ít nhất 6 ký tự.">
          <input required type="password" minLength={6} autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {s.msg ? <Callout tone="blue">{s.msg}</Callout> : null}
      </form>
    </Drawer>
  );
}
