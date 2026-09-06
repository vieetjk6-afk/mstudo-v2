import type { CSSProperties } from "react";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtShort, readConfig, vietqrUrl, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Cinematic — cột 430px, tông kem sang trọng, cánh hoa rơi, ảnh bìa Ken Burns +
// light-leak, tên Cormorant lớn, chữ viết tay Dancing Script. Port từ mẫu studio.
const PAL = { bg: "#f7efe9", panel: "#fffdfb", ink: "#4a3a3e", muted: "#9c8488", line: "#ecdcd6", accent: "#c98a92", accentDeep: "#b06e78", soft: "#f6e7e3", gold: "#e8c9a8" };

export default function CinematicTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const cm = "var(--font-cormorant), serif";
  const sc = "var(--font-script), cursive";
  const wrap: CSSProperties = { background: PAL.bg, color: PAL.ink, width: "100%", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden", fontFamily: "var(--font-manrope), sans-serif" };
  const petal = (left: string, size: number, dur: number, delay: number, deep = false) =>
    <div style={{ position: "absolute", left, top: 0, width: size, height: size, background: deep ? PAL.accentDeep : accent, opacity: 0.45, borderRadius: "0 12px 0 12px", animation: `cnfall ${dur}s linear ${delay}s infinite` }} />;

  return (
    <main style={wrap}>
      <style>{`
        @keyframes cnfall{0%{transform:translateY(-40px) rotate(0);opacity:0}10%{opacity:.9}100%{transform:translateY(2500px) rotate(520deg);opacity:.15}}
        @keyframes cnkb{0%{transform:scale(1)}100%{transform:scale(1.14)}}
        @keyframes cnfloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes cnshine{0%{transform:translateX(-160%) skewX(-16deg)}55%{transform:translateX(220%) skewX(-16deg)}100%{transform:translateX(220%) skewX(-16deg)}}
        @keyframes cnleak{0%,100%{transform:translate(-6%,-4%) scale(1);opacity:.4}50%{transform:translate(10%,6%) scale(1.25);opacity:.8}}
      `}</style>

      {/* petals */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 6 }}>
        {petal("6%", 14, 13, -1)}{petal("22%", 10, 16, -4, true)}{petal("38%", 16, 11, -7)}
        {petal("54%", 9, 18, -2, true)}{petal("70%", 13, 14, -9)}{petal("84%", 11, 15, -5, true)}{petal("92%", 15, 12, -11)}
      </div>

      {/* COVER */}
      <section style={{ position: "relative", height: 648, overflow: "hidden" }}>
        {c.cover_url && (
          <img src={c.cover_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 32%", animation: "cnkb 16s ease-in-out infinite alternate" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(10,6,8,.82) 3%,rgba(10,6,8,.12) 42%,rgba(10,6,8,.4))" }} />
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle,rgba(255,225,180,.55),transparent 65%)", mixBlendMode: "screen", filter: "blur(20px)", pointerEvents: "none", animation: "cnleak 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}><div style={{ position: "absolute", top: 0, left: 0, width: "38%", height: "100%", background: "linear-gradient(105deg,transparent,rgba(255,255,255,.4),transparent)", animation: "cnshine 8s ease-in-out 2s infinite" }} /></div>
        <div style={{ position: "absolute", top: 40, left: 0, right: 0, textAlign: "center", color: "#f2e3d3" }}>
          <div style={{ fontSize: 12, letterSpacing: ".5em", textTransform: "uppercase", fontWeight: 600 }}>Save the date</div>
        </div>
        <div style={{ position: "absolute", left: 34, right: 34, bottom: 52, textAlign: "center", color: "#fff" }}>
          <div style={{ fontFamily: sc, fontSize: 34, color: PAL.gold, lineHeight: 1 }}>{c.cover_quote || "Trân trọng kính mời"}</div>
          <div style={{ fontFamily: cm, fontSize: 72, fontWeight: 500, lineHeight: 0.92, margin: "8px 0 4px" }}>{groom} <span style={{ fontStyle: "italic", color: PAL.gold }}>&amp;</span> {bride}</div>
          <div style={{ width: 54, height: 1, background: PAL.gold, margin: "18px auto" }} />
          {c.wedding_date && <div style={{ fontSize: 14, letterSpacing: ".24em", textTransform: "uppercase" }}>{fmtShort(c.wedding_date)}</div>}
        </div>
      </section>

      {/* LỜI NGỎ */}
      <section style={{ textAlign: "center", padding: "52px 40px 8px", position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 26, color: accent, animation: "cnfloaty 5s ease-in-out infinite" }}>❀</div>
        <p style={{ fontFamily: cm, fontSize: 26, fontStyle: "italic", lineHeight: 1.6, color: PAL.ink, margin: "18px 0 0" }}>“Yêu nhau không phải là nhìn nhau, mà là cùng nhìn về một hướng.”</p>
        <p style={{ fontSize: 13.5, color: PAL.muted, lineHeight: 1.8, marginTop: 18 }}>Chúng mình sắp về chung một nhà. Trân trọng kính mời bạn đến chung vui và chứng kiến khoảnh khắc thiêng liêng của đời chúng mình.</p>
      </section>

      {/* COUNTDOWN */}
      {c.wedding_date && (
        <section style={{ padding: "40px 34px", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 12, letterSpacing: ".32em", textTransform: "uppercase", color: PAL.accentDeep, fontWeight: 700, marginBottom: 20 }}>Đếm ngược đến ngày chung đôi</div>
          <Countdown date={c.wedding_date} />
        </section>
      )}

      {/* SỰ KIỆN */}
      {events.length > 0 && (
        <section style={{ padding: "20px 34px 40px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontFamily: cm, fontSize: 38, fontWeight: 600 }}>Sự kiện cưới</div>
            <div style={{ fontSize: 12.5, color: PAL.muted, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4 }}>Kính mời quý khách</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {events.map((e, i) => (
              <div key={i} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 18, padding: "20px 22px", textAlign: "center" }}>
                <div style={{ fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: PAL.accentDeep, fontWeight: 700 }}>{e.label || "Sự kiện"}</div>
                <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, margin: "8px 0 4px" }}>{[e.time, fmtShort(e.date)].filter(Boolean).join(" · ")}</div>
                {(e.venue || e.address) && <div style={{ fontSize: 13.5, color: PAL.muted, lineHeight: 1.5 }}>{[e.venue, e.address].filter(Boolean).join(" — ")}</div>}
                {e.map_url && <a href={e.map_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 14, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#fff", background: accent, borderRadius: 999, padding: "10px 20px", textDecoration: "none" }}>Xem bản đồ</a>}
              </div>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.panel, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

      {/* ALBUM */}
      {gallery.length > 0 && (
        <section style={{ padding: "20px 0 40px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 20, padding: "0 34px" }}><div style={{ fontFamily: cm, fontSize: 38, fontWeight: 600 }}>Album của chúng mình</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 12px" }}>
            {gallery.map((src, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: i % 5 === 2 ? "16/10" : "3/4", gridColumn: i % 5 === 2 ? "span 2" : undefined, borderRadius: 10, overflow: "hidden" }}>
                <img src={src} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CÂU CHUYỆN */}
      {c.story && (
        <section style={{ padding: "16px 34px 40px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontFamily: sc, fontSize: 34, color: PAL.accentDeep }}>Chuyện của chúng mình</div></div>
          <p style={{ fontSize: 14, color: PAL.ink, lineHeight: 1.8, whiteSpace: "pre-line", textAlign: "center" }}>{c.story}</p>
        </section>
      )}

      {/* MỪNG CƯỚI */}
      {hasGift && (
        <section style={{ padding: "16px 34px 40px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontFamily: cm, fontSize: 34, fontWeight: 600 }}>Hộp mừng cưới</div>
            <div style={{ fontSize: 12.5, color: PAL.muted, marginTop: 2 }}>{c.gift_note || "Gửi yêu thương đến cô dâu & chú rể"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[{ b: c.groom_bank, who: `Chú rể · ${groom}` }, { b: c.bride_bank, who: `Cô dâu · ${bride}` }].filter((x) => vietqrUrl(x.b) || x.b?.account).map((x, i) => (
              <div key={i} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
                {vietqrUrl(x.b) && (
                  <img src={vietqrUrl(x.b)!} alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 10, background: "#fff", flex: "0 0 auto" }} />
                )}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: PAL.accentDeep, fontWeight: 700 }}>{x.who}</div>
                  <div style={{ fontSize: 14, color: PAL.ink, marginTop: 6 }}>{x.b?.name ? `${x.b.name} — ` : ""}<b>{x.b?.account?.replace(/\s/g, "")}</b></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SỔ LƯU BÚT */}
      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section style={{ padding: "16px 34px 40px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}><div style={{ fontFamily: cm, fontSize: 32, fontWeight: 600 }}>Sổ lưu bút</div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {wishes.map((w, i) => (
              <div key={i} style={{ background: PAL.soft, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "13px 16px" }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 6px" }}>{w.wish}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: PAL.accentDeep }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} pal={{ accent, surface: PAL.panel, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

      {/* RSVP + FOOTER */}
      <section style={{ padding: "26px 34px 40px", textAlign: "center", background: PAL.soft, position: "relative", zIndex: 2, borderTop: `1px solid ${PAL.line}` }}>
        {c.rsvp_enabled !== false && (<>
          <div style={{ fontFamily: cm, fontSize: 30, fontWeight: 600, marginBottom: 8 }}>Bạn sẽ đến chứ?</div>
          <RsvpForm slug={inv.slug} note={c.rsvp_note} />
        </>)}
        <div style={{ marginTop: 34 }}>
          <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600 }}>{groom} <span style={{ color: accent, fontStyle: "italic" }}>&amp;</span> {bride}</div>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: PAL.muted, marginTop: 6 }}>Cảm ơn vì đã là một phần trong ngày của chúng mình</div>
          <div style={{ fontSize: 10.5, color: PAL.muted, marginTop: 16, opacity: 0.7 }}>Thiệp cưới online · tạo bởi Mstudo</div>
        </div>
      </section>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
