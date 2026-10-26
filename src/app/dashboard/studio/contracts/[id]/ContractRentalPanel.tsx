"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Shirt, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import DateInput from "@/components/DateInput";
import { fmtDate, todayVN } from "@/lib/date";
import MoneyInput from "@/components/MoneyInput";
import {
  RENTAL_CATEGORY_LABEL, RENTAL_ORDER_STATUS_LABEL, vnd,
  type RentalItem, type RentalOrder, type RentalOrderStatus,
} from "@/lib/types";

/**
 * THUÊ ĐỒ trong hợp đồng — chỉ hiện với hợp đồng nhóm "Makeup & thuê đồ" và
 * "Trọn gói" (xem kindHasRental trong lib/contract-kind).
 *
 * Bảng `rental_orders` đã có sẵn cột `contract_id` và cả index cho nó từ lâu,
 * nhưng không màn nào dùng: kho đồ và hợp đồng là hai thế giới tách rời, studio
 * phải nhớ trong đầu là chiếc váy nào đi với hợp đồng nào.
 *
 * TIỀN ĐI MỘT ĐƯỜNG DUY NHẤT. Tổng hợp đồng tính từ bảng hạng mục, nên tạo đơn
 * thuê ở đây sẽ thêm luôn MỘT HẠNG MỤC tương ứng vào hợp đồng — không thì tiền
 * thuê vô hình ở danh sách hợp đồng, bảng việc và báo cáo. Đổi lại, KPI doanh
 * thu của màn Kho đồ bỏ qua đơn đã gắn hợp đồng (tiền đó đã tính là doanh thu
 * hợp đồng rồi), nếu không thì cùng một khoản đếm hai lần.
 */

type DongDon = { id: string; name: string; price: number; qty: number };
type DonThue = RentalOrder & { rental_order_items: DongDon[] };

const TONE: Record<RentalOrderStatus, string> = {
  booked: "var(--bl)",
  picked_up: "var(--am)",
  returned: "var(--gn)",
  overdue: "var(--rd)",
  canceled: "var(--tx3)",
};

