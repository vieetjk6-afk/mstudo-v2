import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 2c · Giấy dó & mực nho. Vân giấy dọc, dải chữ dọc "THIỆP HỒNG", con dấu
// vuông "HỶ SỰ" lắc nhẹ, mọi khung đều vuông và kẻ một nét mảnh.
const BG = "#efe7d6", INK = "#23201b", RED = "#b2342c", MUTED = "#7c7263", LINE = "#c9bda4", PAPER = "#f7f2e5";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function GiayDoTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || RED;

  return (
    <PhoneShell
      card={BG} page="#ddd2ba" ink={INK} font={SANS} radius={6} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.45, backgroundImage: "repeating-linear-gradient(90deg,rgba(120,105,80,.14) 0 1px,transparent 1px 5px)" }} />}
    >
      <style>{`@keyframes wcSeal{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}`}</style>

      <div style={{ padding: "26px 22px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ writingMode: "vertical-rl", fontFamily: "var(--font-playfair), serif", fontSize: 19, letterSpacing: ".42em", color: accent, paddingTop: 4 }}>THIỆP HỒNG</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Eyebrow style={{ color: MUTED }}>Trân trọng báo tin</Eyebrow>
            <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.06 }}>{d.bride}</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 24, color: accent }}>kết duyên cùng</div>
            <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.06 }}>{d.groom}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 1, background: LINE }} />
          <div style={{ width: 52, height: 52, border: `2px solid ${accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontFamily: "var(--font-playfair), serif", fontSize: 12, lineHeight: 1.1, textAlign: "center", letterSpacing: ".08em", animation: "wcSeal 8s ease-in-out infinite" }}>HỶ<br />SỰ</div>
          <div style={{ flex: 1, height: 1, background: LINE }} />
        </div>

        <div style={{ height: 330, border: `1px solid ${LINE}`, padding: 8, background: PAPER }}>
          <Slot src={d.hero} height="100%" label="Ảnh cưới" tint="rgba(120,105,80,.08)" lazy={false} />
        </div>

        <GuestLine d={d} label={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }} name={{ fontSize: 40, lineHeight: 1.1, color: INK, marginTop: 2 }} />

        {d.date.valid && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "14px 0" }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1 }}>{d.date.day}.{d.date.month}</div>
              <div style={{ fontSize: 11, letterSpacing: ".2em", color: MUTED }}>{d.date.weekday.toUpperCase()} · {d.date.year}</div>
            </div>
            {(d.lunar || d.reception) && (
              <div style={{ textAlign: "right", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>{[d.lunar, d.reception].filter(Boolean).join("\n")}</div>
            )}
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "flex", justifyContent: "space-between" }}
          box={{ textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 32 }}
          lab={{ fontSize: 9, letterSpacing: ".2em", color: MUTED }}
        />

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.pair.length, 2)},1fr)`, gap: 8 }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={130} border={`1px solid ${LINE}`} tint={PAPER} />)}
          </div>
        )}

        {(d.quote || d.story) && (
          <div style={{ fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.75, textAlign: "center", color: "#3c372e", whiteSpace: "pre-line" }}>
            {d.quote ? `“${d.quote}”` : d.story}
          </div>
        )}

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}
          name={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.15 }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: MUTED, marginTop: 4 }}
        />

        <Families d={d} head={{ fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }} divider={LINE} />

        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow style={{ color: MUTED }}>Chương trình</Eyebrow>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <span style={{ fontFamily: SERIF, fontSize: 21, color: accent, minWidth: 62 }}>{e.time || e.date || "—"}</span>
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
            <MapBox d={d} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, background: accent, color: PAPER, fontSize: 11, letterSpacing: ".24em" }}>XEM CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        <InfoGrid
          d={d}
          cell={{ border: `1px dashed ${accent}`, padding: 14, textAlign: "center" }}
          label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: MUTED }}
          value={{ fontFamily: SERIF, fontSize: 19, marginTop: 4 }}
        />

        {d.trio.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
            {d.trio.map((src, i) => <Slot key={i} src={src} height={96} border={`1px solid ${LINE}`} tint={PAPER} />)}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow style={{ color: MUTED }}>Xác nhận tham dự</Eyebrow>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${INK}`, background: "transparent", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: INK, color: BG }}
              msgStyle={{ fontSize: 13, color: accent }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow style={{ color: MUTED }}>Sổ lưu bút</Eyebrow>
            <WishList
              wishes={wishes}
              item={{ borderBottom: "1px solid #d8ceb8", padding: "10px 2px", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 14, lineHeight: 1.6 }}
              by={{ fontStyle: "normal", fontSize: 11, color: MUTED }}
            />
          </div>
        )}

        <Gifts d={d} box={{ border: `1px solid ${LINE}`, padding: 16, background: PAPER }} qrRadius={0} muted={{ color: MUTED }} note={{ color: MUTED, fontStyle: "italic" }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: accent, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
