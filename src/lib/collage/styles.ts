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
  /** Ảnh chính làm nền mờ cả trang. */
  bgPhoto?: { blur: number; dim: number };
  /** Kiểu chữ hợp với phong cách (id trong TEXT_PRESETS) — máy chọn ngẫu nhiên trong đây. */
  presets: string[];
}

export const COLLAGE_STYLES: CollageStyle[] = [
  {
    id: "white", name: "Trắng tinh tế", background: "#ffffff", ink: "#2b2622",
    margin: 0.06, gap: 0.012, bleedBias: 0.25, editorialBias: 0.45,
    presets: ["serif-italic", "script", "caps", "classic"],
  },
  {
    id: "ivory", name: "Kem Hàn Quốc", background: "#f5f0e8", ink: "#4a3b2c",
    margin: 0.085, gap: 0.016, bleedBias: 0.1, editorialBias: 0.75,
    presets: ["classic", "soft", "caps", "script"],
  },
  {
    id: "film", name: "Đen điện ảnh", background: "#121212", ink: "#f1ede6",
    margin: 0, gap: 0.006, bleedBias: 0.75, editorialBias: 0.1,
    presets: ["caps", "bold", "serif-italic"],
  },
  {
    id: "blush", name: "Hồng phấn", background: "#f7e9e6", ink: "#7a4848",
    margin: 0.06, gap: 0.014, bleedBias: 0.2, editorialBias: 0.5,
    presets: ["script", "handwritten", "soft"],
  },
  {
    id: "tradition", name: "Đỏ truyền thống", background: "#7b1e22", ink: "#f0d49a",
    margin: 0.055, gap: 0.012, bleedBias: 0.2, editorialBias: 0.3,
    presets: ["classic", "serif-italic", "script"],
  },
  {
    id: "blur", name: "Nền ảnh mờ", background: "#ffffff", ink: "#ffffff",
    margin: 0.075, gap: 0.014, bleedBias: 0, editorialBias: 0.35,
    bgPhoto: { blur: 26, dim: 0.18 },
    presets: ["script", "serif-italic", "bold", "pen"],
  },
  {
    id: "tight", name: "Ghép sát", background: "#ffffff", ink: "#2b2622",
    margin: 0, gap: 0.008, bleedBias: 0.95, editorialBias: 0,
    presets: ["caps", "bold", "script"],
  },
];

/** "mix" = mỗi trang một phong cách (máy chọn), còn lại là id phong cách cố định. */
export const MIX_STYLE = "mix";
export const DEFAULT_STYLE_ID = "white";

/** Các phong cách hợp nhau khi trộn trong cùng một bộ (bỏ đỏ truyền thống — lệch tông). */
export const MIX_POOL = ["white", "ivory", "blush", "blur", "tight"];

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
