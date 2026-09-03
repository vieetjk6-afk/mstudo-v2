/**
 * NHẮC KỶ NIỆM & CHỤP LẠI — khách cũ là khách rẻ nhất mà studio đang bỏ quên.
 *
 * Cặp đôi chụp cưới năm nay là khách *kỷ niệm 1 năm* của năm sau, rồi *đầy tháng
 * / thôi nôi* của em bé, rồi *kỷ niệm 5 năm*. Studio nào cũng biết điều đó và
 * gần như không studio nào làm, vì không ai ngồi rà lại sổ hợp đồng ba năm
 * trước để xem tháng này có ai tới mốc.
 *
 * Module này tính ra danh sách đó. Cố ý KHÔNG cần bảng mới: mốc suy ra từ
 * `studio_contracts.shoot_date` + loại dịch vụ đã có sẵn, nên bật lên là chạy
 * ngay trên dữ liệu cũ, không phải chờ studio nhập thêm gì.
 *
 * Tự đứng một mình (không import gì) để bộ test nạp thẳng được — xem ghi chú ở
 * @/lib/lead-source.
 */

/** Số năm đáng nhắc. 2 và 4 cố ý BỎ: nhắc mọi năm thì thành làm phiền, và
 *  studio ngưng đọc danh sách. Mốc tròn mới có cớ để khách chi tiền. */
export const MILESTONE_YEARS = [1, 3, 5, 10] as const;

export type MilestoneKind = "wedding" | "baby" | "generic";

export type Milestone = {
  contractId: string;
  clientName: string | null;
  clientPhone: string | null;
  /** Tiêu đề hợp đồng gốc — để studio nhớ ra đây là buổi nào. */
  title: string | null;
  kind: MilestoneKind;
  years: number;
  /** Ngày kỷ niệm trong năm đang xét, dạng YYYY-MM-DD. */
  date: string;
  /** Số ngày kể từ hôm nay (âm = đã qua). */
  inDays: number;
};

type ContractLike = {
  id: string;
  title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  /** Ngày chụp. Không có ngày thì không có mốc — bỏ qua, không đoán bừa. */
  event_date?: string | null;
  shoot_type?: string | null;
  status?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** So sánh chuỗi YYYY-MM-DD nên tính bằng UTC để không lệch múi giờ. */
function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / 86400000);
}

/**
 * Cộng N năm vào một ngày. 29/2 cộng vào năm thường thì lùi về 28/2 — cách này
 * đúng với cách người Việt ăn kỷ niệm, và quan trọng hơn là KHÔNG nhảy sang
 * 01/3 như `new Date()` tự làm (nhắc sai ngày là mất cả ý nghĩa lời chúc).
 */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ny = y + years;
  const last = new Date(Date.UTC(ny, m, 0)).getUTCDate();
  return `${ny}-${pad(m)}-${pad(Math.min(d, last))}`;
}

/** Buổi chụp cưới → kỷ niệm cưới; chụp bé → sinh nhật bé; còn lại là chung. */
export function milestoneKind(shootType?: string | null, title?: string | null): MilestoneKind {
  const hay = `${shootType || ""} ${title || ""}`.toLowerCase();
  if (/(baby|bé|be |em bé|newborn|thôi nôi|thoi noi|đầy tháng|day thang|sinh nhật|sinh nhat)/.test(hay)) return "baby";
  if (/(wedding|cưới|cuoi|ăn hỏi|an hoi|đính hôn|dinh hon|vu quy|tân hôn|tan hon)/.test(hay)) return "wedding";
  return "generic";
}

export const MILESTONE_LABEL: Record<MilestoneKind, (years: number) => string> = {
  wedding: (y) => `Kỷ niệm ${y} năm ngày cưới`,
  baby: (y) => `Bé tròn ${y} tuổi`,
  generic: (y) => `${y} năm buổi chụp`,
};

/**
 * Những mốc rơi vào cửa sổ [hôm nay − backDays, hôm nay + aheadDays].
 *
 * Cửa sổ có phần LÙI VỀ QUÁ KHỨ là cố ý: studio mở app hai tuần một lần, mốc
 * vừa qua hôm kia vẫn còn kịp nhắn một câu chúc muộn — bỏ nó đi thì đúng những
 * khách sắp tới ngày lại là những khách trôi mất.
 */
export function upcomingMilestones(
  contracts: ContractLike[],
  today: string,
  opts: { aheadDays?: number; backDays?: number } = {},
): Milestone[] {
  const ahead = opts.aheadDays ?? 45;
  const back = opts.backDays ?? 7;
  const out: Milestone[] = [];

  for (const c of contracts) {
    if (!c.event_date) continue;
    // Hợp đồng huỷ không còn là khách để chúc mừng.
    if (c.status === "cancelled") continue;
    // Ngày chụp trong TƯƠNG LAI thì chưa có kỷ niệm nào để nhắc.
    if (c.event_date > today) continue;

    const kind = milestoneKind(c.shoot_type, c.title);
    for (const years of MILESTONE_YEARS) {
      const date = addYears(c.event_date, years);
      const inDays = daysBetween(today, date);
      if (inDays > ahead || inDays < -back) continue;
      out.push({
        contractId: c.id,
        clientName: c.client_name ?? null,
        clientPhone: c.client_phone ?? null,
        title: c.title ?? null,
        kind,
        years,
        date,
        inDays,
      });
    }
  }

  // Gần nhất trước; cùng ngày thì mốc lớn hơn trước (10 năm đáng gọi hơn 1 năm).
  out.sort((a, b) => a.inDays - b.inDays || b.years - a.years);
  return out;
}

/** Lời chúc soạn sẵn — studio sửa lại trước khi gửi cũng được. */
export function milestoneMessage(m: {
  clientName?: string | null;
  kind: MilestoneKind;
  years: number;
  studio?: string | null;
}): string {
  const hi = `Chào ${m.clientName || "anh/chị"},`;
  const body =
    m.kind === "wedding"
      ? `Hôm nay là tròn ${m.years} năm ngày cưới của anh chị rồi đó ạ! Bên em vẫn giữ trọn bộ ảnh ngày ấy. Chúc anh chị luôn hạnh phúc như ngày đầu.`
      : m.kind === "baby"
        ? `Chúc mừng bé tròn ${m.years} tuổi ạ! Nhanh thật, mới ngày nào bên em còn chụp cho bé.`
        : `Vậy là đã ${m.years} năm kể từ buổi chụp của mình rồi ạ. Bên em vẫn lưu bộ ảnh đó nhé.`;
  const offer =
    m.kind === "baby"
      ? "Anh chị có muốn chụp một bộ đánh dấu tuổi mới cho bé không ạ? Khách cũ bên em luôn có ưu đãi riêng."
      : "Anh chị có muốn chụp một bộ kỷ niệm không ạ? Khách cũ bên em luôn có ưu đãi riêng.";
  return [hi, body, offer, m.studio ? `— ${m.studio}` : null].filter(Boolean).join("\n");
}
