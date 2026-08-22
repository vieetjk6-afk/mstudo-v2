import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { Trophy } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { vnd, CREW_ROLE_LABEL, type CrewRole } from "@/lib/types";
import { applyBranch, getBranchScope } from "@/lib/branches";


const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

type Row = { name: string | null; phone: string | null; role: CrewRole; status: string; salary: number };

export default async function RankingPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // Bảng này hiện THU NHẬP của từng thợ, nên cũng phải theo phạm vi chi nhánh —
  // nếu không, người phụ trách một cơ sở suy ra được tiền công cơ sở khác đang trả.
  const { data } = await applyBranch(
    supabase
      .from("contract_crew")
      .select("name, phone, role, status, salary, contract:studio_contracts!inner(owner_id, branch_id)")
      .eq("contract.owner_id", profile.id),
    (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected,
    "contract.branch_id"
  );

  const rows = (data ?? []) as unknown as Row[];
  type Agg = { key: string; name: string; role: CrewRole; jobs: number; accepted: number; earned: number };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const key = digits(r.phone) || (r.name || "").trim().toLowerCase();
    if (!key) continue;
    const a = map.get(key) ?? { key, name: r.name || r.phone || "—", role: r.role, jobs: 0, accepted: 0, earned: 0 };
    a.jobs += 1;
    if (r.status === "accepted") {
      a.accepted += 1;
      a.earned += r.salary || 0;
    }
    if (r.name) a.name = r.name;
    map.set(key, a);
  }
  const ranked = Array.from(map.values()).sort((x, y) => y.accepted - x.accepted || y.earned - x.earned);

  const medal = ["#C9A227", "#8E9099", "#B4703A"];

  const topEarn = Math.max(1, ...ranked.map((r) => r.earned));

  return (
    <div className="page-in max-w-[820px]">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Xếp theo số buổi đã nhận và thu nhập từ studio — tính trên toàn bộ hợp đồng.
      </p>

      {ranked.length === 0 ? (
        <Panel>
          <EmptyState icon={Trophy} title="Chưa có dữ liệu xếp hạng" hint="Phân công nhân sự cho hợp đồng, bảng xếp hạng sẽ tự hiện." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map((r, i) => (
            <Panel key={r.key} className="flex items-center gap-3 px-4 py-3.5">
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-extrabold"
                style={i < 3
                  ? { background: `color-mix(in srgb, ${medal[i]} 18%, #fff)`, color: medal[i] }
                  : { background: "var(--sf2)", color: "var(--tx3)" }}
              >
                {i + 1}
              </span>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(r.name) }}>
                {initials(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{r.name}</p>
                <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {CREW_ROLE_LABEL[r.role] ?? r.role} · nhận {r.accepted}/{r.jobs} buổi
                </p>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-[3px]" style={{ background: "var(--bd2)" }}>
                  <div className="h-full rounded-[3px]" style={{ width: `${(r.earned / topEarn) * 100}%`, background: "var(--ac)" }} />
                </div>
              </div>
              <p className="tnum flex-none text-[15px] font-bold">{vnd(r.earned)}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
