"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nextQuoteCode, newShareToken } from "@/lib/contract-code";
import { safeDeposit } from "@/lib/quote-lines";
import { depositByPercent } from "@/lib/quote-deposit";
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
  /** Mở từ một yêu cầu đặt lịch: điền sẵn khách, ngày, gói. */
  fromBooking?: { id: string; name: string; phone: string; facebook: string; eventDate: string; packageNames: string[] } | null;
  /** % cọc studio đặt (null = cách tính cũ) — cọc tạm tính khớp hợp đồng sẽ tạo. */
  depositPercent?: number | null;
};

export function useNewQuoteForm({ ownerId, branchId = null, services = [], pricelist = [], listLabels = {}, fromBooking = null, depositPercent = null }: NewQuoteFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [clientName, setClientName] = useState(fromBooking?.name ?? "");
  const [clientPhone, setClientPhone] = useState(fromBooking?.phone ?? "");
  const [clientEmail, setClientEmail] = useState("");
  const [clientFacebook, setClientFacebook] = useState(fromBooking?.facebook ?? "");
  const [eventDate, setEventDate] = useState(fromBooking?.eventDate ?? "");
  const [location, setLocation] = useState("");
  const [intro, setIntro] = useState(
    "Cảm ơn bạn đã quan tâm. Dưới đây là báo giá chi tiết — bạn có thể chọn/bỏ các hạng mục tuỳ chọn hoặc gửi yêu cầu chỉnh sửa cho mình."
  );
  // Gói khách chọn trong yêu cầu đặt lịch → gói đầu là gói chính, các gói sau
  // là tuỳ chọn (khớp theo tên trong bảng giá).
  const [items, setItems] = useState<Draft[]>(() => {
    if (!fromBooking?.packageNames.length) return [];
    const out: Draft[] = [];
    fromBooking.packageNames.forEach((n, i) => {
      const p = pricelist.find((x) => x.name.trim().toLowerCase() === n.trim().toLowerCase());
      if (!p) return;
      out.push({ name: p.name, description: p.description || "", qty: 1, unit_price: p.price, is_optional: i > 0, is_discount: false, package_group: "", src: p.id });
    });
    return out;
  });
  const [bulkDiscountAmount, setBulkDiscountAmount] = useState(0);
  const [discountPackageGroup, setDiscountPackageGroup] = useState("");
  const [showConditions, setShowConditions] = useState(false);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Khớp đúng thứ được lưu: trong các gói loại trừ nhau chỉ gói đầu tiên được
  // tick sẵn, nên tổng tạm tính cũng chỉ cộng gói đó (không cộng dồn mọi gói).
  const firstGroupPreview = items.find((i) => i.package_group.trim())?.package_group.trim() ?? null;
  const counts = (i: (typeof items)[number]) => !i.package_group.trim() || i.package_group.trim() === firstGroupPreview;
  const grossTotal = items.reduce((s, i) => (i.is_discount || !counts(i) ? s : s + (i.qty || 0) * (i.unit_price || 0)), 0);
  const discountTotal = items.reduce((s, i) => (i.is_discount && counts(i) ? s + (i.qty || 0) * (i.unit_price || 0) : s), 0);
  const total = grossTotal - discountTotal;
  // Kẹp cọc về [0, tổng] — tổng 0 không được ra "Cọc Infinity%".
  const deposit = typeof depositPercent === "number" ? depositByPercent(total, depositPercent) : safeDeposit(total);
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

  // Tên mặc định: dịch vụ + tên khách + NGÀY CHỤP (nếu có). Không dùng ngày hôm
  // nay — khách đọc "Báo giá 22/11/2026" dễ tưởng là ngày chụp.
  const autoTitle = [
    "Báo giá",
    services.find((s) => s.id === serviceId)?.name || "",
    clientName.trim() ? `— ${clientName.trim()}` : "",
    eventDate ? `· ${fmtDate(eventDate)}` : "",
  ].filter(Boolean).join(" ");

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

      // Các gói (package_group) LOẠI TRỪ nhau: chỉ tick sẵn gói đầu tiên. Trước
      // đây mọi dòng đều selected → khách thấy "Chọn 1 gói" mà cả hai gói đều
      // được tick và tổng cộng dồn cả hai.
      const firstGroup = cleaned.find((it) => it.package_group.trim())?.package_group.trim() ?? null;
      const rows = cleaned.map((it, idx) => ({
        quote_id: quote.id,
        name: it.name.trim(),
        description: it.description.trim() || null,
        qty: it.qty || 1,
        unit_price: it.unit_price || 0,
        // Dòng thuộc một gói luôn là tuỳ chọn — không thì "Bắt buộc" + gói bị
        // tính tiền dù khách chọn gói khác.
        is_optional: it.is_optional || !!it.package_group.trim(),
        is_discount: it.is_discount,
        package_group: it.package_group.trim() || null,
        selected: !it.package_group.trim() || it.package_group.trim() === firstGroup,
        position: idx,
      }));
      const { error: iErr } = await supabase.from("quote_items").insert(rows);
      if (iErr) throw new Error(iErr.message);

      // Cả hai nút đều mở màn chi tiết báo giá — nơi có nút gửi thật (Zalo /
      // Messenger / email). Báo giá vẫn ở trạng thái nháp cho tới lúc gửi.
      // "Tạo & gửi khách" mở luôn hộp gửi (chép link + lời nhắn, Zalo…) — trước
      // đây hai nút làm y hệt nhau, studio tưởng đã gửi mà khách chưa nhận gì.
      // Yêu cầu đặt lịch gốc → "đã xử lý", để danh sách đặt lịch không còn nút
      // "Tạo HĐ" mời tạo trùng hợp đồng khi khách đã đi theo đường báo giá.
      if (fromBooking) {
        await supabase.from("studio_bookings").update({ status: "handled" }).eq("id", fromBooking.id).in("status", ["new", "pending", "accepted"]);
      }
      router.push(`/dashboard/studio/quotes/${quote.id}${mode === "send" ? "?send=1" : ""}`);
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
