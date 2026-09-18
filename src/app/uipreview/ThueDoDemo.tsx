"use client";

import ContractRentalPanel from "@/app/dashboard/studio/contracts/[id]/ContractRentalPanel";
import * as f from "./fixtures";

/**
 * Vỏ bọc client cho panel Thuê đồ trong /uipreview.
 *
 * screens.tsx chạy phía máy chủ nên không truyền hàm (onThemHangMuc) thẳng vào
 * component client được — Next từ chối với "Event handlers cannot be passed to
 * Client Component props". Vỏ bọc này là chỗ duy nhất biết tới hàm rỗng đó,
 * nên panel thật vẫn giữ prop bắt buộc: quên truyền là tsc đỏ.
 */
export default function ThueDoDemo() {
  return (
    <ContractRentalPanel
      contractId="c1"
      ownerId="o1"
      clientName="Nguyễn Thị Lan Phương"
      clientPhone="0912345678"
      eventDate={f.contractFull.event_date}
      onThemHangMuc={async () => {}}
      donsBanDau={[...f.rentalDons] as never}
      khoBanDau={[...f.rentalKho] as never}
    />
  );
}
