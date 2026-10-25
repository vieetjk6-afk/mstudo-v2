/**
 * Phần DÙNG CHUNG của danh sách báo giá — bản cũ (QuotesListView) và giao diện
 * mới (QuotesListV2) cùng gọi: đổi trạng thái và các con số pipeline. Để một
 * chỗ cho hai bản không lệch nhau.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { quoteSelectedTotal, type QuoteStatus } from "@/lib/types";
import type { QuoteRow } from "./QuotesListView";

/** Danh sách báo giá trên máy + đổi trạng thái (lạc quan, rồi làm mới server). */
export function useQuoteRows(initialList: QuoteRow[]) {
  const [rows, setRows] = useState<QuoteRow[]>(initialList);
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function changeStatus(id: string, next: QuoteStatus) {
    if (next === "converted") return; // "đã tạo hợp đồng" chỉ do luồng tạo HĐ đặt
    setUpdating(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    await supabase.from("studio_quotes").update({ status: next }).eq("id", id);
    setUpdating(null);
    router.refresh();
  }

  return { rows, updating, changeStatus };
}

export const quoteTotal = (q: QuoteRow) => quoteSelectedTotal(q.quote_items || []);

/**
 * Báo giá còn trong hạn theo NGÀY. Quá hạn thì KHÔNG còn là "đang chờ khách":
 * trang của khách đã khoá nút đồng ý ngay khi qua ngày hết hiệu lực
 * (QuoteClientView tự tính theo ngày), trong khi trạng thái trong DB chỉ được
 * cron đổi sang "expired" mỗi ngày một lần.
 */
export const quoteStillOpen = (r: QuoteRow, nowMs: number) => !r.expires_at || new Date(r.expires_at).getTime() >= nowMs;

/** Đang chờ khách: đã gửi / khách đã xem / khách xin chỉnh, và còn hạn. */
export const quoteWaiting = (r: QuoteRow, nowMs: number) =>
  (r.status === "sent" || r.status === "viewed" || r.status === "adjust_requested") && quoteStillOpen(r, nowMs);

/** Con số pipeline của trang báo giá. */
export function quotePipeline(rows: readonly QuoteRow[], nowMs: number) {
  const waiting = rows.filter((r) => quoteWaiting(r, nowMs));
  const won = rows.filter((r) => r.status === "accepted" || r.status === "converted");
  const closable = rows.filter((r) => r.status !== "draft");
  return {
    waiting,
    won,
    waitingValue: waiting.reduce((s, q) => s + quoteTotal(q), 0),
    /** Tỉ lệ khách đồng ý (%), trên các báo giá đã gửi đi. */
    rate: closable.length ? Math.round((won.length / closable.length) * 100) : 0,
  };
}
