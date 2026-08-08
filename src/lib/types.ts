export type Role = "admin" | "photographer";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  max_albums: number | null;
  monthly_album_limit: number | null;
  can_zip: boolean;
  can_notes: boolean;
  can_galleries: boolean;
  compress_daily_limit: number | null;
  compress_picker_limit: number | null;
  can_watermark_pro: boolean;
  plan: "free" | "basic" | "photographer" | "photographer_plus" | "studio";
  plan_cycle: string | null;
  plan_expires_at: string | null;
  trial_used_at: string | null;
  studio_owner_id: string | null;
  studio_role: string | null;
  is_active: boolean;
  created_at: string;
}

export type AlbumStatus = "draft" | "published";

export interface Album {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  password_hash: string | null;
  selection_limit: number | null;
  watermark_enabled: boolean;
  watermark_text: string | null;
  download_enabled: boolean;
  status: AlbumStatus;
  is_showcase: boolean;
  is_pinned: boolean;
  kind: string | null;
  // Delivery-gallery fields (is_gallery = true)
  is_gallery: boolean;
  client_name: string | null;
  client_phone: string | null;
  event_date: string | null;
  category: string | null;
  category_label: string | null;
  gallery_pinned: boolean;
  // Unified project model: which phase the client link currently exposes, and a
  // separate watermark toggle for the delivery phase.
  phase: AlbumPhase;
  watermark_delivery: boolean;
  created_at: string;
  updated_at: string;
}

// A project moves from "selection" (client picks originals) to "delivery"
// (client downloads finished photos). Each album_source is tagged with the
// stage it belongs to.
export type AlbumPhase = "selection" | "delivery";
export type SourceStage = "selection" | "delivery";

// Gallery categories are free-text, entered per studio (saved & suggested from
// the user's own past galleries). "video" is the one reserved value — galleries
// tagged with it appear under the Video tab on the public browse page.
export const VIDEO_CATEGORY = "video";

export interface Feedback {
  id: string;
  album_id: string | null;
  client_name: string | null;
  rating: number | null;
  content: string;
  approved: boolean;
  created_at: string;
}

export interface SiteSettings {
  id: number;
  profile_name: string;
  profile_role: string;
  profile_location: string;
  profile_bio: string;
  profile_avatar_url: string | null;
  profile_cover_url: string | null;
  stat_years: number;
  contact_phone: string;
  contact_email: string;
  contact_instagram: string;
  contact_facebook: string | null;
  contact_tiktok: string | null;
  contact_youtube: string | null;
  contact_address: string;
  contact_hours: string;
  site_title: string | null;
  site_description: string | null;
  favicon_url: string | null;
  featured_images: string[] | null;
  basic_discount_percent: number;
  price_basic_month: number;
  price_basic_year: number;
  price_studio_month: number;
  price_studio_year: number;
  price_photographer_month: number;
  price_photographer_year: number;
  price_photographer_plus_month: number;
  price_photographer_plus_year: number;
  studio_promo_percent: number;
  studio_discount_percent: number;
  photographer_discount_percent: number;
  photographer_plus_discount_percent: number;
  // Giảm giá riêng theo chu kỳ (tháng / năm) cho từng gói.
  basic_discount_month_percent: number;
  basic_discount_year_percent: number;
  photographer_discount_month_percent: number;
  photographer_discount_year_percent: number;
  photographer_plus_discount_month_percent: number;
  photographer_plus_discount_year_percent: number;
  studio_discount_month_percent: number;
  studio_discount_year_percent: number;
  landing_hero_title: string | null;
  landing_hero_sub: string | null;
  landing_hero_badge: string | null;
  landing_hero_note: string | null;
  upgrade_content: unknown | null;
  feature_flags: Record<string, string> | null; // cờ tính năng: { story: "coming_soon" }
  updated_at: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  percent: number;
  plan: string | null;
  active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  cycle: string | null;
  trial_days: number | null;
  created_at: string;
}

export interface UpgradeRequest {
  id: string;
  user_id: string | null;
  email: string | null;
  note: string | null;
  plan: string | null;
  cycle: string | null;
  discount_code: string | null;
  phone: string | null;
  amount: number | null;
  handled: boolean;
  created_at: string;
}

