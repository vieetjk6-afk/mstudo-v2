import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncContractCalendar } from "@/lib/gcal-sync";
import { autoNotify } from "@/lib/zalo/notify";
import { crewPortalUrl } from "@/lib/crew-show";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { mainUrl } from "@/lib/hosts";
import { fmtDate } from "@/lib/date";
import { vnd } from "@/lib/types";
import { daysBetween, shiftDate, rescheduleClientMessage } from "@/lib/contract-cancel";
import { studioFor, loadContract, contractCrew, notifyContractChanged } from "@/lib/contract-change";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dời lịch hợp đồng: đổi ngày/giờ chụp và kéo theo MỌI thứ gắn với ngày cũ,
 * thay vì chỉ sửa ô ngày rồi để lịch thợ, hạn thu, lịch hẹn nằm lại ngày cũ.
 *
 * Chủ studio và quản lý (toàn studio / chi nhánh) được dời: đây là việc điều
 * phối lịch, không đụng tới tiền đã thu. Phí dời lịch (nếu có) chỉ là một hạng
 * mục cộng thêm, khách vẫn trả qua các đợt như thường.
 *
 * GET ?date=YYYY-MM-DD → thợ của hợp đồng này đã bận ngày mới chưa + số hợp
 *      đồng khác cùng ngày, để cảnh báo TRƯỚC khi dời.
 * POST { newDate, newTime, reason, fee, shiftPlans, moveAppointments, notifyCrew }
 */

