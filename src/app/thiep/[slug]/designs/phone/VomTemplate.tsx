import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// KHUNG VÒM — một bố cục, năm bảng màu (mật ong · xô thơm · navy · ghi · nâu)
//
// Nét riêng:
//   · bìa: thẻ trắng nổi trên nền màu, ảnh trong KHUNG OVAL viền đôi, NGÀY CƯỚI
//     XẾP DỌC chạy dọc mép phải
//   · chú rể / cô dâu: ảnh bo góc lệch trái-phải, tên xếp hai dòng, nhãn GROOM / BRIDE
//   · thẻ mời có DÒNG THỜI GIAN NGANG (đón khách → khai tiệc…)
//   · sự kiện cưới: đường dọc với TRÁI TIM đánh dấu từng lễ, mỗi lễ một link vị trí
//   · "Share the Love" (QR mừng cưới), tab "Địa chỉ tiệc cưới", cảm ơn trong CỔNG VÒM
//   · mở thiệp: HAI CÁNH CỬA VÒM mở ra (xem CardIntro)
// ════════════════════════════════════════════════════════════════════════════

export type VomPalette = { main: string; deep: string; soft: string; ink: string; card: string; line: string; page: string };

export const VOM_PALETTES: Record<string, VomPalette> = {
  "vom-matong": { main: "#d6a05b", deep: "#a26a2c", soft: "#fbf1e3", ink: "#4a2f12", card: "#fffdf9", line: "rgba(162,106,44,.28)", page: "#efdcc0" },
  "vom-xothom": { main: "#6d8b74", deep: "#4a6852", soft: "#edf3ee", ink: "#253a2c", card: "#ffffff", line: "rgba(74,104,82,.26)", page: "#d6e2d8" },
  "vom-navy":   { main: "#2d3d6c", deep: "#1e2a4f", soft: "#dce7f4", ink: "#1f2a4a", card: "#fffdf8", line: "rgba(45,61,108,.24)", page: "#c9d7ea" },
  "vom-ghi":    { main: "#7c948c", deep: "#58706a", soft: "#eef2f0", ink: "#2e3b37", card: "#ffffff", line: "rgba(88,112,106,.26)", page: "#d9e1de" },
  "vom-nau":    { main: "#a86f3f", deep: "#7c4d26", soft: "#f8efe6", ink: "#4a2d16", card: "#ffffff", line: "rgba(124,77,38,.26)", page: "#ead8c5" },
};

const SERIF = "var(--font-cormorant), serif";
const PLAY = "var(--font-playfair), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-hand), cursive";

