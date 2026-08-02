repo: vieetjk01/Studio
branch: claude/stoic-fermi-gf0pg4
path: src/app/dashboard/studio

## Last sync
date: 2026-08-01T15:15:00Z

### Updated in this project
- Dựng lại toàn bộ giao diện quản lý studio thành 1 Design Component (desktop + mobile).
- Gom 40 mục nav của StudioShell thành 12 mục / 5 nhóm, thêm chuyển đổi phân quyền Chủ / Quản lý / Nhân sự.
- Thêm hàng đợi "Cần xử lý ngay" trên Tổng quan và stepper 7 bước cho vòng đời hợp đồng.
- Trạng thái hợp đồng đặt lại nhãn tiếng Việt dễ hiểu (Nháp → Chờ khách duyệt → Khách đã duyệt → Đang thực hiện → Hoàn thành → Đã huỷ).

## Screen map
| Màn hình trong bản thiết kế | File nguồn trong repo |
| --- | --- |
| Khung app, sidebar, topbar | src/components/StudioShell.tsx |
| Tổng quan | src/app/dashboard/studio/page.tsx |
| Hợp đồng & lịch hẹn | src/app/dashboard/studio/contracts/ContractsListView.tsx, src/lib/contract-filter.ts |
| Chi tiết hợp đồng | src/app/dashboard/studio/contracts/[id]/, src/lib/contract-status.ts, src/lib/types.ts |
| Báo giá | src/app/dashboard/studio/quotes/QuotesListView.tsx |
| Yêu cầu mới | src/app/dashboard/studio/leads/LeadsView.tsx |
| Lịch làm việc | src/app/dashboard/studio/calendar/CalendarView.tsx, team/TeamCalendar.tsx |
| Khách hàng + hồ sơ | src/app/dashboard/studio/clients/ClientsView.tsx |
| Thu chi & công nợ | src/app/dashboard/studio/reports/ReportsView.tsx |
| Đối soát tiền công | src/app/dashboard/studio/payroll/PayrollView.tsx |
| Báo cáo | src/app/dashboard/studio/reports/ReportsView.tsx |
| Nhân sự | src/app/dashboard/studio/crew/CrewManager.tsx, staff/StaffManager.tsx |
| Gói dịch vụ | src/app/dashboard/studio/packages/PackagesManager.tsx, pricing/PricingManager.tsx |
| Cài đặt studio | src/app/dashboard/settings/SettingsPanel.tsx |
| Bảng công việc | src/app/dashboard/studio/board/BoardView.tsx |
| Đặt lịch khách | src/app/dashboard/studio/bookings/BookingsView.tsx |
| Xử lý hình ảnh | src/app/dashboard/studio/production/ProductionView.tsx |
| Thư viện album | src/app/dashboard/AlbumList.tsx, albums/[id]/AlbumEditor.tsx |
| Phòng váy | src/app/dashboard/studio/rental/RentalManager.tsx |
| Thiết bị | src/app/dashboard/studio/equipment/EquipmentManager.tsx |
| Sản phẩm cho khách (4 tab) | studio/thiep/, studio/story/, studio/album-designer/, studio/slide/ |
| Xếp hạng | src/app/dashboard/studio/ranking/page.tsx |
| Mẫu tin nhắn | src/app/dashboard/studio/messages/MessagesManager.tsx |
| Dịch vụ & điều khoản | studio/services/ServicesManager.tsx, src/lib/contract-clauses.ts |
| Gói & bảng giá (tab Bảng giá lẻ) | studio/pricing/PricingManager.tsx |
| Website & chatbox | studio/chatbox/ChatboxConfig.tsx, dashboard/site/, SiteRenderer.tsx |
| Công cụ ảnh | dashboard/filter/, dashboard/compress/, studio/drive-sync/ |
| Thông báo | studio/notifications/NotificationsList.tsx, NotificationBell.tsx |
| Tài khoản & bảo mật | dashboard/account/AccountPanel.tsx |
| Gói phần mềm | dashboard/upgrade/page.tsx, src/lib/plans.ts, PlanUsage.tsx |
| Affiliate | dashboard/affiliate/page.tsx, admin/affiliate/page.tsx |
| Ứng dụng máy tính | studio/desktop/DesktopPanel.tsx, RestorePanel.tsx, desktop/ |
| Quản trị hệ thống | dashboard/admin/AdminPanel.tsx, admin/system/SystemPanel.tsx |

## Ghi chú
- Nhãn trạng thái, vai trò nhân sự, loại thanh toán lấy từ `src/lib/types.ts` (CONTRACT_STATUS_LABEL, CREW_ROLE_LABEL, PAYMENT_KIND_LABEL, QUOTE_STATUS_LABEL).
- Bảng màu nền/chữ giữ tông ấm của `src/app/globals.css`; màu nhấn tím lấy từ ảnh tham khảo người dùng gửi.
