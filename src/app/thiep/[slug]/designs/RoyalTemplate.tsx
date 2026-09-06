import type { CSSProperties } from "react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtShort, readConfig, vietqrUrl, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Royal — cột 480px, tông kem/vàng ấm sang trọng, chữ viết tay (Great Vibes →
// var(--font-script)), cánh hoa rơi, bìa Ken Burns, cuộn hiện dần. Port mẫu
// "Bảo Hân & Hoàng Phú".
const PAL = { bg: "#f7f1e7", paper: "#fffdf8", ink: "#413a30", soft: "#6f6659", muted: "#9c9483", line: "#e7ddcc", accent: "#a67c52", gold: "#b89968" };

export default function RoyalTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const cm = "var(--font-cormorant), serif";
  const gv = "var(--font-script), cursive";
  const wrap: CSSProperties = { background: "#241f1a", minHeight: "100vh" };
  const col: CSSProperties = { maxWidth: 480, margin: "0 auto", background: PAL.bg, color: PAL.ink, position: "relative", overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,.4)", fontFamily: "var(--font-manrope), sans-serif" };
  const petals = [
    { left: "8%", size: 16, dur: 14, delay: -1 }, { left: "24%", size: 12, dur: 17, delay: -5 },
    { left: "42%", size: 18, dur: 12, delay: -8 }, { left: "60%", size: 11, dur: 19, delay: -3 },
    { left: "76%", size: 15, dur: 15, delay: -10 }, { left: "90%", size: 13, dur: 13, delay: -6 },
  ];
  const script = (t: string, size: number) => <div style={{ fontFamily: gv, fontSize: size, color: accent, lineHeight: 1 }}>{t}</div>;

  return (
    <main style={wrap}>
      <style>{`
        @keyframes ryken{0%{transform:scale(1.15) translate(0,0)}100%{transform:scale(1.28) translate(-1.5%,-2%)}}
        @keyframes ryfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes rypetal{0%{transform:translateY(-8vh) rotate(0);opacity:0}12%{opacity:.9}100%{transform:translateY(108vh) rotate(360deg);opacity:0}}
      `}</style>
      <div style={col}>
        {/* petals */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30, overflow: "hidden" }}>
          {petals.map((p, i) => (
            <div key={i} style={{ position: "absolute", top: "-6vh", left: p.left, fontSize: p.size, color: PAL.gold, animation: `rypetal ${p.dur}s linear ${p.delay}s infinite` }}>❀</div>
          ))}
        </div>

        {/* HERO */}
        <section style={{ position: "relative", height: "100vh", minHeight: 640, maxHeight: 940, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden", color: "#fff" }}>
          {c.cover_url && <div style={{ position: "absolute", inset: 0, backgroundColor: "#2a2018", backgroundImage: `url('${c.cover_url}')`, backgroundSize: "cover", backgroundPosition: "center 38%", animation: "ryken 18s ease-in-out infinite alternate" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(30,22,16,.55) 0%,rgba(30,22,16,.2) 35%,rgba(30,22,16,.35) 62%,rgba(30,22,16,.78) 100%)" }} />
          <div style={{ position: "relative", zIndex: 2, padding: "0 26px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: gv, fontSize: 30, color: "#f0e2cf" }}>Save the date</div>
            <h1 style={{ fontFamily: cm, fontSize: "clamp(46px,15vw,74px)", fontWeight: 500, lineHeight: 1.05, margin: "10px 0" }}>{groom}<br /><span style={{ fontFamily: gv, fontSize: "0.55em", color: PAL.gold }}>&amp;</span><br />{bride}</h1>
            {c.wedding_date && <div style={{ fontSize: 13, letterSpacing: ".28em", textTransform: "uppercase", marginTop: 8 }}>{fmtShort(c.wedding_date)}</div>}
          </div>
          <div style={{ position: "absolute", bottom: 26, zIndex: 2, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", opacity: 0.85 }}>Cuộn xuống</span>
            <div style={{ animation: "ryfloat 2s ease-in-out infinite" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg></div>
          </div>
        </section>

        {/* INTRO */}
        <section style={{ padding: "64px 30px", textAlign: "center", background: PAL.paper }}>
          <Reveal anim="up">{script("Wedding Invitation", 40)}</Reveal>
          <Reveal anim="up"><p style={{ fontSize: 14.5, lineHeight: 1.9, color: PAL.soft, margin: "20px 0 0" }}>Trong niềm hân hoan, gia đình chúng tôi trân trọng kính mời bạn đến chung vui trong ngày lễ Thành hôn của</p></Reveal>
          <Reveal anim="zoom"><div style={{ margin: "26px 0 6px" }}>
            <div style={{ fontFamily: cm, fontSize: 34, fontWeight: 600 }}>{groom} <span style={{ fontFamily: gv, color: accent }}>&amp;</span> {bride}</div>
          </div></Reveal>
          <Reveal anim="up"><div style={{ margin: "26px auto 0", height: 1, width: 60, background: PAL.line }} /></Reveal>
        </section>

        {/* HAI GIA ĐÌNH */}
        {(c.groom_subtitle || c.bride_subtitle) && (
          <section style={{ padding: "56px 26px 60px", background: PAL.bg }}>
            <div style={{ display: "grid", gap: 20 }}>
              {[{ side: "Nhà trai", name: groom, sub: c.groom_subtitle }, { side: "Nhà gái", name: bride, sub: c.bride_subtitle }].map((f, i) => (
                <Reveal key={i} anim={i === 0 ? "left" : "right"}>
                  <div style={{ background: PAL.paper, border: `1px solid ${PAL.line}`, borderRadius: 20, padding: "26px 24px", textAlign: "center", boxShadow: "0 10px 30px rgba(120,90,50,.05)" }}>
                    <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>{f.side}</div>
                    <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, margin: "8px 0" }}>{f.name}</div>
                    <div style={{ margin: "8px 0", height: 1, width: 36, background: PAL.line, display: "inline-block" }} />
                    {f.sub && <div style={{ fontSize: 13, color: PAL.soft, lineHeight: 1.6, whiteSpace: "pre-line" }}>{f.sub}</div>}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* SỰ KIỆN */}
        {events.length > 0 && (
          <section style={{ padding: "60px 26px", background: PAL.paper }}>
            <Reveal anim="up"><div style={{ textAlign: "center", marginBottom: 40 }}>{script("Sự kiện cưới", 36)}</div></Reveal>
            {events.map((ev, i) => (
              <Reveal key={i} anim="up">
                <div style={{ background: PAL.bg, border: `1px solid ${PAL.line}`, borderRadius: 22, padding: "26px 24px", marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>{ev.label}</div>
                  <div style={{ fontFamily: cm, fontSize: 28, fontWeight: 600, margin: "10px 0 4px" }}>{[ev.time, fmtShort(ev.date)].filter(Boolean).join(" · ")}</div>
                  <div style={{ height: 1, background: PAL.line, margin: "14px 0" }} />
                  {(ev.venue || ev.address) && <div style={{ fontSize: 13, color: PAL.soft, lineHeight: 1.7 }}>{[ev.venue, ev.address].filter(Boolean).join(" — ")}</div>}
                  {ev.map_url && <a href={ev.map_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 12.5, fontWeight: 600, color: accent }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg> Chỉ đường
                  </a>}
                </div>
              </Reveal>
            ))}
          </section>
        )}

        <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.paper, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

        {/* COUNTDOWN */}
        {c.wedding_date && (
          <section style={{ padding: "56px 30px 60px", background: PAL.bg, textAlign: "center" }}>
            <Reveal anim="up">{script("Đếm ngược", 34)}<div style={{ marginTop: 22 }}><Countdown date={c.wedding_date} /></div></Reveal>
          </section>
        )}

        {/* TIMELINE / STORY */}
        {c.story && (
          <section style={{ padding: "56px 30px", background: PAL.paper }}>
            <Reveal anim="up"><div style={{ textAlign: "center", marginBottom: 20 }}>{script("Chuyện tình yêu", 34)}</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.9, color: PAL.soft, whiteSpace: "pre-line", textAlign: "center" }}>{c.story}</p></Reveal>
          </section>
        )}

        {/* ALBUM */}
        {gallery.length > 0 && (
          <section style={{ padding: "56px 16px 60px", background: PAL.bg }}>
            <Reveal anim="up"><div style={{ textAlign: "center", marginBottom: 26 }}>{script("Khoảnh khắc", 34)}</div></Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {gallery.map((src, i) => (
                <Reveal key={i} anim="zoom">
                  <div style={{ position: "relative", aspectRatio: i % 5 === 0 ? "1/1" : "3/4", gridColumn: i % 5 === 0 ? "span 2" : undefined, borderRadius: 14, overflow: "hidden" }}>
                    <img src={src} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* RSVP */}
        {c.rsvp_enabled !== false && (
          <section style={{ padding: "60px 30px", background: PAL.paper, textAlign: "center" }}>
            <Reveal anim="up">{script("Xác nhận tham dự", 34)}
              <p style={{ fontSize: 13.5, color: PAL.soft, margin: "12px 0 22px" }}>{c.rsvp_note || "Sự hiện diện của bạn là niềm hạnh phúc của chúng mình."}</p>
              <RsvpForm slug={inv.slug} note={undefined} /></Reveal>
          </section>
        )}

        {/* GIFT */}
        {hasGift && (
          <section style={{ padding: "56px 26px", background: PAL.bg }}>
            <Reveal anim="up"><div style={{ textAlign: "center", marginBottom: 20 }}>{script("Hộp mừng cưới", 32)}
              {c.gift_note && <p style={{ fontSize: 13, color: PAL.soft, marginTop: 6 }}>{c.gift_note}</p>}</div></Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ b: c.groom_bank, who: `Chú rể · ${groom}` }, { b: c.bride_bank, who: `Cô dâu · ${bride}` }].filter((x) => vietqrUrl(x.b) || x.b?.account).map((x, i) => (
                <Reveal key={i} anim="up"><div style={{ background: PAL.paper, border: `1px solid ${PAL.line}`, borderRadius: 18, padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
                  {vietqrUrl(x.b) && (
                    <img src={vietqrUrl(x.b)!} alt="" width={78} height={78} style={{ width: 78, height: 78, borderRadius: 12, background: "#fff", flex: "0 0 auto" }} />
                  )}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>{x.who}</div>
                    <div style={{ fontSize: 14, marginTop: 6 }}>{x.b?.name ? `${x.b.name} — ` : ""}<b>{x.b?.account?.replace(/\s/g, "")}</b></div>
                  </div>
                </div></Reveal>
              ))}
            </div>
          </section>
        )}

        {/* SỔ LƯU BÚT */}
        {c.guestbook_enabled !== false && wishes.length > 0 && (
          <section style={{ padding: "56px 26px", background: PAL.paper }}>
            <Reveal anim="up"><div style={{ textAlign: "center", marginBottom: 18 }}>{script("Sổ lưu bút", 32)}</div></Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {wishes.map((w, i) => (
                <div key={i} style={{ background: PAL.bg, border: `1px solid ${PAL.line}`, borderRadius: 16, padding: "15px 18px" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 6px" }}>{w.wish}</p>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>— {w.guest_name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} pal={{ accent, surface: PAL.paper, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

        {/* THANK YOU */}
        <footer style={{ padding: "60px 30px 70px", background: PAL.bg, textAlign: "center" }}>
          {script("Thank you", 44)}
          <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, marginTop: 12 }}>{groom} &amp; {bride}</div>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: PAL.muted, marginTop: 10 }}>Hẹn gặp bạn trong ngày vui · tạo bởi Mstudo</div>
        </footer>

        {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
      </div>
    </main>
  );
}
