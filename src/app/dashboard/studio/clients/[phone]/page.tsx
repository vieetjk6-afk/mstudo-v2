import Link from "next/link";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { avatarColor, initials } from "@/lib/avatar";
import { Panel, EmptyState } from "@/components/studio/ui";
import { FileText } from "lucide-react";
import {
  contractTotal,
  sumAmounts,
  vnd,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
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
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Cần gói Photographer trở lên</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Hồ sơ khách gộp lịch sử hợp đồng theo số điện thoại — có ở gói Photographer trở lên.
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

  const debt = Math.max(0, totalValue - collected);
  const lastDate = mine.find((r) => r.event_date)?.event_date || "—";

  return (
    /* Bản thiết kế: cột trái 320px là hồ sơ khách, cột phải là lịch sử hợp đồng. */
    <div className="page-in grid items-start gap-3.5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel className="p-5">
        <Link href="/dashboard/studio/clients" className="mb-3.5 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
          <ArrowLeft size={16} /> Danh bạ
        </Link>

        <div className="flex flex-col items-center text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-[21px] font-bold text-white"
            style={{ background: avatarColor(name) }}
          >
            {initials(name)}
          </span>
          <p className="mt-[11px] text-[17px] font-bold" style={{ letterSpacing: "-.3px" }}>{name}</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {phone || "Chưa có số"}{source ? ` · ${LEAD_SOURCE_LABEL[source] || source}` : ""}
          </p>
          {email ? <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{email}</p> : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={phone ? `tel:${phone}` : undefined}
            aria-disabled={!phone}
            className="flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-semibold"
            style={{ background: "var(--acS)", color: "var(--ac)", opacity: phone ? 1 : 0.5, pointerEvents: phone ? "auto" : "none" }}
          >
            <Phone size={16} /> Gọi
          </a>
          <a
            href={email ? `mailto:${email}` : undefined}
            aria-disabled={!email}
            className="flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-semibold"
            style={{ background: "var(--sf2)", color: "var(--tx2)", opacity: email ? 1 : 0.5, pointerEvents: email ? "auto" : "none" }}
          >
            <Mail size={16} /> Email
          </a>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
          {([
            ["Số hợp đồng", String(mine.length), undefined],
            ["Tổng giá trị", vnd(totalValue), undefined],
            ["Đã thu", vnd(collected), "var(--gn)"],
            ["Còn nợ", vnd(debt), debt > 0 ? "var(--am)" : undefined],
            ["Lần gần nhất", lastDate, undefined],
          ] as [string, string, string | undefined][]).map(([l, v, color]) => (
            <div key={l} className="flex justify-between gap-3 text-[12.5px]">
              <span style={{ color: "var(--tx2)" }}>{l}</span>
              <strong className="tnum" style={color ? { color } : undefined}>{v}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <p className="px-[18px] py-3.5 text-[14px] font-bold" style={{ borderBottom: "1px solid var(--bd2)" }}>
          Lịch sử hợp đồng
        </p>
        {mine.length === 0 ? (
          <EmptyState icon={FileText} title="Chưa có hợp đồng nào" hint="Khách này chưa gắn với hợp đồng nào — tạo hợp đồng mới rồi điền đúng số điện thoại là tự gộp về đây." />
        ) : (
          mine.map((r) => {
            const st = CONTRACT_STATUS_TONE[r.status];
            return (
              <Link
                key={r.id}
                href={`/dashboard/studio/contracts/${r.id}`}
                className="flex items-center gap-3.5 px-[18px] py-[13px]"
                style={{ borderTop: "1px solid var(--bd2)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{r.title}</p>
                  <p className="tnum mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{r.event_date || "Chưa có ngày"}</p>
                </div>
                <span className="tnum flex-none text-[13.5px] font-bold">{vnd(contractTotal(r.contract_items || []))}</span>
                <span
                  className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-[4px] text-[11.5px] font-semibold"
                  style={{ background: st.bg, color: st.fg }}
                >
                  {CONTRACT_STATUS_LABEL[r.status]}
                </span>
              </Link>
            );
          })
        )}
      </Panel>
    </div>
  );
}
