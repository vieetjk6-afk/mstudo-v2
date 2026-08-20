import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoNotify } from "@/lib/zalo/notify";
import {
  clientShootReminderMessage,
  shootReminderMessage,
  paymentDueMessage,
  selectReadyMessage,
  selectNudgeMessage,
  quoteExpiringMessage,
} from "@/lib/zalo/messages";
import { OPEN_QUOTE_STATUSES, QUOTE_NUDGE_DAYS } from "@/lib/quote-expiry";
import { ensureIntakeToken, intakeUrl } from "@/lib/contract-intake";
import { listFolderImages } from "@/lib/drive-server";
import { studioUrl } from "@/lib/hosts";
import { getStudioHost } from "@/lib/studio-site";
import { crewPortalUrl } from "@/lib/crew-show";
import { vnd, CREW_ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cron Zalo — chạy 11h trưa VN (04:00 UTC). Gửi tin tự động theo NGÀY cho các
 * studio đã KẾT NỐI Zalo + BẬT từng mốc (autoNotify tự kiểm tra, tự bỏ qua nếu
 * tắt). Các mốc theo-thao-tác (xác nhận cọc, giao khách) gửi ngay ở chỗ khác.
 *
 * Mốc theo ngày ở đây:
 *   • shoot_reminder — nhắc lịch chụp NGÀY MAI cho khách (kèm link form) & thợ.
 *   • payment_due    — đợt thanh toán tới hạn/quá hạn → nhắc khách + link HĐ.
 *   • select_ready   — mời chọn ảnh: khi thư mục ảnh gốc đã có ảnh (Drive), hoặc
 *                      fallback 1 ngày sau ngày chụp.
 * Chống gửi trùng: kiểm tra zalo_messages đã 'sent' cùng (contract, kind) gần đây.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const nowVN = new Date(Date.now() + 7 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const today = ymd(nowVN);
  const tomorrow = ymd(new Date(nowVN.getTime() + 24 * 3600 * 1000));
  const yesterday = ymd(new Date(nowVN.getTime() - 24 * 3600 * 1000));

  // Chống gửi trùng: đã có tin 'sent' cùng (owner, contract, kind) trong N ngày?
  async function alreadySent(ownerId: string, contractId: string, kind: string, days: number): Promise<boolean> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const { data } = await db
      .from("zalo_messages")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("contract_id", contractId)
      .eq("kind", kind)
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(1);
    return !!(data && data.length);
  }

  // Tên studio để ký tin + cổng thợ riêng của studio đó. Nhớ lại theo owner để
  // một đêm chạy hàng trăm hợp đồng không truy vấn lặp.
  const ownerNames = new Map<string, string>();
  const ownerPortals = new Map<string, string>();
  async function loadOwner(ownerId: string): Promise<void> {
    if (ownerNames.has(ownerId)) return;
    const { data } = await db.from("profiles").select("full_name, crew_token").eq("id", ownerId).maybeSingle();
    ownerNames.set(ownerId, (data?.full_name as string) || "Studio");
    ownerPortals.set(ownerId, crewPortalUrl((data?.crew_token as string | null) ?? null));
  }
  async function studioName(ownerId: string): Promise<string> {
    await loadOwner(ownerId);
    return ownerNames.get(ownerId)!;
  }
  async function crewPortal(ownerId: string): Promise<string> {
    await loadOwner(ownerId);
    return ownerPortals.get(ownerId)!;
  }
  // Mọi link GỬI CHO KHÁCH (album, hợp đồng, báo giá) phải mang domain riêng
  // của studio khi studio đã bật website riêng — không phải mstudo.com. Bảng
  // điều khiển vốn đã dựng link theo domain studio, nên nếu ở đây vẫn là
  // mstudo.com thì cùng một hợp đồng gửi ra hai tên miền khác nhau.
  // Nhớ theo owner: một lượt cron quét nhiều hợp đồng của cùng studio.
  const ownerHosts = new Map<string, string | null>();
  async function clientUrl(ownerId: string, path: string): Promise<string> {
    if (!ownerHosts.has(ownerId)) ownerHosts.set(ownerId, await getStudioHost(db, ownerId));
    return studioUrl(ownerHosts.get(ownerId) ?? null, path);
  }

  let shootSent = 0;
  let dueSent = 0;
  let selectSent = 0;

  // ── 1) SHOOT REMINDER (khách + thợ) — chụp NGÀY MAI ──────────────────────
  const { data: shoots } = await db
    .from("studio_contracts")
    .select("id, owner_id, title, client_name, client_phone, event_time, location, intake_token, contract_crew(name, role, phone)")
    .eq("event_date", tomorrow)
    .neq("status", "cancelled");

  for (const s of (shoots ?? []) as any[]) {
    const studio = await studioName(s.owner_id);
    const when = `${tomorrow}${s.event_time ? ` lúc ${s.event_time}` : ""}${s.location ? ` tại ${s.location}` : ""}`;

    if (s.client_phone && !(await alreadySent(s.owner_id, s.id, "shoot_reminder", 1))) {
      const token = await ensureIntakeToken(db, s.id, s.intake_token);
      const r = await autoNotify({
        ownerId: s.owner_id,
        event: "shoot_reminder",
        audience: "client",
        toPhone: s.client_phone,
        toName: s.client_name,
        body: clientShootReminderMessage({
          name: s.client_name,
          title: s.title,
          date: tomorrow,
          time: s.event_time,
          location: s.location,
          formLink: intakeUrl(token),
          studio,
        }),
        contractId: s.id,
      });
      if (r.ok) shootSent++;
    }

    for (const c of (s.contract_crew || []) as any[]) {
      if (!c.phone) continue;
      const r = await autoNotify({
        ownerId: s.owner_id,
        event: "shoot_reminder",
        audience: "crew",
        toPhone: c.phone,
        toName: c.name,
        body: shootReminderMessage({
          name: c.name,
          title: s.title,
          date: tomorrow,
          time: s.event_time,
          location: s.location,
          role: CREW_ROLE_LABEL[c.role as keyof typeof CREW_ROLE_LABEL],
          studio,
          link: await crewPortal(s.owner_id),
        }),
        contractId: s.id,
      });
      if (r.ok) shootSent++;
    }
  }

  // ── 2) PAYMENT DUE — đợt tới hạn/quá hạn → nhắc khách + link HĐ ───────────
  const { data: dues } = await db
    .from("contract_payment_plan")
    .select("amount, due_date, contract:studio_contracts!inner(id, owner_id, title, client_name, client_phone, client_token, status)")
    .eq("paid", false)
    .not("due_date", "is", null)
    .lte("due_date", today);

  for (const d of (dues ?? []) as any[]) {
    const c = d.contract;
    if (!c || !c.client_phone) continue;
    if (c.status === "draft" || c.status === "cancelled") continue;
    if (await alreadySent(c.owner_id, c.id, "payment_due", 3)) continue;
    const studio = await studioName(c.owner_id);
    const r = await autoNotify({
      ownerId: c.owner_id,
      event: "payment_due",
      audience: "client",
      toPhone: c.client_phone,
      toName: c.client_name,
      body: paymentDueMessage({
        name: c.client_name,
        amount: vnd(Number(d.amount) || 0),
        title: c.title,
        link: c.client_token ? await clientUrl(c.owner_id, `/c/${c.client_token}`) : null,
        overdue: d.due_date < today,
        studio,
      }),
      contractId: c.id,
    });
    if (r.ok) dueSent++;
  }

  // ── 3) SELECT READY — mời chọn ảnh (Drive có ảnh, hoặc 1 ngày sau chụp) ───
  const { data: selCands } = await db
    .from("studio_contracts")
    .select("id, owner_id, title, client_name, client_phone, event_date, selection_album_id, gallery_album_id, drive_tree, select_invited_at")
    .lte("event_date", today)
    .eq("status", "in_progress")
    .not("selection_album_id", "is", null)
    .is("gallery_album_id", null);

  for (const c of (selCands ?? []) as any[]) {
    if (!c.client_phone) continue;
    if (await alreadySent(c.owner_id, c.id, "select_ready", 30)) continue;

    // Ưu tiên phát hiện Drive: thư mục ảnh gốc (role selection) đã có ảnh chưa?
    let eligible = false;
    const node = Array.isArray(c.drive_tree) ? c.drive_tree.find((n: any) => n?.role === "selection" && n?.id) : null;
    if (node?.id) {
      try {
        const files = await listFolderImages(node.id);
        if (files.length > 0) eligible = true;
      } catch {
        /* Drive lỗi/không công khai — rơi về fallback theo ngày */
      }
    }
    // Fallback theo ngày: đã qua ngày chụp ít nhất 1 ngày.
    if (!eligible && c.event_date && c.event_date <= yesterday) eligible = true;
    if (!eligible) continue;

    const { data: al } = await db.from("albums").select("slug").eq("id", c.selection_album_id).maybeSingle();
    if (!al?.slug) continue;
    const studio = await studioName(c.owner_id);
    const r = await autoNotify({
      ownerId: c.owner_id,
      event: "select_ready",
      audience: "client",
      toPhone: c.client_phone,
      toName: c.client_name,
      body: selectReadyMessage({ name: c.client_name, link: await clientUrl(c.owner_id, `/a/${al.slug}`), studio }),
      contractId: c.id,
    });
    if (r.ok) selectSent++;
    // Ghi mốc mời chọn ảnh DÙ gửi Zalo thất bại (hoặc studio chưa bật Zalo):
    // Tổng quan dựa vào mốc này để biết hợp đồng đang tắc bao lâu, và điều đó
    // đúng với mọi studio chứ không riêng studio đã kết nối Zalo.
    if (!c.select_invited_at) {
      await db.from("studio_contracts").update({ select_invited_at: new Date().toISOString() }).eq("id", c.id);
    }
  }

  // ── 4) SELECT NUDGE — khách nhận link rồi im lặng ─────────────────────────
  // Đây là chỗ tắc kinh điển: mời chọn ảnh gửi ĐÚNG MỘT LẦN, khách quên, hậu kỳ
  // đứng, tiền cuối chưa thu được. Nhắc lại tối đa 3 lần, giãn dần.
  let nudgeSent = 0;
  const NUDGE_AFTER_DAYS = [3, 8, 16]; // lần 1 sau 3 ngày, lần 2 sau 8, lần 3 sau 16
  const { data: silent } = await db
    .from("studio_contracts")
    .select("id, owner_id, title, client_name, client_phone, selection_album_id, select_invited_at, select_nudges, select_nudged_at")
    .eq("status", "in_progress")
    .not("select_invited_at", "is", null)
    .not("selection_album_id", "is", null)
    .is("gallery_album_id", null)
    .lt("select_nudges", NUDGE_AFTER_DAYS.length);

  for (const c of (silent ?? []) as any[]) {
    if (!c.client_phone) continue;
    const invitedDays = Math.floor((Date.now() - new Date(c.select_invited_at).getTime()) / (24 * 3600 * 1000));
    const round = (c.select_nudges as number) ?? 0;
    if (invitedDays < NUDGE_AFTER_DAYS[round]) continue;
    // Giãn cách tối thiểu 3 ngày giữa hai lời nhắc, kể cả khi mốc kế đã tới.
    if (c.select_nudged_at && Date.now() - new Date(c.select_nudged_at).getTime() < 3 * 24 * 3600 * 1000) continue;

    // Khách đã chọn được tấm nào chưa? Chọn rồi thì thôi, đừng nhắc nữa.
    const { count } = await db
      .from("selections")
      .select("id", { count: "exact", head: true })
      .eq("album_id", c.selection_album_id);
    if ((count ?? 0) > 0) {
      // Đánh dấu hết mức nhắc để vòng sau không quét lại hợp đồng này nữa.
      await db.from("studio_contracts").update({ select_nudges: NUDGE_AFTER_DAYS.length }).eq("id", c.id);
      continue;
    }

    const { data: al } = await db.from("albums").select("slug").eq("id", c.selection_album_id).maybeSingle();
    if (!al?.slug) continue;
    const studio = await studioName(c.owner_id);
    const r = await autoNotify({
      ownerId: c.owner_id,
      event: "select_nudge",
      audience: "client",
      toPhone: c.client_phone,
      toName: c.client_name,
      body: selectNudgeMessage({
        name: c.client_name,
        link: await clientUrl(c.owner_id, `/a/${al.slug}`),
        studio,
        round: round + 1,
        days: invitedDays,
      }),
      contractId: c.id,
    });
    // Tăng bộ đếm DÙ gửi hỏng: nếu không, một studio chưa bật Zalo sẽ bị quét
    // lại mỗi ngày mãi mãi, và bộ đếm không bao giờ tới mức dừng.
    await db
      .from("studio_contracts")
      .update({ select_nudges: round + 1, select_nudged_at: new Date().toISOString() })
      .eq("id", c.id);
    if (r.ok) nudgeSent++;
  }

  // ── 5) QUOTE EXPIRING / EXPIRED ──────────────────────────────────────────
  // Báo giá gửi đi vốn có hiệu lực vĩnh viễn (cột expires_at có sẵn nhưng chưa
  // ai ghi). Giờ: nhắc khách trước khi hết hạn, rồi tự đóng khi quá hạn.
  let quoteNudged = 0;
  let quoteClosed = 0;
  const nowIso = new Date().toISOString();
  const nudgeWindow = new Date(Date.now() + QUOTE_NUDGE_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: expiringQuotes } = await db
    .from("studio_quotes")
    .select("id, owner_id, title, client_name, client_phone, client_token, status, expires_at")
    .in("status", OPEN_QUOTE_STATUSES as unknown as string[])
    .not("expires_at", "is", null)
    .gt("expires_at", nowIso)
    .lte("expires_at", nudgeWindow);

  for (const q of (expiringQuotes ?? []) as any[]) {
    if (!q.client_phone) continue;
    // zalo_messages gắn theo contract_id, mà báo giá chưa có hợp đồng — dùng
    // chính id báo giá làm khoá chống trùng (cùng kiểu uuid, không đụng nhau).
    if (await alreadySent(q.owner_id, q.id, "quote_expiring", QUOTE_NUDGE_DAYS + 1)) continue;
    const studio = await studioName(q.owner_id);
    const r = await autoNotify({
      ownerId: q.owner_id,
      event: "quote_expiring",
      audience: "client",
      toPhone: q.client_phone,
      toName: q.client_name,
      body: quoteExpiringMessage({
        name: q.client_name,
        link: await clientUrl(q.owner_id, `/q/${q.client_token}`),
        studio,
        days: Math.max(0, Math.ceil((new Date(q.expires_at).getTime() - Date.now()) / (24 * 3600 * 1000))),
      }),
      contractId: q.id,
    });
    if (r.ok) quoteNudged++;
  }

  // Tự đóng báo giá đã quá hạn. Chỉ đụng tới trạng thái CÒN MỞ — báo giá đã
  // chốt/huỷ/đã tạo hợp đồng giữ nguyên.
  const { data: closed } = await db
    .from("studio_quotes")
    .update({ status: "expired" })
    .in("status", OPEN_QUOTE_STATUSES as unknown as string[])
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso)
    .select("id");
  quoteClosed = (closed ?? []).length;

  return NextResponse.json({ ok: true, shootSent, dueSent, selectSent, nudgeSent, quoteNudged, quoteClosed });
}
