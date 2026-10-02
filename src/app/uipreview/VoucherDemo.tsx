"use client";

import { useEffect, useState } from "react";
import { PaidConfirmScreen } from "@/app/c/[token]/PaidConfirm";
import QRCode from "qrcode";
import VoucherPublicView from "@/app/voucher/[token]/VoucherPublicView";
import BookingForm from "@/app/book/[token]/BookingForm";
import LoyaltyVoucherCard from "@/app/dashboard/studio/contracts/[id]/LoyaltyVoucherCard";
import VouchersView from "@/app/dashboard/studio/vouchers/VouchersView";
import PortalVoucher from "@/app/c/[token]/PortalVoucher";

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
        terms: ["Áp dụng cho: Phóng sự x2, Gói combo.", "Tặng được người khác, khi dùng nhập đúng SĐT hợp đồng gốc.", "Không có giá trị quy đổi thành tiền mặt."],
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
      voucher={bad ? { code: "UD-XXXXXX", label: "", ok: false, message: "Voucher đã hết hạn." } : { code: "UD-7K3M9P", label: "Giảm 1.000.000đ", ok: true, needsPhone: true, terms: ["Áp dụng cho: Phóng sự x2, Gói combo.", "Không có giá trị quy đổi thành tiền mặt."] }}
    />
  );
}

/** Thẻ "Voucher ưu đãi lần sau" trong hợp đồng đã ký (dữ liệu do Supabase giả trả về). */
export function TangVoucherDemo() {
  return (
    <div style={{ maxWidth: 900 }}>
      <LoyaltyVoucherCard
        contractId="c1"
        initialPercent={null}
        refreshKey="demo"
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
      program={{ enabled: true, percent: 5, max_discount: 2_000_000, valid_months: 12, title: "Voucher ưu đãi lần sau", package_names: ["Phóng sự x2", "Gói combo"], tiers: [{ min: 0, percent: 5 }, { min: 15_000_000, percent: 7 }, { min: 30_000_000, percent: 10, max: 3_000_000 }] }}
      packages={[
        { name: "Truyền thống", group: "Cưới · Gói chụp cơ bản" },
        { name: "Phóng sự x1", group: "Cưới · Gói chụp cơ bản" },
        { name: "Phóng sự x2", group: "Cưới · Gói chụp cơ bản" },
        { name: "Gói quay cơ bản", group: "Cưới · Gói quay PS ngày cưới" },
        { name: "Gói combo", group: "Cưới · Gói quay PS ngày cưới" },
      ]}
      programMigrated
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

/** Voucher trên cổng hợp đồng của khách, ba giai đoạn. */
export function PortalVoucherDemo() {
  const base = {
    percent: 7,
    title: "Voucher ưu đãi lần sau",
    missing: [] as string[],
    voucher: null,
    terms: ["Áp dụng cho: Phóng sự x2, Gói combo.", "Tặng được người khác, khi dùng nhập đúng SĐT hợp đồng gốc.", "Không có giá trị quy đổi thành tiền mặt."],
  };
  return (
    <div className="mx-auto max-w-[520px] space-y-6">
      <p className="text-xs font-bold">1 · Chưa ký</p>
      <PortalVoucher studioName="Mây Studio" clientName="Phạm Thị Nhật Ý" l={{ ...base, stage: "teaser", value: "Giảm 7% (tối đa 3.000.000đ)", hint: "Hợp đồng từ 30.000.000đ được tặng voucher 10%." }} />
      <p className="text-xs font-bold">2 · Đã ký, chờ studio</p>
      <PortalVoucher studioName="Mây Studio" clientName="Phạm Thị Nhật Ý" l={{ ...base, stage: "pending", value: "Giảm 7% (tối đa 3.000.000đ)", missing: ["Studio xác nhận đã nhận cọc", "Studio ký xác nhận hợp đồng"] }} />
      <p className="text-xs font-bold">3 · Đã phát</p>
      <PortalVoucher
        studioName="Mây Studio"
        clientName="Phạm Thị Nhật Ý"
        l={{ ...base, stage: "issued", value: "Giảm 7% (tối đa 3.000.000đ)", voucher: { code: "UD-7K3M9P", expires_on: "2027-09-29", public_token: "demo-token-1234567890", status: "active", title: "Voucher ưu đãi lần sau" } }}
      />
    </div>
  );
}

/** Màn "Đã nhận cọc" của cổng hợp đồng khi tiền về. */
export function PaidConfirmDemo() {
  return (
    <div className="client-doc min-h-[700px]">
      <PaidConfirmScreen
        e={{ amount: 5_000_000, paidAt: "2026-10-02T09:15:00+07:00", label: "Đặt cọc giữ lịch", deposit: true }}
        lang="vi"
        studioName="Mây Studio"
        contractRef="HD2609"
        eventDate="2026-12-12"
        remaining={59_000_000}
        onClose={() => {}}
      />
    </div>
  );
}
