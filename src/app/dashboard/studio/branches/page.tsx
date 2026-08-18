import { Building2 } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";

/**
 * Chi nhánh studio — mục "Sắp ra mắt" trong nhóm Nhân sự.
 *
 * Chưa có tính năng thật, nên trang chỉ giải thích sắp có gì. Sidebar đã khoá
 * mục này với studio (feature_flags.branches ≠ "live"); admin bấm vào được và
 * rơi đúng vào trang này để dựng tiếp.
 */
export default async function BranchesPage() {
  const profile = await requireStudio("full");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Chi nhánh studio chỉ dành cho tài khoản gói <b>Studio</b>.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="card p-8">
        <Building2 size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
        <h1 className="font-serif text-2xl font-medium">Chi nhánh studio · Sắp ra mắt</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
          Quản lý nhiều cơ sở trong cùng một tài khoản: mỗi chi nhánh có đội ngũ,
          lịch chụp và doanh thu riêng, chủ studio xem gộp hoặc tách theo từng
          chi nhánh. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
        </p>
      </div>
    </div>
  );
}
