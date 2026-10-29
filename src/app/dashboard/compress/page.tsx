"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Minimize2, Stamp, FileImage, Share2 } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import ToolPanel, { type Tool } from "./ToolPanel";
import { useCompressPage } from "./useCompressPage";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const CompressV2 = dynamic(() => import("./CompressV2"));

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
  return useUiV2() ? <CompressV2 /> : <CompressPageV1 />;
}

function CompressPageV1() {
  const { tool, setTool, quota, pro, ensureDriveToken, consumeQuota } = useCompressPage();

  const tabs: { key: Tool; label: string; Icon: typeof Minimize2 }[] = [
    { key: "social", label: "Chuẩn mạng xã hội", Icon: Share2 },
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
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Xuất ảnh đúng khổ chuẩn Facebook / Instagram / TikTok / Zalo, nén ảnh, gắn watermark, đổi định dạng — chạy ngay trên trình duyệt, ảnh không tải lên máy chủ.</p>
      </div>

      {quota && (
        <div className="mb-5 flex flex-wrap gap-2 text-[12.5px]">
          <QuotaChip
            label="Nén · chuẩn MXH (máy tính / link Drive)"
            text={quota.basic.unlimited ? "không giới hạn" : `${quota.basic.used}/${quota.basic.limit} tháng này`}
            warn={!quota.basic.unlimited && (quota.basic.remaining ?? 0) <= 0}
            active={tool === "compress" || tool === "social"}
          />
          <QuotaChip
            label="Nén · chuẩn MXH lên Google Drive"
            text={quota.picker.unlimited ? "không giới hạn" : `${quota.picker.used}/${quota.picker.limit}`}
            warn={!quota.picker.unlimited && (quota.picker.remaining ?? 0) <= 0}
            active={tool === "compress" || tool === "social"}
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
