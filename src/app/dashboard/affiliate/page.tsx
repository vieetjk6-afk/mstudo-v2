"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Share2, TrendingUp, Wallet, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { PLAN_LABEL, formatVnd, type Plan } from "@/lib/plans";
import { mainUrl } from "@/lib/hosts";
import { Panel, PanelHead, Pill, EmptyState } from "@/components/studio/ui";

interface Commission {
  id: string;
  referred_email: string | null;
  plan: string;
  cycle: string;
  sale_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã nhận",
  cancelled: "Đã huỷ",
};
export default function AffiliatePage() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const [codeRes, statsRes] = await Promise.all([
        fetch("/api/affiliate/code").then((r) => r.json()).catch(() => null),
        fetch("/api/affiliate/stats").then((r) => r.json()).catch(() => null),
      ]);
      if (codeRes?.code) setCode(codeRes.code);
      if (statsRes) {
        setCommissions(statsRes.commissions ?? []);
        setTotalEarned(statsRes.totalEarned ?? 0);
        setTotalPaid(statsRes.totalPaid ?? 0);
        setTotalPending(statsRes.totalPending ?? 0);
      }
      setLoading(false);
    })();
  }, []);

  const refLink = code ? `${mainUrl("/")}?ref=${code}` : "";

  function copyLink() {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareLink() {
    if (!refLink) return;
    if (navigator.share) {
      navigator.share({ title: "Giới thiệu mstudo", url: refLink });
    } else {
      copyLink();
    }
  }

  const visible = showAll ? commissions : commissions.slice(0, 5);

  const kpis: { l: string; v: string; c: string }[] = [
    { l: "Tổng hoa hồng", v: formatVnd(totalEarned), c: "var(--tx)" },
    { l: "Đã nhận", v: formatVnd(totalPaid), c: "var(--gn)" },
    { l: "Chờ thanh toán", v: formatVnd(totalPending), c: "var(--am)" },
    { l: "Lượt giới thiệu", v: String(commissions.length), c: "var(--ac)" },
  ];

  return (
    <div className="page-in flex max-w-[940px] flex-col gap-3.5">
      {/* KPI — 4 ô, số 21px/750 tabular, màu theo ý nghĩa. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {kpis.map((k) => (
          <Panel key={k.l} className="px-4 py-3.5">
            <p className="tnum text-[21px] font-bold" style={{ letterSpacing: "-.6px", color: k.c }}>{k.v}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{k.l}</p>
          </Panel>
        ))}
      </div>

      {/* Link giới thiệu — một hàng: icon, link mono, điều khoản hoa hồng, nút chép. */}
      <Panel className="flex flex-wrap items-center gap-3 px-[18px] py-4">
        <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>Link giới thiệu của bạn</p>
          {loading ? (
            <div className="mt-1.5 h-[19px] w-64 max-w-full animate-pulse rounded" style={{ background: "var(--sf2)" }} />
          ) : (
            <p className="mt-0.5 truncate font-mono text-[15px] font-bold">{refLink || "Đang tạo link…"}</p>
          )}
          {code && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--tx3)" }}>
              Mã của bạn: <span className="font-mono font-bold">{code}</span>
            </p>
          )}
        </div>
        <p className="hidden flex-none text-right text-[12px] leading-[1.5] lg:block" style={{ color: "var(--tx3)" }}>
          Hoa hồng ghi nhận khi quản trị viên<br />xác nhận giao dịch
        </p>
        <div className="flex flex-none items-center gap-2">
          <button
            onClick={copyLink}
            disabled={!refLink}
            className="flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            style={{ border: "1px solid var(--bd)", color: copied ? "var(--gn)" : "var(--tx)" }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Đã chép" : "Sao chép"}
          </button>
          <button
            onClick={shareLink}
            disabled={!refLink}
            className="flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Share2 size={15} /> Chia sẻ
          </button>
        </div>
      </Panel>

      {/* Lịch sử hoa hồng — danh sách dòng, không phải bảng 6 cột. */}
      <Panel>
        <PanelHead icon={TrendingUp} tone="green" title="Lịch sử hoa hồng" count={`${commissions.length} lần`} />

        {commissions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Chưa có hoa hồng nào"
            hint="Chia sẻ link giới thiệu ở trên — mỗi lượt mua gói qua link đều được ghi nhận tại đây."
          />
        ) : (
          <>
            {visible.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-[18px] py-[13px]"
                style={{ borderTop: "1px solid var(--bd2)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">
                    {c.referred_email ? c.referred_email.replace(/(.{2}).+(@.+)/, "$1***$2") : "Người dùng ẩn danh"}
                  </p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {new Date(c.created_at).toLocaleDateString("vi-VN")} · {PLAN_LABEL[c.plan as Plan] ?? c.plan}/{c.cycle === "year" ? "năm" : "tháng"} · doanh thu {formatVnd(c.sale_amount)}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <p className="tnum text-[14px] font-bold" style={{ color: "var(--gn)" }}>{formatVnd(c.commission_amount)}</p>
                  <p className="text-[11px]" style={{ color: "var(--tx3)" }}>hoa hồng {c.commission_pct}%</p>
                </div>
                <Pill tone={c.status === "paid" ? "green" : c.status === "pending" ? "amber" : "gray"}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </Pill>
              </div>
            ))}

            {commissions.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 py-3 text-[12.5px] font-semibold"
                style={{ borderTop: "1px solid var(--bd2)", color: "var(--ac)" }}
              >
                {showAll ? <><ChevronUp size={14} /> Thu gọn</> : <><ChevronDown size={14} /> Xem thêm {commissions.length - 5} dòng</>}
              </button>
            )}
          </>
        )}
      </Panel>

      <p className="text-center text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
        Hoa hồng được ghi nhận khi quản trị viên xác nhận giao dịch và thanh toán thủ công.
      </p>
    </div>
  );
}
