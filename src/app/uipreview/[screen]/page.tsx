import { notFound } from "next/navigation";
import Link from "next/link";
import { SCREENS } from "../screens";

/** Một màn xem trước. Chỉ có ở bản dev — xem ghi chú ở ../page.tsx. */
export default function UiPreviewScreen({ params }: { params: { screen: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const screen = SCREENS[params.screen];
  if (!screen) notFound();
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3 text-[12px]" style={{ color: "var(--text3)" }}>
        <Link href="/uipreview" style={{ color: "var(--accent)" }}>← Tất cả màn</Link>
        <span>{screen.title}</span>
        <span className="ml-auto">dữ liệu giả · bản dev</span>
      </div>
      {screen.render()}
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(SCREENS).map((screen) => ({ screen }));
}
