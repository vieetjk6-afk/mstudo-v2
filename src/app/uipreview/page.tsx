import { notFound } from "next/navigation";
import Link from "next/link";
import { SCREENS } from "./screens";

/**
 * XEM TRƯỚC GIAO DIỆN — chỉ chạy ở máy dev, KHÔNG tồn tại trên production.
 *
 * Vì sao cần: gần hết màn hình của app nằm sau đăng nhập + Supabase, nên không
 * mở được để nhìn nếu chỉ có mã nguồn — và các trạng thái hiếm (rỗng, lỗi, chưa
 * cấu hình, tên dài, số tiền 8 chữ số) thì gần như không dựng lại được bằng tay
 * đúng lúc cần nhìn.
 *
 * Mỗi màn một đường riêng /uipreview/<khoá> để chụp ảnh từng cái một. Thêm màn
 * mới ở `screens.tsx`, dữ liệu giả ở `fixtures.ts`.
 */
export default function UiPreviewIndex() {
  if (process.env.NODE_ENV === "production") notFound();
  const keys = Object.keys(SCREENS);
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-serif text-2xl font-medium">Xem trước giao diện</h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--text3)" }}>
        Dữ liệu giả, chỉ có ở bản dev. {keys.length} màn — chụp tất cả bằng{" "}
        <code>npm run ui:shot</code>.
      </p>
      <ul className="mt-5 space-y-1.5">
        {keys.map((k) => (
          <li key={k}>
            <Link
              href={`/uipreview/${k}`}
              className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13.5px]"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            >
              <span>{SCREENS[k].title}</span>
              <code className="text-[11px]" style={{ color: "var(--text3)" }}>{k}</code>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
