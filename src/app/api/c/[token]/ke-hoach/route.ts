import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier } from "@/lib/plans";
import { getStudioBrand } from "@/lib/studio-brand";
import { getFeatureFlags, plannerComingSoon } from "@/lib/feature-flags";
import { limitByIpDurable } from "@/lib/rate-limit";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { resolveDeliveredAlbum } from "@/lib/contract-album";
import { apptTitle } from "@/lib/appointments";
import { todayVN } from "@/lib/date";
import { thiepUrl } from "@/lib/hosts";
import { createInvitationForContract } from "@/lib/wedding-invite-auto";
import { PLAN_BASE_COLS as BASE_COLS, readPlan, syncPlanReplies, type PlanRow } from "@/lib/wedding-plan-db";
import { contractTotal, sumAmounts, type AppointmentKind, type WeddingConfig } from "@/lib/types";
import {
  applyPlanOp, autoLinks, normalizePlan, opNeedsExtra, planToRow, plannerEnabled, seedPlanFor, shootDone, shootsWeddingDay,
  weddingGiftCombo, type DayRow, type StudioAppt,
} from "@/lib/wedding-plan";
import type { PlannerInvite, PlannerOpResponse, PlannerPayload } from "@/app/portal/[token]/ke-hoach/types";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * KẾ HOẠCH CƯỚI của khách — /portal/<client_token>/ke-hoach (không đăng nhập).
 *   POST { phone }      → kế hoạch + những gì đọc từ hợp đồng (tạo kế hoạch lần đầu)
 *   POST { phone, op }  → áp một thao tác (xem PlanOp ở @/lib/wedding-plan)
 *
 * Cùng cổng SĐT với /api/c/[token] (fail-closed, kiểm ở MỌI lần gọi), cùng luật
 * khoá ghi khi gói của studio hết hạn.
 *
 * Chế độ Quà cưới (`weddingGiftCombo`, đang chạy thử với tài khoản admin): lần
 * mở đầu tiên tạo luôn thiệp cưới online cho hợp đồng, và mỗi lần mở thì ghi
 * phản hồi mới qua thiệp vào danh sách khách.
 */
const INV_COLS = "id, slug, edit_token, published, config";
type InvRow = { id: string; slug: string; edit_token: string; published: boolean; config: WeddingConfig | null };

