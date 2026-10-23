import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier } from "@/lib/plans";
import { getStudioBrand } from "@/lib/studio-brand";
import { getFeatureFlags, plannerComingSoon } from "@/lib/feature-flags";
import { limitByIpDurable } from "@/lib/rate-limit";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { resolveDeliveredAlbum } from "@/lib/contract-album";
import { matchGuestRsvps } from "@/lib/wedding-guests";
import { apptTitle } from "@/lib/appointments";
import { todayVN } from "@/lib/date";
import { contractTotal, sumAmounts, type AppointmentKind, type WeddingConfig } from "@/lib/types";
import {
  applyPlanOp, autoLinks, normalizePlan, plannerEnabled, seedPlanFor, shootDone,
  type DayRow, type WeddingPlanData,
} from "@/lib/wedding-plan";
import type { PlannerOpResponse, PlannerPayload } from "@/app/portal/[token]/ke-hoach/types";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

type PlanRow = {
  id: string;
  wedding_date: string | null;
  budget_total: number;
  tasks: unknown;
  budget: unknown;
  day_plan: unknown;
  rev: number;
  updated_at: string;
};
const PLAN_COLS = "id, wedding_date, budget_total, tasks, budget, day_plan, rev, updated_at";

/** Kế hoạch → các cột của `wedding_plans`. */
const toRow = (p: WeddingPlanData) => ({
  wedding_date: p.wedding_date,
  budget_total: p.budget_total,
  tasks: p.tasks,
  budget: p.budget,
  day_plan: p.day,
});

