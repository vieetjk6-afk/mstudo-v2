"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Sparkles, Presentation, type LucideIcon } from "lucide-react";

/**
 * Dải tab cho nhóm "Thiệp · Story · Slide".
 *
 * Sidebar gộp ba màn này vào MỘT mục (`src/lib/studio-nav.ts` khai
 * `match: ["/dashboard/studio/story", "/dashboard/studio/slide"]`), nên khi đang
 * ở màn Thiệp thì không còn đường nào tới Story và Slide — người dùng thấy tên
 * mục có đủ ba chữ mà bên trong chỉ có thiệp. Dải này là đường đi còn thiếu.
 *
 * Dùng .hscroll để trên điện thoại nó lướt ngang chứ không xuống hàng.
 */
const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/studio/thiep", label: "Thiệp cưới", icon: Heart },
  { href: "/dashboard/studio/story", label: "Love Story", icon: Sparkles },
  { href: "/dashboard/studio/slide", label: "Slide", icon: Presentation },
];

export default function ThiepTabs() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Thiệp · Story · Slide"
      className="hscroll mb-4 min-w-0 max-w-full gap-[3px] rounded-[11px] p-[3px]"
      style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
    >
      {TABS.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
            style={{
              color: on ? "var(--ac)" : "var(--tx2)",
              background: on ? "var(--sf)" : "transparent",
              boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none",
            }}
          >
            <t.icon size={14} /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
