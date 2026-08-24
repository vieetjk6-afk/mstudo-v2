import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier } from "@/lib/plans";
import { getStudioBrand } from "@/lib/studio-brand";
import { sendEmail } from "@/lib/email";
import { sendPushToOwner } from "@/lib/push";
import { limitByIpDurable } from "@/lib/rate-limit";
import { autoCreateContractDriveOnSign } from "@/lib/studio-drive";
import { syncContractCalendar } from "@/lib/gcal-sync";
import { fetchAllPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Public client-contract endpoint (no login).
 *   POST { phone }                          -> verify + return the contract + items
 *   POST { action: "edit_request", phone, message } -> submit an amendment request
 * The client's phone (contract.client_phone) acts as the view password.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  // F5: làm chậm dò SĐT theo từng token (SĐT là "mật khẩu" entropy thấp).
  const rl = await limitByIpDurable(req, `c-portal:${params.token}`, 20, 60_000, { failClosed: true });
  if (rl) return rl;
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    message?: string;
    action?: string;
    name?: string;
    signature?: string;
    link?: string;
    rating?: number;
    brief?: { concept?: string; outfit?: string; refs?: string; note?: string };
    option_id?: string;
  };
  const db = createAdminClient();

  // Look up the contract by token ALONE — keep it independent of the owner join
  // so a missing/extra profiles column can never null out the contract lookup.
  const { data: contract } = await db
    .from("studio_contracts")
    .select(
      "id, owner_id, code, title, client_name, client_phone, client_email, client_messenger, shoot_type, event_date, event_time, location, status, note, client_signed_name, client_signature, client_signed_at, studio_signed_name, studio_signature, studio_signed_at, gallery_album_id, selection_album_id, client_viewed_at, brief_concept, brief_outfit, brief_refs, brief_note, brief_submitted_at, chosen_quote_option_id, chosen_quote_at, updated_at"
    )
    .eq("client_token", params.token)
    .maybeSingle();

  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Owner / studio info fetched separately (failure here must not break access).
  const { data: ownerObj } = await db
    .from("profiles")
    .select("full_name, email, pl_phone, pl_bank_holder, pl_bank_account, pl_bank_name, pl_bank_bin, plan, plan_expires_at, role")
    .eq("id", contract.owner_id)
    .maybeSingle();
  // Brand fetched separately (best-effort) so an un-migrated column never breaks
  // the contract portal payload.
  const brand = await getStudioBrand(db, contract.owner_id);
  const studioName = brand.name;
  const studioLogo = brand.logoUrl;
  const bank = {
    bin: ownerObj?.pl_bank_bin ?? null,
    account: ownerObj?.pl_bank_account ?? null,
    holder: ownerObj?.pl_bank_holder ?? null,
    name: ownerObj?.pl_bank_name ?? null,
  };

  // Phone gate (fail-closed): the client's phone is the view password. If the
  // studio hasn't set one, the portal stays locked — we must never serve a
  // contract's full details (client info, payments, signatures) to anyone who
  // merely holds the token.
  if (!contract.client_phone || digits(body.phone) !== digits(contract.client_phone)) {
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }

  // Gói Studio hết hạn → hợp đồng bị KHÓA: khách vẫn xem được nhưng mọi thao tác
  // ghi từ cổng khách (ký, yêu cầu sửa, gửi brief, chọn gói...) đều bị chặn.
  const planLocked =
    studioTier(effectivePlan(ownerObj?.plan, ownerObj?.plan_expires_at), ownerObj?.role === "admin") !== "full";
  const WRITE_ACTIONS = ["paid", "edit_request", "review", "brief", "choose_quote", "set_messenger", "sign"];
  if (planLocked && WRITE_ACTIONS.includes(body.action || "")) {
    return NextResponse.json(
      { error: "plan_locked", message: "Hợp đồng tạm khóa do gói dịch vụ của studio đã hết hạn. Vui lòng liên hệ studio." },
      { status: 403 }
    );
  }

  const who = contract.client_name || "Khách";
  // Captured non-null refs so the nested notify() closure keeps the narrowing.
  const cOwnerId = contract.owner_id as string;
  const cId = contract.id as string;
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  // Record an in-app notification; when `mail` is set, also email the owner.
  async function notify(kind: string, message: string, mail = false) {
    await db.from("studio_notifications").insert({ owner_id: cOwnerId, contract_id: cId, kind, message });
    await sendPushToOwner(cOwnerId, { title: "mstudo", body: message, url: `/dashboard/studio/contracts/${cId}`, tag: `contract-${cId}` });
    if (mail && ownerObj?.email) {
      const host = process.env.NEXT_PUBLIC_STUDIO_HOST;
      const link = host ? `https://${host}/dashboard/studio/contracts/${cId}` : "";
      await sendEmail({
        to: ownerObj.email,
        subject: `Studio: ${message}`,
        html: `<div style="font-family:Arial,sans-serif;color:#222"><p>${esc(message)}</p>${link ? `<p><a href="${link}">Mở hợp đồng →</a></p>` : ""}<p style="color:#888;font-size:12px">Thông báo tự động từ cổng khách.</p></div>`,
      }).catch(() => {});
    }
  }

  if (body.action === "paid") {
    await notify("payment", `${who} báo đã chuyển khoản cho HĐ “${contract.title}”`, true);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "edit_request") {
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: "empty" }, { status: 400 });
    const { error } = await db
      .from("contract_edit_requests")
      .insert({ contract_id: contract.id, message });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    await notify("edit_request", `${who} yêu cầu chỉnh sửa HĐ “${contract.title}”`, true);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "review") {
    const content = body.message?.trim();
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0)));
    if (!content && !rating) return NextResponse.json({ error: "empty" }, { status: 400 });
    const { error } = await db.from("feedback").insert({
      album_id: contract.gallery_album_id || contract.selection_album_id || null,
      client_name: contract.client_name,
      rating: rating || null,
      content: content || "",
      approved: true,
    });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    await notify("review", `${who} đã đánh giá ${rating ? `${rating}★` : ""} HĐ “${contract.title}”`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "brief") {
    const b = body.brief || {};
    const { error } = await db
      .from("studio_contracts")
      .update({
        brief_concept: b.concept?.trim() || null,
        brief_outfit: b.outfit?.trim() || null,
        brief_refs: b.refs?.trim() || null,
        brief_note: b.note?.trim() || null,
        brief_submitted_at: new Date().toISOString(),
      })
      .eq("id", contract.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    await notify("info", `${who} đã gửi brief buổi chụp “${contract.title}”`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "choose_quote") {
    if (!body.option_id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { data: opt } = await db.from("contract_quote_options").select("name, contract_id").eq("id", body.option_id).maybeSingle();
    if (!opt || opt.contract_id !== contract.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { error } = await db
      .from("studio_contracts")
      .update({ chosen_quote_option_id: body.option_id, chosen_quote_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    await notify("info", `${who} đã chọn gói “${opt.name}” cho HĐ “${contract.title}”`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_messenger") {
    const link = (body.link ?? "").trim().slice(0, 500);
    const { error } = await db.from("studio_contracts").update({ client_messenger: link || null }).eq("id", contract.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "sign") {
    // M5: không cho ký đè. Khi đã có chữ ký, hợp đồng là bất biến (chống chối bỏ).
    if (contract.client_signed_at) {
      return NextResponse.json({ error: "already_signed" }, { status: 409 });
    }
    const name = body.name?.trim();
    const signature = body.signature?.trim();
    if (!name) return NextResponse.json({ error: "no_name" }, { status: 400 });
    // Guard against oversized data URLs (~200KB cap).
    if (signature && signature.length > 200_000) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    // Chữ ký PHẢI là data-URL ảnh base64 hợp lệ — chặn nhồi HTML/JS (XSS vào bản
    // in hợp đồng mà chủ studio mở). Không hợp lệ → bỏ chữ ký (vẫn ký được).
    const validSig = !!signature && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(signature);
    const { error } = await db
      .from("studio_contracts")
      .update({
        client_signed_name: name,
        client_signature: validSig ? signature : null,
        client_signed_at: new Date().toISOString(),
        status: contract.status === "draft" || contract.status === "sent" ? "approved" : contract.status,
      })
      .eq("id", contract.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    await notify("signed", `${name} đã ký hợp đồng “${contract.title}”`, true);
    // Tự tạo thư mục Drive + album ngay khi ký (nếu studio đã kết nối Drive).
    // Thư mục trên MÁY do app desktop tạo. Lỗi Drive không được chặn việc ký.
    try {
      await autoCreateContractDriveOnSign(contract.owner_id as string, contract.id as string);
    } catch {
      /* studio chưa nối Drive / lỗi tạm — app desktop sẽ tạo bù khi chạy */
    }
    // ĐẨY LỊCH LÊN GOOGLE NGAY TẠI ĐÂY. Ký xong là hợp đồng thành "đã duyệt",
    // tức đủ điều kiện lên lịch — nhưng ở khoảnh khắc này KHÔNG ai đăng nhập
    // (khách ký ở cổng công khai), nên lối đồng bộ cũ đi từ trình duyệt chủ
    // studio không thể chạy. Đó là lý do lịch trước đây chỉ lên khi mở hợp đồng
    // sửa tay một lần nữa. Hàm này tự nuốt lỗi: Google hỏng thì việc ký vẫn xong.
    await syncContractCalendar(contract.owner_id as string, contract.id as string);
    return NextResponse.json({ ok: true });
  }

  // Record the first time the client opens their portal.
  if (!contract.client_viewed_at) {
    await db.from("studio_contracts").update({ client_viewed_at: new Date().toISOString() }).eq("id", contract.id);
  }

  const [{ data: items }, { data: payments }, { data: milestones }, { data: quoteOptions }, { data: plan }, { data: expenses }, { data: tasks }, { data: products }, { data: appointments }] = await Promise.all([
    db.from("contract_items").select("id, name, qty, unit_price, position").eq("contract_id", contract.id).order("position"),
    db.from("contract_payments").select("id, amount, kind, paid_at").eq("contract_id", contract.id).order("paid_at", { ascending: false }),
    db.from("studio_events").select("id, title, event_date, event_time, note").eq("contract_id", contract.id).order("event_date"),
    db.from("contract_quote_options").select("id, name, price, description, position").eq("contract_id", contract.id).order("position"),
    db.from("contract_payment_plan").select("id, label, amount, due_date, paid, paid_at").eq("contract_id", contract.id).order("position"),
    db.from("studio_expenses").select("id, title, amount, category, spent_at").eq("contract_id", contract.id).eq("client_visible", true).order("spent_at", { ascending: false }),
    db.from("contract_tasks").select("id, label, done, position").eq("contract_id", contract.id).order("position"),
    db.from("contract_products").select("id, name, qty, cost, status, position").eq("contract_id", contract.id).order("position"),
    // Lịch hẹn của hợp đồng (trang điểm / thử đồ / chụp / tư vấn) — CHỈ những mốc
    // studio đánh dấu cho khách xem. Cổng khách /portal dựng lịch trình từ đây;
    // studio chưa chạy migration studio_appointments thì `data` là null và cả
    // hai cổng chỉ đơn giản không có phần lịch trình, không lỗi gì.
    db.from("studio_appointments")
      .select("id, kind, title, appt_date, start_time, end_time, duration_min, location, room, crew_name, status, note")
      .eq("contract_id", contract.id)
      .eq("client_visible", true)
      .neq("status", "cancelled")
      .order("appt_date"),
  ]);

  // Linked delivery gallery (so the portal can deep-link the client's photos).
  let gallery: { slug: string; title: string } | null = null;
  if (contract.gallery_album_id) {
    const { data: g } = await db
      .from("albums")
      .select("slug, title, status, is_gallery, phase")
      .eq("id", contract.gallery_album_id)
      .maybeSingle();
    // Accept legacy galleries and unified projects in the delivery phase.
    if (g && (g.is_gallery || g.phase === "delivery") && g.status === "published") gallery = { slug: g.slug, title: g.title };
  }

  // Linked selection album (client picks their photos at /a/[slug]). For a
  // unified project the same link evolves to the delivery view, so we expose its
  // phase and let the portal adapt the card label.
  let selection: { slug: string; title: string; phase: string } | null = null;
  if (contract.selection_album_id) {
    const { data: s } = await db
      .from("albums")
      .select("slug, title, status, phase")
      .eq("id", contract.selection_album_id)
      .maybeSingle();
    if (s && s.status === "published") selection = { slug: s.slug, title: s.title, phase: s.phase ?? "selection" };
  }

  // Giai đoạn giao khách: khi đã có album hoàn thiện (giao khách), album chọn ảnh
  // không còn hiện cho khách — chỉ còn lại album giai đoạn hoàn thiện. Link file gốc
  // của giai đoạn chọn ảnh được hiện bên trong album hoàn thiện (/album/[slug]).
  if (gallery) selection = null;

  // Free wedding-invitation gift linked to this contract (if the studio made one).
  let wedding: { slug: string; edit_token: string; published: boolean } | null = null;
  {
    const { data: w } = await db
      .from("wedding_invitations")
      .select("slug, edit_token, published")
      .eq("contract_id", contract.id)
      .maybeSingle();
    if (w) wedding = { slug: w.slug, edit_token: w.edit_token, published: w.published };
  }

  // Free Love Story page linked to this contract (if the studio made one).
  let story: { slug: string; edit_token: string; published: boolean } | null = null;
  {
    const { data: s } = await db
      .from("story_pages")
      .select("slug, edit_token, published")
      .eq("contract_id", contract.id)
      .maybeSingle();
    if (s) story = { slug: s.slug, edit_token: s.edit_token, published: s.published };
  }

  /**
   * Ảnh & video của album giao khách — chỉ nạp khi hợp đồng đã **hoàn thành**.
   * Cổng khách /portal đổi sang trang album nền tối ở giai đoạn này, và trang
   * album cần chính danh sách ảnh chứ không chỉ một đường link. Trước mốc đó
   * không nạp gì: hợp đồng đang chạy thì danh sách ảnh vừa vô nghĩa vừa nặng.
   */
  let album: {
    slug: string;
    title: string;
    cover_url: string | null;
    download_enabled: boolean;
    photos: { id: string; drive_file_id: string; name: string; is_video: boolean }[];
  } | null = null;
  if (contract.status === "completed" && contract.gallery_album_id) {
    const { data: a } = await db
      .from("albums")
      .select("id, slug, title, cover_url, download_enabled, status")
      .eq("id", contract.gallery_album_id)
      .maybeSingle();
    if (a && a.status === "published") {
      const photos = (await fetchAllPhotos(db, a.id as string, "id, drive_file_id, name, is_video, position")) as {
        id: string; drive_file_id: string; name: string; is_video: boolean | null;
      }[];
      album = {
        slug: a.slug as string,
        title: a.title as string,
        cover_url: (a.cover_url as string | null) ?? null,
        download_enabled: !!a.download_enabled,
        // Giới hạn 400 ảnh: trang album vẽ lưới thumbnail, quá số này thì payload
        // phình mà mắt cũng không xem hết — khách bấm "Mở album đầy đủ" để xem trọn.
        photos: photos.slice(0, 400).map((ph) => ({
          id: ph.id,
          drive_file_id: ph.drive_file_id,
          name: ph.name,
          is_video: !!ph.is_video || /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i.test(ph.name || ""),
        })),
      };
    }
  }

  // Never expose internal crew/salary to the client (gallery/selection ids hidden).
  return NextResponse.json({
    contract: { ...contract, owner: undefined, gallery_album_id: undefined, selection_album_id: undefined },
    plan_locked: planLocked,
    studio_name: studioName,
    studio_logo: studioLogo,
    studio_phone: ownerObj?.pl_phone ?? null,
    bank,
    items: items ?? [],
    payments: payments ?? [],
    milestones: milestones ?? [],
    quote_options: quoteOptions ?? [],
    plan: plan ?? [],
    expenses: expenses ?? [],
    tasks: tasks ?? [],
    products: products ?? [],
    gallery,
    selection,
    wedding,
    story,
    appointments: appointments ?? [],
    album,
  });
}
