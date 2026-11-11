import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/rate-limit";
import { collageGate, recordCollageEvent } from "@/lib/album-collage";

export const dynamic = "force-dynamic";

/**
 * Thống kê cho studio: khách vừa tải ảnh ghép / tạo video. Tạo bộ ghép mới thì
 * máy chủ tự ghi lúc lưu (saveCollage) — route này chỉ cho những việc xảy ra
 * hoàn toàn trên máy khách.
 * Body: { kind: "export" | "video", n: number, meta?: {...}, key?, access? }
 */
const KINDS = new Set(["export", "video"]);
const META_KEYS = ["format", "families", "styles", "lockups", "carousel", "filter", "seconds", "music"];

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = limitByIp(req, `album-collage-event:${slug}`, 30, 60_000);
  if (limited) return limited;
  const raw = await req.text();
  if (raw.length > 8000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: { kind?: unknown; n?: unknown; meta?: unknown; key?: unknown; access?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.kind !== "string" || !KINDS.has(body.kind)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const gate = await collageGate(slug, body);
  if (!gate.ok) return gate.res;
  // Chỉ giữ các khoá đã biết, giá trị là chuỗi / số / mảng chuỗi ngắn.
  const meta: Record<string, unknown> = {};
  if (body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)) {
    for (const k of META_KEYS) {
      const v = (body.meta as Record<string, unknown>)[k];
      if (typeof v === "string" && v.length <= 40) meta[k] = v;
      else if (typeof v === "number" && Number.isFinite(v)) meta[k] = v;
      else if (typeof v === "boolean") meta[k] = v;
      else if (Array.isArray(v)) meta[k] = v.filter((x): x is string => typeof x === "string" && x.length <= 40).slice(0, 20);
    }
  }
  await recordCollageEvent(gate.db, gate.album.id, body.kind as "export" | "video", typeof body.n === "number" ? body.n : 1, meta).catch(() => {});
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
