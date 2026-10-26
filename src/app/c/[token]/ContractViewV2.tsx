"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FilePlus2,
  FileText,
  Heart,
  ImagePlus,
  Images,
  ListChecks,
  Lock,
  MapPin,
  MessageSquare,
  Package,
  PenLine,
  Phone,
  Printer,
  QrCode,
  Send,
  Sparkles,
  Star,
  Upload,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { Badge, Callout, Card, Field, Progress, Section, Stack, btn, iconBtn, inputCls, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { Menu, Modal, Segmented } from "@/components/v2/kit-client";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { daysFromToday, fmtDate, fmtDateTime, fmtDow, fmtLunar, todayVN } from "@/lib/date";
import { downloadIcs, googleCalendarUrl, type CalEvent } from "@/lib/calendar";
import { instalmentNote, qrUrl } from "@/lib/vietqr";
import { thiepUrl } from "@/lib/hosts";
import { vnd, SHOOT_TYPE_LABEL, PRODUCT_STATUS_LABEL, type ContractStatus } from "@/lib/types";
import PortalVoucher from "./PortalVoucher";
import { PaidConfirmScreen } from "./PaidConfirm";
import ContractPrintDoc from "./ContractPrintDoc";
import ClientAddendaV2 from "./ClientAddendaV2";
import { useContractPortal, type ContractPortal, type PortalPayload } from "./useContractPortal";
import { CopyRow, CustomerRootAuto, Fact, LangToggle, MoneyLine, StepsBar, StickyActionBar, ToastV2, useInView } from "./DocPartsV2";

/* ═══════════════════════════════════════════════════════════════════════════
   HỢP ĐỒNG GỬI KHÁCH — giao diện mới. Cùng state, cùng lời gọi máy chủ với bản
   cũ (./useContractPortal); khác ở cách sắp xếp, viết cho khách mở từ Zalo:
     • Đầu trang thương hiệu studio + nút gọi + menu ⋯ (in/PDF, trang theo dõi,
       yêu cầu chỉnh sửa).
     • Thẻ đầu: trạng thái bằng chữ to ("Hợp đồng chờ bạn ký", "Còn phải thanh
       toán …"), bốn con số (ngày chụp, địa điểm, giá trị, đã trả), tiến trình
       Ký → Đặt cọc → Chụp → Giao ảnh và MỘT nút chính theo việc cần làm.
     • Nội dung chia khối: Dịch vụ & hạng mục · Phụ lục · Lịch trình · Thanh
       toán · Điều khoản (thu gọn) · Hai bên ký kết · Ảnh & quà tặng · Gửi studio.
     • Ký và chuyển khoản mở trong hộp thoại (điện thoại: bảng trượt từ đáy) —
       mã QR + từng dòng chép được + gửi ảnh chuyển khoản ngay tại chỗ.
     • Điện thoại: nút chính cuộn khuất thì hiện thanh thao tác dính dưới đáy.
       Máy tính: cột phải dính theo cuộn (tiền · trang theo dõi · liên hệ).
     • In/PDF: phần màn hình mang `no-print`, in ra đúng bản A4 dùng chung
       (./ContractPrintDoc) như bản cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Nhãn trạng thái viết cho KHÁCH (bản in vẫn dùng CONTRACT_STATUS_LABEL như bản cũ). */
const STATUS: Record<ContractStatus, { tone: Tone; vi: string; en: string }> = {
  draft: { tone: "gray", vi: "Bản nháp", en: "Draft" },
  sent: { tone: "amber", vi: "Chờ bạn ký", en: "Awaiting signature" },
  approved: { tone: "blue", vi: "Đã ký", en: "Signed" },
  in_progress: { tone: "teal", vi: "Đang thực hiện", en: "In progress" },
  post_production: { tone: "violet", vi: "Đang hậu kỳ", en: "Editing photos" },
  completed: { tone: "green", vi: "Hoàn thành", en: "Completed" },
  cancelled: { tone: "red", vi: "Đã huỷ", en: "Cancelled" },
};

type Action = { label: string; icon: LucideIcon; onClick?: () => void; href?: string; external?: boolean; note: React.ReactNode };
type StudioTab = "edit" | "brief" | "review" | "msgr";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 76, behavior: "smooth" });
}

export default function ContractViewV2({
  token,
  brand,
  initial,
}: {
  token: string;
  /** Thương hiệu studio (page.tsx đọc theo token) — hiện cả ở màn nhập SĐT. */
  brand: StudioBrandInfo;
  /** Dữ liệu dựng sẵn cho màn xem trước giao diện. */
  initial?: PortalPayload;
}) {
  const p = useContractPortal(token, { initial });
  const L = (vi: string, en: string) => (p.lang === "vi" ? vi : en);
  const headerBrand: StudioBrandInfo = { name: brand.name, logoUrl: brand.logoUrl ?? p.studioLogo };
  const toggleLang = () => p.setLang(p.lang === "vi" ? "en" : "vi");

  /* ── Hộp thoại ký + chuyển khoản ── */
  const [signOpen, setSignOpen] = useState(false);
  const [payPlanId, setPayPlanId] = useState<string | null>(null);
  const openPay = (planId: string | null) => {
    setPayPlanId(planId);
    p.setQrOpen(true);
  };
  useEffect(() => {
    if (p.signed) setSignOpen(false);
  }, [p.signed]);

  /* ── Khối "Gửi cho studio" ── */
  const [studioTab, setStudioTab] = useState<StudioTab | null>(null);
  const openStudio = (tab: StudioTab) => {
    setStudioTab(tab);
    requestAnimationFrame(() => scrollToId("v2-studio"));
  };

  /* ── Thanh dính: chỉ hiện khi nút chính ở thẻ đầu đã cuộn khuất ── */
  const [actionEl, setActionEl] = useState<HTMLDivElement | null>(null);
  const actionInView = useInView(actionEl, "-60px 0px 0px 0px");

  const c = p.contract;

  return (
    <>
      <CustomerRootAuto className="no-print">
        <CustomerHeaderV2
          brand={headerBrand}
          sub={L("Hợp đồng dịch vụ", "Service contract")}
          right={
            <>
              <LangToggle lang={p.lang} onToggle={toggleLang} />
              {c && p.studioPhone ? (
                <a href={`tel:${p.studioPhone}`} className={iconBtn()} aria-label={L("Gọi studio", "Call the studio")} title={L("Gọi studio", "Call the studio")}>
                  <Phone size={18} />
                </a>
              ) : null}
              {c ? (
                <Menu
                  label={L("Thêm thao tác", "More")}
                  width={240}
                  items={[
                    { label: p.t("pdf"), icon: Printer, onClick: () => window.print() },
                    { label: L("Trang theo dõi của bạn", "Your tracking page"), icon: ListChecks, href: `/portal/${token}` },
                    "divider",
                    { label: p.t("editReq"), icon: MessageSquare, onClick: () => openStudio("edit") },
                    ...(p.studioPhone ? [{ label: `${L("Gọi", "Call")} ${p.studioPhone}`, icon: Phone, href: `tel:${p.studioPhone}`, external: false }] : []),
                  ]}
                />
              ) : null}
            </>
          }
        />

        {!c ? (
          <Gate p={p} L={L} />
        ) : (
          <Body
            p={p}
            L={L}
            token={token}
            openSign={() => setSignOpen(true)}
            openPay={openPay}
            openStudio={openStudio}
            studioTab={studioTab}
            setStudioTab={setStudioTab}
            setActionEl={setActionEl}
            actionInView={actionInView}
          />
        )}

        <ToastV2 msg={p.toast} />

        {c && (
          <>
            <SignModal p={p} L={L} open={signOpen} onClose={() => (p.signing ? undefined : setSignOpen(false))} />
            <PayModal p={p} L={L} open={p.qrOpen} planId={payPlanId} setPlanId={setPayPlanId} onClose={() => p.setQrOpen(false)} />
          </>
        )}

        {p.paidNow && c && (
          <PaidConfirmScreen
            e={p.paidNow}
            lang={p.lang}
            studioName={p.studioName}
            contractRef={c.code || c.title}
            eventDate={c.event_date}
            remaining={Math.max(0, p.balance)}
            onClose={() => p.setPaidNow(null)}
          />
        )}
      </CustomerRootAuto>

      {/* Bản in chính thức (đen trắng, A4) — dùng chung với bản cũ. */}
      {c && (
        <ContractPrintDoc
          contract={c}
          studioName={p.studioName}
          studioLogo={p.studioLogo}
          studioPhone={p.studioPhone}
          bank={p.bank}
          items={p.items}
          products={p.products}
          payments={p.payments}
          plan={p.plan}
          milestones={p.milestones}
          itemsTotal={p.itemsTotal}
          surcharge={p.surcharge}
          printing={p.printing}
          total={p.total}
          collected={p.collected}
          balance={p.balance}
          qr={p.qr}
        />
      )}
    </>
  );
}

