import { toMinutes } from "./appointment-rules";

/* ═══════════════════════════════════════════════════════════════════════════
   CẢNH BÁO TRÙNG LỊCH khi tạo hợp đồng — phần tính toán thuần.

   Hai câu studio cần biết TRƯỚC khi gửi khách ký, không phải sau:
     1. Ngày này studio đã nhận những show nào rồi?
     2. Người vừa phân công có đang đi một show khác trùng giờ không?

   `contract_crew` không nối về `studio_crew` bằng id (thợ được chép tên + SĐT
   vào từng hợp đồng), nên nhận ra "cùng một người" theo SĐT trước, tên sau.

   Chỉ CẢNH BÁO, không chặn: một thợ đi hai show sáng – chiều cùng ngày là
   chuyện thường, và studio là người quyết.
   ═══════════════════════════════════════════════════════════════════════════ */

export type DayContract = {
  id: string;
  code?: string | null;
  title?: string | null;
  client_name?: string | null;
  event_time?: string | null;
};

export type DayCrewRow = {
  contract_id: string;
  name: string | null;
  phone: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type PickedCrew = { name: string; phone: string };

export type CrewClash = {
  crewName: string;
  contract: DayContract;
  /** true = hai khung giờ chồng lên nhau; false = cùng ngày nhưng thiếu giờ để so. */
  overlap: boolean;
  /** Khung giờ của show kia, để hiện ra ("07:00 – 11:00"). */
  otherTime: string;
};

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Show không ghi giờ kết thúc thì coi như kéo dài 4 tiếng — một buổi chụp thường lệ. */
const DEFAULT_SPAN_MIN = 240;

function span(start?: string | null, end?: string | null): { s: number; e: number } | null {
  const s = toMinutes(start);
  if (s == null) return null;
  const e = toMinutes(end);
  return { s, e: e != null && e > s ? e : s + DEFAULT_SPAN_MIN };
}

function fmt(start?: string | null, end?: string | null): string {
  const s = (start ?? "").slice(0, 5);
  const e = (end ?? "").slice(0, 5);
  if (s && e) return `${s} – ${e}`;
  return s || "chưa ghi giờ";
}

function samePerson(p: PickedCrew, r: DayCrewRow): boolean {
  const a = digits(p.phone);
  const b = digits(r.phone);
  if (a.length >= 9 && b.length >= 9) return a === b;
  const n = norm(p.name);
  return !!n && n === norm(r.name);
}

/**
 * Người đã chọn cho hợp đồng mới đang có mặt ở show nào khác cùng ngày.
 * Giờ của show mới = giờ bắt đầu/kết thúc ở bước Lịch; giờ show kia = ca của
 * đúng người đó, không có thì giờ của hợp đồng kia.
 */
export function crewClashes(
  picked: PickedCrew[],
  contracts: DayContract[],
  crew: DayCrewRow[],
  start?: string | null,
  end?: string | null
): CrewClash[] {
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const mine = span(start, end);
  const out: CrewClash[] = [];
  const seen = new Set<string>();
  for (const p of picked) {
    for (const r of crew) {
      const c = byId.get(r.contract_id);
      if (!c || !samePerson(p, r)) continue;
      const key = `${p.phone}|${p.name}|${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const otherStart = r.start_time || c.event_time || null;
      const other = span(otherStart, r.end_time);
      const overlap = mine && other ? mine.s < other.e && other.s < mine.e : false;
      // Cả hai đều có giờ và KHÔNG chồng nhau → không phải trùng, bỏ qua.
      if (mine && other && !overlap) continue;
      out.push({ crewName: p.name || p.phone, contract: c, overlap, otherTime: fmt(otherStart, r.end_time) });
    }
  }
  // Trùng giờ thật lên trước.
  return out.sort((a, b) => Number(b.overlap) - Number(a.overlap));
}
