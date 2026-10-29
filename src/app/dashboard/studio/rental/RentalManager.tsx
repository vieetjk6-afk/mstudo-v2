"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Shirt,
  PackageOpen,
  Boxes,
  ClipboardList,
  Search,
  AlertTriangle,
  Wallet,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  RENTAL_CATEGORIES,
  RENTAL_CATEGORY_LABEL,
  RENTAL_ITEM_STATUS_LABEL,
  RENTAL_ORDER_STATUS_LABEL,
  vnd,
  type RentalCategory,
  type RentalItem,
  type RentalItemStatus,
  type RentalOrderStatus,
  type RentalOrderWithItems,
} from "@/lib/types";
import { useUiV2 } from "@/components/v2/UiV2Context";
import {
  ITEM_STATUSES,
  ORDER_STATUSES,
  emptyItemForm,
  emptyOrderForm,
  filterItems,
  filterOrders,
  isOverdue,
  useOrderLines,
  useRental,
  type ItemForm,
  type Line,
  type OrderForm,
} from "./useRental";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const RentalV2 = dynamic(() => import("./RentalV2"));

type Tab = "inventory" | "orders";

/** Hai tab của màn Phòng váy — gom thành bảng để hai nút không lệch nhau. */
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "inventory", label: "Kho trang phục", icon: Boxes },
  { key: "orders", label: "Đơn thuê", icon: ClipboardList },
];

export type RentalManagerProps = {
  ownerId: string;
  initialItems: RentalItem[];
  initialOrders: RentalOrderWithItems[];
};

/** Giao diện mới → RentalV2; bản cũ giữ nguyên bên dưới. Logic chung ở ./useRental. */
export default function RentalManager(props: RentalManagerProps) {
  return useUiV2() ? <RentalV2 {...props} /> : <RentalManagerV1 {...props} />;
}

function RentalManagerV1(props: RentalManagerProps) {
  const r = useRental(props);
  const { items, orders, unitsOut, stats } = r;
  const [tab, setTab] = useState<Tab>("inventory");

  return (
    <div className="page-in">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Kho trang phục (váy cưới, vest, áo dài, phụ kiện) và đơn cho thuê.
      </p>

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Boxes size={16} />} label="Tổng kho" value={`${stats.totalItems} món`} />
        <StatCard icon={<PackageOpen size={16} />} label="Đang cho thuê" value={`${stats.rentedUnits} món`} />
        <StatCard icon={<Wallet size={16} />} label="Cọc đang giữ" value={vnd(stats.depositsHeld)} />
        <StatCard
          icon={stats.overdue > 0 ? <AlertTriangle size={16} /> : <TrendingUp size={16} />}
          label={stats.overdue > 0 ? "Quá hạn" : "Thuê lẻ tháng này"}
          value={stats.overdue > 0 ? `${stats.overdue} đơn` : vnd(stats.revenueMonth)}
          alert={stats.overdue > 0}
        />
      </div>

      {/* Dải tab: tab đang chọn nổi lên bằng bề mặt thẻ + viền, KHÔNG bằng #fff
          cứng — nền tối thì trắng đè lên chữ sáng là không đọc được. Và tab
          đang chọn phải tự đặt màu chữ, nếu chỉ đổi nền thì nó thừa hưởng màu
          chữ của khối cha. */}
      <div className="mb-5 inline-flex rounded-xl p-1" style={{ background: "var(--sf2)" }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={on}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition"
              style={
                on
                  ? { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx)", fontWeight: 650 }
                  : { border: "1px solid transparent", color: "var(--tx2)" }
              }
            >
              <t.icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "inventory" ? (
        <Inventory items={items} unitsOut={unitsOut} addItem={r.addItem} removeItem={r.removeItem} setItemStatus={r.setItemStatus} />
      ) : (
        <Orders
          items={items}
          orders={orders}
          availById={r.availById}
          createOrder={r.createOrder}
          setOrderStatus={r.setOrderStatus}
          removeOrder={r.removeOrder}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="card p-4" style={alert ? { borderColor: "#d0687a" } : undefined}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: alert ? "#d0687a" : "var(--text3)" }}>
        {icon} {label}
      </div>
      <p className="mt-1 text-lg font-semibold" style={alert ? { color: "#d0687a" } : undefined}>{value}</p>
    </div>
  );
}

