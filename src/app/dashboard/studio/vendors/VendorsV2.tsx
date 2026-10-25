"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, Eye, FileText, Package, Pencil, Phone, Plus, Search, Store, Trash2, Truck, Wallet,
} from "lucide-react";
import {
  Avatar, Badge, Callout, Empty, Field, GroupLabel, InfoList, PageHead, Stack, Stat, StatGrid, Toolbar, btn, iconBtn,
  inputCls, toneFg,
} from "@/components/v2/kit";
import { Drawer, Menu, Modal, SearchInput, Segmented, Switch, Tabs, type MenuItem } from "@/components/v2/kit-client";
import { vnd, vndShort } from "@/lib/types";
import { fmtDate, fmtDow } from "@/lib/date";
import {
  ORDER_STATUS, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SOON_DAYS, VENDOR_KINDS, dueLabel, isClosed, lateness, nextStatus,
  sortByUrgency, vendorKindLabel, type OrderStatus, type VendorKind, type VendorOrder,
} from "@/lib/vendors";
import type { VendorsViewProps, VendorRow } from "./VendorsView";
import { draftOf, emptyOrder, emptyVendor, useVendors } from "./useVendors";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI — giao diện mới. Cùng dữ liệu, cùng thao tác
   với VendorsView (bản cũ, logic chung ở ./useVendors); khác ở cách bày:
     • 4 số liệu: đơn đang chạy · tiền đang treo · quá hẹn · nhà cung cấp.
     • Hai tab: Đơn đặt ngoài | Nhà cung cấp.
     • Đơn: một thanh lọc (tìm · nhà cung cấp · đang chạy / quá hẹn / đã giao /
       tất cả) thay cho ô tick "hiện cả đơn đã giao"; bảng nhóm theo hẹn xong
       (quá hẹn → sắp tới hẹn → đang chạy → chưa hẹn → đã giao), mỗi dòng một
       nút bước kế tiếp. Bấm dòng mở NGĂN KÉO sửa đơn (thay hộp thoại).
     • Nhà cung cấp: bảng gọn (loại, điện thoại, số đơn) → ngăn kéo sửa.
     • Tài khoản nhân viên (chỉ xem): ngăn kéo hiện thông tin, không có nút ghi.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "orders" | "vendors";
type OrderView = "open" | "late" | "done" | "all";
type VendorView = "active" | "inactive" | "all";

type GroupKey = "late" | "soon" | "ok" | "none" | "done";
const GROUPS: { key: GroupKey; label: string; dot: string }[] = [
  { key: "late", label: "Quá hẹn", dot: "var(--rd)" },
  { key: "soon", label: `Sắp tới hẹn · ${SOON_DAYS} ngày`, dot: "var(--am)" },
  { key: "ok", label: "Đang chạy", dot: "var(--ac)" },
  { key: "none", label: "Chưa hẹn ngày", dot: "var(--tx3)" },
  { key: "done", label: "Đã giao khách", dot: "var(--gn)" },
];

function groupOf(o: VendorOrder, today: string): GroupKey {
  if (isClosed(o.status)) return "done";
  if (!o.dueDate) return "none";
  const l = lateness(o, today).level;
  return l === "late" ? "late" : l === "soon" ? "soon" : "ok";
}

const dueColor = (o: VendorOrder, today: string) => {
  const l = lateness(o, today).level;
  return l === "late" ? "var(--rd)" : l === "soon" ? "var(--am)" : "var(--tx3)";
};

/** Tiến độ 4 bước: đã gửi → đang làm → đã nhận → đã giao khách. */
function OrderSteps({ status }: { status: OrderStatus }) {
  const at = ORDER_STATUS.indexOf(status);
  return (
    <span className="flex w-14 flex-none gap-[3px]" aria-hidden>
      {ORDER_STATUS.map((s, i) => (
        <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= at ? toneFg(ORDER_STATUS_TONE[status]) : "var(--bd2)" }} />
      ))}
    </span>
  );
}

