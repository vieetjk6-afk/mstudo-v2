/**
 * LỜI HƯỚNG DẪN TẠO HỢP ĐỒNG — một nguồn duy nhất.
 *
 * Cùng bộ chữ này chạy ở hai nơi:
 *   • scripts/huong-dan-tao-hop-dong.mjs — in lên ảnh chụp và thuyết minh video,
 *   • src/app/huong-dan/tao-hop-dong     — trang hướng dẫn đọc trên web.
 *
 * Để hai nơi tự chép của nhau thì chỉ cần sửa một chỗ là bộ kia nói khác đi mà
 * không ai thấy — trang web bảo bấm nút A trong khi video chỉ vào nút B.
 *
 * Script Node nạp thẳng file .ts này bằng `node --experimental-strip-types`,
 * nên ở đây KHÔNG được import gì theo alias `@/…` (node không hiểu alias) và
 * cũng không dùng cú pháp cần biên dịch thật (enum, decorator, namespace).
 */

/** Một bước trong hướng dẫn. */
export type BuocHuongDan = {
  /** Khoá của bước, cũng là tên file ảnh (`<ten>.png`). */
  ten: string;
  /** Nhãn nhỏ phía trên tiêu đề: "Bắt đầu", "Bước 2/5"… */
  tag: string;
  tieuDe: string;
  /** Các ý của bước. Chữ giữa hai dấu ** được nhấn mạnh. */
  y: string[];
  /** Một câu duy nhất chạy dưới video ở cảnh này. */
  loi: string;
};

export const HUONG_DAN_TAO_HOP_DONG: BuocHuongDan[] = [
  {
    ten: "buoc-0-mo-man",
    tag: "Bắt đầu",
    tieuDe: "Mở màn tạo hợp đồng",
    y: [
      "Vào **Hợp đồng** ở thanh bên trái, bấm nút **+ Hợp đồng mới** ở góc trên bên phải.",
      "Màn tạo hợp đồng chia làm **5 bước**, hỏi đúng thứ tự studio vẫn hỏi khách qua điện thoại.",
      "Thanh 5 bước luôn dính ở đầu trang: bấm vào bước **đã qua** để quay lại sửa bất cứ lúc nào.",
      "Bấm **Lưu nháp** ở bất kỳ bước nào cũng được — miễn là đã có số điện thoại khách.",
    ],
    loi: "Hợp đồng → + Hợp đồng mới. Màn tạo chia 5 bước, mỗi bước một câu hỏi.",
  },
  {
    ten: "buoc-1-khach-hang",
    tag: "Bước 1/5",
    tieuDe: "Hợp đồng này của ai?",
    y: [
      "Khách mới: gõ thẳng **Tên khách hàng** và **Số điện thoại**.",
      "Khách cũ: gõ tên hoặc số vào ô tìm rồi bấm vào dòng khách — hai ô trên tự điền.",
      "SĐT phải đủ **10 số**: khách dùng chính số này làm mật khẩu mở cổng hợp đồng.",
      "Xong thì bấm **Chọn gói** để sang bước 2.",
    ],
    loi: "Bước 1 — chọn khách cũ từ danh sách, tên và số điện thoại tự điền vào.",
  },
  {
    ten: "buoc-2-goi-dich-vu",
    tag: "Bước 2/5",
    tieuDe: "Khách chụp gói nào?",
    y: [
      "**Điều khoản áp dụng** quyết định bộ điều khoản in ra hợp đồng; màn chỉ hiện bảng giá của đúng dịch vụ đó.",
      "**Loại dịch vụ** quyết định nhóm hợp đồng (Chụp / Makeup & thuê đồ / Trọn gói) — hạng mục gợi ý và checklist đổi theo.",
      "Chọn **1 gói chính**, rồi **sửa thẳng ô giá** nếu đã thương lượng khác bảng giá (bảng giá gốc không đổi).",
      "Tick thêm **Hạng mục thêm**, và gõ **Gói riêng** cho thứ không có trong bảng giá.",
      "Tổng ở cuối bước cộng từ các hạng mục — đây là số dùng để chia tiền ở bước 4.",
    ],
    loi: "Bước 2 — chọn gói chính, sửa giá đã thương lượng, tick hạng mục thêm.",
  },
  {
    ten: "buoc-3-lich-nhan-su",
    tag: "Bước 3/5",
    tieuDe: "Chụp khi nào, ai đi?",
    y: [
      "**Ngày chụp** gõ theo dd/mm/yyyy — app không nhận ngày trong quá khứ, và hiện luôn ngày âm bên dưới.",
      "**Giờ bắt đầu** là giờ của hợp đồng; **giờ kết thúc** lưu thành ca của từng người được phân công.",
      "Bấm vào từng người trong sổ thợ để phân công, rồi gõ **tiền công** của người đó.",
      "Tiền công nhập ở đây chính là số dùng để tính lợi nhuận ở bước 5.",
    ],
    loi: "Bước 3 — ngày giờ, địa điểm, rồi bấm chọn thợ và gõ tiền công từng người.",
  },
  {
    ten: "buoc-4-thanh-toan",
    tag: "Bước 4/5",
    tieuDe: "Khách trả tiền thế nào?",
    y: [
      "App chia sẵn **cọc giữ lịch** (làm tròn 500K, khoảng 20–30% hợp đồng) và phần còn lại khi giao sản phẩm.",
      "Sửa tiền một đợt thì **đợt cuối tự đổi** cho khớp tổng — không phải trừ nhẩm.",
      "Mỗi đợt đặt một **hạn thu** riêng để app nhắc khách đúng ngày.",
      "Thiếu tài khoản nhận tiền thì cổng khách không có mã QR — khai trong **Gói & bảng giá**.",
    ],
    loi: "Bước 4 — sửa tiền cọc, đợt cuối tự đổi theo. Mỗi đợt một hạn thu riêng.",
  },
  {
    ten: "buoc-5-kiem-tra",
    tag: "Bước 5/5",
    tieuDe: "Kiểm tra lần cuối rồi gửi khách ký",
    y: [
      "Bảng tóm tắt liệt kê lại mọi thứ — **bấm vào dòng nào là nhảy về đúng bước đó** để sửa.",
      "Khối tiền cộng từ hạng mục, trừ tiền công, ra **lợi nhuận dự kiến**; dưới 45% app cảnh báo lãi mỏng.",
      "Đặt lại **tên hợp đồng** nếu muốn, và tick sẵn checklist hậu kỳ / thư mục ảnh / quay phim.",
      "**Lưu nháp** để quay lại sau, hoặc **Tạo & gửi khách ký** để mở thẳng tab gửi khách (chép link, gửi Zalo, khách ký điện tử và thấy mã QR chuyển cọc).",
    ],
    loi: "Bước 5 — soát lại, xem lợi nhuận, rồi bấm Tạo & gửi khách ký.",
  },
];

