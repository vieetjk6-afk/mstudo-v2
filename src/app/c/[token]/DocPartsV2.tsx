"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Languages } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { CustomerRootV2 } from "@/components/v2/customer";
import { useTheme } from "@/lib/theme";

/* ═══════════════════════════════════════════════════════════════════════════
   KHỐI NHỎ DÙNG CHUNG cho các trang tài liệu gửi khách ở giao diện mới (hợp
   đồng /c, báo giá /q, form /form, voucher, bảng giá…). Chỉ là phần vẽ + chút
   tương tác thuần trình duyệt (chép, cuộn) — mọi dữ liệu và lời gọi máy chủ
   vẫn nằm ở hook của từng trang.
   ═══════════════════════════════════════════════════════════════════════════ */

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

/**
 * <CustomerRootV2> đi theo nền sáng/tối người xem đang dùng (như bản cũ của
 * trang hợp đồng/báo giá: `:root[data-theme="dark"] .client-doc`). Mặc định
 * nền sáng — khách chưa từng chọn thì luôn sáng.
 */
export function CustomerRootAuto({ children, className }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  return (
    <CustomerRootV2 theme={theme} className={className}>
      {children}
    </CustomerRootV2>
  );
}

/**
 * Theo dõi một phần tử còn trong màn hình hay không — để thanh thao tác dính
 * dưới đáy chỉ hiện khi nút chính ở đầu trang đã cuộn khuất (không hiện hai nút
 * chính cùng lúc).
 */
export function useInView<T extends Element>(el: T | null, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [el, rootMargin]);
  return inView;
}

/**
 * Thanh thao tác dính dưới đáy màn hình trên điện thoại (ẩn từ khổ `lg`).
 * Đặt BÊN TRONG <CustomerRootV2> để nhận đúng token màu.
 */
export function StickyActionBar({ show, children, always = false }: { show: boolean; children: React.ReactNode; always?: boolean }) {
  return (
    <div
      aria-hidden={!show}
      className={cx("fixed inset-x-0 bottom-0 z-40", !always && "lg:hidden")}
      style={{
        transform: show ? "translateY(0)" : "translateY(110%)",
        visibility: show ? "visible" : "hidden",
        transition: show ? "transform .2s ease" : "transform .2s ease, visibility 0s linear .2s",
        background: "color-mix(in srgb, var(--sf) 94%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid var(--bd)",
        boxShadow: "0 -10px 30px -18px rgba(15, 30, 55, 0.35)",
        paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[1080px] items-center gap-3 pt-2.5"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Thông báo nổi ngắn trên đầu trang (thay alert của trình duyệt). */
export function ToastV2({ msg, tone = "red" }: { msg: string | null; tone?: "red" | "green" | "dark" }) {
  if (!msg) return null;
  const bg = tone === "red" ? "var(--rd)" : tone === "green" ? "var(--gn)" : "var(--tx)";
  const fg = tone === "dark" ? "var(--sf)" : "#fff";
  return (
    <div
      role="alert"
      className="no-print fixed left-1/2 top-[72px] z-[100] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full px-4 py-2 text-[13.5px] font-medium"
      style={{ background: bg, color: fg, boxShadow: "var(--sh-toast)" }}
    >
      {msg}
    </div>
  );
}

/** Nút đổi ngôn ngữ VI ⇄ EN gọn trên đầu trang. */
export function LangToggle({ lang, onToggle }: { lang: "vi" | "en"; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={btn("ghost", "sm", "!px-2.5")}
      aria-label={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
      title={lang === "vi" ? "English" : "Tiếng Việt"}
    >
      <Languages size={15} /> {lang === "vi" ? "EN" : "VI"}
    </button>
  );
}

/** Một dòng thông tin có nút chép (số tài khoản, nội dung chuyển khoản, mã…). */
export function CopyRow({
  label,
  value,
  copy,
  strong = false,
  mono = false,
  copiedLabel = "Đã chép",
  copyLabel = "Chép",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Chuỗi được chép; bỏ trống = dòng không có nút chép. */
  copy?: string | null;
  strong?: boolean;
  mono?: boolean;
  copiedLabel?: string;
  copyLabel?: string;
}) {
  const [done, setDone] = useState(false);
  function doCopy() {
    if (!copy) return;
    navigator.clipboard?.writeText(copy).catch(() => {});
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  }
  return (
    <div className="flex min-w-0 items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          {label}
        </p>
        <p
          className={cx("break-words", strong ? "text-[16px] font-bold" : "text-[14px] font-semibold", mono && "tracking-[0.03em]")}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </p>
      </div>
      {copy ? (
        <button
          type="button"
          onClick={doCopy}
          className={btn(done ? "soft" : "secondary", "sm", "flex-none")}
          aria-label={`${copyLabel}: ${typeof label === "string" ? label : ""}`}
        >
          {done ? <Check size={14} /> : <Copy size={14} />} {done ? copiedLabel : copyLabel}
        </button>
      ) : null}
    </div>
  );
}

export type StepItem = { key: string; label: string; done: boolean };

/**
 * Tiến trình vài bước (Ký → Đặt cọc → Chụp → Giao ảnh): chấm tròn nối nhau,
 * bước xong màu xanh lá, bước đang tới màu chủ đạo. Nhãn luôn hiện (≤ 4 bước).
 */
export function StepsBar({ steps, label }: { steps: StepItem[]; label?: string }) {
  const cur = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid min-w-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={label}>
      {steps.map((s, i) => {
        const now = i === cur;
        const fg = s.done ? "var(--gn)" : now ? "var(--ac)" : "var(--tx3)";
        const lineDone = i < steps.length - 1 && s.done && steps[i + 1].done;
        return (
          <li key={s.key} className="relative flex min-w-0 flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute top-[13px] h-[2px]"
                style={{ left: "calc(50% + 17px)", right: "calc(-50% + 17px)", background: lineDone ? "var(--gn)" : "var(--bd)" }}
              />
            )}
            <span
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
              style={
                s.done
                  ? { background: "var(--gn)", color: "#fff" }
                  : now
                    ? { background: "var(--acS)", color: "var(--ac)", boxShadow: "0 0 0 2px var(--ac) inset" }
                    : { background: "var(--sf2)", color: "var(--tx3)", boxShadow: "0 0 0 1px var(--bd) inset" }
              }
            >
              {s.done ? <Check size={15} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className="mt-1.5 max-w-full truncate px-0.5 text-[12px]" style={{ color: fg, fontWeight: s.done || now ? 650 : 500 }}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Ô số liệu trong thẻ đầu trang tài liệu (nhãn nhỏ + giá trị + dòng phụ). */
export function Fact({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 px-4 py-3 sm:px-5 sm:py-3.5", className)}>
      <dt className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>
        {label}
      </dt>
      <dd className="mt-1 text-[14.5px] font-semibold">{children}</dd>
    </div>
  );
}

/** Dòng tiền: nhãn trái, số tiền canh phải. */
export function MoneyLine({
  label,
  value,
  tone,
  big = false,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: string;
  big?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={big ? "text-[14px] font-semibold" : "text-[13.5px]"} style={{ color: big ? "var(--tx)" : "var(--tx2)" }}>
        {label}
        {sub ? <span className="block text-[12px] font-normal" style={{ color: "var(--tx3)" }}>{sub}</span> : null}
      </span>
      <span
        className={cx("flex-none whitespace-nowrap", big ? "text-[20px] font-bold tracking-[-0.4px]" : "text-[14px] font-semibold")}
        style={{ color: tone ?? "var(--tx)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}
