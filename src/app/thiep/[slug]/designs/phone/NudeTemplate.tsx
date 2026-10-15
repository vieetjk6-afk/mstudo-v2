import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { alpha, contrast, ensureContrast, mix, safeHex } from "@/lib/wedding-palette";
import GiftBox from "./GiftBox";
import PhotoViewer from "./PhotoViewer";
import { Ambient, MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// NUDE NGỌT — hồng nude, thẻ NỔI MỀM (neumorphism), chữ tên khổng lồ chồng lớp
//
// Nét riêng:
//   · mọi khối là thẻ nổi mềm: bóng sáng góc trên-trái + bóng tối góc dưới-phải
//   · bìa: "Together for life", chữ dọc HAPPY WEDDING, NGÀY CƯỚI CỠ LỚN viền trắng
//     và tên chú rể khổng lồ tràn ra mép thiệp
//   · tên cô dâu chú rể xếp chồng lệch nhau như áp phích chữ
//   · ĐĨA NHẠC xoay có ảnh cưới ở nhãn đĩa, "Count Down" chữ vàng khổ lớn
//   · album có chữ "Album" dựng dọc, xác nhận tham dự với chữ mờ khổng lồ phía sau
//   · bướm trắng bay khắp bìa; mở thiệp: VÉN MÀN VOAN, bướm bay ra (xem CardIntro)
//
// Màu: cả bảng màu suy từ một màu nude cặp đôi chọn; chữ vàng giữ cố định.
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_NUDE = "#d8b4a6";
const GOLD = "#b8893f";
const PLAY = "var(--font-playfair), serif";
const CORM = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-hand), cursive";

function palette(color?: string) {
  const main = safeHex(color, DEFAULT_NUDE);
  const card = mix(main, "#ffffff", 0.88);
  const ink = ensureContrast(mix(main, "#3a2a26", 0.6), card, 6.5);
  const deep = ensureContrast(mix(main, "#000000", 0.18), card, 2.6);
  return {
    main, deep, card, ink,
    bg: mix(main, "#ffffff", 0.74),
    bg2: mix(main, "#ffffff", 0.58),
    muted: mix(ink, card, 0.36),
    giant: alpha(mix(main, "#2b2120", 0.5), 0.42),
    hi: "rgba(255,255,255,.92)",
    lo: alpha(mix(main, "#000000", 0.45), 0.34),
    onDeep: contrast("#ffffff", deep) >= 2.6 ? "#ffffff" : ink,
  };
}
type Pal = ReturnType<typeof palette>;

/** Thẻ nổi mềm. `inset` = khối lõm vào (ô nhập, ô số đếm ngược). */
function soft(P: Pal, inset = false, radius = 26): React.CSSProperties {
  return {
    background: P.card, borderRadius: radius, border: "1px solid rgba(255,255,255,.65)",
    boxShadow: inset
      ? `inset 6px 6px 14px -6px ${P.lo}, inset -6px -6px 14px -6px ${P.hi}`
      : `12px 14px 30px -12px ${P.lo}, -12px -12px 26px -12px ${P.hi}`,
  };
}

/** Đĩa than xoay — nhãn đĩa là ảnh cưới. */
function Vinyl({ photo, P, size = 150 }: { photo?: string; P: Pal; size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div className="nu-spin" style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "repeating-radial-gradient(circle, #1d1a1a 0 2px, #2b2727 2px 3px), radial-gradient(circle, #222 0 60%, #111 100%)",
        boxShadow: `10px 14px 26px -10px ${P.lo}`,
      }}>
        <div style={{ position: "absolute", inset: "31%", borderRadius: "50%", overflow: "hidden", background: P.main, border: `3px solid ${P.card}` }}>
          {photo && <img src={photo} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <span style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 8, margin: -4, borderRadius: "50%", background: P.card }} />
        <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(130deg, rgba(255,255,255,.18), transparent 40%)" }} />
      </div>
    </div>
  );
}

