/**
 * @NHẮC TÊN trong ghi chú nội bộ hợp đồng (tính năng mới số 13).
 *
 * Tách riêng khỏi component vì đây là phần dễ sai nhất: tên tiếng Việt có dấu,
 * có tên là tiền tố của tên khác, và không phải cứ thấy "@" là một lời nhắc.
 */

/** Bỏ dấu để gõ "@thao" cũng khớp "Thảo Huỳnh". */
export function noAccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

export type NotePart = {
  /** Chữ ĐÚNG NHƯ NGƯỜI DÙNG GÕ — để hiện lại y nguyên trên màn hình. */
  text: string;
  mention: boolean;
  /**
   * Tên CHUẨN trong danh sách (chỉ có ở mảnh nhắc tên). Gõ "@thao huynh" không
   * dấu vẫn ra "Thảo Huỳnh" — cột `mentions` lưu bản chuẩn này, nếu không thì
   * sau đó lọc theo tên hay gửi thông báo đều trượt.
   */
  name?: string;
};

/**
 * Cắt nội dung thành mảnh chữ thường và mảnh @nhắc-tên, khớp theo DANH SÁCH
 * người có thật — không bắt bừa mọi chuỗi sau dấu @ (email `a@b.com` không phải
 * lời nhắc).
 *
 * Tên DÀI được thử trước tên ngắn: ê-kíp có cả "Thảo" lẫn "Thảo Huỳnh" thì
 * "@Thảo Huỳnh" phải khớp trọn họ tên, không dừng ở "@Thảo" rồi bỏ lại chữ
 * "Huỳnh" lạc lõng.
 */
export function splitMentions(body: string, names: string[]): NotePart[] {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const out: NotePart[] = [];
  let buf = "";
  let i = 0;
  while (i < body.length) {
    // Chỉ tính là lời nhắc khi "@" đứng đầu dòng hoặc sau khoảng trắng — nếu
    // không thì phần tên miền của email cũng bị tô như một cái tên.
    const atWordStart = i === 0 || /\s/.test(body[i - 1]);
    if (body[i] === "@" && atWordStart) {
      const rest = noAccent(body.slice(i + 1));
      const hit = sorted.find((n) => rest.startsWith(noAccent(n)));
      if (hit) {
        if (buf) { out.push({ text: buf, mention: false }); buf = ""; }
        out.push({ text: `@${body.slice(i + 1, i + 1 + hit.length)}`, mention: true, name: hit });
        i += 1 + hit.length;
        continue;
      }
    }
    buf += body[i];
    i++;
  }
  if (buf) out.push({ text: buf, mention: false });
  return out;
}

/** Các tên thật sự được nhắc trong nội dung (để lưu vào cột `mentions`). */
export function extractMentions(body: string, names: string[]): string[] {
  return [...new Set(splitMentions(body, names).flatMap((p) => (p.name ? [p.name] : [])))];
}
