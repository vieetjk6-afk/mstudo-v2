"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { BUDGETS, COMPANY, SERVICES } from "@/lib/vieetjk-ai/content";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const OTHER = "Other / not sure";
const CALL_US = `Please call ${COMPANY.phone} or message us on Zalo and we'll help right away.`;

/** Form "Nhận tư vấn" — gửi về /api/vieetjk-ai/contact (lưu vào Dashboard → Yêu cầu mới). */
export default function ContactForm({ defaultService = "" }: { defaultService?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    // Khách nước ngoài có thể không có SĐT Việt Nam → chỉ cần SĐT HOẶC email.
    if (!data.phone?.trim() && !data.email?.trim()) {
      setState({ kind: "error", message: "Please enter a phone number or an email address so we can reach you." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/vieetjk-ai/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        form.reset();
        setState({ kind: "sent" });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const message =
        body.error === "no_contact"
          ? "That phone number or email doesn't look right — please check it (e.g. +84 974 374 744 or you@company.com)."
          : res.status === 429
            ? "You've sent several requests in a short time. Please try again in a few minutes."
            : `We couldn't send your request. ${CALL_US}`;
      setState({ kind: "error", message });
    } catch {
      setState({ kind: "error", message: `We couldn't reach the server. ${CALL_US}` });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="va-form">
        <div className="va-sent" role="status">
          <span className="va-ico">
            <CheckCircle2 size={24} />
          </span>
          <h3>We&apos;ve received your request!</h3>
          <p>A Vieetjk specialist will get back to you as soon as possible during business hours. Thank you for your trust.</p>
          <button type="button" className="va-btn va-btn-ghost" style={{ marginTop: 22 }} onClick={() => setState({ kind: "idle" })}>
            Send another request
          </button>
        </div>
      </div>
    );
  }

  const sending = state.kind === "sending";

  return (
    <form className="va-form" onSubmit={onSubmit}>
      <h3>Get a free consultation</h3>
      <p className="va-form-sub">Leave your details and we&apos;ll get in touch to understand your needs and propose the right solution.</p>

      <div className="va-fields">
        <div className="va-field">
          <label htmlFor="va-name">
            Full name <b>*</b>
          </label>
          <input id="va-name" name="name" className="va-input" required maxLength={120} autoComplete="name" placeholder="Jane Nguyen" />
        </div>
        <div className="va-field">
          <label htmlFor="va-company">Company</label>
          <input id="va-company" name="company" className="va-input" maxLength={160} autoComplete="organization" placeholder="Your company" />
        </div>
        <div className="va-field">
          <label htmlFor="va-phone">
            Phone / WhatsApp / Zalo <b>*</b>
          </label>
          <input
            id="va-phone"
            name="phone"
            className="va-input"
            type="tel"
            inputMode="tel"
            maxLength={24}
            autoComplete="tel"
            placeholder="+84 9xx xxx xxx"
          />
        </div>
        <div className="va-field">
          <label htmlFor="va-email">
            Email <b>*</b>
          </label>
          <input id="va-email" name="email" className="va-input" type="email" maxLength={160} autoComplete="email" placeholder="you@company.com" />
        </div>
        <div className="va-field">
          <label htmlFor="va-service">Service of interest</label>
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
          <label htmlFor="va-budget">Estimated budget</label>
          <select id="va-budget" name="budget" className="va-input" defaultValue={BUDGETS[0]}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="va-field full">
          <label htmlFor="va-message">What would you like to solve?</label>
          <textarea
            id="va-message"
            name="message"
            className="va-input"
            maxLength={3000}
            placeholder="e.g. We need a booking app for our 3 stores, with loyalty points and a chatbot that answers customers…"
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
        <p className="va-form-note">* Phone or email is enough. We only use your details to reply — never shared with third parties.</p>
        <button type="submit" className="va-btn va-btn-primary" disabled={sending} aria-busy={sending}>
          <Send size={16} /> {sending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
