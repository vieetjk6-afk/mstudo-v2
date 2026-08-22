import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

const ROLES = ["manager", "staff", "accountant"];

/** Studio owner creates a staff sub-account. */
export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx || (ctx.actingRole !== "owner" && ctx.actingRole !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { email, password, full_name, role, branch_id } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
    branch_id?: string | null;
  };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length < 6) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }
  const studioRole = ROLES.includes(role || "") ? role : "staff";
  const emailNorm = email.trim().toLowerCase();
  const fullName = full_name?.trim() || emailNorm;

  const db = createAdminClient();

  // Chi nhánh phải THUỘC studio này — nếu không, chủ studio A có thể gán nhân
  // viên của mình vào chi nhánh của studio B bằng cách gửi id lạ.
  const branchId = await validBranchId(db, ctx.id as string, branch_id);

  // 1) Tạo tài khoản auth. Nếu email đã tồn tại → nhận tài khoản đó làm nhân viên
  //    (nhưng KHÔNG chiếm tài khoản đang trả phí / admin / thuộc studio khác).
  let userId: string;
  const { data: created, error } = await db.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    const { data: existing } = await db
      .from("profiles")
      .select("id, role, plan, plan_expires_at, studio_owner_id")
      .eq("email", emailNorm)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: error?.message || "create_failed" }, { status: 500 });
    }
    const alreadyMine = existing.studio_owner_id === ctx.id;
    const isFreeUnclaimed =
      existing.role !== "admin" &&
      !existing.studio_owner_id &&
      effectivePlan(existing.plan, existing.plan_expires_at) === "free";
    if (!alreadyMine && !isFreeUnclaimed) {
      // Email đã thuộc một tài khoản trả phí / admin / studio khác.
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    userId = existing.id;
    // Đặt lại mật khẩu theo mật khẩu chủ studio nhập để nhân viên đăng nhập được.
    await db.auth.admin.updateUserById(userId, { password });
  }

  // 2) Bảo đảm hồ sơ tồn tại VÀ đã gắn với studio này. Dùng upsert thay cho update
  //    mù — không phụ thuộc thời điểm trigger handle_new_user tạo hàng profiles
  //    (tránh trường hợp update trúng 0 hàng mà vẫn báo thành công → nhân viên
  //    thành user tự do, bị bắt nâng cấp gói).
  const { error: upErr } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: emailNorm,
        full_name: fullName,
        studio_owner_id: ctx.id,
        studio_role: studioRole,
        studio_branch_id: branchId,
        is_active: true,
      },
      { onConflict: "id" }
    );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 3) Xác nhận đã gắn thành công (nếu không, báo lỗi rõ thay vì im lặng).
  const { data: check } = await db.from("profiles").select("studio_owner_id").eq("id", userId).maybeSingle();
  if (!check || check.studio_owner_id !== ctx.id) {
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Đổi CHI NHÁNH (và vai trò) của một nhân viên đã có.
 *
 * Phải đi qua service-role: vá C1 đã thu hồi quyền UPDATE bảng profiles của
 * `authenticated` và cố ý KHÔNG cấp lại `studio_branch_id` / `studio_role` —
 * nếu cấp, nhân viên tự đổi được chi nhánh và vai trò của chính mình.
 */
export async function PATCH(req: Request) {
  const ctx = await requireStudio();
  if (!ctx || (ctx.actingRole !== "owner" && ctx.actingRole !== "admin" && ctx.actingRole !== "manager")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, branch_id, role } = (await req.json().catch(() => ({}))) as {
    id?: string;
    branch_id?: string | null;
    role?: string;
  };
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const db = createAdminClient();
  const { data: staff } = await db.from("profiles").select("studio_owner_id").eq("id", id).maybeSingle();
  if (!staff || staff.studio_owner_id !== ctx.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  // `branch_id` có mặt trong body (kể cả null) mới sửa — gửi PATCH chỉ để đổi
  // vai trò thì không được âm thầm bỏ chi nhánh của người ta.
  if (branch_id !== undefined) patch.studio_branch_id = await validBranchId(db, ctx.id as string, branch_id);
  // Quản lý KHÔNG được đổi vai trò (đó là việc của chủ studio) — tránh một quản
  // lý tự nâng mình thành owner-equivalent bằng cách sửa vai trò người khác.
  if (role !== undefined && (ctx.actingRole === "owner" || ctx.actingRole === "admin")) {
    if (!ROLES.includes(role)) return NextResponse.json({ error: "bad_role" }, { status: 400 });
    patch.studio_role = role;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Remove a staff sub-account (must belong to this studio). */
export async function DELETE(req: Request) {
  const ctx = await requireStudio();
  if (!ctx || (ctx.actingRole !== "owner" && ctx.actingRole !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const db = createAdminClient();
  const { data: staff } = await db.from("profiles").select("studio_owner_id").eq("id", id).maybeSingle();
  if (!staff || staff.studio_owner_id !== ctx.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Kiểm chi nhánh có thuộc studio này không.
 * Trả null cho "bỏ gán", cho id lạ, và cho cả trường hợp bảng studio_branches
 * chưa tồn tại (chưa chạy migration) — gán bừa một id không kiểm chứng là lỗ
 * hổng, còn bỏ trống thì chỉ là chưa gán.
 */
async function validBranchId(
  db: ReturnType<typeof createAdminClient>,
  ownerId: string,
  branchId: string | null | undefined
): Promise<string | null> {
  if (!branchId) return null;
  const { data } = await db.from("studio_branches").select("id").eq("id", branchId).eq("owner_id", ownerId).maybeSingle();
  return data ? branchId : null;
}
