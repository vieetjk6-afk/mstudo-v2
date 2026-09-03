import { notFound } from "next/navigation";
import Link from "next/link";
import { SCREENS } from "../screens";

/** Một màn xem trước. Chỉ có ở bản dev — xem ghi chú ở ../page.tsx. */
export default function UiPreviewScreen({ params }: { params: { screen: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const screen = SCREENS[params.screen];
  if (!screen) notFound();

  const bar = (
    <div className="mb-4 flex items-center gap-3 text-[12px]" style={{ color: "var(--tx3)" }}>
      <Link href="/uipreview" style={{ color: "var(--ac)" }}>← Tất cả màn</Link>
      <span>{screen.title}</span>
      <span className="ml-auto">dữ liệu giả · bản dev</span>
    </div>
  );

  // Màn `bare` tự dựng khung màu của nó (bảng màu cần so CẢ khung ngoài shell),
  // nên route không bọc gì thêm — bọc vào là mất đúng thứ nó đi kiểm tra.
  if (screen.bare) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div className="px-4 pt-4">{bar}</div>
        {screen.render()}
      </div>
    );
  }

  // Mặc định PHẢI bọc trong .studio-shell: khu quản lý có bộ token RIÊNG khai
  // trong khối đó (xanh thương hiệu #1e9e72, bề mặt trắng, bán kính bo khác),
  // nên dựng ngoài khối là ra màu của :root — ảnh chụp khác app thật.
  //
  // Lưu ý: từ khi :root khai đủ bộ bí danh (--tl, --nu, --brand, --panel…) thì
  // dựng ngoài khối KHÔNG còn làm token rỗng nữa; màn `bang-mau` là chỗ canh
  // để điều đó không âm thầm hỏng lại.
  return (
    <div className="studio-shell" data-theme="light" style={{ background: "var(--bg)", color: "var(--tx)", minHeight: "100vh" }}>
      <div className="p-4">
        {bar}
        {screen.render()}
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(SCREENS).map((screen) => ({ screen }));
}
