"use client";

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
import { createClient } from "@/lib/supabase/client";
import { todayVN } from "@/lib/date";
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

type Tab = "inventory" | "orders";

const ITEM_STATUSES: RentalItemStatus[] = ["available", "maintenance", "retired"];
const ORDER_STATUSES: RentalOrderStatus[] = [
  "booked",
  "picked_up",
  "returned",
  "overdue",
  "canceled",
];

/** Orders in these statuses still hold physical stock (item is "out"). */
const ACTIVE_ORDER_STATUSES: RentalOrderStatus[] = ["booked", "picked_up", "overdue"];

const todayISO = () => todayVN();

/**
 * How many units of each item are currently out (reserved by active orders).
 * Keyed by item_id → total qty across all non-returned / non-canceled orders.
 */
function computeUnitsOut(orders: RentalOrderWithItems[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of orders) {
    if (!ACTIVE_ORDER_STATUSES.includes(o.status)) continue;
    for (const l of o.items) {
      if (!l.item_id) continue;
      out.set(l.item_id, (out.get(l.item_id) ?? 0) + (l.qty || 0));
    }
  }
  return out;
}

/** An order is effectively overdue when its return date has passed & it isn't back. */
function isOverdue(o: RentalOrderWithItems): boolean {
  if (o.status === "returned" || o.status === "canceled") return false;
  return !!o.return_date && o.return_date < todayISO();
}

