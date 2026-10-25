"use client";

import { Check, RotateCcw } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { iconBtn, inputCls } from "@/components/v2/kit";
import { vnd } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh giao diện DÙNG CHUNG cho ba màn nhập liệu V2 của nhóm "tạo hợp đồng /
   báo giá" (NewContractFormV2, NewQuoteFormV2, QuoteEditorV2): danh sách lựa
   chọn có giá, dòng tổng tiền, thanh hành động ghim đáy điện thoại. Chỉ dùng
   token màu của bộ khối V2.
   ═══════════════════════════════════════════════════════════════════════════ */

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

/**
 * Màn nhập liệu có thanh hành động ghim đáy riêng → ẩn nút "+" nổi của thanh
 * tab điện thoại trong lúc màn đang mở: nó nằm đè đúng góc phải của thanh hành
 * động (chỗ nút chính), và đang tạo dở một thứ thì "tạo thứ khác" chỉ là nhiễu.
 */
export function HideCreateFab() {
  return (
    <style>{`@media (max-width:1023.98px){nav[aria-label="Điều hướng nhanh"]>button[aria-label="Tạo mới"]{display:none!important}}`}</style>
  );
}

/**
 * Thanh hành động ghim đáy cho màn CHƯA có cột phải (dưới 1280px). Điện thoại:
 * ngồi ngay trên thanh tab của khung V2 (cao ~69px); từ 1024px khung không còn
 * thanh tab nên hạ xuống sát đáy. `sticky` chứ không `fixed` (xem ghi chú ở
 * NewContractForm bản cũ): phần tử nằm ở cuối luồng nên không che mất nội dung
 * nào. Đặt nó là con TRỰC TIẾP của khối bao cả màn để nó bám suốt chiều dài màn.
 */
export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-20 mt-4 lg:bottom-4 xl:hidden">
      <div
        className="v2-card flex items-center gap-2.5 px-3 py-2.5"
        style={{ boxShadow: "0 10px 30px -10px rgba(16, 24, 40, .28), 0 1px 3px rgba(16, 24, 40, .08)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Tiêu đề phụ trong một khối (vd "Gói chính", "Hạng mục thêm"). */
export function SubHead({ title, aside, className }: { title: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", className)}>
      <h4 className="text-[13.5px] font-semibold" style={{ color: "var(--tx)" }}>{title}</h4>
      {aside ? <div className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{aside}</div> : null}
    </div>
  );
}

/** Khung danh sách viền mảnh, các dòng ngăn bằng một nét. */
export function RowList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx("min-w-0 overflow-hidden rounded-[12px] [&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]", className)}
      style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
    >
      {children}
    </div>
  );
}

/** Nhãn nhóm nhỏ trong RowList (vd tên bảng giá khi có nhiều bảng). */
export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <p className="truncate px-3.5 py-2 text-[11.5px] font-semibold uppercase" style={{ background: "var(--sf2)", color: "var(--tx3)", letterSpacing: ".03em" }}>
      {children}
    </p>
  );
}

/** Ô tròn (chọn một) hoặc ô vuông (chọn nhiều) — chỉ để nhìn, không nhận bấm. */
export function Indicator({ on, mode }: { on: boolean; mode: "radio" | "check" }) {
  return (
    <span
      aria-hidden
      className={cx("flex h-[18px] w-[18px] flex-none items-center justify-center", mode === "radio" ? "rounded-full" : "rounded-[5px]")}
      style={{
        border: `1.5px solid ${on ? "var(--ac)" : "var(--bdS, var(--bd))"}`,
        background: on ? (mode === "radio" ? "var(--sf)" : "var(--ac)") : "var(--sf)",
      }}
    >
      {on ? (
        mode === "radio" ? (
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} />
        ) : (
          <Check size={12} strokeWidth={3} color="#fff" />
        )
      ) : null}
    </span>
  );
}

/**
 * Một dòng lựa chọn: phần trái (ô chọn + tên + dòng phụ) là NÚT bật/tắt; phần
 * phải nằm NGOÀI nút (ô sửa giá không được lồng trong <button>).
 */
export function ChoiceRow({
  on,
  mode,
  title,
  sub,
  right,
  onToggle,
  testId,
}: {
  on: boolean;
  mode: "radio" | "check";
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-2 pr-3 transition-colors"
      style={{ background: on ? "color-mix(in srgb, var(--ac) 6%, var(--sf))" : undefined }}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ac)]"
      >
        <Indicator on={on} mode={mode} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium" style={{ color: "var(--tx)" }}>{title}</span>
          {sub ? <span className="mt-px block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{sub}</span> : null}
        </span>
      </button>
      {right ? <div className="flex flex-none items-center gap-1">{right}</div> : null}
    </div>
  );
}

/** Giá niêm yết (khi chưa chọn) — canh phải, số đều. */
export function PriceText({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <span className="tnum whitespace-nowrap text-[13.5px] font-semibold" style={{ color: muted ? "var(--tx3)" : "var(--tx)" }}>
      {vnd(value)}
    </span>
  );
}

/** Ô sửa giá đã thương lượng + nút hoàn về giá bảng giá (chỉ hiện khi đã sửa). */
export function PriceEditor({
  value,
  onChange,
  edited,
  onReset,
  listPrice,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  edited: boolean;
  onReset: () => void;
  listPrice: number;
  ariaLabel: string;
}) {
  return (
    <>
      {edited ? (
        <button type="button" onClick={onReset} aria-label={`Hoàn về giá bảng giá ${vnd(listPrice)}`} title={`Hoàn về ${vnd(listPrice)}`} className={iconBtn()} style={{ width: 32, height: 32 }}>
          <RotateCcw size={15} />
        </button>
      ) : null}
      <MoneyInput
        value={value}
        onChange={onChange}
        placeholder="Giá"
        ariaLabel={ariaLabel}
        className={cx(inputCls, "tnum text-right font-semibold")}
        // Bề ngang đặt inline: `.ui-v2 .v2-input { width:100% }` thắng lớp w-[…] của Tailwind.
        style={{ width: 120, height: 34 }}
      />
    </>
  );
}

/** Dòng nhãn — số tiền trong khối tổng. */
export function SumRow({
  label,
  value,
  strong = false,
  tone,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  tone?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 text-[13px]" style={{ color: strong ? "var(--tx)" : "var(--tx2)", fontWeight: strong ? 600 : 400 }}>
        {label}
        {sub ? <span className="block text-[11.5px] font-normal" style={{ color: "var(--tx3)" }}>{sub}</span> : null}
      </span>
      <span
        className={cx("tnum flex-none whitespace-nowrap", strong ? "text-[20px] font-bold" : "text-[13.5px] font-semibold")}
        style={{ color: tone ?? (strong ? "var(--ac)" : "var(--tx)"), letterSpacing: strong ? "-.4px" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

/** Nút "+ thêm dòng" viền đứt, chiếm cả bề ngang. */
export function AddRowButton({ onClick, children, testId }: { onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-semibold transition-colors hover:bg-[var(--sf2)]"
      style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
    >
      {children}
    </button>
  );
}
