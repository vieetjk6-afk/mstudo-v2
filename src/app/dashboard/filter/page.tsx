"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FilterTool from "@/components/FilterTool";

/**
 * Trang Lọc ảnh đầy đủ. Toàn bộ chức năng nằm trong <FilterTool/> để popup
 * "Lọc ảnh" ở quản lý album dùng lại y hệt (src/components/FilterDialog.tsx).
 */
export default function FilterPage() {
  return (
    <div className="page-in">
      {/* Quay lại màn Công cụ ảnh — công cụ này là một trong ba thẻ ở đó. */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <Link
          href="/dashboard/tools"
          aria-label="Về Công cụ ảnh"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <ArrowLeft size={17} />
        </Link>
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Khách gửi danh sách tên file — công cụ tự tách những ảnh đó ra thư mục riêng.</p>
      </div>

      <FilterTool readQueryParams />
    </div>
  );
}