type Tr = (vi: string, en: string) => string;

/* ═══ Màn nhập số điện thoại ═══════════════════════════════════════════════ */
function Gate({ p, L }: { p: ContractPortal; L: Tr }) {
  return (
    <CustomerMainV2 width={460}>
      <div className="flex min-h-[calc(100dvh-170px)] flex-col justify-center">
        <Card className="text-center">
          <form onSubmit={p.unlock} className="flex flex-col items-center px-1 py-3 sm:px-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <Lock size={22} />
            </span>
            <h1 className="mt-4 text-[22px] font-bold tracking-[-0.4px]">{p.t("portalTitle")}</h1>
            <p className="mt-1.5 max-w-[34ch] text-[14px] leading-relaxed" style={{ color: "var(--tx2)" }}>
              {p.t("gatePrompt")}
            </p>
            <label className="mt-5 w-full text-left">
              <span className="v2-label">{p.t("phone")}</span>
              <input
                className={`${inputCls} mt-1.5 !h-12 text-center !text-[17px] font-semibold tracking-[0.06em]`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09xx xxx xxx"
                value={p.phone}
                onChange={(e) => p.setPhone(e.target.value)}
              />
            </label>
            {p.err && (
              <div className="mt-3 w-full text-left">
                <Callout tone="red" icon={CircleAlert}>
                  {p.err}
                </Callout>
              </div>
            )}
            <button type="submit" disabled={p.loading || !p.phone.trim()} className={btn("primary", "lg", "mt-4 w-full")}>
              {p.loading ? p.t("opening") : p.t("view")}
            </button>
          </form>
        </Card>
        <p className="mx-auto mt-4 max-w-[38ch] text-center text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {L(
            "Số điện thoại là mật khẩu, để chỉ bạn xem được hợp đồng và các khoản thanh toán.",
            "Your phone number is the password, so only you can see the contract and payments.",
          )}
        </p>
      </div>
    </CustomerMainV2>
  );
}

