"use client";

import { useEffect, useState } from "react";

/** Đồng hồ đếm ngược mm:ss tới lúc link hết hạn. */
export default function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span>30 phút</span>;
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <span className="tabular-nums font-medium text-neutral-200">{left ? `${mm}:${ss}` : "đã hết hạn"}</span>;
}
