"use client";

import FaceAutoScan, { FaceAutoScanView, type AutoScanView } from "@/components/v2/FaceAutoScan";

/**
 * Ô "tự quét khuôn mặt" góc dashboard — mọi trạng thái (tĩnh), và một bản CHẠY
 * THẬT (`?that=1`) để desktop/test/face-auto-scan.mjs giả lập API rồi đo cả
 * vòng: hỏi hàng đợi → nạp mô hình → quét → gửi kết quả → gom.
 */
const MAU: AutoScanView[] = [
  { kieu: "nap", ten: "Cưới Minh & Lan", pct: 42, thuTu: 1, soAlbum: 3 },
  { kieu: "quet", ten: "Cưới Minh & Lan — tiệc tối nhà hàng Riverside", daQuet: 312, tong: 845, thuTu: 1, soAlbum: 3 },
  { kieu: "gom", ten: "Cưới Minh & Lan", thuTu: 2, soAlbum: 3 },
  { kieu: "xong", soAlbum: 3 },
  { kieu: "tam-dung" },
];

export default function FaceAutoScanDemo({ that = false }: { that?: boolean }) {
  if (that) return <FaceAutoScan choBatDauMs={300} />;
  return (
    <div className="studio-shell flex min-h-screen flex-col gap-4 p-4" style={{ background: "var(--bg)" }}>
      {MAU.map((v, i) => (
        <FaceAutoScanView key={i} v={v} fixed={false} onPause={() => {}} onDisable={() => {}} onHide={() => {}} />
      ))}
    </div>
  );
}
