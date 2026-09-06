import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminPanel from "./AdminPanel";
import type { DiscountCode, Profile, UpgradeRequest } from "@/lib/types";


export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") redirect("/dashboard");

  // Đếm album & hợp đồng của từng tài khoản.
  //
  // Đếm SỐNG chứ không lưu bộ đếm trong profiles: số này chỉ admin xem, mỗi lần
  // mở trang là một lần đọc, nên không đáng đánh đổi lấy rủi ro lệch số. Bộ đếm
  // lưu sẵn sẽ sai dần mỗi khi có bản ghi bị xoá bằng đường không đi qua app
  // (SQL Editor, cascade khi xoá tài khoản).
  //
  // Một truy vấn cho mỗi bảng, CHỈ lấy cột owner_id rồi cộng trong JS —
  // PostgREST không có GROUP BY, mà bắn một count cho mỗi tài khoản thì hoá ra
  // hàng trăm truy vấn. Đọc một cột uuid vẫn nhẹ ở quy mô hiện tại; nếu về sau
  // số bản ghi lên hàng trăm nghìn thì thay bằng một RPC làm count phía Postgres.
  // Yêu cầu nâng cấp & mã giảm giá đọc bằng service-role: hai bảng này chỉ admin
  // đụng tới, và ta vừa kiểm role ngay bên trên.
  const db = createAdminClient();
  const [{ data: profiles }, { data: albumOwners }, { data: contractOwners }, { data: upgrades }, { data: codes }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("albums").select("owner_id"),
    // Hợp đồng đã huỷ vẫn là việc studio đã làm, nên vẫn đếm — đây là thước đo
    // mức độ dùng phần mềm, không phải báo cáo doanh thu.
    supabase.from("studio_contracts").select("owner_id"),
    db.from("upgrade_requests").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("discount_codes").select("*").order("created_at", { ascending: false }),
  ]);

  const tally = (rows: { owner_id: string | null }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) if (r.owner_id) m[r.owner_id] = (m[r.owner_id] ?? 0) + 1;
    return m;
  };

  return (
    <AdminPanel
      profiles={(profiles ?? []) as Profile[]}
      albumCounts={tally(albumOwners as { owner_id: string | null }[] | null)}
      contractCounts={tally(contractOwners as { owner_id: string | null }[] | null)}
      upgrades={(upgrades ?? []) as UpgradeRequest[]}
      codes={(codes ?? []) as DiscountCode[]}
    />
  );
}
