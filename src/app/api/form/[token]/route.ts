import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import { sendPushToOwner } from "@/lib/push";
import { intakeViewHref } from "@/lib/notifications";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

const str = (v: any, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
function loc(v: any): { lat: number | null; lng: number | null; mapUrl: string } | null {
  if (!v || typeof v !== "object") return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  // (0,0) là giá trị mặc định khi trình duyệt chưa lấy được GPS — giữa Đại Tây
  // Dương, không phải vị trí thật → coi như không có toạ độ.
  const hasCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  if (hasCoords) {
    return { lat, lng, mapUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` };
  }
  // Không có toạ độ → chấp nhận link Google Maps khách dán (chỉ http/https, chống chèn javascript:).
  const url = typeof v.mapUrl === "string" ? v.mapUrl.trim().slice(0, 500) : "";
  if (/^https?:\/\//i.test(url)) return { lat: null, lng: null, mapUrl: url };
  return null;
}

/** Khách gửi form điền thông tin. Xác thực bằng intake_token (không mật khẩu). */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Không mật khẩu, mà mỗi lần gửi lại đẩy một thông báo vào chuông của studio →
  // giới hạn theo IP để một vòng lặp không chôn vùi chuông thông báo.
  const limited = await limitByIpDurable(req, "intake-form", 15, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("id, owner_id, title, client_name")
    .eq("intake_token", params.token)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const type = b?.type === "psc" ? "psc" : "generic";

  let intake: any;
  if (type === "psc") {
    intake = {
      type,
      bride: {
        name: str(b?.bride?.name, 100),
        phone: str(b?.bride?.phone, 30),
        makeup_time: str(b?.bride?.makeup_time, 20),
        ceremony_time: str(b?.bride?.ceremony_time, 20),
        location: loc(b?.bride?.location),
      },
      groom: {
        name: str(b?.groom?.name, 100),
        phone: str(b?.groom?.phone, 30),
        depart_time: str(b?.groom?.depart_time, 20),
        ceremony_time: str(b?.groom?.ceremony_time, 20),
        location: loc(b?.groom?.location),
      },
      reception: {
        time: str(b?.reception?.time, 20),
        location: loc(b?.reception?.location),
      },
      note: str(b?.note, 1000),
    };
  } else {
    intake = {
      type,
      contact_name: str(b?.contact_name, 100),
      contact_phone: str(b?.contact_phone, 30),
      start_time: str(b?.start_time, 20),
      location: loc(b?.location),
      note: str(b?.note, 1000),
    };
  }

  const { error } = await db
    .from("studio_contracts")
    .update({ intake, intake_submitted_at: new Date().toISOString() })
    .eq("id", c.id);
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  // Báo studio: CHỈ một dòng ngắn. Chi tiết (SĐT, giờ, vị trí từng nhà) xem ở
  // màn "Thông tin buổi chụp" — bấm thông báo là mở thẳng màn đó (kind "intake",
  // xem notificationHref). Trước đây cả khối chi tiết bị nhét vào thông báo nên
  // chuông dài cả màn hình mà vẫn không gửi riêng được cho từng thợ.
  const message = `Khách ${c.client_name || ""} đã điền thông tin buổi chụp "${c.title || ""}".`.replace(/\s+/g, " ");

  try {
    await db.from("studio_notifications").insert({
      owner_id: c.owner_id,
      contract_id: c.id,
      kind: "intake",
      message,
    });
  } catch {
    /* không chặn: form vẫn lưu thành công */
  }
  await sendPushToOwner(c.owner_id, {
    title: "Khách đã điền thông tin buổi chụp",
    body: message,
    url: intakeViewHref(c.id),
    tag: `intake-${c.id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
