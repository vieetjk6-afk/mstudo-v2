"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, Boxes, CalendarDays, Check, ClipboardList, Eye, Gem, Package, PackageOpen, Phone, Plus,
  Search, Shirt, ShoppingBag, Trash2, TrendingUp, Undo2, Wallet, X, type LucideIcon,
} from "lucide-react";
import {
  Avatar, Badge, Callout, Empty, Field, GroupLabel, InfoList, PageHead, Progress, Stack, Stat, StatGrid, Toolbar, btn,
  iconBtn, inputCls, type Tone,
} from "@/components/v2/kit";
import { Drawer, Menu, Modal, SearchInput, Segmented, Tabs, type MenuItem } from "@/components/v2/kit-client";
import {
  RENTAL_CATEGORIES, RENTAL_CATEGORY_LABEL, RENTAL_ITEM_STATUS_LABEL, RENTAL_ORDER_STATUS_LABEL, vnd, vndShort,
  type RentalCategory, type RentalItem, type RentalItemStatus, type RentalOrderStatus, type RentalOrderWithItems,
} from "@/lib/types";
import { daysFromToday, fmtDate, fmtDayMonth, fmtDow } from "@/lib/date";
import type { RentalManagerProps } from "./RentalManager";
import {
  ACTIVE_ORDER_STATUSES, ITEM_STATUSES, ORDER_STATUSES, emptyItemForm, emptyOrderForm, filterItems, filterOrders, isOverdue,
  useOrderLines, useRental, type ItemForm, type OrderForm,
} from "./useRental";

/* ═══════════════════════════════════════════════════════════════════════════
   PHÒNG VÁY — giao diện mới. Cùng dữ liệu, cùng thao tác với RentalManager
   (bản cũ, logic chung ở ./useRental); khác ở cách bày:
     • 4 số liệu: trong kho · đang cho thuê · cọc đang giữ · thuê lẻ tháng này.
       Có đơn quá hạn trả thì hiện một dải đỏ với nút đi thẳng tới các đơn đó.
     • Hai tab: Kho trang phục | Đơn thuê. Biểu mẫu "thêm món" / "tạo đơn" không
       chiếm sẵn 1/3 màn nữa — mở bằng nút chính (ngăn kéo).
     • Kho: lưới thẻ theo loại, mỗi thẻ một nhãn còn/hết. Bấm thẻ mở ngăn chi
       tiết: đổi tình trạng, xem đơn đang giữ món, cho thuê ngay, xoá.
     • Đơn: nhóm theo việc cần làm (quá hạn trả → khách đang giữ → sắp giao →
       đã xong → đã huỷ); mỗi dòng một nút bước tiếp theo (Giao đồ / Nhận lại).
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "inventory" | "orders";
type Avail = "all" | "free" | "out" | "maintenance" | "retired";
type Confirm = { kind: "item" | "order"; id: string; name: string } | null;

const CAT_ICON: Record<RentalCategory, LucideIcon> = { dress: Shirt, vest: Shirt, ao_dai: Shirt, accessory: Gem, other: Package };

const ORDER_TONE: Record<RentalOrderStatus, Tone> = {
  booked: "amber",
  picked_up: "blue",
  returned: "green",
  overdue: "red",
  canceled: "gray",
};

const ITEM_TONE: Record<RentalItemStatus, Tone> = { available: "green", maintenance: "amber", retired: "gray" };

/** Bước tiếp theo của một đơn — nút chữ duy nhất trên dòng. */
function nextStep(o: RentalOrderWithItems): { to: RentalOrderStatus; label: string; icon: LucideIcon } | null {
  if (o.status === "booked") return { to: "picked_up", label: "Giao đồ", icon: ShoppingBag };
  if (o.status === "picked_up" || o.status === "overdue") return { to: "returned", label: "Nhận lại đồ", icon: ArrowDownToLine };
  return null;
}

/** Nhóm đơn theo việc cần làm. */
type OrderGroupKey = "late" | "out" | "booked" | "done" | "canceled";
const ORDER_GROUPS: { key: OrderGroupKey; label: string; dot: string }[] = [
  { key: "late", label: "Quá hạn trả", dot: "var(--rd)" },
  { key: "out", label: "Khách đang giữ đồ", dot: "var(--bl)" },
  { key: "booked", label: "Sắp giao đồ", dot: "var(--am)" },
  { key: "done", label: "Đã trả", dot: "var(--gn)" },
  { key: "canceled", label: "Đã huỷ", dot: "var(--tx3)" },
];
function orderGroup(o: RentalOrderWithItems): OrderGroupKey {
  if (o.status === "overdue" || isOverdue(o)) return "late";
  if (o.status === "picked_up") return "out";
  if (o.status === "booked") return "booked";
  if (o.status === "returned") return "done";
  return "canceled";
}

