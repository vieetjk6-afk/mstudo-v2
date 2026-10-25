"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reviewScore, type ReviewRow } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Đánh giá khách (bản cũ ReviewsView và bản mới
   ReviewsV2): phân loại chờ duyệt / đang hiện / đã ẩn, duyệt, trả lời, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Tab = "pending" | "live" | "hidden" | "all";

export const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Chờ duyệt" },
  { key: "live", label: "Đang hiện" },
  { key: "hidden", label: "Đã ẩn" },
  { key: "all", label: "Tất cả" },
];

/** Nhãn & màu của từng trạng thái — dùng chung cho tab và cho viên trên mỗi
 *  dòng, để hai chỗ không bao giờ nói hai điều khác nhau về cùng một hàng. */
export const BUCKET_LABEL: Record<Exclude<Tab, "all">, string> = {
  pending: "Chờ duyệt",
  live: "Đang hiện",
  hidden: "Đã ẩn",
};
export const BUCKET_TONE: Record<Exclude<Tab, "all">, "amber" | "green" | "gray"> = {
  pending: "amber",
  live: "green",
  hidden: "gray",
};

/** Ba trạng thái nằm trên HAI cột: "chờ duyệt" và "đã ẩn" trong DB đều là
 *  approved=false, nên `moderated_at` (studio đã quyết chưa) mới là thứ tách
 *  được. Cố ý KHÔNG dùng ké `replied_at`: studio soạn lời đáp cho một đánh giá
 *  xấu rồi vẫn chưa quyết cho hiện là chuyện bình thường. */
export const bucketOf = (r: { approved: boolean; moderated_at: string | null }): Exclude<Tab, "all"> =>
  r.approved ? "live" : r.moderated_at ? "hidden" : "pending";

/** Dải sao. `size` nhỏ cho dòng danh sách, to hơn cho ô điểm trung bình. */
export function Stars({ n, size = 13 }: { n: number | null; size?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex flex-none items-center gap-0.5" style={{ color: "var(--am)" }} aria-label={`${n} trên 5 sao`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < n ? "currentColor" : "none"} strokeWidth={i < n ? 0 : 1.6} style={{ opacity: i < n ? 1 : 0.35 }} />
      ))}
    </span>
  );
}

export function useReviews(reviews: ReviewRow[]) {
  const supabase = createClient();
  const [rows, setRows] = useState<ReviewRow[]>(reviews);
  const [tab, setTab] = useState<Tab>(() => (reviews.some((r) => !r.approved) ? "pending" : "all"));
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const score = useMemo(() => reviewScore(rows), [rows]);

  const counts = useMemo(() => {
    const c = { pending: 0, live: 0, hidden: 0, all: rows.length };
    for (const r of rows) c[bucketOf(r)] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => bucketOf(r) === tab)),
    [rows, tab],
  );

  /** Duyệt hoặc ẩn. Cả hai đều là một QUYẾT ĐỊNH, nên cùng đóng `moderated_at`
   *  — nếu không, đánh giá bị ẩn sẽ quay lại tab "Chờ duyệt" mãi và studio phải
   *  ẩn đi ẩn lại. Ghi một patch, cập nhật state một lần. */
  async function setApproved(id: string, approved: boolean) {
    setBusy(id);
    const patch = { approved, moderated_at: new Date().toISOString() };
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from("feedback").update(patch).eq("id", id);
    setBusy(null);
  }

  /** Trả lời KHÔNG đổi trạng thái duyệt: studio được phép soạn lời đáp cho một
   *  đánh giá xấu rồi mới cân nhắc có cho hiện hay không. */
  async function saveReply(id: string) {
    const text = replyText.trim();
    setBusy(id);
    const patch = { reply: text || null, replied_at: text ? new Date().toISOString() : null };
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from("feedback").update(patch).eq("id", id);
    setReplyOpen(null);
    setReplyText("");
    setBusy(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Xoá hẳn đánh giá này? Không lấy lại được.")) return;
    setBusy(id);
    setRows((cur) => cur.filter((r) => r.id !== id));
    await supabase.from("feedback").delete().eq("id", id);
    setBusy(null);
  }

  return {
    rows, tab, setTab, replyOpen, setReplyOpen, replyText, setReplyText, busy, score, counts, visible,
    setApproved, saveReply, remove,
  };
}
