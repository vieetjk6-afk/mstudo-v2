import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// SONG HỶ — bố cục "thẻ kem lồng trong nền đỏ"
//
// Nét riêng so với 9 mẫu còn lại:
//   · TẤM THẺ KEM lớn đặt giữa nền đỏ ôm trọn phần trang trọng (hai họ, ba
//     nghi lễ, địa điểm) — đúng cảm giác tấm thiệp giấy nằm trên nền gấm
//   · nghi lễ xếp thành BA CỘT ngang nhau (Vu quy · Tân hôn · Tiệc), không
//     phải danh sách dọc
//   · huy hiệu tròn "SONG HỶ" phát sáng làm điểm mở đầu, không dùng ảnh bìa lớn
//   · album là ba ô VUÔNG viền vàng nằm ngoài thẻ, trên nền đỏ
// ════════════════════════════════════════════════════════════════════════════

const RED = "#8e1b1b", GOLD = "#ffd77a", CREAM = "#fff8ec", SAND = "#f0c98a", DEEPRED = "#5c1414";
const LINE = "rgba(255,215,122,.45)";
const SERIF = "var(--font-playfair), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function SongHyTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || GOLD;
  const goldHead = { fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent, textAlign: "center" as const };
  const creamLine = <div style={{ height: 1, background: "#e8cfa8" }} />;

  return (
    <PhoneShell
      card={RED} page="#5e1010" ink={CREAM} font={SANS} radius={20} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.16, backgroundImage: "repeating-linear-gradient(45deg,#ffd77a 0 2px,transparent 2px 16px),repeating-linear-gradient(-45deg,#ffd77a 0 2px,transparent 2px 16px)" }} />}
    >
      <style>{`@keyframes shFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>

      <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255,215,122,.35)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: SERIF, fontSize: 14, letterSpacing: ".3em", color: accent }}>THIỆP MỜI</span>
        {d.date.valid && <span style={{ fontSize: 12, letterSpacing: ".14em", color: SAND }}>{d.date.dotted}</span>}
      </div>

      <div style={{ padding: "36px 26px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 92, height: 92, borderRadius: "50%", border: `1px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "shFloat 6s ease-in-out infinite" }}>
          <div style={{ width: 62, height: 62, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#ffe9b0,#e8a84c)", boxShadow: "0 0 30px rgba(255,215,122,.55)" }} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 17, letterSpacing: ".42em", color: accent }}>SONG HỶ</div>
        <div>
          <div className="wed-ink" style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 1.12 }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 30, color: accent }}>sánh duyên cùng</div>
          <div className="wed-ink-2" style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 1.12 }}>{d.groom}</div>
        </div>
        {d.dateSub && <div style={{ fontSize: 13, color: SAND }}>{d.dateSub}</div>}
        {d.reception && <div style={{ fontSize: 13, color: SAND }}>{d.reception}</div>}
      </div>

      <div style={{ padding: "0 22px 46px", display: "flex", flexDirection: "column", gap: 22 }}>
        <Slot src={d.hero} height={280} radius="180px 180px 12px 12px" border={`1px solid ${LINE}`} tint="rgba(255,215,122,.12)" label="Ảnh cưới" lazy={false} fx="kb" />

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase", color: SAND }}>{d.guestLabel}</div>
            <div style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1.1, marginTop: 2 }}>{d.guest}</div>
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 2px", textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 24, color: accent }}
          lab={{ fontSize: 9, color: SAND, letterSpacing: ".12em" }}
        />

        {/* ══ TẤM THẺ KEM: toàn bộ phần trang trọng nằm trong đây ══════════ */}
        <div style={{ background: CREAM, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 18, color: DEEPRED, boxShadow: "0 18px 40px -22px rgba(0,0,0,.55)" }}>
          <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 15, letterSpacing: ".3em", color: "#a12b2b" }}>LỄ THÀNH HÔN</div>

          {d.hasFamilies && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 14, textAlign: "center", fontSize: 13, lineHeight: 1.7 }}>
                <div><div style={{ fontWeight: 600, marginBottom: 6 }}>NHÀ TRAI</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
                <div style={{ background: "#e8cfa8" }} />
                <div><div style={{ fontWeight: 600, marginBottom: 6 }}>NHÀ GÁI</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
              </div>
              {creamLine}
            </>
          )}

          {d.portraits.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, textAlign: "center" }}>
                {d.portraits.map((p) => (
                  <div key={p.role + p.name}>
                    <Slot src={p.photo} height={86} width={86} radius="50%" tint="rgba(161,43,43,.1)" label="" style={{ margin: "0 auto 8px", border: "2px solid #e8cfa8" }} />
                    <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#a12b2b" }}>{p.role}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.2 }}>{p.name}</div>
                    {p.sub && <div style={{ fontSize: 12, lineHeight: 1.5, color: "#8d5b5b" }}>{p.sub}</div>}
                  </div>
                ))}
              </div>
              {creamLine}
            </>
          )}

          {/* Nghi lễ: BA CỘT ngang nhau */}
          {d.events.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.events.length, 3)},1fr)`, gap: 10, textAlign: "center" }}>
                {d.events.slice(0, 3).map((e, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: SERIF, fontSize: 15, color: "#a12b2b", lineHeight: 1.25 }}>{e.label}</div>
                    <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.55 }}>{[e.date, e.time].filter(Boolean).join(" · ")}</div>
                    {e.where && <div style={{ fontSize: 11.5, color: "#8d5b5b", lineHeight: 1.5, marginTop: 3 }}>{e.where}</div>}
                  </div>
                ))}
              </div>
              {d.events.length > 3 && (
                <div style={{ fontSize: 12.5, lineHeight: 1.7, textAlign: "center" }}>
                  {d.events.slice(3).map((e, i) => <div key={i}>{e.label} · {[e.date, e.time].filter(Boolean).join(" ")}</div>)}
                </div>
              )}
              {creamLine}
            </>
          )}

          {(d.venue.name || d.venue.address) && (
            <div style={{ fontSize: 13.5, lineHeight: 1.7, textAlign: "center" }}>
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

        {d.quote && (
          <Reveal anim="blur">
            <div style={{ fontFamily: HAND, fontSize: 24, lineHeight: 1.5, textAlign: "center", color: accent }}>{d.quote}</div>
          </Reveal>
        )}

        {d.story && (
          <Reveal anim="up">
            <div style={goldHead}>CHUYỆN TÌNH YÊU</div>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.9, textAlign: "center", whiteSpace: "pre-line" }}>{d.story}</p>
          </Reveal>
        )}

        {/* Album: ba ô vuông viền vàng trên nền đỏ */}
        {d.trio.length > 0 && (
          <>
            <div style={goldHead}>ALBUM</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.trio.length, 3)},1fr)`, gap: 8 }}>
              {d.trio.map((src, i) => <Slot key={i} src={src} height={112} border={`1px solid ${LINE}`} tint="rgba(255,215,122,.18)" fx="zoom" />)}
            </div>
          </>
        )}

        {d.infos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {d.infos.map((i) => (
              <div key={i.label} style={{ border: "1px solid rgba(255,215,122,.4)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: SAND }}>{i.label}</div>
                {i.value && <div style={{ fontSize: 14, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 18, height: 18, borderRadius: "50%", background: s, border: `1px solid ${LINE}` }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={goldHead}>XÁC NHẬN</div>
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
            <div style={goldHead}>LỜI CHÚC</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ border: "1px solid rgba(255,215,122,.35)", borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.6 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: SAND, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={goldHead}>MỪNG CƯỚI</div>
            {d.giftNote && <p style={{ margin: 0, fontSize: 13, color: SAND, lineHeight: 1.6, textAlign: "center" }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ display: "flex", gap: 14, alignItems: "center", border: "1px solid rgba(255,215,122,.4)", borderRadius: 12, padding: 16 }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", borderRadius: 8, background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: SAND }}>{g.bank.name}</div>
                  <div style={{ color: SAND }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <Reveal anim="zoom">
            <div style={{ textAlign: "center", border: "1px solid rgba(255,215,122,.4)", borderRadius: 12, padding: 20 }}>
              <div style={goldHead}>LỜI CẢM ƠN</div>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={140} width={140} radius="50%" tint="rgba(255,215,122,.15)" label="" style={{ margin: "14px auto", border: `2px solid ${accent}` }} />}
              {d.thanks && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, whiteSpace: "pre-line" }}>{d.thanks}</p>}
            </div>
          </Reveal>
        )}

        {d.closing && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 24, color: accent, whiteSpace: "pre-line", lineHeight: 1.5 }}>{d.closing}</div>
        )}

        <footer style={{ textAlign: "center", borderTop: "1px solid rgba(255,215,122,.35)", paddingTop: 22 }}>
          <div style={{ fontFamily: SERIF, fontSize: 30, color: accent }}>{d.bride} &amp; {d.groom}</div>
          <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: SAND, marginTop: 6 }}>Thiệp cưới online</div>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
