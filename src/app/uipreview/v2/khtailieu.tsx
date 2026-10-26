/* Màn xem trước GIAO DIỆN MỚI của nhóm "khtailieu" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell). */
import * as f from "../fixtures";
import { todayVN } from "@/lib/date";
import { addDaysIso } from "@/lib/contract-filter";
import ContractViewV2 from "@/app/c/[token]/ContractViewV2";
import type { PortalPayload } from "@/app/c/[token]/useContractPortal";
import QuoteClientViewV2 from "@/app/q/[token]/QuoteClientViewV2";
import type { QuoteClientProps } from "@/app/q/[token]/useQuoteClient";
import type { PricelistItem, QuoteItem, StudioQuote } from "@/lib/types";
import QRCode from "qrcode";
import IntakeFormV2 from "@/app/form/[token]/IntakeFormV2";
import VoucherPublicViewV2 from "@/app/voucher/[token]/VoucherPublicViewV2";
import PricelistV2 from "@/app/gia/PricelistV2";
import ShowcaseAlbumV2 from "@/app/showcase/[slug]/ShowcaseAlbumV2";

type Screen = { title: string; render: () => React.ReactNode; bare?: boolean };

const brand = { name: "Mai Studio", logoUrl: null };

/* ── Hợp đồng gửi khách (/c/<token>) — dữ liệu y như POST /api/c/<token> trả về ── */
function hopDong(kind: "cho-ky" | "dang-lam" | "xong"): PortalPayload {
  const t = todayVN();
  const base: PortalPayload = {
    contract: { ...f.contractFull, client_signature: null },
    studio_name: f.studio.name,
    studio_logo: null,
    studio_phone: f.studio.phone,
    bank: f.bank,
    items: f.contractItems.map((i) => ({ id: i.id, name: i.name, description: i.description ?? null, qty: i.qty, unit_price: i.unit_price })),
    payments: f.contractPayments.map((p) => ({ id: p.id, amount: p.amount, kind: p.kind, paid_at: p.paid_at })),
    milestones: f.milestones.map((m) => ({ id: m.id, title: m.title, event_date: m.event_date, event_time: m.event_time, note: m.note })),
    plan: f.contractPlan.map((p, i) => ({ id: p.id, label: p.label, amount: p.amount, due_date: p.due_date, paid: p.paid, paid_at: p.paid_at, pay_code: `MS26090${i}` })),
    expenses: [{ id: "e1", title: "Phụ thu xe đưa đón ngoại thành", amount: 1_500_000, category: null, spent_at: "2026-09-10" }],
    tasks: f.contractTasks.map((x) => ({ id: x.id, label: x.label, done: x.done })),
    products: f.contractProducts.map((x) => ({ id: x.id, name: x.name, qty: x.qty, cost: x.cost, status: x.status })),
    addenda: [
      {
        id: "ad1", contract_id: "c1", no: 1, title: "Thêm giờ quay tiệc tối", note: null,
        lines: [{ name: "Quay thêm 2 giờ tiệc tối", description: null, qty: 1, unit_price: 2_000_000 }],
        signed_at: "2026-09-05T03:00:00Z", signed_by: "client", signed_name: "Nguyễn Thị Lan Phương", created_at: "2026-09-04T03:00:00Z",
      },
    ],
    loyalty: {
      stage: "pending", percent: 7, value: "Giảm 7% (tối đa 3.000.000đ)", title: "Voucher ưu đãi lần sau",
      missing: ["Studio ký xác nhận hợp đồng"], voucher: null,
      terms: ["Áp dụng cho: Phóng sự x2, Gói combo.", "Không có giá trị quy đổi thành tiền mặt."],
    },
    wedding: { slug: "lan-phuong-minh-khoa", edit_token: "demo", published: true },
    story: null,
    selection: null,
    gallery: null,
    quote_options: [],
  };
  base.contract.note = [
    "Cọc 30% giữ lịch, phần còn lại thanh toán theo các đợt ở trên.",
    "Studio giao ảnh chỉnh sửa trong 30 ngày kể từ ngày chụp.",
    "Khách dời lịch trước 15 ngày không mất cọc; sau đó cọc chuyển thành phí giữ lịch.",
    "Trường hợp bất khả kháng (thiên tai, dịch bệnh) hai bên thoả thuận lịch mới.",
    "Ảnh gốc lưu trữ 6 tháng trên Google Drive của studio.",
    "Studio được dùng tối đa 10 ảnh cho portfolio, trừ khi khách yêu cầu không.",
  ].join("\n");

  if (kind === "cho-ky") {
    return {
      ...base,
      contract: {
        ...base.contract,
        status: "sent",
        event_date: addDaysIso(t, 24),
        client_signed_at: null,
        client_signed_name: null,
        client_signature: null,
        studio_signed_name: "Mai Studio",
        studio_signed_at: `${t}T02:00:00Z`,
      },
      payments: [],
      plan: [
        { id: "q1", label: "Đặt cọc giữ lịch", amount: 20_000_000, due_date: addDaysIso(t, 3), paid: false, paid_at: null, pay_code: "MS2610A1" },
        { id: "q2", label: "Thanh toán khi giao album", amount: 47_500_000, due_date: addDaysIso(t, 60), paid: false, paid_at: null, pay_code: "MS2610A2" },
      ],
      expenses: [],
      tasks: [],
      products: [],
      addenda: [],
      wedding: null,
      loyalty: { ...base.loyalty!, stage: "teaser", missing: [], hint: "Hợp đồng từ 80.000.000đ được tặng voucher 10%." },
      quote_options: [
        { id: "o1", name: "Phương án A — chụp + quay", price: 64_000_000, description: "2 thợ chụp, 1 thợ quay\nAlbum 30x30 hai cuốn" },
        { id: "o2", name: "Phương án B — chỉ chụp", price: 45_000_000, description: "2 thợ chụp\nAlbum 30x30 một cuốn" },
      ],
    };
  }
  if (kind === "xong") {
    return {
      ...base,
      contract: { ...base.contract, status: "completed", studio_signed_name: "Mai Studio", studio_signed_at: "2026-09-01T02:00:00Z" },
      payments: [
        ...base.payments!,
        { id: "p2", amount: 25_000_000, kind: "installment", paid_at: "2026-09-02" },
        { id: "p3", amount: 30_500_000, kind: "final", paid_at: "2026-10-18" },
      ],
      plan: base.plan!.map((p) => ({ ...p, paid: true, paid_at: p.paid_at ?? "2026-10-18" })),
      loyalty: null,
      selection: { slug: "lan-phuong-cuoi", title: "Album cưới Lan Phương & Minh Khoa", phase: "delivery" },
      tasks: base.tasks!.map((x) => ({ ...x, done: true })),
      products: base.products!.map((x) => ({ ...x, status: "done" })),
    };
  }
  return base;
}