export type SourceKind = "file" | "folder";

export interface AlbumSource {
  id: string;
  album_id: string;
  name: string;
  drive_url: string;
  kind: SourceKind;
  stage: SourceStage;
  position: number;
  created_at: string;
}

export interface Photo {
  id: string;
  album_id: string;
  source_id: string | null;
  drive_file_id: string;
  name: string;
  position: number;
  is_video: boolean;
  created_at: string;
}

export interface Selection {
  id: string;
  album_id: string;
  photo_id: string;
  photo_name: string;
  session_id: string;
  client_name: string | null;
  client_note: string | null;
  photographer_note: string | null;
  created_at: string;
}

// ── Studio module (studio.mstudo.com) ──────────────────────────────────────

export type ShootType =
  | "photo"
  | "video"
  | "psc"
  | "makeup"
  | "rental"
  | "prewedding"
  | "wedding"
  | "other"
  | "both"; // legacy
export type ContractStatus =
  | "draft"
  | "sent"
  | "approved"
  | "in_progress"
  | "completed"
  | "cancelled";
export type CrewRole = "photographer" | "cameraman" | "assistant" | "editor" | "other";
export type CrewStatus = "pending" | "accepted" | "declined";

export interface StudioService {
  id: string;
  owner_id: string;
  name: string;
  clauses: string;
  position: number;
  active: boolean;
  created_at: string;
}

export interface StudioContract {
  id: string;
  owner_id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  shoot_type: ShootType;
  service_id: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  status: ContractStatus;
  deposit: number;
  note: string | null;
  client_token: string;
  client_signed_name: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  studio_signed_name: string | null;
  studio_signature: string | null;
  studio_signed_at: string | null;
  gallery_album_id: string | null;
  client_viewed_at: string | null;
  assigned_to: string | null;
  delivery_due: string | null;
  client_messenger: string | null;
  selection_album_id: string | null;
  source: string | null;
  brief_concept: string | null;
  brief_outfit: string | null;
  brief_refs: string | null;
  brief_note: string | null;
  brief_submitted_at: string | null;
  chosen_quote_option_id: string | null;
  chosen_quote_at: string | null;
  intake_token: string | null;
  intake: ContractIntake | null;
  intake_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vị trí khách chọn trong form điền thông tin. Có thể là toạ độ (ghim trên
 * bản đồ / GPS) hoặc chỉ là link Google Maps khách dán vào (khi đó lat/lng = null).
 * mapUrl luôn có để studio bấm mở chỉ đường.
 */
export interface IntakeLocation {
  lat: number | null;
  lng: number | null;
  mapUrl: string;
}

/** Dữ liệu form điền thông tin trước buổi chụp (lưu ở studio_contracts.intake). */
export interface ContractIntake {
  type: "psc" | "generic";
  bride?: { name?: string; phone?: string; makeup_time?: string; ceremony_time?: string; location?: IntakeLocation | null };
  groom?: { name?: string; phone?: string; depart_time?: string; ceremony_time?: string; location?: IntakeLocation | null };
  reception?: { time?: string; location?: IntakeLocation | null };
  contact_name?: string;
  contact_phone?: string;
  start_time?: string;
  location?: IntakeLocation | null;
  note?: string;
}

/**
 * Buổi chụp có phải kiểu "cô dâu & chú rể" (cưới / phóng sự cưới) không, để
 * quyết định form khách điền hiện 2 phần Nhà gái/Nhà trai hay bản thông thường.
 *
 * Nhận diện theo shoot_type LEGACY *và* tên dịch vụ studio tự đặt — vì khi chọn
 * một "Loại dịch vụ" tùy biến thì shoot_type luôn bị đưa về "other", nên chỉ
 * dựa vào shoot_type là không đủ (khách chọn dịch vụ tên "PSC" vẫn ra bản rút gọn).
 * Prewedding là buổi chụp đôi một địa điểm → KHÔNG dùng form 2 nhà.
 */
export function intakeIsWedding(shootType?: string | null, serviceName?: string | null): boolean {
  const hay = `${shootType || ""} ${serviceName || ""}`.toLowerCase();
  if (/pre[\s-]?wedding|pre[\s-]?wed|prewedding|pre[\s-]?cư/.test(hay)) return false;
  return /psc|cưới|wedding|đón dâu|rước dâu|vu quy|tân hôn|thành hôn|cô dâu|chú rể/.test(hay);
}

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  referral: "Giới thiệu",
  google: "Google / Tìm kiếm",
  walk_in: "Khách vãng lai",
  returning: "Khách cũ",
  other: "Khác",
};

