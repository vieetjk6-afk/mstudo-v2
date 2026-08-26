"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, type Lang } from "@/lib/vieetjk/content";

/**
 * Bong bóng chat tư vấn tự động (AI) trên website vieetjk.com.
 * Gắn trong VieetjkChrome nên dùng lại được biến CSS của site (--red, --paper…).
 * Gọi /api/vieetjk/chat (streaming) để trả lời; khi khách để lại SĐT (tự gõ hoặc
 * qua form) → gọi /api/vieetjk/lead lưu lead + báo Zalo cho chủ studio.
 */

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** SĐT VN: 0xxxxxxxxx hoặc +84/84xxxxxxxxx (cho phép cách/. /- xen giữa). */
const PHONE_RE = /(?:\+?84|0)(?:\d[\s.-]?){8,9}\d/;

/** Ký tự server đặt đầu tin "quá tải" → tự mở form để lại SĐT (khách không thấy). */
const LEAD_MARKER = "\u0002";

/** Lời chào mở đầu (client-side — không phụ thuộc module server). */
function greeting(lang: Lang): string {
  return lang === "en"
    ? `Hi! I'm the ${BRAND.name} assistant. Ask me about our wedding, event or business photo & film services — or pricing. How can I help?`
    : `Xin chào! Mình là trợ lý của ${BRAND.name}. Bạn cần tư vấn về chụp/quay cưới, sự kiện, doanh nghiệp hay bảng giá? Cứ hỏi mình nhé!`;
}