const hd = (title: string, p?: PortalPayload): Screen => ({
  title: `Giao diện mới — Trang khách · ${title}`,
  render: () => <ContractViewV2 token="demo-hop-dong" brand={brand} initial={p} />,
  bare: true,
});

/* ── Báo giá gửi khách (/q/<token>) ── */
function baoGia(kind: "mo" | "da-dong-y" | "het-han"): QuoteClientProps {
  const t = todayVN();
  const at = `${t}T03:00:00Z`;
  const quote: StudioQuote = {
    id: "q1", owner_id: "o1", code: "BG2610", title: "Báo giá chụp cưới Lan Phương & Minh Khoa",
    client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678", client_email: null, client_facebook: null,
    event_date: addDaysIso(t, 40), location: "Nhà hàng Riverside, 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
    intro: "Chào Lan Phương, Mai Studio gửi bạn báo giá cho ngày cưới. Bạn chọn gói phù hợp, thêm bớt hạng mục tuỳ ý nhé!",
    note: null, deposit_percent: 30, auto_create_contract: true, status: "viewed", client_token: "demo-bao-gia",
    expires_at: addDaysIso(t, 5), contract_id: null, viewed_at: at, accepted_at: null,
    bulk_discount_amount: 1_000_000, bulk_discount_min_items: 0, discount_package_group: "Gói Vàng — chụp + quay",
    created_at: at, updated_at: at, branch_id: null,
  };
  const it = (id: string, name: string, unit_price: number, o: Partial<QuoteItem> = {}): QuoteItem => ({
    id, quote_id: "q1", name, description: null, qty: 1, unit_price, is_optional: false, is_discount: false, selected: true,
    position: 0, package_group: null, created_at: at, ...o,
  });
  const items: QuoteItem[] = [
    it("a1", "2 thợ chụp phóng sự cả ngày", 12_000_000, { package_group: "Gói Vàng — chụp + quay" }),
    it("a2", "1 thợ quay phóng sự + dựng phim 5 phút", 9_000_000, { package_group: "Gói Vàng — chụp + quay", description: "Giao bản dựng trong 21 ngày" }),
    it("b1", "1 thợ chụp phóng sự cả ngày", 7_500_000, { package_group: "Gói Bạc — chỉ chụp", selected: false }),
    it("c1", "Album in 30x30 (60 trang)", 3_500_000, { qty: 2 }),
    it("c2", "Makeup cô dâu tại nhà (2 lần thay)", 3_000_000, { is_optional: true, selected: true, description: "Bao gồm làm tóc, mi, phụ kiện" }),
    it("c3", "Flycam quay toàn cảnh tiệc", 2_500_000, { is_optional: true, selected: false }),
    it("c4", "Ưu đãi khách quen", 500_000, { is_discount: true }),
  ];
  const adjustments = [
    { id: "j1", quote_id: "q1", author: "client" as const, message: "Studio cho mình thêm 1 thợ chụp nhà trai được không ạ?", resolved: true, created_at: addDaysIso(t, -2) + "T02:00:00Z" },
    { id: "j2", quote_id: "q1", author: "studio" as const, message: "Dạ được ạ, studio đã thêm vào Gói Vàng rồi nha.", resolved: true, created_at: addDaysIso(t, -1) + "T03:30:00Z" },
  ];
  const base: QuoteClientProps = {
    quote, initialItems: items, initialAdjustments: adjustments, studioName: "Mai Studio", studioLogo: null,
    studioCanContract: true, initialContractToken: null,
  };
  if (kind === "da-dong-y") return { ...base, quote: { ...quote, status: "converted", accepted_at: at }, initialContractToken: "demo-hop-dong" };
  if (kind === "het-han") return { ...base, quote: { ...quote, status: "expired", expires_at: addDaysIso(t, -3) }, initialAdjustments: [] };
  return base;
}

