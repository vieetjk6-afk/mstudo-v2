"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DateInput from "@/components/DateInput";
import { fmtDate, fmtDateLunar, todayVN } from "@/lib/date";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  Link as LinkIcon,
  PenLine,
  CalendarClock,
  Star,
  FileText,
  Upload,
  X,
  Image as ImageIcon,
  Gift,
  ChevronDown,
  ClipboardList,
  MapPin,
  Tag,
  Phone,
  MessageCircle,
  UserRound,
  Wallet,
  Send,
  UserPlus,
  Printer,
} from "lucide-react";
import { avatarStyle, avatarColor, initials } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import { mainUrl, studioUrl } from "@/lib/hosts";
import MessengerButton from "@/components/MessengerButton";
import ContractStepper, { type ContractLifecycle } from "@/components/studio/ContractStepper";
import ZaloSendButton from "@/components/ZaloSendButton";
import EmailButton from "@/components/EmailButton";
import WeddingInvitationCard from "./WeddingInvitationCard";
import LoveStoryCard from "./LoveStoryCard";
import CalendarButtons from "@/components/CalendarButtons";
import SignaturePad from "@/components/SignaturePad";
import MoneyInput from "@/components/MoneyInput";
import VietQRButton, { type BankInfo } from "@/components/VietQR";
import { PRESET_ITEMS, PRESET_TASKS, nextContractCode } from "@/lib/contract-code";
import { shootReminderMessage } from "@/lib/zalo";
import { compressImage, checkImageFile } from "@/lib/image";
import {
  contractTotal,
  vnd,
  sumAmounts,
  SHOOT_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  CREW_ROLE_LABEL,
  CREW_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  LEAD_SOURCE_LABEL,
  intakeIsWedding,
  type StudioContract,
  type ContractItem,
  type ContractCrew,
  type ContractEditRequest,
  type ContractPayment,
  type ContractTask,
  type ContractPaymentPlan,
  type ContractProduct,
  type ContractQuoteOption,
  type ProductStatus,
  PRODUCT_STATUS_LABEL,
  type StudioCrew,
  type StudioEvent,
  type StudioExpense,
  type ShootType,
  type ContractStatus,
  type CrewRole,
  type CrewStatus,
} from "@/lib/types";
import { CREW_TASK_LABEL, CREW_SIDE_LABEL, CREW_TASKS, CREW_SIDES } from "@/lib/crew-show";
import TimeInput from "@/components/TimeInput";

// unit_price giữ ĐỘ LỚN (số dương khách nhập); is_discount đánh dấu đây là dòng
// giảm giá — khi lưu sẽ ghi unit_price ÂM để trừ vào tổng (không cần cột DB mới).
type ItemRow = { id?: string; name: string; qty: number; unit_price: number; is_discount?: boolean };

/* ── Tab của màn chi tiết (bản thiết kế) ────────────────────────────────────
   Bản thiết kế xếp mọi thứ của một hợp đồng vào một thẻ có thanh tab, thay vì
   một cột dài. Thứ tự tab đi theo trình tự làm việc thật: xem thông tin → chốt
   hạng mục → thu tiền → phân công → giao sản phẩm → gửi khách ký. */
const DETAIL_TABS = [
  ["info", "Thông tin"],
  ["items", "Hạng mục"],
  ["pay", "Thanh toán"],
  ["crew", "Nhân sự"],
  ["album", "Album & sản phẩm"],
  ["send", "Gửi khách & ký"],
] as const;
type DetailTab = (typeof DETAIL_TABS)[number][0];

/** Quy đổi hạng mục sang giá trị CÓ DẤU để tính tổng (giảm giá = âm). */
function signedItems(items: ItemRow[]): { qty: number; unit_price: number }[] {
  return items.map((i) => ({
    qty: i.is_discount ? 1 : i.qty || 0,
    unit_price: (i.is_discount ? -1 : 1) * Math.abs(i.unit_price || 0),
  }));
}

/** Chuẩn hoá hạng mục để lưu DB: giảm giá lưu unit_price âm, còn lại dương. */
function serializeItems(items: ItemRow[]): { name: string; qty: number; unit_price: number }[] {
  return items
    .map((i) => {
      const mag = Math.max(0, Math.round(Number(i.unit_price) || 0));
      return {
        name: i.name.trim(),
        qty: i.is_discount ? 1 : Math.max(0, Math.round(Number(i.qty) || 0)),
        unit_price: i.is_discount ? -mag : mag,
      };
    })
    .filter((i) => i.name);
}
type TimeTrace = { name: string; sent: string; norm: string; db: string };

type CrewRow = {
  id?: string;
  name: string;
  phone: string;
  role: CrewRole;
  salary: number;
  note: string;
  status?: string;
  paid?: boolean;
  /** Thông tin show studio gán — thợ thấy đúng thế trên lịch và trong tin Zalo. */
  task?: string;
  side?: string;
  start?: string;
  end?: string;
};

/** Một nguồn duy nhất để đổi dòng contract_crew → CrewRow. */
function toCrewRow(c: {
  id?: string; name: string; phone: string | null; role: CrewRole; salary: number;
  note: string | null; status?: string; paid?: boolean;
  task?: string | null; side?: string | null; start_time?: string | null; end_time?: string | null;
}): CrewRow {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    role: c.role,
    salary: c.salary,
    note: c.note ?? "",
    status: c.status,
    paid: c.paid,
    task: c.task ?? "",
    side: c.side ?? "",
    start: (c.start_time ?? "").slice(0, 5),
    end: (c.end_time ?? "").slice(0, 5),
  };
}

