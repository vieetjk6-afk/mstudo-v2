import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus, FileText, CalendarDays, Users, AlertCircle, Wallet, Clock, Globe, Images,
  Bolt, UserPlus, Banknote, ImagePlus, ReceiptText, PenLine, CalendarClock,
  TrendingUp, CircleAlert, CalendarRange, Hourglass, Landmark, CalendarCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import StudioTrialButton from "@/components/StudioTrialButton";
import MessengerButton from "@/components/MessengerButton";
import VietQRButton from "@/components/VietQR";
import AutoEmailToggle from "@/components/AutoEmailToggle";
import WebappV2BannerSlot from "@/components/WebappV2BannerSlot";
import { shootReminderMessage } from "@/lib/zalo";
import { crewPortalUrl } from "@/lib/crew-show";
import { avatarStyle, initials } from "@/lib/avatar";
import { TONE, Pill, Panel, PanelHead, StatCard, EmptyState, RevenueChart, type ToneKey } from "@/components/studio/ui";
import {
  contractTotal,
  sumAmounts,
  vnd,
  vndShort,
  CONTRACT_STATUS_TONE,
  SHOOT_TYPE_LABEL,
  CREW_ROLE_LABEL,
  quoteSelectedTotal,
  type ContractStatus,
  type QuoteStatus,
  type CrewRole,
} from "@/lib/types";
import { fmtDate, fmtDayMonth, fmtDow, todayVN, daysFromToday } from "@/lib/date";

/** Photographer-plan overview: bookings + upcoming shoots, no contracts/finance. */
async function BookingOverview({ ownerId }: { ownerId: string }) {
  const supabase = createClient();
  const today = todayVN();

  // 3 query độc lập → chạy song song thay vì tuần tự (giảm TTFB dashboard).
  const [{ data: trialProf }, { data }, { count: selectingAlbums }] = await Promise.all([
    // Đã dùng thử chưa (một lần / tài khoản).
    supabase.from("profiles").select("trial_used_at").eq("id", ownerId).maybeSingle(),
    supabase
      .from("studio_bookings")
      .select("id, name, phone, service, preferred_date, package_name, package_price, status, created_at")
      .eq("owner_id", ownerId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("phase", "selection")
      .eq("status", "published")
      .eq("is_gallery", false),
  ]);
  const trialUsed = !!(trialProf as { trial_used_at?: string | null } | null)?.trial_used_at;
  const bookings = (data ?? []) as Array<{
    id: string; name: string; phone: string; service: string | null;
    preferred_date: string | null; package_name: string | null; package_price: number | null;
    status: "new" | "handled" | "archived"; created_at: string;
  }>;

  const newCount = bookings.filter((b) => b.status === "new").length;
  const upcoming = bookings
    .filter((b) => b.preferred_date && b.preferred_date >= today)
    .sort((a, b) => (a.preferred_date || "").localeCompare(b.preferred_date || ""))
    .slice(0, 8);

  const stats: { icon: typeof FileText; label: string; value: string; delta?: string; deltaTone?: ToneKey }[] = [
    { icon: AlertCircle, label: "Đặt lịch mới", value: String(newCount), delta: newCount > 0 ? "cần xử lý" : undefined, deltaTone: "amber" },
    { icon: Images, label: "Album đang được khách chọn", value: String(selectingAlbums ?? 0), delta: (selectingAlbums ?? 0) > 0 ? "khách đang chọn ảnh" : undefined, deltaTone: "amber" },
    { icon: CalendarDays, label: "Lịch sắp tới", value: String(upcoming.length) },
    { icon: Users, label: "Tổng yêu cầu đặt lịch", value: String(bookings.length) },
  ];

  const quickLinks = [
    { href: "/dashboard/studio/bookings", icon: Clock, label: "Đặt lịch", desc: "Yêu cầu khách gửi" },
    { href: "/dashboard/studio/calendar", icon: CalendarDays, label: "Lịch chụp", desc: "Xem & sắp lịch" },
    { href: "/dashboard/studio/pricing", icon: Wallet, label: "Bảng giá", desc: "Các gói dịch vụ" },
    { href: "/dashboard/studio/clients", icon: Users, label: "Khách hàng", desc: "Danh bạ khách" },
  ];

  return (
    <div className="animate-[vkFade_.5s_ease_both]">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="font-serif text-2xl font-medium">Tổng quan</h1>
        <Link href="/dashboard/site" className="btn-ghost ml-auto">
          <Globe size={16} /> Website riêng
        </Link>
        <Link href="/dashboard/studio/bookings" className="btn-primary">
          <CalendarDays size={16} /> Đặt lịch
        </Link>

      </div>
      <p className="mb-4 text-[13px]" style={{ color: "var(--text3)" }}>Quản lý lịch chụp & yêu cầu đặt lịch của khách</p>

      {/* Thông báo giao diện 2.0 — điểm nhấn: toàn bộ giao diện được làm mới */}
      <WebappV2BannerSlot />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((q) => (
          <Link key={q.href} href={q.href} className="card card-interactive p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <q.icon size={16} />
            </span>
            <p className="mt-3 font-medium">{q.label}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text2)" }}>{q.desc}</p>
          </Link>
        ))}
      </div>

      {/* Upgrade to Studio CTA */}
      <div className="mb-6 card p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ borderColor: "var(--s-amber)", background: "var(--s-amberS)" }}>
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ color: "var(--s-amber)" }}>Nâng cấp lên Studio</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text2)" }}>
            Mở khóa quản lý hợp đồng, tài chính, đội ngũ và toàn bộ tính năng studio chuyên nghiệp.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StudioTrialButton used={trialUsed} />
          <Link href="/dashboard/upgrade" className="btn-primary text-sm">Xem gói Studio</Link>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
          <CalendarDays size={18} style={{ color: "var(--ac)" }} /> Lịch chụp sắp tới
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
          {upcoming.length > 0 ? `${upcoming.length} buổi chụp đã có ngày` : "Chưa có lịch chụp nào sắp tới"}
        </p>
        {upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                    {[b.package_name || b.service, b.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm" style={{ color: "var(--ac)" }}>{fmtDate(b.preferred_date)}</p>
                  {b.package_price ? <p className="text-[11px]" style={{ color: "var(--text3)" }}>{vnd(b.package_price)}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Link href="/dashboard/studio/bookings" className="btn-ghost mt-1">Mở trang đặt lịch</Link>
        )}
      </div>
    </div>
  );
}

