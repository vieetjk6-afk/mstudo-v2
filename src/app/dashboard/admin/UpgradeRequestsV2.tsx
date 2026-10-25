"use client";

import { useMemo, useState } from "react";
import { Check, CheckCheck, Crown, Phone, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Badge, Callout, Empty, Toolbar, btn, type Tone } from "@/components/v2/kit";
import { Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { fmtDateTime } from "@/lib/date";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import { vnd } from "@/lib/types";
import { UPGRADE_PAYMENT_LABEL, type UpgradePaymentStatus } from "@/lib/upgrade-payment";
import type { UpgradeRequest } from "@/lib/types";
import { useUpgradeRequests } from "./useUpgradeRequests";

/* ═══════════════════════════════════════════════════════════════════════════
   YÊU CẦU NÂNG CẤP — giao diện mới (một tab của AdminPanelV2). Cùng logic với
   UpgradeRequests (bản cũ, ./useUpgradeRequests); khác ở cách sắp xếp:
     • Bảng gọn: studio · gói · số tiền · thanh toán · ngày.
     • Mỗi dòng đúng MỘT nút chính: đơn đã báo chuyển → "Đã nhận tiền"; đơn
       chưa xử lý → "Xong". Việc ít dùng (chưa nhận được tiền, bỏ đánh dấu,
       xoá) dồn vào menu ⋯.
     • Lọc nhanh: Cần duyệt (đã báo chuyển) · Chưa xử lý · Tất cả.
   ═══════════════════════════════════════════════════════════════════════════ */

const PAY_TONE: Record<UpgradePaymentStatus, Tone> = { none: "gray", awaiting_confirm: "amber", paid: "green", failed: "red" };
type Filter = "review" | "open" | "all";

const statusOf = (u: UpgradeRequest) => (u.payment_status ?? "none") as UpgradePaymentStatus;
const amountOf = (u: UpgradeRequest) => u.payment_amount ?? u.amount;
const planText = (u: UpgradeRequest) =>
  u.plan ? `${PLAN_LABEL[u.plan as Plan] ?? u.plan}${u.cycle ? ` · ${u.cycle === "year" ? "năm" : "tháng"}` : ""}` : "—";

export default function UpgradeRequestsV2({ initial }: { initial: UpgradeRequest[] }) {
  const r = useUpgradeRequests(initial);
  const reviewCount = r.rows.filter((u) => statusOf(u) === "awaiting_confirm").length;
  const openCount = r.rows.filter((u) => !u.handled).length;
  const [filter, setFilter] = useState<Filter>(reviewCount > 0 ? "review" : "open");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return r.rows.filter((u) => {
      if (filter === "review" && statusOf(u) !== "awaiting_confirm") return false;
      if (filter === "open" && u.handled) return false;
      if (!n) return true;
      return `${u.email ?? ""} ${u.phone ?? ""} ${u.payment_code ?? ""} ${u.discount_code ?? ""}`.toLowerCase().includes(n);
    });
  }, [r.rows, filter, q]);

  const menuItems = (u: UpgradeRequest): MenuItem[] => [
    ...(statusOf(u) === "awaiting_confirm"
      ? ([{ label: "Chưa nhận được tiền", hint: "Báo lại cho studio kèm lý do", icon: X, onClick: () => void r.review(u.id, "reject") }, "divider"] as MenuItem[])
      : []),
    u.handled
      ? { label: "Đánh dấu chưa xử lý", icon: RotateCcw, onClick: () => void r.handle("handled", u.id, false) }
      : { label: "Đánh dấu đã xử lý", icon: CheckCheck, onClick: () => void r.handle("handled", u.id, true) },
    ...(u.phone ? [{ label: "Gọi studio", hint: u.phone, icon: Phone, href: `tel:${u.phone}`, external: true } as MenuItem] : []),
    "divider",
    { label: "Xoá yêu cầu", icon: Trash2, danger: true, onClick: () => void r.handle("delete", u.id) },
  ];

  /** Nút chính của một dòng (tối đa một). */
  const mainAction = (u: UpgradeRequest, full = false) =>
    statusOf(u) === "awaiting_confirm" ? (
      <button type="button" onClick={() => void r.review(u.id, "confirm")} disabled={r.busy === u.id} className={btn("primary", "sm", full ? "flex-1" : "")}>
        <Check size={15} /> Đã nhận tiền
      </button>
    ) : !u.handled ? (
      <button type="button" onClick={() => void r.handle("handled", u.id, true)} className={btn("secondary", "sm", full ? "flex-1" : "")}>
        <CheckCheck size={15} /> Xong
      </button>
    ) : (
      <span className="text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>Đã xử lý</span>
    );

  const payCell = (u: UpgradeRequest) => (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={PAY_TONE[statusOf(u)]} dot>{UPGRADE_PAYMENT_LABEL[statusOf(u)] ?? u.payment_status}</Badge>
      {u.payment_code ? <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>{u.payment_code}</span> : null}
    </div>
  );

  return (
    <section id="yeu-cau-nang-cap" className="v2-card scroll-mt-24 overflow-hidden">
      <header className="v2-section-head">
        <span className="v2-section-icon"><Crown size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">Yêu cầu nâng cấp</h3>
          <p className="v2-section-desc">Studio báo đã chuyển khoản thì đối chiếu sao kê rồi xác nhận — gói được nâng ngay.</p>
        </div>
      </header>

      {r.rows.length > 0 ? (
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <div className="min-w-[200px] flex-1">
              <SearchInput value={q} onChange={setQ} placeholder="Email, số điện thoại, mã chuyển khoản…" className="w-full" />
            </div>
            <Segmented<Filter>
              label="Lọc yêu cầu"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "review", label: "Cần duyệt", count: reviewCount },
                { value: "open", label: "Chưa xử lý", count: openCount },
                { value: "all", label: "Tất cả", count: r.rows.length },
              ]}
            />
          </Toolbar>
        </div>
      ) : null}

      {r.msg ? (
        <div className="px-5 pt-4">
          <Callout tone="red">{r.msg}</Callout>
        </div>
      ) : null}

      {r.rows.length === 0 ? (
        <Empty icon={Crown} title="Chưa có yêu cầu nào" hint="Studio chọn gói ở trang Gói phần mềm là yêu cầu hiện ở đây." />
      ) : shown.length === 0 ? (
        <Empty
          compact
          icon={filter === "review" ? CheckCheck : Search}
          title={filter === "review" && !q ? "Không có đơn nào chờ xác nhận" : "Không có yêu cầu nào khớp"}
          hint={filter !== "all" ? "Chọn “Tất cả” để xem cả yêu cầu đã xử lý." : "Thử gõ ít chữ hơn."}
        />
      ) : (
        <>
          <div className="v2-table-wrap hidden md:block">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Studio</th>
                  <th>Gói</th>
                  <th className="num">Số tiền</th>
                  <th>Thanh toán</th>
                  <th>Ngày gửi</th>
                  <th style={{ width: 190 }} aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} style={u.handled ? { opacity: 0.62 } : undefined}>
                    <td style={{ maxWidth: 280 }}>
                      <p className="truncate font-semibold">{u.email ?? u.user_id}</p>
                      <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                        {[u.phone, u.note].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td><Badge tone="brand">{planText(u)}</Badge></td>
                    <td className="num">
                      <p className="font-semibold">{amountOf(u) != null ? vnd(amountOf(u)) : "—"}</p>
                      {u.discount_code ? <p className="font-mono text-[12px]" style={{ color: "var(--tx3)" }}>{u.discount_code}</p> : null}
                    </td>
                    <td>{payCell(u)}</td>
                    <td className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx3)" }}>{fmtDateTime(u.created_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {mainAction(u)}
                        <Menu label={`Thao tác với yêu cầu của ${u.email ?? "studio"}`} items={menuItems(u)} width={240} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {shown.map((u) => (
              <div key={u.id} className="v2-row !items-start" style={u.handled ? { opacity: 0.62 } : undefined}>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{u.email ?? u.user_id}</p>
                      <p className="v2-row-sub">{[u.phone, fmtDateTime(u.created_at)].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="v2-num flex-none text-[14px] font-semibold">{amountOf(u) != null ? vnd(amountOf(u)) : "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{planText(u)}</Badge>
                    <Badge tone={PAY_TONE[statusOf(u)]} dot>{UPGRADE_PAYMENT_LABEL[statusOf(u)] ?? u.payment_status}</Badge>
                    {u.payment_code ? <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>{u.payment_code}</span> : null}
                  </div>
                  {u.note ? <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>{u.note}</p> : null}
                  <div className="flex items-center gap-2">
                    {mainAction(u, true)}
                    <Menu label={`Thao tác với yêu cầu của ${u.email ?? "studio"}`} items={menuItems(u)} width={240} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
