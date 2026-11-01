"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Package, CalendarDays, Wallet, ClipboardCheck, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { crewRoleLabel, type CrewRoleRow } from "@/lib/crew-roles";
import { SHOOT_TYPES, vnd, type CrewRole, type ShootType } from "@/lib/types";
import { nextContractCode } from "@/lib/contract-code";
import { contractKind, kindHasPhotoWork, shootTypesByKind, DEFAULT_TASKS_BY_KIND } from "@/lib/contract-kind";
import { resolveAlbumMode, type AlbumMode } from "@/lib/album-mode";
import type { AlbumModeStatus } from "@/components/AlbumModePicker";
import { fullClauseText } from "@/lib/contract-clauses";
import { depositByPercent, DEFAULT_DEPOSIT_PERCENT } from "@/lib/quote-deposit";
import {
  buildContractLines,
  effectivePrice,
  isCustomLineFilled,
  isPriceEdited,
  linesTotal,
  discountAmount,
  rebalancePlan,
  DISCOUNT_LINE_NAME,
  CUSTOM_LINE_FALLBACK_NAME,
  type LineCustom,
} from "@/lib/contract-lines";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { makeListLabel } from "@/lib/pricelist-label";
import { draftTotal, missingFields, type QuickDraft } from "@/lib/contract-quick";
import { crewClashes, type DayContract, type DayCrewRow } from "@/lib/contract-conflicts";
import { isMissingColumn, withoutColumn } from "@/lib/missing-column";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Tạo hợp đồng — bản cũ (NewContractForm) và
   giao diện mới (NewContractFormV2) cùng gọi: toàn bộ state 6 bước, tra khách
   cũ, tra trùng lịch, tính tiền, chia đợt, Tạo nhanh, và lưu hợp đồng. Hai bản
   chỉ khác nhau ở cách vẽ — sửa luật ở đây là cả hai cùng đổi.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TemplateOption = {
  id: string;
  name: string;
  shoot_type: ShootType;
  note: string | null;
  contract_template_items: { name: string; qty: number; unit_price: number; position: number }[];
};

export type ServiceOption = { id: string; name: string; clauses: string };

/** Gói dịch vụ lấy từ bảng giá (studio_pricelist, price > 0). */
export type PackageOption = {
  id: string;
  list_key: string;
  name: string;
  price: number;
  unit: string | null;
  category: string | null;
  description?: string | null;
};

/** Khách đã từng ký hợp đồng — gộp sẵn ở server. */
export type RecentClient = { name: string; phone: string; last: string | null; count: number };

type CrewPick = { id: string; name: string; phone: string; role: CrewRole; salary: number };
type Instalment = { label: string; amount: number; due: string };
/** Ngày phụ của hợp đồng — lưu thành mốc lịch (studio_events) nên hiện sẵn trên
    Lịch, lịch thợ, Google Lịch và cổng khách. */
export type ExtraDay = { label: string; date: string; time: string; note: string };


/* ── 6 bước của bản thiết kế ────────────────────────────────────────────────
   Mỗi bước là MỘT câu hỏi, hỏi đúng thứ tự studio vẫn hỏi khách qua điện
   thoại: làm dịch vụ gì → của ai → gói nào → khi nào & ai đi → trả tiền thế
   nào → soát lại. Không nhồi tất cả vào một form dài như bản cũ.

   LOẠI DỊCH VỤ ĐỨNG ĐẦU vì mọi bước sau bám theo nó: bảng giá hiện ra lọc
   theo dịch vụ đã chọn, còn hạng mục gợi ý và việc gieo sẵn thì theo nhóm
   nghề của nó. Trước đây nó nằm lẫn trong bước Gói dịch vụ — studio chọn gói
   xong mới thấy ô loại dịch vụ ngay bên cạnh, tức là chọn ngược. */
export const STEPS = [
  { icon: Package, label: "Loại dịch vụ", title: "Khách đặt dịch vụ gì?", hint: "Chọn trước để mọi bước sau bám theo: gói dịch vụ, hạng mục gợi ý và việc cần làm đều đổi theo lựa chọn này." },
  { icon: User, label: "Khách hàng", title: "Hợp đồng này của ai?", hint: "Gõ số điện thoại để tìm khách cũ — hoặc chọn từ danh sách gần đây." },
  { icon: ReceiptText, label: "Gói dịch vụ", title: "Khách chọn gói nào?", hint: "Tick bao nhiêu gói cũng được — sửa được giá từng gói, hoặc nhập gói riêng ngoài bảng giá." },
  { icon: CalendarDays, label: "Lịch & nhân sự", title: "Chụp khi nào, ai đi?", hint: "Chọn ngày giờ, địa điểm rồi phân công người đi chụp." },
  { icon: Wallet, label: "Thanh toán", title: "Khách trả tiền thế nào?", hint: "Chia đợt thu — mỗi đợt có hạn riêng để nhắc khách." },
  { icon: ClipboardCheck, label: "Kiểm tra", title: "Kiểm tra lần cuối", hint: "Bấm vào dòng bất kỳ để quay lại sửa." },
] as const;

export type NewContractFormProps = {
  ownerId: string;
  /** Đoạn chữ điền sẵn vào ô Tạo nhanh — vd đoạn chat khi mở từ Hộp thư. */
  initialQuickText?: string;
  quickSourceNote?: string;
  assignTo: string | null;
  /**
   * Chi nhánh đang xem trên thanh trên cùng. Hợp đồng mới THỪA HƯỞNG cơ sở đó
   * thay vì hỏi thêm một bước — luồng tạo hợp đồng đã 6 bước, và người đang xem
   * "Chi nhánh Quận 1" thì gần như chắc chắn đang tạo hợp đồng cho Quận 1. Đổi
   * lại được ở màn chi tiết hợp đồng.
   */
  branchId?: string | null;
  /** % cọc studio tự đặt ở "Chính sách studio" (mặc định 25%; 0 = không tự tính cọc). */
  depositPercent?: number;
  templates: TemplateOption[];
  services?: ServiceOption[];
  packages?: PackageOption[];
  roster?: { id: string; name: string; phone: string; role: CrewRole }[];
  /** Vai trò thợ studio tự đặt (studio_crew_roles) — để ra đúng tên vai trò. */
  crewRoles?: CrewRoleRow[];
  recentClients?: RecentClient[];
  bank?: { name: string | null; account: string | null; holder: string | null };
  /** Nhãn studio tự đặt cho từng bảng giá (profiles.pl_list_labels). */
  listLabels?: Record<string, string>;
};

