/**
 * Ghép PHẢN HỒI (RSVP) với DANH SÁCH KHÁCH MỜI của thiệp cưới.
 *
 * Mỗi khách mời có link riêng `?guest=<tên>`; form xác nhận trên thiệp tự điền
 * sẵn đúng tên đó, nên phản hồi được ghép theo tên. Không có mã khách riêng
 * trong bảng wedding_rsvps — khách sửa hẳn tên đi thì phản hồi rơi vào nhóm
 * "ngoài danh sách", vẫn hiện để cặp đôi tự đối chiếu.
 *
 * Không import gì: chạy được cả ở trình duyệt lẫn trong bài test node.
 */

export type RsvpLike = { guest_name: string; attending: boolean; num_guests: number; wish: string | null; created_at: string };

export type GuestStatus<R extends RsvpLike> = { name: string; index: number; rsvp: R | null };

export type GuestRsvpSummary<R extends RsvpLike> = {
  guests: GuestStatus<R>[];
  /** Phản hồi không khớp khách nào trong danh sách (mỗi tên một dòng, bản mới nhất). */
  others: R[];
  attending: number;   // số khách mời (trong danh sách) sẽ tham dự
  declined: number;    // số khách mời báo không dự
  pending: number;     // số khách mời chưa phản hồi
  people: number;      // tổng số người sẽ đến — gồm cả khách ngoài danh sách
};

/** So tên: bỏ hoa/thường, khoảng trắng thừa, dạng Unicode (dựng sẵn/tổ hợp). */
export const exactKey = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
/** Bỏ luôn dấu — khách gõ lại tên không dấu vẫn nhận ra (chỉ dùng khi không nhầm sang người khác). */
export const looseKey = (s: string) => exactKey(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function matchGuestRsvps<R extends RsvpLike>(guests: string[], rsvps: R[]): GuestRsvpSummary<R> {
  // Mới nhất trước: khách gửi lại (đổi ý) thì lấy lần gửi sau cùng.
  const sorted = [...rsvps].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  const byExact = new Map<string, number>();
  const byLoose = new Map<string, number[]>();
  guests.forEach((g, i) => {
    if (!byExact.has(exactKey(g))) byExact.set(exactKey(g), i);
    const l = looseKey(g);
    byLoose.set(l, [...(byLoose.get(l) ?? []), i]);
  });

  const found = new Map<number, R>();
  const others = new Map<string, R>();
  for (const r of sorted) {
    const loose = byLoose.get(looseKey(r.guest_name));
    const i = byExact.get(exactKey(r.guest_name)) ?? (loose?.length === 1 ? loose[0] : undefined);
    if (i !== undefined) { if (!found.has(i)) found.set(i, r); }
    else if (!others.has(exactKey(r.guest_name))) others.set(exactKey(r.guest_name), r);
  }

  const list = guests.map((name, index) => ({ name, index, rsvp: found.get(index) ?? null }));
  const other = [...others.values()];
  const yes = (r: R | null) => !!r && r.attending;
  return {
    guests: list,
    others: other,
    attending: list.filter((g) => yes(g.rsvp)).length,
    declined: list.filter((g) => g.rsvp && !g.rsvp.attending).length,
    pending: list.filter((g) => !g.rsvp).length,
    people: [...list.map((g) => g.rsvp), ...other].reduce((s, r) => s + (yes(r) ? r!.num_guests || 0 : 0), 0),
  };
}
