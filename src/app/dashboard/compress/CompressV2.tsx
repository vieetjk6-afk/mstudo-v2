"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileImage, Minimize2, Share2, Stamp } from "lucide-react";
import { Badge, PageHead, Stack, btn } from "@/components/v2/kit";
import { Tabs } from "@/components/v2/kit-client";
import ToolPanelV2 from "./ToolPanelV2";
import { useCompressPage } from "./useCompressPage";
import type { QuotaState, Tool, ToolPanelProps } from "./useCompressTool";

/* ═══════════════════════════════════════════════════════════════════════════
   NÉN ẢNH & CHUẨN MXH — trang, giao diện mới. Cùng logic trang với bản cũ
   (./useCompressPage): công cụ đang mở, hạn mức, token Drive. Bốn công cụ là
   bốn tab gạch chân; hạn mức gom thành nhãn nhỏ ở đầu trang. Mở thẳng một
   công cụ bằng ?tool=social|compress|watermark|convert (màn Công cụ ảnh dùng).
   ═══════════════════════════════════════════════════════════════════════════ */

const TOOLS: { value: Tool; label: string; icon: typeof Minimize2 }[] = [
  { value: "social", label: "Chuẩn mạng xã hội", icon: Share2 },
  { value: "compress", label: "Nén ảnh", icon: Minimize2 },
  { value: "watermark", label: "Gắn watermark", icon: Stamp },
  { value: "convert", label: "Đổi định dạng", icon: FileImage },
];

export default function CompressV2() {
  const { tool, setTool, quota, pro, ensureDriveToken, consumeQuota } = useCompressPage();

  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("tool");
    if (want && TOOLS.some((t) => t.value === want)) setTool(want as Tool);
  }, [setTool]);

  return (
    <CompressV2View tool={tool} setTool={setTool} quota={quota} pro={pro} ensureDriveToken={ensureDriveToken} consumeQuota={consumeQuota} />
  );
}

/** Phần vẽ — tách riêng để màn xem trước dựng được với dữ liệu giả. */
export function CompressV2View({
  tool,
  setTool,
  quota,
  pro,
  ensureDriveToken,
  consumeQuota,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  quota: QuotaState | null;
  pro: boolean;
  ensureDriveToken: ToolPanelProps["ensureDriveToken"];
  consumeQuota: ToolPanelProps["consumeQuota"];
}) {
  const compressLike = tool === "compress" || tool === "social";
  const q = (x: QuotaState["basic"]) => (x.unlimited ? "không giới hạn" : `${x.used}/${x.limit}`);
  const out = (x: QuotaState["basic"]) => !x.unlimited && (x.remaining ?? 0) <= 0;

  return (
    <Stack>
      <PageHead
        desc="Xuất ảnh đúng khổ Facebook / Instagram / TikTok / Zalo, nén nhẹ, gắn watermark, đổi định dạng — chạy ngay trên trình duyệt, ảnh không tải lên máy chủ."
        actions={
          <Link href="/dashboard/tools" className={btn("ghost", "sm")}>
            <ArrowLeft size={15} /> Công cụ ảnh
          </Link>
        }
      >
        {quota ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {compressLike ? (
              <>
                <Badge tone={out(quota.basic) ? "amber" : "gray"} title="Ảnh trên máy tính hoặc link Drive công khai">
                  Lượt nén tháng này: {q(quota.basic)}
                </Badge>
                <Badge tone={out(quota.picker) ? "amber" : "gray"} title="Chọn từ Google Drive và ghi lại lên Drive">
                  Nén ghi lên Drive: {q(quota.picker)}
                </Badge>
              </>
            ) : (
              <Badge tone="green">Gắn watermark & đổi định dạng: không giới hạn</Badge>
            )}
          </div>
        ) : null}
      </PageHead>

      <Tabs value={tool} onChange={setTool} label="Công cụ" options={TOOLS} />

      <ToolPanelV2
        key={tool}
        tool={tool}
        pro={pro}
        ensureDriveToken={ensureDriveToken}
        quota={quota}
        consumeQuota={consumeQuota}
      />
    </Stack>
  );
}

/** Chỉ cho màn xem trước (/uipreview): hạn mức giả, không gọi máy chủ. */
export function CompressV2Demo({ quota, pro = true, initialTool = "social" }: { quota: QuotaState; pro?: boolean; initialTool?: Tool }) {
  const [tool, setTool] = useState<Tool>(initialTool);
  return (
    <CompressV2View
      tool={tool}
      setTool={setTool}
      quota={quota}
      pro={pro}
      ensureDriveToken={async () => ""}
      consumeQuota={async () => ({ ok: true, status: 200, data: null })}
    />
  );
}
