import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// AURORA — bố cục "trục thời gian zig-zag"
//
// Nét riêng so với 9 mẫu còn lại:
//   · một TRỤC DỌC chạy GIỮA trang, các mốc lễ nằm so le trái–phải hai bên trục
//   · ảnh album là HUY HIỆU TRÒN gắn thẳng lên trục, xen giữa các mốc
//   · chân dung là hai vòng tròn CHỒNG MÉP lên nhau, không phải hai ô rời
//   · dặn dò là các chip bo tròn xếp tràn dòng, không phải lưới ô vuông
//   · ảnh bìa khung vòm, tên chữ Cormorant mảnh — mở đầu nhẹ, không ảnh tràn
// ════════════════════════════════════════════════════════════════════════════

const DEEP = "#33305a", SOFT = "#7a6fa8", SLATE = "#6a5f96";
const GLASS = { background: "rgba(255,255,255,.66)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.9)" };
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function AuroraTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#b98fd0";
  const lab = { fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase" as const, color: SOFT };

  // Trục: mốc lễ so le hai bên, cứ sau mỗi mốc chèn một ảnh tròn (nếu còn ảnh).
  const medallions = d.trio.length ? d.trio : d.pair;

  return (
    <PhoneShell
      card="linear-gradient(170deg,#fef6ff,#eef1ff 45%,#e7fbff)" page="#e3e0f2" ink="#2b2740" font={SANS} radius={40} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 340, height: 340, left: -80, top: -60, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,175,215,.75),transparent 68%)", filter: "blur(38px)", animation: "auBlob 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 320, height: 320, right: -110, top: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(160,205,255,.8),transparent 68%)", filter: "blur(42px)", animation: "auBlob 24s ease-in-out infinite reverse" }} />
          <div style={{ position: "absolute", width: 300, height: 300, left: -60, bottom: 60, borderRadius: "50%", background: "radial-gradient(circle,rgba(190,235,215,.8),transparent 68%)", filter: "blur(42px)", animation: "auBlob 18s ease-in-out infinite" }} />
        </div>
      }
    >
      <style>{`
        @keyframes auBlob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.15)}66%{transform:translate(-30px,25px) scale(.9)}}
        @keyframes auFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>

      <div style={{ padding: "44px 26px 30px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, color: SOFT }}>the wedding of</div>

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="wed-ink" style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 54, lineHeight: 1.02, color: DEEP }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 30, color: accent, animation: "auFloat 5s ease-in-out infinite" }}>and</div>
          <div className="wed-ink-2" style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 54, lineHeight: 1.02, color: DEEP }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 14, ...lab }}>{d.date.spaced}</div>}
          {d.dateSub && <div style={{ fontSize: 12.5, color: SLATE }}>{d.dateSub}</div>}
          {d.reception && <div style={{ fontSize: 12.5, color: SLATE }}>{d.reception}</div>}
        </div>

        <Slot src={d.hero} height={330} radius="200px 200px 24px 24px" border="1px solid rgba(255,255,255,.9)" tint="rgba(255,255,255,.5)" label="Ảnh bìa" lazy={false} fx="kb" style={{ boxShadow: "0 20px 40px -20px rgba(90,80,160,.5)" }} />

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={lab}>{d.guestLabel}</div>
            <div style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1.12, color: DEEP }}>{d.guest}</div>
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "flex", justifyContent: "center", gap: 10 }}
          box={{ ...GLASS, backdropFilter: "blur(10px)", borderRadius: 20, padding: "14px 0", width: 74, textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 30, color: DEEP }}
          lab={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: SOFT }}
        />

        {d.quote && (
          <Reveal anim="blur">
            <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 19, lineHeight: 1.8, color: SLATE }}>“{d.quote}”</div>
          </Reveal>
        )}

        {d.story && (
          <Reveal anim="up">
            <div style={{ ...GLASS, borderRadius: 28, padding: 24 }}>
              <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: DEEP, marginBottom: 10 }}>Chuyện của tụi mình</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line" }}>{d.story}</p>
            </div>
          </Reveal>
        )}
      </div>

      {/* ── TRỤC THỜI GIAN ZIG-ZAG ──────────────────────────────────────── */}
      {d.events.length > 0 && (
        <div style={{ position: "relative", padding: "10px 20px 34px" }}>
          <div style={{ ...lab, textAlign: "center", marginBottom: 22 }}>Ngày vui diễn ra</div>
          <span style={{ position: "absolute", left: "50%", top: 60, bottom: 34, width: 1, background: "rgba(120,110,170,.28)" }} />
          {d.events.map((e, i) => {
            const right = i % 2 === 1;
            const medal = medallions[i];
            return (
              <div key={i}>
                <div style={{ position: "relative", display: "flex", justifyContent: right ? "flex-end" : "flex-start", marginBottom: 14 }}>
                  <span style={{ position: "absolute", left: "50%", top: 22, width: 11, height: 11, marginLeft: -5.5, borderRadius: "50%", background: "#fff", border: `2px solid ${accent}` }} />
                  <div style={{ ...GLASS, borderRadius: 20, padding: "14px 16px", width: "46%" }}>
                    <div style={{ fontFamily: SERIF, fontSize: 19, color: DEEP, lineHeight: 1.2 }}>{e.label}</div>
                    <div style={{ fontSize: 12.5, color: SLATE, marginTop: 4 }}>{[e.date, e.time].filter(Boolean).join(" · ")}</div>
                    {e.where && <div style={{ fontSize: 12, color: SLATE, marginTop: 4, lineHeight: 1.5 }}>{e.where}</div>}
                  </div>
                </div>
                {medal && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                    <Slot src={medal} height={92} width={92} radius="50%" tint="rgba(255,255,255,.5)" label="" style={{ border: "3px solid rgba(255,255,255,.95)", boxShadow: "0 10px 24px -14px rgba(90,80,160,.7)" }} fx="zoom" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "0 26px 48px", display: "flex", flexDirection: "column", gap: 26 }}>
        {/* Chân dung: hai vòng tròn CHỒNG MÉP */}
        {d.portraits.length > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              {d.portraits.map((p, i) => (
                <Slot
                  key={p.role + p.name}
                  src={p.photo} height={116} width={116} radius="50%" tint="rgba(255,255,255,.6)" label=""
                  style={{ border: "3px solid #fff", marginLeft: i ? -22 : 0, boxShadow: "0 12px 26px -16px rgba(90,80,160,.8)" }}
                />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {d.portraits.map((p) => (
                <div key={p.role + p.name}>
                  <div style={{ ...lab, fontSize: 10 }}>{p.role}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 24, color: DEEP, lineHeight: 1.2 }}>{p.name}</div>
                  {p.sub && <div style={{ fontSize: 12.5, color: SLATE, lineHeight: 1.55 }}>{p.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {d.hasFamilies && (
          <div style={{ ...GLASS, borderRadius: 24, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, lineHeight: 1.7, textAlign: "center" }}>
            <div><div style={{ ...lab, fontSize: 10, marginBottom: 4 }}>Nhà trai</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
            <div><div style={{ ...lab, fontSize: 10, marginBottom: 4 }}>Nhà gái</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ ...GLASS, borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...lab, fontSize: 11, letterSpacing: ".26em" }}>Địa điểm</div>
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

        {/* Dặn dò: chip bo tròn xếp tràn dòng */}
        {d.infos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {d.infos.map((i) => (
              <span key={i.label} style={{ ...GLASS, borderRadius: 99, padding: "10px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: SOFT }}>{i.label}</span>
                {i.value}
                {i.swatches?.map((s, k) => <span key={k} style={{ width: 14, height: 14, borderRadius: "50%", background: s, border: "1px solid #fff" }} />)}
              </span>
            ))}
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
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.9)", borderRadius: 18, padding: "12px 16px", fontSize: 13, lineHeight: 1.55 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: SOFT, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...lab, textAlign: "center" }}>Hộp mừng cưới</div>
            {d.giftNote && <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6, textAlign: "center" }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ ...GLASS, borderRadius: 24, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", borderRadius: 14, background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: SLATE }}>{g.bank.name}</div>
                  <div style={{ color: SLATE }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <Reveal anim="up">
            <div style={{ ...GLASS, borderRadius: 28, padding: 24, textAlign: "center" }}>
              <div style={{ ...lab, fontSize: 10 }}>Lời cảm ơn</div>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={140} width={140} radius="50%" tint="rgba(255,255,255,.6)" label="" style={{ margin: "14px auto", border: "3px solid #fff" }} />}
              {d.thanks && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, whiteSpace: "pre-line" }}>{d.thanks}</p>}
            </div>
          </Reveal>
        )}

        {d.closing && (
          <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: SOFT, whiteSpace: "pre-line", lineHeight: 1.7 }}>{d.closing}</div>
        )}

        <footer style={{ textAlign: "center" }}>
          <div style={{ fontFamily: HAND, fontSize: 34, color: accent }}>{d.bride} &amp; {d.groom}</div>
          <div style={{ ...lab, fontSize: 10, marginTop: 6 }}>Thiệp cưới online</div>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
