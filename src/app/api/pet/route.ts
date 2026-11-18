import { NextResponse } from "next/server";
import { getProfileById, requireStudio, requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { durableAllowed } from "@/lib/rate-limit";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { todayVN } from "@/lib/date";
import {
  DEFAULT_NAME, addDays, buildReminders, cleanName, feedXp, isOutfitKey, isTaskKey, outfitUnlocked, summarize, tasksFor,
  OUTFITS, type Claim, type PetTaskKey, type PetTier, type ReminderCounts,
} from "@/lib/pet";

export const dynamic = "force-dynamic";

/**
 * BÉ MÁY ẢNH — thú ảo của từng tài khoản (màn /dashboard/be-may-anh).
 *
 *   GET  → trạng thái bé + nhiệm vụ hôm nay (đã nhận / đã làm, chờ nhận / chưa).
 *   POST { action: "claim",  task }     → nhận thưởng một nhiệm vụ hôm nay.
 *   POST { action: "rename", name }     → đổi tên bé.
 *   POST { action: "outfit", outfit }   → đeo phụ kiện đã mở (null = tháo).
 *
 * Nhiệm vụ gắn việc thật (album / hợp đồng / khoản thu) được MÁY CHỦ đối chiếu
 * dữ liệu của studio trước khi cho nhận — client chỉ bấm nút. Nhân viên làm
 * việc cho studio nào thì đếm theo dữ liệu của studio đó.
 *
 * Database chưa chạy supabase/be-may-anh.sql → GET trả { setup: false } để màn
 * hình nhắc, không làm lỗi dashboard.
 */

type Ctx = { userId: string; ownerId: string; tier: PetTier; role: string };

async function me(): Promise<Ctx | null> {
  const user = await requireUser();
  if (!user) return null;
  const profile = await getProfileById(user.id);
  if (!profile || !profile.is_active) return null;
  // requireStudio trả hồ sơ CHỦ studio (với nhân viên) và gói hiệu lực; tài
  // khoản gói free không có khu studio → null, khi đó tự mình là chủ album.
  const studio = await requireStudio("booking");
  return {
    userId: user.id,
    ownerId: (studio?.id as string | undefined) ?? (profile.studio_owner_id as string | null) ?? user.id,
    tier: (studio?.studioTier as PetTier | undefined) ?? "none",
    role: (studio?.actingRole as string | undefined) ?? "owner",
  };
}

// Ai được nghe nhắc gì — khớp quyền xem màn tương ứng trong @/lib/studio-nav.
const MONEY_ROLES = new Set(["owner", "admin", "manager", "branch_manager", "accountant"]);
const MANAGER_ROLES = new Set(["owner", "admin", "manager", "branch_manager"]);

/**
 * Đếm việc đang chờ để bé nhắc (bé nổi ở góc màn hình). Mỗi câu đếm tự nuốt
 * lỗi — bảng của tính năng nào chưa cài thì câu nhắc ấy chỉ không xuất hiện.
 */
async function countReminders(db: Db, ctx: Ctx, today: string): Promise<Partial<ReminderCounts>> {
  if (ctx.tier === "none") return {};
  const head = { count: "exact" as const, head: true };
  const num = (r: { count: number | null; error: unknown }) => (r.error ? 0 : r.count ?? 0);
  const skip = Promise.resolve({ count: 0, error: null });
  const money = MONEY_ROLES.has(ctx.role);
  const manager = MANAGER_ROLES.has(ctx.role);
  const live = ["sent", "approved", "in_progress", "post_production"];

  const [today1, tomorrow, appts, due, unsigned, bookings, leads, inbox] = await Promise.all([
    db.from("studio_contracts").select("client_name").eq("owner_id", ctx.ownerId)
      .eq("event_date", today).in("status", live).limit(20),
    db.from("studio_contracts").select("id", head).eq("owner_id", ctx.ownerId)
      .eq("event_date", addDays(today, 1)).in("status", live),
    db.from("studio_appointments").select("id", head).eq("owner_id", ctx.ownerId).eq("appt_date", today),
    money
      ? db.from("contract_payment_plan").select("id, contract:studio_contracts!inner(owner_id, status)", head)
          .eq("contract.owner_id", ctx.ownerId).neq("contract.status", "cancelled")
          .eq("paid", false).lte("due_date", today)
      : skip,
    money
      ? db.from("studio_contracts").select("id", head).eq("owner_id", ctx.ownerId).eq("status", "sent")
      : skip,
    manager ? db.from("studio_bookings").select("id", head).eq("owner_id", ctx.ownerId).eq("status", "new") : skip,
    manager ? db.from("website_leads").select("id", head).eq("owner_id", ctx.ownerId).eq("status", "new") : skip,
    db.from("inbox_conversations").select("id", head).eq("owner_id", ctx.ownerId)
      .eq("status", "open").gt("unread", 0),
  ]);

  const shootRows = today1.error ? [] : ((today1.data ?? []) as { client_name: string | null }[]);
  return {
    shootsToday: shootRows.length,
    firstClient: shootRows[0]?.client_name?.trim() || null,
    shootsTomorrow: num(tomorrow),
    apptsToday: num(appts),
    paymentsDue: num(due),
    unsigned: num(unsigned),
    bookings: num(bookings),
    leads: num(leads),
    inbox: num(inbox),
  };
}

/** Nửa đêm hôm nay theo giờ Việt Nam, dạng ISO (UTC). */
function startOfTodayVN(today: string): string {
  return new Date(`${today}T00:00:00+07:00`).toISOString();
}

type Db = ReturnType<typeof createAdminClient>;

/** Hôm nay studio đã làm việc ứng với nhiệm vụ chưa — đối chiếu dữ liệu thật. */
async function taskDone(db: Db, ctx: Ctx, task: PetTaskKey, since: string): Promise<boolean> {
  if (task === "feed") return true;
  if (task === "album") {
    const { count } = await db
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ctx.ownerId)
      .gte("created_at", since);
    return (count ?? 0) > 0;
  }
  if (task === "contract") {
    const { count } = await db
      .from("studio_contracts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ctx.ownerId)
      .gte("created_at", since);
    return (count ?? 0) > 0;
  }
  // payment: khoản thu ghi hôm nay trên một hợp đồng của studio. Số âm là
  // khoản hoàn tiền — không tính là "thu".
  const { data } = await db
    .from("contract_payments")
    .select("id, studio_contracts!inner(owner_id)")
    .eq("studio_contracts.owner_id", ctx.ownerId)
    .gte("created_at", since)
    .gt("amount", 0)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function loadState(db: Db, ctx: Ctx) {
  const today = todayVN();
  const [petRes, claimRes] = await Promise.all([
    db.from("pets").select("name, outfit, created_at").eq("user_id", ctx.userId).maybeSingle(),
    // Mỗi ngày tối đa 4 dòng — vài năm dùng đều vẫn chỉ vài nghìn dòng nhỏ.
    db.from("pet_claims").select("day, task, xp").eq("user_id", ctx.userId).order("day", { ascending: false }).limit(5000),
  ]);
  if (phanLoaiLoi(petRes.error) === "thieu-bang" || phanLoaiLoi(claimRes.error) === "thieu-bang") return null;
  if (petRes.error || claimRes.error) throw new Error("db");

  const claims = (claimRes.data ?? []) as Claim[];
  const summary = summarize(claims, today);
  const since = startOfTodayVN(today);
  const tasks = await Promise.all(
    tasksFor(ctx.tier).map(async (t) => {
      const claimed = summary.doneToday.includes(t.key);
      const ready = claimed || (await taskDone(db, ctx, t.key, since).catch(() => false));
      return {
        key: t.key,
        title: t.title,
        desc: t.desc,
        href: t.href ?? null,
        xp: t.key === "feed" ? summary.feedXp : t.xp,
        claimed,
        ready,
      };
    })
  );

  const outfit = isOutfitKey(petRes.data?.outfit) ? petRes.data.outfit : null;
  return {
    setup: true,
    today,
    pet: {
      name: (petRes.data?.name as string | undefined) ?? DEFAULT_NAME,
      outfit:
        outfit && outfitUnlocked(OUTFITS.find((o) => o.key === outfit)!, summary.stage.index, summary.streak.best)
          ? outfit
          : null,
      born: !!petRes.data,
    },
    summary,
    tasks,
  };
}

export async function GET(req: Request) {
  const ctx = await me();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // ?lite=1 — cho bé nổi ở góc màn hình (components/PetBuddy): giai đoạn, tâm
  // trạng, đã điểm danh chưa + câu nhắc việc. Bỏ phần đối chiếu nhiệm vụ; các
  // câu đếm nhắc việc chỉ là count head-only, chạy song song.
  if (new URL(req.url).searchParams.get("lite")) {
    const db = createAdminClient();
    const [petRes, claimRes] = await Promise.all([
      db.from("pets").select("name, outfit").eq("user_id", ctx.userId).maybeSingle(),
      db.from("pet_claims").select("day, task, xp").eq("user_id", ctx.userId).order("day", { ascending: false }).limit(5000),
    ]);
    if (petRes.error || claimRes.error) return NextResponse.json({ setup: false });
    const today = todayVN();
    const s = summarize((claimRes.data ?? []) as Claim[], today);
    const reminders = buildReminders(await countReminders(db, ctx, today).catch(() => ({})));
    const outfit = isOutfitKey(petRes.data?.outfit) &&
      outfitUnlocked(OUTFITS.find((o) => o.key === petRes.data!.outfit)!, s.stage.index, s.streak.best)
      ? petRes.data!.outfit
      : null;
    return NextResponse.json({
      setup: true,
      name: (petRes.data?.name as string | undefined) ?? DEFAULT_NAME,
      stage: s.stage.index,
      mood: s.mood,
      fedToday: s.streak.fedToday,
      streak: s.streak.current,
      feedXp: s.feedXp,
      outfit,
      reminders,
    });
  }
  try {
    const state = await loadState(createAdminClient(), ctx);
    if (!state) return NextResponse.json({ setup: false });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await me();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Mỗi ngày chỉ có vài việc để bấm; bấm hàng chục lần trong mười phút là máy.
  if (!(await durableAllowed(`pet:${ctx.userId}`, 40, 10 * 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: unknown; task?: unknown; name?: unknown; outfit?: unknown;
  };
  const db = createAdminClient();
  const now = new Date().toISOString();

  // Bé "ra đời" ở lần thao tác đầu tiên — upsert không đụng tên/phụ kiện đã có.
  const ensurePet = () =>
    db.from("pets").upsert({ user_id: ctx.userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (body.action === "claim") {
    if (!isTaskKey(body.task)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const task = body.task;
    if (!tasksFor(ctx.tier).some((t) => t.key === task)) {
      return NextResponse.json({ error: "not_available" }, { status: 403 });
    }
    const today = todayVN();
    if (!(await taskDone(db, ctx, task, startOfTodayVN(today)).catch(() => false))) {
      return NextResponse.json({ error: "not_done" }, { status: 409 });
    }

    const { data: rows, error: readErr } = await db
      .from("pet_claims").select("day, task, xp").eq("user_id", ctx.userId).eq("task", "feed")
      .order("day", { ascending: false }).limit(5000);
    if (phanLoaiLoi(readErr) === "thieu-bang") return NextResponse.json({ error: "setup" }, { status: 503 });
    if (readErr) return NextResponse.json({ error: "server_error" }, { status: 500 });

    const xp = task === "feed" ? feedXp(summarize((rows ?? []) as Claim[], today).streak) : tasksFor(ctx.tier).find((t) => t.key === task)!.xp;

    const pet = await ensurePet();
    if (pet.error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    // Khoá chính (user_id, day, task) là hàng rào thật: hai lượt bấm cùng lúc
    // thì một lượt nhận 23505 và không được cộng lần hai.
    const { error } = await db.from("pet_claims").insert({ user_id: ctx.userId, day: today, task, xp });
    if (error?.code === "23505") return NextResponse.json({ error: "already" }, { status: 409 });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  } else if (body.action === "rename") {
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ error: "bad_name" }, { status: 400 });
    const { error } = await db
      .from("pets").upsert({ user_id: ctx.userId, name, updated_at: now }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  } else if (body.action === "outfit") {
    let outfit: string | null = null;
    if (body.outfit != null) {
      if (!isOutfitKey(body.outfit)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
      const { data: rows } = await db.from("pet_claims").select("day, task, xp").eq("user_id", ctx.userId).limit(5000);
      const s = summarize((rows ?? []) as Claim[], todayVN());
      const o = OUTFITS.find((x) => x.key === body.outfit)!;
      if (!outfitUnlocked(o, s.stage.index, s.streak.best)) {
        return NextResponse.json({ error: "locked" }, { status: 403 });
      }
      outfit = o.key;
    }
    const { error } = await db
      .from("pets").upsert({ user_id: ctx.userId, outfit, updated_at: now }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const state = await loadState(db, ctx);
    if (!state) return NextResponse.json({ error: "setup" }, { status: 503 });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
