import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { alpha, contrast, ensureContrast, mix, safeHex } from "@/lib/wedding-palette";
import PhotoViewer from "./PhotoViewer";
import { Ambient, MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// XANH RÊU — ảnh tràn viền, trắng tinh và một màu xanh rêu đậm
//
// Nét riêng:
//   · bìa là ẢNH TRÀN MÀN HÌNH: dải tối trên ghi "SAVE THE DATE", tên cô dâu
//     chú rể chữ trắng khổ lớn XẾP LỆCH nhau ở chân ảnh, lá rêu rơi chầm chậm
//   · "lá thư": ảnh vuông bóng đổ sâu + đoạn tâm sự chữ nhỏ + một nét chỉ dọc
//   · lịch tháng tiêu đề kiểu tạp chí (MON…SUN), dải ảnh "ALL OF ME · The · ALL OF YOU"
//   · lịch trình dạng TRỤC GIỮA, mốc giờ so le hai bên
//   · khối màu rêu "Our Album" với ảnh viền trắng nghiêng nhẹ; cảm ơn trong CỔNG VÒM
//   · ảnh "rửa phim" (nhạt rồi đậm màu dần khi cuộn tới)
//   · mở thiệp: VÒNG LÁ tự vẽ quanh tên khách rồi lá bung bay (xem CardIntro)
//
// Màu: một màu cặp đôi chọn (mặc định xanh rêu) cho khối màu, chữ nhấn, nút.
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_MOSS = "#56622a";
const PLAY = "var(--font-playfair), serif";
const CORM = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-hand), cursive";

function palette(color?: string) {
  const main = safeHex(color, DEFAULT_MOSS);
  const ink = ensureContrast(mix(main, "#1b1d16", 0.55), "#ffffff", 9);
  return {
    main, ink,
    text: ensureContrast(main, "#ffffff", 4.6, "#000000"),
    soft: mix(main, "#ffffff", 0.93),
    muted: mix(ink, "#ffffff", 0.42),
    line: alpha(main, 0.3),
    onMain: contrast("#ffffff", main) >= 3 ? "#ffffff" : ensureContrast(mix(main, "#000000", 0.7), main, 4.5),
    shade: alpha(mix(main, "#000000", 0.55), 0.38),
  };
}

