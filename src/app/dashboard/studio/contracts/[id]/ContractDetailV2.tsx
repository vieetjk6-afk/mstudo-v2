"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  FileSignature,
  FileText,
  FolderPlus,
  History,
  LayoutDashboard,
  ListPlus,
  MessageCircle,
  Package,
  PenLine,
  Phone,
  Printer,
  Send,
  Shirt,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Progress, btn, iconBtn } from "@/components/v2/kit";
import { Menu, Modal, Tabs, type MenuItem } from "@/components/v2/kit-client";
import { CONTRACT_STATUS_LABEL, vnd, type ContractStatus } from "@/lib/types";
import { kindHasPhotoWork, kindHasRental } from "@/lib/contract-kind";
import { useContractEditor, type ContractEditorProps } from "./useContractEditor";
import { LifeBar, STATUS_TONE, relDay, sessionWhen, toneText, type AskOpts, type V2Ctx, type V2Tab } from "./ContractV2Shared";
import { ContractV2Rail } from "./ContractV2Summary";
import { AddPlanModal, CollectModal, CrewDrawer, InfoDrawer, QrModal, SendModal } from "./ContractV2Dialogs";
import ContractV2Overview from "./ContractV2Overview";
import ContractV2Items from "./ContractV2Items";
import ContractV2Payments from "./ContractV2Payments";
import ContractV2Crew from "./ContractV2Crew";
import ContractV2Album from "./ContractV2Album";
import ContractV2Send from "./ContractV2Send";
import ContractRentalPanelV2 from "./ContractRentalPanelV2";

// Hai hộp thoại Dời lịch / Huỷ — cùng logic với bản cũ (useReschedule / useCancelContract, gọi route máy chủ).
const RescheduleDialog = dynamic(() => import("./ContractChangeDialogsV2").then((m) => m.RescheduleDialogV2), { ssr: false });
const CancelDialog = dynamic(() => import("./ContractChangeDialogsV2").then((m) => m.CancelDialogV2), { ssr: false });