/** Thư mục chứa ảnh + video do scripts/huong-dan-tao-hop-dong.mjs sinh ra. */
export const THU_MUC_HUONG_DAN = "/huong-dan/tao-hop-dong";

/**
 * Video hướng dẫn, HAI định dạng theo thứ tự ưu tiên.
 *
 * MP4 (H.264) đứng trước vì đó là thứ duy nhất máy nào cũng phát được — kể cả
 * Safari trên iPhone đời cũ, nơi .webm chỉ hiện một ô đen. Playwright chỉ quay
 * được .webm nên script đổi sang MP4 sau khi quay; máy không có ffmpeg thì chỉ
 * còn .webm, và thẻ <video> tự rơi xuống nguồn thứ hai.
 */
export const VIDEO_TAO_HOP_DONG: { src: string; type: string }[] = [
  { src: `${THU_MUC_HUONG_DAN}/huong-dan-tao-hop-dong.mp4`, type: "video/mp4" },
  { src: `${THU_MUC_HUONG_DAN}/huong-dan-tao-hop-dong.webm`, type: "video/webm" },
];

export const anhCuaBuoc = (b: BuocHuongDan) => `${THU_MUC_HUONG_DAN}/${b.ten}.png`;

/**
 * Cắt chuỗi có dấu ** thành từng đoạn thường / đậm.
 *
 * Không dùng markdown thật cho bốn dòng chữ: nó kéo theo một thư viện, và cả
 * chuỗi ở đây chỉ cần đúng một kiểu nhấn mạnh.
 */
export function chiaDam(s: string): { chu: string; dam: boolean }[] {
  return s
    .split("**")
    .map((chu, i) => ({ chu, dam: i % 2 === 1 }))
    .filter((p) => p.chu !== "");
}