/* ─────────────────────────── Kho trang phục ─────────────────────────── */

function Inventory({
  items,
  unitsOut,
  addItem,
  removeItem,
  setItemStatus,
}: {
  items: RentalItem[];
  unitsOut: Map<string, number>;
  addItem: (f: ItemForm) => Promise<boolean>;
  removeItem: (id: string) => Promise<boolean>;
  setItemStatus: (id: string, status: RentalItemStatus) => Promise<void>;
}) {
  const [f, setF] = useState<ItemForm>(emptyItemForm);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<RentalCategory | "all">("all");

  const filtered = useMemo(() => filterItems(items, q, filterCat), [items, q, filterCat]);

  const grouped = useMemo(() => {
    const map = new Map<RentalCategory, RentalItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return map;
  }, [filtered]);

  async function add() {
    if (!f.name.trim()) return;
    setBusy(true);
    const ok = await addItem(f);
    setBusy(false);
    if (ok) setF(emptyItemForm());
  }

  async function remove(id: string) {
    await removeItem(id);
  }

  async function setStatus(id: string, status: RentalItemStatus) {
    await setItemStatus(id, status);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card h-fit p-6">
        <h2 className="mb-4 font-serif text-lg font-medium">Thêm trang phục</h2>
        <div className="space-y-3">
          <div className="field"><label className="label">Tên</label><input className="input" placeholder="VD: Váy cưới đuôi cá trắng" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
          <div className="field">
            <label className="label">Loại</label>
            <select className="input" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value as RentalCategory }))}>
              {RENTAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{RENTAL_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Mã</label><input className="input" placeholder="SKU" value={f.code} onChange={(e) => setF((p) => ({ ...p, code: e.target.value }))} /></div>
            <div className="field"><label className="label">Số lượng</label><input className="input" type="number" min={1} value={f.quantity} onChange={(e) => setF((p) => ({ ...p, quantity: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Size</label><input className="input" value={f.size} onChange={(e) => setF((p) => ({ ...p, size: e.target.value }))} /></div>
            <div className="field"><label className="label">Màu</label><input className="input" value={f.color} onChange={(e) => setF((p) => ({ ...p, color: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Giá thuê</label><input className="input" type="number" min={0} placeholder="0" value={f.rental_price} onChange={(e) => setF((p) => ({ ...p, rental_price: e.target.value }))} /></div>
            <div className="field"><label className="label">Tiền cọc</label><input className="input" type="number" min={0} placeholder="0" value={f.deposit} onChange={(e) => setF((p) => ({ ...p, deposit: e.target.value }))} /></div>
          </div>
          <div className="field"><label className="label">Ghi chú</label><input className="input" placeholder="Tuỳ chọn" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></div>
          <button onClick={add} disabled={busy} className="btn-primary w-full"><Plus size={15} /> {busy ? "Đang thêm…" : "Thêm vào kho"}</button>
        </div>
      </div>

      <div className="lg:col-span-2">
        {/* Search + category filter */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
            <input
              className="input !pl-9"
              placeholder="Tìm theo tên, mã, màu…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input !w-auto" value={filterCat} onChange={(e) => setFilterCat(e.target.value as RentalCategory | "all")}>
            <option value="all">Tất cả loại</option>
            {RENTAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{RENTAL_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="card flex items-center justify-center py-16 text-sm" style={{ color: "var(--text3)" }}>
            {items.length === 0 ? "Chưa có trang phục nào." : "Không tìm thấy món phù hợp."}
          </div>
        ) : (
          <div className="space-y-6">
            {RENTAL_CATEGORIES.filter((c) => grouped.has(c)).map((c) => (
              <div key={c}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text2)" }}>
                  <Shirt size={15} /> {RENTAL_CATEGORY_LABEL[c]}
                  <span className="text-xs font-normal" style={{ color: "var(--text3)" }}>({grouped.get(c)!.length})</span>
                </h3>
                <div className="space-y-2">
                  {grouped.get(c)!.map((e) => {
                    const out = unitsOut.get(e.id) ?? 0;
                    const avail = Math.max(0, (e.quantity || 0) - out);
                    return (
                      <div key={e.id} className="card flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {e.name}
                            {e.code ? <span className="ml-2 text-xs font-normal" style={{ color: "var(--text3)" }}>#{e.code}</span> : null}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text3)" }}>
                            {[e.size && `Size ${e.size}`, e.color].filter(Boolean).join(" · ")}
                            {e.rental_price ? ` · Thuê ${vnd(e.rental_price)}` : ""}
                            {e.deposit ? ` · Cọc ${vnd(e.deposit)}` : ""}
                          </p>
                          {e.note ? <p className="mt-0.5 truncate text-xs italic" style={{ color: "var(--text3)" }}>{e.note}</p> : null}
                          <p className="mt-1 text-xs">
                            <span
                              className="rounded-md px-1.5 py-0.5 font-medium"
                              style={{
                                background: avail > 0 ? "var(--s-greenS)" : "rgba(208,104,122,.12)",
                                color: avail > 0 ? "var(--s-green)" : "#d0687a",
                              }}
                            >
                              Còn {avail}/{e.quantity}
                            </span>
                            {out > 0 ? <span className="ml-2" style={{ color: "var(--text3)" }}>Đang thuê {out}</span> : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <select
                            className="input !h-8 !py-0 text-xs"
                            value={e.status}
                            onChange={(ev) => setStatus(e.id, ev.target.value as RentalItemStatus)}
                          >
                            {ITEM_STATUSES.map((s) => (
                              <option key={s} value={s}>{RENTAL_ITEM_STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                          <button onClick={() => remove(e.id)} aria-label="Xoá trang phục" className="btn-ghost px-2.5 py-1.5 text-xs"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Đơn thuê ─────────────────────────────── */

function Orders({
  items,
  orders,
  availById,
  createOrder,
  setOrderStatus,
  removeOrder,
}: {
  items: RentalItem[];
  orders: RentalOrderWithItems[];
  availById: Map<string, number>;
  createOrder: (f: OrderForm, lines: Line[]) => Promise<boolean>;
  setOrderStatus: (id: string, status: RentalOrderStatus) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
}) {
  const [f, setF] = useState<OrderForm>(emptyOrderForm);
  const { lines, setLines, selectableItems, total, addLine, setLineQty, removeLine } = useOrderLines(items, availById);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<RentalOrderStatus | "all">("all");

  const shownOrders = useMemo(() => filterOrders(orders, filter), [orders, filter]);

  async function create() {
    if (!f.client_name.trim() || lines.length === 0) return;
    setBusy(true);
    const ok = await createOrder(f, lines);
    setBusy(false);
    if (!ok) return;
    setF(emptyOrderForm());
    setLines([]);
  }

  async function setStatus(id: string, status: RentalOrderStatus) {
    await setOrderStatus(id, status);
  }

  async function remove(id: string) {
    await removeOrder(id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card h-fit p-6">
        <h2 className="mb-4 font-serif text-lg font-medium">Tạo đơn thuê</h2>
        <div className="space-y-3">
          <div className="field"><label className="label">Tên khách</label><input className="input" value={f.client_name} onChange={(e) => setF((p) => ({ ...p, client_name: e.target.value }))} /></div>
          <div className="field"><label className="label">SĐT</label><input className="input" value={f.client_phone} onChange={(e) => setF((p) => ({ ...p, client_phone: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Ngày nhận</label><input className="input" type="date" value={f.pickup_date} onChange={(e) => setF((p) => ({ ...p, pickup_date: e.target.value }))} /></div>
            <div className="field"><label className="label">Ngày trả</label><input className="input" type="date" value={f.return_date} onChange={(e) => setF((p) => ({ ...p, return_date: e.target.value }))} /></div>
          </div>

          <div className="field">
            <label className="label">Chọn trang phục</label>
            <select className="input" value="" onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
              <option value="">+ Thêm món…</option>
              {selectableItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {RENTAL_CATEGORY_LABEL[i.category]} · {i.name} ({vnd(i.rental_price)}) · còn {availById.get(i.id)}
                </option>
              ))}
            </select>
            {selectableItems.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>Không còn món nào sẵn sàng để thuê.</p>
            )}
          </div>

          {lines.length > 0 && (
            <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--surface2, var(--bg2))" }}>
              {lines.map((l) => (
                <div key={l.item_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.max > 1 && (
                      <input
                        type="number"
                        min={1}
                        max={l.max}
                        value={l.qty}
                        onChange={(e) => setLineQty(l.item_id, Number(e.target.value))}
                        className="input !h-7 !w-14 !py-0 text-center text-xs"
                        title={`Tối đa ${l.max}`}
                      />
                    )}
                    <span style={{ color: "var(--text3)" }}>{vnd(l.price * l.qty)}</span>
                    <button onClick={() => removeLine(l.item_id)} aria-label="Xoá món khỏi đơn" className="text-xs" style={{ color: "var(--text3)" }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                <span>Tổng</span><span>{vnd(total)}</span>
              </div>
            </div>
          )}

          <div className="field"><label className="label">Cọc đã thu</label><input className="input" type="number" min={0} placeholder="0" value={f.deposit_paid} onChange={(e) => setF((p) => ({ ...p, deposit_paid: e.target.value }))} /></div>
          <div className="field"><label className="label">Ghi chú</label><input className="input" placeholder="Tuỳ chọn" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></div>
          <button onClick={create} disabled={busy || !f.client_name.trim() || lines.length === 0} className="btn-primary w-full"><Plus size={15} /> {busy ? "Đang tạo…" : "Tạo đơn"}</button>
        </div>
      </div>

      <div className="lg:col-span-2">
        {/* Status filter */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Tất cả</FilterChip>
          {ORDER_STATUSES.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>{RENTAL_ORDER_STATUS_LABEL[s]}</FilterChip>
          ))}
        </div>

        {shownOrders.length === 0 ? (
          <div className="card flex items-center justify-center py-16 text-sm" style={{ color: "var(--text3)" }}>
            {orders.length === 0 ? "Chưa có đơn thuê nào." : "Không có đơn ở trạng thái này."}
          </div>
        ) : (
          <div className="space-y-2">
            {shownOrders.map((o) => {
              const overdue = isOverdue(o);
              return (
                <div key={o.id} className="card p-4" style={overdue ? { borderColor: "#d0687a" } : undefined}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <PackageOpen size={15} style={{ color: "var(--text3)" }} />
                        {o.client_name}
                        {o.client_phone ? <span className="text-xs font-normal" style={{ color: "var(--text3)" }}>· {o.client_phone}</span> : null}
                        {overdue && o.status !== "overdue" ? (
                          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ background: "rgba(208,104,122,.12)", color: "#d0687a" }}>
                            <AlertTriangle size={12} /> Quá hạn trả
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text3)" }}>
                        {o.items.map((l) => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(", ") || "—"}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text3)" }}>
                        {[o.pickup_date && `Nhận ${o.pickup_date}`, o.return_date && `Trả ${o.return_date}`].filter(Boolean).join(" · ")}
                        {` · Tổng ${vnd(o.total_price)}`}
                        {o.deposit_paid ? ` · Cọc ${vnd(o.deposit_paid)}` : ""}
                        {o.returned_at ? ` · Đã trả ${o.returned_at}` : ""}
                      </p>
                      {o.note ? <p className="mt-0.5 truncate text-xs italic" style={{ color: "var(--text3)" }}>{o.note}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        className="input !h-8 !py-0 text-xs"
                        value={o.status}
                        onChange={(e) => setStatus(o.id, e.target.value as RentalOrderStatus)}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{RENTAL_ORDER_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button onClick={() => remove(o.id)} aria-label="Xoá đơn thuê" className="btn-ghost px-2.5 py-1.5 text-xs"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
      style={
        active
          ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid var(--acM)" }
          : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
      }
    >
      {children}
    </button>
  );
}
