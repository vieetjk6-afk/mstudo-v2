"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REDEEM_ERROR_TEXT } from "@/lib/vouchers";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { nextContractCode } from "@/lib/contract-code";
import { DEFAULT_TASKS_BY_KIND } from "@/lib/contract-kind";
import { fullClauseText } from "@/lib/contract-clauses";
import type { StudioBooking } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Đặt lịch khách (bản cũ BookingsView và bản mới
   BookingsV2): link đặt lịch, đổi trạng thái, xác nhận cọc, sửa, xoá, tạo hợp
   đồng từ yêu cầu, lọc theo trạng thái. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BookingStatus = "new" | "accepted" | "pending" | "declined" | "handled" | "archived";

export interface EditState {
  id: string;
  name: string;
  phone: string;
  service: string;
  preferred_date: string;
  note: string;
  facebook: string;
}

export type BookingsProps = {
  ownerId: string;
  token: string;
  tokenSaved?: boolean;
  initial: StudioBooking[];
  studioHost?: string | null;
  /** Nhân viên tạo hợp đồng → giao luôn cho chính họ (RLS chỉ cho họ ghi hợp đồng giao cho mình). */
  assignTo?: string | null;
};

/** Trạng thái sửa ban đầu của một yêu cầu. */
export const editStateOf = (b: StudioBooking): EditState => ({
  id: b.id,
  name: b.name,
  phone: b.phone,
  service: b.service ?? "",
  preferred_date: b.preferred_date ?? "",
  note: b.note ?? "",
  facebook: b.facebook ?? "",
});

