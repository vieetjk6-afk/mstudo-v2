"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { fmtLunar } from "@/lib/date";

// Date field that always SHOWS dd/mm/yyyy (regardless of browser locale) while
// emitting an ISO yyyy-mm-dd string via onChange. A calendar button opens the
// native picker for convenience. Emits "" when the field is empty/incomplete.

function isoToDisplay(iso: string): string {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function displayToIso(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  // Chặn ngày KHÔNG có thật (vd 31/02): nếu chỉ kiểm 1–31 thì "2026-02-31" khi
  // parse lại bị JS đẩy sang 03/03 — ô nhập âm thầm nhảy sang ngày khác ngày người
  // dùng gõ. Dựng Date rồi soi lại từng thành phần để loại các ngày tràn tháng.
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// Today as a local yyyy-mm-dd (not UTC, so it flips at local midnight).
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DateInput({
  value,
  onChange,
  className = "input",
  wrapperClassName = "",
  placeholder = "dd/mm/yyyy",
  id,
  disabled = false,
  lunar = true,
  allowPast = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  wrapperClassName?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  lunar?: boolean;
  allowPast?: boolean;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [pastWarn, setPastWarn] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const min = allowPast ? undefined : todayIso();
  // Keep the displayed text in sync when the value changes from outside.
  useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  // Reject past dates unless explicitly allowed (e.g. back-dating old albums).
  function emit(iso: string) {
    if (iso && !allowPast && iso < todayIso()) {
      setPastWarn(true);
      onChange("");
      return;
    }
    setPastWarn(false);
    onChange(iso);
  }

  function handleText(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length >= 5) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length >= 3) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    emit(displayToIso(out));
  }

  return (
    <div className={wrapperClassName} style={{ position: "relative", width: "100%" }}>
      <input
        id={id}
        className={className}
        style={{ width: "100%", paddingRight: 36 }}
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(e) => handleText(e.target.value)}
      />
      <button
        type="button"
        aria-label="Chọn ngày"
        disabled={disabled}
        onClick={() => { const p = picker.current; if (p?.showPicker) p.showPicker(); else p?.focus(); }}
        // Vùng bấm 30×30 quanh cái icon 15px. Icon trần thì đầu ngón tay bấm
        // trượt trên điện thoại; hộp này trong suốt và nằm gọn trong phần đệm
        // phải của ô nhập nên không đẩy gì cả.
        style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, color: "var(--text3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <Calendar size={15} />
      </button>
      <input
        ref={picker}
        type="date"
        value={value || ""}
        min={min}
        onChange={(e) => emit(e.target.value)}
        tabIndex={-1}
        aria-hidden
        style={{ position: "absolute", right: 6, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      {pastWarn && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--s-red, #d66)" }}>Không thể chọn ngày trong quá khứ.</p>
      )}
      {lunar && value && fmtLunar(value) && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Âm lịch: {fmtLunar(value)}</p>
      )}
    </div>
  );
}
