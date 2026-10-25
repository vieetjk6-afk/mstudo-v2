/* Tiêu đề topbar của khu quản lý studio — dùng chung cho khung cũ
 * (StudioShell) và khung mới (StudioShellV2), để hai khung không mỗi bên đặt
 * tên màn một kiểu. */

/** Tiêu đề + phụ đề topbar theo tiền tố route (khớp dài nhất thắng). */
export const TITLES: [string, string, string][] = [
  ["/dashboard/studio/quotes/new", "Tạo báo giá", "Ghép gói và hạng mục, xem trước bản khách nhận"],
  ["/dashboard/studio/quotes", "Báo giá", "Gửi khách · theo dõi · chốt thành hợp đồng"],
  ["/dashboard/studio/contracts/new", "Tạo hợp đồng", "Điền lần lượt từng bước, lưu nháp khi cần"],
  ["/dashboard/studio/contracts", "Hợp đồng & lịch hẹn", "Toàn bộ buổi chụp và tiến độ"],
  ["/dashboard/studio/templates", "Mẫu hợp đồng", "Mẫu hợp đồng & điều khoản"],
  ["/dashboard/studio/board", "Bảng công việc", "Kéo thẻ sang cột khác để đổi trạng thái"],
  ["/dashboard/studio/bookings", "Đặt lịch khách", "Yêu cầu đặt lịch gửi từ website và trang giá"],
  ["/dashboard/studio/leads", "Yêu cầu mới", "Khách đặt lịch từ website & chatbox"],
  // Ba màn lịch cũ đã gộp thành các tab của /calendar, nên chỉ còn MỘT dòng ở
  // đây; /schedule và /team giờ là route chuyển hướng, không kịp vẽ topbar.
  ["/dashboard/studio/calendar", "Lịch làm việc", "Buổi chụp · Lịch studio · Đội ngũ"],
  ["/dashboard/studio/production", "Xử lý hình ảnh", "Ảnh, video, in ấn của mọi hợp đồng"],
  ["/dashboard/studio/rental", "Phòng váy", "Kho trang phục và đơn cho thuê"],
  ["/dashboard/studio/equipment", "Thiết bị", "Máy móc, ống kính, đèn và lịch mượn"],
  ["/dashboard/studio/clients", "Khách hàng", "Danh bạ và lịch sử giao dịch"],
  ["/dashboard/studio/reviews", "Đánh giá khách", "Duyệt, trả lời và đi xin cảm nhận"],
  ["/dashboard/studio/thiep", "Thiệp cưới", "Chọn mẫu, điền nội dung, gửi link cho khách"],
  ["/dashboard/studio/story", "Love Story", "Dòng thời gian chuyện tình của cặp đôi"],
  ["/dashboard/studio/slide", "Slide cưới", "Dựng video chiếu tiệc từ ảnh đã chọn"],
  ["/dashboard/studio/album-designer", "Thiết kế album", "Dàn trang album in cho từng hợp đồng"],
  ["/dashboard/studio/album-categories", "Danh mục album", "Nhóm album theo thể loại"],
  ["/dashboard/studio/reports", "Thu chi & công nợ", "Dòng tiền thực tế của studio"],
  ["/dashboard/studio/payroll", "Đối soát tiền công", "Tiền công theo từng nhân sự"],
  ["/dashboard/studio/branches", "Chi nhánh", "Nhiều cơ sở trong một tài khoản — đội ngũ, lịch và doanh thu riêng"],
  ["/dashboard/studio/crew", "Nhân sự", "Đang chuyển sang màn Nhân viên & phân quyền…"],
  ["/dashboard/studio/staff", "Nhân viên & phân quyền", "Tài khoản, vai trò và sổ thợ của studio"],
  ["/dashboard/studio/ranking", "Xếp hạng đội ngũ", "Theo số buổi nhận và thu nhập từ studio"],
  ["/dashboard/studio/messages", "Mẫu tin nhắn", "Tin soạn sẵn gửi khách qua Zalo / SMS"],
  ["/dashboard/studio/pricing", "Gói & bảng giá", "Bảng giá và nội dung từng gói"],
  ["/dashboard/studio/packages", "Gói dịch vụ", "Nội dung, giá và cách hiện trên website"],
  ["/dashboard/studio/services", "Dịch vụ & điều khoản", "Bộ điều khoản áp dụng tự động cho từng loại dịch vụ"],
  ["/dashboard/studio/chatbox", "Website & chatbox", "Dạy trợ lý trả lời theo ý bạn"],
  ["/dashboard/studio/drive-sync", "Đồng bộ Drive", "Kết nối Google Drive & tự đồng bộ ảnh/video hợp đồng"],
  ["/dashboard/studio/notifications", "Thông báo", "Mọi hoạt động của studio theo thời gian"],
  ["/dashboard/studio/desktop", "Ứng dụng máy tính", "Tự lưu hợp đồng và sao lưu dữ liệu ngoại tuyến"],
  ["/dashboard/studio/inbox", "Hộp thư", "Tin nhắn khách từ mọi mạng xã hội"],
  ["/dashboard/studio/vouchers", "Voucher & thẻ quà", "Bán thẻ quà, khách dùng ở hợp đồng"],
  ["/dashboard/studio/vendors", "Nhà cung cấp", "Đơn đặt ngoài và sổ nhà cung cấp"],
  ["/dashboard/studio/audit", "Nhật ký thao tác", "Ai ghi, sửa, xoá tiền và hợp đồng"],
  ["/dashboard/studio", "Tổng quan", "Toàn cảnh studio hôm nay"],
  ["/dashboard/albums/new", "Tạo album", "Tạo nhanh album chọn ảnh từ Google Drive"],
  ["/dashboard/albums", "Thư viện album", "Album chọn ảnh và album giao khách"],
  ["/dashboard/create", "Tạo album", "Tạo album giao khách mới"],
  // /dashboard/tools là route CHÍNH của mục "Công cụ ảnh" nhưng trước giờ không
  // có dòng nào ở đây, nên nó rơi xuống mục "/dashboard" cuối bảng và topbar ghi
  // nhầm thành "Thư viện album".
  ["/dashboard/tools", "Công cụ ảnh", "Lọc ảnh khách chọn, nén ảnh và đóng dấu"],
  ["/dashboard/filter", "Lọc ảnh khách chọn", "Tách ảnh khách đã chọn ra thư mục riêng"],
  ["/dashboard/compress", "Nén ảnh & watermark", "Xử lý hàng loạt trước khi giao khách"],
  ["/dashboard/site/builder", "Giao diện website", "Sắp xếp khối nội dung trang studio"],
  ["/dashboard/site", "Website & chatbox", "Trang portfolio và trợ lý trả lời khách"],
  ["/dashboard/upgrade", "Gói phần mềm", "Gói đang dùng và hạn mức của studio"],
  ["/dashboard/connections", "Kết nối", "Tích hợp dịch vụ bên ngoài"],
  ["/dashboard/affiliate", "Affiliate", "Giới thiệu studio khác và nhận hoa hồng"],
  ["/dashboard/admin/system", "Cài đặt hệ thống", "Thông báo toàn studio, sao lưu & khôi phục"],
  ["/dashboard/admin/affiliate", "Quản lý Affiliate", "Danh sách hoa hồng"],
  ["/dashboard/admin", "Người dùng & studio", "Tài khoản, gói, DUYỆT yêu cầu nâng cấp & mã giảm giá"],
  ["/dashboard/settings", "Cấu hình mstudo", "Cấu hình nền tảng, gói & giá, nội dung trang nâng cấp, góp ý"],
  ["/dashboard/account", "Tài khoản & bảo mật", "Thông tin đăng nhập, mật khẩu, thiết bị"],
  // Tổng quát nhất nằm cuối để mọi route ở trên khớp trước.
  ["/dashboard", "Thư viện album", "Tất cả album của bạn"],
];

/** [tiêu đề, phụ đề] của route đang mở — khớp tiền tố dài nhất đứng trước. */
export function pageTitle(pathname: string): [string, string] {
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? [hit[1], hit[2]] : ["Studio", ""];
}
