import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1f · Cyberpunk "vé concert" — lưới neon, scanline chạy dọc, tấm vé có đường
// răng cưa dashed, lịch trình gọi là SETLIST.
// Màu chữ phụ để ở tông sáng (#b39ac4) thay vì tím đậm để chữ nhỏ vẫn đọc rõ
// trên nền đen (mục tiêu tương phản 4.5:1).
const BG = "#07080f", CYAN = "#00ffd5", PINK = "#ff2d95", TEXT = "#d6f7f2", MUTED = "#b39ac4";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function NeonTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || CYAN;
  const lab = { fontSize: 10, letterSpacing: ".26em", textTransform: "uppercase" as const, color: accent };

  return (
    <PhoneShell
      card={BG} page="#03040a" ink={TEXT} font={SANS} radius={16} accent={accent}
      pattern={
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(0,255,213,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,213,.06) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <div style={{ position: "absolute", left: 0, right: 0, height: 60, background: "linear-gradient(rgba(0,255,213,.14),transparent)", animation: "wcScan 7s linear infinite", pointerEvents: "none" }} />
        </>
      }
    >
      <style>{`
        @keyframes wcScan{from{transform:translateY(-100%)}to{transform:translateY(1400%)}}
        @keyframes wcFlicker{0%,100%{opacity:1}47%{opacity:1}49%{opacity:.35}51%{opacity:1}93%{opacity:.5}}
        @keyframes wcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>

      <div style={{ padding: "24px 20px 46px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Eyebrow style={{ ...lab, letterSpacing: ".24em" }}>Admit one · {d.slug.slice(0, 12)}</Eyebrow>

        {/* Tấm vé */}
        <div style={{ border: `1px solid ${accent}`, borderRadius: 12, overflow: "hidden", background: "rgba(0,255,213,.04)" }}>
          <div style={{ padding: "26px 20px", display: "flex", flexDirection: "column", gap: 6, textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: ".3em", color: PINK }}>THE WEDDING {d.date.year || "TOUR"}</div>
            <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: "#fff", textShadow: "0 0 18px rgba(0,255,213,.7)", animation: "wcFlicker 6s infinite" }}>{d.bride}</div>
            <div style={{ fontSize: 20, color: PINK, textShadow: "0 0 14px rgba(255,45,149,.8)" }}>✦ FEAT ✦</div>
            <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: "#fff", textShadow: "0 0 18px rgba(0,255,213,.7)", animation: "wcFlicker 6s infinite 1.5s" }}>{d.groom}</div>
          </div>
          <div style={{ borderTop: "1px dashed rgba(0,255,213,.5)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
            {[
              { k: "DATE", v: d.date.valid ? d.date.short : "—" },
              { k: "DOORS", v: d.reception || d.events[0]?.time || "—" },
              { k: "SHOW", v: d.events[d.events.length - 1]?.time || "—" },
            ].map((x, i) => (
              <div key={x.k} style={{ padding: "14px 4px", borderRight: i < 2 ? "1px dashed rgba(0,255,213,.3)" : undefined }}>
                <div style={{ fontSize: 9, letterSpacing: ".16em", color: accent }}>{x.k}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        {d.dateSub && <div style={{ textAlign: "center", fontSize: 12, color: MUTED, letterSpacing: ".08em" }}>{d.dateSub}</div>}

        <GuestLine d={d} label={{ ...lab, textAlign: "center" }} name={{ fontSize: 38, lineHeight: 1.1, color: "#fff", marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["DAYS", "HRS", "MIN", "SEC"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ border: `1px solid ${PINK}`, borderRadius: 8, padding: "12px 2px", textAlign: "center", background: "rgba(255,45,149,.07)" }}
          num={{ fontWeight: 700, fontSize: 24, color: PINK }}
          lab={{ fontSize: 9, color: MUTED, letterSpacing: ".12em" }}
        />

        <Slot src={d.hero} height={240} radius={10} border="1px solid rgba(0,255,213,.45)" tint="rgba(0,255,213,.08)" label="Ảnh bìa" lazy={false} />

        {d.events.length > 0 && (
          <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, color: TEXT }}>
            <Eyebrow style={lab}>Setlist</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                <span>{String(i + 1).padStart(2, "0")} · {e.label}</span>
                <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        )}

        {(d.story || d.quote) && (
          <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow style={lab}>Backstage</Eyebrow>
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>{d.story || d.quote}</div>
          </div>
        )}

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: PINK }}
          name={{ fontSize: 20, fontWeight: 700, color: "#fff" }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: MUTED, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20 }}>
            <Families d={d} head={{ ...lab, marginBottom: 6 }} divider="rgba(0,255,213,.3)" />
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ border: "1px solid rgba(255,45,149,.5)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, color: "#f7d6ea" }}>
            <Eyebrow style={{ ...lab, color: PINK }}>Venue</Eyebrow>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: "#fff" }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} radius={8} height={130} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 6, background: PINK, color: BG, fontWeight: 700, fontSize: 13, letterSpacing: ".12em" }}>GET DIRECTIONS →</a>
            )}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Check-in</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["GOING", "MAYBE", "CAN'T"]}
              btn={{ flex: 1, padding: "13px 4px", borderRadius: 6, border: `1px solid ${accent}`, background: "rgba(0,255,213,.1)", color: accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              btnOn={{ background: accent, color: BG }}
              msgStyle={{ fontSize: 13, color: "#ff9ed2" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Fan messages</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ borderLeft: `2px solid ${PINK}`, padding: "10px 14px", color: TEXT, fontSize: 13, lineHeight: 1.5, background: "rgba(255,45,149,.06)", marginBottom: 8 }}
              by={{ fontSize: 11, color: MUTED, marginTop: 4 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <Eyebrow style={lab}>Gallery</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={104} radius={8} border="1px solid rgba(0,255,213,.45)" tint="rgba(0,255,213,.12)" style={{ animation: `wcFloat 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ border: "1px solid rgba(255,45,149,.5)", borderRadius: 8, padding: 14 }}
          label={{ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: PINK }}
          value={{ color: "#fff", fontSize: 14, fontWeight: 700, marginTop: 4 }}
        />

        <Gifts d={d} box={{ border: "1px dashed rgba(0,255,213,.5)", borderRadius: 10, padding: 16, color: TEXT }} qrRadius={4} muted={{ color: accent }} title="Mừng cưới / tip jar" note={{ color: MUTED }} />

        <div style={{ textAlign: "center", fontSize: 10, letterSpacing: ".3em", color: MUTED, whiteSpace: "pre-line" }}>
          {d.closing || d.thanks || "ONE NIGHT ONLY · SEE YOU THERE"}
        </div>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
