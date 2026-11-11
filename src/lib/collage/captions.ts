/* ═══════════════════════════════════════════════════════════════════════════
   THƯ VIỆN LỜI CHÚC + CAPTION KHI ĐĂNG BÀI.

   • Lời chúc / câu để CHÈN VÀO ẢNH, chia theo dịp (cảm ơn, hạnh phúc, tình
     yêu, vu quy · thành hôn, tiếng Anh ngắn). Câu ngắn, viết riêng cho tính
     năng này (không chép thơ / lời bài hát có bản quyền).
   • Caption gợi ý để DÁN KHI ĐĂNG (Facebook, Instagram): điền tên cô dâu chú
     rể, ngày cưới, tên studio; kèm hashtag. Khách bấm "Sao chép".
   Thuần — kiểm thử bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface WishGroup {
  id: string;
  name: string;
  lines: string[];
}

export const WISHES: WishGroup[] = [
  {
    id: "thanks",
    name: "Cảm ơn",
    lines: [
      "Cảm ơn mọi người đã đến chung vui cùng chúng mình",
      "Cảm ơn vì đã là một phần trong ngày đẹp nhất của tụi mình",
      "Lời cảm ơn chân thành nhất gửi đến gia đình và bạn bè",
      "Cảm ơn bố mẹ — người đã nuôi dưỡng tình yêu này",
      "Thật vui vì có mọi người trong ngày hôm ấy",
      "Mỗi lời chúc của mọi người là món quà vô giá",
    ],
  },
  {
    id: "happy",
    name: "Hạnh phúc",
    lines: [
      "Chúng mình cưới rồi!",
      "Từ hôm nay, nhà mình có thêm một người",
      "Hạnh phúc là được ở bên nhau mỗi ngày",
      "Bắt đầu chương mới của hai đứa mình",
      "Về chung một nhà",
      "Một ngày thật đẹp, một đời thật dài",
      "Trăm năm hạnh phúc",
      "Ngày chung đôi",
    ],
  },
  {
    id: "love",
    name: "Tình yêu",
    lines: [
      "Gặp nhau là duyên, ở bên nhau là lựa chọn",
      "Nắm tay nhau đi hết quãng đường còn lại",
      "Em là điều tuyệt vời nhất anh từng có",
      "Anh ở đây, cho tất cả những ngày sau",
      "Yêu thương không cần nói nhiều, chỉ cần ở cạnh",
      "Cùng nhau già đi, cùng nhau hạnh phúc",
    ],
  },
  {
    id: "rite",
    name: "Vu quy · Thành hôn",
    lines: [
      "Lễ Vu Quy",
      "Lễ Thành Hôn",
      "Lễ Tân Hôn",
      "Lễ Gia Tiên",
      "Tơ hồng se duyên",
      "Song hỷ lâm môn",
    ],
  },
  {
    id: "en",
    name: "Tiếng Anh",
    lines: ["Just married", "Happily ever after", "Our wedding day", "Forever starts today", "Thank you for coming", "Love, always", "Mr & Mrs", "Save the date"],
  },
];

export interface CaptionCtx {
  names?: string | null;
  date?: string | null;
  studio?: string | null;
}

/** Hashtag từ tên: "Lan & Minh" → "#LanMinh". Bỏ dấu tiếng Việt để hashtag đúng. */
export function nameTag(names: string | null | undefined): string {
  const s = (names ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .replace(/[^A-Za-z0-9]+/g, "");
  return s.length >= 2 && s.length <= 30 ? `#${s}` : "";
}

/** Caption gợi ý khi đăng bài (đã điền tên / ngày / studio). Dòng trống thì bỏ. */
export function captionsFor(c: CaptionCtx): string[] {
  const names = (c.names ?? "").trim();
  const date = (c.date ?? "").trim();
  const studio = (c.studio ?? "").trim();
  const credit = studio ? `📸 ${studio}` : "";
  const tags = ["#wedding", "#damcuoi", nameTag(names)].filter(Boolean).join(" ");
  const join = (...lines: string[]) => lines.filter((l) => l && l.trim()).join("\n");
  return [
    join(`Chúng mình về chung một nhà rồi 💍${date ? ` · ${date}` : ""}`, credit, tags),
    join(`Cảm ơn mọi người đã đến chung vui cùng ${names || "chúng mình"} ❤️`, "Những khoảnh khắc này tụi mình sẽ nhớ mãi.", credit, tags),
    join(`Ngày chung đôi 🤍${date ? ` ${date}` : ""}`, names ? `${names} — bắt đầu chương mới.` : "Bắt đầu chương mới của hai đứa mình.", credit),
    join(`Just married ✨${names ? ` ${names}` : ""}`, date, credit, tags),
    join("Hạnh phúc là được ở bên nhau mỗi ngày.", names ? `— ${names}${date ? `, ${date}` : ""}` : date, credit),
  ];
}
