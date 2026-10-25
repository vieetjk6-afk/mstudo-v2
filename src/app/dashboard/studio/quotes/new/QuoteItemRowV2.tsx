"use client";

import { useState } from "react";
import { Lock, LockOpen, Plus, Tag, Trash2 } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Badge, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { vnd } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   MỘT DÒNG HẠNG MỤC BÁO GIÁ — giao diện mới, dùng chung cho màn Tạo báo giá
   (NewQuoteFormV2) và màn Sửa báo giá (QuoteEditorV2). Cùng các ô như bản cũ:
   tên · số lượng · đơn giá · bắt buộc/tuỳ chọn · xoá · mô tả nhiều dòng · nhóm
   gói (chỉ hạng mục tuỳ chọn). Khác ở cách đặt: mô tả và nhóm gói thu lại
   thành link "+ Mô tả" / "+ Nhóm gói" khi đang trống, cho danh sách gọn.
   ═══════════════════════════════════════════════════════════════════════════ */

export type QuoteItemLike = {
  name: string;
  description: string | null;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount: boolean;
  package_group: string | null;
  /** Chỉ có ở báo giá đã lưu: khách đang chọn hạng mục tuỳ chọn này không. */
  selected?: boolean;
};

export default function QuoteItemRowV2({
  item,
  index,
  onPatch,
  onRemove,
  disabled = false,
  showSelection = false,
  testIds = {},
}: {
  item: QuoteItemLike;
  index: number;
  onPatch: (patch: Partial<QuoteItemLike>) => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** Màn sửa: hiện "Khách đã chọn / bỏ chọn" và làm mờ dòng khách bỏ. */
  showSelection?: boolean;
  testIds?: { row?: string; name?: string; toggle?: string };
}) {
  const [showDesc, setShowDesc] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const desc = item.description ?? "";
  const group = item.package_group ?? "";
  const descOpen = showDesc || !!desc;
  const canGroup = item.is_optional && !item.is_discount;
  const groupOpen = canGroup && (showGroup || !!group);
  const line = (item.qty || 0) * (item.unit_price || 0);
  const faded = showSelection && item.is_optional && item.selected === false;

  return (
    <div
      className="relative min-w-0 px-3.5 py-3"
      style={{
        background: item.is_discount ? "color-mix(in srgb, var(--am) 6%, var(--sf))" : undefined,
        opacity: faded ? 0.55 : 1,
      }}
      data-testid={testIds.row}
    >
      {item.is_discount ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--am)" }} /> : null}

      <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_auto_auto] items-center gap-2 md:grid-cols-[minmax(0,1fr)_64px_136px_auto_auto]">
        <input
          className={`${inputCls} col-span-4 font-medium md:col-span-1`}
          placeholder={item.is_discount ? "Tên giảm giá" : "Tên hạng mục"}
          value={item.name}
          disabled={disabled}
          aria-label={`Tên hạng mục ${index + 1}`}
          onChange={(e) => onPatch({ name: e.target.value })}
          data-testid={testIds.name}
        />
        <input
          type="number"
          min={1}
          className={`${inputCls} tnum text-center`}
          placeholder="SL"
          title="Số lượng"
          aria-label={`Số lượng hạng mục ${index + 1}`}
          value={item.qty}
          disabled={disabled}
          onChange={(e) => onPatch({ qty: Number(e.target.value) || 0 })}
        />
        {disabled ? (
          // Báo giá đã chốt: chỉ xem (MoneyInput không có trạng thái khoá).
          <input
            className={`${inputCls} tnum text-right font-semibold`}
            value={item.unit_price ? item.unit_price.toLocaleString("vi-VN") : ""}
            aria-label={`Đơn giá hạng mục ${index + 1}`}
            disabled
            readOnly
          />
        ) : (
          <MoneyInput
            value={item.unit_price}
            onChange={(n) => onPatch({ unit_price: n })}
            placeholder="Đơn giá"
            ariaLabel={`Đơn giá hạng mục ${index + 1}`}
            className={`${inputCls} tnum text-right font-semibold`}
          />
        )}
        <button
          type="button"
          onClick={() => onPatch({ is_optional: !item.is_optional })}
          disabled={disabled}
          className={btn("secondary", "md", "px-3")}
          title={item.is_optional ? "Khách tự chọn có lấy hay không — bấm để khoá thành bắt buộc" : "Khách không bỏ được — bấm để mở thành tuỳ chọn"}
          data-testid={testIds.toggle}
        >
          {item.is_optional ? <LockOpen size={14} /> : <Lock size={14} />}
          <span className="text-[12.5px]">{item.is_optional ? "Tuỳ chọn" : "Bắt buộc"}</span>
        </button>
        {onRemove && !disabled ? (
          <button type="button" onClick={onRemove} aria-label={`Xoá hạng mục ${index + 1}`} title="Xoá" className={iconBtn()}>
            <Trash2 size={16} />
          </button>
        ) : (
          <span className="hidden md:block" />
        )}
      </div>

      {descOpen ? (
        // Nhiều dòng: Enter xuống dòng, khách thấy đúng từng dòng ở trang báo giá, bản in và hợp đồng chốt từ báo giá.
        <textarea
          className={`${inputCls} mt-2 block resize-y text-[13.5px]`}
          style={{ minHeight: 64 }}
          rows={2}
          value={desc}
          disabled={disabled}
          aria-label={`Mô tả hạng mục ${index + 1}`}
          placeholder="Mô tả (tuỳ chọn) — Enter để xuống dòng"
          onChange={(e) => onPatch({ description: e.target.value })}
          autoFocus={showDesc && !desc}
        />
      ) : null}
      {groupOpen ? (
        <input
          className={`${inputCls} mt-2`}
          value={group}
          disabled={disabled}
          aria-label={`Nhóm gói của hạng mục ${index + 1}`}
          placeholder="Nhóm gói (VD: goi-co-ban) — để trống nếu không thuộc gói"
          onChange={(e) => onPatch({ package_group: e.target.value })}
          autoFocus={showGroup && !group}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        {item.is_discount ? (
          <Badge tone="amber" icon={Tag}>Giảm giá — trừ vào tổng</Badge>
        ) : showSelection ? (
          <span style={{ color: item.is_optional ? (item.selected ? "var(--gn)" : "var(--tx3)") : "var(--tx3)" }}>
            {item.is_optional ? (item.selected ? "✓ Khách đã chọn" : "✗ Khách bỏ chọn") : "Bắt buộc"}
          </span>
        ) : null}
        {!disabled && !descOpen ? (
          <button type="button" onClick={() => setShowDesc(true)} className="inline-flex items-center gap-1 font-medium hover:underline" style={{ color: "var(--tx2)" }}>
            <Plus size={13} /> Mô tả
          </button>
        ) : null}
        {!disabled && canGroup && !groupOpen ? (
          <button type="button" onClick={() => setShowGroup(true)} className="inline-flex items-center gap-1 font-medium hover:underline" style={{ color: "var(--tx2)" }}>
            <Plus size={13} /> Nhóm gói
          </button>
        ) : null}
        <span className="ml-auto" style={{ color: "var(--tx3)" }}>
          {item.is_discount ? "Giảm" : "Thành tiền"}{" "}
          <b className="tnum" style={{ color: item.is_discount ? "var(--am)" : "var(--tx)" }}>
            {item.is_discount ? "− " : ""}
            {vnd(line)}
          </b>
        </span>
      </div>
    </div>
  );
}
