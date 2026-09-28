"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import InstallPwaButton from "@/components/InstallPwaButton";

/**
 * Nút tải ứng dụng theo gói:
 *  - 2 gói lớn nhất (Photographer Plus + Studio) → "Tải MStudo Desktop".
 *  - Các gói còn lại → nút cài web app (PWA).
 * `desktop` do StudioShell tính: đúng gói, là chủ studio, trang tải chưa bị ẩn —
 * không thì nút dẫn tới trang 404 hoặc trang "chỉ dành cho chủ studio".
 */
export default function DownloadAppButton({ desktop }: { desktop: boolean }) {
  if (desktop) {
    return (
      <Link
        href="/dashboard/studio/desktop"
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
        style={{ background: "var(--brandSoft)", color: "var(--brand)" }}
      >
        <Monitor size={16} /> Tải MStudo Desktop
      </Link>
    );
  }
  return <InstallPwaButton />;
}
