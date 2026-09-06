"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";

export default function Brand({ href = "/" }: { href?: string }) {
  const { theme } = useTheme();
  return (
    <Link href={href} className="flex items-center">
      <img
        src={theme === "dark" ? "/logo-wordmark-dark.svg" : "/logo-wordmark.svg"}
        alt="mstudo"
        className="h-[38px] w-auto object-contain"
      />
    </Link>
  );
}