const CREW_STATUS_TONE: Record<string, string> = {
  pending: "var(--text3)",
  accepted: "var(--s-green)",
  declined: "var(--s-red)",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ContractEditor({
  contract,
  studioHost = null,
  initialItems,
  initialCrew,
  crewPortalUrl = "",
  initialRequests,
  initialPayments,
  roster,
  galleries,
  selectionAlbums,
  initialMilestones,
  studioName,
  conflictByPhone,
  initialTasks,
  initialExpenses,
  initialPlan,
  initialProducts,
  initialQuoteOptions,
  staffList,
  canAssign,
  bank,
  sameDayContracts,
  pricelist,
  initialClientProofs,
  services = [],
  storyComingSoon = false,
  initialTab = "info",
}: {
  contract: StudioContract;
  studioHost?: string | null;
  storyComingSoon?: boolean;
  initialItems: ContractItem[];
  initialCrew: ContractCrew[];
  /** Cổng thợ của studio — nhét vào tin nhắn gửi thợ. */
  crewPortalUrl?: string;
  initialRequests: ContractEditRequest[];
  initialPayments: ContractPayment[];
  roster: StudioCrew[];
  galleries: { id: string; title: string; slug: string }[];
  selectionAlbums: { id: string; title: string; slug: string }[];
  initialMilestones: StudioEvent[];
  studioName: string;
  conflictByPhone: Record<string, string>;
  initialTasks: ContractTask[];
  initialExpenses: StudioExpense[];
  initialPlan: ContractPaymentPlan[];
  initialProducts: ContractProduct[];
  initialQuoteOptions: ContractQuoteOption[];
  staffList: { id: string; full_name: string | null; email: string }[];
  canAssign: boolean;
  bank: BankInfo;
  sameDayContracts: { id: string; title: string; client_name: string | null }[];
  pricelist: { name: string; price: number; unit: string | null }[];
  initialClientProofs: { id: string; url: string; note: string | null; uploaded_at: string; plan_id: string | null }[];
  services?: { id: string; name: string; clauses: string }[];
  /** Tab mở sẵn (?tab=…) — màn tạo hợp đồng nhảy thẳng vào "send" sau khi tạo. */
  initialTab?: string;
}) {
  const conflictFor = (phone: string) => conflictByPhone[(phone || "").replace(/\D/g, "")] || null;
  const router = useRouter();
  const supabase = createClient();

  const [f, setF] = useState({
    title: contract.title,
    code: contract.code ?? "",
    client_name: contract.client_name ?? "",
    client_phone: contract.client_phone ?? "",
    client_email: contract.client_email ?? "",
    shoot_type: contract.shoot_type as ShootType,
    service_id: contract.service_id ?? "",
    status: contract.status as ContractStatus,
    event_date: contract.event_date ?? "",
    event_time: contract.event_time ?? "",
    location: contract.location ?? "",
    note: contract.note ?? "",
    gallery_album_id: contract.gallery_album_id ?? "",
    delivery_due: contract.delivery_due ?? "",
    client_messenger: contract.client_messenger ?? "",
    selection_album_id: contract.selection_album_id ?? "",
    source: contract.source ?? "",
    assigned_to: contract.assigned_to ?? "",
  });
  const contractSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contractSaved, setContractSaved] = useState<"idle" | "saving" | "saved">("idle");

  // Tab của cột trái (bản thiết kế màn "Chi tiết hợp đồng"). Cả trang trước đây
  // là một cột dài ~10 thẻ; gom vào tab để mỗi lần chỉ thấy đúng việc đang làm.
  const [tab, setTab] = useState<DetailTab>(
    DETAIL_TABS.some(([k]) => k === initialTab) ? (initialTab as DetailTab) : "info"
  );

  async function autosaveContract(data: typeof f) {
    setContractSaved("saving");
    const { error } = await supabase
      .from("studio_contracts")
      .update({
        title: data.title.trim() || "Hợp đồng",
        code: data.code.trim() || null,
        client_name: data.client_name.trim() || null,
        client_phone: data.client_phone.replace(/\D/g, "") || null,
        client_email: data.client_email.trim() || null,
        shoot_type: data.shoot_type,
        service_id: data.service_id || null,
        status: data.status,
        event_date: data.event_date || null,
        event_time: data.event_time.trim() || null,
        location: data.location.trim() || null,
        note: data.note.trim() || null,
        gallery_album_id: data.gallery_album_id || null,
        delivery_due: data.delivery_due || null,
        client_messenger: data.client_messenger.trim() || null,
        selection_album_id: data.selection_album_id || null,
        source: data.source || null,
        ...(canAssign ? { assigned_to: data.assigned_to || null } : {}),
      })
      .eq("id", contract.id);
    if (error) {
      setContractSaved("idle");
      toast(`Lỗi lưu: ${error.message}`);
      return;
    }
    setContractSaved("saved");
    setTimeout(() => setContractSaved("idle"), 1500);
    // Sync to Google Calendar if a shoot date is set (fire-and-forget).
    if (data.event_date) {
      // Không còn fire-and-forget: đồng bộ trượt thì phải nói, nếu không studio
      // đinh ninh lịch đã lên Google trong khi chẳng có gì cả.
      fetch("/api/gcal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contract", id: contract.id, action: "upsert" }),
      })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as { synced?: boolean; reason?: string };
          if (!r.ok || j.synced === false) toast(`Chưa lên Google Lịch: ${j.reason ?? "lỗi không rõ"}`);
        })
        .catch((e) => toast(`Chưa lên Google Lịch: ${(e as Error)?.message || e}`));
    }
  }

  const set = (k: keyof typeof f, v: string | number) =>
    setF((p) => {
      const next = { ...p, [k]: v } as typeof p;
      if (contractSaveTimer.current) clearTimeout(contractSaveTimer.current);
      contractSaveTimer.current = setTimeout(() => autosaveContract(next), 700);
      return next;
    });

  const [items, setItems] = useState<ItemRow[]>(
    initialItems.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit_price: Math.abs(i.unit_price), is_discount: i.unit_price < 0 }))
  );
  // Phải map ĐÚNG BẰNG refetchCrew. Thiếu trường nào ở đây thì sau khi tải lại
  // trang ô đó trắng, và lần lưu kế tiếp ghi đè trắng lên giá trị đã lưu —
  // trông y như "bấm lưu không ăn".
  const [crew, setCrew] = useState<CrewRow[]>(initialCrew.map(toCrewRow));
  // Kết quả truy vết lần lưu nhân sự gần nhất — hiện cố định dưới nút Lưu.
  const [crewDebug, setCrewDebug] = useState<string | null>(null);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  /** Tạo cây thư mục Drive cho hợp đồng này (idempotent — bấm lại không tạo trùng). */
  async function makeDriveFolder() {
    setDriveBusy(true);
    setDriveMsg(null);
    try {
      const r = await fetch("/api/studio/contract-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; path?: string; error?: string };
      setDriveMsg(r.ok && j.url ? `Đã tạo: ${j.path} — ${j.url}` : `Không tạo được: ${j.error ?? "lỗi không rõ"}`);
    } catch (e) {
      setDriveMsg(`Không tạo được: ${(e as Error)?.message || e}`);
    } finally {
      setDriveBusy(false);
    }
  }
  const [requests, setRequests] = useState<ContractEditRequest[]>(initialRequests);
  const [payments, setPayments] = useState<ContractPayment[]>(initialPayments);
  const [milestones, setMilestones] = useState<StudioEvent[]>(initialMilestones);
  const [tasks, setTasks] = useState<ContractTask[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [expenses, setExpenses] = useState<StudioExpense[]>(initialExpenses);
  const [exp, setExp] = useState({ title: "", amount: 0, spent_at: today(), client_visible: true });
  const [plan, setPlan] = useState<ContractPaymentPlan[]>(initialPlan);
  const [planForm, setPlanForm] = useState({ label: "", amount: 0, due_date: "" });
  const planSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function autosavePlan(id: string, patch: Partial<ContractPaymentPlan>) {
    setPlan((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    clearTimeout(planSaveTimers.current[id]);
    planSaveTimers.current[id] = setTimeout(async () => {
      await supabase.from("contract_payment_plan").update(patch).eq("id", id);
    }, 600);
  }
  const [clientProofs, setClientProofs] = useState(initialClientProofs);
  const [planProof, setPlanProof] = useState<string>(""); // proof image for the next instalment
  const [proofBusy, setProofBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null); // zoomed transfer-proof image
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  const [products, setProducts] = useState<ContractProduct[]>(initialProducts);
  const [prodForm, setProdForm] = useState({ name: "", qty: 1, cost: 0 });
  const [quoteOptions, setQuoteOptions] = useState<ContractQuoteOption[]>(initialQuoteOptions);
  const [optForm, setOptForm] = useState({ name: "", price: 0, description: "" });

  // new milestone form
  const [ms, setMs] = useState({ title: "", event_date: "", event_time: "" });
  // studio signature
  const [studioSignName, setStudioSignName] = useState(contract.studio_signed_name ?? "");
  const [studioSignature, setStudioSignature] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toast(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  }

  const total = contractTotal(signedItems(items));
  const collected = sumAmounts(payments);
  const balance = total - collected;

  // Default deposit = 25% of contract total, rounded to nearest 500k (min 500k).
  const depositOf = (t: number) => (t > 0 ? Math.max(500_000, Math.round((t * 0.25) / 500_000) * 500_000) : 0);
  const depositAmt = depositOf(total);
  const creatingDeposit = useRef(false);
  const prevTotal = useRef(total);

  // Auto-create the default "Cọc hợp đồng" instalment once the contract has a value.
  useEffect(() => {
    if (total <= 0 || plan.length > 0 || creatingDeposit.current) return;
    creatingDeposit.current = true;
    (async () => {
      const { data } = await supabase
        .from("contract_payment_plan")
        .insert({ contract_id: contract.id, label: "Cọc hợp đồng", amount: depositAmt, position: 0 })
        .select("*")
        .single();
      if (data) setPlan((p) => (p.length === 0 ? [data as ContractPaymentPlan] : p));
      creatingDeposit.current = false;
    })();
  }, [total, plan.length, depositAmt, contract.id, supabase]);

  // Keep the deposit synced to the item total — until studio edits it or marks it paid.
  useEffect(() => {
    if (prevTotal.current === total) return;
    const oldDeposit = depositOf(prevTotal.current);
    prevTotal.current = total;
    const dep = plan.find((p) => p.label === "Cọc hợp đồng" && !p.paid);
    if (dep && dep.amount === oldDeposit && dep.amount !== depositAmt) {
      setPlan((p) => p.map((x) => (x.id === dep.id ? { ...x, amount: depositAmt } : x)));
      supabase.from("contract_payment_plan").update({ amount: depositAmt }).eq("id", dep.id);
    }
  }, [total, plan, depositAmt, supabase]);
  const payroll = crew.reduce((s, c) => s + (Number(c.salary) || 0), 0);
  const paidPayroll = crew.filter((c) => c.paid).reduce((s, c) => s + (Number(c.salary) || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const productCost = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.qty) || 1), 0);
  const profit = total - payroll - expenseTotal - productCost;
  const qrInfo = (contract.code || contract.title || "").slice(0, 25);
  // Client portal runs on the studio's own subdomain once its site is published,
  // otherwise on the main host.
  const shareUrl = studioUrl(studioHost, `/c/${contract.client_token}`);
  // Một nội dung tin duy nhất cho cả thẻ tóm tắt (điện thoại) và khối "Gửi khách
  // & ký" (desktop) — hai chỗ gửi cùng một link thì không được lệch câu chữ.
  const clientPortalMsg = `Xin chào ${f.client_name || "anh/chị"}, đây là hợp đồng dịch vụ của bên em. Anh/chị xem & xác nhận tại: ${shareUrl} (mật khẩu là SĐT của anh/chị). Cảm ơn ạ!`;

  // Required fields — flagged red until valid. Phone must be 10 digits.
  const phoneOk = /^\d{10}$/.test(f.client_phone.replace(/\D/g, ""));
  const reqMissing = {
    title: !f.title.trim(),
    code: !f.code.trim(),
    client_name: !f.client_name.trim(),
    client_phone: !phoneOk,
  };
  const studioSigned = !!contract.studio_signed_at || !!(studioSignName.trim() && studioSignature);
  const redIf = (bad: boolean) => (bad ? { borderColor: "var(--s-red)" } : undefined);

  async function fillCode() {
    if (f.code.trim()) return;
    const code = await nextContractCode(supabase, contract.owner_id);
    set("code", code);
  }

  // Quick status switch — persists immediately without the full-save gate
  // (signature + required fields). Lets the studio move a contract through its
  // lifecycle (Nháp → Đã gửi → … → Hoàn thành) in one click.
  async function changeStatus(status: ContractStatus) {
    if (status === f.status) return;
    set("status", status);
    // Đổi qua route server tập trung: nó đóng dấu completed_at và khi "completed"
    // sẽ tự tạo album giao khách (album chọn ảnh đã tạo lúc khách ký).
    try {
      const res = await fetch("/api/studio/contract-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(`Lỗi: ${data?.error || res.status}`); return; }
      toast(
        status === "completed" && data?.deliveryAlbum
          ? "Đã hoàn thành · đã tạo album giao khách"
          : `Trạng thái: ${CONTRACT_STATUS_LABEL[status]}`
      );
      router.refresh();
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
    }
  }

  // ── Save contract fields ───────────────────────────────────────
  // ── Items ──────────────────────────────────────────────────────
  async function saveItems() {
    setBusy("items");
    const clean = serializeItems(items);
    await supabase.from("contract_items").delete().eq("contract_id", contract.id);
    if (clean.length) {
      await supabase
        .from("contract_items")
        .insert(clean.map((i, idx) => ({ ...i, contract_id: contract.id, position: idx })));
    }
    const { data } = await supabase
      .from("contract_items")
      .select("*")
      .eq("contract_id", contract.id)
      .order("position");
    setItems((data ?? []).map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit_price: Math.abs(i.unit_price), is_discount: i.unit_price < 0 })));
    setBusy(null);
    toast("Đã lưu hạng mục.");
  }

  // ── Crew ───────────────────────────────────────────────────────
  async function refetchCrew() {
    const { data } = await supabase
      .from("contract_crew")
      .select("*")
      .eq("contract_id", contract.id)
      .order("position");
    setCrew((data ?? []).map(toCrewRow));
  }

  async function saveCrew() {
    setBusy("crew");
    setCrewDebug(null);
    // Bọc try/finally: trước đây fetch ném lỗi là nút kẹt vĩnh viễn ở "Đang lưu…"
    // và KHÔNG hiện gì cả — người dùng không biết đã hỏng hay đang chạy.
    try {
      // Qua route server chứ không ghi thẳng: mỗi lần lưu còn kéo theo ghi mốc
      // vào LỊCH CỦA THỢ (bảng chỉ mở policy đọc, ghi phải qua service role) và
      // gửi Zalo báo thợ — hai việc client không làm được.
      const res = await fetch("/api/studio/contract-crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id, crew }),
      });
      const raw = await res.text();
      let j: { notified?: number; error?: string; timeTrace?: TimeTrace[] } = {};
      try { j = JSON.parse(raw); } catch { /* không phải JSON — giữ nguyên raw để hiện */ }

      if (!res.ok) {
        setCrewDebug(`Lưu thất bại (HTTP ${res.status}): ${j.error ?? raw.slice(0, 300)}`);
        return;
      }

      await refetchCrew();

      // Bảng CỐ ĐỊNH thay vì toast 2,2 giây: dòng truy vết dài, tắt trước khi
      // đọc xong thì vô dụng.
      // Chỉ báo khi giá trị gửi lên KHÁC giá trị đọc lại từ DB — chạy đúng thì
      // im lặng, hỏng thì vẫn bắt được ngay lần đầu.
      const trace = (j.timeTrace ?? []).filter((t) => t.sent !== t.db);
      if (trace.length) {
        setCrewDebug(
          trace
            .map((t) => `${t.name}: ô nhập "${t.sent || "(trống)"}" → chuẩn hoá "${t.norm || "(trống)"}" → DB "${t.db || "(trống)"}"`)
            .join("\n"),
        );
      }
      toast(j.notified ? `Đã lưu · đã báo Zalo ${j.notified} thợ.` : "Đã lưu nhân sự & lương.");
    } catch (e) {
      setCrewDebug(`Không gọi được máy chủ: ${(e as Error)?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function togglePaid(c: CrewRow, idx: number) {
    if (!c.id) {
      toast("Lưu nhân sự trước khi đánh dấu đã trả lương.");
      return;
    }
    const next = !c.paid;
    await supabase
      .from("contract_crew")
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq("id", c.id);
    setCrew((p) => p.map((x, i) => (i === idx ? { ...x, paid: next } : x)));
  }

  async function deleteCrew(id?: string, idx?: number) {
    if (id) await supabase.from("contract_crew").delete().eq("id", id);
    setCrew((p) => p.filter((_, i) => i !== idx));
  }

  // ── Payments ───────────────────────────────────────────────────
  async function deletePayment(id: string) {
    const old = payments.find((x) => x.id === id)?.proof_url;
    await supabase.from("contract_payments").delete().eq("id", id);
    await removeProofFile(old);
    setPayments((p) => p.filter((x) => x.id !== id));
  }

  // Open a printable receipt (phiếu thu) for one payment in a new window.
  function printReceipt(p: ContractPayment) {
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
    const collectedNow = sumAmounts(payments);
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu thu</title>
<style>body{font-family:'Times New Roman',Times,serif;color:#111;max-width:560px;margin:24px auto;padding:0 24px}
h1{text-align:center;font-size:20px;margin:0}.muted{color:#555}.row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
.tot{border-top:1px solid #333;margin-top:8px;padding-top:8px;font-weight:700}.sign{margin-top:48px;text-align:center;font-size:13px}</style></head>
<body onload="window.print()">
<h1>PHIẾU THU</h1>
<p style="text-align:center" class="muted">Số: ${esc(p.id.slice(0, 8).toUpperCase())} · ${p.paid_at}</p>
<div class="row"><span>Studio (bên thu):</span><b>${esc(studioName)}</b></div>
<div class="row"><span>Khách hàng:</span><b>${esc(f.client_name || "—")}</b></div>
<div class="row"><span>Hợp đồng:</span><span>${esc(f.title)}${f.code ? " · " + esc(f.code) : ""}</span></div>
<div class="row"><span>Nội dung:</span><span>${esc(PAYMENT_KIND_LABEL[p.kind])}${p.method ? " · " + esc(p.method) : ""}</span></div>
<div class="row tot"><span>Số tiền thu</span><span>${vnd(p.amount)}</span></div>
<div class="row"><span class="muted">Tổng giá trị HĐ</span><span class="muted">${vnd(total)}</span></div>
<div class="row"><span class="muted">Đã thu luỹ kế</span><span class="muted">${vnd(collectedNow)}</span></div>
<div class="row"><span class="muted">Còn lại</span><span class="muted">${vnd(total - collectedNow)}</span></div>
<div class="sign"><b>NGƯỜI THU</b><div style="height:60px"></div><div>${esc(studioName)}</div></div>
</body></html>`;
    const w = window.open("", "_blank", "width=640,height=720");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  /**
   * Xuất PDF hợp đồng từ phía studio — mở một cửa sổ chứa bản văn bản A4 rồi
   * gọi in; hộp in của trình duyệt có sẵn "Lưu thành PDF".
   *
   * Không dùng cổng khách để in: cổng đó khoá bằng SĐT khách, còn studio nhiều
   * lúc cần bản in trước khi khách mở link. Dữ liệu lấy từ chính state đang mở
   * nên bản in luôn khớp thứ đang thấy trên màn hình.
   */
  function printContract() {
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
    const dmy = (s?: string | null) => (s ? fmtDate(s) : "—");
    const itemRows = items
      .map((it) => {
        const line = (it.is_discount ? -1 : 1) * Math.abs(it.unit_price || 0) * (it.is_discount ? 1 : it.qty || 0);
        return `<tr><td>${esc(it.name || "")}</td><td class="c">${it.is_discount ? "" : it.qty}</td>
<td class="r">${it.is_discount ? "" : vnd(Math.abs(it.unit_price))}</td><td class="r">${line < 0 ? "− " : ""}${vnd(Math.abs(line))}</td></tr>`;
      })
      .join("");
    const planRows = plan
      .map((p) => `<tr><td>${esc(p.label)}</td><td class="c">${p.due_date ? dmy(p.due_date) : "—"}</td>
<td class="c">${p.paid ? "Đã thu" : "Chưa thu"}</td><td class="r">${vnd(p.amount)}</td></tr>`)
      .join("");
    const milestoneRows = milestones
      .map((m) => `<tr><td>${esc(m.title)}</td><td class="r">${dmy(m.event_date)}${m.event_time ? ` · ${esc(m.event_time)}` : ""}</td></tr>`)
      .join("");
    const sig = (img: string | null | undefined) =>
      img ? `<img src="${img}" alt="" style="height:62px" />` : "";

    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(f.title || "Hợp đồng")}</title>
<style>
@page{size:A4;margin:16mm}
body{font-family:'Times New Roman',Times,'DejaVu Serif',serif;color:#111;max-width:720px;margin:0 auto;padding:8px 0;font-size:13px;line-height:1.5}
h1{text-align:center;font-size:22px;font-weight:700;margin:0}
h2{font-size:15px;margin:18px 0 8px}
.sub{text-align:center;font-size:13px;margin:4px 0 22px;color:#333}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;border-bottom:1px solid #333;padding:5px 0;font-size:12px}
td{padding:5px 0;border-bottom:1px solid #ddd;vertical-align:top}
.c{text-align:center;width:70px}.r{text-align:right;width:120px}
.meta td{border:none;padding:3px 0}
.tot td{border:none;padding:2px 0;text-align:right}
.tot .k{width:auto}.tot .v{width:140px;font-weight:700}
.note{white-space:pre-wrap;margin:0}
.signs{width:100%;margin-top:42px;text-align:center;font-size:13px;border:none}
.signs td{border:none;width:50%}
.box{height:70px;display:flex;align-items:center;justify-content:center}
</style></head>
<body onload="window.print()">
<h1>HỢP ĐỒNG DỊCH VỤ</h1>
<p class="sub">${esc(f.title || "")}${f.code ? ` · ${esc(f.code)}` : ""}</p>

<table class="meta"><tbody>
<tr><td style="width:150px">Bên A (Studio):</td><td><b>${esc(studioName)}</b></td></tr>
<tr><td>Bên B (Khách hàng):</td><td><b>${esc(f.client_name || "—")}</b>${f.client_phone ? ` · ĐT: ${esc(f.client_phone)}` : ""}${f.client_email ? ` · ${esc(f.client_email)}` : ""}</td></tr>
<tr><td>Dịch vụ:</td><td>${esc(services.find((s) => s.id === f.service_id)?.name || SHOOT_TYPE_LABEL[f.shoot_type])}</td></tr>
<tr><td>Ngày thực hiện:</td><td>${dmy(f.event_date)}${f.event_time ? ` · ${esc(f.event_time)}` : ""}</td></tr>
<tr><td>Địa điểm:</td><td>${esc(f.location || "—")}</td></tr>
</tbody></table>

<h2>1. Hạng mục dịch vụ</h2>
<table><thead><tr><th>Hạng mục</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead>
<tbody>${itemRows || `<tr><td colspan="4">Chưa có hạng mục.</td></tr>`}</tbody></table>
<table class="tot"><tbody>
<tr><td class="k">Tổng giá trị hợp đồng:</td><td class="v">${vnd(total)}</td></tr>
<tr><td class="k">Đã thanh toán:</td><td class="v">${vnd(collected)}</td></tr>
<tr><td class="k">Còn lại:</td><td class="v">${vnd(balance)}</td></tr>
</tbody></table>

${planRows ? `<h2>2. Kế hoạch thanh toán</h2>
<table><thead><tr><th>Đợt</th><th class="c">Hạn</th><th class="c">Tình trạng</th><th class="r">Số tiền</th></tr></thead>
<tbody>${planRows}</tbody></table>` : ""}

${milestoneRows ? `<h2>${planRows ? 3 : 2}. Lịch trình</h2>
<table><tbody>${milestoneRows}</tbody></table>` : ""}

${f.note ? `<h2>${(planRows ? 1 : 0) + (milestoneRows ? 1 : 0) + 2}. Điều khoản / Ghi chú</h2><p class="note">${esc(f.note)}</p>` : ""}

<table class="signs"><tbody><tr>
<td><b>BÊN A (STUDIO)</b><div class="box">${sig(contract.studio_signature)}</div>
<div>${esc(contract.studio_signed_name || studioName)}</div>
${contract.studio_signed_at ? `<div style="font-size:11px;color:#555">Ký ngày ${dmy(contract.studio_signed_at)}</div>` : ""}</td>
<td><b>BÊN B (KHÁCH HÀNG)</b><div class="box">${sig(contract.client_signature)}</div>
<div>${esc(contract.client_signed_name || f.client_name || "")}</div>
${contract.client_signed_at ? `<div style="font-size:11px;color:#555">Ký ngày ${dmy(contract.client_signed_at)}</div>` : ""}</td>
</tr></tbody></table>
</body></html>`;

    const w = window.open("", "_blank", "width=860,height=900");
    if (!w) {
      toast("Trình duyệt chặn cửa sổ in — cho phép pop-up rồi bấm lại.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  // ── Milestones (shared with the studio calendar via studio_events) ─────
  async function addMilestone() {
    if (!ms.event_date) {
      toast("Chọn ngày cho mốc lịch.");
      return;
    }
    setBusy("milestone");
    const { data, error } = await supabase
      .from("studio_events")
      .insert({
        owner_id: contract.owner_id,
        contract_id: contract.id,
        title: ms.title.trim() || "Mốc lịch",
        event_date: ms.event_date,
        event_time: ms.event_time.trim() || null,
        remind: true,
      })
      .select("*")
      .single();
    setBusy(null);
    if (error) {
      toast(`Lỗi: ${error.message}`);
      return;
    }
    if (data) {
      setMilestones((p) => [...p, data as StudioEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setMs({ title: "", event_date: "", event_time: "" });
    }
  }

  async function deleteMilestone(id: string) {
    await supabase.from("studio_events").delete().eq("id", id);
    setMilestones((p) => p.filter((m) => m.id !== id));
  }

  // ── Checklist ──────────────────────────────────────────────────
  async function addTaskLabel(label: string) {
    const v = label.trim();
    if (!v) return;
    const { data } = await supabase
      .from("contract_tasks")
      .insert({ contract_id: contract.id, label: v, position: tasks.length })
      .select("*")
      .single();
    if (data) setTasks((p) => [...p, data as ContractTask]);
  }
  async function addTask() {
    if (!newTask.trim()) return;
    await addTaskLabel(newTask);
    setNewTask("");
  }
  async function toggleTask(t: ContractTask) {
    setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from("contract_tasks").update({ done: !t.done }).eq("id", t.id);
  }
  async function deleteTask(id: string) {
    await supabase.from("contract_tasks").delete().eq("id", id);
    setTasks((p) => p.filter((x) => x.id !== id));
  }
  const tasksDone = tasks.filter((t) => t.done).length;

  // ── Per-contract expenses ──────────────────────────────────────
  async function addExpense() {
    const amount = Math.max(0, Math.round(Number(exp.amount) || 0));
    if (!exp.title.trim() || !amount) return;
    const { data, error } = await supabase
      .from("studio_expenses")
      .insert({ owner_id: contract.owner_id, contract_id: contract.id, title: exp.title.trim(), amount, spent_at: exp.spent_at || today(), client_visible: exp.client_visible })
      .select("*")
      .single();
    if (error) {
      toast(`Lỗi: ${error.message}`);
      return;
    }
    if (data) {
      setExpenses((p) => [data as StudioExpense, ...p]);
      setExp({ title: "", amount: 0, spent_at: today(), client_visible: true });
    }
  }
  async function deleteExpense(id: string) {
    await supabase.from("studio_expenses").delete().eq("id", id);
    setExpenses((p) => p.filter((e) => e.id !== id));
  }
  async function toggleExpenseVisible(id: string, client_visible: boolean) {
    setExpenses((p) => p.map((e) => (e.id === id ? { ...e, client_visible } : e)));
    await supabase.from("studio_expenses").update({ client_visible }).eq("id", id);
  }

  // Quick-pick amounts for the instalment form (VND).
  const QUICK_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

  // Upload a transfer-proof image to the payment-proofs bucket; returns its URL.
  async function uploadProof(file: File): Promise<string | null> {
    const check = checkImageFile(file);
    if (!check.ok) { toast(check.error); return null; }
    // Compress before upload (keep numbers legible) so stored proofs stay light.
    let upload: File = file;
    try {
      const dataUrl = await compressImage(file, { maxDim: 1600, quality: 0.85, mime: "image/webp" });
      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size > 0) upload = new File([blob], "proof.webp", { type: blob.type || "image/webp" });
    } catch { /* fall back to original */ }
    // Ưu tiên lưu vào Drive admin (fallback Supabase) qua /api/upload.
    const fd = new FormData();
    fd.append("file", upload);
    fd.append("bucket", "payment-proofs");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      toast("Tải ảnh thất bại — kiểm tra đã chạy schema.sql (bucket payment-proofs) chưa.");
      return null;
    }
    return data.url as string;
  }

  // Delete a proof image from storage to reclaim space (best-effort).
  async function removeProofFile(url: string | null | undefined) {
    if (!url) return;
    const marker = "/payment-proofs/";
    const i = url.indexOf(marker);
    if (i === -1) return;
    try { await supabase.storage.from("payment-proofs").remove([url.slice(i + marker.length)]); } catch { /* ignore */ }
  }

  async function pickPlanProof(file: File | null) {
    if (!file) return;
    setProofBusy(true);
    const url = await uploadProof(file);
    setProofBusy(false);
    if (url) setPlanProof(url);
  }

  // Attach (or replace) the transfer-proof image on an already-recorded payment.
  async function attachProof(paymentId: string, file: File | null) {
    if (!file) return;
    setProofBusy(true);
    const old = payments.find((x) => x.id === paymentId)?.proof_url;
    const url = await uploadProof(file);
    if (url) {
      await supabase.from("contract_payments").update({ proof_url: url }).eq("id", paymentId);
      if (old && old !== url) await removeProofFile(old); // reclaim the replaced image
      setPayments((p) => p.map((x) => (x.id === paymentId ? { ...x, proof_url: url } : x)));
    }
    setProofBusy(false);
  }

  // ── Payment schedule (unified: marking an instalment paid records a payment) ──
  async function addPlan(markPaid = false) {
    const amount = Math.max(0, Math.round(Number(planForm.amount) || 0));
    if (!planForm.label.trim() && !amount) return;
    const label = planForm.label.trim() || "Đợt thanh toán";
    setBusy(markPaid ? "planPaid" : "plan");
    let payment_id: string | null = null;
    if (markPaid) {
      const { data: payment } = await supabase
        .from("contract_payments")
        .insert({ contract_id: contract.id, amount, kind: "installment", paid_at: today(), note: label, ...(planProof ? { proof_url: planProof } : {}) })
        .select("*")
        .single();
      if (payment) {
        setPayments((p) => [payment as ContractPayment, ...p]);
        payment_id = (payment as ContractPayment).id;
      }
    }
    const { data } = await supabase
      .from("contract_payment_plan")
      .insert({
        contract_id: contract.id,
        label,
        amount,
        due_date: planForm.due_date || null,
        position: plan.length,
        paid: markPaid,
        paid_at: markPaid ? new Date().toISOString() : null,
        payment_id,
      })
      .select("*")
      .single();
    setBusy(null);
    if (data) {
      setPlan((p) => [...p, data as ContractPaymentPlan]);
      setPlanForm({ label: "", amount: 0, due_date: "" });
      setPlanProof("");
    }
  }
  // Mark an instalment collected → records a real payment; un-marking removes it.
  async function markPlanPaid(it: ContractPaymentPlan) {
    if (it.paid) {
      if (it.payment_id) {
        const old = payments.find((x) => x.id === it.payment_id)?.proof_url;
        await supabase.from("contract_payments").delete().eq("id", it.payment_id);
        await removeProofFile(old);
        setPayments((p) => p.filter((x) => x.id !== it.payment_id));
      }
      await supabase.from("contract_payment_plan").update({ paid: false, paid_at: null, payment_id: null }).eq("id", it.id);
      setPlan((p) => p.map((x) => (x.id === it.id ? { ...x, paid: false, paid_at: null, payment_id: null } : x)));
    } else {
      const amount = Math.max(0, Math.round(Number(it.amount) || 0));
      const nowIso = new Date().toISOString();
      const { data: payment } = await supabase
        .from("contract_payments")
        .insert({ contract_id: contract.id, amount, kind: "installment", paid_at: today(), note: it.label })
        .select("*")
        .single();
      const pid = payment ? (payment as ContractPayment).id : null;
      if (payment) setPayments((p) => [payment as ContractPayment, ...p]);
      await supabase.from("contract_payment_plan").update({ paid: true, paid_at: nowIso, payment_id: pid }).eq("id", it.id);
      setPlan((p) => p.map((x) => (x.id === it.id ? { ...x, paid: true, paid_at: nowIso, payment_id: pid } : x)));
      // Zalo: xác nhận cọc (chỉ với đợt CỌC) — tự gửi cho khách nếu studio đã bật
      // mốc "Xác nhận cọc" + đã kết nối Zalo. Fire-and-forget, không chặn UI.
      if ((it.label || "").toLowerCase().includes("cọc")) {
        fetch("/api/studio/zalo/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: contract.id, event: "deposit_confirm", amount }),
        }).catch(() => {});
      }
      // Compute updated plan
      const updatedPlan = plan.map((x) => (x.id === it.id ? { ...x, paid: true } : x));
      const stillUnpaid = updatedPlan.filter((x) => !x.paid);
      const newBalance = total - updatedPlan.reduce((s, x) => (x.paid ? s + x.amount : s), 0) - (payments.filter(p2 => !updatedPlan.some(pl => pl.payment_id === p2.id)).reduce((s, p2) => s + p2.amount, 0));
      if (stillUnpaid.length === 0 && newBalance > 0) {
        const { data: next } = await supabase
          .from("contract_payment_plan")
          .insert({ contract_id: contract.id, label: "Thanh toán toàn bộ hợp đồng", amount: newBalance, position: plan.length + 1 })
          .select("*").single();
        if (next) setPlan((p) => [...p, next as ContractPaymentPlan]);
      }
    }
  }
  async function deletePlan(it: ContractPaymentPlan) {
    if (it.payment_id) {
      const old = payments.find((x) => x.id === it.payment_id)?.proof_url;
      await supabase.from("contract_payments").delete().eq("id", it.payment_id);
      await removeProofFile(old);
      setPayments((p) => p.filter((x) => x.id !== it.payment_id));
    }
    await supabase.from("contract_payment_plan").delete().eq("id", it.id);
    setPlan((p) => p.filter((x) => x.id !== it.id));
  }
  const todayStr = today();
  // Payments not tied to a scheduled instalment (e.g. recorded before the merge).
  const orphanPayments = payments.filter((p) => !plan.some((pl) => pl.payment_id === p.id));


  // ── Print / product orders ─────────────────────────────────────
  async function addProduct() {
    if (!prodForm.name.trim()) return;
    const { data } = await supabase
      .from("contract_products")
      .insert({ contract_id: contract.id, name: prodForm.name.trim(), qty: Math.max(1, Math.round(Number(prodForm.qty) || 1)), cost: Math.max(0, Math.round(Number(prodForm.cost) || 0)), position: products.length })
      .select("*")
      .single();
    if (data) {
      setProducts((p) => [...p, data as ContractProduct]);
      setProdForm({ name: "", qty: 1, cost: 0 });
    }
  }
  async function cycleProduct(it: ContractProduct) {
    const order: ProductStatus[] = ["ordered", "in_progress", "done"];
    const next = order[(order.indexOf(it.status) + 1) % order.length];
    await supabase.from("contract_products").update({ status: next }).eq("id", it.id);
    setProducts((p) => p.map((x) => (x.id === it.id ? { ...x, status: next } : x)));
  }
  async function deleteProduct(id: string) {
    await supabase.from("contract_products").delete().eq("id", id);
    setProducts((p) => p.filter((x) => x.id !== id));
  }
  const PROD_TONE: Record<ProductStatus, string> = { ordered: "var(--text3)", in_progress: "var(--s-blue)", done: "var(--s-green)" };

  // ── Quote options ──────────────────────────────────────────────
  async function addOption() {
    if (!optForm.name.trim()) return;
    const { data } = await supabase
      .from("contract_quote_options")
      .insert({ contract_id: contract.id, name: optForm.name.trim(), price: Math.max(0, Math.round(Number(optForm.price) || 0)), description: optForm.description.trim() || null, position: quoteOptions.length })
      .select("*")
      .single();
    if (data) {
      setQuoteOptions((p) => [...p, data as ContractQuoteOption]);
      setOptForm({ name: "", price: 0, description: "" });
    }
  }
  async function deleteOption(id: string) {
    await supabase.from("contract_quote_options").delete().eq("id", id);
    setQuoteOptions((p) => p.filter((o) => o.id !== id));
  }

  // ── Studio counter-signature ───────────────────────────────────
  async function saveStudioSignature() {
    if (!studioSignName.trim()) {
      toast("Nhập tên người ký (Bên A).");
      return;
    }
    setBusy("sign");
    const { error } = await supabase
      .from("studio_contracts")
      .update({
        studio_signed_name: studioSignName.trim(),
        ...(studioSignature ? { studio_signature: studioSignature } : {}),
        studio_signed_at: new Date().toISOString(),
      })
      .eq("id", contract.id);
    setBusy(null);
    toast(error ? `Lỗi: ${error.message}` : "Đã lưu chữ ký Bên A.");
    if (!error) router.refresh();
  }

  // ── Edit requests ──────────────────────────────────────────────
  async function resolveRequest(id: string) {
    await supabase
      .from("contract_edit_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    setRequests((p) => p.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)));
  }

  async function duplicateContract() {
    setBusy("dup");
    const token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
    const { data, error } = await supabase
      .from("studio_contracts")
      .insert({
        owner_id: contract.owner_id,
        title: `${f.title} (bản sao)`,
        client_name: f.client_name.trim() || null,
        client_phone: f.client_phone.trim() || null,
        client_email: f.client_email.trim() || null,
        client_messenger: f.client_messenger.trim() || null,
        shoot_type: f.shoot_type,
        status: "draft",
        location: f.location.trim() || null,
        note: f.note.trim() || null,
        source: f.source || null,
        client_token: token,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(null);
      toast(`Lỗi: ${error?.message || "không nhân bản được"}`);
      return;
    }
    const clean = serializeItems(items);
    if (clean.length) {
      await supabase.from("contract_items").insert(clean.map((i, idx) => ({ ...i, contract_id: data.id, position: idx })));
    }
    router.push(`/dashboard/studio/contracts/${data.id}`);
  }

  async function deleteContract() {
    if (!confirm("Xoá hợp đồng này? Mọi hạng mục, nhân sự, thanh toán & yêu cầu sẽ bị xoá theo.")) return;
    setBusy("delete");
    const { error } = await supabase.from("studio_contracts").delete().eq("id", contract.id);
    if (error) {
      setBusy(null);
      toast(`Lỗi: ${error.message}`);
      return;
    }
    router.push("/dashboard/studio/contracts");
  }

  const openRequests = requests.filter((r) => r.status === "open");

  // Vòng đời 7 bước — suy ra từ dữ liệu thật, không phải cột trạng thái riêng.
  const lifecycle: ContractLifecycle = {
    hasItems: items.length > 0,
    signed: !!contract.client_signed_at,
    hasCrew: crew.length > 0,
    hasDeposit: collected > 0,
    shot:
      f.status === "in_progress" || f.status === "completed" ||
      (!!f.event_date && f.event_date < todayVN()),
    postDone:
      f.status === "completed" ||
      (products.length > 0 && products.every((x) => x.status === "done")),
    delivered: f.status === "completed" || !!f.gallery_album_id,
  };

  const statusTone = CONTRACT_STATUS_TONE[f.status];
  // Nút phụ ở đầu màn: 12.5px/600, bo 9px, viền + nền thẻ — không đổ bóng.
  // Nhân sự chưa từ chối — dùng cho rail phải và cho badge đếm trên tab.
  const activeCrew = crew.filter((c) => (c.status || "pending") !== "declined");
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const clientDigits = f.client_phone.replace(/\D/g, "");
  // Biên lợi nhuận theo bản thiết kế: <45% đỏ, 45–60% vàng, >60% xanh.
  const marginPct = total > 0 ? Math.round((profit / total) * 100) : 0;
  const marginTone =
    total <= 0 ? { fg: "var(--tx2)", soft: "var(--sf2)" }
      : marginPct < 45 ? { fg: "var(--rd)", soft: "var(--rdS)" }
      : marginPct < 60 ? { fg: "var(--am)", soft: "var(--amS)" }
      : { fg: "var(--gn)", soft: "var(--gnS)" };

  return (
    <div className="page-in">
      {msg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          {msg}
        </div>
      )}

      {/* ── Đầu màn: nút quay lại · mã HĐ · pill trạng thái · tên · hành động ──
          Đúng hàng đầu của bản thiết kế: mã hợp đồng chữ đơn cách, pill trạng
          thái chấm tròn, tên HĐ 21px/750, nhóm nút dồn về phải. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/studio/contracts"
          aria-label="Về danh sách hợp đồng"
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[11.5px] font-bold" style={{ color: "var(--tx3)", fontFamily: "ui-monospace, monospace" }}>
              {f.code || "Chưa có mã"}
            </span>
            <span
              className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold"
              style={{ background: statusTone.bg, color: statusTone.fg }}
            >
              <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: statusTone.fg }} />
              {CONTRACT_STATUS_LABEL[f.status]}
            </span>
            <span className="whitespace-nowrap text-[11.5px]" style={{ color: contractSaved === "saved" ? "var(--gn)" : "var(--tx3)" }}>
              {contractSaved === "saving" ? "Đang lưu…" : contractSaved === "saved" ? "Đã lưu" : "Tự động lưu"}
            </span>
            {!studioSigned && (
              <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: "var(--rd)" }}>Chưa có chữ ký studio</span>
            )}
          </div>
          <h1 className="mt-0.5 truncate text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>{f.title || "Hợp đồng"}</h1>
        </div>

        {/* Trên điện thoại: lưới 2 cột, nút bằng nhau. 5–6 nút với 3 cỡ khác
            nhau tự wrap thành các hàng so le, nút chính lẫn giữa đám nút phụ. */}
        <div className="ml-auto grid w-full grid-cols-2 gap-2 min-[820px]:flex min-[820px]:w-auto min-[820px]:flex-wrap">
          <button onClick={duplicateContract} disabled={busy === "dup"} className="act-btn">
            <Copy size={16} /> {busy === "dup" ? "Đang sao…" : "Tạo giống HĐ này"}
          </button>
          <button onClick={printContract} className="act-btn">
            <Printer size={16} /> Xuất PDF
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="act-btn">
            <FileText size={16} /> Xem như khách
          </a>
          <button onClick={() => setTab("pay")} className="act-btn">
            <Wallet size={16} /> Ghi nhận thanh toán
          </button>
          <button onClick={() => setTab("send")} className="act-btn act-btn-primary col-span-2 min-[820px]:col-auto">
            <Send size={16} /> Gửi khách
          </button>
          {f.status === "cancelled" && (
            <button onClick={deleteContract} disabled={busy === "delete"} className="act-btn act-btn-danger col-span-2 min-[820px]:col-auto">
              <Trash2 size={14} /> Xoá
            </button>
          )}
        </div>
      </div>

      {/* ── Tóm tắt tiền + liên hệ khách, CHỈ trên điện thoại ─────────────────
          Hai thông tin hay cần nhất khi mở một hợp đồng là "còn phải thu bao
          nhiêu" và "số điện thoại khách". Cả hai vốn nằm ở rail phải, mà rail
          chỉ hiện từ 1100px — dưới ngưỡng đó nó bị đẩy xuống tận cuối trang, phải
          cuộn qua toàn bộ form mới thấy. Khối này đưa chúng lên đầu, và ẩn đi ở
          desktop để không lặp với rail. */}
      <div className="mb-3.5 rounded-[14px] p-3.5 min-[1100px]:hidden" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px]" style={{ color: "var(--tx2)" }}>Tổng hợp đồng</span>
          <span className="tnum text-[18px] font-bold" style={{ letterSpacing: "-.4px" }}>{vnd(total)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-[4px]" style={{ background: "var(--bd2)" }}>
          <div className="h-full rounded-[4px]" style={{ width: `${pct}%`, background: "var(--gn)" }} />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12px]">
          <span style={{ color: "var(--tx2)" }}>
            Đã thu <b className="tnum" style={{ color: "var(--gn)" }}>{vnd(collected)}</b>
          </span>
          <span style={{ color: "var(--tx2)" }}>
            {balance > 0
              ? <>Còn phải thu <b className="tnum" style={{ color: "var(--am)" }}>{vnd(balance)}</b></>
              : <b style={{ color: "var(--gn)" }}>Đã thu đủ</b>}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: "1px solid var(--bd2)" }}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{f.client_name || "Chưa có tên khách"}</p>
            <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {f.client_phone || "chưa có số điện thoại"}
            </p>
          </div>
          {clientDigits.length >= 9 && (
            <a href={`tel:${clientDigits}`} className="act-btn act-btn-auto">
              <Phone size={15} /> Gọi
            </a>
          )}
        </div>

        {/* Gửi cổng khách — GỘP từ khối "Gửi khách & ký" phía dưới, cùng nội dung
            tin và cùng link, để trên điện thoại chỉ còn MỘT chỗ gửi cho khách
            thay vì hai chỗ giống nhau ở đầu và giữa trang. Khối dưới vẫn giữ cho
            desktop, nơi thẻ tóm tắt này không hiện. */}
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--bd2)" }}>
          <p className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
            Gửi cổng khách {contract.client_viewed_at ? "· khách đã xem" : "· khách chưa mở"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <MessengerButton link={f.client_messenger} label="Gửi cho khách" message={clientPortalMsg} className="act-btn" />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="act-btn"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
            </button>
            <div className="col-span-2">
              <ZaloSendButton
                phone={f.client_phone}
                name={f.client_name}
                audience="client"
                contractId={contract.id}
                kind="contract_share"
                className="act-btn act-btn-auto flex-1"
                message={clientPortalMsg}
              />
            </div>
            <div className="col-span-2">
              <EmailButton
                to={f.client_email}
                label="Gửi email"
                subject={`Hợp đồng dịch vụ — ${f.title}`}
                message={`Xin chào ${f.client_name || "anh/chị"},\n\nĐây là hợp đồng dịch vụ của bên em. Anh/chị xem & xác nhận tại:\n${shareUrl}\n(Mật khẩu mở là số điện thoại của anh/chị.)\n\nCảm ơn ạ!\n— ${studioName}`}
                className="act-btn"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vòng đời hợp đồng — thay ô chọn trạng thái ở đầu màn (bản thiết kế).
          Ô chọn vẫn nằm ngay đây để đổi trạng thái enum khi cần. */}
      <div className="mb-3.5">
        <ContractStepper
          state={lifecycle}
          right={
            <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Trạng thái
              <select
                className="input py-1.5 text-[12px]"
                style={{ width: "auto" }}
                value={f.status}
                onChange={(e) => changeStatus(e.target.value as ContractStatus)}
                data-testid="contract-status-select"
              >
                {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((k) => (
                  <option key={k} value={k}>{CONTRACT_STATUS_LABEL[k]}</option>
                ))}
              </select>
            </label>
          }
        />
      </div>

      {/* Same-day scheduling warning */}
      {sameDayContracts.length > 0 && (
        <div className="card mb-3.5 p-4" style={{ borderColor: "var(--s-amberS)", background: "var(--s-amberS)" }}>
          <p className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--s-amber)" }}>
            <CalendarClock size={16} /> Trùng ngày {f.event_date}: có {sameDayContracts.length} hợp đồng khác cùng ngày
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sameDayContracts.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/studio/contracts/${c.id}`} className="rounded-full px-3 py-1 text-xs" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  {c.title}{c.client_name ? ` · ${c.client_name}` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>Kiểm tra nhân sự để tránh trùng lịch (xem cảnh báo ⚠ ở mục Nhân sự).</p>
        </div>
      )}

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {/* Thanh tab — đầu thẻ nội dung của bản thiết kế: 13px, tab đang mở
              đậm 700 màu nhấn và có gạch chân 2px. Cuộn ngang trên màn hẹp
              thay vì bẻ dòng, để hàng tab luôn đọc được một mạch. */}
          <div role="tablist" aria-label="Nội dung hợp đồng" className="flex gap-0.5 overflow-x-auto rounded-[14px] px-3" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
            {DETAIL_TABS.map(([key, label]) => {
              const on = tab === key;
              const badge =
                key === "items" ? items.length :
                key === "crew" ? activeCrew.length :
                key === "send" ? openRequests.length : 0;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(key)}
                  className="flex flex-none items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-3 text-[13px]"
                  style={{
                    color: on ? "var(--ac)" : "var(--tx2)",
                    fontWeight: on ? 700 : 550,
                    borderBottom: `2px solid ${on ? "var(--ac)" : "transparent"}`,
                  }}
                >
                  {label}
                  {badge > 0 && (
                    <span
                      className="rounded-[20px] px-1.5 text-[10.5px] font-bold"
                      style={
                        key === "send"
                          ? { background: "var(--amS)", color: "var(--am)" }
                          : { background: on ? "var(--acS)" : "var(--sf2)", color: on ? "var(--ac)" : "var(--tx3)" }
                      }
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 space-y-3.5">
            {/* Thông tin: dữ liệu hợp đồng, brief khách gửi, lịch trình, checklist hậu kỳ */}
            {tab === "info" && (
              <>
              {/* Details */}
              <div className="card p-6">
                <h2 className="mb-4 font-serif text-lg font-medium">Thông tin hợp đồng</h2>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Tên hợp đồng <span style={{ color: "var(--s-red)" }}>*</span></label>
                      <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} style={redIf(reqMissing.title)} />
                    </div>
                    <div>
                      <label className="label">Mã hợp đồng <span style={{ color: "var(--s-red)" }}>*</span></label>
                      <div className="flex gap-2">
                        <input className="input" placeholder="HD-06-2026-001" value={f.code} onChange={(e) => set("code", e.target.value)} style={redIf(reqMissing.code)} />
                        {!f.code.trim() && <button type="button" onClick={fillCode} className="btn-ghost shrink-0 px-3 text-xs">Tạo mã</button>}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Khách hàng <span style={{ color: "var(--s-red)" }}>*</span></label>
                      <input className="input" value={f.client_name} onChange={(e) => set("client_name", e.target.value)} style={redIf(reqMissing.client_name)} />
                    </div>
                    <div>
                      <label className="label">SĐT khách <span style={{ color: "var(--s-red)" }}>*</span></label>
                      <input className="input" inputMode="numeric" maxLength={15} placeholder="0901234567" value={f.client_phone} onChange={(e) => set("client_phone", e.target.value)} style={redIf(reqMissing.client_phone)} />
                      {reqMissing.client_phone && <p className="mt-1 text-[11px]" style={{ color: "var(--s-red)" }}>Phải đủ 10 số.</p>}
                    </div>
                    <div>
                      <label className="label">Email khách</label>
                      <input className="input" value={f.client_email} onChange={(e) => set("client_email", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Link Facebook/Messenger của khách</label>
                    <input className="input" placeholder="m.me/… hoặc facebook.com/…" value={f.client_messenger} onChange={(e) => set("client_messenger", e.target.value)} />
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Khách cũng có thể tự dán link này trong cổng khách.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Loại dịch vụ</label>
                      {services.length > 0 ? (
                        <select
                          className="input"
                          value={f.service_id}
                          onChange={(e) => {
                            const svc = services.find((s) => s.id === e.target.value);
                            // Switching service: link it, force legacy type to "other",
                            // and refresh the (read-only) clauses from the service.
                            setF((p) => ({ ...p, service_id: e.target.value, shoot_type: "other", note: svc ? svc.clauses : p.note }));
                            if (contractSaveTimer.current) clearTimeout(contractSaveTimer.current);
                            const next = { ...f, service_id: e.target.value, shoot_type: "other" as ShootType, note: svc ? svc.clauses : f.note };
                            autosaveContract(next);
                          }}
                        >
                          <option value="">Khác</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input className="input" value="Khác" disabled />
                      )}
                    </div>
                    <div>
                      <label className="label">Ngày</label>
                      <DateInput value={f.event_date} onChange={(v) => set("event_date", v)} />
                    </div>
                    <div>
                      <label className="label">Giờ</label>
                      <input className="input" placeholder="08:00" value={f.event_time} onChange={(e) => set("event_time", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Địa điểm</label>
                      <input className="input" value={f.location} onChange={(e) => set("location", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Trạng thái</label>
                      <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                        {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((k) => (
                          <option key={k} value={k}>{CONTRACT_STATUS_LABEL[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Nguồn khách</label>
                      <select className="input" value={f.source} onChange={(e) => set("source", e.target.value)}>
                        <option value="">— Chưa rõ —</option>
                        {Object.keys(LEAD_SOURCE_LABEL).map((k) => (
                          <option key={k} value={k}>{LEAD_SOURCE_LABEL[k]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Hạn giao ảnh</label>
                    <DateInput value={f.delivery_due} onChange={(v) => set("delivery_due", v)} />
                  </div>
                  {canAssign && staffList.length > 0 && (
                    <div>
                      <label className="label">Giao cho nhân viên</label>
                      <select className="input" value={f.assigned_to} onChange={(e) => set("assigned_to", e.target.value)}>
                        <option value="">— Chưa giao —</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Nhân viên (vai trò Nhân viên) chỉ thấy hợp đồng được giao cho mình.</p>
                    </div>
                  )}
            
                  <div>
                    <label className="label">Album khách hàng (Album chọn ảnh hoặc album hoàn thiện gửi khách hàng)</label>
                    <select className="input" value={f.selection_album_id} onChange={(e) => set("selection_album_id", e.target.value)}>
                      <option value="">— Chưa gắn —</option>
                      {selectionAlbums.map((a) => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                    {selectionAlbums.length === 0 ? (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                        Chưa có album chọn ảnh. Tạo album ở “Tạo album” rồi quay lại gắn.
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                        Mẹo: nếu dùng Dự án hợp nhất, chỉ cần gắn ô này — link sẽ tự chuyển sang ảnh giao khách khi bạn đổi giai đoạn.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Điều khoản hợp đồng</label>
                    <textarea className="input min-h-[120px]" value={f.note} readOnly style={{ opacity: 0.85, cursor: "default" }} />
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                      Điều khoản cố định theo dịch vụ — không sửa ở đây.{" "}
                      <Link href="/dashboard/studio/services" className="hover:underline" style={{ color: "var(--brand, var(--accent))" }}>Sửa trong Dịch vụ &amp; điều khoản</Link>
                    </p>
                  </div>
                  <p className="flex items-center gap-1 text-xs" style={{ color: contractSaved === "saved" ? "var(--s-green)" : "var(--text3)" }}>
                    {contractSaved === "saving" ? "Đang lưu…" : contractSaved === "saved" ? <><Check size={13} /> Đã lưu tự động</> : "Thông tin tự động lưu khi nhập"}
                  </p>
                </div>
              </div>

              {/* Client brief */}
              {contract.brief_submitted_at && (
                <div className="card p-5" style={{ borderColor: "var(--s-blueS)" }}>
                  <h2 className="mb-2 flex items-center gap-2 font-serif text-lg font-medium" style={{ color: "var(--s-blue)" }}>
                    <FileText size={18} /> Brief từ khách
                  </h2>
                  <dl className="space-y-1.5 text-sm">
                    {contract.brief_concept && <div><dt className="inline" style={{ color: "var(--text3)" }}>Concept: </dt><dd className="inline">{contract.brief_concept}</dd></div>}
                    {contract.brief_outfit && <div><dt className="inline" style={{ color: "var(--text3)" }}>Trang phục/người: </dt><dd className="inline">{contract.brief_outfit}</dd></div>}
                    {contract.brief_refs && <div><dt className="inline" style={{ color: "var(--text3)" }}>Tham khảo: </dt><dd className="inline break-all">{contract.brief_refs}</dd></div>}
                    {contract.brief_note && <div><dt className="inline" style={{ color: "var(--text3)" }}>Khác: </dt><dd className="inline">{contract.brief_note}</dd></div>}
                  </dl>
                  <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>Gửi lúc {new Date(contract.brief_submitted_at).toLocaleString("vi-VN")}</p>
                </div>
              )}
              {/* Milestones / schedule */}
              <div className="card p-6">
                <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
                  <CalendarClock size={18} /> Lịch &amp; mốc thời gian
                </h2>
                <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
                  Thêm các mốc (vd: chụp pre-wedding, ngày cưới, trao ảnh). Mốc cũng hiện trên Lịch &amp; cổng khách.
                </p>
                {f.event_date && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                    <span className="text-sm">Buổi chính · {fmtDateLunar(f.event_date)}{f.event_time ? ` · ${f.event_time}` : ""}</span>
                    <CalendarButtons compact event={{ date: f.event_date, time: f.event_time, title: f.title, location: f.location }} />
                  </div>
                )}
                {milestones.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có mốc nào.</p>
                ) : (
                  <ul className="space-y-2">
                    {milestones.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                        <div>
                          <p className="text-sm font-medium">{m.title}</p>
                          <p className="text-[11px]" style={{ color: "var(--text3)" }}>{fmtDate(m.event_date)}{m.event_time ? ` · ${m.event_time}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <CalendarButtons compact event={{ date: m.event_date, time: m.event_time, title: m.title, location: f.location }} />
                          <button onClick={() => deleteMilestone(m.id)} style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-12" style={{ borderColor: "var(--border)" }}>
                  <input className="input sm:col-span-6" placeholder="Tên mốc (vd: Ngày cưới)" value={ms.title} onChange={(e) => setMs((p) => ({ ...p, title: e.target.value }))} />
                  <DateInput wrapperClassName="sm:col-span-4" value={ms.event_date} onChange={(v) => setMs((p) => ({ ...p, event_date: v }))} />
                  <input className="input sm:col-span-2" placeholder="08:00" value={ms.event_time} onChange={(e) => setMs((p) => ({ ...p, event_time: e.target.value }))} />
                </div>
                <button onClick={addMilestone} disabled={busy === "milestone"} className="btn-ghost mt-3">
                  <Plus size={15} /> {busy === "milestone" ? "Đang thêm…" : "Thêm mốc lịch"}
                </button>
              </div>

              {/* Checklist */}
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-lg font-medium">Checklist công việc</h2>
                  {tasks.length > 0 && (
                    <span className="text-xs" style={{ color: tasksDone === tasks.length ? "var(--s-green)" : "var(--text3)" }}>
                      {tasksDone}/{tasks.length} xong
                    </span>
                  )}
                </div>
                {tasks.length > 0 && (
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(tasksDone / tasks.length) * 100}%`, background: "var(--s-green)" }} />
                  </div>
                )}
                {tasks.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có việc nào. Vd: đặt cọc, chụp, chọn ảnh, retouch, in album, giao.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5">
                        <button onClick={() => toggleTask(t)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ border: "1px solid var(--border2)", background: t.done ? "var(--s-green)" : "transparent" }}>
                          {t.done && <Check size={13} color="#0c0c0c" />}
                        </button>
                        <span className="flex-1 text-sm" style={{ color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
                        <button onClick={() => deleteTask(t.id)} style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    placeholder="Thêm việc…"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                  />
                  <button onClick={addTask} className="btn-ghost shrink-0"><Plus size={15} /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_TASKS.filter((label) => !tasks.some((t) => t.label === label)).map((label) => (
                    <button key={label} type="button" onClick={() => addTaskLabel(label)} className="rounded-full px-2.5 py-1 text-xs" style={{ border: "1px dashed var(--border2)", color: "var(--text3)" }}>
                      + {label}
                    </button>
                  ))}
                </div>
              </div>

              </>
            )}

            {/* Hạng mục: bảng dịch vụ và tổng giá trị hợp đồng */}
            {tab === "items" && (
              <>
              {/* Items */}
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-serif text-lg font-medium">Hạng mục &amp; báo giá</h2>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setItems((p) => [...p, { name: "", qty: 1, unit_price: 0 }])} className="btn-ghost px-2.5 py-1.5 text-xs">
                      <Plus size={14} /> Thêm hạng mục
                    </button>
                    <button onClick={() => setItems((p) => [...p, { name: "Giảm giá", qty: 1, unit_price: 0, is_discount: true }])} className="btn-ghost px-2.5 py-1.5 text-xs" style={{ color: "var(--s-amber)" }}>
                      <Tag size={14} /> Thêm giảm giá
                    </button>
                  </div>
                </div>
                {(pricelist.length > 0 || PRESET_ITEMS.length > 0) && (
                  <div className="mb-4">
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>Thêm nhanh</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pricelist.map((p, i) => (
                        <button key={`pl${i}`} type="button" onClick={() => setItems((prev) => [...prev, { name: p.name, qty: 1, unit_price: p.price }])} className="rounded-full px-2.5 py-1 text-xs" style={{ border: "1px solid var(--border2)", color: "var(--text2)" }}>
                          + {p.name} · {vnd(p.price)}
                        </button>
                      ))}
                      {PRESET_ITEMS.map((name) => (
                        <button key={name} type="button" onClick={() => setItems((prev) => [...prev, { name, qty: 1, unit_price: 0 }])} className="rounded-full px-2.5 py-1 text-xs" style={{ border: "1px dashed var(--border2)", color: "var(--text3)" }}>
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {items.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có hạng mục. Bấm “Thêm hạng mục”.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] uppercase tracking-wide sm:grid" style={{ color: "var(--text3)" }}>
                      <span className="col-span-6">Hạng mục</span>
                      <span className="col-span-2 text-center">SL</span>
                      <span className="col-span-3 text-right">Đơn giá</span>
                      <span className="col-span-1" />
                    </div>
                    {items.map((it, idx) =>
                      it.is_discount ? (
                        <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-lg p-1.5" style={{ background: "var(--s-amberS)" }}>
                          <input className="input col-span-12 sm:col-span-6" placeholder="Tên khoản giảm giá" value={it.name}
                            onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                          <span className="col-span-3 hidden text-center text-xs sm:col-span-2 sm:inline" style={{ color: "var(--s-amber)" }}>
                            <Tag size={12} className="inline" /> Giảm
                          </span>
                          <MoneyInput className="input col-span-7 text-right sm:col-span-3" value={it.unit_price}
                            onChange={(n) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: n } : x)))} />
                          <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="col-span-2 flex justify-center sm:col-span-1" style={{ color: "var(--text3)" }} aria-label="Xoá">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <div key={idx} className="grid grid-cols-12 items-center gap-2">
                          <input className="input col-span-12 sm:col-span-6" placeholder="VD: Chụp phóng sự cả ngày" value={it.name}
                            onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                          <input type="number" className="input col-span-3 text-center sm:col-span-2" value={it.qty}
                            onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))} />
                          <MoneyInput className="input col-span-7 text-right sm:col-span-3" value={it.unit_price}
                            onChange={(n) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: n } : x)))} />
                          <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="col-span-2 flex justify-center sm:col-span-1" style={{ color: "var(--text3)" }} aria-label="Xoá">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text2)" }}>Tổng giá trị hợp đồng</span>
                  <span className="font-serif text-xl font-medium">{vnd(total)}</span>
                </div>
                <button onClick={saveItems} disabled={busy === "items"} className="btn-primary mt-4">
                  {busy === "items" ? "Đang lưu…" : "Lưu hạng mục"}
                </button>
              </div>

              </>
            )}

            {/* Thanh toán: kế hoạch thu, lịch sử thu và chi phí phát sinh */}
            {tab === "pay" && (
              <>
              {/* Payments — unified schedule + collection */}
              <div className="card p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-serif text-lg font-medium">Thanh toán</h2>
                  <p className="text-xs" style={{ color: "var(--text2)" }}>
                    Đã thu <b style={{ color: "var(--s-green)" }}>{vnd(collected)}</b> · Còn lại <b style={{ color: balance > 0 ? "var(--s-amber)" : "var(--s-green)" }}>{vnd(balance)}</b>
                  </p>
                </div>
                <p className="mb-4 text-[11px]" style={{ color: "var(--text3)" }}>
                  Mỗi đợt thu đặt sẵn số tiền &amp; hạn — bấm “Đã thu” để ghi nhận khoản thu (quá hạn chưa thu sẽ cảnh báo ở Tổng quan).
                </p>

                {plan.length > 0 && (
                  <ul className="space-y-2">
                    {plan.map((it) => {
                      const overdue = !it.paid && it.due_date && it.due_date < todayStr;
                      const linked = it.payment_id ? payments.find((p) => p.id === it.payment_id) : undefined;
                      return (
                        <li key={it.id} className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: "var(--surface2)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1.5 min-w-0">
                              {it.paid ? (
                                <>
                                  <p className="text-sm font-medium">{vnd(it.amount)} · {it.label}</p>
                                  <p className="text-[11px]" style={{ color: "var(--s-green)" }}>✓ Đã thu{it.paid_at ? ` · ${it.paid_at.slice(0, 10)}` : ""}</p>
                                </>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  <input
                                    className="input h-8 text-sm font-medium flex-1 min-w-[120px]"
                                    value={it.label}
                                    onChange={(e) => autosavePlan(it.id, { label: e.target.value })}
                                  />
                                  <MoneyInput
                                    className="input h-8 text-sm w-32"
                                    value={it.amount}
                                    onChange={(n) => autosavePlan(it.id, { amount: n })}
                                  />
                                  <DateInput
                                    className="input h-8 text-sm"
                                    wrapperClassName="w-36"
                                    value={it.due_date ?? ""}
                                    onChange={(v) => autosavePlan(it.id, { due_date: v || null })}
                                  />
                                  {overdue && <span className="text-[11px] self-center" style={{ color: "var(--s-red)" }}>quá hạn</span>}
                                </div>
                              )}
                              {/* Client proofs for this instalment */}
                              {clientProofs.filter((cp) => cp.plan_id === it.id).map((cp) => (
                                <button key={cp.id} type="button" onClick={() => setLightbox(cp.url)} className="inline-block cursor-zoom-in" title="Phóng to ảnh chuyển khoản">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={cp.url} alt="CK" className="h-10 w-10 rounded-lg object-cover" style={{ border: "1px solid var(--border)" }} />
                                </button>
                              ))}
                            </div>
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {!it.paid && it.amount > 0 && <VietQRButton bank={bank} amount={it.amount} addInfo={qrInfo} label="QR" />}
                            {it.paid && linked?.proof_url && (
                              <button type="button" onClick={() => setLightbox(linked.proof_url!)} className="shrink-0 cursor-zoom-in" title="Phóng to ảnh chuyển khoản">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={linked.proof_url} alt="CK" className="h-7 w-7 rounded object-cover" style={{ border: "1px solid var(--border)" }} />
                              </button>
                            )}
                            {it.paid && linked && (
                              <label className="flex shrink-0 cursor-pointer items-center p-1 text-[11px]" style={{ color: "var(--text3)" }} title="Tải ảnh đã chuyển khoản" aria-label="Tải ảnh đã chuyển khoản">
                                <ImageIcon size={14} />
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => attachProof(linked.id, e.target.files?.[0] ?? null)} />
                              </label>
                            )}
                            {it.paid && linked && (
                              <button onClick={() => printReceipt(linked)} className="shrink-0 p-1 text-[11px]" style={{ color: "var(--text2)" }}>Phiếu thu</button>
                            )}
                            <button onClick={() => markPlanPaid(it)} className="shrink-0 p-1 text-[11px]" style={{ color: it.paid ? "var(--s-green)" : "var(--text3)" }}>
                              {it.paid ? "✓ Đã thu" : "Đánh dấu thu"}
                            </button>
                            <button onClick={() => deletePlan(it)} className="shrink-0 p-1" aria-label="Xoá đợt thanh toán" title="Xoá" style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                          </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Add an instalment — optionally mark it collected immediately */}
                {plan.length === 0 && total > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setPlanForm({ label: "Cọc hợp đồng", amount: depositAmt, due_date: "" })}
                    >
                      Cọc 25% · {vnd(depositAmt)}
                    </button>
                  </div>
                )}
                <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-12" style={{ borderColor: "var(--border)" }}>
                  <input className="input sm:col-span-5" placeholder="Tên đợt (vd: Cọc, Đợt 2)" value={planForm.label} onChange={(e) => setPlanForm((p) => ({ ...p, label: e.target.value }))} />
                  <MoneyInput className="input sm:col-span-4" placeholder="Số tiền" value={planForm.amount} onChange={(n) => setPlanForm((p) => ({ ...p, amount: n }))} />
                  <DateInput wrapperClassName="sm:col-span-3" value={planForm.due_date} onChange={(v) => setPlanForm((p) => ({ ...p, due_date: v }))} />
                </div>
                {/* Quick amounts */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((a) => (
                    <button key={a} onClick={() => setPlanForm((p) => ({ ...p, amount: a }))} className="rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                      {vnd(a)}
                    </button>
                  ))}
                  {balance > 0 && (
                    <button onClick={() => setPlanForm((p) => ({ ...p, amount: balance }))} className="rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--accent)" }}>
                      Còn lại · {vnd(balance)}
                    </button>
                  )}
                </div>
                {/* Transfer-proof image for "Thêm & đã thu" */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs">
                    <Upload size={14} /> {proofBusy ? "Đang tải…" : planProof ? "Đổi ảnh CK" : "Ảnh đã chuyển khoản"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPlanProof(e.target.files?.[0] ?? null)} />
                  </label>
                  {planProof && (
                    <button type="button" onClick={() => setLightbox(planProof)} className="flex items-center gap-1 text-xs cursor-zoom-in" style={{ color: "var(--text2)" }} title="Phóng to ảnh">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={planProof} alt="proof" className="h-8 w-8 rounded object-cover" style={{ border: "1px solid var(--border)" }} /> đính kèm khi “đã thu”
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => addPlan(false)} disabled={busy === "plan"} className="btn-ghost"><Plus size={15} /> {busy === "plan" ? "Đang thêm…" : "Thêm đợt thu"}</button>
                  <button onClick={() => addPlan(true)} disabled={busy === "planPaid"} className="btn-ghost" style={{ color: "var(--s-green)" }}><Check size={15} /> {busy === "planPaid" ? "Đang lưu…" : "Thêm & đã thu"}</button>
                </div>

                {/* Unlinked client proofs (not tied to any instalment) */}
                {clientProofs.filter(cp => !cp.plan_id).length > 0 && (
                  <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                    <p className="mb-2 text-xs font-medium" style={{ color: "var(--text3)" }}>Ảnh CK từ khách (chưa gắn đợt):</p>
                    <div className="flex flex-wrap gap-2">
                      {clientProofs.filter(cp => !cp.plan_id).map(cp => (
                        <button key={cp.id} type="button" onClick={() => setLightbox(cp.url)} className="cursor-zoom-in" title="Phóng to ảnh chuyển khoản">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cp.url} alt="CK" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border)" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Backward-compat: payments recorded before the merge (no instalment) */}
                {orphanPayments.length > 0 && (
                  <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
                    <h3 className="mb-3 text-sm font-medium">Khoản thu khác</h3>
                    <ul className="space-y-2">
                      {orphanPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                          <div>
                            <p className="text-sm font-medium">{vnd(p.amount)} · {PAYMENT_KIND_LABEL[p.kind]}</p>
                            <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                              {p.paid_at}{p.method ? ` · ${p.method}` : ""}{p.note ? ` · ${p.note}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => printReceipt(p)} className="text-[11px]" style={{ color: "var(--text2)" }}>Phiếu thu</button>
                            <button onClick={() => deletePayment(p.id)} style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Per-contract expenses */}
              <div className="card p-6">
                <h2 className="mb-1 font-serif text-lg font-medium">Chi phí phát sinh</h2>
                <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
                  Chi phí riêng cho buổi này (di chuyển, đạo cụ, thuê ngoài…) — để tính lãi/lỗ thực &amp; vào báo cáo thu chi.
                </p>
                {expenses.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có chi phí nào.</p>
                ) : (
                  <ul className="space-y-2">
                    {expenses.map((e) => (
                      <li key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                        <div>
                          <p className="text-sm font-medium">{vnd(e.amount)} · {e.title}</p>
                          <p className="text-[11px]" style={{ color: "var(--text3)" }}>{e.spent_at}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpenseVisible(e.id, !e.client_visible)}
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={e.client_visible
                              ? { background: "var(--s-amberS)", color: "var(--s-amber)" }
                              : { background: "var(--surface)", color: "var(--text3)" }}
                            title={e.client_visible ? "Khách thấy & bị tính vào hóa đơn — bấm để chuyển thành nội bộ" : "Chỉ nội bộ (tính lãi/lỗ) — bấm để hiện cho khách"}
                          >
                            {e.client_visible ? "Khách thấy" : "Nội bộ"}
                          </button>
                          <button onClick={() => deleteExpense(e.id)} style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-12" style={{ borderColor: "var(--border)" }}>
                  <input className="input sm:col-span-6" placeholder="Nội dung chi" value={exp.title} onChange={(e) => setExp((p) => ({ ...p, title: e.target.value }))} />
                  <MoneyInput className="input sm:col-span-3" placeholder="Số tiền" value={exp.amount} onChange={(n) => setExp((p) => ({ ...p, amount: n }))} />
                  <DateInput wrapperClassName="sm:col-span-3" value={exp.spent_at} onChange={(v) => setExp((p) => ({ ...p, spent_at: v }))} />
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text2)" }}>
                  <input type="checkbox" checked={exp.client_visible} onChange={(e) => setExp((p) => ({ ...p, client_visible: e.target.checked }))} />
                  Hiện cho khách &amp; tính vào hóa đơn (bỏ chọn nếu là chi phí nội bộ chỉ để tính lãi/lỗ)
                </label>
                <button onClick={addExpense} className="btn-ghost mt-3"><Plus size={15} /> Thêm chi phí</button>
                <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text2)" }}>Tổng chi phí hợp đồng</span>
                  <span className="font-serif text-lg font-medium">{vnd(expenseTotal)}</span>
                </div>
              </div>

              </>
            )}

            {/* Nhân sự: phân công, tiền công và trạng thái nhận việc */}
            {tab === "crew" && (
              <>
              {/* Crew */}
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-lg font-medium">Photographer / Cameramen</h2>
                  <button onClick={() => setCrew((p) => [...p, { name: "", phone: "", role: "photographer", salary: 0, note: "" }])} className="btn-ghost px-2.5 py-1.5 text-xs">
                    <Plus size={14} /> Thêm người
                  </button>
                </div>

                {roster.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>Chọn nhanh từ sổ thợ:</span>
                    {roster.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          // Đã bận ngày đó thì HỎI trước khi gán — studio vẫn được
                          // quyền chồng lịch, chỉ là phải biết mình đang làm thế.
                          const clash = conflictFor(r.phone);
                          if (clash && !confirm(`${r.name || r.phone} ${clash.toLowerCase()} ngày ${f.event_date}.\n\nVẫn gán người này?`)) return;
                          setCrew((p) => [...p, { name: r.name, phone: r.phone, role: r.role, salary: 0, note: "" }]);
                        }}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{ background: "var(--surface2)", border: conflictFor(r.phone) ? "1px solid var(--s-red)" : "1px solid var(--border)" }}
                        title={conflictFor(r.phone) ?? undefined}
                      >
                        + {r.name || r.phone}
                      </button>
                    ))}
                  </div>
                )}

                {crew.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa gán ai cho hợp đồng này.</p>
                ) : (
                  <div className="space-y-3">
                    {crew.map((c, idx) => {
                      const st = (c.status || "pending") as CrewStatus;
                      return (
                        <div key={idx} className="rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                          <div className="grid gap-2 sm:grid-cols-12">
                            <input className="input sm:col-span-4" placeholder="Tên" value={c.name} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                            <input className="input sm:col-span-3" placeholder="SĐT" value={c.phone} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)))} />
                            <select className="input sm:col-span-3" value={c.role} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, role: e.target.value as CrewRole } : x)))}>
                              {(Object.keys(CREW_ROLE_LABEL) as CrewRole[]).map((k) => (
                                <option key={k} value={k}>{CREW_ROLE_LABEL[k]}</option>
                              ))}
                            </select>
                            <MoneyInput className="input text-right sm:col-span-2" placeholder="Lương" value={c.salary} onChange={(n) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, salary: n } : x)))} />
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-12">
                            <select className="input sm:col-span-3" value={c.task ?? ""} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, task: e.target.value } : x)))} aria-label="Chụp hay quay">
                              <option value="">— Chụp/Quay —</option>
                              {CREW_TASKS.map((k) => (<option key={k} value={k}>{CREW_TASK_LABEL[k]}</option>))}
                            </select>
                            <select className="input sm:col-span-3" value={c.side ?? ""} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, side: e.target.value } : x)))} aria-label="Nhà trai hay nhà gái">
                              <option value="">— Nhà trai/gái —</option>
                              {CREW_SIDES.map((k) => (<option key={k} value={k}>{CREW_SIDE_LABEL[k]}</option>))}
                            </select>
                            <TimeInput className="input sm:col-span-3" value={c.start ?? ""} onChange={(v) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, start: v } : x)))} ariaLabel="Từ giờ" placeholder="Từ 08:00" />
                            <TimeInput className="input sm:col-span-3" value={c.end ?? ""} onChange={(v) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, end: v } : x)))} ariaLabel="Đến giờ" placeholder="Đến 17:00" />
                          </div>
                          <input className="input mt-2" placeholder="Yêu cầu riêng gửi cho người này (vd: mang lens 35mm, có mặt 7:30)…" value={c.note} onChange={(e) => setCrew((p) => p.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))} />
                          {c.phone && conflictFor(c.phone) && (
                            <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: "rgba(199,123,123,0.12)", color: "var(--s-red)" }}>
                              ⚠ {conflictFor(c.phone)} (ngày {f.event_date})
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px]" style={{ color: CREW_STATUS_TONE[st] }}>{CREW_STATUS_LABEL[st]}</span>
                              <button onClick={() => togglePaid(c, idx)} className="text-[11px]" style={{ color: c.paid ? "var(--s-green)" : "var(--text3)" }}>
                                {c.paid ? "✓ Đã trả lương" : "Chưa trả lương"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <MessengerButton
                                label="Gửi cho thợ"
                                message={shootReminderMessage({
                                  name: c.name,
                                  title: f.title,
                                  date: f.event_date,
                                  time: f.event_time,
                                  location: f.location,
                                  role: CREW_ROLE_LABEL[c.role],
                                  link: crewPortalUrl,
                                })}
                              />
                              <ZaloSendButton
                                phone={c.phone}
                                name={c.name}
                                audience="crew"
                                contractId={contract.id}
                                kind="crew_notify"
                                label="Gửi Zalo"
                                message={shootReminderMessage({
                                  name: c.name,
                                  title: f.title,
                                  date: f.event_date,
                                  time: f.event_time,
                                  location: f.location,
                                  role: CREW_ROLE_LABEL[c.role],
                                  studio: studioName,
                                  link: crewPortalUrl,
                                })}
                              />
                              <button onClick={() => deleteCrew(c.id, idx)} className="text-xs" style={{ color: "var(--text3)" }}>
                                <Trash2 size={14} className="inline" /> Xoá
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text2)" }}>Tổng lương nhân sự</span>
                  <span className="font-serif text-lg font-medium">{vnd(payroll)}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={makeDriveFolder} disabled={driveBusy} className="btn-ghost px-3 py-1.5 text-xs">
                    {driveBusy ? "Đang tạo…" : "Tạo thư mục Drive cho hợp đồng"}
                  </button>
                  {driveMsg && (
                    <span className="break-all text-[11px]" style={{ color: "var(--text3)" }}>{driveMsg}</span>
                  )}
                </div>
                <button onClick={saveCrew} disabled={busy === "crew"} className="btn-primary mt-4">
                  {busy === "crew" ? "Đang lưu…" : "Lưu nhân sự & lương"}
                </button>
                {crewDebug && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px]" style={{ color: "var(--text2)" }}>{crewDebug}</pre>
                      <button onClick={() => setCrewDebug(null)} className="shrink-0 text-[11px]" style={{ color: "var(--text3)" }}>Đóng</button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                  Thợ tự nhập SĐT tại {mainUrl("/crew")} để xem việc &amp; lương rồi nhận/từ chối.
                </p>
              </div>


              </>
            )}

            {/* Album & sản phẩm: đơn in ấn và tiện ích tặng khách */}
            {tab === "album" && (
              <>
              {/* Image processing / print / product orders */}
              <div className="card p-6">
                <h2 className="mb-1 font-serif text-lg font-medium">Xử lý ảnh / video / in ấn</h2>
                <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>Các nội dung cần xử lý &amp; sản phẩm — quản lý &amp; giao việc ở mục “Xử lý hình ảnh”.</p>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {["Xử lý hình ảnh", "Xử lý video", "In ấn album", "In ấn ảnh", "Ép gỗ / khung"].map((name) => (
                    <button key={name} type="button" onClick={() => setProdForm((p) => ({ ...p, name }))} className="rounded-full px-2.5 py-1 text-xs" style={{ border: "1px dashed var(--border2)", color: "var(--text3)" }}>
                      + {name}
                    </button>
                  ))}
                </div>
                {products.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có sản phẩm nào.</p>
                ) : (
                  <ul className="space-y-2">
                    {products.map((it) => (
                      <li key={it.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                        <div>
                          <p className="text-sm font-medium">{it.name} {it.qty > 1 ? `×${it.qty}` : ""}</p>
                          <p className="text-[11px]" style={{ color: "var(--text3)" }}>{it.cost > 0 ? vnd(it.cost) : ""}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => cycleProduct(it)} className="text-[11px]" style={{ color: PROD_TONE[it.status] }}>
                            {PRODUCT_STATUS_LABEL[it.status]}
                          </button>
                          <button onClick={() => deleteProduct(it.id)} style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-12">
                  <input className="input sm:col-span-6" placeholder="Tên sản phẩm" value={prodForm.name} onChange={(e) => setProdForm((p) => ({ ...p, name: e.target.value }))} />
                  <input type="number" className="input sm:col-span-2" placeholder="SL" value={prodForm.qty} onChange={(e) => setProdForm((p) => ({ ...p, qty: Number(e.target.value) }))} />
                  <MoneyInput className="input sm:col-span-4" placeholder="Chi phí" value={prodForm.cost} onChange={(n) => setProdForm((p) => ({ ...p, cost: n }))} />
                </div>
                <button onClick={addProduct} className="btn-ghost mt-3"><Plus size={15} /> Thêm sản phẩm</button>
              </div>

              {/* Tiện ích tặng khách & xin đánh giá — gộp lại 1 mục thu gọn cho đỡ rối.
                  Mặc định đóng; bấm để mở Thiệp cưới · Love Story · Xin đánh giá. */}
              <details className="group">
                <summary className="card flex cursor-pointer list-none items-center gap-3 p-4">
                  <Gift size={16} style={{ color: "var(--brand)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Tiện ích tặng khách &amp; xin đánh giá</p>
                    <p className="text-[12px]" style={{ color: "var(--text3)" }}>Thiệp cưới online · Love Story · Xin khách đánh giá</p>
                  </div>
                  <ChevronDown size={16} className="transition-transform group-open:rotate-180" style={{ color: "var(--text3)" }} />
                </summary>

                <div className="mt-3">
                  {/* Online wedding invitation (free gift) */}
                  <WeddingInvitationCard
                    contract={{ id: contract.id, owner_id: contract.owner_id, title: f.title, event_date: f.event_date || null, location: f.location || null }}
                    clientName={f.client_name}
                    clientMessenger={f.client_messenger}
                  />

                  {/* Love Story page (free gift) */}
                  <LoveStoryCard
                    contract={{ id: contract.id, owner_id: contract.owner_id, title: f.title, event_date: f.event_date || null, location: f.location || null }}
                    clientName={f.client_name}
                    clientMessenger={f.client_messenger}
                    studioHost={studioHost}
                    comingSoon={storyComingSoon}
                  />

                  {/* Ask for a review */}
                  <div className="card mb-0 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Star size={16} className="mt-0.5 shrink-0" style={{ color: "var(--s-amber)" }} />
                        <p className="min-w-0 flex-1 text-sm" style={{ color: "var(--text2)" }}>
                          Xin khách đánh giá sau khi giao ảnh (gửi kèm link cổng → mục “Đánh giá studio”).
                        </p>
                      </div>
                      {(() => {
                        const reviewMsg = `Cảm ơn ${f.client_name || "anh/chị"} đã tin tưởng ${studioName}! Anh/chị đánh giá giúp em tại: ${shareUrl} (mục “Đánh giá studio”). Em cảm ơn ạ!`;
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <MessengerButton link={f.client_messenger} label="Gửi cho khách" message={reviewMsg} />
                            <ZaloSendButton phone={f.client_phone} name={f.client_name} audience="client" contractId={contract.id} kind="review_request" message={reviewMsg} />
                            <EmailButton to={f.client_email} label="Email" subject={`Xin đánh giá — ${studioName}`} message={reviewMsg} />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </details>
              </>
            )}

            {/* Gửi khách & ký: link cổng khách, form thông tin, chữ ký hai bên */}
            {tab === "send" && (
              <>
              {/* Share link */}
              <div className="card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <LinkIcon size={16} className="mt-0.5 shrink-0" style={{ color: "var(--text3)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>
                        Cổng khách: xem HĐ · lịch · ảnh · thanh toán (mật khẩu = SĐT khách)
                      </p>
                      <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{shareUrl}</p>
                      <p className="text-[11px]" style={{ color: contract.client_viewed_at ? "var(--s-green)" : "var(--text3)" }}>
                        {contract.client_viewed_at
                          ? `Khách đã xem · ${new Date(contract.client_viewed_at).toLocaleString("vi-VN")}`
                          : "Khách chưa mở link"}
                      </p>
                    </div>
                  </div>
                  {/* Chỉ từ 1100px trở lên: dưới ngưỡng đó thẻ tóm tắt đầu trang
                      đã có đúng cụm này, hiện cả hai là trùng. */}
                  <div className="hidden flex-wrap items-center gap-2 min-[1100px]:flex">
                    <MessengerButton
                      link={f.client_messenger}
                      label="Gửi cho khách"
                      message={clientPortalMsg}
                    />
                    <ZaloSendButton
                      phone={f.client_phone}
                      name={f.client_name}
                      audience="client"
                      contractId={contract.id}
                      kind="contract_share"
                      message={clientPortalMsg}
                    />
                    <EmailButton
                      to={f.client_email}
                      label="Gửi email"
                      subject={`Hợp đồng dịch vụ — ${f.title}`}
                      message={`Xin chào ${f.client_name || "anh/chị"},\n\nĐây là hợp đồng dịch vụ của bên em. Anh/chị xem & xác nhận tại:\n${shareUrl}\n(Mật khẩu mở là số điện thoại của anh/chị.)\n\nCảm ơn ạ!\n— ${studioName}`}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="btn-ghost px-3 py-2 text-xs"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
                    </button>
                  </div>
                </div>
              </div>
              {/* Form điền thông tin buổi chụp — gửi khách qua Zalo (kèm tự động lúc nhắc lịch) */}
              <div className="card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <ClipboardList size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Form thông tin buổi chụp</p>
                      <p className="text-[12px]" style={{ color: "var(--text3)" }}>
                        {contract.intake_submitted_at
                          ? `Khách đã điền · ${new Date(contract.intake_submitted_at).toLocaleString("vi-VN")}`
                          : intakeIsWedding(contract.shoot_type, services.find((s) => s.id === f.service_id)?.name)
                          ? "Khách điền tên & SĐT cô dâu/chú rể, mốc giờ trong ngày, vị trí nhà gái/nhà trai & nơi đãi tiệc (có bản đồ)."
                          : "Khách điền tên người làm việc trực tiếp, SĐT, thời gian bắt đầu, vị trí (có bản đồ) & ghi chú."}
                      </p>
                    </div>
                  </div>
                  {contract.intake_token &&
                    (() => {
                      const formUrl = studioUrl(studioHost, `/form/${contract.intake_token}`);
                      const submitted = !!contract.intake_submitted_at;
                      const msg = submitted
                        ? `Chào ${f.client_name || "anh/chị"}, anh/chị kiểm tra & bổ sung/sửa lại giúp studio thông tin buổi chụp tại: ${formUrl} (mở form rồi bấm "Chỉnh sửa / bổ sung").`
                        : `Chào ${f.client_name || "anh/chị"}, anh/chị điền giúp studio một số thông tin cho buổi chụp tại: ${formUrl}`;
                      const btnLabel = submitted ? "Yêu cầu nhập lại / bổ sung" : "Gửi cho khách";
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <a href={formUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs">
                            <LinkIcon size={13} className="inline" /> Mở form
                          </a>
                          <MessengerButton link={f.client_messenger} label={btnLabel} message={msg} />
                          <ZaloSendButton phone={f.client_phone} name={f.client_name} audience="client" contractId={contract.id} kind="intake_form" message={msg} />
                        </div>
                      );
                    })()}
                </div>

                {contract.intake_submitted_at && contract.intake && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {contract.intake.type === "psc" ? (
                      <>
                        <IntakeSide title="Nhà gái (cô dâu)" rows={[
                          ["Tên", contract.intake.bride?.name],
                          ["SĐT", contract.intake.bride?.phone],
                          ["Makeup", contract.intake.bride?.makeup_time],
                          ["Giờ lễ", contract.intake.bride?.ceremony_time],
                        ]} location={contract.intake.bride?.location} />
                        <IntakeSide title="Nhà trai (chú rể)" rows={[
                          ["Tên", contract.intake.groom?.name],
                          ["SĐT", contract.intake.groom?.phone],
                          ["Xuất phát", contract.intake.groom?.depart_time],
                          ["Giờ lễ", contract.intake.groom?.ceremony_time],
                        ]} location={contract.intake.groom?.location} />
                        {(contract.intake.reception?.time || contract.intake.reception?.location) && (
                          <IntakeSide title="Tiệc cưới / địa điểm khác" rows={[
                            ["Giờ đãi tiệc", contract.intake.reception?.time],
                          ]} location={contract.intake.reception?.location} />
                        )}
                      </>
                    ) : (
                      <IntakeSide title="Thông tin khách" rows={[
                        ["Người làm việc trực tiếp", contract.intake.contact_name],
                        ["SĐT", contract.intake.contact_phone],
                        ["Thời gian bắt đầu", contract.intake.start_time],
                      ]} location={contract.intake.location} />
                    )}
                    {contract.intake.note && (
                      <p className="sm:col-span-2 text-[12px]" style={{ color: "var(--text2)" }}>
                        Ghi chú: {contract.intake.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {/* Signature banner */}
              {contract.client_signed_at && (
                <div className="card flex flex-wrap items-center gap-4 p-5" style={{ borderColor: "var(--s-greenS)" }}>
                  <PenLine size={18} style={{ color: "var(--s-green)" }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--s-green)" }}>
                      Khách đã ký hợp đồng
                    </p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      {contract.client_signed_name || f.client_name} · {new Date(contract.client_signed_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  {contract.client_signature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contract.client_signature} alt="Chữ ký" className="h-16 rounded bg-white p-1" />
                  )}
                </div>
              )}
              {/* Open edit requests */}
              {openRequests.length > 0 && (
                <div className="card p-5" style={{ borderColor: "var(--s-amberS)" }}>
                  <h2 className="mb-3 font-serif text-lg font-medium" style={{ color: "var(--s-amber)" }}>
                    Khách yêu cầu chỉnh sửa ({openRequests.length})
                  </h2>
                  <ul className="space-y-2">
                    {openRequests.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                        <div>
                          <p className="text-sm">{r.message}</p>
                          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text3)" }}>
                            {new Date(r.created_at).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <button onClick={() => resolveRequest(r.id)} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs">
                          <Check size={13} /> Đã xử lý
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Studio counter-signature (Bên A) */}
              <div className="card p-6">
                <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
                  <PenLine size={18} /> Chữ ký Bên A (Studio)
                </h2>
                <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
                  Ký xác nhận của studio — hiển thị trên bản PDF hợp đồng.
                </p>
                {contract.studio_signed_at && (
                  <div className="mb-4 flex items-center gap-4 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
                    {contract.studio_signature && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={contract.studio_signature} alt="Chữ ký" className="h-14 rounded bg-white p-1" />
                    )}
                    <div className="text-xs" style={{ color: "var(--text3)" }}>
                      {contract.studio_signed_name} · {new Date(contract.studio_signed_at).toLocaleString("vi-VN")}
                    </div>
                  </div>
                )}
                <input className="input" placeholder="Tên người ký (đại diện studio)" value={studioSignName} onChange={(e) => setStudioSignName(e.target.value)} />
                <div className="mt-3">
                  <label className="label">Chữ ký {contract.studio_signed_at ? "(ký lại nếu muốn thay)" : ""}</label>
                  <SignaturePad onChange={setStudioSignature} />
                </div>
                <button onClick={saveStudioSignature} disabled={busy === "sign"} className="btn-primary mt-3">
                  <PenLine size={15} /> {busy === "sign" ? "Đang lưu…" : "Lưu chữ ký Bên A"}
                </button>
              </div>
              </>
            )}

          </div>
        </div>

        {/* ── Rail phải: khách hàng · nhân sự · tài chính (bản thiết kế) ────
            Dính theo cuộn từ 1180px trở lên; dưới ngưỡng đó rơi xuống 1 cột và
            bỏ sticky, đúng bảng ngưỡng responsive trong README. */}
        <div className="flex flex-col gap-3.5 min-[1180px]:sticky min-[1180px]:top-[76px] min-[1180px]:self-start">

          {/* Khách hàng */}
          <div className="rounded-[14px] p-4" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
            <p className="eyebrow mb-2.5 uppercase">Khách hàng</p>
            <div className="flex items-center gap-[11px]">
              <span
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                style={avatarStyle(f.client_name || f.title)}
              >
                {initials(f.client_name || f.title)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold">{f.client_name || "Chưa có tên khách"}</p>
                <p className="mt-px truncate text-[12px]" style={{ color: "var(--tx3)" }}>{f.client_phone || "Chưa có SĐT"}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-[7px]">
              <a
                href={clientDigits ? `tel:${clientDigits}` : undefined}
                aria-disabled={!clientDigits}
                className="flex flex-col items-center gap-[3px] rounded-[10px] py-2.5 text-[11px] font-semibold"
                style={{ background: "var(--sf2)", opacity: clientDigits ? 1 : 0.5 }}
              >
                <Phone size={17} style={{ color: "var(--ac)" }} /> Gọi
              </a>
              <a
                href={clientDigits ? `https://zalo.me/${clientDigits}` : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!clientDigits}
                className="flex flex-col items-center gap-[3px] rounded-[10px] py-2.5 text-[11px] font-semibold"
                style={{ background: "var(--sf2)", opacity: clientDigits ? 1 : 0.5 }}
              >
                <MessageCircle size={17} style={{ color: "var(--ac)" }} /> Zalo
              </a>
              {clientDigits ? (
                <Link
                  href={`/dashboard/studio/clients/${clientDigits}`}
                  className="flex flex-col items-center gap-[3px] rounded-[10px] py-2.5 text-[11px] font-semibold"
                  style={{ background: "var(--sf2)" }}
                >
                  <UserRound size={17} style={{ color: "var(--ac)" }} /> Hồ sơ
                </Link>
              ) : (
                <span
                  className="flex flex-col items-center gap-[3px] rounded-[10px] py-2.5 text-[11px] font-semibold"
                  style={{ background: "var(--sf2)", opacity: 0.5 }}
                >
                  <UserRound size={17} style={{ color: "var(--ac)" }} /> Hồ sơ
                </span>
              )}
            </div>
          </div>

          {/* Nhân sự phụ trách — tóm tắt; sửa thì nhảy sang tab Nhân sự. */}
          <div className="rounded-[14px] p-4" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
            <div className="mb-2.5 flex items-center">
              <p className="eyebrow uppercase">Nhân sự phụ trách</p>
              <button onClick={() => setTab("crew")} className="ml-auto text-[11.5px] font-bold" style={{ color: "var(--ac)" }}>
                Sửa
              </button>
            </div>
            {activeCrew.length === 0 ? (
              <button
                onClick={() => setTab("crew")}
                className="flex w-full items-center justify-center gap-1.5 rounded-[11px] p-3.5 text-[12.5px] font-semibold"
                style={{ border: "1.5px dashed var(--am)", color: "var(--am)", background: "var(--amS)" }}
              >
                <UserPlus size={15} /> Chưa có ai — phân công ngay
              </button>
            ) : (
              activeCrew.map((c, i) => (
                <div key={c.id ?? i} className="flex items-center gap-2.5 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <span
                    className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[10.5px] font-bold text-white"
                    style={{ background: avatarColor(c.name || c.phone) }}
                  >
                    {initials(c.name || c.phone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">{c.name || c.phone || "Chưa đặt tên"}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{CREW_ROLE_LABEL[c.role]}</p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="tnum text-[12px] font-bold">{vnd(c.salary || 0)}</p>
                    <p className="text-[10px] font-semibold" style={{ color: c.paid ? "var(--gn)" : "var(--am)" }}>
                      {c.paid ? "Đã trả" : "Chưa trả"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tài chính hợp đồng — cùng công thức lãi/lỗ như trước, trình bày lại
              theo bản thiết kế: đã thu + thanh tiến độ, rồi các dòng trừ dần. */}
          <div className="rounded-[14px] p-4" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
            <p className="eyebrow mb-3 uppercase">Tài chính hợp đồng</p>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12.5px]" style={{ color: "var(--tx2)" }}>Đã thu</span>
              <span className="tnum text-[17px] font-bold" style={{ color: "var(--gn)" }}>{vnd(collected)}</span>
            </div>
            <div className="mb-2.5 h-1.5 overflow-hidden rounded-[4px]" style={{ background: "var(--bd2)" }}>
              <div className="h-full rounded-[4px]" style={{ width: `${pct}%`, background: "var(--gn)" }} />
            </div>

            <div className="flex justify-between py-1.5 text-[12.5px]">
              <span style={{ color: "var(--tx2)" }}>Tổng hợp đồng</span>
              <strong className="tnum">{vnd(total)}</strong>
            </div>
            <div className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <span style={{ color: "var(--tx2)" }}>Còn phải thu</span>
              <span className="flex items-center gap-2">
                <strong className="tnum" style={{ color: balance > 0 ? "var(--am)" : "var(--gn)" }}>{vnd(balance)}</strong>
                {balance > 0 && <VietQRButton bank={bank} amount={balance} addInfo={qrInfo} label="QR" />}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-[12.5px]">
              <span style={{ color: "var(--tx2)" }}>Tiền công nhân sự</span>
              <strong className="tnum">− {vnd(payroll)}</strong>
            </div>
            <div className="flex justify-between pb-1.5 text-[11.5px]">
              <span style={{ color: "var(--tx3)" }}>· đã trả</span>
              <span className="tnum" style={{ color: "var(--tx3)" }}>{vnd(paidPayroll)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-[12.5px]">
              <span style={{ color: "var(--tx2)" }}>Chi phí sản phẩm</span>
              <strong className="tnum">− {vnd(productCost)}</strong>
            </div>
            <div className="flex justify-between py-1.5 text-[12.5px]">
              <span style={{ color: "var(--tx2)" }}>Chi phí khác</span>
              <strong className="tnum">− {vnd(expenseTotal)}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between pt-2.5 text-[13px]" style={{ borderTop: "1px solid var(--bd)" }}>
              <span className="font-semibold">Lợi nhuận dự kiến</span>
              <span className="flex items-center gap-2">
                <span
                  className="flex-none rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold"
                  style={{ background: marginTone.soft, color: marginTone.fg }}
                >
                  {marginPct}%
                </span>
                <strong className="tnum text-[15px]" style={{ color: marginTone.fg }}>{vnd(profit)}</strong>
              </span>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--tx3)" }}>
              Lợi nhuận = giá trị HĐ − tiền công − chi phí sản phẩm − chi phí khác.
            </p>
          </div>
        </div>
      </div>

      {/* Lightbox: zoom a transfer-proof image in place (no new tab).
          Portalled to <body> so the fixed overlay covers the full viewport and
          isn't trapped by the studio shell's transformed (.page-in) ancestor. */}
      {mounted && lightbox && createPortal(
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: "rgba(0,0,0,.85)", backdropFilter: "blur(4px)" }}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Ảnh chuyển khoản"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain cursor-default"
            style={{ boxShadow: "0 12px 48px rgba(0,0,0,.5)" }}
          />
          <a
            href={lightbox}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}
          >
            Mở ảnh gốc ↗
          </a>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Thẻ hiển thị một phía (nhà gái/nhà trai) của form thông tin khách đã điền. */
function IntakeSide({
  title,
  rows,
  location,
}: {
  title: string;
  rows: [string, string | undefined | null][];
  location?: { lat: number | null; lng: number | null; mapUrl: string } | null;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold">{title}</p>
      <div className="mt-1 space-y-0.5 text-[12px]" style={{ color: "var(--text2)" }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            {k}: {v || "—"}
          </div>
        ))}
        {location && (
          <a href={location.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: "#0068FF" }}>
            <MapPin size={12} /> Xem vị trí trên bản đồ
          </a>
        )}
      </div>
    </div>
  );
}
