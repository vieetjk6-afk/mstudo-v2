import { BookImage, Video } from "lucide-react";
import AlbumAiPromo from "@/components/AlbumAiPromo";
import { StudioUpsellView } from "@/components/studio/StudioUpsell";
import type { AlbumAiStatus } from "@/lib/albumai";

/**
 * Album AI ở MỌI trạng thái bản quyền + màn mời nâng cấp — những thứ mở bằng
 * tay phải đổi gói tài khoản qua lại mới thấy hết. Bấm "Tải Album AI" trên từng
 * thẻ để xem hộp thoại của đúng trạng thái đó.
 */
const STATES: [string, AlbumAiStatus, string | null][] = [
  ["Studio trả phí — chưa kích hoạt", { state: "ready" }, "studio.hoa-mai@example.com"],
  ["Studio — đã kích hoạt", { state: "active", expiresAt: "2027-10-10T03:00:00.000Z" }, "studio.hoa-mai@example.com"],
  ["Studio dùng thử", { state: "trial" }, "studio.hoa-mai@example.com"],
  ["Gói Photographer / Plus", { state: "upgrade" }, "nhiepanh.minh@example.com"],
  ["Nhân viên studio", { state: "staff" }, null],
  ["Hết 1 năm tặng", { state: "expired", expiresAt: "2026-09-01T03:00:00.000Z" }, "studio.hoa-mai@example.com"],
];

export default function AlbumAiDemo() {
  return (
    <div className="flex flex-col gap-6">
      {STATES.map(([label, status, email]) => (
        <div key={label} data-state={status.state}>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".6px", color: "var(--tx3)" }}>{label}</p>
          <AlbumAiPromo status={status} email={email} dismissible />
        </div>
      ))}
      <StudioUpsellView
        icon={BookImage}
        feature="Thiết kế album"
        desc="Biến folder ảnh cưới thành album in — chọn khổ, chọn mẫu, AI tự rải ảnh & dàn trang rồi xuất file in."
        isStaff={false}
        planLabel="Photographer Plus"
      />
      <StudioUpsellView
        icon={Video}
        feature="Slide ảnh"
        desc="Tự dựng video slideshow ảnh cưới để chiếu tiệc — chọn ảnh, chủ đề, nhạc, hiệu ứng chuyển cảnh rồi xuất video."
        isStaff
        planLabel={null}
      />
    </div>
  );
}
