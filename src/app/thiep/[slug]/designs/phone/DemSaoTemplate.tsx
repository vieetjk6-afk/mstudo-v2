import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import GiftBox from "./GiftBox";
import { mix, nightPalette } from "@/lib/wedding-palette";
import PhotoViewer from "./PhotoViewer";
import { Ambient, MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// ĐÊM SAO — trời sao xanh đêm, chữ viết tay bạc
//
// Nét riêng:
//   · nền TRỜI SAO phủ suốt thiệp (ba lớp chấm sao lệch nhau + ánh lấp lánh),
//     đáy bìa có DẢI NGÂN HÀ toả sáng
//   · tiêu đề mục: dòng chữ in nhỏ giữa hai ngôi sao + tên mục CHỮ VIẾT TAY
//   · khối nội dung là THẺ KÍNH MỜ viền bạc; nghi lễ trong khung VÒM
//   · lịch trình buổi tiệc có BIỂU TƯỢNG theo việc (đón khách, làm lễ, khai tiệc…)
//   · bản đồ lồng trong ô CỬA VÒM, cảm ơn trong khung ẢNH OVAL phát sáng
//   · mở thiệp: một VỆT SAO BĂNG rơi xuống rồi ảnh tròn hiện ra (xem CardIntro)
// ════════════════════════════════════════════════════════════════════════════

/*
 * Bầu trời đổi theo màu cặp đôi chọn ("Màu bầu trời"), chữ/ánh bạc cùng sắc với
 * trời — xem nightPalette. Đặt thành biến CSS ở gốc để các khối con dùng chung.
 */
const NIGHT = "var(--ds-sky)", NIGHT2 = "var(--ds-sky2)", INK = "var(--ds-ink)", MUTED = "var(--ds-muted)", SILVER = "var(--ds-silver)", LINE = "var(--ds-line)";
const GLASS = "linear-gradient(160deg, var(--ds-glass1), var(--ds-glass2))";
const DEFAULT_SKY = "#0c1230";
const CORM = "var(--font-cormorant), serif";
const HAND = "var(--font-hand), cursive";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
/** Style kèm biến CSS tuỳ chỉnh (--wed-t1, --r0…). */
type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

/** Trời sao: ba lớp chấm sao kích thước/độ sáng khác nhau, lặp lệch nhịp. */
const STARS = [
  "radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,.9), transparent 60%)",
  "radial-gradient(1.4px 1.4px at 68% 42%, rgba(255,255,255,.8), transparent 60%)",
  "radial-gradient(1px 1px at 38% 76%, rgba(220,226,255,.75), transparent 60%)",
  "radial-gradient(1.8px 1.8px at 86% 12%, rgba(255,255,255,.65), transparent 60%)",
  "radial-gradient(1px 1px at 24% 58%, rgba(255,255,255,.55), transparent 60%)",
].join(",");

function Glass({ children, style, arch }: { children: React.ReactNode; style?: React.CSSProperties; arch?: boolean }) {
  return (
    <div style={{
      position: "relative", background: GLASS, border: `1px solid ${LINE}`, borderRadius: arch ? "160px 160px 16px 16px" : 16,
      padding: arch ? "44px 20px 24px" : "26px 20px", boxShadow: "0 24px 50px -28px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.08)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", textAlign: "center", ...style,
    }}>{children}</div>
  );
}

/** Tiêu đề mục: "✦ CHỮ IN NHỎ ✦" + tên mục chữ viết tay. */
function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: CORM, fontSize: 12, letterSpacing: ".42em", textTransform: "uppercase", color: MUTED }}>✦ {kicker} ✦</div>
      <div className="wed-sheen" style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1.2, color: INK, "--wed-t1": INK, "--wed-t2": "#ffffff" } as CSSVars}>{title}</div>
    </div>
  );
}

/** Ngôi sao bốn cánh làm dấu ngăn giữa các mục. */
const Spark = () => <div aria-hidden style={{ textAlign: "center", color: SILVER, fontSize: 14, opacity: 0.8 }}>✦</div>;

