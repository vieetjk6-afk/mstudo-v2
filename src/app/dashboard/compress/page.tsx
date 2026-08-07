"use client";

import { useEffect, useState } from "react";
import { Minimize2, Stamp, FileImage } from "lucide-react";
import { pickerConfigured, preloadGoogle, requestDriveToken } from "@/lib/google-picker";
import ToolPanel, { type Tool, type QuotaState } from "./ToolPanel";

/** Ô hạn mức: pill 20px, tô màu cảnh báo khi hết lượt, chìm khi không liên quan. */
function QuotaChip({ label, text, warn, active }: { label: string; text: string; warn: boolean; active: boolean }) {
  return (
    <span
      className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold"
      style={{
        background: warn ? "var(--amS)" : active ? "var(--acS)" : "var(--sf2)",
        color: warn ? "var(--am)" : active ? "var(--ac)" : "var(--tx3)",
      }}
    >
      {label}: <b className="tnum">{text}</b>
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
      <p className="mb-3.5 max-w-3xl text-[13px] leading-[1.6]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        Nén ảnh, gắn watermark, đổi định dạng — từ máy tính hoặc Google Drive.
        Xử lý ngay trên trình duyệt, ảnh không tải lên máy chủ.
      </p>

      {quota && (
        <div className="mb-3 flex flex-wrap gap-2">
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

      {/* Chọn công cụ — segmented control trong ô nền phụ, đúng bản thiết kế. */}
      <div className="mb-3.5 flex w-fit gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            className="flex flex-none items-center gap-1.5 rounded-[8px] px-[15px] py-[6.5px] text-[12.5px] font-semibold"
            style={tool === key ? { background: "var(--sf)", color: "var(--tx)", boxShadow: "0 1px 2px rgba(20,15,25,.08)" } : { color: "var(--tx2)" }}
          >
            <Icon size={15} /> {label}
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
