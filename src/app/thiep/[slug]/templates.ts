// Visual "skins" for wedding invitation templates. Each template is a palette +
// typography + a few layout flags; the renderer (WeddingRenderer) applies them
// as CSS variables so one renderer can produce several distinct looks.

export type WeddingSkin = {
  name: string;
  label: string;
  accent: string;       // primary accent (overridable by config.accent)
  bg: string;           // page background
  surface: string;      // card background
  text: string;         // body text
  muted: string;        // secondary text
  border: string;
  font: "serif" | "sans";
  hero: "overlay" | "framed"; // cover treatment
  motif: "floral" | "geo" | "none";
  dark: boolean;        // dark templates flip the cover text colour logic
};

export const WEDDING_SKINS: Record<string, WeddingSkin> = {
  classic: {
    name: "classic",
    label: "Cổ điển (be ấm)",
    accent: "#b08968",
    bg: "#fbf7f2",
    surface: "#ffffff",
    text: "#3a3530",
    muted: "rgba(58,53,48,0.62)",
    border: "rgba(58,53,48,0.14)",
    font: "serif",
    hero: "overlay",
    motif: "none",
    dark: false,
  },
  elegant: {
    name: "elegant",
    label: "Sang trọng (tối + vàng)",
    accent: "#c9a86a",
    bg: "#15110d",
    surface: "rgba(255,255,255,0.045)",
    text: "#ece6da",
    muted: "rgba(236,230,218,0.6)",
    border: "rgba(201,168,106,0.28)",
    font: "serif",
    hero: "overlay",
    motif: "geo",
    dark: true,
  },
  floral: {
    name: "floral",
    label: "Hoa (hồng pastel)",
    accent: "#d77a93",
    bg: "#fdf3f4",
    surface: "#ffffff",
    text: "#4a373c",
    muted: "rgba(74,55,60,0.6)",
    border: "rgba(215,122,147,0.22)",
    font: "serif",
    hero: "overlay",
    motif: "floral",
    dark: false,
  },
  modern: {
    name: "modern",
    label: "Hiện đại (tối giản)",
    accent: "#2f7d77",
    bg: "#ffffff",
    surface: "#f5f6f4",
    text: "#232524",
    muted: "rgba(35,37,36,0.55)",
    border: "rgba(35,37,36,0.12)",
    font: "sans",
    hero: "framed",
    motif: "none",
    dark: false,
  },
  cinematic: {
    name: "cinematic", label: "Điện ảnh (tối · chữ viết tay)",
    accent: "#e6c39c", bg: "#171013", surface: "rgba(255,255,255,0.045)", text: "#f4e9df",
    muted: "rgba(244,233,223,0.62)", border: "rgba(230,195,156,0.28)", font: "serif", hero: "overlay", motif: "geo", dark: true,
  },
  story: {
    name: "story", label: "Story trượt (tối · gold)",
    accent: "#e8c9a8", bg: "#0d0a0b", surface: "rgba(255,255,255,0.05)", text: "#f0e6e2",
    muted: "rgba(240,230,226,0.6)", border: "rgba(232,201,168,0.26)", font: "serif", hero: "overlay", motif: "geo", dark: true,
  },
  editorial: {
    name: "editorial", label: "Tạp chí (sáng · cam đất)",
    accent: "#b5624f", bg: "#f4f1ec", surface: "#ffffff", text: "#241f21",
    muted: "#8f867f", border: "#e4ddd3", font: "serif", hero: "framed", motif: "none", dark: false,
  },
  royal: {
    name: "royal", label: "Hoàng gia (kem · vàng · chữ viết tay)",
    accent: "#a67c52", bg: "#f7f1e7", surface: "#fffdf8", text: "#413a30",
    muted: "#9c9483", border: "#e7ddcc", font: "serif", hero: "overlay", motif: "floral", dark: false,
  },
  sweet: {
    name: "sweet", label: "Ngọt ngào (hồng · cuộn dọc đầy đủ)",
    accent: "#c98a86", bg: "#fbeef0", surface: "#fff8f6", text: "#5a3f42",
    muted: "rgba(90,63,66,0.6)", border: "rgba(201,138,134,0.24)", font: "serif", hero: "overlay", motif: "floral", dark: false,
  },
};

export function getSkin(template?: string): WeddingSkin {
  return WEDDING_SKINS[template ?? "classic"] ?? WEDDING_SKINS.classic;
}

// ────────────────────────────────────────────────────────────────────────────
// DANH MỤC MẪU THIỆP — nguồn dữ liệu duy nhất cho bộ chọn mẫu trong trình
// chỉnh sửa: tên hiển thị, một dòng mô tả phong cách, và bảng màu để vẽ ảnh
// minh hoạ nhanh (không phải render cả thiệp) trên thẻ chọn mẫu.
// ────────────────────────────────────────────────────────────────────────────

