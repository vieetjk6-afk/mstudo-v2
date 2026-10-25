"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nextQuoteCode, newShareToken } from "@/lib/contract-code";
import { safeDeposit } from "@/lib/quote-lines";
import { depositRatio } from "@/lib/quote-deposit";
import { fmtDate } from "@/lib/date";
import { makeListLabel } from "@/lib/pricelist-label";
import type { QuickDraft } from "@/lib/contract-quick";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Tạo báo giá — bản cũ (NewQuoteForm) và giao
   diện mới (NewQuoteFormV2) cùng gọi: thông tin khách, chọn gói/hạng mục từ
   bảng giá, hạng mục tự nhập, giảm giá, Tạo nhanh, tổng & cọc, và lưu. Hai bản
   chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** `src` nhớ hạng mục này sinh ra từ dòng nào của bảng giá, để tick/bỏ tick
 *  ở hai khối trên cùng một nguồn mà không so khớp theo tên. */
export type Draft = {
  name: string;
  description: string;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount: boolean;
  package_group: string;
  src?: string;
};
export type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  description: string | null;
  category: string | null;
  list_key: string | null;
};

export type NewQuoteFormProps = {
  ownerId: string;
  /** Chi nhánh đang xem — báo giá mới thuộc luôn cơ sở đó, và hợp đồng chốt từ
   *  nó cũng thừa hưởng (xem lib/quote-convert.ts). */
  branchId?: string | null;
  services?: { id: string; name: string }[];
  pricelist?: PriceItem[];
  /** Nhãn studio tự đặt cho từng bảng giá (profiles.pl_list_labels). */
  listLabels?: Record<string, string>;
};

export function useNewQuoteForm({ ownerId, branchId = null, services = [], pricelist = [], listLabels = {} }: NewQuoteFormProps) {
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
  // Kẹp cọc về [0, tổng] — tổng 0 không được ra "Cọc Infinity%".
  const deposit = safeDeposit(total);
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

  /* ── Tạo nhanh: cùng bộ phân tích với màn tạo hợp đồng ───────────────────
     Báo giá không có thợ, cọc hay giờ chụp nên chỉ lấy phần khách + gói. Gói
     chính là hạng mục BẮT BUỘC, hạng mục thêm là TUỲ CHỌN (khách tự tick ở
     trang báo giá) — đúng như khi studio bấm chọn tay ở bên dưới. */
  const quickContext = useMemo(
    () => ({
      packages: pricelist.map((p) => ({ id: p.id, name: p.name, price: p.price, list_key: p.list_key })),
      services: services.map((x) => ({ id: x.id, name: x.name })),
      crew: [],
    }),
    [pricelist, services]
  );
  const [quickDone, setQuickDone] = useState<"ai" | "rules" | null>(null);
  function applyQuick(d: QuickDraft, source: "ai" | "rules") {
    if (d.clientName) setClientName(d.clientName);
    if (d.clientPhone) setClientPhone(d.clientPhone);
    if (d.eventDate) setEventDate(d.eventDate);
    if (d.location) setLocation(d.location);
    if (d.serviceId && services.some((x) => x.id === d.serviceId)) setServiceId(d.serviceId);
    if (d.title) setTitle(d.title);
    const byId = new Map(pricelist.map((p) => [p.id, p]));
    const main = d.mainPkgId ? byId.get(d.mainPkgId) : undefined;
    const extras = (d.extraIds ?? []).map((id) => byId.get(id)).filter((p): p is PriceItem => !!p && p.id !== main?.id);
    if (main || extras.length || d.customLines?.length) {
      const rows: Draft[] = [];
      if (main) {
        rows.push({
          name: main.name, description: main.description || "", qty: 1,
          unit_price: d.mainPrice ?? main.price, is_optional: false, is_discount: false, package_group: "", src: main.id,
        });
      }
      for (const c of d.customLines ?? []) {
        rows.push({ name: c.name, description: "", qty: c.qty, unit_price: c.unit_price, is_optional: false, is_discount: false, package_group: "" });
      }
      for (const x of extras) {
        rows.push({
          name: x.name, description: x.description || "", qty: 1,
          unit_price: x.price, is_optional: true, is_discount: false, package_group: "", src: x.id,
        });
      }
      // Giữ các dòng studio tự gõ tay không thuộc bảng giá; thay phần từ bảng giá.
      setItems((arr) => [...rows, ...arr.filter((i) => !i.src && !rows.some((r) => r.name === i.name))]);
    }
    setQuickDone(source);
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
          ...(branchId ? { branch_id: branchId } : {}),
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

  /** Dòng khách sẽ thấy ở rail phải — cùng một mảng items, không tính lại tay. */
  const previewLines = items.filter((i) => i.name.trim() || i.unit_price);

  return {
    services, pricelist, router,
    title, setTitle, serviceId, setServiceId, clientName, setClientName, clientPhone, setClientPhone,
    clientEmail, setClientEmail, clientFacebook, setClientFacebook, eventDate, setEventDate, location, setLocation,
    intro, setIntro, items, bulkDiscountAmount, setBulkDiscountAmount, discountPackageGroup, setDiscountPackageGroup,
    showConditions, setShowConditions, saving, error,
    grossTotal, discountTotal, total, deposit, depositPct, packageGroups, mainSrc, extraSrcs, listLabel, priceGroups,
    update, add, remove, pickMain, toggleExtra, quickContext, quickDone, applyQuick, autoTitle, save, previewLines,
  };
}