/** Dòng hạn của đơn: "Trả hôm nay" / "Trễ trả 3 ngày" / "Nhận ngày mai"… */
function orderWhen(o: RentalOrderWithItems): { text: string; tone: Tone } | null {
  if (o.status === "returned") return o.returned_at ? { text: `Đã trả ${fmtDayMonth(o.returned_at)}`, tone: "green" } : null;
  if (o.status === "canceled") return null;
  if (o.status === "booked" && o.pickup_date) {
    const d = daysFromToday(o.pickup_date);
    if (d !== null && d >= 0) return { text: d === 0 ? "Nhận đồ hôm nay" : d === 1 ? "Nhận đồ ngày mai" : `Nhận sau ${d} ngày`, tone: d <= 1 ? "amber" : "gray" };
  }
  if (o.return_date) {
    const d = daysFromToday(o.return_date);
    if (d === null) return null;
    if (d < 0) return { text: `Trễ trả ${-d} ngày`, tone: "red" };
    if (d === 0) return { text: "Trả hôm nay", tone: "amber" };
    return { text: `Còn ${d} ngày trả`, tone: d <= 2 ? "amber" : "gray" };
  }
  return null;
}

const itemsLine = (o: RentalOrderWithItems) => o.items.map((l) => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(", ") || "Chưa có món";
const range = (o: RentalOrderWithItems) =>
  o.pickup_date || o.return_date
    ? `${o.pickup_date ? fmtDayMonth(o.pickup_date) : "?"} → ${o.return_date ? fmtDayMonth(o.return_date) : "?"}`
    : "Chưa hẹn ngày";

export default function RentalV2(props: RentalManagerProps) {
  const r = useRental(props);
  const { items, orders, unitsOut, stats, availById } = r;
  const [tab, setTab] = useState<Tab>("inventory");
  const [orderFilter, setOrderFilter] = useState<RentalOrderStatus | "all">("all");
  const [itemId, setItemId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(false);
  const [newOrder, setNewOrder] = useState<{ preset: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const freeUnits = useMemo(() => [...availById.values()].reduce((s, n) => s + n, 0), [availById]);

  const peekItem = itemId ? (items.find((i) => i.id === itemId) ?? null) : null;
  const peekOrder = orderId ? (orders.find((o) => o.id === orderId) ?? null) : null;

  async function doConfirm() {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    if (c.kind === "item") {
      if (await r.removeItem(c.id)) setItemId(null);
    } else {
      await r.removeOrder(c.id);
      setOrderId(null);
    }
  }

  return (
    <Stack>
      <PageHead
        desc="Váy cưới, vest, áo dài, phụ kiện cho thuê — biết ngay món nào còn, món nào khách đang giữ."
        actions={
          tab === "inventory" ? (
            <>
              <button type="button" className={btn("secondary")} onClick={() => setNewOrder({ preset: null })}>
                <ClipboardList size={16} /> Tạo đơn thuê
              </button>
              <button type="button" className={btn("primary")} onClick={() => setNewItem(true)}>
                <Plus size={17} /> Thêm trang phục
              </button>
            </>
          ) : (
            <>
              <button type="button" className={btn("secondary")} onClick={() => setNewItem(true)}>
                <Plus size={16} /> Thêm trang phục
              </button>
              <button type="button" className={btn("primary")} onClick={() => setNewOrder({ preset: null })}>
                <ClipboardList size={17} /> Tạo đơn thuê
              </button>
            </>
          )
        }
      />

      <StatGrid>
        <Stat icon={Boxes} tone="brand" label="Trong kho" value={`${stats.totalItems} món`} sub={`${items.length} mẫu · ${freeUnits} món sẵn sàng`} />
        <Stat icon={PackageOpen} tone="blue" label="Đang cho thuê" value={`${stats.rentedUnits} món`} sub={`${stats.activeOrders} đơn chưa trả đồ`} />
        <Stat icon={Wallet} tone="amber" label="Cọc đang giữ" value={vndShort(stats.depositsHeld)} sub="Hoàn lại khi khách trả đồ" />
        <Stat icon={TrendingUp} tone="green" label="Thuê lẻ tháng này" value={vndShort(stats.revenueMonth)} sub="Không tính đơn gắn hợp đồng" />
      </StatGrid>

      {stats.overdue > 0 ? (
        <Callout
          tone="red"
          icon={AlertTriangle}
          title={`${stats.overdue} đơn đã quá ngày trả đồ`}
          action={
            <button
              type="button"
              className={btn("secondary", "sm")}
              onClick={() => {
                setTab("orders");
                setOrderFilter("overdue");
              }}
            >
              Xem đơn
            </button>
          }
        >
          Gọi khách nhắc trả để món kịp cho đơn sau.
        </Callout>
      ) : null}

      <div className="flex flex-col gap-4">
        <Tabs<Tab>
          label="Phòng váy"
          value={tab}
          onChange={setTab}
          options={[
            { value: "inventory", label: "Kho trang phục", icon: Boxes, count: items.length },
            {
              value: "orders",
              label: (
                <>
                  Đơn thuê
                  {stats.overdue ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--rd)" }} title={`${stats.overdue} đơn quá hạn`} /> : null}
                </>
              ),
              icon: ClipboardList,
              count: orders.length,
            },
          ]}
        />
        {tab === "inventory" ? (
          <InventoryV2 items={items} unitsOut={unitsOut} onOpen={setItemId} onAdd={() => setNewItem(true)} />
        ) : (
          <OrdersV2
            orders={orders}
            filter={orderFilter}
            setFilter={setOrderFilter}
            onOpen={setOrderId}
            onStatus={r.setOrderStatus}
            onDelete={(o) => setConfirm({ kind: "order", id: o.id, name: o.client_name })}
            onAdd={() => setNewOrder({ preset: null })}
          />
        )}
      </div>

      {/* ── Ngăn: chi tiết một món ── */}
      <ItemPeek
        it={peekItem}
        out={peekItem ? (unitsOut.get(peekItem.id) ?? 0) : 0}
        holding={peekItem ? orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status) && o.items.some((l) => l.item_id === peekItem.id)) : []}
        canRent={peekItem ? (availById.get(peekItem.id) ?? 0) > 0 : false}
        onClose={() => setItemId(null)}
        onStatus={r.setItemStatus}
        onRent={(id) => {
          setItemId(null);
          setNewOrder({ preset: id });
        }}
        onDelete={(it) => setConfirm({ kind: "item", id: it.id, name: it.name })}
        onOpenOrder={(id) => {
          setItemId(null);
          setTab("orders");
          setOrderId(id);
        }}
      />

      {/* ── Ngăn: chi tiết một đơn ── */}
      <OrderPeek
        o={peekOrder}
        onClose={() => setOrderId(null)}
        onStatus={r.setOrderStatus}
        onDelete={(o) => setConfirm({ kind: "order", id: o.id, name: o.client_name })}
      />

      {/* ── Ngăn: thêm trang phục ── */}
      {newItem ? <NewItemDrawer onClose={() => setNewItem(false)} addItem={r.addItem} /> : null}

      {/* ── Ngăn: tạo đơn thuê ── */}
      {newOrder ? (
        <NewOrderDrawer
          items={items}
          availById={availById}
          preset={newOrder.preset}
          createOrder={r.createOrder}
          onClose={() => setNewOrder(null)}
          onCreated={() => {
            setNewOrder(null);
            setTab("orders");
            setOrderFilter("all");
          }}
        />
      ) : null}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={Trash2}
        title={confirm?.kind === "item" ? "Xoá món khỏi kho?" : "Xoá đơn thuê?"}
        desc={
          confirm?.kind === "item"
            ? `“${confirm.name}” sẽ bị xoá khỏi kho trang phục. Không hoàn tác được.`
            : `Đơn thuê của ${confirm?.name ?? ""} sẽ bị xoá cùng các món trong đơn. Không hoàn tác được.`
        }
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirm(null)}>
              Giữ lại
            </button>
            <button type="button" className={btn("danger")} onClick={doConfirm}>
              <Trash2 size={16} /> Xoá
            </button>
          </>
        }
      />
    </Stack>
  );
}

