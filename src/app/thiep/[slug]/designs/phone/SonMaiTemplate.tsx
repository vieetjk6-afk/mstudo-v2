import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 2b · Sơn mài indigo & vàng lá. Header chia cột với dải chữ DỌC, ảnh ngang,
// đếm ngược là lưới 4 ô viền vàng mảnh — mọi khối đều vuông vắn, không bo góc.
const BG = "#101a2e", INK = "#f5efe1", GOLD = "#d6b266", STEEL = "#9fb0cc", BODY = "#e8e2d4";
const LINE = "rgba(214,178,102,.4)";
const TINT = "rgba(255,255,255,.12)";
const SERIF = "var(--font-playfair), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function SonMaiTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || GOLD;
  const card = { border: `1px solid ${LINE}`, padding: 20, display: "flex", flexDirection: "column" as const, gap: 14, color: BODY };

  return (
    <PhoneShell
      card={BG} page="#0a1120" ink={INK} font={SANS} radius={14} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3, backgroundImage: "radial-gradient(rgba(214,178,102,.25) 1px,transparent 1px),radial-gradient(rgba(214,178,102,.12) 1px,transparent 1px)", backgroundSize: "22px 22px,11px 11px", backgroundPosition: "0 0,7px 9px" }} />}
    >
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ width: 56, borderRight: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "22px 0" }}>
          <div style={{ writingMode: "vertical-rl", fontFamily: SERIF, fontSize: 15, letterSpacing: ".55em", color: accent }}>SONG HỶ LÂM MÔN</div>
        </div>
        <div style={{ flex: 1, padding: "30px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Eyebrow style={{ color: STEEL }}>Thiệp mời dự lễ thành hôn</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1.12 }}>{d.bride}</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: accent, letterSpacing: ".2em" }}>✦</div>
          <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1.12 }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 10, fontSize: 12, letterSpacing: ".22em", color: accent }}>{d.date.weekday.toUpperCase()} · {d.date.dotted}</div>}
          {d.dateSub && <div style={{ fontSize: 12, color: STEEL }}>{d.dateSub}</div>}
        </div>
      </div>

      <Slot src={d.hero} height={300} label="Ảnh cưới" tint={TINT} lazy={false} style={{ borderBottom: `1px solid ${LINE}` }} />

      <div style={{ padding: "22px 20px 46px", display: "flex", flexDirection: "column", gap: 22 }}>
        <GuestLine d={d} label={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL }} name={{ fontSize: 38, lineHeight: 1.1, color: INK, marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: LINE, border: `1px solid ${LINE}` }}
          box={{ background: BG, padding: "14px 2px", textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 26, color: accent }}
          lab={{ fontSize: 9, color: STEEL, letterSpacing: ".14em" }}
        />

        {d.pair.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={130} tint={TINT} style={{ flex: 1 }} />)}
          </div>
        )}

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL }}
          name={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.15, color: INK }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: STEEL, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <div style={card}>
            <Eyebrow style={{ color: accent }}>Hai họ</Eyebrow>
            <Families d={d} head={{ color: STEEL, marginBottom: 4 }} divider="rgba(214,178,102,.35)" wrap={{ gap: 14 }} />
          </div>
        )}

        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", color: BODY }}>
            <Eyebrow style={{ color: accent, marginBottom: 12 }}>Lịch trình</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "13px 0", borderTop: "1px solid rgba(214,178,102,.3)", borderBottom: i === d.events.length - 1 ? "1px solid rgba(214,178,102,.3)" : undefined }}>
                <span style={{ fontFamily: SERIF, color: accent, minWidth: 62 }}>{e.date || e.time || "—"}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5 }}>{[e.label, e.time && e.date ? e.time : null, e.where].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        )}

        {d.story && (
          <div style={card}>
            <Eyebrow style={{ color: accent }}>Chuyện của chúng mình</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line", margin: 0 }}>{d.story}</p>
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={card}>
            <Eyebrow style={{ color: accent }}>Địa điểm</Eyebrow>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, background: accent, color: BG, fontWeight: 600, fontSize: 12, letterSpacing: ".18em" }}>CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        <InfoGrid
          d={d}
          cell={{ border: `1px solid ${LINE}`, padding: 14, textAlign: "center" }}
          label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: STEEL }}
          value={{ fontFamily: SERIF, fontSize: 18, color: accent, marginTop: 4 }}
        />

        {d.trio.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
            {d.trio.map((src, i) => <Slot key={i} src={src} height={104} tint={TINT} />)}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={{ color: accent }}>Xác nhận</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: accent, color: BG }}
              msgStyle={{ fontSize: 13, color: "#f0dcae" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={{ color: accent }}>Lời chúc</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ borderLeft: `2px solid ${accent}`, padding: "10px 14px", color: BODY, fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}
              by={{ fontSize: 11, color: STEEL, marginTop: 4 }}
            />
          </div>
        )}

        <Gifts d={d} box={{ border: `1px solid ${LINE}`, padding: 16, color: BODY }} qrRadius={0} muted={{ color: accent }} note={{ color: STEEL }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 19, color: accent, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