export type NotificationKind =
  | "signed"
  | "edit_request"
  | "crew_accepted"
  | "crew_declined"
  | "review"
  | "payment"
  | "quote_accepted"
  | "announcement"
  | "new_user"
  | "upgrade_request"
  | "contact"
  | "selection"
  | "info";

export interface StudioNotification {
  id: string;
  owner_id: string;
  contract_id: string | null;
  album_id?: string | null;
  kind: NotificationKind;
  message: string;
  read: boolean;
  important?: boolean;
  created_at: string;
}

export interface ContractTask {
  id: string;
  contract_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface ContractTemplate {
  id: string;
  owner_id: string;
  name: string;
  shoot_type: ShootType;
  note: string | null;
  created_at: string;
}

export interface ContractTemplateItem {
  id: string;
  template_id: string;
  name: string;
  qty: number;
  unit_price: number;
  position: number;
}

export interface ContractItem {
  id: string;
  contract_id: string;
  name: string;
  qty: number;
  unit_price: number;
  position: number;
  created_at: string;
}

export interface ContractCrew {
  id: string;
  contract_id: string;
  name: string;
  phone: string | null;
  role: CrewRole;
  salary: number;
  status: CrewStatus;
  note: string | null;
  responded_at: string | null;
  paid: boolean;
  paid_at: string | null;
  position: number;
  created_at: string;
  /** Thông tin show studio gán cho người này. */
  task: string | null;
  side: string | null;
  start_time: string | null;
  end_time: string | null;
}

export type PaymentKind = "deposit" | "installment" | "final" | "other";

export interface ContractPayment {
  id: string;
  contract_id: string;
  amount: number;
  method: string | null;
  kind: PaymentKind;
  note: string | null;
  proof_url: string | null;
  paid_at: string;
  created_at: string;
}

export interface PricelistItem {
  id: string;
  owner_id: string;
  list_key: string;
  name: string;
  price: number;
  unit: string | null;
  category: string | null;
  description: string | null;
  active: boolean;
  show_on_home: boolean;
  position: number;
  created_at: string;
}

export interface StudioPackage {
  id: string;
  owner_id: string;
  client_name: string;
  client_phone: string | null;
  name: string;
  total_sessions: number;
  used_sessions: number;
  price: number;
  paid: boolean;
  note: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface StudioBooking {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  service: string | null;
  preferred_date: string | null;
  note: string | null;
  package_name: string | null;
  package_price: number | null;
  facebook: string | null;
  status: "new" | "accepted" | "pending" | "declined" | "handled" | "archived";
  created_at: string;
}

// ── Rental module (Thuê đồ: váy cưới, vest, áo dài, phụ kiện) ───────────────

export type RentalCategory = "dress" | "vest" | "ao_dai" | "accessory" | "other";
export type RentalItemStatus = "available" | "maintenance" | "retired";
export type RentalOrderStatus =
  | "booked"
  | "picked_up"
  | "returned"
  | "overdue"
  | "canceled";

export const RENTAL_CATEGORY_LABEL: Record<RentalCategory, string> = {
  dress: "Váy cưới",
  vest: "Vest",
  ao_dai: "Áo dài",
  accessory: "Phụ kiện",
  other: "Khác",
};

export const RENTAL_CATEGORIES: RentalCategory[] = [
  "dress",
  "vest",
  "ao_dai",
  "accessory",
  "other",
];

export const RENTAL_ITEM_STATUS_LABEL: Record<RentalItemStatus, string> = {
  available: "Sẵn sàng",
  maintenance: "Bảo trì / giặt",
  retired: "Ngừng dùng",
};

export const RENTAL_ORDER_STATUS_LABEL: Record<RentalOrderStatus, string> = {
  booked: "Đã đặt",
  picked_up: "Đã nhận đồ",
  returned: "Đã trả",
  overdue: "Quá hạn",
  canceled: "Đã huỷ",
};

export interface RentalItem {
  id: string;
  owner_id: string;
  name: string;
  category: RentalCategory;
  code: string | null;
  size: string | null;
  color: string | null;
  rental_price: number;
  deposit: number;
  quantity: number;
  cover_url: string | null;
  status: RentalItemStatus;
  note: string | null;
  created_at: string;
}

export interface RentalOrder {
  id: string;
  owner_id: string;
  contract_id: string | null;
  client_name: string;
  client_phone: string | null;
  pickup_date: string | null;
  return_date: string | null;
  returned_at: string | null;
  total_price: number;
  deposit_paid: number;
  status: RentalOrderStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalOrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  name: string;
  price: number;
  qty: number;
  created_at: string;
}

/** An order with its line items joined in (used by the rental manager UI). */
export interface RentalOrderWithItems extends RentalOrder {
  items: RentalOrderItem[];
}

export interface StudioEquipment {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
}

export interface ContractEquipment {
  id: string;
  contract_id: string;
  equipment_id: string | null;
  name: string;
  created_at: string;
}

export interface ContractQuoteOption {
  id: string;
  contract_id: string;
  name: string;
  price: number;
  description: string | null;
  position: number;
  created_at: string;
}

export type ProductStatus = "ordered" | "in_progress" | "done";
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  ordered: "Đã đặt",
  in_progress: "Đang làm",
  done: "Đã giao",
};
export interface ContractProduct {
  id: string;
  contract_id: string;
  name: string;
  qty: number;
  cost: number;
  status: ProductStatus;
  note: string | null;
  position: number;
  created_at: string;
}

export interface ContractPaymentPlan {
  id: string;
  contract_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
  payment_id: string | null;
  position: number;
  created_at: string;
}

export interface StudioExpense {
  id: string;
  owner_id: string;
  contract_id: string | null;
  title: string;
  amount: number;
  category: string | null;
  note: string | null;
  spent_at: string;
  client_visible: boolean; // shown + billed on the client portal vs internal-only
  created_at: string;
}

export interface ContractEditRequest {
  id: string;
  contract_id: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
}

export interface StudioCrew {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  role: CrewRole;
  note: string | null;
  created_at: string;
}

export interface StudioEvent {
  id: string;
  owner_id: string;
  contract_id: string | null;
  title: string;
  event_date: string;
  event_time: string | null;
  note: string | null;
  remind: boolean;
  created_at: string;
}

export const SHOOT_TYPE_LABEL: Record<ShootType, string> = {
  photo: "Chụp ảnh",
  video: "Quay phim",
  psc: "Quay chụp PSC",
  makeup: "Trang điểm",
  rental: "Thuê đồ",
  prewedding: "Chụp prewedding",
  wedding: "Trọn gói ngày cưới",
  other: "Khác",
  both: "Chụp & Quay", // legacy value, still rendered for old contracts
};

/** Service types offered in dropdowns (excludes the legacy "both"). */
export const SHOOT_TYPES: ShootType[] = [
  "photo",
  "video",
  "psc",
  "makeup",
  "rental",
  "prewedding",
  "wedding",
  "other",
];

/**
 * Nhãn hiển thị tiếng Việt của trạng thái hợp đồng (bản thiết kế, mục "Trạng
 * thái hợp đồng"). GIÁ TRỊ ENUM TRONG DB KHÔNG ĐỔI — chỉ đổi chữ hiện ra.
 */
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Nháp",
  sent: "Chờ khách duyệt",
  approved: "Khách đã duyệt",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

/**
 * Màu pill trạng thái hợp đồng — một bảng dùng chung cho mọi màn, để hợp đồng
 * "Đang thực hiện" ở Tổng quan, danh sách và chi tiết luôn cùng một màu.
 */
export const CONTRACT_STATUS_TONE: Record<ContractStatus, { fg: string; bg: string }> = {
  draft: { fg: "var(--nu)", bg: "var(--nuS)" },
  sent: { fg: "var(--am)", bg: "var(--amS)" },
  approved: { fg: "var(--bl)", bg: "var(--blS)" },
  in_progress: { fg: "var(--tl)", bg: "var(--tlS)" },
  completed: { fg: "var(--gn)", bg: "var(--gnS)" },
  cancelled: { fg: "var(--rd)", bg: "var(--rdS)" },
};

export const CREW_ROLE_LABEL: Record<CrewRole, string> = {
  photographer: "Photographer",
  cameraman: "Cameraman",
  assistant: "Trợ lý",
  editor: "Sửa ảnh / Dựng phim",
  other: "Khác",
};

export const CREW_STATUS_LABEL: Record<CrewStatus, string> = {
  pending: "Chờ phản hồi",
  accepted: "Đã nhận",
  declined: "Từ chối",
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Đặt cọc",
  installment: "Thanh toán đợt",
  final: "Tất toán",
  other: "Khác",
};

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  equipment: "Thiết bị",
  rent: "Thuê mặt bằng / studio",
  props: "Đạo cụ / trang phục",
  travel: "Di chuyển",
  marketing: "Marketing",
  outsource: "Thuê ngoài",
  other: "Khác",
};

