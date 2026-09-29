"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import VoucherPublicView from "@/app/voucher/[token]/VoucherPublicView";
import BookingForm from "@/app/book/[token]/BookingForm";
import LoyaltyVoucherCard from "@/app/dashboard/studio/contracts/[id]/LoyaltyVoucherCard";

/** Trang khách mở khi quét QR voucher. */
export function VoucherKhachDemo({ used = false }: { used?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL("https://mayanh.mstudo.com/voucher/demo-token-1234567890", { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } }).then(setQr);
  }, []);
  return (
    <VoucherPublicView
      ticket={{
        studio: "Mây Studio",
        title: "Voucher ưu đãi lần sau",
        value: "Giảm 10% (tối đa 2.000.000đ)",
        code: "UD-7K3M9P",
        expires: "29/09/2027",
        recipient: "Phạm Thị Nhật Ý",
        qr,
        stateLabel: used ? "Đã dùng" : null,
      }}
      logo={null}
      bookUrl={used ? null : "/book/demo?voucher=UD-7K3M9P"}
      studioPhone="0933444555"
      usable={!used}
    />
  );
}

/** Form đặt lịch khi vào từ QR voucher. */
export function DatLichVoucherDemo({ bad = false }: { bad?: boolean }) {
  return (
    <BookingForm
      token="demo"
      studioName="Mây Studio"
      packages={[{ name: "Chụp cưới · Gói Vàng", price: 15_000_000 }, { name: "Chụp cưới · Gói Bạc", price: 9_000_000 }]}
      voucher={bad ? { code: "UD-XXXXXX", label: "", ok: false, message: "Voucher đã hết hạn." } : { code: "UD-7K3M9P", label: "Giảm 10% (tối đa 2.000.000đ)", ok: true }}
    />
  );
}

/** Thẻ "Voucher ưu đãi lần sau" trong hợp đồng đã ký (dữ liệu do Supabase giả trả về). */
export function TangVoucherDemo() {
  return (
    <div style={{ maxWidth: 900 }}>
      <LoyaltyVoucherCard
        contractId="c1"
        signed
        clientName="Phạm Thị Nhật Ý"
        clientPhone="0933444555"
        clientMessenger=""
        studioHost="mayanh.mstudo.com"
        studioName="Mây Studio"
      />
    </div>
  );
}
