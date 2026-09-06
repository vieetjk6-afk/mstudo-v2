import { createAdminClient } from "@/lib/supabase/admin";
import { shiftBlockFor, SHIFT_COMPANY_LABEL, type ShiftLetter } from "@/lib/crew-shift";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (s: string) => s.replace(/-/g, "");
const esc = (s: string) => (s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function stamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function plusDay(date: string, n = 1) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Một VEVENT. Giờ để dạng "floating" (không hậu tố Z, không TZID) nên lịch của
 * thợ hiểu theo múi giờ máy họ — đúng ý "8 giờ sáng là 8 giờ sáng".
 */
function vevent(uid: string, date: string, start: string | null, end: string | null, overnight: boolean, summary: string, desc: string | null, now: Date) {
  const lines = ["BEGIN:VEVENT", `UID:${uid}@mstudo`, `DTSTAMP:${stamp(now)}`];
  if (start && end) {
    // Ca vắt qua nửa đêm thì DTEND phải sang NGÀY HÔM SAU, nếu không end < start
    // và Google/Apple lặng lẽ bỏ qua sự kiện.
    const endDate = overnight || end <= start ? plusDay(date) : date;
    lines.push(`DTSTART:${ymd(date)}T${start.replace(":", "")}00`, `DTEND:${ymd(endDate)}T${end.replace(":", "")}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(plusDay(date))}`);
  }
  lines.push(`SUMMARY:${esc(summary)}`);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/**
 * Feed iCalendar CHỈ ĐỌC cho lịch của một thợ.
 *
 * Đi đường .ics thay vì OAuth Google: thợ không có tài khoản trong hệ thống
 * (chỉ có số điện thoại), nên không có chỗ nào gắn refresh token cho tử tế. Thợ
 * dán URL này vào Google Calendar → "Khác" → "Từ URL" là xong, một chiều
 * app → lịch, không xin quyền gì của họ.
 *
 * Token nằm trong URL nên URL này là bí mật — ai có link là xem được lịch.
 */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: acc } = await db
    .from("crew_account")
    .select("phone")
    .eq("calendar_token", params.token)
    .maybeSingle();
  if (!acc) return new Response("Not found", { status: 404 });

  const phone = acc.phone as string;
  const [{ data: marks }, { data: plan }] = await Promise.all([
    db.from("crew_unavailable").select("*").eq("phone", phone).order("date"),
    db.from("crew_shift_plan").select("shift").eq("phone", phone).maybeSingle(),
  ]);

  const now = new Date();
  const body: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mstudo//crew//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lịch thợ · mstudo",
  ];

  type Mark = { id: string; date: string; start_time: string | null; end_time: string | null; overnight: boolean | null; title: string | null; note: string | null };
  for (const m of (marks ?? []) as Mark[]) {
    body.push(
      vevent(
        m.id,
        m.date,
        m.start_time?.slice(0, 5) ?? null,
        m.end_time?.slice(0, 5) ?? null,
        !!m.overnight,
        m.title || m.note || "Bận",
        m.note && m.title ? m.note : null,
        now,
      ),
    );
  }

  // Ca công ty được TÍNH ra chứ không lưu, nên chỉ trải một khoảng quanh hôm nay
  // — đủ để lịch luôn có ca phía trước mà file không phình vô hạn.
  const shift = (plan?.shift as ShiftLetter | undefined) ?? null;
  if (shift) {
    const today = new Date();
    for (let i = -30; i < 180; i++) {
      const d = new Date(today.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      const b = shiftBlockFor(d, shift);
      if (!b) continue;
      body.push(vevent(`shift-${d}-${b.shift}`, d, b.start, b.end, b.overnight, `Ca ${b.shift} · ${SHIFT_COMPANY_LABEL.hoa_phat}`, null, now));
    }
  }

  body.push("END:VCALENDAR");
  return new Response(body.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Lịch đổi liên tục nhưng Google chỉ hỏi lại vài giờ một lần — không cần
      // cache thêm ở tầng CDN.
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
