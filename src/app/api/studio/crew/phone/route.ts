import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { forcedBranchScope } from "@/lib/studio-roles";
import { crewPhoneError, findPhoneOwner, normalizeCrewPhone, phoneDigits } from "@/lib/crew-phone";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỔI SĐT CỦA THỢ — /api/studio/crew/phone

   Không ghi thẳng studio_crew.phone từ trình duyệt: phân công hợp đồng, lịch
   bận/rảnh và chấm công lưu THEO SỐ, không theo studio_crew.id. Chỉ đổi số ở sổ
   thì thợ đăng nhập /crew bằng số mới thấy trống trơn, nhắc lịch Zalo vẫn gửi
   số cũ, bảng lương và xếp hạng tách một người thành hai.

   Nên route này chuyển, TRONG PHẠM VI STUDIO NÀY:
     contract_crew      (qua hợp đồng của studio)
     crew_unavailable   (owner_id = studio)
     crew_available     (owner_id = studio)
     crew_timesheet     (owner_id = studio)
   rồi mới đổi số ở sổ — làm SAU CÙNG để lỡ hỏng giữa chừng thì bấm lưu lại là
   chạy tiếp được (dòng đã chuyển không còn khớp số cũ nên không bị chuyển hai lần).

   KHÔNG đụng crew_account (link lịch .ics) và chỉ CHÉP crew_shift_plan sang số
   mới: hai bảng đó là của THỢ, dùng chung mọi studio — thợ có thể vẫn dùng số
   cũ ở studio khác.
   ═══════════════════════════════════════════════════════════════════════════ */

const MANAGERS = ["owner", "admin", "manager", "branch_manager"];

type Err = { code?: string; message?: string } | null;

/** Bảng chưa có (project chưa chạy migration) → bỏ qua phần đó, không chặn đổi số. */
const missingTable = (e: Err) => !!e && (e.code === "42P01" || e.code === "PGRST205");