export function useBookings({ ownerId, token, initial, studioHost = null, assignTo = null }: BookingsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState<StudioBooking[]>(initial);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState(() => studioUrl(studioHost, `/book/${token}`));
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    setBookingUrl(studioHost ? studioUrl(studioHost, `/book/${token}`) : `${window.location.origin}/book/${token}`);
  }, [token, studioHost]);

  async function updateStatus(id: string, status: BookingStatus) {
    setBusy(id);
    await supabase.from("studio_bookings").update({ status }).eq("id", id);
    setList((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    setBusy(null);
  }

  /** Studio đã đối chiếu sao kê và xác nhận nhận được cọc. */
  async function confirmDeposit(id: string) {
    setBusy(id);
    await supabase.from("studio_bookings").update({ deposit_status: "confirmed" }).eq("id", id);
    setList((p) => p.map((b) => (b.id === id ? { ...b, deposit_status: "confirmed" as const } : b)));
    setBusy(null);
  }

  async function deleteBooking(id: string) {
    if (!confirm("Xoá yêu cầu này? Không thể khôi phục.")) return;
    await supabase.from("studio_bookings").delete().eq("id", id);
    setList((p) => p.filter((b) => b.id !== id));
  }

  async function saveEdit() {
    if (!editState) return;
    setEditBusy(true);
    const patch = {
      name: editState.name.trim(),
      phone: editState.phone.trim(),
      service: editState.service.trim() || null,
      preferred_date: editState.preferred_date || null,
      note: editState.note.trim() || null,
      facebook: editState.facebook.trim() || null,
    };
    await supabase.from("studio_bookings").update(patch).eq("id", editState.id);
    setList((p) => p.map((b) => b.id === editState.id ? { ...b, ...patch } : b));
    setEditBusy(false);
    setEditState(null);
  }

  async function toContract(b: StudioBooking) {
    setBusy(b.id);
    const ct = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
    const code = await nextContractCode(supabase, ownerId);
    const note = [b.note, fullClauseText()].filter(Boolean).join("\n\n");
    const core = {
      owner_id: ownerId,
      code,
      title: b.service ? `${b.service} — ${b.name}` : `Hợp đồng — ${b.name}`,
      client_name: b.name,
      client_phone: b.phone,
      // Hợp đồng ở lại cơ sở của yêu cầu đặt lịch: doanh thu chi nhánh tính đúng,
      // và quản lý chi nhánh (RLS ghim theo branch_id) tạo được hợp đồng của mình.
      branch_id: b.branch_id ?? null,
      ...(assignTo ? { assigned_to: assignTo } : {}),
      client_messenger: b.facebook || null,
      event_date: b.preferred_date,
      note,
      client_token: ct,
    };
    // Giữ lại chuỗi quy nguồn. Trước đây bấm "Tạo hợp đồng" là nguồn rơi mất:
    // yêu cầu đặt lịch biết khách từ Facebook hay Google, hợp đồng thì không,
    // nên biểu đồ doanh thu theo nguồn ở màn Thu chi luôn trống.
    //
    // Chưa chạy migration `nguon_khach.sql` thì `booking_id` chưa tồn tại và cả
    // câu insert bị từ chối — thà mất phần quy nguồn còn hơn không tạo được
    // hợp đồng.
    let { data, error } = await supabase
      .from("studio_contracts")
      .insert({ ...core, source: b.source ?? null, booking_id: b.id })
      .select("id")
      .single();
    if (error) {
      ({ data, error } = await supabase.from("studio_contracts").insert(core).select("id").single());
    }
    if (error || !data) { setBusy(null); alert("Không tạo được hợp đồng: " + (error?.message || "")); return; }
    if (b.package_name) {
      await supabase.from("contract_items").insert({ contract_id: data.id, name: b.package_name, qty: 1, unit_price: b.package_price || 0, position: 0 });
    }
    // Khách đặt lịch kèm voucher ưu đãi → áp luôn vào hợp đồng vừa tạo (dòng
    // giảm giá, máy chủ tự tính % theo gói). Hỏng thì chỉ báo: hợp đồng đã có,
    // studio áp tay ở tab Thanh toán được.
    if (b.voucher_code) {
      const r = await fetch("/api/studio/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // bookingId: máy chủ đã kiểm SĐT mở khoá voucher lúc khách gửi yêu cầu.
        body: JSON.stringify({ action: "redeem", code: b.voucher_code, contractId: data.id, bookingId: b.id }),
      }).then((x) => x.json()).catch(() => null);
      if (!r?.ok) {
        alert(
          `Chưa áp được voucher ${b.voucher_code}: ${REDEEM_ERROR_TEXT[r?.error as keyof typeof REDEEM_ERROR_TEXT] ?? (r?.error === "nothing_to_discount" ? "hợp đồng chưa có giá để trừ" : r?.error || "lỗi mạng")}. Bạn áp lại ở tab Thanh toán của hợp đồng nhé.`
        );
      }
    }
    // Yêu cầu đặt lịch chỉ có dịch vụ dạng CHỮ TỰ DO ("makeup cô dâu", "chụp
    // kỷ yếu"…), không phải gói dịch vụ có mã, nên không suy ra nhóm được. Hợp
    // đồng tạo ra nhận shoot_type mặc định của database là 'photo' → nhóm chụp;
    // gieo đúng danh sách của nhóm đó. Studio đổi gói dịch vụ thì sửa lại
    // checklist trong hợp đồng.
    await supabase
      .from("contract_tasks")
      .insert(DEFAULT_TASKS_BY_KIND.shoot.map((label, position) => ({ contract_id: data.id, label, position })));
    await supabase.from("studio_bookings").update({ status: "handled" }).eq("id", b.id);
    router.push(`/dashboard/studio/contracts/${data.id}`);
  }

  // "Tất cả" bỏ qua mục đã lưu trữ (xem riêng ở tab "Lưu trữ").
  const filtered = filterStatus === "all"
    ? list.filter((b) => b.status !== "archived")
    : list.filter((b) => b.status === filterStatus);

  const counts = list.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  function copyLink() {
    navigator.clipboard?.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return {
    list, copied, copyLink, busy, bookingUrl, editState, setEditState, editBusy, filterStatus, setFilterStatus,
    updateStatus, confirmDeposit, deleteBooking, saveEdit, toContract, filtered, counts,
  };
}
