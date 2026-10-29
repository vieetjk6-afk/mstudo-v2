"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, todayVN } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn, withoutColumn } from "@/lib/missing-column";
import { studioUrl } from "@/lib/hosts";
import type { ContractLifecycle } from "@/components/studio/ContractStepper";
import { qrUrl, instalmentNote, type BankInfo } from "@/components/VietQR";
import { nextContractCode } from "@/lib/contract-code";
import { contractKind } from "@/lib/contract-kind";
import type { CrewRoleRow } from "@/lib/crew-roles";
import { contractPrintDocument, type ContractPrintData } from "@/lib/contract-print";
import { receiptNo, receiptPrintData, yearOf } from "@/lib/accounting";
import { instalmentReminderMessage } from "@/lib/zalo";
import { compressImage, checkImageFile } from "@/lib/image";
import {
  contractTotal,
  vnd,
  sumAmounts,
  SHOOT_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  paymentMethodLabel,
  type PaymentMethod,
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
  type StudioCrew,
  type StudioEvent,
  type StudioAppointment,
  type StudioExpense,
  type ShootType,
  type ContractStatus,
  type CrewRole,
} from "@/lib/types";
import { isSignedLockError, type ContractAddendum } from "@/lib/contract-addenda";
import type { ContractAlbumOption } from "@/lib/contract-album";
import { normalizeAlbumMode, type AlbumMode } from "@/lib/album-mode";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC CHUNG của màn chi tiết hợp đồng — bản cũ (ContractEditor) và bản mới
   (ContractDetailV2) gọi cùng một hook này: cùng state, cùng truy vấn
   Supabase, cùng route máy chủ, cùng thông báo. Hai bản chỉ khác cách vẽ.

   Đây là phần thân cũ của ContractEditor chuyển nguyên sang, chỉ thêm vài thứ
   bản cũ không dùng tới: hàm "…Now" bỏ qua confirm() (bản mới hỏi bằng hộp
   thoại riêng), giá trị trả về true/false của các hàm lưu, và bản "đã lưu" của
   hạng mục / nhân sự để bản mới báo "có thay đổi chưa lưu".
   ═══════════════════════════════════════════════════════════════════════════ */

// unit_price giữ ĐỘ LỚN (số dương khách nhập); is_discount đánh dấu đây là dòng
// giảm giá — khi lưu sẽ ghi unit_price ÂM để trừ vào tổng (không cần cột DB mới).
/**
 * Một dòng hạng mục đang sửa.
 *
 * `description` là ba trạng thái, không phải hai: `undefined` = chưa bật ô mô tả
 * (hiện nút "Thêm mô tả"), `""` = đã bật nhưng còn trống, có chữ = đã nhập.
 * Nhờ vậy không cần giữ thêm state "ô nào đang mở" — thứ sẽ lệch ngay khi
 * studio xoá một dòng ở giữa danh sách.
 */
export type ItemRow = {
  id?: string; name: string; description?: string; qty: number; unit_price: number; is_discount?: boolean;
  /** Hạng mục chính / phụ. Trống = chưa phân loại (hợp đồng cũ). */
  tier?: "main" | "sub" | "";
  /** Mốc lịch (studio_events) tạo từ hạng mục này. */
  event_id?: string | null;
};

/** Một nguồn duy nhất đổi dòng contract_items → ItemRow (lúc nạp trang và sau khi lưu). */
export function toItemRow(i: ContractItem): ItemRow {
  return {
    id: i.id, name: i.name, description: i.description ?? undefined, qty: i.qty,
    unit_price: Math.abs(i.unit_price), is_discount: i.unit_price < 0,
    tier: i.tier ?? "", event_id: i.event_id ?? null,
  };
}

/** Hạng mục mới: chưa có hạng mục chính thì là chính, có rồi thì là phụ. */
export function nextTier(items: ItemRow[]): "main" | "sub" {
  return items.some((i) => !i.is_discount && i.tier === "main") ? "sub" : "main";
}

/** Quy đổi hạng mục sang giá trị CÓ DẤU để tính tổng (giảm giá = âm). */
export function signedItems(items: ItemRow[]): { qty: number; unit_price: number }[] {
  return items.map((i) => ({
    qty: i.is_discount ? 1 : i.qty || 0,
    unit_price: (i.is_discount ? -1 : 1) * Math.abs(i.unit_price || 0),
  }));
}

/** Chuẩn hoá hạng mục để lưu DB: giảm giá lưu unit_price âm, còn lại dương. */
export function serializeItems(items: ItemRow[]): { name: string; description: string | null; qty: number; unit_price: number; tier: string | null; event_id: string | null }[] {
  return items
    .map((i) => {
      const mag = Math.max(0, Math.round(Number(i.unit_price) || 0));
      return {
        name: i.name.trim(),
        // Ô mô tả bật rồi mà để trống thì lưu null, không lưu chuỗi rỗng —
        // để bản in và cổng khách chỉ cần kiểm tra một điều kiện.
        description: i.description?.trim() || null,
        qty: i.is_discount ? 1 : Math.max(0, Math.round(Number(i.qty) || 0)),
        unit_price: i.is_discount ? -mag : mag,
        tier: i.is_discount ? null : i.tier || null,
        event_id: i.event_id ?? null,
      };
    })
    .filter((i) => i.name);
}
type TimeTrace = { name: string; sent: string; norm: string; db: string };

export type CrewRow = {
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
  /** Mốc thời gian (studio_events.id) người này làm; trống = buổi chính. */
  eventId?: string;
};

/** Một nguồn duy nhất để đổi dòng contract_crew → CrewRow. */
export function toCrewRow(c: {
  id?: string; name: string; phone: string | null; role: CrewRole; salary: number;
  note: string | null; status?: string; paid?: boolean;
  task?: string | null; side?: string | null; start_time?: string | null; end_time?: string | null;
  event_id?: string | null;
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
    eventId: c.event_id ?? "",
  };
}

function today() {
  // Phải theo giờ Việt Nam (UTC+7): dùng trực tiếp toISOString() (UTC) thì từ
  // 00:00–07:00 VN sẽ ra NGÀY HÔM QUA — một khoản thu nhập lúc 1h sáng ngày 1 bị
  // ghi vào ngày cuối tháng trước, rơi sai kỳ kế toán (có thể vào sổ đã khoá).
  return todayVN();
}

/**
 * Thu nhỏ ảnh chữ ký (canvas trên máy Retina rất to) — cắt sát nét ký và giới
 * hạn bề ngang, để lưu / in nhẹ và không vượt giới hạn dung lượng.
 */
