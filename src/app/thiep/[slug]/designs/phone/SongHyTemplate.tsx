import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1c · Truyền thống Việt đỏ – vàng. Hoa văn caro chéo mờ, huy hiệu tròn
// "SONG HỶ", và một thẻ kem đặt giữa nền đỏ để phần chữ nhỏ luôn đủ tương phản.
const RED = "#8e1b1b", GOLD = "#ffd77a", CREAM = "#fff8ec", SAND = "#f0c98a", DEEPRED = "#5c1414";
const LINE = "rgba(255,215,122,.45)";
const SERIF = "var(--font-playfair), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function SongHyTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || GOLD;

  return (
    <PhoneShell
      card={RED} page="#5e1010" ink={CREAM} font={SANS} radius={20} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.16, backgroundImage: "repeating-linear-gradient(45deg,#ffd77a 0 2px,transparent 2px 16px),repeating-linear-gradient(-45deg,#ffd77a 0 2px,transparent 2px 16px)" }} />}
    >
      <style>{`@keyframes wcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes wcSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}`}</style>

      <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255,215,122,.35)" }}>
        <span style={{ fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent }}>THIỆP MỜI</span>
      </div>

      <div style={{ padding: "36px 26px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 92, height: 92, borderRadius: "50%", border: `1px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "wcFloat 6s ease-in-out infinite" }}>
          <div style={{ width: 62, height: 62, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#ffe9b0,#e8a84c)", boxShadow: "0 0 30px rgba(255,215,122,.55)" }} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 17, letterSpacing: ".42em", color: accent }}>SONG HỶ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 1.1 }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 30, color: accent }}>sánh duyên cùng</div>
          <div style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 1.1 }}>{d.groom}</div>
        </div>
        {d.date.valid && <div style={{ fontSize: 13, letterSpacing: ".24em", color: SAND }}>{d.date.weekday.toUpperCase()} · {d.date.dotted}</div>}
        {d.dateSub && <div style={{ fontSize: 13, color: SAND }}>{d.dateSub}</div>}
      </div>

      <div style={{ padding: "0 22px 46px", display: "flex", flexDirection: "column", gap: 20 }}>
        <Slot src={d.hero} height={280} radius="180px 180px 12px 12px" border={`1px solid ${LINE}`} tint="rgba(255,215,122,.12)" label="Ảnh cưới" lazy={false} />

        <GuestLine d={d} label={{ fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase", color: SAND }} name={{ fontSize: 40, lineHeight: 1.1, color: CREAM, marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 2px", textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 24, color: accent }}
          lab={{ fontSize: 9, color: SAND, letterSpacing: ".12em" }}
        />

        {/* Thẻ kem: hai họ + nghi lễ + địa điểm — chữ nâu đỏ trên nền kem. */}
        <div style={{ background: CREAM, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 16, color: DEEPRED }}>
          <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 15, letterSpacing: ".3em", color: "#a12b2b" }}>LỄ THÀNH HÔN</div>

          {(d.families.groom || d.families.bride) && (
            <>
              <Families d={d} head={{ fontWeight: 600, marginBottom: 6 }} divider="#e8cfa8" wrap={{ gap: 14 }} />
              <div style={{ height: 1, background: "#e8cfa8" }} />
            </>
          )}

          {d.events.length > 0 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, lineHeight: 1.6 }}>
                {d.events.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontFamily: SERIF, color: "#a12b2b", minWidth: 78 }}>{e.label}</span>
                    <span>{[[e.date, e.time].filter(Boolean).join(" · "), e.where].filter(Boolean).join(" — ")}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: "#e8cfa8" }} />
            </>
          )}

          {(d.venue.name || d.venue.address) && (
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
          )}
          <MapBox d={d} radius={10} height={130} />
          {d.mapHref && (
            <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 8, background: RED, color: accent, fontWeight: 600, fontSize: 14, letterSpacing: ".06em" }}>CHỈ ĐƯỜNG</a>
          )}
        </div>

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: SAND }}
          name={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.15, color: CREAM }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: SAND, marginTop: 4 }}
        />

        {(d.story || d.quote) && (
          <div style={{ fontSize: 14, lineHeight: 1.75, color: CREAM, textAlign: "center", whiteSpace: "pre-line" }}>{d.story || d.quote}</div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent }}>XÁC NHẬN</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", borderRadius: 8, border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: accent, color: RED }}
              msgStyle={{ textAlign: "center", fontSize: 13, color: "#ffe9b0" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent }}>LỜI CHÚC</div>
            <WishList
              wishes={wishes}
              item={{ border: "1px solid rgba(255,215,122,.35)", borderRadius: 8, padding: "12px 14px", color: CREAM, fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
              by={{ fontSize: 11, color: SAND, marginTop: 4 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent }}>ALBUM</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={104} border={`1px solid ${LINE}`} tint="rgba(255,215,122,.18)" style={{ animation: `wcSway 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ border: "1px solid rgba(255,215,122,.4)", borderRadius: 10, padding: 14 }}
          label={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: SAND }}
          value={{ color: CREAM, fontSize: 14, marginTop: 4 }}
        />

        <Gifts d={d} box={{ border: "1px solid rgba(255,215,122,.4)", borderRadius: 12, padding: 16, color: CREAM }} muted={{ color: SAND }} note={{ color: SAND }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 22, color: accent, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
