import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileById, requireStudio } from "@/lib/auth-guards";
import { todayVN } from "@/lib/date";
import { addDays } from "@/lib/appointments";
import type { StudioAppointment, StudioNotification } from "@/lib/types";
import StaffPortal, { type TaskRow, type ChecklistRow } from "./StaffPortal";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG NHÂN VIÊN — /staff  (bản thiết kế "Cổng nhân viên & khách hàng", mục 1)

   Trang RIÊNG của người được phân công: lịch trong ngày, hàng đợi hậu kỳ, thông
   báo. Tối ưu cho điện thoại — nhân viên mở nó ngoài hiện trường, không phải
   ngồi trước sidebar của khu quản lý.

   Khác /crew: /crew là cổng CỘNG TÁC VIÊN không có tài khoản (tra theo số điện
   thoại, gom việc từ nhiều studio). /staff dành cho nhân viên CÓ tài khoản của
   một studio — nên nó đọc được cả việc hậu kỳ và thông báo, thứ mà cổng tra
   theo SĐT không có quyền xem.
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function StaffPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-[19px] font-bold">Cần đăng nhập tài khoản studio</h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          Cổng nhân viên dành cho tài khoản được studio cấp. Nếu bạn là cộng tác viên tự do,
          hãy mở cổng tra việc theo số điện thoại.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/login" className="rounded-[10px] px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
            Đăng nhập
          </Link>
          <Link href="/crew" className="rounded-[10px] px-4 py-2.5 text-[13px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
            Cổng cộng tác viên
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const me = profile.actingUserId as string;
  // `requireStudio` trả về hồ sơ CHỦ studio (mọi truy vấn phải scope theo chủ),
  // nên tên để chào phải đọc riêng hồ sơ của chính người đang đăng nhập —
  // nếu không nhân viên sẽ được chào bằng tên chủ studio.
  const meProfile = profile.isStaff ? await getProfileById(me) : profile;
  const today = todayVN();
  const weekAhead = addDays(today, 7);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDays(`${today.slice(0, 7)}-01`, 31).slice(0, 7) + "-01";

  const [
    { data: appointments },
    { data: monthAppts },
    { data: products },
    { data: notifications },
    { data: myContracts },
  ] = await Promise.all([
    // Lịch từ HÔM NAY tới 7 ngày tới — đủ cho tab "Hôm nay" và thẻ "Sắp tới".
    supabase
      .from("studio_appointments")
      .select("*")
      .eq("owner_id", profile.id)
      .gte("appt_date", today)
      .lte("appt_date", weekAhead)
      .neq("status", "cancelled")
      .order("appt_date")
      .order("start_time"),
    // Chỉ để đếm KPI "buổi trong tháng" — lấy đúng 3 cột cho nhẹ.
    supabase
      .from("studio_appointments")
      .select("id, staff_id, appt_date")
      .eq("owner_id", profile.id)
      .gte("appt_date", monthStart)
      .lt("appt_date", monthEnd)
      .neq("status", "cancelled"),
    // Hàng đợi hậu kỳ: cùng nguồn với màn "Xử lý hình ảnh" của khu quản lý
    // (contract_products) nên hai màn không bao giờ lệch số.
    supabase
      .from("contract_products")
      .select(
        "id, name, qty, cost, status, note, assigned_to, contract:studio_contracts!inner(id, code, title, client_name, delivery_due, owner_id, assigned_to)"
      )
      .eq("contract.owner_id", profile.id)
      .order("created_at"),
    supabase
      .from("studio_notifications")
      .select("*")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(60),
    // Việc cần làm sau buổi chụp = checklist của những hợp đồng tôi phụ trách.
    supabase
      .from("studio_contracts")
      .select("id, code, title, status, contract_tasks(id, label, done, position)")
      .eq("owner_id", profile.id)
      .eq("assigned_to", me)
      .in("status", ["approved", "in_progress"])
      .order("event_date", { ascending: true })
      .limit(20),
  ]);

  const appts = (appointments ?? []) as StudioAppointment[];

  // Checklist phẳng: mỗi việc mang theo mã hợp đồng để nhân viên biết việc của ai.
  const checklist: ChecklistRow[] = ((myContracts ?? []) as {
    id: string;
    code: string | null;
    title: string;
    contract_tasks: { id: string; label: string; done: boolean; position: number }[] | null;
  }[])
    .flatMap((c) =>
      (c.contract_tasks ?? []).map((t) => ({
        id: t.id,
        label: t.label,
        done: t.done,
        position: t.position,
        contract_id: c.id,
        contract_code: c.code,
        contract_title: c.title,
      }))
    )
    .sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position)
    .slice(0, 12);

  return (
    <StaffPortal
      me={me}
      meName={meProfile?.full_name || meProfile?.email || "Bạn"}
      actingRole={profile.actingRole as string}
      studioName={profile.full_name || "Studio"}
      today={today}
      appointments={appts}
      monthApptCount={(monthAppts ?? []).length}
      myMonthApptCount={((monthAppts ?? []) as { staff_id: string | null }[]).filter((a) => a.staff_id === me).length}
      tasks={(products ?? []) as unknown as TaskRow[]}
      notifications={(notifications ?? []) as StudioNotification[]}
      checklist={checklist}
      contractCount={(myContracts ?? []).length}
    />
  );
}
