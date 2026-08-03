"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus, Eye, Pencil, ExternalLink, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarStyle, initials } from "@/lib/avatar";
import { vnd, vndShort, QUOTE_STATUS_LABEL, quoteSelectedTotal, type StudioQuote, type QuoteStatus } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { studioUrl } from "@/lib/hosts";

export type QuoteRow = StudioQuote & {
  quote_items: { qty: number; unit_price: number; selected: boolean; is_optional: boolean; is_discount: boolean }[];
  quote_adjustments: { id: string; resolved: boolean }[];
};

/** Màu pill trạng thái báo giá — cùng bộ màu trạng thái của bản thiết kế. */
const STATUS_TONE: Record<QuoteStatus, { fg: string; bg: string }> = {
  draft: { fg: "var(--nu)", bg: "var(--nuS)" },
  sent: { fg: "var(--am)", bg: "var(--amS)" },
  viewed: { fg: "var(--bl)", bg: "var(--blS)" },
  adjust_requested: { fg: "var(--am)", bg: "var(--amS)" },
  accepted: { fg: "var(--gn)", bg: "var(--gnS)" },
  converted: { fg: "var(--gn)", bg: "var(--gnS)" },
  expired: { fg: "var(--nu)", bg: "var(--nuS)" },
  cancelled: { fg: "var(--rd)", bg: "var(--rdS)" },
};

export default function QuotesListView({ list: initialList, studioHost = null }: { list: QuoteRow[]; studioHost?: string | null }) {
  const [rows, setRows] = useState<QuoteRow[]>(initialList);
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function changeStatus(id: string, next: QuoteStatus) {
    if (next === "converted") return; // "đã tạo hợp đồng" chỉ do luồng tạo HĐ đặt
    setUpdating(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    await supabase.from("studio_quotes").update({ status: next }).eq("id", id);
    setUpdating(null);
    router.refresh();
  }

  const kpis = useMemo(() => {
    const totalOf = (q: QuoteRow) => quoteSelectedTotal(q.quote_items || []);
    const waiting = rows.filter((r) => r.status === "sent" || r.status === "viewed" || r.status === "adjust_requested");
    const won = rows.filter((r) => r.status === "accepted" || r.status === "converted");
    const closable = rows.filter((r) => r.status !== "draft");
    return [
      { v: String(rows.length), l: "Báo giá đã tạo", c: "var(--tx)" },
      { v: String(waiting.length), l: "Đang chờ khách", c: "var(--am)" },
      { v: vndShort(waiting.reduce((s, q) => s + totalOf(q), 0)), l: "Giá trị đang chờ", c: "var(--ac)" },
      {
        v: closable.length ? `${Math.round((won.length / closable.length) * 100)}%` : "0%",
        l: "Tỉ lệ khách đồng ý", c: "var(--gn)",
      },
    ];
  }, [rows]);

  return (
    <div className="page-in flex flex-col gap-3.5" data-testid="quotes-list-page">
      {/* ── 4 thẻ số liệu ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        {kpis.map((k) => (
          <Panel key={k.l} className="px-4 py-3.5">
            <p className="tnum text-[23px] font-bold leading-none" style={{ letterSpacing: "-.7px", color: k.c }}>{k.v}</p>
            <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{k.l}</p>
          </Panel>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Báo giá gửi khách qua link riêng — khách bấm đồng ý là tự sinh hợp đồng.
        </p>
        <Link
          href="/dashboard/studio/quotes/new"
          className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff" }}
          data-testid="quote-new-btn"
        >
          <FilePlus size={16} /> Báo giá mới
        </Link>
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ReceiptText}
            title="Chưa có báo giá nào"
            hint="Ghép gói và hạng mục, gửi link cho khách — khách đồng ý là hợp đồng tự sinh ra."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 min-[1100px]:grid-cols-2">
          {rows.map((q) => {
            const total = quoteSelectedTotal(q.quote_items || []);
            const pendingAdj = (q.quote_adjustments || []).filter((a) => !a.resolved).length;
            const st = STATUS_TONE[q.status];
            return (
              <Panel key={q.id} className="flex flex-col gap-3 px-4 py-[15px]" data-testid={`quote-row-${q.id}`}>
                <div className="flex items-start gap-[11px]">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11.5px] font-bold" style={avatarStyle(q.client_name || q.title)}>
                    {initials(q.client_name || q.title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{q.title}</p>
                    <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {[q.code, q.client_name, q.client_phone].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                    </p>
                  </div>
                  <span className="flex-none whitespace-nowrap rounded-[20px] px-2.5 py-1 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>
                    {QUOTE_STATUS_LABEL[q.status]}
                  </span>
                </div>

                {pendingAdj > 0 && (
                  <p className="rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
                    {pendingAdj} yêu cầu chỉnh từ khách chưa xử lý
                  </p>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[120px] flex-1">
                    <p className="tnum text-[19px] font-bold" style={{ letterSpacing: "-.5px" }}>{vnd(total)}</p>
                    <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {(q.quote_items || []).length} hạng mục · tạo {fmtDate(q.created_at)}
                    </p>
                  </div>
                  <a
                    href={studioUrl(studioHost, `/q/${q.client_token}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-[7px] text-[12px] font-semibold"
                    style={{ border: "1px solid var(--bd)" }}
                    data-testid={`quote-view-public-${q.id}`}
                  >
                    <Eye size={14} /> Trang khách <ExternalLink size={11} />
                  </a>
                  <Link
                    href={`/dashboard/studio/quotes/${q.id}`}
                    className="flex flex-none items-center gap-1.5 rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold"
                    style={{ background: "var(--ac)", color: "#fff" }}
                    data-testid={`quote-edit-${q.id}`}
                  >
                    <Pencil size={13} /> Mở báo giá
                  </Link>
                </div>

                <label className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Trạng thái
                  <select
                    className="input w-auto py-1.5 text-[12px]"
                    aria-label="Đổi trạng thái báo giá"
                    style={{ color: st.fg, opacity: updating === q.id ? 0.5 : 1 }}
                    value={q.status}
                    disabled={updating === q.id}
                    onChange={(e) => changeStatus(q.id, e.target.value as QuoteStatus)}
                  >
                    {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((k) => (
                      <option key={k} value={k} disabled={k === "converted"}>{QUOTE_STATUS_LABEL[k]}</option>
                    ))}
                  </select>
                </label>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
