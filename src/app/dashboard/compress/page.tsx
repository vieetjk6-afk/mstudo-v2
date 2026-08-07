"use client";

import { useEffect, useState } from "react";
import { Minimize2, Stamp, FileImage } from "lucide-react";
import { pickerConfigured, preloadGoogle, requestDriveToken } from "@/lib/google-picker";
import ToolPanel, { type Tool, type QuotaState } from "./ToolPanel";

function QuotaChip({ label, text, warn, active }: { label: string; text: string; warn: boolean; active: boolean }) {
  const color = warn ? "var(--gold)" : active ? "var(--accent)" : "var(--text2)";
  return (
    <span
      className="rounded-full px-3 py-1"
      style={{
        background: warn ? "color-mix(in srgb, var(--gold) 16%, transparent)" : active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface2)",
        border: `1px solid ${active && !warn ? "var(--accent)" : "var(--border)"}`,
        color,
        opacity: active ? 1 : 0.7,
      }}
    >
      {label}: <b style={{ color: warn ? "var(--gold)" : "var(--text)" }}>{text}</b>
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
      <div className="mb-6">
        <p className="eyebrow mb-1.5">Công cụ ảnh</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-medium leading-none">Xử lý ảnh</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text2)" }}>
          Nén ảnh, gắn watermark, đổi định dạng — từ máy tính hoặc Google Drive. Xử lý ngay trên
          trình duyệt, ảnh không tải lên máy chủ.
        </p>
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
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
            style={
              tool === key
                ? { background: "var(--accent)", color: "var(--accentInk)" }
                : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }
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