/* ═══════════════════════════════════════════════════════════════════════════
   CHI TIẾT HỢP ĐỒNG — giao diện mới. Cùng state, cùng truy vấn, cùng thao tác
   với bản cũ (logic chung ở ./useContractEditor); khác ở cách sắp xếp:
     • Thẻ đầu: khách · mã · trạng thái (bấm để đổi) · liên hệ, bốn con số
       chính (ngày chụp, địa điểm, giá trị, đã thu) và tiến độ 7 bước. MỘT nút
       chính đổi theo việc cần làm tiếp (gửi ký → thu tiền → ký Bên A →
       phân công → hoàn thành), các thao tác còn lại dồn vào menu ⋯.
     • Thanh tab dính dưới topbar; cuộn qua thẻ đầu thì hiện tên khách + nút
       chính ngay trên thanh tab.
     • Tab: Tổng quan (việc cần làm + thông tin) · Hạng mục · Thanh toán ·
       Ê-kíp & lịch (buổi chụp gọn, mỗi buổi một nút) · Sản phẩm · Thuê đồ ·
       Ký & gửi. Khoá tab trùng bản cũ nên link ?tab=pay|crew|send vẫn đúng.
     • Máy tính rộng: cột phải dính theo cuộn (tiền · buổi sắp tới · ê-kíp).
       Hẹp hơn: một cột, ba thẻ đó nằm trong tab Tổng quan.
     • Sửa nhanh bằng ngăn kéo / hộp thoại; xoá luôn hỏi lại bằng hộp thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

const TAB_DEFS: { key: V2Tab; label: string; icon: LucideIcon }[] = [
  { key: "info", label: "Tổng quan", icon: LayoutDashboard },
  { key: "items", label: "Hạng mục", icon: ListPlus },
  { key: "pay", label: "Thanh toán", icon: Wallet },
  { key: "crew", label: "Ê-kíp & lịch", icon: Users },
  { key: "album", label: "Sản phẩm", icon: Package },
  { key: "rental", label: "Thuê đồ", icon: Shirt },
  { key: "send", label: "Ký & gửi", icon: FileSignature },
];

type Step = { key: string; label: string; icon: LucideIcon; run: () => void };

export default function ContractDetailV2(props: ContractEditorProps) {
  const ed = useContractEditor(props);
  const { f } = ed;
  const { contract, canRental, canSeeAudit, initialTab } = ed.props;

  /* ── Tab ── */
  const tabs = TAB_DEFS.filter((t) => {
    if (t.key === "rental") return kindHasRental(ed.kind) && canRental;
    if (t.key === "album") return kindHasPhotoWork(ed.kind);
    return true;
  });
  const [tab, setTab] = useState<V2Tab>(() => (TAB_DEFS.some((t) => t.key === initialTab) ? (initialTab as V2Tab) : "info"));
  const tabOk = tabs.some((t) => t.key === tab);
  // Đổi gói dịch vụ làm tab đang mở biến mất → về Tổng quan (như bản cũ).
  useEffect(() => {
    if (!tabOk) setTab("info");
  }, [tabOk]);

  /* ── Thanh tab dính: biết khi nào thẻ đầu đã cuộn khuất ── */
  const headRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "-60px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Chuyển tab; đang cuộn sâu thì đưa nội dung tab mới về ngay dưới thanh tab. */
  const go = useCallback((t: V2Tab, anchor?: string) => {
    setTab(t);
    requestAnimationFrame(() => {
      if (anchor) {
        const a = document.getElementById(anchor);
        if (a) {
          window.scrollTo({ top: window.scrollY + a.getBoundingClientRect().top - 124, behavior: "smooth" });
          return;
        }
      }
      const nav = navRef.current;
      if (!nav) return;
      const top = nav.getBoundingClientRect().top;
      if (top <= 61) window.scrollTo({ top: window.scrollY + top - 60 });
    });
  }, []);

  /* ── Hộp thoại dùng chung ── */
  const [confirm, setConfirm] = useState<AskOpts | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [collect, setCollect] = useState<{ planId: string | null } | null>(null);
  const [addPlan, setAddPlan] = useState<{ paid: boolean } | null>(null);
  const [qr, setQr] = useState<{ amount: number; addInfo: string; title: string } | null>(null);
  const [crewEdit, setCrewEdit] = useState<{ idx: number | null; eventId?: string } | null>(null);

  const ctx: V2Ctx = {
    ed,
    go,
    ask: setConfirm,
    openSend: () => ed.setSendOpen(true),
    openCollect: (planId) => setCollect({ planId: planId ?? null }),
    openAddPlan: (prefill) => {
      if (prefill) ed.setPlanForm({ label: prefill.label, amount: prefill.amount, due_date: "" });
      setAddPlan({ paid: false });
    },
    openInfo: () => setInfoOpen(true),
    openQr: setQr,
    openCrew: (idx, eventId) => setCrewEdit({ idx, eventId }),
  };

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  }

  /* ── Việc cần làm tiếp → nút chính ── */
  const live = f.status !== "cancelled";
  const unpaid = ed.plan.filter((p) => !p.paid);
  // Hợp đồng đã huỷ thì không còn "quá hạn" để nhắc.
  const overdue = live ? unpaid.filter((p) => p.due_date && p.due_date < ed.todayStr) : [];
  const step: Step | null = !live
    ? null
    : ed.items.length === 0 && ed.addendumItems.length === 0
      ? { key: "items", label: "Thêm hạng mục", icon: ListPlus, run: () => go("items") }
      : f.status === "draft"
        ? { key: "send", label: "Gửi khách ký", icon: Send, run: ctx.openSend }
        : overdue.length > 0
          ? { key: "collect", label: "Ghi nhận thanh toán", icon: Wallet, run: () => ctx.openCollect(overdue[0].id) }
          : f.status === "sent" && !contract.client_signed_at && ed.collected <= 0
            ? { key: "send", label: "Nhắc khách ký", icon: Send, run: ctx.openSend }
            : !ed.studioSigned
              ? { key: "sign", label: "Ký xác nhận Bên A", icon: PenLine, run: () => go("send", "v2-sign") }
              : ed.activeCrew.length === 0 && f.status !== "post_production" && f.status !== "completed"
                ? { key: "crew", label: "Phân công ê-kíp", icon: UserPlus, run: () => go("crew") }
                : ed.balance > 0
                  ? { key: "collect", label: "Ghi nhận thanh toán", icon: Wallet, run: () => ctx.openCollect(unpaid[0]?.id) }
                  : f.status !== "completed"
                    ? {
                        key: "done",
                        label: "Hoàn thành hợp đồng",
                        icon: CheckCircle2,
                        run: () =>
                          setConfirm({
                            title: "Đánh dấu hợp đồng hoàn thành?",
                            desc: "Hợp đồng chuyển sang Hoàn thành. Nếu thư mục ảnh chỉnh sửa đã có ảnh, album tự chuyển sang giai đoạn Giao khách.",
                            confirm: "Hoàn thành",
                            run: () => ed.changeStatus("completed"),
                          }),
                      }
                    : { key: "send", label: "Gửi khách", icon: Send, run: ctx.openSend };

  /* ── Menu ⋯ ── */
  const moreItems: MenuItem[] = [
    ...(step?.key !== "send" ? [{ label: "Gửi khách", icon: Send, onClick: ctx.openSend, hint: "Zalo, chia sẻ nhanh, chép link" }] : []),
    { label: "Xem như khách", icon: FileText, href: ed.shareUrl, external: true },
    { label: "Trang riêng của khách", icon: CalendarRange, href: ed.portalUrl, external: true },
    "divider",
    ...(step?.key !== "collect" ? [{ label: "Ghi nhận thanh toán", icon: Wallet, onClick: () => ctx.openCollect(unpaid[0]?.id) }] : []),
    ...(live ? [{ label: "Dời lịch", icon: CalendarClock, onClick: () => ed.setChangeDlg("reschedule"), hint: "Báo khách, cập nhật lịch thợ" }] : []),
    { label: "Xuất PDF hợp đồng", icon: Printer, onClick: ed.printContract },
    { label: ed.busy === "dup" ? "Đang sao…" : "Tạo giống HĐ này", icon: Copy, onClick: ed.duplicateContract, disabled: ed.busy === "dup" },
    {
      label: ed.driveBusy ? "Đang tạo thư mục…" : "Tạo thư mục Drive",
      icon: FolderPlus,
      onClick: ed.makeDriveFolder,
      disabled: ed.driveBusy,
    },
    ...(canSeeAudit ? [{ label: "Lịch sử thao tác", icon: History, href: `/dashboard/studio/audit?contract=${contract.id}` }] : []),
    "divider",
    live
      ? { label: "Huỷ hợp đồng", icon: Ban, danger: true, onClick: () => ed.setChangeDlg("cancel") }
      : {
          label: ed.busy === "delete" ? "Đang xoá…" : "Xoá hợp đồng",
          icon: Trash2,
          danger: true,
          disabled: ed.busy === "delete",
          onClick: () =>
            setConfirm({
              title: "Xoá hợp đồng này?",
              desc: "Mọi hạng mục, nhân sự, thanh toán và yêu cầu của hợp đồng sẽ bị xoá theo. Không khôi phục được.",
              confirm: "Xoá hợp đồng",
              danger: true,
              run: ed.deleteContractNow,
            }),
        },
  ];

  /* ── Số liệu thẻ đầu ── */
  const rel = relDay(f.event_date);
  const clientName = f.client_name.trim() || "Chưa có tên khách";
  const digits = ed.clientDigits;
  const badgeFor = (t: V2Tab) =>
    t === "items" ? ed.items.length || undefined
      : t === "crew" ? ed.activeCrew.length || undefined
        : t === "send" ? ed.openRequests.length || undefined
          : t === "pay" ? overdue.length || undefined
            : undefined;

  const stepBtn = (size: "sm" | "md" = "md", full = false) =>
    step ? (
      <button type="button" onClick={step.run} className={btn("primary", size, full ? "!flex-1" : "")}>
        <step.icon size={size === "sm" ? 15 : 17} /> {step.label}
      </button>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {ed.msg && (
        <div
          role="status"
          className="fixed left-1/2 top-[72px] z-[90] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full px-4 py-2 text-[13.5px] font-medium"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "0 10px 30px -10px rgba(0,0,0,.35)" }}
        >
          {ed.msg}
        </div>
      )}

      {/* ── Thẻ đầu ── */}
      <header ref={headRef} className="v2-card overflow-hidden">
        <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
          <Link href="/dashboard/studio/contracts" aria-label="Về danh sách hợp đồng" title="Về danh sách hợp đồng" className={iconBtn("-ml-1.5 -mt-0.5 hidden sm:inline-flex")}>
            <ArrowLeft size={18} />
          </Link>
          <span className="hidden sm:inline-flex">
            <Avatar name={clientName} size={48} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1 className="min-w-0 truncate text-[18px] font-bold tracking-[-0.3px] sm:text-[20px]">{clientName}</h1>
              <StatusMenu ed={ed} />
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px]" style={{ color: "var(--tx3)" }}>
              <span className="flex-none font-mono text-[12.5px] font-semibold" style={{ color: f.code ? "var(--tx2)" : "var(--rd)" }}>
                {f.code || "Chưa có mã"}
              </span>
              <span className="flex-none">·</span>
              <span className="truncate" title={f.title}>{f.title || "Hợp đồng"}</span>
              {ed.contractSaved !== "idle" && (
                <span className="flex flex-none items-center gap-1 text-[12px]" style={{ color: ed.contractSaved === "saved" ? "var(--gn)" : "var(--tx3)" }}>
                  · {ed.contractSaved === "saving" ? "Đang lưu…" : <><Check size={13} /> Đã lưu</>}
                </span>
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <ContactChip href={digits ? `tel:${digits}` : undefined} icon={Phone} label={f.client_phone || "Chưa có SĐT"} />
              <ContactChip href={digits ? `https://zalo.me/${digits}` : undefined} external icon={MessageCircle} label="Zalo" />
              <ContactChip href={digits ? `/dashboard/studio/clients/${digits}` : undefined} internal icon={UserRound} label="Hồ sơ khách" />
              <span className="ml-1 hidden text-[12.5px] md:inline" style={{ color: ed.clientViewedAt ? "var(--gn)" : "var(--tx3)" }}>
                {ed.clientViewedAt ? `Khách xem lần cuối ${ed.clientViewedAt}` : "Khách chưa mở link"}
              </span>
            </div>
          </div>
          <div className="hidden flex-none items-center gap-2 sm:flex">
            {step && step.key !== "send" && (
              <button type="button" onClick={ctx.openSend} className={btn("secondary", "md", "hidden lg:inline-flex")}>
                <Send size={16} /> Gửi khách
              </button>
            )}
            {stepBtn()}
            <Menu items={moreItems} label="Thao tác khác" width={250} />
          </div>
          <div className="-mr-1.5 -mt-1 flex-none sm:hidden">
            <Menu items={moreItems} label="Thao tác khác" width={250} />
          </div>
        </div>

        {/* Bốn con số chính */}
        <dl className="grid grid-cols-2 lg:grid-cols-4" style={{ borderTop: "1px solid var(--bd2)" }}>
          <Fact label="Ngày chụp" className="[border-right:1px_solid_var(--bd2)]">
            {f.event_date ? (
              <>
                <span className="block">{sessionWhen({ date: f.event_date, time: f.event_time || null })}</span>
                {rel && (
                  <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: toneText(rel.tone) }}>
                    {rel.text}
                  </span>
                )}
              </>
            ) : (
              <button type="button" onClick={ctx.openInfo} className="text-left" style={{ color: "var(--am)" }}>
                Chưa có ngày · <span className="underline underline-offset-2">Đặt ngày</span>
              </button>
            )}
          </Fact>
          <Fact label="Địa điểm" className="lg:[border-right:1px_solid_var(--bd2)]">
            <span className="line-clamp-2 text-[13.5px] font-medium leading-snug" title={f.location || undefined} style={{ color: f.location ? "var(--tx)" : "var(--tx3)" }}>
              {f.location || "Chưa có địa điểm"}
            </span>
          </Fact>
          <Fact label="Giá trị hợp đồng" className="[border-right:1px_solid_var(--bd2)] [border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
            <span className="v2-num block">{vnd(ed.total)}</span>
            <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
              {ed.items.length} hạng mục{ed.addendumItems.length ? " · có phụ lục" : ""}
            </span>
          </Fact>
          <Fact label="Thanh toán" className="[border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
            <span className="v2-num block" style={{ color: ed.collected > 0 ? "var(--gn)" : "var(--tx)" }}>
              {vnd(ed.collected)}
            </span>
            <span className="mt-1.5 block">
              <Progress value={ed.pct} tone={ed.balance <= 0 && ed.total > 0 ? "green" : "brand"} />
            </span>
            <span className="mt-1 block text-[12.5px] font-medium" style={{ color: ed.balance > 0 ? "var(--am)" : "var(--gn)" }}>
              {ed.total <= 0 ? "Chưa có giá trị" : ed.balance > 0 ? `Còn ${vnd(ed.balance)}${overdue.length ? " · có đợt quá hạn" : ""}` : "Đã thu đủ"}
            </span>
          </Fact>
        </dl>

        <div className="px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
          <LifeBar ed={ed} />
        </div>

        {/* Điện thoại: nút chính chiếm cả hàng, ngay dưới thông tin. */}
        {step && (
          <div className="flex items-center gap-2 px-4 pb-4 sm:hidden">
            {stepBtn("md", true)}
            {step.key !== "send" && (
              <button type="button" onClick={ctx.openSend} className={iconBtn()} aria-label="Gửi khách" title="Gửi khách" style={{ border: "1px solid var(--bd)" }}>
                <Send size={17} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Thanh tab dính ── */}
      <div ref={navRef} className="sticky top-[60px] z-20 -mx-4 px-4 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ background: "var(--bg)" }}>
        <div className="flex items-end gap-3">
          {/* Thanh dính đang hiện tên khách + nút chính: bỏ icon tab cho đủ chỗ. */}
          <div className={`min-w-0 flex-1 ${compact ? "xl:[&_.v2-tab_svg]:hidden" : ""}`}>
            <Tabs
              label="Nội dung hợp đồng"
              value={tabOk ? tab : "info"}
              onChange={(t) => go(t)}
              options={tabs.map((t) => ({ value: t.key, label: t.label, icon: t.icon, count: badgeFor(t.key) }))}
            />
          </div>
          {compact && (
            <div className="hidden flex-none items-center gap-2.5 pb-1.5 xl:flex">
              <span className="hidden max-w-[190px] truncate text-[13.5px] font-semibold min-[1400px]:inline" title={clientName}>
                {clientName}
              </span>
              {step ? (
                stepBtn("sm")
              ) : (
                <Badge tone={STATUS_TONE[f.status]} dot>
                  {CONTRACT_STATUS_LABEL[f.status]}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Nội dung + cột phải ── */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {tab === "info" && <ContractV2Overview ctx={ctx} />}
          {tab === "items" && <ContractV2Items ctx={ctx} />}
          {tab === "pay" && <ContractV2Payments ctx={ctx} />}
          {tab === "crew" && <ContractV2Crew ctx={ctx} />}
          {tab === "album" && kindHasPhotoWork(ed.kind) && <ContractV2Album ctx={ctx} />}
          {tab === "rental" && kindHasRental(ed.kind) && canRental && (
            <ContractRentalPanelV2
              contractId={contract.id}
              ownerId={contract.owner_id}
              clientName={f.client_name || ""}
              clientPhone={f.client_phone || ""}
              eventDate={f.event_date || null}
              onThemHangMuc={ed.themHangMucVaLuu}
            />
          )}
          {tab === "send" && <ContractV2Send ctx={ctx} />}
        </div>
        <aside className="hidden xl:sticky xl:top-[124px] xl:flex xl:flex-col xl:gap-4" aria-label="Tóm tắt hợp đồng">
          <ContractV2Rail ctx={ctx} />
        </aside>
      </div>

      {/* ── Hộp thoại ── */}
      <SendModal ed={ed} open={ed.sendOpen} onClose={() => ed.setSendOpen(false)} />
      <InfoDrawer ed={ed} open={infoOpen} onClose={() => setInfoOpen(false)} />
      {collect && (
        <CollectModal
          ctx={ctx}
          planId={collect.planId}
          onClose={() => setCollect(null)}
          onOther={() => {
            setCollect(null);
            setAddPlan({ paid: true });
          }}
        />
      )}
      {addPlan && <AddPlanModal ed={ed} paidDefault={addPlan.paid} onClose={() => setAddPlan(null)} onZoom={ed.setLightbox} />}
      {qr && <QrModal ed={ed} q={qr} onClose={() => setQr(null)} />}
      {crewEdit && <CrewDrawer ctx={ctx} edit={crewEdit} onClose={() => setCrewEdit(null)} />}

      <Modal
        open={!!confirm}
        onClose={() => (confirmBusy ? undefined : setConfirm(null))}
        title={confirm?.title ?? ""}
        desc={confirm?.desc}
        icon={confirm?.danger ? Trash2 : undefined}
        width={440}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirm(null)} disabled={confirmBusy}>
              Thôi
            </button>
            <button type="button" className={btn(confirm?.danger ? "danger" : "primary")} onClick={runConfirm} disabled={confirmBusy}>
              {confirmBusy ? "Đang làm…" : confirm?.confirm}
            </button>
          </>
        }
      />

      <Modal open={!!ed.lightbox} onClose={() => ed.setLightbox(null)} title="Ảnh chuyển khoản" width={720}>
        {ed.lightbox && (
          <div className="flex flex-col items-center gap-3">
            <img src={ed.lightbox} alt="Ảnh chuyển khoản" className="max-h-[70vh] w-auto max-w-full rounded-[12px] object-contain" style={{ border: "1px solid var(--bd)" }} />
            <a href={ed.lightbox} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
              Mở ảnh gốc ↗
            </a>
          </div>
        )}
      </Modal>

      {ed.changeDlg === "reschedule" && (
        <RescheduleDialog
          contractId={contract.id}
          eventDate={f.event_date || null}
          eventTime={f.event_time || null}
          clientName={f.client_name || null}
          clientPhone={f.client_phone || null}
          onClose={ed.closeChangeDlg}
          onDone={ed.onChangeDone}
        />
      )}
      {ed.changeDlg === "cancel" && (
        <CancelDialog
          contractId={contract.id}
          clientName={f.client_name || null}
          clientPhone={f.client_phone || null}
          onClose={ed.closeChangeDlg}
          onDone={ed.onChangeDone}
        />
      )}
    </div>
  );
}

/* ── Ô số liệu của thẻ đầu ── */
function Fact({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 sm:py-3.5 ${className}`}>
      <dt className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>
        {label}
      </dt>
      <dd className="mt-1 text-[14.5px] font-semibold">{children}</dd>
    </div>
  );
}

/* ── Nút liên hệ nhỏ (gọi · Zalo · hồ sơ) ── */
function ContactChip({
  href,
  icon: Icon,
  label,
  external = false,
  internal = false,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
  internal?: boolean;
}) {
  const cls = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium";
  const style = { background: "var(--sf2)", color: "var(--tx2)" };
  const body = (
    <>
      <Icon size={14} style={{ color: "var(--ac)" }} /> {label}
    </>
  );
  if (!href)
    return (
      <span className={cls} style={{ ...style, opacity: 0.55 }} aria-disabled>
        {body}
      </span>
    );
  if (internal)
    return (
      <Link href={href} className={cls} style={style}>
        {body}
      </Link>
    );
  return (
    <a href={href} className={cls} style={style} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {body}
    </a>
  );
}

/* ── Trạng thái: nhãn bấm được, mở menu đổi trạng thái ── */
function StatusMenu({ ed }: { ed: V2Ctx["ed"] }) {
  const cur = ed.f.status;
  const all = Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[];
  return (
    <Menu
      label="Đổi trạng thái hợp đồng"
      align="left"
      width={240}
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`Trạng thái: ${CONTRACT_STATUS_LABEL[cur]} — bấm để đổi`} className="flex-none rounded-full">
          <Badge tone={STATUS_TONE[cur]} dot>
            {CONTRACT_STATUS_LABEL[cur]}
            <ChevronDown size={12} strokeWidth={2.4} />
          </Badge>
        </button>
      )}
      items={all.map((k) => ({
        label: CONTRACT_STATUS_LABEL[k],
        icon: k === cur ? Check : k === "cancelled" ? Ban : Circle,
        danger: k === "cancelled",
        hint: k === "cancelled" && cur !== "cancelled" ? "Chọn cách xử lý tiền cọc, lịch thợ" : undefined,
        disabled: k === cur,
        // Chọn "Đã huỷ" mở hộp thoại Huỷ (như bản cũ): huỷ kéo theo hoàn/giữ cọc, gỡ lịch thợ…
        onClick: () => (k === "cancelled" ? ed.setChangeDlg("cancel") : ed.changeStatus(k)),
      }))}
    />
  );
}
