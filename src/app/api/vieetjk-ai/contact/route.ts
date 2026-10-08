import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVieetjkOwner } from "@/lib/vieetjk/data";
import { sendZalo } from "@/lib/zalo/send";
import { limitByIpDurable } from "@/lib/rate-limit";

/**
 * Form "Nhận tư vấn" trên ai.vieetjk.com (Công ty giải pháp công nghệ Vieetjk).
 * Lưu vào website_leads (source = "vieetjk-ai") của cùng chủ tài khoản đang sở
 * hữu vieetjk.com → hiện chung ở Dashboard → Yêu cầu mới, rồi báo Zalo cho chủ.
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

/** Chuỗi đã cắt khoảng trắng & giới hạn độ dài; rỗng → null. */
function text(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.trim().slice(0, max) || null : null;
}

export async function POST(req: NextRequest) {
  // Endpoint CÔNG KHAI ghi bằng service-role VÀ bắn tin Zalo cho chủ mỗi lần
  // gọi — cùng ngưỡng với chatbox vieetjk.com để không bị bơm rác / spam Zalo.
  const limited = await limitByIpDurable(req, "vieetjk-ai-contact", 5, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Ô bẫy ẩn: người thật không thấy nên luôn để trống. Bot điền vào thì giả vờ
  // thành công để nó không thử cách khác.
  if (text(body.website, 200)) return Response.json({ ok: true });

  const phone = typeof body.phone === "string" ? cleanPhone(body.phone) : null;
  if (!phone) return Response.json({ error: "no_phone" }, { status: 400 });

  const name = text(body.name, 120);
  const email = text(body.email, 160);
  const company = text(body.company, 160);
  const service = text(body.service, 120);
  const budget = text(body.budget, 60);
  const message = text(body.message, 3000);

  const { ownerId, phone: ownerPhone, name: ownerName } = await resolveVieetjkOwner();
  if (!ownerId) return Response.json({ error: "no_owner" }, { status: 500 });

  const interest = ["ai.vieetjk.com", service, budget && `Ngân sách: ${budget}`].filter(Boolean).join(" · ");
  // LeadsView hiển thị transcript như hội thoại — gói nội dung form thành một
  // "tin nhắn" của khách để chủ đọc được đủ thông tin ở cùng một chỗ.
  const detail = [
    name && `Họ tên: ${name}`,
    `SĐT: ${phone}`,
    email && `Email: ${email}`,
    company && `Công ty: ${company}`,
    service && `Dịch vụ: ${service}`,
    budget && `Ngân sách: ${budget}`,
    message && `Nội dung: ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  const db = createAdminClient();
  const { error } = await db.from("website_leads").insert({
    owner_id: ownerId,
    source: "vieetjk-ai",
    name,
    phone,
    interest,
    transcript: [{ role: "user", content: detail }],
  });
  if (error) {
    console.error("[vieetjk-ai/contact] insert error", error.message);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Báo Zalo cho chủ (best-effort — không chặn nếu lỗi/chưa kết nối Zalo).
  if (ownerPhone) {
    try {
      await sendZalo({
        ownerId,
        toPhone: ownerPhone,
        toName: ownerName,
        body: ["🔔 Yêu cầu tư vấn mới từ ai.vieetjk.com", detail.slice(0, 1200), "— Xem chi tiết trong Dashboard → Yêu cầu mới."].join("\n"),
        kind: "website_lead",
        log: false,
      });
    } catch (e) {
      console.error("[vieetjk-ai/contact] zalo notify failed", (e as Error)?.message);
    }
  }

  return Response.json({ ok: true });
}
