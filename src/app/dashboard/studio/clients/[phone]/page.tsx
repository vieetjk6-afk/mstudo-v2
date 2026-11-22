import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireStudio } from "@/lib/auth-guards";
import {
  contractTotal,
  sumAmounts,
  vnd,
  CONTRACT_STATUS_LABEL,
  type ContractStatus,
} from "@/lib/types";
import { LEAD_SOURCE_LABEL } from "@/lib/lead-source";
import { isUiV2 } from "@/lib/ui-server";
import ClientDetailV2 from "./ClientDetailV2";
import { clientKey } from "@/lib/client-key";
import { applyBranch, getBranchScope } from "@/lib/branches";
import StudioDenied from "@/components/StudioDenied";


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

export default async function ClientDetail(props: { params: Promise<{ phone: string }> }) {
  const params = await props.params;
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

  // Cùng các chốt của danh bạ: kế toán không xem khách; nhân viên chỉ thấy HĐ
  // được giao; lọc theo chi nhánh đang chọn. Trước đây gõ thẳng URL hồ sơ là
  // thấy mọi hợp đồng + doanh thu của khách ở mọi chi nhánh.
  if (profile.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  const branchSel = (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected;
  // URL cũ có thể mang "84901…" hay "+84901…" → chuẩn hoá giống danh bạ.
  const rawKey = decodeURIComponent(params.phone);
  const key = /\d{9}/.test(rawKey) ? clientKey(rawKey, null) : rawKey;
  const supabase = await createClient();
  // Lật trang — không thì studio quá 1000 HĐ mở hồ sơ khách cũ ra trống trơn.
  const all = await fetchAllRows<Row>((from, to) => {
    let cq = supabase
      .from("studio_contracts")
      .select("id, title, client_name, client_phone, client_email, event_date, status, source, branch_id, contract_items(qty, unit_price), contract_payments(amount)")
      .eq("owner_id", profile.id);
    if (profile.actingRole === "staff") cq = cq.eq("assigned_to", profile.actingUserId);
    return applyBranch(cq, branchSel)
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, to);
  });
  const mine = all.filter((r) => clientKey(r.client_phone, r.client_name) === key);

  const name = mine.find((r) => r.client_name)?.client_name || mine[0]?.client_phone || "Khách hàng";
  const phone = mine.find((r) => r.client_phone)?.client_phone || "";
  const email = mine.find((r) => r.client_email)?.client_email || "";
  const source = mine.find((r) => r.source)?.source || null;
  const live = mine.filter((r) => r.status !== "cancelled");
  const totalValue = live.reduce((s, r) => s + contractTotal(r.contract_items || []), 0);
  const collected = live.reduce((s, r) => s + sumAmounts(r.contract_payments || []), 0);

  if (await isUiV2()) {
    return (
      <ClientDetailV2
        name={name}
        phone={phone}
        email={email}
        sourceLabel={source ? LEAD_SOURCE_LABEL[source] || source : null}
        rows={mine.map((r) => ({
          id: r.id,
          title: r.title,
          event_date: r.event_date,
          status: r.status,
          value: contractTotal(r.contract_items || []),
          collected: sumAmounts(r.contract_payments || []),
        }))}
      />
    );
  }

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
