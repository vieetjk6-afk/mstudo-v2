import type { CSSProperties } from "react";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtShort, readConfig, vietqrUrl, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Editorial — tạp chí sáng, tông đất terracotta, tít Cormorant khổ lớn, băng ảnh
// tự trôi. Port từ mẫu studio (thiep-1c).
const PAL = { bg: "#f4f1ec", panel: "#fff", ink: "#241f21", muted: "#8f867f", line: "#e4ddd3", accent: "#b5624f", accentSoft: "#efe3dc" };

export default function EditorialTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const cm = "var(--font-cormorant), serif";
  const wrap: CSSProperties = { background: PAL.bg, color: PAL.ink, width: "100%", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden", fontFamily: "var(--font-manrope), sans-serif" };
  const kicker: CSSProperties = { fontSize: 11, letterSpacing: ".34em", textTransform: "uppercase", fontWeight: 800, color: accent };
  const dm = c.wedding_date ? new Date(c.wedding_date) : null;
  const strip = gallery.length ? [...gallery, ...gallery].slice(0, Math.max(8, gallery.length * 2)) : [];

  return (
    <main style={wrap}>
      <style>{`
        @keyframes edzoom{0%{transform:scale(1)}100%{transform:scale(1.12)}}
        @keyframes edmarq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      `}</style>

      {/* MASTHEAD */}
      <section style={{ padding: "46px 34px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={kicker}>The wedding of</span>
          <span style={{ ...kicker, color: PAL.muted }}>Est. {dm ? dm.getFullYear() : "2026"}</span>
        </div>
        <div style={{ fontFamily: cm, fontSize: 84, fontWeight: 600, lineHeight: 0.86, margin: "18px 0 0", letterSpacing: "-.01em" }}>{groom}<br /><span style={{ fontStyle: "italic", color: accent }}>&amp;</span> {bride}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <span style={{ flex: "0 0 auto", width: 44, height: 2, background: accent }} />
          <span style={{ fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: PAL.ink, fontWeight: 600 }}>{c.wedding_date ? fmtShort(c.wedding_date) : ""}</span>
        </div>
      </section>

      {/* FULL-BLEED 01 */}
      {c.cover_url && (
        <section style={{ position: "relative", height: 440, overflow: "hidden" }}>
          <img src={c.cover_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 42%", animation: "edzoom 18s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", top: 16, left: 16, fontFamily: cm, fontSize: 66, fontWeight: 600, color: "#fff", lineHeight: 1, textShadow: "0 2px 16px rgba(0,0,0,.4)", opacity: 0.9 }}>01</div>
          <div style={{ position: "absolute", bottom: 16, right: 18, color: "#fff", textAlign: "right", textShadow: "0 1px 8px rgba(0,0,0,.5)" }}><div style={{ fontFamily: cm, fontSize: 30, fontStyle: "italic" }}>Ngày chung đôi</div></div>
        </section>
      )}

      {/* QUOTE + CIRCLE */}
      <section style={{ padding: "44px 34px", display: "flex", gap: 22, alignItems: "center" }}>
        {(gallery[0] || c.cover_url) && (
          <div style={{ flex: "0 0 auto", width: 120, height: 120, borderRadius: "50%", overflow: "hidden", border: `3px solid ${PAL.panel}`, boxShadow: "0 10px 26px rgba(120,70,60,.2)" }}>
            <img src={gallery[0] || c.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: "edzoom 14s ease-in-out infinite alternate" }} />
          </div>
        )}
        <p style={{ flex: 1, fontFamily: cm, fontSize: 25, fontStyle: "italic", lineHeight: 1.45, margin: 0 }}>“{c.cover_quote || "Chúng mình sắp về chung một nhà — và muốn có bạn ở đó."}”</p>
      </section>

      {/* BIG DATE */}
      {dm && (
        <section style={{ padding: "8px 34px 40px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20, borderTop: `1px solid ${PAL.line}`, borderBottom: `1px solid ${PAL.line}`, padding: "26px 0" }}>
            <div style={{ fontFamily: cm, fontSize: 100, fontWeight: 600, lineHeight: 0.8, color: accent }}>{String(dm.getDate()).padStart(2, "0")}<span style={{ fontSize: 40, color: PAL.ink }}>.{String(dm.getMonth() + 1).padStart(2, "0")}</span></div>
            <div style={{ paddingBottom: 10 }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: PAL.muted, fontWeight: 700 }}>Năm {dm.getFullYear()}</div>
              {events[0] && <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{[events[0].time, events[0].label].filter(Boolean).join(" — ")}</div>}
              {events[0]?.venue && <div style={{ fontSize: 13, color: PAL.muted, marginTop: 2, lineHeight: 1.4 }}>{[events[0].venue, events[0].address].filter(Boolean).join(" · ")}</div>}
            </div>
          </div>
        </section>
      )}

      {/* FILM STRIP */}
      {strip.length > 0 && (
        <section style={{ padding: "0 0 44px", overflow: "hidden" }}>
          <div style={{ ...kicker, padding: "0 34px 16px" }}>Những khoảnh khắc</div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 10, width: "200%", animation: "edmarq 26s linear infinite", padding: "0 10px" }}>
              {strip.map((src, i) => (
                <div key={i} style={{ flex: "0 0 auto", width: 200, height: 260, borderRadius: 6, backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EVENTS list */}
      {events.length > 0 && (
        <section style={{ padding: "0 34px 44px" }}>
          <div style={{ fontFamily: cm, fontSize: 36, fontWeight: 600, marginBottom: 18 }}>Chương trình</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 18, padding: "16px 0", borderTop: `1px solid ${PAL.line}`, borderBottom: i === events.length - 1 ? `1px solid ${PAL.line}` : undefined }}>
                <div style={{ flex: "0 0 78px", fontFamily: cm, fontSize: 22, fontWeight: 600, color: accent }}>{e.time || fmtShort(e.date)}</div>
                <div><div style={{ fontSize: 15, fontWeight: 700 }}>{e.label}</div><div style={{ fontSize: 13, color: PAL.muted }}>{[e.venue, e.address].filter(Boolean).join(" · ")}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.panel, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

      {/* STORY */}
      {c.story && (
        <section style={{ padding: "0 34px 44px" }}>
          <div style={{ ...kicker, marginBottom: 16 }}>Câu chuyện</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: PAL.ink, whiteSpace: "pre-line", margin: 0 }}>{c.story}</p>
        </section>
      )}

      {/* COUNTDOWN (dark) */}
      {c.wedding_date && (
        <section style={{ padding: 34, background: PAL.ink, color: "#fff", textAlign: "center" }}>
          <div style={{ ...kicker, color: "#d9b3a6" }}>Đếm ngược</div>
          <div style={{ marginTop: 14 }}><Countdown date={c.wedding_date} /></div>
        </section>
      )}

      {/* GIFT + RSVP */}
      <section style={{ padding: "40px 34px" }}>
        {hasGift && (<>
          <div style={{ fontFamily: cm, fontSize: 34, fontWeight: 600, textAlign: "center", marginBottom: c.gift_note ? 10 : 20 }}>Hộp mừng cưới</div>
          {c.gift_note && <p style={{ textAlign: "center", fontSize: 13, fontStyle: "italic", color: PAL.muted, margin: "0 auto 18px", maxWidth: 420, whiteSpace: "pre-line" }}>{c.gift_note}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            {[{ b: c.groom_bank, who: "Chú rể" }, { b: c.bride_bank, who: "Cô dâu" }].filter((x) => x.b?.account).map((x, i) => (
              <div key={i} style={{ flex: 1, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
                {vietqrUrl(x.b) && (
                  <img src={vietqrUrl(x.b)!} alt="" width={120} height={120} style={{ width: "100%", maxWidth: 120, height: "auto", borderRadius: 8, background: "#fff", margin: "0 auto 8px" }} />
                )}
                <div style={{ ...kicker, fontSize: 10 }}>{x.who}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{x.b?.name}<br /><b style={{ fontSize: 15 }}>{x.b?.account?.replace(/\s/g, "")}</b></div>
              </div>
            ))}
          </div>
        </>)}
        {c.rsvp_enabled !== false && (
          <div style={{ marginTop: hasGift ? 24 : 0, textAlign: "center" }}>
            <div style={{ fontFamily: cm, fontSize: 26, fontStyle: "italic", marginBottom: 14 }}>Bạn sẽ đến chứ?</div>
            <RsvpForm slug={inv.slug} note={c.rsvp_note} />
          </div>
        )}
      </section>

      {/* WISHES */}
      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section style={{ padding: "0 34px 40px" }}>
          <div style={{ ...kicker, marginBottom: 14 }}>Sổ lưu bút</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {wishes.map((w, i) => (
              <div key={i} style={{ borderTop: `1px solid ${PAL.line}`, paddingTop: 12 }}>
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 4px" }}>{w.wish}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} pal={{ accent, surface: PAL.panel, text: PAL.ink, muted: PAL.muted, border: PAL.line }} />

      <footer style={{ padding: "14px 34px 44px", textAlign: "center" }}>
        <div style={{ fontFamily: cm, fontSize: 40, fontWeight: 600 }}>{groom} <span style={{ fontStyle: "italic", color: accent }}>&amp;</span> {bride}</div>
        <div style={{ ...kicker, color: PAL.muted, marginTop: 8 }}>Cảm ơn vì đã ở đây · tạo bởi Mstudo</div>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