/** Biểu tượng nét mảnh theo việc trong lịch trình. */
function Icon({ label }: { label: string }) {
  const k = label.toLowerCase();
  const p = { fill: "none", style: { stroke: SILVER }, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      {/đón|check|khách/.test(k) ? <><path {...p} d="M4 20V9l8-5 8 5v11" /><path {...p} d="M10 20v-6h4v6" /></>
        : /lễ|hôn|nghi|thề|vu quy|gia tiên/.test(k) ? <><circle {...p} cx="9" cy="14" r="5" /><circle {...p} cx="15" cy="14" r="5" /><path {...p} d="M10 5l2-2 2 2" /></>
        : /tiệc|khai|ăn|nhập/.test(k) ? <><path {...p} d="M8 3v7a3 3 0 0 0 6 0V3" /><path {...p} d="M11 13v8M8 21h6" /></>
        : /ảnh|chụp|giao lưu|nhảy|nhạc/.test(k) ? <><rect {...p} x="3" y="7" width="18" height="13" rx="2" /><circle {...p} cx="12" cy="13.5" r="3.5" /><path {...p} d="M8 7l2-3h4l2 3" /></>
        : <path {...p} d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z" />}
    </svg>
  );
}

export default function DemSaoTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const N = nightPalette(d.accent, DEFAULT_SKY);
  const accent = N.silver;
  const body = { fontFamily: CORM, fontSize: 16.5, lineHeight: 1.6, color: MUTED };
  const pill = { display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.06)", color: INK, borderRadius: 999, padding: "10px 24px", fontFamily: CORM, fontSize: 14, letterSpacing: ".2em", textTransform: "uppercase" as const };
  const album = [...d.pair, ...d.trio];

  return (
    <PhoneShell
      card={`${STARS}, linear-gradient(180deg, ${NIGHT} 0%, ${NIGHT2} 46%, ${NIGHT} 100%)`}
      page={mix(N.sky, "#000000", 0.5)} ink={INK} font={SANS} radius={18} accent={accent}
      vars={{ "--ds-sky": N.sky, "--ds-sky2": N.sky2, "--ds-ink": N.ink, "--ds-muted": N.muted, "--ds-silver": N.silver, "--ds-line": N.line, "--ds-glass1": N.glass1, "--ds-glass2": N.glass2 }}
      pattern={<div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: STARS, backgroundSize: "180px 220px", opacity: 0.9, pointerEvents: "none" }} />}
    >
      {/* ── Bìa: ảnh tròn phát sáng + tên viết tay + dải ngân hà ───────────── */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px 90px", overflow: "hidden", textAlign: "center" }}>
        <Ambient kind="sparkle" color="#ffffff" count={16} />
        <Ambient kind="ray" color={N.glow(0.16)} />
        <div aria-hidden style={{ position: "absolute", left: "-20%", right: "-20%", bottom: -60, height: 220, background: `radial-gradient(50% 50% at 50% 50%, ${N.glow(0.42)}, ${N.glow(0.2)} 55%, transparent 75%)`, filter: "blur(8px)" }} />
        <div style={{ position: "relative", fontFamily: CORM, fontSize: 12.5, letterSpacing: ".46em", textTransform: "uppercase", color: MUTED }}>✦ Lễ thành hôn ✦</div>
        <div style={{ position: "relative", margin: "24px 0 22px", padding: 8, borderRadius: "50%", border: `1px solid ${LINE}`, boxShadow: `0 0 60px -6px ${N.glow(0.55)}, inset 0 0 22px ${N.glow(0.25)}` }}>
          <Slot src={d.hero} height={236} width={236} radius="50%" tint="rgba(255,255,255,.06)" fx="kb gloss" lazy={false}
            fallback={<span style={{ fontFamily: HAND, fontSize: 64, color: SILVER }}>{initial(d.groom)}&amp;{initial(d.bride)}</span>} />
        </div>
        <div className="wed-ink" style={{ position: "relative", fontFamily: HAND, fontSize: 54, lineHeight: 1.05, color: INK, textShadow: `0 0 24px ${N.glow(0.55)}` }}>{d.groom}</div>
        <div style={{ position: "relative", fontFamily: HAND, fontSize: 30, color: SILVER, lineHeight: 1 }}>&amp;</div>
        <div className="wed-ink-2" style={{ position: "relative", fontFamily: HAND, fontSize: 54, lineHeight: 1.05, color: INK, textShadow: `0 0 24px ${N.glow(0.55)}` }}>{d.bride}</div>
        {d.date.valid && <div style={{ ...pill, position: "relative", marginTop: 22, letterSpacing: ".4em", fontSize: 15 }}>{d.date.day} . {d.date.month} . {d.date.year}</div>}
        {d.lunarLine && <div style={{ ...body, position: "relative", fontStyle: "italic", fontSize: 15, marginTop: 10 }}>{d.lunarLine.replace(/^Tức/, "Nhằm")}</div>}
      </section>

      <div style={{ padding: "10px 18px 40px", display: "flex", flexDirection: "column", gap: 40 }}>
        {d.quote && <p style={{ ...body, textAlign: "center", fontStyle: "italic", fontSize: 18, margin: 0, whiteSpace: "pre-line" }}>{d.quote}</p>}

        {/* ── Hai bên gia đình ─────────────────────────────────────────── */}
        {(d.hasFamilies || d.homes.groom || d.homes.bride) && (
          <Reveal anim="up">
            <Heading kicker="Hai họ" title="Hai Bên Gia Đình" />
            <Glass style={{ marginTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 14 }}>
                {([["Nhà trai", d.families.groom, d.homes.groom], null, ["Nhà gái", d.families.bride, d.homes.bride]] as const).map((col, i) =>
                  col === null ? <span key={i} style={{ background: LINE }} /> : (
                    <div key={i}>
                      <div style={{ fontFamily: CORM, fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}>{col[0]}</div>
                      <div style={{ fontFamily: CORM, fontSize: 17, lineHeight: 1.55, color: INK, whiteSpace: "pre-line", marginTop: 8 }}>{col[1] || "—"}</div>
                      {col[2] && <div style={{ ...body, fontSize: 14, marginTop: 6, whiteSpace: "pre-line" }}>{col[2]}</div>}
                    </div>
                  ),
                )}
              </div>
            </Glass>
          </Reveal>
        )}

        {/* ── Chú rể & cô dâu: hai ảnh tròn ──────────────────────────────── */}
        <Reveal anim="up">
          <div style={{ textAlign: "center", ...body, fontStyle: "italic", fontSize: 15, marginBottom: 14 }}>Trân trọng báo tin lễ thành hôn của con chúng tôi</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {d.portraits.slice().reverse().map((p, i) => (
              <div key={p.role} style={{ textAlign: "center" }}>
                <div style={{ display: "inline-block", padding: 5, borderRadius: "50%", border: `1px solid ${LINE}`, boxShadow: `0 0 30px -10px ${N.glow(0.6)}` }}>
                  <Slot src={p.photo} height={132} width={132} radius="50%" tint="rgba(255,255,255,.06)" fx="breathe"
                    fallback={<span style={{ fontFamily: HAND, fontSize: 44, color: SILVER }}>{initial(p.name)}</span>} />
                </div>
                <div style={{ fontFamily: CORM, fontSize: 11.5, letterSpacing: ".34em", textTransform: "uppercase", color: MUTED, marginTop: 10 }}>{i ? "Cô dâu" : "Chú rể"}</div>
                <div style={{ fontFamily: HAND, fontSize: 30, color: INK, lineHeight: 1.2 }}>{p.name}</div>
                {(i ? d.bios.bride : d.bios.groom) && <p style={{ ...body, fontSize: 14.5, margin: "6px 0 0" }}>{i ? d.bios.bride : d.bios.groom}</p>}
              </div>
            ))}
          </div>
        </Reveal>

        <Spark />

        {/* ── Thư mời ─────────────────────────────────────────────────────── */}
        <Reveal anim="up">
          <Heading kicker="Thư mời" title="Trân Trọng Kính Mời" />
          <Glass style={{ marginTop: 16 }}>
            <div style={{ fontFamily: HAND, fontSize: 40, color: INK, lineHeight: 1.2 }}>{d.guest || "Quý Khách"}</div>
            <div style={{ ...body, marginTop: 4 }}>tới dự bữa tiệc chung vui cùng gia đình chúng tôi</div>
            {d.pair[0] && <Slot src={d.pair[0]} height={190} radius={12} tint="rgba(255,255,255,.06)" fx="zoom develop" style={{ margin: "18px 0 6px" }} />}
            {d.startTime && <div style={{ ...body, marginTop: 14 }}>Vào lúc <span style={{ color: INK, fontSize: 21 }}>{d.startTime.replace(":", " giờ ")}</span></div>}
            {d.date.valid && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, marginTop: 10 }}>
                <div style={{ fontFamily: CORM, fontSize: 13.5, letterSpacing: ".22em", textTransform: "uppercase", color: MUTED, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "6px 0" }}>{d.date.weekday}</div>
                <div style={{ fontFamily: CORM, fontSize: 56, color: INK, lineHeight: 1, textShadow: `0 0 18px ${N.glow(0.6)}` }}>{d.date.day}</div>
                <div style={{ fontFamily: CORM, fontSize: 13.5, letterSpacing: ".22em", textTransform: "uppercase", color: MUTED, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "6px 0" }}>Tháng {d.date.month}</div>
              </div>
            )}
            {d.date.valid && <div style={{ fontFamily: CORM, fontSize: 15, letterSpacing: ".3em", color: INK, marginTop: 8 }}>{d.date.year}</div>}
            {d.lunarLine && <div style={{ ...body, fontStyle: "italic", fontSize: 14.5, marginTop: 6 }}>({d.lunarLine.replace(/^Tức/, "Nhằm")})</div>}
            {(d.venue.name || d.venue.address) && (
              <>
                <div style={{ fontFamily: CORM, fontSize: 12, letterSpacing: ".34em", textTransform: "uppercase", color: MUTED, marginTop: 16 }}>Tại</div>
                {d.venue.name && <div style={{ fontFamily: HAND, fontSize: 34, color: INK, lineHeight: 1.25 }}>{d.venue.name}</div>}
                {d.venue.address && <div style={{ ...body, fontSize: 15 }}>{d.venue.address}</div>}
              </>
            )}
          </Glass>
        </Reveal>

        {/* ── Nghi lễ: thẻ vòm ───────────────────────────────────────────── */}
        {d.events.length > 0 && (
          <div>
            <Heading kicker="Nghi lễ" title="Các Nghi Lễ" />
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
              {d.events.map((e, i) => (
                <Reveal key={i} anim="up" delay={i * 90}>
                  <Glass arch>
                    <div style={{ position: "absolute", left: "50%", top: -18, marginLeft: -18, width: 36, height: 36, borderRadius: "50%", background: NIGHT2, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon label={e.label} /></div>
                    <div style={{ fontFamily: HAND, fontSize: 32, color: INK, lineHeight: 1.2 }}>{e.label}</div>
                    <div style={{ fontFamily: CORM, fontSize: 16, color: INK, marginTop: 4 }}>
                      {[e.time, e.bits?.valid ? `${e.bits.weekday} ${e.bits.dotted}` : e.date].filter(Boolean).join(" · ")}
                    </div>
                    {e.where && <div style={{ ...body, fontSize: 15, marginTop: 4 }}>{e.where}</div>}
                    {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ ...pill, padding: "7px 18px", fontSize: 12, marginTop: 12 }}>Chỉ đường</a>}
                  </Glass>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* ── Lịch cưới + thêm vào lịch ────────────────────────────────────── */}
        {d.date.valid && (
          <Reveal anim="up">
            <Heading kicker="Save the date" title="Lịch Cưới" />
            <Glass style={{ marginTop: 16 }}>
              <MonthCalendar
                date={d.c.wedding_date} ink={INK} muted={MUTED} accent={N.heart} heartInk={N.sky} font={CORM}
                title={(m, y) => <div style={{ fontFamily: CORM, fontSize: 15, letterSpacing: ".34em", textTransform: "uppercase", color: INK, marginBottom: 12 }}>Tháng {m} · {y}</div>}
              />
            </Glass>
            {d.calendarHref && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={pill}>✦ Thêm vào lịch</a>
              </div>
            )}
          </Reveal>
        )}

        <div>
          <Heading kicker="Đếm ngược" title="Tới Ngày Chung Đôi" />
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}
            box={{ background: GLASS, border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 0", textAlign: "center" }}
            num={{ fontFamily: CORM, fontSize: 32, color: INK, lineHeight: 1, textShadow: `0 0 14px ${N.glow(0.6)}` }}
            lab={{ fontFamily: CORM, fontSize: 11.5, letterSpacing: ".2em", textTransform: "uppercase", color: MUTED, marginTop: 6 }}
          />
        </div>

        {/* ── Lịch trình buổi tiệc ───────────────────────────────────────── */}
        {d.timeline.length > 0 && (
          <Reveal anim="up">
            <Heading kicker="Timeline" title="Lịch Trình Buổi Tiệc" />
            <Glass style={{ marginTop: 16, textAlign: "left" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 72, top: 12, bottom: 12, width: 1, background: LINE }} />
                {d.timeline.map((t, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "54px 38px 1fr", alignItems: "center", gap: 12, padding: "9px 0" }}>
                    <div style={{ fontFamily: CORM, fontSize: 16, color: INK, textAlign: "right" }}>{t.time}</div>
                    <div style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", background: NIGHT2, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon label={t.label} /></div>
                    <div style={{ fontFamily: CORM, fontSize: 17, color: INK }}>{t.label}</div>
                  </div>
                ))}
              </div>
            </Glass>
          </Reveal>
        )}

        {/* ── Bản đồ trong ô cửa vòm ─────────────────────────────────────── */}
        {(d.mapEmbed || d.mapImage || d.mapHref) && (
          <Reveal anim="up">
            <Heading kicker="Bản đồ" title="Đường Tới Hôn Lễ" />
            <div style={{ marginTop: 16, padding: 8, borderRadius: "170px 170px 18px 18px", border: `1px solid ${LINE}`, background: GLASS }}>
              <div style={{ borderRadius: "164px 164px 12px 12px", overflow: "hidden" }}>
                <MapBox d={d} height={300} />
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              {d.venue.address && <div style={{ ...body, fontSize: 15, marginBottom: 12 }}>{[d.venue.name, d.venue.address].filter(Boolean).join(" · ")}</div>}
              {d.mapHref && <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ ...pill, background: INK, color: NIGHT, border: 0, fontWeight: 600 }}>Mở bản đồ</a>}
            </div>
          </Reveal>
        )}

        {d.infos.length > 0 && (
          <Glass>
            {d.infos.map((i) => (
              <div key={i.label} style={{ padding: "6px 0" }}>
                <div style={{ fontFamily: CORM, fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}>{i.label}</div>
                {i.value && <div style={{ fontFamily: CORM, fontSize: 18, color: INK }}>{i.value}</div>}
                {i.swatches && <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 8 }}>{i.swatches.map((s, k) => <span key={k} style={{ width: 26, height: 26, borderRadius: "50%", background: s, border: `1px solid ${LINE}` }} />)}</div>}
              </div>
            ))}
          </Glass>
        )}

        {/* ── Album ───────────────────────────────────────────────────────── */}
        {album.length > 0 && (
          <div>
            <Heading kicker="Album" title="Khoảnh Khắc" />
            <p style={{ ...body, textAlign: "center", fontStyle: "italic", fontSize: 15, margin: "6px 0 16px" }}>Mỗi khoảnh khắc bên nhau đều lấp lánh như sao trời</p>
            <PhotoViewer photos={album} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {album.map((src, i) => (
                <Reveal key={i} anim={i % 3 === 0 ? "iris" : "focus"} delay={(i % 3) * 110} style={{ gridColumn: i % 3 === 0 ? "1 / -1" : undefined }}>
                  <Slot src={src} pv={i} height={i % 3 === 0 ? 250 : 170} radius={12} tint="rgba(255,255,255,.06)" fx={i % 3 === 0 ? "zoom parallax" : "zoom"}
                    style={{ border: `1px solid ${LINE}` }} />
                </Reveal>
              ))}
            </PhotoViewer>
          </div>
        )}

        {d.story && (
          <Reveal anim="up">
            <Heading kicker="Chuyện tình" title="Chuyện Của Hai Ta" />
            <p style={{ ...body, margin: "14px 0 0", whiteSpace: "pre-line", textAlign: "center" }}>{d.story}</p>
          </Reveal>
        )}

        {/* ── Xác nhận, lời chúc, mừng cưới ──────────────────────────────── */}
        {d.rsvpOn && (
          <div>
            <Heading kicker="RSVP" title="Xác Nhận Tham Dự" />
            <Glass style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ ...body, margin: 0, fontSize: 15 }}>Hãy cho chúng mình biết bạn có thể tới chung vui để gia đình chuẩn bị chu đáo hơn nhé!</p>
              <QuickRsvp
                slug={d.slug}
                note={d.c.rsvp_note}
                btn={{ flex: 1, padding: "11px 4px", border: `1px solid ${LINE}`, borderRadius: 999, background: "rgba(255,255,255,.05)", color: INK, fontFamily: CORM, fontSize: 15, cursor: "pointer" }}
                btnOn={{ background: INK, color: NIGHT, fontWeight: 700 }}
                msgStyle={{ textAlign: "center", fontFamily: CORM, fontSize: 15.5, color: MUTED }}
              />
            </Glass>
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div>
            <Heading kicker="Guest book" title="Gửi Lời Chúc" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <Glass key={i} style={{ textAlign: "left", padding: "14px 16px" }}>
                  <div style={{ fontFamily: CORM, fontSize: 16, lineHeight: 1.5, color: INK }}>“{w.wish}”</div>
                  <div style={{ fontFamily: HAND, fontSize: 22, color: SILVER, marginTop: 2 }}>{w.guest_name}</div>
                </Glass>
              ))}
            </div>
          </div>
        )}

        {d.gifts.length > 0 && (
          <div>
            <Heading kicker="Mừng cưới" title="Hộp Mừng Cưới" />
            <GiftBox gifts={d.gifts} note={d.giftNote ?? "Cảm ơn tấm lòng của bạn dành cho chúng mình"} box={N.box} ribbon={N.ink} ink={INK} muted={MUTED} card={N.ink} cardInk={N.sky} font={CORM} style={{ marginTop: 18 }} />
          </div>
        )}
      </div>

      {/* ── Cảm ơn: ảnh oval phát sáng ──────────────────────────────────── */}
      <section style={{ position: "relative", padding: "20px 26px 120px", textAlign: "center", overflow: "hidden" }}>
        <Ambient kind="sparkle" color="#ffffff" count={10} />
        <div style={{ position: "relative", display: "inline-block", padding: 7, borderRadius: "50%", border: `1px solid ${LINE}`, boxShadow: `0 0 50px -10px ${N.glow(0.6)}` }}>
          <Slot src={d.thanksPhoto || d.trio[d.trio.length - 1] || d.hero} height={290} width={210} radius="50%" tint="rgba(255,255,255,.06)" fx="breathe" />
        </div>
        <div className="wed-sheen" style={{ position: "relative", fontFamily: HAND, fontSize: 58, lineHeight: 1.1, marginTop: 16, color: INK, "--wed-t1": INK, "--wed-t2": "#fff" } as CSSVars}>Thank You</div>
        <p style={{ ...body, position: "relative", margin: "8px auto 0", maxWidth: 300, whiteSpace: "pre-line" }}>{d.thanks || "Sự hiện diện của Quý khách là niềm vinh hạnh cho gia đình chúng tôi."}</p>
        {d.closing && <div style={{ position: "relative", fontFamily: HAND, fontSize: 28, color: SILVER, marginTop: 10 }}>{d.closing}</div>}
        <div style={{ position: "relative", fontFamily: HAND, fontSize: 34, color: INK, marginTop: 14 }}>{d.groom} &amp; {d.bride}</div>
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
