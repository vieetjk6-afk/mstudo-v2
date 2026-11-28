/**
 * Google Calendar helper — server-side only.
 * Uses stored OAuth2 refresh token per user to create/update/delete events.
 */
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAIN_HOST } from "@/lib/hosts";

const CLIENT_ID     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI  = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

export function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(state?: string): string {
  const oauth2 = makeOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: state ?? "",
  });
}

/** Exchange code for tokens, persist refresh_token in profiles. */
export async function connectGoogleCalendar(userId: string, code: string) {
  const oauth2 = makeOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh_token returned — try disconnecting and reconnecting.");
  const db = createAdminClient();
  await db
    .from("profiles")
    .update({ google_refresh_token: tokens.refresh_token, google_calendar_id: "primary" })
    .eq("id", userId);
}

/** Remove the stored token. */
export async function disconnectGoogleCalendar(userId: string) {
  const db = createAdminClient();
  await db.from("profiles").update({ google_refresh_token: null, google_calendar_id: null }).eq("id", userId);
}

/** Return an authenticated calendar client for a user, or null if not connected. */
async function calendarFor(userId: string) {
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("google_refresh_token, google_calendar_id").eq("id", userId).maybeSingle();
  if (!data?.google_refresh_token) return null;

  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({ refresh_token: data.google_refresh_token });
  return {
    cal: google.calendar({ version: "v3", auth: oauth2 }),
    calendarId: data.google_calendar_id || "primary",
  };
}

/**
 * Kiểm tra THẬT xem Google Lịch còn dùng được không — gọi API chứ không chỉ xem
 * DB có token. Token bị thu hồi ở phía Google vẫn nằm nguyên trong DB, nên chỉ
 * kiểm tra sự tồn tại là báo "đã kết nối" trong khi mọi lượt đồng bộ đều trượt.
 */
/**
 * Dựng nội dung sự kiện Google Lịch từ một hợp đồng.
 *
 * Tách ra dùng chung cho cả lúc lưu lẻ lẫn lúc đồng bộ hàng loạt — hai bản sao
 * trôi dạt khỏi nhau đúng là kiểu lỗi đã tốn của dự án này cả buổi.
 */
/**
 * Link tuyệt đối tới trang hợp đồng trong dashboard studio — để bấm từ sự kiện
 * Google Lịch là mở đúng hợp đồng. Trang nằm sau đăng nhập nên luôn ở host
 * chính (không phải domain riêng của studio). Chưa cấu hình MAIN_HOST (dev,
 * preview) thì không có link: đường dẫn tương đối dán vào Google là vô dụng.
 */
export function contractDashboardUrl(contractId: string | null | undefined): string | null {
  if (!contractId || !MAIN_HOST) return null;
  return `https://${MAIN_HOST}/dashboard/studio/contracts/${contractId}`;
}

