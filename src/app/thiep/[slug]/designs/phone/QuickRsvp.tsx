"use client";

import { useState, type CSSProperties } from "react";
import RsvpForm from "../../RsvpForm";

type Choice = "yes" | "maybe" | "no";

/**
 * Xác nhận tham dự kiểu "ba nút" của bộ thiệp điện thoại: khách chạm một nút
 * để trả lời nhanh, form đầy đủ (tên, số người, lời chúc) mới mở ra bên dưới
 * và ghi thẳng vào danh sách phản hồi như mọi mẫu thiệp khác.
 */
export default function QuickRsvp({
  slug, note, labels = ["Có mặt", "Chưa chắc", "Xin phép"], btn, btnOn, msg, msgStyle, formWrap,
}: {
  slug: string;
  note?: string;
  labels?: [string, string, string];
  btn: CSSProperties;
  /** Style của nút đang được chọn. */
  btnOn: CSSProperties;
  /** Câu trả lời hiện dưới ba nút, theo từng lựa chọn. */
  msg?: Record<Choice, string>;
  msgStyle?: CSSProperties;
  formWrap?: CSSProperties;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);

  const replies: Record<Choice, string> = msg ?? {
    yes: "Tuyệt quá! Điền giúp tụi mình vài thông tin nhé.",
    maybe: "Không sao, cứ điền trước — đổi ý lúc nào cũng được.",
    no: "Tiếc quá! Gửi tụi mình một lời chúc nhé.",
  };

  const keys: Choice[] = ["yes", "maybe", "no"];

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        {keys.map((k, i) => (
          <button key={k} type="button" onClick={() => setChoice(k)} style={{ ...btn, ...(choice === k ? btnOn : null) }}>
            {labels[i]}
          </button>
        ))}
      </div>
      {choice && (
        <>
          <div style={{ minHeight: 18, ...msgStyle }}>{replies[choice]}</div>
          <div style={formWrap}>
            <RsvpForm slug={slug} note={note} initialAttending={choice !== "no"} />
          </div>
        </>
      )}
    </>
  );
}