export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx || !MANAGERS.includes(ctx.actingRole as string)) {
    return NextResponse.json({ error: "Chỉ quản lý trở lên được đổi số điện thoại của thợ." }, { status: 403 });
  }
  const ownerId = ctx.id as string;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const next = normalizeCrewPhone(typeof body?.phone === "string" ? body.phone : "");
  const bad = crewPhoneError(next);
  if (!id) return NextResponse.json({ error: "Thiếu thợ cần đổi số." }, { status: 400 });
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const db = createAdminClient();
  const { data: roster, error: rosterErr } = await db
    .from("studio_crew")
    .select("id, phone, name, branch_id")
    .eq("owner_id", ownerId);
  if (rosterErr) return NextResponse.json({ error: "Không đọc được sổ thợ." }, { status: 500 });

  const crew = (roster ?? []).find((r) => r.id === id);
  if (!crew) return NextResponse.json({ error: "Không tìm thấy thợ này trong sổ." }, { status: 404 });

  // Quản lý chi nhánh chỉ thấy (nên chỉ sửa được) thợ của cơ sở mình — cùng
  // luật ghim phạm vi với trang Nhân sự.
  const pinned = forcedBranchScope(ctx.actingRole as string, (ctx.actingBranchId as string | null) ?? null);
  if (pinned && (pinned === "none" ? crew.branch_id !== null : crew.branch_id !== pinned)) {
    return NextResponse.json({ error: "Thợ này thuộc chi nhánh khác." }, { status: 403 });
  }

  const dup = findPhoneOwner(roster ?? [], next, id);
  if (dup) {
    return NextResponse.json(
      { error: `Số ${next} đã có trong sổ (thợ ${dup.name || dup.phone}). Mỗi số chỉ thuộc một thợ.` },
      { status: 409 }
    );
  }

  // Các dạng số cũ đang nằm trong những bảng kia: chữ số thô (cách cổng /crew
  // và các route lịch ghi) và dạng đã chuẩn hoá (84… → 0…).
  const olds = [...new Set([phoneDigits(crew.phone), normalizeCrewPhone(crew.phone)])].filter((p) => p && p !== next);
  const moved = { contracts: 0, busy: 0, free: 0, timesheet: 0 };
  const warnings: string[] = [];

  if (olds.length) {
    // 1) Phân công hợp đồng. contract_crew không có owner_id → lọc qua hợp đồng.
    let ccRows: { id: string; phone: string | null }[] = [];
    const byDigits = await db
      .from("contract_crew")
      .select("id, phone, contract:studio_contracts!inner(owner_id)")
      .eq("contract.owner_id", ownerId)
      .in("phone_digits", olds);
    if (byDigits.error) {
      // Chưa chạy crew_phone_digits.sql → quét SĐT của studio rồi so chữ số.
      const all = await db
        .from("contract_crew")
        .select("id, phone, contract:studio_contracts!inner(owner_id)")
        .eq("contract.owner_id", ownerId)
        .not("phone", "is", null);
      if (all.error) return NextResponse.json({ error: "Không đọc được phân công hợp đồng." }, { status: 500 });
      ccRows = (all.data ?? []).filter((r) => olds.includes(phoneDigits(r.phone)));
    } else {
      ccRows = byDigits.data ?? [];
    }
    const ccIds = ccRows.map((r) => r.id);
    for (let i = 0; i < ccIds.length; i += 200) {
      const { error } = await db.from("contract_crew").update({ phone: next }).in("id", ccIds.slice(i, i + 200));
      if (error) return NextResponse.json({ error: "Không chuyển được phân công hợp đồng sang số mới." }, { status: 500 });
    }
    moved.contracts = ccIds.length;

    // 2) Lịch bận (studio xếp hộ / thợ tự báo cho studio này).
    {
      const { data, error } = await db
        .from("crew_unavailable")
        .update({ phone: next })
        .eq("owner_id", ownerId)
        .in("phone", olds)
        .select("id");
      if (error && !missingTable(error)) {
        return NextResponse.json({ error: "Không chuyển được lịch bận của thợ." }, { status: 500 });
      }
      moved.busy = data?.length ?? 0;
    }

    // 3) Khoảng rảnh. unique(phone, date, start_time) là TOÀN CỤC: số mới có thể
    //    đã báo rảnh đúng khung đó (ở studio khác) → giữ dòng sẵn có, bỏ dòng cũ.
    {
      const { data: rows, error } = await db
        .from("crew_available")
        .select("id")
        .eq("owner_id", ownerId)
        .in("phone", olds);
      if (error && !missingTable(error)) {
        return NextResponse.json({ error: "Không đọc được khoảng rảnh của thợ." }, { status: 500 });
      }
      for (const r of rows ?? []) {
        const u = await db.from("crew_available").update({ phone: next }).eq("id", r.id);
        if (u.error?.code === "23505") await db.from("crew_available").delete().eq("id", r.id);
        else if (u.error) return NextResponse.json({ error: "Không chuyển được khoảng rảnh của thợ." }, { status: 500 });
        moved.free++;
      }
    }

    // 4) Chấm công. Mỗi SĐT chỉ có MỘT ca đang mở trên toàn hệ thống: số mới
    //    đang mở ca ở nơi khác thì ca mở của số cũ không chuyển được.
    {
      const closed = await db
        .from("crew_timesheet")
        .update({ phone: next })
        .eq("owner_id", ownerId)
        .in("phone", olds)
        .not("ended_at", "is", null)
        .select("id");
      if (closed.error && !missingTable(closed.error)) {
        return NextResponse.json({ error: "Không chuyển được bảng chấm công của thợ." }, { status: 500 });
      }
      moved.timesheet = closed.data?.length ?? 0;
      if (!closed.error) {
        const open = await db
          .from("crew_timesheet")
          .update({ phone: next })
          .eq("owner_id", ownerId)
          .in("phone", olds)
          .is("ended_at", null)
          .select("id");
        if (open.error?.code === "23505") {
          warnings.push("Thợ đang có ca chấm công mở dưới số cũ — kết thúc ca đó ở số cũ, các ca sau sẽ theo số mới.");
        } else if (open.error) {
          return NextResponse.json({ error: "Không chuyển được ca chấm công đang mở." }, { status: 500 });
        } else {
          moved.timesheet += open.data?.length ?? 0;
        }
      }
    }

    // 5) Ca công ty (A/B/C) là của thợ, dùng chung mọi studio: CHÉP sang số mới
    //    nếu số mới chưa có, không xoá của số cũ.
    {
      const { data: plan } = await db
        .from("crew_shift_plan")
        .select("company, shift")
        .in("phone", olds)
        .limit(1)
        .maybeSingle();
      if (plan) {
        await db
          .from("crew_shift_plan")
          .upsert({ phone: next, company: plan.company, shift: plan.shift, updated_at: new Date().toISOString() }, { onConflict: "phone", ignoreDuplicates: true });
      }
    }
  }

  // 6) SAU CÙNG mới đổi số ở sổ (xem ghi chú đầu file).
  const { data: updated, error: upErr } = await db
    .from("studio_crew")
    .update({ phone: next })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (upErr || !updated) {
    if (upErr?.code === "23505") {
      return NextResponse.json({ error: `Số ${next} đã có trong sổ thợ.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Không lưu được số điện thoại mới. Bấm lưu lại để thử tiếp." }, { status: 500 });
  }

  return NextResponse.json({ crew: updated, moved, warnings });
}
