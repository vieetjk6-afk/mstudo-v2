import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1a · Y2K chrome — blob gradient lỏng, đĩa chrome xoay, tên chữ gradient chạy
// shimmer, thông tin tiệc nằm trong một thẻ trắng bo 28px nổi trên nền tím.
const BG = "#12052b", LILAC = "#c9b8ff", PINK = "#ffd6f7";
const GLASS = { background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)" };
const TINT = "rgba(255,255,255,.14)";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

const NAME: React.CSSProperties = {
  fontFamily: SANS, fontWeight: 800, fontSize: 48, lineHeight: 1, letterSpacing: "-.03em",
  background: "linear-gradient(100deg,#fff,#a8e9ff,#ffd6f7,#fff,#bcaaff,#fff)", backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "wcShimmer 5s linear infinite",
};

export default function Y2kTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#ff4fd8";
  const lab = { fontSize: 10, letterSpacing: ".26em", textTransform: "uppercase" as const, color: LILAC };

  return (
    <PhoneShell
      card={BG} page="#080216" ink="#fff" font={SANS} radius={44} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 320, height: 320, left: -90, top: 40, borderRadius: "50%", background: `radial-gradient(circle,${accent},transparent 70%)`, filter: "blur(40px)", animation: "wcBlob 14s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 300, height: 300, right: -100, top: 420, borderRadius: "50%", background: "radial-gradient(circle,#3ee9ff,transparent 70%)", filter: "blur(45px)", animation: "wcBlob 18s ease-in-out infinite reverse" }} />
          <div style={{ position: "absolute", width: 280, height: 280, left: 30, bottom: 120, borderRadius: "50%", background: "radial-gradient(circle,#b86bff,transparent 70%)", filter: "blur(45px)", animation: "wcBlob 16s ease-in-out infinite" }} />
        </div>
      }
    >
      <style>{`
        @keyframes wcShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes wcBlob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.15)}66%{transform:translate(-30px,25px) scale(.9)}}
        @keyframes wcSpin{to{transform:rotate(360deg)}}
        @keyframes wcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
      `}</style>

      <div style={{ padding: "26px 24px 46px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Eyebrow style={lab}>Save the date</Eyebrow>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
          <div style={{ width: 112, height: 112, borderRadius: "50%", background: "conic-gradient(from 0deg,#fff,#9ad7ff,#ffb3f0,#fff,#cbb3ff,#fff)", animation: "wcSpin 9s linear infinite", boxShadow: "0 0 40px rgba(255,110,220,.5)" }} />
          <div style={{ ...NAME, marginTop: 16 }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 34, color: "#ff9ee8" }}>&amp;</div>
          <div style={{ ...NAME, animationDelay: ".6s" }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 12, fontSize: 12, letterSpacing: ".3em", color: LILAC }}>{d.date.spaced}</div>}
        </div>

        <GuestLine d={d} label={lab} name={{ fontSize: 40, lineHeight: 1.1, color: "#fff", marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ ...GLASS, backdropFilter: "blur(8px)", borderRadius: 16, padding: "12px 4px", textAlign: "center" }}
          num={{ fontWeight: 800, fontSize: 24, color: "#fff" }}
          lab={{ fontSize: 9, letterSpacing: ".14em", color: LILAC, textTransform: "uppercase" }}
        />

        <Slot src={d.hero} height={250} radius={26} border="1px solid rgba(255,255,255,.3)" tint={TINT} label="Ảnh bìa" lazy={false} />

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.pair.length, 2)},1fr)`, gap: 10 }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={110} radius={18} border="1px solid rgba(255,255,255,.25)" tint={TINT} />)}
          </div>
        )}

        {/* Thẻ trắng: toàn bộ thông tin "đi đâu, lúc nào" gom một chỗ dễ đọc. */}
        <div style={{ background: "rgba(255,255,255,.95)", borderRadius: 28, padding: 22, display: "flex", flexDirection: "column", gap: 16, color: BG }}>
          <Eyebrow style={{ ...lab, color: "#7a5bd0" }}>{d.guestLabel}</Eyebrow>
          {d.quote && <div style={{ fontSize: 15, lineHeight: 1.65 }}>{d.quote}</div>}
          {d.date.valid && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", borderTop: "1px dashed #ccc3e8", borderBottom: "1px dashed #ccc3e8", padding: "14px 0" }}>
              <div style={{ textAlign: "center", minWidth: 74 }}>
                <div style={{ fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{d.date.day}</div>
                <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#7a5bd0" }}>Tháng {d.date.month}</div>
              </div>
              <div style={{ width: 1, alignSelf: "stretch", background: "#e4ddf5" }} />
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <strong>{d.date.weekday}</strong>
                {d.lunar && <><br />{d.lunar}</>}
                {d.reception && <><br />{d.reception}</>}
              </div>
            </div>
          )}
          {(d.venue.name || d.venue.address) && (
            <div style={{ fontSize: 14, lineHeight: 1.65 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
          )}
          <MapBox d={d} radius={18} height={130} />
          {d.mapHref && (
            <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: 13, borderRadius: 99, background: "linear-gradient(100deg,#ff4fd8,#8f5bff,#3ee9ff)", backgroundSize: "200% 100%", animation: "wcShimmer 6s linear infinite", color: "#fff", fontWeight: 600, fontSize: 14 }}>
              Chỉ đường tới đó
            </a>
          )}
        </div>

        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Lịch trình</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, color: "rgba(255,255,255,.92)" }}>
                <span>{e.label}</span>
                <span style={{ color: LILAC, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        )}

        {d.story && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Chuyện của tụi mình</Eyebrow>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.9)", whiteSpace: "pre-line" }}>{d.story}</div>
          </div>
        )}

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 9, letterSpacing: ".26em", textTransform: "uppercase", color: LILAC }}
          name={{ fontSize: 22, fontWeight: 700, color: "#fff" }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: LILAC, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <Families d={d} wrap={{ color: "rgba(255,255,255,.92)" }} head={{ ...lab, marginBottom: 6 }} divider="rgba(255,255,255,.25)" />
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow style={lab}>Bạn đến được chứ?</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Có mặt", "Để xem", "Tiếc quá"]}
              btn={{ flex: 1, padding: "13px 4px", border: "1px solid rgba(255,255,255,.4)", borderRadius: 99, background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: "#fff", color: BG }}
              msgStyle={{ fontSize: 13, color: PINK }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={lab}>Lời chúc</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ ...GLASS, borderRadius: 18, padding: "12px 16px", color: "#fff", fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
              by={{ fontSize: 11, color: LILAC, marginTop: 4 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <Eyebrow style={lab}>Album nhỏ</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={104} radius={16} border="1px solid rgba(255,255,255,.25)" tint={TINT} style={{ animation: `wcFloat 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ ...GLASS, borderRadius: 18, padding: 14 }}
          label={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: LILAC }}
          value={{ color: "#fff", fontSize: 14, fontWeight: 600, marginTop: 4 }}
        />

        <Gifts d={d} box={{ ...GLASS, borderRadius: 22, padding: 16, color: "#fff" }} qrRadius={14} muted={{ color: LILAC }} note={{ color: LILAC }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 22, color: PINK, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
