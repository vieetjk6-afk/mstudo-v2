import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

const str = (v: any, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
function loc(v: any): { lat: number | null; lng: number | null; mapUrl: string } | null {
  if (!v || typeof v !== "object") return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
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

  // Báo studio (chuông thông báo) kèm link vị trí đã chọn.
  const lines: string[] = [`Khách ${c.client_name || ""} đã điền thông tin buổi chụp "${c.title || ""}".`];
  if (type === "psc") {
    lines.push(
      `Nhà gái${intake.bride.name ? ` (${intake.bride.name})` : ""}: SĐT ${intake.bride.phone || "—"}, makeup ${intake.bride.makeup_time || "—"}, lễ ${intake.bride.ceremony_time || "—"}${
        intake.bride.location ? `, vị trí: ${intake.bride.location.mapUrl}` : ""
      }`
    );
    lines.push(
      `Nhà trai${intake.groom.name ? ` (${intake.groom.name})` : ""}: SĐT ${intake.groom.phone || "—"}, xuất phát ${intake.groom.depart_time || "—"}, lễ ${intake.groom.ceremony_time || "—"}${
        intake.groom.location ? `, vị trí: ${intake.groom.location.mapUrl}` : ""
      }`
    );
    if (intake.reception.time || intake.reception.location) {
      lines.push(
        `Tiệc: giờ ${intake.reception.time || "—"}${intake.reception.location ? `, vị trí: ${intake.reception.location.mapUrl}` : ""}`
      );
    }
  } else {
    lines.push(
      `${intake.contact_name ? `Người liên hệ: ${intake.contact_name}, ` : ""}SĐT: ${intake.contact_phone || "—"}${
        intake.start_time ? `, bắt đầu: ${intake.start_time}` : ""
      }${intake.location ? `, vị trí: ${intake.location.mapUrl}` : ""}`
    );
  }
  if (intake.note) lines.push(`Ghi chú: ${intake.note}`);

  try {
    await db.from("studio_notifications").insert({
      owner_id: c.owner_id,
      contract_id: c.id,
      kind: "info",
      message: lines.join("\n"),
    });
  } catch {
    /* không chặn: form vẫn lưu thành công */
  }

  return NextResponse.json({ ok: true });
}
