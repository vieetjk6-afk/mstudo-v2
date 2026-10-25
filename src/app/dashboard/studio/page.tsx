import Link from "next/link";
import { contractKind, kindHasPhotoWork } from "@/lib/contract-kind";
import { redirect } from "next/navigation";
import {
  Plus, FileText, CalendarDays, Users, AlertCircle, Wallet, Clock, Globe, Images,
  Bolt, UserPlus, Banknote, ImagePlus, ReceiptText, PenLine, CalendarClock,
  TrendingUp, CircleAlert, CalendarRange, Hourglass, Landmark, CalendarCheck,
  AlertTriangle, Star, Gift,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import StudioTrialButton from "@/components/StudioTrialButton";
import MessengerButton from "@/components/MessengerButton";
import VietQRButton from "@/components/VietQR";
import { instalmentNote } from "@/lib/vietqr";
import { isMissingColumn } from "@/lib/missing-column";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { chunk } from "@/lib/photos";
import CollectButton from "@/components/studio/CollectButton";
import AutoEmailToggle from "@/components/AutoEmailToggle";
import UpcomingSchedule from "@/components/studio/UpcomingSchedule";
import { shootReminderMessage } from "@/lib/zalo";
import { crewPortalUrl } from "@/lib/crew-show";
import { avatarStyle, initials } from "@/lib/avatar";
import { brandFrom } from "@/lib/studio-brand";
import { TONE, Pill, Panel, PanelHead, StatCard, EmptyState, RevenueChart, type ToneKey } from "@/components/studio/ui";
import {
  contractTotal,
  sumAmounts,
  vnd,
  vndShort,
  SHOOT_TYPE_LABEL,
  quoteSelectedTotal,
  type ContractStatus,
  type QuoteStatus,
  type CrewRole,
} from "@/lib/types";
import { fmtDate, fmtDow, todayVN, daysFromToday } from "@/lib/date";
import { crewRoleLabel, loadCrewRoles } from "@/lib/crew-roles";
import { MILESTONE_LABEL, milestoneMessage, upcomingMilestones } from "@/lib/anniversary";
import { isUiV2 } from "@/lib/ui-server";
import OverviewV2, { OverviewBookingV2 } from "./OverviewV2";
import type { OvAct, OvTask, OvTaskKind } from "./OverviewTypes";

/** Thao tác tại chỗ của một việc trong "Cần xử lý ngay" — bản cũ (V1). */
function UrgentActV1({ act, bank }: { act: OvAct; bank: Parameters<typeof VietQRButton>[0]["bank"] }) {
  if (act.kind === "collect") return <CollectButton planId={act.planId} contractId={act.contractId} amountLabel={act.amountLabel} />;
  if (act.kind === "qr")
    return (
      <span className="flex flex-wrap items-center gap-2">
        <VietQRButton bank={bank} amount={act.amount} addInfo={act.addInfo} label="QR" />
        {act.contractId && <CollectButton planId={act.planId} contractId={act.contractId} amountLabel={act.amountLabel} />}
      </span>
    );
  return <MessengerButton link={act.link} label={act.label} message={act.message} />;
}

/** Photographer-plan overview: bookings + upcoming shoots, no contracts/finance. */
async function BookingOverview({ ownerId }: { ownerId: string }) {
  const supabase = await createClient();
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

  // Giao diện mới: cùng dữ liệu đã tải ở trên, chỉ khác cách sắp xếp.
  if (await isUiV2())
    return (
      <OverviewBookingV2
        today={today}
        newCount={newCount}
        selectingAlbums={selectingAlbums ?? 0}
        totalBookings={bookings.length}
        upcoming={upcoming}
        newBookings={bookings.filter((b) => b.status === "new").slice(0, 6)}
        trialUsed={trialUsed}
      />
    );

  const quickLinks = [
    { href: "/dashboard/studio/bookings", icon: Clock, label: "Đặt lịch", desc: "Yêu cầu khách gửi" },
    { href: "/dashboard/studio/calendar", icon: CalendarDays, label: "Lịch chụp", desc: "Xem & sắp lịch" },
    { href: "/dashboard/studio/pricing", icon: Wallet, label: "Bảng giá", desc: "Các gói dịch vụ" },
    { href: "/dashboard/studio/clients", icon: Users, label: "Khách hàng", desc: "Danh bạ khách" },
  ];

  return (
    <div className="page-in">
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

  const supabase = await createClient();

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
  // Mọi mốc ngày suy từ todayVN() rồi tính bằng Date.UTC — không trộn với
  // new Date() giờ máy (máy chủ UTC: từ 0h–7h sáng VN là còn "hôm qua", và
  // `new Date(y, m, 1).toISOString()` ở múi +7 lùi về ngày cuối tháng trước).
  const today = todayVN();
  const [vnYear, vnMonth, vnDay] = today.split("-").map(Number); // vnMonth: 1–12
  const monthStart = `${today.slice(0, 7)}-01`;
  const dueLimit = new Date(Date.UTC(vnYear, vnMonth - 1, vnDay + 7)).toISOString().slice(0, 10);
  // Start of the 6-month window for the revenue chart (this month minus 5).
  const chartStart = new Date(Date.UTC(vnYear, vnMonth - 1 - 5, 1)).toISOString().slice(0, 10);

  type CrewLite = { id: string; name: string; phone: string | null; role: CrewRole; status: string };
  type ActiveRow = {
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
    select_invited_at: string | null;
    updated_at: string;
    contract_items: { qty: number; unit_price: number }[];
    contract_edit_requests: { status: string }[];
    contract_payments: { amount: number }[];
    contract_crew: CrewLite[];
  };
  type OldRow = Pick<
    ActiveRow,
    | "id" | "title" | "client_name" | "client_phone" | "location" | "event_date" | "event_time"
    | "status" | "shoot_type" | "contract_items" | "contract_payments" | "contract_edit_requests" | "contract_crew"
  >;

  // Hợp đồng chia HAI tập theo việc trang này thật sự cần:
  //  • ĐANG CHẠY — mọi trạng thái chưa xong (nháp → hậu kỳ) + hợp đồng đã xong
  //    có ngày chụp trong 180 ngày gần đây. Đây là tập mọi khối lịch/tắc/giao ảnh
  //    dùng tới (khối nào cũng chỉ nhìn hôm qua trở đi, hoặc HĐ chưa xong), nên
  //    tải đủ cột + các bảng con.
  //  • ĐÃ XONG TỪ LÂU (hoặc không ghi ngày) — chỉ còn góp vào số TỔNG: công nợ
  //    khách, số hợp đồng đang có, mốc kỷ niệm, và yêu cầu sửa / thợ chưa nhận
  //    còn treo. Tải cột nhẹ, bảng con sửa/thợ lọc sẵn ở DB nên gần như rỗng.
  // Trước đây là MỘT truy vấn tải hết mọi hợp đồng từng có kèm bốn bảng con,
  // không giới hạn: chậm, và vượt 1000 hàng là Supabase lặng lẽ cắt — KPI với
  // danh sách tắc sai mà không ai biết. Cả hai tập giờ đều lật trang (fetchAllRows).
  const recentCutoff = new Date(Date.UTC(vnYear, vnMonth - 1, vnDay - 180)).toISOString().slice(0, 10);
  const isStaff = profile.actingRole === "staff";
  const activeContracts = () =>
    fetchAllRows<ActiveRow>((from, to) => {
      let q = supabase
        .from("studio_contracts")
        .select(
          "id, code, title, client_name, client_phone, client_messenger, location, event_date, event_time, delivery_due, status, shoot_type, client_signed_at, selection_album_id, select_invited_at, updated_at, contract_items(qty, unit_price), contract_edit_requests(status), contract_payments(amount), contract_crew(id, name, phone, role, status)"
        )
        .eq("owner_id", profile.id)
        .neq("status", "cancelled")
        .or(`status.neq.completed,event_date.gte.${recentCutoff}`);
      if (isStaff) q = q.eq("assigned_to", profile.actingUserId);
      // Thứ tự theo ngày chụp như cũ, thêm id để thứ tự là TỔNG (lật trang không trùng/sót).
      return q.order("event_date", { ascending: true, nullsFirst: false }).order("id").range(from, to);
    });
  const oldContracts = () =>
    fetchAllRows<OldRow>((from, to) => {
      let q = supabase
        .from("studio_contracts")
        .select(
          "id, title, client_name, client_phone, location, event_date, event_time, status, shoot_type, contract_items(qty, unit_price), contract_payments(amount), contract_edit_requests(status), contract_crew(id, name, phone, role, status)"
        )
        .eq("owner_id", profile.id)
        .eq("status", "completed")
        .or(`event_date.lt.${recentCutoff},event_date.is.null`)
        // Lọc HÀNG CON (không phải hàng cha): HĐ cũ vẫn về đủ để cộng công nợ,
        // nhưng chỉ mang theo yêu cầu sửa đang mở và thợ chưa phản hồi.
        .eq("contract_edit_requests.status", "open")
        .eq("contract_crew.status", "pending");
      if (isStaff) q = q.eq("assigned_to", profile.actingUserId);
      return q.order("id").range(from, to);
    });

  const [
    contracts,
    oldList,
    { data: planRows },
    { data: paySixMonths },
    { data: recentQuotes },
    { data: pendingProofs },
    { count: pendingReviews },
    { count: pendingBank },
  ] = await Promise.all([
    activeContracts(),
    oldContracts(),
    // pay_code (mã đợt cho SePay) chỉ có sau migrations/bank_auto_reconcile.sql.
    // Chưa chạy thì lùi về bản không có cột, không để cả Tổng quan hỏng.
    (async () => {
      const q = (cols: string) =>
        supabase
          .from("contract_payment_plan")
          .select(cols)
          .eq("contract.owner_id", profile.id)
          .eq("paid", false)
          .not("due_date", "is", null)
          .lte("due_date", dueLimit)
          .order("due_date");
      const base = "id, label, amount, due_date, paid, contract:studio_contracts!inner(id, owner_id, code, title)";
      const full = await q(`${base}, pay_code`);
      return full.error && isMissingColumn(full.error, "pay_code") ? q(base) : full;
    })(),
    // Một truy vấn cho cả biểu đồ 6 tháng lẫn doanh thu tháng này — tháng này
    // nằm gọn trong cửa sổ 6 tháng nên lọc lại bằng JS, khỏi gọi DB lần nữa.
    // Lật trang luôn: studio đông khách vượt 1000 lượt thu trong 6 tháng là có thật.
    fetchAllRows<{ amount: number; paid_at: string }>((from, to) =>
      supabase
        .from("contract_payments")
        .select("amount, paid_at, contract:studio_contracts!inner(owner_id)")
        .eq("contract.owner_id", profile.id)
        .gte("paid_at", chartStart)
        .order("id")
        .range(from, to)
    ).then((data) => ({ data })),
    supabase
      .from("studio_quotes")
      .select("id, code, title, client_name, client_phone, status, created_at, quote_items(qty, unit_price, selected, is_optional, is_discount)")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    // Khách đã GỬI ẢNH CHUYỂN KHOẢN cho một đợt mà đợt đó vẫn chưa đánh dấu thu.
    // Đây là việc gấp nhất trong ngày (tiền đang chờ đối soát) mà trước đây chỉ
    // nằm trong chuông — mở khu quản lý mới thấy, và chuông thì trôi rất nhanh.
    supabase
      .from("contract_client_proofs")
      .select("id, created_at, plan:contract_payment_plan!inner(id, label, amount, paid), contract:studio_contracts!inner(id, owner_id, title, client_name)")
      .eq("contract.owner_id", profile.id)
      .eq("plan.paid", false)
      .order("created_at", { ascending: false })
      .limit(20),
    // Đánh giá khách chưa quyết cho hiện hay ẩn. Chỉ cần ĐẾM (head: true) —
    // hàng đợi bên dưới chỉ hiện một dòng "có N cái chờ bạn duyệt", nội dung
    // đọc ở màn Đánh giá khách.
    supabase
      .from("feedback")
      .select("id, album:albums!inner(owner_id)", { count: "exact", head: true })
      .eq("album.owner_id", profile.id)
      .eq("approved", false)
      .is("moderated_at", null),
    // Tiền SePay báo về mà không tự ghi thu được (nội dung không có mã đợt, hoặc
    // có mã nhưng lệch). Chỉ ĐẾM. Studio không dùng SePay, hoặc chưa chạy
    // migrations/bank_auto_reconcile.sql, thì count là 0/null và thẻ không hiện:
    // truy vấn lỗi trả về { count: null } chứ không ném, nên Tổng quan không sập.
    supabase
      .from("studio_bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .in("status", ["unmatched", "mismatch"]),
  ]);

  const list = contracts;
  // Toàn bộ hợp đồng chưa huỷ (hai tập gộp lại), sắp theo ngày chụp như truy vấn
  // cũ — dùng cho những số phải tính trên MỌI hợp đồng: công nợ, yêu cầu sửa,
  // thợ chưa nhận, mốc kỷ niệm. Khối lịch/tắc/giao ảnh vẫn dùng `list`.
  const allContracts: OldRow[] = [...oldList, ...list].sort((a, b) =>
    (a.event_date || "\uffff").localeCompare(b.event_date || "\uffff")
  );

  // Lịch chụp sắp tới chỉ tính hợp đồng đã xác nhận/ký (bỏ nháp & mới gửi).
  //
  // Hai chỗ từng sai ở đây, cùng làm hỏng đúng một thứ — cái danh sách này:
  //  • Truy vấn hợp đồng chỉ sắp theo NGÀY, không theo giờ trong ngày. Phải tự
  //    sắp lại (ngày rồi giờ) thì "sắp tới" mới đúng nghĩa gần-nhất-trước.
  //  • Cắt `.slice(0, 6)` ngay tại đây khiến thẻ KPI "Lịch sắp tới" không bao giờ
  //    quá 6, dù studio có 30 buổi. Giữ danh sách đầy đủ để đếm; cắt lúc VẼ.
  const upcoming = list
    .filter((c) => c.event_date && c.event_date >= today && ["approved", "in_progress", "post_production", "completed"].includes(c.status))
    .sort((a, b) =>
      (a.event_date as string).localeCompare(b.event_date as string) ||
      // Buổi chưa ghi giờ xuống cuối ngày hôm đó, không đoán hộ là sáng hay chiều.
      (a.event_time || "99:99").localeCompare(b.event_time || "99:99")
    );
  // Yêu cầu sửa khách gửi mà chưa xử lý xong.
  const openEdits = allContracts.flatMap((c) =>
    (c.contract_edit_requests || []).filter((r) => r.status === "open").map(() => c)
  );

  // ── Hợp đồng đang TẮC ─────────────────────────────────────────────────────
  // Một hợp đồng không tự báo là nó đang đứng im. Ba chỗ dừng lâu nhất trong
  // thực tế: khách chưa ký, khách chưa chọn ảnh, và ảnh trễ hạn giao. Đo bằng
  // SỐ NGÀY chứ không phải trạng thái, vì trạng thái vẫn "đang thực hiện" suốt
  // thời gian nằm im.
  const STALL_DAYS = 7;
  const daysSince = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0;

  // Crew who haven't responded yet (pending) on non-cancelled contracts.
  // Tính sớm để đọc vai trò thợ SONG SONG với bước kiểm tra album bên dưới.
  const pendingCrew = allContracts
    .filter((c) => c.status !== "cancelled")
    .flatMap((c) => (c.contract_crew || []).filter((cr) => cr.status === "pending").map((cr) => ({ c, cr })));
  // Vai trò tự đặt chỉ cần đọc khi có thợ để nhắc (dùng ở mục 9 bên dưới).
  const crewRolesP = pendingCrew.length ? loadCrewRoles(supabase, profile.id as string) : Promise.resolve([]);

  // Album chọn ảnh nào đã có khách bấm chọn → hợp đồng đó không còn tắc ở bước này.
  // Chỉ hỏi cho đúng những hợp đồng CÓ THỂ tắc ở bước này (đã mời ≥ STALL_DAYS
  // ngày và không rơi vào nhánh "chưa ký" trước đó), mỗi album một câu
  // `limit(1)` — biết "có hay không" là đủ. Trước đây kéo về MỌI lượt chọn của
  // MỌI album chỉ để dựng một Set, với hàng trăm UUID nhét trong URL.
  // (Không dùng albums.selection_done_at: cột đó là "đã bấm chốt", còn ở đây
  // khách mới chọn vài ảnh là đã không còn tắc; album chốt trước migration lại NULL.)
  const inviteCandidates = [
    ...new Set(
      list
        .filter(
          (c) =>
            c.status !== "completed" && c.status !== "draft" &&
            !(c.status === "sent" && !c.client_signed_at) &&
            !!c.select_invited_at && !!c.selection_album_id &&
            daysSince(c.select_invited_at) >= STALL_DAYS
        )
        .map((c) => c.selection_album_id as string)
    ),
  ];
  const pickedAlbums = new Set<string>();
  for (const part of chunk(inviteCandidates, 10)) {
    const res = await Promise.all(
      part.map((id) => supabase.from("selections").select("album_id").eq("album_id", id).limit(1))
    );
    res.forEach(({ data }, i) => { if (data && data.length > 0) pickedAlbums.add(part[i]); });
  }

  type Stall = { c: (typeof list)[number]; reason: string; days: number; tone: ToneKey };
  const stalled: Stall[] = [];
  for (const c of list) {
    if (c.status === "completed" || c.status === "draft") continue;

    // 1) Đã gửi khách nhưng chưa ai ký.
    if (c.status === "sent" && !c.client_signed_at) {
      const d = daysSince(c.updated_at);
      if (d >= STALL_DAYS) stalled.push({ c, reason: "Khách chưa ký hợp đồng", days: d, tone: "amber" });
      continue;
    }
    // 2) Đã mời chọn ảnh nhưng album chưa có lượt chọn nào.
    if (c.select_invited_at && c.selection_album_id && !pickedAlbums.has(c.selection_album_id)) {
      const d = daysSince(c.select_invited_at);
      if (d >= STALL_DAYS) {
        stalled.push({ c, reason: "Khách chưa chọn ảnh", days: d, tone: "amber" });
        continue;
      }
    }
    // 3) Quá hạn giao ảnh — đây là lỗi của studio, tô đỏ.
    if (c.delivery_due && c.delivery_due < today) {
      const d = Math.floor((new Date(today).getTime() - new Date(c.delivery_due).getTime()) / 86400000);
      stalled.push({ c, reason: "Trễ hạn giao ảnh", days: d, tone: "red" });
    }
  }
  stalled.sort((a, b) => b.days - a.days);

  // Outstanding debts: active contracts where collected < total.
  const debts = allContracts
    .filter((c) => c.status !== "cancelled")
    .map((c) => ({ c, due: contractTotal(c.contract_items || []) - sumAmounts(c.contract_payments || []) }))
    .filter((d) => d.due > 0)
    .sort((a, b) => (a.c.event_date || "9999").localeCompare(b.c.event_date || "9999"));
  const totalDue = debts.reduce((s, d) => s + d.due, 0);

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
    id: string; label: string; amount: number; due_date: string; pay_code?: string | null;
    contract: { id: string; code: string | null; title: string } | null;
  }>);
  // CÙNG nội dung chuyển khoản với mã QR trong hợp đồng (mã HĐ + tên đợt).
  const planAct = (d: (typeof duePlan)[number]): OvAct => ({
    kind: "qr",
    amount: d.amount,
    addInfo: instalmentNote((d.contract?.code || d.contract?.title || "").slice(0, 25), d.label, d.pay_code),
    planId: d.id,
    contractId: d.contract?.id ?? null,
    amountLabel: vnd(d.amount),
  });

  // ── Số liệu KPI ───────────────────────────────────────────────
  // 6 tháng doanh thu — gom tiền đã thu theo YYYY-MM.
  const sixMonthPays = paySixMonths;
  // Tháng này = phần của cửa sổ 6 tháng từ ngày 1 trở đi (paid_at ISO so chuỗi
  // được với YYYY-MM-DD, đúng như `.gte("paid_at", monthStart)` trước đây).
  const revenueMonth = sumAmounts(sixMonthPays.filter((p) => (p.paid_at || "") >= monthStart));
  const notCancelled = list.filter((c) => c.status !== "cancelled");

  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10);
  const todayJobs = notCancelled
    .filter((c) => c.event_date === today)
    .sort((a, b) => (a.event_time || "").localeCompare(b.event_time || ""));
  // Khối "Lịch hôm nay & sắp tới" ở đầu trang. Ghép hai danh sách chứ không
  // dùng riêng `upcoming`: `todayJobs` nhận MỌI trạng thái (kể cả nháp/chờ ký —
  // buổi chiều nay chưa ký vẫn phải chuẩn bị), còn `upcoming` chỉ nhận HĐ đã
  // chốt. Lọc trùng ngày hôm nay ra khỏi vế sau để một buổi không hiện hai lần.
  const schedule = [...todayJobs, ...upcoming.filter((c) => c.event_date !== today)];
  const yesterdayJobs = notCancelled.filter((c) => c.event_date === yesterday).length;
  const jobsDelta = todayJobs.length - yesterdayJobs;

  const revBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(vnYear, vnMonth - 1 - 5 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const value = sixMonthPays
      .filter((p) => (p.paid_at || "").slice(0, 7) === key)
      .reduce((s, p) => s + (p.amount || 0), 0);
    return { label: `T${d.getUTCMonth() + 1}`, value };
  });
  const prevMonthRev = revBars.length >= 2 ? revBars[revBars.length - 2].value : 0;
  const revDeltaPct = prevMonthRev > 0 ? Math.round(((revenueMonth - prevMonthRev) / prevMonthRev) * 100) : null;

  const overdueDebts = debts.filter((d) => d.c.event_date && d.c.event_date < today);

  // ── Hàng đợi "Cần xử lý ngay" (tính năng mới số 1) ────────────────────
  // Mỗi dòng là một việc CÓ THẬT đang treo, kèm nút hành động tại chỗ. Làm xong
  // là dòng tự biến mất vì nó sinh ra từ chính dữ liệu, không phải danh sách tay.
  type Urgent = {
    key: string; kind: OvTaskKind; icon: typeof FileText; tone: ToneKey;
    title: string; sub: string; tag: string; cta: string; href: string;
    act?: OvAct;
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
      key: `crew-${c.id}`, kind: "crew", icon: UserPlus, tone: "red",
      title: `${c.title} chưa có nhân sự`,
      sub: `${fmtDow(c.event_date)} ${fmtDate(c.event_date)}${c.event_time ? ` · ${c.event_time}` : ""} · ${c.client_name || "khách chưa đặt tên"}`,
      tag: "Phân công", cta: "Phân công", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 2. Khách đã báo chuyển khoản, đang chờ studio đối soát rồi bấm "Đã thu".
  //    Đứng TRƯỚC công nợ quá hạn: tiền đã nằm trong tài khoản rồi, chỉ thiếu
  //    một cú xác nhận — làm xong là hết việc, không phải đi đòi ai.
  for (const pr of ((pendingProofs ?? []) as unknown as Array<{
    id: string; created_at: string;
    plan: { id: string; label: string; amount: number } | null;
    contract: { id: string; title: string; client_name: string | null } | null;
  }>)) {
    if (!pr.contract) continue;
    urgent.push({
      key: `proof-${pr.id}`, kind: "proof", icon: Banknote, tone: "amber",
      title: `Chờ đối soát: ${pr.contract.client_name || pr.contract.title}`,
      sub: `Khách đã gửi ảnh chuyển khoản${pr.plan ? ` · ${pr.plan.label} · ${vnd(pr.plan.amount)}` : ""} · ${fmtDate(pr.created_at)}`,
      tag: "Thanh toán", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${pr.contract.id}?tab=pay`,
      // Chốt NGAY tại thẻ: bốn bước (mở HĐ → tab → tìm đợt → bấm) xuống một.
      act: pr.plan ? { kind: "collect", planId: pr.plan.id, contractId: pr.contract.id, amountLabel: vnd(pr.plan.amount) } : undefined,
    });
  }

  // 2b. Tiền đã vào tài khoản (SePay báo) nhưng chưa biết của hợp đồng nào. Gộp
  //     một dòng: gán từng khoản làm ở thẻ Tự xác nhận, nơi có ô chọn đợt.
  //     Chỉ chủ studio: sổ giao dịch ngân hàng là của riêng chủ.
  if ((pendingBank ?? 0) > 0 && (profile.actingRole === "owner" || profile.actingRole === "admin")) {
    urgent.push({
      key: "bank-pending", kind: "bank", icon: Banknote, tone: "amber",
      title: `${pendingBank} khoản tiền vào chưa rõ của hợp đồng nào`,
      sub: "SePay đã báo tiền về nhưng nội dung không có mã đợt · gán vào đúng đợt hoặc bỏ qua",
      tag: "Thanh toán", cta: "Xem & gán", href: "/dashboard/studio/pricing#tu-xac-nhan",
    });
  }

  // 3. Đợt thu đã quá hạn.
  for (const d of duePlan.filter((x) => x.due_date < today)) {
    urgent.push({
      key: `plan-${d.id}`, kind: "plan", icon: Banknote, tone: "red",
      title: `Quá hạn thu: ${d.contract?.title || "hợp đồng"}`,
      sub: `${d.label} · ${vnd(d.amount)} · hạn ${fmtDate(d.due_date)}`,
      tag: "Công nợ", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${d.contract?.id ?? ""}`,
      // CÙNG nội dung chuyển khoản với mã QR trong hợp đồng (mã HĐ + tên đợt).
      // Trước đây chỗ này chỉ lấy tên hợp đồng, nên hai mã của CÙNG một đợt ra
      // hai nội dung khác nhau và sao kê không đối chiếu về đâu được.
      act: planAct(d),
    });
  }

  // 4. Trễ cam kết giao ảnh.
  for (const c of lateDeliveries) {
    const late = Math.abs(daysFromToday(c.delivery_due) ?? 0);
    urgent.push({
      key: `late-${c.id}`, kind: "late", icon: Clock, tone: "red",
      title: `Trễ cam kết giao ảnh: ${c.title}`,
      sub: `${c.client_name || "—"} · hạn ${fmtDate(c.delivery_due)} · quá ${late} ngày`,
      tag: "Cam kết", cta: "Giao ngay", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 5. Đã chụp xong nhưng chưa tạo album chọn ảnh.
  for (const c of notCancelled) {
    if (!c.event_date || c.event_date >= today) continue;
    // post_production BẮT BUỘC có mặt: sau ngày chụp hợp đồng tự sang trạng
    // thái đó, thiếu nó thì nhắc "chưa tạo album chọn ảnh" không bao giờ hiện.
    if (c.status !== "approved" && c.status !== "in_progress" && c.status !== "post_production") continue;
    // Hợp đồng makeup / thuê đồ không có ảnh nào để chọn — giục tạo album chọn
    // ảnh cho nó là việc không làm được, và mục này nằm ở khu VIỆC GẤP nên đẩy
    // những thứ thật sự gấp xuống dưới.
    if (!kindHasPhotoWork(contractKind(c.shoot_type))) continue;
    if (c.selection_album_id) continue;
    urgent.push({
      key: `album-${c.id}`, kind: "album", icon: ImagePlus, tone: "blue",
      title: `${c.title} đã chụp xong — chưa có album chọn ảnh`,
      sub: `${c.client_name || "—"} · chụp ${fmtDate(c.event_date)}${c.delivery_due ? ` · hạn giao ${fmtDate(c.delivery_due)}` : ""}`,
      tag: "Album", cta: "Tạo album", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 6. Hợp đồng đã gửi, khách chưa ký.
  for (const { c, days } of unsigned.filter((u) => u.days >= 1)) {
    urgent.push({
      key: `sign-${c.id}`, kind: "sign", icon: PenLine, tone: "amber",
      title: `${c.title} chưa được ký`,
      sub: `${c.client_name || "—"} · đã gửi ${days} ngày trước`,
      tag: "Hợp đồng", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${c.id}`,
      act: {
        kind: "messenger",
        link: c.client_messenger,
        label: "Nhắc khách",
        message: `Xin chào ${c.client_name || "anh/chị"}, studio gửi lại hợp đồng "${c.title}" để anh/chị xem & ký xác nhận giúp em nhé. Cảm ơn ạ!`,
      },
    });
  }

  // 7. Báo giá khách chưa phản hồi quá 2 ngày.
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
      key: `quote-${q.id}`, kind: "quote", icon: ReceiptText, tone: "amber",
      title: `Báo giá "${q.title || q.code || "chưa đặt tên"}" khách chưa chốt`,
      sub: `${q.client_name || "—"} · ${vnd(quoteSelectedTotal(q.quote_items || []))} · gửi ${days} ngày trước`,
      tag: "Báo giá", cta: "Mở báo giá", href: `/dashboard/studio/quotes/${q.id}`,
    });
  }

  // 8. Khách gửi yêu cầu sửa chưa xử lý.
  for (const c of openEdits) {
    urgent.push({
      key: `edit-${c.id}`, kind: "edit", icon: CircleAlert, tone: "amber",
      title: `Khách yêu cầu sửa: ${c.title}`,
      sub: `${c.client_name || "—"} · yêu cầu đang mở`,
      tag: "Yêu cầu sửa", cta: "Xem yêu cầu", href: `/dashboard/studio/contracts/${c.id}`,
    });
  }

  // 9. Thợ chưa nhận job. Vai trò tự đặt đã bắt đầu đọc từ trên (crewRolesP).
  const crewRoles = await crewRolesP;
  for (const { c, cr } of pendingCrew) {
    urgent.push({
      key: `pcrew-${cr.id}`, kind: "pcrew", icon: Users, tone: "blue",
      title: `${cr.name || cr.phone || "Thợ"} chưa phản hồi lời mời`,
      sub: `${crewRoleLabel(cr.role, crewRoles)} · ${c.title}${c.event_date ? ` · ${fmtDate(c.event_date)}` : ""}`,
      tag: "Nhân sự", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${c.id}`,
      act: {
        kind: "messenger",
        label: "Nhắc thợ",
        message: shootReminderMessage({ name: cr.name, title: c.title, date: c.event_date, time: c.event_time, location: c.location, role: crewRoleLabel(cr.role, crewRoles), link: crewPortal }),
      },
    });
  }

  // 10. Đánh giá khách đang chờ duyệt. Gộp thành MỘT dòng chứ không một dòng
  //     mỗi đánh giá: cả cụm xử lý ở cùng một màn trong một lượt, tách ra chỉ
  //     đẩy chín việc khác ra khỏi top 6.
  if ((pendingReviews ?? 0) > 0) {
    urgent.push({
      key: "reviews-pending", kind: "reviews", icon: Star, tone: "amber",
      title: `${pendingReviews} đánh giá khách chờ bạn duyệt`,
      sub: "Khách đã viết cảm nhận — duyệt thì mới lên website studio",
      tag: "Đánh giá", cta: "Duyệt ngay", href: "/dashboard/studio/reviews",
    });
  }

  // ── Nên liên hệ tháng này (kỷ niệm & chụp lại) ────────────────────────
  // Tính THẲNG từ `allContracts` đã tải ở trên — không thêm truy vấn nào, vì tập
  // "đã xong từ lâu" chứa đủ hợp đồng nhiều năm trước (mốc 1/3/5/10 năm đều cũ
  // hơn cửa sổ 180 ngày). Nhân sự không thấy khối này: đây là việc chăm khách
  // của quản lý, mà danh sách của nhân sự còn bị lọc theo phân công nên số sẽ sai.
  const milestones =
    profile.actingRole === "staff"
      ? []
      : upcomingMilestones(
          allContracts.map((c) => ({
            id: c.id,
            title: c.title,
            client_name: c.client_name,
            client_phone: c.client_phone,
            event_date: c.event_date,
            shoot_type: c.shoot_type,
            status: c.status,
          })),
          today,
        );
  const milestoneTop = milestones.slice(0, 6);

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
      icon: TrendingUp, tone: "green", label: `Doanh thu tháng ${vnMonth}`,
      value: vndShort(revenueMonth), sub: `${allContracts.length} hợp đồng đang có`,
      delta: revDeltaPct != null ? `${revDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(revDeltaPct)}%` : undefined,
      deltaTone: (revDeltaPct ?? 0) >= 0 ? "green" : "red",
    },
    {
      icon: Hourglass, tone: "amber", label: "Việc đang chờ bạn",
      value: String(urgent.length), sub: "báo giá, cọc, phân công, giao ảnh, đánh giá",
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
  // Ký tên cuối lời chúc kỷ niệm — tên thương hiệu studio, không phải tên chủ.
  const studioName = brandFrom(profile).name;

  // ── Giao diện mới (V2): cùng dữ liệu đã tính ở trên, chỉ đổi cách bày ─────
  if (await isUiV2()) {
    const toTask = (u: Urgent): OvTask => ({
      key: u.key, kind: u.kind, tone: u.tone, title: u.title, sub: u.sub, tag: u.tag, cta: u.cta, href: u.href, act: u.act,
    });
    return (
      <OverviewV2
        greeting={greeting}
        firstName={firstName}
        today={today}
        vnMonth={vnMonth}
        todayJobs={todayJobs.length}
        jobsDelta={jobsDelta}
        revenueMonth={revenueMonth}
        revDeltaPct={revDeltaPct}
        contractsCount={allContracts.length}
        totalDue={totalDue}
        debtsCount={debts.length}
        overdueDebtsCount={overdueDebts.length}
        tasks={urgent.map(toTask)}
        dueSoon={duePlan
          .filter((d) => d.due_date >= today)
          .map((d) => ({
            key: `soon-${d.id}`, kind: "plan-soon", tone: "blue",
            title: d.contract?.title || "Hợp đồng",
            sub: `${d.label} · ${vnd(d.amount)} · hạn ${fmtDate(d.due_date)}`,
            tag: "Sắp tới hạn", cta: "Mở hợp đồng", href: `/dashboard/studio/contracts/${d.contract?.id ?? ""}`,
            act: planAct(d),
          }))}
        schedule={schedule.map((c) => ({
          id: c.id, title: c.title, client_name: c.client_name, event_date: c.event_date, event_time: c.event_time,
          status: c.status, location: c.location, shootLabel: SHOOT_TYPE_LABEL[c.shoot_type] ?? "",
          crewCount: (c.contract_crew || []).filter((cr) => cr.status !== "declined").length,
        }))}
        warns={warnTop.map((w) => ({ key: w.key, tone: w.tone, title: w.title, sub: w.sub, kind: w.icon === CalendarRange ? "day" : "person" }))}
        sla={slaRows.map(({ c, left }) => ({
          id: c.id, title: c.title, client_name: c.client_name, shootLabel: SHOOT_TYPE_LABEL[c.shoot_type] ?? "", delivery_due: c.delivery_due, left,
        }))}
        slaLate={slaLate}
        stalled={stalled.map(({ c, reason, days, tone }) => ({ id: c.id, title: c.title, client_name: c.client_name, reason, days, tone }))}
        stallDays={STALL_DAYS}
        milestones={milestoneTop.map((m) => ({
          key: `${m.contractId}-${m.years}`,
          contractId: m.contractId,
          name: m.clientName || m.title || "Khách cũ",
          label: MILESTONE_LABEL[m.kind](m.years),
          date: m.date,
          inDays: m.inDays,
          message: milestoneMessage({ clientName: m.clientName, kind: m.kind, years: m.years, studio: studioName }),
        }))}
        milestonesTotal={milestones.length}
        revBars={revBars}
        bank={bank}
        autoEmail={profile.actingRole !== "staff" ? { ownerId: profile.id, initial: !!profile.auto_client_emails } : null}
      />
    );
  }

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


      {/* ── 4 thẻ KPI ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <UpcomingSchedule rows={schedule} today={today} />

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
              {u.act && <UrgentActV1 act={u.act} bank={bank} />}
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

      {/* ── Nên liên hệ tháng này ─────────────────────────────────────
          Khách cũ tới mốc kỷ niệm. Chỉ hiện khi CÓ ai đó tới mốc — studio đang
          không có khách nào tới hạn thì khối này biến mất thay vì chiếm chỗ
          bằng một ô trống. */}
      {milestoneTop.length > 0 && (
        <Panel>
          <PanelHead
            icon={Gift} tone="brand" title="Nên liên hệ tháng này"
            count={String(milestones.length)}
            note="Khách cũ tới mốc kỷ niệm — một lời chúc là một cơ hội chụp lại"
          />
          {milestoneTop.map((m) => {
            const late = m.inDays < 0;
            const when =
              m.inDays === 0 ? "Hôm nay" : late ? `Qua ${Math.abs(m.inDays)} ngày` : `Còn ${m.inDays} ngày`;
            return (
              <div key={`${m.contractId}-${m.years}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold" style={avatarStyle(m.clientName || m.title || "?")}>
                  {initials(m.clientName || m.title || "?")}
                </span>
                <div className="min-w-[190px] flex-1">
                  <p className="text-[13.5px] font-semibold">{m.clientName || m.title || "Khách cũ"}</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {MILESTONE_LABEL[m.kind](m.years)} · {fmtDate(m.date)}
                  </p>
                </div>
                <Pill tone={m.inDays <= 3 ? "amber" : "gray"}>{when}</Pill>
                <MessengerButton
                  label="Gửi lời chúc"
                  message={milestoneMessage({
                    clientName: m.clientName,
                    kind: m.kind,
                    years: m.years,
                    studio: studioName,
                  })}
                />
                <Link
                  href={`/dashboard/studio/contracts/${m.contractId}`}
                  className="flex-none whitespace-nowrap rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold"
                  style={{ background: "var(--tx)", color: "var(--sf)" }}
                >
                  Mở hợp đồng
                </Link>
              </div>
            );
          })}
          {milestones.length > milestoneTop.length && (
            <p className="px-4 py-2.5 text-[12px]" style={{ color: "var(--tx3)" }}>
              Còn {milestones.length - milestoneTop.length} khách nữa tới mốc trong 45 ngày tới.
            </p>
          )}
        </Panel>
      )}

      {/* ── Doanh thu tháng ───────────────────────────────────────────── */}
      <RevenueChart
        bars={revBars}
        headline={vnd(revenueMonth)}
        delta={revDeltaPct != null ? `${revDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(revDeltaPct)}% so với tháng trước` : null}
      />

      {/* Hợp đồng đang tắc — việc nằm im không tự kêu, nên phải có chỗ kêu hộ.
          Chỉ hiện khi thực sự có hợp đồng tắc; studio đang chạy trơn thì khối
          này biến mất thay vì chiếm chỗ với một ô trống. */}
      {stalled.length > 0 && (
        <Panel className="mt-3.5">
          <PanelHead
            icon={AlertTriangle}
            tone="amber"
            title="Hợp đồng đang tắc"
            count={String(stalled.length)}
            note={`Đứng im từ ${STALL_DAYS} ngày trở lên`}
          />
          <div className="px-2 pb-2">
            {stalled.slice(0, 6).map(({ c, reason, days, tone }) => (
              <Link
                key={`${c.id}-${reason}`}
                href={`/dashboard/studio/contracts/${c.id}`}
                className="nav-item flex w-full items-center gap-2.5 rounded-[10px] px-2 py-[9px] text-left"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold" style={avatarStyle(c.client_name || c.title)}>
                  {initials(c.client_name || c.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{c.title}</span>
                  <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                    {c.client_name || "Chưa có tên khách"} · {reason}
                  </span>
                </span>
                <Pill tone={tone}>{days} ngày</Pill>
              </Link>
            ))}
            {stalled.length > 6 && (
              <p className="px-2 pb-1 pt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                và {stalled.length - 6} hợp đồng khác
              </p>
            )}
          </div>
        </Panel>
      )}

      {profile.actingRole !== "staff" && (
        <AutoEmailToggle ownerId={profile.id} initial={!!profile.auto_client_emails} />
      )}
    </div>
  );
}