export function contractToGCal(ct: {
  id?: string | null;
  title?: string | null;
  client_name?: string | null;
  shoot_type?: string | null;
  event_date: string;
  event_time?: string | null;
  location?: string | null;
}, typeLabel: string): GCalEventInput {
  const url = contractDashboardUrl(ct.id);
  const summary = ct.client_name
    ? `${ct.client_name}${typeLabel ? ` · ${typeLabel}` : ""}${ct.title ? ` — ${ct.title}` : ""}`
    : ct.title || "Lịch chụp";
  return {
    summary,
    description: [
      ct.client_name ? `Khách: ${ct.client_name}` : null,
      typeLabel ? `Loại: ${typeLabel}` : null,
      // Google Lịch (web + app điện thoại) tự biến URL trong mô tả thành link bấm được.
      url ? `\nMở hợp đồng: ${url}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    sourceUrl: url,
    location: ct.location ?? undefined,
    date: ct.event_date,
    time: ct.event_time,
    duration: 180,
  };
}

/**
 * Dựng sự kiện Google Lịch từ một mốc lịch (studio_events). Mốc đi kèm hợp đồng
 * (ngày đãi, thử đồ…) mang link mở hợp đồng. Dùng chung cho lưu lẻ và backfill.
 */
export function studioEventToGCal(ev: {
  title?: string | null;
  note?: string | null;
  event_date: string;
  event_time?: string | null;
  contract_id?: string | null;
}): GCalEventInput {
  const url = contractDashboardUrl(ev.contract_id);
  return {
    summary: ev.title || "Mốc lịch",
    description: [ev.note || "", url ? `Mở hợp đồng: ${url}` : ""].filter(Boolean).join("\n\n") || undefined,
    date: ev.event_date,
    time: ev.event_time,
    duration: 60,
    sourceUrl: url,
  };
}

/**
 * Hợp đồng ở trạng thái nào thì được lên lịch Google. Luật thật nằm ở
 * lib/gcal-plan.ts (thuần logic, có kiểm thử); ở đây chỉ xuất lại cho những nơi
 * đã nhập từ file này.
 */
export { GCAL_CONTRACT_STATUSES, gcalPlan } from "@/lib/gcal-plan";

// Lần kiểm tra Google Lịch THÀNH CÔNG gần nhất của từng studio (bộ nhớ instance).
// Mỗi lần mở màn Lịch trước đây là một lượt làm mới token OAuth + events.list
// thật lên Google. Kết quả "đang chạy tốt" giữ 10 phút; lỗi thì luôn hỏi lại để
// studio sửa xong là thấy ngay. Ngắt kết nối vẫn hiện đúng vì cột token được đọc
// mỗi lần trước khi xét bộ nhớ.
const healthyAt = new Map<string, number>();
const HEALTH_TTL_MS = 10 * 60 * 1000;

export async function gcalHealth(userId: string): Promise<{ connected: boolean; ok: boolean; error: string | null }> {
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("google_refresh_token").eq("id", userId).maybeSingle();
  if (!data?.google_refresh_token) { healthyAt.delete(userId); return { connected: false, ok: false, error: null }; }
  if (Date.now() - (healthyAt.get(userId) ?? 0) < HEALTH_TTL_MS) return { connected: true, ok: true, error: null };
  try {
    const ctx = await calendarFor(userId);
    if (!ctx) return { connected: true, ok: false, error: "không dựng được client" };
    await ctx.cal.events.list({ calendarId: ctx.calendarId, maxResults: 1 });
    healthyAt.set(userId, Date.now());
    return { connected: true, ok: true, error: null };
  } catch (e) {
    return { connected: true, ok: false, error: (e as Error)?.message || String(e) };
  }
}

export interface GCalEventInput {
  summary: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) — if omitted, created as all-day */
  time?: string | null;
  /** Duration in minutes (default 60) */
  duration?: number;
  /** Link về trang gốc trong mStudo — gắn vào trường `source` của sự kiện. */
  sourceUrl?: string | null;
}

function buildEvent(input: GCalEventInput) {
  const { summary, description, location, date, time, duration = 120, sourceUrl } = input;
  // `source` là trường chính thức của Google cho "sự kiện này đến từ đâu".
  const source = sourceUrl ? { title: "Hợp đồng mStudo", url: sourceUrl } : undefined;
  if (time) {
    const [h, m] = time.split(":").map(Number);
    const start = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00`);
    const end = new Date(start.getTime() + duration * 60_000);
    return {
      summary,
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: start.toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
      end:   { dateTime: end.toISOString(),   timeZone: "Asia/Ho_Chi_Minh" },
      source,
    };
  }
  // All-day
  return {
    summary,
    description: description || undefined,
    location: location || undefined,
    start: { date },
    end:   { date },
    source,
  };
}

/**
 * Create or update a Google Calendar event.
 * Returns the gcal_event_id (use it to update/delete later).
 */
export async function upsertGCalEvent(
  userId: string,
  input: GCalEventInput,
  existingGCalId?: string | null,
): Promise<string | null> {
  const ctx = await calendarFor(userId);
  if (!ctx) return null;
  const { cal, calendarId } = ctx;
  const resource = buildEvent(input);

  if (existingGCalId) {
    try {
      const res = await cal.events.update({ calendarId, eventId: existingGCalId, requestBody: resource });
      return res.data.id ?? existingGCalId;
    } catch {
      // If the remote event was deleted, fall through to insert.
    }
  }

  const res = await cal.events.insert({ calendarId, requestBody: resource });
  return res.data.id ?? null;
}

/** Delete a Google Calendar event. Silently ignores 404. */
export async function deleteGCalEvent(userId: string, gcalEventId: string) {
  const ctx = await calendarFor(userId);
  if (!ctx) return;
  try {
    await ctx.cal.events.delete({ calendarId: ctx.calendarId, eventId: gcalEventId });
  } catch {
    // Ignore if already gone.
  }
}