export default function NudeTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const P = palette(d.accent);
  const album = [...d.pair, ...d.trio];
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  const kicker = { fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: ".32em", textTransform: "uppercase" as const, color: P.muted };
  const body = { fontFamily: CORM, fontSize: 16.5, lineHeight: 1.6, color: P.ink };
  const giant = (size: number): React.CSSProperties => ({ fontFamily: PLAY, fontSize: size, lineHeight: 0.9, color: P.giant, letterSpacing: "-.01em" });
  const pill = { display: "inline-flex", alignItems: "center", gap: 8, ...soft(P, false, 999), padding: "10px 24px", fontFamily: SANS, fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase" as const, color: P.ink };

  return (
    <PhoneShell card={`linear-gradient(180deg, ${P.bg} 0%, ${P.bg2} 50%, ${P.bg} 100%)`} page={P.bg2} ink={P.ink} font={SANS} radius={18} accent={P.deep}>
      <style>{`
        @keyframes nuSpin { to { transform: rotate(360deg) } }
        .nu-spin { animation: nuSpin 9s linear infinite; }
        .nu-outline { color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.95); }
        @supports not (-webkit-text-stroke: 1px black) { .nu-outline { color: rgba(255,255,255,.9); } }
      `}</style>

      {/* ── Bìa ─────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100svh", padding: "26px 22px 0", overflow: "hidden" }}>
        <Ambient kind="butterfly" color="rgba(255,255,255,.95)" color2={alpha(P.main, 0.9)} count={7} />
        <div style={{ ...soft(P, false, 30), position: "relative", padding: "22px 16px 16px 40px", zIndex: 2 }}>
          <div aria-hidden style={{ position: "absolute", left: 12, bottom: 70, writingMode: "vertical-rl", transform: "rotate(180deg)", ...kicker, fontSize: 10, letterSpacing: ".6em" }}>Happy Wedding</div>
          <div className="wed-ink" style={{ fontFamily: PLAY, fontSize: 28, color: P.ink, textAlign: "center", paddingRight: 24 }}>
            Together for <span style={{ fontStyle: "italic", color: P.deep }}>life</span>
          </div>
          <div style={{ marginTop: 14, ...soft(P, true, 22), padding: 8 }}>
            <Slot src={d.hero} height={380} radius={16} tint={P.bg} fx="kb gloss" lazy={false}
              fallback={<span style={{ fontFamily: PLAY, fontSize: 80, color: P.giant }}>{initial(d.groom)}{initial(d.bride)}</span>} />
          </div>
        </div>
        {d.date.valid && (
          <div className="nu-outline wed-ink-2" style={{ position: "relative", zIndex: 3, fontFamily: PLAY, fontWeight: 700, fontSize: 84, lineHeight: 1, textAlign: "center", marginTop: -58, textShadow: `0 6px 24px ${P.lo}` }}>
            {d.date.day}.{d.date.month}
          </div>
        )}
        <div style={{ ...giant(78), position: "relative", zIndex: 1, marginTop: 6, marginLeft: -6, whiteSpace: "nowrap" }}>{words(d.groom).slice(-1)[0]}</div>
        <div style={{ ...giant(78), position: "relative", zIndex: 1, textAlign: "right", marginRight: -8, marginTop: -8, whiteSpace: "nowrap" }}>{words(d.bride).slice(-1)[0]}</div>
        <div style={{ textAlign: "center", padding: "14px 0 30px" }}>
          <span className="wed-float" style={{ ...kicker, display: "inline-block", ...soft(P, false, 999), padding: "8px 18px", color: P.ink }}>Kéo xuống ↓</span>
        </div>
      </section>

      <div style={{ padding: "20px 22px 10px", display: "flex", flexDirection: "column", gap: 46 }}>
        {/* ── Tên xếp chồng như áp phích ─────────────────────────────────── */}
        <Reveal anim="blur">
          <div style={{ position: "relative" }}>
            {words(d.groom).map((w, i) => <div key={`g${i}`} style={{ ...giant(66), color: i ? P.giant : alpha(P.ink, 0.62), marginLeft: i * 34 }}>{w}</div>)}
            <div style={{ fontFamily: HAND, fontSize: 54, color: P.deep, lineHeight: 0.9, textAlign: "center", margin: "-6px 0" }}>&amp;</div>
            {words(d.bride).map((w, i, arr) => <div key={`b${i}`} style={{ ...giant(66), color: i === arr.length - 1 ? alpha(P.ink, 0.62) : P.giant, textAlign: "right", marginRight: (arr.length - 1 - i) * 30 }}>{w}</div>)}
          </div>
        </Reveal>

        {d.quote && <p style={{ ...body, fontStyle: "italic", fontSize: 18, textAlign: "center", margin: 0, whiteSpace: "pre-line" }}>{d.quote}</p>}

        {/* ── Save the date + lịch ──────────────────────────────────────── */}
        {d.date.valid && (
          <Reveal anim="up">
            <div className="wed-sheen" style={{ fontFamily: HAND, fontSize: 52, textAlign: "center", color: GOLD, "--wed-t1": GOLD, "--wed-t2": "#fff3d6" } as React.CSSProperties}>Save The Date</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "12px 0 22px" }}>
              {[d.date.day, d.date.month, d.date.year].map((v, i) => (
                <div key={i} style={{ ...soft(P, false, 18), width: i === 2 ? 96 : 70, padding: "14px 0", textAlign: "center", fontFamily: PLAY, fontSize: 30, color: P.ink }}>{v}</div>
              ))}
            </div>
            <div style={{ ...soft(P), padding: "18px 12px 12px" }}>
              <MonthCalendar date={d.c.wedding_date} ink={P.ink} muted={P.muted} accent={P.deep} heartInk={P.onDeep} font={SANS}
                title={(m, y) => <div style={{ fontFamily: PLAY, fontSize: 22, color: P.ink, textAlign: "center", marginBottom: 12 }}>Tháng {m} · {y}</div>} />
              {d.calendarHref && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={{ ...pill, fontSize: 10.5, padding: "8px 18px" }}>📅 Thêm vào lịch</a>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ── Gia đình + lễ thành hôn ────────────────────────────────────── */}
        <Reveal anim="up">
          <div style={{ ...soft(P), padding: "26px 18px", textAlign: "center" }}>
            {(d.hasFamilies || d.homes.groom || d.homes.bride) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {([["Nhà trai", d.families.groom, d.homes.groom], ["Nhà gái", d.families.bride, d.homes.bride]] as const).map(([k, fam, home]) => (
                  <div key={k}>
                    <div style={{ ...kicker, color: P.ink, fontSize: 10 }}>{k}</div>
                    <div style={{ ...body, fontSize: 14.5, marginTop: 6, whiteSpace: "pre-line" }}>{fam || "—"}</div>
                    {home && <div style={{ ...body, fontStyle: "italic", fontSize: 13.5, color: P.muted, whiteSpace: "pre-line" }}>{home}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontFamily: PLAY, fontSize: 30, color: P.ink }}>Lễ Thành Hôn</div>
            {d.date.valid && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginTop: 16, color: P.ink }}>
                <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 17 }}>{d.date.weekday}</div>
                <div style={{ borderLeft: `1px solid ${alpha(P.ink, 0.25)}`, borderRight: `1px solid ${alpha(P.ink, 0.25)}`, padding: "0 18px" }}>
                  <div style={{ fontFamily: CORM, fontSize: 14 }}>Ngày</div>
                  <div style={{ fontFamily: PLAY, fontSize: 42, lineHeight: 1 }}>{d.date.day}</div>
                  <div style={{ fontFamily: CORM, fontSize: 14 }}>Tháng {d.date.month}</div>
                </div>
                <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 17 }}>Năm<br />{d.date.year}</div>
              </div>
            )}
            {d.lunarLine && <div style={{ ...body, fontStyle: "italic", fontSize: 14.5, color: P.muted, marginTop: 10 }}>({d.lunarLine})</div>}
          </div>
        </Reveal>

        {/* ── Cô dâu & chú rể + đĩa nhạc ─────────────────────────────────── */}
        <div style={{ position: "relative" }}>
          {d.portraits.slice().reverse().map((p, i) => {
            const bio = i ? d.bios.bride : d.bios.groom;
            return (
              <Reveal key={p.role} anim={i ? "right" : "left"} style={{ marginTop: i ? 26 : 0 }}>
                <div style={{ ...soft(P, false, 28), padding: 8 }}>
                  <div style={{ position: "relative", borderRadius: 22, overflow: "hidden" }}>
                    <Slot src={p.photo} height={330} tint={P.bg2} fx="zoom parallax"
                      fallback={<span style={{ fontFamily: PLAY, fontSize: 90, color: P.giant }}>{initial(p.name)}</span>} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.42), transparent 34%, transparent 70%, rgba(0,0,0,.3))", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", left: 0, right: 0, top: 16, textAlign: "center", color: "#fff" }}>
                      <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".5em", textTransform: "uppercase", opacity: 0.9 }}>{p.role}</div>
                      <div style={{ fontFamily: PLAY, fontSize: 40, lineHeight: 1.1, textShadow: "0 4px 18px rgba(0,0,0,.3)" }}>{words(p.name).slice(-1)[0]}</div>
                    </div>
                  </div>
                  {(bio || p.sub) && (
                    <div style={{ padding: "12px 10px 6px", textAlign: "center" }}>
                      <div style={{ fontFamily: PLAY, fontSize: 18, color: P.ink }}>{p.name}</div>
                      {p.sub && <div style={{ ...body, fontStyle: "italic", fontSize: 14, color: P.muted }}>{p.sub}</div>}
                      {bio && <p style={{ ...body, fontSize: 15, margin: "4px 0 0" }}>{bio}</p>}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 26 }}>
            <Vinyl photo={d.hero} P={P} />
            <div>
              <div style={{ ...kicker, fontSize: 9.5 }}>♪ Our song</div>
              <div style={{ fontFamily: HAND, fontSize: 34, color: P.deep, lineHeight: 1.1 }}>{d.groom.split(/\s+/).slice(-1)[0]} &amp; {d.bride.split(/\s+/).slice(-1)[0]}</div>
              <div style={{ height: 3, width: 120, borderRadius: 3, background: alpha(P.ink, 0.15), marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "62%", background: P.deep }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Thư mời ───────────────────────────────────────────────────── */}
        <Reveal anim="up">
          <div style={{ ...soft(P), padding: "30px 18px", textAlign: "center" }}>
            <div style={{ fontFamily: PLAY, fontSize: 24, color: P.muted }}>Trân Trọng Kính Mời</div>
            <div style={{ display: "inline-block", margin: "12px 0", ...soft(P, true, 999), padding: "6px 26px", fontFamily: HAND, fontSize: 34, color: GOLD }}>{d.guest || "Quý Khách"}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: P.ink, lineHeight: 1.7 }}>Tới dự buổi tiệc mừng cưới<br />cùng gia đình</div>
            <div style={{ height: 1, background: alpha(P.ink, 0.15), margin: "20px 0" }} />
            {d.startTime && <div style={{ ...kicker, color: P.ink }}>Vào lúc {d.startTime} {d.date.weekday ? `· ${d.date.weekday}` : ""}</div>}
            {d.date.valid && <div style={{ fontFamily: PLAY, fontSize: 34, color: GOLD, margin: "6px 0 2px" }}>{d.date.dotted}</div>}
            {d.lunarLine && <div style={{ ...body, fontStyle: "italic", fontSize: 14, color: P.muted }}>({d.lunarLine})</div>}
            {(d.venue.name || d.venue.address) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...kicker, color: P.ink }}>Tại</div>
                {d.venue.name && <div style={{ fontFamily: PLAY, fontSize: 24, color: P.ink, marginTop: 4 }}>{d.venue.name}</div>}
                {d.venue.address && <div style={{ ...body, fontSize: 14.5, color: P.muted }}>{d.venue.address}</div>}
              </div>
            )}
            {d.timeline.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontFamily: PLAY, fontSize: 18, color: P.ink, marginBottom: 12 }}>TimeLine</div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${Math.min(d.timeline.length, 4)}, 1fr)` }}>
                  <span style={{ position: "absolute", left: "10%", right: "10%", top: 5, height: 1, background: alpha(P.ink, 0.25) }} />
                  {d.timeline.slice(0, 4).map((t, k) => (
                    <div key={k} style={{ position: "relative" }}>
                      <span className="wed-heartbeat" style={{ display: "block", width: 11, height: 11, borderRadius: "50%", background: P.deep, margin: "0 auto 8px", boxShadow: `0 0 0 4px ${P.card}`, animationDelay: `${k * 0.4}s` }} />
                      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: P.ink }}>{t.label}</div>
                      <div style={{ fontFamily: SANS, fontSize: 11, color: P.muted }}>{t.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontFamily: HAND, fontSize: 28, color: P.deep, marginTop: 20 }}>Rất hân hạnh được đón tiếp!</div>
          </div>
        </Reveal>

        {/* ── Các lễ khác ───────────────────────────────────────────────── */}
        {d.events.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {d.events.map((e, i) => (
              <Reveal key={i} anim="up" delay={i * 90}>
                <div style={{ ...soft(P, false, 20), padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ ...soft(P, true, 16), width: 66, padding: "10px 0", textAlign: "center", flex: "none" }}>
                    <div style={{ fontFamily: PLAY, fontSize: 24, color: P.ink, lineHeight: 1 }}>{e.bits?.valid ? e.bits.day : "—"}</div>
                    <div style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: ".14em", color: P.muted }}>{e.bits?.valid ? `TH ${e.bits.month}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontFamily: PLAY, fontSize: 18, color: P.ink }}>{e.label}</div>
                    <div style={{ fontFamily: SANS, fontSize: 12, color: P.muted }}>{[e.time, e.venue].filter(Boolean).join(" · ")}</div>
                    {e.address && <div style={{ fontFamily: SANS, fontSize: 11.5, color: P.muted }}>{e.address}</div>}
                    {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 700, color: P.deep, textDecoration: "underline", textUnderlineOffset: 3 }}>Chỉ đường</a>}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* ── Bản đồ trong khung vòm nổi ─────────────────────────────────── */}
        {(d.mapEmbed || d.mapImage || d.mapHref) && (
          <Reveal anim="zoom">
            <div style={{ ...soft(P, false, 0), borderRadius: "180px 180px 30px 30px", padding: 12 }}>
              <div style={{ ...soft(P, true, 0), borderRadius: "170px 170px 22px 22px", overflow: "hidden", padding: 6 }}>
                <MapBox d={d} height={300} radius={0} style={{ borderRadius: "164px 164px 18px 18px" }} />
              </div>
              {d.mapHref && (
                <div style={{ textAlign: "center", marginTop: -22, position: "relative" }}>
                  <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={pill}>📍 Xem bản đồ</a>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ── Đếm ngược ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "center" }}>
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "flex", flexDirection: "column", gap: 12, ...soft(P, false, 999), padding: "18px 10px" }}
            box={{ ...soft(P, true, 999), width: 64, padding: "10px 0", textAlign: "center" }}
            num={{ fontFamily: PLAY, fontStyle: "italic", fontSize: 24, color: P.ink, lineHeight: 1 }}
            lab={{ fontFamily: CORM, fontStyle: "italic", fontSize: 12.5, color: P.muted }}
          />
          <div>
            <div className="wed-sheen" style={{ fontFamily: PLAY, fontSize: 64, lineHeight: 0.95, color: GOLD, "--wed-t1": GOLD, "--wed-t2": "#fff1cf" } as React.CSSProperties}>Count<br />Down</div>
            <p style={{ ...body, fontStyle: "italic", fontSize: 15, color: P.muted, margin: "10px 0 0" }}>Cùng chúng mình đếm ngược tới ngày vui nhé!</p>
          </div>
        </div>

        {d.story && (
          <Reveal anim="up">
            <div style={{ ...soft(P), padding: "28px 20px 22px", position: "relative", overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", top: -28, left: 8, fontFamily: PLAY, fontSize: 160, color: alpha(P.main, 0.35), lineHeight: 1 }}>“</div>
              <div style={{ position: "relative", fontFamily: PLAY, fontSize: 24, color: P.ink, textAlign: "center" }}>Chuyện của chúng mình</div>
              <p style={{ ...body, position: "relative", fontSize: 16.5, margin: "12px 0 0", whiteSpace: "pre-line", textAlign: "center" }}>{d.story}</p>
            </div>
          </Reveal>
        )}

        {/* ── Album ─────────────────────────────────────────────────────── */}
        {album.length > 0 && (
          <div style={{ position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 54px", gap: 8 }}>
              <PhotoViewer photos={album} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {album.map((src, i) => (
                  <Reveal key={i} anim={i % 3 === 0 ? "iris" : "focus"} delay={(i % 2) * 120} style={{ gridColumn: i % 3 === 0 ? "1 / -1" : undefined }}>
                    <div style={{ ...soft(P, false, 20), padding: 6 }}>
                      <Slot src={src} pv={i} height={i % 3 === 0 ? 230 : 180} radius={15} tint={P.bg} fx="zoom" />
                    </div>
                  </Reveal>
                ))}
              </PhotoViewer>
              <div aria-hidden style={{ position: "relative" }}>
                <div style={{ position: "sticky", top: 30, writingMode: "vertical-rl", fontFamily: PLAY, fontSize: 66, lineHeight: 1, color: P.giant }}>Album</div>
              </div>
            </div>
            {d.date.valid && (
              <div className="nu-outline" style={{ fontFamily: PLAY, fontWeight: 700, fontSize: 52, textAlign: "center", marginTop: -18, position: "relative", textShadow: `0 6px 20px ${P.lo}` }}>{d.date.dotted}</div>
            )}
            <div style={{ ...kicker, textAlign: "center", marginTop: 6 }}>Lưu giữ khoảnh khắc</div>
          </div>
        )}

        {/* ── Xác nhận tham dự: chữ mờ khổng lồ phía sau ─────────────────── */}
        {d.rsvpOn && (
          <div id="xac-nhan" style={{ position: "relative", scrollMarginTop: 20 }}>
            <div aria-hidden style={{ ...giant(92), textAlign: "center", color: alpha("#ffffff", 0.75), textShadow: `0 8px 30px ${P.lo}` }}>Xác<br />Nhận</div>
            <div style={{ ...soft(P), position: "relative", marginTop: -60, padding: "24px 16px", boxShadow: `0 0 0 6px ${alpha("#ffffff", 0.5)}, 0 0 50px ${alpha("#ffffff", 0.8)}, 12px 14px 30px -12px ${P.lo}` }}>
              <p style={{ ...body, fontSize: 15.5, textAlign: "center", margin: "0 0 16px", color: P.muted }}>Hãy xác nhận sự hiện diện của Quý khách để gia đình chúng tôi chuẩn bị chu đáo hơn nhé!</p>
              <QuickRsvp
                slug={d.slug}
                note={d.c.rsvp_note}
                btn={{ flex: 1, padding: "12px 4px", ...soft(P, false, 999), color: P.ink, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                btnOn={{ background: P.deep, color: P.onDeep, boxShadow: `inset 4px 4px 10px -4px ${P.lo}` }}
                msgStyle={{ textAlign: "center", fontFamily: CORM, fontSize: 16, color: P.ink }}
                formWrap={{ ...soft(P, true, 18), padding: 14, color: P.ink }}
              />
            </div>
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: GOLD }}>Gửi lời nhắn</div>
              <div className="wed-sheen" style={{ fontFamily: PLAY, fontSize: 44, color: GOLD, lineHeight: 1.1, "--wed-t1": GOLD, "--wed-t2": "#fff1cf" } as React.CSSProperties}>Yêu Thương</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <div key={i} style={{ ...soft(P, false, 18), padding: "12px 16px" }}>
                  <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: P.deep }}>{w.guest_name}</div>
                  <div style={{ ...body, fontSize: 16, marginTop: 2 }}>{w.wish}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ ...soft(P), padding: "26px 16px" }}>
            <div style={{ textAlign: "center", fontFamily: PLAY, fontSize: 34, color: P.ink }}>Share <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".2em", verticalAlign: "middle" }}>THE</span> Love</div>
            <GiftBox gifts={d.gifts} note={d.giftNote ?? "Gửi quà mừng tới cô dâu chú rể"} box={P.deep} ribbon={GOLD} ink={P.ink} muted={P.muted} card={P.card} font={SANS} hint="Ấn vào hộp quà" style={{ marginTop: 14 }} />
          </div>
        )}
      </div>

      {/* ── Cảm ơn trong khung vòm nổi nhiều lớp ──────────────────────────── */}
      <section style={{ position: "relative", padding: "40px 26px 120px", textAlign: "center", overflow: "hidden" }}>
        <Ambient kind="butterfly" color="rgba(255,255,255,.95)" color2={alpha(P.main, 0.9)} count={5} />
        <div style={{ ...soft(P, false, 0), borderRadius: "999px 999px 40px 40px", padding: 14, maxWidth: 300, margin: "0 auto" }}>
          <div style={{ ...soft(P, true, 0), borderRadius: "999px 999px 30px 30px", padding: 12 }}>
            <Slot src={d.thanksPhoto || d.hero} height={330} radius="999px 999px 22px 22px" tint={P.bg} fx="breathe" />
          </div>
        </div>
        <Reveal anim="blur">
          <div style={{ ...giant(74), color: alpha(P.ink, 0.55), marginTop: -40, position: "relative" }}>Thank<br />You</div>
        </Reveal>
        <p style={{ ...body, fontStyle: "italic", fontSize: 16.5, color: P.muted, margin: "14px auto 0", maxWidth: 300, whiteSpace: "pre-line" }}>
          {d.thanks || "Sự hiện diện của bạn là niềm vinh hạnh của gia đình chúng tôi."}
        </p>
        {d.closing && <div style={{ fontFamily: HAND, fontSize: 30, color: P.deep, marginTop: 10 }}>{d.closing}</div>}
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
