"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import InstallPwaButton from "@/components/InstallPwaButton";
import { useUiV2 } from "@/components/v2/UiV2Context";

/**
 * Nút tải ứng dụng theo gói:
 *  - 2 gói lớn nhất (Photographer Plus + Studio) → "Tải MStudo Desktop".
 *  - Các gói còn lại → nút cài web app (PWA).
 * `desktop` do StudioShell tính: đúng gói, là chủ studio, trang tải chưa bị ẩn —
 * không thì nút dẫn tới trang 404 hoặc trang "chỉ dành cho chủ studio".
 */
export default function DownloadAppButton(props: { desktop: boolean }) {
  return useUiV2() ? <DownloadAppButtonV2 {...props} /> : <DownloadAppButtonV1 {...props} />;
}

function DownloadAppButtonV1({ desktop }: { desktop: boolean }) {
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

/** Giao diện mới (ngăn kéo điện thoại): một hàng kiểu mục menu có dòng phụ,
 *  thay cho khối nền màu đặc. Gói không có Desktop vẫn là nút cài web app. */
function DownloadAppButtonV2({ desktop }: { desktop: boolean }) {
  if (desktop) {
    return (
      <Link href="/dashboard/studio/desktop" className="v2-nav flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <Monitor size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px]">Tải MStudo Desktop</span>
          <span className="block truncate text-[12px] font-normal" style={{ color: "var(--tx3)" }}>Tự lưu hợp đồng, sao lưu</span>
        </span>
      </Link>
    );
  }
  return <InstallPwaButton />;
}
