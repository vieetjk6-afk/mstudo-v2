/* Màn xem trước GIAO DIỆN MỚI của nhóm "hopdong" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import { ContractsList, type ContractRow } from "@/app/dashboard/studio/contracts/ContractsListView";
import QuotesListView, { type QuoteRow } from "@/app/dashboard/studio/quotes/QuotesListView";
import { todayVN } from "@/lib/date";
import { addDaysIso } from "@/lib/contract-filter";

/**
 * Dữ liệu mẫu có ngày chụp TƯƠNG ĐỐI so với hôm nay — ngày trong fixtures cố
 * định nên dễ rơi hết vào quá khứ, khi đó nhóm "7 ngày tới" / "Sắp chụp" không
 * bao giờ hiện ra để soi.
 */
function contractsNow(): ContractRow[] {
  const t = todayVN();
  const d = (n: number) => addDaysIso(t, n);
  const [c1, c2, c6, c5, c3, c4] = f.contracts;
  return [
    { ...c1, event_date: d(0) },
    { ...c6, event_date: d(1), status: "approved" },
    {
      ...c2, id: "c7", code: "HD2612", title: "Chụp gia đình cuối tuần", client_name: "Lê Minh Khang", client_phone: "0933222111",
      event_date: d(4), event_time: "16:00", status: "sent", shoot_type: "photo",
      contract_items: [{ qty: 1, unit_price: 6_500_000, name: "Gói gia đình 2 giờ" }], contract_payments: [], contract_crew: [],
    },
    {
      ...c2, id: "c8", code: "HD2613", title: "Phóng sự cưới nhà trai — Hà Nội", client_name: "Đỗ Quang Huy", client_phone: "0966777888",
      event_date: d(19), event_time: "08:00", status: "approved", shoot_type: "wedding",
      contract_items: [{ qty: 1, unit_price: 28_000_000, name: "Phóng sự cưới" }, { qty: 1, unit_price: 6_000_000, name: "Album in 30x30" }],
      contract_payments: [{ amount: 10_000_000 }],
      contract_crew: [
        { id: "k8", name: "Anh Tuấn", role: "photographer", status: "accepted" },
        { id: "k9", name: "Hà", role: "cameraman", status: "accepted" },
        { id: "k10", name: "Ngọc", role: "makeup", status: "pending" },
        { id: "k11", name: "Minh", role: "assistant", status: "accepted" },
      ],
    },
    c2, c5, c3, c4,
  ];
}

function quotesNow(): QuoteRow[] {
  const t = todayVN();
  const d = (n: number) => addDaysIso(t, n);
  const [q1, q2] = f.quotes;
  const base = { ...q1, quote_adjustments: [] };
  return [
    { ...q1, expires_at: d(2) },
    { ...q2, expires_at: d(10) },
    { ...base, id: "q3", code: "BG2603", title: "Báo giá chụp gia đình", client_name: "Lê Minh Khang", client_phone: "0933222111", status: "viewed", expires_at: d(12), viewed_at: `${d(-1)}T03:00:00Z`, event_date: d(9), created_at: `${d(-3)}T03:00:00Z`,
      quote_items: [{ qty: 1, unit_price: 6_500_000, selected: true, is_optional: false, is_discount: false }, { qty: 1, unit_price: 1_200_000, selected: false, is_optional: true, is_discount: false }] },
    { ...base, id: "q4", code: "BG2604", title: "Makeup cô dâu + thuê váy", client_name: "Phạm Thu Hà", client_phone: "0977888999", status: "converted", contract_id: "c6", accepted_at: `${d(-5)}T03:00:00Z`, expires_at: d(-1),
      quote_items: [{ qty: 1, unit_price: 8_000_000, selected: true, is_optional: false, is_discount: false }] },
    { ...base, id: "q5", code: null, title: "Báo giá chụp sản phẩm (nháp)", client_name: null, client_phone: null, status: "draft", expires_at: null, event_date: null, quote_items: [] },
    { ...base, id: "q6", code: "BG2599", title: "Báo giá quay phóng sự", client_name: "Công ty TNHH Hạ Vy", client_phone: "0903111222", status: "sent", expires_at: d(-4),
      quote_items: [{ qty: 1, unit_price: 12_000_000, selected: true, is_optional: false, is_discount: false }] },
  ];
}

export const SCREENS_HOPDONG: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-hop-dong": {
    title: "Giao diện mới — Hợp đồng & lịch hẹn",
    render: () => (
      <PreviewV2 path="/dashboard/studio/contracts">
        <ContractsList rows={contractsNow()} studio={f.studio} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-hop-dong-trong": {
    title: "Giao diện mới — Hợp đồng (chưa có hợp đồng nào)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/contracts">
        <ContractsList rows={[]} studio={f.studio} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-bao-gia": {
    title: "Giao diện mới — Báo giá",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes">
        <QuotesListView list={quotesNow()} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-bao-gia-trong": {
    title: "Giao diện mới — Báo giá (chưa có báo giá nào)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/quotes">
        <QuotesListView list={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
};
