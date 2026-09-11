import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// NEON TICKET — cả tấm thiệp LÀ một chiếc vé
//
// Nét riêng so với 9 mẫu còn lại:
//   · HAI MÉP ĐỤC LỖ chạy suốt chiều cao, đúng kiểu vé xé khỏi cuống
//   · một ĐƯỜNG XÉ ngang có hai khuyết tròn chia thiệp thành thân vé và CUỐNG
//   · cuống vé ở cuối chứa QR mừng cưới + MÃ VẠCH vẽ bằng CSS + số vé
//   · lịch trình gọi là SETLIST, đánh số 01–0n kiểu danh sách bài hát
//   · ba ô DATE / DOORS / SHOW nằm ngay dưới tên như thông tin suất diễn
// ════════════════════════════════════════════════════════════════════════════

const BG = "#07080f", PAGE = "#03040a", CYAN = "#00ffd5", PINK = "#ff2d95", TEXT = "#d6f7f2", MUTED = "#b39ac4";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

/** Mã vạch vẽ bằng CSS — độ rộng vạch suy ra từ slug nên mỗi thiệp một kiểu. */
function Barcode({ seed }: { seed: string }) {
  const bars = Array.from({ length: 44 }, (_, i) => ((seed.charCodeAt(i % Math.max(seed.length, 1)) || 65) + i * 7) % 4);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }} aria-hidden>
      {bars.map((b, i) => (
        <span key={i} style={{ width: b === 0 ? 1 : b, height: "100%", background: b % 2 ? CYAN : "rgba(0,255,213,.45)" }} />
      ))}
    </div>
  );
}

