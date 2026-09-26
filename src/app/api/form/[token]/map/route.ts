import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { locationFromUrl, searchPlaces } from "@/lib/intake-location";

export const dynamic = "force-dynamic";

/* Trợ giúp chọn vị trí cho form thông tin buổi chụp (CÔNG KHAI, xác thực bằng
   intake_token như chính form):
     GET  ?q=địa chỉ   → gợi ý địa điểm (tìm theo chữ)
     POST { url }      → toạ độ từ link Google Maps, kể cả link rút gọn
                         maps.app.goo.gl mà trình duyệt không tự mở được. */

async function tokenOk(token: string): Promise<boolean> {
  const { data } = await createAdminClient().from("studio_contracts").select("id").eq("intake_token", token).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const limited = limitByIp(req, "intake-map-search", 30, 60_000);
  if (limited) return limited;
  const { token } = await props.params;
  if (!(await tokenOk(token))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchPlaces(q) });
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const limited = limitByIp(req, "intake-map-resolve", 20, 60_000);
  if (limited) return limited;
  const { token } = await props.params;
  if (!(await tokenOk(token))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const input = typeof url === "string" ? url.trim().slice(0, 500) : "";
  if (!/^https?:\/\//i.test(input)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const location = await locationFromUrl(input);
  if (!location) return NextResponse.json({ error: "no_coords" }, { status: 422 });
  return NextResponse.json({ location });
}
