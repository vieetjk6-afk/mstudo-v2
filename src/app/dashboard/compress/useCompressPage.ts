"use client";

import { useEffect, useState } from "react";
import { pickerConfigured, preloadGoogle, requestDriveToken } from "@/lib/google-picker";
import type { Tool, QuotaState } from "./useCompressTool";

/**
 * Phần LOGIC của trang /dashboard/compress dùng chung cho bản cũ và bản mới:
 * công cụ đang mở, hạn mức nén (đọc + trừ lượt), token Google Drive.
 */
export function useCompressPage() {
  const [tool, setTool] = useState<Tool>("social");
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [pro, setPro] = useState(false);

  useEffect(() => {
    if (pickerConfigured) preloadGoogle();
    refreshQuota();
  }, []);

  async function refreshQuota() {
    try {
      const r = await fetch("/api/compress/use");
      if (r.ok) {
        const d = await r.json();
        setQuota({ basic: d.basic, picker: d.picker });
        setPro(!!d.pro);
      }
    } catch {
      /* ignore */
    }
  }

  async function ensureDriveToken(force = false): Promise<string> {
    if (driveToken && !force) return driveToken;
    const t = await requestDriveToken(force);
    setDriveToken(t);
    return t;
  }

  async function consumeQuota(kind: "basic" | "picker") {
    const r = await fetch("/api/compress/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await r.json().catch(() => null);
    if (data?.basic) setQuota({ basic: data.basic, picker: data.picker });
    return { ok: r.ok, status: r.status, data };
  }

  return { tool, setTool, quota, pro, ensureDriveToken, consumeQuota };
}