// ── Site builder (multi-tenant portfolio sites) ─────────────────────────────

export type SiteTheme = {
  accent?: string;   // primary accent colour
  bg?: string;       // background
  text?: string;
  font?: "serif" | "sans";
  mode?: "light" | "dark";          // affects borders/cards
  logo?: string;                    // logo image URL (shown in the top bar)
  heroAlign?: "center" | "left";    // hero text alignment
  galleryCols?: number;             // gallery columns (2–4)
  radius?: "rounded" | "sharp";     // corner style
  navPosition?: "top" | "left" | "right" | "bottom"; // menu placement
  heroSize?: "small" | "medium" | "large"; // cover height
  contentWidth?: "full" | "compact";       // published page width
  customCss?: string;                      // advanced: raw CSS applied site-wide
  /** Nút liên hệ nổi góc phải (Zalo / gọi / Messenger / đặt lịch). */
  fab?: {
    off?: boolean;
    phone?: boolean;
    zalo?: boolean;
    messenger?: boolean;
    booking?: boolean;
  };
};
export type SiteSeo = { title?: string; description?: string; og_image?: string };

export interface Site {
  id: string;
  owner_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_verified?: boolean;
  template: string;
  theme: SiteTheme;
  seo: SiteSeo;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type SiteBlockType =
  | "hero"
  | "gallery"
  | "about"
  | "pricing"
  | "testimonials"
  | "contact"
  | "video"
  | "social"
  | "faq"
  | "services"
  | "stats"
  | "cta"
  | "team"
  | "quote"
  | "logos"
  | "map"
  | "html";

export const SITE_BLOCK_LABEL: Record<SiteBlockType, string> = {
  hero: "Ảnh bìa / Giới thiệu",
  gallery: "Bộ sưu tập ảnh",
  about: "Về tôi / studio",
  pricing: "Bảng giá",
  testimonials: "Đánh giá khách",
  contact: "Liên hệ & đặt lịch",
  video: "Video",
  social: "Mạng xã hội",
  faq: "Câu hỏi thường gặp",
  services: "Dịch vụ / Quy trình",
  stats: "Con số nổi bật",
  cta: "Kêu gọi đặt lịch",
  team: "Đội ngũ",
  quote: "Trích dẫn nổi bật",
  logos: "Logo đối tác / báo chí",
  map: "Bản đồ địa chỉ",
  html: "HTML / Nhúng mã (tự thiết kế)",
};

export interface SiteBlock {
  id: string;
  site_id: string;
  type: SiteBlockType;
  position: number;
  visible: boolean;
  // Free-form per-block config (heading, text, image url, selected album ids…).
  config: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// THIỆP CƯỚI ONLINE (online wedding invitation)
// ============================================================================

/** Bank details for a "mừng cưới" (gift) QR, reused from the contract bank shape. */
export type WeddingBank = {
  holder?: string;     // chủ tài khoản
  account?: string;    // số tài khoản
  bin?: string;        // mã ngân hàng (VietQR BIN)
  name?: string;       // tên ngân hàng
};

/** One ceremony / party block (Lễ Vu Quy, Lễ Thành Hôn, Tiệc cưới…). */
export type WeddingEventBlock = {
  label?: string;      // "Lễ Vu Quy" / "Tiệc cưới"
  date?: string;       // ISO date (yyyy-mm-dd)
  time?: string;       // "11:00"
  venue?: string;      // tên địa điểm (Tư gia / Trung tâm tiệc cưới…)
  address?: string;
  map_url?: string;    // link Google Maps
};

/** Full editable content of an invitation (stored in wedding_invitations.config). */
export type WeddingConfig = {
  groom_name?: string;
  bride_name?: string;
  groom_subtitle?: string;   // ví dụ: "Con ông … & bà …"
  bride_subtitle?: string;
  cover_url?: string;        // ảnh bìa
  cover_quote?: string;      // lời mở / "Save the date"
  wedding_date?: string;     // ngày cưới chính (ISO) — dùng cho đếm ngược
  story?: string;            // chuyện tình yêu
  events?: WeddingEventBlock[];
  gallery?: string[];        // ảnh cưới (URL)
  rsvp_enabled?: boolean;
  rsvp_note?: string;
  gift_enabled?: boolean;    // hộp mừng cưới
  gift_note?: string;
  groom_bank?: WeddingBank;
  bride_bank?: WeddingBank;
  music_url?: string;        // URL nhạc nền (mp3/audio)
  music_autoplay?: boolean;  // thử tự phát (trình duyệt có thể chặn)
  guestbook_enabled?: boolean; // hiện sổ lưu bút (lời chúc của khách)
  guests_password?: string;    // mật khẩu mở "trang xem riêng" (danh sách RSVP + lời chúc) cho gia đình; KHÔNG bao giờ gửi ra thiệp công khai
  guests?: string[];           // danh sách khách mời → link + QR cá nhân hóa cho từng người
  guest_greeting?: string;     // lời mời phía trên tên khách (mặc định "Trân trọng kính mời")
  location?: string;           // địa điểm ngắn hiện ở bìa (vd "Hà Nội, Việt Nam")
  groom_role?: string;         // vai vế chú rể (vd "Út nam")
  bride_role?: string;         // vai vế cô dâu (vd "Trưởng nữ")
  groom_photo?: string;        // ảnh chân dung chú rể (khối hồ sơ)
  bride_photo?: string;        // ảnh chân dung cô dâu
  dress_code?: string[];       // màu trang phục (dress code) — danh sách mã màu
  dress_code_note?: string;
  map_url?: string;            // link Google Maps (nút "Chỉ đường")
  thanks_note?: string;        // lời cảm ơn ở cuối thiệp
  thanks_photo?: string;       // ảnh tròn ở phần cảm ơn
  story_url?: string;          // link Love Story (nếu trống → tự lấy theo hợp đồng)
  accent?: string;           // màu nhấn (#rrggbb) — ghi đè màu của template
  font?: "serif" | "sans";   // ghi đè phông của template
};

export const WEDDING_TEMPLATES = ["classic", "elegant", "floral", "modern", "cinematic", "story", "editorial", "royal", "sweet"] as const;
export type WeddingTemplate = (typeof WEDDING_TEMPLATES)[number];

export interface WeddingInvitation {
  id: string;
  owner_id: string;
  contract_id: string | null;
  slug: string;
  edit_token: string;
  template: WeddingTemplate | string;
  config: WeddingConfig;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeddingRsvp {
  id: string;
  invitation_id: string;
  guest_name: string;
  side: "groom" | "bride" | "both";
  attending: boolean;
  num_guests: number;
  wish: string | null;
  created_at: string;
}

// ============================================================================
// TRANG LOVE STORY (Instagram-style story/share page)
// ============================================================================

export type StoryTimelineItem = { date?: string; title?: string; text?: string };

/** Editable content of a Love Story page (story_pages.config). */
export type StoryConfig = {
  groom_name?: string;
  bride_name?: string;
  cover_url?: string;        // ảnh bìa (URL trực tiếp)
  tagline?: string;          // câu mở đầu
  story?: string;            // nội dung chia sẻ chính
  timeline?: StoryTimelineItem[];
  drive_folder?: string;     // link folder Drive KHÁCH cung cấp — ảnh/video lấy từ đây
  video_url?: string;        // link video (Drive/YouTube) — không bắt buộc
  event_label?: string;      // vd "Lễ Thành Hôn"
  event_date?: string;
  event_venue?: string;
  wishes_enabled?: boolean;  // cho khách gửi lời chúc
  guest_upload?: boolean;    // cho quan khách tự đăng ảnh/video (ghi vào Drive cặp đôi)
  accent?: string;
  music_url?: string;
};

export interface StoryPage {
  id: string;
  owner_id: string;
  contract_id: string | null;
  slug: string;
  edit_token: string;
  config: StoryConfig;
  published: boolean;
  created_at: string;
  updated_at: string;
}

/** Reserved subdomains that tenants may not claim. */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "album", "img", "image", "images", "studio", "api", "admin",
  "mail", "smtp", "ftp", "cdn", "static", "assets", "blog", "help", "support",
  "dashboard", "login", "auth", "vieetjk", "mstudo", "test", "dev", "staging",
]);

/** Sum of a list of payment amounts. */
export function sumAmounts(rows: { amount: number }[]): number {
  return rows.reduce((s, r) => s + (r.amount || 0), 0);
}

/** Total contract value = sum(qty × unit_price). */
export function contractTotal(items: { qty: number; unit_price: number }[]): number {
  return items.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0);
}

