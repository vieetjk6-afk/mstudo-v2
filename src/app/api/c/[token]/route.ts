import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, planAllowsWatermark, studioTier, type Plan } from "@/lib/plans";
import { brandFrom, type StudioBrandInfo } from "@/lib/studio-brand";
import { sendEmail } from "@/lib/email";
import { sendPushToOwner } from "@/lib/push";
import { limitByIpDurable } from "@/lib/rate-limit";
import { autoCreateContractDriveOnSign } from "@/lib/studio-drive";
import { syncContractCalendar } from "@/lib/gcal-sync";
import { fetchAllPhotos, filterDeliveryPhotos } from "@/lib/photos";
import { resolveDeliveredAlbum } from "@/lib/contract-album";
import { isMissingColumn } from "@/lib/missing-column";
import { listAddenda, signAddendum } from "@/lib/contract-addenda-server";
import { addendumLabel } from "@/lib/contract-addenda";
import { contractLoyalty } from "@/lib/voucher-program-server";
import { voucherTerms, voucherValueLabel } from "@/lib/vouchers";
import { contractTotal, sumAmounts, vnd } from "@/lib/types";
import { parseFinalVideos, safeUrl, type FinalVideo } from "@/lib/final-links";
import { getFeatureFlags, plannerComingSoon } from "@/lib/feature-flags";
import { autoLinks, normalizePlan, planProgress, plannerEnabled, seedPlanFor, shootDone, weddingGiftCombo } from "@/lib/wedding-plan";
import { todayVN } from "@/lib/date";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

type OwnerRow = {
  full_name: string | null;
  email: string | null;
  pl_phone: string | null;
  pl_bank_holder: string | null;
  pl_bank_account: string | null;
  pl_bank_name: string | null;
  pl_bank_bin: string | null;
  plan: Plan | null;
  plan_expires_at: string | null;
  role: string | null;
};

/**
 * Chủ studio + thương hiệu trong MỘT lượt đọc profiles (trước đây là hai câu
 * nối tiếp trên cùng một dòng). Vẫn giữ nguyên lời hứa cũ "cột thương hiệu
 * chưa migrate không được làm hỏng cổng khách": câu gộp lỗi thì đọc lại chỉ
 * các cột cốt lõi và coi thương hiệu như không có (giống getStudioBrand trả
 * brandFrom(null) khi lỗi). Lỗi ở đây cũng không chặn quyền xem hợp đồng.
 */
async function loadOwner(db: ReturnType<typeof createAdminClient>, ownerId: string): Promise<{ ownerObj: OwnerRow | null; brand: StudioBrandInfo }> {
  const core = "full_name, email, pl_phone, pl_bank_holder, pl_bank_account, pl_bank_name, pl_bank_bin, plan, plan_expires_at, role";
  const full = await db
    .from("profiles")
    .select(`${core}, studio_brand_name, studio_logo_url, pl_logo_url`)
    .eq("id", ownerId)
    .maybeSingle();
  if (!full.error) return { ownerObj: (full.data as OwnerRow | null) ?? null, brand: brandFrom(full.data) };
  const { data } = await db.from("profiles").select(core).eq("id", ownerId).maybeSingle();
  return { ownerObj: (data as OwnerRow | null) ?? null, brand: brandFrom(null) };
}