async function shrinkSignature(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof document === "undefined") return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = dataUrl;
    });
    const src = document.createElement("canvas");
    src.width = img.width;
    src.height = img.height;
    const sctx = src.getContext("2d");
    if (!sctx) return dataUrl;
    sctx.drawImage(img, 0, 0);
    const { data, width, height } = sctx.getImageData(0, 0, src.width, src.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return dataUrl;
    const pad = 8;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const scale = Math.min(1, 600 / w, 240 / h);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(w * scale));
    out.height = Math.max(1, Math.round(h * scale));
    out.getContext("2d")?.drawImage(src, x0, y0, w, h, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

/** Số tiền chọn nhanh cho form đợt thu (VND). */
export const QUICK_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

/** Dấu vân tay các ô SỬA ĐƯỢC của một người (bỏ trạng thái nhận việc / đã trả lương). */
function crewRowSig(c: CrewRow): string {
  return JSON.stringify([c.name, c.phone, c.role, Number(c.salary) || 0, c.note, c.task ?? "", c.side ?? "", c.start ?? "", c.end ?? "", c.eventId ?? ""]);
}
function crewSavedMap(rows: CrewRow[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows) if (r.id) m[r.id] = crewRowSig(r);
  return m;
}

export type ContractEditorProps = {
contract: StudioContract;
studioHost?: string | null;
/** Chữ ký Bên A studio đã lưu (studio_saved_signature) — ký một chạm. */
savedSignature?: { name: string; signature: string } | null;
/** Tên người ký Bên A điền sẵn: tên của chữ ký đã lưu → tên ký lần trước → tên chủ studio. */
defaultSignName?: string;
storyComingSoon?: boolean;
/** Kế hoạch cưới còn "Sắp ra mắt" với studio này (thẻ chỉ hiện nhãn). */
plannerComingSoon?: boolean;
/** Chế độ Quà cưới (`weddingGiftCombo`): kế hoạch cưới + thiệp chung một trang. */
giftCombo?: boolean;
initialItems: ContractItem[];
/** Phụ lục của hợp đồng (chỉ có sau migration contract_addenda.sql). */
initialAddenda?: ContractAddendum[];
/** Vai trò được tạo/xác nhận phụ lục (không phải nhân viên thường). */
canEditAddenda?: boolean;
/** Chủ studio / kế toán: thấy nút "Lịch sử" dẫn tới nhật ký thao tác của hợp đồng. */
canSeeAudit?: boolean;
initialCrew: ContractCrew[];
/** Cổng thợ của studio — nhét vào tin nhắn gửi thợ. */
crewPortalUrl?: string;
initialRequests: ContractEditRequest[];
initialPayments: ContractPayment[];
roster: StudioCrew[];
/** Vai trò thợ studio tự đặt / đè vai trò có sẵn (studio_crew_roles). */
crewRoles?: CrewRoleRow[];
galleries: ContractAlbumOption[];
selectionAlbums: ContractAlbumOption[];
/** Album của hợp đồng (selection_album_id) đã ở giai đoạn giao khách — page.tsx tính bằng isDeliveryPhase. */
linkedAlbumDelivered?: boolean;
/** Số ảnh của album đang gắn (theo id), nếu đếm được. */
albumPhotoCounts?: Record<string, number>;
initialMilestones: StudioEvent[];
initialAppointments: StudioAppointment[];
/** Id chủ studio — cần để ghi dòng studio_appointments (bảng scope theo chủ). */
ownerId: string;
/** Chi nhánh còn hoạt động. Rỗng → không hiện ô chọn chi nhánh. */
branches: { id: string; name: string }[];
/** Vai trò bị ghim chi nhánh (branch_manager): không được chuyển hợp đồng sang cơ sở khác — RLS cũng chặn. */
branchLocked?: boolean;
studioName: string;
/** % cọc gợi ý của studio ("Chính sách studio"). 0 = không gợi ý. */
depositPercent?: number;
/** Thương hiệu studio in trên đầu bản PDF hợp đồng. */
studioLogo?: string | null;
studioPhone?: string | null;
studioEmail?: string | null;
conflictByPhone: Record<string, string>;
initialTasks: ContractTask[];
initialExpenses: StudioExpense[];
initialPlan: ContractPaymentPlan[];
initialProducts: ContractProduct[];
initialQuoteOptions: ContractQuoteOption[];
staffList: { id: string; full_name: string | null; email: string }[];
canAssign: boolean;
/** Gói Studio mới có kho đồ — xem planAllowsRental trong lib/plans. */
canRental?: boolean;
bank: BankInfo;
sameDayContracts: { id: string; title: string; client_name: string | null }[];
pricelist: { name: string; price: number; unit: string | null; description?: string | null }[];
initialClientProofs: { id: string; url: string; note: string | null; uploaded_at: string; plan_id: string | null }[];
services?: { id: string; name: string; clauses: string }[];
/** Tab mở sẵn (?tab=…) — màn tạo hợp đồng nhảy thẳng vào "send" sau khi tạo. */
initialTab?: string;
};

export function useContractEditor(props: ContractEditorProps) {
  const {
    contract,
    studioHost = null,
    savedSignature = null,
    defaultSignName = "",
    initialItems,
    initialAddenda = [],
    canEditAddenda = false,
    canSeeAudit = false,
    initialCrew,
    crewPortalUrl = "",
    initialRequests,
    initialPayments,
    roster,
    crewRoles = [],
    galleries,
    selectionAlbums,
    linkedAlbumDelivered = false,
    albumPhotoCounts = {},
    initialMilestones,
    initialAppointments,
    ownerId,
    branches,
    branchLocked = false,
    studioName,
    depositPercent = 25,
    studioLogo = null,
    studioPhone = null,
    studioEmail = null,
    conflictByPhone,
    initialTasks,
    initialExpenses,
    initialPlan,
    initialProducts,
    staffList,
    canAssign,
    canRental = false,
    bank,
    sameDayContracts,
    pricelist,
    initialClientProofs,
    services = [],
    storyComingSoon = false,
    plannerComingSoon = false,
    giftCombo = false,
    initialTab = "info",
  } = props;
  /** Prop đã áp giá trị mặc định — bản cũ và bản mới đọc từ đây. */
  const p = {
    contract,
    studioHost,
    savedSignature,
    defaultSignName,
    initialItems,
    initialAddenda,
    canEditAddenda,
    canSeeAudit,
    initialCrew,
    crewPortalUrl,
    initialRequests,
    initialPayments,
    roster,
    crewRoles,
    galleries,
    selectionAlbums,
    linkedAlbumDelivered,
    albumPhotoCounts,
    initialMilestones,
    initialAppointments,
    ownerId,
    branches,
    branchLocked,
    studioName,
    depositPercent,
    studioLogo,
    studioPhone,
    studioEmail,
    conflictByPhone,
    initialTasks,
    initialExpenses,
    initialPlan,
    initialProducts,
    staffList,
    canAssign,
    canRental,
    bank,
    sameDayContracts,
    pricelist,
    initialClientProofs,
    services,
    storyComingSoon,
    plannerComingSoon,
    giftCombo,
    initialTab,
  };

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
    branch_id: contract.branch_id ?? "",
  });
  const contractSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contractSaved, setContractSaved] = useState<"idle" | "saving" | "saved">("idle");
  // Hợp đồng đã có album giao khách hay chưa. Giữ ở state để thẻ "đang ở giai
  // đoạn Chọn ảnh" biến mất ngay khi vừa giao, không phải tải lại trang.
  // Tính cả album của hợp đồng đã chuyển sang giao khách (dự án hợp nhất) — trước
  // đây chỉ nhìn gallery_album_id nên nút "Giao khách ngay" vẫn hiện dù đã giao.
  const [deliveryDone, setDeliveryDone] = useState(!!contract.gallery_album_id || linkedAlbumDelivered);
  const [deliverBusy, setDeliverBusy] = useState(false);
  // Chế độ album (album mặc định / nhập link riêng) — thẻ ContractAlbumModeCard
  // giữ nguồn thật, ở đây chỉ để ẩn khối "Giao khách ngay" của luồng Drive.
  const [albumMode, setAlbumMode] = useState<AlbumMode | null>(normalizeAlbumMode(contract.album_mode));

  // Link album / video hoàn thiện — lưu RIÊNG khỏi autosaveContract: studio chưa
  // chạy migrations/contract_final_links.sql thì chỉ hai ô này báo lỗi, các ô
  // khác của hợp đồng vẫn lưu bình thường.
  const [finalLinks, setFinalLinks] = useState({
    album: contract.final_album_url ?? "",
    videos: contract.final_video_urls ?? "",
    originals: contract.final_originals_url ?? "",
  });
  const [finalSaved, setFinalSaved] = useState<"idle" | "saving" | "saved">("idle");
  // Số ảnh in tặng — lưu RIÊNG như các link trên: chưa chạy
  // migrations/anh_in_tang.sql thì chỉ ô này báo, hợp đồng vẫn lưu bình thường.
  const [printQuota, setPrintQuota] = useState(contract.print_quota ? String(contract.print_quota) : "");
  const [printSaved, setPrintSaved] = useState<"idle" | "saving" | "saved">("idle");
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function changePrintQuota(v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 3);
    setPrintQuota(clean);
    if (printTimer.current) clearTimeout(printTimer.current);
    printTimer.current = setTimeout(async () => {
      setPrintSaved("saving");
      const n = Number(clean);
      const { error } = await supabase
        .from("studio_contracts")
        .update({ print_quota: n > 0 ? n : null })
        .eq("id", contract.id);
      if (error) {
        setPrintSaved("idle");
        toast(
          isMissingColumn(error, "print_quota")
            ? "Chưa lưu được số ảnh in: hãy chạy supabase/migrations/anh_in_tang.sql trên Supabase."
            : `Lỗi lưu số ảnh in: ${error.message}`
        );
        return;
      }
      setPrintSaved("saved");
      setTimeout(() => setPrintSaved("idle"), 1500);
    }, 700);
  }
  const finalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setFinal(k: "album" | "videos" | "originals", v: string) {
    setFinalLinks((p) => {
      const next = { ...p, [k]: v };
      if (finalTimer.current) clearTimeout(finalTimer.current);
      finalTimer.current = setTimeout(async () => {
        setFinalSaved("saving");
        // Ghi CẢ BA ô một lượt (bộ hẹn giờ dùng chung, gõ ô này rồi sang ô kia
        // thì lượt trước bị huỷ). Ô file gốc nằm ở migration thứ hai
        // (contract_final_originals.sql): chưa chạy thì vẫn lưu album / video.
        const base = { final_album_url: next.album.trim() || null, final_video_urls: next.videos.trim() || null };
        const write = (patch: Record<string, string | null>) => supabase.from("studio_contracts").update(patch).eq("id", contract.id);
        let { error } = await write({ ...base, final_originals_url: next.originals.trim() || null });
        let originalsMissing = false;
        if (error && isMissingColumn(error, "final_originals_url")) {
          originalsMissing = true;
          ({ error } = await write(base));
        }
        if (error) {
          setFinalSaved("idle");
          toast(
            isMissingColumn(error, "final_")
              ? "Chưa lưu được link: hãy chạy supabase/migrations/contract_final_links.sql trên Supabase."
              : `Lỗi lưu link: ${error.message}`
          );
          return;
        }
        if (originalsMissing && next.originals.trim()) {
          setFinalSaved("idle");
          toast("Chưa lưu được link file gốc: hãy chạy supabase/migrations/contract_final_originals.sql trên Supabase.");
          return;
        }
        setFinalSaved("saved");
        setTimeout(() => setFinalSaved("idle"), 1500);
      }, 700);
      return next;
    });
  }


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
        // KHÔNG ghi `status`, `gallery_album_id`, `selection_album_id` ở đây
        // (xem AUTOSAVE_FORBIDDEN_KEYS trong @/lib/contract-album): state cục bộ
        // có thể đã cũ — server vừa tạo album khi đổi trạng thái — và lượt tự lưu
        // kế tiếp sẽ xoá mất album đó. Trạng thái đi qua changeStatus(), album
        // lưu ngay bằng saveAlbumLink().
        event_date: data.event_date || null,
        event_time: data.event_time.trim() || null,
        location: data.location.trim() || null,
        note: data.note.trim() || null,
        delivery_due: data.delivery_due || null,
        client_messenger: data.client_messenger.trim() || null,
        source: data.source || null,
        ...(canAssign ? { assigned_to: data.assigned_to || null } : {}),
        branch_id: data.branch_id || null,
      })
      .eq("id", contract.id);
    if (error) {
      setContractSaved("idle");
      toast(`Lỗi lưu: ${error.message}`);
      return;
    }
    setContractSaved("saved");
    setTimeout(() => setContractSaved("idle"), 1500);
    // Đồng bộ Google Lịch sau MỌI lần lưu, kể cả khi vừa XOÁ ngày chụp hay lùi
    // hợp đồng về nháp: server quyết định tạo, sửa hay gỡ sự kiện. Trước đây chỉ
    // gọi khi còn `event_date`, nên xoá ngày xong buổi chụp vẫn nằm trên lịch
    // Google và thợ vẫn tới.
    syncContractCalendar();
  }

  /**
   * Nhờ server đẩy hợp đồng này lên Google Lịch. Không còn fire-and-forget:
   * đồng bộ trượt thì phải nói, nếu không studio đinh ninh lịch đã lên Google
   * trong khi chẳng có gì cả. Im lặng khi studio chưa nối Google Lịch — đó là
   * lựa chọn của họ, không phải lỗi cần nhắc mỗi lần gõ phím.
   */
  function syncContractCalendar() {
    fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "contract", id: contract.id, action: "upsert" }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { synced?: boolean; reason?: string };
        if (j.reason === "chưa kết nối Google Lịch") return;
        if (!r.ok || j.synced === false) toast(`Chưa lên Google Lịch: ${j.reason ?? "lỗi không rõ"}`);
      })
      .catch((e) => toast(`Chưa lên Google Lịch: ${(e as Error)?.message || e}`));
  }

  /**
   * Đổi dịch vụ: gắn dịch vụ, đưa loại cũ về "other" và nạp lại bộ điều khoản
   * (chỉ đọc) của dịch vụ đó — rồi lưu ngay, không chờ nhịp tự lưu.
   */
  function changeService(id: string) {
    const svc = services.find((s) => s.id === id);
    setF((p) => ({ ...p, service_id: id, shoot_type: "other", note: svc ? svc.clauses : p.note }));
    if (contractSaveTimer.current) clearTimeout(contractSaveTimer.current);
    const next = { ...f, service_id: id, shoot_type: "other" as ShootType, note: svc ? svc.clauses : f.note };
    autosaveContract(next);
  }

  const set = (k: keyof typeof f, v: string | number) =>
    setF((p) => {
      const next = { ...p, [k]: v } as typeof p;
      if (contractSaveTimer.current) clearTimeout(contractSaveTimer.current);
      contractSaveTimer.current = setTimeout(() => autosaveContract(next), 700);
      return next;
    });

  // Bảng hạng mục CHỈ giữ hạng mục gốc. Dòng của phụ lục đã ký (addendum_id)
  // nằm riêng: chúng bất biến và hiện trong thẻ Phụ lục, nhưng vẫn vào tổng tiền.
  const [items, setItems] = useState<ItemRow[]>(
    initialItems.filter((i) => !i.addendum_id).map(toItemRow)
  );
  const [addendumItems, setAddendumItems] = useState<ContractItem[]>(initialItems.filter((i) => !!i.addendum_id));
  // Bản hạng mục ĐÃ LƯU (dạng chuẩn hoá như lúc ghi DB). Bản cũ không dùng;
  // bản mới so với `items` để báo "có thay đổi chưa lưu".
  const [savedItems, setSavedItems] = useState(() => serializeItems(items));
  // Khách đã ký → hạng mục gốc khoá (trigger guard_signed_contract_items dưới DB
  // là hàng rào thật; ở đây chỉ để không cho bấm rồi mới báo lỗi).
  const itemsLocked = !!contract.client_signed_at;
  // Phải map ĐÚNG BẰNG refetchCrew. Thiếu trường nào ở đây thì sau khi tải lại
  // trang ô đó trắng, và lần lưu kế tiếp ghi đè trắng lên giá trị đã lưu —
  // trông y như "bấm lưu không ăn".
  const [crew, setCrew] = useState<CrewRow[]>(initialCrew.map(toCrewRow));
  // Bản nhân sự ĐÃ LƯU theo id (chỉ bản mới đọc) — xem crewRowDirty.
  const [savedCrew, setSavedCrew] = useState(() => crewSavedMap(crew));
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
  const [clientProofs] = useState(initialClientProofs);
  const [planProof, setPlanProof] = useState<string>(""); // proof image for the next instalment
  // Tiền về bằng gì cho "Thêm & đã thu". Đính ảnh chuyển khoản thì tự chuyển sang CK.
  const [planMethod, setPlanMethod] = useState<PaymentMethod>("cash");
  // Đợt đang chờ chọn "Tiền mặt / Chuyển khoản" sau khi bấm "Đánh dấu thu".
  const [collectFor, setCollectFor] = useState<string | null>(null);
  // Hộp thoại Dời lịch / Huỷ. Làm xong thì đóng hộp thoại là tải lại cả trang:
  // hai thao tác này đổi đợt thu, hạng mục, lần thu ở máy chủ, mà màn này giữ
  // bản sao của từng thứ trong state.
  const [changeDlg, setChangeDlg] = useState<"reschedule" | "cancel" | null>(null);
  const [changeDone, setChangeDone] = useState(false);
  function closeChangeDlg() {
    setChangeDlg(null);
    if (changeDone) window.location.reload();
  }
  // Lịch sử dời lịch (bảng chỉ có sau migrations/contract_cancel_reschedule.sql;
  // chưa chạy thì lỗi truy vấn → danh sách rỗng, không hiện gì).
  const [reschedules, setReschedules] = useState<{ id: string; old_date: string | null; new_date: string; reason: string | null; fee: number; created_at: string }[]>([]);
  useEffect(() => {
    supabase
      .from("contract_reschedules")
      .select("id, old_date, new_date, reason, fee, created_at")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setReschedules((data ?? []) as typeof reschedules), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.id]);
  function onChangeDone(patch: { event_date?: string; event_time?: string; status?: "cancelled" }) {
    setChangeDone(true);
    // setF thẳng (không qua set()) để form mang giá trị mới trước lần tự lưu kế.
    setF((prev) => ({ ...prev, ...patch }));
  }
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
  /*
   * GÓI TUỲ CHỌN CỦA HỢP ĐỒNG — MÀN STUDIO CHƯA CÓ CHỖ QUẢN LÝ.
   *
   * Trang khách (/c/[token]) đã làm xong phần của nó: đọc contract_quote_options,
   * hiện danh sách, và cho khách bấm chọn một gói (POST option_id). Nhưng phía
   * studio thì không có ô nhập nào — hai hàm addOption/deleteOption từng nằm ở
   * file này chưa bao giờ được gắn vào nút bấm, nên đã xoá khi bật ESLint.
   *
   * Hệ quả: KHÔNG có đường nào trong app tạo ra một dòng contract_quote_options
   * (đã quét cả repo: không còn insert/upsert nào vào bảng đó). Khách chỉ thấy
   * danh sách rỗng.
   *
   * Giữ nguyên `initialQuoteOptions` chảy từ page xuống đây để lúc dựng ô nhập
   * chỉ phải nối lại một chỗ, thay vì lần lại cả đường dữ liệu.
   */

  // new milestone form
  const [ms, setMs] = useState({ title: "", event_date: "", event_time: "" });
  // Hạng mục đã tick "Thêm vào mốc lịch" nhưng chưa chọn ngày (theo vị trí dòng).
  const [msOpen, setMsOpen] = useState<Record<number, boolean>>({});
  // Mốc đang sửa tại chỗ (tên / ngày / giờ) — null = không sửa mốc nào.
  const [editMs, setEditMs] = useState<{ id: string; title: string; event_date: string; event_time: string } | null>(null);
  // studio signature
  const [studioSignName, setStudioSignName] = useState(contract.studio_signed_name || defaultSignName);
  const [studioSignature, setStudioSignature] = useState("");
  /** Chữ ký đã lưu dùng được ngay; `drawNew` = studio muốn ký tay chữ ký khác. */
  const [savedSig, setSavedSig] = useState(savedSignature);
  const [drawNew, setDrawNew] = useState(!savedSignature);
  const [rememberSig, setRememberSig] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Bảng chọn cách gửi cổng khách (mở từ nút "Gửi khách" ở thanh đầu trang). */
  const [sendOpen, setSendOpen] = useState(false);

  function toast(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  }

  const total = contractTotal(signedItems(items)) + contractTotal(addendumItems);
  const collected = sumAmounts(payments);
  const balance = total - collected;

  // Cọc gợi ý = % studio đặt trong "Chính sách studio" (mặc định 25%), làm tròn
  // lên bội của 500k, tối thiểu 500k. 0% = studio tắt gợi ý, tự nhập từng đợt.
  // useCallback: hàm này nằm trong deps của effect đồng bộ tiền cọc bên dưới.
  // Để nó dựng lại mỗi lần render thì effect chạy lại mỗi lần render — chỉ phụ
  // thuộc đúng `depositPercent`, nên khoá lại theo đó.
  const depositOf = useCallback(
    (t: number) =>
      t > 0 && depositPercent > 0
        ? Math.max(500_000, Math.round((t * depositPercent) / 100 / 500_000) * 500_000)
        : 0,
    [depositPercent]
  );
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
      // Builder của supabase-js chỉ GỬI khi được then/await — thiếu .then() là
      // màn hình hiện cọc mới còn DB (cổng khách, nhắc nợ) giữ cọc cũ.
      void supabase.from("contract_payment_plan").update({ amount: depositAmt }).eq("id", dep.id).then(() => undefined);
    }
  }, [total, plan, depositAmt, supabase, depositOf]);
  const payroll = crew.reduce((s, c) => s + (Number(c.salary) || 0), 0);
  const paidPayroll = crew.filter((c) => c.paid).reduce((s, c) => s + (Number(c.salary) || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const productCost = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.qty) || 1), 0);
  const profit = total - payroll - expenseTotal - productCost;
  const qrInfo = (contract.code || contract.title || "").slice(0, 25);
  // Client portal runs on the studio's own subdomain once its site is published,
  // otherwise on the main host.
  const shareUrl = studioUrl(studioHost, `/c/${contract.client_token}`);
  // Trang RIÊNG của khách theo hợp đồng: tiến độ, lịch trình, các đợt thanh toán,
  // sản phẩm — và tự đổi thành trang album khi hợp đồng hoàn thành. Cùng token
  // với bản hợp đồng ở trên, nên khách chỉ cần một mật khẩu (SĐT) cho cả hai.
  const portalUrl = studioUrl(studioHost, `/portal/${contract.client_token}`);
  // Một nội dung tin duy nhất cho mọi cách gửi trong bảng "Gửi khách" — cùng một
  // link thì không được lệch câu chữ giữa Zalo, chia sẻ nhanh và chép link.
  const clientPortalMsg = `Xin chào ${f.client_name || "anh/chị"}, đây là hợp đồng dịch vụ của bên em. Anh/chị xem & xác nhận tại: ${shareUrl} (mật khẩu là SĐT của anh/chị). Cảm ơn ạ!`;

  /** "Vietcombank · 0123456789 · NGUYEN VAN A" — dòng STK để khách chuyển tay. */
  const bankLine = [bank.name, (bank.account || "").replace(/\s/g, ""), bank.holder]
    .filter(Boolean)
    .join(" · ");

  /**
   * Nội dung chuyển khoản RIÊNG cho từng đợt: nhìn sao kê là biết tiền của đợt
   * nào, thay vì mọi đợt cùng một mã hợp đồng. Đây cũng là `addInfo` của mã QR
   * đợt đó, nên nút QR và tin nhắc Zalo luôn khớp nhau.
   */
  function planNote(it: ContractPaymentPlan): string {
    return instalmentNote(qrInfo, it.label, it.pay_code);
  }

  /** Tin Zalo nhắc MỘT đợt thanh toán (ảnh QR gửi kèm là QR của chính đợt đó). */
  function planReminderMsg(it: ContractPaymentPlan): string {
    return instalmentReminderMessage({
      name: f.client_name,
      title: f.title,
      label: it.label,
      amount: vnd(it.amount),
      dueDate: it.due_date ? fmtDate(it.due_date) : null,
      overdue: !!it.due_date && it.due_date < today(),
      bankLine: bankLine || null,
      transferNote: planNote(it),
      qrLink: qrUrl(bank, it.amount, planNote(it)),
      link: shareUrl,
      studio: studioName,
    });
  }
  /** "22:42 11-08" — lần cuối khách mở cổng, hoặc null nếu chưa mở lần nào. */
  const clientViewedAt = contract.client_viewed_at
    ? new Date(contract.client_viewed_at).toLocaleString("vi-VN", {
        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
      })
    : null;

  /**
   * Chép ĐÚNG lời nhắn như nút Gửi Zalo (lời chào + link + mật khẩu), hiện
   * "Đã chép" 1,5 giây. Studio dán vào Messenger/SMS là gửi được ngay, không
   * phải tự gõ lại câu dẫn quanh cái link trơ trọi.
   */
  function copyShareUrl() {
    navigator.clipboard?.writeText(clientPortalMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /**
   * Chia sẻ nhanh qua bảng chia sẻ của hệ điều hành (Zalo, Messenger, SMS…).
   * Trình duyệt không hỗ trợ `navigator.share` (phần lớn desktop) thì lùi về
   * chép link, để nút không bao giờ bấm mà không có gì xảy ra.
   */
  async function quickShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Hợp đồng — ${f.title}`, text: clientPortalMsg, url: shareUrl });
        setSendOpen(false);
        return;
      } catch {
        /* khách bấm huỷ — không lùi về chép link, tránh chép ngoài ý muốn */
        return;
      }
    }
    copyShareUrl();
    toast("Trình duyệt không hỗ trợ chia sẻ nhanh — đã chép lời nhắn kèm link.");
  }

  // Required fields — flagged red until valid. Phone must be 10 digits.
  const phoneOk = /^\d{10}$/.test(f.client_phone.replace(/\D/g, ""));
  const reqMissing = {
    title: !f.title.trim(),
    code: !f.code.trim(),
    client_name: !f.client_name.trim(),
    client_phone: !phoneOk,
  };
  const studioSigned = !!contract.studio_signed_at || !!(studioSignName.trim() && studioSignature);

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
    const prevStatus = f.status;
    // setF thẳng, KHÔNG qua set(): trạng thái chỉ ghi qua route server, không
    // hẹn lượt autosave nào. (Lượt autosave đang chờ của ô khác vẫn chạy — nó
    // không còn ghi status / album nên không đè được gì.)
    setF((p) => ({ ...p, status }));
    const revert = () => setF((p) => (p.status === status ? { ...p, status: prevStatus } : p));
    // Đổi qua route server tập trung: nó đóng dấu completed_at và khi "completed"
    // sẽ tự tạo album giao khách (album chọn ảnh đã tạo lúc khách ký).
    try {
      const res = await fetch("/api/studio/contract-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { revert(); toast(`Lỗi: ${data?.error || res.status}`); return; }
      applyAlbumIds(data);
      const sentNote = data?.portalSent ? " · đã gửi link trang riêng cho khách" : "";
      if (status === "completed" && data?.deliveryAlbum) {
        setDeliveryDone(true);
        toast(`Đã hoàn thành · đã tạo album giao khách${sentNote}`);
      } else if (status === "completed" && data?.deliveryReason === "manual_no_link") {
        toast(`Đã hoàn thành · dán link ảnh hoàn thiện ở tab Sản phẩm để giao khách${sentNote}`);
      } else if (status === "completed" && data?.deliveryWaiting) {
        // Hoàn thành = thu đủ tiền. Ảnh chỉnh sửa chưa có thì đừng đẩy khách sang
        // album rỗng — nói rõ album còn ở giai đoạn chọn ảnh để studio khỏi tưởng lỗi.
        toast(`Đã hoàn thành · chưa có ảnh chỉnh sửa nên album vẫn ở giai đoạn Chọn ảnh${sentNote}`);
      } else if (status === "completed" && sentNote) {
        toast(`Đã hoàn thành${sentNote}`);
      } else {
        toast(`Trạng thái: ${CONTRACT_STATUS_LABEL[status]}`);
      }
      router.refresh();
    } catch {
      revert();
      toast("Lỗi mạng, thử lại nhé.");
    }
  }

  /** Áp id album server vừa trả (đọc lại từ DB) vào form — không bao giờ ghi ngược. */
  function applyAlbumIds(data: { selectionAlbumId?: string | null; galleryAlbumId?: string | null } | null | undefined) {
    if (!data) return;
    setF((p) => ({
      ...p,
      ...(data.selectionAlbumId !== undefined ? { selection_album_id: data.selectionAlbumId ?? "" } : {}),
      ...(data.galleryAlbumId !== undefined ? { gallery_album_id: data.galleryAlbumId ?? "" } : {}),
    }));
  }

  /**
   * Gắn / gỡ album cho hợp đồng — lưu NGAY bằng một lượt update riêng (không qua
   * autosave, xem ghi chú ở autosaveContract). Lỗi thì trả ô chọn về giá trị cũ.
   */
  async function saveAlbumLink(k: "selection_album_id" | "gallery_album_id", id: string) {
    const prev = f[k];
    setF((p) => ({ ...p, [k]: id }));
    const { error } = await supabase.from("studio_contracts").update({ [k]: id || null }).eq("id", contract.id);
    if (error) {
      setF((p) => ({ ...p, [k]: prev }));
      toast(`Lỗi lưu album: ${error.message}`);
      return;
    }
    toast(id ? "Đã gắn album" : "Đã gỡ album");
    router.refresh();
  }

  /**
   * "Giao khách ngay" — tạo album giao khách mà không đợi ảnh trên Drive. Dùng
   * khi studio biết chắc đã xử lý xong (ảnh vừa lên, hoặc giao bằng đường khác)
   * và không muốn chờ nhịp quét hằng ngày.
   */
  async function deliverNow() {
    setDeliverBusy(true);
    try {
      const res = await fetch("/api/studio/contract-deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(`Lỗi: ${data?.error || res.status}`); return; }
      applyAlbumIds(data);
      setDeliveryDone(true);
      toast("Đã chuyển sang giai đoạn Giao khách");
      router.refresh();
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
    } finally {
      setDeliverBusy(false);
    }
  }

  // ── Save contract fields ───────────────────────────────────────
  // ── Items ──────────────────────────────────────────────────────
  /**
   * Lưu bảng hạng mục. Nhận THẲNG danh sách cần ghi thay vì đọc state, để chỗ
   * gọi vừa sửa xong mảng là ghi được ngay — `setItems()` chưa kịp có hiệu lực
   * ở lần chạy hiện tại (panel Thuê đồ cần đúng việc này).
   */
  async function luuHangMuc(list: ItemRow[]): Promise<boolean> {
    if (itemsLocked) {
      toast("Khách đã ký hợp đồng — thêm/bớt dịch vụ bằng phụ lục ở tab Hạng mục.");
      return false;
    }
    setBusy("items");
    const clean = serializeItems(list);
    const del = await supabase.from("contract_items").delete().eq("contract_id", contract.id).is("addendum_id", null);
    // Chưa chạy migration contract_addenda.sql thì chưa có cột addendum_id →
    // xoá như cũ. Có cột mà bị khoá thì DỪNG, đừng chèn thêm một bảng giá nữa.
    if (del.error && isMissingColumn(del.error, "addendum_id")) {
      await supabase.from("contract_items").delete().eq("contract_id", contract.id);
    } else if (del.error) {
      setBusy(null);
      toast(isSignedLockError(del.error) ? "Khách đã ký hợp đồng — bảng giá đã khoá, dùng phụ lục." : `Lưu hạng mục KHÔNG thành công: ${del.error.message}`);
      return false;
    }
    let descLost = false;
    if (clean.length) {
      const rows = clean.map((i, idx) => ({ ...i, contract_id: contract.id, position: idx }));
      const { error, dropped } = await insertItems(rows);
      descLost = dropped.includes("description") && clean.some((i) => i.description);
      if (error) {
        // Báo thật, và giữ nguyên state đang có để studio bấm Lưu lại được —
        // trước đây lỗi insert bị nuốt, màn hình vẫn hiện "Đã lưu hạng mục."
        setBusy(null);
        toast(`Lưu hạng mục KHÔNG thành công: ${error.message}`);
        return false;
      }
    }
    const { data } = await supabase
      .from("contract_items")
      .select("*")
      .eq("contract_id", contract.id)
      .order("position");
    // Map phải ĐỦ TRƯỜNG như lúc nạp trang: thiếu trường nào ở đây thì sau khi
    // bấm Lưu ô đó trắng ngay trên màn hình, dù trong database vẫn còn.
    const savedRows = ((data ?? []) as ContractItem[]).filter((i) => !i.addendum_id).map(toItemRow);
    setItems(savedRows);
    setSavedItems(serializeItems(savedRows));
    setBusy(null);
    // Mô tả bị bỏ vì database thiếu cột thì NÓI RA: im lặng thì studio cứ tưởng
    // khách đã thấy mô tả trên cổng hợp đồng và bản in.
    toast(
      descLost
        ? "Đã lưu hạng mục nhưng CHƯA lưu được mô tả — database chưa có cột mô tả, chạy supabase/migrations/contract_item_description.sql."
        : "Đã lưu hạng mục."
    );
    return true;
  }

  /**
   * Chèn hạng mục, chịu được database chưa chạy migration. Thiếu cột nào
   * (description, tier, event_id) thì bỏ cột đó rồi ghi lại — nếu không, hàm
   * lưu vừa XOÁ hết hạng mục xong lại chèn hỏng, studio mất sạch bảng giá.
   * Trả kèm danh sách cột đã bỏ để nơi gọi báo cho studio biết.
   */
  async function insertItems(rows: Record<string, unknown>[]) {
    let cur = rows;
    const dropped: string[] = [];
    let { error } = await supabase.from("contract_items").insert(cur);
    for (const col of ["description", "tier", "event_id"]) {
      if (error && isMissingColumn(error, col)) {
        cur = withoutColumn(cur, col);
        dropped.push(col);
        ({ error } = await supabase.from("contract_items").insert(cur));
      }
    }
    return { error, dropped };
  }

  /** Vỏ bọc KHÔNG tham số cho nút "Lưu hạng mục" — xem ghi chú ở luuHangMuc. */
  async function saveItems() {
    return luuHangMuc(items);
  }

  /**
   * Thêm một hạng mục rồi ghi luôn. Panel Thuê đồ dùng hàm này: đơn thuê đã
   * nằm trong database rồi, nên tiền thuê phải vào bảng hạng mục ngay — để
   * sang lần Lưu sau thì studio có thể đã đóng trang, và trình sửa XOÁ SẠCH
   * bảng hạng mục trước khi ghi lại nên dòng chèn từ nơi khác sẽ mất.
   */
  async function themHangMucVaLuu(name: string, unit_price: number) {
    if (itemsLocked) {
      toast(`Khách đã ký — thêm “${name}” bằng một phụ lục ở tab Hạng mục.`);
      return;
    }
    const moi: ItemRow[] = [...items, { name, qty: 1, unit_price } as ItemRow];
    setItems(moi);
    await luuHangMuc(moi);
  }

  // ── Crew ───────────────────────────────────────────────────────
  async function refetchCrew() {
    const { data } = await supabase
      .from("contract_crew")
      .select("*")
      .eq("contract_id", contract.id)
      .order("position");
    const rows = (data ?? []).map(toCrewRow);
    setCrew(rows);
    setSavedCrew(crewSavedMap(rows));
  }

  /** Nút "Lưu nhân sự & lương" của bản cũ: lưu đúng danh sách đang hiện. */
  async function saveCrew() {
    return saveCrewList(crew);
  }

  /**
   * Lưu một danh sách nhân sự CỤ THỂ — bản mới sửa từng người trong ngăn kéo
   * rồi lưu ngay, mà `setCrew()` chưa kịp có hiệu lực ở lượt chạy hiện tại.
   * Trả true khi máy chủ nhận.
   */
  async function saveCrewList(list: CrewRow[]): Promise<boolean> {
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
        body: JSON.stringify({ contractId: contract.id, crew: list }),
      });
      const raw = await res.text();
      let j: { notified?: number; error?: string; timeTrace?: TimeTrace[] } = {};
      try { j = JSON.parse(raw); } catch { /* không phải JSON — giữ nguyên raw để hiện */ }

      if (!res.ok) {
        setCrewDebug(`Lưu thất bại (HTTP ${res.status}): ${j.error ?? raw.slice(0, 300)}`);
        return false;
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
      return true;
    } catch (e) {
      setCrewDebug(`Không gọi được máy chủ: ${(e as Error)?.message || String(e)}`);
      return false;
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
    const { error } = await supabase
      .from("contract_crew")
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq("id", c.id);
    // Cùng lý do với deletePayment bên dưới: khoá sổ / mất mạng thì báo, không đổi màn.
    if (error) {
      toast(error.message);
      return;
    }
    setCrew((p) => p.map((x, i) => (i === idx ? { ...x, paid: next } : x)));
  }

  async function deleteCrew(id?: string, idx?: number) {
    if (id) {
      const { error } = await supabase.from("contract_crew").delete().eq("id", id);
      if (error) {
        toast(error.message);
        return;
      }
    }
    setCrew((p) => p.filter((_, i) => i !== idx));
  }

  // ── Payments ───────────────────────────────────────────────────
  async function deletePayment(id: string) {
    const old = payments.find((x) => x.id === id)?.proof_url;
    const { error } = await supabase.from("contract_payments").delete().eq("id", id);
    // Trước đây lỗi bị nuốt hoàn toàn: hàng rào KHOÁ SỔ dưới DB chối lệnh xoá,
    // mà màn hình vẫn bỏ dòng khỏi danh sách — studio tưởng đã xoá, F5 thấy nó
    // quay lại. Thông báo của trigger đã viết sẵn bằng tiếng Việt (xem
    // supabase/migrations/accounting.sql), nên hiện thẳng nó ra.
    if (error) {
      toast(error.message);
      return;
    }
    await removeProofFile(old);
    setPayments((p) => p.filter((x) => x.id !== id));
  }

  /**
   * PHIẾU THU cho một lần thu — dùng CHUNG khung in với hợp đồng
   * (@/lib/contract-print), không dựng hệ thống in thứ hai.
   *
   * Bản trước đây tự ghép HTML tay và sai hai chỗ mà khách cầm giấy về sẽ thấy:
   *   • "Số phiếu" là 8 ký tự đầu của UUID — không phải số, không theo thứ tự,
   *     và kế toán không dùng được. Giờ số do DB cấp nguyên tử theo studio × năm
   *     (hàm next_receipt_no, migration accounting.sql) và LƯU LẠI, nên in lại
   *     phiếu cũ vẫn ra đúng số cũ.
   *   • "Đã thu luỹ kế" lấy tổng của MỌI lần thu tính tới HÔM NAY. In lại một
   *     phiếu của ba tháng trước sẽ hiện số luỹ kế của hôm nay — sai. Giờ cộng
   *     đúng những lần thu TỚI thời điểm của phiếu đó.
   */
  async function printReceipt(p: ContractPayment) {
    // Đã có số thì giữ nguyên; chưa có thì xin DB cấp. Chỉ cấp KHI IN — studio
    // ghi rồi xoá một khoản là chuyện thường, mà dãy số phiếu thủng lỗ chỗ thì
    // kế toán không giải thích được.
    let no = p.receipt_no ?? null;
    if (!no) {
      const year = yearOf(p.paid_at, new Date().getFullYear());
      const { data: seq, error } = await supabase.rpc("next_receipt_no", { p_owner: ownerId, p_year: year });
      if (error || typeof seq !== "number") {
        toast(
          error?.code === "42883" || error?.code === "PGRST202"
            ? "Cần chạy supabase/migrations/accounting.sql để cấp số phiếu thu."
            : error?.message ?? "Chưa cấp được số phiếu."
        );
        return;
      }
      no = receiptNo(seq, year);
      await supabase
        .from("contract_payments")
        .update({ receipt_no: no, receipt_at: new Date().toISOString() })
        .eq("id", p.id);
      setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, receipt_no: no } : x)));
    }

    // Đã thu TRƯỚC phiếu này: cộng những lần thu có mốc ≤ mốc của phiếu này.
    // So thêm bằng `id` để hai lần thu CÙNG NGÀY không cùng được tính là "trước".
    const paidBefore = payments
      .filter((x) => x.paid_at < p.paid_at || (x.paid_at === p.paid_at && x.id < p.id))
      .reduce((sum, x) => sum + (x.amount || 0), 0);

    const html = contractPrintDocument(
      receiptPrintData({
        no,
        paidOn: fmtDate(p.paid_at),
        amount: p.amount,
        kindLabel: [PAYMENT_KIND_LABEL[p.kind], paymentMethodLabel(p.method)].filter(Boolean).join(" · "),
        note: p.note ?? null,
        studio: {
          name: studioName,
          logo: studioLogo,
          phone: studioPhone,
          email: studioEmail,
          bankHolder: bank.holder,
          bankAccount: bank.account,
          bankName: bank.name,
        },
        client: { name: f.client_name, phone: f.client_phone, address: null },
        contract: { title: f.title, code: f.code },
        contractTotal: total,
        paidBefore,
      }),
      { autoPrint: true }
    );

    const w = window.open("", "_blank", "width=880,height=920");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  /**
   * Dữ liệu cho bản in hợp đồng (dùng chung với cổng khách & MStudo Desktop —
   * xem src/lib/contract-print.ts). Lấy từ chính state đang mở nên bản in luôn
   * khớp thứ studio đang thấy trên màn hình.
   */
  function buildPrintData(qr: string): ContractPrintData {
    const dmy = (s?: string | null) => (s ? fmtDate(s) : "");
    return {
      docTitle: `Hợp đồng ${f.code || ""} ${f.client_name || ""}`.trim(),
      title: f.title,
      code: f.code,
      issuedAt: dmy(contract.created_at),
      statusLabel: CONTRACT_STATUS_LABEL[f.status],
      studio: {
        name: studioName,
        logo: studioLogo,
        phone: studioPhone,
        email: studioEmail,
        bankHolder: bank.holder,
        bankAccount: bank.account,
        bankName: bank.name,
      },
      client: { name: f.client_name, phone: f.client_phone, email: f.client_email },
      facts: [
        { label: "Dịch vụ", value: services.find((s) => s.id === f.service_id)?.name || SHOOT_TYPE_LABEL[f.shoot_type] },
        { label: "Ngày chụp", value: [dmy(f.event_date), f.event_time].filter(Boolean).join(" · ") },
        { label: "Hạn giao sản phẩm", value: dmy(f.delivery_due) },
        { label: "Địa điểm", value: f.location, wide: true },
      ],
      items: items.map((it) => ({
        name: it.name,
        description: it.description?.trim() || null,
        qty: it.is_discount ? null : it.qty,
        unitPrice: it.is_discount ? null : Math.abs(it.unit_price || 0),
        amount: (it.is_discount ? -1 : 1) * Math.abs(it.unit_price || 0) * (it.is_discount ? 1 : it.qty || 0),
      })),
      totals: [
        { label: "Tổng giá trị hợp đồng", amount: total, strong: true },
        { label: "Đã thanh toán", amount: collected, minus: true },
        { label: "Còn lại", amount: balance, bold: true },
      ],
      amountInWords: total,
      plan: plan.map((p) => ({ label: p.label, due: dmy(p.due_date), paid: p.paid, amount: p.amount })),
      schedule: milestones.map((m) => ({
        title: m.title,
        when: [dmy(m.event_date), m.event_time].filter(Boolean).join(" · "),
      })),
      payments: payments.map((p) => ({
        date: dmy(p.paid_at),
        kind: PAYMENT_KIND_LABEL[p.kind],
        amount: p.amount,
        note: [p.method, p.note].filter(Boolean).join(" · "),
      })),
      terms: f.note,
      signs: [
        {
          label: "Bên A · Studio",
          name: contract.studio_signed_name || studioName,
          image: contract.studio_signature,
          signedAt: dmy(contract.studio_signed_at),
        },
        {
          label: "Bên B · Khách hàng",
          name: contract.client_signed_name || f.client_name,
          image: contract.client_signature,
          signedAt: dmy(contract.client_signed_at),
        },
      ],
      qr,
      footer: `Quét mã QR ở đầu trang để mở bản hợp đồng điện tử · Xuất ngày ${fmtDate(todayVN())}`,
    };
  }

  /**
   * Xuất PDF hợp đồng từ phía studio — mở một cửa sổ chứa bản văn bản A4 rồi
   * gọi in; hộp in của trình duyệt có sẵn "Lưu thành PDF".
   *
   * Không dùng cổng khách để in: cổng đó khoá bằng SĐT khách, còn studio nhiều
   * lúc cần bản in trước khi khách mở link.
   */
  async function printContract() {
    // Mở cửa sổ TRƯỚC khi await: mở sau một tác vụ bất đồng bộ là trình duyệt
    // coi như pop-up tự động và chặn.
    const w = window.open("", "_blank", "width=880,height=920");
    if (!w) {
      toast("Trình duyệt chặn cửa sổ in — cho phép pop-up rồi bấm lại.");
      return;
    }
    let qr = "";
    try {
      const QRCode = (await import("qrcode")).default;
      qr = await QRCode.toDataURL(shareUrl, { margin: 1, width: 240, color: { dark: "#111111", light: "#ffffff" } });
    } catch {
      /* QR chỉ là tiện ích — thiếu vẫn in được */
    }
    w.document.write(contractPrintDocument(buildPrintData(qr)));
    w.document.close();
  }

  // ── Milestones (shared with the studio calendar via studio_events) ─────
  /** Tạo một mốc lịch cho hợp đồng này — dùng chung cho form "Thêm mốc lịch" và hạng mục. */
  async function createMilestone(title: string, event_date: string, event_time: string | null): Promise<StudioEvent | null> {
    const { data, error } = await supabase
      .from("studio_events")
      .insert({
        owner_id: contract.owner_id,
        contract_id: contract.id,
        title: title.trim() || "Mốc lịch",
        event_date,
        event_time: event_time?.trim() || null,
        remind: true,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast(`Lỗi: ${error?.message ?? "không tạo được mốc lịch"}`);
      return null;
    }
    setMilestones((p) => [...p, data as StudioEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    // Mốc lịch (ngày đãi trước, thử đồ...) cũng là lịch phải chạy — trước đây
    // chỉ ghi vào DB nên Google Lịch chỉ có mỗi ngày chụp chính.
    syncMilestone(data.id as string, "upsert");
    return data as StudioEvent;
  }

  async function addMilestone() {
    if (!ms.event_date) {
      toast("Chọn ngày cho mốc lịch.");
      return false;
    }
    setBusy("milestone");
    const ev = await createMilestone(ms.title, ms.event_date, ms.event_time);
    setBusy(null);
    if (ev) setMs({ title: "", event_date: "", event_time: "" });
    return !!ev;
  }

  /**
   * Sửa tên / ngày / giờ của một mốc. Thợ được gán vào mốc này có lịch ghi
   * "<tên mốc> · <tên hợp đồng>" theo ngày của mốc, nên lưu lại nhân sự luôn để
   * lịch thợ đổi theo — không thì lịch thợ còn tên và ngày cũ.
   */
  async function updateMilestone(id: string, patch: { title?: string; event_date?: string; event_time?: string | null }) {
    const clean = {
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() || "Mốc lịch" } : {}),
      ...(patch.event_time !== undefined ? { event_time: patch.event_time?.trim() || null } : {}),
    };
    if (clean.event_date === "") {
      toast("Chọn ngày cho mốc lịch.");
      return false;
    }
    const { error } = await supabase.from("studio_events").update(clean).eq("id", id);
    if (error) {
      toast(`Lỗi: ${error.message}`);
      return false;
    }
    setMilestones((p) => p.map((m) => (m.id === id ? { ...m, ...clean } : m)).sort((a, b) => a.event_date.localeCompare(b.event_date)));
    syncMilestone(id, "upsert");
    if (crew.some((c) => c.id && c.eventId === id)) await saveCrew();
    else toast("Đã cập nhật mốc lịch.");
    return true;
  }

  async function saveEditMilestone() {
    if (!editMs) return;
    setBusy("milestone-edit");
    const ok = await updateMilestone(editMs.id, { title: editMs.title, event_date: editMs.event_date, event_time: editMs.event_time });
    setBusy(null);
    if (ok) setEditMs(null);
  }

  // ── Hạng mục ↔ mốc lịch ───────────────────────────────────────
  /**
   * Chọn ngày cho hạng mục → tạo mốc lịch mang tên hạng mục (vd: "Đãi trước")
   * rồi lưu liên kết. Lưu hạng mục ngay: mốc đã nằm trong DB rồi, để tới lần
   * bấm Lưu sau thì studio có thể đã đóng trang và liên kết mất.
   */
  async function linkItemToMilestone(idx: number, date: string) {
    const it = items[idx];
    if (!it || !date) return;
    if (it.event_id) {
      await updateMilestone(it.event_id, { event_date: date });
      return;
    }
    setBusy("item-ms");
    const ev = await createMilestone(it.name || "Mốc lịch", date, null);
    setBusy(null);
    if (!ev) return;
    const next = items.map((x, i) => (i === idx ? { ...x, event_id: ev.id } : x));
    setItems(next);
    await luuHangMuc(next);
  }

  async function unlinkItemMilestone(idx: number) {
    if (!items[idx]?.event_id) return;
    if (!confirm("Bỏ mốc lịch của hạng mục này? Mốc sẽ bị xoá khỏi lịch.")) return;
    await unlinkItemMilestoneNow(idx);
  }

  /** Như trên nhưng KHÔNG hỏi lại — nơi gọi đã tự hỏi xác nhận. */
  async function unlinkItemMilestoneNow(idx: number) {
    const id = items[idx]?.event_id;
    if (!id) return;
    await deleteMilestone(id);
    const next = items.map((x, i) => (i === idx ? { ...x, event_id: null } : x));
    setItems(next);
    await luuHangMuc(next);
  }

  async function deleteMilestone(id: string) {
    // PHẢI `await`: server tra `gcal_event_id` từ chính hàng này. Xoá hàng trước
    // rồi mới gọi thì không còn gì để tra, và sự kiện nằm lại trên lịch Google
    // vĩnh viễn — mốc đã huỷ mà thợ vẫn thấy trên điện thoại.
    await syncMilestone(id, "delete");
    await supabase.from("studio_events").delete().eq("id", id);
    setMilestones((p) => p.filter((m) => m.id !== id));
    // Hạng mục gắn mốc này: DB tự bỏ liên kết (on delete set null), state theo.
    setItems((p) => p.map((x) => (x.event_id === id ? { ...x, event_id: null } : x)));
    setSavedItems((p) => p.map((x) => (x.event_id === id ? { ...x, event_id: null } : x)));
    // DB tự đưa phân công về buổi chính (on delete set null), nhưng mốc trên
    // lịch thợ chỉ đổi ngày khi lưu lại nhân sự — nhắc studio bấm Lưu.
    if (crew.some((c) => c.eventId === id)) {
      setCrew((p) => p.map((c) => (c.eventId === id ? { ...c, eventId: "" } : c)));
      toast("Thợ của mốc này đã chuyển về buổi chính — bấm “Lưu nhân sự & lương” để cập nhật lịch thợ.");
    }
  }

  function syncMilestone(id: string, action: "upsert" | "delete") {
    return fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "event", id, action }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { synced?: boolean; reason?: string };
        if (action === "delete" || j.reason === "chưa kết nối Google Lịch") return;
        if (!r.ok || j.synced === false) toast(`Mốc lịch chưa lên Google: ${j.reason ?? "lỗi không rõ"}`);
      })
      .catch(() => {/* mốc lịch lên trễ không đáng chặn thao tác */});
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
    if (url) {
      setPlanProof(url);
      setPlanMethod("transfer");
    }
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

  // Zalo sau một lần thu: đủ tiền → "đã thanh toán đủ", đợt cọc → "đã nhận cọc".
  // Máy chủ tự tính và tự kiểm tra studio đã bật mốc + kết nối Zalo chưa.
  // Fire-and-forget, không chặn UI.
  function paymentZalo(amount: number, label: string | null | undefined) {
    fetch("/api/studio/zalo/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: contract.id,
        event: "payment_received",
        amount,
        isDeposit: (label || "").toLowerCase().includes("cọc"),
      }),
    }).catch(() => {});
  }

  // ── Payment schedule (unified: marking an instalment paid records a payment) ──
  async function addPlan(markPaid = false) {
    const amount = Math.max(0, Math.round(Number(planForm.amount) || 0));
    if (!planForm.label.trim() && !amount) return false;
    const label = planForm.label.trim() || "Đợt thanh toán";
    setBusy(markPaid ? "planPaid" : "plan");
    let payment_id: string | null = null;
    if (markPaid) {
      const { data: payment, error } = await supabase
        .from("contract_payments")
        .insert({ contract_id: contract.id, amount, kind: "installment", method: planMethod, paid_at: today(), note: label, ...(planProof ? { proof_url: planProof } : {}) })
        .select("*")
        .single();
      // Ghi lần thu HỎNG (thường là hàng rào khoá sổ) thì DỪNG — không ghi tiếp
      // dòng đợt. Ghi tiếp là đợt hiện "đã thu" mà không có lần thu nào phía
      // sau: hai bảng lệch nhau, và không màn nào nói ra.
      if (error || !payment) {
        setBusy(null);
        toast(error?.message || "Không ghi được lần thu.");
        return false;
      }
      setPayments((p) => [payment as ContractPayment, ...p]);
      payment_id = (payment as ContractPayment).id;
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
    if (payment_id) {
      paymentZalo(amount, label);
      approveIfDeposited();
    }
    return !!data;
  }
  /**
   * Vừa ghi một khoản thu → hợp đồng nháp / chờ khách duyệt tự thành "Khách đã
   * duyệt", không cần chữ ký (khách chốt bằng cọc). Máy chủ lo Drive + Google
   * Lịch như lúc khách ký. setF thẳng để lần tự lưu sau không ghi đè lại trạng
   * thái cũ.
   */
  function approveIfDeposited() {
    if (f.status !== "draft" && f.status !== "sent") return;
    fetch(`/api/studio/contracts/${contract.id}/approve-on-deposit`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.approved) {
          setF((prev) => ({ ...prev, status: "approved" }));
          toast("Đã nhận cọc · hợp đồng chuyển sang Khách đã duyệt");
        }
      })
      .catch(() => {});
  }
  // Đợt đang ghi dở — chặn bấm "Ghi thu" lần hai trước khi lần đầu xong (mỗi
  // lần là một dòng contract_payments: doanh thu bị đếm đôi).
  const planBusyRef = useRef<Set<string>>(new Set());
  // Mark an instalment collected → records a real payment; un-marking removes it.
  async function markPlanPaid(it: ContractPaymentPlan, method: PaymentMethod | null = null) {
    if (planBusyRef.current.has(it.id)) return;
    planBusyRef.current.add(it.id);
    try {
      await markPlanPaidInner(it, method);
    } finally {
      planBusyRef.current.delete(it.id);
    }
  }
  async function markPlanPaidInner(it: ContractPaymentPlan, method: PaymentMethod | null) {
    setCollectFor(null);
    if (it.paid) {
      if (it.payment_id) {
        const old = payments.find((x) => x.id === it.payment_id)?.proof_url;
        const { error } = await supabase.from("contract_payments").delete().eq("id", it.payment_id);
        // Xoá HỎNG thì dừng: gỡ dấu "đã thu" của đợt trong khi lần thu vẫn nằm
        // trong sổ là doanh thu bị đếm hai lần.
        if (error) {
          toast(error.message);
          return;
        }
        await removeProofFile(old);
        setPayments((p) => p.filter((x) => x.id !== it.payment_id));
      }
      await supabase.from("contract_payment_plan").update({ paid: false, paid_at: null, payment_id: null }).eq("id", it.id);
      setPlan((p) => p.map((x) => (x.id === it.id ? { ...x, paid: false, paid_at: null, payment_id: null } : x)));
    } else {
      const amount = Math.max(0, Math.round(Number(it.amount) || 0));
      const nowIso = new Date().toISOString();
      const { data: payment, error } = await supabase
        .from("contract_payments")
        .insert({ contract_id: contract.id, amount, kind: "installment", method, paid_at: today(), note: it.label })
        .select("*")
        .single();
      if (error || !payment) {
        toast(error?.message || "Không ghi được lần thu.");
        return;
      }
      const pid = (payment as ContractPayment).id;
      setPayments((p) => [payment as ContractPayment, ...p]);
      await supabase.from("contract_payment_plan").update({ paid: true, paid_at: nowIso, payment_id: pid }).eq("id", it.id);
      setPlan((p) => p.map((x) => (x.id === it.id ? { ...x, paid: true, paid_at: nowIso, payment_id: pid } : x)));
      approveIfDeposited();
      paymentZalo(amount, it.label);
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
      const { error } = await supabase.from("contract_payments").delete().eq("id", it.payment_id);
      // Như trên: xoá đợt mà lần thu ở lại là doanh thu đếm hai lần.
      if (error) {
        toast(error.message);
        return;
      }
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

  // ── Quote options ──────────────────────────────────────────────
  // ── Studio counter-signature ───────────────────────────────────
  /**
   * Ký Bên A. `useSaved` = ký bằng chữ ký đã lưu (một chạm). Ký tay mới mà tick
   * "Lưu để lần sau" thì lưu chữ ký đó thay cho chữ ký cũ.
   */
  async function saveStudioSignature(useSaved = false) {
    const name = useSaved && savedSig ? savedSig.name : studioSignName.trim();
    const sig = useSaved && savedSig ? savedSig.signature : await shrinkSignature(studioSignature);
    if (!name) {
      toast("Nhập tên người ký (Bên A).");
      return;
    }
    setBusy("sign");
    const { error } = await supabase
      .from("studio_contracts")
      .update({
        studio_signed_name: name,
        ...(sig ? { studio_signature: sig } : {}),
        studio_signed_at: new Date().toISOString(),
      })
      .eq("id", contract.id);
    setBusy(null);
    // Lưu chữ ký để lần sau ký một chạm. Lỗi thì NÓI RA (trước đây im lặng →
    // studio tưởng đã lưu mà lần sau không thấy).
    let warn: string | null = null;
    if (!error && !useSaved && rememberSig && sig) {
      const r = await fetch("/api/studio/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, signature: sig }),
      }).catch(() => null);
      if (r?.ok) setSavedSig({ name, signature: sig });
      else {
        const j = r ? await r.json().catch(() => ({})) : {};
        warn =
          j.error === "missing_migration" ? "Đã ký, nhưng chưa lưu được chữ ký: cần chạy supabase/voucher-uu-dai.sql."
            : r?.status === 403 ? "Đã ký, nhưng chỉ chủ / quản lý mới lưu được chữ ký mặc định."
            : `Đã ký, nhưng chưa lưu được chữ ký để dùng lại (${j.error || r?.status || "lỗi mạng"}).`;
      }
    }
    toast(error ? `Lỗi: ${error.message}` : warn ?? (useSaved ? "Đã ký bằng chữ ký đã lưu." : rememberSig && sig ? "Đã ký và lưu chữ ký để lần sau ký một chạm." : "Đã ký Bên A."));
    if (!error) {
      setStudioSignName(name);
      // Ký xong là hợp đồng đã chốt — đẩy luôn lên Google Lịch thay vì đợi lần
      // sửa ô nào đó kế tiếp mới chạy autosave.
      syncContractCalendar();
      router.refresh();
    }
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
        // Bản sao ở lại đúng cơ sở, và với nhân viên thì vẫn giao cho chính họ:
        // RLS chỉ cho quản lý chi nhánh ghi hợp đồng của cơ sở mình, nhân viên ghi
        // hợp đồng giao cho mình (migrations/phan_quyen_vai_tro_hop_dong.sql).
        branch_id: f.branch_id || null,
        ...(canAssign ? {} : { assigned_to: contract.assigned_to }),
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(null);
      toast(`Lỗi: ${error?.message || "không nhân bản được"}`);
      return;
    }
    // Mốc lịch thuộc hợp đồng cũ — bản sao không mang theo liên kết đó.
    const clean = serializeItems(items).map((i) => ({ ...i, event_id: null }));
    if (clean.length) {
      await insertItems(clean.map((i, idx) => ({ ...i, contract_id: data.id, position: idx })));
    }
    router.push(`/dashboard/studio/contracts/${data.id}`);
  }

  async function deleteContract() {
    if (!confirm("Xoá hợp đồng này? Mọi hạng mục, nhân sự, thanh toán & yêu cầu sẽ bị xoá theo.")) return;
    await deleteContractNow();
  }

  /** Như trên nhưng KHÔNG hỏi lại — nơi gọi đã tự hỏi xác nhận. */
  async function deleteContractNow() {
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

  /* Nhóm hợp đồng suy từ gói dịch vụ đang chọn (f.shoot_type), KHÔNG từ bản đã
     lưu: studio đổi gói từ "Chụp ảnh" sang "Trang điểm" là danh sách gợi ý phải
     đổi theo ngay, chứ không đợi bấm Lưu rồi tải lại trang. */
  const kind = contractKind(f.shoot_type);

  // Vòng đời 7 bước — suy ra từ dữ liệu thật, không phải cột trạng thái riêng.
  const lifecycle: ContractLifecycle = {
    hasItems: items.length > 0,
    // Chốt bằng cọc cũng là đã chốt: có tiền mà trạng thái đã qua "chờ duyệt".
    signed: !!contract.client_signed_at || (collected > 0 && f.status !== "draft" && f.status !== "sent" && f.status !== "cancelled"),
    hasCrew: crew.length > 0,
    hasDeposit: collected > 0,
    shot:
      f.status === "in_progress" || f.status === "post_production" || f.status === "completed" ||
      (!!f.event_date && f.event_date < todayVN()),
    // Album đã sang giao khách cũng là hậu kỳ xong — đừng bắt studio bấm từng
    // sản phẩm "Xử lý hình ảnh" sang "xong" mới qua được bước này.
    postDone:
      f.status === "completed" ||
      deliveryDone ||
      (products.length > 0 && products.every((x) => x.status === "done")),
    delivered: f.status === "completed" || !!f.gallery_album_id || deliveryDone,
  };

  // Nút phụ ở đầu màn: 12.5px/600, bo 9px, viền + nền thẻ — không đổ bóng.
  // Nhân sự chưa từ chối — dùng cho rail phải và cho badge đếm trên tab.
  const activeCrew = crew.filter((c) => (c.status || "pending") !== "declined");
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const clientDigits = f.client_phone.replace(/\D/g, "");
  // Biên lợi nhuận theo bản thiết kế: <45% đỏ, 45–60% vàng, >60% xanh.
  const marginPct = total > 0 ? Math.round((profit / total) * 100) : 0;


  /** Một người có thay đổi chưa lưu (hoặc chưa từng lưu) — chỉ bản mới dùng. */
  const crewRowDirty = (c: CrewRow) => !c.id || savedCrew[c.id] !== crewRowSig(c);
  const itemsDirty = !itemsLocked && JSON.stringify(serializeItems(items)) !== JSON.stringify(savedItems);
  const crewDirty = crew.some(crewRowDirty);

  return {
    props: p,
    conflictFor, router, supabase,
    f, setF, set, changeService, contractSaved, autosaveContract, syncContractCalendar, contractSaveTimer,
    deliveryDone, setDeliveryDone, deliverBusy, deliverNow, albumMode, setAlbumMode,
    finalLinks, finalSaved, setFinal, printQuota, printSaved, changePrintQuota,
    items, setItems, addendumItems, setAddendumItems, itemsLocked, savedItems, setSavedItems, itemsDirty,
    crew, setCrew, crewDebug, setCrewDebug, crewRowDirty, crewDirty,
    driveMsg, setDriveMsg, driveBusy, makeDriveFolder,
    requests, payments, setPayments, milestones, tasks, newTask, setNewTask, expenses, exp, setExp,
    plan, planForm, setPlanForm, autosavePlan, clientProofs, planProof, setPlanProof, planMethod, setPlanMethod,
    collectFor, setCollectFor, changeDlg, setChangeDlg, closeChangeDlg, reschedules, onChangeDone,
    proofBusy, lightbox, setLightbox, mounted, products, prodForm, setProdForm,
    ms, setMs, msOpen, setMsOpen, editMs, setEditMs,
    studioSignName, setStudioSignName, studioSignature, setStudioSignature, savedSig, drawNew, setDrawNew, rememberSig, setRememberSig,
    msg, toast, busy, copied, sendOpen, setSendOpen,
    total, collected, balance, depositAmt, payroll, paidPayroll, expenseTotal, productCost, profit, marginPct,
    qrInfo, shareUrl, portalUrl, clientPortalMsg, bankLine, planNote, planReminderMsg, clientViewedAt,
    copyShareUrl, quickShare, phoneOk, reqMissing, studioSigned, fillCode, changeStatus, applyAlbumIds, saveAlbumLink,
    luuHangMuc, saveItems, themHangMucVaLuu,
    refetchCrew, saveCrew, saveCrewList, togglePaid, deleteCrew,
    deletePayment, printReceipt, printContract,
    addMilestone, updateMilestone, saveEditMilestone, linkItemToMilestone, unlinkItemMilestone, unlinkItemMilestoneNow, deleteMilestone,
    addTaskLabel, addTask, toggleTask, deleteTask, tasksDone,
    addExpense, deleteExpense, toggleExpenseVisible,
    pickPlanProof, attachProof, addPlan, markPlanPaid, deletePlan, todayStr, orphanPayments,
    addProduct, cycleProduct, deleteProduct,
    saveStudioSignature, resolveRequest, duplicateContract, deleteContract, deleteContractNow,
    openRequests, kind, lifecycle, activeCrew, pct, clientDigits,
  };
}

export type ContractEditorState = ReturnType<typeof useContractEditor>;
