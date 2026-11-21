"use client";

import { fmtDateTime } from "@/lib/date";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "./LeadsView";

/* Phần LOGIC dùng chung của màn Yêu cầu mới (bản cũ LeadsView và bản mới
   LeadsV2): danh sách đang hiện và đổi trạng thái đã liên hệ / mới. */

/** Giờ VN cố định (không theo múi giờ máy — máy chủ UTC, khách UTC+7 → lệch
 *  7 tiếng giữa bản SSR và bản trình duyệt, kèm lỗi hydration). */
export function fmtLeadTime(ts: string): string {
  return fmtDateTime(ts) || ts;
}

export function zaloUrl(phone: string): string {
  return `https://zalo.me/${phone.replace(/\D/g, "")}`;
}

export function useLeads(leads: Lead[]) {
  const supabase = createClient();
  const [rows, setRows] = useState<Lead[]>(leads);

  async function setStatus(id: string, status: Lead["status"]) {
    const prev = rows.find((r) => r.id === id)?.status;
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("website_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    // Lưu hỏng → trả lại trạng thái cũ, không để màn hình nói một đằng DB một nẻo.
    if (error && prev) {
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status: prev } : r)));
      alert("Chưa lưu được trạng thái — thử lại nhé.");
    }
  }

  const newCount = rows.filter((r) => r.status === "new").length;

  return { rows, setStatus, newCount };
}