const ROLES = ["manager", "branch_manager"] as const;
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const normTime = (v: unknown): string | null => {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

async function guard(id: string) {
  const profile = await studioFor(ROLES);
  if (!profile) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const db = createAdminClient();
  const contract = await loadContract(db, id, profile.id);
  if (!contract) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { db, contract, profile };
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  const { db, contract, profile } = g;
  const date = new URL(req.url).searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ crewBusy: [], sameDay: [] });

  const crew = await contractCrew(db, contract.id);
  const phones = crew.map((c) => digits(c.phone)).filter(Boolean);
  const [{ data: marks }, { data: others }] = await Promise.all([
    phones.length
      ? db
          .from("crew_unavailable")
          .select("phone, title, contract_crew_id")
          .eq("owner_id", profile.id)
          .eq("date", date)
          .in("phone", phones)
      : Promise.resolve({ data: [] as { phone: string; title: string | null; contract_crew_id: string | null }[] }),
    db
      .from("studio_contracts")
      .select("id, title, client_name")
      .eq("owner_id", profile.id)
      .eq("event_date", date)
      .neq("status", "cancelled")
      .neq("id", contract.id)
      .limit(10),
  ]);
  const ownIds = new Set(crew.map((c) => c.id));
  const crewBusy = ((marks ?? []) as { phone: string; title: string | null; contract_crew_id: string | null }[])
    // Mốc của CHÍNH hợp đồng này (nếu dời trong cùng ngày) không phải trùng lịch.
    .filter((m) => !m.contract_crew_id || !ownIds.has(m.contract_crew_id))
    .map((m) => {
      const who = crew.find((c) => digits(c.phone) === digits(m.phone));
      return { name: who?.name || m.phone, what: m.title || "đã bận" };
    });
  return NextResponse.json({ crewBusy, sameDay: others ?? [] });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  const { db, contract, profile } = g;
  if (contract.status === "cancelled") return NextResponse.json({ error: "cancelled" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as {
    newDate?: string; newTime?: string; reason?: string; fee?: number;
    shiftPlans?: boolean; moveAppointments?: boolean; notifyCrew?: boolean;
  };
  if (!isDate(b.newDate)) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  const newDate = b.newDate;
  const oldDate = contract.event_date;
  const oldTime = contract.event_time;
  // Không nhập giờ mới → giữ NGUYÊN giờ cũ (có studio ghi "07:00 - 12:00", chuẩn
  // hoá là mất nửa sau). Có nhập thì chuẩn hoá HH:MM, lạ quá thì giữ chữ gốc.
  const rawTime = String(b.newTime ?? "").trim();
  const newTime = rawTime ? normTime(rawTime) ?? rawTime.slice(0, 40) : oldTime;
  if (newDate === oldDate && (newTime ?? "") === (oldTime ?? "")) {
    return NextResponse.json({ error: "same_date" }, { status: 400 });
  }
  const reason = (b.reason || "").trim().slice(0, 300) || null;
  const fee = Math.max(0, Math.min(100_000_000, Math.round(Number(b.fee) || 0)));

  // 1) Lịch sử TRƯỚC: đây là thứ duy nhất nhớ ngày cũ. Chưa chạy migration thì
  //    dừng hẳn, không dời "mất dấu".
  const { error: hErr } = await db.from("contract_reschedules").insert({
    contract_id: contract.id,
    old_date: oldDate,
    old_time: oldTime,
    new_date: newDate,
    new_time: newTime,
    reason,
    fee,
    created_by: (profile.actingUserId as string | undefined) ?? profile.id,
  });
  if (hErr) {
    if (phanLoaiLoi(hErr) !== "khac") {
      return NextResponse.json({ error: "missing_migration", file: "supabase/huy-doi-lich.sql" }, { status: 409 });
    }
    return NextResponse.json({ error: "write_failed", message: hErr.message }, { status: 500 });
  }

  // 2) Ngày giờ của hợp đồng.
  const { error: cErr } = await db
    .from("studio_contracts")
    .update({ event_date: newDate, event_time: newTime })
    .eq("id", contract.id);
  if (cErr) return NextResponse.json({ error: "write_failed", message: cErr.message }, { status: 500 });

  const delta = oldDate ? daysBetween(oldDate, newDate) ?? 0 : 0;
  let shiftedPlans = 0;
  let movedAppts = 0;
  let movedCrew = 0;

  // 3) Hạn các đợt CHƯA thu dời theo cùng số ngày ("trước ngày chụp 7 ngày" vẫn
  //    đúng là 7 ngày). Đợt đã thu giữ nguyên: đó là lịch sử.
  if (b.shiftPlans !== false && delta !== 0) {
    const { data: plans } = await db
      .from("contract_payment_plan")
      .select("id, due_date")
      .eq("contract_id", contract.id)
      .eq("paid", false)
      .not("due_date", "is", null);
    for (const p of (plans ?? []) as { id: string; due_date: string }[]) {
      await db.from("contract_payment_plan").update({ due_date: shiftDate(p.due_date, delta) }).eq("id", p.id);
      shiftedPlans++;
    }
  }

  // 4) Lịch hẹn nằm ĐÚNG ngày chụp cũ (makeup, chụp) sang ngày mới. Lịch thử đồ
  //    / tư vấn ở ngày khác không đụng: chúng có lý do riêng để ở ngày đó.
  if (b.moveAppointments !== false && oldDate && oldDate !== newDate) {
    const { data: appts } = await db
      .from("studio_appointments")
      .update({ appt_date: newDate, updated_at: new Date().toISOString() })
      .eq("contract_id", contract.id)
      .eq("appt_date", oldDate)
      .eq("status", "scheduled")
      .select("id")
      .then((r) => r, () => ({ data: null }));
    movedAppts = (appts ?? []).length;
  }

  // 5) Lịch của thợ đi theo ngày mới.
  // Thợ gán theo MỐC khác (đãi trước, thử đồ…) giữ nguyên ngày của mốc — dời
  // buổi chính không kéo họ theo, cũng không báo họ. Chưa có cột event_id thì
  // coi như không ai gán theo mốc.
  const { data: onMs } = await db
    .from("contract_crew")
    .select("id")
    .eq("contract_id", contract.id)
    .not("event_id", "is", null)
    .then((r) => r, () => ({ data: null }));
  const onMilestone = new Set(((onMs ?? []) as { id: string }[]).map((r) => r.id));
  const crew = (await contractCrew(db, contract.id)).filter((c) => !onMilestone.has(c.id));
  if (crew.length && oldDate !== newDate) {
    const { data: moved } = await db
      .from("crew_unavailable")
      .update({ date: newDate })
      .in("contract_crew_id", crew.map((c) => c.id))
      .select("id")
      .then((r) => r, () => ({ data: null }));
    movedCrew = (moved ?? []).length;
  }

  // 6) Phí dời lịch → một hạng mục, để tổng hợp đồng và công nợ tự cộng.
  if (fee > 0) {
    await db.from("contract_items").insert({
      contract_id: contract.id,
      name: `Phí dời lịch (${oldDate ? fmtDate(oldDate) : "chưa có ngày"} → ${fmtDate(newDate)})`,
      qty: 1,
      unit_price: fee,
      position: 999,
    });
  }

  const when = `${fmtDate(newDate)}${newTime ? ` · ${newTime}` : ""}`;
  await notifyContractChanged(db, profile.id, contract.id, `Dời lịch “${contract.title}”${oldDate ? ` từ ${fmtDate(oldDate)}` : ""} sang ${when}`);

  // 7) Báo thợ qua Zalo (nếu studio đã nối Zalo và bật mốc báo lịch cho thợ).
  let crewNotified = 0;
  if (b.notifyCrew !== false && crew.length) {
    const { data: me } = await db.from("profiles").select("crew_token").eq("id", profile.id).maybeSingle();
    const portal = crewPortalUrl(me?.crew_token as string | null);
    for (const c of crew) {
      if (!c.phone) continue;
      const r = await autoNotify({
        ownerId: profile.id,
        event: "crew_assigned",
        audience: "crew",
        toPhone: c.phone,
        toName: c.name,
        body: `ĐỔI LỊCH: “${contract.title}” dời${oldDate ? ` từ ${fmtDate(oldDate)}` : ""} sang ${when}${contract.location ? ` tại ${contract.location}` : ""}.\nXem lịch của bạn: ${portal}`,
        templateData: {
          name: c.name || "",
          show: contract.title,
          date: fmtDate(newDate),
          time: newTime ?? "",
          location: contract.location ?? "",
          link: portal,
        },
        contractId: contract.id,
      }).catch(() => ({ ok: false }));
      if (r.ok) crewNotified++;
    }
  }

  await syncContractCalendar(profile.id, contract.id);

  return NextResponse.json({
    ok: true,
    shiftedPlans,
    movedAppts,
    movedCrew,
    crewNotified,
    clientMessage: rescheduleClientMessage({
      name: contract.client_name,
      title: contract.title,
      oldDate: oldDate ? fmtDate(oldDate) : null,
      newDate: fmtDate(newDate),
      newTime,
      fee: fee > 0 ? vnd(fee) : null,
      link: contract.client_token ? mainUrl(`/c/${contract.client_token}`) : null,
      studio: profile.full_name,
    }),
  });
}