export default function NeonTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || CYAN;
  const lab = { fontSize: 10, letterSpacing: ".26em", textTransform: "uppercase" as const, color: accent };
  const ticketNo = (d.slug || "wedding").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase().padEnd(6, "0");

  // Đường xé ngang: nét đứt + hai khuyết tròn màu nền trang ở hai đầu.
  const TearLine = () => (
    <div style={{ position: "relative", height: 0, borderTop: `2px dashed rgba(0,255,213,.5)`, margin: "10px 0 30px" }}>
      <span style={{ position: "absolute", left: -22, top: -11, width: 22, height: 22, borderRadius: "50%", background: PAGE }} />
      <span style={{ position: "absolute", right: -22, top: -11, width: 22, height: 22, borderRadius: "50%", background: PAGE }} />
    </div>
  );

  return (
    <PhoneShell
      card={BG} page={PAGE} ink={TEXT} font={SANS} radius={16} accent={accent}
      pattern={
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(0,255,213,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,213,.06) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <div style={{ position: "absolute", left: 0, right: 0, height: 60, background: "linear-gradient(rgba(0,255,213,.14),transparent)", animation: "nnScan 7s linear infinite", pointerEvents: "none" }} />
          {/* Hai mép đục lỗ */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 12, pointerEvents: "none", zIndex: 3, backgroundImage: `radial-gradient(circle 5px at 0px 10px, ${PAGE} 98%, transparent 100%)`, backgroundSize: "12px 20px", backgroundRepeat: "repeat-y" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 12, pointerEvents: "none", zIndex: 3, backgroundImage: `radial-gradient(circle 5px at 12px 10px, ${PAGE} 98%, transparent 100%)`, backgroundSize: "12px 20px", backgroundRepeat: "repeat-y" }} />
        </>
      }
    >
      <style>{`
        @keyframes nnScan{from{transform:translateY(-100%)}to{transform:translateY(1500%)}}
        @keyframes nnFlicker{0%,100%{opacity:1}47%{opacity:1}49%{opacity:.35}51%{opacity:1}93%{opacity:.5}}
      `}</style>

      <div style={{ padding: "22px 22px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...lab, letterSpacing: ".22em", display: "flex", justifyContent: "space-between" }}>
          <span>Admit one</span>
          <span style={{ color: PINK }}>NO. {ticketNo}</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: ".3em", color: PINK }}>THE WEDDING {d.date.year || "TOUR"}</div>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: "#fff", textShadow: "0 0 18px rgba(0,255,213,.7)", animation: "nnFlicker 6s infinite", marginTop: 6 }}>{d.bride}</div>
          <div style={{ fontSize: 20, color: PINK, textShadow: "0 0 14px rgba(255,45,149,.8)" }}>✦ FEAT ✦</div>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: "#fff", textShadow: "0 0 18px rgba(0,255,213,.7)", animation: "nnFlicker 6s infinite 1.5s" }}>{d.groom}</div>
        </div>

        {/* Ba ô thông tin suất diễn */}
        <div style={{ border: `1px solid ${accent}`, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center", background: "rgba(0,255,213,.04)" }}>
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
        {d.dateSub && <div style={{ textAlign: "center", fontSize: 12, color: MUTED, letterSpacing: ".08em" }}>{d.dateSub}</div>}

        {d.guest && (
          <div style={{ textAlign: "center", border: "1px dashed rgba(255,45,149,.55)", borderRadius: 8, padding: "12px 10px" }}>
            <div style={{ ...lab, color: PINK }}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 38, lineHeight: 1.1, color: "#fff" }}>{d.guest}</div>
          </div>
        )}

        <Slot src={d.hero} height={240} radius={10} border="1px solid rgba(0,255,213,.45)" tint="rgba(0,255,213,.08)" label="Ảnh bìa" lazy={false} fx="kb" />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["DAYS", "HRS", "MIN", "SEC"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ border: `1px solid ${PINK}`, borderRadius: 8, padding: "12px 2px", textAlign: "center", background: "rgba(255,45,149,.07)" }}
          num={{ fontWeight: 700, fontSize: 24, color: PINK }}
          lab={{ fontSize: 9, color: MUTED, letterSpacing: ".12em" }}
        />

        {/* SETLIST đánh số */}
        {d.events.length > 0 && (
          <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, color: TEXT }}>
            <div style={lab}>Setlist</div>
            {d.events.map((e, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                  <span><span style={{ color: PINK, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span> · {e.label}</span>
                  <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
                </div>
                {e.where && <div style={{ fontSize: 12, color: MUTED, marginTop: 3, paddingLeft: 24 }}>{e.where}</div>}
              </div>
            ))}
          </div>
        )}

        {(d.story || d.quote) && (
          <Reveal anim="clip">
            <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={lab}>Backstage</div>
              {d.quote && <div style={{ fontSize: 15, lineHeight: 1.7, color: "#fff", fontStyle: "italic" }}>“{d.quote}”</div>}
              {d.story && <div style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-line" }}>{d.story}</div>}
            </div>
          </Reveal>
        )}

        {/* Chân dung kiểu "line-up": ảnh vuông + tên in đậm */}
        {d.portraits.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {d.portraits.map((p) => (
              <div key={p.role + p.name} style={{ border: "1px solid rgba(255,45,149,.5)", borderRadius: 8, padding: 10 }}>
                <Slot src={p.photo} height={104} radius={4} tint="rgba(255,45,149,.1)" label={p.role} />
                <div style={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: PINK, marginTop: 8 }}>{p.role}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginTop: 3 }}>{p.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {d.hasFamilies && (
          <div style={{ border: "1px solid rgba(0,255,213,.45)", borderRadius: 10, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, lineHeight: 1.7 }}>
            <div><div style={lab}>Nhà trai</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
            <div><div style={lab}>Nhà gái</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ border: "1px solid rgba(255,45,149,.5)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, color: "#f7d6ea" }}>
            <div style={{ ...lab, color: PINK }}>Venue</div>
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

        {d.trio.length > 0 && (
          <div className="wed-swipe" style={{ gap: 8, marginLeft: -22, marginRight: -22, padding: "0 22px" }}>
            {d.trio.map((src, i) => (
              <Slot key={i} src={src} height={132} width={132} radius={8} border="1px solid rgba(0,255,213,.45)" tint="rgba(0,255,213,.12)" fx="zoom" />
            ))}
          </div>
        )}

        {d.infos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {d.infos.map((i) => (
              <div key={i.label} style={{ border: "1px solid rgba(255,45,149,.5)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: PINK }}>{i.label}</div>
                {i.value && <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 18, height: 18, borderRadius: "50%", background: s, border: "1px solid rgba(255,255,255,.4)" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Check-in</div>
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
            <div style={lab}>Fan messages</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${PINK}`, padding: "10px 14px", color: TEXT, fontSize: 13, lineHeight: 1.6, background: "rgba(255,45,149,.06)" }}>
                {w.wish}
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ ĐƯỜNG XÉ — dưới đây là CUỐNG VÉ ══════════════════════════ */}
        <TearLine />

        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: "rgba(0,255,213,.05)", border: "1px dashed rgba(0,255,213,.4)", borderRadius: 10, padding: 18 }}>
          <div style={{ ...lab, display: "flex", justifyContent: "space-between" }}>
            <span>Stub · giữ lại nhé</span>
            <span style={{ color: PINK }}>{ticketNo}</span>
          </div>
          {d.gifts.length > 0 && (
            <>
              {d.giftNote && <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{d.giftNote}</p>}
              {d.gifts.map((g) => (
                <div key={g.title} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", borderRadius: 4, background: "#fff", objectFit: "contain" }} />
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: TEXT }}>
                    MỪNG CƯỚI / TIP JAR
                    <div style={{ color: accent }}>{g.bank.name} · {g.bank.account?.replace(/\s/g, "")}</div>
                    <div style={{ color: accent }}>{g.bank.holder || g.fallbackName}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {(d.thanks || d.thanksPhoto) && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", borderTop: "1px dashed rgba(0,255,213,.35)", paddingTop: 14 }}>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={72} width={72} radius={4} tint="rgba(0,255,213,.12)" label="" style={{ flex: "none" }} />}
              <div>
                <div style={{ ...lab, color: PINK }}>Lời cảm ơn</div>
                {d.thanks && <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.7, color: TEXT, whiteSpace: "pre-line" }}>{d.thanks}</p>}
              </div>
            </div>
          )}
          <Barcode seed={d.slug || "wedding"} />
          <footer style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{d.bride} &amp; {d.groom}</div>
            <div style={{ fontSize: 10, letterSpacing: ".3em", color: MUTED, whiteSpace: "pre-line", marginTop: 6 }}>
              {d.closing || "ONE NIGHT ONLY · SEE YOU THERE"}
            </div>
            <div style={{ fontSize: 9, letterSpacing: ".3em", color: MUTED, marginTop: 8 }}>THIỆP CƯỚI ONLINE</div>
          </footer>
        </div>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
