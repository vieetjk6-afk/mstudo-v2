"use client";

import { useRouter } from "next/navigation";
import { quoteShareMessage } from "@/lib/share-messages";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import {
  vnd,
  QUOTE_STATUS_LABEL,
  quoteSelectedTotal,
  type StudioQuote,
  type QuoteItem,
  type QuoteAdjustment,
  type QuoteStatus,
} from "@/lib/types";
import { activeBulkDiscount, safeDeposit } from "@/lib/quote-lines";
import { depositRatio } from "@/lib/quote-deposit";
import { quoteExpiryFrom } from "@/lib/quote-expiry";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Sửa báo giá — bản cũ (QuoteEditor) và giao
   diện mới (QuoteEditorV2) cùng gọi: bản đang sửa so với bản đã lưu, lưu gộp,
   đổi trạng thái, hạn hiệu lực, thêm/xoá hạng mục, chép link, in PDF, chuyển
   thành hợp đồng, trao đổi với khách. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

type EditableQuoteFields = Pick<
  StudioQuote,
  "title" | "client_name" | "client_phone" | "client_email" | "client_facebook" | "event_date" | "location" | "intro" | "bulk_discount_amount" | "discount_package_group"
>;

const FIELD_KEYS: (keyof EditableQuoteFields)[] = [
  "title", "client_name", "client_phone", "client_email", "client_facebook", "event_date", "location", "intro",
  "bulk_discount_amount", "discount_package_group",
];

function pickFields(q: StudioQuote): EditableQuoteFields {
  return {
    title: q.title,
    client_name: q.client_name,
    client_phone: q.client_phone,
    client_email: q.client_email,
    client_facebook: q.client_facebook,
    event_date: q.event_date,
    location: q.location,
    intro: q.intro,
    bulk_discount_amount: q.bulk_discount_amount ?? 0,
    discount_package_group: q.discount_package_group ?? null,
  };
}

export type QuoteEditorProps = {
  quote: StudioQuote;
  initialItems: QuoteItem[];
  initialAdjustments: QuoteAdjustment[];
  canConvert: boolean;
  studioHost?: string | null;
  /** Hạn hiệu lực mặc định của studio (ngày). 0 = không đặt hạn. */
  quoteValidDays?: number;
};