export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Trang này ghi theo từng cú bấm (tick một việc, sửa một khoản tiền) nên trần
  // rộng hơn cổng khách chính. Lượt dò SĐT SAI thì tính chung vào trần 20/phút
  // của cổng chính ở dưới — mở thêm route này không được nới cửa dò số.
  const rl = await limitByIpDurable(req, `c-plan:${params.token}`, 120, 60_000, { failClosed: true });
  if (rl) return rl;
  const body = (await req.json().catch(() => ({}))) as { phone?: string; op?: unknown };
  const db = createAdminClient();

  const { data: contract } = await db
    .from("studio_contracts")
    .select("id, owner_id, title, client_name, client_phone, shoot_type, service_id, event_date, event_time, location, status, client_signed_at, gallery_album_id, selection_album_id, intake")
    .eq("client_token", params.token)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!contract.client_phone || digits(body.phone) !== digits(contract.client_phone)) {
    const slow = await limitByIpDurable(req, `c-portal:${params.token}`, 20, 60_000, { failClosed: true });
    if (slow) return slow;
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }

  const cId = contract.id as string;
  const [{ data: ownerObj }, brand, { data: items }, { data: service }, { data: toggleRow }, flags] = await Promise.all([
    db.from("profiles").select("pl_phone, plan, plan_expires_at, role").eq("id", contract.owner_id).maybeSingle(),
    getStudioBrand(db, contract.owner_id as string),
    db.from("contract_items").select("name, qty, unit_price").eq("contract_id", cId),
    contract.service_id
      ? db.from("studio_services").select("name").eq("id", contract.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Cột bật/tắt đọc riêng: chưa chạy migration thì lỗi ở đây chỉ làm mọi hợp
    // đồng thành "theo gói", không làm hỏng lượt đọc hợp đồng ở trên.
    db.from("studio_contracts").select("wedding_planner").eq("id", cId).maybeSingle(),
    getFeatureFlags(),
  ]);
  // "Sắp ra mắt": khách chưa được thấy trang này — trừ hợp đồng của tài khoản
  // admin, đường để admin thử trọn vòng trước khi mở (xem plannerComingSoon).
  if (plannerComingSoon(flags) && ownerObj?.role !== "admin") {
    return NextResponse.json({ error: "coming_soon" }, { status: 403 });
  }
  const planLocked =
    studioTier(effectivePlan(ownerObj?.plan, ownerObj?.plan_expires_at), ownerObj?.role === "admin") !== "full";
  const combo = weddingGiftCombo(ownerObj?.role);

  const read = await readPlan(db, cId, null);
  if (read.error) {
    // Studio chưa chạy migrations/ke_hoach_cuoi.sql — nói thẳng là chưa sẵn sàng
    // thay vì để khách sửa một kế hoạch không có chỗ lưu.
    const missing = phanLoaiLoi(read.error) === "thieu-bang";
    return NextResponse.json({ error: missing ? "not_ready" : "server_error" }, { status: missing ? 503 : 500 });
  }
  const ext = read.ext;
  const cols = ext ? `${BASE_COLS}, extra` : BASE_COLS;
  let row = read.row;

  const pkg = {
    shootType: contract.shoot_type as string | null,
    intakeType: (contract.intake as { type?: string } | null)?.type ?? null,
    title: contract.title as string | null,
    serviceName: (service as { name?: string } | null)?.name ?? null,
    itemNames: ((items ?? []) as { name: string | null }[]).map((i) => i.name),
  };
  const enabled = plannerEnabled({
    ...pkg,
    toggle: (toggleRow as { wedding_planner?: boolean | null } | null)?.wedding_planner ?? null,
    hasPlan: !!row,
  });
  if (!enabled) return NextResponse.json({ error: "disabled" }, { status: 403 });
  const seed = () => seedPlanFor((contract.event_date as string | null) ?? null, pkg);

  /* ── Ghi một thao tác ─────────────────────────────────────────────────── */
  if (body.op !== undefined) {
    if (planLocked) return NextResponse.json({ error: "plan_locked" }, { status: 403 });
    if (!ext && opNeedsExtra(body.op)) {
      const res: PlannerOpResponse = { plan: row ? normalizePlan(row) : seed(), updated_at: row?.updated_at ?? null, error: "need_update" };
      return NextResponse.json(res, { status: 400 });
    }
    // Ghi kèm điều kiện `rev` đúng bản vừa đọc. Cô dâu và chú rể cùng sửa trên
    // hai máy thì lượt ghi chậm hơn trượt, đọc lại bản mới rồi áp lại thao tác
    // của mình lên đó — không ai ghi đè mất việc của người kia.
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = row ? normalizePlan(row) : seed();
      const r = applyPlanOp(current, body.op);
      if (!r.ok) {
        const res: PlannerOpResponse = { plan: current, updated_at: row?.updated_at ?? null, error: r.error };
        return NextResponse.json(res, { status: r.error === "gone" ? 409 : 400 });
      }
      if (!row) {
        const { data: made, error } = await db
          .from("wedding_plans")
          .insert({ contract_id: cId, owner_id: contract.owner_id, ...planToRow(r.plan, ext), rev: 1 })
          .select(cols)
          .single();
        const m = made as PlanRow | null;
        if (!error && m) return NextResponse.json({ plan: normalizePlan(m), updated_at: m.updated_at } satisfies PlannerOpResponse);
        if (error?.code !== "23505") return NextResponse.json({ error: "server_error" }, { status: 500 });
      } else {
        const { data: saved, error } = await db
          .from("wedding_plans")
          .update({ ...planToRow(r.plan, ext), rev: row.rev + 1 })
          .eq("id", row.id)
          .eq("rev", row.rev)
          .select(cols);
        if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
        // `cols` là chuỗi ghép lúc chạy nên bộ suy kiểu của supabase-js không đọc được.
        const s = ((saved ?? []) as unknown as PlanRow[])[0];
        if (s) return NextResponse.json({ plan: normalizePlan(s), updated_at: s.updated_at } satisfies PlannerOpResponse);
      }
      // Trượt (máy kia vừa ghi / vừa tạo) → đọc lại rồi thử lại.
      row = (await readPlan(db, cId, ext)).row;
    }
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  /* ── Đọc ──────────────────────────────────────────────────────────────── */
  // Lần mở đầu tiên: lưu luôn bộ mẫu, để hai máy (cô dâu, chú rể) cùng bắt đầu
  // từ MỘT kế hoạch. Gói studio hết hạn thì không ghi gì — hiện bộ mẫu để xem.
  if (!row && !planLocked) {
    const { data: made } = await db
      .from("wedding_plans")
      .insert({ contract_id: cId, owner_id: contract.owner_id, ...planToRow(seed(), ext), rev: 1 })
      .select(cols)
      .single();
    row = (made as PlanRow | null) ?? (await readPlan(db, cId, ext)).row;
  }

  const today = todayVN();
  const linkedIds = [contract.gallery_album_id, contract.selection_album_id].filter(Boolean) as string[];
  const [{ data: payments }, { data: payPlan }, { data: appts }, { data: inv }, { data: albums }] = await Promise.all([
    db.from("contract_payments").select("amount").eq("contract_id", cId),
    db.from("contract_payment_plan").select("due_date, paid").eq("contract_id", cId),
    db.from("studio_appointments")
      .select("id, kind, title, appt_date, start_time, location, room, status")
      .eq("contract_id", cId)
      .eq("client_visible", true)
      .neq("status", "cancelled")
      .order("appt_date"),
    db.from("wedding_invitations").select(INV_COLS).eq("contract_id", cId).maybeSingle(),
    linkedIds.length
      ? db.from("albums").select("id, slug, status, phase, is_gallery").in("id", linkedIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Quà cưới: thiệp tặng CÙNG kế hoạch — có ngay lần đầu cặp đôi mở trang, không
  // đợi luật tự tặng (một tháng trước ngày cưới). Ngày cưới lấy theo kế hoạch;
  // giờ và địa điểm của hợp đồng chỉ điền khi hợp đồng quay chụp chính ngày cưới
  // (hợp đồng prewedding thì đó là giờ, chỗ đi chụp).
  let invRow = inv as InvRow | null;
  if (combo && !invRow && !planLocked) {
    const intake = contract.intake as { groom?: { name?: string }; bride?: { name?: string } } | null;
    const weddingDay = shootsWeddingDay(pkg);
    const made = await createInvitationForContract(db, {
      id: cId,
      owner_id: contract.owner_id as string,
      title: contract.title as string | null,
      client_name: (contract.client_name as string | null) ?? null,
      event_date: (row ? normalizePlan(row) : seed()).wedding_date,
      event_time: weddingDay ? ((contract.event_time as string | null) ?? null) : null,
      location: weddingDay ? ((contract.location as string | null) ?? null) : null,
      groom: intake?.groom?.name ?? null,
      bride: intake?.bride?.name ?? null,
    });
    if (made.ok) {
      const { data: all } = await db
        .from("wedding_invitations")
        .select(INV_COLS)
        .eq("contract_id", cId)
        .order("created_at")
        .order("id");
      const rows = (all ?? []) as InvRow[];
      invRow = rows[0] ?? null;
      // Cô dâu và chú rể cùng mở lần đầu → hai thiệp cho một hợp đồng (trang hợp
      // đồng đọc thiệp bằng maybeSingle, hai dòng là hỏng). Giữ thiệp tạo trước,
      // xoá thiệp thừa của chính lượt này.
      if (made.created && rows.length > 1 && rows[0].slug !== made.slug) {
        await db.from("wedding_invitations").delete().eq("slug", made.slug);
      }
    }
  }
  if (combo && ext && row && invRow) row = await syncPlanReplies(db, row, invRow.id, cId);
  const plan = row ? normalizePlan(row) : seed();

  type Appt = { id: string; kind: AppointmentKind; title: string; appt_date: string; start_time: string | null; location: string | null; room: string | null; status: string };
  const apptRows = (appts ?? []) as Appt[];
  const shot = shootDone(apptRows, (contract.event_date as string | null) ?? null, today);
  const toStudioAppt = (a: Appt): StudioAppt => ({
    id: a.id,
    date: a.appt_date,
    time: (a.start_time ?? "").slice(0, 5),
    title: apptTitle(a),
    place: [a.room, a.location].filter(Boolean).join(" · ") || undefined,
  });

  type AlbumRow = { id: string; slug: string; status: string | null; phase: string | null; is_gallery: boolean | null };
  const byId = new Map(((albums ?? []) as AlbumRow[]).map((a) => [a.id, a]));
  const gRow = contract.gallery_album_id ? byId.get(contract.gallery_album_id as string) ?? null : null;
  const sRow = contract.selection_album_id ? byId.get(contract.selection_album_id as string) ?? null : null;
  const delivered = resolveDeliveredAlbum({ gallery: gRow, selection: sRow });
  // "Khách đã chọn xong ảnh" đọc riêng: cột có từ album_selection_done.sql, thiếu
  // cột thì chỉ mất dấu tự tick, không mất cả link album.
  const { data: sDone } = sRow && !delivered
    ? await db.from("albums").select("selection_done_at").eq("id", sRow.id).maybeSingle()
    : { data: null };
  const album = delivered
    ? { picked: true, href: `/album/${(delivered.album as AlbumRow).slug}` }
    : sRow && sRow.status === "published"
      ? { picked: !!(sDone as { selection_done_at?: string | null } | null)?.selection_done_at, href: `/a/${sRow.slug}` }
      : null;

  // Quà cưới: thiệp sửa ngay trong trang này (#thiep), không mở trang riêng.
  const inviteHref = invRow ? (combo ? "#thiep" : `/thiep/sua/${invRow.edit_token}`) : "";
  let invite: PlannerPayload["invite"] = null;
  if (invRow) {
    // Không gửi lời chúc: trang kế hoạch chỉ cần ai dự, bao nhiêu người.
    const { data: rsvps } = await db
      .from("wedding_rsvps")
      .select("guest_name, attending, num_guests, created_at")
      .eq("invitation_id", invRow.id)
      .order("created_at", { ascending: false })
      .limit(2000);
    invite = {
      href: inviteHref,
      token: invRow.edit_token,
      public_href: thiepUrl(`/${invRow.slug}`),
      published: !!invRow.published,
      names: (invRow.config?.guests ?? []).filter((g) => typeof g === "string" && g.trim()),
      replies: (rsvps ?? []) as PlannerInvite["replies"],
    };
  }

  const total = contractTotal((items ?? []) as { qty: number; unit_price: number }[]);
  const paid = sumAmounts((payments ?? []) as { amount: number }[]);
  // Hạn của đợt thanh toán chưa trả sớm nhất — để "Sắp tới" nhắc đúng ngày.
  const nextDue = ((payPlan ?? []) as { due_date: string | null; paid: boolean }[])
    .filter((p) => !p.paid && p.due_date)
    .map((p) => p.due_date as string)
    .sort()[0] ?? null;
  const studioDay: DayRow[] = plan.wedding_date
    ? apptRows.filter((a) => a.appt_date === plan.wedding_date).map((a) => ({ ...toStudioAppt(a), id: `s-${a.id}`, studio: true }))
    : [];

  const payload: PlannerPayload = {
    enabled: true,
    ext,
    combo,
    contract: {
      title: contract.title as string,
      client_name: (contract.client_name as string | null) ?? null,
      event_date: (contract.event_date as string | null) ?? null,
      status: contract.status as PlannerPayload["contract"]["status"],
    },
    studio_name: brand.name,
    studio_phone: (ownerObj?.pl_phone as string | null) ?? null,
    plan,
    updated_at: row?.updated_at ?? null,
    auto: autoLinks({
      studioName: brand.name,
      signed: !!contract.client_signed_at,
      shot,
      invitation: invRow ? { published: !!invRow.published, href: inviteHref } : null,
      album,
      total,
      paid,
    }),
    studio_line: total > 0 ? { name: `Gói của ${brand.name}`, estimate: total, paid, due: nextDue } : null,
    studio_day: studioDay,
    studio_appts: apptRows.filter((a) => a.appt_date >= today).slice(0, 12).map(toStudioAppt),
    invite,
    plan_locked: planLocked,
  };
  return NextResponse.json(payload);
}