export default function RentalManager({
  ownerId,
  initialItems,
  initialOrders,
}: {
  ownerId: string;
  initialItems: RentalItem[];
  initialOrders: RentalOrderWithItems[];
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("inventory");
  const [items, setItems] = useState<RentalItem[]>(initialItems);
  const [orders, setOrders] = useState<RentalOrderWithItems[]>(initialOrders);

  const unitsOut = useMemo(() => computeUnitsOut(orders), [orders]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
    const rentedUnits = [...unitsOut.values()].reduce((s, n) => s + n, 0);
    const depositsHeld = activeOrders.reduce((s, o) => s + (o.deposit_paid || 0), 0);
    // Revenue booked this month (by pickup date, falling back to created date).
    const month = todayISO().slice(0, 7);
    const revenueMonth = orders
      .filter((o) => o.status !== "canceled")
      .filter((o) => (o.pickup_date ?? o.created_at).slice(0, 7) === month)
      .reduce((s, o) => s + (o.total_price || 0), 0);
    const overdue = orders.filter(isOverdue).length;
    return {
      totalItems: items.reduce((s, i) => s + (i.quantity || 0), 0),
      rentedUnits,
      depositsHeld,
      revenueMonth,
      overdue,
    };
  }, [orders, items, unitsOut]);

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
          label={stats.overdue > 0 ? "Quá hạn" : "Doanh thu tháng"}
          value={stats.overdue > 0 ? `${stats.overdue} đơn` : vnd(stats.revenueMonth)}
          alert={stats.overdue > 0}
        />
      </div>

      <div className="mb-5 inline-flex rounded-xl p-1" style={{ background: "var(--surface2, var(--bg2))" }}>
        <button
          onClick={() => setTab("inventory")}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition"
          style={tab === "inventory" ? { background: "var(--card, #fff)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { color: "var(--text2)" }}
        >
          <Boxes size={15} /> Kho trang phục
        </button>
        <button
          onClick={() => setTab("orders")}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition"
          style={tab === "orders" ? { background: "var(--card, #fff)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { color: "var(--text2)" }}
        >
          <ClipboardList size={15} /> Đơn thuê
        </button>
      </div>

      {tab === "inventory" ? (
        <Inventory supabase={supabase} ownerId={ownerId} items={items} setItems={setItems} unitsOut={unitsOut} />
      ) : (
        <Orders supabase={supabase} ownerId={ownerId} items={items} orders={orders} setOrders={setOrders} unitsOut={unitsOut} />
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
  supabase,
  ownerId,
  items,
  setItems,
  unitsOut,
}: {
  supabase: ReturnType<typeof createClient>;
  ownerId: string;
  items: RentalItem[];
  setItems: React.Dispatch<React.SetStateAction<RentalItem[]>>;
  unitsOut: Map<string, number>;
}) {
  const emptyForm = {
    name: "",
    category: "dress" as RentalCategory,
    code: "",
    size: "",
    color: "",
    rental_price: "",
    deposit: "",
    quantity: "1",
    note: "",
  };
  const [f, setF] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<RentalCategory | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filterCat !== "all" && it.category !== filterCat) return false;
      if (!needle) return true;
      return [it.name, it.code, it.color, it.size]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [items, q, filterCat]);

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
    const { data, error } = await supabase
      .from("rental_items")
      .insert({
        owner_id: ownerId,
        name: f.name.trim(),
        category: f.category,
        code: f.code.trim() || null,
        size: f.size.trim() || null,
        color: f.color.trim() || null,
        rental_price: Number(f.rental_price) || 0,
        deposit: Number(f.deposit) || 0,
        quantity: Number(f.quantity) || 1,
        note: f.note.trim() || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setItems((p) => [...p, data as RentalItem]);
      setF(emptyForm);
    }
  }

  async function remove(id: string) {
    if ((unitsOut.get(id) ?? 0) > 0) {
      alert("Món này đang có trong đơn thuê chưa trả — không thể xoá.");
      return;
    }
    await supabase.from("rental_items").delete().eq("id", id);
    setItems((p) => p.filter((e) => e.id !== id));
  }

  async function setStatus(id: string, status: RentalItemStatus) {
    await supabase.from("rental_items").update({ status }).eq("id", id);
    setItems((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
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

type Line = { item_id: string; name: string; price: number; qty: number; max: number };

function Orders({
  supabase,
  ownerId,
  items,
  orders,
  setOrders,
  unitsOut,
}: {
  supabase: ReturnType<typeof createClient>;
  ownerId: string;
  items: RentalItem[];
  orders: RentalOrderWithItems[];
  setOrders: React.Dispatch<React.SetStateAction<RentalOrderWithItems[]>>;
  unitsOut: Map<string, number>;
}) {
  const emptyForm = {
    client_name: "",
    client_phone: "",
    pickup_date: "",
    return_date: "",
    deposit_paid: "",
    note: "",
  };
  const [f, setF] = useState(emptyForm);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<RentalOrderStatus | "all">("all");

  // Available units per item = quantity − units already out in other active orders.
  const availById = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.status !== "available") continue;
      m.set(it.id, Math.max(0, (it.quantity || 0) - (unitsOut.get(it.id) ?? 0)));
    }
    return m;
  }, [items, unitsOut]);

  const selectableItems = items.filter((i) => i.status === "available" && (availById.get(i.id) ?? 0) > 0);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const shownOrders = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "overdue") return orders.filter((o) => o.status === "overdue" || isOverdue(o));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  function addLine(itemId: string) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;
    const max = availById.get(itemId) ?? 0;
    if (max <= 0) return;
    setLines((p) => {
      if (p.some((l) => l.item_id === itemId)) return p;
      return [...p, { item_id: it.id, name: it.name, price: it.rental_price, qty: 1, max }];
    });
  }

  function setLineQty(itemId: string, qty: number) {
    setLines((p) => p.map((l) => (l.item_id === itemId ? { ...l, qty: Math.max(1, Math.min(l.max, qty)) } : l)));
  }

  function removeLine(itemId: string) {
    setLines((p) => p.filter((l) => l.item_id !== itemId));
  }

  async function create() {
    if (!f.client_name.trim() || lines.length === 0) return;
    setBusy(true);
    const { data: order, error } = await supabase
      .from("rental_orders")
      .insert({
        owner_id: ownerId,
        client_name: f.client_name.trim(),
        client_phone: f.client_phone.trim() || null,
        pickup_date: f.pickup_date || null,
        return_date: f.return_date || null,
        total_price: total,
        deposit_paid: Number(f.deposit_paid) || 0,
        note: f.note.trim() || null,
      })
      .select("*")
      .single();

    if (error || !order) {
      setBusy(false);
      alert("Không tạo được đơn. Thử lại nhé.");
      return;
    }

    const { data: lineRows } = await supabase
      .from("rental_order_items")
      .insert(
        lines.map((l) => ({
          order_id: order.id,
          item_id: l.item_id,
          name: l.name,
          price: l.price,
          qty: l.qty,
        }))
      )
      .select("*");

    setBusy(false);
    setOrders((p) => [{ ...(order as RentalOrderWithItems), items: lineRows ?? [] }, ...p]);
    setF(emptyForm);
    setLines([]);
  }

  async function setStatus(id: string, status: RentalOrderStatus) {
    const patch: Record<string, unknown> = { status };
    if (status === "returned") patch.returned_at = todayISO();
    else patch.returned_at = null;
    await supabase.from("rental_orders").update(patch).eq("id", id);
    setOrders((p) =>
      p.map((o) =>
        o.id === id
          ? { ...o, status, returned_at: status === "returned" ? (patch.returned_at as string) : null }
          : o
      )
    );
  }

  async function remove(id: string) {
    await supabase.from("rental_orders").delete().eq("id", id);
    setOrders((p) => p.filter((o) => o.id !== id));
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
