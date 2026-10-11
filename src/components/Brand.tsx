"use client";

import Link from "next/link";

// Logo theo giao diện chọn bằng CSS (.logo-on-light / .logo-on-dark trong
// globals.css), không theo state React — tránh nháy logo sáng khi tải trang tối.
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center">
      <img src="/logo-wordmark.svg" alt="mstudo" className="logo-on-light h-[38px] w-auto object-contain" />
      <img src="/logo-wordmark-dark.svg" alt="mstudo" className="logo-on-dark h-[38px] w-auto object-contain" />
    </Link>
  );
}
