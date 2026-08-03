/**
 * Avatar chữ cái theo bản thiết kế: băm tên → chọn 1 trong 8 màu cố định, nền
 * là màu đó pha 14% với trắng. Cùng một khách luôn ra cùng màu ở mọi màn.
 */
const AVATAR_COLORS = [
  "#8E2DA8", "#2F5FD0", "#BC5B5B", "#A9791F",
  "#177A5B", "#5B4BC4", "#C0642B", "#2F8F8A",
] as const;

/** Màu chữ của avatar (một trong 8 màu bản thiết kế). */
export function avatarColor(name: string | null | undefined): string {
  const s = (name || "?").trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Nền + chữ cho avatar. Nền pha trắng để chữ luôn đọc được. */
export function avatarStyle(name: string | null | undefined): { background: string; color: string } {
  const c = avatarColor(name);
  return { background: `color-mix(in srgb, ${c} 14%, #fff)`, color: c };
}

/** Chữ cái đầu, tối đa 2 ký tự: "Lê Hoàng Sang" → "LS". */
export function initials(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
