-- ─────────────────────────────────────────────────────────────────────────
-- Nhân sự hợp đồng: thêm vai trò 'makeup' (Trang điểm) và 'hair' (Làm tóc)
--
-- Vì sao: hợp đồng nhóm "Makeup & thuê đồ" không có lấy MỘT vai trò nào đúng
-- nghề — danh sách chỉ có Photographer / Cameraman / Sửa ảnh / Trợ lý / Khác.
-- Studio phải chọn "Khác" cho thợ trang điểm, rồi bảng lương, cổng thợ và tin
-- nhắn Zalo gửi thợ đều hiện "Khác".
--
-- Ô chọn vai trò trong hợp đồng giờ lọc theo nhóm (CREW_ROLES_BY_KIND trong
-- src/lib/contract-kind.ts): hợp đồng chụp không hiện "Trang điểm", hợp đồng
-- makeup không hiện "Cameraman", trọn gói hiện tất cả.
--
-- Bảng studio_crew (danh sách thợ) KHÔNG cần sửa: cột role ở đó là chữ tự do,
-- không có ràng buộc.
--
-- KHÔNG đổi dữ liệu cũ. Chạy được nhiều lần.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.contract_crew
  drop constraint if exists contract_crew_role_check;

alter table public.contract_crew
  add constraint contract_crew_role_check
  check (role in ('photographer', 'cameraman', 'makeup', 'hair',
                  'assistant', 'editor', 'other'));