export default function VendorsV2({ ownerId, initialVendors, initialOrders, contracts, readOnly }: VendorsViewProps) {
  const v = useVendors({ ownerId, initialVendors, initialOrders, contracts });
  const { today, vendors, model, sum, draft, setDraft, vDraft, setVDraft, busy } = v;
  const [tab, setTab] = useState<Tab>("orders");
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const activeVendors = vendors.filter((x) => x.active).length;

  const openOrder = (o: VendorOrder) => (readOnly ? setViewId(o.id) : setDraft(draftOf(o)));
  const viewing = viewId ? (model.find((o) => o.id === viewId) ?? null) : null;

  return (
    <Stack>
      {v.toastNode}
      <PageHead
        desc="Album in, makeup thuê ngoài, xe hoa… Đơn trễ hẹn nằm trên cùng, tiền tự ghi vào Thu chi."
        actions={
          readOnly ? null : tab === "orders" ? (
            <>
              <button type="button" className={btn("secondary")} onClick={() => setVDraft(emptyVendor())}>
                <Store size={16} /> Thêm nhà cung cấp
              </button>
              <button type="button" className={btn("primary")} onClick={() => setDraft(emptyOrder())}>
                <Plus size={17} /> Đơn mới
              </button>
            </>
          ) : (
            <>
              <button type="button" className={btn("secondary")} onClick={() => setDraft(emptyOrder())}>
                <Package size={16} /> Đơn mới
              </button>
              <button type="button" className={btn("primary")} onClick={() => setVDraft(emptyVendor())}>
                <Plus size={17} /> Thêm nhà cung cấp
              </button>
            </>
          )
        }
      />

      <StatGrid>
        <Stat icon={Package} tone="brand" label="Đơn đang chạy" value={sum.openCount} sub={`${sum.count} đơn tất cả`} />
        <Stat icon={Wallet} tone="amber" label="Tiền đang treo" value={vndShort(sum.open)} sub={`Tổng đã đặt ${vndShort(sum.total)}`} />
        <Stat
          icon={AlertTriangle}
          tone="red"
          label="Quá hẹn"
          value={sum.lateCount}
          valueTone={sum.lateCount ? "red" : undefined}
          sub={sum.lateCount ? "Cần gọi nhà cung cấp" : sum.soonCount ? `${sum.soonCount} đơn sắp tới hẹn` : "Không có đơn trễ"}
        />
        <Stat icon={Store} tone="teal" label="Nhà cung cấp" value={activeVendors} sub="Đang hợp tác" />
      </StatGrid>

      <div className="flex flex-col gap-4">
        <Tabs<Tab>
          label="Nhà cung cấp"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "orders",
              label: (
                <>
                  Đơn đặt ngoài
                  {sum.lateCount ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--rd)" }} title={`${sum.lateCount} đơn quá hẹn`} /> : null}
                </>
              ),
              icon: Truck,
              count: sum.openCount,
            },
            { value: "vendors", label: "Nhà cung cấp", icon: Store, count: vendors.length },
          ]}
        />
        {tab === "orders" ? (
          <OrdersPanel
            model={model}
            vendors={vendors}
            today={today}
            readOnly={readOnly}
            busy={busy}
            contractLabel={v.contractLabel}
            onOpen={openOrder}
            onAdvance={(o) => void v.advance(o)}
            onDelete={(o) => setConfirmId(o.id)}
            onAdd={() => setDraft(emptyOrder())}
          />
        ) : (
          <VendorsPanel
            vendors={vendors}
            model={model}
            readOnly={readOnly}
            onOpen={(x) => !readOnly && setVDraft(x)}
            onAdd={() => setVDraft(emptyVendor())}
          />
        )}
      </div>

      {/* ── Ngăn kéo: sửa / tạo đơn ── */}
      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Sửa đơn đặt ngoài" : "Đơn đặt ngoài mới"}
        desc="Đơn tự ghi một dòng vào Thu chi — sửa đơn thì sửa luôn dòng đó."
        width={500}
        footer={
          draft ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              {draft.id ? (
                <button type="button" className={btn("danger")} onClick={() => setConfirmId(draft.id)} disabled={busy}>
                  <Trash2 size={16} /> Xoá
                </button>
              ) : null}
              <button type="button" className={btn("ghost", "md", "ml-auto")} onClick={() => setDraft(null)}>
                Đóng
              </button>
              <button type="button" className={btn("primary")} onClick={() => void v.saveOrder()} disabled={busy}>
                <Check size={16} /> {busy ? "Đang lưu…" : "Lưu đơn"}
              </button>
            </div>
          ) : null
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <Field label="Nội dung đơn" htmlFor="vo-title">
              <input
                id="vo-title"
                className={inputCls}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Album 30x30 cao cấp, 40 trang…"
                autoFocus={!draft.id}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nhà cung cấp" htmlFor="vo-vendor">
                <select id="vo-vendor" className={inputCls} value={draft.vendor_id} onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value })}>
                  <option value="">— Chưa chọn —</option>
                  {vendors
                    .filter((x) => x.active)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Của hợp đồng" htmlFor="vo-contract">
                <select id="vo-contract" className={inputCls} value={draft.contract_id} onChange={(e) => setDraft({ ...draft, contract_id: e.target.value })}>
                  <option value="">— Không gắn hợp đồng —</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} · ` : ""}
                      {c.client_name || c.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số tiền (đ)" htmlFor="vo-amount">
                <input
                  id="vo-amount"
                  type="number"
                  min={0}
                  step={100000}
                  className={inputCls}
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Hẹn xong" htmlFor="vo-due">
                <input id="vo-due" type="date" className={inputCls} value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Trạng thái">
              <Segmented<OrderStatus>
                label="Trạng thái đơn"
                value={draft.status}
                onChange={(s) => setDraft({ ...draft, status: s })}
                options={ORDER_STATUS.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))}
              />
            </Field>
            <Field label="Ghi chú" htmlFor="vo-note">
              <textarea id="vo-note" className={inputCls} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <Callout tone="blue" icon={Wallet}>
              Đơn này tự ghi <b>một dòng</b> vào Thu chi (nhóm “Nhà cung cấp”), theo ngày hẹn xong. Sửa đơn thì sửa luôn dòng đó — tiền không bị đếm hai lần.
            </Callout>
          </div>
        ) : null}
      </Drawer>

      {/* ── Ngăn kéo: xem đơn (tài khoản chỉ xem) ── */}
      <Drawer open={!!viewing} onClose={() => setViewId(null)} title={viewing?.title ?? ""} desc="Chỉ xem — tài khoản nhân viên không sửa được đơn." width={460}>
        {viewing ? (
          <InfoList
            items={[
              { label: "Nhà cung cấp", value: viewing.vendorName || "Chưa chọn" },
              { label: "Của hợp đồng", value: v.contractLabel(viewing.contractId) || "Không gắn hợp đồng" },
              { label: "Hẹn xong", value: viewing.dueDate ? `${fmtDow(viewing.dueDate)} · ${fmtDate(viewing.dueDate)}` : "Chưa hẹn ngày" },
              { label: "Tình hình", value: <span style={{ color: dueColor(viewing, today) }}>{dueLabel(viewing, today)}</span> },
              { label: "Số tiền", value: <span className="v2-num">{vnd(viewing.amount)}</span> },
              { label: "Trạng thái", value: <Badge tone={ORDER_STATUS_TONE[viewing.status]} dot>{ORDER_STATUS_LABEL[viewing.status]}</Badge> },
              ...(viewing.note ? [{ label: "Ghi chú", value: viewing.note }] : []),
            ]}
          />
        ) : null}
      </Drawer>

      {/* ── Ngăn kéo: nhà cung cấp ── */}
      <Drawer
        open={!!vDraft}
        onClose={() => setVDraft(null)}
        title={vDraft?.id ? "Sửa nhà cung cấp" : "Nhà cung cấp mới"}
        desc="Khai một lần, chọn lại khi đặt đơn."
        width={460}
        footer={
          <div className="flex w-full items-center gap-2">
            <button type="button" className={btn("ghost", "md", "ml-auto")} onClick={() => setVDraft(null)}>
              Đóng
            </button>
            <button type="button" className={btn("primary")} onClick={() => void v.saveVendor()} disabled={busy}>
              <Check size={16} /> {busy ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        }
      >
        {vDraft ? (
          <div className="flex flex-col gap-4">
            <Field label="Tên" htmlFor="vd-name">
              <input id="vd-name" className={inputCls} value={vDraft.name} onChange={(e) => setVDraft({ ...vDraft, name: e.target.value })} placeholder="Xưởng album Minh Anh" autoFocus={!vDraft.id} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Loại" htmlFor="vd-kind">
                <select id="vd-kind" className={inputCls} value={vDraft.kind} onChange={(e) => setVDraft({ ...vDraft, kind: e.target.value as VendorKind })}>
                  {VENDOR_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {vendorKindLabel(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số điện thoại" htmlFor="vd-phone">
                <input id="vd-phone" className={inputCls} inputMode="tel" value={vDraft.phone ?? ""} onChange={(e) => setVDraft({ ...vDraft, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Người liên hệ" htmlFor="vd-contact">
              <input id="vd-contact" className={inputCls} value={vDraft.contact ?? ""} onChange={(e) => setVDraft({ ...vDraft, contact: e.target.value })} />
            </Field>
            <Field label="Ghi chú" htmlFor="vd-note">
              <textarea id="vd-note" className={inputCls} rows={2} value={vDraft.note ?? ""} onChange={(e) => setVDraft({ ...vDraft, note: e.target.value })} placeholder="Giá album 30x30, thời gian in 7 ngày…" />
            </Field>
            <Switch checked={vDraft.active} onChange={(on) => setVDraft({ ...vDraft, active: on })} label="Còn hợp tác" desc="Tắt để ẩn khỏi danh sách chọn khi đặt đơn mới." />
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        icon={Trash2}
        title="Xoá đơn đặt ngoài?"
        desc="Đơn và dòng chi đi kèm trong Thu chi sẽ bị xoá. Không hoàn tác được."
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirmId(null)}>
              Giữ lại
            </button>
            <button
              type="button"
              className={btn("danger")}
              disabled={busy}
              onClick={() => {
                const id = confirmId;
                setConfirmId(null);
                if (id) void v.removeOrder(id);
              }}
            >
              <Trash2 size={16} /> Xoá đơn
            </button>
          </>
        }
      />
    </Stack>
  );
}

/* ═══════════════════════════════ Tab đơn ═══════════════════════════════ */

function OrdersPanel({
  model,
  vendors,
  today,
  readOnly,
  busy,
  contractLabel,
  onOpen,
  onAdvance,
  onDelete,
  onAdd,
}: {
  model: VendorOrder[];
  vendors: VendorRow[];
  today: string;
  readOnly: boolean;
  busy: boolean;
  contractLabel: (id: string | null) => string | null;
  onOpen: (o: VendorOrder) => void;
  onAdvance: (o: VendorOrder) => void;
  onDelete: (o: VendorOrder) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<OrderView>("open");
  const [vendorF, setVendorF] = useState("");

  const matched = useMemo(() => {
    const n = q.trim().toLowerCase();
    return model.filter((o) => {
      if (vendorF && o.vendorId !== vendorF) return false;
      if (!n) return true;
      return [o.title, o.vendorName, o.note, contractLabel(o.contractId)].some((x) => x?.toLowerCase().includes(n));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, q, vendorF]);

  const inView = (o: VendorOrder, w: OrderView) =>
    w === "all" ? true : w === "done" ? isClosed(o.status) : w === "late" ? lateness(o, today).level === "late" : !isClosed(o.status);

  const groups = useMemo(() => {
    const list = sortByUrgency(
      matched.filter((o) => inView(o, view)),
      today,
    );
    return GROUPS.map((g) => ({ ...g, rows: list.filter((o) => groupOf(o, today) === g.key) })).filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, view, today]);

  const usedVendors = vendors.filter((x) => model.some((o) => o.vendorId === x.id));
  const filtering = !!q.trim() || !!vendorF;

  if (model.length === 0)
    return (
      <div className="v2-card">
        <Empty
          icon={Package}
          title="Chưa có đơn đặt ngoài nào"
          hint="Album in, makeup thuê ngoài, xe hoa — đặt ở đây để biết cái nào đã xong và tiền tự vào Thu chi."
          action={
            readOnly ? undefined : (
              <button type="button" className={btn("secondary")} onClick={onAdd}>
                <Plus size={16} /> Tạo đơn đầu tiên
              </button>
            )
          }
        />
      </div>
    );

  const menu = (o: VendorOrder): MenuItem[] =>
    readOnly
      ? [{ label: "Xem đơn", icon: Eye, onClick: () => onOpen(o) }]
      : [
          { label: "Sửa đơn", icon: Pencil, onClick: () => onOpen(o) },
          "divider",
          { label: "Xoá đơn", icon: Trash2, danger: true, onClick: () => onDelete(o) },
        ];

  const stepBtn = (o: VendorOrder, extra = "") => {
    const next = nextStatus(o.status);
    if (readOnly || !next) return null;
    return (
      <button type="button" className={btn("soft", "sm", extra)} onClick={() => onAdvance(o)} disabled={busy} title={`Chuyển sang “${ORDER_STATUS_LABEL[next]}”`}>
        {ORDER_STATUS_LABEL[next]} <ArrowRight size={14} />
      </button>
    );
  };

  return (
    <div className="v2-card overflow-hidden">
      <div className="v2-card-pad flex flex-col gap-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Toolbar>
          <div className="min-w-[220px] flex-[1_1_240px]">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm đơn, nhà cung cấp, khách…" className="w-full" />
          </div>
          {usedVendors.length > 1 && (
            <select aria-label="Nhà cung cấp" className={inputCls} value={vendorF} onChange={(e) => setVendorF(e.target.value)}>
              <option value="">Mọi nhà cung cấp</option>
              {usedVendors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
          <div className="w-full min-w-0">
            <Segmented<OrderView>
              label="Nhóm đơn"
              value={view}
              onChange={setView}
              options={[
                { value: "open", label: "Đang chạy", count: matched.filter((o) => inView(o, "open")).length },
                { value: "late", label: "Quá hẹn", count: matched.filter((o) => inView(o, "late")).length },
                { value: "done", label: "Đã giao khách", count: matched.filter((o) => inView(o, "done")).length },
                { value: "all", label: "Tất cả", count: matched.length },
              ]}
            />
          </div>
        </Toolbar>
        {filtering ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {matched.length} / {model.length} đơn khớp bộ lọc ·{" "}
            <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setVendorF(""); }}>
              Xoá lọc
            </button>
          </p>
        ) : null}
      </div>

      {groups.length === 0 ? (
        view === "open" && !filtering ? (
          <Empty compact icon={Check} title="Không còn đơn nào đang chạy" hint="Mọi đơn đã giao khách. Xem lại ở nhóm “Đã giao khách”." />
        ) : (
          <Empty compact icon={Search} title="Không có đơn nào khớp" hint="Thử chọn nhóm khác hoặc bỏ bớt bộ lọc." />
        )
      ) : (
        <>
          {/* Máy tính: bảng */}
          <div className="v2-table-wrap hidden lg:block">
            <table className="v2-table" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th>Đơn · hợp đồng</th>
                  <th style={{ width: "19%" }}>Nhà cung cấp</th>
                  <th style={{ width: 150 }}>Hẹn xong</th>
                  <th className="num" style={{ width: 118 }}>
                    Số tiền
                  </th>
                  <th style={{ width: 150 }}>Trạng thái</th>
                  <th style={{ width: readOnly ? 56 : 196 }} aria-label="Thao tác" />
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.key}>
                  <tr>
                    <td colSpan={6} style={{ background: "var(--sf2)", padding: "8px 16px" }}>
                      <GroupHead label={g.label} dot={g.dot} n={g.rows.length} />
                    </td>
                  </tr>
                  {g.rows.map((o) => (
                    <tr key={o.id} className="cursor-pointer" onClick={() => onOpen(o)}>
                      <td>
                        <p className="truncate font-semibold" title={o.title}>
                          {o.title}
                        </p>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {contractLabel(o.contractId) || "Không gắn hợp đồng"}
                        </p>
                      </td>
                      <td>
                        <p className="truncate text-[13.5px]" style={{ color: o.vendorName ? undefined : "var(--tx3)" }}>
                          {o.vendorName || "Chưa chọn"}
                        </p>
                      </td>
                      <td>
                        <p className="v2-num whitespace-nowrap text-[13.5px] font-semibold">
                          {o.dueDate ? `${fmtDow(o.dueDate)} · ${fmtDate(o.dueDate)}` : "—"}
                        </p>
                        <p className="whitespace-nowrap text-[12px] font-medium" style={{ color: dueColor(o, today) }}>
                          {dueLabel(o, today)}
                        </p>
                      </td>
                      <td className="num font-semibold">{vnd(o.amount)}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge tone={ORDER_STATUS_TONE[o.status]} dot>
                            {ORDER_STATUS_LABEL[o.status]}
                          </Badge>
                          <OrderSteps status={o.status} />
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {stepBtn(o)}
                          <Menu items={menu(o)} label={`Thao tác cho ${o.title}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          {/* Điện thoại / máy tính bảng: thẻ */}
          <div className="lg:hidden">
            {groups.map((g) => (
              <ul key={g.key}>
                <li className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                  <GroupHead label={g.label} dot={g.dot} n={g.rows.length} />
                </li>
                {g.rows.map((o) => (
                  <li key={o.id} className="relative px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <button type="button" className="absolute inset-0" aria-label={`Mở đơn ${o.title}`} onClick={() => onOpen(o)} />
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd2)" }}>
                        <Truck size={18} />
                      </span>
                      <div className="pointer-events-none min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{o.title}</p>
                          <span className="v2-num flex-none text-[13.5px] font-semibold">{vndShort(o.amount)}</span>
                        </div>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {[o.vendorName, contractLabel(o.contractId)].filter(Boolean).join(" · ") || "Chưa chọn nhà cung cấp"}
                        </p>
                      </div>
                      <div className="relative -mr-1.5 -mt-1 flex-none self-start">
                        <Menu items={menu(o)} label={`Thao tác cho ${o.title}`} />
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <Badge tone={ORDER_STATUS_TONE[o.status]} dot>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                        <span className="whitespace-nowrap text-[12.5px] font-semibold" style={{ color: dueColor(o, today) }}>
                          {dueLabel(o, today)}
                        </span>
                      </div>
                      {stepBtn(o, "relative flex-none")}
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GroupHead({ label, dot, n }: { label: string; dot: string; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: dot }} />
      <GroupLabel count={`${n} đơn`}>{label}</GroupLabel>
    </div>
  );
}

/* ═══════════════════════════ Tab nhà cung cấp ═══════════════════════════ */

function VendorsPanel({
  vendors,
  model,
  readOnly,
  onOpen,
  onAdd,
}: {
  vendors: VendorRow[];
  model: VendorOrder[];
  readOnly: boolean;
  onOpen: (v: VendorRow) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<VendorView>("all");
  const inactive = vendors.filter((x) => !x.active).length;

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return vendors.filter((x) => {
      if (view === "active" && !x.active) return false;
      if (view === "inactive" && x.active) return false;
      if (!n) return true;
      return [x.name, x.contact, x.phone, vendorKindLabel(x.kind), x.note].some((s) => s?.toLowerCase().includes(n));
    });
  }, [vendors, q, view]);

  if (vendors.length === 0)
    return (
      <div className="v2-card">
        <Empty
          icon={Store}
          title="Chưa có nhà cung cấp nào"
          hint="Xưởng album, thợ makeup ngoài, nhà xe — khai một lần rồi chọn khi đặt đơn."
          action={
            readOnly ? undefined : (
              <button type="button" className={btn("secondary")} onClick={onAdd}>
                <Plus size={16} /> Thêm nhà cung cấp
              </button>
            )
          }
        />
      </div>
    );

  const countOf = (id: string) => {
    const mine = model.filter((o) => o.vendorId === id);
    return { all: mine.length, open: mine.filter((o) => !isClosed(o.status)).length };
  };

  return (
    <div className="v2-card overflow-hidden">
      <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Toolbar>
          <div className="min-w-[220px] flex-[1_1_240px]">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, người liên hệ, số điện thoại…" className="w-full" />
          </div>
          {inactive > 0 && (
            <Segmented<VendorView>
              label="Tình trạng hợp tác"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "Tất cả", count: vendors.length },
                { value: "active", label: "Đang hợp tác", count: vendors.length - inactive },
                { value: "inactive", label: "Ngưng", count: inactive },
              ]}
            />
          )}
        </Toolbar>
      </div>

      {shown.length === 0 ? (
        <Empty compact icon={Search} title="Không tìm thấy nhà cung cấp" hint="Thử gõ ít chữ hơn." />
      ) : (
        <>
          <div className="v2-table-wrap hidden md:block">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th style={{ width: 150 }}>Loại</th>
                  <th style={{ width: 170 }}>Điện thoại</th>
                  <th className="num" style={{ width: 130 }}>
                    Đơn
                  </th>
                  <th style={{ width: 150 }}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const c = countOf(x.id);
                  return (
                    <tr key={x.id} className={readOnly ? undefined : "cursor-pointer"} onClick={() => onOpen(x)} style={x.active ? undefined : { opacity: 0.6 }}>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={x.name} size={34} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{x.name}</p>
                            <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                              {x.contact || x.note || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{vendorKindLabel(x.kind)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {x.phone ? (
                          <a href={`tel:${x.phone}`} className="v2-num inline-flex items-center gap-1.5 font-medium hover:underline" style={{ color: "var(--ac)" }}>
                            <Phone size={14} /> {x.phone}
                          </a>
                        ) : (
                          <span style={{ color: "var(--tx3)" }}>—</span>
                        )}
                      </td>
                      <td className="num">
                        <span className="font-semibold">{c.all}</span>
                        {c.open ? <span style={{ color: "var(--tx3)" }}> · {c.open} đang chạy</span> : null}
                      </td>
                      <td>
                        {x.active ? (
                          <Badge tone="green" dot>
                            Đang hợp tác
                          </Badge>
                        ) : (
                          <Badge tone="gray" dot>
                            Ngưng hợp tác
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden">
            {shown.map((x) => {
              const c = countOf(x.id);
              return (
                <li key={x.id} className="relative flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)", opacity: x.active ? 1 : 0.6 }}>
                  {readOnly ? null : <button type="button" className="absolute inset-0" aria-label={`Sửa ${x.name}`} onClick={() => onOpen(x)} />}
                  <Avatar name={x.name} size={38} />
                  <div className="pointer-events-none min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{x.name}</p>
                    <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      {vendorKindLabel(x.kind)} · {c.all} đơn{c.open ? ` · ${c.open} đang chạy` : ""}
                      {x.active ? "" : " · ngưng hợp tác"}
                    </p>
                  </div>
                  {x.phone ? (
                    <a href={`tel:${x.phone}`} className={iconBtn("relative")} aria-label={`Gọi ${x.name}`} title={x.phone}>
                      <Phone size={17} />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {readOnly ? (
        <p className="flex items-center gap-1.5 px-4 py-3 text-[12.5px] sm:px-5" style={{ color: "var(--tx3)", borderTop: "1px solid var(--bd)", background: "var(--sf2)" }}>
          <FileText size={14} /> Tài khoản nhân viên chỉ xem được sổ nhà cung cấp.
        </p>
      ) : null}
    </div>
  );
}
