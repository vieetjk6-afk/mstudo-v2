import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/fetch-all-rows";

/* ═══════════════════════════════════════════════════════════════════════════
   BÌNH CHỌN HỆ THỐNG — admin hỏi ý kiến mọi tài khoản (bảng system_polls /
   system_poll_votes, xem supabase/migrations/binh_chon.sql). Hai bảng chỉ đi
   qua service-role ở đây; client không đọc thẳng được nên không ai biết ai chọn
   gì — người dùng chỉ thấy tổng số phiếu của từng phương án.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PollAudience = "everyone" | "owners";

export type PollRow = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  audience: PollAudience;
  active: boolean;
  created_at: string;
  closed_at: string | null;
};

/** Bình chọn kèm kết quả — hình dữ liệu gửi về trình duyệt. */
export type PollView = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  active: boolean;
  /** Số phiếu của từng phương án, cùng thứ tự với `options`. */
  counts: number[];
  /** Số NGƯỜI đã bỏ phiếu (chọn nhiều thì tổng `counts` lớn hơn số này). */
  voters: number;
  /** Phương án người đang xem đã chọn; null = chưa bỏ phiếu. */
  mine: number[] | null;
};

export const POLL_COLS = "id, question, options, multi, audience, active, created_at, closed_at";

/** Giới hạn nội dung — admin gõ tay, chặn cỡ để thẻ nổi không vỡ khung. */
export const POLL_LIMITS = { question: 200, option: 120, minOptions: 2, maxOptions: 8 } as const;

/** Tài khoản này có thuộc đối tượng của bình chọn không. */
export function inAudience(poll: Pick<PollRow, "audience">, profile: { studio_owner_id?: string | null }): boolean {
  return poll.audience === "everyone" || !profile.studio_owner_id;
}

/** Đếm phiếu của MỘT bình chọn: số phiếu từng phương án + số người + phiếu của `userId`. */
export async function tally(poll: PollRow, userId: string | null): Promise<PollView> {
  const db = createAdminClient();
  const votes = await fetchAllRows<{ user_id: string; choices: number[] }>((from, to) =>
    db.from("system_poll_votes").select("user_id, choices").eq("poll_id", poll.id).order("user_id").range(from, to)
  );
  const counts = poll.options.map(() => 0);
  let mine: number[] | null = null;
  for (const v of votes) {
    for (const c of v.choices ?? []) if (c >= 0 && c < counts.length) counts[c] += 1;
    if (userId && v.user_id === userId) mine = v.choices ?? [];
  }
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    multi: poll.multi,
    active: poll.active,
    counts,
    voters: votes.length,
    mine,
  };
}

/**
 * Kiểm phiếu gửi lên: mảng chỉ số, không trùng, nằm trong khoảng phương án, ít
 * nhất một; bình chọn một phương án thì đúng một. Trả về mảng đã sắp xếp, hoặc
 * null nếu không hợp lệ.
 */
export function cleanChoices(raw: unknown, poll: Pick<PollRow, "options" | "multi">): number[] | null {
  if (!Array.isArray(raw)) return null;
  const set = new Set<number>();
  for (const x of raw) {
    const n = Number(x);
    if (!Number.isInteger(n) || n < 0 || n >= poll.options.length) return null;
    set.add(n);
  }
  if (set.size === 0) return null;
  if (!poll.multi && set.size !== 1) return null;
  return [...set].sort((a, b) => a - b);
}
