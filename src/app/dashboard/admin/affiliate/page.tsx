"use client";

import { fmtDate } from "@/lib/date";
import { Check, X, Clock, Save, TrendingUp } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { PLAN_LABEL, formatVnd, type Plan } from "@/lib/plans";
import AdminAffiliateV2 from "./AdminAffiliateV2";
import { useAdminAffiliate } from "./useAdminAffiliate";

const STATUS_LABEL: Record<string, string> = { pending: "Chờ", paid: "Đã trả", cancelled: "Huỷ" };
const STATUS_COLOR: Record<string, string> = { pending: "var(--gold)", paid: "var(--success)", cancelled: "var(--text3)" };

/** Quản lý Affiliate: giao diện mới (AdminAffiliateV2) hay bản cũ — xem UiV2Context. */
export default function AdminAffiliatePage() {
  return useUiV2() ? <AdminAffiliateV2 /> : <AdminAffiliateV1 />;
}

function AdminAffiliateV1() {
  // Logic dùng chung với bản mới — xem ./useAdminAffiliate.
  const { commissions, loading, rates, setRates, saving, saved, updateStatus, saveRates, totalPending, totalPaid } = useAdminAffiliate();

  return (
    <div className="page-in">
      <div className="mb-8">
        <p className="eyebrow mb-1.5">Quản trị</p>
        <h1 className="font-serif text-[clamp(24px,3vw,36px)] font-medium leading-none">Quản lý Affiliate</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="card p-5">
          <p className="mb-1 text-[13px]" style={{ color: "var(--text2)" }}>Tổng đã trả</p>
          <p className="font-serif text-2xl font-medium" style={{ color: "var(--success)" }}>{formatVnd(totalPaid)}</p>
        </div>
        <div className="card p-5">
          <p className="mb-1 text-[13px]" style={{ color: "var(--text2)" }}>Chờ thanh toán</p>
          <p className="font-serif text-2xl font-medium" style={{ color: "var(--gold)" }}>{formatVnd(totalPending)}</p>
        </div>
        <div className="card p-5">
          <p className="mb-1 text-[13px]" style={{ color: "var(--text2)" }}>Tổng giao dịch</p>
          <p className="font-serif text-2xl font-medium">{commissions.length}</p>
        </div>
      </div>

      {/* Commission rates */}
      <div className="card mb-8 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <TrendingUp size={16} style={{ color: "var(--gold, #3fb98a)" }} />
          Tỉ lệ hoa hồng
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["basic", "photographer", "photographer_plus", "studio"] as const).map((plan) => (
            <div key={plan}>
              <label className="mb-1.5 block text-[13px]" style={{ color: "var(--text2)" }}>
                Gói {PLAN_LABEL[plan]} (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={rates[plan]}
                onChange={(e) => setRates((r) => ({ ...r, [plan]: Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
          ))}
        </div>
        <button onClick={saveRates} disabled={saving} className="btn-primary mt-4 gap-1.5">
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Đã lưu" : saving ? "Đang lưu…" : "Lưu tỉ lệ"}
        </button>
      </div>

      {/* Commission table */}
      <div className="card overflow-hidden p-0">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-medium">Lịch sử hoa hồng</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text3)" }}>Đang tải…</div>
        ) : commissions.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text3)" }}>Chưa có hoa hồng nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Affiliate</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Khách được giới thiệu</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Gói</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--text2)" }}>Doanh thu</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--text2)" }}>Hoa hồng</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: "var(--text2)" }}>Trạng thái</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Ngày</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: "var(--text2)" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{c.referrer?.full_name || "—"}</p>
                      <p className="text-[11px]" style={{ color: "var(--text3)" }}>{c.referrer?.email}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text2)" }}>
                      <span className="font-mono text-[12px]">
                        {c.referred_email ? c.referred_email.replace(/(.{2}).+(@.+)/, "$1***$2") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {PLAN_LABEL[c.plan as Plan] ?? c.plan}
                      <span className="ml-1 text-[11px]" style={{ color: "var(--text3)" }}>/{c.cycle === "year" ? "năm" : "tháng"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatVnd(c.sale_amount)}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: "#3fb98a" }}>
                      {formatVnd(c.commission_amount)}
                      <span className="ml-1 text-[11px]" style={{ color: "var(--text3)" }}>({c.commission_pct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `color-mix(in srgb, ${STATUS_COLOR[c.status]} 14%, transparent)`, color: STATUS_COLOR[c.status] }}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text3)" }}>
                      {fmtDate(c.created_at)}
                      {c.paid_at && <p className="text-[11px]">Trả: {fmtDate(c.paid_at)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        {c.status !== "paid" && (
                          <button
                            onClick={() => updateStatus(c.id, "paid")}
                            title="Đánh dấu đã trả"
                            aria-label="Đánh dấu đã trả"
                            className="rounded-lg p-1.5 transition-colors hover:bg-green-900/30"
                            style={{ color: "var(--success)" }}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {c.status !== "cancelled" && c.status !== "paid" && (
                          <button
                            onClick={() => updateStatus(c.id, "cancelled")}
                            title="Huỷ"
                            aria-label="Huỷ hoa hồng"
                            className="rounded-lg p-1.5 transition-colors hover:bg-red-900/30"
                            style={{ color: "var(--danger)" }}
                          >
                            <X size={14} />
                          </button>
                        )}
                        {c.status === "paid" && (
                          <button
                            onClick={() => updateStatus(c.id, "pending")}
                            title="Hoàn lại chờ"
                            aria-label="Hoàn lại trạng thái chờ"
                            className="rounded-lg p-1.5 transition-colors hover:bg-amber-900/30"
                            style={{ color: "var(--gold)" }}
                          >
                            <Clock size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
