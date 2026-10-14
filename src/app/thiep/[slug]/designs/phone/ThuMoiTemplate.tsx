import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { Ambient, Letters, MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// THƯ MỜI NÂU — kiểu "thư mời tiệc cưới" quen thuộc của các mẫu LadiPage
//
// Nét riêng so với các mẫu còn lại:
//   · bìa là ảnh tràn màn hình: "THƯ MỜI TIỆC CƯỚI" ở đáy, tên viết tay ở đỉnh
//   · khối "Thư Mời" có NGÀY TÁCH BA CỘT: thứ | số ngày to | tháng · năm
//   · có TỜ LỊCH CẢ THÁNG, ngày cưới khoanh trái tim
//   · địa điểm đặt trên nền ảnh tối, tên nơi tổ chức viết tay cỡ lớn
//   · mừng cưới gói trong nút bấm mở ra (không bày QR sẵn giữa thiệp)
//   · tông trắng – xám – nâu cà phê
// ════════════════════════════════════════════════════════════════════════════

const BG = "#ffffff", SOFT = "#f6f1ec", BROWN = "#6b503d", INK = "#545454", GREY = "#737373", LINE = "#e6ddd4";
const SERIF = "var(--font-playfair), var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-hand), cursive";

const DOW = ["mon", "tue", "wed", "thur", "fri", "sat", "sun"];
const MONTH_VI = ["Tháng Giêng", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu", "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Chạp"];

/** Các ô của tờ lịch tháng, tuần bắt đầu từ thứ Hai (ô trống = null). */
function monthCells(iso?: string): { cells: (number | null)[]; day: number; month: number; year: number } | null {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear(), m = d.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return { cells, day: d.getDate(), month: m, year: y };
}

export default function ThuMoiTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || BROWN;
  const cal = monthCells(d.countdownTo);
  const mainEvent = d.events[d.events.length - 1];
  const caps = { fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" as const, color: GREY, lineHeight: 1.6 };
  const title = { fontFamily: HAND, fontSize: 52, lineHeight: 1.1, color: accent, textAlign: "center" as const };
  const shadow = "1px 2px 3px rgba(0,0,0,.55)";

  return (
    <PhoneShell card={BG} page="#e9e4de" ink={INK} font={SANS} accent={accent}>
      <style>{`
        @keyframes tmKen{from{transform:scale(1.03)}to{transform:scale(1.15)}}
        @keyframes tmBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        .tm-hero img{animation:tmKen 20s ease-out forwards}
        .tm-beat{animation:tmBeat 1.6s ease-in-out infinite}
        .tm-gift summary{list-style:none;cursor:pointer}
        .tm-gift summary::-webkit-details-marker{display:none}
      `}</style>

      {/* ── Bìa: ảnh tràn màn hình, tên viết tay trên đỉnh, "THƯ MỜI" ở đáy ── */}
      <section className="tm-hero" style={{ position: "relative", height: "100svh", minHeight: 620, maxHeight: 820, overflow: "hidden", color: "#fff" }}>
        {d.hero
          ? <img src={d.hero} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, #a58a74, ${BROWN})` }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 58%, rgba(0,0,0,.55) 100%)" }} />
        <Ambient kind="heart" color="rgba(255,255,255,.75)" count={10} />

        <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", zIndex: 2, textShadow: shadow }}>
          <div style={{ fontFamily: HAND, fontSize: 54, lineHeight: 1.15 }}><Letters text={d.groom} delay={0.2} step={0.06} /></div>
          <div className="wed-float" style={{ fontFamily: HAND, fontSize: 40, lineHeight: 1 }}>&amp;</div>
          <div style={{ fontFamily: HAND, fontSize: 54, lineHeight: 1.15 }}><Letters text={d.bride} delay={0.2 + d.groom.length * 0.06} step={0.06} /></div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 36, textAlign: "center", zIndex: 2, textShadow: shadow }}>
          <div className="wed-ink" style={{ fontFamily: SERIF, fontSize: 25, letterSpacing: ".04em" }}>THƯ MỜI TIỆC CƯỚI</div>
          {d.date.valid && (
            <div className="wed-ink-2" style={{ marginTop: 10, fontSize: 18, lineHeight: 1.5 }}>
              {[d.date.weekday.toUpperCase(), mainEvent?.time].filter(Boolean).join(" - ")}
              <br />
              <span style={{ fontFamily: SERIF, fontSize: 22, letterSpacing: ".06em" }}>{d.date.dotted}</span>
            </div>
          )}
        </div>
      </section>

      <div style={{ padding: "44px 22px 10px", display: "flex", flexDirection: "column", gap: 40 }}>
        {/* Câu trích dẫn viết tay */}
        {d.quote && (
          <Reveal anim="blur">
            <p style={{ margin: 0, fontFamily: HAND, fontSize: 30, lineHeight: 1.25, color: GREY, textAlign: "center", whiteSpace: "pre-line" }}>“{d.quote}”</p>
          </Reveal>
        )}

        {/* Hai họ: hai cột */}
        {d.hasFamilies && (
          <Reveal anim="up">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, textAlign: "center" }}>
              {([["Nhà trai", d.families.groom], ["Nhà gái", d.families.bride]] as const).map(([lab, txt]) => (
                <div key={lab}>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: INK }}>{lab}</div>
                  <div style={{ ...caps, fontSize: 12, marginTop: 6, whiteSpace: "pre-line" }}>{txt || "—"}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={caps}>{d.guestLabel}</div>
            <div style={{ fontFamily: HAND, fontSize: 44, lineHeight: 1.15, color: accent }}>{d.guest}</div>
          </div>
        )}

        {/* Chú rể · Cô dâu: hai ảnh dọc cạnh nhau */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[d.portraits[1], d.portraits[0]].map((p, i) => (
            <Reveal key={p.role + p.name} anim={i === 0 ? "left" : "right"}>
              <div style={{ textAlign: "center" }}>
                <Slot
                  src={p.photo}
                  height={240}
                  radius={4}
                  tint={SOFT}
                  fx="zoom"
                  style={{ boxShadow: "0 10px 24px -14px rgba(0,0,0,.5)" }}
                  fallback={<span style={{ fontFamily: HAND, fontSize: 70, color: accent, opacity: 0.55 }}>{initial(p.name)}</span>}
                />
                <div style={{ marginTop: 12, fontSize: 16, letterSpacing: ".06em", textTransform: "uppercase", color: "#222" }}>{p.role}</div>
                <div style={{ fontFamily: HAND, fontSize: 36, lineHeight: 1.2, color: INK }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12, color: GREY, lineHeight: 1.5, marginTop: 2 }}>{p.sub}</div>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── Thư mời: ngày tách ba cột + âm lịch ─────────────────────────── */}
      <section style={{ padding: "34px 22px 40px", textAlign: "center" }}>
        <Reveal anim="zoom">
          <div style={{ fontFamily: HAND, fontSize: 58, lineHeight: 1.1, color: "#111" }}>Thư Mời</div>
          <div style={{ marginTop: 8, fontSize: 15, letterSpacing: ".04em", color: "#111" }}>THAM DỰ LỄ CƯỚI CỦA</div>
          <div style={{ fontFamily: HAND, fontSize: 38, lineHeight: 1.25, color: accent, marginTop: 4 }}>{d.groom} &amp; {d.bride}</div>
        </Reveal>

        {d.pair.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: d.pair.length > 1 ? "1fr 1fr" : "1fr", gap: 8, margin: "22px 0 4px" }}>
            {d.pair.map((src, i) => <Slot key={i} src={src} height={200} radius={4} tint={SOFT} fx="zoom gloss" />)}
          </div>
        )}

        {mainEvent && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 16, letterSpacing: ".04em", textTransform: "uppercase", color: "#111" }}>{mainEvent.label}</div>
            {mainEvent.time && <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Vào Lúc {mainEvent.time}</div>}
          </div>
        )}

        {d.date.valid && (
          <Reveal anim="up">
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", margin: "14px auto 0", maxWidth: 340, color: INK }}>
              <div style={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase", borderTop: `1.5px solid ${INK}`, borderBottom: `1.5px solid ${INK}`, padding: "6px 0" }}>{d.date.weekday}</div>
              <div className="tm-beat" style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 700, lineHeight: 1, padding: "0 16px" }}>{d.date.day}</div>
              <div style={{ borderTop: `1.5px solid ${INK}`, borderBottom: `1.5px solid ${INK}`, padding: "2px 0", lineHeight: 1.3 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Tháng {d.date.month}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{d.date.year}</div>
              </div>
            </div>
          </Reveal>
        )}
        {d.lunar && <div style={{ marginTop: 12, fontSize: 15, fontStyle: "italic", color: GREY }}>({d.lunar})</div>}
        {d.reception && <div style={{ marginTop: 4, fontSize: 14, color: GREY }}>{d.reception}</div>}

        {/* Các lễ khác (nếu có nhiều sự kiện) */}
        {d.events.length > 1 && (
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            {d.events.slice(0, -1).map((e, i) => (
              <div key={i} style={{ background: SOFT, borderRadius: 6, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55 }}>
                <b style={{ color: accent }}>{e.label}</b> · {[e.time, e.date].filter(Boolean).join(" ")}
                {e.where && <div style={{ color: GREY }}>{e.where}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Tờ lịch tháng, ngày cưới khoanh trái tim ─────────────────────── */}
      {cal && (
        <section style={{ padding: "8px 18px 40px" }}>
          <Reveal anim="up">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 4px 10px", color: accent }}>
              <div style={{ fontFamily: HAND, fontSize: 40, lineHeight: 1.1 }}>{MONTH_VI[cal.month]}</div>
              <div style={{ fontFamily: HAND, fontSize: 54, lineHeight: 1, paddingRight: 6 }}>{cal.year}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: accent, borderRadius: "6px 6px 0 0" }}>
              {DOW.map((w) => <div key={w} style={{ textAlign: "center", padding: "6px 0", fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: "#fff", textTransform: "lowercase" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: `1px solid ${LINE}`, borderTop: 0, borderRadius: "0 0 6px 6px", padding: "6px 0" }}>
              {cal.cells.map((n, i) => {
                const on = n === cal.day;
                return (
                  <div key={i} style={{ position: "relative", height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 17, color: on ? "#fff" : accent }}>
                    {on && <span className="tm-beat" aria-hidden style={{ position: "absolute", fontSize: 42, lineHeight: 1, color: accent, fontFamily: "system-ui" }}>♥</span>}
                    <span style={{ position: "relative", fontWeight: on ? 700 : 400 }}>{n ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Địa điểm: nền ảnh tối, tên nơi tổ chức viết tay cỡ lớn ───────── */}
      {(d.venue.name || d.venue.address || d.mapHref) && (
        <section style={{ position: "relative", padding: "36px 18px 30px", textAlign: "center", color: "#fff", overflow: "hidden" }}>
          {d.trio[0] || d.hero
            ? <img src={d.trio[0] || d.hero} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(2px)", transform: "scale(1.05)" }} />
            : null}
          <div style={{ position: "absolute", inset: 0, background: d.trio[0] || d.hero ? "rgba(40,28,20,.62)" : accent }} />
          <div style={{ position: "relative" }}>
            <Reveal anim="fade">
              <div style={{ fontFamily: HAND, fontSize: 50, lineHeight: 1.15, textShadow: shadow }}>Địa điểm tổ chức</div>
              {d.venue.name && <div style={{ fontFamily: HAND, fontSize: 58, lineHeight: 1.05, marginTop: 14, textShadow: shadow }}>{d.venue.name}</div>}
            </Reveal>
            {d.venue.address && (
              <div style={{ background: "rgba(255,255,255,.94)", color: INK, borderRadius: 6, padding: "12px 14px", margin: "18px 0 14px", fontSize: 16, lineHeight: 1.45 }}>{d.venue.address}</div>
            )}
            <MapBox d={d} height={180} radius={6} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, padding: "9px 30px", borderRadius: 999, background: "#fff", color: accent, fontSize: 15, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>📍 Vị trí</a>
            )}
            {d.infos.filter((i) => i.label === "Gửi xe" || i.label === "Hotline").map((i) => (
              <div key={i.label} style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.85)" }}>{i.label}: {i.value}</div>
            ))}
          </div>
        </section>
      )}

      {/* ── Album ──────────────────────────────────────────────────────── */}
      {d.trio.length > 0 && (
        <section style={{ padding: "34px 14px 10px" }}>
          <div style={{ position: "relative", textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontFamily: SERIF, fontSize: 40, color: INK, letterSpacing: ".02em" }}>Album</div>
            <div style={{ position: "absolute", right: 22, top: -8, fontFamily: HAND, fontSize: 24, color: INK, transform: "rotate(-8deg)" }}>Anniversary</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {d.trio.map((src, i) => (
              <Reveal key={i} anim={i % 2 ? "right" : "left"} style={i % 3 === 0 ? { gridColumn: "1 / -1" } : undefined}>
                <Slot src={src} height={i % 3 === 0 ? 250 : 200} radius={4} tint={SOFT} fx="zoom" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <div style={{ padding: "36px 22px 46px", display: "flex", flexDirection: "column", gap: 34 }}>
        {d.story && (
          <Reveal anim="up">
            <div style={title}>Chuyện tình yêu</div>
            <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.8, color: INK, whiteSpace: "pre-line", textAlign: "center" }}>{d.story}</p>
          </Reveal>
        )}

        {/* Dặn dò: trang phục · hashtag */}
        {d.infos.some((i) => i.label === "Trang phục" || i.label === "Hashtag") && (
          <div style={{ display: "flex", gap: 10 }}>
            {d.infos.filter((i) => i.label === "Trang phục" || i.label === "Hashtag").map((i) => (
              <div key={i.label} style={{ flex: 1, background: SOFT, borderRadius: 6, padding: 14, textAlign: "center" }}>
                <div style={{ ...caps, fontWeight: 700 }}>{i.label}</div>
                {i.value && <div style={{ fontSize: 14, color: accent, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 20, height: 20, borderRadius: "50%", background: s, border: "1px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Đếm ngược */}
        <div>
          <div style={{ ...caps, textAlign: "center", fontWeight: 700, marginBottom: 12 }}>Cùng đếm ngược</div>
          <PhoneCountdown
            date={d.countdownTo}
            labels={["Ngày", "Giờ", "Phút", "Giây"]}
            wrap={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}
            box={{ textAlign: "center", background: accent, color: "#fff", borderRadius: 6, padding: "12px 0" }}
            num={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, lineHeight: 1 }}
            lab={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}
          />
        </div>

        {/* Mừng cưới · Xác nhận tham dự: hai nút cạnh nhau như bản gốc */}
        {(d.gifts.length > 0 || d.rsvpOn) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {d.gifts.length > 0 && (
              <details className="tm-gift">
                <summary style={{ textAlign: "center", padding: "12px 0", borderRadius: 6, border: `1.5px solid ${accent}`, color: accent, fontSize: 16, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>🎁 Mừng cưới</summary>
                <div style={{ marginTop: 12, background: accent, borderRadius: 8, padding: 16, color: "#fff", textAlign: "center" }}>
                  {d.giftNote && <p style={{ margin: "0 0 12px", fontSize: 13.5, fontStyle: "italic", lineHeight: 1.6 }}>{d.giftNote}</p>}
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    {d.gifts.map((g) => (
                      <div key={g.title} style={{ width: 160 }}>
                        <img src={g.qr} alt="" width={160} height={160} style={{ width: "100%", height: "auto", background: "#fff", borderRadius: 6 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, marginTop: 8 }}>
                          CTK: {g.bank.holder || g.fallbackName}<br />
                          STK: {g.bank.account?.replace(/\s/g, "")}<br />
                          NH: {g.bank.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
            {d.rsvpOn && (
              <div style={{ background: SOFT, borderRadius: 8, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, color: GREY }}>XÁC NHẬN THAM DỰ</div>
                <div style={{ textAlign: "center", fontSize: 14, color: accent, lineHeight: 1.6 }}>Bạn sẽ tham gia chứ?</div>
                <QuickRsvp
                  slug={d.slug}
                  note={d.c.rsvp_note}
                  labels={["Mình sẽ tham gia", "Chưa chắc chắn", "Tiếc quá, không đi được"]}
                  msg={{
                    yes: "Cảm ơn bạn đã xác nhận! Điền giúp tụi mình vài dòng nhé.",
                    maybe: "Mong rằng bạn sẽ có mặt trong ngày trọng đại của chúng mình.",
                    no: "Tiếc quá! Gửi tụi mình một lời chúc nhé.",
                  }}
                  btn={{ flex: 1, padding: "11px 4px", border: `1px solid ${accent}`, borderRadius: 6, background: "#fff", color: accent, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, cursor: "pointer" }}
                  btnOn={{ background: accent, color: "#fff" }}
                  msgStyle={{ textAlign: "center", fontSize: 13.5, color: accent, lineHeight: 1.6 }}
                />
              </div>
            )}
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={title}>Lời chúc</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${accent}`, background: SOFT, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55 }}>
                {w.wish}
                <div style={{ fontSize: 11.5, color: GREY, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <div style={{ textAlign: "center" }}>
            {d.thanksPhoto && <Slot src={d.thanksPhoto} height={260} radius={4} tint={SOFT} fx="breathe" style={{ marginBottom: 16 }} />}
            {d.thanks && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: GREY, whiteSpace: "pre-line", fontStyle: "italic" }}>{d.thanks}</p>}
          </div>
        )}

        <footer style={{ textAlign: "center" }}>
          {d.closing && <div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: GREY }}>{d.closing}</div>}
          <p style={{ fontFamily: HAND, fontSize: 46, lineHeight: 1.2, color: accent, margin: "6px 0 0" }}>Thank you!</p>
          <p style={{ fontFamily: HAND, fontSize: 28, color: INK, margin: 0 }}>{d.groom} &amp; {d.bride}</p>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
