/* Màn xem trước GIAO DIỆN MỚI của nhóm "taohd" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import NewContractForm from "@/app/dashboard/studio/contracts/new/NewContractForm";
import NewQuoteForm from "@/app/dashboard/studio/quotes/new/NewQuoteForm";
import QuoteEditor from "@/app/dashboard/studio/quotes/[id]/QuoteEditor";
import type { QuoteAdjustment, QuoteItem, QuoteStatus, StudioQuote } from "@/lib/types";
import { todayVN } from "@/lib/date";
import { addDaysIso } from "@/lib/contract-filter";

/* ── Báo giá mẫu cho màn Sửa báo giá ─────────────────────────────────────────
   Lấy báo giá đầu trong fixtures, bỏ phần gộp của màn danh sách, đặt hạn hiệu
   lực TƯƠNG ĐỐI so với hôm nay (ngày cố định dễ rơi vào quá khứ). Hạng mục cố
   tình đủ loại: bắt buộc, tuỳ chọn khách đã chọn / đã bỏ, có mô tả nhiều dòng,
   có nhóm gói, và một khoản giảm giá. */
function quoteOf(status: QuoteStatus, expiresIn: number | null, extra: Partial<StudioQuote> = {}): StudioQuote {
  const { quote_items: _items, quote_adjustments: _adj, ...base } = f.quotes[0];
  return {
    ...base,
    status,
    expires_at: expiresIn === null ? null : `${addDaysIso(todayVN(), expiresIn)}T16:59:59.999Z`,
    event_date: addDaysIso(todayVN(), 38),
    location: "Nhà hàng Riverside, Quận 7",
    ...extra,
  };
}

const item = (id: string, p: Partial<QuoteItem>): QuoteItem => ({
  id, quote_id: "q1", name: "", description: null, qty: 1, unit_price: 0, is_optional: false, is_discount: false,
  selected: true, position: 0, package_group: null, created_at: "2026-08-20T03:00:00Z", ...p,
});

const quoteItems: QuoteItem[] = [
  item("i1", { name: "Phóng sự cưới trọn gói", description: "2 thợ chụp nhà gái + nhà trai\nGiao toàn bộ file gốc\n400 ảnh chỉnh sửa", unit_price: 45_000_000, position: 0 }),
  item("i2", { name: "Album in 30x30 (30 trang)", unit_price: 3_500_000, is_optional: true, selected: true, package_group: "goi-album", position: 1 }),
  item("i3", { name: "Quay phim highlight 3–5 phút", description: "1 thợ quay, dựng nhạc theo yêu cầu", unit_price: 8_000_000, is_optional: true, selected: false, position: 2 }),
  item("i4", { name: "Ưu đãi khách đặt sớm", unit_price: 2_000_000, is_discount: true, position: 3 }),
];

const adjustments: QuoteAdjustment[] = [
  { id: "a1", quote_id: "q1", author: "client", message: "Cho mình bỏ album 30x30, thêm 1 thợ quay buổi lễ được không ạ? Ngân sách bên mình khoảng 50tr.", resolved: false, created_at: "2026-08-22T09:15:00Z" },
  { id: "a2", quote_id: "q1", author: "studio", message: "Dạ được ạ, studio gửi lại bản mới trong hôm nay nhé.", resolved: true, created_at: "2026-08-22T10:02:00Z" },
];

export const SCREENS_TAOHD: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-tao-hop-dong": {
    title: "Giao diện mới — Tạo hợp đồng (6 bước)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/contracts/new">
        <NewContractForm
          ownerId="o1"
          assignTo={null}
          templates={[]}
          services={f.dichVu}
          packages={f.goiDichVu}
          roster={f.roster}
          recentClients={f.khachGanDay}
          bank={f.bank}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-tao-hop-dong-hop-thu": {
    title: "Giao diện mới — Tạo hợp đồng mở từ Hộp thư (đoạn chat điền sẵn)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/contracts/new">
        <NewContractForm
          ownerId="o1"
          assignTo={null}
          templates={[]}
          services={f.dichVu}
          packages={f.goiDichVu}
          roster={f.roster}
          recentClients={f.khachGanDay}
          bank={f.bank}
          initialQuickText={"Khách: Chị Lan 0912345678\nChốt gói Phóng sự x2 giá 5tr5, thêm Album\nChụp 12/12 7h tại nhà hàng Riverside Q7\nCọc 2tr"}
          quickSourceNote="Đã chép sẵn cuộc trò chuyện Zalo với Chị Lan — bấm phân tích để điền hợp đồng."
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-tao-bao-gia": {
    title: "Giao diện mới — Tạo báo giá",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes/new">
        <NewQuoteForm ownerId="o1" services={f.dichVu} pricelist={f.goiDichVu} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-sua-bao-gia": {
    title: "Giao diện mới — Sửa báo giá (đã gửi, khách xin chỉnh)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes/q1">
        <QuoteEditor
          quote={quoteOf("adjust_requested", 2, { bulk_discount_amount: 1_000_000, discount_package_group: "goi-album" })}
          initialItems={quoteItems}
          initialAdjustments={adjustments}
          canConvert
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-sua-bao-gia-nhap": {
    title: "Giao diện mới — Sửa báo giá (bản nháp, chưa gửi)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes/q1">
        <QuoteEditor quote={quoteOf("draft", null, { client_name: null, client_phone: null })} initialItems={quoteItems.slice(0, 2)} initialAdjustments={[]} canConvert />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-sua-bao-gia-chot": {
    title: "Giao diện mới — Sửa báo giá (khách đã đồng ý)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes/q1">
        <QuoteEditor quote={quoteOf("accepted", 9)} initialItems={quoteItems} initialAdjustments={adjustments.slice(1)} canConvert />
      </PreviewV2>
    ),
    bare: true,
  },
};
