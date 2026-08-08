"use client";

import { useRouter } from "next/navigation";
import DateInput from "@/components/DateInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Lock, LockOpen, Send, FileSignature, X, Check, Save, Tag, CloudOff, Printer } from "lucide-react";
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
import { computeRoundedDeposit, depositRatio } from "@/lib/quote-deposit";

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

export default function QuoteEditor({
  quote: initialQuote,
  initialItems,
  initialAdjustments,
  canConvert,
  studioHost = null,
}: {
  quote: StudioQuote;
  initialItems: QuoteItem[];
  initialAdjustments: QuoteAdjustment[];
  canConvert: boolean;
  studioHost?: string | null;
}) {
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
  const deposit = computeRoundedDeposit(total);
  const depositPct = depositRatio(total, deposit);
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
        return `<tr><td>${esc(it.name || "")}${it.description ? `<div style="font-size:11px;color:#555">${esc(it.description)}</div>` : ""}</td>
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
    await navigator.clipboard.writeText(shareUrl);
    flash("Đã copy link!");
  }

  async function markSent() {
    setBusy(true);
    await patchQuoteImmediate({ status: "sent" });
    setBusy(false);
    flash("Đã đánh dấu là 'Đã gửi'.");
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
    if (!confirm(`Tạo hợp đồng từ báo giá này?\n\nTổng tiền: ${vnd(total)}\nCọc đề xuất: ${vnd(deposit)}`)) return;
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

  return (
    <div className="space-y-6" data-testid="quote-edit-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/studio/quotes" aria-label="Quay lại danh sách báo giá" className="btn-ghost px-2 py-1.5"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="font-serif text-2xl font-medium">{quote.title}</h1>
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              {quote.code || "—"} • <span className="text-accent">{QUOTE_STATUS_LABEL[quote.status]}</span>
              {dirty && !locked && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>
                  <CloudOff size={10} /> Chưa lưu
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text3)" }}>
            Trạng thái
            <select
              className="input py-1.5 text-xs"
              style={{ width: "auto" }}
              value={quote.status === "converted" ? "converted" : quote.status}
              onChange={(e) => changeStatus(e.target.value as QuoteStatus)}
              data-testid="quote-status-select"
            >
              {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((k) => (
                <option key={k} value={k} disabled={k === "converted"}>{QUOTE_STATUS_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {!locked && (
            <button
              onClick={saveAll}
              disabled={!dirty || saving}
              className="btn-primary text-xs"
              data-testid="quote-save-btn"
            >
              <Save size={12} /> {saving ? "Đang lưu…" : dirty ? "Lưu thay đổi" : "Đã lưu"}
            </button>
          )}
          <button onClick={printQuote} className="btn-ghost px-3 py-2 text-xs">
            <Printer size={12} /> Xuất PDF
          </button>
          <button onClick={copyLink} className="btn-ghost px-3 py-2 text-xs" data-testid="quote-copy-link">
            <Copy size={12} /> Copy link khách
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">
            <ExternalLink size={12} /> Xem trang khách
          </a>
          {quote.status === "draft" && !dirty && (
            <button onClick={markSent} disabled={busy} className="btn-primary text-xs" data-testid="quote-mark-sent">
              <Send size={12} /> Đánh dấu đã gửi
            </button>
          )}
          {quote.status === "accepted" && !quote.contract_id && canConvert && (
            <button onClick={convertToContract} disabled={busy} className="btn-primary text-xs" data-testid="quote-convert">
              <FileSignature size={12} /> Tạo hợp đồng
            </button>
          )}
          {quote.status === "accepted" && !quote.contract_id && !canConvert && (
            <span className="rounded-md px-2 py-1.5 text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }} data-testid="quote-convert-upsell">
              Khách đã đồng ý — nâng cấp gói Studio để tạo hợp đồng
            </span>
          )}
          {quote.contract_id && (
            <Link href={`/dashboard/studio/contracts/${quote.contract_id}`} className="btn-primary text-xs">
              <FileSignature size={12} /> Mở hợp đồng
            </Link>
          )}
          {quote.status === "cancelled" && (
            <button onClick={deleteQuote} disabled={busy} className="btn-danger px-3 py-2 text-xs">
              <Trash2 size={12} /> Xoá
            </button>
          )}
        </div>
      </header>

      {msg && <p className="rounded-md px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}>{msg}</p>}
      {err && <p className="rounded-md px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)" }}>{err}</p>}

      {adjustments.length > 0 && (
        <section className="card p-5" data-testid="quote-adjustments">
          <h2 className="text-sm font-medium" style={{ color: pendingAdj.length > 0 ? "var(--s-amber)" : "var(--text2)" }}>
            Trao đổi với khách {pendingAdj.length > 0 && <span className="ml-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>{pendingAdj.length} chưa xử lý</span>}
          </h2>
          <div className="mt-3 space-y-2">
            {adjustments.map((a) => {
              const isPending = !a.resolved && a.author === "client";
              return (
                <div
                  key={a.id}
                  className="rounded-md p-3"
                  style={{
                    background: isPending ? "var(--s-amberS)" : "var(--surface2)",
                    border: isPending ? "1px solid var(--s-amberS)" : "1px solid transparent",
                    opacity: a.resolved ? 0.55 : 1,
                  }}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px]" style={{ color: "var(--text3)" }}>
                    <span className="font-medium" style={{ color: a.author === "client" ? "var(--s-amber)" : "var(--text2)" }}>
                      {a.author === "client" ? "Khách" : "Studio"}
                    </span>
                    <span>{new Date(a.created_at).toLocaleString("vi-VN")}</span>
                    {a.resolved && <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: "rgba(52,211,153,0.15)", color: "var(--success)" }}>Đã xử lý</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{a.message}</p>
                  {isPending && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => resolveAdjustment(a.id, true)} className="btn-ghost px-2 py-1 text-xs">
                        <Check size={10} /> Đánh dấu đã xử lý
                      </button>
                    </div>
                  )}
                  {a.resolved && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => resolveAdjustment(a.id, false)} className="btn-ghost px-2 py-1 text-xs" style={{ color: "var(--text3)" }}>
                        <X size={10} /> Bỏ đánh dấu
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-medium" style={{ color: "var(--text2)" }}>Thông tin chung</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
          {locked ? "Báo giá đã chốt — không thể chỉnh sửa." : "Bạn có thể chỉnh sửa thoải mái khi khách chưa đồng ý. Nhớ bấm Lưu sau khi sửa."}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Tiêu đề báo giá">
            <input className="input" value={quote.title} disabled={locked} onChange={(e) => patchLocal({ title: e.target.value })} />
          </Field>
          <Field label="Tên khách">
            <input className="input" value={quote.client_name || ""} disabled={locked} onChange={(e) => patchLocal({ client_name: e.target.value })} />
          </Field>
          <Field label="SĐT">
            <input className="input" value={quote.client_phone || ""} disabled={locked} onChange={(e) => patchLocal({ client_phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={quote.client_email || ""} disabled={locked} onChange={(e) => patchLocal({ client_email: e.target.value })} />
          </Field>
          <Field label="Link Facebook">
            <input className="input" value={quote.client_facebook || ""} disabled={locked} placeholder="https://facebook.com/..." onChange={(e) => patchLocal({ client_facebook: e.target.value })} />
          </Field>
          <Field label="Ngày sự kiện">
            <DateInput value={quote.event_date || ""} disabled={locked} onChange={(v) => patchLocal({ event_date: v || null })} />
          </Field>
          <Field label="Địa điểm">
            <input className="input" value={quote.location || ""} disabled={locked} onChange={(e) => patchLocal({ location: e.target.value })} />
          </Field>
        </div>
        <Field label="Lời chào / Giới thiệu" className="mt-3">
          <textarea className="input" rows={3} value={quote.intro || ""} disabled={locked} onChange={(e) => patchLocal({ intro: e.target.value })} />
        </Field>
        <div className="mt-4 rounded-lg p-3" style={{ background: "var(--surface2)" }}>
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--text2)" }}>Giảm giá theo gói chỉ định (tuỳ chọn)</p>
          <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
            Nếu khách chọn đúng gói bạn chỉ định bên dưới, tự động giảm thêm số tiền tương ứng. Đặt nhóm gói cho từng hạng mục ở phần Hạng mục.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Gói được giảm">
              <select className="input" value={quote.discount_package_group ?? ""} disabled={locked}
                onChange={(e) => patchLocal({ discount_package_group: e.target.value || null })}>
                <option value="">— Không áp dụng —</option>
                {packageGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền giảm (VND)">
              <input type="number" min={0} className="input" value={quote.bulk_discount_amount ?? 0} disabled={locked}
                onChange={(e) => patchLocal({ bulk_discount_amount: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          {packageGroups.length === 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
              Chưa có gói nào. Thêm “Nhóm gói” cho các hạng mục tuỳ chọn để tạo gói.
            </p>
          )}
          {quote.discount_package_group && (quote.bulk_discount_amount ?? 0) > 0 && (
            <p className="mt-2 text-xs" style={{ color: bulkDiscountActive ? "var(--success)" : "var(--text3)" }}>
              {bulkDiscountActive
                ? `✓ Đang áp dụng — khách được giảm ${vnd(quote.bulk_discount_amount ?? 0)}`
                : `Khách chưa chọn gói “${quote.discount_package_group}” nên chưa được giảm`}
            </p>
          )}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium" style={{ color: "var(--text2)" }}>Hạng mục</h2>
          {!locked && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => addItem(false)} className="btn-ghost px-2.5 py-1.5 text-xs">
                <Plus size={12} /> Thêm hạng mục
              </button>
              <button onClick={() => addItem(true)} className="btn-ghost px-2.5 py-1.5 text-xs" style={{ color: "var(--s-amber)" }} data-testid="quote-add-discount">
                <Tag size={12} /> Thêm giảm giá
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-lg border p-3"
              style={{
                borderColor: it.is_discount ? "var(--s-amberS)" : "var(--border)",
                background: it.is_discount ? "var(--s-amberS)" : "transparent",
                opacity: it.is_optional && !it.selected ? 0.5 : 1,
              }}
              data-testid={`quote-edit-item-${it.id}`}
            >
              {it.is_discount && (
                <p className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>
                  <Tag size={10} /> Khoản giảm giá — trừ vào tổng
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-12">
                <input
                  className="input md:col-span-5"
                  value={it.name}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  className="input md:col-span-2"
                  value={it.qty}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { qty: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  min={0}
                  className="input md:col-span-3"
                  value={it.unit_price}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { unit_price: Number(e.target.value) || 0 })}
                />
                <div className="flex items-center gap-1 md:col-span-2">
                  <button
                    onClick={() => patchItemLocal(it.id, { is_optional: !it.is_optional })}
                    className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                    disabled={locked}
                  >
                    {it.is_optional ? <LockOpen size={12} /> : <Lock size={12} />}
                    {it.is_optional ? "Tuỳ chọn" : "Bắt buộc"}
                  </button>
                  {!locked && (
                    <button onClick={() => deleteItem(it.id)} className="btn-ghost px-2 py-1.5" title="Xoá">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <input
                className="input mt-2"
                value={it.description || ""}
                disabled={locked}
                placeholder="Mô tả (tuỳ chọn)"
                onChange={(e) => patchItemLocal(it.id, { description: e.target.value })}
              />
              {it.is_optional && !it.is_discount && (
                <input
                  className="input mt-1.5"
                  value={it.package_group || ""}
                  disabled={locked}
                  placeholder="Nhóm gói (VD: goi-co-ban) — để trống nếu không thuộc gói"
                  onChange={(e) => patchItemLocal(it.id, { package_group: e.target.value })}
                />
              )}
              <p className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--text3)" }}>
                <span>
                  {it.is_optional ? (it.selected ? "✓ Khách đã chọn" : "✗ Khách bỏ chọn") : "Bắt buộc"}
                </span>
                <span style={{ color: it.is_discount ? "var(--s-amber)" : "var(--text3)" }}>
                  {it.is_discount ? "Giảm: " : "Thành tiền: "}
                  <b style={{ color: it.is_discount ? "var(--s-amber)" : "var(--text)" }}>
                    {it.is_discount ? "−" : ""}{vnd((it.qty || 0) * (it.unit_price || 0))}
                  </b>
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-end gap-1 text-sm" style={{ color: "var(--text2)" }}>
          <p>Tổng hạng mục: {vnd(grossTotal)}</p>
          {discountTotal > 0 && <p style={{ color: "var(--s-amber)" }}>Giảm giá item: −{vnd(discountTotal)}</p>}
          {bulkDiscountActive && <p style={{ color: "var(--success)" }}>Ưu đãi gói {quote.discount_package_group}: −{vnd(quote.bulk_discount_amount ?? 0)}</p>}
          <p>
            <b className="text-base text-accent">
              Khách đang chọn: {vnd(bulkDiscountActive ? total - (quote.bulk_discount_amount ?? 0) : total)}
            </b>
          </p>
          <p className="text-xs">Cọc đề xuất (~{depositPct.toFixed(0)}%, làm tròn 500K): {vnd(deposit)}</p>
        </div>
      </section>

      {!locked && quote.status !== "cancelled" && (
        <button onClick={cancel} className="btn-ghost text-xs" style={{ color: "var(--text3)" }}>
          <X size={12} /> Hủy báo giá này
        </button>
      )}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
