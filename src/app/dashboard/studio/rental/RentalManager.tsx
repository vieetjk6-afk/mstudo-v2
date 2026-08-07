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
import { avatarColor, initials } from "@/lib/avatar";
import { Panel, Pill, StatCard, EmptyState } from "@/components/studio/ui";
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
  /* Bản thiết kế chỉ có MỘT nút "Thêm" trên hàng công cụ; form nhập bung ra khi
     bấm, thay vì chiếm cứng một cột bên trái như bản cũ. */
  const [adding, setAdding] = useState(false);
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
    <div className="page-in flex flex-col gap-3.5">
      {/* KPI — bốn con số của kho, dùng chung khối StatCard của bản thiết kế. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <StatCard icon={Boxes} tone="brand" label="Tổng kho" value={`${stats.totalItems} món`} sub="Tính cả món đang cho thuê" />
        <StatCard icon={PackageOpen} tone="blue" label="Đang cho thuê" value={`${stats.rentedUnits} món`} sub="Chưa nhận lại" />
        <StatCard icon={Wallet} tone="amber" label="Cọc đang giữ" value={vnd(stats.depositsHeld)} sub="Phải trả khách khi nhận đồ" />
        <StatCard
          icon={stats.overdue > 0 ? AlertTriangle : TrendingUp}
          tone={stats.overdue > 0 ? "red" : "green"}
          label={stats.overdue > 0 ? "Quá hạn trả" : "Doanh thu tháng"}
          value={stats.overdue > 0 ? `${stats.overdue} đơn` : vnd(stats.revenueMonth)}
          sub={stats.overdue > 0 ? "Cần gọi khách ngay" : "Tiền thuê đã chốt"}
        />
      </div>

      {/* Thanh chuyển tab + nút thêm — đúng hàng công cụ của bản thiết kế. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-none gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {([["inventory", "Kho trang phục", Boxes], ["orders", "Đơn thuê", ClipboardList]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setAdding(false); }}
              className="flex items-center gap-1.5 rounded-[8px] px-[15px] py-[6.5px] text-[12.5px] font-semibold"
              style={tab === key ? { background: "var(--sf)", color: "var(--tx)", boxShadow: "0 1px 2px rgba(20,15,25,.08)" } : { color: "var(--tx2)" }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
          style={adding ? { border: "1px solid var(--bd)" } : { background: "var(--ac)", color: "#fff" }}
        >
          <Plus size={17} /> {adding ? "Đóng" : tab === "inventory" ? "Thêm trang phục" : "Tạo đơn thuê"}
        </button>
      </div>

      {tab === "inventory" ? (
        <Inventory supabase={supabase} ownerId={ownerId} items={items} setItems={setItems} unitsOut={unitsOut} adding={adding} setAdding={setAdding} />
      ) : (
        <Orders supabase={supabase} ownerId={ownerId} items={items} orders={orders} setOrders={setOrders} unitsOut={unitsOut} adding={adding} setAdding={setAdding} />
      )}
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
  adding,
  setAdding,
}: {
  supabase: ReturnType<typeof createClient>;
  ownerId: string;
  items: RentalItem[];
  setItems: React.Dispatch<React.SetStateAction<RentalItem[]>>;
  unitsOut: Map<string, number>;
  adding: boolean;
  setAdding: React.Dispatch<React.SetStateAction<boolean>>;
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
      setAdding(false);
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
    <div className="flex flex-col gap-3.5">
      {adding && (
        <Panel className="p-4">
          <p className="mb-3 text-[13.5px] font-bold">Thêm trang phục vào kho</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2"><label className="label mb-1 block uppercase">Tên</label><input className="input w-full" placeholder="VD: Váy cưới đuôi cá trắng" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <label className="label mb-1 block uppercase">Loại</label>
              <select className="input w-full" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value as RentalCategory }))}>
                {RENTAL_CATEGORIES.map((c) => <option key={c} value={c}>{RENTAL_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div><label className="label mb-1 block uppercase">Mã</label><input className="input w-full" placeholder="SKU" value={f.code} onChange={(e) => setF((p) => ({ ...p, code: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Số lượng</label><input className="input w-full" type="number" min={1} value={f.quantity} onChange={(e) => setF((p) => ({ ...p, quantity: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Size</label><input className="input w-full" value={f.size} onChange={(e) => setF((p) => ({ ...p, size: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Màu</label><input className="input w-full" value={f.color} onChange={(e) => setF((p) => ({ ...p, color: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Giá thuê</label><input className="input w-full" type="number" min={0} placeholder="0" value={f.rental_price} onChange={(e) => setF((p) => ({ ...p, rental_price: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Tiền cọc</label><input className="input w-full" type="number" min={0} placeholder="0" value={f.deposit} onChange={(e) => setF((p) => ({ ...p, deposit: e.target.value }))} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="label mb-1 block uppercase">Ghi chú</label><input className="input w-full" placeholder="Tuỳ chọn" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></div>
            <div className="flex items-end">
              <button
                onClick={add}
                disabled={busy || !f.name.trim()}
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm vào kho"}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* Tìm kiếm + lọc loại */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
          <input className="input !pl-9 w-full" placeholder="Tìm theo tên, mã, màu…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto flex-none" value={filterCat} onChange={(e) => setFilterCat(e.target.value as RentalCategory | "all")}>
          <option value="all">Tất cả loại</option>
          {RENTAL_CATEGORIES.map((c) => <option key={c} value={c}>{RENTAL_CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Shirt}
            title={items.length === 0 ? "Kho trang phục còn trống" : "Không tìm thấy món phù hợp"}
            hint={items.length === 0 ? "Bấm “Thêm trang phục” để nhập món đầu tiên — váy cưới, vest, áo dài hay phụ kiện." : "Thử xoá bớt từ khoá hoặc chọn lại loại."}
          />
        </Panel>
      ) : (
        RENTAL_CATEGORIES.filter((c) => grouped.has(c)).map((c) => (
          <div key={c}>
            <p className="mb-2 flex items-center gap-2 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>
              <Shirt size={13} /> {RENTAL_CATEGORY_LABEL[c]} · {grouped.get(c)!.length}
            </p>
            {/* Thẻ ngang: ảnh 94px bên trái, thông tin bên phải — dáng thiết kế. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {grouped.get(c)!.map((e) => {
                const out = unitsOut.get(e.id) ?? 0;
                const avail = Math.max(0, (e.quantity || 0) - out);
                return (
                  <Panel key={e.id} className="flex overflow-hidden">
                    <div className="flex w-[94px] flex-none items-center justify-center" style={{ background: "var(--sf2)" }}>
                      {e.cover_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={e.cover_url} alt="" className="h-full w-full object-cover" />
                        : <Shirt size={24} style={{ color: "var(--tx3)" }} />}
                    </div>
                    <div className="min-w-0 flex-1 px-3.5 py-[13px]">
                      <p className="text-[13.5px] font-bold leading-[1.3]" style={{ textWrap: "pretty" }}>{e.name}</p>
                      <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {[e.code && `#${e.code}`, e.size && `Size ${e.size}`, e.color].filter(Boolean).join(" · ") || "Chưa ghi mã"}
                      </p>
                      <p className="tnum mt-2 text-[14px] font-bold">{e.rental_price ? vnd(e.rental_price) : "Chưa đặt giá"}</p>
                      {e.deposit ? <p className="tnum text-[11px]" style={{ color: "var(--tx3)" }}>Cọc {vnd(e.deposit)}</p> : null}
                      {e.note ? <p className="mt-1 truncate text-[11px] italic" style={{ color: "var(--tx3)" }}>{e.note}</p> : null}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Pill tone={avail > 0 ? "green" : "red"}>Còn {avail}/{e.quantity}</Pill>
                        {out > 0 ? <Pill tone="blue">Đang thuê {out}</Pill> : null}
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5">
                        <select
                          className="input !h-8 !py-0 flex-1 text-[11.5px]"
                          value={e.status}
                          onChange={(ev) => setStatus(e.id, ev.target.value as RentalItemStatus)}
                        >
                          {ITEM_STATUSES.map((s) => <option key={s} value={s}>{RENTAL_ITEM_STATUS_LABEL[s]}</option>)}
                        </select>
                        <button
                          onClick={() => remove(e.id)}
                          aria-label="Xoá trang phục"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px]"
                          style={{ color: "var(--tx3)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        ))
      )}
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
  adding,
  setAdding,
}: {
  supabase: ReturnType<typeof createClient>;
  ownerId: string;
  items: RentalItem[];
  orders: RentalOrderWithItems[];
  setOrders: React.Dispatch<React.SetStateAction<RentalOrderWithItems[]>>;
  unitsOut: Map<string, number>;
  adding: boolean;
  setAdding: React.Dispatch<React.SetStateAction<boolean>>;
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
    setAdding(false);
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
    <div className="flex flex-col gap-3.5">
      {adding && (
        <Panel className="p-4">
          <p className="mb-3 text-[13.5px] font-bold">Tạo đơn thuê</p>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label mb-1 block uppercase">Tên khách</label><input className="input w-full" value={f.client_name} onChange={(e) => setF((p) => ({ ...p, client_name: e.target.value }))} /></div>
              <div><label className="label mb-1 block uppercase">SĐT</label><input className="input w-full" value={f.client_phone} onChange={(e) => setF((p) => ({ ...p, client_phone: e.target.value }))} /></div>
              <div><label className="label mb-1 block uppercase">Ngày nhận</label><input className="input w-full" type="date" value={f.pickup_date} onChange={(e) => setF((p) => ({ ...p, pickup_date: e.target.value }))} /></div>
              <div><label className="label mb-1 block uppercase">Ngày trả</label><input className="input w-full" type="date" value={f.return_date} onChange={(e) => setF((p) => ({ ...p, return_date: e.target.value }))} /></div>
              <div><label className="label mb-1 block uppercase">Cọc đã thu</label><input className="input w-full" type="number" min={0} placeholder="0" value={f.deposit_paid} onChange={(e) => setF((p) => ({ ...p, deposit_paid: e.target.value }))} /></div>
              <div><label className="label mb-1 block uppercase">Ghi chú</label><input className="input w-full" placeholder="Tuỳ chọn" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></div>
            </div>

            <div>
              <label className="label mb-1 block uppercase">Trang phục trong đơn</label>
              <select className="input w-full" value="" onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
                <option value="">+ Thêm món…</option>
                {selectableItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {RENTAL_CATEGORY_LABEL[i.category]} · {i.name} ({vnd(i.rental_price)}) · còn {availById.get(i.id)}
                  </option>
                ))}
              </select>
              {selectableItems.length === 0 && (
                <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>Không còn món nào sẵn sàng để thuê.</p>
              )}

              {lines.length > 0 && (
                <div className="mt-2.5 space-y-2 rounded-[11px] p-3" style={{ background: "var(--sf2)" }}>
                  {lines.map((l) => (
                    <div key={l.item_id} className="flex items-center gap-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                      {l.max > 1 && (
                        <input
                          type="number"
                          min={1}
                          max={l.max}
                          value={l.qty}
                          onChange={(e) => setLineQty(l.item_id, Number(e.target.value))}
                          className="input !h-7 !w-14 !py-0 flex-none text-center text-[11.5px]"
                          title={`Tối đa ${l.max}`}
                        />
                      )}
                      <span className="tnum flex-none" style={{ color: "var(--tx3)" }}>{vnd(l.price * l.qty)}</span>
                      <button onClick={() => removeLine(l.item_id)} aria-label="Xoá món khỏi đơn" className="flex-none" style={{ color: "var(--tx3)" }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 text-[13px] font-bold" style={{ borderTop: "1px solid var(--bd)" }}>
                    <span>Tổng</span><span className="tnum">{vnd(total)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={create}
                disabled={busy || !f.client_name.trim() || lines.length === 0}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                <Plus size={16} /> {busy ? "Đang tạo…" : "Tạo đơn"}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* Lọc theo trạng thái */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Tất cả</FilterChip>
        {ORDER_STATUSES.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>{RENTAL_ORDER_STATUS_LABEL[s]}</FilterChip>
        ))}
      </div>

      {shownOrders.length === 0 ? (
        <Panel>
          <EmptyState
            icon={PackageOpen}
            title={orders.length === 0 ? "Chưa có đơn thuê nào" : "Không có đơn ở trạng thái này"}
            hint={orders.length === 0 ? "Bấm “Tạo đơn thuê” để ghi đơn đầu tiên — chọn khách, ngày lấy / trả và các món trong kho." : "Chọn lại bộ lọc phía trên để xem các đơn khác."}
          />
        </Panel>
      ) : (
        /* Dòng đơn thuê theo bản thiết kế: avatar chữ cái, LẤY ĐỒ / TRẢ ĐỒ có
           nhãn viết hoa riêng, tiền căn phải, pill trạng thái không xuống dòng. */
        <Panel>
          {shownOrders.map((o) => {
            const overdue = isOverdue(o);
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-[18px] py-3.5"
                style={{ borderTop: "1px solid var(--bd2)" }}
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11.5px] font-bold text-white"
                  style={{ background: avatarColor(o.client_name) }}
                >
                  {initials(o.client_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold">
                    {o.client_name}
                    {o.client_phone ? <span className="ml-1.5 text-[11.5px] font-medium" style={{ color: "var(--tx3)" }}>· {o.client_phone}</span> : null}
                  </p>
                  <p className="mt-px truncate text-[12px]" style={{ color: "var(--tx2)" }}>
                    {o.items.map((l) => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(", ") || "—"}
                  </p>
                  {o.note ? <p className="truncate text-[11px] italic" style={{ color: "var(--tx3)" }}>{o.note}</p> : null}
                </div>

                <div className="flex-none text-center">
                  <p className="text-[10.5px] font-semibold" style={{ color: "var(--tx3)" }}>LẤY ĐỒ</p>
                  <p className="tnum mt-px text-[12.5px] font-semibold">{o.pickup_date || "—"}</p>
                </div>
                <div className="flex-none text-center">
                  <p className="text-[10.5px] font-semibold" style={{ color: overdue ? "var(--rd)" : "var(--tx3)" }}>TRẢ ĐỒ</p>
                  <p className="tnum mt-px text-[12.5px] font-semibold" style={overdue ? { color: "var(--rd)" } : undefined}>
                    {o.returned_at || o.return_date || "—"}
                  </p>
                </div>
                <div className="w-[120px] flex-none text-right">
                  <p className="tnum text-[14px] font-bold">{vnd(o.total_price)}</p>
                  <p className="tnum text-[11px]" style={{ color: "var(--tx3)" }}>{o.deposit_paid ? `Cọc ${vnd(o.deposit_paid)}` : "Chưa cọc"}</p>
                </div>

                {overdue && o.status !== "overdue" ? (
                  <Pill tone="red"><AlertTriangle size={12} /> Quá hạn trả</Pill>
                ) : null}

                <select
                  className="input !h-8 !w-auto !py-0 flex-none text-[11.5px]"
                  value={o.status}
                  onChange={(e) => setStatus(o.id, e.target.value as RentalOrderStatus)}
                >
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{RENTAL_ORDER_STATUS_LABEL[s]}</option>)}
                </select>
                <button
                  onClick={() => remove(o.id)}
                  aria-label="Xoá đơn thuê"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px]"
                  style={{ color: "var(--tx3)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </Panel>
      )}
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