/** Format a VND amount in full with thousands separators (e.g. 1.500.000đ). */
export function vnd(n: number | null | undefined): string {
  const v = Math.round(n || 0);
  return v.toLocaleString("vi-VN") + "đ";
}

/**
 * Tiền rút gọn cho ô KPI / biểu đồ: ≥1 tỷ → "1,2 tỷ", ≥1 triệu → "28,5tr",
 * còn lại → "850k" (theo mục "Định dạng tiền" của bản thiết kế). Chỗ nào là
 * con số phải đối chiếu (hoá đơn, bảng thanh toán) thì dùng vnd() đầy đủ.
 */
export function vndShort(n: number | null | undefined): string {
  const v = Math.round(n || 0);
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const num = (x: number, d: number) =>
    x.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: d });
  if (a >= 1e9) return `${sign}${num(a / 1e9, 1)} tỷ`;
  if (a >= 1e6) return `${sign}${num(a / 1e6, 1)}tr`;
  if (a >= 1e3) return `${sign}${num(a / 1e3, 0)}k`;
  return `${sign}${a}`;
}


/* ─────────────── Customer quotes (báo giá) ─────────────── */
export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "adjust_requested"
  | "accepted"
  | "converted"
  | "expired"
  | "cancelled";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  viewed: "Khách đã xem",
  adjust_requested: "Khách yêu cầu chỉnh",
  accepted: "Khách đồng ý",
  converted: "Đã tạo hợp đồng",
  expired: "Hết hạn",
  cancelled: "Đã hủy",
};

