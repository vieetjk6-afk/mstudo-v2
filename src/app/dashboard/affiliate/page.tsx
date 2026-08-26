"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import { Copy, Check, Share2, TrendingUp, Clock, Wallet, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { PLAN_LABEL, formatVnd, type Plan } from "@/lib/plans";
import { mainUrl } from "@/lib/hosts";

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
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--gold)",
  paid: "var(--success)",
  cancelled: "var(--text3)",
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

  return (
    <div className="page-in">
      <div className="mb-8">
        <p className="eyebrow mb-1.5">Tiếp thị liên kết</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-medium leading-none">Affiliate</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text2)" }}>
          Chia sẻ link của bạn — mỗi khi người được giới thiệu mua gói, bạn nhận hoa hồng tương ứng.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {[
          { label: "Tổng hoa hồng", value: totalEarned, icon: TrendingUp, color: "#3fb98a" },
          { label: "Đã nhận", value: totalPaid, icon: Wallet, color: "var(--success)" },
          { label: "Chờ thanh toán", value: totalPending, icon: Clock, color: "var(--gold)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="mb-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--text2)" }}>
              <Icon size={15} style={{ color }} />
              {label}
            </div>
            <p className="font-serif text-2xl font-medium">{formatVnd(value)}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="card mb-8 p-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
          <Gift size={18} style={{ color: "var(--brand, #3fb98a)" }} />
          Link giới thiệu của bạn
        </h2>
        <p className="mb-4 text-[13px]" style={{ color: "var(--text2)" }}>
          Chia sẻ link này. Khi người dùng mới mua gói thông qua link, bạn sẽ nhận hoa hồng tự động.
        </p>

        {loading ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono min-w-0"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            >
              <span className="truncate" style={{ color: "var(--text2)" }}>{refLink || "Đang tạo link…"}</span>
            </div>
            <button onClick={copyLink} className="btn-ghost flex-shrink-0 gap-1.5 px-3 py-2.5 text-sm">
              {copied ? <Check size={15} style={{ color: "var(--success)" }} /> : <Copy size={15} />}
              {copied ? "Đã sao chép" : "Sao chép"}
            </button>
            <button onClick={shareLink} className="btn-primary flex-shrink-0 gap-1.5 px-3 py-2.5 text-sm">
              <Share2 size={15} />
              Chia sẻ
            </button>
          </div>
        )}

        {code && (
          <p className="mt-3 text-[12px]" style={{ color: "var(--text3)" }}>
            Mã của bạn: <span className="font-mono font-bold">{code}</span>
          </p>
        )}
      </div>

      {/* Commission history */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-medium">Lịch sử hoa hồng</h2>
          <span className="text-[13px]" style={{ color: "var(--text3)" }}>{commissions.length} lần</span>
        </div>

        {commissions.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--text3)" }}>
            Chưa có hoa hồng nào. Hãy chia sẻ link của bạn!
          </div>
        ) : (
          <>
            {/* Cuộn ngang riêng cho bảng — main của shell đã clip trục ngang nên
                bảng 6 cột phải tự cuộn, không thì bị cắt mất cột trên mobile. */}
            <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Người dùng</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Gói</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--text2)" }}>Doanh thu</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--text2)" }}>Hoa hồng</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: "var(--text2)" }}>Trạng thái</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)" }}>Ngày</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3" style={{ color: "var(--text2)" }}>
                      {c.referred_email ? (
                        <span className="font-mono text-[12px]">
                          {c.referred_email.replace(/(.{2}).+(@.+)/, "$1***$2")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text3)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {PLAN_LABEL[c.plan as Plan] ?? c.plan}
                      <span className="ml-1 text-[11px]" style={{ color: "var(--text3)" }}>
                        /{c.cycle === "year" ? "năm" : "tháng"}
                      </span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {commissions.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-[13px]"
                style={{ borderColor: "var(--border)", color: "var(--text2)" }}
              >
                {showAll ? <><ChevronUp size={14} /> Thu gọn</> : <><ChevronDown size={14} /> Xem thêm {commissions.length - 5} dòng</>}
              </button>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[12.5px]" style={{ color: "var(--text3)" }}>
        Hoa hồng được ghi nhận khi quản trị viên xác nhận giao dịch và sẽ được thanh toán thủ công.
      </p>
    </div>
  );
}
