import { requireStudio } from "@/lib/auth-guards";
import StudioDenied from "@/components/StudioDenied";
import { brandFrom } from "@/lib/studio-brand";
import { getBranchScope } from "@/lib/branches";
import ContractsListView from "./ContractsListView";

// Trang chỉ gác quyền; danh sách hợp đồng được tải client-side + cache trên máy
// (hiển thị tức thì, làm mới ngầm) qua /api/studio/contracts-list — bỏ độ trễ
// chờ server render lại mỗi lần mở trang.
export default async function ContractsList() {
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này chỉ dành cho tài khoản gói Studio.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  // Chi nhánh đang xem đi vào KHOÁ CACHE của danh sách (xem ghi chú trong
  // ContractsListView) — đổi chi nhánh không được hiện lại danh sách cơ sở cũ.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);

  // Thương hiệu studio in ở đầu file Excel/CSV xuất ra từ màn này.
  return (
    <ContractsListView
      studio={{
        name: brandFrom(profile).name,
        phone: (profile.pl_phone as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      }}
      branchKey={scope.selected ?? "all"}
    />
  );
}
