import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Eyebrow, Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1b · Aurora mộng mơ — blob pastel trôi phía sau, ảnh khung vòm, mọi khối là
// thẻ kính mờ (backdrop-filter) bo tròn lớn trên nền gradient sáng.
const DEEP = "#33305a", SOFT = "#7a6fa8", SLATE = "#6a5f96";
const GLASS = { background: "rgba(255,255,255,.66)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.9)" };
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function AuroraTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#b98fd0";
  const lab = { fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase" as const, color: SOFT };

  return (
    <PhoneShell
      card="linear-gradient(170deg,#fef6ff,#eef1ff 45%,#e7fbff)" page="#e3e0f2" ink="#2b2740" font={SANS} radius={40} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 340, height: 340, left: -80, top: -60, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,175,215,.75),transparent 68%)", filter: "blur(38px)", animation: "wcAur 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 320, height: 320, right: -110, top: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(160,205,255,.8),transparent 68%)", filter: "blur(42px)", animation: "wcAur 24s ease-in-out infinite reverse" }} />
          <div style={{ position: "absolute", width: 300, height: 300, left: -60, bottom: 60, borderRadius: "50%", background: "radial-gradient(circle,rgba(190,235,215,.8),transparent 68%)", filter: "blur(42px)", animation: "wcAur 18s ease-in-out infinite" }} />
        </div>
      }
    >
      <style>{`
        @keyframes wcAur{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.15)}66%{transform:translate(-30px,25px) scale(.9)}}
        @keyframes wcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
      `}</style>

      <div style={{ padding: "44px 26px 48px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, color: SOFT }}>the wedding of</div>

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 54, lineHeight: 1.02, color: DEEP }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 30, color: accent, animation: "wcFloat 5s ease-in-out infinite" }}>and</div>
          <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 54, lineHeight: 1.02, color: DEEP }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 14, ...lab }}>{d.date.spaced}</div>}
          {d.dateSub && <div style={{ fontSize: 12.5, color: SLATE }}>{d.dateSub}</div>}
        </div>

        <Slot src={d.hero} height={330} radius="200px 200px 24px 24px" border="1px solid rgba(255,255,255,.9)" tint="rgba(255,255,255,.5)" label="Ảnh bìa" lazy={false} style={{ boxShadow: "0 20px 40px -20px rgba(90,80,160,.5)" }} />

        <GuestLine d={d} label={{ ...lab, textAlign: "center" }} name={{ fontSize: 42, lineHeight: 1.1, color: DEEP, marginTop: 2 }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "flex", justifyContent: "center", gap: 10 }}
          box={{ ...GLASS, backdropFilter: "blur(10px)", borderRadius: 20, padding: "14px 0", width: 74, textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 30, color: DEEP }}
          lab={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: SOFT }}
        />

        {(d.story || d.quote) && (
          <div style={{ ...GLASS, borderRadius: 28, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: DEEP }}>Chuyện của tụi mình</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-line" }}>{d.story || d.quote}</p>
          </div>
        )}

        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...lab, textAlign: "center" }}>Lịch trình</div>
            <div style={{ ...GLASS, borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {d.events.map((e, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: 1, background: "rgba(120,110,170,.18)", margin: "0 0 14px" }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 19, color: DEEP }}>{e.label}</span>
                    <span style={{ fontSize: 13, color: SLATE, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
                  </div>
                  {e.where && <div style={{ fontSize: 13, color: SLATE, marginTop: 4 }}>{e.where}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <Portraits
          d={d}
          ring={accent}
          role={{ fontSize: 10, letterSpacing: ".26em", textTransform: "uppercase", color: SOFT }}
          name={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.15, color: DEEP }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: SLATE, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <div style={{ ...GLASS, borderRadius: 24, padding: 20 }}>
            <Families d={d} head={{ ...lab, fontSize: 10, marginBottom: 6 }} divider="rgba(120,110,170,.18)" />
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ ...GLASS, borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <Eyebrow style={{ ...lab, fontSize: 11, letterSpacing: ".26em" }}>Địa điểm</Eyebrow>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} radius={18} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 99, background: "linear-gradient(100deg,#f3c1e5,#c4c8ff,#b9eaf2)", color: "#34305a", fontWeight: 600, fontSize: 14 }}>Mở chỉ đường</a>
            )}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...lab, textAlign: "center" }}>Xác nhận tham dự</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Mình đến", "Chưa chắc", "Không thể"]}
              btn={{ flex: 1, padding: "13px 4px", borderRadius: 99, border: "1px solid rgba(120,110,170,.3)", background: "rgba(255,255,255,.8)", color: DEEP, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: DEEP, color: "#fff", borderColor: DEEP }}
              msgStyle={{ textAlign: "center", fontSize: 13, color: "#8a5fae" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...lab, textAlign: "center" }}>Sổ lưu bút</div>
            <WishList
              wishes={wishes}
              item={{ background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.9)", borderRadius: 18, padding: "12px 16px", fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
              by={{ fontSize: 11, color: SOFT, marginTop: 4 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <div style={{ ...lab, textAlign: "center" }}>Khoảnh khắc của tụi mình</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => (
                <Slot key={i} src={src} height={108} radius="60px 60px 14px 14px" border="1px solid rgba(255,255,255,.9)" tint="rgba(255,255,255,.5)" style={{ animation: `wcFloat 7s ease-in-out infinite ${i * 0.9}s` }} />
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ ...GLASS, borderRadius: 20, padding: 16, fontSize: 13, lineHeight: 1.6 }}
          label={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: SOFT }}
          value={{ fontFamily: SERIF, fontSize: 19, color: DEEP }}
        />

        <Gifts d={d} box={{ ...GLASS, borderRadius: 24, padding: 16 }} qrRadius={14} muted={{ color: SLATE }} note={{ color: SLATE }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: SOFT, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
