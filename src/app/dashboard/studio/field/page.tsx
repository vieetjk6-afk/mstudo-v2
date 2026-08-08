import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { todayVN } from "@/lib/date";
import { detectShootKind, buildFieldPlan } from "@/lib/field-mode";
import FieldMode, { type FieldJob } from "./FieldMode";

/**
 * CHẾ ĐỘ NGÀY CHỤP (màn `field` của bản thiết kế) — màn rút gọn dùng khi đang
 * cầm máy ở hiện trường: chữ 16–28px, nút cao 56px, chỉ hiện đúng thứ cần.
 *
 * Trang này lấy các buổi chụp CỦA HÔM NAY rồi dựng lịch trình + checklist ảnh
 * cho từng buổi (xem `src/lib/field-mode.ts`). Nhiều buổi trong ngày thì màn
 * hình cho chọn; `?id=` ghim sẵn một buổi.
 */
export const dynamic = "force-dynamic";

type CrewTime = { contract_id: string; start_time: string | null; end_time: string | null };

export default async function FieldModePage({ searchParams }: { searchParams: { id?: string } }) {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Cần gói Photographer trở lên</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Chế độ ngày chụp đi kèm gói Photographer — nâng gói là dùng được ngay trên điện thoại khi ra hiện trường.
        </p>
        <a
          href="/dashboard/upgrade"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          Nâng cấp gói
        </a>
      </div>
    );
  }

  const today = todayVN();
  const supabase = createClient();

  // Buổi chụp hôm nay của studio. Nhân viên chỉ thấy buổi được giao cho mình —
  // cùng quy tắc với màn Xử lý hình ảnh.
  let q = supabase
    .from("studio_contracts")
    .select("id, code, title, client_name, client_phone, location, event_time, shoot_type, service_id, intake, status")
    .eq("owner_id", profile.id)
    .eq("event_date", today)
    .neq("status", "cancelled")
    .order("event_time", { ascending: true, nullsFirst: false });
  if (profile.actingRole === "staff") q = q.eq("assigned_to", profile.actingUserId);
  const { data: contracts } = await q;

  const rows = (contracts ?? []) as {
    id: string; code: string | null; title: string; client_name: string | null; client_phone: string | null;
    location: string | null; event_time: string | null; shoot_type: string | null; service_id: string | null;
    intake: { start_time?: string; location?: { mapUrl?: string } | null } | null; status: string;
  }[];

  if (rows.length === 0) return <FieldMode jobs={[]} initialId={null} today={today} />;

  const ids = rows.map((r) => r.id);
  // Giờ thật của buổi chụp nằm ở lịch phân công nhân sự: sớm nhất là giờ có mặt,
  // muộn nhất là giờ tan. Hợp đồng chỉ có MỘT cột giờ (event_time) nên không đủ.
  const [{ data: crew }, { data: services }] = await Promise.all([
    supabase.from("contract_crew").select("contract_id, start_time, end_time").in("contract_id", ids),
    supabase.from("studio_services").select("id, name").eq("owner_id", profile.id),
  ]);

  const serviceName = new Map((services ?? []).map((s) => [s.id as string, s.name as string]));
  const crewSpan = new Map<string, { start: string | null; end: string | null }>();
  for (const c of (crew ?? []) as CrewTime[]) {
    const cur = crewSpan.get(c.contract_id) ?? { start: null, end: null };
    if (c.start_time && (!cur.start || c.start_time < cur.start)) cur.start = c.start_time;
    if (c.end_time && (!cur.end || c.end_time > cur.end)) cur.end = c.end_time;
    crewSpan.set(c.contract_id, cur);
  }

  const jobs: FieldJob[] = rows.map((r) => {
    const svc = r.service_id ? serviceName.get(r.service_id) ?? null : null;
    const span = crewSpan.get(r.id);
    // Ưu tiên giờ phân công (sát thực tế nhất) → giờ hợp đồng → giờ khách khai.
    const startTime = span?.start || r.event_time || r.intake?.start_time || null;
    const plan = buildFieldPlan({
      kind: detectShootKind(svc, r.title, r.shoot_type),
      startTime,
      endTime: span?.end ?? null,
    });
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      clientName: r.client_name,
      clientPhone: r.client_phone,
      location: r.location,
      mapUrl: r.intake?.location?.mapUrl ?? null,
      status: r.status,
      plan,
    };
  });

  const wanted = searchParams.id && jobs.some((j) => j.id === searchParams.id) ? searchParams.id : null;
  return <FieldMode jobs={jobs} initialId={wanted ?? jobs[0].id} today={today} />;
}
