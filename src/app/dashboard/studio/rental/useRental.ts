"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayVN } from "@/lib/date";
import type {
  RentalCategory, RentalItem, RentalItemStatus, RentalOrderStatus, RentalOrderWithItems,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Phòng váy (bản cũ RentalManager và bản mới
   RentalV2): kho, đơn thuê, số món đang ra ngoài, số liệu đầu trang và MỌI câu
   ghi Supabase (thêm/xoá/đổi tình trạng món, tạo/đổi trạng thái/xoá đơn). Hai
   bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ITEM_STATUSES: RentalItemStatus[] = ["available", "maintenance", "retired"];
export const ORDER_STATUSES: RentalOrderStatus[] = ["booked", "picked_up", "returned", "overdue", "canceled"];

/** Orders in these statuses still hold physical stock (item is "out"). */
export const ACTIVE_ORDER_STATUSES: RentalOrderStatus[] = ["booked", "picked_up", "overdue"];

const todayISO = () => todayVN();

/**
 * How many units of each item are currently out (reserved by active orders).
 * Keyed by item_id → total qty across all non-returned / non-canceled orders.
 */
export function computeUnitsOut(orders: RentalOrderWithItems[]): Map<string, number> {
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
export function isOverdue(o: RentalOrderWithItems): boolean {
  if (o.status === "returned" || o.status === "canceled") return false;
  return !!o.return_date && o.return_date < todayISO();
}

/** Lọc kho theo từ khoá (tên, mã, màu, size) và loại — dùng chung hai bản. */
export function filterItems(items: RentalItem[], q: string, cat: RentalCategory | "all"): RentalItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter((it) => {
    if (cat !== "all" && it.category !== cat) return false;
    if (!needle) return true;
    return [it.name, it.code, it.color, it.size].filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
  });
}

/** Lọc đơn theo trạng thái; "overdue" gồm cả đơn đã qua ngày trả mà chưa trả. */
export function filterOrders(orders: RentalOrderWithItems[], filter: RentalOrderStatus | "all"): RentalOrderWithItems[] {
  if (filter === "all") return orders;
  if (filter === "overdue") return orders.filter((o) => o.status === "overdue" || isOverdue(o));
  return orders.filter((o) => o.status === filter);
}

/* ── Biểu mẫu ── */
export const emptyItemForm = () => ({
  name: "",
  category: "dress" as RentalCategory,
  code: "",
  size: "",
  color: "",
  rental_price: "",
  deposit: "",
  quantity: "1",
  note: "",
});
export type ItemForm = ReturnType<typeof emptyItemForm>;

export const emptyOrderForm = () => ({
  client_name: "",
  client_phone: "",
  pickup_date: "",
  return_date: "",
  deposit_paid: "",
  note: "",
});
export type OrderForm = ReturnType<typeof emptyOrderForm>;

export type Line = { item_id: string; name: string; price: number; qty: number; max: number };

export function useRental({
  ownerId,
  initialItems,
  initialOrders,
}: {
  ownerId: string;
  initialItems: RentalItem[];
  initialOrders: RentalOrderWithItems[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<RentalItem[]>(initialItems);
  const [orders, setOrders] = useState<RentalOrderWithItems[]>(initialOrders);

  const unitsOut = useMemo(() => computeUnitsOut(orders), [orders]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
    const rentedUnits = [...unitsOut.values()].reduce((s, n) => s + n, 0);
    const depositsHeld = activeOrders.reduce((s, o) => s + (o.deposit_paid || 0), 0);
    // Doanh thu tháng (tính theo ngày nhận đồ, không có thì theo ngày tạo đơn).
    //
    // BỎ QUA đơn đã gắn hợp đồng: tiền thuê của những đơn đó được ghi thành một
    // hạng mục của hợp đồng (xem ContractRentalPanel), nên đã nằm trong doanh
    // thu hợp đồng rồi. Cộng ở đây nữa là cùng một khoản đếm hai lần, và chủ
    // studio cộng hai màn lại sẽ ra con số không có thật.
    const month = todayISO().slice(0, 7);
    const revenueMonth = orders
      .filter((o) => o.status !== "canceled")
      .filter((o) => !o.contract_id)
      .filter((o) => (o.pickup_date ?? o.created_at).slice(0, 7) === month)
      .reduce((s, o) => s + (o.total_price || 0), 0);
    const overdue = orders.filter(isOverdue).length;
    return {
      totalItems: items.reduce((s, i) => s + (i.quantity || 0), 0),
      rentedUnits,
      depositsHeld,
      revenueMonth,
      overdue,
      activeOrders: activeOrders.length,
    };
  }, [orders, items, unitsOut]);

  // Available units per item = quantity − units already out in other active orders.
  const availById = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.status !== "available") continue;
      m.set(it.id, Math.max(0, (it.quantity || 0) - (unitsOut.get(it.id) ?? 0)));
    }
    return m;
  }, [items, unitsOut]);

  /* ── Kho ── */

  /** Thêm một món vào kho. Trả về true nếu đã lưu (để bản vẽ dọn biểu mẫu). */
  async function addItem(f: ItemForm): Promise<boolean> {
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
    if (!error && data) {
      setItems((p) => [...p, data as RentalItem]);
      return true;
    }
    return false;
  }

  /** Xoá một món — chặn khi món còn nằm trong đơn chưa trả. Trả về true nếu đã xoá. */
  async function removeItem(id: string): Promise<boolean> {
    if ((unitsOut.get(id) ?? 0) > 0) {
      alert("Món này đang có trong đơn thuê chưa trả — không thể xoá.");
      return false;
    }
    await supabase.from("rental_items").delete().eq("id", id);
    setItems((p) => p.filter((e) => e.id !== id));
    return true;
  }

  async function setItemStatus(id: string, status: RentalItemStatus) {
    await supabase.from("rental_items").update({ status }).eq("id", id);
    setItems((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  /* ── Đơn thuê ── */

  /** Tạo đơn + các dòng món. Trả về true nếu đã tạo (để bản vẽ dọn biểu mẫu). */
  async function createOrder(f: OrderForm, lines: Line[]): Promise<boolean> {
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
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
      alert("Không tạo được đơn. Thử lại nhé.");
      return false;
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

    setOrders((p) => [{ ...(order as RentalOrderWithItems), items: lineRows ?? [] }, ...p]);
    return true;
  }

  async function setOrderStatus(id: string, status: RentalOrderStatus) {
    const patch: Record<string, unknown> = { status };
    if (status === "returned") patch.returned_at = todayISO();
    else patch.returned_at = null;
    await supabase.from("rental_orders").update(patch).eq("id", id);
    setOrders((p) =>
      p.map((o) =>
        o.id === id ? { ...o, status, returned_at: status === "returned" ? (patch.returned_at as string) : null } : o
      )
    );
  }

  async function removeOrder(id: string) {
    await supabase.from("rental_orders").delete().eq("id", id);
    setOrders((p) => p.filter((o) => o.id !== id));
  }

  return {
    items, orders, unitsOut, stats, availById,
    addItem, removeItem, setItemStatus, createOrder, setOrderStatus, removeOrder,
  };
}

/** Một dòng món mới từ kho (null nếu món không còn sẵn). */
function lineFor(items: RentalItem[], availById: Map<string, number>, itemId: string): Line | null {
  const it = items.find((i) => i.id === itemId);
  if (!it) return null;
  const max = availById.get(itemId) ?? 0;
  if (max <= 0) return null;
  return { item_id: it.id, name: it.name, price: it.rental_price, qty: 1, max };
}

/**
 * Các món đang chọn cho một đơn mới — thêm, đổi số lượng, bỏ, tổng tiền.
 * `presetItemId`: mở biểu mẫu với sẵn một món (nút "Cho thuê món này" ở bản mới).
 */
export function useOrderLines(items: RentalItem[], availById: Map<string, number>, presetItemId: string | null = null) {
  const [lines, setLines] = useState<Line[]>(() => {
    const l = presetItemId ? lineFor(items, availById, presetItemId) : null;
    return l ? [l] : [];
  });
  const selectableItems = items.filter((i) => i.status === "available" && (availById.get(i.id) ?? 0) > 0);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  function addLine(itemId: string) {
    const l = lineFor(items, availById, itemId);
    if (!l) return;
    setLines((p) => {
      if (p.some((x) => x.item_id === itemId)) return p;
      return [...p, l];
    });
  }

  function setLineQty(itemId: string, qty: number) {
    setLines((p) => p.map((l) => (l.item_id === itemId ? { ...l, qty: Math.max(1, Math.min(l.max, qty)) } : l)));
  }

  function removeLine(itemId: string) {
    setLines((p) => p.filter((l) => l.item_id !== itemId));
  }

  return { lines, setLines, selectableItems, total, addLine, setLineQty, removeLine };
}
