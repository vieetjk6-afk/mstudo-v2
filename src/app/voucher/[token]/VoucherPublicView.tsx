"use client";

import { useState } from "react";
import { CalendarCheck, Download, Copy, Check, Phone } from "lucide-react";
import { VoucherTicket, saveVoucherImage, type TicketData } from "@/components/voucher/VoucherTicket";

export default function VoucherPublicView({
  ticket,
  logo,
  bookUrl,
  studioPhone,
  usable,
}: {
  ticket: TicketData;
  logo: string | null;
  bookUrl: string | null;
  studioPhone: string | null;
  usable: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveVoucherImage(ticket);
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(ticket.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "#efe6d8", color: "#2b2118" }}>
      <div className="mx-auto max-w-[400px]">
        {logo && (
          <img src={logo} alt={ticket.studio} className="mx-auto mb-5 h-14 w-auto max-w-[200px] object-contain" />
        )}
        <VoucherTicket d={ticket} />

        <div className="mt-6 space-y-2.5">
          {usable && bookUrl && (
            <a
              href={bookUrl}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[15px] font-bold"
              style={{ background: "#2b2118", color: "#fbf6ee" }}
            >
              <CalendarCheck size={18} /> Đặt lịch ngay với voucher này
            </a>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[15px] font-semibold disabled:opacity-60"
            style={{ background: "#fbf6ee", border: "1px solid #b8863b88" }}
          >
            <Download size={18} /> {saving ? "Đang tạo ảnh…" : "Lưu voucher về điện thoại"}
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={copyCode}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-[13.5px] font-semibold"
              style={{ background: "#fbf6ee", border: "1px solid #b8863b55" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Đã chép mã" : "Chép mã"}
            </button>
            {studioPhone && (
              <a
                href={`tel:${studioPhone.replace(/[^\d+]/g, "")}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-[13.5px] font-semibold"
                style={{ background: "#fbf6ee", border: "1px solid #b8863b55" }}
              >
                <Phone size={16} /> Gọi studio
              </a>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[12px]" style={{ color: "#2b211899" }}>
          {usable
            ? "Đặt lịch bằng nút trên, hoặc đọc mã voucher cho studio khi ký hợp đồng lần sau. Mỗi voucher dùng một lần."
            : "Voucher này không còn dùng được. Liên hệ studio nếu bạn cần hỗ trợ."}
        </p>
      </div>
    </main>
  );
}
