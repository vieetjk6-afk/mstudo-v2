import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { StudioService, StudioCrew } from "@/lib/types";
import NewContractForm, {
  type TemplateOption,
  type ServiceOption,
  type PackageOption,
  type RecentClient,
} from "./NewContractForm";


const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export default async function NewContractPage() {
  const profile = await requireStudio("plus");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này chỉ dành cho tài khoản gói Studio.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  const supabase = createClient();
  const [{ data: templates }, { data: services }, { data: packages }, { data: roster }, { data: past }] =
    await Promise.all([
      supabase
        .from("contract_templates")
        .select("id, name, shoot_type, note, contract_template_items(name, qty, unit_price, position)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("studio_services")
        .select("id, name, clauses")
        .eq("owner_id", profile.id)
        .eq("active", true)
        .order("position", { ascending: true }),
      // Gói dịch vụ trong bảng giá (studio_pricelist, price > 0) — nguồn của
      // bước "Khách chụp gói nào?".
      supabase
        .from("studio_pricelist")
        .select("id, list_key, name, price, unit, category, description")
        .eq("owner_id", profile.id)
        .eq("active", true)
        .gt("price", 0)
        .order("list_key", { ascending: true })
        .order("position", { ascending: true }),
      // Sổ thợ — bước "Chụp khi nào, ai đi?" phân công thẳng từ đây.
      supabase.from("studio_crew").select("id, name, phone, role").eq("owner_id", profile.id).order("name"),
      // Khách gần đây: gộp từ hợp đồng cũ để bước 1 khỏi phải gõ lại tên/SĐT.
      supabase
        .from("studio_contracts")
        .select("client_name, client_phone, event_date, created_at, status")
        .eq("owner_id", profile.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  // Gộp hợp đồng cũ theo SĐT (không có SĐT thì theo tên) → danh sách khách gần
  // đây, mới nhất trước. Chỉ giữ 8 người cho vừa một màn.
  const byClient = new Map<string, RecentClient>();
  for (const r of (past ?? []) as { client_name: string | null; client_phone: string | null; event_date: string | null; created_at: string }[]) {
    const key = digits(r.client_phone) || (r.client_name || "").trim().toLowerCase();
    if (!key) continue;
    const cur = byClient.get(key);
    if (cur) {
      cur.count += 1;
      if (r.event_date && (!cur.last || r.event_date > cur.last)) cur.last = r.event_date;
      continue;
    }
    byClient.set(key, {
      name: r.client_name || r.client_phone || "—",
      phone: r.client_phone || "",
      last: r.event_date,
      count: 1,
    });
  }

  const assignTo = profile.actingRole === "staff" ? (profile.actingUserId as string) : null;
  return (
    <NewContractForm
      ownerId={profile.id}
      assignTo={assignTo}
      templates={(templates ?? []) as unknown as TemplateOption[]}
      services={((services ?? []) as Pick<StudioService, "id" | "name" | "clauses">[]) as ServiceOption[]}
      packages={(packages ?? []) as unknown as PackageOption[]}
      roster={(roster ?? []) as Pick<StudioCrew, "id" | "name" | "phone" | "role">[]}
      recentClients={Array.from(byClient.values()).slice(0, 8)}
      bank={{
        name: (profile.pl_bank_name as string | null) ?? null,
        account: (profile.pl_bank_account as string | null) ?? null,
        holder: (profile.pl_bank_holder as string | null) ?? null,
      }}
      // Nhãn studio tự đặt cho bảng giá; thiếu nó thì tiêu đề nhóm gói rơi về
      // `list_key` thô (slug hoặc UUID của dịch vụ).
      listLabels={((profile as { pl_list_labels?: Record<string, string> | null }).pl_list_labels ?? {}) as Record<string, string>}
    />
  );
}
