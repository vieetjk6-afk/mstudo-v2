"use client";

import { useRouter } from "next/navigation";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Lock,
  LockOpen,
  ArrowLeft,
  Tag,
  Package,
  Check,
  Send,
  Eye,
  Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { nextQuoteCode, newShareToken } from "@/lib/contract-code";
import { computeRoundedDeposit, depositRatio } from "@/lib/quote-deposit";
import { fmtDate } from "@/lib/date";
import { vnd } from "@/lib/types";
import { makeListLabel } from "@/lib/pricelist-label";

/** `src` nhớ hạng mục này sinh ra từ dòng nào của bảng giá, để tick/bỏ tick
 *  ở hai khối trên cùng một nguồn mà không so khớp theo tên. */
type Draft = {
  name: string;
  description: string;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount: boolean;
  package_group: string;
  src?: string;
};
type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  description: string | null;
  category: string | null;
  list_key: string | null;
};

export default function NewQuoteForm({
  ownerId,
  services = [],
  pricelist = [],
  listLabels = {},
}: {
  ownerId: string;
  services?: { id: string; name: string }[];
  pricelist?: PriceItem[];
  /** Nhãn studio tự đặt cho từng bảng giá (profiles.pl_list_labels). */
  listLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientFacebook, setClientFacebook] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [intro, setIntro] = useState(
    "Cảm ơn bạn đã quan tâm. Dưới đây là báo giá chi tiết — bạn có thể chọn/bỏ các hạng mục tuỳ chọn hoặc gửi yêu cầu chỉnh sửa cho mình."
  );
  const [items, setItems] = useState<Draft[]>([]);
  const [bulkDiscountAmount, setBulkDiscountAmount] = useState(0);
  const [discountPackageGroup, setDiscountPackageGroup] = useState("");
  const [showConditions, setShowConditions] = useState(false);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grossTotal = items.reduce((s, i) => (i.is_discount ? s : s + (i.qty || 0) * (i.unit_price || 0)), 0);
  const discountTotal = items.reduce((s, i) => (i.is_discount ? s + (i.qty || 0) * (i.unit_price || 0) : s), 0);
  const total = grossTotal - discountTotal;
  const deposit = computeRoundedDeposit(total);
  const depositPct = depositRatio(total, deposit);
  const packageGroups = Array.from(new Set(items.map((i) => i.package_group.trim()).filter(Boolean)));

  // Gói chính = hạng mục bắt buộc sinh ra từ bảng giá (mỗi báo giá 1 gói).
  const mainSrc = items.find((i) => i.src && !i.is_optional && !i.is_discount)?.src ?? "";
  const extraSrcs = items.filter((i) => i.src && i.is_optional).map((i) => i.src!);

  const listLabel = useMemo(() => makeListLabel(listLabels, services), [listLabels, services]);

  const priceGroups = useMemo(() => {
    const map = new Map<string, PriceItem[]>();
    for (const p of pricelist) {
      const key = p.list_key || "cuoi";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [pricelist]);

  function update(idx: number, patch: Partial<Draft>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function add(asDiscount = false) {
    setItems((arr) => [
      ...arr,
      asDiscount
        ? { name: "Giảm giá combo", description: "", qty: 1, unit_price: 500000, is_optional: false, is_discount: true, package_group: "" }
        : { name: "", description: "", qty: 1, unit_price: 0, is_optional: true, is_discount: false, package_group: "" },
    ]);
  }
  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

  /** Chọn gói chính: thay dòng gói chính cũ (nếu có) bằng dòng mới. */
  function pickMain(p: PriceItem) {
    setItems((arr) => {
      const rest = arr.filter((i) => !(i.src && !i.is_optional && !i.is_discount) && i.src !== p.id);
      if (mainSrc === p.id) return rest;
      const row: Draft = {
        name: p.name,
        description: p.description || "",
        qty: 1,
        unit_price: p.price,
        is_optional: false,
        is_discount: false,
        package_group: "",
        src: p.id,
      };
      return [row, ...rest];
    });
  }
  /** Tick / bỏ tick hạng mục thêm (luôn là hạng mục tuỳ chọn của khách). */
  function toggleExtra(p: PriceItem) {
    setItems((arr) => {
      if (arr.some((i) => i.src === p.id && i.is_optional)) return arr.filter((i) => i.src !== p.id);
      return [
        ...arr,
        {
          name: p.name,
          description: p.description || "",
          qty: 1,
          unit_price: p.price,
          is_optional: true,
          is_discount: false,
          package_group: "",
          src: p.id,
        },
      ];
    });
  }

  const autoTitle = `Báo giá${services.find((s) => s.id === serviceId)?.name ? ` ${services.find((s) => s.id === serviceId)?.name}` : ""} ${fmtDate(eventDate || new Date())}`;

  async function save(mode: "draft" | "send") {
    setError(null);
    const cleaned = items.filter((i) => i.name.trim());
    if (cleaned.length === 0) {
      setError("Cần ít nhất 1 hạng mục có tên.");
      return;
    }
    setSaving(mode);
    try {
      const code = await nextQuoteCode(supabase, ownerId);
      const token = newShareToken();
      const { data: quote, error: qErr } = await supabase
        .from("studio_quotes")
        .insert({
          owner_id: ownerId,
          code,
          title: title.trim() || autoTitle,
          client_name: clientName.trim() || null,
          client_phone: clientPhone.trim() || null,
          client_email: clientEmail.trim() || null,
          client_facebook: clientFacebook.trim() || null,
          event_date: eventDate || null,
          location: location.trim() || null,
          intro: intro.trim() || null,
          ...(serviceId ? { service_id: serviceId } : {}),
          client_token: token,
          status: "draft",
          bulk_discount_amount: bulkDiscountAmount || 0,
          discount_package_group: discountPackageGroup.trim() || null,
        })
        .select("id")
        .single();
      if (qErr || !quote) throw new Error(qErr?.message || "Tạo báo giá thất bại");

      const rows = cleaned.map((it, idx) => ({
        quote_id: quote.id,
        name: it.name.trim(),
        description: it.description.trim() || null,
        qty: it.qty || 1,
        unit_price: it.unit_price || 0,
        is_optional: it.is_optional,
        is_discount: it.is_discount,
        package_group: it.package_group.trim() || null,
        selected: true,
        position: idx,
      }));
      const { error: iErr } = await supabase.from("quote_items").insert(rows);
      if (iErr) throw new Error(iErr.message);

      // Cả hai nút đều mở màn chi tiết báo giá — nơi có nút gửi thật (Zalo /
      // Messenger / email). Báo giá vẫn ở trạng thái nháp cho tới lúc gửi.
      router.push(`/dashboard/studio/quotes/${quote.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
      setSaving(null);
    }
  }

  /* ── Khối dùng lại ─────────────────────────────────────────────────────── */
  const panel = "rounded-[14px] px-5 py-[18px]";
  const panelStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const eyebrow = "text-[11px] font-extrabold uppercase";
  const eyebrowStyle = { letterSpacing: ".5px", color: "var(--tx3)" } as const;
  const fieldLabel = "mb-1.5 block text-[11px] font-bold uppercase";
  const fieldLabelStyle = { letterSpacing: ".4px", color: "var(--tx3)" } as const;
  const inputCls = "w-full rounded-[10px] px-3 py-2.5 text-[13px]";
  const inputStyle = { border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" } as const;

  /** Dòng khách sẽ thấy ở rail phải — cùng một mảng items, không tính lại tay. */
  const previewLines = items.filter((i) => i.name.trim() || i.unit_price);

  return (
    /* grid-cols-1 (= repeat(1, minmax(0,1fr))) chứ KHÔNG để lưới tự suy ra một
       cột: cột suy ra dùng track `auto`, mà sàn của track `auto` là min-content
       của thẻ con — thẻ nào không có min-width:0 sẽ không chịu co, kéo cả lưới
       rộng hơn màn hình. Đúng lỗi "chọn gói xong giao diện bị kéo ra": rail phải
       hiện dòng mô tả gói (whitespace-nowrap vì `truncate`) nên min-content của
       nó bằng nguyên câu mô tả — trên điện thoại lưới phình gấp đôi bề ngang
       màn, `overflow-x-clip` của khung studio cắt mất phần thừa nên mọi khối
       trông như bị đẩy lệch ra ngoài. Từ 1180px trở lên lưới hai cột đã dùng
       minmax(0,…) nên máy tính không dính lỗi này. */
    <div
      className="page-in mx-auto grid max-w-[1060px] grid-cols-1 items-start gap-3.5 min-[1180px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
      data-testid="quote-new-page"
    >
      {/* ══ Cột trái — studio nhập ══════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-col gap-3.5">

        {/* ── Khách hàng & gói chính ─────────────────────────────────────── */}
        <div className={panel} style={panelStyle}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              aria-label="Quay lại"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
              style={{ border: "1px solid var(--bd)" }}
            >
              <ArrowLeft size={17} />
            </button>
            <h1 className="text-[15px] font-bold">Khách hàng &amp; gói chính</h1>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-name">Tên khách</label>
              <input id="q-name" className={inputCls} style={inputStyle} value={clientName} onChange={(e) => setClientName(e.target.value)} data-testid="quote-client-name" />
            </div>
            <div>
              <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-phone">Số điện thoại</label>
              <input id="q-phone" className={inputCls} style={inputStyle} inputMode="numeric" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} data-testid="quote-client-phone" />
            </div>
          </div>

          <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Gói chính</p>
          {pricelist.length === 0 ? (
            <div className="rounded-[11px] px-4 py-5 text-center" style={{ border: "1px dashed var(--bd)" }}>
              <p className="text-[13px] font-semibold">Bảng giá đang trống</p>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Thêm gói vào{" "}
                <a href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>bảng giá</a>{" "}
                để chọn một chạm — hoặc tự nhập hạng mục ở khối dưới.
              </p>
            </div>
          ) : (
            /* min-w-0 ở CẢ HAI cấp lưới: lưới không khai báo số cột dùng track
               `auto`, mà sàn của track là min-content của item. Nút bên trong có
               `truncate` (white-space: nowrap) nên min-content bằng nguyên chuỗi
               mô tả gói — track phình rộng hơn thẻ và cả danh sách tràn ra ngoài,
               đè lên rail phải ở desktop và làm trang cuộn ngang trên điện thoại.
               min-width:0 cho item co lại đúng bề ngang thẻ, chữ mới chịu cắt. */
            <div className="grid min-w-0 gap-2">
              {priceGroups.map(([key, list]) => (
                <div key={key} className="grid min-w-0 gap-2">
                  {priceGroups.length > 1 && (
                    <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>
                      {listLabel(key)}
                    </p>
                  )}
                  {list.map((p) => {
                    const on = mainSrc === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickMain(p)}
                        className="flex min-w-0 items-center gap-3 rounded-[11px] px-3.5 py-3 text-left"
                        style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                      >
                        <Package size={19} style={{ flex: "none", color: on ? "var(--ac)" : "var(--tx3)" }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                          <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                            {[p.category, p.description].filter(Boolean).join(" · ") || "Gói trong bảng giá"}
                          </span>
                        </span>
                        <strong className="tnum flex-none whitespace-nowrap text-[13.5px]">{vnd(p.price)}</strong>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Hạng mục thêm từ bảng giá lẻ ───────────────────────────────── */}
        {pricelist.length > 0 && (
          <div className={panel} style={panelStyle}>
            <h2 className="text-[15px] font-bold">Hạng mục thêm từ bảng giá lẻ</h2>
            <p className="mb-3 mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Những mục này gửi cho khách dưới dạng <b>tuỳ chọn</b> — khách tự tick, tổng tự cộng lại.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {pricelist.filter((p) => p.id !== mainSrc).map((p) => {
                const on = extraSrcs.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleExtra(p)}
                    className="flex min-w-0 items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-left"
                    style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                  >
                    {on ? <Check size={18} style={{ flex: "none", color: "var(--ac)" }} /> : <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />}
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{p.name}</span>
                    <span className="flex-none text-right">
                      <strong className="tnum block text-[12.5px]">{vnd(p.price)}</strong>
                      {p.unit && <span className="block text-[10px]" style={{ color: "var(--tx3)" }}>{p.unit}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Hạng mục tự nhập ───────────────────────────────────────────── */}
        <div className={panel} style={panelStyle}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Hạng mục tự nhập</h2>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => add(false)}
                className="flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
                data-testid="quote-item-add"
              >
                <Plus size={13} /> Thêm hạng mục
              </button>
              <button
                onClick={() => add(true)}
                className="flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
                style={{ border: "1px solid var(--bd)", color: "var(--am)" }}
                data-testid="quote-add-discount"
              >
                <Tag size={13} /> Thêm giảm giá
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
            Bấm <Lock size={10} className="inline" /> để khoá hạng mục bắt buộc (khách không bỏ chọn được),{" "}
            <LockOpen size={10} className="inline" /> cho hạng mục tuỳ chọn.
          </p>

          {items.length === 0 ? (
            <p className="mt-3 rounded-[10px] px-3.5 py-3 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
              Chưa có hạng mục nào. Chọn một gói ở trên, hoặc bấm “Thêm hạng mục” để tự nhập.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-[11px] p-3"
                  style={{
                    borderColor: it.is_discount ? "var(--am)" : "var(--bd)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    background: it.is_discount ? "var(--amS)" : "transparent",
                  }}
                  data-testid={`quote-item-${idx}`}
                >
                  {it.is_discount && (
                    <p className="mb-2 inline-flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--sf)", color: "var(--am)" }}>
                      <Tag size={10} /> Khoản giảm giá — trừ vào tổng
                    </p>
                  )}
                  <div className="grid gap-2 md:grid-cols-12">
                    <input
                      className={`${inputCls} md:col-span-5`}
                      style={inputStyle}
                      placeholder={it.is_discount ? "Tên giảm giá" : "Tên hạng mục"}
                      value={it.name}
                      onChange={(e) => update(idx, { name: e.target.value })}
                      data-testid={`quote-item-name-${idx}`}
                    />
                    <input
                      type="number"
                      min={1}
                      className={`${inputCls} md:col-span-2`}
                      style={inputStyle}
                      placeholder="SL"
                      value={it.qty}
                      onChange={(e) => update(idx, { qty: Number(e.target.value) || 0 })}
                    />
                    <div className="md:col-span-3">
                      <MoneyInput
                        value={it.unit_price}
                        onChange={(n) => update(idx, { unit_price: n })}
                        placeholder="Đơn giá"
                        className="tnum w-full rounded-[10px] px-3 py-2.5 text-right text-[13px]"
                      />
                    </div>
                    <div className="flex items-center gap-1 md:col-span-2">
                      <button
                        onClick={() => update(idx, { is_optional: !it.is_optional })}
                        className="flex flex-1 items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[11.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)" }}
                        data-testid={`quote-item-toggle-${idx}`}
                      >
                        {it.is_optional ? <LockOpen size={12} /> : <Lock size={12} />}
                        {it.is_optional ? "Tuỳ chọn" : "Bắt buộc"}
                      </button>
                      <button
                        onClick={() => remove(idx)}
                        className="flex h-[38px] w-9 flex-none items-center justify-center rounded-[9px]"
                        style={{ border: "1px solid var(--bd)", color: "var(--tx3)" }}
                        title="Xoá"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <input
                    className={`${inputCls} mt-2`}
                    style={inputStyle}
                    placeholder="Mô tả ngắn (tuỳ chọn)"
                    value={it.description}
                    onChange={(e) => update(idx, { description: e.target.value })}
                  />
                  {it.is_optional && !it.is_discount && (
                    <input
                      className={`${inputCls} mt-1.5`}
                      style={inputStyle}
                      placeholder="Nhóm gói (VD: goi-co-ban) — để trống nếu không thuộc gói"
                      value={it.package_group}
                      onChange={(e) => update(idx, { package_group: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Điều kiện báo giá ──────────────────────────────────────────── */}
        <div className={panel} style={panelStyle}>
          <div className="flex items-center">
            <h2 className="text-[15px] font-bold">Điều kiện báo giá</h2>
            <button
              onClick={() => setShowConditions((v) => !v)}
              className="ml-auto flex items-center gap-1.5 text-[11.5px] font-bold"
              style={{ color: "var(--ac)" }}
              aria-expanded={showConditions}
            >
              <Pencil size={13} /> {showConditions ? "Xong" : "Sửa"}
            </button>
          </div>

          {!showConditions ? (
            <div className="mt-2">
              {([
                ["Tiêu đề", title.trim() || autoTitle],
                ["Dịch vụ (điều khoản)", services.find((s) => s.id === serviceId)?.name || "Không chọn"],
                ["Ngày sự kiện", eventDate ? fmtDate(eventDate) : "Chưa có"],
                ["Địa điểm", location.trim() || "Chưa có"],
                ["Cọc đề xuất", total > 0 ? `${vnd(deposit)} (~${depositPct.toFixed(0)}%)` : "—"],
                ["Giảm theo gói chỉ định", bulkDiscountAmount > 0 && discountPackageGroup ? `${discountPackageGroup} · −${vnd(bulkDiscountAmount)}` : "Không áp dụng"],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 py-[11px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <span className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>{label}</span>
                  <span className="flex-none text-right text-[12.5px] font-semibold">{value}</span>
                </div>
              ))}
              <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Bỏ trống ô khách hàng cũng được — khách tự điền khi xác nhận báo giá.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-title">Tiêu đề báo giá</label>
                <input id="q-title" className={inputCls} style={inputStyle} placeholder={autoTitle} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="quote-title" />
              </div>
              {services.length > 0 && (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-svc">Dịch vụ (điều khoản riêng)</label>
                  <select id="q-svc" className={inputCls} style={inputStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    <option value="">— Không chọn —</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Ngày sự kiện</label>
                <DateInput value={eventDate} onChange={setEventDate} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-loc">Địa điểm</label>
                <input id="q-loc" className={inputCls} style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-email">Email khách</label>
                <input id="q-email" type="email" className={inputCls} style={inputStyle} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-fb">Link Facebook</label>
                <input id="q-fb" className={inputCls} style={inputStyle} placeholder="https://facebook.com/…" value={clientFacebook} onChange={(e) => setClientFacebook(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-intro">Lời chào / giới thiệu</label>
                <textarea id="q-intro" className={inputCls} style={inputStyle} rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
              </div>
              <div className="sm:col-span-2 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                <p className="text-[12px] font-bold">Giảm giá theo gói chỉ định (tuỳ chọn)</p>
                <p className="mb-2.5 mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Đặt “Nhóm gói” cho hạng mục tuỳ chọn ở trên để tạo gói (khách chỉ chọn 1 gói). Khách chọn đúng gói chỉ định thì tự động giảm thêm.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={fieldLabel} style={fieldLabelStyle} htmlFor="q-dg">Gói được giảm</label>
                    <select id="q-dg" className={inputCls} style={{ ...inputStyle, background: "var(--sf)" }} value={discountPackageGroup} onChange={(e) => setDiscountPackageGroup(e.target.value)}>
                      <option value="">— Không áp dụng —</option>
                      {packageGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel} style={fieldLabelStyle}>Số tiền giảm</label>
                    <MoneyInput
                      value={bulkDiscountAmount}
                      onChange={setBulkDiscountAmount}
                      placeholder="0"
                      className="tnum w-full rounded-[10px] px-3 py-2.5 text-right text-[13px]"
                    />
                  </div>
                </div>
                {packageGroups.length === 0 && (
                  <p className="mt-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    Chưa có gói nào — thêm “Nhóm gói” cho hạng mục tuỳ chọn để tạo gói.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Rail phải — bản khách sẽ nhận ═══════════════════════════════════
          Cập nhật ngay theo từng lựa chọn bên trái; mọi con số cộng từ chính
          mảng hạng mục, không có tổng viết tay. */}
      <div className={`${panel} min-[1180px]:sticky min-[1180px]:top-[76px]`} style={panelStyle}>
        <p className={eyebrow} style={eyebrowStyle}>Bản khách sẽ nhận</p>
        <p className="mb-3.5 mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>Cập nhật ngay khi bạn chọn</p>

        {previewLines.length === 0 ? (
          <p className="rounded-[10px] px-3.5 py-4 text-center text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
            Chưa có hạng mục nào — chọn gói chính để bắt đầu.
          </p>
        ) : (
          previewLines.map((l, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{l.name || "(chưa đặt tên)"}</p>
                <p className="mt-px truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                  {[l.is_discount ? "Giảm giá" : l.is_optional ? "Khách tự chọn" : "Bắt buộc", l.qty > 1 ? `×${l.qty}` : null, l.description || null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span
                className="tnum flex-none whitespace-nowrap text-[13px] font-bold"
                style={{ color: l.is_discount ? "var(--am)" : "var(--tx)" }}
              >
                {l.is_discount ? "− " : ""}{vnd((l.qty || 0) * (l.unit_price || 0))}
              </span>
            </div>
          ))
        )}

        <div className="mt-2.5 flex justify-between py-1.5 text-[12.5px]">
          <span style={{ color: "var(--tx2)" }}>Tổng hạng mục</span>
          <strong className="tnum">{vnd(grossTotal)}</strong>
        </div>
        {discountTotal > 0 && (
          <div className="flex justify-between py-1.5 text-[12.5px]">
            <span style={{ color: "var(--tx2)" }}>Giảm giá</span>
            <strong className="tnum" style={{ color: "var(--am)" }}>− {vnd(discountTotal)}</strong>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between pt-2.5" style={{ borderTop: "1px solid var(--bd)" }}>
          <span className="text-[13px] font-bold">Tổng báo giá</span>
          <strong className="tnum text-[20px]" style={{ color: "var(--ac)", letterSpacing: "-.5px" }} data-testid="quote-total">
            {vnd(total)}
          </strong>
        </div>
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
          Cọc đề xuất ~{depositPct.toFixed(0)}% (làm tròn 500K): <b style={{ color: "var(--tx2)" }}>{vnd(deposit)}</b>
        </p>

        <button
          onClick={() => save("send")}
          disabled={!!saving}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-3 text-[13.5px] font-bold disabled:opacity-50"
          style={{ background: "var(--ac)", color: "#fff" }}
          data-testid="quote-save-btn"
        >
          <Send size={17} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách"}
        </button>
        <button
          onClick={() => save("draft")}
          disabled={!!saving}
          className="mt-2 w-full rounded-[10px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ border: "1px solid var(--bd)" }}
        >
          {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
        </button>
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
          <Eye size={14} style={{ flex: "none", marginTop: 1 }} />
          Khối này chính là bản khách thấy — cả hai nút đều lưu rồi mở màn chi tiết, nơi có link gửi khách và nút gửi Zalo / Messenger / email.
        </p>

        {error && (
          <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }} data-testid="quote-save-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
