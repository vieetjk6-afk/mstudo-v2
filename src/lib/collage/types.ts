/* ═══════════════════════════════════════════════════════════════════════════
   GHÉP LAYOUT ẢNH — mô hình dữ liệu dùng chung cho bộ dàn trang, màn sửa, bộ
   xuất ảnh và máy chủ (lưu bộ layout 1 ngày — bảng album_collages).

   Bộ máy dàn trang chép từ dự án Albumi (repo Album-layout: core/adaptive.ts,
   core/compose.ts, core/typography.ts, core/crop.ts), thu gọn cho đúng việc ở
   đây: mỗi "trang" là MỘT ảnh đăng mạng xã hội (không có trang đôi, gáy, bleed).

   Toạ độ tính theo điểm ảnh của khổ (vd. 1080×1350), gốc ở góc trên trái.
   File này chỉ nhập KIỂU (import type) để kiểm thử Node chạy thẳng được.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { Ornament } from "./ornaments";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cách đặt ảnh trong khung: phủ kín khung, phóng thêm `zoom`, điểm (cx, cy) của ảnh nằm giữa khung. */
export interface Crop {
  /** 1 = vừa phủ kín khung; > 1 = phóng to thêm. */
  zoom: number;
  /** Điểm của ảnh (0..1) được đưa vào giữa khung. */
  cx: number;
  cy: number;
}

/**
 * Trang trí khung ảnh — để layout không chỉ là lưới chữ nhật: ảnh in có viền
 * (polaroid), khung vòm, khung tròn, xoay nhẹ kiểu ảnh rải trên bàn, đổ bóng.
 * `rect` của khung là hộp NGOÀI (gồm cả viền); phần ảnh = rect trừ viền
 * (frame-geom.ts → photoArea). Mọi trường đều tuỳ chọn: bộ cũ không có `deco`
 * vẫn vẽ y như trước.
 */
export interface FrameDeco {
  /** Hình phần ảnh: "round" bo góc mềm, "arch" vòm (trên tròn), "oval" tròn / bầu dục, "stamp" tem thư (viền răng cưa). */
  shape?: "round" | "arch" | "oval" | "stamp";
  /** Viền quanh ảnh, theo điểm ảnh của khổ (kiểu ảnh in). */
  pad?: number;
  /** Viền dưới — dày hơn viền kia là kiểu ảnh lấy liền (polaroid), chỗ để viết chữ. */
  padBottom?: number;
  /** Màu viền #rrggbb (mặc định trắng). */
  padColor?: string;
  /** Xoay quanh tâm khung, độ (−15…15). */
  rotate?: number;
  /** Đổ bóng mềm — tách khung khỏi nền / ảnh phía sau. */
  shadow?: boolean;
}

export interface PhotoFrame {
  kind: "photo";
  id: string;
  rect: Rect;
  /** photos.id — luôn là ảnh studio đã giao trong album này (máy chủ kiểm lại khi lưu). */
  photoId: string;
  crop: Crop;
  deco?: FrameDeco;
}

export type TextAlign = "left" | "center" | "right";

export interface TextStyle {
  /** Khoá phông — xem fonts.ts (chỉ các phông có đủ dấu tiếng Việt). */
  font: string;
  /** Cỡ chữ, theo điểm ảnh của khổ. */
  size: number;
  weight: number;
  italic: boolean;
  color: string;
  align: TextAlign;
  /** Giãn chữ, tính theo em. */
  letterSpacing: number;
  lineHeight: number;
  uppercase: boolean;
  /** Bóng mờ sau chữ — cho chữ đặt đè lên ảnh. */
  shadow?: boolean;
}

export interface TextFrame {
  kind: "text";
  id: string;
  rect: Rect;
  /** Nội dung khách nhập. Xuống dòng bằng \n; dòng dài tự ngắt theo bề ngang khung. */
  text: string;
  style: TextStyle;
  /** Xoay quanh tâm khung chữ, độ — chữ viết trên ảnh in đang xoay. */
  rotate?: number;
  /**
   * Mẫu chữ (lockups.ts): dòng nhỏ phía trên / dưới nội dung + hoa văn. Dòng phụ
   * là trang trí của khối chữ (ngày cưới, tên), không phải nội dung thứ hai.
   */
  lockup?: { id: string; kicker?: string; sub?: string };
}

