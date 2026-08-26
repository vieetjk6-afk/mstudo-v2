import { notFound } from "next/navigation";
import Link from "next/link";
import { SCREENS } from "../screens";

/** Một màn xem trước. Chỉ có ở bản dev — xem ghi chú ở ../page.tsx. */
export default function UiPreviewScreen({ params }: { params: { screen: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const screen = SCREENS[params.screen];
  if (!screen) notFound();
  // PHẢI bọc trong .studio-shell: gần hết design token của khu quản lý
  // (--tl, --nu, --gn, --sf2…) khai báo trong khối đó chứ không phải :root.
  // Dựng ngoài khối là token rỗng — viên trạng thái mất nền, chấm màu mất màu,
  // và ảnh chụp ra khác hẳn app thật. Chính bẫy này đã được ghi lại một lần
  // trong globals.css khi hộp thoại portal ra <body>.
  return (
    <div className="studio-shell" data-theme="light" style={{ background: "var(--bg)", color: "var(--tx)", minHeight: "100vh" }}>
      <div className="p-4">
        <div className="mb-4 flex items-center gap-3 text-[12px]" style={{ color: "var(--tx3)" }}>
          <Link href="/uipreview" style={{ color: "var(--ac)" }}>← Tất cả màn</Link>
          <span>{screen.title}</span>
          <span className="ml-auto">dữ liệu giả · bản dev</span>
        </div>
        {screen.render()}
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(SCREENS).map((screen) => ({ screen }));
}
