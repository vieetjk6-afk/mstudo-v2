"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download, FileSpreadsheet, Gift, HeartHandshake, MessageCircle, Phone, Repeat, Search, UserPlus, UserRound,
  Users, Wallet, ArrowUpRight, FilePlus,
} from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import {
  Avatar, Badge, Empty, InfoList, PageHead, Progress, Stack, Stat, StatGrid, Toolbar, btn, inputCls,
} from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, Tabs } from "@/components/v2/kit-client";
import { vnd, vndShort, type StudioReferral } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import type { ExportStudio } from "@/lib/studio-export";
import type { ClientAgg } from "./ClientsView";
import ReferralsV2 from "./ReferralsV2";
import {
  useClients, clientHref, sourceLabel, debtOf, inviteBackMessage, zaloUrl, type ClientSegment, type ClientSort,
} from "./useClients";

/* ═══════════════════════════════════════════════════════════════════════════
   KHÁCH HÀNG — giao diện mới. Cùng dữ liệu, cùng thao tác với ClientsView
   (bản cũ, logic chung ở ./useClients); khác ở cách sắp xếp:
     • 4 số liệu: số khách · tỉ lệ quay lại · giá trị TB · đang còn nợ.
     • Hai tab: Danh bạ khách | Khách giới thiệu (sổ giới thiệu trước nằm rời
       dưới đáy trang).
     • Một thanh lọc: tìm · nhóm (tất cả / khách quen / cần chăm sóc / còn nợ)
       · sắp xếp. Xuất Excel/CSV dồn vào menu ⋯.
     • Bảng gọn (máy tính) / thẻ gọn (điện thoại); bấm một khách mở NGĂN KÉO
       xem nhanh: gọi, Zalo, mời quay lại, tiền đã thu/còn nợ, mở hồ sơ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  clients: ClientAgg[];
  studio: ExportStudio;
  referrals?: { rows: StudioReferral[]; bookingUrl: string | null };
};

type View = "clients" | "referrals";

export default function ClientsV2({ clients, studio, referrals }: Props) {
  const c = useClients(clients, studio);
  const [view, setView] = useState<View>("clients");
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const peek = peekKey ? clients.find((x) => x.key === peekKey) ?? null : null;

  const owedCount = referrals ? referrals.rows.filter((r) => r.status === "earned").length : 0;

  /** Một nhãn chính cho mỗi khách (bảng chỉ có chỗ cho một). */
  const mainBadge = (x: ClientAgg) =>
    c.isOld(x) ? (
      <Badge tone="amber" dot>Cần chăm sóc</Badge>
    ) : x.count > 1 ? (
      <Badge tone="green" dot>Khách quen</Badge>
    ) : (
      <Badge tone="gray" dot>Khách mới</Badge>
    );

  const rowMenu = (x: ClientAgg) => (
    <Menu
      label={`Thao tác với ${x.name}`}
      items={[
        { label: "Xem nhanh", icon: UserRound, onClick: () => setPeekKey(x.key) },
        { label: "Mở hồ sơ khách", icon: ArrowUpRight, href: clientHref(x) },
        ...(x.phone
          ? ([
              "divider",
              { label: "Gọi điện", hint: x.phone, icon: Phone, href: `tel:${x.phone}`, external: true },
              { label: "Nhắn Zalo", icon: MessageCircle, href: zaloUrl(x.phone), external: true },
            ] as const)
          : []),
      ]}
    />
  );

  const filtering = c.q.trim() !== "" || c.segment !== "all";

  const list =
    clients.length === 0 ? (
      <div className="v2-card">
        <Empty
          icon={Users}
          title="Chưa có khách hàng nào"
          hint="Danh bạ tự sinh ra từ hợp đồng — tạo hợp đồng đầu tiên là khách xuất hiện ở đây."
          action={
            <Link href="/dashboard/studio/contracts/new" className={btn("primary")}>
              <UserPlus size={17} /> Tạo hợp đồng đầu tiên
            </Link>
          }
        />
      </div>
    ) : (
      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            {/* .v2-search tự đặt min-width: 0, nên giữ bề rộng tối thiểu ở lớp bọc. */}
            <div className="min-w-[220px] flex-1">
              <SearchInput value={c.q} onChange={c.setQ} placeholder="Tên hoặc số điện thoại…" className="w-full" />
            </div>
            <Segmented<ClientSegment>
              label="Nhóm khách"
              value={c.segment}
              onChange={c.setSegment}
              options={[
                { value: "all", label: "Tất cả", count: clients.length },
                { value: "returning", label: "Khách quen", count: c.returning },
                { value: "old", label: "Cần chăm sóc", count: c.oldCount },
                { value: "debt", label: "Còn nợ", count: c.debtCount },
              ]}
            />
            <select
              aria-label="Sắp xếp khách hàng"
              className={inputCls}
              value={c.sort}
              onChange={(e) => c.setSort(e.target.value as ClientSort)}
            >
              <option value="recent">Gần đây nhất</option>
              <option value="value">Chi nhiều nhất</option>
              <option value="count">Nhiều hợp đồng nhất</option>
            </select>
          </Toolbar>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {c.filtered.length} khách · tổng chi tiêu {vnd(c.filtered.reduce((s, x) => s + x.value, 0))}
            {filtering ? (
              <>
                {" · "}
                <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { c.setQ(""); c.setSegment("all"); }}>
                  Xoá lọc
                </button>
              </>
            ) : null}
          </p>
        </div>

        {c.filtered.length === 0 ? (
          <Empty compact icon={Search} title="Không tìm thấy khách phù hợp" hint="Thử chọn nhóm “Tất cả” hoặc gõ ít chữ hơn." />
        ) : (
          <>
            {/* Máy tính: bảng — bấm một dòng mở ngăn kéo xem nhanh. */}
            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th style={{ width: 170 }}>Lần gần nhất</th>
                    <th className="num" style={{ width: 150 }}>Tổng chi tiêu</th>
                    <th className="num" style={{ width: 140 }}>Còn nợ</th>
                    <th style={{ width: 150 }}>Nhóm</th>
                    <th style={{ width: 56 }} aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {c.filtered.map((x) => {
                    const debt = debtOf(x);
                    return (
                      <tr key={x.key} className="cursor-pointer" onClick={() => setPeekKey(x.key)}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={x.name} size={36} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{x.name}</p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                                {x.phone || "—"} · {x.count} hợp đồng
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="v2-num whitespace-nowrap">{x.last ? fmtDate(x.last) : "—"}</p>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{sourceLabel(x)}</p>
                        </td>
                        <td className="num font-semibold">{vnd(x.value)}</td>
                        <td className="num" style={{ color: debt > 0 ? "var(--am)" : "var(--gn)", fontWeight: 600 }}>
                          {debt > 0 ? vnd(debt) : "Đã thu đủ"}
                        </td>
                        <td>{mainBadge(x)}</td>
                        <td onClick={(e) => e.stopPropagation()}>{rowMenu(x)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Điện thoại: thẻ gọn — chạm để xem nhanh. */}
            <div className="md:hidden">
              {c.filtered.map((x) => {
                const debt = debtOf(x);
                return (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setPeekKey(x.key)}
                    className="v2-row v2-row-link w-full text-left"
                  >
                    <Avatar name={x.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{x.name}</p>
                      <p className="v2-row-sub">
                        {x.count} hợp đồng · {x.last ? fmtDate(x.last) : "chưa có buổi nào"}
                      </p>
                      {c.isOld(x) ? (
                        <span className="mt-1 inline-flex"><Badge tone="amber" dot>Cần chăm sóc</Badge></span>
                      ) : null}
                    </div>
                    <div className="flex-none text-right">
                      <p className="v2-num text-[14px] font-semibold">{vndShort(x.value)}</p>
                      <p className="v2-num text-[12px] font-medium" style={{ color: debt > 0 ? "var(--am)" : "var(--gn)" }}>
                        {debt > 0 ? `nợ ${vndShort(debt)}` : "đã thu đủ"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );

  return (
    <Stack>
      <PageHead
        desc="Danh bạ tự sinh ra từ hợp đồng. Bấm vào một khách để xem nhanh, gọi lại hoặc mời quay lại."
        actions={
          <>
            <Menu
              label="Xuất danh sách"
              width={240}
              items={[
                {
                  label: c.exporting ? "Đang tạo…" : "Xuất Excel",
                  hint: "Đúng danh sách đang lọc",
                  icon: FileSpreadsheet,
                  disabled: c.exporting || clients.length === 0,
                  onClick: () => void c.exportExcel(),
                },
                { label: "Xuất CSV", hint: "Bản CSV cho công cụ khác", icon: Download, disabled: clients.length === 0, onClick: c.exportCsv },
              ]}
            />
            <Link href="/dashboard/studio/contracts/new" className={btn("primary")}>
              <FilePlus size={17} /> Tạo hợp đồng
            </Link>
          </>
        }
      />

      <StatGrid>
        <Stat icon={Users} tone="brand" label="Khách đã chụp" value={clients.length} sub={`${c.returning} khách quen`} />
        <Stat icon={Repeat} tone="green" label="Khách quay lại" value={`${c.returnPct}%`} sub="Chụp từ 2 hợp đồng trở lên" />
        <Stat icon={Wallet} tone="blue" label="Giá trị TB / khách" value={clients.length ? vndShort(c.avgValue) : "0"} sub={`Tổng ${vndShort(c.totalSpent)}`} />
        <Stat
          icon={HeartHandshake}
          tone="amber"
          label="Đang còn nợ"
          value={vndShort(c.totalDebt)}
          valueTone={c.totalDebt > 0 ? "amber" : undefined}
          sub={c.debtCount ? `${c.debtCount} khách chưa thu đủ` : "Đã thu đủ"}
        />
      </StatGrid>

      {referrals ? (
        <div className="flex flex-col gap-4">
          <Tabs<View>
            label="Khách hàng"
            value={view}
            onChange={setView}
            options={[
              { value: "clients", label: "Danh bạ khách", icon: Users, count: clients.length },
              {
                value: "referrals",
                label: (
                  <>
                    Khách giới thiệu
                    {owedCount ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--am)" }} title={`${owedCount} lượt cần tặng thưởng`} /> : null}
                  </>
                ),
                icon: Gift,
                count: referrals.rows.length,
              },
            ]}
          />
          {view === "clients" ? list : <ReferralsV2 rows={referrals.rows} bookingUrl={referrals.bookingUrl} />}
        </div>
      ) : (
        list
      )}

      <Drawer
        open={!!peek}
        onClose={() => setPeekKey(null)}
        title="Khách hàng"
        desc={peek ? sourceLabel(peek) : undefined}
        footer={
          peek ? (
            <>
              <Link href="/dashboard/studio/contracts/new" className={btn("secondary")}>
                <FilePlus size={16} /> Hợp đồng mới
              </Link>
              <Link href={clientHref(peek)} className={btn("primary")}>
                Mở hồ sơ <ArrowUpRight size={16} />
              </Link>
            </>
          ) : null
        }
      >
        {peek ? <ClientPeek c={peek} isOld={c.isOld(peek)} /> : null}
      </Drawer>
    </Stack>
  );
}

function ClientPeek({ c, isOld }: { c: ClientAgg; isOld: boolean }) {
  const debt = debtOf(c);
  const pct = c.value > 0 ? (c.collected / c.value) * 100 : 100;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={c.name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{c.name}</p>
          <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>{c.phone || "Chưa có số điện thoại"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.count > 1 ? <Badge tone="green" dot>Khách quen</Badge> : <Badge tone="gray" dot>Khách mới</Badge>}
            {isOld ? <Badge tone="amber" dot>Cần chăm sóc</Badge> : null}
          </div>
        </div>
      </div>

      {c.phone ? (
        <div className="grid grid-cols-3 gap-2">
          <a href={`tel:${c.phone}`} className={btn("secondary", "md", "w-full")}>
            <Phone size={16} /> Gọi
          </a>
          <a href={zaloUrl(c.phone)} target="_blank" rel="noopener noreferrer" className={btn("secondary", "md", "w-full")}>
            <MessageCircle size={16} /> Zalo
          </a>
          <MessengerButton label="Mời lại" message={inviteBackMessage(c)} className={btn("secondary", "md", "w-full")} />
        </div>
      ) : null}

      {isOld ? (
        <p className="rounded-[10px] px-3 py-2.5 text-[13px]" style={{ background: "var(--amS)", color: "var(--tx2)" }}>
          Đã hơn 6 tháng chưa chụp lại. Bấm <b>Mời lại</b> để gửi lời mời kèm ưu đãi khách cũ.
        </p>
      ) : null}

      <div className="v2-card v2-card-pad flex flex-col gap-3" style={{ boxShadow: "none" }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Tổng chi tiêu</p>
          <p className="v2-num text-[18px] font-bold">{vnd(c.value)}</p>
        </div>
        <Progress value={pct} tone={debt > 0 ? "amber" : "green"} />
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span style={{ color: "var(--tx2)" }}>
            Đã thu <b className="v2-num" style={{ color: "var(--gn)" }}>{vnd(c.collected)}</b>
          </span>
          <span style={{ color: debt > 0 ? "var(--am)" : "var(--gn)", fontWeight: 600 }}>
            {debt > 0 ? `Còn nợ ${vnd(debt)}` : "Đã thu đủ"}
          </span>
        </div>
      </div>

      <InfoList
        items={[
          { label: "Số hợp đồng", value: `${c.count} hợp đồng` },
          { label: "Lần chụp gần nhất", value: c.last ? fmtDate(c.last) : "Chưa có buổi nào" },
          { label: "Nguồn khách", value: sourceLabel(c) },
        ]}
      />
    </div>
  );
}
