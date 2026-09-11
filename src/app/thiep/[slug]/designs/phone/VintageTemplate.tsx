import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1d · Hoa lá vintage vẽ tay — cánh hoa rơi nhè nhẹ, khung viền 1px màu rơm,
// tất cả góc đều vuông, sổ lưu bút kiểu dòng kẻ chấm.
const BG = "#f7f2e7", INK = "#463c2c", DARK = "#3b3222", MUTED = "#8c7c5c", LINE = "#c9bb9a", PAPER = "rgba(255,253,247,.7)";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

const PETALS = [
  { left: "8%", size: 12, color: "#d98fa0", dur: 13, delay: 0, opacity: 0.7 },
  { left: "38%", size: 10, color: "#c2ae7a", dur: 17, delay: 3, opacity: 0.7 },
  { left: "68%", size: 14, color: "#9db98c", dur: 15, delay: 6, opacity: 0.6 },
  { left: "88%", size: 9, color: "#d98fa0", dur: 19, delay: 9, opacity: 0.6 },
];

export default function VintageTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#b0724f";

  return (
    <PhoneShell
      card={BG} page="#e6dfcd" ink={INK} font={SANS} radius={8} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {PETALS.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: p.left, top: 0, width: p.size, height: p.size, borderRadius: "60% 20% 60% 20%", background: p.color, opacity: p.opacity, animation: `wcPetal ${p.dur}s linear infinite ${p.delay}s` }} />
          ))}
        </div>
      }
    >
      <style>{`
        @keyframes wcPetal{0%{transform:translateY(-40px) rotate(0deg);opacity:0}12%{opacity:.9}100%{transform:translateY(1400px) rotate(320deg);opacity:0}}
        @keyframes wcSway{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
      `}</style>

      <div style={{ padding: "30px 24px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ border: `1px solid ${LINE}`, padding: "26px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", background: PAPER }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 38, height: 1, background: LINE }} />
            <span style={{ fontSize: 10, letterSpacing: ".34em", color: MUTED, textTransform: "uppercase" }}>{d.guestLabel}</span>
            <span style={{ width: 38, height: 1, background: LINE }} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.05, color: DARK }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 28, color: accent, animation: "wcSway 6s ease-in-out infinite" }}>&amp;</div>
          <div style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.05, color: DARK }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 10, fontSize: 11, letterSpacing: ".3em", color: MUTED }}>{d.date.day} THÁNG {d.date.month} · {d.date.year}</div>}
          {d.dateSub && <div style={{ fontSize: 12.5, color: MUTED }}>{d.dateSub}</div>}
        </div>

        <GuestLine d={d} label={{ fontSize: 10, letterSpacing: ".34em", textTransform: "uppercase", color: MUTED, textAlign: "center" }} name={{ fontSize: 40, lineHeight: 1.1, color: DARK, marginTop: 2 }} />

        <Slot src={d.hero} height={300} border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" label="Ảnh cưới" lazy={false} />

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.pair.length, 2)},1fr)`, gap: 12 }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={140} border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" />)}
          </div>
        )}

        {(d.quote || d.story) && (
          <div style={{ textAlign: "center", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 18, lineHeight: 1.7, color: "#5a4d39", whiteSpace: "pre-line" }}>
            {d.quote ? `“${d.quote}”` : d.story}
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "flex", justifyContent: "center", gap: 26, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "18px 0" }}
          box={{ textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 32, color: DARK }}
          lab={{ fontSize: 9, letterSpacing: ".2em", color: MUTED }}
        />

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}
          name={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.15, color: DARK }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: MUTED, marginTop: 4 }}
        />

        <Families d={d} head={{ fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }} divider={LINE} />

        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Eyebrow style={{ letterSpacing: ".34em", color: MUTED, textAlign: "center" }}>Chương trình</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <span style={{ fontFamily: SERIF, fontSize: 20, color: accent, minWidth: 74 }}>{e.time || e.date || "—"}</span>
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>{[e.label, e.where].filter(Boolean).join(" — ")}</span>
              </div>
            ))}
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ border: `1px solid ${LINE}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, background: PAPER }}>
            <Eyebrow style={{ color: MUTED }}>Địa điểm</Eyebrow>
            <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} height={130} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, border: `1px solid ${DARK}`, color: DARK, fontSize: 11, letterSpacing: ".24em" }}>XEM CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow style={{ letterSpacing: ".34em", color: MUTED, textAlign: "center" }}>Bạn sẽ đến chứ?</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Có", "Chưa chắc", "Không"]}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: 13, cursor: "pointer" }}
              btnOn={{ background: accent, color: "#fffdf7" }}
              msgStyle={{ textAlign: "center", fontSize: 13, color: accent }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={{ letterSpacing: ".34em", color: MUTED, textAlign: "center" }}>Sổ lưu bút</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ borderBottom: `1px dotted ${LINE}`, padding: "10px 2px", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 14, lineHeight: 1.6 }}
              by={{ fontStyle: "normal", fontSize: 11, color: MUTED }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <Eyebrow style={{ letterSpacing: ".34em", color: MUTED, textAlign: "center" }}>Album nhỏ</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={104} border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" style={{ animation: `wcSway 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ border: `1px solid ${LINE}`, padding: 16, background: PAPER, fontSize: 13, lineHeight: 1.6 }}
          label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: MUTED }}
          value={{ fontFamily: SERIF, fontSize: 19 }}
        />

        <Gifts d={d} box={{ border: `1px solid ${LINE}`, padding: 16, background: PAPER }} qrRadius={0} muted={{ color: MUTED }} note={{ color: MUTED, fontStyle: "italic" }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 22, color: accent, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
