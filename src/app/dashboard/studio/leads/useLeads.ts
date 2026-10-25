"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "./LeadsView";

/* Phần LOGIC dùng chung của màn Yêu cầu mới (bản cũ LeadsView và bản mới
   LeadsV2): danh sách đang hiện và đổi trạng thái đã liên hệ / mới. */

export function fmtLeadTime(ts: string): string {
  try {
    return new Date(ts).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function zaloUrl(phone: string): string {
  return `https://zalo.me/${phone.replace(/\D/g, "")}`;
}

export function useLeads(leads: Lead[]) {
  const supabase = createClient();
  const [rows, setRows] = useState<Lead[]>(leads);

  async function setStatus(id: string, status: Lead["status"]) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("website_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  }

  const newCount = rows.filter((r) => r.status === "new").length;

  return { rows, setStatus, newCount };
}
