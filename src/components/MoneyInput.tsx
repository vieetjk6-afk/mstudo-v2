"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Money input that shows thousands separators (1.500.000) and returns a number.
 *
 * Giá trị được định dạng lại mỗi lần gõ, nên phải tự giữ con trỏ: trước đây gõ
 * giữa "1.500.000" là con trỏ nhảy về cuối, và Backspace ngay sau dấu "." chẳng
 * xoá gì (chữ số không đổi → React trả lại chuỗi cũ). Giờ con trỏ đứng sau đúng
 * số chữ số như trước khi gõ, và Backspace/Delete vào dấu chấm thì xoá luôn chữ
 * số kề bên.
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder,
  className = "input",
  style,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const display = value > 0 ? value.toLocaleString("vi-VN") : "";
  const ref = useRef<HTMLInputElement>(null);
  // Số chữ số đứng TRƯỚC con trỏ, cần khôi phục sau lượt vẽ kế tiếp.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const want = caretDigits.current;
    if (!el || want === null || document.activeElement !== el) return;
    caretDigits.current = null;
    let pos = 0;
    for (let seen = 0; pos < display.length && seen < want; pos++) {
      if (/\d/.test(display[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
  }, [display]);

  const emit = (raw: string, caret: number) => {
    caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
    onChange(Number(raw.replace(/\D/g, "")) || 0);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onChange={(e) => emit(e.target.value || "", e.target.selectionStart ?? e.target.value.length)}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        const s = el.selectionStart ?? 0;
        if (s !== el.selectionEnd) return; // đang bôi đen → để trình duyệt xử lý
        const v = el.value;
        // Backspace ngay sau dấu chấm / Delete ngay trước dấu chấm: xoá chữ số kề.
        if (e.key === "Backspace" && s > 1 && !/\d/.test(v[s - 1])) {
          e.preventDefault();
          emit(v.slice(0, s - 2) + v.slice(s), s - 2);
        } else if (e.key === "Delete" && s < v.length - 1 && !/\d/.test(v[s])) {
          e.preventDefault();
          emit(v.slice(0, s + 1) + v.slice(s + 2), s + 1);
        }
      }}
    />
  );
}
