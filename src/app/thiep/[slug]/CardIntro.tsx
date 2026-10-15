"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getTemplateMeta } from "./templates";

/**
 * HIỆU ỨNG MỞ THIỆP — lớp phủ khách thấy trước khi tấm thiệp hiện ra.
 *
 * Trước đây chỉ khách có link riêng (?guest=…) mới thấy, và chỉ có đúng một
 * kiểu bì thư kem cho cả mười mẫu. Giờ mẫu nào cũng có, và mỗi mẫu mở theo
 * cách hợp với chất của nó:
 *
 *   bì thư   sen · giấy dó · song hỷ · và toàn bộ bộ mẫu trang dài
 *   kéo màn  sơn mài · 3D glass
 *   mở khoá  y2k · neon
 *   mở sổ    hoa lá vintage · scrapbook
 *   nở sáng  aurora
 *   dấu sáp  đỏ đô      — phong bì đỏ rượu vang, dấu sáp vỡ, thư rút ra kèm ảnh polaroid xoè
 *   sao băng đêm sao    — vệt sao băng rơi qua trời sao, ảnh tròn phát sáng hiện ra
 *   cửa vòm  khung vòm  — hai cánh cửa vòm mở ra hai bên
 *
 * BA CHỐT AN TOÀN, vì lớp này che kín tấm thiệp:
 *   · <noscript> gỡ hẳn lớp phủ — không có JS thì bấm không ăn thua, mà thiệp
 *     thì vẫn phải đọc được
 *   · bấm vào ĐÂU cũng mở, không bắt trúng nút
 *   · prefers-reduced-motion: vẫn có lớp mở nhưng bỏ hết chuyển động
 */

export type IntroStyle = "envelope" | "curtain" | "unlock" | "book" | "bloom" | "seal" | "meteor" | "arch";

/** Kiểu mở + vài nét trang trí riêng của từng mẫu. */
type IntroSkin = {
  style: IntroStyle;
  /** Dấu niêm / biểu tượng giữa lớp mở. */
  seal: string;
  /** Chữ trên nút. */
  cta: string;
  /** Hạt trang trí bay trong lúc chờ mở. */
  motes?: { glyph?: string; color: string; count: number; rise?: boolean };
};

const SKINS: Record<string, IntroSkin> = {
  sen:       { style: "envelope", seal: "✿", cta: "Mở thiệp",        motes: { color: "rgba(255,226,230,.95)", count: 12 } },
  sonmai:    { style: "curtain",  seal: "✦", cta: "Vén màn",         motes: { color: "rgba(214,178,102,.9)", count: 12, rise: true } },
  giaydo:    { style: "envelope", seal: "囍", cta: "Mở thiệp",        motes: { color: "rgba(178,52,44,.6)", count: 10 } },
  y2k:       { style: "unlock",   seal: "♡", cta: "Chạm để mở",      motes: { color: "rgba(255,255,255,.5)", count: 10, rise: true } },
  aurora:    { style: "bloom",    seal: "✧", cta: "Mở thiệp",        motes: { color: "rgba(255,255,255,.95)", count: 12 } },
  songhy:    { style: "envelope", seal: "囍", cta: "Mở thiệp",        motes: { color: "rgba(255,215,122,.95)", count: 14, rise: true } },
  vintage:   { style: "book",     seal: "❧", cta: "Mở thiệp",        motes: { color: "rgba(176,114,79,.55)", count: 10 } },
  glass:     { style: "curtain",  seal: "◇", cta: "Trượt để mở",     motes: { color: "rgba(255,255,255,.7)", count: 10, rise: true } },
  neon:      { style: "unlock",   seal: "★", cta: "Quét vé vào tiệc", motes: { color: "rgba(0,255,213,.8)", count: 10, rise: true } },
  scrapbook: { style: "book",     seal: "♥", cta: "Mở sổ ra xem",    motes: { glyph: "♥", color: "rgba(168,115,79,.7)", count: 9, rise: true } },
  thumoi:    { style: "envelope", seal: "♥", cta: "Mở thư mời",      motes: { glyph: "♥", color: "rgba(107,80,61,.6)", count: 10, rise: true } },
  dodo:      { style: "seal",     seal: "♥", cta: "Mở thiệp",        motes: { color: "rgba(200,164,110,.85)", count: 10, rise: true } },
  demsao:    { style: "meteor",   seal: "✦", cta: "Mở thiệp",        motes: { color: "rgba(255,255,255,.9)", count: 16, rise: true } },
  "vom-matong": { style: "arch",  seal: "❦", cta: "Ấn mở thiệp" },
  "vom-xothom": { style: "arch",  seal: "❦", cta: "Ấn mở thiệp" },
  "vom-navy":   { style: "arch",  seal: "❦", cta: "Ấn mở thiệp" },
  "vom-ghi":    { style: "arch",  seal: "❦", cta: "Ấn mở thiệp" },
  "vom-nau":    { style: "arch",  seal: "❦", cta: "Ấn mở thiệp" },
};

