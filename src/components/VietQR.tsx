"use client";

import { useState } from "react";
import { QrCode, X, Copy, Check } from "lucide-react";
import { vnd } from "@/lib/types";

// Phần thuần (qrUrl, instalmentNote, BankInfo) nằm ở @/lib/vietqr để server
// component dùng được; tái xuất ở đây để mọi chỗ đang nhập từ file này vẫn chạy.
export { qrUrl, instalmentNote, type BankInfo } from "@/lib/vietqr";
import { qrUrl, type BankInfo } from "@/lib/vietqr";

/** Inline VietQR card — QR image + amount + copyable account/content. */
export function VietQR({ bank, amount, addInfo }: { bank: BankInfo; amount: number; addInfo: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const url = qrUrl(bank, amount, addInfo);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!url) {
    return (
      <p className="text-xs" style={{ color: "var(--text3)" }}>
        Chưa cấu hình ngân hàng để tạo mã QR. Vào <b>Bảng giá → Liên hệ &amp; chuyển khoản</b> chọn ngân hàng &amp; số tài khoản.
      </p>
    );
  }

  const acc = (bank.account || "").replace(/\s/g, "");
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="VietQR" width={220} height={220} style={{ width: 220, height: "auto", borderRadius: 12, background: "#fff" }} />
      {amount > 0 && <p className="font-serif text-lg font-medium" style={{ color: "var(--accent)" }}>{vnd(amount)}</p>}
      {bank.holder && <p className="text-sm">{bank.holder}</p>}
      <button onClick={() => copy(acc, "acc")} className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text2)" }}>
        {copied === "acc" ? <Check size={12} /> : <Copy size={12} />} {acc}{bank.name ? ` · ${bank.name}` : ""}
      </button>
      {addInfo && (
        <button onClick={() => copy(addInfo, "info")} className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text3)" }}>
          {copied === "info" ? <Check size={11} /> : <Copy size={11} />} Nội dung: {addInfo}
        </button>
      )}
    </div>
  );
}

/** Compact button that opens the VietQR in a modal. */
export default function VietQRButton({
  bank,
  amount,
  addInfo,
  label = "QR thu tiền",
}: {
  bank: BankInfo;
  amount: number;
  addInfo: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost inline-flex items-center gap-1 px-2.5 py-1.5 text-xs">
        <QrCode size={14} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setOpen(false)}>
          <div className="card relative w-full max-w-xs p-6" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3" style={{ color: "var(--text3)" }} aria-label="Đóng">
              <X size={18} />
            </button>
            <h3 className="mb-4 text-center font-serif text-lg font-medium">Quét mã để chuyển khoản</h3>
            <VietQR bank={bank} amount={amount} addInfo={addInfo} />
          </div>
        </div>
      )}
    </>
  );
}
