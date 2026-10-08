"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { BUDGETS, COMPANY, SERVICES } from "@/lib/vieetjk-ai/content";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const OTHER = "Khác / chưa rõ";

/** Form "Nhận tư vấn" — gửi về /api/vieetjk-ai/contact (lưu vào Dashboard → Yêu cầu mới). */
export default function ContactForm({ defaultService = "" }: { defaultService?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/vieetjk-ai/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd.entries())),
      });
      if (res.ok) {
        form.reset();
        setState({ kind: "sent" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const message =
        data.error === "no_phone"
          ? "Số điện thoại chưa đúng — vui lòng kiểm tra lại (ví dụ 0974 374 744)."
          : res.status === 429
            ? "Bạn vừa gửi khá nhiều yêu cầu. Vui lòng thử lại sau ít phút."
            : `Chưa gửi được yêu cầu. Bạn vui lòng gọi ${COMPANY.phone} hoặc nhắn Zalo để được hỗ trợ ngay.`;
      setState({ kind: "error", message });
    } catch {
      setState({
        kind: "error",
        message: `Không kết nối được máy chủ. Bạn vui lòng gọi ${COMPANY.phone} hoặc nhắn Zalo để được hỗ trợ ngay.`,
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="va-form">
        <div className="va-sent" role="status">
          <span className="va-ico">
            <CheckCircle2 size={24} />
          </span>
          <h3>Đã nhận yêu cầu của bạn!</h3>
          <p>Chuyên viên Vieetjk sẽ liên hệ lại với bạn sớm nhất trong giờ làm việc. Cảm ơn bạn đã tin tưởng.</p>
          <button type="button" className="va-btn va-btn-ghost" style={{ marginTop: 22 }} onClick={() => setState({ kind: "idle" })}>
            Gửi yêu cầu khác
          </button>
        </div>
      </div>
    );
  }

  const sending = state.kind === "sending";

  return (
    <form className="va-form" onSubmit={onSubmit}>
      <h3>Nhận tư vấn miễn phí</h3>
      <p className="va-form-sub">Để lại thông tin, chúng tôi sẽ gọi lại để tìm hiểu nhu cầu và đề xuất giải pháp phù hợp.</p>

      <div className="va-fields">
        <div className="va-field">
          <label htmlFor="va-name">
            Họ và tên <b>*</b>
          </label>
          <input id="va-name" name="name" className="va-input" required maxLength={120} autoComplete="name" placeholder="Nguyễn Văn A" />
        </div>
        <div className="va-field">
          <label htmlFor="va-phone">
            Số điện thoại <b>*</b>
          </label>
          <input
            id="va-phone"
            name="phone"
            className="va-input"
            required
            type="tel"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="09xx xxx xxx"
          />
        </div>
        <div className="va-field">
          <label htmlFor="va-email">Email</label>
          <input id="va-email" name="email" className="va-input" type="email" maxLength={160} autoComplete="email" placeholder="ban@congty.vn" />
        </div>
        <div className="va-field">
          <label htmlFor="va-company">Công ty</label>
          <input id="va-company" name="company" className="va-input" maxLength={160} autoComplete="organization" placeholder="Tên doanh nghiệp" />
        </div>
        <div className="va-field">
          <label htmlFor="va-service">Dịch vụ quan tâm</label>
          <select id="va-service" name="service" className="va-input" defaultValue={defaultService || OTHER}>
            {SERVICES.map((s) => (
              <option key={s.slug} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value={OTHER}>{OTHER}</option>
          </select>
        </div>
        <div className="va-field">
          <label htmlFor="va-budget">Ngân sách dự kiến</label>
          <select id="va-budget" name="budget" className="va-input" defaultValue={BUDGETS[0]}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="va-field full">
          <label htmlFor="va-message">Bạn đang cần giải quyết điều gì?</label>
          <textarea
            id="va-message"
            name="message"
            className="va-input"
            maxLength={3000}
            placeholder="Ví dụ: Tôi muốn làm app đặt lịch cho chuỗi 3 cửa hàng, có tích điểm thành viên và chatbot trả lời khách…"
          />
        </div>
        {/* Bẫy bot: người thật không thấy ô này. */}
        <div className="va-hp" aria-hidden="true">
          <label htmlFor="va-website">Website</label>
          <input id="va-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state.kind === "error" && (
        <div className="va-alert err" role="alert">
          {state.message}
        </div>
      )}

      <div className="va-form-foot">
        <p className="va-form-note">Thông tin của bạn chỉ dùng để Vieetjk liên hệ tư vấn, không chia sẻ cho bên thứ ba.</p>
        <button type="submit" className="va-btn va-btn-primary" disabled={sending} aria-busy={sending}>
          <Send size={16} /> {sending ? "Đang gửi…" : "Gửi yêu cầu"}
        </button>
      </div>
    </form>
  );
}