const DEFAULT_SKIN: IntroSkin = { style: "envelope", seal: "♥", cta: "Mở thiệp", motes: { color: "rgba(255,255,255,.8)", count: 10 } };

export default function CardIntro({
  name, label, couple, accent, template, photos = [],
}: { name: string; label: string; couple: string; accent: string; template: string; photos?: string[] }) {
  const [opening, setOpening] = useState(false);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  const meta = getTemplateMeta(template);
  const skin = SKINS[template] ?? DEFAULT_SKIN;
  const a = accent || meta.accent;

  /*
   * Khóa cuộn trang trong lúc lớp mở còn hiển thị.
   *
   * Cố ý KHÔNG nhớ giá trị cũ rồi trả lại: bản trước làm vậy, và nếu có hai lớp
   * mở cùng tồn tại thì lớp thứ hai nhớ đúng chữ "hidden" do lớp thứ nhất vừa
   * đặt, nên lúc dọn nó TRẢ LẠI "hidden" — thiệp mở ra xong không cuộn được
   * nữa. Đo trong trình duyệt thấy body.overflow vẫn là "hidden" sau khi mở.
   * Ở đây chỉ có hai trạng thái: còn che thì khoá, hết che thì mở.
   */
  useEffect(() => {
    document.body.style.overflow = gone ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [gone]);

  function open() {
    if (opening) return;
    setOpening(true);
    // Có tên khách thì giữ lâu hơn để họ kịp đọc tên mình.
    const hold = name ? 2400 : 1500;
    setTimeout(() => setDone(true), hold);
    setTimeout(() => setGone(true), hold + 850);
  }

  if (gone) return null;

  const ease = "cubic-bezier(.22,.61,.36,1)";
  const dark = shade(a, -0.22);
  const paper = meta.dark ? shade(meta.bg, 0.06) : "#fffdfa";
  const ink = meta.dark ? meta.ink : "#2c2621";
  const serif = meta.serif ? "var(--font-cormorant), serif" : "var(--font-be-vietnam), system-ui, sans-serif";

  /** Dòng chữ giữa lớp mở — dùng chung cho cả năm kiểu. */
  const caption = (
    <div style={{ textAlign: "center", padding: "0 18px", color: ink }}>
      <div style={{ fontFamily: serif, fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: a }}>
        {name ? label : "Thiệp cưới"}
      </div>
      <div style={{
        fontFamily: name ? "var(--font-hand), cursive" : serif,
        fontSize: name ? 38 : 30, lineHeight: 1.12, marginTop: 6,
      }}>
        {name || couple || "Mời bạn"}
      </div>
      {name && couple && (
        <div style={{ fontFamily: serif, fontSize: 12.5, letterSpacing: ".1em", color: a, marginTop: 8 }}>{couple}</div>
      )}
    </div>
  );

  const button = !opening && (
    <button
      onClick={(e) => { e.stopPropagation(); open(); }}
      style={{
        fontFamily: serif, fontSize: 15, letterSpacing: ".08em",
        background: a, color: readable(a), border: "none", borderRadius: 999, padding: "11px 30px",
        boxShadow: "0 8px 22px rgba(0,0,0,.18)", cursor: "pointer", animation: "wedIntroBob 1.8s ease-in-out infinite",
        position: "relative", zIndex: 4,
      }}
    >{skin.cta} ✦</button>
  );

  return (
    <div
      className="wed-intro"
      onClick={open}
      style={{
        position: "fixed", inset: 0, zIndex: 100, overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
        cursor: opening ? "default" : "pointer",
        background: meta.dark
          ? `radial-gradient(120% 120% at 50% 30%, ${shade(meta.bg, 0.14)} 0%, ${meta.bg} 100%)`
          : `radial-gradient(120% 120% at 50% 30%, ${shade(meta.bg, 0.5)} 0%, ${meta.bg} 100%)`,
        opacity: done ? 0 : 1, transition: `opacity .8s ${ease}`, pointerEvents: done ? "none" : "auto",
        padding: 20,
      }}
    >
      {/* Không có JS thì lớp này không mở được — phải gỡ hẳn, không được che thiệp. */}
      <noscript><style>{".wed-intro{display:none!important}"}</style></noscript>

      <Motes skin={skin} />

      {skin.style === "envelope" && (
        <Envelope opening={opening} accent={a} dark={dark} paper={paper} seal={skin.seal} ease={ease}>{caption}</Envelope>
      )}
      {skin.style === "curtain" && (
        <Curtain opening={opening} accent={a} dark={dark} paper={paper} seal={skin.seal} ease={ease}>{caption}</Curtain>
      )}
      {skin.style === "unlock" && (
        <Unlock opening={opening} accent={a} seal={skin.seal} ease={ease}>{caption}</Unlock>
      )}
      {skin.style === "book" && (
        <Book opening={opening} accent={a} paper={paper} seal={skin.seal} ease={ease}>{caption}</Book>
      )}
      {skin.style === "bloom" && (
        <Bloom opening={opening} accent={a} paper={paper} seal={skin.seal} ease={ease}>{caption}</Bloom>
      )}
      {skin.style === "seal" && (
        <WaxSeal opening={opening} accent={a} dark={dark} paper={paper} seal={skin.seal} ease={ease} photos={photos}>{caption}</WaxSeal>
      )}
      {skin.style === "meteor" && (
        <Meteor opening={opening} accent={a} seal={skin.seal} ease={ease} photos={photos}>{caption}</Meteor>
      )}
      {skin.style === "arch" && (
        <ArchDoors opening={opening} accent={a} dark={dark} paper={paper} seal={skin.seal} ease={ease}>{caption}</ArchDoors>
      )}

      {button}

      <style>{`
        @keyframes wedIntroBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes wedIntroFall{0%{top:-12%;opacity:0}12%,84%{opacity:.85}100%{top:108%;opacity:0;transform:translateX(var(--sx,18px)) rotate(var(--sr,220deg))}}
        @keyframes wedIntroRise{0%{top:106%;opacity:0}14%,82%{opacity:.85}100%{top:-12%;opacity:0;transform:translateX(var(--sx,-18px))}}
        @keyframes wedIntroPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
        @keyframes wedIntroMeteor{0%{opacity:0;transform:rotate(-38deg) translateX(0)}8%{opacity:1}30%,100%{opacity:0;transform:rotate(-38deg) translateX(-460px)}}
        @media (prefers-reduced-motion: reduce){
          .wed-intro, .wed-intro *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
        }
      `}</style>
    </div>
  );
}

// ── Năm kiểu mở ─────────────────────────────────────────────────────────────

/** Bì thư: nắp lật lên, tấm thiệp trồi ra. */
function Envelope({ opening, accent, dark, paper, seal, ease, children }: StyleProps) {
  return (
    <div style={{ perspective: 1100, width: "min(88vw, 360px)" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 2" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: accent, boxShadow: "0 20px 50px rgba(0,0,0,.22)" }} />
        <div style={{
          position: "absolute", left: "6%", right: "6%", top: "8%", bottom: "8%", borderRadius: 8,
          background: paper, boxShadow: "0 6px 18px rgba(0,0,0,.14)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: opening ? "translateY(-74%) scale(1.06)" : "translateY(0)",
          transition: `transform 1.1s ${ease} .4s`, zIndex: opening ? 5 : 1,
        }}>
          {/* Bì đang đóng thì chữ phải ẩn: khe chữ V giữa nắp và túi để lọt
              nửa cái tên ra ngoài, nhìn như lỗi in. Chữ hiện dần lúc thiệp trồi lên. */}
          <div style={{ opacity: opening ? 1 : 0, transition: `opacity .5s ${ease} .7s` }}>{children}</div>
        </div>
        {/* Túi dưới che nửa dưới tấm thiệp */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, top: "42%", borderRadius: "0 0 10px 10px",
          background: `linear-gradient(${shade(accent, 0.05)}, ${dark})`,
          clipPath: "polygon(0 22%, 50% 0, 100% 22%, 100% 100%, 0 100%)", zIndex: 6,
        }} />
        {/* Nắp bì */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "58%",
          background: `linear-gradient(${dark}, ${shade(accent, -0.08)})`,
          clipPath: "polygon(0 0, 100% 0, 50% 92%)",
          transformOrigin: "top", transform: opening ? "rotateX(180deg)" : "rotateX(0deg)",
          transition: `transform .9s ${ease}`, transformStyle: "preserve-3d", backfaceVisibility: "hidden",
          zIndex: opening ? 2 : 8,
        }} />
        {!opening && <Seal seal={seal} accent={accent} />}
      </div>
    </div>
  );
}

/** Kéo màn: hai cánh trượt sang hai bên để lộ thiệp. */
function Curtain({ opening, accent, dark, paper, seal, ease, children }: StyleProps) {
  const panel: CSSProperties = {
    position: "fixed", top: 0, bottom: 0, width: "51%",
    background: `linear-gradient(160deg, ${shade(accent, -0.05)}, ${dark})`,
    transition: `transform 1.15s ${ease}`, zIndex: 1,
  };
  return (
    <>
      <div style={{ ...panel, left: 0, transform: opening ? "translateX(-102%)" : "none", borderRight: `1px solid ${shade(accent, 0.25)}` }} />
      <div style={{ ...panel, right: 0, transform: opening ? "translateX(102%)" : "none", borderLeft: `1px solid ${shade(accent, 0.25)}` }} />
      <div style={{
        position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        borderRadius: 18, padding: "26px 26px 30px", background: paper,
        boxShadow: "0 24px 50px -22px rgba(0,0,0,.5)", maxWidth: "min(86vw, 330px)",
        opacity: opening ? 0 : 1, transform: opening ? "scale(.94)" : "none",
        transition: `opacity .45s ${ease}, transform .6s ${ease}`,
      }}>
        <span style={{ fontSize: 30, color: accent, animation: "wedIntroPulse 3s ease-in-out infinite" }}>{seal}</span>
        {children}
      </div>
    </>
  );
}

/** Mở khoá: cả lớp trượt lên như màn hình khoá điện thoại. */
function Unlock({ opening, accent, seal, ease, children }: StyleProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
      transform: opening ? "translateY(-16%) scale(.96)" : "none",
      opacity: opening ? 0 : 1, transition: `transform 1s ${ease}, opacity .8s ${ease}`,
    }}>
      <div style={{
        width: 92, height: 92, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${accent}`, color: accent, fontSize: 30,
        boxShadow: `0 0 44px -6px ${accent}`, animation: "wedIntroPulse 3s ease-in-out infinite",
      }}>{seal}</div>
      {children}
    </div>
  );
}

/** Mở sổ: hai nửa trang gập ra hai bên. */
function Book({ opening, accent, paper, seal, ease, children }: StyleProps) {
  // Hai nửa trang phải TỰ thấy được nếp gập: cùng một màu giấy trên nền giấy
  // thì nhìn ra một mảng phẳng, không ai biết đây là quyển sổ đang đóng.
  const half: CSSProperties = {
    position: "absolute", top: 0, bottom: 0, width: "50%",
    boxShadow: "0 18px 44px -18px rgba(0,0,0,.45)", transition: `transform 1.1s ${ease}`,
    backfaceVisibility: "hidden", border: `1px solid ${shade(accent, 0.55)}`,
  };
  return (
    <div style={{ perspective: 1400, width: "min(86vw, 340px)" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", transformStyle: "preserve-3d" }}>
        <div style={{
          ...half, left: 0, transformOrigin: "left center", transform: opening ? "rotateY(-118deg)" : "none",
          background: `linear-gradient(90deg, ${paper}, ${shade(accent, 0.82)})`, borderRadius: "6px 0 0 6px",
        }} />
        <div style={{
          ...half, right: 0, transformOrigin: "right center", transform: opening ? "rotateY(118deg)" : "none",
          background: `linear-gradient(270deg, ${paper}, ${shade(accent, 0.82)})`, borderRadius: "0 6px 6px 0",
        }} />
        {/* Gáy sổ */}
        <div style={{
          position: "absolute", top: "3%", bottom: "3%", left: "50%", width: 3, marginLeft: -1.5, zIndex: 1,
          background: `linear-gradient(${shade(accent, 0.3)}, ${accent}, ${shade(accent, 0.3)})`,
          opacity: opening ? 0 : 0.7, transition: `opacity .5s ${ease}`,
        }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
          opacity: opening ? 0 : 1, transition: `opacity .4s ${ease}`, zIndex: 2,
        }}>
          <span style={{ fontSize: 24, color: accent }}>{seal}</span>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Nở sáng: một quầng tròn lan ra từ giữa. */
function Bloom({ opening, accent, paper, seal, ease, children }: StyleProps) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{
        position: "absolute", width: 260, height: 260, borderRadius: "50%", top: "50%", left: "50%",
        marginLeft: -130, marginTop: -130, pointerEvents: "none",
        background: `radial-gradient(circle, ${accent}, transparent 68%)`, opacity: 0.35, filter: "blur(26px)",
        transform: opening ? "scale(6)" : "scale(1)", transition: `transform 1.2s ${ease}`,
      }} />
      <div style={{
        position: "relative", width: 132, height: 132, borderRadius: "50%", background: paper,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: accent,
        border: `1px solid ${accent}`, boxShadow: `0 18px 40px -14px ${accent}, 0 0 0 7px ${shade(accent, 0.86)}`,
        transform: opening ? "scale(1.5)" : "scale(1)", opacity: opening ? 0 : 1,
        transition: `transform 1.1s ${ease}, opacity .9s ${ease}`,
        animation: "wedIntroPulse 3.4s ease-in-out infinite",
      }}>{seal}</div>
      <div style={{ position: "relative", opacity: opening ? 0 : 1, transition: `opacity .5s ${ease}` }}>{children}</div>
    </div>
  );
}

/**
 * Dấu sáp: phong bì màu đậm khép bằng dấu sáp. Chạm vào thì dấu sáp vỡ, nắp
 * lật, lá thư rút lên — phía sau xoè ra tối đa ba ảnh polaroid của cặp đôi.
 */
function WaxSeal({ opening, accent, dark, paper, seal, ease, photos = [], children }: StyleProps) {
  const fan = photos.slice(0, 3);
  const angle = [-16, 0, 16];
  return (
    <div style={{ perspective: 1200, width: "min(88vw, 360px)", marginTop: 40 }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3" }}>
        {/* Ảnh polaroid nằm trong phong bì, xoè ra khi mở */}
        {fan.map((src, i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "10%", width: "44%", marginLeft: "-22%", background: "#fff", padding: "6px 6px 20px",
            boxShadow: "0 12px 24px -10px rgba(0,0,0,.45)", zIndex: 1,
            transform: opening ? `translate(${(i - (fan.length - 1) / 2) * 62}%, -92%) rotate(${angle[fan.length === 1 ? 1 : i] ?? 0}deg)` : "translateY(10%) rotate(0deg)",
            transition: `transform 1.1s ${ease} ${0.75 + i * 0.12}s`,
          }}>
            <img src={src} alt="" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" }} />
          </div>
        ))}
        <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: `linear-gradient(170deg, ${shade(accent, 0.08)}, ${dark})`, boxShadow: "0 26px 60px -20px rgba(0,0,0,.55)" }} />
        {/* Lá thư */}
        <div style={{
          position: "absolute", left: "7%", right: "7%", top: "7%", bottom: "9%", borderRadius: 4, background: paper,
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: opening ? 5 : 2,
          transform: opening ? "translateY(-58%)" : "none", transition: `transform 1.1s ${ease} .45s`,
          boxShadow: "0 8px 20px rgba(0,0,0,.18)",
        }}>
          <div style={{ opacity: opening ? 1 : 0, transition: `opacity .5s ${ease} .9s` }}>{children}</div>
        </div>
        {/* Túi dưới */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, top: "38%", zIndex: 6, borderRadius: "0 0 6px 6px",
          background: `linear-gradient(${shade(accent, -0.02)}, ${dark})`, clipPath: "polygon(0 0, 50% 44%, 100% 0, 100% 100%, 0 100%)",
        }} />
        {/* Nắp */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "62%", zIndex: opening ? 3 : 7,
          background: `linear-gradient(${shade(accent, 0.12)}, ${shade(accent, -0.12)})`, clipPath: "polygon(0 0, 100% 0, 50% 100%)",
          transformOrigin: "top", transform: opening ? "rotateX(180deg)" : "none", transition: `transform .8s ${ease}`, backfaceVisibility: "hidden",
        }} />
        {/* Dấu sáp: vỡ ra khi mở */}
        <div style={{
          position: "absolute", left: "50%", top: "58%", width: 70, height: 70, marginLeft: -35, marginTop: -35, zIndex: 9, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${shade(accent, 0.35)}, ${shade(accent, -0.1)} 55%, ${shade(accent, -0.35)})`,
          boxShadow: "0 6px 14px rgba(0,0,0,.35), inset 0 -4px 8px rgba(0,0,0,.25), inset 0 3px 6px rgba(255,255,255,.25)",
          display: "flex", alignItems: "center", justifyContent: "center", color: shade(accent, 0.6), fontSize: 26,
          transform: opening ? "scale(1.5)" : "scale(1)", opacity: opening ? 0 : 1, transition: `transform .45s ${ease}, opacity .35s ${ease}`,
        }}>
          <span style={{ width: 52, height: 52, borderRadius: "50%", border: `1.5px dashed ${shade(accent, 0.45)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{seal}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Sao băng: trời sao, một vệt sao băng rơi chéo qua lặp lại; giữa là ảnh tròn
 * phát sáng cùng tên. Mở ra thì cả bầu trời phóng vụt về phía người xem.
 */
function Meteor({ opening, accent, seal, ease, photos = [], children }: StyleProps) {
  const photo = photos[0];
  return (
    <>
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(1px 1px at 12% 18%, #fff, transparent 60%), radial-gradient(1.4px 1.4px at 68% 42%, rgba(255,255,255,.85), transparent 60%), radial-gradient(1px 1px at 38% 76%, rgba(220,226,255,.8), transparent 60%), radial-gradient(1.8px 1.8px at 86% 12%, rgba(255,255,255,.7), transparent 60%), radial-gradient(1px 1px at 24% 58%, rgba(255,255,255,.6), transparent 60%)",
        backgroundSize: "170px 200px",
        transform: opening ? "scale(2.4)" : "scale(1)", opacity: opening ? 0 : 1, transition: `transform 1.4s ${ease}, opacity 1.2s ${ease}`,
      }} />
      {[0, 1].map((i) => (
        <span key={i} aria-hidden style={{
          position: "absolute", zIndex: 1, top: `${8 + i * 22}%`, left: `${58 + i * 22}%`, width: 150, height: 2, borderRadius: 2,
          background: "linear-gradient(90deg, rgba(255,255,255,0), #fff)", filter: "drop-shadow(0 0 6px #fff)",
          transform: "rotate(-38deg)", opacity: 0, animation: `wedIntroMeteor ${3.2 + i * 1.3}s ease-in ${0.6 + i * 1.7}s infinite`,
        }} />
      ))}
      {/* Bấm mở: một loạt sao băng vụt qua cùng lúc */}
      {opening && [0, 1, 2].map((i) => (
        <span key={`b${i}`} aria-hidden style={{
          position: "absolute", zIndex: 1, top: `${4 + i * 16}%`, left: `${44 + i * 18}%`, width: 190, height: 2, borderRadius: 2,
          background: "linear-gradient(90deg, rgba(255,255,255,0), #fff)", filter: "drop-shadow(0 0 8px #fff)",
          transform: "rotate(-38deg)", opacity: 0, animation: `wedIntroMeteor 1.3s ease-in ${i * 0.22}s forwards`,
        }} />
      ))}
      {/* Ảnh + tên KHÔNG mờ đi lúc bấm: khách cần đọc tên mình đến khi cả lớp chuyển cảnh. */}
      <div style={{
        position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
        transform: opening ? "scale(1.06)" : "none", transition: `transform 2.4s ${ease}`,
      }}>
        <div style={{ padding: 7, borderRadius: "50%", border: "1px solid rgba(201,210,255,.4)", boxShadow: `0 0 60px -8px ${accent}`, animation: "wedIntroPulse 3.6s ease-in-out infinite" }}>
          {photo
            ? <img src={photo} alt="" style={{ width: 168, height: 168, borderRadius: "50%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: 168, height: 168, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: accent }}>{seal}</div>}
        </div>
        {children}
      </div>
    </>
  );
}

/** Cửa vòm: hai cánh cửa nửa vòm khép giữa màn hình, chạm vào thì mở ra hai bên. */
function ArchDoors({ opening, accent, dark, paper, seal, ease, children }: StyleProps) {
  const leaf = (side: "l" | "r"): CSSProperties => ({
    position: "absolute", top: 0, bottom: 0, width: "50%", [side === "l" ? "left" : "right"]: 0,
    background: `linear-gradient(${side === "l" ? 100 : 260}deg, ${shade(accent, 0.12)}, ${dark})`,
    borderRadius: side === "l" ? "999px 0 0 0" : "0 999px 0 0",
    transformOrigin: side === "l" ? "left center" : "right center",
    transform: opening ? `rotateY(${side === "l" ? -108 : 108}deg)` : "none",
    transition: `transform 1.25s ${ease} .15s`, backfaceVisibility: "hidden",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.28)",
  });
  return (
    <div style={{ perspective: 1300, width: "min(80vw, 320px)" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4.3", borderRadius: "999px 999px 0 0", background: paper, boxShadow: "0 30px 60px -24px rgba(0,0,0,.45)" }}>
        {/* Nội dung sau cánh cửa: hiện ra khi cửa mở */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", opacity: opening ? 1 : 0.0, transition: `opacity .6s ${ease} .6s` }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, color: accent }}>{seal}</span>
            {children}
          </div>
        </div>
        <div style={leaf("l")}>
          <span style={{ position: "absolute", inset: "14px 8px 14px 14px", borderRadius: "999px 0 0 0", border: "1px solid rgba(255,255,255,.35)", borderRight: 0 }} />
          <span style={{ position: "absolute", right: 12, top: "56%", width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.85)" }} />
        </div>
        <div style={leaf("r")}>
          <span style={{ position: "absolute", inset: "14px 14px 14px 8px", borderRadius: "0 999px 0 0", border: "1px solid rgba(255,255,255,.35)", borderLeft: 0 }} />
          <span style={{ position: "absolute", left: 12, top: "56%", width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.85)" }} />
        </div>
        {/* Khi cửa còn khép: tên khách/cặp đôi in trên thẻ nhỏ giữa hai cánh */}
        <div style={{
          position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", width: "84%", zIndex: 3,
          background: paper, borderRadius: 14, padding: "16px 8px", boxShadow: "0 14px 30px -14px rgba(0,0,0,.5)",
          opacity: opening ? 0 : 1, transition: `opacity .4s ${ease}`,
        }}>{children}</div>
      </div>
    </div>
  );
}

/** Bộ tham số chung của các kiểu mở; kiểu nào không cần màu nào thì bỏ qua. */
type StyleProps = {
  opening: boolean; accent: string; seal: string; ease: string; children: ReactNode;
  /** Ảnh của cặp đôi (bìa + album) — kiểu dấu sáp / sao băng dùng. */ photos?: string[];
  /** Màu đậm hơn accent — dùng cho nắp bì, cánh màn. */ dark?: string;
  /** Màu giấy — dùng cho tấm thiệp, trang sổ, huy hiệu. */ paper?: string;
};

/** Dấu niêm tròn giữa nắp bì. */
function Seal({ seal, accent }: { seal: string; accent: string }) {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", zIndex: 9,
      width: 46, height: 46, borderRadius: "50%", background: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 3px 10px rgba(0,0,0,.2)", color: accent, fontSize: 20,
    }}>{seal}</div>
  );
}

/** Hạt trang trí rơi/bay trong lúc chờ mở. Vị trí tính theo chỉ số nên máy chủ
 *  và trình duyệt dựng ra y hệt nhau. */
function Motes({ skin }: { skin: IntroSkin }) {
  const m = skin.motes;
  if (!m) return null;
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {Array.from({ length: m.count }, (_, i) => {
        const x = rnd(i, 1), y = rnd(i, 2), z = rnd(i, 3);
        const dur = 9 + x * 8;
        const sz = 6 + z * 10;
        const base: CSSProperties & Record<string, string> = {
          position: "absolute", left: `${(y * 100).toFixed(1)}%`,
          "--sx": `${((x - 0.5) * 60).toFixed(0)}px`,
          "--sr": `${((z - 0.5) * 460).toFixed(0)}deg`,
          animation: `${m.rise ? "wedIntroRise" : "wedIntroFall"} ${dur.toFixed(1)}s linear ${(-x * dur).toFixed(1)}s infinite`,
        };
        return m.glyph
          ? <span key={i} style={{ ...base, fontSize: sz + 4, lineHeight: 1, color: m.color }}>{m.glyph}</span>
          : <span key={i} style={{ ...base, width: sz, height: sz * 0.7, background: m.color, borderRadius: m.rise ? "50%" : "56% 4% 56% 4%" }} />;
      })}
    </div>
  );
}

function rnd(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Chữ đen hay trắng thì dễ đọc hơn trên nền này. */
function readable(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const [r, g, b] = [1, 2, 3].map((k) => parseInt(m[k], 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#1c1a17" : "#fff";
}

/** Làm đậm/nhạt một màu hex theo hệ số (-1..1). */
function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  const r = adj(parseInt(m[1], 16)), g = adj(parseInt(m[2], 16)), b = adj(parseInt(m[3], 16));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
