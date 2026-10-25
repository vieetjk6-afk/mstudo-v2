"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Layers, Minus, Phone, Plus, RotateCcw, Search, Ticket, Trash2, Wallet, CheckCircle2 } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Avatar, Badge, Empty, Field, PageHead, Progress, Stack, Stat, StatGrid, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { vnd, vndShort, type StudioPackage } from "@/lib/types";
import type { PackagesProps } from "./PackagesManager";
import { usePackages } from "./usePackages";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ BUỔI — giao diện mới. Cùng logic với PackagesManager (./usePackages);
   khác ở cách sắp xếp:
     • 4 số liệu: thẻ đang dùng · buổi còn lại · doanh thu thẻ · chưa thu.
     • Một bảng: khách · gói · thanh buổi đã dùng · giá + đã/chưa thu. Mỗi dòng
       một nút "Dùng 1 buổi"; hoàn buổi, đánh dấu thu tiền, gọi, xoá vào ⋯.
     • Lọc nhanh: còn buổi / hết buổi / chưa thu. Tạo thẻ bằng ngăn kéo.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filter = "all" | "open" | "done" | "unpaid";
const remainingOf = (p: StudioPackage) => p.total_sessions - p.used_sessions;

export default function PackagesV2({ ownerId, initial }: PackagesProps) {
  const pk = usePackages(ownerId, initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const openCount = pk.list.filter((p) => remainingOf(p) > 0).length;
  const doneCount = pk.list.length - openCount;
  const unpaid = pk.list.filter((p) => !p.paid);
  const totalLeft = pk.list.reduce((n, p) => n + Math.max(0, remainingOf(p)), 0);
  const totalUsed = pk.list.reduce((n, p) => n + p.used_sessions, 0);
  const totalSessions = pk.list.reduce((n, p) => n + p.total_sessions, 0);
  const revenue = pk.list.reduce((n, p) => n + p.price, 0);
  const unpaidSum = unpaid.reduce((n, p) => n + p.price, 0);

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return pk.list.filter((p) => {
      if (filter === "open" && remainingOf(p) <= 0) return false;
      if (filter === "done" && remainingOf(p) > 0) return false;
      if (filter === "unpaid" && p.paid) return false;
      return !n || noAccent(`${p.client_name} ${p.client_phone ?? ""} ${p.name}`).includes(n);
    });
  }, [pk.list, q, filter]);

  const rowMenu = (p: StudioPackage) => (
    <Menu
      label={`Thao tác với thẻ của ${p.client_name}`}
      items={[
        { label: "Hoàn 1 buổi", hint: "Trả lại buổi đã trừ nhầm", icon: RotateCcw, disabled: p.used_sessions === 0, onClick: () => void pk.setUsed(p, -1) },
        {
          label: p.paid ? "Đánh dấu chưa thanh toán" : "Đánh dấu đã thanh toán",
          icon: p.paid ? CircleDollarSign : CheckCircle2,
          onClick: () => void pk.togglePaid(p),
        },
        ...(p.client_phone ? [{ label: "Gọi khách", hint: p.client_phone, icon: Phone, href: `tel:${p.client_phone}`, external: true }] : []),
        "divider",
        { label: "Xoá thẻ buổi", icon: Trash2, danger: true, onClick: () => void pk.remove(p.id) },
      ]}
    />
  );

  const spendBtn = (p: StudioPackage, full = false) => (
    <button
      type="button"
      onClick={() => void pk.setUsed(p, 1)}
      disabled={remainingOf(p) <= 0}
      className={btn("soft", "sm", full ? "w-full" : "")}
    >
      <Minus size={15} /> Dùng 1 buổi
    </button>
  );

  return (
    <Stack>
      <PageHead
        desc="Khách mua gói nhiều buổi trả trước — mỗi lần chụp trừ một buổi, hết buổi là thẻ tự chuyển sang “đã dùng hết”."
        actions={
          <button type="button" onClick={() => setCreating(true)} className={btn("primary")}>
            <Plus size={17} /> Tạo thẻ buổi
          </button>
        }
      />

      {pk.list.length > 0 ? (
        <StatGrid>
          <Stat icon={Ticket} tone="brand" label="Thẻ đang dùng" value={openCount} sub={`${pk.list.length} thẻ đã bán`} />
          <Stat icon={Layers} tone="blue" label="Buổi còn lại" value={totalLeft} sub={`Đã dùng ${totalUsed}/${totalSessions} buổi`} />
          <Stat icon={Wallet} tone="green" label="Doanh thu thẻ" value={vndShort(revenue)} sub={`Đã thu ${vndShort(revenue - unpaidSum)}`} />
          <Stat
            icon={CircleDollarSign}
            tone="amber"
            label="Chưa thanh toán"
            value={vndShort(unpaidSum)}
            valueTone={unpaidSum > 0 ? "amber" : undefined}
            sub={unpaid.length ? `${unpaid.length} thẻ chưa thu tiền` : "Đã thu đủ"}
          />
        </StatGrid>
      ) : null}

      {pk.list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Ticket}
            title="Chưa có thẻ buổi nào"
            hint="Bán gói nhiều buổi (chụp bé hằng tháng, chụp gia đình…) rồi trừ dần mỗi lần khách tới chụp."
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tên khách, SĐT hoặc tên gói…" className="w-full" />
              </div>
              <Segmented<Filter>
                label="Lọc thẻ buổi"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Tất cả", count: pk.list.length },
                  { value: "open", label: "Còn buổi", count: openCount },
                  { value: "done", label: "Hết buổi", count: doneCount },
                  { value: "unpaid", label: "Chưa thu", count: unpaid.length },
                ]}
              />
            </Toolbar>
          </div>

          {shown.length === 0 ? (
            <Empty compact icon={Search} title="Không có thẻ nào khớp" hint="Thử chọn “Tất cả” hoặc gõ ít chữ hơn." />
          ) : (
            <>
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th style={{ width: 210 }}>Gói</th>
                      <th style={{ width: 200 }}>Buổi đã dùng</th>
                      <th className="num" style={{ width: 150 }}>Giá</th>
                      <th style={{ width: 190 }} aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => {
                      const left = remainingOf(p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={p.client_name} size={36} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{p.client_name}</p>
                                <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{p.client_phone || "Chưa có SĐT"}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Bán {fmtDate(p.created_at)}</p>
                          </td>
                          <td>
                            <p className="v2-num mb-1.5 text-[13px]">
                              <b style={{ color: left > 0 ? "var(--tx)" : "var(--rd)" }}>Còn {left}</b>
                              <span style={{ color: "var(--tx3)" }}> / {p.total_sessions} buổi</span>
                            </p>
                            <Progress value={(p.used_sessions / Math.max(1, p.total_sessions)) * 100} tone={left > 0 ? "brand" : "red"} />
                          </td>
                          <td className="num">
                            <p className="font-semibold">{vnd(p.price)}</p>
                            <span className="mt-1 inline-flex">
                              {p.paid ? <Badge tone="green" dot>Đã thu</Badge> : <Badge tone="amber" dot>Chưa thu</Badge>}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              {spendBtn(p)}
                              {rowMenu(p)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden">
                {shown.map((p) => {
                  const left = remainingOf(p);
                  return (
                    <div key={p.id} className="v2-row flex-col items-stretch gap-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={p.client_name} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="v2-row-title">{p.client_name}</p>
                          <p className="v2-row-sub">{p.name} · {vndShort(p.price)}</p>
                        </div>
                        {rowMenu(p)}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="v2-num mb-1 text-[13px]">
                            <b style={{ color: left > 0 ? "var(--tx)" : "var(--rd)" }}>Còn {left}</b>
                            <span style={{ color: "var(--tx3)" }}> / {p.total_sessions} buổi</span>
                            {" · "}
                            <span style={{ color: p.paid ? "var(--gn)" : "var(--am)", fontWeight: 600 }}>{p.paid ? "đã thu" : "chưa thu"}</span>
                          </p>
                          <Progress value={(p.used_sessions / Math.max(1, p.total_sessions)) * 100} tone={left > 0 ? "brand" : "red"} />
                        </div>
                        {spendBtn(p)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="Tạo thẻ buổi"
        desc="Khách trả trước một gói nhiều buổi."
        footer={
          <>
            <button type="button" onClick={() => setCreating(false)} className={btn("ghost")}>Huỷ</button>
            <button
              type="button"
              disabled={pk.busy || !pk.f.client_name.trim()}
              onClick={async () => {
                if (await pk.add()) setCreating(false);
              }}
              className={btn("primary")}
            >
              <Plus size={16} /> {pk.busy ? "Đang tạo…" : "Tạo thẻ"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Khách hàng" hint={!pk.f.client_name.trim() ? "Bắt buộc." : undefined}>
              <input className={inputCls} value={pk.f.client_name} onChange={(e) => pk.setF((p) => ({ ...p, client_name: e.target.value }))} autoFocus />
            </Field>
            <Field label="Số điện thoại">
              <input className={inputCls} type="tel" value={pk.f.client_phone} onChange={(e) => pk.setF((p) => ({ ...p, client_phone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Tên gói">
            <input className={inputCls} value={pk.f.name} onChange={(e) => pk.setF((p) => ({ ...p, name: e.target.value }))} placeholder="VD: Gói 10 buổi chụp bé" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số buổi">
              <input type="number" min={1} className={inputCls} value={pk.f.total_sessions} onChange={(e) => pk.setF((p) => ({ ...p, total_sessions: Number(e.target.value) }))} />
            </Field>
            <Field label="Giá cả gói">
              <MoneyInput className={inputCls} value={pk.f.price} onChange={(n) => pk.setF((p) => ({ ...p, price: n }))} ariaLabel="Giá cả gói" />
            </Field>
          </div>
        </div>
      </Drawer>
    </Stack>
  );
}
