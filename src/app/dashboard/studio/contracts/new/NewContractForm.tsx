"use client";

import { useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import MoneyInput from "@/components/MoneyInput";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  User,
  Package,
  CalendarDays,
  Wallet,
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  Send,
  AlertTriangle,
  CircleAlert,
  Landmark,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CREW_ROLE_LABEL,
  SHOOT_TYPE_LABEL,
  SHOOT_TYPES,
  vnd,
  type CrewRole,
  type ShootType,
} from "@/lib/types";
import { nextContractCode, DEFAULT_TASKS } from "@/lib/contract-code";
import { fullClauseText } from "@/lib/contract-clauses";
import { computeRoundedDeposit } from "@/lib/quote-deposit";
import {
  buildContractLines,
  effectivePrice,
  isCustomLineFilled,
  isPriceEdited,
  linesTotal,
  CUSTOM_LINE_FALLBACK_NAME,
  type LineCustom,
} from "@/lib/contract-lines";
import { fmtDate, fmtDow } from "@/lib/date";
import { avatarStyle, avatarColor, initials } from "@/lib/avatar";
import { noAccent } from "@/lib/studio-nav";
import { makeListLabel } from "@/lib/pricelist-label";

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

/* ── 5 bước của bản thiết kế ────────────────────────────────────────────────
   Mỗi bước là MỘT câu hỏi, hỏi đúng thứ tự studio vẫn hỏi khách qua điện
   thoại: của ai → chụp gói nào → khi nào & ai đi → trả tiền thế nào → soát
   lại. Không nhồi tất cả vào một form dài như bản cũ. */
const STEPS = [
  { icon: User, label: "Khách hàng", title: "Hợp đồng này của ai?", hint: "Gõ số điện thoại để tìm khách cũ — hoặc chọn từ danh sách gần đây." },
  { icon: Package, label: "Gói dịch vụ", title: "Khách chụp gói nào?", hint: "Chọn 1 gói chính, tick thêm hạng mục phát sinh — sửa được giá từng gói, hoặc nhập gói riêng ngoài bảng giá." },
  { icon: CalendarDays, label: "Lịch & nhân sự", title: "Chụp khi nào, ai đi?", hint: "Chọn ngày giờ, địa điểm rồi phân công người đi chụp." },
  { icon: Wallet, label: "Thanh toán", title: "Khách trả tiền thế nào?", hint: "Chia đợt thu — mỗi đợt có hạn riêng để nhắc khách." },
  { icon: ClipboardCheck, label: "Kiểm tra", title: "Kiểm tra lần cuối", hint: "Bấm vào dòng bất kỳ để quay lại sửa." },
] as const;

