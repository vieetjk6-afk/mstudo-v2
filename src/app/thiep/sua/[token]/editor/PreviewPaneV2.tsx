"use client";

import { useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import { iconBtn } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import WeddingRenderer, { type Wish } from "../../../[slug]/WeddingRenderer";
import { DEVICES, ScaledDevice, usePreviewScale, type Device } from "./PreviewPane";

/* ═══════════════════════════════════════════════════════════════════════════
   KHUNG XEM TRƯỚC — giao diện mới. Cùng iframe + thu nhỏ với PreviewPane (bản
   cũ, phần dùng chung xuất từ ./PreviewPane): thiệp / love story THẬT dựng
   trong khung thiết bị. Khác: thanh trên dùng bộ khối V2, khung điện thoại vừa
   cả chiều cao cột (thấy trọn một màn, không phải cuộn khung ngoài).
   ═══════════════════════════════════════════════════════════════════════════ */

export function DevicePreviewV2({
  openUrl, openLabel = "Mở trang thật ở tab mới", children, className = "",
}: {
  openUrl: string;
  openLabel?: string;
  /** Nội dung dựng trong khung; `nonce` đổi khi bấm "Xem lại từ đầu". */
  children: (nonce: number) => React.ReactNode;
  className?: string;
}) {
  const [device, setDevice] = useState<Device>("phone");
  const [nonce, setNonce] = useState(0);
  const { w, h } = DEVICES[device];
  const { hostRef, scale } = usePreviewScale(w, h, device === "phone");

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex flex-none items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Segmented<Device>
          size="sm"
          label="Khổ xem trước"
          value={device}
          onChange={setDevice}
          options={[
            { value: "phone", label: <><Smartphone size={13} /> Điện thoại</> },
            { value: "wide", label: <><Monitor size={13} /> Máy tính</> },
          ]}
        />
        <span className="flex-1" />
        <span className="v2-num hidden text-[11.5px] sm:inline" style={{ color: "var(--tx3)" }}>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => setNonce((n) => n + 1)} className={iconBtn()} aria-label="Xem lại từ đầu" title="Xem lại từ đầu">
          <RotateCw size={16} />
        </button>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className={iconBtn()} aria-label={openLabel} title={openLabel}>
          <ExternalLink size={16} />
        </a>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-auto p-3" style={{ background: "var(--bg2)" }}>
        <ScaledDevice w={w} h={h} scale={scale} frameKey={`${device}-${nonce}`}>
          {children(nonce)}
        </ScaledDevice>
      </div>
    </div>
  );
}

/** Xem trước thiệp cưới đang sửa (dựng lại theo từng phím gõ). */
export default function PreviewPaneV2({
  inv, wishes, guest, storyUrl, publicUrl, className,
}: {
  inv: WeddingInvitation;
  wishes: Wish[];
  guest: string;
  storyUrl?: string;
  publicUrl: string;
  className?: string;
}) {
  const cfg = inv.config as WeddingConfig;
  return (
    <DevicePreviewV2 openUrl={publicUrl} openLabel="Mở thiệp thật ở tab mới" className={className}>
      {(nonce) => (
        <WeddingRenderer
          key={`${inv.template}-${nonce}`}
          inv={inv}
          wishes={cfg.guestbook_enabled === false ? [] : wishes}
          guest={guest}
          storyUrl={storyUrl}
          preview
        />
      )}
    </DevicePreviewV2>
  );
}
