import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1e · 3D glassmorphism — quả cầu gradient trôi phía sau, mọi khối là thẻ kính
// blur 18px bo 28px trên nền xanh tím sâu.
const INK = "#fff", DIM = "rgba(255,255,255,.7)", DIM2 = "rgba(255,255,255,.92)";
const GLASS = { background: "rgba(255,255,255,.13)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,.3)" };
const TINT = "rgba(255,255,255,.12)";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function GlassTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#ff9ad5";
  const card = { ...GLASS, borderRadius: 28, padding: 22, display: "flex", flexDirection: "column" as const, gap: 14, color: INK };
  const lab = { fontSize: 10, letterSpacing: ".28em", textTransform: "uppercase" as const, color: DIM };

  return (
    <PhoneShell
      card="linear-gradient(160deg,#1b2a4a,#2d1b4a 50%,#0f2e3e)" page="#111a2c" ink={INK} font={SANS} radius={38} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 230, height: 230, right: -60, top: 60, borderRadius: "50%", background: "linear-gradient(140deg,#ff9ad5,#8f7bff)", filter: "blur(2px)", opacity: 0.85, animation: "wcFloat 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 150, height: 150, left: -40, top: 380, borderRadius: "50%", background: "linear-gradient(140deg,#7bf0ff,#4d8bff)", opacity: 0.8, animation: "wcFloat 12s ease-in-out infinite 1s" }} />
          <div style={{ position: "absolute", width: 190, height: 190, right: -50, bottom: 120, borderRadius: "50%", background: "linear-gradient(140deg,#ffd98f,#ff7bb4)", opacity: 0.7, animation: "wcFloat 11s ease-in-out infinite 2s" }} />
        </div>
      }
    >
      <style>{`@keyframes wcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>

      <div style={{ padding: "34px 22px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Eyebrow style={{ ...lab, color: "rgba(255,255,255,.75)" }}>We&apos;re getting married</Eyebrow>

        <div style={{ ...GLASS, borderRadius: 32, padding: "30px 22px", boxShadow: "0 20px 50px -20px rgba(0,0,0,.6)", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.06, letterSpacing: "-.02em" }}>{d.bride}</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,.65)", letterSpacing: ".3em" }}>×</div>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.06, letterSpacing: "-.02em" }}>{d.groom}</div>
          {d.date.valid && (
            <div style={{ marginTop: 14, fontSize: 12, letterSpacing: ".26em", color: "rgba(255,255,255,.75)" }}>
              {d.date.weekday.toUpperCase()} · {d.date.dotted}{d.reception ? ` · ${d.reception}` : ""}
            </div>
          )}
          {d.dateSub && <div style={{ fontSize: 12.5, color: DIM }}>{d.dateSub}</div>}
        </div>

        <GuestLine d={d} label={{ ...lab, textAlign: "center" }} name={{ fontSize: 40, lineHeight: 1.1, color: INK, marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ ...GLASS, backdropFilter: "blur(14px)", borderRadius: 20, padding: "14px 2px", textAlign: "center" }}
          num={{ fontWeight: 700, fontSize: 24, color: INK }}
          lab={{ fontSize: 9, color: "rgba(255,255,255,.6)", letterSpacing: ".14em" }}
        />

        <Slot src={d.hero} height={260} radius={28} border="1px solid rgba(255,255,255,.3)" tint={TINT} label="Ảnh bìa" lazy={false} />

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.pair.length, 2)},1fr)`, gap: 10 }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={120} radius={22} border="1px solid rgba(255,255,255,.26)" tint={TINT} />)}
          </div>
        )}

        {d.events.length > 0 && (
          <div style={card}>
            <Eyebrow style={lab}>Lịch trình</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i}>
                {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "0 0 14px" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                  <span>{e.label}</span>
                  <span style={{ color: DIM, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
                </div>
                {e.where && <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>{e.where}</div>}
              </div>
            ))}
          </div>
        )}

        {(d.story || d.quote) && (
          <div style={card}>
            <Eyebrow style={lab}>Chuyện của tụi mình</Eyebrow>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: DIM2, whiteSpace: "pre-line" }}>{d.story || d.quote}</div>
          </div>
        )}

        <Portraits
          d={d}
          ring={"rgba(255,255,255,.5)"}
          role={{ fontSize: 10, letterSpacing: ".28em", textTransform: "uppercase", color: DIM }}
          name={{ fontSize: 22, fontWeight: 700, color: INK }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: DIM, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <div style={card}>
            <Families d={d} head={{ ...lab, marginBottom: 6 }} divider="rgba(255,255,255,.2)" />
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={card}>
            <Eyebrow style={lab}>Địa điểm</Eyebrow>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} radius={18} height={130} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 99, background: "rgba(255,255,255,.92)", color: "#1b2a4a", fontWeight: 600, fontSize: 14 }}>Chỉ đường</a>
            )}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, color: INK }}>
            <Eyebrow style={lab}>RSVP</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Đi chứ", "Chưa chắc", "Bận mất"]}
              btn={{ flex: 1, padding: "13px 4px", borderRadius: 18, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.14)", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: "#fff", color: "#1b2a4a" }}
              msgStyle={{ fontSize: 13, color: "#ffd6f7" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Lời chúc</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 18, padding: "12px 16px", color: INK, fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
              by={{ fontSize: 11, color: "rgba(255,255,255,.65)", marginTop: 4 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <Eyebrow style={lab}>Album</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={104} radius={20} border="1px solid rgba(255,255,255,.26)" tint="rgba(255,255,255,.14)" style={{ animation: `wcFloat 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ ...GLASS, borderRadius: 22, padding: 16, color: INK, fontSize: 13, lineHeight: 1.6 }}
          label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,.65)" }}
          value={{ fontWeight: 600, marginTop: 2 }}
        />

        <Gifts d={d} box={{ ...GLASS, borderRadius: 24, padding: 16, color: INK }} qrRadius={16} muted={{ color: DIM }} note={{ color: DIM }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontSize: 15, lineHeight: 1.7, color: DIM2, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
