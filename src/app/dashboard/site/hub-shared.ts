import { fmtDate } from "@/lib/date";

/* Phần tính toán dùng chung của màn Website & chatbox (bản cũ WebsiteHub và
   bản giao diện mới WebsiteHubV2). */

/** Ngày cập nhật gần nhất, nói theo kiểu người đọc ("3 ngày trước"). */
export function updatedAgo(updatedAt: string): string {
  const d = new Date(updatedAt).getTime();
  if (!d) return "";
  const days = Math.floor((Date.now() - d) / 86400_000);
  if (days <= 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  if (days < 30) return `${days} ngày trước`;
  return fmtDate(updatedAt);
}

/** Kịch bản chatbox: mỗi dòng gạch đầu dòng trong ô hướng dẫn là một luật. */
export function chatRules(instructions: string): string[] {
  return instructions
    .split("\n")
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
}

/** Lời chào mặc định khi studio chưa đặt. */
export const DEFAULT_GREETING = "Xin chào! Studio có thể giúp gì cho anh/chị hôm nay?";
