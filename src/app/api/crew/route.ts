import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "8:5" | "08:05" → "08:05"; rác hoặc rỗng → null (nghĩa là cả ngày). */
function normTime(v: string | null | undefined): string | null {
  // Chấp nhận cả GIÂY: <input type="time"> ở Safari/một số trình duyệt di động
  // trả "08:00:00" chứ không phải "08:00". Regex cũ loại thẳng giá trị đó và trả
  // null, nên giờ biến mất im lặng trong khi task/side (kiểu text) vẫn lưu được.
  const m = (v ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Public crew portal (no login). A photographer/cameraman enters their phone to
 * see every job they've been assigned across studios + accept/decline.
 *   POST { phone }                                   -> list assignments + busy days
 *   POST { action: "respond", id, phone, status }    -> accept | decline a job
 *   POST { action: "busy_add", phone, date, start?, end?, title?, note? }
 *                                                    -> add a schedule entry
 *                                                       (no times = cả ngày)
 *   POST { action: "busy_remove", id, phone }        -> clear one entry
 *   POST { action: "shift_set", phone, company, shift } -> set/clear công ty + ca
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    action?: string;
    id?: string;
    status?: string;
    date?: string;
    note?: string;
    start?: string;
    end?: string;
    title?: string;
    company?: string;
    shift?: string;
    studioId?: string;
    captcha?: string;
  };
  const phone = digits(body.phone);
  if (!phone) return NextResponse.json({ error: "no_phone" }, { status: 400 });

  // Chống lạm dụng: cổng thợ chỉ nhận diện bằng SĐT (không token/đăng nhập), nên
  // các action GHI (respond/busy_add/busy_remove) không có captcha là bề mặt phá
  // hoại (đánh dấu bận, từ chối buổi của người khác nếu biết SĐT). Giới hạn theo
  // IP+SĐT để chặn dò/spam hàng loạt. Lookup vẫn có Turnstile (token dùng-một-lần).
  const rl = await limitByIpDurable(req, `crew:${phone}`, 30, 60_000);
  if (rl) return rl;

  // Require CAPTCHA on initial phone lookup (not on follow-up actions that already have id)
  if (!body.action || body.action === "lookup") {
    // Tra cứu bằng SĐT trả về LỊCH LÀM VIỆC của thợ — dò hàng loạt là moi được
    // dữ liệu cá nhân. Khi captcha không xác minh được thì chỉ cho vài lượt mỗi
    // giờ trên mỗi IP thay vì mở cửa như trước.
    const captcha = await guardCaptcha(req, "crew-lookup", body.captcha);
    if (captcha) return captcha;
  }

  const db = createAdminClient();

  if (body.action === "busy_add") {
    if (!DATE_RE.test(body.date ?? "")) return NextResponse.json({ error: "no_date" }, { status: 400 });
    // Mốc bận thuộc về ĐÚNG MỘT studio: thợ chạy nhiều nơi thì báo riêng cho
    // từng nơi. Phải là studio đã nhận thợ này vào sổ, nếu không ai cầm SĐT
    // người khác cũng nhét được lịch vào studio bất kỳ.
    const studioId = (body.studioId || "").trim();
    if (!studioId) return NextResponse.json({ error: "no_studio" }, { status: 400 });
    const { data: roster } = await db.from("studio_crew").select("phone").eq("owner_id", studioId);
    if (!(roster ?? []).some((r) => digits(r.phone as string) === phone)) {
      return NextResponse.json({ error: "not_in_roster" }, { status: 403 });
    }
    const start = normTime(body.start);
    const end = normTime(body.end);
    // Chỉ nhận CẢ HAI giờ hoặc KHÔNG giờ nào. Một đầu giờ lửng thì không biểu
    // diễn được khoảng thời gian nào cả.
    if ((start && !end) || (!start && end)) {
      return NextResponse.json({ error: "bad_time" }, { status: 400 });
    }
    // insert chứ không upsert: một ngày thợ có thể nhận nhiều việc, và ràng buộc
    // duy nhất (phone, date) đã được gỡ ở migration crew_schedule.sql.
    const { error } = await db.from("crew_unavailable").insert({
      phone,
      date: body.date,
      start_time: start,
      end_time: end,
      // Giờ kết thúc nhỏ hơn giờ bắt đầu ⇒ vắt qua nửa đêm (vd 20:00 → 08:00).
      overnight: !!(start && end && end <= start),
      title: body.title?.trim() || null,
      note: body.note?.trim() || null,
      owner_id: studioId,
      created_by: "crew",
    });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "busy_remove") {
    if (!body.id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    // Chỉ xoá mốc của chính SĐT này và do CHÍNH THỢ thêm — mốc studio xếp thì
    // studio mới được gỡ. Phân biệt bằng created_by chứ không bằng owner_id
    // nữa, vì giờ mốc nào cũng có owner_id.
    await db.from("crew_unavailable").delete().eq("id", body.id).eq("phone", phone).eq("created_by", "crew");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "calendar_token") {
    // Cấp một lần rồi dùng mãi — token nằm trong URL feed nên đổi token là mọi
    // lịch đã đăng ký ở máy thợ chết theo.
    const { data: existing } = await db.from("crew_account").select("calendar_token").eq("phone", phone).maybeSingle();
    let token = existing?.calendar_token as string | undefined;
    if (!token) {
      token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
      await db.from("crew_account").upsert({ phone, calendar_token: token }, { onConflict: "phone" });
    }
    return NextResponse.json({ token });
  }

  if (body.action === "shift_set") {
    const shift = (body.shift || "").toUpperCase();
    if (!shift) {
      await db.from("crew_shift_plan").delete().eq("phone", phone);
      return NextResponse.json({ ok: true });
    }
    if (!["A", "B", "C"].includes(shift)) return NextResponse.json({ error: "bad_shift" }, { status: 400 });
    const { error } = await db.from("crew_shift_plan").upsert(
      { phone, company: body.company || "hoa_phat", shift, updated_at: new Date().toISOString() },
      { onConflict: "phone" },
    );
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "respond") {
    if (!body.id || (body.status !== "accepted" && body.status !== "declined")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    // Verify the crew row belongs to this phone before updating.
    const { data: row } = await db
      .from("contract_crew")
      .select("id, phone, name, contract:studio_contracts(owner_id, title)")
      .eq("id", body.id)
      .maybeSingle();
    if (!row || digits(row.phone) !== phone) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { error } = await db
      .from("contract_crew")
      .update({ status: body.status, responded_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    const ct = (row as unknown as { contract: { owner_id: string; title: string } | null }).contract;
    if (ct?.owner_id) {
      const crewMsg = `${row.name || phone} đã ${body.status === "accepted" ? "nhận" : "từ chối"} buổi “${ct.title}”`;
      await db.from("studio_notifications").insert({
        owner_id: ct.owner_id,
        contract_id: null,
        kind: body.status === "accepted" ? "crew_accepted" : "crew_declined",
        message: crewMsg,
      });
      await sendPushToOwner(ct.owner_id, { title: "Phản hồi từ thợ", body: crewMsg, url: "/dashboard/studio/calendar?tab=team", tag: "crew" });
    }
    return NextResponse.json({ ok: true });
  }

  // Việc được phân cho thợ này. Lọc thẳng trong SQL theo `phone_digits` — cột
  // sinh tự động chứa SĐT chỉ-số, có chỉ mục (migration crew_phone_digits.sql).
  //
  // Trước đây chỗ này TẢI TOÀN BỘ contract_crew của MỌI studio rồi lọc bằng JS,
  // vì SĐT lưu đúng như người ta gõ ("0912 345 678") nên không .eq() được. Chi
  // phí một lần mở cổng thợ tăng theo số studio trên nền tảng chứ không theo số
  // việc của thợ đó.
  const CREW_COLS =
    "id, name, role, salary, status, note, phone, responded_at, contract:studio_contracts(title, client_name, shoot_type, event_date, event_time, location, status)";
  const byDigits = await db
    .from("contract_crew")
    .select(CREW_COLS)
    .eq("phone_digits", phone)
    .order("created_at", { ascending: false });

  // Chưa chạy migration → cột chưa tồn tại. Lùi về lối cũ để cổng thợ vẫn chạy
  // (chậm nhưng đúng), giống cách crew_unavailable đang làm bên dưới.
  let mine = byDigits.data ?? [];
  if (byDigits.error) {
    const { data: all } = await db.from("contract_crew").select(CREW_COLS).order("created_at", { ascending: false });
    mine = (all ?? []).filter((r) => digits(r.phone) === phone);
  }

  const [{ data: busy }, { data: shiftPlan }] = await Promise.all([
    // select("*") để cổng thợ vẫn chạy trước khi migration crew_schedule.sql
    // được chạy — xem ghi chú ở dashboard/studio/team/page.tsx.
    db.from("crew_unavailable").select("*").eq("phone", phone).order("date"),
    db.from("crew_shift_plan").select("company, shift").eq("phone", phone).maybeSingle(),
  ]);
  const { data: acc } = await db.from("crew_account").select("calendar_token").eq("phone", phone).maybeSingle();

  return NextResponse.json({
    assignments: mine,
    busy: busy ?? [],
    shift: shiftPlan ?? null,
    calendarToken: acc?.calendar_token ?? null,
  });
}
