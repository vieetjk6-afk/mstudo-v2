import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
function stamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
const ymd = (s: string) => s.replace(/-/g, "");
const esc = (s: string) => (s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function vevent(uid: string, date: string, time: string | null, summary: string, location: string | null, desc: string | null, now: Date) {
  const lines = ["BEGIN:VEVENT", `UID:${uid}@mstudo`, `DTSTAMP:${stamp(now)}`];
  const mt = (time || "").match(/(\d{1,2}):(\d{2})/);
  if (mt) {
    const start = `${ymd(date)}T${pad(+mt[1])}${pad(+mt[2])}00`;
    // +2h end (floating local time). Ca bắt đầu ≥22h phải lăn DTEND sang NGÀY
    // HÔM SAU, nếu không end < start và Google/Apple Calendar bỏ sự kiện.
    const endH = (+mt[1] + 2) % 24;
    let endDate = date;
    if (+mt[1] + 2 >= 24) {
      const d = new Date(date + "T00:00:00Z");
      endDate = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    }
    lines.push(`DTSTART:${start}`, `DTEND:${ymd(endDate)}T${pad(endH)}${pad(+mt[2])}00`);
  } else {
    const d = new Date(date + "T00:00:00");
    const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    lines.push(`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(next)}`);
  }
  lines.push(`SUMMARY:${esc(summary)}`);
  if (location) lines.push(`LOCATION:${esc(location)}`);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Read-only iCalendar feed of a studio's shoots + schedule notes. */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: owner } = await db.from("profiles").select("id, full_name").eq("calendar_token", params.token).maybeSingle();
  if (!owner) return new Response("Not found", { status: 404 });

  const [{ data: contracts }, { data: events }] = await Promise.all([
    db.from("studio_contracts").select("id, title, client_name, event_date, event_time, location, status").eq("owner_id", owner.id).not("event_date", "is", null).in("status", ["approved", "in_progress", "completed"]),
    db.from("studio_events").select("id, title, event_date, event_time, note, contract:studio_contracts(title, event_date)").eq("owner_id", owner.id),
  ]);

  const now = new Date();
  const body: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mstudo//Studio//VI",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc((owner.full_name || "Studio") + " — Lịch chụp")}`,
  ];
  for (const c of (contracts ?? []) as Array<{ id: string; title: string; client_name: string | null; event_date: string; event_time: string | null; location: string | null }>) {
    body.push(vevent(`c-${c.id}`, c.event_date, c.event_time, c.title + (c.client_name ? ` · ${c.client_name}` : ""), c.location, null, now));
  }
  for (const e of (events ?? []) as Array<{ id: string; title: string; event_date: string; event_time: string | null; note: string | null; contract: { title: string; event_date: string | null } | { title: string; event_date: string | null }[] | null }>) {
    // Mốc khác ngày hợp đồng chính → ghi rõ "{Tên mốc} — [Tên hợp đồng chính]".
    const cc = Array.isArray(e.contract) ? e.contract[0] : e.contract;
    const summary = cc && cc.event_date && cc.event_date !== e.event_date ? `${e.title} — [${cc.title}]` : e.title;
    body.push(vevent(`e-${e.id}`, e.event_date, e.event_time, summary, null, e.note, now));
  }
  body.push("END:VCALENDAR");

  return new Response(body.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
