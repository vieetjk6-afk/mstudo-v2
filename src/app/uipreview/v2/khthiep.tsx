/* Màn xem trước GIAO DIỆN MỚI của nhóm "khthiep" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell).
 *
 * Nhóm này: trình sửa thiệp cưới /thiep/sua/<token> (cặp đôi + studio mở bằng
 * link) và trình sửa Love Story /story/sua/<token>. Dữ liệu giả + API giả ở
 * ./khthiep-demo.tsx; mẫu thiệp / trang story là bộ dựng thật (không vẽ lại). */
import { EditorsV1Demo, StoryEditorV2Demo, WeddingEditorV2Demo } from "./khthiep-demo";

export const SCREENS_KHTHIEP: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  /* ── Thiệp cưới ── */
  "v2-thiep-sua": {
    title: "V2 · Sửa thiệp cưới — khối Cô dâu & chú rể mở sẵn, xem trước điện thoại bên phải (điện thoại: tab Sửa)",
    render: () => <WeddingEditorV2Demo />,
    bare: true,
  },
  "v2-thiep-sua-ngay": {
    title: "V2 · Sửa thiệp cưới — Ngày giờ & địa điểm (sự kiện sửa trong ngăn kéo, lịch trình, bản đồ)",
    render: () => <WeddingEditorV2Demo section="date" />,
    bare: true,
  },
  "v2-thiep-sua-mau": {
    title: "V2 · Sửa thiệp cưới — Mẫu thiệp (mẫu đang dùng, dải màu, nút Đổi mẫu mở ngăn kéo lưới mẫu)",
    render: () => <WeddingEditorV2Demo section="template" />,
    bare: true,
  },
  "v2-thiep-sua-moi": {
    title: "V2 · Sửa thiệp cưới — thiệp mới tinh: bản nháp, còn thiếu cả 6 mục chính (bấm để nhảy tới khối)",
    render: () => <WeddingEditorV2Demo token="demo-v2-new" section={null} />,
    bare: true,
  },
  "v2-thiep-sua-xem-truoc": {
    title: "V2 · Sửa thiệp cưới — tab Xem trước (điện thoại)",
    render: () => <WeddingEditorV2Demo view="preview" />,
    bare: true,
  },
  "v2-thiep-sua-khach": {
    title: "V2 · Sửa thiệp cưới — Khách mời: số liệu phản hồi, thêm nhanh, lọc, mỗi khách một dòng (bấm mở ngăn kéo QR + link)",
    render: () => <WeddingEditorV2Demo view="guests" />,
    bare: true,
  },
  "v2-thiep-sua-khach-khoa": {
    title: "V2 · Sửa thiệp cưới — Khách mời khi phản hồi đang khoá bằng mật khẩu trang xem riêng",
    render: () => <WeddingEditorV2Demo token="demo-v2-lock" view="guests" />,
    bare: true,
  },
  "v2-thiep-sua-qua-cuoi": {
    title: "V2 · Sửa thiệp cưới nhúng trong kế hoạch cưới (Quà cưới): nút về kế hoạch, khách dùng chung",
    render: () => <WeddingEditorV2Demo token="demo-v2-combo" view="guests" embed />,
    bare: true,
  },

  /* ── Love Story ── */
  "v2-story-sua": {
    title: "V2 · Sửa Love Story — khối gập mở, xem trước bằng trang story thật bên phải",
    render: () => <StoryEditorV2Demo />,
    bare: true,
  },
  "v2-story-sua-moc": {
    title: "V2 · Sửa Love Story — Dòng thời gian (bấm mốc mở ngăn kéo sửa)",
    render: () => <StoryEditorV2Demo section="timeline" />,
    bare: true,
  },
  "v2-story-sua-khach": {
    title: "V2 · Sửa Love Story — Khách gửi ảnh & video (đã nối Drive)",
    render: () => <StoryEditorV2Demo section="guests" />,
    bare: true,
  },
  "v2-story-sua-moi": {
    title: "V2 · Sửa Love Story — trang mới tinh (bản nháp, chưa nối Drive)",
    render: () => <StoryEditorV2Demo token="demo-v2-story-new" />,
    bare: true,
  },

  /* ── Đối chiếu: bản cũ cùng dữ liệu (trang thật khi giao diện mới tắt) ── */
  "v2-thiep-sua-ban-cu": {
    title: "Đối chiếu · Sửa thiệp cưới BẢN CŨ (V1) cùng dữ liệu giả",
    render: () => <EditorsV1Demo kind="thiep" />,
    bare: true,
  },
  "v2-story-sua-ban-cu": {
    title: "Đối chiếu · Sửa Love Story BẢN CŨ (V1) cùng dữ liệu giả",
    render: () => <EditorsV1Demo kind="story" />,
    bare: true,
  },
};
