"use client";

/** Money input that shows thousands separators (1.500.000) and returns a number. */
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
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(Number((e.target.value || "").replace(/\D/g, "")) || 0)}
    />
  );
}
