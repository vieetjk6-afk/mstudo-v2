import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/rate-limit";
import { collageGate, deleteCollage, listCollages, saveCollage } from "@/lib/album-collage";

export const dynamic = "force-dynamic";

/**
 * Bộ layout khách đang ghép trong album giao khách — GIỮ 1 NGÀY kể từ lần lưu
 * cuối (album_collages.expires_at), mở lại sửa tiếp được kể cả trên máy khác.
 *
 * Vé đi trong header (GET / DELETE) hoặc thân (POST), không bao giờ trên URL:
 *   x-collage-key  — vé SĐT cô dâu / chú rể (cùng vé ảnh in)
 *   x-album-access — vé mở khoá album có mật khẩu
 */
const NO_STORE = { "Cache-Control": "no-store" };

function headerCred(req: Request) {
  return { key: req.headers.get("x-collage-key") ?? undefined, access: req.headers.get("x-album-access") ?? undefined };
}

/** Danh sách bộ layout còn hạn của album. */
export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = limitByIp(req, `album-collage-list:${slug}`, 40, 60_000);
  if (limited) return limited;
  const gate = await collageGate(slug, headerCred(req));
  if (!gate.ok) return gate.res;
  const sets = await listCollages(gate.db, gate.album.id);
  if (sets === null) return NextResponse.json({ error: "not_ready" }, { status: 503, headers: NO_STORE });
  return NextResponse.json({ sets }, { headers: NO_STORE });
}

/**
 * Lưu một bộ layout (tạo mới khi không có id). Màn ghép tự lưu sau mỗi lần sửa.
 * Body: { id?: string, title?: string, doc: CollageDoc, key?: string, access?: string }
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = limitByIp(req, `album-collage-save:${slug}`, 90, 60_000);
  if (limited) return limited;
  const raw = await req.text();
  // Bộ layout là JSON nhỏ (vài KB) — chặn thân quá lớn trước khi phân tích.
  if (raw.length > 400_000) return NextResponse.json({ error: "too_large" }, { status: 413, headers: NO_STORE });
  let body: { id?: unknown; title?: unknown; doc?: unknown; key?: unknown; access?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const gate = await collageGate(slug, body);
  if (!gate.ok) return gate.res;
  const res = await saveCollage(gate.db, gate.album.id, body, gate.brand);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
  return NextResponse.json(res, { headers: NO_STORE });
}

/** Xoá một bộ layout: DELETE ?id=<uuid> */
export async function DELETE(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = limitByIp(req, `album-collage-del:${slug}`, 30, 60_000);
  if (limited) return limited;
  const gate = await collageGate(slug, headerCred(req));
  if (!gate.ok) return gate.res;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const ok = await deleteCollage(gate.db, gate.album.id, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: NO_STORE });
}