/**
 * KẾ HOẠCH CƯỚI của khách — /portal/<client_token>/ke-hoach (không đăng nhập).
 *   POST { phone }      → kế hoạch + những gì đọc từ hợp đồng (tạo kế hoạch lần đầu)
 *   POST { phone, op }  → áp một thao tác (xem PlanOp ở @/lib/wedding-plan)
 *
 * Cùng cổng SĐT với /api/c/[token] (fail-closed, kiểm ở MỌI lần gọi), cùng luật
 * khoá ghi khi gói của studio hết hạn.
 */
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
    .select("id, owner_id, title, client_name, client_phone, shoot_type, service_id, event_date, status, client_signed_at, gallery_album_id, selection_album_id, intake")
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

  const { data: found, error: readErr } = await db.from("wedding_plans").select(PLAN_COLS).eq("contract_id", cId).maybeSingle();
  if (readErr) {
    // Studio chưa chạy migrations/ke_hoach_cuoi.sql — nói thẳng là chưa sẵn sàng
    // thay vì để khách sửa một kế hoạch không có chỗ lưu.
    const missing = phanLoaiLoi(readErr) === "thieu-bang";
    return NextResponse.json({ error: missing ? "not_ready" : "server_error" }, { status: missing ? 503 : 500 });
  }
  let row = found as PlanRow | null;

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

  /* ── Ghi một thao tác ─────────────────────────────────────────────────── */
  if (body.op !== undefined) {
    if (planLocked) return NextResponse.json({ error: "plan_locked" }, { status: 403 });
    // Ghi kèm điều kiện `rev` đúng bản vừa đọc. Cô dâu và chú rể cùng sửa trên
    // hai máy thì lượt ghi chậm hơn trượt, đọc lại bản mới rồi áp lại thao tác
    // của mình lên đó — không ai ghi đè mất việc của người kia.
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = row ? normalizePlan(row) : seedPlanFor((contract.event_date as string | null) ?? null, pkg);
      const r = applyPlanOp(current, body.op);
      if (!r.ok) {
        const res: PlannerOpResponse = { plan: current, updated_at: row?.updated_at ?? null, error: r.error };
        return NextResponse.json(res, { status: r.error === "gone" ? 409 : 400 });
      }
      if (!row) {
        const { data: made, error } = await db
          .from("wedding_plans")
          .insert({ contract_id: cId, owner_id: contract.owner_id, ...toRow(r.plan), rev: 1 })
          .select(PLAN_COLS)
          .single();
        if (!error && made) return NextResponse.json({ plan: normalizePlan(made), updated_at: made.updated_at } satisfies PlannerOpResponse);
        if (error?.code !== "23505") return NextResponse.json({ error: "server_error" }, { status: 500 });
      } else {
        const { data: saved, error } = await db
          .from("wedding_plans")
          .update({ ...toRow(r.plan), rev: row.rev + 1 })
          .eq("id", row.id)
          .eq("rev", row.rev)
          .select(PLAN_COLS);
        if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
        const s = (saved ?? [])[0] as PlanRow | undefined;
        if (s) return NextResponse.json({ plan: normalizePlan(s), updated_at: s.updated_at } satisfies PlannerOpResponse);
      }
      // Trượt (máy kia vừa ghi / vừa tạo) → đọc lại rồi thử lại.
      const { data: again } = await db.from("wedding_plans").select(PLAN_COLS).eq("contract_id", cId).maybeSingle();
      row = again as PlanRow | null;
    }
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  /* ── Đọc ──────────────────────────────────────────────────────────────── */
  // Lần mở đầu tiên: lưu luôn bộ mẫu, để hai máy (cô dâu, chú rể) cùng bắt đầu
  // từ MỘT kế hoạch. Gói studio hết hạn thì không ghi gì — hiện bộ mẫu để xem.
  if (!row && !planLocked) {
    const { data: made } = await db
      .from("wedding_plans")
      .insert({ contract_id: cId, owner_id: contract.owner_id, ...toRow(seedPlanFor((contract.event_date as string | null) ?? null, pkg)), rev: 1 })
      .select(PLAN_COLS)
      .single();
    row = (made as PlanRow | null) ?? ((await db.from("wedding_plans").select(PLAN_COLS).eq("contract_id", cId).maybeSingle()).data as PlanRow | null);
  }
  const plan = row ? normalizePlan(row) : seedPlanFor((contract.event_date as string | null) ?? null, pkg);

  const today = todayVN();
  const linkedIds = [contract.gallery_album_id, contract.selection_album_id].filter(Boolean) as string[];
  const [{ data: payments }, { data: appts }, { data: inv }, { data: albums }] = await Promise.all([
    db.from("contract_payments").select("amount").eq("contract_id", cId),
    db.from("studio_appointments")
      .select("id, kind, title, appt_date, start_time, location, room, status")
      .eq("contract_id", cId)
      .eq("client_visible", true)
      .neq("status", "cancelled"),
    db.from("wedding_invitations").select("id, edit_token, published, config").eq("contract_id", cId).maybeSingle(),
    linkedIds.length
      ? db.from("albums").select("id, slug, status, phase, is_gallery").in("id", linkedIds)
      : Promise.resolve({ data: [] }),
  ]);

  type Appt = { id: string; kind: AppointmentKind; title: string; appt_date: string; start_time: string | null; location: string | null; room: string | null; status: string };
  const apptRows = (appts ?? []) as Appt[];
  const shot = shootDone(apptRows, (contract.event_date as string | null) ?? null, today);

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

  const invRow = inv as { id: string; edit_token: string; published: boolean; config: WeddingConfig | null } | null;
  let guests: PlannerPayload["guests"] = null;
  if (invRow) {
    const list = (invRow.config?.guests ?? []).filter((g) => typeof g === "string" && g.trim());
    const { data: rsvps } = await db
      .from("wedding_rsvps")
      .select("guest_name, attending, num_guests, wish, created_at")
      .eq("invitation_id", invRow.id)
      .limit(2000);
    const s = matchGuestRsvps(list, (rsvps ?? []) as { guest_name: string; attending: boolean; num_guests: number; wish: string | null; created_at: string }[]);
    guests = { total: list.length, attending: s.attending, people: s.people, replies: (rsvps ?? []).length, href: `/thiep/sua/${invRow.edit_token}` };
  }

  const total = contractTotal((items ?? []) as { qty: number; unit_price: number }[]);
  const paid = sumAmounts((payments ?? []) as { amount: number }[]);
  const studioDay: DayRow[] = plan.wedding_date
    ? apptRows
        .filter((a) => a.appt_date === plan.wedding_date)
        .map((a) => ({
          id: `s-${a.id}`,
          time: (a.start_time ?? "").slice(0, 5),
          title: apptTitle(a),
          place: [a.room, a.location].filter(Boolean).join(" · ") || undefined,
          studio: true,
        }))
    : [];

  const payload: PlannerPayload = {
    enabled: true,
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
      invitation: invRow ? { published: !!invRow.published, href: `/thiep/sua/${invRow.edit_token}` } : null,
      album,
      total,
      paid,
    }),
    studio_line: total > 0 ? { name: `Gói của ${brand.name}`, estimate: total, paid } : null,
    studio_day: studioDay,
    guests,
    plan_locked: planLocked,
  };
  return NextResponse.json(payload);
}
