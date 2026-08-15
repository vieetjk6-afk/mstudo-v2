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
  UserPlus,
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
import { fmtDate, fmtDow } from "@/lib/date";
import { avatarStyle, avatarColor, initials } from "@/lib/avatar";
import { noAccent } from "@/lib/studio-nav";

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
  { icon: Package, label: "Gói dịch vụ", title: "Khách chụp gói nào?", hint: "Chọn 1 gói chính, sau đó tick thêm hạng mục phát sinh." },
  { icon: CalendarDays, label: "Lịch & nhân sự", title: "Chụp khi nào, ai đi?", hint: "Chọn ngày giờ, địa điểm rồi phân công người đi chụp." },
  { icon: Wallet, label: "Thanh toán", title: "Khách trả tiền thế nào?", hint: "Chia đợt thu — mỗi đợt có hạn riêng để nhắc khách." },
  { icon: ClipboardCheck, label: "Kiểm tra", title: "Kiểm tra lần cuối", hint: "Bấm vào dòng bất kỳ để quay lại sửa." },
] as const;

export default function NewContractForm({
  ownerId,
  assignTo,
  templates,
  services = [],
  packages = [],
  roster = [],
  recentClients = [],
  bank,
}: {
  ownerId: string;
  assignTo: string | null;
  templates: TemplateOption[];
  services?: ServiceOption[];
  packages?: PackageOption[];
  roster?: { id: string; name: string; phone: string; role: CrewRole }[];
  recentClients?: RecentClient[];
  bank?: { name: string | null; account: string | null; holder: string | null };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // ── Bước 1 — khách hàng ──────────────────────────────────────────────────
  const [clientQuery, setClientQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [manualClient, setManualClient] = useState(false);

  // ── Bước 2 — gói & hạng mục ─────────────────────────────────────────────
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [shootType, setShootType] = useState<ShootType>("photo");
  const [templateId, setTemplateId] = useState("");
  const [mainPkgId, setMainPkgId] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);

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

  /* ── Tiền ────────────────────────────────────────────────────────────────
     Tổng LUÔN cộng từ mảng hạng mục, không có biến tổng viết tay — đúng ghi
     chú "nguồn số liệu duy nhất" trong README. */
  const lines = useMemo(() => {
    const out: { name: string; qty: number; unit_price: number }[] = [];
    if (template) {
      [...template.contract_template_items]
        .sort((a, b) => a.position - b.position)
        .forEach((i) => out.push({ name: i.name, qty: i.qty, unit_price: i.unit_price }));
    }
    if (mainPkg) out.push({ name: mainPkg.name, qty: 1, unit_price: mainPkg.price });
    for (const x of extras) out.push({ name: x.name, qty: 1, unit_price: x.price });
    return out;
  }, [template, mainPkg, extras]);

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
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

  const phoneOk = /^\d{10}$/.test(clientPhone.replace(/\D/g, ""));

  /* ── Khách gần đây: lọc không dấu như ô ⌘K ────────────────────────────── */
  const filteredClients = useMemo(() => {
    const q = noAccent(clientQuery.trim());
    if (!q) return recentClients;
    return recentClients.filter((c) => noAccent(`${c.name} ${c.phone}`).includes(q));
  }, [recentClients, clientQuery]);

  /* ── Nhóm bảng giá theo list_key để danh sách gói không thành một mớ ──── */
  const packageGroups = useMemo(() => {
    const map = new Map<string, PackageOption[]>();
    for (const p of packages) {
      const key = p.list_key || "khac";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [packages]);

  function pickClient(c: RecentClient) {
    setClientName(c.name);
    setClientPhone(c.phone);
    setManualClient(false);
  }
  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  function patchInstalment(i: number, patch: Partial<Instalment>) {
    setPlan((instalments).map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
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
    await Promise.all([
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

  return (
    <div className="page-in mx-auto flex max-w-[900px] flex-col gap-3.5">
      {/* ── Thanh 5 bước ───────────────────────────────────────────────────
          Bấm được vào bước đã qua để quay lại sửa; bước chưa tới thì không. */}
      <div className={`${panel} flex items-start px-4 py-4`} style={panelStyle}>
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

      {/* ── Nội dung bước ──────────────────────────────────────────────────── */}
      <div className={`${panel} px-5 py-5`} style={panelStyle}>
        <h3 className="text-[16px] font-bold">{STEPS[step].title}</h3>
        <p className="mb-4 mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{STEPS[step].hint}</p>

        {/* ── Bước 1 · Khách hàng ─────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
              <input
                className={`${inputCls} pl-10`}
                style={inputStyle}
                placeholder="Tên hoặc số điện thoại khách…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
            </div>

            {recentClients.length > 0 && !manualClient && (
              <>
                <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Khách gần đây</p>
                <div className="grid gap-2">
                  {filteredClients.length === 0 ? (
                    <p className="py-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      Không có khách cũ nào khớp “{clientQuery}”. Nhập tay bên dưới nhé.
                    </p>
                  ) : (
                    filteredClients.map((c) => {
                      const on = clientPhone.replace(/\D/g, "") === c.phone.replace(/\D/g, "") && !!c.phone;
                      return (
                        <button
                          key={`${c.phone}-${c.name}`}
                          type="button"
                          onClick={() => pickClient(c)}
                          className="flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-left"
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

            {manualClient || recentClients.length === 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-name">Tên khách hàng</label>
                  <input id="nc-name" className={inputCls} style={inputStyle} value={clientName} onChange={(e) => setClientName(e.target.value)} />
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
            ) : (
              <button
                type="button"
                onClick={() => { setManualClient(true); setClientName(""); setClientPhone(""); }}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-3 text-[12.5px] font-semibold"
                style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
              >
                <UserPlus size={16} /> Khách mới — nhập thông tin thủ công
              </button>
            )}

            {clientPhone && !phoneOk && (
              <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--rd)" }}>
                SĐT phải đủ 10 số — khách dùng chính số này làm mật khẩu mở cổng hợp đồng.
              </p>
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
                  <select id="nc-svc" className={inputCls} style={inputStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
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
                  để chọn nhanh ở đây — hoặc dùng mẫu hợp đồng, hoặc thêm hạng mục sau khi tạo.
                </p>
              </div>
            ) : (
              <>
                <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Gói chính</p>
                <div className="grid gap-2">
                  {packageGroups.map(([key, list]) => (
                    <div key={key} className="grid gap-2">
                      {packageGroups.length > 1 && (
                        <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>{key}</p>
                      )}
                      {list.map((p) => {
                        const on = mainPkgId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setMainPkgId(on ? "" : p.id); setExtraIds((prev) => prev.filter((x) => x !== p.id)); }}
                            className="flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-left"
                            style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                          >
                            <Package size={19} style={{ flex: "none", color: on ? "var(--ac)" : "var(--tx3)" }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                              <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                                {[p.category, p.description, p.unit].filter(Boolean).join(" · ") || "Gói trong bảng giá"}
                              </span>
                            </span>
                            <strong className="tnum flex-none whitespace-nowrap text-[13.5px]">{vnd(p.price)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <p className={`mb-2 mt-[18px] ${eyebrow}`} style={eyebrowStyle}>Hạng mục thêm</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {packages.filter((p) => p.id !== mainPkgId).map((x) => {
                    const on = extraIds.includes(x.id);
                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => toggleExtra(x.id)}
                        className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-left"
                        style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                      >
                        {on ? <Check size={18} style={{ flex: "none", color: "var(--ac)" }} /> : <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{x.name}</span>
                        <strong className="tnum flex-none whitespace-nowrap text-[12.5px]">{vnd(x.price)}</strong>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

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
                  <Link href="/dashboard/studio/crew" className="font-semibold underline" style={{ color: "var(--ac)" }}>Đội ngũ</Link>{" "}
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
                [1, "Gói chính", mainPkg ? `${mainPkg.name} · ${vnd(mainPkg.price)}` : template ? `Mẫu: ${template.name}` : "Chưa chọn"],
                [1, "Hạng mục thêm", extras.length ? extras.map((x) => x.name).join(", ") : "Không có"],
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

      {/* ── Thanh hành động ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/dashboard/studio/contracts" className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ color: "var(--tx3)" }}>
          Huỷ
        </Link>
        <button
          type="button"
          onClick={() => create("draft")}
          disabled={!!saving || !phoneOk}
          className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
        </button>

        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="ml-auto flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className={`flex items-center gap-1.5 rounded-[10px] px-5 py-2.5 text-[13px] font-bold disabled:opacity-50 ${step === 0 ? "ml-auto" : ""}`}
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
            className="flex items-center gap-1.5 rounded-[10px] px-5 py-2.5 text-[13px] font-bold disabled:opacity-50"
            style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 2px 8px color-mix(in srgb, var(--ac) 30%, transparent)" }}
          >
            <Send size={17} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách ký"}
          </button>
        )}
      </div>
    </div>
  );
}
