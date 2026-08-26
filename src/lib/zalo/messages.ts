// Trình dựng nội dung tin nhắn Zalo — THUẦN, an toàn cho client (không server-only).
// Dùng cho nút "Gửi cho khách" (deep-link + copy) lẫn gửi tự động phía máy chủ.

/** Build a friendly reminder message for an upcoming shoot. */
export function shootReminderMessage(opts: {
  name?: string | null;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  role?: string | null;
  studio?: string | null;
  /** Cổng thợ — để thợ bấm xem lịch còn lại của mình, không phải hỏi lại studio. */
  link?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Chào ${opts.name || "bạn"},`);
  const what = opts.title ? `"${opts.title}"` : "buổi chụp/quay";
  const when = [opts.date, opts.time].filter(Boolean).join(" ");
  lines.push(
    `Nhắc lịch ${what}${when ? ` vào ${when}` : ""}${opts.location ? ` tại ${opts.location}` : ""}.`
  );
  if (opts.role) lines.push(`Vai trò: ${opts.role}.`);
  lines.push("Vui lòng có mặt đúng giờ nhé. Cảm ơn bạn!");
  if (opts.link) lines.push(`Xem & xác nhận lịch của bạn: ${opts.link}`);
  if (opts.studio) lines.push(`— ${opts.studio}`);
  return lines.join("\n");
}

const hi = (name?: string | null) => `Chào ${name || "anh/chị"},`;
const sign = (studio?: string | null) => (studio ? `\n— ${studio}` : "");

/** Nhắc lịch chụp gửi cho KHÁCH, kèm link form điền thông tin (nếu có). */
export function clientShootReminderMessage(opts: {
  name?: string | null;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  formLink?: string | null;
  studio?: string | null;
}): string {
  const when = [opts.date, opts.time].filter(Boolean).join(" ");
  const lines = [
    hi(opts.name),
    `Studio xin nhắc lịch ${opts.title ? `"${opts.title}"` : "buổi chụp"}${when ? ` vào ${when}` : ""}${
      opts.location ? ` tại ${opts.location}` : ""
    }. 📸`,
  ];
  if (opts.formLink)
    lines.push(`Anh/chị điền giúp em một số thông tin để bên em chuẩn bị chu đáo tại: ${opts.formLink}`);
  lines.push("Hẹn gặp anh/chị đúng giờ nhé ạ!");
  return lines.join("\n") + sign(opts.studio);
}

/** Xác nhận đã nhận cọc + link hợp đồng để khách theo dõi. */
export function depositConfirmMessage(opts: {
  name?: string | null;
  amount?: string | null;
  title?: string | null;
  link?: string | null;
  studio?: string | null;
}): string {
  const lines = [
    hi(opts.name),
    `Studio đã nhận cọc${opts.amount ? ` ${opts.amount}` : ""} cho hợp đồng${
      opts.title ? ` "${opts.title}"` : ""
    }. Cảm ơn anh/chị, bên em đã giữ lịch cho mình ạ.`,
  ];
  if (opts.link) lines.push(`Anh/chị theo dõi hợp đồng (lịch · thanh toán · ảnh) tại: ${opts.link} (mật khẩu là SĐT của anh/chị).`);
  return lines.join("\n") + sign(opts.studio);
}

/** Nhắc thanh toán số tiền còn lại + link hợp đồng. */
export function paymentDueMessage(opts: {
  name?: string | null;
  amount?: string | null;
  title?: string | null;
  link?: string | null;
  overdue?: boolean;
  studio?: string | null;
}): string {
  const lines = [
    hi(opts.name),
    `Hợp đồng${opts.title ? ` "${opts.title}"` : ""} còn lại${opts.amount ? ` ${opts.amount}` : ""} cần thanh toán${
      opts.overdue ? " (đã tới hạn)" : ""
    }. Anh/chị hoàn tất giúp em nhé ạ.`,
  ];
  if (opts.link) lines.push(`Xem chi tiết & mã QR/STK tại: ${opts.link} (mật khẩu là SĐT của anh/chị).`);
  return lines.join("\n") + sign(opts.studio);
}

/** Mời khách chọn ảnh. */
export function selectReadyMessage(opts: {
  name?: string | null;
  link?: string | null;
  studio?: string | null;
}): string {
  const lines = [
    hi(opts.name),
    "Ảnh gốc đã sẵn sàng để anh/chị chọn! Mời anh/chị chọn những tấm ưng ý nhất để bên em chỉnh sửa.",
  ];
  if (opts.link) lines.push(`Chọn ảnh tại: ${opts.link}`);
  return lines.join("\n") + sign(opts.studio);
}

/**
 * Nhắc lại khi khách nhận link chọn ảnh rồi im lặng. Giọng NHẸ dần theo số lần
 * nhắc: lần đầu chỉ hỏi thăm, lần sau mới nói tới ảnh hưởng lịch hậu kỳ. Nhắc
 * mà gắt là mất khách, nhưng không nhắc thì hợp đồng nằm im hàng tháng.
 */
export function selectNudgeMessage(opts: {
  name?: string | null;
  link?: string | null;
  studio?: string | null;
  /** Lần nhắc thứ mấy (1, 2, 3…). */
  round?: number;
  /** Đã bao nhiêu ngày kể từ lúc mời chọn ảnh. */
  days?: number;
}): string {
  const round = opts.round ?? 1;
  const lines = [hi(opts.name)];
  if (round <= 1) {
    lines.push("Bên em thấy anh/chị chưa chọn ảnh, không biết link có mở được không ạ?");
  } else if (round === 2) {
    lines.push(
      `Album chọn ảnh của anh/chị vẫn đang chờ${opts.days ? ` (đã ${opts.days} ngày)` : ""}. Anh/chị chọn giúp em để bên em vào chỉnh sửa nhé ạ.`,
    );
  } else {
    lines.push(
      `Em vẫn giữ album chờ anh/chị chọn ảnh${opts.days ? ` (đã ${opts.days} ngày)` : ""}. Anh/chị chọn sớm giúp em để kịp lịch hậu kỳ ạ.`,
    );
  }
  if (opts.link) lines.push(`Chọn ảnh tại: ${opts.link}`);
  if (round >= 2) lines.push("Nếu anh/chị cần bên em hỗ trợ chọn, nhắn em nhé ạ.");
  return lines.join("\n") + sign(opts.studio);
}

/** Nhắc khách trước khi báo giá hết hiệu lực. */
export function quoteExpiringMessage(opts: {
  name?: string | null;
  link?: string | null;
  studio?: string | null;
  days?: number;
}): string {
  const lines = [hi(opts.name)];
  lines.push(
    opts.days && opts.days > 0
      ? `Báo giá bên em gửi anh/chị còn hiệu lực ${opts.days} ngày nữa ạ.`
      : "Báo giá bên em gửi anh/chị hết hiệu lực hôm nay ạ.",
  );
  if (opts.link) lines.push(`Xem lại báo giá tại: ${opts.link}`);
  lines.push("Anh/chị cần bên em giữ giá hoặc điều chỉnh hạng mục thì nhắn em nhé ạ.");
  return lines.join("\n") + sign(opts.studio);
}

/** Báo đã giao ảnh hoàn thiện. */
export function deliveryReadyMessage(opts: {
  name?: string | null;
  link?: string | null;
  studio?: string | null;
}): string {
  const lines = [hi(opts.name), "Ảnh của anh/chị đã hoàn thiện! Mời anh/chị xem & tải về."];
  if (opts.link) lines.push(`Xem album hoàn thiện tại: ${opts.link}`);
  lines.push("Nếu cần chỉnh thêm anh/chị nhắn em nhé ạ.");
  return lines.join("\n") + sign(opts.studio);
}

/**
 * Nhắc MỘT đợt thanh toán cụ thể trong hợp đồng (nút "Nhắc Zalo" ở tab Thanh
 * toán). Khác `paymentDueMessage` — vốn nói về TỔNG số còn lại — tin này gọi
 * đúng tên đợt, số tiền của đợt đó và kèm mã QR chuyển khoản đã điền sẵn số
 * tiền + nội dung, để khách quét là chuyển được ngay.
 *
 * Ảnh QR gửi kèm là tệp đính kèm của tin (kênh cá nhân); `qrLink` vẫn đưa vào
 * nội dung để khách còn mở được khi kênh gửi không đính kèm được ảnh.
 */
export function instalmentReminderMessage(opts: {
  name?: string | null;
  title?: string | null;
  /** Tên đợt: "Cọc hợp đồng", "Đợt 2"… */
  label?: string | null;
  /** Số tiền của ĐỢT, đã định dạng (vd "5.000.000 ₫"). */
  amount?: string | null;
  /** Hạn thu, dạng dd/mm/yyyy. */
  dueDate?: string | null;
  overdue?: boolean;
  /** "Vietcombank · 0123456789 · NGUYEN VAN A" — để khách chuyển tay nếu cần. */
  bankLine?: string | null;
  /** Nội dung chuyển khoản (trùng với addInfo trong mã QR). */
  transferNote?: string | null;
  /** Ảnh QR (VietQR) — cũng là ảnh đính kèm của tin. */
  qrLink?: string | null;
  /** Cổng khách của hợp đồng. */
  link?: string | null;
  studio?: string | null;
}): string {
  const what = opts.label?.trim() || "đợt thanh toán";
  const lines = [
    hi(opts.name),
    `Studio xin nhắc ${what}${opts.title ? ` của hợp đồng "${opts.title}"` : ""}${
      opts.amount ? `: ${opts.amount}` : ""
    }${
      opts.overdue
        ? ` (đã quá hạn${opts.dueDate ? ` ${opts.dueDate}` : ""})`
        : opts.dueDate
          ? ` (hạn ${opts.dueDate})`
          : ""
    }.`,
  ];
  // Chưa cấu hình ngân hàng thì KHÔNG có ảnh QR gửi kèm — đừng bảo khách quét
  // một mã không tồn tại.
  if (opts.qrLink)
    lines.push("Anh/chị quét mã QR bên dưới là chuyển đúng số tiền & nội dung, không cần nhập tay ạ.");
  if (opts.bankLine) lines.push(`Tài khoản: ${opts.bankLine}`);
  if (opts.transferNote) lines.push(`Nội dung chuyển khoản: ${opts.transferNote}`);
  if (opts.qrLink) lines.push(`Mã QR: ${opts.qrLink}`);
  if (opts.link) lines.push(`Xem hợp đồng & các đợt thanh toán: ${opts.link} (mật khẩu là SĐT của anh/chị).`);
  lines.push("Chuyển xong anh/chị gửi em ảnh chuyển khoản nhé, em cảm ơn ạ!");
  return lines.join("\n") + sign(opts.studio);
}
