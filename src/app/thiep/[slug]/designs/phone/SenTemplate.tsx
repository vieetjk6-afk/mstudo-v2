import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 2a · Sen & kem — áo dài tối giản. Ảnh bìa full-bleed trên cùng, tên đặt dưới
// ảnh, hai ảnh bo vòm ngược chiều nhau, giọng chữ Cormorant + Dancing Script.
const BG = "#faf6ef", INK = "#3a3129", SOFT = "#f2ece2", LINE = "#e3d9cc", MUTED = "#9a7d6a", BODY = "#4a4038";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function SenTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#c98a93";
  const eyebrow = { color: MUTED, letterSpacing: ".32em" as const };

  return (
    <PhoneShell card={BG} page="#ece7dd" ink={INK} font={SANS} radius={18} accent={accent}>
      <>
        <Slot src={d.hero} height={330} label="Ảnh bìa" lazy={false} tint={SOFT} />

        <div style={{ textAlign: "center", padding: "24px 24px 6px" }}>
          <Eyebrow style={{ ...eyebrow, letterSpacing: ".42em" }}>Lễ thành hôn</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1.08, marginTop: 8 }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 26, color: accent }}>&amp;</div>
          <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1.08 }}>{d.groom}</div>
        </div>

        <div style={{ padding: "0 24px 46px", display: "flex", flexDirection: "column", gap: 24, color: BODY }}>
          {d.date.valid && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ width: 44, height: 1, background: "#d8c9bb" }} />
              <span style={{ fontSize: 12, letterSpacing: ".3em", color: MUTED }}>{d.date.spaced}</span>
              <span style={{ width: 44, height: 1, background: "#d8c9bb" }} />
            </div>
          )}

          {d.dateSub && <div style={{ textAlign: "center", fontSize: 12.5, color: MUTED, marginTop: -14 }}>{d.dateSub}</div>}

          <GuestLine d={d} label={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }} name={{ fontSize: 40, lineHeight: 1.1, color: INK, marginTop: 2 }} />

          <PhoneCountdown
            date={d.countdownTo}
            labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
            wrap={{ display: "flex", justifyContent: "center", gap: 22, background: SOFT, borderRadius: 14, padding: "16px 8px" }}
            box={{ textAlign: "center" }}
            num={{ fontFamily: SERIF, fontSize: 30, color: INK }}
            lab={{ fontSize: 9, letterSpacing: ".18em", color: MUTED }}
          />

          <Families d={d} head={{ fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }} divider="#e3d9cc" />

          {d.pair.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: d.pair.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
              <Slot src={d.pair[0]} height={150} radius="120px 120px 8px 8px" tint={SOFT} />
              {d.pair[1] && <Slot src={d.pair[1]} height={150} radius="8px 8px 120px 120px" tint={SOFT} />}
            </div>
          )}

          <Portraits
            d={d}
            ring={accent}
            role={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}
            name={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.15, color: INK }}
            sub={{ fontSize: 12.5, lineHeight: 1.55, color: MUTED, marginTop: 4 }}
          />

          {(d.quote || d.story) && (
            <div style={{ textAlign: "center", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.7, color: "#5a4d42", whiteSpace: "pre-line" }}>
              {d.quote ? `“${d.quote}”` : d.story}
            </div>
          )}

          {d.events.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Eyebrow style={{ ...eyebrow, textAlign: "center" }}>Chương trình</Eyebrow>
              {d.events.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                  <span style={{ fontFamily: SERIF, fontSize: 21, color: accent, minWidth: 64 }}>{e.time || e.date || "—"}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6 }}>{[e.label, e.where].filter(Boolean).join(" — ")}</span>
                </div>
              ))}
            </div>
          )}

          {(d.venue.name || d.venue.address || d.mapHref) && (
            <div style={{ background: SOFT, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <Eyebrow style={eyebrow}>Địa điểm &amp; di chuyển</Eyebrow>
              <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                {d.venue.name && <strong>{d.venue.name}</strong>}
                {d.venue.name && d.venue.address && <br />}
                {d.venue.address}
              </div>
              <MapBox d={d} radius={10} />
              {d.mapHref && (
                <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 10, background: INK, color: BG, fontSize: 11, letterSpacing: ".24em" }}>
                  MỞ CHỈ ĐƯỜNG
                </a>
              )}
            </div>
          )}

          <InfoGrid
            d={d}
            cell={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, textAlign: "center" }}
            label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: MUTED }}
            value={{ fontFamily: SERIF, fontSize: 20, color: INK, marginTop: 4 }}
          />

          {d.trio.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => <Slot key={i} src={src} height={104} radius={8} tint={SOFT} />)}
            </div>
          )}

          {d.rsvpOn && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Eyebrow style={{ ...eyebrow, textAlign: "center" }}>Xác nhận tham dự</Eyebrow>
              <QuickRsvp
                slug={d.slug}
                note={d.c.rsvp_note}
                btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, borderRadius: 10, background: "transparent", color: "#a8626d", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                btnOn={{ background: accent, color: "#fff" }}
                msgStyle={{ textAlign: "center", fontSize: 13, color: "#a8626d" }}
                formWrap={{ marginTop: 4 }}
              />
            </div>
          )}

          {d.wishesOn && wishes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Eyebrow style={{ ...eyebrow, textAlign: "center" }}>Sổ lưu bút</Eyebrow>
              <WishList
                wishes={wishes}
                item={{ background: SOFT, borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}
                by={{ fontSize: 11, color: MUTED, marginTop: 4 }}
              />
            </div>
          )}

          <Gifts d={d} box={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }} muted={{ color: MUTED }} note={{ color: MUTED, fontStyle: "italic" }} />

          {(d.thanks || d.closing) && (
            <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 22, color: accent, whiteSpace: "pre-line" }}>
              {d.closing || d.thanks}
            </div>
          )}
        </div>

        {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
      </>
    </PhoneShell>
  );
}