/**
 * Hợp đồng (chưa huỷ) có lịch vào NGÀY này — ngày chính của hợp đồng HOẶC một
 * mốc lịch / ngày phụ của nó. Trước đây chỉ dò ngày chính, nên show có ngày
 * thứ hai rơi đúng hôm đó vẫn không ai báo.
 */
async function busyContractsOn(db: ReturnType<typeof createClient>, ownerId: string, date: string): Promise<DayContract[]> {
  const cols = "id, code, title, client_name, event_time";
  const [{ data: main }, { data: evs }] = await Promise.all([
    db.from("studio_contracts").select(cols).eq("owner_id", ownerId).eq("event_date", date).neq("status", "cancelled").limit(50),
    db.from("studio_events").select("contract_id, event_time").eq("owner_id", ownerId).eq("event_date", date).not("contract_id", "is", null).limit(50),
  ]);
  const out = new Map<string, DayContract>(((main ?? []) as DayContract[]).map((c) => [c.id, c]));
  const evRows = (evs ?? []) as { contract_id: string; event_time: string | null }[];
  const missing = Array.from(new Set(evRows.map((e) => e.contract_id))).filter((id) => !out.has(id));
  if (missing.length) {
    const { data: more } = await db.from("studio_contracts").select(cols).in("id", missing).neq("status", "cancelled");
    for (const c of (more ?? []) as DayContract[]) {
      // Giờ của mốc trong ngày đó, không phải giờ ngày chính của hợp đồng kia.
      out.set(c.id, { ...c, event_time: evRows.find((e) => e.contract_id === c.id)?.event_time ?? null });
    }
  }
  return Array.from(out.values());
}

