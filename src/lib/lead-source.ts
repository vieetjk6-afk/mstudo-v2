/**
 * NGUỒN KHÁCH — khách này từ đâu tới.
 *
 * Cột `studio_contracts.source` đã có từ trước, nhưng phải GÕ TAY nên gần như
 * luôn rỗng: lúc tạo hợp đồng thì không ai nhớ ba tuần trước khách bấm vào đâu.
 * Bộ hàm này lấp đúng chỗ đó — đoán nguồn NGAY LÚC khách gửi yêu cầu, từ hai
 * thứ trình duyệt vốn đã mang sẵn:
 *
 *   • tham số utm_* / gclid / fbclid trên URL (link quảng cáo nào cũng có),
 *   • `document.referrer` khi không có utm (khách bấm từ Facebook, Google…).
 *
 * Cố ý KHÔNG lưu gì có thể nhận dạng người dùng: chỉ một nhãn kênh trong tập
 * đóng của LEAD_SOURCE_LABEL, cộng utm thô để studio đối chiếu với trình quản
 * lý quảng cáo. Không cookie, không id theo dõi, không lịch sử duyệt web.
 */

/**
 * Tập ĐÓNG các nguồn khách + nhãn tiếng Việt. Sống ở đây (không phải types.ts)
 * để module này KHÔNG import gì cả: bộ test của repo nạp thẳng file .ts bằng
 * `node --experimental-strip-types`, mà cách đó không giải được alias "@/" —
 * nên mọi module có logic cần test phải tự đứng một mình. `types.ts` xuất lại
 * `LEAD_SOURCE_LABEL` để những chỗ đang nhập từ đó không phải sửa.
 */
export const LEAD_SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  referral: "Giới thiệu",
  google: "Google / Tìm kiếm",
  walk_in: "Khách vãng lai",
  returning: "Khách cũ",
  other: "Khác",
};

/** Nguồn hợp lệ = đúng tập khoá mà cả app đang dùng cho nhãn nguồn. */
export type LeadSource = keyof typeof LEAD_SOURCE_LABEL & string;

export function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LEAD_SOURCE_LABEL, v);
}

/** Tham số quảng cáo thô, giữ nguyên để studio đối chiếu với Ads Manager. */
export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

/** Chữ ký của các mạng trong referrer → kênh. Xếp theo thứ tự kiểm tra. */
const HOST_RULES: [RegExp, LeadSource][] = [
  [/(^|\.)(facebook|fb|messenger|instagram|threads)\./i, "facebook"],
  [/(^|\.)(google|bing|duckduckgo|coccoc|yahoo)\./i, "google"],
];

/** utm_source thường gõ tay nên muôn hình vạn trạng — gom về tập đóng. */
const UTM_RULES: [RegExp, LeadSource][] = [
  [/^(fb|facebook|meta|ig|instagram|messenger|zalo)/i, "facebook"],
  [/^(google|adwords|gg|bing|seo|search|organic)/i, "google"],
  [/^(ref|referral|gioi[_-]?thieu|word[_-]?of[_-]?mouth)/i, "referral"],
  [/^(returning|khach[_-]?cu|repeat|loyal)/i, "returning"],
];

const clean = (v: string | null | undefined): string | undefined => {
  const t = (v ?? "").trim();
  // 120 ký tự là quá đủ cho một tên chiến dịch; dài hơn là rác hoặc ai đó đang
  // thử nhét dữ liệu vào cột.
  return t ? t.slice(0, 120) : undefined;
};

/** Nhặt utm_* (và utm_source ẩn sau gclid/fbclid) từ query string. */
export function readUtm(params: URLSearchParams): Utm {
  const utm: Utm = {
    source: clean(params.get("utm_source")),
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    term: clean(params.get("utm_term")),
  };
  // Link quảng cáo Google/Meta gắn sẵn gclid/fbclid mà nhiều studio quên đặt
  // utm_source — vẫn suy ra được kênh từ chính hai tham số đó.
  if (!utm.source && params.get("gclid")) utm.source = "google";
  if (!utm.source && params.get("fbclid")) utm.source = "facebook";
  // Bỏ hết khoá rỗng để không lưu {} đầy null xuống DB.
  for (const k of Object.keys(utm) as (keyof Utm)[]) if (!utm[k]) delete utm[k];
  return utm;
}