/**
 * Public client-contract endpoint (no login).
 *   POST { phone }                          -> verify + return the contract + items
 *   POST { action: "edit_request", phone, message } -> submit an amendment request
 * The client's phone (contract.client_phone) acts as the view password.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
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
    addendum_id?: string;
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

  // Phone gate (fail-closed): the client's phone is the view password. If the
  // studio hasn't set one, the portal stays locked — we must never serve a
  // contract's full details (client info, payments, signatures) to anyone who
  // merely holds the token.
  // Chặn NGAY sau khi có hợp đồng: cổng này chỉ cần chính hợp đồng, không cần
  // profiles — sai SĐT thì khỏi tốn thêm câu đọc nào (phản hồi y hệt trước).
  if (!contract.client_phone || digits(body.phone) !== digits(contract.client_phone)) {
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }

  const cId = contract.id as string;

  // Nhẹ: trang hợp đồng hỏi định kỳ khi khách đang chuyển khoản, để tiền về
  // (SePay tự ghi thu) là chuyển ngay sang màn "Đã nhận cọc". Trả về TRƯỚC mọi
  // câu đọc chủ studio / thương hiệu: không phải thao tác ghi nên không cần
  // biết gói có bị khóa hay không, và đây là lượt gọi lặp lại nhiều nhất.
  if (body.action === "pay_status") {
    const [{ data: pays }, { data: plan }] = await Promise.all([
      db.from("contract_payments").select("id, amount, kind, paid_at").eq("contract_id", cId),
      db.from("contract_payment_plan").select("id, label, amount, paid, paid_at").eq("contract_id", cId),
    ]);
    return NextResponse.json({ payments: pays ?? [], plan: plan ?? [] });
  }

  const WRITE_ACTIONS = ["paid", "edit_request", "review", "brief", "choose_quote", "set_messenger", "sign", "sign_addendum"];
  const isWrite = WRITE_ACTIONS.includes(body.action || "");

  // Lượt xem cổng (không phải thao tác ghi): khởi động luôn toàn bộ câu đọc dữ
  // liệu cổng SONG SONG với câu đọc chủ studio — chúng chỉ cần hợp đồng. Thao
  // tác ghi thì không nạp gì thừa.
  const viewP = isWrite ? null : loadPortalData();

  // Owner / studio info (failure here must not break access) — gộp brand vào
  // cùng một câu, xem loadOwner().
  const { ownerObj, brand } = await loadOwner(db, contract.owner_id as string);
  const studioName = brand.name;
  const studioLogo = brand.logoUrl;
  const bank = {
    bin: ownerObj?.pl_bank_bin ?? null,
    account: ownerObj?.pl_bank_account ?? null,
    holder: ownerObj?.pl_bank_holder ?? null,
    name: ownerObj?.pl_bank_name ?? null,
  };

  // Gói Studio hết hạn → hợp đồng bị KHÓA: khách vẫn xem được nhưng mọi thao tác
  // ghi từ cổng khách (ký, yêu cầu sửa, gửi brief, chọn gói...) đều bị chặn.
  const planLocked =
    studioTier(effectivePlan(ownerObj?.plan, ownerObj?.plan_expires_at), ownerObj?.role === "admin") !== "full";
  if (planLocked && isWrite) {
    return NextResponse.json(
      { error: "plan_locked", message: "Hợp đồng tạm khóa do gói dịch vụ của studio đã hết hạn. Vui lòng liên hệ studio." },
      { status: 403 }
    );
  }

  const who = contract.client_name || "Khách";
  // Captured non-null refs so the nested notify() closure keeps the narrowing.
  const cOwnerId = contract.owner_id as string;
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

  if (body.action === "sign_addendum") {
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "no_name" }, { status: 400 });
    const signature = body.signature?.trim();
    if (signature && signature.length > 200_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const validSig = !!signature && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(signature);
    // Phụ lục phải thuộc ĐÚNG hợp đồng của token này — không ký hộ hợp đồng khác.
    const target = (await listAddenda(db, cId)).find((a) => a.id === body.addendum_id);
    if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const r = await signAddendum(db, target.id, { by: "client", name, signature: validSig ? signature : null });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "already_signed" ? 409 : 500 });
    await db.from("studio_audit_log").insert({
      owner_id: cOwnerId, actor_id: null, action: "addendum.sign", entity: "contract", entity_id: cId, contract_id: cId,
      summary: `Khách ${name} ký ${addendumLabel(target)}`, after: { lines: target.lines },
    }).then(undefined, () => undefined);
    await notify("signed", `${name} đã ký ${addendumLabel(target)} của HĐ “${contract.title}”`, true);
    return NextResponse.json({ ok: true });
  }

  /**
   * Mọi câu đọc của lượt xem cổng chỉ phụ thuộc vào CHÍNH hợp đồng — gom vào
   * một Promise.all (trước đây ~10 câu nối tiếp: albums gắn kèm, thiệp cưới,
   * love story, cờ tính năng, link hoàn thiện, phụ lục, voucher...). Được gọi
   * sớm, chạy song song với câu đọc chủ studio ở trên.
   */
  function loadPortalData() {
    type LinkedRow = { id: string; slug: string; title: string; status: string | null; phase: string | null; is_gallery: boolean | null };
    const linkedIds = [contract!.gallery_album_id, contract!.selection_album_id].filter(Boolean) as string[];
    return Promise.all([
      db.from("contract_items").select("*").eq("contract_id", cId).order("position"),
      db.from("contract_payments").select("id, amount, kind, paid_at").eq("contract_id", cId).order("paid_at", { ascending: false }),
      db.from("studio_events").select("id, title, event_date, event_time, note").eq("contract_id", cId).order("event_date"),
      db.from("contract_quote_options").select("id, name, price, description, position").eq("contract_id", cId).order("position"),
      // pay_code (mã đợt để SePay tự ghi thu) chỉ có sau migrations/bank_auto_reconcile.sql;
      // chưa chạy thì lùi về bản cũ, không để cổng khách hỏng.
      (async () => {
        const q = (cols: string) => db.from("contract_payment_plan").select(cols).eq("contract_id", cId).order("position");
        const base = "id, label, amount, due_date, paid, paid_at";
        const full = await q(`${base}, pay_code`);
        return full.error && isMissingColumn(full.error, "pay_code") ? q(base) : full;
      })(),
      db.from("studio_expenses").select("id, title, amount, category, spent_at").eq("contract_id", cId).eq("client_visible", true).order("spent_at", { ascending: false }),
      db.from("contract_tasks").select("id, label, done, position").eq("contract_id", cId).order("position"),
      db.from("contract_products").select("id, name, qty, cost, status, position").eq("contract_id", cId).order("position"),
      // Lịch hẹn của hợp đồng (trang điểm / thử đồ / chụp / tư vấn) — CHỈ những mốc
      // studio đánh dấu cho khách xem. Cổng khách /portal dựng lịch trình từ đây;
      // studio chưa chạy migration studio_appointments thì `data` là null và cả
      // hai cổng chỉ đơn giản không có phần lịch trình, không lỗi gì.
      db.from("studio_appointments")
        .select("id, kind, title, appt_date, start_time, end_time, duration_min, location, room, crew_name, status, note")
        .eq("contract_id", cId)
        .eq("client_visible", true)
        .neq("status", "cancelled")
        .order("appt_date"),
      // Album gắn kèm (album giao khách / chọn ảnh) — xem luật ở dưới.
      linkedIds.length
        ? db.from("albums").select("id, slug, title, status, is_gallery, phase").in("id", linkedIds).then((r) => (r.data ?? []) as LinkedRow[])
        : Promise.resolve([] as LinkedRow[]),
      // Free wedding-invitation gift linked to this contract (if the studio made one).
      db.from("wedding_invitations").select("slug, edit_token, published").eq("contract_id", cId).maybeSingle(),
      // Free Love Story page linked to this contract (if the studio made one).
      db.from("story_pages").select("slug, edit_token, published").eq("contract_id", cId).maybeSingle(),
      getFeatureFlags(),
      // Link album / video hoàn thiện studio dán tay trên hợp đồng — đọc gộp cả
      // cột file gốc trong MỘT câu (trước đây hai câu trên cùng một dòng). Câu gộp
      // lỗi (studio chưa chạy migrations/contract_final_links.sql hoặc
      // contract_final_originals.sql) thì lùi về đúng hai câu riêng như cũ: mới
      // chạy migration đầu thì album / video vẫn hiện, chỉ thiếu ô file gốc.
      (async () => {
        const all = await db.from("studio_contracts").select("final_album_url, final_video_urls, final_originals_url").eq("id", cId).maybeSingle();
        if (!all.error) return { fl: all.data, fo: all.data };
        const [{ data: fl }, { data: fo }] = await Promise.all([
          db.from("studio_contracts").select("final_album_url, final_video_urls").eq("id", cId).maybeSingle(),
          db.from("studio_contracts").select("final_originals_url").eq("id", cId).maybeSingle(),
        ]);
        return { fl, fo };
      })(),
      listAddenda(db, cId),
      contractLoyalty(db, cId).catch(() => null),
      // Record the first time the client opens their portal. Chạy song song với
      // các câu đọc (không câu nào phụ thuộc vào nó) thay vì chặn trước cả loạt.
      contract!.client_viewed_at
        ? Promise.resolve(null)
        : db.from("studio_contracts").update({ client_viewed_at: new Date().toISOString() }).eq("id", cId).then(() => null),
    ]);
  }

  const [
    { data: items }, { data: payments }, { data: milestones }, { data: quoteOptions }, { data: plan }, { data: expenses }, { data: tasks }, { data: products }, { data: appointments },
    linkedRows, { data: w }, { data: s }, flags, { fl, fo }, addenda, loyaltyRaw,
  ] = await (viewP ?? loadPortalData());

  // Album giao khách đã gắn (để cổng khách dẫn thẳng tới ảnh). Chỉ tính là ĐÃ
  // GIAO khi album còn ở giai đoạn giao khách và đã xuất bản: studio đưa album
  // về "Chọn ảnh" thì cổng khách phải quay lại thẻ chọn ảnh. Album nào là album
  // giao khách — luật chung ở @/lib/contract-album (album giao riêng thắng, không
  // thì chính album của hợp đồng khi nó đã sang giai đoạn giao khách).
  const linkedById = new Map(linkedRows.map((r) => [r.id, r]));
  const gRow = contract.gallery_album_id ? linkedById.get(contract.gallery_album_id) ?? null : null;
  const sRow = contract.selection_album_id ? linkedById.get(contract.selection_album_id) ?? null : null;
  const delivered = resolveDeliveredAlbum({ gallery: gRow, selection: sRow });
  const deliveredAlbumId: string | null = delivered?.album.id ?? null;

  let gallery: { slug: string; title: string } | null = null;
  if (delivered?.via === "gallery") gallery = { slug: delivered.album.slug, title: delivered.album.title };

  // Linked selection album (client picks their photos at /a/[slug]). For a
  // unified project the same link evolves to the delivery view, so we expose its
  // phase and let the portal adapt the card label.
  let selection: { slug: string; title: string; phase: string } | null = null;
  if (sRow && sRow.status === "published") {
    selection = { slug: sRow.slug, title: sRow.title, phase: sRow.phase ?? "selection" };
  }

  // Giai đoạn giao khách: khi đã có album hoàn thiện (giao khách), album chọn ảnh
  // không còn hiện cho khách — chỉ còn lại album giai đoạn hoàn thiện. Link file gốc
  // của giai đoạn chọn ảnh được hiện bên trong album hoàn thiện (/album/[slug]).
  if (gallery) selection = null;

  const wedding: { slug: string; edit_token: string; published: boolean } | null = w
    ? { slug: w.slug, edit_token: w.edit_token, published: w.published }
    : null;
  const story: { slug: string; edit_token: string; published: boolean } | null = s
    ? { slug: s.slug, edit_token: s.edit_token, published: s.published }
    : null;

  // Kế hoạch cưới (/portal/<token>/ke-hoach) và ảnh của album giao khách độc lập
  // nhau → hai khối chạy song song (mỗi khối vẫn có chuỗi phụ thuộc riêng).
  //
  // Kế hoạch cưới — chỉ phần tóm tắt cho thẻ ở cổng khách. Mọi bước đều
  // best-effort: chưa chạy migrations/ke_hoach_cuoi.sql thì `planner` = null và
  // cổng khách chỉ đơn giản không có thẻ này.
  const loadPlanner = async (): Promise<{ wedding_date: string | null; done: number; total: number; combo: boolean } | null> => {
    if (plannerComingSoon(flags) && ownerObj?.role !== "admin") return null;
    const cq = (cols: string) => db.from("studio_contracts").select(cols).eq("id", cId).maybeSingle();
    const [{ data: pRow, error: pErr }, extraFull] = await Promise.all([
      db.from("wedding_plans").select("wedding_date, tasks").eq("contract_id", cId).maybeSingle(),
      cq("wedding_planner, service_id, intake"),
    ]);
    const extra = (extraFull.error && isMissingColumn(extraFull.error, "wedding_planner") ? (await cq("service_id, intake")).data : extraFull.data) as
      { wedding_planner?: boolean | null; service_id?: string | null; intake?: { type?: string } | null } | null;
    if (pErr) return null;
    const { data: svc } = extra?.service_id
      ? await db.from("studio_services").select("name").eq("id", extra.service_id).maybeSingle()
      : { data: null };
    const pkg = {
      shootType: contract.shoot_type as string | null,
      intakeType: extra?.intake?.type ?? null,
      title: contract.title as string | null,
      serviceName: (svc as { name?: string } | null)?.name ?? null,
      itemNames: ((items ?? []) as { name: string | null }[]).map((i) => i.name),
    };
    if (!plannerEnabled({ ...pkg, toggle: extra?.wedding_planner ?? null, hasPlan: !!pRow })) return null;
    const p = pRow ? normalizePlan(pRow) : seedPlanFor((contract.event_date as string | null) ?? null, pkg);
    // "Khách đã chọn xong ảnh" — đọc riêng: cột có từ album_selection_done.sql.
    const { data: sDone } = sRow && !delivered
      ? await db.from("albums").select("selection_done_at").eq("id", sRow.id).maybeSingle()
      : { data: null };
    const auto = autoLinks({
      studioName,
      signed: !!contract.client_signed_at,
      shot: shootDone((appointments ?? []) as { kind: string; status: string; appt_date: string }[], (contract.event_date as string | null) ?? null, todayVN()),
      invitation: wedding ? { published: wedding.published, href: "" } : null,
      album: delivered ? { picked: true, href: "" } : selection ? { picked: !!(sDone as { selection_done_at?: string | null } | null)?.selection_done_at, href: "" } : null,
      total: contractTotal((items ?? []) as { qty: number; unit_price: number }[]),
      paid: sumAmounts((payments ?? []) as { amount: number }[]),
    });
    return { wedding_date: p.wedding_date, ...planProgress(p.tasks, auto), combo: weddingGiftCombo(ownerObj?.role) };
  };

  /**
   * Ảnh & video của album giao khách — chỉ nạp khi hợp đồng đã **hoàn thành**.
   * Cổng khách /portal đổi sang trang album nền tối ở giai đoạn này, và trang
   * album cần chính danh sách ảnh chứ không chỉ một đường link. Trước mốc đó
   * không nạp gì: hợp đồng đang chạy thì danh sách ảnh vừa vô nghĩa vừa nặng.
   */
  type PortalAlbum = {
    slug: string;
    title: string;
    cover_url: string | null;
    download_enabled: boolean;
    watermark: string | null;
    photos: { id: string; drive_file_id: string; name: string; is_video: boolean }[];
  };
  const loadAlbum = async (): Promise<PortalAlbum | null> => {
    if (contract.status !== "completed" || !deliveredAlbumId) return null;
    const { data: a } = await db
      .from("albums")
      .select("id, slug, title, cover_url, download_enabled, watermark_delivery, watermark_text, status")
      .eq("id", deliveredAlbumId)
      .maybeSingle();
    if (!a || a.status !== "published") return null;
    const [allPhotos, { data: srcs }] = await Promise.all([
      fetchAllPhotos(db, a.id as string, "id, drive_file_id, name, is_video, position, source_id"),
      db.from("album_sources").select("id, stage").eq("album_id", a.id as string),
    ]);
    // Cùng luật với /album/[slug]: album có nguồn giai đoạn "delivery" thì chỉ
    // lấy ảnh giao khách. Thiếu bước này, album của hợp đồng vừa chuyển sang
    // giao khách sẽ đổ cả ảnh gốc (JPG Goc) lẫn ảnh chỉnh sửa lên cổng khách.
    const photos = filterDeliveryPhotos(
      allPhotos as { id: string; drive_file_id: string; name: string; is_video: boolean | null; source_id: string | null }[],
      (srcs ?? []) as { id: string; stage: string | null }[],
    );
    return {
      slug: a.slug as string,
      title: a.title as string,
      cover_url: (a.cover_url as string | null) ?? null,
      download_enabled: !!a.download_enabled,
      // Cùng luật với trang /album/[slug]: watermark chỉ còn hiệu lực khi gói
      // của studio còn cho phép — nút tải từng ảnh ở cổng khách đóng dấu y hệt.
      watermark:
        a.watermark_delivery && planAllowsWatermark(effectivePlan(ownerObj?.plan, ownerObj?.plan_expires_at), ownerObj?.role === "admin")
          ? ((a.watermark_text as string | null) || studioName)
          : null,
      // Giới hạn 400 ảnh: trang album vẽ lưới thumbnail, quá số này thì payload
      // phình mà mắt cũng không xem hết — khách bấm "Mở album đầy đủ" để xem trọn.
      photos: photos.slice(0, 400).map((ph) => ({
        id: ph.id,
        drive_file_id: ph.drive_file_id,
        name: ph.name,
        is_video: !!ph.is_video || /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i.test(ph.name || ""),
      })),
    };
  };

  const [planner, album] = await Promise.all([loadPlanner(), loadAlbum()]);

  let finalLinks: { album_url: string | null; videos: FinalVideo[]; originals_url: string | null } | null = null;
  {
    const albumUrl = safeUrl((fl?.final_album_url as string | null) ?? null);
    const videos = parseFinalVideos((fl?.final_video_urls as string | null) ?? null);
    const originalsUrl = safeUrl((fo?.final_originals_url as string | null) ?? null);
    if (albumUrl || videos.length || originalsUrl) finalLinks = { album_url: albumUrl, videos, originals_url: originalsUrl };
  }

  // Voucher ưu đãi của chương trình: trước khi ký là lời mời chốt ("ký & cọc
  // để nhận voucher X%"), đủ điều kiện thì phát luôn tại đây. Chỉ gửi đúng
  // phần khách cần.
  const loyalty = (() => {
    const l = loyaltyRaw;
    if (!l || l.stage === "off") return null;
    const shape = { kind: "loyalty" as const, discount_type: "percent" as const, percent: l.percent, amount: 0, max_discount: l.max, applies_packages: l.packages };
    return {
      stage: l.stage,
      percent: l.percent,
      value: voucherValueLabel(l.voucher ?? shape),
      // Chưa phát: gợi ý mốc cao hơn kế tiếp để khách cân nhắc thêm gói.
      hint: !l.voucher && l.next ? `Hợp đồng từ ${vnd(l.next.min)} được tặng voucher ${l.next.percent}%${(l.next.max ?? l.progMax) ? ` (tối đa ${vnd((l.next.max ?? l.progMax) as number)})` : ""}.` : null,
      title: l.title,
      missing: l.missing,
      terms: voucherTerms(l.voucher ? { ...l.voucher, kind: "loyalty" } : shape),
      voucher: l.voucher && l.voucher.status !== "void"
        ? { code: l.voucher.code, expires_on: l.voucher.expires_on, public_token: l.voucher.public_token, status: l.voucher.status, title: l.voucher.title }
        : null,
    };
  })();

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
    final_links: finalLinks,
    planner,
    addenda,
    loyalty,
  });
}