const bg = (title: string, p: QuoteClientProps): Screen => ({
  title: `Giao diện mới — Trang khách · ${title}`,
  render: () => <QuoteClientViewV2 {...p} />,
  bare: true,
});

/* ── Voucher ưu đãi (/voucher/<token>) — QR dựng ở máy chủ như trang thật ── */
async function VoucherV2Demo({ used = false }: { used?: boolean }) {
  const qr = await QRCode.toDataURL("https://maistudio.mstudo.com/voucher/demo-token-1234567890", { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } });
  return (
    <VoucherPublicViewV2
      ticket={{
        studio: "Mai Studio",
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

/* ── Bảng giá công khai (/gia/<token>, /banggia) ── */
const plItems: PricelistItem[] = [
  ...f.goiDichVu.filter((g) => g.list_key === "sv-cuoi"),
  { id: "g6", list_key: "sv-cuoi", name: "Phóng sự x3 — trọn ngày", price: 9_500_000, unit: "ngày", category: "Gói chụp cơ bản", description: "3 thợ chụp nhà gái, nhà trai, tiệc\nChỉnh sửa 500+ hình\nTặng 30 ảnh in 13x18" },
  { id: "n1", list_key: "sv-cuoi", name: "Ghi chú", price: 0, unit: "", category: "Lưu ý khi đặt lịch", description: "Cọc 30% giữ lịch\nNgoại thành tính thêm phí di chuyển\nGiao file sau 14–21 ngày" },
  { id: "n2", list_key: "sv-cuoi", name: "Quà tặng", price: 0, unit: "", category: "Quà tặng kèm", description: "Thiệp cưới online\nTrang Love Story" },
].map((g, i) => ({ owner_id: "o1", active: true, show_on_home: false, position: i, created_at: "2026-09-01T00:00:00Z", ...g }));
const plProps = {
  contact: { full_name: "Mai Studio", pl_phone: "0912 345 678", pl_facebook: "facebook.com/maistudio", pl_bank_holder: "NGUYEN VAN A", pl_bank_account: "0123456789", pl_bank_name: "Vietcombank" },
  items: plItems,
  lists: [
    { key: "sv-cuoi", label: "Chụp cưới", title: "Bảng giá chụp cưới" },
    { key: "sv-makeup", label: "Trang điểm & thuê đồ", title: "Bảng giá trang điểm" },
  ],
  selected: "sv-cuoi",
  tabBase: "/gia/demo",
  bookHref: "/book/demo?list=sv-cuoi",
  clauses: "Cọc 20%, thanh toán đủ khi giao file.\nDời lịch trước 15 ngày không mất cọc.",
};

export const SCREENS_KHTAILIEU: Record<string, Screen> = {
  "v2-kh-hop-dong-khoa": hd("Hợp đồng: nhập SĐT để mở"),
  "v2-kh-hop-dong-cho-ky": hd("Hợp đồng chờ khách ký (có phương án gói, voucher mời)", hopDong("cho-ky")),
  "v2-kh-hop-dong": hd("Hợp đồng đã ký, còn đợt quá hạn (phụ lục, phát sinh, sản phẩm, quà thiệp)", hopDong("dang-lam")),
  "v2-kh-hop-dong-xong": hd("Hợp đồng hoàn thành, đã thanh toán đủ, ảnh đã giao", hopDong("xong")),
  "v2-kh-bao-gia": bg("Báo giá: chọn gói + hạng mục tuỳ chọn, sắp hết hạn, có trao đổi", baoGia("mo")),
  "v2-kh-bao-gia-da-dong-y": bg("Báo giá khách đã đồng ý, hợp đồng tự tạo", baoGia("da-dong-y")),
  "v2-kh-bao-gia-het-han": bg("Báo giá hết hạn", baoGia("het-han")),
  "v2-kh-form-cuoi": {
    title: "Giao diện mới — Trang khách · Form thông tin buổi chụp (cưới: nhà gái, nhà trai, tiệc)",
    render: () => (
      <IntakeFormV2
        token="demo-form"
        isWedding
        clientName="Nguyễn Thị Lan Phương"
        title="Chụp phóng sự cưới Lan Phương & Minh Khoa"
        studio="Mai Studio"
        submitted={false}
        initial={null}
        brand={brand}
      />
    ),
    bare: true,
  },
  "v2-kh-form": {
    title: "Giao diện mới — Trang khách · Form thông tin buổi chụp (loại khác, đã gửi trước đó)",
    render: () => (
      <IntakeFormV2
        token="demo-form"
        isWedding={false}
        clientName="Trần Minh Khoa"
        title="Chụp kỷ yếu lớp 12A3"
        studio="Mai Studio"
        submitted
        initial={{ type: "generic", contact_name: "Cô Hạnh (GVCN)", contact_phone: "0901112223", start_time: "07:30", note: "Lớp tập trung ở cổng trường" }}
        brand={brand}
      />
    ),
    bare: true,
  },
  "v2-kh-voucher": { title: "Giao diện mới — Trang khách · Voucher ưu đãi (quét QR)", render: () => <VoucherV2Demo />, bare: true },
  "v2-kh-voucher-da-dung": { title: "Giao diện mới — Trang khách · Voucher đã dùng", render: () => <VoucherV2Demo used />, bare: true },
  "v2-kh-bang-gia": { title: "Giao diện mới — Trang khách · Bảng giá (màu mặc định)", render: () => <PricelistV2 {...plProps} />, bare: true },
  "v2-kh-bang-gia-mau": {
    title: "Giao diện mới — Trang khách · Bảng giá theo màu studio chọn (pl_bg / pl_text / pl_accent)",
    render: () => <PricelistV2 {...plProps} theme={{ bg: "#1f2a24", text: "#f1ead8", accent: "#b8863b", logo: null }} />,
    bare: true,
  },
  "v2-kh-showcase": {
    title: "Giao diện mới — Trang khách · Album tham khảo (showcase)",
    render: () => (
      <ShowcaseAlbumV2
        brand={brand}
        title="Pre-wedding Đà Lạt — Thảo & Nam"
        kind="Album cưới"
        description="Chụp tại đồi chè Cầu Đất lúc bình minh"
        photos={Array.from({ length: 10 }, (_, i) => ({ id: `ph${i}`, fileId: `demo-file-${i}`, name: `DSC_${1000 + i}.jpg` }))}
      />
    ),
    bare: true,
  },
};
