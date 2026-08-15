import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { convertQuoteToContract } from "@/lib/quote-convert";
import { effectivePlan, studioTier } from "@/lib/plans";
import { sendEmail } from "@/lib/email";
import { sendPushToOwner } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { isQuoteExpired } from "@/lib/quote-expiry";

export const dynamic = "force-dynamic";

/**
 * Public quote actions for a client viewing /q/[token].
 * No auth — the token is the access credential. Service role bypasses RLS, but
 * every write is scoped to the quote that matches the token.
 *
 * Actions:
 *  - toggle  : flip selected on an optional item
 *  - adjust  : append a client adjustment message + bump status
 *  - accept  : client fills name / phone / email / facebook, optionally ticks
 *              "auto-create contract", which (only if the studio is on the
 *              'full' tier) immediately spawns the contract.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  // M6: chặn spam thao tác/tạo hợp đồng rác theo từng token báo giá.
  if (!rateLimit(`quote:${params.token}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  if (!action) return NextResponse.json({ error: "missing action" }, { status: 400 });

  const db = createAdminClient();
  const { data: quote } = await db
    .from("studio_quotes")
    .select("id, status, owner_id, title, expires_at")
    .eq("client_token", params.token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Báo giá không tồn tại." }, { status: 404 });

  if (quote.status === "accepted" || quote.status === "converted") {
    return NextResponse.json({ error: "Báo giá đã chốt, không thể thay đổi." }, { status: 409 });
  }
  if (quote.status === "cancelled" || quote.status === "expired") {
    return NextResponse.json({ error: "Báo giá đã đóng." }, { status: 409 });
  }
  // Chốt hạn ngay tại đây chứ không chỉ dựa vào status: cron đóng báo giá quá
  // hạn chỉ chạy MỘT LẦN mỗi ngày, nên một báo giá hết hạn lúc 23:59 vẫn còn
  // status 'sent' suốt sáng hôm sau. Chỉ chặn hành động GHI của khách; studio
  // vẫn gia hạn được từ trang quản lý.
  if (isQuoteExpired(quote.expires_at)) {
    return NextResponse.json(
      { error: "Báo giá đã hết hiệu lực. Liên hệ studio để được báo giá lại." },
      { status: 409 },
    );
  }

  if (action === "toggle") {
    const itemId = body.item_id as string | undefined;
    const selected = !!body.selected;
    if (!itemId) return NextResponse.json({ error: "missing item_id" }, { status: 400 });
    const { data: item } = await db
      .from("quote_items")
      .select("id, is_optional, package_group")
      .eq("id", itemId)
      .eq("quote_id", quote.id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });
    if (!item.is_optional && !item.package_group) return NextResponse.json({ error: "Hạng mục bắt buộc." }, { status: 400 });
    // Package group: packages are mutually exclusive — selecting one deselects
    // every other package, so the client can only ever have a single package on.
    if (item.package_group) {
      if (selected) {
        await db.from("quote_items").update({ selected: false }).eq("quote_id", quote.id).not("package_group", "is", null);
        await db.from("quote_items").update({ selected: true }).eq("quote_id", quote.id).eq("package_group", item.package_group);
      } else {
        await db.from("quote_items").update({ selected: false }).eq("quote_id", quote.id).eq("package_group", item.package_group);
      }
    } else {
      await db.from("quote_items").update({ selected }).eq("id", itemId);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "adjust") {
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "Tin nhắn trống." }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: "Tin nhắn quá dài (tối đa 2000 ký tự)." }, { status: 400 });
    const { data: row, error } = await db
      .from("quote_adjustments")
      .insert({ quote_id: quote.id, author: "client", message })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await db.from("studio_quotes").update({ status: "adjust_requested" }).eq("id", quote.id);
    return NextResponse.json({ ok: true, adjustment: row });
  }

  if (action === "accept") {
    const clientName = String(body.client_name || "").trim();
    const clientPhone = String(body.client_phone || "").trim();
    const clientEmail = String(body.client_email || "").trim();
    const clientFacebook = String(body.client_facebook || "").trim();
    const autoCreate = !!body.auto_create_contract;

    if (!clientName) return NextResponse.json({ error: "Vui lòng nhập họ tên." }, { status: 400 });
    if (!/^[0-9]{9,11}$/.test(clientPhone.replace(/\s+/g, ""))) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ (9–11 chữ số)." }, { status: 400 });
    }

    // 1) Lock the client info + mark accepted.
    await db
      .from("studio_quotes")
      .update({
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || null,
        client_facebook: clientFacebook || null,
        auto_create_contract: autoCreate,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    // 2) Fetch owner info once — used for both notification and tier check.
    const { data: owner } = await db
      .from("profiles")
      .select("plan, plan_expires_at, role, email")
      .eq("id", quote.owner_id)
      .maybeSingle();

    // 3) Notify the studio owner: in-app + push + email.
    const quoteTitle = (quote as { title?: string }).title || "Báo giá";
    const msg = `${clientName} đã chấp nhận báo giá "${quoteTitle}"`;
    await db.from("studio_notifications").insert({
      owner_id: quote.owner_id,
      contract_id: null,
      kind: "quote_accepted",
      message: msg,
    });
    await sendPushToOwner(quote.owner_id, {
      title: "Khách chấp nhận báo giá",
      body: msg,
      url: `/dashboard/studio/quotes`,
      tag: `quote-accepted-${quote.id}`,
    }).catch(() => {});
    if (owner?.email) {
      const host = process.env.NEXT_PUBLIC_STUDIO_HOST;
      const link = host ? `https://${host}/dashboard/studio/quotes` : "";
      // Escape nội dung khách nhập (clientName/quoteTitle) trước khi nhồi vào HTML email.
      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      await sendEmail({
        to: owner.email,
        subject: `Studio: ${msg}`,
        html: `<div style="font-family:Arial,sans-serif;color:#222"><p>${escHtml(msg)}</p>${link ? `<p><a href="${link}">Xem báo giá →</a></p>` : ""}<p style="color:#888;font-size:12px">Thông báo tự động từ cổng khách.</p></div>`,
      }).catch(() => {});
    }

    // 4) If the client ticked auto-create AND the studio is on the full tier,
    //    spawn the contract right away. Photographers (booking tier) only get
    //    the quote acceptance — they don't have the contract feature.
    if (autoCreate) {
      const tier = owner
        ? studioTier(effectivePlan(owner.plan, owner.plan_expires_at), owner.role === "admin")
        : "none";
      if (tier === "full") {
        const result = await convertQuoteToContract(db, quote.id);
        if (result.ok) {
          return NextResponse.json({
            ok: true,
            contract_id: result.contract_id,
            contract_token: result.contract_token,
            auto_created: true,
          });
        }
        // Conversion failed — still report accept success so the client UI doesn't break.
        return NextResponse.json({ ok: true, auto_created: false, convert_error: result.error });
      }
    }

    return NextResponse.json({ ok: true, auto_created: false });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