export default function VomTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const P = VOM_PALETTES[inv.template] ?? VOM_PALETTES["vom-xothom"];
  const accent = d.accent || P.main;
  const label = { fontFamily: SANS, fontSize: 10.5, letterSpacing: ".34em", textTransform: "uppercase" as const, color: P.deep };
  const muted = { fontFamily: SERIF, fontSize: 16, lineHeight: 1.55, color: `${P.ink}b3` };
  const card = { background: P.card, borderRadius: 22, boxShadow: `0 22px 44px -26px ${P.deep}aa`, border: `1px solid ${P.line}` };
  const H = ({ children, light }: { children: React.ReactNode; light?: boolean }) => (
    <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.1, textAlign: "center", color: light ? "#fff" : P.ink }}>{children}</div>
  );
  const vdate = d.date.valid ? `${d.date.day} • ${d.date.month} • ${d.date.year}` : "";
  const album = [...d.pair, ...d.trio];
  const portraits = d.portraits.slice().reverse(); // chú rể trước

  return (
    <PhoneShell card={P.soft} page={P.page} ink={P.ink} font={SANS} radius={18} accent={accent}>
      {/* ── Bìa: thẻ trắng + khung oval + ngày xếp dọc ────────────────────── */}
      <section style={{ background: `linear-gradient(170deg, ${P.main}, ${P.deep})`, padding: "26px 18px 30px" }}>
        <div style={{ ...card, position: "relative", padding: "40px 22px 36px", textAlign: "center", overflow: "hidden" }}>
          {vdate && (
            <>
              <div aria-hidden style={{ position: "absolute", right: 12, top: 30, writingMode: "vertical-rl", fontFamily: SANS, fontSize: 12, letterSpacing: ".42em", color: accent }}>{vdate}</div>
              <div aria-hidden style={{ position: "absolute", left: 12, bottom: 30, writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: SANS, fontSize: 12, letterSpacing: ".42em", color: accent }}>{vdate}</div>
            </>
          )}
          <div style={label}>Thiệp mời cưới</div>
          <div style={{ margin: "22px auto 0", width: 210, padding: 8, borderRadius: 999, border: `1px solid ${P.line}`, boxShadow: `0 0 0 6px ${P.card}, 0 0 0 7px ${P.line}` }}>
            <Slot src={d.hero} height={330} radius={999} tint={P.soft} fx="kb" lazy={false}
              fallback={<span style={{ fontFamily: SERIF, fontSize: 60, color: accent, opacity: 0.5 }}>{initial(d.groom)}{initial(d.bride)}</span>} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.08, color: P.ink, marginTop: 26 }}>
            <div className="wed-ink">{d.groom}</div>
            <div style={{ fontFamily: HAND, fontSize: 30, color: accent, lineHeight: 1 }}>&amp;</div>
            <div className="wed-ink-2">{d.bride}</div>
          </div>
          {d.lunarLine && <div style={{ ...muted, fontStyle: "italic", fontSize: 14.5, marginTop: 10 }}>({d.lunarLine})</div>}
        </div>
      </section>

      <div style={{ padding: "36px 18px 10px", display: "flex", flexDirection: "column", gap: 38 }}>
        {/* ── Chú rể / cô dâu: ảnh bo góc lệch hai bên ─────────────────────── */}
        {portraits.map((p, i) => {
          const right = i === 0;
          const bio = i ? d.bios.bride : d.bios.groom;
          return (
            <Reveal key={p.role} anim={right ? "right" : "left"}>
              <div style={{ display: "grid", gridTemplateColumns: right ? "1fr 1.15fr" : "1.15fr 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ order: right ? 0 : 1, textAlign: right ? "right" : "left" }}>
                  {p.name.split(/\s+/).map((w, k) => <div key={k} style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.05, color: P.ink }}>{w}</div>)}
                  <div style={{ ...label, marginTop: 10, color: accent }}>{i ? "Bride" : "Groom"}</div>
                  {bio && <p style={{ ...muted, fontSize: 14.5, margin: "8px 0 0" }}>{bio}</p>}
                  {p.sub && <p style={{ ...muted, fontSize: 13.5, margin: "4px 0 0" }}>{p.sub}</p>}
                </div>
                <div style={{ order: right ? 1 : 0, ...card, padding: 6, borderRadius: 26 }}>
                  <Slot src={p.photo} height={250} radius={20} tint={P.soft} fx="zoom"
                    fallback={<span style={{ fontFamily: SERIF, fontSize: 56, color: accent, opacity: 0.45 }}>{initial(p.name)}</span>} />
                </div>
              </div>
            </Reveal>
          );
        })}

        {/* ── Thẻ mời: giờ, ngày, nơi, dòng thời gian ngang, hai họ ─────────── */}
        <Reveal anim="up">
          <div style={{ ...card, padding: "32px 20px 28px", textAlign: "center" }}>
            <div style={{ ...label, fontSize: 12.5, color: accent }}>Trân trọng kính mời</div>
            <div style={{ display: "inline-block", margin: "12px 0 8px", border: `1px solid ${accent}`, borderRadius: 999, padding: "4px 20px", fontFamily: HAND, fontSize: 30, color: accent }}>{d.guest || "Bạn và Gia Đình"}</div>
            <div style={{ ...label, letterSpacing: ".16em", lineHeight: 1.8 }}>tới dự bữa tiệc mừng lễ thành hôn<br />của chúng tôi</div>
            <div style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 1.1, color: P.ink, margin: "18px 0" }}>
              {d.groom}<div style={{ fontFamily: HAND, fontSize: 26, color: accent }}>&amp;</div>{d.bride}
            </div>
            {d.startTime && <div style={{ ...label, fontSize: 12, color: P.ink }}>Vào lúc {d.startTime.replace(":", " giờ ")}</div>}
            {d.date.valid && (
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: P.ink, marginTop: 6 }}>
                {d.date.weekday}, ngày {d.date.day} tháng {d.date.month} năm {d.date.year}
              </div>
            )}
            {d.lunarLine && <div style={{ ...muted, fontStyle: "italic", fontSize: 14, marginTop: 4 }}>({d.lunarLine})</div>}
            {(d.venue.name || d.venue.address) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...label, fontSize: 11.5, color: accent }}>Tại</div>
                {d.venue.name && <div style={{ fontFamily: SERIF, fontSize: 22, color: P.ink, marginTop: 4 }}>{d.venue.name}</div>}
                {d.venue.address && <div style={{ ...muted, fontSize: 14.5 }}>{d.venue.address}</div>}
              </div>
            )}

            {d.timeline.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: SERIF, fontSize: 20, color: P.ink, marginBottom: 12 }}>Timeline</div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${Math.min(d.timeline.length, 4)}, 1fr)` }}>
                  <span style={{ position: "absolute", left: "8%", right: "8%", top: 5, height: 1, background: P.line }} />
                  {d.timeline.slice(0, 4).map((t, k) => (
                    <div key={k} style={{ position: "relative" }}>
                      <span style={{ display: "block", width: 11, height: 11, borderRadius: "50%", background: accent, margin: "0 auto 8px", boxShadow: `0 0 0 4px ${P.card}` }} />
                      <div style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: P.ink }}>{t.label}</div>
                      <div style={{ fontFamily: SANS, fontSize: 11.5, color: `${P.ink}99`, marginTop: 2 }}>{t.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(d.hasFamilies || d.homes.groom || d.homes.bride) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24, paddingTop: 18, borderTop: `1px solid ${P.line}` }}>
                {([["Nhà trai", d.families.groom, d.homes.groom], ["Nhà gái", d.families.bride, d.homes.bride]] as const).map(([k, fam, home]) => (
                  <div key={k}>
                    <div style={{ ...label, fontSize: 10, color: accent }}>{k}</div>
                    <div style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: P.ink, marginTop: 6, whiteSpace: "pre-line" }}>{fam || "—"}</div>
                    {home && <div style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.55, color: `${P.ink}99`, marginTop: 4, whiteSpace: "pre-line" }}>{home}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontFamily: HAND, fontSize: 28, color: accent, marginTop: 20 }}>Rất hân hạnh được đón tiếp!</div>
          </div>
        </Reveal>

        {/* ── Save the date + lịch tháng ─────────────────────────────────── */}
        {d.date.valid && (
          <Reveal anim="up">
            <H>Save the Date</H>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "12px 0 18px", fontFamily: SERIF, fontSize: 34, color: P.ink }}>
              <span>{d.date.day}</span><span style={{ width: 1, height: 30, background: P.line }} /><span>{d.date.month}</span><span style={{ width: 1, height: 30, background: P.line }} /><span>{d.date.year}</span>
            </div>
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ background: accent, color: "#fff", textAlign: "center", padding: "12px 0", fontFamily: SERIF, fontSize: 22 }}>Tháng {Number(d.date.month)} · {d.date.year}</div>
              <MonthCalendar date={d.c.wedding_date} ink={P.ink} muted={`${P.ink}88`} accent={accent} font={SANS} title={() => null} style={{ padding: "14px 10px 10px" }} />
            </div>
            {d.calendarHref && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", border: `1px solid ${P.line}`, background: P.card, borderRadius: 999, padding: "8px 20px", fontFamily: SANS, fontSize: 12, color: P.ink }}>📅 Thêm vào lịch</a>
              </div>
            )}
          </Reveal>
        )}

        <div>
          <div style={{ ...label, textAlign: "center", fontSize: 12, color: accent, marginBottom: 14 }}>Thời gian đếm ngược</div>
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "flex", justifyContent: "center", gap: 10 }}
            box={{ width: 64, background: accent, borderRadius: 14, padding: "12px 0", textAlign: "center", boxShadow: `0 10px 22px -12px ${P.deep}` }}
            num={{ fontFamily: SERIF, fontSize: 30, color: "#fff", lineHeight: 1 }}
            lab={{ fontFamily: SANS, fontSize: 10, color: "rgba(255,255,255,.85)", marginTop: 4 }}
          />
        </div>

        {/* ── Sự kiện cưới: đường dọc + tim ──────────────────────────────── */}
        {d.events.length > 0 && (
          <div>
            <H>Sự kiện cưới</H>
            <div style={{ ...card, marginTop: 18, padding: "24px 18px 8px 18px" }}>
              <div style={{ position: "relative", paddingLeft: 30 }}>
                <span style={{ position: "absolute", left: 8, top: 6, bottom: 22, width: 1, background: P.line }} />
                {d.events.map((e, i) => (
                  <Reveal key={i} anim="up" delay={i * 0.08}>
                    <div style={{ position: "relative", paddingBottom: 18 }}>
                      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden style={{ position: "absolute", left: -30, top: 0 }}>
                        <path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.2 4.5 5.9 4.5c2.3 0 3.6 1.3 4.4 2.5.4.6.9.6 1.4 0 .8-1.2 2.1-2.5 4.4-2.5 3.7 0 5.6 3.9 3.9 7.2C19.5 16.4 12 21 12 21z" fill={accent} />
                      </svg>
                      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: accent }}>{e.label}</div>
                      {e.venue && <div style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: `${P.ink}99`, marginTop: 4 }}>Tại {e.venue}</div>}
                      <div style={{ fontFamily: SANS, fontSize: 13, color: P.ink, marginTop: 4 }}>
                        {[e.time, e.bits?.valid ? `Ngày ${e.bits.day} | ${e.bits.month} | ${e.bits.year}` : e.date].filter(Boolean).join(" · ")}
                      </div>
                      {e.address && <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: P.ink, marginTop: 2 }}>{e.address}</div>}
                      {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontFamily: SANS, fontSize: 12, color: accent, textDecoration: "underline", textUnderlineOffset: 3 }}>Xem vị trí</a>}
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        )}

        {d.story && (
          <Reveal anim="up">
            <H>Câu chuyện tình yêu</H>
            <div style={{ ...card, marginTop: 18, padding: 18, display: "grid", gridTemplateColumns: d.pair[1] ? "1fr 1fr" : "1fr", gap: 14, alignItems: "center" }}>
              <p style={{ ...muted, fontSize: 15.5, margin: 0, whiteSpace: "pre-line" }}>{d.story}</p>
              {d.pair[1] && <Slot src={d.pair[1]} height={210} radius={16} tint={P.soft} fx="zoom" />}
            </div>
          </Reveal>
        )}

        {d.infos.length > 0 && (
          <div style={{ textAlign: "center" }}>
            {d.infos.map((i) => (
              <div key={i.label} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: SERIF, fontSize: 28, color: P.ink }}>{i.label === "Trang phục" ? "Dresscode" : i.label}</div>
                {i.value && <div style={{ ...muted, fontSize: 15 }}>{i.value}</div>}
                {i.swatches && <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>{i.swatches.map((s, k) => <span key={k} style={{ width: 40, height: 40, borderRadius: "50%", background: s, marginLeft: k ? -8 : 0, border: `2px solid ${P.card}`, boxShadow: "0 4px 10px rgba(0,0,0,.12)" }} />)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Album ──────────────────────────────────────────────────────── */}
      {album.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div style={{ background: accent, color: "#fff", textAlign: "center", padding: "22px 0", fontFamily: SERIF, fontSize: 34 }}>Album</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 14 }}>
            {album.map((src, i) => <Slot key={i} src={src} height={i % 4 === 0 || i % 4 === 3 ? 240 : 180} radius={16} tint={P.card} fx="zoom" style={{ boxShadow: `0 10px 22px -16px ${P.deep}` }} />)}
          </div>
        </section>
      )}

      {/* ── Xác nhận + lời chúc trên nền màu ───────────────────────────── */}
      {d.rsvpOn && (
        <section style={{ background: `linear-gradient(170deg, ${P.main}, ${P.deep})`, padding: "40px 20px", marginTop: 28 }}>
          <div style={{ fontFamily: SANS, fontSize: 20, letterSpacing: ".1em", textTransform: "uppercase", color: "#fff", textAlign: "center", lineHeight: 1.4 }}>Xác nhận và<br />gửi lời chúc</div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: "rgba(255,255,255,.85)", textAlign: "center", margin: "12px 0 18px" }}>
            Chúng tôi rất mong nhận được phản hồi của bạn để chuẩn bị chu đáo nhất. Trân trọng!
          </p>
          <QuickRsvp
            slug={d.slug}
            note={d.c.rsvp_note}
            btn={{ flex: 1, padding: "11px 4px", border: "1px solid rgba(255,255,255,.6)", borderRadius: 999, background: "transparent", color: "#fff", fontFamily: SANS, fontSize: 13, cursor: "pointer" }}
            btnOn={{ background: "#fff", color: P.deep, fontWeight: 700 }}
            msgStyle={{ textAlign: "center", fontFamily: SANS, fontSize: 13, color: "#fff" }}
            formWrap={{ background: P.card, borderRadius: 16, padding: 14, color: P.ink }}
          />
        </section>
      )}

      <div style={{ padding: "36px 18px 10px", display: "flex", flexDirection: "column", gap: 36 }}>
        {d.wishesOn && wishes.length > 0 && (
          <div>
            <div style={{ ...label, textAlign: "center", fontSize: 14, color: P.ink, borderTop: `1px solid ${P.line}`, borderBottom: `1px solid ${P.line}`, padding: "10px 0" }}>Lời chúc từ khách mời</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <div key={i} style={{ ...card, borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: accent }}>{w.guest_name}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.5, color: P.ink, marginTop: 2 }}>{w.wish}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.gifts.length > 0 && (
          <Reveal anim="up">
            <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 40, color: P.ink }}>Share <span style={{ fontFamily: SANS, fontSize: 13, letterSpacing: ".2em", verticalAlign: "middle" }}>THE</span> Love</div>
            {d.giftNote && <p style={{ ...muted, textAlign: "center", fontSize: 14.5, margin: "6px 0 0" }}>{d.giftNote}</p>}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              {d.gifts.map((g) => (
                <div key={g.title} style={{ width: 160, background: accent, color: "#fff", borderRadius: 18, padding: 12, textAlign: "center", boxShadow: `0 16px 30px -18px ${P.deep}` }}>
                  <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", marginBottom: 8 }}>{g.title}</div>
                  <img src={g.qr} alt={`Mã QR mừng ${g.title}`} width={136} height={136} style={{ width: "100%", height: "auto", background: "#fff", borderRadius: 10 }} />
                  <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, marginTop: 8 }}>{g.bank.holder || g.fallbackName}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, opacity: 0.85 }}>{g.bank.account?.replace(/\s/g, "")}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, opacity: 0.85 }}>{g.bank.name}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* ── Địa chỉ tiệc cưới: tab bo tròn trên dải màu ─────────────────── */}
      {(d.mapEmbed || d.mapImage || d.mapHref || d.venue.address) && (
        <section style={{ marginTop: 26 }}>
          <div style={{ ...label, textAlign: "center", fontSize: 13, color: P.ink, marginBottom: 14 }}>Vị trí</div>
          <div style={{ background: accent, paddingBottom: 18 }}>
            <div style={{ width: 230, margin: "0 auto", background: P.soft, borderRadius: "0 0 999px 999px", textAlign: "center", padding: "10px 0 12px", fontFamily: SANS, fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: accent }}>Địa chỉ tiệc cưới</div>
            <div style={{ margin: "16px 16px 0", padding: 6, background: P.card, borderRadius: 18 }}>
              <MapBox d={d} height={220} radius={14} />
              {!d.mapEmbed && !d.mapImage && <div style={{ ...muted, textAlign: "center", padding: 16 }}>{d.venue.address}</div>}
            </div>
            {d.mapHref && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: P.card, color: accent, borderRadius: 999, padding: "10px 28px", fontFamily: SANS, fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Chỉ đường</a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Cảm ơn trong cổng vòm ─────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(170deg, ${P.main}, ${P.deep})`, padding: "40px 22px 110px" }}>
        <div style={{ position: "relative", margin: "0 auto", maxWidth: 320, padding: 10, borderRadius: "170px 170px 0 0", border: "1px solid rgba(255,255,255,.65)" }}>
          <div style={{ borderRadius: "160px 160px 0 0", border: "1px solid rgba(255,255,255,.4)", overflow: "hidden", minHeight: 360, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
            {(d.thanksPhoto || d.hero) && <img src={d.thanksPhoto || d.hero} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />}
            <div style={{ position: "relative", padding: "0 16px 26px", textAlign: "center", color: "#fff", background: `linear-gradient(to top, ${P.deep}ee, transparent)` }}>
              <div style={{ fontFamily: PLAY, fontSize: 50, lineHeight: 1.05, textShadow: "0 4px 18px rgba(0,0,0,.25)" }}>Thank<br />you!</div>
            </div>
          </div>
        </div>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,255,255,.92)", textAlign: "center", margin: "18px auto 0", maxWidth: 310, whiteSpace: "pre-line" }}>
          {d.thanks || "Sự hiện diện của bạn là niềm vinh hạnh cho gia đình chúng tôi.\nChân thành cảm ơn!"}
        </p>
        {d.closing && <div style={{ fontFamily: HAND, fontSize: 28, color: "#fff", textAlign: "center", marginTop: 8 }}>{d.closing}</div>}
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
