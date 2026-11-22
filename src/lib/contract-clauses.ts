// Ready-to-use Vietnamese contract clauses for a photo/video studio.
// Defaults are sensible; edit the [bracketed] parts per contract.
export type Clause = { key: string; label: string; text: string };

export const CONTRACT_CLAUSES: Clause[] = [
  {
    key: "deposit",
    label: "Đặt cọc & thanh toán",
    text:
      "1. ĐẶT CỌC & THANH TOÁN\n" +
      "- Khách đặt cọc theo kế hoạch thanh toán của hợp đồng để giữ lịch; lịch chỉ được xác nhận sau khi studio nhận cọc.\n" +
      "- Phần còn lại thanh toán chậm nhất vào ngày chụp (hoặc trước khi bàn giao sản phẩm).\n" +
      "- Tiền cọc không hoàn lại nếu khách đơn phương huỷ.",
  },
  {
    key: "cancel",
    label: "Huỷ & dời lịch",
    text:
      "2. HUỶ & DỜI LỊCH\n" +
      "- Khách được dời lịch 01 lần miễn phí nếu báo trước ít nhất 07 ngày và tuỳ lịch trống của studio.\n" +
      "- Huỷ trong vòng 07 ngày trước buổi chụp: mất tiền cọc.\n" +
      "- Studio nếu phải huỷ vì lý do chủ quan sẽ hoàn 100% cọc hoặc sắp xếp ê-kíp thay thế.",
  },
  {
    key: "delivery",
    label: "Thời gian giao sản phẩm",
    text:
      "3. THỜI GIAN BÀN GIAO\n" +
      "- Ảnh xem trước (chưa chỉnh): trong 03 ngày sau buổi chụp.\n" +
      "- Ảnh đã chỉnh sửa: trong 15–20 ngày kể từ khi khách chọn ảnh.\n" +
      "- Album/Video (nếu có): trong 30–45 ngày. Thời gian có thể thay đổi vào mùa cao điểm và sẽ được thông báo trước.",
  },
  {
    key: "copyright",
    label: "Bản quyền & sử dụng ảnh",
    text:
      "4. BẢN QUYỀN & SỬ DỤNG HÌNH ẢNH\n" +
      "- Studio giữ bản quyền tác giả đối với toàn bộ ảnh/video.\n" +
      "- Khách được toàn quyền sử dụng cho mục đích cá nhân.\n" +
      "- Studio có quyền sử dụng sản phẩm để quảng bá (website, mạng xã hội, dự thi). Nếu khách muốn giữ kín, vui lòng thông báo bằng văn bản trước buổi chụp.",
  },
  {
    key: "cooperation",
    label: "Hợp tác từ khách",
    text:
      "5. TRÁCH NHIỆM CỦA KHÁCH\n" +
      "- Khách cung cấp đầy đủ thông tin, có mặt đúng giờ; thời gian khách đến trễ được tính vào thời lượng buổi chụp.\n" +
      "- Chi phí phát sinh ngoài thoả thuận (vé tham quan, gửi xe, di chuyển ngoài khu vực, phụ thu giờ) do khách chi trả.",
  },
  {
    key: "liability",
    label: "Rủi ro & bồi thường",
    text:
      "6. RỦI RO & GIỚI HẠN TRÁCH NHIỆM\n" +
      "- Studio thực hiện công việc với trách nhiệm chuyên môn cao nhất.\n" +
      "- Với sự cố khách quan (thời tiết, thiết bị hỏng đột xuất), studio chủ động phương án thay thế tương đương.\n" +
      "- Mức bồi thường tối đa (nếu có lỗi từ studio) không vượt quá giá trị hợp đồng.",
  },
  {
    key: "forcemajeure",
    label: "Bất khả kháng",
    text:
      "7. BẤT KHẢ KHÁNG\n" +
      "- Trường hợp thiên tai, dịch bệnh, quy định của cơ quan nhà nước… khiến không thể thực hiện, hai bên cùng dời lịch mà không phạt cọc.",
  },
  {
    key: "retention",
    label: "Lưu trữ file",
    text:
      "8. LƯU TRỮ FILE\n" +
      "- Studio lưu file trong 03 tháng kể từ ngày bàn giao; sau thời hạn này studio có thể xoá để giải phóng dung lượng.\n" +
      "- Khách vui lòng tải về và tự sao lưu sản phẩm đã nhận.",
  },
];

/** All clauses joined into one terms block. */
export function fullClauseText(): string {
  return CONTRACT_CLAUSES.map((c) => c.text).join("\n\n");
}
