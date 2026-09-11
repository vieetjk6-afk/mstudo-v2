import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// Y2K CHROME — bố cục "màn hình app": thẻ nổi trên nền gradient
//
// Nét riêng so với 9 mẫu còn lại:
//   · ảnh là BĂNG CUỘN NGANG vuốt từng tấm, không có lưới ảnh nào
//   · lịch trình là các CHIP BO TRÒN xếp tràn dòng, không phải danh sách dọc
//   · mọi thông tin "đi đâu, lúc nào" gom trong MỘT THẺ TRẮNG nổi giữa nền tím
//   · chân dung là hai vòng tròn lớn nằm chung một thẻ kính
//   · thanh đầu trang DÍNH khi cuộn, kiểu thanh trạng thái của app
// ════════════════════════════════════════════════════════════════════════════

const BG = "#12052b", LILAC = "#c9b8ff", PINK = "#ffd6f7";
const GLASS = { background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)" };
const TINT = "rgba(255,255,255,.14)";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

const NAME: React.CSSProperties = {
  fontFamily: SANS, fontWeight: 800, fontSize: 48, lineHeight: 1, letterSpacing: "-.03em",
  background: "linear-gradient(100deg,#fff,#a8e9ff,#ffd6f7,#fff,#bcaaff,#fff)", backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "y2kShim 5s linear infinite",
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
          <div style={{ position: "absolute", width: 320, height: 320, left: -90, top: 40, borderRadius: "50%", background: `radial-gradient(circle,${accent},transparent 70%)`, filter: "blur(40px)", animation: "y2kBlob 14s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 300, height: 300, right: -100, top: 420, borderRadius: "50%", background: "radial-gradient(circle,#3ee9ff,transparent 70%)", filter: "blur(45px)", animation: "y2kBlob 18s ease-in-out infinite reverse" }} />
          <div style={{ position: "absolute", width: 280, height: 280, left: 30, bottom: 120, borderRadius: "50%", background: "radial-gradient(circle,#b86bff,transparent 70%)", filter: "blur(45px)", animation: "y2kBlob 16s ease-in-out infinite" }} />
        </div>
      }
    >
      <style>{`
        @keyframes y2kShim{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes y2kBlob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.15)}66%{transform:translate(-30px,25px) scale(.9)}}
        @keyframes y2kSpin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Thanh đầu dính, kiểu app */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", background: "rgba(18,5,43,.72)", backdropFilter: "blur(12px)", ...lab }}>
        <span>Save the date</span>
        {d.date.valid && <span style={{ color: PINK }}>{d.date.dotted}</span>}
      </div>

      <div style={{ padding: "18px 24px 46px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
          <div style={{ width: 112, height: 112, borderRadius: "50%", background: "conic-gradient(from 0deg,#fff,#9ad7ff,#ffb3f0,#fff,#cbb3ff,#fff)", animation: "y2kSpin 9s linear infinite", boxShadow: "0 0 40px rgba(255,110,220,.5)" }} />
          <div style={{ ...NAME, marginTop: 16 }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 34, color: "#ff9ee8" }}>&amp;</div>
          <div style={{ ...NAME, animationDelay: ".6s" }}>{d.groom}</div>
          {d.dateSub && <div style={{ marginTop: 10, fontSize: 12.5, color: LILAC }}>{d.dateSub}</div>}
        </div>

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={lab}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 40, lineHeight: 1.1 }}>{d.guest}</div>
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ ...GLASS, backdropFilter: "blur(8px)", borderRadius: 16, padding: "12px 4px", textAlign: "center" }}
          num={{ fontWeight: 800, fontSize: 24, color: "#fff" }}
          lab={{ fontSize: 9, letterSpacing: ".14em", color: LILAC, textTransform: "uppercase" }}
        />
      </div>

      {/* ── BĂNG ẢNH CUỘN NGANG (thay cho mọi lưới ảnh) ─────────────────── */}
      {d.photos.length > 0 && (
        <div className="wed-swipe" style={{ gap: 12, padding: "0 24px 4px" }}>
          {d.photos.map((src, i) => (
            <Slot key={i} src={src} height={300} width={236} radius={26} border="1px solid rgba(255,255,255,.3)" tint={TINT} lazy={i > 0} />
          ))}
        </div>
      )}

      <div style={{ padding: "22px 24px 46px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Thẻ trắng: toàn bộ thông tin "đi đâu, lúc nào" */}
        <div style={{ background: "rgba(255,255,255,.95)", borderRadius: 28, padding: 22, display: "flex", flexDirection: "column", gap: 16, color: BG }}>
          <div style={{ ...lab, color: "#7a5bd0" }}>Tụi mình chốt đơn rồi</div>
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
            <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: 13, borderRadius: 99, background: "linear-gradient(100deg,#ff4fd8,#8f5bff,#3ee9ff)", backgroundSize: "200% 100%", animation: "y2kShim 6s linear infinite", color: "#fff", fontWeight: 600, fontSize: 14 }}>
              Chỉ đường tới đó
            </a>
          )}
        </div>

        {/* Lịch trình dạng CHIP */}
        {d.events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Lịch trình</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {d.events.map((e, i) => (
                <span key={i} style={{ ...GLASS, borderRadius: 99, padding: "9px 16px", fontSize: 13, lineHeight: 1.3 }}>
                  <b style={{ fontWeight: 600 }}>{e.label}</b>
                  <span style={{ color: LILAC }}> · {[e.date, e.time].filter(Boolean).join(" ")}</span>
                </span>
              ))}
            </div>
            {d.events.some((e) => e.where) && (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,.78)" }}>
                {d.events.filter((e) => e.where).map((e, i) => <div key={i}>{e.label}: {e.where}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Chân dung: hai vòng tròn lớn chung một thẻ kính */}
        {d.portraits.length > 0 && (
          <div style={{ ...GLASS, borderRadius: 28, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" }}>
            {d.portraits.map((p) => (
              <div key={p.role + p.name}>
                <Slot src={p.photo} height={104} width={104} radius="50%" tint={TINT} label="" style={{ margin: "0 auto 10px", border: `2px solid ${accent}` }} />
                <div style={{ fontSize: 9, letterSpacing: ".26em", textTransform: "uppercase", color: LILAC }}>{p.role}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12, color: LILAC, lineHeight: 1.5, marginTop: 3 }}>{p.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {d.hasFamilies && (
          <div style={{ ...GLASS, borderRadius: 24, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, lineHeight: 1.7 }}>
            <div><div style={lab}>Nhà trai</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
            <div><div style={lab}>Nhà gái</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
          </div>
        )}

        {d.story && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Chuyện của tụi mình</div>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,.9)", whiteSpace: "pre-line" }}>{d.story}</div>
          </div>
        )}

        {d.infos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {d.infos.map((i) => (
              <div key={i.label} style={{ ...GLASS, borderRadius: 18, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: LILAC }}>{i.label}</div>
                {i.value && <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 18, height: 18, borderRadius: "50%", background: s, border: "1px solid rgba(255,255,255,.6)" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Bạn đến được chứ?</div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={lab}>Lời chúc</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ ...GLASS, borderRadius: 18, borderBottomLeftRadius: 6, padding: "12px 16px", fontSize: 13, lineHeight: 1.55 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: LILAC, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Mừng cưới online</div>
            {d.giftNote && <p style={{ margin: 0, fontSize: 13, color: LILAC, lineHeight: 1.6 }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ ...GLASS, borderRadius: 22, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", borderRadius: 14, background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: LILAC }}>{g.bank.name}</div>
                  <div style={{ color: LILAC }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.closing) && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 24, color: PINK, whiteSpace: "pre-line", lineHeight: 1.5 }}>
            {d.closing || d.thanks}
          </div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
