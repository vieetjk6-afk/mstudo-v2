"use client";

import { useState } from "react";
import { useCoupleKey } from "../couple-key";

/* ═══════════════════════════════════════════════════════════════════════════
   LỐI VÀO GHÉP LAYOUT ẢNH trong album giao khách — thẻ "Ghép ảnh đăng mạng xã
   hội" + bước xác nhận SĐT cô dâu / chú rể + mở màn ghép (CollageStudio, nạp
   chậm). Logic ở đây, cách vẽ ở CollageCard.tsx — dùng chung bản cũ và V2.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERIFY_ERRORS: Record<string, string> = {
  wrong_phone: "Số này không khớp số điện thoại cô dâu / chú rể studio đã ghi trên hợp đồng.",
  rate_limited: "Bạn thử sai nhiều lần quá — đợi ít phút rồi thử lại nhé.",
  not_enabled: "Album này chưa mở tính năng ghép ảnh. Bạn liên hệ studio nhé.",
  wrong_password: "Phiên xem album đã hết hạn — tải lại trang, nhập lại mật khẩu rồi thử lại.",
};

export const NEED_VERIFY_MSG = "Phiên xác nhận đã hết hạn (studio vừa cập nhật số điện thoại) — bạn xác nhận lại nhé.";

export function useCollageEntry({
  slug,
  collage,
  access,
  shareMode,
}: {
  slug: string;
  collage: { coupleOnly: boolean } | null | undefined;
  /** Vé mở khoá album có mật khẩu. */
  access: string | undefined;
  /** Link chia sẻ chọn lọc (?s=) — người nhận không phải cô dâu chú rể, không có ghép ảnh. */
  shareMode: boolean;
}) {
  const enabled = !!collage && !shareMode;
  const coupleOnly = !!collage?.coupleOnly;
  const [key, setKey] = useCoupleKey(slug, enabled && coupleOnly);
  const verified = !coupleOnly || !!key;
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  async function verify(phone: string) {
    if (verifyBusy) return;
    if (phone.replace(/\D/g, "").length < 9) {
      setVerifyErr("Bạn nhập đủ số điện thoại nhé.");
      return;
    }
    setVerifyBusy(true);
    setVerifyErr(null);
    try {
      const res = await fetch(`/api/album/${slug}/collage/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, access }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setVerifyErr(VERIFY_ERRORS[d.error as string] ?? "Chưa xác nhận được, bạn thử lại sau ít phút.");
        return;
      }
      // key null: hợp đồng vừa bị xoá SĐT → không cần vé, coi như đã xác nhận.
      setKey(typeof d.key === "string" ? d.key : "ok");
      setVerifyOpen(false);
      setStudioOpen(true);
    } catch {
      setVerifyErr("Mất kết nối — bạn kiểm tra mạng rồi thử lại.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return {
    enabled,
    coupleOnly,
    verified,
    /** Vé gửi kèm mọi lượt gọi /collage/* (null khi hợp đồng không ghi SĐT). */
    key: coupleOnly ? key : null,
    verifyOpen,
    verifyBusy,
    verifyErr,
    verify,
    closeVerify: () => {
      setVerifyOpen(false);
      setVerifyErr(null);
    },
    studioOpen,
    open: () => {
      if (!verified) {
        setVerifyErr(null);
        setVerifyOpen(true);
        return;
      }
      setStudioOpen(true);
    },
    close: () => setStudioOpen(false),
    /** Máy chủ báo vé hết hiệu lực: xoá vé, đóng màn ghép, hỏi lại SĐT. */
    needVerify: () => {
      setKey(null);
      setStudioOpen(false);
      setVerifyErr(NEED_VERIFY_MSG);
      setVerifyOpen(true);
    },
  };
}

export type CollageEntry = ReturnType<typeof useCollageEntry>;
