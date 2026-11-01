"use client";

import { useState } from "react";
import { transferNote } from "@/lib/vietqr";

/* Ô "Nội dung chuyển khoản (QR hợp đồng)" — dùng chung cho bản cũ
   (PricingManager) và giao diện mới (PricingSettingsV2). Ba lựa chọn:
     • Chỉ số hợp đồng
     • Số hợp đồng + ngày
     • Tự nhập — chèn {so_hd}, {ngay}; app tự bỏ dấu tiếng Việt.
   Lưu ở profiles.qr_note_date + profiles.qr_note_template (rỗng = không tự nhập). */

type Value = { qr_note_date: boolean; qr_note_template: string };
type Mode = "code" | "date" | "custom";

const SAMPLE = { code: "HD-11-2026-007", event_date: "2026-12-25" };
const DEFAULT_TEMPLATE = "{so_hd}";

export default function TransferNoteField({
  value,
  onChange,
  selectClassName,
  inputClassName,
  inputStyle,
  hintClassName = "mt-1 text-[11.5px]",
  hintColor = "var(--tx3)",
}: {
  value: Value;
  onChange: (patch: Partial<Value>) => void;
  selectClassName: string;
  inputClassName: string;
  inputStyle?: React.CSSProperties;
  hintClassName?: string;
  hintColor?: string;
}) {
  // Chế độ giữ ở state riêng: chọn "Tự nhập" rồi xoá hết chữ thì ô vẫn còn để
  // gõ lại, không tự nhảy về "Chỉ số hợp đồng".
  const [mode, setMode] = useState<Mode>(value.qr_note_template.trim() ? "custom" : value.qr_note_date ? "date" : "code");

  function pick(m: Mode) {
    setMode(m);
    if (m === "custom") onChange({ qr_note_template: value.qr_note_template.trim() || DEFAULT_TEMPLATE });
    else onChange({ qr_note_template: "", qr_note_date: m === "date" });
  }

  const example = transferNote(SAMPLE, null, {
    withDate: value.qr_note_date,
    sepay: false,
    template: mode === "custom" ? value.qr_note_template : null,
  });

  return (
    <div className="grid gap-2">
      <select aria-label="Kiểu nội dung chuyển khoản" className={selectClassName} style={inputStyle} value={mode} onChange={(e) => pick(e.target.value as Mode)}>
        <option value="code">Chỉ số hợp đồng — VD: HD-11-2026-007</option>
        <option value="date">Số hợp đồng + ngày — VD: HD-11-2026-007 25-12-2026</option>
        <option value="custom">Tự nhập…</option>
      </select>
      {mode === "custom" && (
        <input
          aria-label="Nội dung chuyển khoản tự nhập"
          className={inputClassName}
          style={inputStyle}
          maxLength={60}
          placeholder="VD: TT {so_hd}"
          value={value.qr_note_template}
          onChange={(e) => onChange({ qr_note_template: e.target.value })}
        />
      )}
      <p className={hintClassName} style={{ color: hintColor }}>
        {mode === "custom" && (
          <>
            Chèn <code>{"{so_hd}"}</code> (số hợp đồng) và <code>{"{ngay}"}</code> (ngày chính). Chữ có dấu tự bỏ dấu, tối đa 50 ký tự.{" "}
          </>
        )}
        Khách sẽ thấy: <b>{example || "(trống — khách tự ghi)"}</b>. Đã bật Tự xác nhận chuyển khoản (SePay) thì tự thêm mã MS… ở đầu để
        tiền về tự ghi thu.
      </p>
    </div>
  );
}
