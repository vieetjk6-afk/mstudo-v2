"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Copy, Gift, Link2, Share2, TrendingUp, Wallet } from "lucide-react";
import { Badge, Card, Empty, PageHead, Stack, Stat, StatGrid, btn, type Tone } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { PLAN_LABEL, formatVnd, type Plan } from "@/lib/plans";
import { STATUS_LABEL, maskEmail, useAffiliate, type AffiliateSeed, type Commission } from "./useAffiliate";

/* ═══════════════════════════════════════════════════════════════════════════
   AFFILIATE — giao diện mới. Cùng logic với bản cũ (./useAffiliate); khác ở
   cách sắp xếp:
     • Ba số liệu: tổng hoa hồng · đã nhận · chờ thanh toán.
     • Thẻ link giới thiệu: link + Chép / Chia sẻ (nút chính), mã của bạn, và
       ba bước nhận hoa hồng ngay bên cạnh.
     • Bảng lịch sử hoa hồng có lọc trạng thái; điện thoại thành thẻ gọn.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<Commission["status"], Tone> = { pending: "amber", paid: "green", cancelled: "gray" };
type Filter = "all" | Commission["status"];

export default function AffiliateV2({ seed }: { seed?: AffiliateSeed }) {
  const a = useAffiliate(seed);
  const [filter, setFilter] = useState<Filter>("all");
  const count = (st: Commission["status"]) => a.commissions.filter((c) => c.status === st).length;
  const filtered = filter === "all" ? a.commissions : a.commissions.filter((c) => c.status === filter);
  const shown = a.showAll ? filtered : filtered.slice(0, 5);

  return (
    <Stack>
      <PageHead desc="Giới thiệu mstudo cho studio khác — mỗi khi họ mua gói qua link của bạn, bạn nhận hoa hồng." />

      <StatGrid cols={3}>
        <Stat label="Tổng hoa hồng" value={formatVnd(a.totalEarned)} icon={TrendingUp} tone="brand" sub={`${a.commissions.length} lần ghi nhận`} />
        <Stat label="Đã nhận" value={formatVnd(a.totalPaid)} icon={Wallet} tone="green" sub="Đã chuyển cho bạn" />
        <Stat label="Chờ thanh toán" value={formatVnd(a.totalPending)} icon={Clock} tone="amber" valueTone={a.totalPending > 0 ? "amber" : undefined} sub="Trả sau khi xác nhận giao dịch" />
      </StatGrid>

      <Card padded={false} className="grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="v2-card-pad flex min-w-0 flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="v2-section-icon"><Gift size={17} /></span>
            <div className="min-w-0">
              <h3 className="v2-section-title">Link giới thiệu của bạn</h3>
              <p className="v2-section-desc">Người dùng mới mua gói qua link này là bạn nhận hoa hồng tự động.</p>
            </div>
          </div>
          {a.loading ? (
            <div className="skeleton h-[42px] rounded-[12px]" />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] px-3.5 py-2.5"
                style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
              >
                <Link2 size={16} style={{ color: "var(--tx3)", flex: "none" }} />
                <span className="truncate font-mono text-[13.5px]" style={{ color: a.refLink ? "var(--tx)" : "var(--tx3)" }}>
                  {a.refLink || "Đang tạo link…"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button type="button" onClick={a.copyLink} disabled={!a.refLink} className={btn("secondary")}>
                  {a.copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />}
                  {a.copied ? "Đã chép" : "Chép link"}
                </button>
                <button type="button" onClick={a.shareLink} disabled={!a.refLink} className={btn("primary")}>
                  <Share2 size={16} /> Chia sẻ
                </button>
              </div>
            </div>
          )}
          {a.code ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Mã của bạn: <span className="rounded-[6px] px-1.5 py-0.5 font-mono font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>{a.code}</span>
            </p>
          ) : null}
        </div>
        <ol className="v2-card-pad flex flex-col gap-3 border-t lg:border-l lg:border-t-0" style={{ background: "var(--sf2)", borderColor: "var(--bd2)" }}>
          {[
            ["Gửi link", "Cho studio, nhiếp ảnh gia bạn quen."],
            ["Họ mua gói", "Bất kỳ gói trả phí nào, theo tháng hay năm."],
            ["Nhận hoa hồng", "Ghi nhận khi quản trị viên xác nhận giao dịch, trả thủ công."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--sf)", color: "var(--ac)", boxShadow: "inset 0 0 0 1px var(--bd)" }}>
                {i + 1}
              </span>
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold">{t}</p>
                <p style={{ color: "var(--tx3)" }}>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <section className="v2-card overflow-hidden">
        <header className="v2-section-head">
          <div className="min-w-0 flex-1">
            <h3 className="v2-section-title">Lịch sử hoa hồng</h3>
            <p className="v2-section-desc">{a.commissions.length} lần · mới nhất ở trên</p>
          </div>
        </header>
        {a.commissions.length > 0 ? (
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Segmented<Filter>
              label="Lọc theo trạng thái"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tất cả", count: a.commissions.length },
                { value: "pending", label: "Chờ", count: count("pending") },
                { value: "paid", label: "Đã nhận", count: count("paid") },
                { value: "cancelled", label: "Đã huỷ", count: count("cancelled") },
              ]}
            />
          </div>
        ) : null}

        {a.loading ? (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-[10px]" />)}
          </div>
        ) : a.commissions.length === 0 ? (
          <Empty icon={Gift} title="Chưa có hoa hồng nào" hint="Hãy chia sẻ link của bạn — lần đầu có người mua gói, hoa hồng hiện ở đây." />
        ) : filtered.length === 0 ? (
          <Empty compact icon={Gift} title="Không có dòng nào ở trạng thái này" />
        ) : (
          <>
            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Gói</th>
                    <th className="num">Doanh thu</th>
                    <th className="num">Hoa hồng</th>
                    <th>Trạng thái</th>
                    <th className="num">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.referred_email ? <span className="font-mono text-[12.5px]">{maskEmail(c.referred_email)}</span> : <span style={{ color: "var(--tx3)" }}>—</span>}
                      </td>
                      <td>
                        {PLAN_LABEL[c.plan as Plan] ?? c.plan}
                        <span className="text-[12px]" style={{ color: "var(--tx3)" }}> /{c.cycle === "year" ? "năm" : "tháng"}</span>
                      </td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{formatVnd(c.sale_amount)}</td>
                      <td className="num">
                        <span className="font-semibold">{formatVnd(c.commission_amount)}</span>
                        <span className="text-[12px]" style={{ color: "var(--tx3)" }}> ({c.commission_pct}%)</span>
                      </td>
                      <td><Badge tone={STATUS_TONE[c.status]} dot>{STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                      <td className="num" style={{ color: "var(--tx3)" }}>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden">
              {shown.map((c) => (
                <div key={c.id} className="v2-row">
                  <div className="min-w-0 flex-1">
                    <p className="v2-row-title">
                      {PLAN_LABEL[c.plan as Plan] ?? c.plan}
                      <span className="font-normal" style={{ color: "var(--tx3)" }}> /{c.cycle === "year" ? "năm" : "tháng"}</span>
                    </p>
                    <p className="v2-row-sub">
                      {c.referred_email ? maskEmail(c.referred_email) : "—"} · {fmtDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <span className="v2-num text-[14px] font-semibold">{formatVnd(c.commission_amount)}</span>
                    <Badge tone={STATUS_TONE[c.status]} dot>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            {filtered.length > 5 ? (
              <button
                type="button"
                onClick={() => a.setShowAll((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 py-3 text-[13px] font-semibold"
                style={{ borderTop: "1px solid var(--bd2)", color: "var(--ac)" }}
              >
                {a.showAll ? <><ChevronUp size={15} /> Thu gọn</> : <><ChevronDown size={15} /> Xem thêm {filtered.length - 5} dòng</>}
              </button>
            ) : null}
          </>
        )}
      </section>
    </Stack>
  );
}