export default function ReuTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const P = palette(d.accent);
  const album = [...d.pair, ...d.trio];
  const first = (s: string) => s.split(/\s+/).slice(-1)[0];
  const kicker = { fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: ".26em", textTransform: "uppercase" as const, color: P.text };
  const small = { fontFamily: SANS, fontSize: 12.5, lineHeight: 1.75, color: P.text };
  const btn = { display: "inline-flex", alignItems: "center", gap: 6, background: P.main, color: P.onMain, borderRadius: 999, padding: "9px 22px", fontFamily: SANS, fontSize: 12, fontWeight: 600 };
  const shadowed = { boxShadow: `0 26px 40px -22px ${P.shade}, 0 8px 18px -12px ${P.shade}` };

  return (
    <PhoneShell card="#ffffff" page={mix(P.main, "#ffffff", 0.8)} ink={P.ink} font={SANS} radius={18} accent={P.main}>
      {/* ── Bìa: ảnh tràn viền ───────────────────────────────────────────── */}
      <section style={{ position: "relative", height: "min(100svh, 860px)", minHeight: 620, overflow: "hidden", background: mix(P.main, "#000000", 0.5) }}>
        <Slot src={d.hero} height="100%" fx="kb" lazy={false} tint={mix(P.main, "#777777", 0.6)} style={{ position: "absolute", inset: 0 }}
          fallback={<span style={{ fontFamily: PLAY, fontSize: 110, color: "rgba(255,255,255,.3)" }}>{initial(d.groom)}{initial(d.bride)}</span>} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(40,40,40,.78) 0%, rgba(40,40,40,.18) 26%, transparent 40%, transparent 55%, rgba(30,30,30,.72) 100%)" }} />
        <Ambient kind="leaf" color="rgba(255,255,255,.75)" color2={alpha(mix(P.main, "#ffffff", 0.35), 0.9)} count={10} />
        <div style={{ position: "absolute", top: 46, left: 0, right: 0, textAlign: "center", color: "#fff", zIndex: 2 }}>
          <div className="wed-ink" style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, letterSpacing: ".3em" }}>SAVE THE DATE</div>
          {d.date.valid && <div className="wed-ink-2" style={{ fontFamily: SANS, fontSize: 13, letterSpacing: ".3em", marginTop: 8 }}>{d.date.dotted}</div>}
        </div>
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 34, color: "#fff", zIndex: 2, textShadow: "0 4px 24px rgba(0,0,0,.35)" }}>
          <div className="wed-ink" style={{ fontFamily: PLAY, fontSize: 64, lineHeight: 0.95 }}>{first(d.groom)}</div>
          <div style={{ fontFamily: PLAY, fontSize: 30, lineHeight: 1, textAlign: "center", margin: "-4px 0" }}>&amp;</div>
          <div className="wed-ink-2" style={{ fontFamily: PLAY, fontSize: 64, lineHeight: 0.95, textAlign: "right" }}>{first(d.bride)}</div>
        </div>
      </section>

      <div style={{ padding: "48px 22px 10px", display: "flex", flexDirection: "column", gap: 48 }}>
        {/* ── Lá thư ───────────────────────────────────────────────────── */}
        <Reveal anim="up">
          <div style={{ textAlign: "center" }}>
            <Slot src={d.pair[0] || d.hero} height={230} width={230} radius={4} tint={P.soft} fx="develop" style={{ margin: "0 auto", ...shadowed }} label="" />
            <p style={{ ...small, margin: "28px auto 0", maxWidth: 320, whiteSpace: "pre-line" }}>
              {d.quote || "Tình yêu là khi anh và em cùng nắm tay nhau bước qua những tháng ngày bình yên lẫn giông bão. Ngày hôm nay, chúng mình muốn được chia sẻ niềm hạnh phúc ấy cùng bạn."}
            </p>
            <div aria-hidden className="wed-rule" style={{ width: 1, height: 56, background: P.main, margin: "20px auto 0", transformOrigin: "top" }} />
          </div>
        </Reveal>

        {/* ── Lịch tháng ───────────────────────────────────────────────── */}
        {d.date.valid && (
          <Reveal anim="up">
            <MonthCalendar date={d.c.wedding_date} ink={P.ink} muted={P.text} accent={P.main} heartInk={P.onMain} font={SANS} cell={36}
              heads={["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]}
              title={(m) => <div style={{ fontFamily: PLAY, fontSize: 30, color: P.text, textAlign: "center", marginBottom: 16 }}>Tháng {String(m).padStart(2, "0")}</div>} />
            {d.calendarHref && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: "transparent", color: P.text, border: `1px solid ${P.line}` }}>📅 Thêm vào lịch</a>
              </div>
            )}
          </Reveal>
        )}
      </div>

      {/* ── Dải ảnh "All of me · The · All of you" ─────────────────────── */}
      <section style={{ position: "relative", height: 320, overflow: "hidden", marginTop: 40, color: "#fff" }}>
        <Slot src={d.pair[1] || d.hero} height="100%" fx="pan" tint={mix(P.main, "#777777", 0.6)} style={{ position: "absolute", inset: 0 }} label="" />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(50,50,50,.5), rgba(255,255,255,0) 45%, rgba(50,50,50,.55))" }} />
        <div style={{ position: "absolute", left: 22, top: 70, fontFamily: SANS, fontSize: 15, letterSpacing: ".2em" }}>ALL OF ME</div>
        <Reveal anim="blur" style={{ position: "absolute", left: 0, right: 0, top: 104, textAlign: "center" }}>
          <div style={{ fontFamily: PLAY, fontSize: 64, textShadow: "0 4px 24px rgba(0,0,0,.3)" }}>The</div>
        </Reveal>
        <div style={{ position: "absolute", right: 22, top: 196, fontFamily: SANS, fontSize: 15, letterSpacing: ".2em" }}>ALL OF YOU</div>
      </section>

      <div style={{ padding: "48px 22px 10px", display: "flex", flexDirection: "column", gap: 48 }}>
        {/* ── Thư mời ──────────────────────────────────────────────────── */}
        <Reveal anim="up">
          <div style={{ textAlign: "center" }}>
            <div style={kicker}>Trân trọng kính mời</div>
            <div style={{ display: "inline-block", margin: "12px 0", border: `1px solid ${P.text}`, borderRadius: 999, padding: "5px 20px", fontFamily: CORM, fontSize: 20, fontWeight: 600, color: P.text }}>{d.guest || "Bạn và Gia Đình"}</div>
            <div style={{ ...kicker, fontSize: 10.5, letterSpacing: ".14em", lineHeight: 1.8 }}>Tới dự bữa tiệc chung vui<br />cùng gia đình chúng tôi</div>
            <div style={{ fontFamily: PLAY, fontSize: 42, lineHeight: 1.15, color: P.text, margin: "20px 0" }}>
              {d.groom}<div style={{ fontFamily: PLAY, fontSize: 26 }}>&amp;</div>{d.bride}
            </div>
            {d.startTime && <div style={{ ...kicker, fontSize: 12.5, letterSpacing: ".12em" }}>Vào lúc {d.startTime.replace(":", " giờ ")}</div>}
            {d.date.valid && <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: P.text, marginTop: 4 }}>{d.date.weekday}, ngày {d.date.day} tháng {d.date.month} năm {d.date.year}</div>}
            {d.lunarLine && <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 15, color: P.muted, marginTop: 2 }}>({d.lunarLine})</div>}
            {(d.venue.name || d.venue.address) && (
              <div style={{ marginTop: 18 }}>
                <div style={{ ...kicker, fontSize: 13, letterSpacing: ".14em" }}>Tại {d.venue.name || ""}</div>
                {d.venue.address && <div style={{ ...small, color: P.muted, marginTop: 4 }}>{d.venue.address}</div>}
                {d.mapHref && <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ ...btn, marginTop: 12 }}>📍 Chỉ đường</a>}
              </div>
            )}
          </div>
        </Reveal>

        {(d.hasFamilies || d.homes.groom || d.homes.bride) && (
          <Reveal anim="up">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 14, textAlign: "center" }}>
              {([["Nhà trai", d.families.groom, d.homes.groom], null, ["Nhà gái", d.families.bride, d.homes.bride]] as const).map((x, i) =>
                x ? (
                  <div key={i}>
                    <div style={{ ...kicker, fontSize: 11 }}>{x[0]}</div>
                    <div style={{ fontFamily: SANS, fontSize: 12, lineHeight: 1.7, color: P.ink, marginTop: 6, whiteSpace: "pre-line" }}>{x[1] || "—"}</div>
                    {x[2] && <div style={{ fontFamily: SANS, fontSize: 11.5, color: P.muted, marginTop: 4, whiteSpace: "pre-line" }}>{x[2]}</div>}
                  </div>
                ) : <span key={i} style={{ background: P.line }} />,
              )}
            </div>
          </Reveal>
        )}

        {/* ── Chú rể & cô dâu ──────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {d.portraits.slice().reverse().map((p, i) => (
            <Reveal key={p.role} anim={i ? "right" : "left"}>
              <div className="wed-tilt" style={{ background: "#fff", padding: "8px 8px 14px", rotate: i ? "2deg" : "-2deg", ...shadowed, textAlign: "center" }}>
                <Slot src={p.photo} height={210} tint={P.soft} fx="develop zoom"
                  fallback={<span style={{ fontFamily: PLAY, fontSize: 64, color: P.line }}>{initial(p.name)}</span>} />
                <div style={{ ...kicker, fontSize: 9.5, marginTop: 10 }}>{i ? "Cô dâu" : "Chú rể"}</div>
                <div style={{ fontFamily: PLAY, fontSize: 19, color: P.text }}>{p.name}</div>
              </div>
              {(i ? d.bios.bride : d.bios.groom) && <p style={{ ...small, fontSize: 12, color: P.muted, textAlign: "center", margin: "12px 0 0" }}>{i ? d.bios.bride : d.bios.groom}</p>}
            </Reveal>
          ))}
        </div>

        {/* ── Các lễ ───────────────────────────────────────────────────── */}
        {d.events.length > 1 && (
          <div>
            <div style={{ fontFamily: PLAY, fontSize: 32, color: P.text, textAlign: "center", marginBottom: 16 }}>Các nghi lễ</div>
            {d.events.map((e, i) => (
              <Reveal key={i} anim="up" delay={i * 90}>
                <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 14, padding: "14px 0", borderTop: `1px solid ${P.line}` }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: PLAY, fontSize: 30, lineHeight: 1, color: P.text }}>{e.bits?.valid ? e.bits.day : "—"}</div>
                    <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: ".18em", color: P.muted }}>{e.bits?.valid ? `THÁNG ${e.bits.month}` : ""}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: P.text }}>{e.label}</div>
                    <div style={{ ...small, color: P.ink }}>{[e.time, e.venue].filter(Boolean).join(" · ")}</div>
                    {e.address && <div style={{ ...small, fontSize: 12, color: P.muted }}>{e.address}</div>}
                    {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: P.text, textDecoration: "underline", textUnderlineOffset: 3 }}>Chỉ đường</a>}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* ── Lịch trình trục giữa ─────────────────────────────────────── */}
        {d.timeline.length > 0 && (
          <div>
            <div style={{ fontFamily: PLAY, fontSize: 34, color: P.text, textAlign: "center", marginBottom: 20 }}>Timeline</div>
            <div style={{ position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: P.main }} />
              {d.timeline.map((t, i) => {
                const left = i % 2 === 0;
                return (
                  <Reveal key={i} anim={left ? "left" : "right"} delay={i * 100}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 30px 1fr", alignItems: "center", padding: "10px 0" }}>
                      <div style={{ textAlign: "right", visibility: left ? "visible" : "hidden" }}>
                        <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: P.text }}>{t.time}</div>
                        <div style={{ ...small, color: P.ink }}>{t.label}</div>
                      </div>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fff", border: `2px solid ${P.main}`, margin: "0 auto", position: "relative" }} />
                      <div style={{ textAlign: "left", visibility: left ? "hidden" : "visible" }}>
                        <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: P.text }}>{t.time}</div>
                        <div style={{ ...small, color: P.ink }}>{t.label}</div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        )}

        {d.story && (
          <Reveal anim="up">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: PLAY, fontSize: 30, color: P.text }}>Chuyện của chúng mình</div>
              <p style={{ ...small, fontSize: 13.5, color: P.ink, margin: "14px auto 0", maxWidth: 330, whiteSpace: "pre-line" }}>{d.story}</p>
            </div>
          </Reveal>
        )}
      </div>

      {/* ── Khối rêu "Our Album" ─────────────────────────────────────────── */}
      {album.length > 0 && (
        <section style={{ background: P.main, color: P.onMain, padding: "44px 18px 40px", marginTop: 44 }}>
          <div style={{ textAlign: "center", fontFamily: PLAY, fontSize: 42, lineHeight: 1.15 }}>Our<br />Album</div>
          <PhotoViewer photos={album} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 26 }}>
            {album.map((src, i) => (
              <Reveal key={i} anim={i % 2 ? "right" : "left"} delay={(i % 2) * 120} style={{ gridColumn: i % 5 === 0 ? "1 / -1" : undefined }}>
                <div className="wed-tilt" style={{ background: "#fff", padding: 6, rotate: i % 5 === 0 ? "0deg" : i % 2 ? "1.5deg" : "-1.5deg", boxShadow: "0 18px 30px -18px rgba(0,0,0,.55)" }}>
                  <Slot src={src} pv={i} height={i % 5 === 0 ? 240 : 190} tint={P.soft} fx="develop" />
                </div>
              </Reveal>
            ))}
          </PhotoViewer>
        </section>
      )}

      <div style={{ padding: "44px 22px 10px", display: "flex", flexDirection: "column", gap: 44 }}>
        {/* ── Đếm ngược ────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: PLAY, fontSize: 36, color: P.text }}>Count Down</div>
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}
            box={{ width: 70, padding: "12px 0", background: P.main, borderRadius: 10, textAlign: "center", ...shadowed }}
            num={{ fontFamily: SANS, fontSize: 26, fontWeight: 600, color: P.onMain, lineHeight: 1 }}
            lab={{ fontFamily: SANS, fontSize: 10, letterSpacing: ".14em", color: alpha(P.onMain, 0.85), marginTop: 6 }}
          />
        </div>

        {/* ── Xác nhận tham dự ─────────────────────────────────────────── */}
        {d.rsvpOn && (
          <div id="xac-nhan" style={{ background: P.soft, borderRadius: 20, padding: "28px 18px", scrollMarginTop: 20 }}>
            <div style={{ fontFamily: PLAY, fontSize: 36, color: P.text, textAlign: "center" }}>Xác Nhận</div>
            <p style={{ ...small, color: P.ink, textAlign: "center", margin: "8px 0 18px" }}>Hãy xác nhận sự hiện diện của bạn để gia đình chúng tôi đón tiếp chu đáo nhất. Trân trọng!</p>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "11px 4px", border: `1px solid ${P.main}`, borderRadius: 999, background: "#fff", color: P.text, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: P.main, color: P.onMain }}
              msgStyle={{ textAlign: "center", fontFamily: SANS, fontSize: 13, color: P.ink }}
              formWrap={{ background: "#fff", borderRadius: 14, padding: 14, color: P.ink }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div>
            <div style={{ fontFamily: PLAY, fontSize: 30, color: P.text, textAlign: "center" }}>Lời chúc</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${P.main}`, background: P.soft, borderRadius: "0 12px 12px 0", padding: "10px 14px" }}>
                  <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: P.text }}>{w.guest_name}</div>
                  <div style={{ fontFamily: CORM, fontSize: 16.5, lineHeight: 1.5, color: P.ink }}>{w.wish}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.gifts.length > 0 && (
          <Reveal anim="up">
            <div style={{ fontFamily: PLAY, fontSize: 30, color: P.text, textAlign: "center" }}>Hộp mừng cưới</div>
            {d.giftNote && <p style={{ ...small, color: P.muted, textAlign: "center", margin: "6px 0 0" }}>{d.giftNote}</p>}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {d.gifts.map((g) => (
                <div key={g.title} style={{ width: 160, background: P.main, color: P.onMain, borderRadius: 14, padding: 10, textAlign: "center", ...shadowed }}>
                  <div style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: ".22em", textTransform: "uppercase", marginBottom: 8 }}>Mừng {g.title}</div>
                  <img src={g.qr} alt={`Mã QR mừng ${g.title}`} width={140} height={140} style={{ width: "100%", height: "auto", background: "#fff", borderRadius: 8 }} />
                  <div style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, marginTop: 8 }}>{g.bank.holder || g.fallbackName}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, opacity: 0.85 }}>{g.bank.account?.replace(/\s/g, "")} · {g.bank.name}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* ── Bản đồ trong khung vòm ───────────────────────────────────── */}
        {(d.mapEmbed || d.mapImage) && (
          <Reveal anim="iris">
            <div style={{ borderRadius: "999px 999px 0 0", overflow: "hidden", ...shadowed, border: "8px solid #fff" }}>
              <MapBox d={d} height={340} />
            </div>
            {d.mapHref && <div style={{ textAlign: "center", marginTop: 16 }}><a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={btn}>📍 Mở bản đồ</a></div>}
          </Reveal>
        )}
      </div>

      {/* ── Cảm ơn trong cổng vòm ─────────────────────────────────────────── */}
      <section style={{ padding: "40px 26px 120px", textAlign: "center" }}>
        <Reveal anim="up">
          <div style={{ position: "relative", maxWidth: 300, margin: "0 auto", borderRadius: "999px 999px 0 0", overflow: "hidden", ...shadowed }}>
            <Slot src={d.thanksPhoto || d.hero} height={400} tint={P.soft} fx="kb-r" label="" />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "60px 10px 24px", background: `linear-gradient(transparent, ${alpha(mix(P.main, "#000000", 0.4), 0.75)})`, color: "#fff" }}>
              <div style={{ fontFamily: PLAY, fontSize: 48, lineHeight: 1.02, textShadow: "0 4px 18px rgba(0,0,0,.35)" }}>Thank<br />you!</div>
            </div>
          </div>
        </Reveal>
        <p style={{ ...small, fontSize: 13.5, color: P.ink, margin: "20px auto 0", maxWidth: 300, whiteSpace: "pre-line" }}>
          {d.thanks || "Sự hiện diện của bạn là niềm vinh hạnh cho gia đình chúng tôi.\nChân thành cảm ơn!"}
        </p>
        {d.closing && <div style={{ fontFamily: HAND, fontSize: 30, color: P.text, marginTop: 10 }}>{d.closing}</div>}
        <div style={{ fontFamily: PLAY, fontSize: 22, color: P.text, marginTop: 14 }}>{d.groom} &amp; {d.bride}</div>
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