const CSS = `
.vjk-chat-fab{position:fixed;right:20px;bottom:20px;z-index:60;width:56px;height:56px;border-radius:999px;
  border:0;cursor:pointer;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;
  box-shadow:0 10px 30px rgba(0,0,0,.35);transition:transform .18s,background .18s;}
.vjk-chat-fab:hover{background:var(--red-dark);transform:translateY(-2px);}
.vjk-chat-panel{position:fixed;right:20px;bottom:88px;z-index:60;width:min(380px,calc(100vw - 40px));
  height:min(560px,calc(100vh - 140px));display:flex;flex-direction:column;overflow:hidden;
  background:var(--paper2);border:1px solid var(--line);border-radius:18px;
  box-shadow:0 20px 50px rgba(0,0,0,.5);animation:vjkChatIn .18s ease both;}
@keyframes vjkChatIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
.vjk-chat-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--paper3);}
.vjk-chat-dot{width:9px;height:9px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18);}
.vjk-chat-title{font-weight:600;font-size:14px;}
.vjk-chat-sub{font-size:11px;color:var(--ink3);}
.vjk-chat-x{margin-left:auto;background:none;border:0;color:var(--ink2);cursor:pointer;padding:4px;line-height:0;}
.vjk-chat-x:hover{color:var(--ink);}
.vjk-chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.vjk-chat-row{display:flex;}
.vjk-chat-row.me{justify-content:flex-end;}
.vjk-chat-bubble{max-width:82%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;}
.vjk-chat-row.bot .vjk-chat-bubble{background:var(--paper3);color:var(--ink);border-bottom-left-radius:4px;}
.vjk-chat-row.me .vjk-chat-bubble{background:var(--red);color:#fff;border-bottom-right-radius:4px;}
.vjk-chat-typing{display:inline-flex;gap:4px;padding:4px 0;}
.vjk-chat-typing i{width:6px;height:6px;border-radius:999px;background:var(--ink3);animation:vjkBlink 1s infinite;}
.vjk-chat-typing i:nth-child(2){animation-delay:.2s;}
.vjk-chat-typing i:nth-child(3){animation-delay:.4s;}
@keyframes vjkBlink{0%,60%,100%{opacity:.25;}30%{opacity:1;}}
.vjk-chat-lead{padding:10px 12px;border-top:1px solid var(--line);background:var(--paper3);}
.vjk-chat-leadbtn{width:100%;background:none;border:1px dashed var(--line);color:var(--ink2);border-radius:10px;
  padding:8px;font-size:12.5px;cursor:pointer;font-family:inherit;transition:border-color .18s,color .18s;}
.vjk-chat-leadbtn:hover{border-color:var(--red);color:var(--ink);}
.vjk-chat-leadform{display:flex;flex-direction:column;gap:8px;}
.vjk-chat-leadform input{background:var(--paper);border:1px solid var(--line);border-radius:10px;color:var(--ink);
  padding:9px 11px;font-size:13.5px;font-family:inherit;outline:none;}
.vjk-chat-leadform input:focus{border-color:var(--ink3);}
.vjk-chat-leadrow{display:flex;gap:8px;}
.vjk-chat-leadrow button{flex:1;border:0;border-radius:10px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.vjk-chat-leadsend{background:var(--red);color:#fff;}
.vjk-chat-leadsend:hover:not(:disabled){background:var(--red-dark);}
.vjk-chat-leadsend:disabled{opacity:.45;cursor:default;}
.vjk-chat-leadcancel{background:var(--paper);color:var(--ink2);border:1px solid var(--line) !important;}
.vjk-chat-leaddone{font-size:12.5px;color:#22c55e;text-align:center;padding:2px;}
.vjk-chat-live{align-self:center;font-size:12px;color:#22c55e;padding:2px 0;}
.vjk-chat-foot{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line);background:var(--paper2);}
.vjk-chat-input{flex:1;background:var(--paper);border:1px solid var(--line);border-radius:12px;color:var(--ink);
  padding:10px 12px;font-size:14px;font-family:inherit;resize:none;max-height:96px;outline:none;}
.vjk-chat-input:focus{border-color:var(--ink3);}
.vjk-chat-send{background:var(--red);color:#fff;border:0;border-radius:12px;width:42px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .18s;flex-shrink:0;}
.vjk-chat-send:hover:not(:disabled){background:var(--red-dark);}
.vjk-chat-send:disabled{opacity:.45;cursor:default;}
`;

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ChatWidget({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: greeting(lang) }]);
  const [showForm, setShowForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadDone, setLeadDone] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  /**
   * Nhân viên studio đã tiếp quản phiên này chưa. Khi có, trợ lý tự động ngừng
   * trả lời và khung chat nói rõ khách đang được người thật tư vấn — chứ không
   * để khách gõ vào khoảng không rồi tưởng bot chết.
   */
  const [takenOver, setTakenOver] = useState(false);

  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const msgsRef = useRef<Msg[]>(msgs);
  const leadSavedRef = useRef(false);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, busy, open, showForm]);

  useEffect(() => {
    if (open) taRef.current?.focus();
  }, [open]);

  // Tự bật khung chat khi khách vào trang (trừ khi họ đã chủ động đóng phiên này).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let closed = false;
    try {
      closed = sessionStorage.getItem("vjk_chat_closed") === "1";
    } catch {
      /* bỏ qua */
    }
    if (closed) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Nạp lời chào tùy chỉnh (chủ studio đặt trong dashboard) — thay lời chào mặc
  // định nếu khách chưa nhắn gì.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/vieetjk/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const g = d?.greeting;
        if (cancelled || !g || typeof g !== "string") return;
        setMsgs((cur) => (cur.length === 1 && cur[0].role === "assistant" ? [{ role: "assistant", content: g }] : cur));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Hỏi máy chủ vài giây một lần xem nhân viên studio có nhắn gì không.
     Chỉ chạy khi khung chat đang MỞ — khách đóng khung rồi thì không có gì để
     hiển thị, hỏi tiếp chỉ tốn băng thông của cả hai bên. */
  const lastStaffAtRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let stop = false;
    const tick = async () => {
      try {
        const qs = new URLSearchParams({ sessionId });
        if (lastStaffAtRef.current) qs.set("after", lastStaffAtRef.current);
        const res = await fetch(`/api/vieetjk/chat/updates?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as {
          messages: { id: string; body: string; created_at: string }[];
          takenOver: boolean;
        };
        if (stop) return;
        setTakenOver(!!data.takenOver);
        if (data.messages?.length) {
          lastStaffAtRef.current = data.messages[data.messages.length - 1].created_at;
          setMsgs((cur) => [...cur, ...data.messages.map((m) => ({ role: "assistant" as const, content: m.body }))]);
        }
      } catch {
        /* mất mạng một nhịp → lần sau hỏi lại */
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [open, sessionId]);

  /** Đóng khung chat + ghi nhớ để không tự bật lại trong phiên này. */
  function closeChat() {
    setOpen(false);
    try {
      sessionStorage.setItem("vjk_chat_closed", "1");
    } catch {
      /* bỏ qua */
    }
  }

  /**
   * Lưu lead (best-effort). Nhận `convo` tường minh khi có (tránh phụ thuộc
   * msgsRef có thể chưa kịp cập nhật tin cuối); nếu không thì lấy từ msgsRef.
   */
  async function saveLead(name: string | null, phone: string, convo?: Msg[]): Promise<boolean> {
    const src = convo ?? msgsRef.current;
    const transcript = src.map((m) => ({ role: m.role, content: m.content }));
    const interest = src.find((m) => m.role === "user")?.content?.slice(0, 300) ?? null;
    try {
      const res = await fetch("/api/vieetjk/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, phone, interest, transcript }),
      });
      if (!res.ok) return false;
      leadSavedRef.current = true;
      setLeadDone(true);
      return true;
    } catch {
      return false;
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    let acc = "";
    try {
      const res = await fetch("/api/vieetjk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          sessionId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      // 202 = nhân viên studio đã tiếp quản phiên này ⇒ trợ lý im, tin của khách
      // đã vào hộp thư, câu trả lời của người sẽ tới qua vòng hỏi định kỳ.
      if (res.status === 202) {
        setTakenOver(true);
        // Bỏ bong bóng rỗng vừa dựng sẵn cho câu trả lời của bot.
        setMsgs((cur) => cur.slice(0, -1));
        return; // `finally` phía dưới lo setBusy(false)
      }
      if (!res.ok || !res.body) throw new Error("no_stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs((cur) => {
          const next = [...cur];
          // Bỏ ký tự marker khi hiển thị (khách không thấy).
          next[next.length - 1] = { role: "assistant", content: acc.split(LEAD_MARKER).join("") };
          return next;
        });
      }
      if (!acc.trim()) throw new Error("empty");
      // Server báo "quá tải" → tự mở form để lại SĐT cho khách.
      if (acc.includes(LEAD_MARKER) && !leadSavedRef.current) setShowForm(true);
    } catch {
      setMsgs((cur) => {
        const next = [...cur];
        next[next.length - 1] = {
          role: "assistant",
          content:
            lang === "en"
              ? "Sorry, I can't reply right now. Please contact us directly."
              : "Xin lỗi, mình chưa trả lời được lúc này. Bạn liên hệ trực tiếp giúp mình nhé.",
        };
        return next;
      });
    } finally {
      setBusy(false);
    }

    // Khách gõ kèm SĐT → tự lưu lead (một lần / phiên) + xác nhận trong chat.
    const m = text.match(PHONE_RE);
    if (m && !leadSavedRef.current) {
      // Dựng transcript tường minh: lịch sử + tin trả lời vừa nhận.
      const convo: Msg[] = [...history, { role: "assistant", content: acc }];
      const ok = await saveLead(null, m[0], convo);
      if (ok) {
        setMsgs((cur) => [
          ...cur,
          {
            role: "assistant",
            content:
              lang === "en"
                ? "Thanks! We've saved your number — the studio will reach out soon."
                : "Cảm ơn bạn! Studio đã nhận số điện thoại và sẽ liên hệ sớm nhé.",
          },
        ]);
      }
    }
  }

  async function submitLead() {
    const phone = leadPhone.trim();
    if (!PHONE_RE.test(phone) || leadBusy) return;
    setLeadBusy(true);
    const ok = await saveLead(leadName.trim() || null, phone);
    setLeadBusy(false);
    if (ok) {
      setShowForm(false);
      setMsgs((cur) => [
        ...cur,
        {
          role: "assistant",
          content:
            lang === "en"
              ? `Thank you${leadName.trim() ? `, ${leadName.trim()}` : ""}! We've received your details and will contact you soon.`
              : `Cảm ơn ${leadName.trim() || "bạn"}! Studio đã nhận thông tin và sẽ liên hệ sớm nhé.`,
        },
      ]);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const lastBotEmpty = busy && msgs[msgs.length - 1]?.role === "assistant" && !msgs[msgs.length - 1].content;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {open && (
        <div className="vjk-chat-panel" role="dialog" aria-label={lang === "en" ? "Chat assistant" : "Trợ lý tư vấn"}>
          <div className="vjk-chat-head">
            <span className="vjk-chat-dot" />
            <div>
              <div className="vjk-chat-title">{lang === "en" ? "Assistant" : "Tư vấn viên"}</div>
              <div className="vjk-chat-sub">{lang === "en" ? "Usually replies instantly" : "Thường trả lời ngay"}</div>
            </div>
            <button className="vjk-chat-x" onClick={closeChat} aria-label={lang === "en" ? "Close" : "Đóng"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div className="vjk-chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`vjk-chat-row ${m.role === "user" ? "me" : "bot"}`}>
                {m.role === "assistant" && !m.content && i === msgs.length - 1 && lastBotEmpty ? (
                  <div className="vjk-chat-bubble">
                    <span className="vjk-chat-typing"><i /><i /><i /></span>
                  </div>
                ) : (
                  <div className="vjk-chat-bubble">{m.content}</div>
                )}
              </div>
            ))}
            {takenOver && (
              <div className="vjk-chat-live">
                {lang === "en"
                  ? "● A studio team member is chatting with you now."
                  : "● Nhân viên studio đang trực tiếp trả lời bạn."}
              </div>
            )}
          </div>

          {/* Bắt lead: nút mở form để lại SĐT, hoặc xác nhận đã gửi. */}
          <div className="vjk-chat-lead">
            {leadDone ? (
              <div className="vjk-chat-leaddone">
                ✓ {lang === "en" ? "Your details were sent to the studio." : "Đã gửi thông tin cho studio."}
              </div>
            ) : showForm ? (
              <div className="vjk-chat-leadform">
                <input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder={lang === "en" ? "Your name (optional)" : "Họ tên (không bắt buộc)"}
                />
                <input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  inputMode="tel"
                  placeholder={lang === "en" ? "Phone number *" : "Số điện thoại *"}
                />
                <div className="vjk-chat-leadrow">
                  <button className="vjk-chat-leadcancel" onClick={() => setShowForm(false)}>
                    {lang === "en" ? "Cancel" : "Huỷ"}
                  </button>
                  <button className="vjk-chat-leadsend" onClick={submitLead} disabled={leadBusy || !PHONE_RE.test(leadPhone.trim())}>
                    {leadBusy ? (lang === "en" ? "Sending…" : "Đang gửi…") : lang === "en" ? "Send" : "Gửi"}
                  </button>
                </div>
              </div>
            ) : (
              <button className="vjk-chat-leadbtn" onClick={() => setShowForm(true)}>
                📞 {lang === "en" ? "Leave your number for a callback" : "Để lại SĐT để được tư vấn"}
              </button>
            )}
          </div>

          <div className="vjk-chat-foot">
            <textarea
              ref={taRef}
              className="vjk-chat-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={lang === "en" ? "Type a message…" : "Nhập tin nhắn…"}
            />
            <button className="vjk-chat-send" onClick={send} disabled={busy || !input.trim()} aria-label={lang === "en" ? "Send" : "Gửi"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
      )}
      <button
        className="vjk-chat-fab"
        onClick={() => (open ? closeChat() : setOpen(true))}
        aria-label={lang === "en" ? "Open chat" : "Mở khung tư vấn"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <IconChat />
        )}
      </button>
    </>
  );
}