export default function ContractRentalPanel({
  contractId, ownerId, clientName, clientPhone, eventDate, onThemHangMuc,
  donsBanDau, khoBanDau,
}: {
  contractId: string;
  ownerId: string;
  clientName: string;
  clientPhone: string;
  eventDate: string | null;
  /** Ghi tiền thuê vào bảng hạng mục của hợp đồng (và lưu ngay). */
  onThemHangMuc: (name: string, unitPrice: number) => Promise<void>;
  /* Hai prop dưới CHỈ dành cho /uipreview: có chúng thì không gọi database.
     Panel này tự nạp dữ liệu nên không có chúng thì màn xem trước đứng mãi ở
     "Đang tải kho đồ…" — mà màn không soi được thì lỗi bố cục không ai thấy. */
  donsBanDau?: DonThue[];
  khoBanDau?: RentalItem[];
}) {
  /* useMemo chứ KHÔNG gọi thẳng: createClient() trả về đối tượng MỚI mỗi lần
     vẽ, mà `supabase` nằm trong dependency của nap() → nap đổi danh tính mỗi
     lần vẽ → useEffect chạy lại → setState → vẽ lại… thành vòng lặp gọi
     database vô tận. Vòng lặp này không thấy được ở bản xem trước (nap() thoát
     sớm khi có dữ liệu mẫu) — chỉ nổ khi chạy thật. */
  const supabase = useMemo(() => createClient(), []);
  const xemTruoc = !!donsBanDau || !!khoBanDau;
  const [dons, setDons] = useState<DonThue[]>(donsBanDau ?? []);
  const [kho, setKho] = useState<RentalItem[]>(khoBanDau ?? []);
  const [dangNap, setDangNap] = useState(!xemTruoc);
  const [moForm, setMoForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const [chon, setChon] = useState<Record<string, boolean>>({});
  const [nhan, setNhan] = useState("");
  const [tra, setTra] = useState("");
  const [coc, setCoc] = useState(0);

  const nap = useCallback(async () => {
    if (xemTruoc) return;
    const [{ data: d }, { data: k }] = await Promise.all([
      supabase
        .from("rental_orders")
        .select("*, rental_order_items(id, name, price, qty)")
        .eq("contract_id", contractId)
        .order("created_at"),
      supabase
        .from("rental_items")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("status", "available")
        .order("category")
        .order("name"),
    ]);
    setDons((d ?? []) as DonThue[]);
    setKho((k ?? []) as RentalItem[]);
    setDangNap(false);
  }, [supabase, contractId, ownerId, xemTruoc]);

  useEffect(() => { void nap(); }, [nap]);

  const daChon = kho.filter((m) => chon[m.id]);
  const tongThue = daChon.reduce((s, m) => s + (m.rental_price || 0), 0);
  const cocGoiY = daChon.reduce((s, m) => s + (m.deposit || 0), 0);

  async function taoDon() {
    if (daChon.length === 0) { setLoi("Chọn ít nhất một món trong kho đồ."); return; }
    setBusy(true);
    setLoi(null);
    try {
      const { data: don, error } = await supabase
        .from("rental_orders")
        .insert({
          owner_id: ownerId,
          contract_id: contractId,
          client_name: clientName || "—",
          client_phone: clientPhone || null,
          // Chưa chọn ngày thì lấy ngày chụp của hợp đồng làm ngày nhận: đồ
          // gần như luôn được nhận đúng hôm đó.
          pickup_date: nhan || eventDate || null,
          return_date: tra || null,
          total_price: tongThue,
          deposit_paid: coc || 0,
        })
        .select("*")
        .single();
      if (error || !don) { setLoi(`Không tạo được đơn thuê: ${error?.message ?? "lỗi không rõ"}`); return; }

      const { error: loiDong } = await supabase.from("rental_order_items").insert(
        daChon.map((m) => ({ order_id: don.id, item_id: m.id, name: m.name, price: m.rental_price || 0, qty: 1 }))
      );
      if (loiDong) {
        // Đơn rỗng không dùng được và sẽ nằm lại trong kho đồ như rác — dọn đi
        // rồi báo, hơn là để studio thấy một đơn không có món nào.
        await supabase.from("rental_orders").delete().eq("id", don.id);
        setLoi(`Không ghi được danh sách món: ${loiDong.message}`);
        return;
      }

      await onThemHangMuc(`Thuê đồ · ${daChon.map((m) => m.name).join(", ")}`, tongThue);
      setChon({});
      setNhan(""); setTra(""); setCoc(0);
      setMoForm(false);
      await nap();
    } finally {
      setBusy(false);
    }
  }

  async function doiTrangThai(don: DonThue, moi: RentalOrderStatus) {
    setDons((p) => p.map((x) => (x.id === don.id ? { ...x, status: moi } : x)));
    await supabase
      .from("rental_orders")
      .update({ status: moi, returned_at: moi === "returned" ? todayVN() : null })
      .eq("id", don.id);
  }

  async function xoaDon(don: DonThue) {
    // Chỉ gỡ ĐƠN THUÊ. Hạng mục tiền trong hợp đồng để studio tự xoá ở tab Hạng
    // mục — tự động xoá thì có ngày xoá nhầm dòng studio đã sửa tay.
    setDons((p) => p.filter((x) => x.id !== don.id));
    await supabase.from("rental_orders").delete().eq("id", don.id);
  }

  if (dangNap) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text3)" }}>
        <Loader2 size={14} className="animate-spin" /> Đang tải kho đồ…
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-medium">Thuê đồ</h2>
          <p className="text-[12px]" style={{ color: "var(--text3)" }}>
            Đồ lấy từ Kho đồ. Tiền thuê được ghi thành một hạng mục của hợp đồng nên đã nằm trong tổng.
          </p>
        </div>
        {!moForm && (
          <button onClick={() => setMoForm(true)} className="btn-ghost px-2.5 py-1.5 text-xs">
            <Plus size={14} /> Thêm đơn thuê
          </button>
        )}
      </div>

      {loi && (
        <p className="mb-3 rounded-[10px] p-2.5 text-[12.5px]" style={{ background: "var(--s-redS)", color: "var(--s-red)" }}>{loi}</p>
      )}

      {moForm && (
        <div className="mb-4 rounded-[14px] p-3.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          {kho.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text3)" }}>
              Kho đồ chưa có món nào sẵn sàng. Thêm váy / vest / áo dài ở màn <b>Kho đồ</b> trước.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>Chọn món trong kho</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {kho.map((m) => {
                  const on = !!chon[m.id];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChon((p) => ({ ...p, [m.id]: !p[m.id] }))}
                      className="max-w-full truncate rounded-full px-2.5 py-1 text-xs"
                      style={{
                        border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`,
                        background: on ? "var(--acS, var(--surface))" : "transparent",
                        color: on ? "var(--accent)" : "var(--text2)",
                      }}
                    >
                      {RENTAL_CATEGORY_LABEL[m.category]} · {m.name}
                      {m.rental_price > 0 ? ` · ${vnd(m.rental_price)}` : ""}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: "var(--text3)" }}>Ngày nhận đồ</label>
                  <DateInput value={nhan} onChange={setNhan} allowPast lunar={false} placeholder={eventDate ? "theo ngày chụp" : "dd/mm/yyyy"} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: "var(--text3)" }}>Hẹn trả</label>
                  <DateInput value={tra} onChange={setTra} allowPast lunar={false} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: "var(--text3)" }}>
                    Cọc đồ {cocGoiY > 0 ? `(gợi ý ${vnd(cocGoiY)})` : ""}
                  </label>
                  <MoneyInput className="input" value={coc} onChange={setCoc} placeholder="0" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  {daChon.length} món · <b>{vnd(tongThue)}</b>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => { setMoForm(false); setLoi(null); }} className="btn-ghost px-2.5 py-1.5 text-xs">Huỷ</button>
                  <button onClick={taoDon} disabled={busy || daChon.length === 0} className="btn-primary px-2.5 py-1.5 text-xs">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Tạo đơn thuê
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {dons.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Hợp đồng này chưa có đơn thuê đồ nào.</p>
      ) : (
        <ul className="space-y-2">
          {dons.map((d) => (
            <li key={d.id} className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Shirt size={14} style={{ color: "var(--text3)" }} />
                    {d.rental_order_items?.map((x) => x.name).join(", ") || "—"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                    {d.pickup_date ? `Nhận ${fmtDate(d.pickup_date)}` : "chưa hẹn ngày nhận"}
                    {d.return_date ? ` · trả ${fmtDate(d.return_date)}` : ""}
                    {d.deposit_paid > 0 ? ` · cọc ${vnd(d.deposit_paid)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold" style={{ color: TONE[d.status] }}>
                    {RENTAL_ORDER_STATUS_LABEL[d.status]}
                  </span>
                  <span className="text-sm">{vnd(d.total_price)}</span>
                  {d.status !== "returned" && (
                    <button
                      onClick={() => doiTrangThai(d, d.status === "booked" ? "picked_up" : "returned")}
                      className="btn-ghost inline-flex h-7 items-center px-2.5 text-xs"
                    >
                      {d.status === "booked" ? "Đã giao đồ" : "Đã nhận lại"}
                    </button>
                  )}
                  <button
                    onClick={() => xoaDon(d)}
                    aria-label="Gỡ đơn thuê"
                    title="Gỡ đơn thuê"
                    className="flex h-7 w-7 shrink-0 items-center justify-center"
                    style={{ color: "var(--text3)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
