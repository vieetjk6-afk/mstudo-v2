"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, PackageCheck, PackageOpen, Plus, Shirt, Trash2 } from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Empty, Field, GroupLabel, Section, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, Modal } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { RENTAL_CATEGORY_LABEL, RENTAL_ORDER_STATUS_LABEL, vnd, type RentalOrderStatus } from "@/lib/types";
import { useContractRental, type ContractRentalProps, type DonThue } from "./ContractRentalPanel";

/* ═══════════════════════════════════════════════════════════════════════════
   THUÊ ĐỒ trong hợp đồng — giao diện mới (tab Thuê đồ). Cùng logic với bản cũ
   (useContractRental): mỗi đơn thuê một dòng có nhãn trạng thái và MỘT nút
   chuyển bước (đã giao đồ → đã nhận lại); tạo đơn trong ngăn kéo — chọn món
   trong kho, ngày nhận/trả, cọc. Gỡ đơn thì hỏi lại.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<RentalOrderStatus, Tone> = {
  booked: "blue",
  picked_up: "amber",
  returned: "green",
  overdue: "red",
  canceled: "gray",
};

export default function ContractRentalPanelV2(props: ContractRentalProps) {
  const { eventDate } = props;
  const r = useContractRental(props);
  const { dons, kho, dangNap, moForm, setMoForm, busy, loi, setLoi, chon, setChon, daChon, tongThue, cocGoiY } = r;
  const [del, setDel] = useState<DonThue | null>(null);
  const total = dons.filter((d) => d.status !== "canceled").reduce((s, d) => s + (d.total_price || 0), 0);

  return (
    <>
      <Section
        title="Thuê đồ"
        icon={Shirt}
        desc="Đồ lấy từ Kho đồ. Tiền thuê được ghi thành một hạng mục của hợp đồng nên đã nằm trong tổng."
        actions={
          <button
            type="button"
            className={btn("secondary", "sm")}
            disabled={dangNap}
            onClick={() => {
              setLoi(null);
              setMoForm(true);
            }}
            aria-label="Thêm đơn thuê"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Thêm đơn thuê</span>
          </button>
        }
        flush
      >
        {dangNap ? (
          <p className="flex items-center gap-2 px-4 py-5 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>
            <Loader2 size={15} className="animate-spin" /> Đang tải kho đồ…
          </p>
        ) : (
          <>
            {loi && !moForm && (
              <div className="px-4 pt-4 sm:px-5">
                <Callout tone="red">{loi}</Callout>
              </div>
            )}
            {dons.length === 0 ? (
              <Empty
                compact
                icon={Shirt}
                title="Chưa có đơn thuê đồ"
                hint="Chọn váy, vest, áo dài… trong kho cho hợp đồng này — tiền thuê tự vào bảng hạng mục."
              />
            ) : (
              <>
                <ul>
                  {dons.map((d) => (
                    <OrderRow key={d.id} d={d} onStep={(moi) => r.doiTrangThai(d, moi)} onDelete={() => setDel(d)} />
                  ))}
                </ul>
                <div className="flex items-baseline justify-between gap-3 px-4 py-3.5 sm:px-5" style={{ background: "var(--sf2)" }}>
                  <span className="text-[13.5px] font-semibold">Tổng tiền thuê</span>
                  <span className="v2-num text-[16px] font-bold">{vnd(total)}</span>
                </div>
              </>
            )}
          </>
        )}
      </Section>

      {moForm && (
        <Drawer
          open
          onClose={() => {
            setMoForm(false);
            setLoi(null);
          }}
          title="Thêm đơn thuê"
          desc="Tạo đơn là thêm luôn một hạng mục tiền thuê vào hợp đồng."
          width={520}
          footer={
            kho.length > 0 ? (
              <>
                <span className="mr-auto self-center text-[13px]" style={{ color: "var(--tx2)" }}>
                  {daChon.length} món · <b className="v2-num" style={{ color: "var(--tx)" }}>{vnd(tongThue)}</b>
                </span>
                <button
                  type="button"
                  className={btn("ghost")}
                  onClick={() => {
                    setMoForm(false);
                    setLoi(null);
                  }}
                >
                  Huỷ
                </button>
                <button type="button" className={btn("primary")} onClick={r.taoDon} disabled={busy || daChon.length === 0}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tạo đơn thuê
                </button>
              </>
            ) : undefined
          }
        >
          {kho.length === 0 ? (
            <Empty
              compact
              icon={PackageOpen}
              title="Kho đồ chưa có món nào sẵn sàng"
              hint="Thêm váy / vest / áo dài ở màn Kho đồ trước, rồi quay lại tạo đơn."
              action={
                <Link href="/dashboard/studio/rental" className={btn("secondary", "sm")}>
                  Mở Kho đồ
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <GroupLabel count={daChon.length ? `${daChon.length} đã chọn` : undefined}>Chọn món trong kho</GroupLabel>
                <ul className="mt-2 flex flex-col overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
                  {kho.map((m) => {
                    const on = !!chon[m.id];
                    return (
                      <li key={m.id} style={{ borderBottom: "1px solid var(--bd2)" }} className="last:!border-b-0">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setChon((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          style={{ background: on ? "var(--acS)" : undefined }}
                        >
                          <span
                            className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px]"
                            style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bdS)"}`, background: on ? "var(--ac)" : "var(--sf)", color: "#fff" }}
                            aria-hidden
                          >
                            {on && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold">{m.name}</span>
                            <span className="block truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                              {RENTAL_CATEGORY_LABEL[m.category]}
                              {m.code ? ` · ${m.code}` : ""}
                              {m.size ? ` · size ${m.size}` : ""}
                              {m.deposit > 0 ? ` · cọc ${vnd(m.deposit)}` : ""}
                            </span>
                          </span>
                          <span className="v2-num flex-none text-[13.5px] font-semibold">{m.rental_price > 0 ? vnd(m.rental_price) : "—"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ngày nhận đồ" htmlFor="rt-nhan" hint={eventDate ? "Bỏ trống = theo ngày chụp" : undefined}>
                  <DateInput
                    id="rt-nhan"
                    className={inputCls}
                    value={r.nhan}
                    onChange={r.setNhan}
                    allowPast
                    lunar={false}
                    placeholder={eventDate ? "theo ngày chụp" : "dd/mm/yyyy"}
                  />
                </Field>
                <Field label="Hẹn trả" htmlFor="rt-tra">
                  <DateInput id="rt-tra" className={inputCls} value={r.tra} onChange={r.setTra} allowPast lunar={false} />
                </Field>
              </div>
              <Field label="Cọc đồ" hint={cocGoiY > 0 ? `Gợi ý theo kho: ${vnd(cocGoiY)}` : undefined}>
                <MoneyInput className={inputCls} value={r.coc} onChange={r.setCoc} placeholder="0" ariaLabel="Cọc đồ" />
              </Field>
              {loi && <Callout tone="red">{loi}</Callout>}
            </div>
          )}
        </Drawer>
      )}

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        icon={Trash2}
        title="Gỡ đơn thuê này?"
        desc="Chỉ gỡ đơn thuê. Hạng mục tiền thuê trong hợp đồng giữ nguyên — xoá ở tab Hạng mục nếu cần."
        width={440}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setDel(null)}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("danger")}
              onClick={() => {
                const d = del;
                setDel(null);
                if (d) void r.xoaDon(d);
              }}
            >
              Gỡ đơn thuê
            </button>
          </>
        }
      />
    </>
  );
}

/* ── Một đơn thuê ── */
function OrderRow({ d, onStep, onDelete }: { d: DonThue; onStep: (moi: RentalOrderStatus) => void; onDelete: () => void }) {
  const names = d.rental_order_items?.map((x) => x.name).join(", ") || "—";
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <span className="v2-section-icon mt-0.5 flex-none">
        <Shirt size={16} />
      </span>
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[14px] font-semibold" title={names}>
            {names}
          </p>
          <p className="v2-num flex-none text-[14.5px] font-semibold">{vnd(d.total_price)}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          <Badge tone={STATUS_TONE[d.status]} dot>
            {RENTAL_ORDER_STATUS_LABEL[d.status]}
          </Badge>
          <span>
            {d.pickup_date ? `Nhận ${fmtDate(d.pickup_date)}` : "Chưa hẹn ngày nhận"}
            {d.return_date ? ` · trả ${fmtDate(d.return_date)}` : ""}
            {d.deposit_paid > 0 ? ` · cọc ${vnd(d.deposit_paid)}` : ""}
          </span>
        </div>
      </div>
      <div className="ml-auto flex flex-none items-center gap-1">
        {d.status !== "returned" && (
          <button type="button" className={btn(d.status === "overdue" ? "soft" : "secondary", "sm")} onClick={() => onStep(d.status === "booked" ? "picked_up" : "returned")}>
            {d.status === "booked" ? <Shirt size={15} /> : <PackageCheck size={15} />}
            {d.status === "booked" ? "Đã giao đồ" : "Đã nhận lại"}
          </button>
        )}
        <Menu label="Thao tác đơn thuê" items={[{ label: "Gỡ đơn thuê", icon: Trash2, danger: true, onClick: onDelete }]} />
      </div>
    </li>
  );
}