export function useQuoteEditor({
  quote: initialQuote,
  initialItems,
  initialAdjustments,
  studioHost = null,
  quoteValidDays = 15,
}: QuoteEditorProps) {
  const router = useRouter();
  const supabase = createClient();
  const [quote, setQuote] = useState(initialQuote);
  const [items, setItems] = useState(initialItems);
  const [savedFields, setSavedFields] = useState<EditableQuoteFields>(pickFields(initialQuote));
  const [savedItems, setSavedItems] = useState<QuoteItem[]>(initialItems);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const shareUrl = studioUrl(studioHost, `/q/${quote.client_token}`);
  const total = quoteSelectedTotal(items);
  const grossTotal = items.reduce(
    (s, i) => (i.is_discount ? s : s + (i.qty || 0) * (i.unit_price || 0)),
    0,
  );
  const discountTotal = items.reduce(
    (s, i) => (i.is_discount ? s + (i.qty || 0) * (i.unit_price || 0) : s),
    0,
  );
  // Cọc tính trên tổng ĐÃ trừ ưu đãi gói (khớp trang khách và hợp đồng chốt
  // ra), kẹp về [0, tổng] — tổng 0 không được ra "Cọc Infinity%".
  const payableTotal = total - activeBulkDiscount(quote, items);
  const deposit = safeDeposit(payableTotal);
  const depositPct = depositRatio(payableTotal, deposit);
  const locked = quote.status === "accepted" || quote.status === "converted";

  /**
   * Xuất PDF báo giá từ phía studio — mở một cửa sổ chứa bản A4 rồi gọi in;
   * hộp in của trình duyệt có sẵn "Lưu thành PDF". Dữ liệu lấy từ state đang
   * mở nên bản in luôn khớp thứ đang thấy trên màn hình.
   */
  function printQuote() {
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
    const rows = items
      .map((it) => {
        const line = (it.qty || 0) * (it.unit_price || 0);
        const tag = it.is_discount ? "Giảm giá" : it.is_optional ? "Tuỳ chọn" : "Bắt buộc";
        return `<tr><td>${esc(it.name || "")}${it.description ? `<div style="font-size:11px;color:#555;white-space:pre-line">${esc(it.description.trim())}</div>` : ""}</td>
<td class="c">${tag}</td><td class="c">${it.is_discount ? "" : it.qty}</td>
<td class="r">${it.is_discount ? "− " : ""}${vnd(line)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(quote.title || "Báo giá")}</title>
<style>
@page{size:A4;margin:16mm}
body{font-family:'Times New Roman',Times,'DejaVu Serif',serif;color:#111;max-width:720px;margin:0 auto;padding:8px 0;font-size:13px;line-height:1.5}
h1{text-align:center;font-size:22px;font-weight:700;margin:0}
h2{font-size:15px;margin:18px 0 8px}
.sub{text-align:center;font-size:13px;margin:4px 0 22px;color:#333}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;border-bottom:1px solid #333;padding:5px 0;font-size:12px}
td{padding:5px 0;border-bottom:1px solid #ddd;vertical-align:top}
.c{text-align:center;width:80px}.r{text-align:right;width:130px}
.meta td{border:none;padding:3px 0}
.tot td{border:none;padding:2px 0;text-align:right}
.tot .v{width:150px;font-weight:700}
.note{white-space:pre-wrap;margin:0}
</style></head>
<body onload="window.print()">
<h1>BÁO GIÁ DỊCH VỤ</h1>
<p class="sub">${esc(quote.title || "")}${quote.code ? ` · ${esc(quote.code)}` : ""}</p>
<table class="meta"><tbody>
<tr><td style="width:150px">Khách hàng:</td><td><b>${esc(quote.client_name || "—")}</b>${quote.client_phone ? ` · ĐT: ${esc(quote.client_phone)}` : ""}${quote.client_email ? ` · ${esc(quote.client_email)}` : ""}</td></tr>
<tr><td>Ngày sự kiện:</td><td>${quote.event_date ? esc(quote.event_date) : "—"}</td></tr>
<tr><td>Địa điểm:</td><td>${esc(quote.location || "—")}</td></tr>
</tbody></table>
${quote.intro ? `<p class="note" style="margin-top:14px">${esc(quote.intro)}</p>` : ""}
<h2>Hạng mục báo giá</h2>
<table><thead><tr><th>Hạng mục</th><th class="c">Loại</th><th class="c">SL</th><th class="r">Thành tiền</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4">Chưa có hạng mục.</td></tr>`}</tbody></table>
<table class="tot"><tbody>
<tr><td>Tổng hạng mục:</td><td class="v">${vnd(grossTotal)}</td></tr>
${discountTotal > 0 ? `<tr><td>Giảm giá:</td><td class="v">− ${vnd(discountTotal)}</td></tr>` : ""}
<tr><td>Tổng báo giá:</td><td class="v">${vnd(total)}</td></tr>
${payableTotal !== total ? `<tr><td>Ưu đãi gói ${esc(quote.discount_package_group || "")}:</td><td class="v">− ${vnd(total - payableTotal)}</td></tr><tr><td>Khách thanh toán:</td><td class="v">${vnd(payableTotal)}</td></tr>` : ""}
<tr><td>Cọc đề xuất (~${depositPct.toFixed(0)}%):</td><td class="v">${vnd(deposit)}</td></tr>
</tbody></table>
<p style="margin-top:24px;font-size:12px;color:#555">Báo giá chỉ mang tính tham khảo và có thể thay đổi theo thoả thuận. Hạng mục "Tuỳ chọn" khách tự chọn trên trang báo giá trực tuyến.</p>
</body></html>`;
    const w = window.open("", "_blank", "width=860,height=900");
    if (!w) {
      setErr("Trình duyệt chặn cửa sổ in — cho phép pop-up rồi bấm lại.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  // Dirty = any editable field differs from its last-saved snapshot, or any
  // item field differs from the matching saved item.
  const fieldsDirty = FIELD_KEYS.some((k) => (quote[k] ?? "") !== (savedFields[k] ?? ""));
  const itemsDirty = items.some((it) => {
    const saved = savedItems.find((s) => s.id === it.id);
    if (!saved) return true;
    return (
      it.name !== saved.name ||
      it.description !== saved.description ||
      it.qty !== saved.qty ||
      it.unit_price !== saved.unit_price ||
      it.is_optional !== saved.is_optional ||
      it.is_discount !== saved.is_discount ||
      it.position !== saved.position ||
      (it.package_group ?? "") !== (saved.package_group ?? "")
    );
  });
  const dirty = fieldsDirty || itemsDirty;

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2200);
  }

  function patchLocal(patch: Partial<StudioQuote>) {
    setQuote((q) => ({ ...q, ...patch }));
  }
  function patchItemLocal(id: string, patch: Partial<QuoteItem>) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveAll() {
    if (locked || saving) return;
    setSaving(true);
    setErr(null);
    try {
      // 1) Field-level patch on studio_quotes if any field changed.
      if (fieldsDirty) {
        const patch: Partial<StudioQuote> = {};
        FIELD_KEYS.forEach((k) => {
          // Send null for empty strings on optional text columns.
          patch[k] = (quote[k] ?? null) as never;
        });
        const { error } = await supabase.from("studio_quotes").update(patch).eq("id", quote.id);
        if (error) throw new Error(error.message);
      }
      // 2) Per-item patch for any dirty items.
      const tasks: Promise<{ error: unknown } | null>[] = [];
      items.forEach((it) => {
        const saved = savedItems.find((s) => s.id === it.id);
        if (
          saved &&
          it.name === saved.name &&
          it.description === saved.description &&
          it.qty === saved.qty &&
          it.unit_price === saved.unit_price &&
          it.is_optional === saved.is_optional &&
          it.is_discount === saved.is_discount &&
          it.position === saved.position &&
          (it.package_group ?? "") === (saved.package_group ?? "")
        ) {
          return;
        }
        tasks.push(
          supabase
            .from("quote_items")
            .update({
              name: it.name,
              description: it.description,
              qty: it.qty,
              unit_price: it.unit_price,
              is_optional: it.is_optional,
              is_discount: it.is_discount,
              position: it.position,
              package_group: it.package_group || null,
            })
            .eq("id", it.id) as unknown as Promise<{ error: unknown }>,
        );
      });
      const results = await Promise.all(tasks);
      const firstErr = results.find((r) => r && (r as { error: unknown }).error);
      if (firstErr) throw new Error(String((firstErr as { error: { message?: string } }).error?.message ?? "Lỗi lưu hạng mục"));

      setSavedFields(pickFields(quote));
      setSavedItems(items);
      flash("✓ Đã lưu thay đổi");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  async function patchQuoteImmediate(patch: Partial<StudioQuote>) {
    // Used for status changes — don't get batched with editable fields.
    setQuote((q) => ({ ...q, ...patch }));
    const { error } = await supabase.from("studio_quotes").update(patch).eq("id", quote.id);
    if (error) setErr(error.message);
  }

  async function changeStatus(status: QuoteStatus) {
    if (status === quote.status) return;
    // Converting is special — it spawns a contract. Keep that on the dedicated
    // button so the studio doesn't trigger it accidentally from the dropdown.
    if (status === "converted") {
      setErr("Để chuyển sang 'Đã tạo hợp đồng', dùng nút Tạo hợp đồng.");
      return;
    }
    await patchQuoteImmediate({ status });
    flash(`Đã chuyển trạng thái: ${QUOTE_STATUS_LABEL[status]}`);
  }

  async function addItem(asDiscount: boolean) {
    const position = items.length;
    const { data, error } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quote.id,
        name: asDiscount ? "Giảm giá combo" : "Hạng mục mới",
        qty: 1,
        unit_price: asDiscount ? 500000 : 0,
        is_optional: !asDiscount,        // discounts are mandatory by default
        is_discount: asDiscount,
        selected: true,
        position,
      })
      .select("*")
      .single();
    if (error || !data) {
      setErr(error?.message || "Không thêm được");
      return;
    }
    setItems((arr) => [...arr, data as QuoteItem]);
    setSavedItems((arr) => [...arr, data as QuoteItem]);
  }

  async function deleteItem(id: string) {
    setItems((arr) => arr.filter((it) => it.id !== id));
    setSavedItems((arr) => arr.filter((it) => it.id !== id));
    await supabase.from("quote_items").delete().eq("id", id);
  }

  async function copyLink() {
    // Chép kèm lời nhắn để studio dán thẳng vào Zalo/Messenger, không phải gõ câu dẫn.
    await navigator.clipboard.writeText(quoteShareMessage(quote.client_name, quote.title, shareUrl));
    flash("Đã chép link kèm lời nhắn!");
  }

  async function markSent() {
    setBusy(true);
    // Đặt hạn hiệu lực ngay lúc gửi (nếu studio chưa tự đặt): đây là lúc DUY
    // NHẤT biết chắc mốc bắt đầu đếm. Đặt lúc tạo nháp thì báo giá soạn dở cả
    // tuần đã tự hết hạn trước khi khách kịp nhận.
    const patch: Partial<StudioQuote> = { status: "sent" };
    if (!quote.expires_at) patch.expires_at = quoteExpiryFrom(quoteValidDays);
    await patchQuoteImmediate(patch);
    setBusy(false);
    flash(patch.expires_at ? `Đã đánh dấu 'Đã gửi' · hiệu lực ${quoteValidDays} ngày.` : "Đã đánh dấu là 'Đã gửi'.");
  }

  /** Gia hạn hiệu lực thêm N ngày kể từ hôm nay (dùng cho báo giá đã hết hạn). */
  async function extendExpiry(days: number) {
    setBusy(true);
    // Hết hạn rồi mà gia hạn thì đưa về lại trạng thái "đã gửi" — để nguyên
    // 'expired' thì khách bấm đồng ý vẫn bị chặn dù studio đã mở lại.
    const patch: Partial<StudioQuote> = { expires_at: quoteExpiryFrom(days) };
    if (quote.status === "expired") patch.status = "sent";
    await patchQuoteImmediate(patch);
    setBusy(false);
    flash(`Đã gia hạn thêm ${days} ngày.`);
  }

  /** Bỏ hạn — báo giá có hiệu lực tới khi studio tự huỷ. */
  async function clearExpiry() {
    setBusy(true);
    const patch: Partial<StudioQuote> = { expires_at: null };
    if (quote.status === "expired") patch.status = "sent";
    await patchQuoteImmediate(patch);
    setBusy(false);
    flash("Đã bỏ hạn hiệu lực.");
  }

  async function cancel() {
    if (!confirm("Hủy báo giá này?")) return;
    await patchQuoteImmediate({ status: "cancelled" });
    flash("Đã hủy báo giá.");
  }

  async function deleteQuote() {
    if (!confirm("Xoá báo giá này? Mọi hạng mục sẽ bị xoá theo.")) return;
    setBusy(true);
    const { error } = await supabase.from("studio_quotes").delete().eq("id", quote.id);
    if (error) {
      setBusy(false);
      setErr(`Lỗi: ${error.message}`);
      return;
    }
    router.push("/dashboard/studio/quotes");
  }

  async function convertToContract() {
    if (!confirm(`Tạo hợp đồng từ báo giá này?\n\nTổng tiền: ${vnd(payableTotal)}\nCọc đề xuất: ${vnd(deposit)}`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/quote-convert/${quote.id}`, { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.contract_id) throw new Error(data.error || "Tạo hợp đồng thất bại");
      flash("Đã tạo hợp đồng. Đang chuyển trang…");
      setTimeout(() => router.push(`/dashboard/studio/contracts/${data.contract_id}`), 600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi không xác định");
      setBusy(false);
    }
  }

  async function resolveAdjustment(id: string, resolved: boolean) {
    setAdjustments((arr) => arr.map((a) => (a.id === id ? { ...a, resolved } : a)));
    await supabase.from("quote_adjustments").update({ resolved }).eq("id", id);
  }

  const pendingAdj = adjustments.filter((a) => !a.resolved && a.author === "client");

  // Distinct package groups defined across items (for the discount selector).
  const packageGroups = Array.from(
    new Set(items.map((it) => (it.package_group || "").trim()).filter(Boolean)),
  );
  // Discount preview (mirrors client view): active when the selected package is
  // the designated discount package.
  const selectedPackageGroup = items.find((it) => it.package_group && it.selected)?.package_group ?? null;
  const bulkDiscountActive =
    !!quote.discount_package_group &&
    selectedPackageGroup === quote.discount_package_group &&
    (quote.bulk_discount_amount ?? 0) > 0;

  return {
    quote, items, adjustments, saving, busy, msg, err,
    shareUrl, total, grossTotal, discountTotal, payableTotal, deposit, depositPct, locked,
    fieldsDirty, itemsDirty, dirty, pendingAdj, packageGroups, selectedPackageGroup, bulkDiscountActive,
    printQuote, patchLocal, patchItemLocal, saveAll, changeStatus, addItem, deleteItem, copyLink, markSent,
    extendExpiry, clearExpiry, cancel, deleteQuote, convertToContract, resolveAdjustment,
  };
}
