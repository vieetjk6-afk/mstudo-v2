import type { ADSize, ADTpl } from "./designer-core";

/* Dữ liệu tĩnh của Thiết kế album: khổ in, bộ mẫu, nhóm mẫu — dùng chung cho
 * bản cũ (AlbumDesigner) và bản mới (AlbumDesignerV2). */

export type Size = { id: string; name: string; dim: string; w: number; h: number; tag: string };
export const SIZES: Size[] = [
  { id: "sq30", name: "Vuông 30×30", dim: "30 × 30 cm", w: 30, h: 30, tag: "Bán chạy nhất" },
  { id: "sq25", name: "Vuông 25×25", dim: "25 × 25 cm", w: 25, h: 25, tag: "Gọn nhẹ" },
  { id: "ls32", name: "Ngang 30×20", dim: "30 × 20 cm", w: 30, h: 20, tag: "Kể chuyện" },
  { id: "ls43", name: "Ngang 40×30", dim: "40 × 30 cm", w: 40, h: 30, tag: "Khổ lớn" },
  { id: "pt23", name: "Dọc 20×30", dim: "20 × 30 cm", w: 20, h: 30, tag: "Chân dung" },
  { id: "a4l", name: "A4 Ngang", dim: "29.7 × 21 cm", w: 29.7, h: 21, tag: "Tiêu chuẩn" },
  { id: "a4p", name: "A4 Dọc", dim: "21 × 29.7 cm", w: 21, h: 29.7, tag: "Tiêu chuẩn" },
  { id: "sq20", name: "Vuông 20×20", dim: "20 × 20 cm", w: 20, h: 20, tag: "Mini" },
];

export type Tpl = { id: string; name: string; cat: string; page: string; ink: string; font: string; sample: string; upper?: boolean };
export const CM = "var(--font-cormorant), serif";
export const SC = "var(--font-script), cursive";
export const TEMPLATES: Tpl[] = [
  { id: "blanc", name: "Blanc", cat: "Hiện đại", page: "#ffffff", ink: "#17181a", font: CM, sample: "Blanc" },
  { id: "grid", name: "Grid Studio", cat: "Hiện đại", page: "#f5f4f1", ink: "#1b1b1b", font: "var(--font-manrope), sans-serif", sample: "STUDIO", upper: true },
  { id: "vogue", name: "Éditorial", cat: "Editorial", page: "#fbfaf8", ink: "#111111", font: CM, sample: "Vol. 01" },
  { id: "kinfolk", name: "Kinfolk", cat: "Editorial", page: "#f2f0ea", ink: "#2a2723", font: CM, sample: "Moments" },
  { id: "amour", name: "Amour", cat: "Lãng mạn", page: "#fbf5ef", ink: "#4a3b34", font: SC, sample: "Amour" },
  { id: "bloom", name: "Bloom", cat: "Lãng mạn", page: "#fcf6f3", ink: "#5b4a45", font: CM, sample: "In Bloom" },
  { id: "noir", name: "Noir", cat: "Sang trọng", page: "#1a1a1c", ink: "#ece7dd", font: CM, sample: "NOIR", upper: true },
  { id: "velvet", name: "Velvet", cat: "Sang trọng", page: "#241d24", ink: "#efe6ea", font: CM, sample: "Velvet" },
  { id: "lumen", name: "Lumen", cat: "Hiện đại", page: "#f7f7f5", ink: "#1c1c1e", font: "var(--font-manrope), sans-serif", sample: "Lumen" },
  { id: "korea", name: "Hàn Quốc", cat: "Hiện đại", page: "#f4f2ee", ink: "#2b2a28", font: "var(--font-manrope), sans-serif", sample: "Seoul" },
  { id: "ivory", name: "Ivory", cat: "Editorial", page: "#faf7f1", ink: "#26221c", font: CM, sample: "Ivory" },
  { id: "film", name: "Film", cat: "Lãng mạn", page: "#efe7db", ink: "#4b3f31", font: CM, sample: "Kodak" },
  { id: "sage", name: "Sage", cat: "Lãng mạn", page: "#eef1ea", ink: "#38402f", font: CM, sample: "Sage" },
  { id: "onyx", name: "Onyx", cat: "Sang trọng", page: "#101012", ink: "#e8e6e2", font: CM, sample: "ONYX", upper: true },
  { id: "mocha", name: "Mocha", cat: "Sang trọng", page: "#efe7df", ink: "#4a3b30", font: CM, sample: "Mocha" },
];
export const CATS = ["Tất cả", "Hiện đại", "Editorial", "Lãng mạn", "Sang trọng"];

export type SavedRow = { id: string; name: string; size: ADSize; tpl: ADTpl; updated_at: string };
export type Step = "home" | "size" | "template" | "editor";
