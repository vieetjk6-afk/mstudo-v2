import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Families, Gifts, GuestLine, InfoGrid, MapBox, PhoneCountdown, PhoneShell, Portraits, QuickRsvp, Slot, WishList, phoneData } from "./kit";

// 1g · Scrapbook polaroid — ảnh dán lệch có băng dính, giấy note vàng, chữ
// viết tay Caveat, lời chúc dán như sticky note.
const BG = "#e9e3d6", INK = "#3a3227", BROWN = "#7a6a4e", PAPER = "#fffdf6", NOTE = "#fdf6d8", DASH = "#b6a98c";
const HAND = "var(--font-caveat), cursive";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const SHADOW = "0 8px 18px -10px rgba(70,60,40,.6)";

export default function ScrapbookTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#a8734f";
  const paperCard = (rot: number) => ({ background: PAPER, padding: 20, boxShadow: SHADOW, transform: `rotate(${rot}deg)`, display: "flex", flexDirection: "column" as const, gap: 12 });
  const title = { fontFamily: HAND, fontSize: 26, color: INK };

  return (
    <PhoneShell
      card={BG} page="#d8d0bd" ink={INK} font={SANS} radius={10} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "radial-gradient(rgba(120,105,80,.18) 1px,transparent 1px)", backgroundSize: "6px 6px" }} />}
    >
      <style>{`
        @keyframes wcTape{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes wcSway{0%,100%{transform:rotate(-2.4deg)}50%{transform:rotate(1.6deg)}}
      `}</style>

      <div style={{ padding: "28px 20px 52px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontFamily: HAND, fontSize: 22, color: BROWN }}>our little wedding book</div>

        {/* Polaroid lớn: ảnh bìa + tên cô dâu chú rể viết tay dưới đáy khung. */}
        <div style={{ background: PAPER, padding: "14px 14px 52px", boxShadow: "0 10px 24px -12px rgba(70,60,40,.6)", transform: "rotate(-2.2deg)", position: "relative" }}>
          <div style={{ position: "absolute", top: -12, left: "50%", width: 96, height: 26, marginLeft: -48, background: "rgba(215,200,150,.75)", transform: "rotate(-2deg)", animation: "wcTape 7s ease-in-out infinite" }} />
          <Slot src={d.hero} height={250} label="Ảnh polaroid" tint="rgba(120,105,80,.1)" lazy={false} />
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontFamily: HAND, fontSize: 26, color: INK }}>{d.bride} &amp; {d.groom}</div>
        </div>

        {d.pair.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            {d.pair.map((src, i) => (
              <div key={i} style={{ flex: 1, background: PAPER, padding: "10px 10px 34px", boxShadow: SHADOW, transform: `rotate(${i === 0 ? 2.6 : -3}deg)` }}>
                <Slot src={src} height={110} tint="rgba(120,105,80,.1)" />
              </div>
            ))}
          </div>
        )}

        <div style={{ background: NOTE, padding: 20, boxShadow: "0 8px 18px -10px rgba(70,60,40,.5)", transform: "rotate(1.2deg)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: HAND, fontSize: 30, color: INK }}>Tụi mình cưới nhau!</div>
          <div style={{ fontSize: 14, lineHeight: 1.65 }}>
            {d.date.valid && <><strong>{d.date.weekday}, {d.date.dotted}</strong>{d.reception ? ` — ${d.reception}` : ""}<br /></>}
            {d.lunar && <>{d.lunar}<br /></>}
            {d.quote || "Rất mong có bạn đến chung vui, chụp hình và ăn thật no 🙂"}
          </div>
        </div>

        <GuestLine d={d} label={{ fontFamily: HAND, fontSize: 18, color: BROWN, textAlign: "center" }} name={{ fontSize: 40, lineHeight: 1.1, color: INK }} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "flex", justifyContent: "center", gap: 10 }}
          box={{ background: PAPER, border: `1px dashed ${DASH}`, padding: "12px 0", width: 76, textAlign: "center" }}
          boxes={[{ transform: "rotate(-1.5deg)" }, { transform: "rotate(1.5deg)" }, { transform: "rotate(-2deg)" }, { transform: "rotate(2deg)" }]}
          num={{ fontFamily: HAND, fontSize: 30, color: INK }}
          lab={{ fontSize: 10, color: BROWN }}
        />

        {d.events.length > 0 && (
          <div style={paperCard(-1)}>
            <div style={title}>Lịch trình ngày vui</div>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ fontFamily: HAND, fontSize: 20, color: accent, minWidth: 64 }}>{e.time || e.date || "—"}</span>
                <span>{[e.label, e.where].filter(Boolean).join(" — ")}</span>
              </div>
            ))}
          </div>
        )}

        <Portraits
          d={d}
          ring={DASH}
          role={{ fontFamily: HAND, fontSize: 18, color: accent }}
          name={{ fontFamily: HAND, fontSize: 24, color: INK }}
          sub={{ fontSize: 12.5, lineHeight: 1.55, color: BROWN, marginTop: 4 }}
        />

        {(d.families.groom || d.families.bride) && (
          <div style={paperCard(1.4)}>
            <div style={title}>Hai bên gia đình</div>
            <Families d={d} head={{ fontFamily: HAND, fontSize: 20, color: accent, marginBottom: 4 }} divider={DASH} />
          </div>
        )}

        {d.story && (
          <div style={paperCard(-1.6)}>
            <div style={title}>Chuyện của tụi mình</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>{d.story}</div>
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={paperCard(1.6)}>
            <div style={title}>Tới đây nhé</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} height={130} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 12, background: INK, color: NOTE, fontFamily: HAND, fontSize: 20 }}>Mở bản đồ</a>
            )}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...title, textAlign: "center" }}>Bạn đi được không?</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Đi chứ!", "Để xem", "Tiếc quá"]}
              btn={{ flex: 1, padding: "12px 4px", border: `1px dashed ${BROWN}`, background: PAPER, color: INK, fontFamily: HAND, fontSize: 19, cursor: "pointer" }}
              btnOn={{ background: NOTE, borderStyle: "solid" }}
              msgStyle={{ textAlign: "center", fontFamily: HAND, fontSize: 20, color: accent }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...title, textAlign: "center" }}>Lời chúc dán lên đây</div>
            <WishList
              wishes={wishes}
              item={{ background: NOTE, padding: 14, boxShadow: "0 6px 14px -8px rgba(70,60,40,.6)", fontFamily: HAND, fontSize: 20, lineHeight: 1.4, color: INK, marginBottom: 10, transform: "rotate(-1deg)" }}
              by={{ fontSize: 15, color: BROWN, marginTop: 2 }}
            />
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <div style={{ ...title, textAlign: "center" }}>Vài tấm nữa nè</div>
            <div style={{ display: "flex", gap: 10 }}>
              {d.trio.map((src, i) => (
                <div key={i} style={{ flex: 1, background: PAPER, padding: "8px 8px 26px", boxShadow: SHADOW, animation: `wcSway 9s ease-in-out infinite ${i}s` }}>
                  <Slot src={src} height={94} tint="rgba(120,105,80,.1)" />
                </div>
              ))}
            </div>
          </>
        )}

        <InfoGrid
          d={d}
          cell={{ background: NOTE, padding: 14, boxShadow: SHADOW, fontSize: 14, lineHeight: 1.6 }}
          label={{ fontFamily: HAND, fontSize: 20, color: accent, letterSpacing: "normal", textTransform: "none" }}
          value={{}}
        />

        <Gifts d={d} box={{ background: PAPER, padding: 16, boxShadow: SHADOW, transform: "rotate(-1.4deg)" }} qrRadius={0} muted={{ color: BROWN }} note={{ fontFamily: HAND, fontSize: 20, color: BROWN }} />

        {(d.closing || d.thanks) && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 24, color: BROWN, whiteSpace: "pre-line" }}>{d.closing || d.thanks}</div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
