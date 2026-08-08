"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minimize2, Stamp, FileImage } from "lucide-react";
import { pickerConfigured, preloadGoogle, requestDriveToken } from "@/lib/google-picker";
import ToolPanel, { type Tool, type QuotaState } from "./ToolPanel";

/** Pill hạn mức — bo 20px, cặp màu trạng thái của bản thiết kế. */
function QuotaChip({ label, text, warn, active }: { label: string; text: string; warn: boolean; active: boolean }) {
  const fg = warn ? "var(--am)" : active ? "var(--ac)" : "var(--tx3)";
  const bg = warn ? "var(--amS)" : active ? "var(--acS)" : "var(--sf2)";
  return (
    <span className="whitespace-nowrap rounded-[20px] px-[11px] py-[5px] font-semibold" style={{ background: bg, color: fg }}>
      {label}: <b>{text}</b>
    </span>
  );
}

export default function CompressPage() {
  const [tool, setTool] = useState<Tool>("compress");
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

  const tabs: { key: Tool; label: string; Icon: typeof Minimize2 }[] = [
    { key: "compress", label: "Nén ảnh", Icon: Minimize2 },
    { key: "watermark", label: "Gắn watermark", Icon: Stamp },
    { key: "convert", label: "Đổi định dạng", Icon: FileImage },
  ];

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
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Nén ảnh, gắn watermark, đổi định dạng — chạy ngay trên trình duyệt, ảnh không tải lên máy chủ.</p>
      </div>

      {quota && (
        <div className="mb-5 flex flex-wrap gap-2 text-[12.5px]">
          <QuotaChip
            label="Nén (máy tính / link Drive)"
            text={quota.basic.unlimited ? "không giới hạn" : `${quota.basic.used}/${quota.basic.limit} tháng này`}
            warn={!quota.basic.unlimited && (quota.basic.remaining ?? 0) <= 0}
            active={tool === "compress"}
          />
          <QuotaChip
            label="Nén lên Google Drive"
            text={quota.picker.unlimited ? "không giới hạn" : `${quota.picker.used}/${quota.picker.limit}`}
            warn={!quota.picker.unlimited && (quota.picker.remaining ?? 0) <= 0}
            active={tool === "compress"}
          />
          <QuotaChip
            label="Gắn watermark · Đổi định dạng"
            text="không giới hạn"
            warn={false}
            active={tool === "watermark" || tool === "convert"}
          />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
            style={
              tool === key
                ? { background: "var(--ac)", color: "#fff" }
                : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx2)" }
            }
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <ToolPanel
        key={tool}
        tool={tool}
        pro={pro}
        ensureDriveToken={ensureDriveToken}
        quota={quota}
        consumeQuota={consumeQuota}
      />
    </div>
  );
}