export default function NewContractForm({
  ownerId,
  assignTo,
  branchId = null,
  templates,
  services = [],
  packages = [],
  roster = [],
  recentClients = [],
  bank,
  listLabels = {},
}: {
  ownerId: string;
  assignTo: string | null;
  /**
   * Chi nhánh đang xem trên thanh trên cùng. Hợp đồng mới THỪA HƯỞNG cơ sở đó
   * thay vì hỏi thêm một bước — luồng tạo hợp đồng đã 5 bước, và người đang xem
   * "Chi nhánh Quận 1" thì gần như chắc chắn đang tạo hợp đồng cho Quận 1. Đổi
   * lại được ở màn chi tiết hợp đồng.
   */
  branchId?: string | null;
  templates: TemplateOption[];
  services?: ServiceOption[];
  packages?: PackageOption[];
  roster?: { id: string; name: string; phone: string; role: CrewRole }[];
  recentClients?: RecentClient[];
  bank?: { name: string | null; account: string | null; holder: string | null };
  /** Nhãn studio tự đặt cho từng bảng giá (profiles.pl_list_labels). */
  listLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // ── Bước 1 — khách hàng ──────────────────────────────────────────────────
  const [clientQuery, setClientQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // ── Bước 2 — gói & hạng mục ─────────────────────────────────────────────
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

  // ── Bước 3 — lịch & nhân sự ─────────────────────────────────────────────
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [picked, setPicked] = useState<CrewPick[]>([]);

  // ── Bước 4 — thanh toán ─────────────────────────────────────────────────
  const [plan, setPlan] = useState<Instalment[] | null>(null);

  // ── Tuỳ chọn giữ lại từ bản cũ ──────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [addChecklist, setAddChecklist] = useState(true);
  const [makePhoto, setMakePhoto] = useState(true);
  const [makeVideo, setMakeVideo] = useState(false);

  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) || null;
  const template = templates.find((t) => t.id === templateId) || null;
  const mainPkg = packages.find((p) => p.id === mainPkgId) || null;
  const extras = packages.filter((p) => extraIds.includes(p.id));

  const priceOf = (p: PackageOption) => effectivePrice(p, pkgPrice);
  const priceEdited = (p: PackageOption) => isPriceEdited(p, pkgPrice);

  /* ── Tiền ────────────────────────────────────────────────────────────────
     Tổng LUÔN cộng từ mảng hạng mục, không có biến tổng viết tay — đúng ghi
     chú "nguồn số liệu duy nhất" trong README. */
  const lines = useMemo(
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

  // Kế hoạch thu mặc định: cọc giữ lịch (làm tròn 500K theo chính sách sẵn có
  // của repo) + phần còn lại khi giao sản phẩm. Studio sửa/thêm đợt tuỳ ý.
  const defaultPlan = useMemo<Instalment[]>(() => {
    if (total <= 0) return [];
    const dep = Math.min(total, computeRoundedDeposit(total));
    const rest = total - dep;
    const out: Instalment[] = [{ label: "Cọc giữ lịch", amount: dep, due: "" }];
    if (rest > 0) out.push({ label: "Thanh toán khi giao sản phẩm", amount: rest, due: "" });
    return out;
  }, [total]);
  const instalments = plan ?? defaultPlan;
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

  /** Bước hiện tại đã đủ dữ liệu để đi tiếp chưa. */
  const canNext = step === 0 ? phoneOk : step === 1 ? lines.length > 0 : true;
  const autoTitle = selectedService
    ? `Hợp đồng ${selectedService.name} ${fmtDate(eventDate || new Date())}`
    : `Hợp đồng ${fmtDate(eventDate || new Date())}`;

  async function create(mode: "draft" | "send") {
    setErr(null);
    if (!phoneOk) {
      setStep(0);
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
    // Điều khoản cố định theo dịch vụ; nếu không có thì lấy mẫu / bộ mặc định.
    const note = selectedService?.clauses || template?.note || fullClauseText();
    const { data, error } = await supabase
      .from("studio_contracts")
      .insert({
        owner_id: ownerId,
        code,
        title: title.trim() || autoTitle,
        client_name: clientName.trim() || null,
        client_phone: clientPhone.replace(/\D/g, "") || null,
        shoot_type: template?.shoot_type ?? shootType,
        ...(serviceId ? { service_id: serviceId } : {}),
        event_date: eventDate || null,
        event_time: startTime || null,
        location: location.trim() || null,
        note,
        client_token: token,
        drive_make_photo: makePhoto,
        drive_make_video: makeVideo,
        ...(assignTo ? { assigned_to: assignTo } : {}),
        ...(branchId ? { branch_id: branchId } : {}),
      })
      .select("id")
      .single();
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
        ? supabase.from("contract_items").insert(
            lines.map((l, position) => ({ contract_id: data.id, name: l.name, qty: l.qty, unit_price: l.unit_price, position }))
          )
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
      addChecklist
        ? supabase
            .from("contract_tasks")
            .insert(DEFAULT_TASKS.map((label, position) => ({ contract_id: data.id, label, position })))
        : null,
    ]);

    // Tên bảng theo đúng thứ tự trong Promise.all ở trên.
    const failed = ["Hạng mục", "Nhân sự", "Đợt thanh toán", "Checklist"]
      .filter((_, i) => saved[i]?.error);
    if (failed.length) {
      const first = saved.find((r) => r?.error)?.error;
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

  /* ── Khối dùng lại ───────────────────────────────────────────────────────── */
  const panel = "rounded-[14px]";
  const panelStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const eyebrow = "text-[11px] font-extrabold uppercase";
  const eyebrowStyle = { letterSpacing: ".5px", color: "var(--tx3)" } as const;
  const fieldLabel = "mb-1.5 block text-[11px] font-bold uppercase";
  const fieldLabelStyle = { letterSpacing: ".4px", color: "var(--tx3)" } as const;
  const inputCls = "w-full rounded-[10px] px-3 py-2.5 text-[13px]";
  const inputStyle = { border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" } as const;

  /* ── Thanh hành động ──────────────────────────────────────────────────────
     Dựng MỘT LẦN rồi đặt vào hai chỗ tuỳ khổ màn (React tái dùng element vô
     tư): máy tính ghim ngay dưới thanh 5 bước ở ĐẦU trang; điện thoại ghim ĐÁY
     màn, ngay trên thanh điều hướng — ngón cái với tới được mà không phải cuộn
     hết một bước dài. Trước đây thanh này nằm cuối trang nên mỗi lần sang bước
     mới đều phải cuộn xuống đáy tìm nút. */
  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/dashboard/studio/contracts"
        className="rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold sm:text-[13px]"
        style={{ color: "var(--tx3)" }}
      >
        Huỷ
      </Link>
      <button
        type="button"
        onClick={() => create("draft")}
        disabled={!!saving || !phoneOk}
        className="rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold disabled:opacity-50 sm:text-[13px]"
        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
      >
        {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
      </button>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="ml-auto flex items-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold sm:px-4 sm:text-[13px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          {/* Trên điện thoại chỉ còn mũi tên — bốn nút chữ đầy đủ là tràn hàng. */}
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
        </button>
      )}

      {step < STEPS.length - 1 ? (
        <button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          disabled={!canNext}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50 sm:px-5 sm:text-[13px] ${step === 0 ? "ml-auto" : ""}`}
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          {step === 0 ? "Chọn gói" : step === 1 ? "Đặt lịch" : step === 2 ? "Chia tiền" : "Xem lại"}
          <ArrowRight size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => create("send")}
          disabled={!!saving}
          className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50 sm:px-5 sm:text-[13px]"
          style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 2px 8px color-mix(in srgb, var(--ac) 30%, transparent)" }}
        >
          <Send size={17} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách ký"}
        </button>
      )}
    </div>
  );

  return (
    <div className="page-in mx-auto flex max-w-[900px] flex-col gap-3.5">
      {/* ── Đầu trang GHIM: 5 bước + (máy tính) thanh hành động ─────────────
          Neo dưới topbar của StudioShell bằng --topbar-h. Cuộn nội dung dài
          không làm mất chỗ đứng: luôn thấy đang ở bước nào và bấm đi tiếp được
          ngay. */}
      <div
        className="sticky z-20 flex flex-col gap-2.5 pb-2.5 pt-1"
        style={{ top: "var(--topbar-h)", background: "var(--bg)" }}
      >
        {/* ── Thanh 5 bước ───────────────────────────────────────────────────
            Bấm được vào bước đã qua để quay lại sửa; bước chưa tới thì không. */}
        <div className={`${panel} flex items-start px-3 py-3 sm:px-4 sm:py-4`} style={panelStyle}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = s.icon;
            const lineC = i <= step ? "var(--ac)" : "var(--bd)";
            return (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-[7px]">
                <div className="flex w-full items-center">
                  <span className="h-0.5 flex-1" style={{ background: i === 0 ? "transparent" : lineC }} />
                  <button
                    type="button"
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    aria-current={current ? "step" : undefined}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
                    style={
                      done
                        ? { background: "var(--gn)", color: "#fff", border: "1.5px solid var(--gn)" }
                        : current
                          ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" }
                          : { background: "var(--sf2)", color: "var(--tx3)", border: "1.5px solid var(--bd)" }
                    }
                  >
                    {done ? <Check size={17} /> : <Icon size={17} />}
                  </button>
                  <span className="h-0.5 flex-1" style={{ background: i === STEPS.length - 1 ? "transparent" : (i < step ? "var(--ac)" : "var(--bd)") }} />
                </div>
                <span
                  className="text-center text-[11.5px]"
                  style={{ color: current ? "var(--ac)" : done ? "var(--tx2)" : "var(--tx3)", fontWeight: current ? 700 : 550 }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Máy tính: nút thao tác nằm ngay dưới 5 bước. Điện thoại dùng bản ghim
            đáy màn ở cuối file này. */}
        <div className={`${panel} hidden px-3 py-2.5 sm:block`} style={panelStyle}>{actionBar}</div>
      </div>

      {/* ── Nội dung bước ──────────────────────────────────────────────────── */}
      <div className={`${panel} px-5 py-5`} style={panelStyle}>
        <h3 className="text-[16px] font-bold">{STEPS[step].title}</h3>
        <p className="mb-4 mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{STEPS[step].hint}</p>

        {/* ── Bước 1 · Khách hàng ─────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            {/* NHẬP TAY ĐẶT TRÊN ĐẦU: phần lớn hợp đồng là khách mới, mà trước
                đây hai ô này nằm cuối bước, sau cả danh sách khách cũ và một nút
                "khách mới" phải bấm mới hiện ra. Giờ gõ được ngay; chọn khách cũ
                bên dưới thì hai ô này tự điền. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-name">Tên khách hàng</label>
                <input id="nc-name" className={inputCls} style={inputStyle} placeholder="Nguyễn Văn A" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-phone">Số điện thoại</label>
                <input
                  id="nc-phone"
                  className={inputCls}
                  style={{ ...inputStyle, borderColor: clientPhone && !phoneOk ? "var(--rd)" : "var(--bd)" }}
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="0901234567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </div>

            {clientPhone && !phoneOk && (
              <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--rd)" }}>
                SĐT phải đủ 10 số — khách dùng chính số này làm mật khẩu mở cổng hợp đồng.
              </p>
            )}

            {recentClients.length > 0 && (
              <>
                <p className={`mb-2 mt-[18px] ${eyebrow}`} style={eyebrowStyle}>Hoặc chọn khách cũ</p>
                <div className="relative mb-2.5">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
                  <input
                    className={`${inputCls} pl-10`}
                    style={inputStyle}
                    placeholder="Tìm theo tên hoặc số điện thoại…"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
                {/* min-w-0: lưới không khai báo cột lấy min-content của item làm
                    sàn track, mà item có `truncate` (nowrap) nên track phình rộng
                    hơn thẻ và danh sách tràn ra ngoài. Xem NewQuoteForm. */}
                <div className="grid min-w-0 gap-2">
                  {filteredClients.length === 0 ? (
                    <p className="py-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      Không có khách cũ nào khớp “{clientQuery}” — cứ gõ thẳng vào hai ô trên.
                    </p>
                  ) : (
                    filteredClients.map((c) => {
                      const on = clientPhone.replace(/\D/g, "") === c.phone.replace(/\D/g, "") && !!c.phone;
                      return (
                        <button
                          key={`${c.phone}-${c.name}`}
                          type="button"
                          onClick={() => pickClient(c)}
                          className="flex min-w-0 items-center gap-3 rounded-[11px] px-3.5 py-3 text-left"
                          style={{
                            border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                            background: on ? "var(--acS)" : "var(--sf)",
                          }}
                        >
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={avatarStyle(c.name)}>
                            {initials(c.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold">{c.name}</span>
                            <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                              {[c.phone || "chưa có SĐT", `${c.count} hợp đồng`, c.last ? `gần nhất ${fmtDate(c.last)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          {on && <Check size={20} style={{ flex: "none", color: "var(--ac)" }} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

          </div>
        )}

        {/* ── Bước 2 · Gói dịch vụ ────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {services.length > 0 ? (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-svc">Loại dịch vụ (điều khoản)</label>
                  <select id="nc-svc" className={inputCls} style={inputStyle} value={serviceId} onChange={(e) => changeService(e.target.value)}>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-shoot">Loại dịch vụ</label>
                  <select id="nc-shoot" className={inputCls} style={inputStyle} value={shootType} onChange={(e) => setShootType(e.target.value as ShootType)}>
                    {SHOOT_TYPES.map((k) => <option key={k} value={k}>{SHOOT_TYPE_LABEL[k]}</option>)}
                  </select>
                </div>
              )}
              {templates.length > 0 && (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-tpl">Tạo từ mẫu hợp đồng</label>
                  <select id="nc-tpl" className={inputCls} style={inputStyle} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">— Không dùng mẫu —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.contract_template_items?.length || 0} hạng mục)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {packages.length === 0 ? (
              <div className="rounded-[11px] px-4 py-5 text-center" style={{ border: "1px dashed var(--bd)" }}>
                <p className="text-[13px] font-semibold">Bảng giá đang trống</p>
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Thêm gói vào{" "}
                  <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>bảng giá</Link>{" "}
                  để chọn nhanh ở đây — hoặc dùng mẫu hợp đồng, hoặc nhập <b>gói riêng</b> ngay bên dưới.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className={eyebrow} style={eyebrowStyle}>Gói chính</p>
                  {/* Đang lọc theo dịch vụ thì nói rõ, và luôn để sẵn đường xem
                      lại toàn bộ — bảng giá không đặt theo dịch vụ vẫn dùng được. */}
                  {serviceListKeys && (
                    <button
                      type="button"
                      onClick={() => setShowAllLists((v) => !v)}
                      className="text-[11.5px] font-semibold underline"
                      style={{ color: "var(--ac)" }}
                    >
                      {filteringLists
                        ? `Đang hiện bảng giá ${selectedService?.name ?? ""} — xem tất cả`
                        : "Chỉ hiện bảng giá của dịch vụ này"}
                    </button>
                  )}
                </div>
                <p className="mb-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Chọn gói rồi <b>sửa thẳng ô giá</b> nếu đã thương lượng khác bảng giá — bảng giá gốc không đổi.
                </p>
                <div className="grid min-w-0 gap-2">
                  {packageGroups.map(([key, list]) => (
                    <div key={key} className="grid min-w-0 gap-2">
                      {packageGroups.length > 1 && (
                        <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>{listLabel(key)}</p>
                      )}
                      {list.map((p) => {
                        const on = mainPkgId === p.id;
                        const edited = priceEdited(p);
                        return (
                          /* Không còn là MỘT nút: gói đã chọn phải sửa được giá
                             ngay tại chỗ, mà <input> không đặt trong <button>
                             được (bấm vào ô là bấm cả nút). Nên tách: nút chọn
                             chiếm phần tên, ô giá nằm ngoài nút. */
                          <div
                            key={p.id}
                            className="flex min-w-0 items-center gap-2 rounded-[11px] pr-2.5"
                            style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                          >
                            <button
                              type="button"
                              onClick={() => pickMain(p.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left"
                              aria-pressed={on}
                            >
                              <Package size={19} style={{ flex: "none", color: on ? "var(--ac)" : "var(--tx3)" }} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                                <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                                  {on && edited
                                    ? `Giá bảng giá ${vnd(p.price)} — đang dùng giá sửa`
                                    : [p.category, p.description, p.unit].filter(Boolean).join(" · ") || "Gói trong bảng giá"}
                                </span>
                              </span>
                            </button>
                            {on ? (
                              <span className="flex flex-none items-center gap-1">
                                <MoneyInput
                                  value={priceOf(p)}
                                  onChange={(n) => setPkgPriceFor(p.id, n)}
                                  placeholder="Giá"
                                  ariaLabel={`Giá gói ${p.name}`}
                                  className="tnum w-[112px] rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                                  style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                                />
                                {edited && (
                                  <button
                                    type="button"
                                    onClick={() => clearPkgPrice(p.id)}
                                    aria-label={`Hoàn giá bảng giá cho ${p.name}`}
                                    title={`Hoàn về ${vnd(p.price)}`}
                                    className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                                    style={{ color: "var(--tx3)" }}
                                  >
                                    <RotateCcw size={15} />
                                  </button>
                                )}
                              </span>
                            ) : (
                              <strong className="tnum flex-none whitespace-nowrap text-[13.5px]">{vnd(p.price)}</strong>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <p className={`mb-2 mt-[18px] ${eyebrow}`} style={eyebrowStyle}>Hạng mục thêm</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visiblePackages.filter((p) => p.id !== mainPkgId).map((x) => {
                    const on = extraIds.includes(x.id);
                    const edited = priceEdited(x);
                    return (
                      <div
                        key={x.id}
                        className="flex min-w-0 items-center gap-2 rounded-[10px] pr-2"
                        style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExtra(x.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3.5 text-left"
                          aria-pressed={on}
                        >
                          {on ? <Check size={18} style={{ flex: "none", color: "var(--ac)" }} /> : <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />}
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{x.name}</span>
                        </button>
                        {on ? (
                          <span className="flex flex-none items-center gap-0.5">
                            <MoneyInput
                              value={priceOf(x)}
                              onChange={(n) => setPkgPriceFor(x.id, n)}
                              placeholder="Giá"
                              ariaLabel={`Giá hạng mục ${x.name}`}
                              className="tnum w-[104px] rounded-[8px] px-2 py-1.5 text-right text-[12.5px] font-bold"
                              style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                            />
                            {edited && (
                              <button
                                type="button"
                                onClick={() => clearPkgPrice(x.id)}
                                aria-label={`Hoàn giá bảng giá cho ${x.name}`}
                                title={`Hoàn về ${vnd(x.price)}`}
                                className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
                                style={{ color: "var(--tx3)" }}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </span>
                        ) : (
                          <strong className="tnum flex-none whitespace-nowrap text-[12.5px]">{vnd(x.price)}</strong>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Gói riêng ───────────────────────────────────────────────────
                Gói KHÔNG có trong bảng giá: khách đặt thêm một buổi chụp lạ,
                gộp combo theo thoả thuận riêng, hay thuê một món thiết bị cho
                đúng lần này. Trước đây studio phải tạo hợp đồng rồi mở màn chi
                tiết mới thêm được hạng mục — mà bước Thanh toán ở đây đã chia
                cọc theo tổng, nên cọc chia thiếu ngay từ lúc tạo. Cũng là đường
                đi duy nhất khi bảng giá còn trống. */}
            <div className="mt-[18px]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={eyebrow} style={eyebrowStyle}>Gói riêng (không có trong bảng giá)</p>
                {customLines.length > 0 && (
                  <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>Chỉ dùng cho hợp đồng này</span>
                )}
              </div>
              <div className="grid gap-2">
                {customLines.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-[11px] px-3 py-2.5" style={{ border: "1px solid var(--bd)" }}>
                    <input
                      className="min-w-[150px] flex-1 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold"
                      style={inputStyle}
                      value={c.name}
                      aria-label={`Tên gói riêng ${i + 1}`}
                      placeholder="VD: Chụp thêm buổi ở Đà Lạt"
                      onChange={(e) => patchCustomLine(i, { name: e.target.value })}
                    />
                    <span className="flex flex-none items-center gap-1.5">
                      <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>SL</span>
                      <input
                        type="number"
                        min={1}
                        className="tnum w-[62px] rounded-[8px] px-2 py-2 text-center text-[13px] font-semibold"
                        style={inputStyle}
                        value={c.qty}
                        aria-label={`Số lượng gói riêng ${i + 1}`}
                        onChange={(e) => patchCustomLine(i, { qty: Number(e.target.value) })}
                      />
                    </span>
                    <MoneyInput
                      value={c.unit_price}
                      onChange={(n) => patchCustomLine(i, { unit_price: n })}
                      placeholder="Đơn giá"
                      ariaLabel={`Đơn giá gói riêng ${i + 1}`}
                      className="tnum w-[124px] flex-none rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomLine(i)}
                      aria-label={`Bỏ gói riêng ${i + 1}`}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomLine}
                  className="flex items-center justify-center gap-1.5 rounded-[11px] py-3 text-[12.5px] font-semibold"
                  style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
                >
                  <Plus size={16} /> Nhập gói riêng
                </button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="mt-4 flex items-baseline justify-between rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                <span className="text-[12.5px] font-semibold">{lines.length} hạng mục</span>
                <strong className="tnum text-[17px]" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(total)}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Bước 3 · Lịch & nhân sự ─────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Ngày chụp</label>
                <DateInput value={eventDate} onChange={setEventDate} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Bắt đầu</label>
                <TimeInput value={startTime} onChange={setStartTime} ariaLabel="Giờ bắt đầu" />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Kết thúc</label>
                <TimeInput value={endTime} onChange={setEndTime} ariaLabel="Giờ kết thúc" placeholder="18:00" />
              </div>
            </div>
            <p className="mb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Giờ bắt đầu là giờ của hợp đồng; giờ kết thúc lưu thành ca của từng người được phân công bên dưới.
            </p>
            <div className="mb-4">
              <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-loc">Địa điểm</label>
              <input id="nc-loc" className={inputCls} style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nhà hàng, studio, ngoại cảnh…" />
            </div>

            <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Phân công nhân sự</p>
            {roster.length === 0 ? (
              <div className="rounded-[11px] px-4 py-5 text-center" style={{ border: "1px dashed var(--bd)" }}>
                <p className="text-[13px] font-semibold">Sổ thợ đang trống</p>
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Thêm người vào{" "}
                  <Link href="/dashboard/studio/staff?tab=crew" className="font-semibold underline" style={{ color: "var(--ac)" }}>Đội ngũ</Link>{" "}
                  để phân công ngay tại đây — hoặc phân công sau ở màn chi tiết.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {roster.map((r) => {
                  const on = picked.find((x) => x.id === r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-[11px] px-3 py-2.5"
                      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                    >
                      <button type="button" onClick={() => toggleCrew(r)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: avatarColor(r.name || r.phone) }}
                        >
                          {initials(r.name || r.phone)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">{r.name || r.phone}</span>
                          <span className="block truncate text-[10.5px]" style={{ color: "var(--tx3)" }}>{CREW_ROLE_LABEL[r.role]}</span>
                        </span>
                      </button>
                      {on ? (
                        <span className="w-[104px] flex-none">
                          <MoneyInput
                            value={on.salary}
                            onChange={(n) => setCrewSalary(r.id, n)}
                            placeholder="Tiền công"
                            className="w-full rounded-[8px] px-2 py-1.5 text-right text-[12px] tnum"
                          />
                        </span>
                      ) : (
                        <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {picked.length > 0 && (
              <p className="mt-3 text-[12px]" style={{ color: "var(--tx3)" }}>
                {picked.length} người · tiền công <b className="tnum" style={{ color: "var(--tx2)" }}>{vnd(payroll)}</b>
              </p>
            )}
          </div>
        )}

        {/* ── Bước 4 · Thanh toán ─────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-4 grid gap-2">
              {instalments.map((p, i) => {
                const pct = total > 0 ? Math.round((p.amount / total) * 100) : 0;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2.5 rounded-[11px] px-3.5 py-3" style={{ border: "1px solid var(--bd)" }}>
                    <span
                      className="tnum flex h-8 w-11 flex-none items-center justify-center rounded-[8px] text-[12px] font-bold"
                      style={{ background: "var(--acS)", color: "var(--ac)" }}
                    >
                      {pct}%
                    </span>
                    <input
                      className="min-w-[130px] flex-1 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold"
                      style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                      value={p.label}
                      aria-label={`Tên đợt ${i + 1}`}
                      onChange={(e) => patchInstalment(i, { label: e.target.value })}
                    />
                    <span className="w-[140px] flex-none">
                      <DateInput value={p.due} onChange={(v) => patchInstalment(i, { due: v })} />
                    </span>
                    <span className="w-[130px] flex-none">
                      <MoneyInput
                        value={p.amount}
                        onChange={(n) => patchInstalment(i, { amount: n })}
                        placeholder="Số tiền"
                        className="tnum w-full rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInstalment(i)}
                      aria-label="Bỏ đợt này"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addInstalment}
                className="flex items-center justify-center gap-1.5 rounded-[11px] py-3 text-[12.5px] font-semibold"
                style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
              >
                <Plus size={16} /> Thêm đợt thanh toán
              </button>
              {instalments.length > 1 && total > 0 && (
                <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Sửa tiền cọc (hoặc đợt bất kỳ ở trên) thì <b>đợt cuối tự đổi</b> cho khớp tổng {vnd(total)}.
                </p>
              )}
            </div>

            {planTotal !== total && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--amS)" }}>
                <CircleAlert size={18} style={{ flex: "none", color: "var(--am)" }} />
                <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  Tổng các đợt là <b className="tnum">{vnd(planTotal)}</b>, lệch{" "}
                  <b className="tnum">{vnd(Math.abs(total - planTotal))}</b> so với giá trị hợp đồng{" "}
                  <b className="tnum">{vnd(total)}</b>. Sửa lại nếu không cố ý.
                </p>
              </div>
            )}

            <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Hình thức nhận tiền</p>
            {/* Tài khoản nhận tiền khai ở mục "Thông tin liên hệ" của Gói & bảng
                giá (các cột pl_bank_*), KHÔNG phải /dashboard/settings — trang đó
                là cấu hình nền tảng mstudo và chặn non-admin, nên link cũ đá chủ
                studio về /dashboard. */}
            <div className="flex items-start gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <Landmark size={18} style={{ flex: "none", color: "var(--ac)" }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                {bank?.account
                  ? <>Khách quét mã VietQR hoặc chuyển vào <b>{[bank.name, bank.account, bank.holder].filter(Boolean).join(" · ")}</b>. Mã QR sinh sẵn theo từng đợt trong cổng khách.</>
                  : <>Chưa khai báo tài khoản nhận tiền — cổng khách sẽ không có mã QR. Khai báo trong <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>Gói &amp; bảng giá</Link>.</>}
              </p>
            </div>
          </div>
        )}

        {/* ── Bước 5 · Kiểm tra lần cuối ──────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="mb-4 overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              {([
                [0, "Khách hàng", [clientName || "Chưa có tên", clientPhone].filter(Boolean).join(" · ")],
                [1, "Dịch vụ", selectedService?.name || SHOOT_TYPE_LABEL[shootType]],
                // Giá hiện ở đây là giá ĐÃ SỬA, không phải giá bảng giá — nếu
                // in giá niêm yết thì bước soát lại sẽ khẳng định một con số
                // khác với con số thật đang nằm trong hợp đồng.
                [1, "Gói chính", mainPkg ? `${mainPkg.name} · ${vnd(priceOf(mainPkg))}${priceEdited(mainPkg) ? " (đã sửa giá)" : ""}` : template ? `Mẫu: ${template.name}` : "Chưa chọn"],
                [1, "Hạng mục thêm", extras.length ? extras.map((x) => `${x.name} · ${vnd(priceOf(x))}`).join(", ") : "Không có"],
                [1, "Gói riêng", customPreview || "Không có"],
                [2, "Ngày chụp", eventDate ? `${fmtDow(eventDate)} · ${fmtDate(eventDate)}` : "Chưa chọn ngày"],
                [2, "Khung giờ", startTime || endTime ? [startTime, endTime].filter(Boolean).join(" – ") : "Chưa đặt giờ"],
                [2, "Địa điểm", location || "Chưa có"],
                [2, "Nhân sự", picked.length ? picked.map((c) => c.name || c.phone).join(", ") : "Chưa phân công"],
                [3, "Đợt thanh toán", instalments.length ? instalments.map((p) => `${p.label} ${vnd(p.amount)}`).join(" · ") : "Chưa chia đợt"],
              ] as [number, string, string][]).map(([goto, label, value], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(goto)}
                  className="flex w-full items-center gap-3.5 px-4 py-3 text-left"
                  style={{ borderBottom: "1px solid var(--bd2)" }}
                >
                  <span className="w-[110px] flex-none text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>{label}</span>
                  <span className="min-w-0 flex-1 text-[13px] font-semibold">{value}</span>
                  <Pencil size={16} style={{ flex: "none", color: "var(--tx3)" }} />
                </button>
              ))}
            </div>

            <div className="rounded-[12px] px-4 py-4" style={{ border: "1px solid var(--bd)" }}>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 py-1 text-[13px]">
                  <span className="min-w-0 truncate" style={{ color: "var(--tx2)" }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                  <strong className="tnum flex-none">{vnd(l.qty * l.unit_price)}</strong>
                </div>
              ))}
              <div className="mt-1.5 flex items-baseline justify-between pt-2.5" style={{ borderTop: "1px solid var(--bd)" }}>
                <span className="text-[13.5px] font-bold">Tổng hợp đồng</span>
                <strong className="tnum text-[22px]" style={{ color: "var(--ac)", letterSpacing: "-.6px" }}>{vnd(total)}</strong>
              </div>
              <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--bd2)" }}>
                <div className="flex justify-between py-0.5 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>Tiền công nhân sự</span>
                  <strong className="tnum">− {vnd(payroll)}</strong>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between pt-2.5 text-[12.5px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                <span style={{ color: "var(--tx2)" }}>Lợi nhuận dự kiến</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold" style={{ background: marginTone.soft, color: marginTone.fg }}>
                    {marginPct}%
                  </span>
                  <strong className="tnum text-[15px]" style={{ color: marginTone.fg }}>{vnd(profit)}</strong>
                </span>
              </div>
            </div>

            {/* Cảnh báo lãi mỏng — tính năng mới số 3 của bản thiết kế. */}
            {thinMargin && (
              <div
                className="mt-3 flex gap-2.5 rounded-[11px] px-3.5 py-3"
                style={{ background: "var(--rdS)", border: "1px solid color-mix(in srgb, var(--rd) 25%, transparent)" }}
              >
                <AlertTriangle size={18} style={{ flex: "none", color: "var(--rd)", marginTop: 1 }} />
                <div>
                  <p className="text-[13px] font-bold" style={{ color: "var(--rd)" }}>Hợp đồng này lãi mỏng</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                    Biên lợi nhuận chỉ {marginPct}% ({vnd(profit)} trên {vnd(total)}) sau khi trả {vnd(payroll)} tiền công.
                    Chi phí in ấn và phát sinh chưa tính vào đây. Cân nhắc tăng giá hoặc bớt người trước khi gửi khách ký.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3.5 grid gap-2 rounded-[11px] px-3.5 py-3 sm:grid-cols-2" style={{ background: "var(--sf2)" }}>
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-title">Tên hợp đồng</label>
                <input
                  id="nc-title"
                  className={inputCls}
                  style={{ ...inputStyle, background: "var(--sf)" }}
                  placeholder={autoTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                <input type="checkbox" checked={addChecklist} onChange={(e) => setAddChecklist(e.target.checked)} />
                Thêm checklist hậu kỳ mặc định
              </label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  <input type="checkbox" checked={makePhoto} onChange={(e) => setMakePhoto(e.target.checked)} />
                  Tạo thư mục ảnh
                </label>
                <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  <input type="checkbox" checked={makeVideo} onChange={(e) => setMakeVideo(e.target.checked)} />
                  Có quay phim
                </label>
              </div>
            </div>

            <div className="mt-3.5 flex gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <Send size={18} style={{ flex: "none", color: "var(--ac)" }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                Bấm “Tạo &amp; gửi khách ký” sẽ tạo hợp đồng rồi mở thẳng tab gửi khách: chép link cổng, gửi Zalo/Messenger/email.
                Khách mở link bằng số điện thoại của mình, ký điện tử và thấy mã QR chuyển cọc.
              </p>
            </div>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
            {err}
          </p>
        )}
      </div>

      {/* ── Điện thoại: thanh hành động GHIM ĐÁY ────────────────────────────
          Ngồi ngay TRÊN thanh điều hướng đáy của StudioShell (cao 52px + vùng an
          toàn của máy).

          Dùng `sticky` chứ KHÔNG `fixed`: thẻ <main> bao ngoài có
          `overflow-x: clip`, và hiệu ứng vào trang `page-in` chạy transform —
          hai thứ này đều có thể biến một phần tử `fixed` thành neo theo thẻ cha
          thay vì theo màn hình. `sticky` neo theo vùng cuộn nên không dính.
          Phần tử vẫn chiếm chỗ ở CUỐI luồng nên không che mất nội dung nào, và
          khoảng đệm ngay sau nó cho nó chỗ bám tới tận đáy trang (phần tử dính
          chỉ chạy trong hộp NỘI DUNG của thẻ cha, padding không tính). */}
      <div
        className="sticky z-30 sm:hidden"
        style={{ bottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className={`${panel} px-3 py-2.5`}
          style={{ ...panelStyle, boxShadow: "0 -6px 20px rgba(20, 15, 25, .12)" }}
        >
          {actionBar}
        </div>
      </div>
      <div className="h-12 sm:hidden" />
    </div>
  );
}
