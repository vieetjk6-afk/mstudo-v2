import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { mainUrl } from "@/lib/hosts";
import { vnd } from "@/lib/types";
import { autoAdvanceContracts } from "@/lib/contract-status";
import { STORAGE_WARN_DAYS, daysLeft } from "@/lib/storage-lifecycle";

export const dynamic = "force-dynamic";

// Daily owner digest: shoots tomorrow, instalments due/overdue, late deliveries,
// và album sắp tới hạn dọn ảnh gốc trên Drive.
// Scheduled via vercel.json crons (07:00 VN = 00:00 UTC).
export async function GET(req: NextRequest) {
  // Fail-closed: a missing CRON_SECRET must lock the endpoint, not open it —
  // otherwise anyone could trigger the mass-email digest.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Tự chuyển HĐ (đã gửi/đã duyệt) sang "đang thực hiện" khi tới ngày sớm nhất
  // (event_date hoặc mốc studio_events như ngày đãi trước). Chạy mỗi ngày cho
  // MỌI chủ studio — kể cả khi họ không mở trang.
  let advanced = 0;
  try {
    advanced = (await autoAdvanceContracts(db)).length;
  } catch {
    /* không chặn digest nhắc việc nếu bước này lỗi */
  }

  // Work in VN time (UTC+7).
  const nowVN = new Date(Date.now() + 7 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const today = ymd(nowVN);
  const tomorrow = ymd(new Date(nowVN.getTime() + 24 * 3600 * 1000));

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Album sắp tới hạn dọn ảnh gốc trên Drive (hoặc đã quá hạn). Chỉ lấy album đã
  // giao khách và chưa nhắc trong 14 ngày qua — nhắc mỗi ngày suốt cửa sổ 30
  // ngày thì chủ studio sẽ tắt email luôn.
  const warnUntil = ymd(new Date(nowVN.getTime() + STORAGE_WARN_DAYS * 24 * 3600 * 1000));
  const noticeCutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const [shootsRes, duesRes, lateRes, doneRes, storageRes] = await Promise.all([
    db
      .from("studio_contracts")
      .select("id, owner_id, title, client_name, client_email, client_phone, event_time, location, contract_crew(name, role, phone)")
      .eq("event_date", tomorrow)
      .neq("status", "cancelled"),
    db
      .from("contract_payment_plan")
      .select("amount, label, due_date, contract:studio_contracts!inner(owner_id, title)")
      .eq("paid", false)
      .not("due_date", "is", null)
      .lte("due_date", tomorrow),
    db
      .from("studio_contracts")
      .select("owner_id, title, delivery_due")
      .not("delivery_due", "is", null)
      .lt("delivery_due", today)
      .neq("status", "completed")
      .neq("status", "cancelled"),
    db
      .from("studio_contracts")
      .select("owner_id, title, client_name, client_email, client_token")
      .eq("status", "completed")
      .gte("updated_at", since24h),
    db
      .from("albums")
      .select("id, owner_id, title, slug, storage_until")
      .not("storage_until", "is", null)
      .lte("storage_until", warnUntil)
      .or(`storage_notice_at.is.null,storage_notice_at.lt.${noticeCutoff}`),
  ]);

  type Shoot = { id: string; owner_id: string; title: string; client_name: string | null; client_email: string | null; client_phone: string | null; event_time: string | null; location: string | null; contract_crew: { name: string; role: string; phone: string | null }[] };
  type Due = { amount: number; label: string; due_date: string; contract: { owner_id: string; title: string } | null };
  type Late = { owner_id: string; title: string; delivery_due: string };
  type Done = { owner_id: string; title: string; client_name: string | null; client_email: string | null; client_token: string };
  type Storage = { id: string; owner_id: string; title: string; slug: string; storage_until: string };

  const shoots = (shootsRes.data ?? []) as unknown as Shoot[];
  const dues = (duesRes.data ?? []) as unknown as Due[];
  const late = (lateRes.data ?? []) as unknown as Late[];
  const done = (doneRes.data ?? []) as unknown as Done[];
  const storage = (storageRes.data ?? []) as unknown as Storage[];

  // Group everything by owner.
  type Bucket = { shoots: Shoot[]; dues: Due[]; late: Late[]; storage: Storage[] };
  const byOwner = new Map<string, Bucket>();
  const bucket = (id: string) => {
    let b = byOwner.get(id);
    if (!b) { b = { shoots: [], dues: [], late: [], storage: [] }; byOwner.set(id, b); }
    return b;
  };
  for (const s of shoots) bucket(s.owner_id).shoots.push(s);
  for (const d of dues) if (d.contract?.owner_id) bucket(d.contract.owner_id).dues.push(d);
  for (const l of late) bucket(l.owner_id).late.push(l);
  for (const a of storage) bucket(a.owner_id).storage.push(a);

  const allOwnerIds = [...new Set([...byOwner.keys(), ...shoots.map((s) => s.owner_id), ...done.map((d) => d.owner_id)])];
  if (allOwnerIds.length === 0) return NextResponse.json({ ok: true, sent: 0, advanced, note: "nothing to remind" });

  const { data: owners } = await db.from("profiles").select("id, email, full_name, auto_client_emails").in("id", allOwnerIds);
  type OwnerRow = { id: string; email: string | null; full_name: string | null; auto_client_emails: boolean };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id as string, o as OwnerRow]));

  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  let sent = 0;
  const results: { owner: string; ok: boolean; error?: string }[] = [];

  for (const [ownerId, b] of byOwner) {
    const owner = ownerMap.get(ownerId);
    if (!owner?.email) continue;

    const parts: string[] = [];
    if (b.shoots.length) {
      parts.push(
        `<h3 style="margin:18px 0 6px">📸 Lịch chụp ngày mai (${esc(tomorrow)})</h3><ul style="margin:0;padding-left:18px">` +
          b.shoots
            .map((s) => {
              const crew = (s.contract_crew || []).map((c) => esc(c.name)).filter(Boolean).join(", ");
              return `<li>${esc(s.title)}${s.client_name ? ` — ${esc(s.client_name)}` : ""}${s.event_time ? ` · ${esc(s.event_time)}` : ""}${s.location ? ` · ${esc(s.location)}` : ""}${crew ? `<br><span style="color:#666">Ê-kíp: ${crew}</span>` : ""}</li>`;
            })
            .join("") +
          `</ul>`
      );
    }
    if (b.dues.length) {
      parts.push(
        `<h3 style="margin:18px 0 6px">💰 Đợt thu đến hạn / quá hạn</h3><ul style="margin:0;padding-left:18px">` +
          b.dues
            .map((d) => `<li>${esc(d.contract?.title || "Hợp đồng")} · ${esc(d.label)} — <b>${vnd(d.amount)}</b> · hạn ${esc(d.due_date)}${d.due_date < today ? ' <span style="color:#c0392b">(quá hạn)</span>' : ""}</li>`)
            .join("") +
          `</ul>`
      );
    }
    if (b.late.length) {
      parts.push(
        `<h3 style="margin:18px 0 6px">⏰ Trễ hạn giao ảnh</h3><ul style="margin:0;padding-left:18px">` +
          b.late.map((l) => `<li>${esc(l.title)} · hạn ${esc(l.delivery_due)}</li>`).join("") +
          `</ul>`
      );
    }
    if (b.storage.length) {
      parts.push(
        `<h3 style="margin:18px 0 6px">💾 Ảnh gốc sắp tới hạn dọn trên Drive</h3><ul style="margin:0;padding-left:18px">` +
          b.storage
            .map((a) => {
              const n = daysLeft(a.storage_until, nowVN);
              const when = n === null ? "" : n < 0 ? ` <span style="color:#c0392b">(quá hạn ${Math.abs(n)} ngày)</span>` : ` · còn ${n} ngày`;
              return `<li>${esc(a.title)}${when}</li>`;
            })
            .join("") +
          `</ul><p style="color:#666;margin:6px 0 0;font-size:12px">mstudo KHÔNG tự xoá ảnh. Mở album để dọn thư mục gốc trên Drive, hoặc gia hạn thêm.</p>`
      );
    }
    if (!parts.length) continue;

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="margin:0 0 4px">Nhắc việc studio</h2>
<p style="color:#666;margin:0 0 8px">Chào ${esc(owner.full_name || "bạn")}, đây là tóm tắt cần xử lý hôm nay.</p>
${parts.join("")}
<p style="margin-top:22px;color:#888;font-size:12px">Email tự động từ mstudo.</p>
</div>`;

    const r = await sendEmail({ to: owner.email, subject: `Nhắc việc studio — ${tomorrow}`, html });
    if (r.ok) sent++;
    results.push({ owner: ownerId, ok: r.ok, error: r.error });

    // Đánh dấu đã nhắc để 14 ngày tới không lặp lại cùng một album. Chỉ đánh
    // dấu khi email ĐI ĐƯỢC — gửi hỏng mà vẫn đánh dấu thì chủ studio mất luôn
    // lời cảnh báo cho tới lần sau.
    if (r.ok && b.storage.length) {
      await db
        .from("albums")
        .update({ storage_notice_at: new Date().toISOString() })
        .in("id", b.storage.map((a) => a.id));
    }
  }

  // ── Opt-in client emails: shoot reminders + review requests ──────────────
  const optedIn = (id: string) => !!ownerMap.get(id)?.auto_client_emails;
  let clientSent = 0;

  for (const s of shoots) {
    if (!s.client_email || !optedIn(s.owner_id)) continue;
    const studio = ownerMap.get(s.owner_id)?.full_name || "Studio";
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
<p>Xin chào ${esc(s.client_name || "anh/chị")},</p>
<p>${esc(studio)} xin nhắc lịch chụp <b>ngày mai (${esc(tomorrow)})</b>${s.event_time ? ` lúc <b>${esc(s.event_time)}</b>` : ""}${s.location ? ` tại ${esc(s.location)}` : ""}.</p>
<p>Hẹn gặp anh/chị ạ! 📸</p>
<p style="color:#888;font-size:12px">Email tự động từ ${esc(studio)}.</p></div>`;
    const r = await sendEmail({ to: s.client_email, subject: `Nhắc lịch chụp ngày mai — ${studio}`, html });
    if (r.ok) clientSent++;
  }

  for (const c of done) {
    if (!c.client_email || !optedIn(c.owner_id)) continue;
    const studio = ownerMap.get(c.owner_id)?.full_name || "Studio";
    const link = c.client_token ? mainUrl(`/c/${c.client_token}`) : "";
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
<p>Xin chào ${esc(c.client_name || "anh/chị")},</p>
<p>Cảm ơn anh/chị đã tin tưởng ${esc(studio)}! Nếu hài lòng, anh/chị dành chút thời gian <b>đánh giá</b> giúp studio nhé.</p>
${link ? `<p><a href="${link}">Mở cổng &amp; đánh giá →</a> (mục “Đánh giá studio”)</p>` : ""}
<p style="color:#888;font-size:12px">Email tự động từ ${esc(studio)}.</p></div>`;
    const r = await sendEmail({ to: c.client_email, subject: `Cảm ơn & xin đánh giá — ${studio}`, html });
    if (r.ok) clientSent++;
  }

  // Tin Zalo tự động (nhắc lịch/thanh toán/chọn ảnh) chạy ở cron riêng
  // /api/cron/zalo lúc 11h trưa — xem src/app/api/cron/zalo/route.ts.

  return NextResponse.json({ ok: true, sent, clientSent, advanced, owners: results.length });
}
