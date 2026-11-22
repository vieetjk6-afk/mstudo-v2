import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { autoAdvanceContracts } from "@/lib/contract-status";
import { applyBranch, getBranchScope } from "@/lib/branches";
import { doToc } from "@/lib/do-toc";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export const dynamic = "force-dynamic";

/**
 * Danh sách hợp đồng cho web app (phiên đăng nhập) — để trang "Quản lý HĐ" tải
 * client-side + cache trên máy (stale-while-revalidate), hiển thị tức thì.
 * Cùng truy vấn với bản SSR cũ trong contracts/page.tsx.
 */
// Lần chạy autoAdvance gần nhất theo từng studio (trong bộ nhớ của instance).
// Kết quả chỉ đổi theo NGÀY, mà danh sách được mở hàng chục lần mỗi ngày — mỗi
// lần 2–4 truy vấn nối tiếp trước khi kịp đọc danh sách. Một giờ một lần là đủ
// bắt hợp đồng vừa nhập / vừa đổi ngày; cron hằng ngày lo phần còn lại.
const lastAdvance = new Map<string, number>();
const ADVANCE_EVERY_MS = 60 * 60 * 1000;

export async function GET() {
  const dt = doToc("/api/studio/contracts-list");
  const profile = await dt.buoc("requireStudio", requireStudio("plus"));
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Tới ngày sớm nhất của HĐ (kể cả ngày đãi trước) thì tự chuyển sang "đang
  // thực hiện" ngay khi mở trang. Dùng admin client (scoped theo owner) để chạy
  // được cả với tài khoản nhân viên; lỗi ở bước này không được làm hỏng danh sách.
  const oid = profile.id as string;
  if (Date.now() - (lastAdvance.get(oid) ?? 0) >= ADVANCE_EVERY_MS) {
    lastAdvance.set(oid, Date.now());
    try {
      await dt.buoc("autoAdvance", autoAdvanceContracts(createAdminClient(), oid));
    } catch {
      lastAdvance.delete(oid); // lỗi → lần mở sau thử lại
      /* best-effort — cron hằng ngày vẫn xử lý */
    }
  }

  const supabase = await createClient();
  // Chi nhánh đang chọn trên thanh trên cùng — endpoint này chạy trong cùng
  // request nên đọc được cookie đó, và danh sách hợp đồng khớp với phạm vi mà
  // người dùng đang thấy ở mọi màn khác.
  const scope = await dt.buoc("branch", getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string));
  // LẬT TRANG: `.select()` trơn bị Supabase cắt lặng lẽ ở 1000 dòng, và vì
  // xếp mới tạo trước nên phần bị cắt chính là HĐ CŨ — thường đã hoàn thành —
  // khiến tìm tên/SĐT khách cũ không ra. Thứ tự tổng (created_at, id) để ranh
  // giới trang không trùng/sót hàng.
  const data = await dt.buoc(
    "list",
    fetchAllRows<unknown>((from, to) => {
      let q = supabase
        .from("studio_contracts")
        .select("id, code, title, client_name, client_phone, event_date, event_time, location, status, shoot_type, branch_id, contract_items(qty, unit_price, name), contract_payments(amount), contract_crew(id, name, role, status)")
        .eq("owner_id", profile.id);
      if (profile.actingRole === "staff") q = q.eq("assigned_to", profile.actingUserId);
      return applyBranch(q, scope.selected)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
    })
  );
  dt.xong();
  return NextResponse.json({ list: data });
}
