"use client";

import { useState, type CSSProperties } from "react";
import type { Gift } from "./kit";

/**
 * HỘP MỪNG CƯỚI bấm để mở: một hộp quà thắt nơ, chạm vào thì nắp bật lên, ánh
 * kim toả ra và các thẻ QR chuyển khoản hiện dần bên dưới.
 *
 * Mã QR không hiện sẵn ngay đầu: khách lướt qua thiệp thấy một hộp quà thì dễ
 * chịu hơn thấy ngay số tài khoản — và ai muốn mừng chỉ cần chạm một lần.
 * Mỗi mẫu truyền bảng màu riêng (hộp, nơ, thẻ) nên hình thức vẫn khác nhau.
 */
export default function GiftBox({
  gifts, note, box, ribbon, ink, muted, card, cardInk, font, hint = "Chạm để mở hộp mừng cưới", style,
}: {
  gifts: Gift[];
  note?: string;
  /** Màu thân hộp. */ box: string;
  /** Màu dây nơ. */ ribbon: string;
  ink: string;
  muted: string;
  /** Nền thẻ QR. */ card: string;
  cardInk?: string;
  font?: string;
  hint?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  if (!gifts.length) return null;
  const ease = "cubic-bezier(.22,.61,.36,1)";

  async function copy(acc: string) {
    try { await navigator.clipboard.writeText(acc); setCopied(acc); setTimeout(() => setCopied(null), 1600); } catch { /* trình duyệt chặn — thôi */ }
  }

  return (
    <div style={{ textAlign: "center", fontFamily: font, ...style }}>
      {note && <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.65, color: muted, fontStyle: "italic" }}>{note}</p>}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Mở hộp mừng cưới"
        style={{ position: "relative", width: 132, height: open ? 70 : 132, margin: "0 auto", display: "block", background: "none", border: 0, padding: 0, cursor: open ? "default" : "pointer", transition: `height .7s ${ease}` }}
      >
        {/* ánh kim toả ra lúc mở */}
        {open && (
          <span aria-hidden style={{ position: "absolute", left: "50%", top: "40%", width: 10, height: 10, marginLeft: -5 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} style={{
                position: "absolute", width: "6px", height: "6px", borderRadius: "50%", background: ribbon,
                animation: `wedGiftBurst .9s ${ease} forwards`, "--a": `${i * 36}deg`,
              } as CSSProperties & Record<string, string>} />
            ))}
          </span>
        )}
        {/* nắp */}
        <span style={{
          position: "absolute", left: 6, right: 6, top: 30, height: 26, borderRadius: 6, background: box, zIndex: 2,
          boxShadow: "0 6px 14px rgba(0,0,0,.18)",
          transform: open ? "translateY(-46px) rotate(-14deg)" : "none", opacity: open ? 0 : 1,
          transition: `transform .6s ${ease}, opacity .5s ${ease} .25s`,
        }}>
          <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 14, marginLeft: -7, background: ribbon }} />
          {/* nơ */}
          <span style={{ position: "absolute", left: "50%", top: -22, width: 26, height: 22, marginLeft: -28, borderRadius: "60% 10% 60% 40%", border: `5px solid ${ribbon}`, transform: "rotate(-18deg)" }} />
          <span style={{ position: "absolute", left: "50%", top: -22, width: 26, height: 22, marginLeft: 2, borderRadius: "10% 60% 40% 60%", border: `5px solid ${ribbon}`, transform: "rotate(18deg)" }} />
        </span>
        {/* thân hộp */}
        <span className={open ? undefined : "wed-gift-wiggle"} style={{
          position: "absolute", left: 14, right: 14, top: 54, bottom: 0, borderRadius: "0 0 8px 8px", background: box,
          boxShadow: "0 16px 30px -12px rgba(0,0,0,.35), inset 0 10px 14px -10px rgba(0,0,0,.28)",
          transform: open ? "scale(.6) translateY(40px)" : "none", opacity: open ? 0 : 1,
          transition: `transform .6s ${ease} .1s, opacity .45s ${ease} .2s`,
        }}>
          <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 14, marginLeft: -7, background: ribbon }} />
        </span>
      </button>
      {!open && <p style={{ margin: "14px 0 0", fontSize: 11.5, letterSpacing: ".18em", textTransform: "uppercase", color: muted }}>{hint}</p>}

      {open && (
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
          {gifts.map((g, i) => {
            const acc = g.bank.account?.replace(/\s/g, "") ?? "";
            return (
              <div key={g.title} style={{
                width: 156, background: card, color: cardInk ?? ink, borderRadius: 14, padding: 12,
                boxShadow: "0 14px 30px -18px rgba(0,0,0,.5)", animation: `wedGiftCard .7s ${ease} ${0.15 + i * 0.12}s both`,
              }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", opacity: 0.75, marginBottom: 8 }}>Mừng {g.title}</div>
                <img src={g.qr} alt={`Mã QR mừng ${g.title}`} width={132} height={132} style={{ width: "100%", height: "auto", background: "#fff", borderRadius: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>{g.bank.holder || g.fallbackName}</div>
                {g.bank.name && <div style={{ fontSize: 11.5, opacity: 0.75 }}>{g.bank.name}</div>}
                {acc && (
                  <button type="button" onClick={() => copy(acc)} style={{ marginTop: 8, width: "100%", border: `1px solid ${cardInk ?? ink}33`, background: "transparent", color: "inherit", borderRadius: 8, padding: "6px 4px", fontSize: 12, cursor: "pointer" }}>
                    {copied === acc ? "Đã chép số tài khoản" : `${acc} · Chép`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes wedGiftBurst { from { transform: rotate(var(--a)) translateX(0) scale(1); opacity: 1 } to { transform: rotate(var(--a)) translateX(70px) scale(.3); opacity: 0 } }
        @keyframes wedGiftCard { from { opacity: 0; transform: translateY(18px) scale(.94) } to { opacity: 1; transform: none } }
        @keyframes wedGiftWiggle { 0%, 86%, 100% { transform: rotate(0) } 90% { transform: rotate(-4deg) } 94% { transform: rotate(4deg) } 97% { transform: rotate(-2deg) } }
        .wed-gift-wiggle { animation: wedGiftWiggle 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
      `}</style>
    </div>
  );
}
