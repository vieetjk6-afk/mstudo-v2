import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { branchName } from "@/lib/branch-rules";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   BÁO CHỦ STUDIO: có hợp đồng mới, TỪ CHI NHÁNH NÀO — /api/studio/contract-created

   Studio nhiều cơ sở thì chủ không ngồi cạnh người tạo hợp đồng nữa. Trước đây
   một hợp đồng do quản lý chi nhánh lập chỉ hiện ra khi chủ tự mở danh sách và
   để ý thấy dòng mới — không có tín hiệu nào cả.

   Chạy ở server bằng service-role vì phải ghi thông báo cho MỘT NGƯỜI KHÁC (chủ
   studio); client của người tạo không có quyền đó, và cũng không nên có.

   Không báo khi chính chủ studio tự tạo hợp đồng — tự báo cho mình là nhiễu.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { contractId } = (await req.json().catch(() => ({}))) as { contractId?: string };
  if (!contractId) return NextResponse.json({ error: "missing contractId" }, { status: 400 });

  const admin = createAdminClient();

  // Hợp đồng phải có thật và người gọi phải thuộc studio đó — nếu không thì bất
  // kỳ ai đăng nhập cũng bơm được thông báo vào chuông của studio khác.
  const { data: contract } = await admin
    .from("studio_contracts")
    .select("id, owner_id, code, title, client_name, branch_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: me } = await admin
    .from("profiles")
    .select("id, full_name, email, studio_owner_id, studio_role")
    .eq("id", user.id)
    .maybeSingle();
  const myStudio = me?.studio_owner_id || me?.id;
  if (myStudio !== contract.owner_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Chủ studio tự tạo → không tự báo cho mình.
  if (user.id === contract.owner_id) return NextResponse.json({ ok: true, skipped: "self" });

  // Tên chi nhánh. Hợp đồng chưa gán chi nhánh vẫn báo, chỉ ghi "chưa gán cơ sở"
  // — im lặng ở đây thì đúng những hợp đồng thiếu dữ liệu lại là những hợp đồng
  // không ai biết mà đi sửa.
  const { data: branches } = await admin
    .from("studio_branches")
    .select("id, name, code, active, position")
    .eq("owner_id", contract.owner_id);
  // branchName tự trả nhãn "chưa gán" khi id rỗng.
  const where = branchName(contract.branch_id as string | null, (branches ?? []) as Parameters<typeof branchName>[1]);

  const who = me?.full_name?.trim() || me?.email || "Nhân sự";
  const what = contract.code ? `${contract.code} · ${contract.title}` : contract.title;
  const message = `${who} vừa tạo hợp đồng ${what}${contract.client_name ? ` cho ${contract.client_name}` : ""} — chi nhánh ${where}`;

  await admin.from("studio_notifications").insert({
    owner_id: contract.owner_id,
    contract_id: contract.id,
    kind: "contract_created",
    message,
  });

  try {
    await sendPushToOwner(contract.owner_id, {
      title: `Hợp đồng mới — ${where}`,
      body: message,
      url: `/dashboard/studio/contracts/${contract.id}`,
      tag: `contract-created-${contract.id}`,
    });
  } catch {
    /* push chưa cấu hình → chuông vẫn có */
  }

  return NextResponse.json({ ok: true, branch: where });
}
