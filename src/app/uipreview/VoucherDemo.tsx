"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import VoucherPublicView from "@/app/voucher/[token]/VoucherPublicView";
import BookingForm from "@/app/book/[token]/BookingForm";
import LoyaltyVoucherCard from "@/app/dashboard/studio/contracts/[id]/LoyaltyVoucherCard";
import VouchersView from "@/app/dashboard/studio/vouchers/VouchersView";

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

const base = {
  buyer_name: null, paid_method: null, paid_at: "2026-09-01", redeemed_contract_id: null, redeemed_at: null, note: null,
  created_at: "2026-09-01T10:00:00Z", paid: true, status: "active" as const,
};

/** Màn Voucher & thẻ quà: thẻ quà đã bán + voucher ưu đãi đã tặng. */
export function VoucherQuanLyDemo() {
  return (
    <VouchersView
      migrated
      studioName="Mây Studio"
      studioPhone="0933444555"
      studioHost="mayanh.mstudo.com"
      initial={[
        { ...base, id: "v1", code: "UD-7K3M9P", title: "Voucher ưu đãi lần sau", amount: 0, price: 0, buyer_phone: "0933444555", recipient_name: "Phạm Thị Nhật Ý", expires_on: "2027-09-29", kind: "loyalty", discount_type: "percent", percent: 10, max_discount: 2_000_000, source_contract_id: "c1", public_token: "demo-token-1234567890" },
        { ...base, id: "v2", code: "UD-4HRT8W", title: "Voucher ưu đãi lần sau", amount: 500_000, price: 0, buyer_phone: "0911222333", recipient_name: "Trần Minh Khoa", expires_on: null, kind: "loyalty", discount_type: "amount", status: "redeemed", redeemed_contract_id: "c2", source_contract_id: "c3", public_token: "demo-token-abcdefghij" },
        { ...base, id: "v3", code: "QUA-9PXK2M", title: "Voucher chụp ảnh 20/10", amount: 2_000_000, price: 1_800_000, buyer_phone: "0988777666", buyer_name: "Lê Văn Hùng", recipient_name: "Nguyễn Thu Hà", expires_on: "2027-10-20" },
      ]}
    />
  );
}
