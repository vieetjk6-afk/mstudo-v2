"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, ChevronRight, CircleDollarSign, FilePlus, FileText, Info, Mail, MessageCircle, Phone,
  ReceiptText, Wallet, CheckCircle2,
} from "lucide-react";
import {
  Avatar, Badge, Empty, InfoList, Progress, Stack, Stat, StatGrid, btn, type Tone,
} from "@/components/v2/kit";
import { Menu, Tabs } from "@/components/v2/kit-client";
import { CONTRACT_STATUS_LABEL, vnd, type ContractStatus } from "@/lib/types";
import { fmtDate } from "@/lib/date";

/* ═══════════════════════════════════════════════════════════════════════════
   HỒ SƠ KHÁCH — giao diện mới. Cùng dữ liệu page.tsx đã tải cho bản cũ;
   khác ở cách sắp xếp:
     • Thẻ đầu: avatar, tên, liên hệ + nút Gọi / Zalo / Email.
     • 4 số liệu: số hợp đồng · tổng giá trị · đã thu · còn nợ.
     • Tab: Hợp đồng (lịch sử, bấm mở) · Thanh toán (thu được bao nhiêu của
       từng hợp đồng) · Thông tin.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ClientContractV2 = {
  id: string;
  title: string;
  event_date: string | null;
  status: ContractStatus;
  value: number;
  collected: number;
};

const STATUS_TONE: Record<ContractStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  approved: "blue",
  in_progress: "teal",
  post_production: "violet",
  completed: "green",
  cancelled: "red",
};

type Tab = "contracts" | "payments" | "info";

export default function ClientDetailV2({
  name,
  phone,
  email,
  sourceLabel,
  rows,
}: {
  name: string;
  phone: string;
  email: string;
  sourceLabel: string | null;
  rows: ClientContractV2[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("contracts");
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const collected = rows.reduce((s, r) => s + r.collected, 0);
  const active = rows.filter((r) => r.status !== "cancelled");
  const debt = active.reduce((s, r) => s + Math.max(0, r.value - r.collected), 0);
  const dated = rows.map((r) => r.event_date).filter(Boolean).sort() as string[];
  const first = dated[0] ?? null;
  const last = dated[dated.length - 1] ?? null;
  const zalo = phone ? `https://zalo.me/${phone.replace(/\D/g, "")}` : null;

  return (
    <Stack>
      <Link href="/dashboard/studio/clients" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--tx3)" }}>
        <ArrowLeft size={15} /> Khách hàng
      </Link>

      {/* ── Thẻ đầu: ai, liên hệ thế nào ─────────────────────────────── */}
      <div className="v2-card v2-card-pad flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={name} size={60} />
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold leading-tight" style={{ letterSpacing: "-0.3px" }}>{name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px]" style={{ color: "var(--tx2)" }}>
              <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {phone || "—"}</span>
              {email ? <span className="inline-flex min-w-0 items-center gap-1.5"><Mail size={13} /> <span className="truncate">{email}</span></span> : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sourceLabel ? <Badge tone="blue">{sourceLabel}</Badge> : null}
              {rows.length > 1 ? <Badge tone="green" dot>Khách quen</Badge> : null}
              {debt > 0 ? <Badge tone="amber" dot>Còn nợ</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          {phone ? (
            <>
              <a href={`tel:${phone}`} className={btn("primary", "md", "flex-1 md:flex-none")}>
                <Phone size={16} /> Gọi
              </a>
              <a href={zalo!} target="_blank" rel="noopener noreferrer" className={btn("secondary", "md", "flex-1 md:flex-none")}>
                <MessageCircle size={16} /> Zalo
              </a>
            </>
          ) : null}
          <Menu
            label="Thêm thao tác"
            width={230}
            items={[
              ...(email ? [{ label: "Gửi email", hint: email, icon: Mail, href: `mailto:${email}`, external: true }] : []),
              { label: "Tạo hợp đồng mới", icon: FilePlus, href: "/dashboard/studio/contracts/new" },
              { label: "Tạo báo giá", icon: ReceiptText, href: "/dashboard/studio/quotes/new" },
            ]}
          />
        </div>
      </div>

      <StatGrid>
        <Stat icon={FileText} tone="brand" label="Hợp đồng" value={rows.length} sub={last ? `Gần nhất ${fmtDate(last)}` : "Chưa có ngày chụp"} />
        <Stat icon={CircleDollarSign} tone="blue" label="Tổng giá trị" value={vnd(totalValue)} />
        <Stat icon={CheckCircle2} tone="green" label="Đã thu" value={vnd(collected)} valueTone="green" />
        <Stat icon={Wallet} tone="amber" label="Còn nợ" value={debt > 0 ? vnd(debt) : "0 ₫"} valueTone={debt > 0 ? "amber" : undefined} sub={debt > 0 ? "Chưa tính hợp đồng đã huỷ" : "Đã thu đủ"} />
      </StatGrid>

      <div className="flex flex-col gap-4">
        <Tabs<Tab>
          label="Hồ sơ khách"
          value={tab}
          onChange={setTab}
          options={[
            { value: "contracts", label: "Hợp đồng", icon: FileText, count: rows.length },
            { value: "payments", label: "Thanh toán", icon: Wallet },
            { value: "info", label: "Thông tin", icon: Info },
          ]}
        />

        {tab === "contracts" ? (
          rows.length === 0 ? (
            <div className="v2-card">
              <Empty icon={FileText} title="Chưa có hợp đồng nào" />
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Hợp đồng</th>
                      <th style={{ width: 140 }}>Ngày chụp</th>
                      <th style={{ width: 170 }}>Trạng thái</th>
                      <th className="num" style={{ width: 160 }}>Giá trị</th>
                      <th style={{ width: 44 }} aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/studio/contracts/${r.id}`)}>
                        <td>
                          <Link href={`/dashboard/studio/contracts/${r.id}`} className="font-semibold" onClick={(e) => e.stopPropagation()}>
                            {r.title}
                          </Link>
                        </td>
                        <td className="v2-num" style={{ color: "var(--tx2)" }}>{r.event_date ? fmtDate(r.event_date) : "—"}</td>
                        <td><Badge tone={STATUS_TONE[r.status]} dot>{CONTRACT_STATUS_LABEL[r.status]}</Badge></td>
                        <td className="num font-semibold">{vnd(r.value)}</td>
                        <td style={{ color: "var(--tx3)" }}><ChevronRight size={16} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                {rows.map((r) => (
                  <Link key={r.id} href={`/dashboard/studio/contracts/${r.id}`} className="v2-row v2-row-link">
                    <span className="v2-section-icon flex-none" style={{ width: 36, height: 36 }}><CalendarDays size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{r.title}</p>
                      <p className="v2-row-sub">{r.event_date ? fmtDate(r.event_date) : "Chưa có ngày"} · {CONTRACT_STATUS_LABEL[r.status]}</p>
                    </div>
                    <span className="v2-num flex-none text-[13.5px] font-semibold">{vnd(r.value)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        ) : null}

        {tab === "payments" ? (
          <div className="v2-card overflow-hidden">
            <div className="v2-card-pad flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[15px] font-semibold">Đã thu {vnd(collected)}</p>
                <p className="text-[13px]" style={{ color: "var(--tx3)" }}>trên tổng {vnd(totalValue)}</p>
              </div>
              <Progress value={totalValue > 0 ? (collected / totalValue) * 100 : 0} tone={debt > 0 ? "amber" : "green"} />
            </div>
            {rows.length === 0 ? (
              <Empty compact icon={Wallet} title="Chưa có khoản thu nào" />
            ) : (
              rows.map((r) => {
                const left = Math.max(0, r.value - r.collected);
                const pct = r.value > 0 ? (r.collected / r.value) * 100 : r.collected > 0 ? 100 : 0;
                return (
                  <Link key={r.id} href={`/dashboard/studio/contracts/${r.id}`} className="v2-row v2-row-link items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="v2-row-title min-w-0 flex-1">{r.title}</p>
                        <span className="flex-none">
                          {r.status === "cancelled" ? (
                            <Badge tone="red">Đã huỷ</Badge>
                          ) : left > 0 ? (
                            <Badge tone="amber">Còn {vnd(left)}</Badge>
                          ) : (
                            <Badge tone="green">Đã thu đủ</Badge>
                          )}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Progress value={pct} tone={r.status === "cancelled" ? "gray" : left > 0 ? "amber" : "green"} />
                      </div>
                      <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                        <span className="v2-num">{vnd(r.collected)}</span> / <span className="v2-num">{vnd(r.value)}</span>
                        {r.event_date ? ` · ${fmtDate(r.event_date)}` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        ) : null}

        {tab === "info" ? (
          <div className="v2-card v2-card-pad">
            <InfoList
              items={[
                { label: "Họ tên", value: name },
                { label: "Điện thoại", value: phone || "—" },
                { label: "Email", value: email || "—" },
                { label: "Nguồn khách", value: sourceLabel || "Không rõ nguồn" },
                { label: "Lần chụp đầu", value: first ? fmtDate(first) : "—" },
                { label: "Lần chụp gần nhất", value: last ? fmtDate(last) : "—" },
              ]}
            />
          </div>
        ) : null}
      </div>
    </Stack>
  );
}