/* ═══════════════════════════ Kho trang phục ═══════════════════════════ */

function availOf(it: RentalItem, out: number): { text: string; tone: Tone; free: number } {
  const free = Math.max(0, (it.quantity || 0) - out);
  if (it.status !== "available") return { text: RENTAL_ITEM_STATUS_LABEL[it.status], tone: ITEM_TONE[it.status], free };
  if (free <= 0) return { text: "Đã cho thuê hết", tone: "red", free };
  return { text: `Còn ${free}/${it.quantity}`, tone: "green", free };
}

function CatTile({ cat, size = 42 }: { cat: RentalCategory; size?: number }) {
  const Icon = CAT_ICON[cat];
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[12px]"
      style={{ width: size, height: size, background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd2)" }}
    >
      <Icon size={size * 0.45} />
    </span>
  );
}

function InventoryV2({
  items,
  unitsOut,
  onOpen,
  onAdd,
}: {
  items: RentalItem[];
  unitsOut: Map<string, number>;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<RentalCategory | "all">("all");
  const [avail, setAvail] = useState<Avail>("all");

  const byText = useMemo(() => filterItems(items, q, "all"), [items, q]);
  const matchAvail = (it: RentalItem) => {
    if (avail === "all") return true;
    if (avail === "maintenance" || avail === "retired") return it.status === avail;
    const free = Math.max(0, (it.quantity || 0) - (unitsOut.get(it.id) ?? 0));
    return it.status === "available" && (avail === "free" ? free > 0 : free === 0);
  };
  const pool = byText.filter(matchAvail);
  const shown = cat === "all" ? pool : pool.filter((it) => it.category === cat);
  const cats = RENTAL_CATEGORIES.filter((c) => items.some((it) => it.category === c));

  if (items.length === 0)
    return (
      <div className="v2-card">
        <Empty
          icon={Shirt}
          title="Kho trang phục còn trống"
          hint="Thêm váy cưới, vest, áo dài, phụ kiện kèm giá thuê và tiền cọc — rồi tạo đơn thuê từ chính kho này."
          action={
            <button type="button" className={btn("secondary")} onClick={onAdd}>
              <Plus size={16} /> Thêm trang phục đầu tiên
            </button>
          }
        />
      </div>
    );

  const filtering = !!q.trim() || avail !== "all" || cat !== "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="v2-card v2-card-pad flex flex-col gap-3">
        <Toolbar>
          <div className="min-w-[220px] flex-[1_1_240px]">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, mã, màu, size…" className="w-full" />
          </div>
          <select aria-label="Tình trạng" className={inputCls} value={avail} onChange={(e) => setAvail(e.target.value as Avail)}>
            <option value="all">Mọi tình trạng</option>
            <option value="free">Còn sẵn để thuê</option>
            <option value="out">Đã cho thuê hết</option>
            <option value="maintenance">{RENTAL_ITEM_STATUS_LABEL.maintenance}</option>
            <option value="retired">{RENTAL_ITEM_STATUS_LABEL.retired}</option>
          </select>
          {cats.length > 1 && (
            <div className="w-full min-w-0">
              <Segmented<RentalCategory | "all">
                label="Loại trang phục"
                value={cat}
                onChange={setCat}
                options={[
                  { value: "all", label: "Tất cả", count: pool.length },
                  ...cats.map((c) => ({ value: c, label: RENTAL_CATEGORY_LABEL[c], count: pool.filter((it) => it.category === c).length })),
                ]}
              />
            </div>
          )}
        </Toolbar>
        {filtering ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {shown.length} / {items.length} mẫu khớp bộ lọc ·{" "}
            <button
              type="button"
              className="font-semibold"
              style={{ color: "var(--ac)" }}
              onClick={() => {
                setQ("");
                setAvail("all");
                setCat("all");
              }}
            >
              Xoá lọc
            </button>
          </p>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="v2-card">
          <Empty compact icon={Search} title="Không tìm thấy món phù hợp" hint="Thử gõ ít chữ hơn hoặc chọn tình trạng khác." />
        </div>
      ) : (
        RENTAL_CATEGORIES.filter((c) => shown.some((it) => it.category === c)).map((c) => {
          const list = shown.filter((it) => it.category === c);
          return (
            <section key={c} className="flex flex-col gap-2.5">
              {cat === "all" ? <GroupLabel count={`${list.length} mẫu`}>{RENTAL_CATEGORY_LABEL[c]}</GroupLabel> : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
                {list.map((it) => {
                  const out = unitsOut.get(it.id) ?? 0;
                  const a = availOf(it, out);
                  const meta = [it.code && `#${it.code}`, it.size && `Size ${it.size}`, it.color].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onOpen(it.id)}
                      className="v2-card v2-card-link flex flex-col gap-3 p-3.5 text-left"
                      style={it.status === "retired" ? { opacity: 0.7 } : undefined}
                    >
                      <div className="flex w-full min-w-0 items-start gap-3">
                        <CatTile cat={it.category} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{it.name}</p>
                          <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                            {meta || RENTAL_CATEGORY_LABEL[it.category]}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto flex w-full items-center gap-2 pt-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                        <span className="v2-num min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--tx2)" }}>
                          <b className="font-semibold" style={{ color: "var(--tx)" }}>
                            {it.rental_price ? vndShort(it.rental_price) : "—"}
                          </b>
                          {it.deposit ? ` · cọc ${vndShort(it.deposit)}` : ""}
                        </span>
                        <Badge tone={a.tone} dot>
                          {a.text}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ItemPeek({
  it,
  out,
  holding,
  canRent,
  onClose,
  onStatus,
  onRent,
  onDelete,
  onOpenOrder,
}: {
  it: RentalItem | null;
  out: number;
  holding: RentalOrderWithItems[];
  canRent: boolean;
  onClose: () => void;
  onStatus: (id: string, s: RentalItemStatus) => void;
  onRent: (id: string) => void;
  onDelete: (it: RentalItem) => void;
  onOpenOrder: (id: string) => void;
}) {
  if (!it)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const a = availOf(it, out);
  return (
    <Drawer
      open
      onClose={onClose}
      title={it.name}
      desc={[RENTAL_CATEGORY_LABEL[it.category], it.code ? `Mã ${it.code}` : null].filter(Boolean).join(" · ")}
      width={460}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <button type="button" className={btn("danger")} onClick={() => onDelete(it)}>
            <Trash2 size={16} /> Xoá khỏi kho
          </button>
          {canRent ? (
            <button type="button" className={btn("primary", "md", "ml-auto")} onClick={() => onRent(it.id)}>
              <ClipboardList size={16} /> Cho thuê món này
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="v2-card v2-card-pad flex flex-col gap-2.5" style={{ boxShadow: "none", background: "var(--sf2)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
              Còn trong kho
            </p>
            <Badge tone={a.tone} dot>
              {a.text}
            </Badge>
          </div>
          <p className="v2-num text-[22px] font-bold">
            {a.free}
            <span className="text-[14px] font-medium" style={{ color: "var(--tx3)" }}>
              {" "}
              / {it.quantity} món
            </span>
          </p>
          <Progress value={it.quantity ? (a.free / it.quantity) * 100 : 0} tone={a.free > 0 ? "green" : "red"} />
          {out > 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {out} món đang nằm trong đơn chưa trả
            </p>
          ) : null}
        </div>

        <Field label="Tình trạng món">
          <Segmented<RentalItemStatus>
            label="Tình trạng món"
            value={it.status}
            onChange={(s) => onStatus(it.id, s)}
            options={ITEM_STATUSES.map((s) => ({ value: s, label: RENTAL_ITEM_STATUS_LABEL[s] }))}
          />
        </Field>

        <InfoList
          items={[
            { label: "Giá thuê", value: <span className="v2-num">{vnd(it.rental_price)}</span> },
            { label: "Tiền cọc", value: <span className="v2-num">{vnd(it.deposit)}</span> },
            { label: "Size", value: it.size || "—" },
            { label: "Màu", value: it.color || "—" },
            { label: "Số lượng", value: `${it.quantity} món` },
            ...(it.note ? [{ label: "Ghi chú", value: it.note }] : []),
          ]}
        />

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold">
            <PackageOpen size={16} style={{ color: "var(--tx3)" }} /> Đơn đang giữ món này
          </p>
          {holding.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--tx3)" }}>
              Không có đơn nào đang giữ món này.
            </p>
          ) : (
            <ul className="flex flex-col">
              {holding.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => onOpenOrder(o.id)} className="flex w-full items-center gap-2.5 rounded-[10px] px-1 py-1.5 text-left hover:bg-[var(--sf2)]">
                    <Avatar name={o.client_name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{o.client_name}</p>
                      <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                        {range(o)}
                      </p>
                    </div>
                    <Badge tone={isOverdue(o) ? "red" : ORDER_TONE[o.status]}>{isOverdue(o) ? "Quá hạn trả" : RENTAL_ORDER_STATUS_LABEL[o.status]}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function NewItemDrawer({ onClose, addItem }: { onClose: () => void; addItem: (f: ItemForm) => Promise<boolean> }) {
  const [f, setF] = useState<ItemForm>(emptyItemForm);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ItemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    const ok = await addItem(f);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Thêm trang phục"
      desc="Món mới vào kho ở tình trạng Sẵn sàng."
      width={460}
      footer={
        <div className="flex w-full items-center gap-2">
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className={btn("primary", "md", "ml-auto")} onClick={save} disabled={busy || !f.name.trim()}>
            <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm vào kho"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên trang phục" htmlFor="ri-name">
          <input id="ri-name" className={inputCls} placeholder="VD: Váy cưới đuôi cá trắng" value={f.name} onChange={set("name")} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loại" htmlFor="ri-cat">
            <select id="ri-cat" className={inputCls} value={f.category} onChange={set("category")}>
              {RENTAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {RENTAL_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mã" htmlFor="ri-code">
            <input id="ri-code" className={inputCls} placeholder="VD: V-01" value={f.code} onChange={set("code")} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Size" htmlFor="ri-size">
            <input id="ri-size" className={inputCls} value={f.size} onChange={set("size")} />
          </Field>
          <Field label="Màu" htmlFor="ri-color">
            <input id="ri-color" className={inputCls} value={f.color} onChange={set("color")} />
          </Field>
          <Field label="Số lượng" htmlFor="ri-qty">
            <input id="ri-qty" className={inputCls} type="number" min={1} value={f.quantity} onChange={set("quantity")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giá thuê (đ)" htmlFor="ri-price">
            <input id="ri-price" className={inputCls} type="number" min={0} placeholder="0" value={f.rental_price} onChange={set("rental_price")} />
          </Field>
          <Field label="Tiền cọc (đ)" htmlFor="ri-deposit">
            <input id="ri-deposit" className={inputCls} type="number" min={0} placeholder="0" value={f.deposit} onChange={set("deposit")} />
          </Field>
        </div>
        <Field label="Ghi chú" htmlFor="ri-note">
          <input id="ri-note" className={inputCls} placeholder="Tuỳ chọn" value={f.note} onChange={set("note")} />
        </Field>
      </div>
    </Drawer>
  );
}

/* ═══════════════════════════════ Đơn thuê ═══════════════════════════════ */

function OrdersV2({
  orders,
  filter,
  setFilter,
  onOpen,
  onStatus,
  onDelete,
  onAdd,
}: {
  orders: RentalOrderWithItems[];
  filter: RentalOrderStatus | "all";
  setFilter: (f: RentalOrderStatus | "all") => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, s: RentalOrderStatus) => void;
  onDelete: (o: RentalOrderWithItems) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState("");

  const searched = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return orders;
    return orders.filter((o) =>
      [o.client_name, o.client_phone, o.note, ...o.items.map((l) => l.name)].some((v) => v?.toLowerCase().includes(n)),
    );
  }, [orders, q]);

  const groups = useMemo(() => {
    const list = filterOrders(searched, filter);
    return ORDER_GROUPS.map((g) => {
      const rows = list.filter((o) => orderGroup(o) === g.key);
      // Việc cần làm: hạn gần trước. Đơn đã xong: mới nhất trước.
      const key = (o: RentalOrderWithItems) => (g.key === "booked" ? o.pickup_date : o.return_date) || "9999";
      rows.sort((a, b) => (g.key === "done" || g.key === "canceled" ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
      return { ...g, rows };
    }).filter((g) => g.rows.length > 0);
  }, [searched, filter]);

  if (orders.length === 0)
    return (
      <div className="v2-card">
        <Empty
          icon={ClipboardList}
          title="Chưa có đơn thuê nào"
          hint="Tạo đơn khi khách thuê đồ lẻ (không qua hợp đồng): chọn món từ kho, hẹn ngày nhận và trả, ghi tiền cọc."
          action={
            <button type="button" className={btn("secondary")} onClick={onAdd}>
              <Plus size={16} /> Tạo đơn thuê
            </button>
          }
        />
      </div>
    );

  const menu = (o: RentalOrderWithItems): MenuItem[] => [
    { label: "Xem chi tiết", icon: Eye, onClick: () => onOpen(o.id) },
    "divider",
    ...ORDER_STATUSES.filter((s) => s !== o.status).map((s) => ({
      label: `Đánh dấu “${RENTAL_ORDER_STATUS_LABEL[s]}”`,
      icon: s === "returned" ? Undo2 : s === "canceled" ? X : s === "overdue" ? AlertTriangle : Check,
      onClick: () => void onStatus(o.id, s),
    })),
    "divider",
    { label: "Xoá đơn", icon: Trash2, danger: true, onClick: () => onDelete(o) },
  ];

  const count = (f: RentalOrderStatus | "all") => filterOrders(searched, f).length;

  return (
    <div className="v2-card overflow-hidden">
      <div className="v2-card-pad flex flex-col gap-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Toolbar>
          <div className="min-w-[220px] flex-[1_1_240px]">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm khách, số điện thoại, món…" className="w-full" />
          </div>
          <div className="w-full min-w-0">
            <Segmented<RentalOrderStatus | "all">
              label="Trạng thái đơn"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tất cả", count: count("all") },
                ...ORDER_STATUSES.map((s) => ({ value: s, label: RENTAL_ORDER_STATUS_LABEL[s], count: count(s) })),
              ]}
            />
          </div>
        </Toolbar>
      </div>

      {groups.length === 0 ? (
        <Empty compact icon={Search} title="Không có đơn nào ở nhóm này" hint="Thử chọn “Tất cả” hoặc gõ ít chữ hơn." />
      ) : (
        <>
          {/* Máy tính: bảng */}
          <div className="v2-table-wrap hidden lg:block">
            <table className="v2-table" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Khách</th>
                  <th>Trang phục</th>
                  <th style={{ width: 160 }}>Nhận → trả</th>
                  <th className="num" style={{ width: 120 }}>
                    Tiền thuê
                  </th>
                  <th style={{ width: 186 }} aria-label="Thao tác" />
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.key}>
                  <tr>
                    <td colSpan={5} style={{ background: "var(--sf2)", padding: "8px 16px" }}>
                      <OrderGroupHead label={g.label} dot={g.dot} n={g.rows.length} />
                    </td>
                  </tr>
                  {g.rows.map((o) => {
                    const w = orderWhen(o);
                    const step = nextStep(o);
                    return (
                      <tr key={o.id} className="cursor-pointer" onClick={() => onOpen(o.id)}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={o.client_name} size={34} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{o.client_name}</p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                                {o.client_phone || "Chưa có số điện thoại"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="truncate text-[13.5px]" title={itemsLine(o)}>
                            {itemsLine(o)}
                          </p>
                          <p className="mt-1">
                            <Badge tone={ORDER_TONE[o.status]} dot>
                              {RENTAL_ORDER_STATUS_LABEL[o.status]}
                            </Badge>
                          </p>
                        </td>
                        <td>
                          <p className="v2-num whitespace-nowrap text-[13.5px] font-semibold">{range(o)}</p>
                          {w ? (
                            <p className="whitespace-nowrap text-[12px] font-medium" style={{ color: w.tone === "gray" ? "var(--tx3)" : w.tone === "green" ? "var(--gn)" : w.tone === "red" ? "var(--rd)" : "var(--am)" }}>
                              {w.text}
                            </p>
                          ) : null}
                        </td>
                        <td className="num">
                          <p className="font-semibold">{vndShort(o.total_price)}</p>
                          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                            {o.deposit_paid ? `cọc ${vndShort(o.deposit_paid)}` : "chưa cọc"}
                          </p>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {step ? (
                              <button type="button" className={btn("soft", "sm")} onClick={() => onStatus(o.id, step.to)}>
                                <step.icon size={14} /> {step.label}
                              </button>
                            ) : null}
                            <Menu items={menu(o)} label={`Thao tác đơn ${o.client_name}`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>

          {/* Điện thoại / máy tính bảng: thẻ */}
          <div className="lg:hidden">
            {groups.map((g) => (
              <ul key={g.key}>
                <li className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                  <OrderGroupHead label={g.label} dot={g.dot} n={g.rows.length} />
                </li>
                {g.rows.map((o) => {
                  const w = orderWhen(o);
                  const step = nextStep(o);
                  return (
                    <li key={o.id} className="relative px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <button type="button" className="absolute inset-0" aria-label={`Xem đơn ${o.client_name}`} onClick={() => onOpen(o.id)} />
                      <div className="flex gap-3">
                        <Avatar name={o.client_name} size={38} />
                        <div className="pointer-events-none min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{o.client_name}</p>
                            <span className="v2-num flex-none text-[13.5px] font-semibold">{vndShort(o.total_price)}</span>
                          </div>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                            {itemsLine(o)}
                          </p>
                        </div>
                        <div className="relative -mr-1.5 -mt-1 flex-none self-start">
                          <Menu items={menu(o)} label={`Thao tác đơn ${o.client_name}`} />
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="v2-num flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
                            <CalendarDays size={13} style={{ color: "var(--tx3)" }} /> {range(o)}
                          </span>
                          {w ? (
                            <Badge tone={w.tone} dot={w.tone === "red" || w.tone === "amber"}>
                              {w.text}
                            </Badge>
                          ) : (
                            <Badge tone={ORDER_TONE[o.status]}>{RENTAL_ORDER_STATUS_LABEL[o.status]}</Badge>
                          )}
                        </div>
                        {step ? (
                          <button type="button" className={btn("soft", "sm", "relative flex-none")} onClick={() => onStatus(o.id, step.to)}>
                            <step.icon size={14} /> {step.label}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrderGroupHead({ label, dot, n }: { label: string; dot: string; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: dot }} />
      <GroupLabel count={`${n} đơn`}>{label}</GroupLabel>
    </div>
  );
}

function OrderPeek({
  o,
  onClose,
  onStatus,
  onDelete,
}: {
  o: RentalOrderWithItems | null;
  onClose: () => void;
  onStatus: (id: string, s: RentalOrderStatus) => void;
  onDelete: (o: RentalOrderWithItems) => void;
}) {
  if (!o)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const step = nextStep(o);
  const w = orderWhen(o);
  const late = isOverdue(o);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Đơn thuê · ${o.client_name}`}
      desc={o.contract_id ? "Đơn gắn với hợp đồng" : "Đơn thuê lẻ"}
      width={460}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <button type="button" className={btn("danger")} onClick={() => onDelete(o)}>
            <Trash2 size={16} /> Xoá đơn
          </button>
          {step ? (
            <button type="button" className={btn("primary", "md", "ml-auto")} onClick={() => onStatus(o.id, step.to)}>
              <step.icon size={16} /> {step.label}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar name={o.client_name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{o.client_name}</p>
            <p className="truncate text-[13px]" style={{ color: "var(--tx3)" }}>
              {o.client_phone || "Chưa có số điện thoại"}
            </p>
          </div>
          {o.client_phone ? (
            <a href={`tel:${o.client_phone}`} className={iconBtn()} aria-label="Gọi khách" title="Gọi khách">
              <Phone size={17} />
            </a>
          ) : null}
          <Badge tone={ORDER_TONE[o.status]} dot>
            {RENTAL_ORDER_STATUS_LABEL[o.status]}
          </Badge>
        </div>

        {late && o.status !== "overdue" ? (
          <Callout tone="red" icon={AlertTriangle} title="Quá hạn trả">
            Hẹn trả {fmtDate(o.return_date)} nhưng chưa nhận lại đồ.
          </Callout>
        ) : null}

        <Field label="Trạng thái đơn" htmlFor="ro-status">
          <select id="ro-status" className={inputCls} value={o.status} onChange={(e) => onStatus(o.id, e.target.value as RentalOrderStatus)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RENTAL_ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <InfoList
          items={[
            { label: "Ngày nhận đồ", value: o.pickup_date ? `${fmtDow(o.pickup_date)} · ${fmtDate(o.pickup_date)}` : "Chưa hẹn" },
            { label: "Ngày trả đồ", value: o.return_date ? `${fmtDow(o.return_date)} · ${fmtDate(o.return_date)}` : "Chưa hẹn" },
            ...(w ? [{ label: "Tình hình", value: <span style={{ color: w.tone === "red" ? "var(--rd)" : w.tone === "amber" ? "var(--am)" : w.tone === "green" ? "var(--gn)" : undefined }}>{w.text}</span> }] : []),
            ...(o.returned_at ? [{ label: "Đã trả ngày", value: fmtDate(o.returned_at) }] : []),
            ...(o.note ? [{ label: "Ghi chú", value: o.note }] : []),
          ]}
        />

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold">
            <Shirt size={16} style={{ color: "var(--tx3)" }} /> Trang phục trong đơn
          </p>
          <ul className="flex flex-col">
            {o.items.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]">
                <span className="min-w-0 truncate">
                  {l.name}
                  {l.qty > 1 ? <span style={{ color: "var(--tx3)" }}> × {l.qty}</span> : null}
                </span>
                <span className="v2-num flex-none font-medium">{vnd(l.price * l.qty)}</span>
              </li>
            ))}
            {o.items.length === 0 ? (
              <li className="text-[13px]" style={{ color: "var(--tx3)" }}>
                Chưa có món nào.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="v2-card v2-card-pad grid grid-cols-2 gap-2 text-[12px]" style={{ boxShadow: "none", background: "var(--sf2)", color: "var(--tx3)" }}>
          <div>
            Tiền thuê
            <p className="v2-num text-[16px] font-semibold" style={{ color: "var(--tx)" }}>
              {vnd(o.total_price)}
            </p>
          </div>
          <div>
            Cọc đã thu
            <p className="v2-num text-[16px] font-semibold" style={{ color: o.deposit_paid ? "var(--gn)" : "var(--tx)" }}>
              {vnd(o.deposit_paid)}
            </p>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function NewOrderDrawer({
  items,
  availById,
  preset,
  createOrder,
  onClose,
  onCreated,
}: {
  items: RentalItem[];
  availById: Map<string, number>;
  preset: string | null;
  createOrder: (f: OrderForm, lines: ReturnType<typeof useOrderLines>["lines"]) => Promise<boolean>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState<OrderForm>(emptyOrderForm);
  // Mở từ "Cho thuê món này" → món đó có sẵn trong đơn.
  const L = useOrderLines(items, availById, preset);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof OrderForm) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const ready = !!f.client_name.trim() && L.lines.length > 0;

  async function create() {
    if (!ready) return;
    setBusy(true);
    const ok = await createOrder(f, L.lines);
    setBusy(false);
    if (ok) onCreated();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Tạo đơn thuê"
      desc="Chọn món từ kho — chỉ hiện món còn sẵn."
      width={500}
      footer={
        <div className="flex w-full items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
              Tổng tiền thuê
            </p>
            <p className="v2-num text-[16px] font-bold">{vnd(L.total)}</p>
          </div>
          <button type="button" className={btn("primary")} onClick={create} disabled={busy || !ready}>
            <Plus size={16} /> {busy ? "Đang tạo…" : "Tạo đơn"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tên khách" htmlFor="ro-name">
            <input id="ro-name" className={inputCls} value={f.client_name} onChange={set("client_name")} autoFocus />
          </Field>
          <Field label="Số điện thoại" htmlFor="ro-phone">
            <input id="ro-phone" className={inputCls} inputMode="tel" value={f.client_phone} onChange={set("client_phone")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày nhận đồ" htmlFor="ro-pick">
            <input id="ro-pick" className={inputCls} type="date" value={f.pickup_date} onChange={set("pickup_date")} />
          </Field>
          <Field label="Ngày trả đồ" htmlFor="ro-ret">
            <input id="ro-ret" className={inputCls} type="date" value={f.return_date} onChange={set("return_date")} />
          </Field>
        </div>

        <Field
          label="Trang phục"
          htmlFor="ro-add"
          hint={L.selectableItems.length === 0 ? "Không còn món nào sẵn sàng để thuê." : undefined}
        >
          <select id="ro-add" className={inputCls} value="" onChange={(e) => e.target.value && L.addLine(e.target.value)}>
            <option value="">+ Thêm món…</option>
            {L.selectableItems.map((i) => (
              <option key={i.id} value={i.id}>
                {RENTAL_CATEGORY_LABEL[i.category]} · {i.name} ({vnd(i.rental_price)}) · còn {availById.get(i.id)}
              </option>
            ))}
          </select>
        </Field>

        {L.lines.length > 0 ? (
          <ul className="v2-card flex flex-col overflow-hidden" style={{ boxShadow: "none" }}>
            {L.lines.map((l) => (
              <li key={l.item_id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{l.name}</span>
                {l.max > 1 ? (
                  <input
                    type="number"
                    min={1}
                    max={l.max}
                    value={l.qty}
                    onChange={(e) => L.setLineQty(l.item_id, Number(e.target.value))}
                    className={`${inputCls} !h-8 !w-16 text-center`}
                    aria-label={`Số lượng ${l.name}`}
                    title={`Tối đa ${l.max}`}
                  />
                ) : null}
                <span className="v2-num w-[86px] flex-none text-right text-[13px]" style={{ color: "var(--tx2)" }}>
                  {vnd(l.price * l.qty)}
                </span>
                <button type="button" className={iconBtn("!h-8 !w-8")} aria-label={`Bỏ ${l.name} khỏi đơn`} onClick={() => L.removeLine(l.item_id)}>
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Cọc đã thu (đ)" htmlFor="ro-dep">
            <input id="ro-dep" className={inputCls} type="number" min={0} placeholder="0" value={f.deposit_paid} onChange={set("deposit_paid")} />
          </Field>
          <Field label="Ghi chú" htmlFor="ro-note">
            <input id="ro-note" className={inputCls} placeholder="Tuỳ chọn" value={f.note} onChange={set("note")} />
          </Field>
        </div>
      </div>
    </Drawer>
  );
}
