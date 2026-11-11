/* Phong cách ảnh ghép: màu nền, màu chữ, lề, khe giữa ảnh và xu hướng bố cục.
   Chép tinh thần bộ STYLES của Albumi (core/styles.ts), chọn lại cho ảnh đăng
   mạng xã hội của ảnh cưới. */

export interface CollageStyle {
  id: string;
  name: string;
  background: string;
  /** Màu chữ chính. */
  ink: string;
  /** Lề trang, theo tỉ lệ cạnh ngắn. */
  margin: number;
  /** Khe giữa ảnh, theo tỉ lệ cạnh ngắn. */
  gap: number;
  /** 0..1: ưu tiên ảnh tràn khung (không lề). */
  bleedBias: number;
  /** 0..1: ưu tiên bố cục biên tập nhiều khoảng trắng. */
  editorialBias: number;
  /** 0..1: ưu tiên bố cục trang trí (ảnh in polaroid, vòm, tròn, ảnh rải…); 0 = không dùng. */
  decoBias?: number;
  /** Ảnh chính làm nền mờ cả trang. */
  bgPhoto?: { blur: number; dim: number };
  /** Màu nền + màu chữ lấy từ màu chủ đạo của ảnh chính (palette.ts); `background`/`ink` là dự phòng. */
  fromPhoto?: boolean;
  /** Kiểu chữ hợp với phong cách (id trong TEXT_PRESETS) — máy chọn ngẫu nhiên trong đây. */
  presets: string[];
}

export const COLLAGE_STYLES: CollageStyle[] = [
  {
    id: "white", name: "Trắng tinh tế", background: "#ffffff", ink: "#2b2622",
    margin: 0.06, gap: 0.012, bleedBias: 0.25, editorialBias: 0.45, decoBias: 0.45,
    presets: ["serif-italic", "script", "caps", "classic", "formal", "didone", "geo"],
  },
  {
    id: "ivory", name: "Kem Hàn Quốc", background: "#f5f0e8", ink: "#4a3b2c",
    margin: 0.085, gap: 0.016, bleedBias: 0.1, editorialBias: 0.75, decoBias: 0.6,
    presets: ["classic", "soft", "caps", "script", "garamond", "formal", "signature"],
  },
  {
    id: "film", name: "Đen điện ảnh", background: "#121212", ink: "#f1ede6",
    margin: 0, gap: 0.006, bleedBias: 0.75, editorialBias: 0.1, decoBias: 0.25,
    presets: ["caps", "bold", "serif-italic", "didone", "geo"],
  },
  {
    id: "blush", name: "Hồng phấn", background: "#f7e9e6", ink: "#7a4848",
    margin: 0.06, gap: 0.014, bleedBias: 0.2, editorialBias: 0.5, decoBias: 0.7,
    presets: ["script", "handwritten", "soft", "brush", "signature"],
  },
  {
    id: "tradition", name: "Đỏ truyền thống", background: "#7b1e22", ink: "#f0d49a",
    margin: 0.055, gap: 0.012, bleedBias: 0.2, editorialBias: 0.3, decoBias: 0.4,
    presets: ["classic", "serif-italic", "script", "formal"],
  },
  {
    id: "blur", name: "Nền ảnh mờ", background: "#ffffff", ink: "#ffffff",
    margin: 0.075, gap: 0.014, bleedBias: 0, editorialBias: 0.35, decoBias: 0.55,
    bgPhoto: { blur: 26, dim: 0.18 },
    presets: ["script", "serif-italic", "bold", "pen", "brush", "geo"],
  },
  {
    id: "tight", name: "Ghép sát", background: "#ffffff", ink: "#2b2622",
    margin: 0, gap: 0.008, bleedBias: 0.95, editorialBias: 0, decoBias: 0,
    presets: ["caps", "bold", "script", "geo"],
  },
  {
    id: "kraft", name: "Giấy kraft", background: "#d9c6a8", ink: "#3b2e22",
    margin: 0.07, gap: 0.014, bleedBias: 0.05, editorialBias: 0.35, decoBias: 0.9,
    presets: ["handwritten", "pen", "script", "classic", "brush"],
  },
  {
    id: "sage", name: "Xanh ô liu", background: "#e4e8dc", ink: "#3c4a37",
    margin: 0.075, gap: 0.014, bleedBias: 0.1, editorialBias: 0.6, decoBias: 0.6,
    presets: ["classic", "serif-italic", "script", "caps", "garamond", "signature"],
  },
  {
    id: "palette", name: "Màu theo ảnh", background: "#f3eee8", ink: "#3b322b",
    margin: 0.075, gap: 0.014, bleedBias: 0.1, editorialBias: 0.5, decoBias: 0.6, fromPhoto: true,
    presets: ["serif-italic", "classic", "script", "formal", "garamond", "geo"],
  },
  {
    id: "mocha", name: "Nâu mocha", background: "#3a2d27", ink: "#f2e7d9",
    margin: 0.065, gap: 0.012, bleedBias: 0.2, editorialBias: 0.45, decoBias: 0.5,
    presets: ["serif-italic", "caps", "script", "didone", "formal"],
  },
];

/** "mix" = mỗi trang một phong cách (máy chọn), còn lại là id phong cách cố định. */
export const MIX_STYLE = "mix";
export const DEFAULT_STYLE_ID = "white";

/** Các phong cách hợp nhau khi trộn trong cùng một bộ (bỏ đỏ truyền thống — lệch tông). */
export const MIX_POOL = ["white", "ivory", "blush", "blur", "tight", "kraft", "sage"];

export function styleById(id: string | null | undefined): CollageStyle {
  return COLLAGE_STYLES.find((s) => s.id === id) ?? COLLAGE_STYLES[0];
}

/** Nền tối hay sáng — để chọn màu chữ / viền tương phản. */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
