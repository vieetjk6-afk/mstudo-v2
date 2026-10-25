"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Percent, Receipt, RotateCcw, Save, Search, TrendingUp, Wallet, X } from "lucide-react";
import { Badge, Empty, Field, PageHead, Section, Stack, Stat, StatGrid, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { PLAN_LABEL, formatVnd, type Plan } from "@/lib/plans";
import { RATE_PLANS, useAdminAffiliate, type AdminAffiliateSeed, type AdminCommission } from "./useAdminAffiliate";

/* ═══════════════════════════════════════════════════════════════════════════
   QUẢN LÝ AFFILIATE (admin) — giao diện mới. Cùng logic với bản cũ
   (./useAdminAffiliate); khác ở cách sắp xếp:
     • Ba số liệu: đã trả · chờ thanh toán · tổng giao dịch.
     • Khối tỉ lệ hoa hồng gọn một hàng, nút lưu ở đầu khối.
     • Bảng hoa hồng có tìm + lọc trạng thái; mỗi dòng chờ trả có đúng một
       nút "Đã trả", việc khác (huỷ, hoàn lại chờ) ở menu ⋯.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_LABEL: Record<AdminCommission["status"], string> = { pending: "Chờ trả", paid: "Đã trả", cancelled: "Đã huỷ" };
const STATUS_TONE: Record<AdminCommission["status"], Tone> = { pending: "amber", paid: "green", cancelled: "gray" };
type Filter = "all" | AdminCommission["status"];

const mask = (e: string | null) => (e ? e.replace(/(.{2}).+(@.+)/, "$1***$2") : "—");

export default function AdminAffiliateV2({ seed }: { seed?: AdminAffiliateSeed }) {
  const a = useAdminAffiliate(seed);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const count = (st: AdminCommission["status"]) => a.commissions.filter((c) => c.status === st).length;

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return a.commissions.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!n) return true;
      return `${c.referrer?.full_name ?? ""} ${c.referrer?.email ?? ""} ${c.referred_email ?? ""}`.toLowerCase().includes(n);
    });
  }, [a.commissions, filter, q]);

  const menuItems = (c: AdminCommission): MenuItem[] => [
    ...(c.status === "cancelled" ? [{ label: "Đánh dấu đã trả", icon: Check, onClick: () => void a.updateStatus(c.id, "paid") }] : []),
    ...(c.status === "pending" ? [{ label: "Huỷ hoa hồng", icon: X, danger: true, onClick: () => void a.updateStatus(c.id, "cancelled") }] : []),
    ...(c.status === "paid" ? [{ label: "Hoàn lại trạng thái chờ", icon: RotateCcw, onClick: () => void a.updateStatus(c.id, "pending") }] : []),
  ];
  const actions = (c: AdminCommission) => (
    <div className="flex items-center justify-end gap-1.5">
      {c.status === "pending" ? (
        <button type="button" onClick={() => void a.updateStatus(c.id, "paid")} className={btn("primary", "sm")}>
          <Check size={15} /> Đã trả
        </button>
      ) : null}
      <Menu label="Thao tác với khoản hoa hồng" items={menuItems(c)} />
    </div>
  );

  return (
    <Stack>
      <PageHead desc="Hoa hồng của người giới thiệu và tỉ lệ theo từng gói. Chuyển tiền xong thì bấm “Đã trả”." />

      <StatGrid cols={3}>
        <Stat label="Tổng đã trả" value={formatVnd(a.totalPaid)} icon={Wallet} tone="green" valueTone="green" sub={`${count("paid")} khoản`} />
        <Stat label="Chờ thanh toán" value={formatVnd(a.totalPending)} icon={Clock} tone="amber" valueTone={a.totalPending > 0 ? "amber" : undefined} sub={`${count("pending")} khoản cần trả`} />
        <Stat label="Tổng giao dịch" value={a.commissions.length} icon={Receipt} tone="blue" sub={`${count("cancelled")} đã huỷ`} />
      </StatGrid>

      <Section
        icon={Percent}
        title="Tỉ lệ hoa hồng"
        desc="Phần trăm trên số tiền khách trả, áp cho giao dịch mới."
      >
        <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          {RATE_PLANS.map((plan) => (
            <Field key={plan} label={`Gói ${PLAN_LABEL[plan]}`}>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={a.rates[plan]}
                  onChange={(e) => a.setRates((r) => ({ ...r, [plan]: Number(e.target.value) }))}
                  className={inputCls}
                  style={{ paddingRight: 34 }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--tx3)" }}>%</span>
              </div>
            </Field>
          ))}
          <button type="button" onClick={() => void a.saveRates()} disabled={a.saving} className={btn("secondary", "md", "col-span-2 lg:col-span-1")}>
            {a.saved ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Save size={16} />}
            {a.saved ? "Đã lưu" : a.saving ? "Đang lưu…" : "Lưu tỉ lệ"}
          </button>
        </div>
      </Section>

      <section className="v2-card overflow-hidden">
        <header className="v2-section-head">
          <span className="v2-section-icon"><TrendingUp size={17} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="v2-section-title">Lịch sử hoa hồng</h3>
            <p className="v2-section-desc">Mỗi lần một người được giới thiệu mua gói.</p>
          </div>
        </header>
        {a.commissions.length > 0 ? (
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tên, email người giới thiệu…" className="w-full" />
              </div>
              <Segmented<Filter>
                label="Lọc theo trạng thái"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Tất cả", count: a.commissions.length },
                  { value: "pending", label: "Chờ trả", count: count("pending") },
                  { value: "paid", label: "Đã trả", count: count("paid") },
                  { value: "cancelled", label: "Huỷ", count: count("cancelled") },
                ]}
              />
            </Toolbar>
          </div>
        ) : null}

        {a.loading ? (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-[10px]" />)}
          </div>
        ) : a.commissions.length === 0 ? (
          <Empty icon={TrendingUp} title="Chưa có hoa hồng nào" hint="Khi người được giới thiệu mua gói, khoản hoa hồng hiện ở đây." />
        ) : shown.length === 0 ? (
          <Empty compact icon={Search} title="Không có khoản nào khớp bộ lọc" />
        ) : (
          <>
            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Người giới thiệu</th>
                    <th>Gói · khách được giới thiệu</th>
                    <th className="num">Doanh thu</th>
                    <th className="num">Hoa hồng</th>
                    <th>Trạng thái</th>
                    <th>Ngày</th>
                    <th style={{ width: 140 }} aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} style={c.status === "cancelled" ? { opacity: 0.65 } : undefined}>
                      <td style={{ maxWidth: 240 }}>
                        <p className="truncate font-semibold">{c.referrer?.full_name || c.referrer?.email || "—"}</p>
                        {c.referrer?.full_name ? <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{c.referrer?.email}</p> : null}
                      </td>
                      <td>
                        <p className="whitespace-nowrap">
                          {PLAN_LABEL[c.plan as Plan] ?? c.plan}
                          <span className="text-[12px]" style={{ color: "var(--tx3)" }}> /{c.cycle === "year" ? "năm" : "tháng"}</span>
                        </p>
                        <p className="font-mono text-[12px]" style={{ color: "var(--tx3)" }}>{mask(c.referred_email)}</p>
                      </td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{formatVnd(c.sale_amount)}</td>
                      <td className="num">
                        <span className="font-semibold">{formatVnd(c.commission_amount)}</span>
                        <span className="text-[12px]" style={{ color: "var(--tx3)" }}> ({c.commission_pct}%)</span>
                      </td>
                      <td><Badge tone={STATUS_TONE[c.status]} dot>{STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                      <td className="whitespace-nowrap">
                        <span className="block text-[13px]" style={{ color: "var(--tx2)" }}>{fmtDate(c.created_at)}</span>
                        {c.paid_at ? <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>Trả {fmtDate(c.paid_at)}</span> : null}
                      </td>
                      <td>{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden">
              {shown.map((c) => (
                <div key={c.id} className="v2-row !items-start" style={c.status === "cancelled" ? { opacity: 0.65 } : undefined}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="v2-row-title">{c.referrer?.full_name || c.referrer?.email || "—"}</p>
                        <p className="v2-row-sub">
                          {PLAN_LABEL[c.plan as Plan] ?? c.plan}/{c.cycle === "year" ? "năm" : "tháng"} · {mask(c.referred_email)} · {fmtDate(c.created_at)}
                        </p>
                      </div>
                      <span className="v2-num flex-none text-[14px] font-semibold">{formatVnd(c.commission_amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[c.status]} dot>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                      <span className="ml-auto">{actions(c)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </Stack>
  );
}
