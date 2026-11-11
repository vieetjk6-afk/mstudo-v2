import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/rate-limit";
import { collageGate, loadCollagePhotos } from "@/lib/album-collage";

export const dynamic = "force-dynamic";
// Phần gợi ý có hạn giờ riêng (vài giây, xem loadCollagePhotos); đây là hàng rào
// cuối: DB treo hẳn thì Vercel cắt ở 30 giây và máy khách báo lỗi kèm nút thử
// lại — thay vì giữ vòng quay "Đang mở album…" tới 5 phút.
export const maxDuration = 30;

/**
 * Ảnh để ghép layout + nhóm gợi ý (ảnh chung, cô dâu, chú rể, decor, bê quả…).
 *
 * Chỉ ảnh studio đã GIAO trong album này (bỏ video) — trình chọn ảnh của khách
 * dựng từ đúng danh sách này, không có chỗ nào đưa ảnh ngoài vào. Nhóm gợi ý
 * tính từ khuôn mặt máy chủ đã quét + tên thư mục, miễn phí (lib/collage/categories).
 *
 * POST để vé (SĐT / mật khẩu album) đi trong thân, không nằm trên URL.
 * Body: { key?: string, access?: string }
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = limitByIp(req, `album-collage-photos:${slug}`, 30, 60_000);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; access?: unknown };
  const gate = await collageGate(slug, body);
  if (!gate.ok) return gate.res;
  const { photos, groups, partial } = await loadCollagePhotos(gate.db, gate.album.id);
  return NextResponse.json({ photos, cats: groups.cats, info: groups.info, partial }, { headers: { "Cache-Control": "no-store" } });
}