export type TemplateGroup = "phone" | "long";

export type WeddingTemplateMeta = {
  name: string;
  label: string;      // tên ngắn trên thẻ chọn
  tagline: string;    // một dòng mô tả phong cách
  group: TemplateGroup;
  bg: string;         // nền tấm thiệp (vẽ ảnh minh hoạ)
  ink: string;        // màu chữ
  accent: string;     // màu nhấn
  serif: boolean;     // chữ tên dùng serif hay sans
  dark: boolean;
};

/** Mẫu "thiệp điện thoại": khổ dọc, cuộn một mạch như cầm tấm thiệp trên tay. */
const PHONE_TEMPLATES: WeddingTemplateMeta[] = [
  { name: "sen", label: "Sen & kem", tagline: "Áo dài tối giản · kem & hồng sen", group: "phone", bg: "#faf6ef", ink: "#3a3129", accent: "#c98a93", serif: true, dark: false },
  { name: "sonmai", label: "Sơn mài", tagline: "Indigo & vàng lá · chữ dọc song hỷ", group: "phone", bg: "#101a2e", ink: "#f5efe1", accent: "#d6b266", serif: true, dark: true },
  { name: "giaydo", label: "Giấy dó", tagline: "Vân giấy & mực nho · dấu triện đỏ", group: "phone", bg: "#efe7d6", ink: "#23201b", accent: "#b2342c", serif: true, dark: false },
  { name: "y2k", label: "Y2K chrome", tagline: "Gradient lỏng · đĩa chrome xoay", group: "phone", bg: "#12052b", ink: "#ffffff", accent: "#ff4fd8", serif: false, dark: true },
  { name: "aurora", label: "Aurora", tagline: "Pastel mộng mơ · thẻ kính mờ", group: "phone", bg: "#f2f0fd", ink: "#33305a", accent: "#b98fd0", serif: true, dark: false },
  { name: "songhy", label: "Song Hỷ", tagline: "Truyền thống Việt · đỏ & vàng", group: "phone", bg: "#8e1b1b", ink: "#fff8ec", accent: "#ffd77a", serif: true, dark: true },
  { name: "vintage", label: "Hoa lá vintage", tagline: "Vẽ tay · cánh hoa rơi · tông đất", group: "phone", bg: "#f7f2e7", ink: "#3b3222", accent: "#b0724f", serif: true, dark: false },
  { name: "glass", label: "3D glass", tagline: "Quả cầu nổi · kính mờ hiện đại", group: "phone", bg: "#22224a", ink: "#ffffff", accent: "#ff9ad5", serif: false, dark: true },
  { name: "neon", label: "Neon ticket", tagline: "Cyberpunk · vé concert phát sáng", group: "phone", bg: "#07080f", ink: "#d6f7f2", accent: "#00ffd5", serif: false, dark: true },
  { name: "scrapbook", label: "Scrapbook", tagline: "Polaroid dán tay · giấy note vàng", group: "phone", bg: "#e9e3d6", ink: "#3a3227", accent: "#a8734f", serif: false, dark: false },
];

/** Mẫu "trang dài" — bộ gốc, đẹp cả trên máy tính. */
const LONG_TEMPLATES: WeddingTemplateMeta[] = Object.values(WEDDING_SKINS).map((s) => ({
  name: s.name,
  label: s.label.split(" (")[0],
  tagline: s.label.includes("(") ? s.label.split("(")[1].replace(")", "") : "Thiệp cuộn dọc",
  group: "long" as const,
  bg: s.bg,
  ink: s.text,
  accent: s.accent,
  serif: s.font === "serif",
  dark: s.dark,
}));

export const WEDDING_TEMPLATE_CATALOG: WeddingTemplateMeta[] = [...PHONE_TEMPLATES, ...LONG_TEMPLATES];

export const TEMPLATE_GROUPS: { key: TemplateGroup; title: string; hint: string }[] = [
  { key: "phone", title: "Thiệp điện thoại", hint: "Khổ dọc, cuộn một mạch — hợp để gửi qua Zalo/Messenger." },
  { key: "long", title: "Trang thiệp dài", hint: "Bố cục rộng, đẹp cả khi khách mở trên máy tính." },
];

export function getTemplateMeta(name?: string): WeddingTemplateMeta {
  return WEDDING_TEMPLATE_CATALOG.find((t) => t.name === name) ?? WEDDING_TEMPLATE_CATALOG[0];
}

/** Mẫu này là thiệp khổ điện thoại? (dùng để canh các khối phụ cho vừa khung) */
export function isPhoneTemplate(name?: string): boolean {
  return getTemplateMeta(name).group === "phone";
}

export const WEDDING_TEMPLATE_LIST = WEDDING_TEMPLATE_CATALOG.map((t) => ({ name: t.name, label: t.label }));