/* ═══ Nội dung hợp đồng ════════════════════════════════════════════════════ */
function Body({
  p,
  L,
  token,
  openSign,
  openPay,
  openStudio,
  studioTab,
  setStudioTab,
  setActionEl,
  actionInView,
}: {
  p: ContractPortal;
  L: Tr;
  token: string;
  openSign: () => void;
  openPay: (planId: string | null) => void;
  openStudio: (t: StudioTab) => void;
  studioTab: StudioTab | null;
  setStudioTab: (t: StudioTab) => void;
  setActionEl: (el: HTMLDivElement | null) => void;
  actionInView: boolean;
}) {
  const c = p.contract!;
  const today = todayVN();
  const cancelled = c.status === "cancelled";
  const overdue = !!(p.nextDue?.due_date && p.nextDue.due_date < today);
  const addendaWaiting = p.addenda.filter((a) => !a.signed_at).length;
  const photos = p.selection
    ? { href: `/a/${p.selection.slug}`, deliver: p.selection.phase === "delivery", title: p.selection.title }
    : p.gallery
      ? { href: `/album/${p.gallery.slug}`, deliver: true, title: p.gallery.title }
      : null;
  const days = daysFromToday(c.event_date);

  /* ── Trạng thái bằng chữ + MỘT việc chính ── */
  let hero: { tone: Tone; icon: LucideIcon; title: string; sub: string };
  let action: Action | null = null;
  if (cancelled) {
    hero = {
      tone: "red",
      icon: Ban,
      title: L("Hợp đồng đã huỷ", "This contract was cancelled"),
      sub: L("Liên hệ studio nếu bạn cần hỗ trợ thêm.", "Contact the studio if you need help."),
    };
  } else if (!p.signed) {
    hero = {
      tone: "amber",
      icon: PenLine,
      title: L("Hợp đồng chờ bạn ký", "Waiting for your signature"),
      sub:
        p.collected <= 0 && p.balance > 0
          ? L(
              `Đọc kỹ nội dung bên dưới rồi ký xác nhận. Sau khi ký, bạn thanh toán ${p.nextDue ? `“${p.nextDue.label}”` : "khoản cọc"} ${vnd(p.dueAmount)}.`,
              `Read the contract below, then sign. After signing, transfer ${vnd(p.dueAmount)} to hold your date.`,
            )
          : L("Đọc kỹ nội dung bên dưới rồi ký xác nhận. Có điểm chưa ổn? Gửi yêu cầu chỉnh sửa cho studio trước.", "Read the contract below, then sign. Something off? Ask the studio to change it first."),
    };
    action = { label: L("Ký hợp đồng", "Sign contract"), icon: PenLine, onClick: openSign, note: L("Hợp đồng chờ bạn ký", "Awaiting your signature") };
  } else if (addendaWaiting > 0) {
    hero = {
      tone: "amber",
      icon: FilePlus2,
      title: L("Có phụ lục chờ bạn ký", "An addendum needs your signature"),
      sub: L("Studio vừa thêm hoặc bớt dịch vụ. Ký phụ lục để xác nhận thay đổi.", "The studio changed some services. Sign the addendum to confirm."),
    };
    action = { label: L("Xem & ký phụ lục", "Review & sign"), icon: FilePlus2, onClick: () => scrollToId("v2-addenda"), note: L("Phụ lục chờ bạn ký", "Addendum to sign") };
  } else if (p.balance > 0) {
    const due = p.nextDue?.due_date;
    hero = {
      tone: overdue ? "red" : "amber",
      icon: Wallet,
      title: `${L("Còn phải thanh toán", "Amount due")} ${vnd(p.dueAmount)}`,
      sub: [
        p.nextDue ? p.nextDue.label : L("Phần còn lại của hợp đồng", "Remaining balance"),
        due ? `${overdue ? L("quá hạn từ", "overdue since") : L("hạn", "due")} ${fmtDate(due)}` : "",
        p.dueAmount < p.balance ? `${L("tổng còn lại", "total remaining")} ${vnd(p.balance)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
    action = {
      label: L("Thanh toán", "Pay now"),
      icon: QrCode,
      onClick: () => openPay(p.nextDue?.id ?? null),
      note: (
        <>
          <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>
            {p.nextDue ? p.nextDue.label : L("Còn phải thanh toán", "Amount due")}
          </span>
          <span className="block text-[16px] font-bold" style={{ color: overdue ? "var(--rd)" : "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
            {vnd(p.dueAmount)}
          </span>
        </>
      ),
    };
  } else if (photos && !photos.deliver) {
    hero = {
      tone: "green",
      icon: ImagePlus,
      title: L("Ảnh đã sẵn sàng để bạn chọn", "Your photos are ready to pick"),
      sub: L("Mở album và đánh dấu những tấm bạn ưng ý. Mật khẩu là số điện thoại của bạn.", "Open the album and mark your favourites. The password is your phone number."),
    };
    action = { label: L("Chọn ảnh", "Pick photos"), icon: ImagePlus, href: photos.href, external: true, note: photos.title };
  } else if (photos) {
    hero = {
      tone: "green",
      icon: Images,
      title: L("Ảnh của bạn đã sẵn sàng", "Your photos are ready"),
      sub: L("Mở album để xem và tải ảnh. Mật khẩu là số điện thoại của bạn.", "Open the album to view and download. The password is your phone number."),
    };
    action = { label: L("Xem ảnh", "View photos"), icon: Images, href: photos.href, external: true, note: photos.title };
  } else if (c.status === "completed") {
    hero = {
      tone: "green",
      icon: CheckCircle2,
      title: L("Hợp đồng đã hoàn thành", "Contract completed"),
      sub: L(`Cảm ơn bạn đã đồng hành cùng ${p.studioName}.`, `Thank you for choosing ${p.studioName}.`),
    };
  } else if (days !== null && days >= 0) {
    hero = {
      tone: "green",
      icon: CalendarCheck,
      title: days === 0 ? L("Hôm nay là ngày chụp", "Today is the shoot day") : L(`Còn ${days} ngày tới buổi chụp`, `${days} days until your shoot`),
      sub: L("Bạn đã ký và thanh toán đủ. Hẹn gặp bạn!", "Signed and fully paid. See you soon!"),
    };
  } else {
    hero = {
      tone: "violet",
      icon: Sparkles,
      title: L("Studio đang hoàn thiện ảnh của bạn", "The studio is finishing your photos"),
      sub: L("Studio sẽ báo bạn ngay khi ảnh sẵn sàng.", "You'll be notified when the photos are ready."),
    };
  }

  const steps = [
    { key: "sign", label: L("Ký", "Sign"), done: p.signed },
    { key: "deposit", label: L("Đặt cọc", "Deposit"), done: p.collected > 0 },
    { key: "shoot", label: L("Chụp", "Shoot"), done: c.status === "post_production" || c.status === "completed" || (!!c.event_date && c.event_date < today) },
    { key: "deliver", label: L("Giao ảnh", "Delivery"), done: c.status === "completed" || !!photos?.deliver },
  ];

  const pct = p.total > 0 ? Math.round((Math.max(0, p.collected) / p.total) * 100) : 0;
  const HeroIcon = hero.icon;

  const actionBtn = (size: "md" | "lg", extra = "") =>
    action ? (
      action.href ? (
        <a href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined} className={btn("primary", size, extra)}>
          <action.icon size={size === "lg" ? 18 : 16} /> {action.label}
        </a>
      ) : (
        <button type="button" onClick={action.onClick} className={btn("primary", size, extra)}>
          <action.icon size={size === "lg" ? 18 : 16} /> {action.label}
        </button>
      )
    ) : null;

  return (
    <>
      <CustomerMainV2>
        <Stack gap={16}>
          {/* ── Thẻ đầu: trạng thái + số liệu + tiến trình + việc chính ── */}
          <header className="v2-card overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                <span>{L("Hợp đồng dịch vụ chụp ảnh", "Photography service contract")}</span>
                {c.code && (
                  <>
                    <span>·</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--tx2)" }}>
                      {c.code}
                    </span>
                  </>
                )}
                <Badge tone={STATUS[c.status].tone} dot>
                  {p.lang === "vi" ? STATUS[c.status].vi : STATUS[c.status].en}
                </Badge>
              </div>
              <h1 className="mt-2 text-[20px] font-bold leading-snug tracking-[-0.3px] sm:text-[24px]" style={{ textWrap: "pretty" }}>
                {c.title}
              </h1>

              <div className="mt-4 flex items-start gap-3 rounded-[14px] p-3.5 sm:p-4" style={{ background: toneBg(hero.tone) }}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--sf)", color: toneFg(hero.tone) }}>
                  <HeroIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-bold leading-snug tracking-[-0.2px] sm:text-[18px]" style={{ color: toneFg(hero.tone) }} data-testid="contract-hero-title">
                    {hero.title}
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    {hero.sub}
                  </p>
                </div>
              </div>

              <div ref={setActionEl} className="mt-4 flex flex-wrap items-center gap-2">
                {actionBtn("lg", "w-full sm:w-auto")}
                {!action && (
                  <Link href={`/portal/${token}`} className={btn("secondary", "md")}>
                    <ListChecks size={16} /> {L("Trang theo dõi", "Tracking page")}
                  </Link>
                )}
                <button type="button" onClick={() => window.print()} className={btn("ghost", "md", action ? "hidden sm:inline-flex" : "")}>
                  <Printer size={16} /> {p.t("pdf")}
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 lg:grid-cols-4" style={{ borderTop: "1px solid var(--bd2)" }}>
              <Fact label={L("Ngày chụp", "Shoot date")} className="[border-right:1px_solid_var(--bd2)]">
                {c.event_date ? (
                  <>
                    <span className="block">
                      {fmtDate(c.event_date)}
                      {c.event_time ? ` · ${c.event_time}` : ""}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
                      ÂL {fmtLunar(c.event_date)}
                      {days !== null && days >= 0 && !cancelled ? ` · ${days === 0 ? L("hôm nay", "today") : L(`còn ${days} ngày`, `in ${days} days`)}` : ""}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--tx3)" }}>{L("Chưa chốt ngày", "Not set yet")}</span>
                )}
              </Fact>
              <Fact label={L("Địa điểm", "Location")} className="lg:[border-right:1px_solid_var(--bd2)]">
                <span className="line-clamp-2 text-[14px] leading-snug" title={c.location || undefined} style={{ color: c.location ? "var(--tx)" : "var(--tx3)" }}>
                  {c.location || "—"}
                </span>
              </Fact>
              <Fact label={L("Giá trị hợp đồng", "Contract value")} className="[border-right:1px_solid_var(--bd2)] [border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
                <span className="block" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {vnd(p.total)}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
                  {SHOOT_TYPE_LABEL[c.shoot_type]} · {p.items.length} {L("hạng mục", "items")}
                </span>
              </Fact>
              <Fact label={p.t("paid")} className="[border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
                <span className="block" style={{ color: p.collected > 0 ? "var(--gn)" : "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
                  {vnd(p.collected)}
                </span>
                <span className="mt-1.5 block">
                  <Progress value={pct} tone={p.balance <= 0 && p.total > 0 ? "green" : "brand"} />
                </span>
                <span className="mt-1 block text-[12.5px] font-medium" style={{ color: p.balance > 0 ? "var(--am)" : "var(--gn)" }}>
                  {p.balance > 0 ? `${L("Còn", "Left")} ${vnd(p.balance)}` : L("Đã thanh toán đủ", "Fully paid")}
                </span>
              </Fact>
            </dl>

            {!cancelled && (
              <div className="px-4 py-4 sm:px-6" style={{ borderTop: "1px solid var(--bd2)" }}>
                <StepsBar steps={steps} label={L("Tiến trình hợp đồng", "Contract progress")} />
              </div>
            )}
          </header>

          {/* Điện thoại: lối sang trang theo dõi (máy tính nằm ở cột phải). */}
          <TrackingLink token={token} L={L} className="lg:hidden" />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
            <Stack gap={16}>
              {p.quoteOptions.length > 0 && <QuoteOptionsSection p={p} />}
              <ItemsSection p={p} L={L} />
              <ClientAddendaV2 id="v2-addenda" token={token} phone={p.phone} lang={p.lang} addenda={p.addenda} onSigned={() => p.fetchContract(p.phone)} />
              {(c.event_date || p.milestones.length > 0) && <ScheduleSection p={p} L={L} />}
              {(p.balance > 0 || p.plan.length > 0) && <PaySection p={p} L={L} overdue={overdue} openPay={openPay} />}
              {p.loyalty && <PortalVoucher l={p.loyalty} studioName={p.studioName} clientName={c.client_name} />}
              {p.termLines.length > 0 && <TermsSection p={p} L={L} />}
              <PartiesSection p={p} L={L} openSign={openSign} />
              {(p.selection || p.gallery || p.wedding || p.story) && <PhotosGiftsSection p={p} L={L} />}
              {p.tasks.length > 0 && <TasksSection p={p} L={L} />}
              <StudioSection
                p={p}
                L={L}
                tab={studioTab ?? (!p.signed ? "edit" : c.status === "completed" ? "review" : "brief")}
                setTab={setStudioTab}
              />
              <p className="pb-2 text-center text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {p.t("updated")}: {fmtDateTime(c.updated_at)} · {p.studioName}
              </p>
            </Stack>

            <aside className="hidden lg:sticky lg:top-[76px] lg:flex lg:flex-col lg:gap-4" aria-label={L("Tóm tắt", "Summary")}>
              <MoneyCard p={p} L={L} overdue={overdue} openPay={openPay} />
              <TrackingLink token={token} L={L} />
              <HelpCard p={p} L={L} openStudio={openStudio} />
            </aside>
          </div>
        </Stack>
        {action && <div className="h-16 lg:hidden" aria-hidden />}
      </CustomerMainV2>

      {action && (
        <StickyActionBar show={!actionInView}>
          <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{action.note}</div>
          {actionBtn("md")}
        </StickyActionBar>
      )}
    </>
  );
}

/* ── Lối sang trang theo dõi riêng của khách (cùng token, cùng mật khẩu) ── */
function TrackingLink({ token, L, className = "" }: { token: string; L: Tr; className?: string }) {
  return (
    <Link href={`/portal/${token}`} className={`v2-card v2-card-link flex items-center gap-3 px-4 py-3.5 ${className}`}>
      <span className="v2-section-icon">
        <ListChecks size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{L("Trang theo dõi của bạn", "Your tracking page")}</span>
        <span className="block text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          {L("Lịch hẹn, tiến độ thanh toán, sản phẩm và album ảnh", "Appointments, payments, products and your album")}
        </span>
      </span>
      <ArrowUpRight size={17} className="flex-none" style={{ color: "var(--ac)" }} />
    </Link>
  );
}

/* ── Chọn gói dịch vụ (studio gửi nhiều phương án) ── */
function QuoteOptionsSection({ p }: { p: ContractPortal }) {
  return (
    <Section icon={Package} title={p.t("quoteTitle")} desc={p.t("quotePrompt")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {p.quoteOptions.map((o) => {
          const on = p.chosenQuote === o.id;
          return (
            <div
              key={o.id}
              className="flex flex-col rounded-[14px] p-4"
              style={{ background: on ? "var(--acS)" : "var(--sf)", border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-semibold">{o.name}</p>
                {on && (
                  <Badge tone="brand" icon={Check}>
                    {p.t("chosen")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[20px] font-bold tracking-[-0.4px]" style={{ color: "var(--ac)", fontVariantNumeric: "tabular-nums" }}>
                {vnd(o.price)}
              </p>
              {o.description && (
                <p className="mt-2 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  {o.description}
                </p>
              )}
              {!on && (
                <button type="button" onClick={() => p.chooseQuote(o.id)} className={btn("secondary", "md", "mt-3 w-full")}>
                  {p.t("choose")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── Dịch vụ & hạng mục (kèm chi phí phát sinh, sản phẩm in ấn, tổng) ── */
function ItemsSection({ p, L }: { p: ContractPortal; L: Tr }) {
  const sub = (label: string) => (
    <p className="px-4 pb-1 pt-4 text-[12.5px] font-semibold sm:px-5" style={{ color: "var(--tx3)" }}>
      {label}
    </p>
  );
  return (
    <Section icon={ListChecks} title={L("Dịch vụ & hạng mục", "Services & items")} desc={`${SHOOT_TYPE_LABEL[p.contract!.shoot_type]} · ${p.items.length} ${L("hạng mục", "items")}`} flush>
      {p.items.length === 0 ? (
        <p className="px-5 py-5 text-[13.5px]" style={{ color: "var(--tx3)" }}>
          {p.t("noItems")}
        </p>
      ) : (
        p.items.map((it) => {
          const isDiscount = it.unit_price < 0;
          return (
            <Line
              key={it.id}
              title={it.name}
              desc={it.description?.trim() || null}
              meta={!isDiscount && it.qty > 1 ? `${it.qty} × ${vnd(it.unit_price)}` : null}
              amount={isDiscount ? `− ${vnd(Math.abs(it.qty * it.unit_price))}` : vnd(it.qty * it.unit_price)}
              tone={isDiscount ? "var(--am)" : undefined}
            />
          );
        })
      )}

      {p.expenses.length > 0 && (
        <>
          {sub(L("Chi phí phát sinh", "Extra costs"))}
          {p.expenses.map((e) => (
            <Line key={e.id} title={e.title} meta={e.spent_at ? fmtDate(e.spent_at) : null} amount={vnd(e.amount)} />
          ))}
        </>
      )}

      {p.products.length > 0 && (
        <>
          {sub(L("Sản phẩm đính kèm", "Products"))}
          {p.products.map((pr) => (
            <Line
              key={pr.id}
              title={`${pr.name}${pr.qty > 1 ? ` ×${pr.qty}` : ""}`}
              badge={
                <Badge tone={pr.status === "done" ? "green" : pr.status === "in_progress" ? "blue" : "gray"} dot>
                  {PRODUCT_STATUS_LABEL[pr.status as keyof typeof PRODUCT_STATUS_LABEL] || pr.status}
                </Badge>
              }
              amount={pr.cost > 0 ? vnd(pr.cost * (pr.qty || 1)) : null}
            />
          ))}
        </>
      )}

      <div className="-mt-px px-4 py-4 sm:px-5" style={{ background: "var(--sf2)", borderTop: "1px solid var(--bd2)" }}>
        {(p.surcharge > 0 || p.printing > 0) && <MoneyLine label={L("Giá trị dịch vụ", "Services")} value={vnd(p.itemsTotal)} />}
        {p.surcharge > 0 && <MoneyLine label={L("Chi phí phát sinh", "Surcharges")} value={vnd(p.surcharge)} />}
        {p.printing > 0 && <MoneyLine label={L("Chi phí in ấn", "Printing")} value={vnd(p.printing)} />}
        <MoneyLine big label={L("Tổng cộng", "Total")} value={vnd(p.total)} tone="var(--ac)" />
        <div className="mt-1 flex flex-col pt-1" style={{ borderTop: "1px dashed var(--bd)" }}>
          <MoneyLine label={p.t("paid")} value={vnd(p.collected)} tone="var(--gn)" />
          <MoneyLine label={p.t("remaining")} value={vnd(p.balance)} tone={p.balance > 0 ? "var(--am)" : "var(--gn)"} />
        </div>
      </div>
    </Section>
  );
}

/** Một dòng hạng mục: tên + mô tả bên trái, số tiền canh phải. */
function Line({
  title,
  desc,
  meta,
  badge,
  amount,
  tone,
}: {
  title: React.ReactNode;
  desc?: string | null;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  amount: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug" style={{ color: tone }}>
          {title}
        </p>
        {desc && (
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            {desc}
          </p>
        )}
        {(meta || badge) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {meta}
            {badge}
          </div>
        )}
      </div>
      {amount !== null && (
        <span className="flex-none whitespace-nowrap text-[14px] font-semibold" style={{ color: tone ?? "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </span>
      )}
    </div>
  );
}

/* ── Lịch trình ── */
function ScheduleSection({ p, L }: { p: ContractPortal; L: Tr }) {
  const c = p.contract!;
  const rows: { key: string; date: string; time: string | null; title: string; sub: string | null; main?: boolean }[] = [];
  if (c.event_date)
    rows.push({ key: "main", date: c.event_date, time: c.event_time, title: `${L("Buổi chính", "Main session")}${c.title ? ` — ${c.title}` : ""}`, sub: c.location, main: true });
  for (const m of p.milestones) rows.push({ key: m.id, date: m.event_date, time: m.event_time, title: m.title, sub: m.note });
  return (
    <Section icon={CalendarDays} title={L("Lịch trình", "Schedule")} desc={L("Bấm biểu tượng lịch để thêm vào điện thoại của bạn.", "Tap the calendar icon to add it to your phone.")} flush>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <DateChip date={r.date} main={r.main} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug">{r.title}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {[r.time, `ÂL ${fmtLunar(r.date)}`].filter(Boolean).join(" · ")}
            </p>
            {r.sub && (
              <p className="mt-0.5 flex items-start gap-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                {r.main && <MapPin size={13} className="mt-[3px] flex-none" />}
                <span className="min-w-0">{r.sub}</span>
              </p>
            )}
          </div>
          <AddToCalendar ev={{ date: r.date, time: r.time, title: r.main ? c.title : r.title, location: c.location }} L={L} />
        </div>
      ))}
    </Section>
  );
}

function DateChip({ date, main }: { date: string; main?: boolean }) {
  const day = Number(date.slice(8, 10));
  const month = Number(date.slice(5, 7));
  return (
    <span
      className="flex h-[52px] w-[48px] flex-none flex-col items-center justify-center rounded-[12px] leading-none"
      style={main ? { background: "var(--acS)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx2)" }}
    >
      <span className="text-[11px] font-semibold">{fmtDow(date)}</span>
      <span className="mt-0.5 text-[18px] font-bold" style={{ color: main ? "var(--ac)" : "var(--tx)" }}>
        {day}
      </span>
      <span className="mt-0.5 text-[10.5px] font-medium">Th{month}</span>
    </span>
  );
}

function AddToCalendar({ ev, L }: { ev: CalEvent; L: Tr }) {
  return (
    <Menu
      label={L("Thêm vào lịch", "Add to calendar")}
      width={220}
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={L("Thêm vào lịch", "Add to calendar")} title={L("Thêm vào lịch", "Add to calendar")} className={iconBtn()}>
          <CalendarPlus size={18} />
        </button>
      )}
      items={[
        { label: "Google Calendar", icon: CalendarPlus, href: googleCalendarUrl(ev), external: true },
        { label: L("Tải file lịch (.ics)", "Download .ics"), icon: Download, onClick: () => downloadIcs(ev.title || "su-kien", ev) },
      ]}
    />
  );
}

/* ── Thanh toán: đợt kế tiếp + các đợt + gửi ảnh chuyển khoản ── */
function PaySection({ p, L, overdue, openPay }: { p: ContractPortal; L: Tr; overdue: boolean; openPay: (planId: string | null) => void }) {
  const today = todayVN();
  return (
    <Section
      id="v2-pay"
      icon={Wallet}
      title={L("Thanh toán", "Payment")}
      desc={p.balance > 0 ? `${L("Đã thanh toán", "Paid")} ${vnd(p.collected)} / ${vnd(p.total)}` : L("Bạn đã thanh toán đủ. Cảm ơn bạn!", "Fully paid. Thank you!")}
    >
      <div className="flex flex-col gap-4">
        {p.balance > 0 && (
          <div className="flex flex-col gap-3 rounded-[14px] p-3.5 sm:flex-row sm:items-center sm:p-4" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              {p.dueQr ? (
                <button type="button" onClick={() => openPay(p.nextDue?.id ?? null)} aria-label={L("Phóng to mã QR", "Enlarge QR")} className="flex-none">
                  <img src={p.dueQr} alt="VietQR" width={84} height={84} className="h-[84px] w-[84px] rounded-[10px] bg-white object-contain p-1" style={{ border: "1px solid var(--bd)" }} />
                </button>
              ) : (
                <span className="flex h-[84px] w-[84px] flex-none items-center justify-center rounded-[10px] p-2 text-center text-[11px] leading-tight" style={{ border: "1px dashed var(--bd)", color: "var(--tx3)" }}>
                  {L("Liên hệ studio để nhận số tài khoản", "Ask the studio for bank details")}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
                  {p.nextDue ? p.nextDue.label : L("Còn phải thanh toán", "Amount due")}
                  {p.duePct > 0 ? ` (${p.duePct}%)` : ""}
                </p>
                <p className="mt-0.5 text-[22px] font-bold tracking-[-0.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {vnd(p.dueAmount)}
                </p>
                {p.nextDue?.due_date && (
                  <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: overdue ? "var(--rd)" : "var(--am)" }}>
                    {overdue ? L("Quá hạn từ", "Overdue since") : L("Hạn", "Due")} {fmtDate(p.nextDue.due_date)}
                  </p>
                )}
                {p.dueAmount < p.balance && (
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    {L(`Còn ${vnd(p.balance - p.dueAmount)} ở các đợt sau.`, `${vnd(p.balance - p.dueAmount)} in later instalments.`)}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => openPay(p.nextDue?.id ?? null)} className={btn("secondary", "md", "w-full sm:w-auto")}>
              <QrCode size={16} /> {L("Mã QR & số tài khoản", "QR & bank details")}
            </button>
          </div>
        )}

        {p.plan.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
              {L("Các đợt thanh toán", "Instalments")}
            </p>
            <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              {p.plan.map((row, i) => {
                const late = !row.paid && !!row.due_date && row.due_date < today;
                return (
                  <div key={row.id} className="flex items-center gap-3 px-3.5 py-3" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                      style={row.paid ? { background: "var(--gnS)", color: "var(--gn)" } : late ? { background: "var(--rdS)", color: "var(--rd)" } : { background: "var(--amS)", color: "var(--am)" }}
                    >
                      {row.paid ? <Check size={15} strokeWidth={2.6} /> : late ? <CircleAlert size={15} /> : <span className="h-2 w-2 rounded-full" style={{ background: "currentColor" }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[14px] font-semibold leading-snug">{row.label}</p>
                      <p className="text-[12.5px]" style={{ color: row.paid ? "var(--gn)" : late ? "var(--rd)" : "var(--tx3)" }}>
                        {row.paid
                          ? `${L("Đã thanh toán", "Paid")}${row.paid_at ? ` · ${fmtDate(row.paid_at)}` : ""}`
                          : row.due_date
                            ? `${late ? L("Quá hạn", "Overdue") : L("Hạn", "Due")} ${fmtDate(row.due_date)}`
                            : L("Chưa thanh toán", "Pending")}
                      </p>
                    </div>
                    <span className="flex-none whitespace-nowrap text-[14px] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {vnd(row.amount)}
                    </span>
                    {p.bank.bin &&
                      p.unpaidPlan.length > 0 &&
                      (row.paid ? (
                        <span className="w-9 flex-none" aria-hidden />
                      ) : (
                        <button type="button" onClick={() => openPay(row.id)} className={iconBtn()} aria-label={`${L("Mã QR", "QR")} · ${row.label}`} title={L("Mã QR chuyển khoản", "Transfer QR")}>
                          <QrCode size={17} />
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {p.balance > 0 && <ProofUpload p={p} L={L} />}
      </div>
    </Section>
  );
}

/** Gửi ảnh chuyển khoản (kéo thả hoặc chọn) + "Tôi đã chuyển khoản". */
function ProofUpload({ p, L }: { p: ContractPortal; L: Tr }) {
  return (
    <div className="pt-4" style={{ borderTop: "1px solid var(--bd2)" }}>
      <p className="text-[14px] font-semibold">{L("Đã chuyển khoản? Gửi ảnh cho studio", "Transferred? Send the receipt")}</p>
      <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
        {L("Studio đối soát và xác nhận khoản thanh toán cho bạn.", "The studio will reconcile and confirm your payment.")}
      </p>
      {p.proofUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.proofUrls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="proof" className="h-16 w-16 rounded-[10px] object-cover" style={{ border: "1px solid var(--bd)" }} />
            </a>
          ))}
        </div>
      )}
      {p.unpaidPlan.length > 0 && (
        <select className={`${inputCls} mt-3`} value={p.selectedPlanId} onChange={(e) => p.setSelectedPlanId(e.target.value)} aria-label={L("Đợt thanh toán", "Instalment")}>
          <option value="">{L("— Chọn đợt thanh toán —", "— Select instalment —")}</option>
          {p.unpaidPlan.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label} · {vnd(row.amount)}
            </option>
          ))}
        </select>
      )}
      <label
        className="relative mt-3 block w-full cursor-pointer rounded-[12px] px-4 py-6 text-center"
        style={{ border: `1.5px dashed ${p.proofUploading ? "var(--ac)" : "var(--bdS)"}`, background: p.proofUploading ? "var(--acS)" : "var(--sf2)" }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "var(--ac)";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = "";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "";
          const fl = e.dataTransfer.files?.[0];
          if (fl && fl.type.startsWith("image/")) p.uploadProof(fl, p.selectedPlanId || undefined);
        }}
      >
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={p.proofUploading}
          onChange={(e) => {
            const fl = e.target.files?.[0];
            if (fl) p.uploadProof(fl, p.selectedPlanId || undefined);
            e.target.value = "";
          }}
        />
        <Upload size={22} className="mx-auto mb-1.5" style={{ color: p.proofUploading ? "var(--ac)" : "var(--tx3)" }} />
        <p className="text-[14px] font-semibold" style={{ color: p.proofUploading ? "var(--ac)" : "var(--tx2)" }}>
          {p.proofUploading ? L("Đang tải lên…", "Uploading…") : L("Bấm để chọn ảnh chuyển khoản", "Choose the receipt photo")}
        </p>
        {!p.proofUploading && (
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
            {L("Hoặc kéo ảnh vào đây · tối đa 10MB", "Or drag it here · max 10MB")}
          </p>
        )}
      </label>
      {p.paidReported ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: "var(--gn)" }}>
          <Check size={16} /> {L("Đã thông báo, studio sẽ đối soát.", "Notified — the studio will reconcile.")}
        </p>
      ) : (
        <button type="button" onClick={p.reportPaid} className={btn("ghost", "md", "mt-2 w-full")}>
          {L("Tôi đã chuyển khoản (không có ảnh)", "I have transferred (no screenshot)")}
        </button>
      )}
    </div>
  );
}

/* ── Điều khoản (thu gọn) ── */
function TermsSection({ p, L }: { p: ContractPortal; L: Tr }) {
  const [open, setOpen] = useState(false);
  const FIRST = 4;
  const lines = open ? p.termLines : p.termLines.slice(0, FIRST);
  return (
    <Section icon={FileText} title={L("Điều khoản", "Terms")} desc={p.signed ? L(`${p.termLines.length} điều khoản`, `${p.termLines.length} terms`) : L(`${p.termLines.length} điều khoản · đọc trước khi ký`, `${p.termLines.length} terms · read before signing`)}>
      <ul className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5">
            <Check size={16} className="mt-[3px] flex-none" style={{ color: "var(--ac)" }} />
            <span className="text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {line}
            </span>
          </li>
        ))}
      </ul>
      {p.termLines.length > FIRST && (
        <button type="button" onClick={() => setOpen((v) => !v)} className={btn("ghost", "sm", "mt-2 -ml-2")} aria-expanded={open}>
          <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
          {open ? L("Thu gọn", "Show less") : L(`Xem đủ ${p.termLines.length} điều khoản`, `Read all ${p.termLines.length} terms`)}
        </button>
      )}
    </Section>
  );
}

/* ── Hai bên ký kết ── */
function PartiesSection({ p, L, openSign }: { p: ContractPortal; L: Tr; openSign: () => void }) {
  const c = p.contract!;
  const cancelled = c.status === "cancelled";
  return (
    <Section id="v2-sign" icon={UsersRound} title={L("Hai bên ký kết", "Parties & signatures")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Party
          label={L("Bên A · Studio", "Party A · Studio")}
          name={c.studio_signed_name || p.studioName}
          lines={[p.studioPhone]}
          sig={c.studio_signature}
          sigAlt={L("Chữ ký của studio", "Studio signature")}
          status={
            c.studio_signature || c.studio_signed_at ? (
              <Badge tone="green" icon={Check}>
                {L("Đã ký", "Signed")}
                {c.studio_signed_at ? ` · ${fmtDate(c.studio_signed_at)}` : ""}
              </Badge>
            ) : (
              <Badge tone="gray">{L("Studio chưa ký", "Not signed yet")}</Badge>
            )
          }
        />
        <Party
          label={L("Bên B · Khách hàng", "Party B · Client")}
          name={c.client_signed_name || c.client_name || "—"}
          lines={[[c.client_phone, c.client_email].filter(Boolean).join(" · ")]}
          sig={c.client_signature}
          sigAlt={L("Chữ ký của bạn", "Your signature")}
          status={
            p.signed ? (
              <Badge tone="green" icon={Check}>
                {p.t("signedOn")} {fmtDateTime(c.client_signed_at!)}
              </Badge>
            ) : (
              <Badge tone="amber" dot>
                {L("Chờ bạn ký", "Awaiting you")}
              </Badge>
            )
          }
          action={
            !p.signed && !cancelled ? (
              <button type="button" onClick={openSign} className={btn("soft", "md", "mt-3 w-full")}>
                <PenLine size={16} /> {L("Ký ngay", "Sign now")}
              </button>
            ) : null
          }
        />
      </div>
    </Section>
  );
}

function Party({
  label,
  name,
  lines,
  sig,
  sigAlt,
  status,
  action,
}: {
  label: string;
  name: string;
  lines: (string | null)[];
  sig: string | null;
  sigAlt: string;
  status: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[14px] p-4" style={{ border: "1px solid var(--bd)" }}>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-[15px] font-semibold">{name}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {l}
        </p>
      ))}
      <div className="mt-3 flex h-[72px] items-center justify-center rounded-[10px]" style={{ background: "#fff", border: "1px dashed var(--bd)" }}>
        {sig ? <img src={sig} alt={sigAlt} className="max-h-[64px] w-auto max-w-full object-contain" /> : <PenLine size={18} style={{ color: "#c3c9d1" }} />}
      </div>
      <div className="mt-2.5">{status}</div>
      {action}
    </div>
  );
}

/* ── Ảnh & quà tặng ── */
function PhotosGiftsSection({ p, L }: { p: ContractPortal; L: Tr }) {
  return (
    <Section icon={Images} title={L("Ảnh & quà tặng", "Photos & gifts")} flush>
      {p.selection && (
        <GiftRow
          icon={p.selection.phase === "delivery" ? Images : ImagePlus}
          title={p.selection.phase === "delivery" ? p.t("viewPhotos") : p.t("pickPhotos")}
          sub={`${p.selection.title} · ${p.selection.phase === "delivery" ? p.t("viewPhotosSub") : p.t("pickPhotosSub")}`}
          href={`/a/${p.selection.slug}`}
          L={L}
        />
      )}
      {p.gallery && <GiftRow icon={Images} title={p.t("viewPhotos")} sub={`${p.gallery.title} · ${p.t("viewPhotosSub")}`} href={`/album/${p.gallery.slug}`} L={L} />}
      {p.wedding && (
        <GiftRow
          icon={Heart}
          tone="red"
          title={L("Thiệp cưới online tặng bạn", "Your free wedding e-invitation")}
          sub={L("Bạn tự điền thông tin, chọn ảnh & chia sẻ cho khách mời.", "Fill in your details, pick photos and share with guests.")}
          L={L}
          actions={
            <>
              <a href={thiepUrl(`/sua/${p.wedding.edit_token}`)} target="_blank" rel="noreferrer" className={btn("soft", "sm")}>
                <PenLine size={14} /> {L("Chỉnh sửa thiệp", "Edit invitation")}
              </a>
              {p.wedding.published && (
                <a href={thiepUrl(`/${p.wedding.slug}`)} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
                  <Images size={14} /> {L("Xem thiệp", "View")}
                </a>
              )}
            </>
          }
        />
      )}
      {p.story && (
        <GiftRow
          icon={Heart}
          tone="red"
          title={L("Trang Love Story tặng bạn", "Your free Love Story page")}
          sub={L("Điền nội dung & dán link folder ảnh/video Google Drive của bạn.", "Add your story and a Google Drive photo/video folder link.")}
          L={L}
          actions={
            <>
              <a href={`/story/sua/${p.story.edit_token}`} target="_blank" rel="noreferrer" className={btn("soft", "sm")}>
                <PenLine size={14} /> {L("Chỉnh sửa trang", "Edit page")}
              </a>
              {p.story.published && (
                <a href={`/story/${p.story.slug}`} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
                  <Images size={14} /> {L("Xem trang", "View")}
                </a>
              )}
            </>
          }
        />
      )}
    </Section>
  );
}

function GiftRow({
  icon: Icon,
  title,
  sub,
  href,
  actions,
  tone = "brand",
  L,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  href?: string;
  actions?: React.ReactNode;
  tone?: Tone;
  L: Tr;
}) {
  const body = (
    <>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: toneBg(tone), color: toneFg(tone) }}>
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          {sub}
        </p>
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {href && (
        <span className="flex flex-none items-center gap-1 self-center text-[13px] font-semibold" style={{ color: "var(--ac)" }}>
          {L("Mở", "Open")} <ArrowUpRight size={15} />
        </span>
      )}
    </>
  );
  const cls = "flex items-start gap-3 px-4 py-3.5 sm:px-5";
  const style = { borderBottom: "1px solid var(--bd2)" };
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} v2-row-link`} style={style}>
      {body}
    </a>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

/* ── Tiến độ công việc ── */
function TasksSection({ p, L }: { p: ContractPortal; L: Tr }) {
  const done = p.tasks.filter((x) => x.done).length;
  return (
    <Section icon={ListChecks} title={L("Tiến độ công việc", "Progress")} actions={<Badge tone={done === p.tasks.length ? "green" : "brand"}>{`${done}/${p.tasks.length}`}</Badge>}>
      <Progress value={(done / p.tasks.length) * 100} tone={done === p.tasks.length ? "green" : "brand"} />
      <ul className="mt-3 flex flex-col">
        {p.tasks.map((tk) => (
          <li key={tk.id} className="flex items-center gap-2.5 py-1.5">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px]" style={{ border: tk.done ? "0" : "1.5px solid var(--bdS)", background: tk.done ? "var(--gn)" : "transparent" }}>
              {tk.done && <Check size={13} color="#fff" strokeWidth={3} />}
            </span>
            <span className="text-[14px]" style={{ color: tk.done ? "var(--tx3)" : "var(--tx)", textDecoration: tk.done ? "line-through" : "none" }}>
              {tk.label}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── Gửi cho studio: yêu cầu sửa · brief · đánh giá · Messenger ── */
function StudioSection({ p, L, tab, setTab }: { p: ContractPortal; L: Tr; tab: StudioTab; setTab: (t: StudioTab) => void }) {
  return (
    <Section id="v2-studio" icon={MessageSquare} title={L("Gửi cho studio", "Message the studio")} desc={L("Yêu cầu chỉnh sửa, mong muốn cho buổi chụp, cảm nhận của bạn.", "Change requests, shoot wishes and feedback.")}>
      <div className="flex flex-col gap-4">
        <Segmented<StudioTab>
          label={L("Chọn nội dung", "Choose")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "edit", label: L("Chỉnh sửa", "Changes") },
            { value: "brief", label: "Brief" },
            { value: "review", label: L("Đánh giá", "Review") },
            { value: "msgr", label: "Messenger" },
          ]}
        />

        {tab === "edit" &&
          (p.sent ? (
            <Callout tone="green" icon={CheckCircle2} title={p.t("editSent")} />
          ) : (
            <div className="flex flex-col gap-3" id="edit-request">
              <p className="text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {p.t("editPrompt")}
              </p>
              <textarea className={inputCls} rows={4} placeholder={p.t("editPh")} value={p.editMsg} onChange={(e) => p.setEditMsg(e.target.value)} />
              <div>
                <button type="button" onClick={p.sendEdit} disabled={p.sending || !p.editMsg.trim()} className={btn("secondary")}>
                  <Send size={15} /> {p.sending ? p.t("sending") : p.t("send")}
                </button>
              </div>
            </div>
          ))}

        {tab === "brief" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {p.t("briefPrompt")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={p.t("briefConcept")}>
                <input className={inputCls} value={p.brief.concept} onChange={(e) => p.setBrief((b) => ({ ...b, concept: e.target.value }))} />
              </Field>
              <Field label={p.t("briefOutfit")}>
                <input className={inputCls} value={p.brief.outfit} onChange={(e) => p.setBrief((b) => ({ ...b, outfit: e.target.value }))} />
              </Field>
            </div>
            <Field label={p.t("briefRefs")}>
              <input className={inputCls} inputMode="url" value={p.brief.refs} onChange={(e) => p.setBrief((b) => ({ ...b, refs: e.target.value }))} />
            </Field>
            <Field label={p.t("briefNote")}>
              <textarea className={inputCls} rows={3} value={p.brief.note} onChange={(e) => p.setBrief((b) => ({ ...b, note: e.target.value }))} />
            </Field>
            <div>
              <button type="button" onClick={p.submitBrief} className={btn(p.briefSent ? "soft" : "secondary")}>
                {p.briefSent ? <Check size={15} /> : <Send size={15} />} {p.briefSent ? p.t("briefSaved") : p.t("briefSave")}
              </button>
            </div>
          </div>
        )}

        {tab === "review" &&
          (p.reviewSent ? (
            <Callout tone="green" icon={CheckCircle2} title={p.t("reviewThanks")} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {p.t("reviewPrompt")}
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => p.setRating(n)} aria-label={`${n} sao`} className="rounded-[8px] p-0.5">
                    <Star size={30} style={{ color: n <= p.rating ? "var(--am)" : "var(--bdS)" }} fill={n <= p.rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <textarea className={inputCls} rows={3} placeholder={p.t("reviewPh")} value={p.reviewText} onChange={(e) => p.setReviewText(e.target.value)} />
              <div>
                <button type="button" onClick={p.sendReview} disabled={!p.rating && !p.reviewText.trim()} className={btn("secondary")}>
                  <Star size={15} /> {p.t("sendReview")}
                </button>
              </div>
            </div>
          ))}

        {tab === "msgr" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {p.t("messengerPrompt")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${inputCls} min-w-0 flex-1`} inputMode="url" placeholder="m.me/… hoặc facebook.com/…" value={p.messenger} onChange={(e) => p.setMessenger(e.target.value)} />
              <button type="button" onClick={p.saveMessenger} className={btn(p.msgrSaved ? "soft" : "secondary")}>
                {p.msgrSaved ? <Check size={15} /> : null} {p.msgrSaved ? p.t("saved") : p.t("saveLink")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Cột phải (máy tính): tiền · trang theo dõi · liên hệ ── */
function MoneyCard({ p, L, overdue, openPay }: { p: ContractPortal; L: Tr; overdue: boolean; openPay: (planId: string | null) => void }) {
  const pct = p.total > 0 ? Math.round((Math.max(0, p.collected) / p.total) * 100) : 0;
  return (
    <Card>
      <p className="text-[15px] font-semibold">{L("Thanh toán", "Payment")}</p>
      <div className="mt-2">
        <MoneyLine label={p.t("totalVal")} value={vnd(p.total)} />
        <MoneyLine label={p.t("paid")} value={vnd(p.collected)} tone="var(--gn)" />
        <MoneyLine label={p.t("remaining")} value={vnd(p.balance)} tone={p.balance > 0 ? "var(--am)" : "var(--gn)"} />
      </div>
      <div className="mt-2">
        <Progress value={pct} tone={p.balance <= 0 && p.total > 0 ? "green" : "brand"} />
      </div>
      {p.balance > 0 && (
        <div className="mt-4 rounded-[12px] p-3" style={{ background: "var(--sf2)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
            {p.nextDue ? p.nextDue.label : L("Còn phải thanh toán", "Amount due")}
          </p>
          <p className="text-[19px] font-bold tracking-[-0.4px]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {vnd(p.dueAmount)}
          </p>
          {p.nextDue?.due_date && (
            <p className="text-[12.5px] font-semibold" style={{ color: overdue ? "var(--rd)" : "var(--am)" }}>
              {overdue ? L("Quá hạn từ", "Overdue since") : L("Hạn", "Due")} {fmtDate(p.nextDue.due_date)}
            </p>
          )}
          <button type="button" onClick={() => openPay(p.nextDue?.id ?? null)} className={btn("secondary", "md", "mt-3 w-full")}>
            <QrCode size={16} /> {L("Mã QR & số tài khoản", "QR & bank details")}
          </button>
        </div>
      )}
    </Card>
  );
}

function HelpCard({ p, L, openStudio }: { p: ContractPortal; L: Tr; openStudio: (t: StudioTab) => void }) {
  return (
    <Card>
      <p className="text-[15px] font-semibold">{L("Cần hỗ trợ?", "Need help?")}</p>
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>
        {p.studioName}
        {p.studioPhone ? ` · ${p.studioPhone}` : ""}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {p.studioPhone && (
          <a href={`tel:${p.studioPhone}`} className={btn("secondary", "md", "w-full")}>
            <Phone size={16} /> {L("Gọi studio", "Call the studio")}
          </a>
        )}
        <button type="button" onClick={() => openStudio("edit")} className={btn("ghost", "md", "w-full")}>
          <MessageSquare size={16} /> {p.t("editReq")}
        </button>
        <button type="button" onClick={() => window.print()} className={btn("ghost", "md", "w-full")}>
          <Printer size={16} /> {p.t("pdf")}
        </button>
      </div>
    </Card>
  );
}

/* ═══ Hộp thoại ký hợp đồng ════════════════════════════════════════════════ */
function SignModal({ p, L, open, onClose }: { p: ContractPortal; L: Tr; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={p.t("signTitle")}
      desc={p.t("signAgree")}
      icon={PenLine}
      width={520}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose} disabled={p.signing}>
            {L("Để sau", "Later")}
          </button>
          <button type="button" className={btn("primary")} onClick={p.sign} disabled={p.signing} data-testid="contract-sign-btn">
            <PenLine size={16} /> {p.signing ? p.t("signing") : p.t("sign")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={p.t("signerName")}>
          <input className={inputCls} autoComplete="name" placeholder={L("Họ và tên", "Full name")} value={p.signName} onChange={(e) => p.setSignName(e.target.value)} />
        </Field>
        <Field label={p.t("signature")} hint={L("Dùng ngón tay hoặc chuột ký vào khung trắng.", "Sign in the white box with your finger or mouse.")}>
          <div className="[&_canvas]:[border:1.5px_dashed_var(--bdS)]">
            <SignaturePad onChange={p.setSignature} />
          </div>
        </Field>
        {p.err && (
          <p className="text-[13px] font-medium" style={{ color: "var(--rd)" }}>
            {p.err}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ═══ Hộp thoại chuyển khoản: QR + từng dòng chép được + gửi ảnh ═══════════ */
function PayModal({
  p,
  L,
  open,
  planId,
  setPlanId,
  onClose,
}: {
  p: ContractPortal;
  L: Tr;
  open: boolean;
  planId: string | null;
  setPlanId: (id: string | null) => void;
  onClose: () => void;
}) {
  const row = planId ? p.plan.find((x) => x.id === planId && !x.paid) ?? null : null;
  const amount = row ? row.amount : p.balance;
  const note = row ? instalmentNote(p.contractRef, row.label, row.pay_code) : p.contractRef;
  const url = qrUrl(p.bank, amount, note);
  const acc = (p.bank.account || "").replace(/\s/g, "");
  const copyL = { copyLabel: L("Chép", "Copy"), copiedLabel: L("Đã chép", "Copied") };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L("Chuyển khoản", "Bank transfer")}
      desc={row ? row.label : L("Phần còn lại của hợp đồng", "Remaining balance")}
      icon={QrCode}
      width={460}
      footer={
        <>
          <label className={btn("secondary", "md", p.proofUploading ? "pointer-events-none opacity-60" : "cursor-pointer")}>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={p.proofUploading}
              onChange={(e) => {
                const fl = e.target.files?.[0];
                if (fl) p.uploadProof(fl, row?.id);
                e.target.value = "";
              }}
            />
            <Upload size={16} /> {p.proofUploading ? L("Đang tải lên…", "Uploading…") : L("Gửi ảnh chuyển khoản", "Send receipt")}
          </label>
          {p.paidReported ? (
            <span className="inline-flex h-[38px] items-center gap-1.5 px-2 text-[13.5px] font-semibold" style={{ color: "var(--gn)" }}>
              <Check size={16} /> {L("Đã báo studio", "Studio notified")}
            </span>
          ) : (
            <button type="button" onClick={p.reportPaid} className={btn("primary")}>
              <Check size={16} /> {L("Tôi đã chuyển khoản", "I've transferred")}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col">
        {p.unpaidPlan.length > 1 && (
          <Field label={L("Thanh toán cho", "Paying for")} className="mb-3">
            <select className={inputCls} value={row?.id ?? ""} onChange={(e) => setPlanId(e.target.value || null)}>
              {p.unpaidPlan.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} · {vnd(r.amount)}
                </option>
              ))}
              <option value="">
                {L("Toàn bộ phần còn lại", "Whole remaining balance")} · {vnd(p.balance)}
              </option>
            </select>
          </Field>
        )}
        {url ? (
          <div className="flex justify-center">
            <img src={url} alt="VietQR" width={232} height={232} className="h-[208px] w-[208px] rounded-[16px] bg-white object-contain p-2 sm:h-[232px] sm:w-[232px]" style={{ border: "1px solid var(--bd)" }} />
          </div>
        ) : (
          <Callout tone="amber" icon={CircleAlert} title={L("Studio chưa cài số tài khoản", "No bank account set up")}>
            {p.studioPhone ? (
              <>
                {L("Gọi studio để nhận thông tin chuyển khoản:", "Call the studio for bank details:")}{" "}
                <a href={`tel:${p.studioPhone}`} className="font-semibold underline" style={{ color: "var(--tx)" }}>
                  {p.studioPhone}
                </a>
              </>
            ) : (
              L("Liên hệ studio để nhận thông tin chuyển khoản.", "Contact the studio for bank details.")
            )}
          </Callout>
        )}
        <div className="mt-3">
          <CopyRow label={L("Số tiền", "Amount")} value={vnd(amount)} copy={amount > 0 ? String(Math.round(amount)) : null} strong {...copyL} />
          {p.bank.name && <CopyRow label={L("Ngân hàng", "Bank")} value={p.bank.name} {...copyL} />}
          {acc && <CopyRow label={L("Số tài khoản", "Account number")} value={acc} copy={acc} mono {...copyL} />}
          {p.bank.holder && <CopyRow label={L("Chủ tài khoản", "Account holder")} value={p.bank.holder} {...copyL} />}
          {note && <CopyRow label={L("Nội dung chuyển khoản", "Transfer note")} value={note} copy={note} mono {...copyL} />}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          {L(
            "Ghi đúng nội dung để studio đối soát nhanh. Trang này tự báo ngay khi studio nhận được tiền.",
            "Keep the transfer note as shown so the studio can match it. This page updates as soon as the payment arrives.",
          )}
        </p>
      </div>
    </Modal>
  );
}
