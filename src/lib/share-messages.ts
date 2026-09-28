// Lời nhắn đi kèm link khi studio chia sẻ cho khách — THUẦN, dùng chung cho
// nút Gửi Zalo / Messenger lẫn nút "Chép link". Một chỗ soạn nên hai đường gửi
// không bao giờ lệch chữ: khách nhận qua Zalo hay qua tin dán tay đều như nhau.

const hi = (name?: string | null) => `Chào ${name?.trim() || "anh/chị"}`;

/** Mời khách xem album ảnh. */
export function albumShareMessage(name: string | null | undefined, link: string): string {
  return `${hi(name)}, mời anh/chị xem album ảnh tại: ${link}`;
}

/** Tặng khách thiệp cưới online — link để khách tự sửa. */
export function weddingEditMessage(link: string): string {
  return `Chúc mừng anh/chị! Bên em tặng anh/chị thiệp cưới online. Anh/chị mở link này để tự điền thông tin & chọn ảnh nhé: ${link}`;
}

/** Tặng khách trang Love Story — link để khách tự sửa. */
export function storyEditMessage(link: string): string {
  return `Bên em tặng anh/chị trang Love Story. Mở link này để điền nội dung & dán link folder ảnh/video Google Drive của mình nhé: ${link}`;
}

/** Gửi báo giá. */
export function quoteShareMessage(name: string | null | undefined, title: string | null | undefined, link: string): string {
  const what = title?.trim() ? `báo giá "${title.trim()}"` : "báo giá";
  return `${hi(name)}, bên em gửi anh/chị ${what}. Anh/chị xem chi tiết và chọn gói tại: ${link}. Cần điều chỉnh gì anh/chị cứ nhắn em nhé!`;
}

/** Nhờ khách đánh giá sau khi đã giao album. */
export function reviewRequestMessage(name: string | null | undefined, link: string): string {
  return `${hi(name)}, cảm ơn anh/chị đã tin tưởng bên em! Nếu hài lòng với bộ ảnh, anh/chị để lại vài dòng cảm nhận giúp em tại: ${link}. Em cảm ơn ạ!`;
}
