"use client";

import { useState } from "react";
import { saveVoucherImage, type TicketData } from "@/components/voucher/VoucherTicket";

/**
 * Hai thao tác của trang voucher khách mở khi quét QR — lưu ảnh voucher về máy
 * và chép mã — dùng chung cho bản cũ (VoucherPublicView) và giao diện mới
 * (VoucherPublicViewV2).
 */
export function useVoucherActions(ticket: TicketData) {
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

  return { saving, copied, save, copyCode };
}
