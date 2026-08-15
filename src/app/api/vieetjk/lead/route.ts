import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVieetjkOwner } from "@/lib/vieetjk/data";
import { sendZalo } from "@/lib/zalo/send";
import { MAX_TURNS, type ChatTurn } from "@/lib/vieetjk/assistant";
import { limitByIpDurable } from "@/lib/rate-limit";

/**
 * Lưu lead từ chatbox website vieetjk.com: khách để lại SĐT (tự nhập hoặc bot
 * xin được) → lưu kèm hội thoại vào website_leads, rồi báo Zalo cho chủ studio.
 * Chạy server-side với service-role (bỏ qua RLS để insert).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SĐT Việt Nam: 0xxxxxxxxx (10 số) hoặc +84/84xxxxxxxxx. */
const PHONE_RE = /(?:\+?84|0)(?:\d[\s.-]?){8,9}\d/;

function cleanPhone(raw: string): string | null {
  const m = raw.match(PHONE_RE);
  if (!m) return null;
  let d = m[0].replace(/[^\d]/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (d.length < 9 || d.length > 11) return null;
  return d;
}

function sanitizeTranscript(turns: unknown): ChatTurn[] {
  if (!Array.isArray(turns)) return [];
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const role = t?.role;
    const content = typeof t?.content === "string" ? t.content.trim() : "";
    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  return out.slice(-MAX_TURNS);
}

export async function POST(req: NextRequest) {
  // Endpoint CÔNG KHAI ghi bằng service-role VÀ bắn một tin Zalo cho chủ studio
  // mỗi lần gọi — không giới hạn thì một script có thể vừa bơm rác vào
  // website_leads vừa spam Zalo của chủ studio. Cùng ngưỡng với các cổng công
  // khai khác (contact/feedback).
  const limited = await limitByIpDurable(req, "vieetjk-lead", 5, 60_000);
  if (limited) return limited;

  let body: {
    sessionId?: unknown;
    name?: unknown;
    phone?: unknown;
    interest?: unknown;
    transcript?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? cleanPhone(body.phone) : null;
  if (!phone) {
    return Response.json({ error: "no_phone" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) || null : null;
  const interest = typeof body.interest === "string" ? body.interest.trim().slice(0, 500) || null : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
  const transcript = sanitizeTranscript(body.transcript);

  const { ownerId, phone: ownerPhone, name: ownerName } = await resolveVieetjkOwner();
  if (!ownerId) {
    return Response.json({ error: "no_owner" }, { status: 500 });
  }

  const db = createAdminClient();
  const { error } = await db.from("website_leads").insert({
    owner_id: ownerId,
    source: "vieetjk",
    session_id: sessionId,
    name,
    phone,
    interest,
    transcript,
  });
  if (error) {
    console.error("[vieetjk/lead] insert error", error.message);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Báo Zalo cho chủ studio (best-effort — không chặn nếu lỗi/chưa kết nối Zalo).
  if (ownerPhone) {
    const lines = [
      "🔔 Lead mới từ chatbox website",
      name ? `Tên: ${name}` : null,
      `SĐT: ${phone}`,
      interest ? `Quan tâm: ${interest}` : null,
      "— Xem chi tiết trong Dashboard → Lead website.",
    ].filter(Boolean);
    try {
      await sendZalo({
        ownerId,
        toPhone: ownerPhone,
        toName: ownerName,
        body: lines.join("\n"),
        kind: "website_lead",
        log: false,
      });
    } catch (e) {
      console.error("[vieetjk/lead] zalo notify failed", (e as Error)?.message);
    }
  }

  return Response.json({ ok: true });
}
