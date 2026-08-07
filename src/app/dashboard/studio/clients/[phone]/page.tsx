import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import {
  contractTotal,
  sumAmounts,
  vnd,
  CONTRACT_STATUS_LABEL,
  LEAD_SOURCE_LABEL,
  type ContractStatus,
} from "@/lib/types";


const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

type Row = {
  id: string;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  event_date: string | null;
  status: ContractStatus;
  source: string | null;
  contract_items: { qty: number; unit_price: number }[];
  contract_payments: { amount: number }[];
};

export default async function ClientDetail({ params }: { params: { phone: string } }) {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const key = decodeURIComponent(params.phone);
  const supabase = createClient();
  const { data } = await supabase
    .from("studio_contracts")
    .select("id, title, client_name, client_phone, client_email, event_date, status, source, contract_items(qty, unit_price), contract_payments(amount)")
    .eq("owner_id", profile.id)
    .order("event_date", { ascending: false, nullsFirst: false });

  const all = (data ?? []) as unknown as Row[];
  const mine = all.filter((r) => (digits(r.client_phone) || (r.client_name || "").trim().toLowerCase()) === key);

  const name = mine.find((r) => r.client_name)?.client_name || mine[0]?.client_phone || "Khách hàng";
  const phone = mine.find((r) => r.client_phone)?.client_phone || "";
  const email = mine.find((r) => r.client_email)?.client_email || "";
  const source = mine.find((r) => r.source)?.source || null;
  const totalValue = mine.reduce((s, r) => s + contractTotal(r.contract_items || []), 0);
  const collected = mine.reduce((s, r) => s + sumAmounts(r.contract_payments || []), 0);

  return (
    <div className="page-in">
      <Link href="/dashboard/studio/clients" className="mb-5 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--text3)" }}>
        <ArrowLeft size={15} /> Khách hàng
      </Link>
      <h1 className="font-serif text-3xl font-medium">{name}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
        {phone || "—"}{email ? ` · ${email}` : ""}{source ? ` · ${LEAD_SOURCE_LABEL[source] || source}` : ""}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="card p-5"><p className="text-xs" style={{ color: "var(--text3)" }}>Hợp đồng</p><p className="mt-1 font-serif text-xl font-medium">{mine.length}</p></div>
        <div className="card p-5"><p className="text-xs" style={{ color: "var(--text3)" }}>Tổng giá trị</p><p className="mt-1 font-serif text-xl font-medium">{vnd(totalValue)}</p></div>
        <div className="card p-5"><p className="text-xs" style={{ color: "var(--text3)" }}>Đã thu</p><p className="mt-1 font-serif text-xl font-medium" style={{ color: "var(--s-green)" }}>{vnd(collected)}</p></div>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-lg font-medium">Lịch sử hợp đồng</h2>
      <div className="space-y-2">
        {mine.map((r) => (
          <Link key={r.id} href={`/dashboard/studio/contracts/${r.id}`} className="card flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface2)]">
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="text-xs" style={{ color: "var(--text3)" }}>{r.event_date || "—"} · {CONTRACT_STATUS_LABEL[r.status]}</p>
            </div>
            <span className="font-serif font-medium">{vnd(contractTotal(r.contract_items || []))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
