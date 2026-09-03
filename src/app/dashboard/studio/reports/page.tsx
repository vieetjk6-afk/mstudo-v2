import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { contractTotal, sumAmounts, type StudioExpense } from "@/lib/types";
import { buildFunnel, sourceLabel } from "@/lib/lead-source";
import { brandFrom } from "@/lib/studio-brand";
import { applyBranch, getBranchScope } from "@/lib/branches";
import ReportsView, { type PaymentRow, type SalaryRow, type SourceStat } from "./ReportsView";


/** Khoá nhóm cho "chưa điền nguồn". Cố ý KHÁC "other" (= "Khác", một nguồn có
 *  thật mà ta không xếp được) — trộn hai thứ này lại là báo cáo nói sai. */
const UNKNOWN = "__unknown__";

export default async function ReportsPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Tính năng này chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  if (profile.actingRole === "staff") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không có quyền</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Mục tài chính chỉ dành cho quản lý / kế toán.</p>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // srcContracts độc lập với 3 truy vấn còn lại → gộp chung một Promise.all thay
  // vì await nối tiếp sau đó (bớt một round-trip tuần tự).
  // Chi nhánh đang chọn. Thu và tiền công lọc qua hợp đồng cha
  // (`contract.branch_id`) vì bản thân hai bảng đó không mang cột chi nhánh —
  // khoản thu thuộc cơ sở nào là do hợp đồng của nó quyết định.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  const [
    { data: payments },
    { data: salaries },
    { data: expenses },
    { data: srcContracts },
    { data: srcBookings },
    { count: convCount },
    { count: leadCount },
  ] = await Promise.all([
    applyBranch(
      supabase
        .from("contract_payments")
        .select("id, amount, kind, paid_at, contract:studio_contracts!inner(owner_id, title, branch_id)")
        .eq("contract.owner_id", profile.id),
      scope.selected,
      "contract.branch_id"
    ),
    applyBranch(
      supabase
        .from("contract_crew")
        .select("id, name, salary, paid, paid_at, contract:studio_contracts!inner(owner_id, title, branch_id)")
        .eq("contract.owner_id", profile.id)
        .eq("paid", true),
      scope.selected,
      "contract.branch_id"
    ),
    applyBranch(supabase.from("studio_expenses").select("*").eq("owner_id", profile.id), scope.selected),
    // Lead-source analytics: value & collected per acquisition channel (all-time).
    applyBranch(
      supabase
        .from("studio_contracts")
        .select("source, branch_id, contract_items(qty, unit_price), contract_payments(amount)")
        .eq("owner_id", profile.id)
        .neq("status", "cancelled"),
      scope.selected
    ),
    // Phễu: yêu cầu đặt lịch (bậc giữa). `archived` là yêu cầu studio dọn đi
    // chứ không phải khách thật, nên không tính vào phễu.
    applyBranch(
      supabase.from("studio_bookings").select("source, status, branch_id").eq("owner_id", profile.id).neq("status", "archived"),
      scope.selected
    ),
    // Bậc đầu phễu — "khách hỏi". Đếm HAI nguồn vì studio hỏi qua đâu cũng là
    // hỏi: hội thoại trong hộp thư (Zalo/Facebook/Instagram/chatbox của chính
    // studio) và lead từ chatbox trên vieetjk.com. Chỉ đếm website_leads thì
    // studio nào không dùng site nền tảng sẽ thấy bậc đầu bằng 0 và cả cái phễu
    // thành vô nghĩa. Hai bảng nguồn khác nhau nên không đếm trùng một người.
    //
    // Cả hai đều KHÔNG có cột chi nhánh (khách nhắn vào trang chung, chưa gắn
    // cơ sở nào) nên cố ý không lọc theo chi nhánh.
    supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    supabase.from("website_leads").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
  ]);
  const srcMap = new Map<string, { count: number; value: number; collected: number; bookings: number }>();
  for (const c of (srcContracts ?? []) as unknown as Array<{
    source: string | null;
    contract_items: { qty: number; unit_price: number }[];
    contract_payments: { amount: number }[];
  }>) {
    // "Chưa rõ nguồn" phải là một nhóm RIÊNG, không dồn vào "Khác": trước đây
    // hợp đồng bỏ trống nguồn bị gộp vào `other` rồi hiện nhãn "Khác", nên
    // studio đọc biểu đồ là tưởng đã biết nguồn của những khách đó.
    const key = c.source || UNKNOWN;
    const cur = srcMap.get(key) || { count: 0, value: 0, collected: 0, bookings: 0 };
    cur.count += 1;
    cur.value += contractTotal(c.contract_items || []);
    cur.collected += sumAmounts(c.contract_payments || []);
    srcMap.set(key, cur);
  }
  // Yêu cầu đặt lịch theo nguồn — để mỗi dòng nói được "bao nhiêu người hỏi thì
  // ra bấy nhiêu hợp đồng", chứ không chỉ nói tổng tiền.
  const bookingRows = (srcBookings ?? []) as unknown as { source: string | null }[];
  for (const b of bookingRows) {
    const key = b.source || UNKNOWN;
    const cur = srcMap.get(key) || { count: 0, value: 0, collected: 0, bookings: 0 };
    cur.bookings += 1;
    srcMap.set(key, cur);
  }

  const sourceStats: SourceStat[] = [...srcMap.entries()]
    .map(([source, v]) => ({ source, label: source === UNKNOWN ? sourceLabel(null) : sourceLabel(source), ...v }))
    .sort((a, b) => b.value - a.value || b.bookings - a.bookings);

  const funnel = buildFunnel({
    // Đang xem MỘT chi nhánh thì bỏ hẳn bậc "khách hỏi": hai bảng nguồn của nó
    // không có cột chi nhánh, nên đó là số của cả studio — chia cho số yêu cầu
    // của riêng một cơ sở sẽ ra tỉ lệ sai mà nhìn vẫn như thật.
    leads: scope.selected ? null : (convCount ?? 0) + (leadCount ?? 0),
    bookings: bookingRows.length,
    contracts: [...srcMap.values()].reduce((n, v) => n + v.count, 0),
    revenue: [...srcMap.values()].reduce((n, v) => n + v.collected, 0),
  });

  return (
    <ReportsView
      ownerId={profile.id}
      studio={{
        name: brandFrom(profile).name,
        phone: (profile.pl_phone as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      }}
      payments={(payments ?? []) as unknown as PaymentRow[]}
      salaries={(salaries ?? []) as unknown as SalaryRow[]}
      initialExpenses={(expenses ?? []) as StudioExpense[]}
      initialTarget={Number(profile.monthly_revenue_target) || 0}
      sourceStats={sourceStats}
      funnel={funnel}
    />
  );
}
