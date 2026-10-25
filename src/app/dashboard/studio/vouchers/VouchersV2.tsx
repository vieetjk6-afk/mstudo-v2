"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Ban, Check, Gift, Plus, Printer, RotateCcw, Search, Send, Ticket, Wallet } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Empty, Field, PageHead, Stack, Stat, StatGrid, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, Modal, SearchInput, Segmented, Switch, type MenuItem } from "@/components/v2/kit-client";
import { IssuedVoucher } from "@/app/dashboard/studio/contracts/[id]/LoyaltyVoucherCard";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { vnd, vndShort } from "@/lib/types";
import { VOUCHER_STATE_LABEL, isLoyalty, voucherState, voucherValueLabel, type Voucher, type VoucherState } from "@/lib/vouchers";
import type { VouchersProps } from "./VouchersView";
import { useVouchers } from "./useVouchers";
import VoucherProgramV2 from "./VoucherProgramV2";

/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER & THẺ QUÀ — giao diện mới. Cùng logic với VouchersView (./useVouchers)
   và VoucherProgramCard (./useVoucherProgram); khác ở cách sắp xếp:
     • 4 số liệu: đã bán · đã thu · còn nợ khách · voucher ưu đãi còn hiệu lực.
     • Chương trình ưu đãi thu thành MỘT dải tóm tắt có công tắc; cài đặt chi
       tiết mở bằng ngăn kéo.
     • Danh sách: tìm theo mã/tên + lọc loại (Segmented) + lọc trạng thái. Mỗi
       dòng MỘT nút theo việc tiếp theo (Đã thu / In thẻ / Xem & gửi), các thao
       tác khác (trả lại, huỷ, mở hợp đồng) vào ⋯.
     • Bán voucher bằng ngăn kéo; xem & gửi voucher ưu đãi bằng hộp thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATE_TONE: Record<VoucherState, Tone> = { usable: "green", unpaid: "amber", expired: "gray", redeemed: "blue", void: "red" };