export interface StudioQuote {
  id: string;
  owner_id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_facebook: string | null;
  event_date: string | null;
  location: string | null;
  intro: string | null;
  note: string | null;
  deposit_percent: number;
  auto_create_contract: boolean;
  status: QuoteStatus;
  client_token: string;
  expires_at: string | null;
  contract_id: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  bulk_discount_amount: number;
  bulk_discount_min_items: number;
  discount_package_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  name: string;
  description: string | null;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount: boolean;
  selected: boolean;
  position: number;
  package_group: string | null;
  created_at: string;
}

export interface QuoteAdjustment {
  id: string;
  quote_id: string;
  author: "client" | "studio";
  message: string;
  resolved: boolean;
  created_at: string;
}

/**
 * Total of the items the client currently has selected. Discount items
 * (is_discount=true) are subtracted; regular items are added. Required items
 * (is_optional=false) always count regardless of `selected`.
 */
export function quoteSelectedTotal(
  items: { qty: number; unit_price: number; selected: boolean; is_optional: boolean; is_discount?: boolean }[]
): number {
  return items.reduce((sum, i) => {
    const active = i.selected || !i.is_optional;
    if (!active) return sum;
    const line = (i.qty || 0) * (i.unit_price || 0);
    return i.is_discount ? sum - line : sum + line;
  }, 0);
}
