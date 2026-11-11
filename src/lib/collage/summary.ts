/* Tóm tắt mẫu một bộ ảnh ghép dùng (họ bố cục, phong cách, mẫu chữ, carousel,
   màu ảnh) — để thống kê cho studio (album_collage_events.meta). Vài trăm byte.
   Thuần — máy chủ và máy khách dùng chung. */
import type { CollageDoc } from "./types";

export function docSummary(doc: Pick<CollageDoc, "pages" | "formatId" | "filter">): Record<string, unknown> {
  const uniq = (xs: string[]) => [...new Set(xs)].slice(0, 20);
  return {
    format: doc.formatId,
    families: uniq(doc.pages.map((p) => p.recipe.split(/[:~]/)[0]).filter(Boolean)),
    styles: uniq(doc.pages.map((p) => p.styleId)),
    lockups: uniq(doc.pages.flatMap((p) => p.frames.flatMap((f) => (f.kind === "text" && f.lockup ? [f.lockup.id] : []))).filter(Boolean)),
    carousel: doc.pages.some((p) => (p.span ?? 1) > 1),
    ...(doc.filter ? { filter: doc.filter } : {}),
  };
}