export default function VouchersV2({ initial, migrated, studioName, studioPhone, studioHost, program, programMigrated, packages = [] }: VouchersProps) {
  const v = useVouchers({ initial, studioName, studioPhone });
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return n
      ? v.shown.filter((x) => noAccent(`${x.code} ${x.title} ${x.buyer_name ?? ""} ${x.recipient_name ?? ""} ${x.buyer_phone ?? ""}`).includes(n))
      : v.shown;
  }, [v.shown, q]);

  /** Thao tác chính của một dòng — đúng việc tiếp theo cần làm. */
  const primaryAction = (x: Voucher) => {
    if (x.status === "active" && !x.paid)
      return (
        <button type="button" onClick={() => void v.act(x, "mark_paid")} disabled={v.busy} className={btn("soft", "sm")}>
          <Check size={15} /> Đã thu
        </button>
      );
    if (x.status !== "void" && !isLoyalty(x))
      return (
        <button type="button" onClick={() => v.printCard(x)} className={btn("secondary", "sm")}>
          <Printer size={15} /> In thẻ
        </button>
      );
    if (isLoyalty(x) && x.public_token && x.status !== "void")
      return (
        <button type="button" onClick={() => v.setSharing(x)} className={btn("secondary", "sm")}>
          <Send size={15} /> Xem & gửi
        </button>
      );
    return null;
  };

  const rowMenu = (x: Voucher) => {
    const items: MenuItem[] = [];
    if (x.status === "active" && !x.paid) items.push({ label: "Đánh dấu đã thu tiền", icon: Check, disabled: v.busy, onClick: () => void v.act(x, "mark_paid") });
    if (x.status !== "void" && !isLoyalty(x)) items.push({ label: "In thẻ quà", icon: Printer, onClick: () => v.printCard(x) });
    if (isLoyalty(x) && x.public_token && x.status !== "void") items.push({ label: "Xem & gửi voucher", icon: Send, onClick: () => v.setSharing(x) });
    if (isLoyalty(x) && x.source_contract_id) items.push({ label: "Hợp đồng tặng voucher", icon: ArrowUpRight, href: `/dashboard/studio/contracts/${x.source_contract_id}` });
    if (x.redeemed_contract_id) items.push({ label: "Hợp đồng đã dùng voucher", icon: ArrowUpRight, href: `/dashboard/studio/contracts/${x.redeemed_contract_id}` });
    if (isLoyalty(x) && x.status === "redeemed")
      items.push({ label: "Trả lại “còn hiệu lực”", hint: "Khi đã gỡ dòng giảm giá khỏi hợp đồng", icon: RotateCcw, disabled: v.busy, onClick: () => void v.act(x, "release") });
    if (x.status === "active") {
      if (items.length) items.push("divider");
      items.push({ label: "Huỷ voucher", hint: "Thẻ không dùng được nữa", icon: Ban, danger: true, disabled: v.busy, onClick: () => void v.act(x, "void") });
    }
    return items.length ? <Menu label={`Thao tác với voucher ${x.code}`} width={250} items={items} /> : <span className="inline-block w-9" />;
  };

  const people = (x: Voucher) =>
    [x.buyer_name ? `mua: ${x.buyer_name}` : null, x.recipient_name ? `tặng: ${x.recipient_name}` : null].filter(Boolean).join(" · ") || "—";

  const valueSub = (x: Voucher) => (isLoyalty(x) ? "quà tặng" : x.price !== x.amount ? `bán ${vnd(x.price)}` : null);

  return (
    <Stack>
      <PageHead
        desc="Bán thẻ quà mùa lễ và quản lý voucher ưu đãi đã tặng khách. Khách dùng cả hai ở tab Thanh toán của hợp đồng."
        actions={
          <button type="button" onClick={() => v.setDraft(v.newDraft())} disabled={!migrated} className={btn("primary")}>
            <Plus size={17} /> Bán voucher
          </button>
        }
      />

      {!migrated ? (
        <Callout tone="amber" title="Chưa bật được voucher">
          Chạy <code className="break-all">supabase/migrations/studio_vouchers.sql</code> trong Supabase SQL Editor để bắt đầu bán voucher.
        </Callout>
      ) : null}

      <StatGrid>
        <Stat icon={Ticket} tone="brand" label="Thẻ quà đã bán" value={v.sum.sold} sub="Không tính thẻ đã huỷ" />
        <Stat icon={Wallet} tone="green" label="Đã thu từ bán thẻ" value={vndShort(v.sum.collected)} sub={v.sum.redeemed > 0 ? `Đã dùng ${vndShort(v.sum.redeemed)} ở hợp đồng` : "Chưa thẻ nào được dùng"} />
        <Stat
          icon={Gift}
          tone="amber"
          label="Còn nợ khách"
          value={vndShort(v.sum.outstanding)}
          valueTone={v.sum.outstanding > 0 ? "amber" : undefined}
          sub={`${v.sum.outstandingCount} thẻ còn hiệu lực`}
        />
        <Stat icon={Ticket} tone="violet" label="Voucher ưu đãi" value={v.loyaltyActive} sub={`Còn hiệu lực · ${v.loyaltyCount} đã tặng`} />
      </StatGrid>

      <VoucherProgramV2 initial={program} migrated={programMigrated} toast={v.toast} packages={packages} />

      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <div className="min-w-[200px] flex-1">
              <SearchInput value={q} onChange={setQ} placeholder="Mã thẻ, người mua, người được tặng…" className="w-full" />
            </div>
            <Segmented<"all" | "gift" | "loyalty">
              label="Loại voucher"
              value={v.kind}
              onChange={v.setKind}
              options={[
                { value: "all", label: "Mọi loại" },
                { value: "gift", label: "Thẻ quà" },
                { value: "loyalty", label: "Ưu đãi lần sau" },
              ]}
            />
            <select aria-label="Trạng thái voucher" className={inputCls} value={v.filter} onChange={(e) => v.setFilter(e.target.value as VoucherState | "all")}>
              <option value="all">Mọi trạng thái</option>
              {(["usable", "unpaid", "redeemed", "expired", "void"] as const).map((k) => (
                <option key={k} value={k}>{VOUCHER_STATE_LABEL[k]}</option>
              ))}
            </select>
          </Toolbar>
        </div>

        {shown.length === 0 ? (
          v.list.length === 0 ? (
            <Empty icon={Ticket} title="Chưa có voucher" hint="Bấm “Bán voucher” để tạo thẻ quà đầu tiên. Voucher ưu đãi tự hiện ở đây khi được tặng." />
          ) : (
            <Empty compact icon={Search} title="Không có voucher nào khớp" hint="Thử chọn “Mọi loại” và “Mọi trạng thái”." />
          )
        ) : (
          <>
            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Voucher</th>
                    <th style={{ width: 170 }}>Trạng thái</th>
                    <th>Khách</th>
                    <th style={{ width: 120 }}>Hạn dùng</th>
                    <th className="num" style={{ width: 180 }}>Giá trị</th>
                    <th style={{ width: 170 }} aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((x) => {
                    const st = voucherState(x, v.today);
                    return (
                      <tr key={x.id} style={st === "void" || st === "expired" ? { opacity: 0.65 } : undefined}>
                        <td>
                          <p className="font-mono text-[13.5px] font-semibold tracking-wide">{x.code}</p>
                          <p className="max-w-[260px] truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{x.title}</p>
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <Badge tone={STATE_TONE[st]} dot>{VOUCHER_STATE_LABEL[st]}</Badge>
                            {isLoyalty(x) ? <Badge tone="violet">Ưu đãi lần sau</Badge> : null}
                          </div>
                        </td>
                        <td>
                          <p className="max-w-[240px] truncate text-[13px]">{people(x)}</p>
                          {x.buyer_phone ? <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{x.buyer_phone}</p> : null}
                        </td>
                        <td className="text-[13px]">{x.expires_on ? fmtDate(x.expires_on) : <span style={{ color: "var(--tx3)" }}>Không hạn</span>}</td>
                        <td className="num">
                          <p className="font-semibold">{voucherValueLabel(x)}</p>
                          {valueSub(x) ? <p className="text-[12px] font-normal" style={{ color: "var(--tx3)" }}>{valueSub(x)}</p> : null}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {primaryAction(x)}
                            {rowMenu(x)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {shown.map((x) => {
                const st = voucherState(x, v.today);
                return (
                  <div key={x.id} className="v2-row flex-col !items-stretch gap-2" style={st === "void" || st === "expired" ? { opacity: 0.7 } : undefined}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[14px] font-semibold tracking-wide">{x.code}</p>
                        <p className="v2-row-sub">{x.title}{x.expires_on ? ` · hạn ${fmtDate(x.expires_on)}` : ""}</p>
                      </div>
                      <div className="flex-none text-right">
                        <p className="v2-num text-[14px] font-semibold">{voucherValueLabel(x)}</p>
                        {valueSub(x) ? <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{valueSub(x)}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={STATE_TONE[st]} dot>{VOUCHER_STATE_LABEL[st]}</Badge>
                      {isLoyalty(x) ? <Badge tone="violet">Ưu đãi</Badge> : null}
                      <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{people(x)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {primaryAction(x)}
                      {rowMenu(x)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Drawer
        open={!!v.draft}
        onClose={() => v.setDraft(null)}
        title="Bán voucher mới"
        desc="Mã thẻ tự sinh (vd QUA-7K3M9P, không có ký tự dễ nhầm 0/O, 1/I)."
        footer={
          <>
            <button type="button" onClick={() => v.setDraft(null)} className={btn("ghost")}>Đóng</button>
            <button type="button" onClick={() => void v.create()} disabled={v.busy} className={btn("primary")}>
              <Ticket size={16} /> {v.busy ? "Đang tạo…" : "Tạo voucher"}
            </button>
          </>
        }
      >
        {v.draft ? (
          <DraftForm d={v.draft} set={(patch) => v.draft && v.setDraft({ ...v.draft, ...patch })} />
        ) : null}
      </Drawer>

      <Modal open={!!v.sharing} onClose={() => v.setSharing(null)} title={v.sharing ? `Voucher ${v.sharing.code}` : "Voucher"} width={760}>
        {v.sharing ? (
          <IssuedVoucher
            v={v.sharing}
            today={v.today}
            studioHost={studioHost}
            studioName={studioName}
            clientName={v.sharing.recipient_name ?? ""}
            clientPhone={v.sharing.buyer_phone ?? ""}
            clientMessenger=""
            contractId={v.sharing.source_contract_id ?? null}
          />
        ) : null}
      </Modal>
      {v.toastNode}
    </Stack>
  );
}

type DraftT = NonNullable<ReturnType<typeof useVouchers>["draft"]>;

function DraftForm({ d, set }: { d: DraftT; set: (patch: Partial<DraftT>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tên thẻ">
        <input className={inputCls} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Voucher chụp ảnh gia đình" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mệnh giá" hint="Số tiền trừ vào hợp đồng.">
          <MoneyInput
            className={`${inputCls} text-right`}
            value={d.amount}
            onChange={(n) => set({ amount: n, price: d.price === d.amount ? n : d.price })}
            ariaLabel="Mệnh giá"
          />
        </Field>
        <Field label="Giá bán thực thu" hint="Bán rẻ hơn mệnh giá thì nhập giá thật.">
          <MoneyInput className={`${inputCls} text-right`} value={d.price} onChange={(n) => set({ price: n })} ariaLabel="Giá bán thực thu" />
        </Field>
        <Field label="Người mua">
          <input className={inputCls} value={d.buyer_name} onChange={(e) => set({ buyer_name: e.target.value })} />
        </Field>
        <Field label="SĐT người mua">
          <input className={inputCls} inputMode="tel" value={d.buyer_phone} onChange={(e) => set({ buyer_phone: e.target.value })} />
        </Field>
        <Field label="Người được tặng" hint="In trên thẻ.">
          <input className={inputCls} value={d.recipient_name} onChange={(e) => set({ recipient_name: e.target.value })} />
        </Field>
        <Field label="Hạn dùng">
          <input type="date" className={inputCls} value={d.expires_on} onChange={(e) => set({ expires_on: e.target.value })} />
        </Field>
      </div>
      <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
        <Switch checked={d.paid} onChange={(x) => set({ paid: x })} label="Đã thu tiền" desc="Chưa thu tiền thì thẻ chưa dùng được." />
        {d.paid ? (
          <div className="pb-3">
            <Segmented<"transfer" | "cash">
              size="sm"
              label="Hình thức thu"
              value={d.paid_method}
              onChange={(m) => set({ paid_method: m })}
              options={[
                { value: "transfer", label: "Chuyển khoản" },
                { value: "cash", label: "Tiền mặt" },
              ]}
            />
          </div>
        ) : null}
      </div>
      <Field label="Ghi chú">
        <textarea className={inputCls} rows={2} value={d.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
    </div>
  );
}