export type Frame = PhotoFrame | TextFrame;

/** Ảnh làm nền mờ cho cả trang. */
export interface BgPhoto {
  photoId: string;
  /** Bán kính mờ theo phần nghìn cạnh ngắn của trang (0 = nét, 60 = rất mờ). */
  blur: number;
  /** Độ phủ màu nền lên ảnh 0..1 (0 = ảnh nguyên, 0.6 = nhạt hẳn). */
  dim: number;
}

export interface CollagePage {
  id: string;
  frames: Frame[];
  background: string;
  bgPhoto?: BgPhoto;
  /** Hình trang trí (hoa lá, băng dính, dải phim…) — ornaments.ts. */
  ornaments?: Ornament[];
  /**
   * Carousel liền mạch: trang rộng gấp `span` lần khổ (2–10 slide), khung ảnh
   * vắt qua ranh giới slide. Xuất ra `span` ảnh nối nhau khi vuốt.
   */
  span?: number;
  /** Tên công thức bố cục đã dùng (để gợi ý khác đi và tránh lặp giữa các trang). */
  recipe: string;
  styleId: string;
}

/** Số ảnh mỗi trang: một con số cố định, hoặc "mix" = máy đổi nhịp 2–5 ảnh cho đa dạng. */
export type PerPage = number | "mix";

/** Một bộ layout khách đang ghép — đúng thứ lưu ở album_collages.data. */
export interface CollageDoc {
  v: 1;
  /** "manual" = khách tự chọn ảnh cho từng layout (tạo lại giữ nguyên nhóm ảnh từng trang). */
  mode?: "manual";
  formatId: string;
  /** Phong cách khách chọn lúc tạo ("mix" = mỗi trang một kiểu). */
  styleId: string;
  perPage: PerPage;
  /** Nội dung chữ khách nhập — mỗi nội dung nằm trên ĐÚNG MỘT trang, mỗi trang tối đa một nội dung. */
  texts: string[];
  /** Ảnh khách đã chọn để ghép, theo thứ tự chọn. */
  photoIds: string[];
  /** Tỉ lệ rộng/cao của từng ảnh — để vẽ lại đúng ngay khi mở, không phải đợi ảnh tải. */
  aspects: Record<string, number>;
  pages: CollagePage[];
  seed: number;
}

/** Thông tin một ảnh mà bộ dàn trang cần. */
export interface LayoutInput {
  id: string;
  /** rộng / cao */
  aspect: number;
  /** Điểm ưu tiên 0..10 — ảnh điểm cao được khung lớn. */
  score: number;
  /** Ảnh có người là nhân vật chính (cô dâu, chú rể, ảnh chung) — được làm "ảnh chính" của trang. */
  hero?: boolean;
  /** Khung khuôn mặt [x, y, w, h] chuẩn hoá 0..1 — để cắt ảnh không mất mặt. */
  faces?: number[][];
  /** Màu chủ đạo của ảnh (#rrggbb, đậm trước) — cho phong cách "Màu theo ảnh". */
  palette?: string[];
}

/* ── Giới hạn — dùng chung cho giao diện và máy chủ ────────────────────────── */
export const COLLAGE_LIMITS = {
  /** Ảnh tối đa một trang (lưới đẹp nhất tới 9). */
  pagePhotos: 9,
  /** Ảnh tối đa khách chọn cho một bộ. */
  photos: 60,
  /** Trang tối đa một bộ. */
  pages: 30,
  /** Nội dung chữ tối đa một bộ (≤ số trang). */
  texts: 30,
  /** Ký tự tối đa một nội dung. */
  textChars: 280,
  /** Khung tối đa một trang (ảnh + chữ). Carousel: tối đa 3 ảnh mỗi slide. */
  frames: 32,
  /** Hình trang trí tối đa một trang. */
  ornaments: 24,
  /** Slide tối đa của một carousel liền mạch. */
  slides: 10,
  /** Bộ layout tối đa đang giữ cho một album. */
  sets: 12,
  /** Bộ layout được giữ trên máy chủ bao lâu kể từ lần lưu cuối. */
  keepMs: 24 * 60 * 60 * 1000,
} as const;