export function useNewContractForm({
  ownerId,
  assignTo,
  branchId = null,
  depositPercent = DEFAULT_DEPOSIT_PERCENT,
  templates,
  services = [],
  packages = [],
  roster = [],
  crewRoles = [],
  recentClients = [],
  bank,
  listLabels = {},
  initialQuickText = "",
  quickSourceNote,
}: NewContractFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // ── Bước 2 — khách hàng ──────────────────────────────────────────────────
  const [clientQuery, setClientQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  // Một hợp đồng cho cả hai nhà: người ký (client_name) + tên cô dâu, chú rể.
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");

  // ── Bước 3 — gói & hạng mục ─────────────────────────────────────────────
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  // Bảng giá lọc theo loại dịch vụ đang chọn. Bật cờ này để xem lại TẤT CẢ —
  // lối thoát khi bảng giá không đặt theo dịch vụ nên lọc ra ít hơn mong đợi.
  const [showAllLists, setShowAllLists] = useState(false);
  const [shootType, setShootType] = useState<ShootType>("photo");
  const [templateId, setTemplateId] = useState("");
  const [mainPkgId, setMainPkgId] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  /* Giá đã thương lượng của từng gói, theo id gói — bảng giá chỉ là giá NIÊM
     YẾT, còn giá thật trên hợp đồng gần như lần nào cũng khác (khách quen bớt
     một ít, mùa thấp điểm giảm, gói gộp thì thêm). Trước đây studio phải chọn
     gói rồi vào màn chi tiết sửa lại từng hạng mục, nên số ở bước Thanh toán
     (cọc, đợt thu) được chia trên giá niêm yết — sai ngay từ lúc tạo. Chỉ ghi
     id nào đã sửa; gói chưa sửa vẫn ăn theo bảng giá nếu bảng giá đổi. */
  const [pkgPrice, setPkgPrice] = useState<Record<string, number>>({});
  /* Gói riêng: hạng mục gõ tay cho đúng hợp đồng này. Không phải mọi thứ khách
     đặt đều nằm trong bảng giá, và thêm một dòng dùng-một-lần vào bảng giá
     chung chỉ làm bảng giá rác dần. */
  const [customLines, setCustomLines] = useState<LineCustom[]>([]);
  /* Giảm giá cho cả hợp đồng — theo số tiền hoặc %. Trước đây form không có ô
     này: studio phải sửa giá từng gói hoặc vào màn chi tiết thêm dòng giảm. */
  const [discountMode, setDiscountMode] = useState<"vnd" | "pct">("vnd");
  const [discountValue, setDiscountValue] = useState(0);

  // ── Bước 4 — lịch & nhân sự ─────────────────────────────────────────────
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  // Ngày chính tự đặt tên ("Lễ nhà gái", "Ngày cưới"…) + ghi chú riêng cho ngày.
  const [eventLabel, setEventLabel] = useState("");
  const [eventNote, setEventNote] = useState("");
  // Ngày phụ (đám hai ngày, thử đồ, đãi tiệc…) — mỗi ngày một tên, ngày, giờ, ghi chú.
  const [extraDays, setExtraDays] = useState<ExtraDay[]>([]);
  const [picked, setPicked] = useState<CrewPick[]>([]);

  // ── Bước 5 — thanh toán ─────────────────────────────────────────────────
  /* Đợt thu studio đã nhập + TỔNG lúc nhập. Tổng đổi sau đó (quay lại sửa
     gói, giảm giá) thì cọc TỰ TÍNH LẠI theo % của studio và đợt cuối gánh
     phần còn lại — xem rebalancePlan. null = chưa đụng tới → kế hoạch mặc định. */
  const [plan, setPlanState] = useState<{ rows: Instalment[]; total: number } | null>(null);

  // ── Tuỳ chọn giữ lại từ bản cũ ──────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [addChecklist, setAddChecklist] = useState(true);
  const [makePhoto, setMakePhoto] = useState(true);
  const [makeVideo, setMakeVideo] = useState(false);
  // Album ảnh của hợp đồng: album mặc định (mstudo desktop) hay nhập link riêng.
  // Mặc định theo trạng thái kết nối: đủ điều kiện → album mặc định, chưa → link riêng.
  const [albumMode, setAlbumMode] = useState<AlbumMode | null>(null);
  const [albumModeTouched, setAlbumModeTouched] = useState(false);
  const [albumStatus, setAlbumStatus] = useState<AlbumModeStatus | null>(null);

  /* Yêu cầu riêng của khách (ô Tạo nhanh điền sẵn) — lưu vào brief_note, tức mục
     Brief KHÁCH XEM ĐƯỢC ở cổng hợp đồng, nên nhãn ở bước Kiểm tra nói rõ điều đó. */
  const [briefNote, setBriefNote] = useState("");
  /* Kết quả lần "Tạo nhanh" gần nhất — hiện dải tóm tắt ở bước Kiểm tra. */
  /* Ghi chú NỘI BỘ — cột internal_note, khách không bao giờ thấy. */
  const [internalNote, setInternalNote] = useState("");
  const [quick, setQuick] = useState<{ source: "ai" | "rules"; missing: string[]; filled: number } | null>(null);

  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) || null;
  const template = templates.find((t) => t.id === templateId) || null;
  const nhomDichVu = shootTypesByKind(SHOOT_TYPES);
  const mainPkg = packages.find((p) => p.id === mainPkgId) || null;
  const extras = packages.filter((p) => extraIds.includes(p.id));

  const priceOf = (p: PackageOption) => effectivePrice(p, pkgPrice);
  const priceEdited = (p: PackageOption) => isPriceEdited(p, pkgPrice);

  /* ── Tiền ────────────────────────────────────────────────────────────────
     Tổng LUÔN cộng từ mảng hạng mục, không có biến tổng viết tay — đúng ghi
     chú "nguồn số liệu duy nhất" trong README. */
  const baseLines = useMemo(
    () =>
      buildContractLines({
        templateItems: template?.contract_template_items ?? [],
        mainPkg,
        extras,
        pkgPrice,
        customLines,
      }),
    [template, mainPkg, extras, pkgPrice, customLines]
  );
  /** Tạm tính trước giảm giá. */
  const subtotal = linesTotal(baseLines);
  const discount = discountAmount(subtotal, discountValue, discountMode);
  const lines = useMemo(
    // Cùng dạng dòng giảm giá với buildContractLines({ discount }) và màn chi tiết.
    () => (discount > 0 ? [...baseLines, { name: DISCOUNT_LINE_NAME, qty: 1, unit_price: -discount }] : baseLines),
    [baseLines, discount]
  );

  const total = linesTotal(lines);
  const payroll = picked.reduce((s, c) => s + (c.salary || 0), 0);
  const profit = total - payroll;
  const marginPct = total > 0 ? Math.round((profit / total) * 100) : 0;
  // Bản thiết kế: dưới 45% đỏ, 45–60% vàng, trên 60% xanh.
  const marginTone =
    total <= 0 ? { fg: "var(--tx2)", soft: "var(--sf2)" }
      : marginPct < 45 ? { fg: "var(--rd)", soft: "var(--rdS)" }
      : marginPct < 60 ? { fg: "var(--am)", soft: "var(--amS)" }
      : { fg: "var(--gn)", soft: "var(--gnS)" };
  const thinMargin = total > 0 && marginPct < 45;

  // Kế hoạch thu mặc định: cọc giữ lịch theo % cọc của studio (làm tròn 500K)
  // + phần còn lại khi giao sản phẩm. Studio tắt cọc tự động (0%) thì một đợt
  // trọn gói. Studio sửa/thêm đợt tuỳ ý.
  const autoDeposit = depositPercent > 0 ? depositByPercent(total, depositPercent) : null;
  const defaultPlan = useMemo<Instalment[]>(() => {
    if (total <= 0) return [];
    if (!autoDeposit) return [{ label: "Thanh toán khi giao sản phẩm", amount: total, due: "" }];
    const rest = total - autoDeposit;
    const out: Instalment[] = [{ label: "Cọc giữ lịch", amount: autoDeposit, due: "" }];
    if (rest > 0) out.push({ label: "Thanh toán khi giao sản phẩm", amount: rest, due: "" });
    return out;
  }, [total, autoDeposit]);
  const instalments = plan ? (plan.total === total ? plan.rows : rebalancePlan(plan.rows, total, autoDeposit)) : defaultPlan;
  const setPlan = (rows: Instalment[] | null, forTotal = total) => setPlanState(rows ? { rows, total: forTotal } : null);
  const planTotal = instalments.reduce((s, p) => s + (p.amount || 0), 0);

  /** Gói riêng gọn thành một dòng cho bước soát lại. */
  const customPreview = useMemo(
    () =>
      customLines
        .filter(isCustomLineFilled)
        .map((c) => `${c.name.trim() || CUSTOM_LINE_FALLBACK_NAME}${c.qty > 1 ? ` ×${c.qty}` : ""} · ${vnd(c.unit_price)}`)
        .join(", "),
    [customLines]
  );

  const phoneOk = /^\d{10}$/.test(clientPhone.replace(/\D/g, ""));
  const phoneDigits = clientPhone.replace(/\D/g, "");

  /* ── Khách cũ ────────────────────────────────────────────────────────────
     Danh sách "khách gần đây" chỉ có 8 người; gõ (hoặc Tạo nhanh điền) một SĐT
     đã từng ký thì vẫn phải nhận ra, để studio thấy ngay đây là khách quay lại
     và dùng lại đúng tên đã lưu thay vì sinh thêm một cách viết tên nữa. */
  const [returning, setReturning] = useState<{ phone: string; count: number; name: string; last: string | null } | null>(null);
  useEffect(() => {
    if (!phoneOk) return;
    let alive = true;
    const t = setTimeout(async () => {
      // Chỉ là gợi ý: tra hỏng (mất mạng, RLS) thì im lặng, không chặn form.
      let data: unknown[] | null = null;
      try {
        ({ data } = await createClient()
          .from("studio_contracts")
          .select("client_name, event_date, created_at")
          .eq("owner_id", ownerId)
          .eq("client_phone", phoneDigits)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(50));
      } catch {
        return;
      }
      if (!alive) return;
      const rows = (data ?? []) as { client_name: string | null; event_date: string | null }[];
      setReturning(
        rows.length
          ? {
              phone: phoneDigits,
              count: rows.length,
              name: rows.find((r) => r.client_name?.trim())?.client_name?.trim() || "",
              last: rows.map((r) => r.event_date).filter(Boolean).sort().pop() ?? null,
            }
          : { phone: phoneDigits, count: 0, name: "", last: null }
      );
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [phoneOk, phoneDigits, ownerId]);
  const returningHit = returning && returning.phone === phoneDigits && returning.count > 0 ? returning : null;
  const savedNameDiffers =
    !!returningHit?.name && noAccent(returningHit.name.trim()) !== noAccent(clientName.trim());

  /* ── Cùng ngày đã có show nào ────────────────────────────────────────────
     Đọc lại mỗi khi đổi ngày; so thợ trùng giờ tính ở dưới (không cần gọi lại
     khi chỉ đổi người/giờ). */
  const [dayInfo, setDayInfo] = useState<{ date: string; contracts: DayContract[]; crew: DayCrewRow[] } | null>(null);
  useEffect(() => {
    if (!eventDate) return;
    let alive = true;
    (async () => {
      try {
        const db = createClient();
        const contracts = await busyContractsOn(db, ownerId, eventDate);
        let crew: DayCrewRow[] = [];
        if (contracts.length) {
          const { data: cr } = await db
            .from("contract_crew")
            .select("contract_id, name, phone, start_time, end_time")
            .in("contract_id", contracts.map((c) => c.id));
          crew = (cr ?? []) as DayCrewRow[];
        }
        if (alive) setDayInfo({ date: eventDate, contracts, crew });
      } catch {
        /* Cảnh báo trùng lịch là phụ — tra hỏng thì thôi, không chặn tạo hợp đồng. */
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventDate, ownerId]);
  const sameDayAll = dayInfo && dayInfo.date === eventDate ? dayInfo.contracts : [];

  /* Ngày phụ cũng phải báo trùng: đám hai ngày mà chỉ dò ngày chính thì vẫn
     nhận thêm show vào ngày thứ hai, tới hôm đó thợ bị kẹt. */
  const extraDates = useMemo(
    () => Array.from(new Set(extraDays.map((d) => d.date).filter((d) => d && d !== eventDate))).sort(),
    [extraDays, eventDate]
  );
  const extraKey = extraDates.join(",");
  const [extraBusy, setExtraBusy] = useState<{ key: string; byDate: Record<string, DayContract[]> } | null>(null);
  useEffect(() => {
    if (!extraKey) return;
    let alive = true;
    (async () => {
      try {
        const db = createClient();
        const dates = extraKey.split(",");
        const lists = await Promise.all(dates.map((d) => busyContractsOn(db, ownerId, d)));
        if (alive) setExtraBusy({ key: extraKey, byDate: Object.fromEntries(dates.map((d, i) => [d, lists[i]])) });
      } catch {
        /* phụ — tra hỏng thì thôi */
      }
    })();
    return () => {
      alive = false;
    };
  }, [extraKey, ownerId]);
  /** Ngày phụ đã có show khác: [{ ngày, tên ngày, các hợp đồng }]. */
  const extraClashes = useMemo(() => {
    if (!extraBusy || extraBusy.key !== extraKey) return [];
    return extraDates
      .map((date) => ({
        date,
        label: extraDays.find((d) => d.date === date)?.label.trim() || "Ngày phụ",
        contracts: extraBusy.byDate[date] ?? [],
      }))
      .filter((x) => x.contracts.length > 0);
  }, [extraBusy, extraKey, extraDates, extraDays]);
  const clashes = useMemo(
    () =>
      dayInfo && dayInfo.date === eventDate
        ? crewClashes(picked.map((c) => ({ name: c.name, phone: c.phone })), dayInfo.contracts, dayInfo.crew, startTime, endTime)
        : [],
    [dayInfo, eventDate, picked, startTime, endTime]
  );
  // Show cùng ngày đã nêu tên trong cảnh báo thợ thì khỏi liệt kê lại lần nữa.
  const sameDay = sameDayAll.filter((c) => !clashes.some((x) => x.contract.id === c.id));

  /* ── Khách gần đây: lọc không dấu như ô ⌘K ────────────────────────────── */
  const filteredClients = useMemo(() => {
    const q = noAccent(clientQuery.trim());
    if (!q) return recentClients;
    return recentClients.filter((c) => noAccent(`${c.name} ${c.phone}`).includes(q));
  }, [recentClients, clientQuery]);

  const listLabel = useMemo(() => makeListLabel(listLabels, services), [listLabels, services]);

  /* ── Bảng giá của ĐÚNG loại dịch vụ đang chọn ────────────────────────────
     Studio bán nhiều loại (cưới, đính hôn, kỷ yếu…) và mỗi loại một bảng giá.
     Đổ hết mọi bảng giá ra màn chọn gói thì phải dò giữa vài chục dòng, rất dễ
     chọn nhầm gói của dịch vụ khác.

     `studio_pricelist.list_key` là khoá KỸ THUẬT: có thể là id của dịch vụ (khi
     studio tạo bảng giá riêng cho dịch vụ đó), hoặc slug dựng sẵn/tự đặt
     ("cuoi", "dinh-hon"). Nên dò theo ba đường: trùng id → trùng slug hoá từ
     tên dịch vụ → trùng nhãn hiển thị. Không đường nào khớp thì trả null và
     giữ nguyên toàn bộ bảng giá — thà hiện thừa còn hơn hiện ra màn trống. */
  const serviceListKeys = useMemo(() => {
    if (!selectedService) return null;
    const name = noAccent(selectedService.name.trim());
    const slug = name.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const keys = new Set<string>();
    for (const p of packages) {
      const key = p.list_key || "khac";
      if (key === selectedService.id || (slug && key === slug) || noAccent(listLabel(key)) === name) {
        keys.add(key);
      }
    }
    return keys.size ? keys : null;
  }, [packages, selectedService, listLabel]);

  const filteringLists = !!serviceListKeys && !showAllLists;
  const visiblePackages = useMemo(
    () => (filteringLists ? packages.filter((p) => serviceListKeys!.has(p.list_key || "khac")) : packages),
    [packages, serviceListKeys, filteringLists]
  );

  /* ── Nhóm bảng giá theo list_key để danh sách gói không thành một mớ ──── */
  const packageGroups = useMemo(() => {
    const map = new Map<string, PackageOption[]>();
    for (const p of visiblePackages) {
      const key = p.list_key || "khac";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [visiblePackages]);

  /** Đổi loại dịch vụ ⇒ bỏ gói đã chọn: giá của dịch vụ cũ không còn nhìn thấy
      nữa, để lại trong tổng tiền là một khoản vô hình không ai gỡ được. */
  /** Chọn mẫu hợp đồng thì kéo luôn gói dịch vụ của mẫu vào ô chọn. */
  useEffect(() => {
    let off = false;
    fetch("/api/studio/album-mode-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (AlbumModeStatus & { defaultMode?: AlbumMode }) | null) => {
        if (off) return;
        // Không đọc được trạng thái → coi như chưa kết nối (cách thủ công).
        const st: AlbumModeStatus = d ?? { driveConfigured: false, driveConnected: false, rootFolderReady: false, desktopConnected: false };
        setAlbumStatus(st);
      })
      .catch(() => {
        if (!off) setAlbumStatus({ driveConfigured: false, driveConnected: false, rootFolderReady: false, desktopConnected: false });
      });
    return () => {
      off = true;
    };
  }, []);
  // Chế độ đang áp dụng: studio chưa tự chọn → theo mặc định; chọn album mặc
  // định mà chưa đủ điều kiện → lùi về nhập link riêng.
  const effectiveAlbumMode: AlbumMode | null = albumStatus
    ? resolveAlbumMode(albumModeTouched ? albumMode : null, albumStatus)
    : albumModeTouched ? albumMode : null;

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setShootType(t.shoot_type);
  }

  function changeService(id: string) {
    if (id === serviceId) return;
    setServiceId(id);
    setMainPkgId("");
    setExtraIds([]);
    setPkgPrice({});
    setShowAllLists(false);
    // Gói riêng thì GIỮ: đó là dòng studio tự gõ, không thuộc bảng giá nào, và
    // vẫn hiện nguyên trên màn — không thành khoản vô hình như gói của dịch vụ cũ.
  }

  function pickClient(c: RecentClient) {
    setClientName(c.name);
    setClientPhone(c.phone);
  }
  /** Chọn/bỏ gói chính. Bỏ chọn thì xoá luôn giá đã sửa của gói đó. */
  function pickMain(id: string) {
    const off = mainPkgId === id;
    setMainPkgId(off ? "" : id);
    setExtraIds((prev) => prev.filter((x) => x !== id));
    if (off) clearPkgPrice(id);
  }
  /* Chọn NHIỀU gói trong một hợp đồng: mọi gói của bảng giá là một ô tick.
     Gói tick đầu tiên đứng đầu danh sách hạng mục (mainPkgId), các gói sau nối
     tiếp (extraIds) — dữ liệu và cách cộng tiền giữ nguyên như cũ. Bỏ tick gói
     đầu thì gói kế tiếp lên thay, không mất lựa chọn nào. */
  function togglePkg(id: string) {
    if (id === mainPkgId) {
      const [next, ...rest] = extraIds;
      setMainPkgId(next ?? "");
      setExtraIds(rest);
      clearPkgPrice(id);
      return;
    }
    if (extraIds.includes(id)) return toggleExtra(id);
    if (!mainPkgId) setMainPkgId(id);
    else setExtraIds((prev) => [...prev, id]);
  }
  const pickedPkgIds = mainPkgId ? [mainPkgId, ...extraIds] : extraIds;
  const pickedPkgs = pickedPkgIds.map((id) => packages.find((p) => p.id === id)).filter((p): p is PackageOption => !!p);

  function toggleExtra(id: string) {
    const off = extraIds.includes(id);
    setExtraIds((prev) => (off ? prev.filter((x) => x !== id) : [...prev, id]));
    if (off) clearPkgPrice(id);
  }
  function setPkgPriceFor(id: string, price: number) {
    setPkgPrice((prev) => ({ ...prev, [id]: Math.max(0, price) }));
  }
  /* Hoàn giá = XOÁ khoá khỏi map, không phải ghi lại giá bảng giá: gói nào chưa
     sửa thì luôn ăn theo bảng giá, kể cả khi bảng giá đổi giữa lúc đang nhập. */
  function clearPkgPrice(id: string) {
    setPkgPrice((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function addCustomLine() {
    setCustomLines((prev) => [...prev, { name: "", qty: 1, unit_price: 0 }]);
  }
  function patchCustomLine(i: number, patch: Partial<LineCustom>) {
    setCustomLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeCustomLine(i: number) {
    setCustomLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addExtraDay() {
    setExtraDays((prev) => [...prev, { label: prev.length ? `Ngày phụ ${prev.length + 1}` : "Ngày phụ", date: "", time: "", note: "" }]);
  }
  function patchExtraDay(i: number, patch: Partial<ExtraDay>) {
    setExtraDays((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeExtraDay(i: number) {
    setExtraDays((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleCrew(r: { id: string; name: string; phone: string; role: CrewRole }) {
    setPicked((prev) =>
      prev.some((x) => x.id === r.id)
        ? prev.filter((x) => x.id !== r.id)
        : [...prev, { id: r.id, name: r.name, phone: r.phone, role: r.role, salary: 0 }]
    );
  }
  function setCrewSalary(id: string, salary: number) {
    setPicked((prev) => prev.map((x) => (x.id === id ? { ...x, salary } : x)));
  }
  /* Sửa MỘT đợt thì đợt CUỐI gánh phần còn lại, để tổng luôn khớp giá trị hợp
     đồng. Studio gõ tiền cọc là chính, và trước đây phải tự trừ nhẩm rồi gõ nốt
     số còn lại — sai một lần là hợp đồng lệch tiền, chỉ hiện ra ở dòng cảnh báo
     nhỏ bên dưới. Sửa thẳng đợt cuối thì để nguyên (đó là số người dùng đang tự
     đặt), và không đụng gì khi chưa có tổng tiền. */
  function patchInstalment(i: number, patch: Partial<Instalment>) {
    const next = instalments.map((x, idx) => (idx === i ? { ...x, ...patch } : x));
    const last = next.length - 1;
    if (patch.amount !== undefined && total > 0 && i < last) {
      const others = next.reduce((s, x, idx) => (idx === last ? s : s + (x.amount || 0)), 0);
      next[last] = { ...next[last], amount: Math.max(0, total - others) };
    }
    setPlan(next);
  }
  function addInstalment() {
    setPlan([...instalments, { label: "Đợt thanh toán", amount: Math.max(0, total - planTotal), due: "" }]);
  }
  function removeInstalment(i: number) {
    setPlan(instalments.filter((_, idx) => idx !== i));
  }

  /* ── Tạo nhanh ────────────────────────────────────────────────────────────
     Ngữ cảnh gửi cho bộ phân tích: đúng những gói/dịch vụ/thợ form đang có —
     id nào AI trả về cũng phải nằm trong đây. Memo để ô Tạo nhanh không chạy
     lại bộ đọc quy tắc mỗi lần form re-render. */
  const quickContext = useMemo(
    () => ({
      packages: packages.map((p) => ({ id: p.id, name: p.name, price: p.price, list_key: p.list_key })),
      services: services.map((s) => ({ id: s.id, name: s.name })),
      crew: roster.map((r) => ({ id: r.id, name: r.name || r.phone, role: crewRoleLabel(r.role, crewRoles) })),
    }),
    [packages, services, roster, crewRoles]
  );

  /** Đổ bản nháp vào mọi bước rồi nhảy tới bước Kiểm tra. Trường nào bản nháp
      không có thì GIỮ nguyên thứ studio đã nhập tay, không xoá trắng. */
  function applyQuick(d: QuickDraft, source: "ai" | "rules") {
    const pkgIds = new Set(packages.map((p) => p.id));
    let filled = 0;
    const hit = () => (filled += 1);

    if (d.serviceId && services.some((x) => x.id === d.serviceId)) {
      setServiceId(d.serviceId);
      setShowAllLists(false);
      hit();
    }
    if (d.shootType) setShootType(d.shootType);
    if (d.clientName) (setClientName(d.clientName), hit());
    if (d.clientPhone) (setClientPhone(d.clientPhone), hit());
    if (d.brideName) (setBrideName(d.brideName), hit());
    if (d.groomName) (setGroomName(d.groomName), hit());

    const main = d.mainPkgId && pkgIds.has(d.mainPkgId) ? d.mainPkgId : "";
    if (main || d.extraIds?.length || d.customLines?.length) {
      setMainPkgId(main);
      setExtraIds((d.extraIds ?? []).filter((id) => pkgIds.has(id) && id !== main));
      setPkgPrice(main && d.mainPrice !== undefined ? { [main]: Math.max(0, d.mainPrice) } : {});
      setCustomLines(d.customLines ?? []);
      hit();
    }
    // Gói AI chọn có thể thuộc bảng giá của dịch vụ khác → mở "xem tất cả" để
    // studio luôn thấy gói vừa chọn khi quay lại bước Gói dịch vụ. (Không lọc
    // theo serviceListKeys ở đây được: nó còn tính theo dịch vụ CŨ.)
    if (main || d.extraIds?.length) setShowAllLists(true);

    if (d.eventDate) (setEventDate(d.eventDate), hit());
    if (d.eventLabel) setEventLabel(d.eventLabel);
    if (d.extraDays?.length) {
      setExtraDays(d.extraDays.map((x) => ({ label: x.label, date: x.date, time: x.time ?? "", note: x.note ?? "" })));
      hit();
    }
    if (d.startTime) setStartTime(d.startTime);
    if (d.endTime) setEndTime(d.endTime);
    if (d.location) (setLocation(d.location), hit());
    if (d.crewIds?.length) {
      setPicked(
        roster
          .filter((r) => d.crewIds!.includes(r.id))
          .map((r) => ({ id: r.id, name: r.name, phone: r.phone, role: r.role, salary: 0 }))
      );
      hit();
    }

    // Cọc: có số cọc thì dựng kế hoạch 2 đợt theo tổng MỚI của bản nháp; không
    // có thì trả về kế hoạch mặc định (cọc làm tròn theo chính sách).
    const t = draftTotal(d, { ...quickContext, today: "" });
    if (d.deposit && d.deposit > 0 && t > 0) {
      const dep = Math.min(t, d.deposit);
      const next: Instalment[] = [{ label: "Cọc giữ lịch", amount: dep, due: d.depositDue ?? "" }];
      if (t - dep > 0) next.push({ label: "Thanh toán khi giao sản phẩm", amount: t - dep, due: "" });
      setPlan(next, t);
      hit();
    } else {
      setPlan(null);
    }
    if (d.title) setTitle(d.title);
    if (d.note) setBriefNote(d.note);
    if (d.internalNote) setInternalNote(d.internalNote);
    if (d.shootType === "video" || d.shootType === "psc") setMakeVideo(true);

    setQuick({ source, missing: missingFields(d), filled });
    setErr(null);
    setStep(STEPS.length - 1);
  }

  /** Bước hiện tại đã đủ dữ liệu để đi tiếp chưa. */
  const canNext = step === 1 ? phoneOk : step === 2 ? lines.length > 0 : true;
  const autoTitle = selectedService
    ? `Hợp đồng ${selectedService.name} ${fmtDate(eventDate || new Date())}`
    : `Hợp đồng ${fmtDate(eventDate || new Date())}`;

  async function create(mode: "draft" | "send") {
    setErr(null);
    if (!phoneOk) {
      // Bước 1 (chỉ số 1) là Khách hàng — nơi có ô điện thoại. Trước khi đưa
      // Loại dịch vụ lên đầu thì đó là chỉ số 0.
      setStep(1);
      setErr("SĐT khách phải đủ 10 số (dùng làm mật khẩu để khách mở cổng hợp đồng).");
      return;
    }
    setSaving(mode);
    const supabase = createClient();
    const token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const code = await nextContractCode(supabase, ownerId);
    // Ngày phụ chưa chọn ngày thì bỏ (mốc lịch bắt buộc có ngày).
    const validExtraDays = extraDays.filter((x) => !!x.date);
    // Điều khoản cố định theo dịch vụ; nếu không có thì lấy mẫu / bộ mặc định.
    const note = selectedService?.clauses || template?.note || fullClauseText();
    const row: Record<string, unknown> = {
      owner_id: ownerId,
      code,
      title: title.trim() || autoTitle,
      client_name: clientName.trim() || null,
      client_phone: clientPhone.replace(/\D/g, "") || null,
      ...(brideName.trim() ? { bride_name: brideName.trim() } : {}),
      ...(groomName.trim() ? { groom_name: groomName.trim() } : {}),
      shoot_type: shootType,
      ...(serviceId ? { service_id: serviceId } : {}),
      event_date: eventDate || null,
      event_time: startTime || null,
      ...(eventLabel.trim() ? { event_label: eventLabel.trim() } : {}),
      ...(eventNote.trim() ? { event_note: eventNote.trim() } : {}),
      location: location.trim() || null,
      note,
      client_token: token,
      drive_make_photo: makePhoto,
      drive_make_video: makeVideo,
      // Chỉ hợp đồng có hậu kỳ ảnh mới có album. Chưa kiểm tra xong kết nối thì
      // resolveAlbumMode(null) = nhập link riêng (cách an toàn, không cần Drive).
      ...(kindHasPhotoWork(contractKind(shootType))
        ? { album_mode: effectiveAlbumMode ?? resolveAlbumMode(null, albumStatus) }
        : {}),
      ...(briefNote.trim() ? { brief_note: briefNote.trim() } : {}),
      ...(internalNote.trim() ? { internal_note: internalNote.trim() } : {}),
      ...(assignTo ? { assigned_to: assignTo } : {}),
      ...(branchId ? { branch_id: branchId } : {}),
    };
    let { data, error } = await supabase.from("studio_contracts").insert(row).select("id").single();
    // Database chưa chạy migration contract_internal_note.sql → lưu hợp đồng
    // không kèm ghi chú nội bộ, rồi BÁO ra (ở danh sách "không lưu được" bên dưới)
    // thay vì chặn cả việc tạo hợp đồng.
    let noteLost = false;
    if (error && row.internal_note !== undefined && isMissingColumn(error, "internal_note")) {
      delete row.internal_note;
      noteLost = true;
      ({ data, error } = await supabase.from("studio_contracts").insert(row).select("id").single());
    }
    // Chưa chạy migration che_do_album_hop_dong.sql → lưu hợp đồng như cũ (hành
    // vi album tự động cũ), không chặn việc tạo hợp đồng.
    if (error && row.album_mode !== undefined && isMissingColumn(error, "album_mode")) {
      delete row.album_mode;
      ({ data, error } = await supabase.from("studio_contracts").insert(row).select("id").single());
    }
    // Chưa chạy migration hop_dong_yeu_cau_studio.sql → lưu hợp đồng không kèm
    // tên cô dâu/chú rể, tên/ghi chú ngày chính, rồi báo ra bên dưới.
    const newCols = ["bride_name", "groom_name", "event_label", "event_note"] as const;
    let newColsLost = false;
    if (error && newCols.some((c) => row[c] !== undefined && isMissingColumn(error, c))) {
      for (const c of newCols) delete row[c];
      newColsLost = true;
      ({ data, error } = await supabase.from("studio_contracts").insert(row).select("id").single());
    }
    if (error || !data) {
      setSaving(null);
      setErr(error?.message || "Không tạo được hợp đồng.");
      return;
    }

    // Hạng mục · nhân sự · đợt thu · checklist — chạy song song, thất bại ở một
    // bảng phụ không làm mất hợp đồng vừa tạo.
    //
    // NHƯNG PHẢI BÁO RA. Trước đây khối này bỏ qua sạch giá trị trả về, nên khi
    // RLS chặn ghi hạng mục (đúng cảnh của quản lý chi nhánh trên DB chưa vá
    // policy — xem migrations/rls_thanh_vien_hop_dong.sql) thì hợp đồng vẫn được
    // tạo, người dùng vẫn được chuyển sang màn chi tiết, và chỉ phát hiện ra khi
    // nhìn thấy tổng tiền 0đ mà không hiểu vì sao. Lưu hỏng mà im lặng là kiểu
    // hỏng tệ nhất: studio tưởng đã có hợp đồng đầy đủ và gửi cho khách.
    const saved = await Promise.all([
      lines.length
        ? (async () => {
            // Mô tả gói trong bảng giá đi theo sang hạng mục — khách đọc nó ở
            // cổng hợp đồng và trên bản in. Trước đây bị bỏ rơi ở đây.
            const rows = lines.map((l, position) => ({
              contract_id: data.id, name: l.name, description: l.description ?? null, qty: l.qty, unit_price: l.unit_price, position,
            }));
            const res = await supabase.from("contract_items").insert(rows);
            // Chưa chạy migration contract_item_description.sql → ghi bản không
            // có mô tả, đừng để mất cả bảng hạng mục.
            return res.error && isMissingColumn(res.error, "description")
              ? supabase.from("contract_items").insert(withoutColumn(rows, "description"))
              : res;
          })()
        : null,
      picked.length
        ? supabase.from("contract_crew").insert(
            picked.map((c, position) => ({
              contract_id: data.id,
              name: c.name,
              phone: c.phone || null,
              role: c.role,
              salary: c.salary || 0,
              ...(startTime ? { start_time: startTime } : {}),
              ...(endTime ? { end_time: endTime } : {}),
              position,
            }))
          )
        : null,
      instalments.length
        ? supabase.from("contract_payment_plan").insert(
            instalments
              .filter((p) => p.amount > 0)
              .map((p, position) => ({
                contract_id: data.id,
                label: p.label.trim() || "Đợt thanh toán",
                amount: p.amount,
                due_date: p.due || null,
                position,
              }))
          )
        : null,
      validExtraDays.length
        ? supabase
            .from("studio_events")
            .insert(
              validExtraDays.map((x) => ({
                owner_id: ownerId,
                contract_id: data.id,
                title: x.label.trim() || "Ngày phụ",
                event_date: x.date,
                event_time: x.time || null,
                note: x.note.trim() || null,
                remind: true,
              }))
            )
            .select("id")
        : null,
      addChecklist
        ? supabase
            .from("contract_tasks")
            // Việc gieo sẵn theo NHÓM hợp đồng: hợp đồng makeup không có ảnh
            // nào để "Chọn ảnh"/"Chỉnh sửa ảnh", gieo vào là studio phải xoá tay.
            .insert(
              DEFAULT_TASKS_BY_KIND[contractKind(shootType)].map((label, position) => ({
                contract_id: data.id, label, position,
              }))
            )
        : null,
    ]);

    // Tên bảng theo đúng thứ tự trong Promise.all ở trên.
    const failed = ["Hạng mục", "Nhân sự", "Đợt thanh toán", "Ngày phụ", "Checklist"]
      .filter((_, i) => saved[i]?.error);
    if (noteLost) failed.push("Ghi chú nội bộ (chưa chạy migration contract_internal_note.sql)");
    if (newColsLost) failed.push("Tên cô dâu/chú rể, tên & ghi chú ngày chính (chưa chạy migration hop_dong_yeu_cau_studio.sql)");
    if (failed.length) {
      const first = saved.find((r) => r?.error)?.error ?? null;
      setSaving(null);
      setErr(
        `Hợp đồng đã tạo nhưng KHÔNG lưu được: ${failed.join(", ")}. ` +
        `Vào màn chi tiết để nhập lại, và báo chủ studio chạy migration phân quyền nếu lỗi lặp lại.` +
        (first?.message ? ` (${first.message})` : "")
      );
      // Vẫn mở màn chi tiết sau một nhịp để họ đọc được thông báo rồi tự đi tiếp
      // — hợp đồng đã tồn tại, giữ họ lại ở form chỉ khiến họ bấm Lưu lần nữa
      // và tạo ra hợp đồng trùng.
      setTimeout(() => router.push(`/dashboard/studio/contracts/${data.id}`), 2500);
      return;
    }

    // Báo chủ studio biết hợp đồng vừa được tạo ở chi nhánh nào (fire-and-forget:
    // thông báo hỏng không được phép chặn luồng tạo hợp đồng).
    fetch("/api/studio/contract-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: data.id }),
    }).catch(() => {});

    // Ngày phụ lên Google Lịch như mốc lịch thêm ở màn chi tiết (fire-and-forget).
    const evRows = (saved[3]?.data ?? []) as { id: string }[];
    for (const ev of evRows) {
      fetch("/api/gcal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "event", id: ev.id, action: "upsert" }),
      }).catch(() => {});
    }
    // Đồng bộ Google Calendar nếu có ngày (fire-and-forget).
    if (eventDate) {
      fetch("/api/gcal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contract", id: data.id, action: "upsert" }),
      }).catch(() => {});
    }
    // "Tạo & gửi khách ký" mở thẳng tab Gửi khách & ký ở màn chi tiết; "Lưu
    // nháp" mở tab Thông tin. Hợp đồng vẫn ở trạng thái nháp cho tới khi studio
    // bấm gửi thật — không tự đánh dấu "đã gửi" thay người dùng.
    router.push(`/dashboard/studio/contracts/${data.id}${mode === "send" ? "?tab=send" : ""}`);
  }

  return {
    // props đã chuẩn hoá mặc định
    templates, services, packages, roster, crewRoles, recentClients, bank, initialQuickText, quickSourceNote,
    // bước
    step, setStep, canNext,
    // khách
    clientQuery, setClientQuery, clientName, setClientName, clientPhone, setClientPhone, phoneOk, phoneDigits,
    brideName, setBrideName, groomName, setGroomName,
    filteredClients, pickClient, returningHit, savedNameDiffers,
    // dịch vụ & gói
    serviceId, changeService, showAllLists, setShowAllLists, shootType, setShootType, templateId, pickTemplate,
    selectedService, template, nhomDichVu, mainPkgId, mainPkg, extraIds, extras, pkgPrice, priceOf, priceEdited,
    pickMain, toggleExtra, togglePkg, pickedPkgIds, pickedPkgs, setPkgPriceFor, clearPkgPrice, customLines, addCustomLine, patchCustomLine, removeCustomLine,
    customPreview, listLabel, serviceListKeys, filteringLists, visiblePackages, packageGroups,
    // tiền
    depositPercent,
    lines, total, subtotal, discount, discountMode, setDiscountMode, discountValue, setDiscountValue, payroll, profit, marginPct, marginTone, thinMargin,
    // lịch & nhân sự
    eventDate, setEventDate, startTime, setStartTime, endTime, setEndTime, location, setLocation,
    eventLabel, setEventLabel, eventNote, setEventNote,
    extraDays, addExtraDay, patchExtraDay, removeExtraDay, extraClashes,
    picked, toggleCrew, setCrewSalary, sameDayAll, sameDay, clashes,
    // thanh toán
    instalments, planTotal, patchInstalment, addInstalment, removeInstalment,
    // tuỳ chọn
    title, setTitle, autoTitle, addChecklist, setAddChecklist, makePhoto, setMakePhoto, makeVideo, setMakeVideo,
    albumMode, setAlbumMode, setAlbumModeTouched, albumStatus, setAlbumStatus, effectiveAlbumMode,
    briefNote, setBriefNote, internalNote, setInternalNote,
    // Tạo nhanh
    quick, quickContext, applyQuick,
    // lưu
    saving, err, create,
  };
}

export type NewContractFormState = ReturnType<typeof useNewContractForm>;
