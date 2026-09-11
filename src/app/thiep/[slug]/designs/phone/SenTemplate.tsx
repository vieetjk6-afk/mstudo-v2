import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// SEN & KEM — bố cục "ảnh bìa tràn màn hình"
//
// Nét riêng so với 9 mẫu còn lại:
//   · bìa là ẢNH TRÀN CẢ MÀN HÌNH, tên cô dâu chú rể đè lên đáy ảnh
//   · chương trình là MỐC THỜI GIAN DỌC có đường chỉ và chấm tròn
//   · đếm ngược nằm CUỐI thiệp (ngay trên phần xác nhận), không nằm ở đầu
//   · album là dải ảnh xếp dọc tràn mép, không phải lưới ba ô
// ════════════════════════════════════════════════════════════════════════════

const BG = "#faf6ef", INK = "#3a3129", SOFT = "#f2ece2", LINE = "#e3d9cc", MUTED = "#9a7d6a", BODY = "#4a4038";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

export default function SenTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#c98a93";
  const eyebrow = { fontSize: 10, letterSpacing: ".32em", textTransform: "uppercase" as const, color: MUTED };
  const rule = <span style={{ display: "block", width: 46, height: 1, background: LINE, margin: "0 auto" }} />;

  return (
    <PhoneShell card={BG} page="#ece7dd" ink={INK} font={SANS} radius={18} accent={accent}>
      <style>{`
        @keyframes senCue{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(6px);opacity:1}}
        @keyframes senKen{from{transform:scale(1.02)}to{transform:scale(1.16)}}
        .wed-kb-img{animation:senKen 22s ease-out forwards}
      `}</style>

      {/* ── Bìa: ảnh tràn màn hình, tên đè lên ảnh ─────────────────────── */}
      <section style={{ position: "relative", height: "100svh", minHeight: 560, overflow: "hidden" }}>
        {d.hero
          ? <img className="wed-kb-img" src={d.hero} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, background: SOFT }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(38,30,24,.78) 0%,rgba(38,30,24,.28) 42%,rgba(38,30,24,.06) 70%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 28px 40px", textAlign: "center", color: "#fff" }}>
          <div style={{ ...eyebrow, letterSpacing: ".42em", color: "rgba(255,255,255,.82)" }}>Lễ thành hôn</div>
          <div className="wed-ink" style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.04, marginTop: 10, textShadow: "0 2px 24px rgba(0,0,0,.35)" }}>{d.bride}</div>
          <div style={{ fontFamily: HAND, fontSize: 28, color: "#f4c9cf" }}>&amp;</div>
          <div className="wed-ink-2" style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.04, textShadow: "0 2px 24px rgba(0,0,0,.35)" }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 16, fontSize: 12, letterSpacing: ".3em", color: "rgba(255,255,255,.9)" }}>{d.date.spaced}</div>}
          {d.dateSub && <div style={{ marginTop: 4, fontSize: 12.5, color: "rgba(255,255,255,.72)" }}>{d.dateSub}</div>}
          {d.reception && <div style={{ marginTop: 2, fontSize: 12.5, color: "rgba(255,255,255,.72)" }}>{d.reception}</div>}
          <div style={{ marginTop: 22, fontSize: 18, color: "rgba(255,255,255,.7)", animation: "senCue 2.4s ease-in-out infinite" }}>↓</div>
        </div>
      </section>

      <div style={{ padding: "40px 24px 46px", display: "flex", flexDirection: "column", gap: 34, color: BODY }}>
        {d.guest && (
          <div style={{ textAlign: "center" }}>
            {rule}
            <div style={{ ...eyebrow, margin: "14px 0 2px" }}>{d.guestLabel}</div>
            <div style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1.1, color: INK }}>{d.guest}</div>
            <div style={{ marginTop: 14 }}>{rule}</div>
          </div>
        )}

        {/* Hai họ: hai cột ngăn bằng một nét dọc mảnh */}
        {d.hasFamilies && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 18, textAlign: "center", fontSize: 13.5, lineHeight: 1.7 }}>
            <div>
              <div style={{ ...eyebrow, marginBottom: 8 }}>Nhà trai</div>
              <span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span>
            </div>
            <div style={{ background: LINE }} />
            <div>
              <div style={{ ...eyebrow, marginBottom: 8 }}>Nhà gái</div>
              <span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span>
            </div>
          </div>
        )}

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: d.pair.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
            <Slot src={d.pair[0]} height={168} radius="130px 130px 8px 8px" tint={SOFT} />
            {d.pair[1] && <Slot src={d.pair[1]} height={168} radius="8px 8px 130px 130px" tint={SOFT} />}
          </div>
        )}

        {d.quote && (
          <Reveal anim="blur">
            <div style={{ textAlign: "center", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.75, color: "#5a4d42", whiteSpace: "pre-line" }}>
              “{d.quote}”
            </div>
          </Reveal>
        )}

        {d.story && (
          <Reveal anim="up">
            <div style={{ ...eyebrow, textAlign: "center", marginBottom: 12 }}>Chuyện tình yêu</div>
            <span className="wed-rule" style={{ display: "block", width: 46, height: 1, background: LINE, margin: "0 auto 16px" }} />
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.85, color: BODY, whiteSpace: "pre-line", textAlign: "center" }}>{d.story}</p>
          </Reveal>
        )}

        {/* Chương trình: mốc thời gian DỌC, đường chỉ mảnh + chấm tròn */}
        {d.events.length > 0 && (
          <div>
            <div style={{ ...eyebrow, textAlign: "center", marginBottom: 22 }}>Chương trình</div>
            <div style={{ position: "relative", paddingLeft: 30 }}>
              <span style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: LINE }} />
              {d.events.map((e, i) => (
                <div key={i} style={{ position: "relative", marginBottom: i === d.events.length - 1 ? 0 : 26 }}>
                  <span style={{ position: "absolute", left: -30, top: 7, width: 11, height: 11, borderRadius: "50%", background: BG, border: `1.5px solid ${accent}` }} />
                  <div style={{ fontFamily: SERIF, fontSize: 22, color: accent, lineHeight: 1.2 }}>{e.time || e.date || "—"}</div>
                  <div style={{ fontSize: 15, marginTop: 2 }}>{e.label}</div>
                  {e.where && <div style={{ fontSize: 13.5, color: MUTED, marginTop: 2, lineHeight: 1.6 }}>{e.where}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chân dung: hai ảnh VUÔNG lớn, chú thích nằm dưới */}
        {d.portraits.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {d.portraits.map((p) => (
              <div key={p.role + p.name}>
                <Slot src={p.photo} height={150} radius={4} tint={SOFT} label={p.role} />
                <div style={{ ...eyebrow, marginTop: 10 }}>{p.role}</div>
                <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.2, color: INK }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, marginTop: 3 }}>{p.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ background: SOFT, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={eyebrow}>Địa điểm &amp; di chuyển</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} radius={10} />
            {d.infos.filter((i) => i.label === "Gửi xe" || i.label === "Hotline").map((i) => (
              <div key={i.label} style={{ fontSize: 13.5, lineHeight: 1.7, color: MUTED }}>{i.label}: <span style={{ color: BODY }}>{i.value}</span></div>
            ))}
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 10, background: INK, color: BG, fontSize: 11, letterSpacing: ".24em" }}>MỞ CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        {/* Dặn dò: chỉ hai ô (trang phục · hashtag) — gửi xe/hotline đã nằm ở khối địa điểm */}
        {d.infos.some((i) => i.label === "Trang phục" || i.label === "Hashtag") && (
          <div style={{ display: "flex", gap: 12 }}>
            {d.infos.filter((i) => i.label === "Trang phục" || i.label === "Hashtag").map((i) => (
              <div key={i.label} style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
                <div style={{ ...eyebrow, letterSpacing: ".2em" }}>{i.label}</div>
                {i.value && <div style={{ fontFamily: SERIF, fontSize: 20, color: INK, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 20, height: 20, borderRadius: "50%", background: s, border: "1px solid #fff" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Album: dải ảnh xếp DỌC tràn mép, cách nhau đúng một nét */}
      {d.trio.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {d.trio.map((src, i) => <Slot key={i} src={src} height={230} tint={SOFT} fx="zoom" />)}
        </div>
      )}

      <div style={{ padding: "40px 24px 46px", display: "flex", flexDirection: "column", gap: 30, color: BODY }}>
        {/* Đếm ngược đặt CUỐI: số trần giữa hai nét kẻ */}
        <div>
          <div style={{ ...eyebrow, textAlign: "center", marginBottom: 14 }}>Còn lại</div>
          <PhoneCountdown
            date={d.countdownTo}
            labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
            wrap={{ display: "flex", justifyContent: "space-around", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "18px 0" }}
            box={{ textAlign: "center" }}
            num={{ fontFamily: SERIF, fontSize: 34, color: INK, lineHeight: 1 }}
            lab={{ fontSize: 9, letterSpacing: ".22em", color: MUTED, marginTop: 6 }}
          />
        </div>

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...eyebrow, textAlign: "center" }}>Xác nhận tham dự</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, borderRadius: 10, background: "transparent", color: "#a8626d", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: accent, color: "#fff" }}
              msgStyle={{ textAlign: "center", fontSize: 13, color: "#a8626d" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...eyebrow, textAlign: "center" }}>Sổ lưu bút</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ background: SOFT, borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.55 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={eyebrow}>Mừng cưới</div>
            {d.giftNote && <p style={{ margin: "8px 0 0", fontSize: 13.5, fontStyle: "italic", color: MUTED, lineHeight: 1.6 }}>{d.giftNote}</p>}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
              {d.gifts.map((g) => (
                <div key={g.title} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: 14, width: 150 }}>
                  <img src={g.qr} alt="" width={120} height={120} style={{ width: "100%", height: "auto", background: "#fff", borderRadius: 8 }} />
                  <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>{g.bank.holder || g.fallbackName}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{g.bank.name}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <div style={{ textAlign: "center" }}>
            {d.thanksPhoto && <Slot src={d.thanksPhoto} height={170} width={170} radius="50%" tint={SOFT} style={{ margin: "0 auto 14px", border: `2px solid ${accent}` }} />}
            {d.thanks && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: MUTED, whiteSpace: "pre-line" }}>{d.thanks}</p>}
          </div>
        )}

        {d.closing && <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 24, color: accent }}>{d.closing}</div>}

        <footer style={{ textAlign: "center", paddingTop: 10 }}>
          {rule}
          <p style={{ fontFamily: SERIF, fontSize: 30, color: accent, margin: "14px 0 4px" }}>{d.bride} &amp; {d.groom}</p>
          <p style={{ fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: MUTED }}>Thiệp cưới online</p>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