/**
 * Suy ra KÊNH từ (utm, referrer, tham số ref).
 *
 * Thứ tự ưu tiên là cố ý: utm do studio tự gắn nên chính xác nhất; referrer chỉ
 * là phỏng đoán; và `?ref=` (link khách cũ giới thiệu) thắng referrer vì nó nói
 * đúng ý định. Không đoán được thì trả `null` — thà để trống còn hơn dồn hết
 * vào "khác" rồi studio tưởng thật.
 */
export function inferSource(input: {
  utm?: Utm;
  referrer?: string | null;
  ref?: string | null;
  /** Host của chính trang studio — referrer nội bộ KHÔNG phải một nguồn. */
  selfHost?: string | null;
}): LeadSource | null {
  const { utm = {}, referrer, ref, selfHost } = input;

  const raw = utm.source;
  if (raw) {
    if (isLeadSource(raw)) return raw;
    for (const [re, src] of UTM_RULES) if (re.test(raw)) return src;
    // Có utm_source nhưng không khớp luật nào: vẫn là một nguồn CÓ THẬT do
    // studio tự đặt tên, chỉ là ta không xếp được — "khác" đúng hơn là null.
    return "other";
  }

  if (clean(ref)) return "referral";

  const host = hostOf(referrer);
  if (host) {
    // Khách bấm từ trang này sang trang khác của CHÍNH studio thì không tính.
    if (selfHost && host.endsWith(selfHost.replace(/^www\./, ""))) return null;
    for (const [re, src] of HOST_RULES) if (re.test(host)) return src;
    return "other";
  }

  return null;
}

function hostOf(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Nhãn tiếng Việt của một nguồn (kể cả nguồn lạ / rỗng). */
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Không rõ nguồn";
  return LEAD_SOURCE_LABEL[source] || source;
}

/* ── Phễu chuyển đổi ────────────────────────────────────────────────────────
   Bốn bậc studio thật sự đi qua: khách hỏi → gửi yêu cầu đặt lịch → ký hợp
   đồng → tiền về. Tính ở một chỗ để màn báo cáo và bản xuất Excel không mỗi
   nơi một cách chia. */

export type FunnelStage = {
  key: "leads" | "bookings" | "contracts" | "revenue";
  label: string;
  /** Số đếm của bậc (riêng bậc doanh thu là SỐ TIỀN). */
  value: number;
  /** % so với bậc LIỀN TRƯỚC. null ở bậc đầu và ở bậc doanh thu. */
  rate: number | null;
};

export function buildFunnel(input: {
  /**
   * Số khách hỏi. `null` = KHÔNG ĐO ĐƯỢC trong phạm vi đang xem, khác hẳn với 0
   * ("đo được, và bằng không"). Ca thật: studio chọn một chi nhánh — hộp thư và
   * lead không mang cột chi nhánh (khách nhắn vào trang chung) nên bậc này là
   * số của CẢ studio, đem chia cho số yêu cầu của MỘT cơ sở thì ra một tỉ lệ
   * vô nghĩa. Khi đó bỏ hẳn bậc đầu còn trung thực hơn là vẽ ra một con số sai.
   */
  leads: number | null;
  bookings: number;
  contracts: number;
  revenue: number;
}): FunnelStage[] {
  const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const stages: FunnelStage[] = [];
  if (input.leads !== null) {
    stages.push({ key: "leads", label: "Khách hỏi", value: input.leads, rate: null });
  }
  stages.push({
    key: "bookings",
    label: "Gửi yêu cầu đặt lịch",
    value: input.bookings,
    rate: input.leads === null ? null : pct(input.bookings, input.leads),
  });
  stages.push({ key: "contracts", label: "Ký hợp đồng", value: input.contracts, rate: pct(input.contracts, input.bookings) });
  stages.push({ key: "revenue", label: "Tiền đã thu", value: input.revenue, rate: null });
  return stages;
}
