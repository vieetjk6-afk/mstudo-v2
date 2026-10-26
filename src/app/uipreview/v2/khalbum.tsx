/* Màn xem trước GIAO DIỆN MỚI của nhóm "khalbum" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell). */
import AlbumUnavailableV2 from "@/app/a/[slug]/AlbumUnavailableV2";
import { KhAlbumChonDemo, KhAlbumGiaoDemo, KhAlbumMatDemo, KhAlbumThuMucDemo, KhAlbumTrungDemo } from "./khalbum-demo";

/* Album của khách (trang không đăng nhập): /a/[slug] chọn ảnh, /album/[slug]
 * giao khách, /album thư mục. Dữ liệu và ảnh giả ở ./khalbum-demo. Khung xem ảnh
 * mở bằng cách bấm một ô: screen "v2-album-chon" + click `[aria-label^="Xem ảnh"]`. */
export const SCREENS_KHALBUM: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-album-chon": {
    title: "V2 · Album chọn ảnh — đang chọn 7/30, có ảnh bìa, 2 thư mục, khuôn mặt",
    render: () => <KhAlbumChonDemo />,
    bare: true,
  },
  "v2-album-chon-moi": {
    title: "V2 · Album chọn ảnh — lần đầu mở: chưa chọn gì, không giới hạn, đang quét khuôn mặt",
    render: () => <KhAlbumChonDemo variant="moi" />,
    bare: true,
  },
  "v2-album-chon-khoa": {
    title: "V2 · Album chọn ảnh — có mật khẩu",
    render: () => <KhAlbumChonDemo variant="khoa" />,
    bare: true,
  },
  "v2-album-chon-rong": {
    title: "V2 · Album chọn ảnh — album chưa có ảnh",
    render: () => <KhAlbumChonDemo variant="rong" />,
    bare: true,
  },
  "v2-album-chon-chiase": {
    title: "V2 · Album chọn ảnh — link chia sẻ ảnh đã chọn (chỉ xem)",
    render: () => <KhAlbumChonDemo variant="chiase" />,
    bare: true,
  },
  "v2-album-chon-wm": {
    title: "V2 · Album chọn ảnh — có watermark, không ảnh bìa",
    render: () => <KhAlbumChonDemo variant="wm" />,
    bare: true,
  },
  "v2-album-trung": {
    title: "V2 · Album chọn ảnh — ngăn kéo “Ảnh na ná nhau” đã quét xong",
    render: () => <KhAlbumTrungDemo />,
    bare: true,
  },
  "v2-album-mat": {
    title: "V2 · Album chọn ảnh — ngăn kéo “Tìm ảnh có mặt bạn”",
    render: () => <KhAlbumMatDemo />,
    bare: true,
  },
  "v2-album-giao": {
    title: "V2 · Album giao khách — có ảnh bìa, tải tất cả, ảnh in tặng, 2 thư mục, video, cảm nhận",
    render: () => <KhAlbumGiaoDemo />,
    bare: true,
  },
  "v2-album-giao-khoa": {
    title: "V2 · Album giao khách — có mật khẩu (số điện thoại)",
    render: () => <KhAlbumGiaoDemo variant="khoa" />,
    bare: true,
  },
  "v2-album-giao-chiase": {
    title: "V2 · Album giao khách — link chia sẻ vài ảnh",
    render: () => <KhAlbumGiaoDemo variant="chiase" />,
    bare: true,
  },
  "v2-album-giao-gon": {
    title: "V2 · Album giao khách — không bìa, không cho tải, không ảnh in",
    render: () => <KhAlbumGiaoDemo variant="gon" />,
    bare: true,
  },
  "v2-album-khong-co": {
    title: "V2 · Album không xem được (chưa xuất bản / hết hạn)",
    render: () => <AlbumUnavailableV2 brand={{ name: "Mây Studio", logoUrl: null }} title="Album này hiện không xem được" />,
    bare: true,
  },
  "v2-album-thu-muc": {
    title: "V2 · Thư mục album (/album) — tìm, ảnh/video, loại album, nhóm theo tháng",
    render: () => <KhAlbumThuMucDemo />,
    bare: true,
  },
};