export default async function StudioOverview() {
  const profile = await requireStudio("booking");
  // Cổng thợ riêng của studio — đính vào tin Zalo gửi cho thợ.
  const crewPortal = crewPortalUrl((profile?.crew_token as string | null) ?? null);
  // Free/Basic accounts have no studio tier — send them to the album library
  // (not /dashboard, which redirects back here and would loop).
  if (!profile) redirect("/dashboard/albums");

  const supabase = createClient();

  // Photographer plan (booking tier): a focused overview around shoots &
  // bookings — no contracts/finance, which belong to the full Studio plan.
  if (profile.studioTier === "booking") return <BookingOverview ownerId={profile.id} />;

  const bank = {
    bin: (profile.pl_bank_bin as string | null) ?? null,
    account: (profile.pl_bank_account as string | null) ?? null,
    holder: (profile.pl_bank_holder as string | null) ?? null,
    name: (profile.pl_bank_name as string | null) ?? null,
  };

  // Pre-compute date constants so all query groups can run in parallel.
  const now = new Date();
  const today = todayVN();
  const monthStart = `${today.slice(0, 7)}-01`;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const dueLimit = horizon.toISOString().slice(0, 10);
  // Start of the 6-month window for the revenue chart (this month minus 5).
  const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

  // Explicit columns + drop cancelled at the DB (less payload than select *).
  let cq = supabase
    .from("studio_contracts")
    .select(
      "id, code, title, client_name, client_phone, client_messenger, location, event_date, event_time, delivery_due, status, shoot_type, client_signed_at, selection_album_id, updated_at, contract_items(qty, unit_price), contract_edit_requests(status), contract_payments(amount), contract_crew(id, name, phone, role, status)"
    )
    .eq("owner_id", profile.id)
    .neq("status", "cancelled");
  if (profile.actingRole === "staff") cq = cq.eq("assigned_to", profile.actingUserId);

  const [
    { data: contracts },
    { data: planRows },
    { data: payMonth },
    { data: paySixMonths },
    { data: recentQuotes },
  ] = await Promise.all([
    cq.order("event_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("contract_payment_plan")
      .select("id, label, amount, due_date, paid, contract:studio_contracts!inner(id, owner_id, title)")
      .eq("contract.owner_id", profile.id)
      .eq("paid", false)
      .not("due_date", "is", null)
      .lte("due_date", dueLimit)
      .order("due_date"),
    supabase
      .from("contract_payments")
      .select("amount, contract:studio_contracts!inner(owner_id)")
      .eq("contract.owner_id", profile.id)
      .gte("paid_at", monthStart),
    supabase
      .from("contract_payments")
      .select("amount, paid_at, contract:studio_contracts!inner(owner_id)")
      .eq("contract.owner_id", profile.id)
      .gte("paid_at", chartStart),
    supabase
      .from("studio_quotes")
      .select("id, code, title, client_name, client_phone, status, created_at, quote_items(qty, unit_price, selected, is_optional, is_discount)")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  type CrewLite = { id: string; name: string; phone: string | null; role: CrewRole; status: string };
  const list = (contracts ?? []) as Array<{
    id: string;
    code: string | null;
    title: string;
    client_name: string | null;
    client_phone: string | null;
    client_messenger: string | null;
    location: string | null;
    event_date: string | null;
    event_time: string | null;
    delivery_due: string | null;
    status: ContractStatus;
    shoot_type: keyof typeof SHOOT_TYPE_LABEL;
    client_signed_at: string | null;
    selection_album_id: string | null;
    updated_at: string;
    contract_items: { qty: number; unit_price: number }[];
    contract_edit_requests: { status: string }[];
    contract_payments: { amount: number }[];
    contract_crew: CrewLite[];
  }>;

  const upcoming = list
    // Lịch chụp sắp tới chỉ tính hợp đồng đã xác nhận/ký (bỏ nháp & mới gửi).
    .filter((c) => c.event_date && c.event_date >= today && ["approved", "in_progress", "completed"].includes(c.status))
    .slice(0, 6);
  // Yêu cầu sửa khách gửi mà chưa xử lý xong.
  const openEdits = list.flatMap((c) =>
    (c.contract_edit_requests || []).filter((r) => r.status === "open").map(() => c)
  );

  // Outstanding debts: active contracts where collected < total.
  const debts = list
    .filter((c) => c.status !== "cancelled")
    .map((c) => ({ c, due: contractTotal(c.contract_items || []) - sumAmounts(c.contract_payments || []) }))
    .filter((d) => d.due > 0)
    .sort((a, b) => (a.c.event_date || "9999").localeCompare(b.c.event_date || "9999"));
  const totalDue = debts.reduce((s, d) => s + d.due, 0);

  // Crew who haven't responded yet (pending) on non-cancelled contracts.
  const pendingCrew = list
    .filter((c) => c.status !== "cancelled")
    .flatMap((c) => (c.contract_crew || []).filter((cr) => cr.status === "pending").map((cr) => ({ c, cr })));

  // Contracts sent to the client but not signed yet (oldest waiting first).
  const unsigned = list
    .filter((c) => c.status === "sent" && !c.client_signed_at)
    .map((c) => ({ c, days: Math.max(0, Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)) }))
    .sort((a, b) => b.days - a.days);

  // Photo deliveries past their due date and not yet completed.
  const lateDeliveries = list
    .filter((c) => c.delivery_due && c.delivery_due < today && c.status !== "completed" && c.status !== "cancelled")
    .sort((a, b) => (a.delivery_due || "").localeCompare(b.delivery_due || ""));

  // Scheduled payment installments due within 7 days (or overdue) & unpaid.
  const duePlan = ((planRows ?? []) as unknown as Array<{
    id: string; label: string; amount: number; due_date: string;
    contract: { id: string; title: string } | null;
  }>);

  // ── Số liệu KPI ───────────────────────────────────────────────
  const revenueMonth = sumAmounts((payMonth ?? []) as unknown as { amount: number }[]);
  const notCancelled = list.filter((c) => c.status !== "cancelled");

  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10);
  const todayJobs = notCancelled
    .filter((c) => c.event_date === today)
    .sort((a, b) => (a.event_time || "").localeCompare(b.event_time || ""));
  const yesterdayJobs = notCancelled.filter((c) => c.event_date === yesterday).length;
  const jobsDelta = todayJobs.length - yesterdayJobs;

  // 6 tháng doanh thu — gom tiền đã thu theo YYYY-MM.
  const sixMonthPays = (paySixMonths ?? []) as unknown as { amount: number; paid_at: string }[];
  const revBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const value = sixMonthPays
      .filter((p) => (p.paid_at || "").slice(0, 7) === key)
      .reduce((s, p) => s + (p.amount || 0), 0);
    return { label: `T${d.getMonth() + 1}`, value };
  });
  const prevMonthRev = revBars.length >= 2 ? revBars[revBars.length - 2].value : 0;
  const revDeltaPct = prevMonthRev > 0 ? Math.round(((revenueMonth - prevMonthRev) / prevMonthRev) * 100) : null;

  const overdueDebts = debts.filter((d) => d.c.event_date && d.c.event_date < today);

  // ── Hàng đợi "Cần xử lý ngay" (tính năng mới số 1) ────────────────────
  // Mỗi dòng là một việc CÓ THẬT đang treo, kèm nút hành động tại chỗ. Làm xong
  // là dòng tự biến mất vì nó sinh ra từ chính dữ liệu, không phải danh sách tay.
  type Urgent = {
    key: string; icon: typeof FileText; tone: ToneKey;
    title: string; sub: string; tag: string; cta: string; href: string;
    action?: React.ReactNode;
  };
  const urgent: Urgent[] = [];

  // 1. Buổi chụp trong 3 ngày tới chưa có ai nhận.
  for (const c of notCancelled) {
    if (!c.event_date || c.event_date < today) continue;
    const left = daysFromToday(c.event_date);
    if (left == null || left > 3) continue;
    if ((c.contract_crew || []).length > 0) continue;
    if (c.status === "draft") continue;
    urgent.push({
      key: `crew-${c.id}`, icon: UserPlus, tone: "red",
      title: `${c.title} chưa có nhân sự`,
      sub: `${fmtDow(c.event_date)} ${fmtDate(c.event_date)}${c.event_time ? ` · ${c.event_time}` : ""} · ${c.client_name || "khách chưa đặt tên"}`,
      tag: "Phân công", cta: "Phân công", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 2. Đợt thu đã quá hạn.
  for (const d of duePlan.filter((x) => x.due_date < today)) {
    urgent.push({
      key: `plan-${d.id}`, icon: Banknote, tone: "red",
      title: `Quá hạn thu: ${d.contract?.title || "hợp đồng"}`,
      sub: `${d.label} · ${vnd(d.amount)} · hạn ${fmtDate(d.due_date)}`,
      tag: "Công nợ", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${d.contract?.id ?? ""}`,
      action: <VietQRButton bank={bank} amount={d.amount} addInfo={(d.contract?.title || "").slice(0, 25)} label="QR" />,
    });
  }

  // 3. Trễ cam kết giao ảnh.
  for (const c of lateDeliveries) {
    const late = Math.abs(daysFromToday(c.delivery_due) ?? 0);
    urgent.push({
      key: `late-${c.id}`, icon: Clock, tone: "red",
      title: `Trễ cam kết giao ảnh: ${c.title}`,
      sub: `${c.client_name || "—"} · hạn ${fmtDate(c.delivery_due)} · quá ${late} ngày`,
      tag: "Cam kết", cta: "Giao ngay", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 4. Đã chụp xong nhưng chưa tạo album chọn ảnh.
  for (const c of notCancelled) {
    if (!c.event_date || c.event_date >= today) continue;
    if (c.status !== "approved" && c.status !== "in_progress") continue;
    if (c.selection_album_id) continue;
    urgent.push({
      key: `album-${c.id}`, icon: ImagePlus, tone: "blue",
      title: `${c.title} đã chụp xong — chưa có album chọn ảnh`,
      sub: `${c.client_name || "—"} · chụp ${fmtDate(c.event_date)}${c.delivery_due ? ` · hạn giao ${fmtDate(c.delivery_due)}` : ""}`,
      tag: "Album", cta: "Tạo album", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 5. Hợp đồng đã gửi, khách chưa ký.
  for (const { c, days } of unsigned.filter((u) => u.days >= 1)) {
    urgent.push({
      key: `sign-${c.id}`, icon: PenLine, tone: "amber",
      title: `${c.title} chưa được ký`,
      sub: `${c.client_name || "—"} · đã gửi ${days} ngày trước`,
      tag: "Hợp đồng", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${c.id}`,
      action: (
        <MessengerButton
          link={c.client_messenger}
          label="Nhắc khách"
          message={`Xin chào ${c.client_name || "anh/chị"}, studio gửi lại hợp đồng "${c.title}" để anh/chị xem & ký xác nhận giúp em nhé. Cảm ơn ạ!`}
        />
      ),
    });
  }

  // 6. Báo giá khách chưa phản hồi quá 2 ngày.
  const quoteRows = (recentQuotes ?? []) as Array<{
    id: string; code: string | null; title: string | null; client_name: string | null;
    client_phone: string | null; status: QuoteStatus; created_at: string;
    quote_items: { qty: number; unit_price: number; selected: boolean; is_optional: boolean; is_discount?: boolean }[];
  }>;
  for (const q of quoteRows) {
    if (q.status !== "sent" && q.status !== "viewed" && q.status !== "adjust_requested") continue;
    const days = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400000);
    if (days < 2) continue;
    urgent.push({
      key: `quote-${q.id}`, icon: ReceiptText, tone: "amber",
      title: `Báo giá "${q.title || q.code || "chưa đặt tên"}" khách chưa chốt`,
      sub: `${q.client_name || "—"} · ${vnd(quoteSelectedTotal(q.quote_items || []))} · gửi ${days} ngày trước`,
      tag: "Báo giá", cta: "Mở báo giá", href: `/dashboard/studio/quotes/${q.id}`,
    });
  }

  // 7. Khách gửi yêu cầu sửa chưa xử lý.
  for (const c of openEdits) {
    urgent.push({
      key: `edit-${c.id}`, icon: CircleAlert, tone: "amber",
      title: `Khách yêu cầu sửa: ${c.title}`,
      sub: `${c.client_name || "—"} · yêu cầu đang mở`,
      tag: "Yêu cầu sửa", cta: "Xem yêu cầu", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 8. Thợ chưa nhận job.
  for (const { c, cr } of pendingCrew) {
    urgent.push({
      key: `pcrew-${cr.id}`, icon: Users, tone: "blue",
      title: `${cr.name || cr.phone || "Thợ"} chưa phản hồi lời mời`,
      sub: `${CREW_ROLE_LABEL[cr.role]} · ${c.title}${c.event_date ? ` · ${fmtDate(c.event_date)}` : ""}`,
      tag: "Nhân sự", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${c.id}`,
      action: (
        <MessengerButton
          label="Nhắc thợ"
          message={shootReminderMessage({ name: cr.name, title: c.title, date: c.event_date, time: c.event_time, location: c.location, role: CREW_ROLE_LABEL[cr.role], link: crewPortal })}
        />
      ),
    });
  }

  const SEVERITY: Record<string, number> = { red: 0, amber: 1, blue: 2, teal: 3, brand: 4, green: 5, gray: 6 };
  urgent.sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]);
  const urgentTop = urgent.slice(0, 6);

  // ── Cảnh báo dồn lịch (tính năng mới số 6) ────────────────────────────
  // Một ngày ≥3 buổi, hoặc một người nhận ≥4 ngày trong 7 ngày tới.
  const warns: { key: string; icon: typeof FileText; tone: ToneKey; title: string; sub: string }[] = [];
  const byDay = new Map<string, number>();
  for (const c of notCancelled) {
    if (!c.event_date || c.event_date < today) continue;
    const left = daysFromToday(c.event_date);
    if (left == null || left > 14) continue;
    byDay.set(c.event_date, (byDay.get(c.event_date) ?? 0) + 1);
  }
  for (const [date, n] of [...byDay.entries()].sort()) {
    if (n < 3) continue;
    warns.push({
      key: `day-${date}`, icon: CalendarRange, tone: "amber",
      title: `${fmtDow(date)} ${fmtDate(date)} có ${n} buổi chụp`,
      sub: "Kiểm tra nhân sự và thiết bị trước khi nhận thêm job vào ngày này.",
    });
  }
  const byPerson = new Map<string, { name: string; days: Set<string> }>();
  for (const c of notCancelled) {
    if (!c.event_date || c.event_date < today) continue;
    const left = daysFromToday(c.event_date);
    if (left == null || left > 7) continue;
    for (const cr of c.contract_crew || []) {
      if (cr.status === "declined") continue;
      const k = (cr.phone || cr.name || cr.id).trim();
      const cur = byPerson.get(k) ?? { name: cr.name || cr.phone || "Nhân sự", days: new Set<string>() };
      cur.days.add(c.event_date);
      byPerson.set(k, cur);
    }
  }
  for (const { name, days } of byPerson.values()) {
    if (days.size < 4) continue;
    warns.push({
      key: `person-${name}`, icon: CircleAlert, tone: "red",
      title: `${name} nhận ${days.size} ngày trong tuần này`,
      sub: "Quá tải dễ trễ hậu kỳ — cân nhắc chia bớt cho người khác.",
    });
  }
  const warnTop = warns.slice(0, 3);

  // ── Cam kết giao ảnh (tính năng mới số 5) ─────────────────────────────
  const slaRows = notCancelled
    .filter((c) => c.delivery_due && c.status !== "completed")
    .map((c) => ({ c, left: daysFromToday(c.delivery_due) ?? 0 }))
    .sort((a, b) => a.left - b.left)
    .slice(0, 6);
  const slaLate = slaRows.filter((r) => r.left < 0).length;

  const stats: { icon: typeof FileText; tone: ToneKey; label: string; value: string; sub?: string; delta?: string; deltaTone?: ToneKey }[] = [
    {
      icon: CalendarCheck, tone: "brand", label: "Buổi chụp hôm nay",
      value: String(todayJobs.length), sub: "so với hôm qua",
      delta: jobsDelta === 0 ? "= hôm qua" : `${jobsDelta > 0 ? "▲" : "▼"} ${Math.abs(jobsDelta)}`,
      deltaTone: jobsDelta >= 0 ? "green" : "red",
    },
    {
      icon: TrendingUp, tone: "green", label: `Doanh thu tháng ${new Date(today).getMonth() + 1}`,
      value: vndShort(revenueMonth), sub: `${notCancelled.length} hợp đồng đang có`,
      delta: revDeltaPct != null ? `${revDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(revDeltaPct)}%` : undefined,
      deltaTone: (revDeltaPct ?? 0) >= 0 ? "green" : "red",
    },
    {
      icon: Hourglass, tone: "amber", label: "Việc đang chờ bạn",
      value: String(urgent.length), sub: "báo giá, cọc, phân công, giao ảnh",
      delta: urgent.length > 0 ? "cần xử lý" : "sạch việc", deltaTone: urgent.length > 0 ? "amber" : "green",
    },
    {
      icon: Landmark, tone: "red", label: "Công nợ khách",
      value: vndShort(totalDue), sub: `trên ${debts.length} hợp đồng`,
      delta: overdueDebts.length > 0 ? `${overdueDebts.length} quá hạn` : undefined, deltaTone: "red",
    },
  ];

  const hour = Number(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 13));
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = (profile.full_name || "").trim().split(/\s+/).pop() || "bạn";

  return (
    <div className="page-in flex flex-col gap-3.5">
      {/* ── Lời chào + hành động chính ───────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <h1 className="text-[24px] font-bold" style={{ letterSpacing: "-.6px" }}>{greeting}, {firstName}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--tx2)" }}>
            Hôm nay {fmtDow(today)} · {fmtDate(today)} — studio có {todayJobs.length} buổi chụp, {urgent.length} việc cần xử lý.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/studio/quotes/new"
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
          >
            <ReceiptText size={17} /> Báo giá mới
          </Link>
          <Link
            href="/dashboard/studio/contracts/new"
            className="flex items-center gap-1.5 rounded-[10px] px-[15px] py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 2px 8px color-mix(in srgb, var(--ac) 30%, transparent)" }}
          >
            <Plus size={17} /> Hợp đồng mới
          </Link>
        </div>
      </div>

      <WebappV2BannerSlot />

      {/* ── 4 thẻ KPI ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Cần xử lý ngay ────────────────────────────────────────────── */}
      <Panel>
        <PanelHead
          icon={Bolt} tone="amber" title="Cần xử lý ngay"
          count={urgent.length ? String(urgent.length) : undefined}
          note="Xử lý xong sẽ tự biến mất khỏi danh sách"
        />
        {urgentTop.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Không còn việc nào đang treo" hint="Mọi hợp đồng, cọc và lịch giao ảnh đều đang đúng hạn." />
        ) : (
          urgentTop.map((u) => (
            <div key={u.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <span className="flex-none rounded-[10px] p-2" style={{ background: TONE[u.tone].soft, color: TONE[u.tone].fg, lineHeight: 0 }}>
                <u.icon size={18} />
              </span>
              <div className="min-w-[200px] flex-1">
                <p className="text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{u.title}</p>
                <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{u.sub}</p>
              </div>
              <Pill tone={u.tone}>{u.tag}</Pill>
              {u.action}
              <Link
                href={u.href}
                className="flex-none whitespace-nowrap rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold"
                style={{ background: "var(--tx)", color: "var(--sf)" }}
              >
                {u.cta}
              </Link>
            </div>
          ))
        )}
        {urgent.length > urgentTop.length && (
          <Link href="/dashboard/studio/contracts" className="block px-4 py-2.5 text-[12px] font-semibold" style={{ color: "var(--ac)" }}>
            Còn {urgent.length - urgentTop.length} việc nữa →
          </Link>
        )}
      </Panel>

      {/* ── Cảnh báo dồn lịch ─────────────────────────────────────────── */}
      {warnTop.length > 0 && (
        <div className="grid gap-3 min-[1100px]:grid-cols-3">
          {warnTop.map((w) => (
            <div key={w.key} className="flex gap-2.5 rounded-[13px] px-[15px] py-[13px]" style={{ background: TONE[w.tone].soft, border: "1px solid var(--bd)" }}>
              <w.icon size={18} style={{ flex: "none", marginTop: 1, color: TONE[w.tone].fg }} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold" style={{ color: TONE[w.tone].fg }}>{w.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-[1.5]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{w.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cam kết giao ảnh ──────────────────────────────────────────── */}
      <Panel>
        <PanelHead
          icon={CalendarClock} tone="blue" title="Cam kết giao ảnh"
          count={slaRows.length ? `${slaRows.length} mốc${slaLate ? ` · ${slaLate} trễ` : ""}` : undefined}
          note="Đếm ngược theo hạn giao ghi trong từng hợp đồng"
        />
        {slaRows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Chưa có mốc giao ảnh nào" hint="Đặt hạn giao trong hợp đồng để theo dõi đếm ngược ở đây." />
        ) : (
          slaRows.map(({ c, left }) => {
            const tone: ToneKey = left < 0 ? "red" : left <= 3 ? "amber" : "gray";
            const label = left < 0 ? `Trễ ${Math.abs(left)} ngày` : left === 0 ? "Hạn hôm nay" : `Còn ${left} ngày`;
            return (
              <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-[11px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span className="w-[104px] flex-none text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>
                  {SHOOT_TYPE_LABEL[c.shoot_type]}
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-[13px] font-semibold">{c.title}</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{c.client_name || "—"}</p>
                </div>
                <span className="tnum flex-none text-[11.5px]" style={{ color: "var(--tx3)" }}>Hạn {fmtDate(c.delivery_due)}</span>
                <Pill tone={tone}>{label}</Pill>
              </Link>
            );
          })
        )}
      </Panel>

      {/* ── Doanh thu + Lịch hôm nay ──────────────────────────────────── */}
      <div className="grid gap-3.5 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <RevenueChart
          bars={revBars}
          headline={vnd(revenueMonth)}
          delta={revDeltaPct != null ? `${revDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(revDeltaPct)}% so với tháng trước` : null}
        />

        <Panel className="flex flex-col">
          <div className="flex items-center px-4 pb-2.5 pt-3.5">
            <div>
              <h2 className="text-[14px] font-bold">Lịch hôm nay</h2>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                {todayJobs.length} buổi · {upcoming.length} buổi sắp tới
              </p>
            </div>
            <Link href="/dashboard/studio/calendar" className="ml-auto text-[12px] font-semibold" style={{ color: "var(--ac)" }}>Xem lịch</Link>
          </div>
          <div className="px-2 pb-2">
            {(todayJobs.length ? todayJobs : upcoming).slice(0, 6).map((c) => (
              <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="nav-item flex w-full items-center gap-2.5 rounded-[10px] px-2 py-[9px] text-left">
                <span className="tnum w-[38px] flex-none text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
                  {todayJobs.length ? (c.event_time || "—") : fmtDayMonth(c.event_date)}
                </span>
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold" style={avatarStyle(c.client_name)}>
                  {initials(c.client_name || c.title)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{c.title}</span>
                <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: CONTRACT_STATUS_TONE[c.status].fg }} />
              </Link>
            ))}
            {todayJobs.length === 0 && upcoming.length === 0 && (
              <EmptyState icon={CalendarDays} title="Hôm nay không có buổi chụp" hint="Tạo hợp đồng hoặc nhận đặt lịch để lấp lịch tuần này." />
            )}
          </div>
        </Panel>
      </div>

      {profile.actingRole !== "staff" && (
        <AutoEmailToggle ownerId={profile.id} initial={!!profile.auto_client_emails} />
      )}
    </div>
  );
}
