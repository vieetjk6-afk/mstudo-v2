import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import GiftBox from "./GiftBox";
import { alpha, ensureContrast, mix, safeHex } from "@/lib/wedding-palette";
import PhotoViewer from "./PhotoViewer";
import { Ambient, Letters, MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData, type PhoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// ĐỎ ĐÔ — tối giản đỏ rượu vang trên nền kem
//
// Nét riêng:
//   · nền kem có NÉT VẼ HÀNG CỘT VÒM mờ (kiến trúc cổ điển) chạy suốt thiệp
//   · thông tin đặt trong THẺ ĐỎ RƯỢU VANG viền chỉ vàng, góc gắn ánh sao
//   · bìa là ba ẢNH POLAROID xếp lệch rơi xuống, tên đôi chữ Playfair đỏ đô
//   · giờ ĐÓN KHÁCH / KHAI TIỆC tách hai cột, LỊCH THÁNG khoanh tim ngày cưới
//   · âm lịch tự tính, nút THÊM VÀO LỊCH, HỘP QUÀ bấm để mở
//   · mở thiệp: phong bì đỏ đô DẤU SÁP (xem CardIntro)
// ════════════════════════════════════════════════════════════════════════════

const BG = "#f6eee4", CREAM = "#f3e6d8", GOLD = "#c8a46e";
/*
 * Màu thẻ đổi theo màu cặp đôi chọn (mặc định đỏ rượu vang): đặt thành biến CSS
 * ở gốc thiệp (xem `dodoPalette`) để cả các khối con dùng chung.
 */
const WINE = "var(--dd-wine)", WINE2 = "var(--dd-wine2)", INK = "var(--dd-ink)", MUTED = "var(--dd-muted)", LINE = "var(--dd-line)";
const DEFAULT_WINE = "#5c1822";

/** Bảng màu từ màu chọn — ép đủ ĐẬM để chữ kem trên thẻ luôn đọc được. */
function dodoPalette(color?: string) {
  const wine = ensureContrast(safeHex(color, DEFAULT_WINE), CREAM, 6, "#000000");
  const ink = ensureContrast(mix(wine, "#1c1416", 0.55), BG, 9);
  const shadow = mix(wine, "#000000", 0.35);
  return {
    wine, wine2: mix(wine, "#ffffff", 0.13), ink, muted: mix(ink, BG, 0.42), line: alpha(wine, 0.16),
    blush: mix(wine, BG, 0.86), sh: alpha(shadow, 0.5), sh2: alpha(shadow, 0.75),
  };
}
const PLAY = "var(--font-playfair), serif";
const CORM = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
/** Style kèm biến CSS tuỳ chỉnh (--wed-t1, --r0…). */
type CSSVars = React.CSSProperties & Record<`--${string}`, string>;
const HAND = "var(--font-hand), cursive";

/** Hàng cột vòm vẽ nét mảnh — nền kiến trúc mờ phía sau các khối. */
function Colonnade({ color = WINE, opacity = 0.09, style }: { color?: string; opacity?: number; style?: React.CSSProperties }) {
  const arches = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax meet" aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "auto", opacity, pointerEvents: "none", ...style }}>
      <g fill="none" style={{ stroke: color }} strokeWidth="1.2">
        {/* mái vòm giữa */}
        <path d="M150 92 Q200 30 250 92" />
        <path d="M160 92 Q200 44 240 92" />
        <line x1="200" y1="22" x2="200" y2="40" />
        <circle cx="200" cy="19" r="3.5" />
        <line x1="140" y1="92" x2="260" y2="92" />
        {/* dãy cửa vòm */}
        {arches.map((i) => {
          const x = 20 + i * 76;
          return (
            <g key={i}>
              <path d={`M${x} 220 V140 Q${x + 26} 106 ${x + 52} 140 V220`} />
              <path d={`M${x + 8} 220 V146 Q${x + 26} 120 ${x + 44} 146 V220`} />
              <line x1={x + 60} y1="128" x2={x + 60} y2="220" />
              <line x1={x + 66} y1="128" x2={x + 66} y2="220" />
            </g>
          );
        })}
        <line x1="10" y1="124" x2="390" y2="124" />
        <line x1="10" y1="130" x2="390" y2="130" />
      </g>
    </svg>
  );
}

/** Thẻ đỏ rượu vang viền chỉ vàng, góc có ánh sao. */
function WineCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: "relative", background: `linear-gradient(165deg, ${WINE2} 0%, ${WINE} 62%)`, color: CREAM, borderRadius: 14,
      padding: "34px 22px 30px", boxShadow: "0 26px 50px -26px var(--dd-sh2)", textAlign: "center", ...style,
    }}>
      <span aria-hidden style={{ position: "absolute", inset: 8, border: `1px solid ${GOLD}55`, borderRadius: 10, pointerEvents: "none" }} />
      <span aria-hidden className="wed-float" style={{ position: "absolute", right: -9, top: -11, color: GOLD, fontSize: 20 }}>✦</span>
      <span aria-hidden className="wed-float" style={{ position: "absolute", left: -7, bottom: 26, color: GOLD, fontSize: 13, animationDelay: "1.4s" }}>✦</span>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

/** Giờ đón khách / khai tiệc: ưu tiên lịch trình có chữ "đón"/"khai", không thì hai mốc đầu. */
function arrival(d: PhoneData): { label: string; time: string }[] {
  const t = d.timeline.filter((x) => x.time);
  const greet = t.find((x) => /đón/i.test(x.label));
  const feast = t.find((x) => /khai|nhập tiệc|tiệc/i.test(x.label) && x !== greet);
  const pick = [greet, feast].filter(Boolean) as { time: string; label: string }[];
  const rows = (pick.length ? pick : t.slice(0, 2)).map((x) => ({ label: x.label || "Thời gian", time: x.time }));
  if (!rows.length && d.reception) return [{ label: "Đón khách", time: d.reception.replace(/^đón khách\s*(từ)?\s*/i, "") }];
  return rows;
}

export default function DoDoTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const P = dodoPalette(d.accent);
  const accent = P.wine;
  const eyebrow = { fontFamily: CORM, fontSize: 13, letterSpacing: ".34em", textTransform: "uppercase" as const };
  const title = (t: string, color = accent) => (
    <div style={{ fontFamily: PLAY, fontSize: 25, letterSpacing: ".06em", textTransform: "uppercase", color, textAlign: "center" }}>{t}</div>
  );
  const polaroids = [d.hero, d.pair[0], d.pair[1]].filter(Boolean) as string[];
  const album = [...d.pair, ...d.trio];
  const times = arrival(d);
  const parents = d.hasFamilies || d.homes.groom || d.homes.bride;

  return (
    <PhoneShell
      card={BG} page="#e9ddd0" ink={INK} font={SANS} radius={18} accent={accent}
      vars={{ "--dd-wine": P.wine, "--dd-wine2": P.wine2, "--dd-ink": P.ink, "--dd-muted": P.muted, "--dd-line": P.line, "--dd-blush": P.blush, "--dd-sh": P.sh, "--dd-sh2": P.sh2 }}
    >
      <style>{`
        @keyframes ddDrop { from { opacity: 0; transform: translateY(-38px) rotate(var(--r0)) } to { opacity: 1; transform: rotate(var(--r1)) } }
        .dd-pola { animation: ddDrop 1.1s cubic-bezier(.2,.8,.25,1) both; }
      `}</style>

      {/* ── Bìa: polaroid xếp lệch + tên đôi ─────────────────────────────── */}
      <section style={{ position: "relative", padding: "56px 22px 64px", overflow: "hidden", textAlign: "center" }}>
        <Colonnade opacity={0.1} />
        <Ambient kind="sparkle" color={GOLD} count={9} />
        <div style={{ ...eyebrow, color: MUTED }}>Save the date</div>
        <div style={{ position: "relative", height: 330, margin: "26px auto 6px", maxWidth: 330 }}>
          {(polaroids.length ? polaroids : [undefined, undefined, undefined]).slice(0, 3).map((src, i) => {
            const pos = [
              { left: "4%", top: 36, r0: "-14deg", r1: "-7deg", z: 1 },
              { right: "2%", top: 0, r0: "16deg", r1: "8deg", z: 3 },
              { left: "20%", top: 96, r0: "-4deg", r1: "2deg", z: 2 },
            ][i];
            return (
              <div key={i} className="dd-pola" style={{
                position: "absolute", left: pos.left, right: pos.right, top: pos.top, zIndex: pos.z, width: 176,
                background: "#fff", padding: "9px 9px 30px", boxShadow: "0 16px 32px -14px var(--dd-sh)",
                animationDelay: `${0.25 + i * 0.22}s`, "--r0": pos.r0, "--r1": pos.r1, transform: `rotate(${pos.r1})`,
              } as CSSVars}>
                <Slot src={src} height={196} tint={CREAM} fx={i === 1 ? "kb gloss" : "kb"} lazy={false} label="" />
              </div>
            );
          })}
        </div>
        <div style={{ position: "relative", fontFamily: PLAY, fontSize: 40, lineHeight: 1.12, color: accent }}>
          <div className="wed-ink">{d.groom}</div>
          <div className="wed-float" style={{ fontFamily: CORM, fontSize: 26, color: GOLD, margin: "2px 0" }}>&amp;</div>
          <div className="wed-ink-2">{d.bride}</div>
        </div>
        {d.date.valid && <div style={{ ...eyebrow, color: INK, marginTop: 18, letterSpacing: ".3em" }}>{d.date.dotted}</div>}
        {d.lunarLine && <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 15.5, color: MUTED, marginTop: 4 }}>({d.lunarLine})</div>}
        {d.quote && <p style={{ position: "relative", fontFamily: CORM, fontSize: 17, lineHeight: 1.6, color: MUTED, margin: "18px auto 0", maxWidth: 300, whiteSpace: "pre-line" }}>{d.quote}</p>}
      </section>

      <div style={{ padding: "0 18px 50px", display: "flex", flexDirection: "column", gap: 34 }}>
        {/* ── Thông tin lễ cưới: hai họ + tên đôi ─────────────────────────── */}
        <Reveal anim="up">
          <WineCard>
            <div style={{ fontFamily: PLAY, fontSize: 22, letterSpacing: ".08em", textTransform: "uppercase" }}>Thông tin lễ cưới</div>
            {parents && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 22, fontFamily: CORM, fontSize: 16, lineHeight: 1.5 }}>
                {([["Nhà trai", d.families.groom, d.homes.groom], ["Nhà gái", d.families.bride, d.homes.bride]] as const).map(([k, fam, home]) => (
                  <div key={k}>
                    <div style={{ fontSize: 12.5, letterSpacing: ".22em", textTransform: "uppercase", color: GOLD }}>{k}</div>
                    <div style={{ whiteSpace: "pre-line", marginTop: 6, fontWeight: 600 }}>{fam || "—"}</div>
                    {home && <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 4, whiteSpace: "pre-line" }}>{home}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontFamily: CORM, fontSize: 14.5, letterSpacing: ".14em", textTransform: "uppercase", margin: "24px 0 14px", lineHeight: 1.6, opacity: 0.9 }}>
              Trân trọng báo tin<br />lễ thành hôn của con chúng tôi
            </div>
            {d.portraits.slice().reverse().map((p, i) => (
              <div key={p.role}>
                {i === 1 && <div style={{ fontFamily: CORM, fontSize: 28, color: GOLD, lineHeight: 1 }}>&amp;</div>}
                <div style={{ fontFamily: PLAY, fontSize: 36, lineHeight: 1.15 }}><Letters text={p.name} delay={0.1 + i * 0.3} step={0.05} /></div>
                <div style={{ fontFamily: CORM, fontSize: 13, letterSpacing: ".3em", textTransform: "uppercase", opacity: 0.75, marginTop: 4 }}>{p.role}</div>
              </div>
            ))}
          </WineCard>
        </Reveal>

        {/* ── Cô dâu & chú rể: hai ảnh chân dung kèm lời giới thiệu ────────── */}
        {(d.hasPortraitPhotos || d.bios.groom || d.bios.bride) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {d.portraits.slice().reverse().map((p, i) => (
              <Reveal key={p.role} anim={i ? "right" : "left"}>
                <div style={{ textAlign: "center" }}>
                  <div className="wed-tilt" style={{ background: "#fff", padding: 7, boxShadow: "0 14px 26px -16px var(--dd-sh)", rotate: `${i ? 2 : -2}deg` }}>
                    <Slot src={p.photo} height={200} tint={CREAM} fx="zoom parallax" fallback={<span style={{ fontFamily: PLAY, fontSize: 54, color: accent, opacity: 0.4 }}>{initial(p.name)}</span>} />
                  </div>
                  <div style={{ fontFamily: PLAY, fontSize: 20, color: accent, marginTop: 12 }}>{p.name}</div>
                  {(i ? d.bios.bride : d.bios.groom) && <p style={{ margin: "6px 0 0", fontFamily: CORM, fontSize: 15, lineHeight: 1.5, color: MUTED }}>{i ? d.bios.bride : d.bios.groom}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* ── Album: dải ảnh vuốt ngang có khung trắng ──────────────────────── */}
        {album.length > 0 && (
          <div>
            {title("Album ảnh")}
            <PhotoViewer photos={album}>
              <div className="wed-swipe wed-cover3d" style={{ gap: 14, padding: "20px 6px 8px", margin: "0 -18px" }}>
                <span style={{ width: 4 }} />
                {album.map((src, i) => (
                  <div key={i} data-c3 style={{ width: 230, background: "#fff", padding: 8, boxShadow: "0 14px 26px -16px var(--dd-sh)", transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}>
                    <Slot src={src} pv={i} height={300} tint={CREAM} fx="develop" />
                  </div>
                ))}
                <span style={{ width: 4 }} />
              </div>
            </PhotoViewer>
          </div>
        )}

        {/* ── Lời mời + giờ + lịch tháng ─────────────────────────────────── */}
        <Reveal anim="up">
          <WineCard>
            <div style={{ fontFamily: PLAY, fontSize: 21 }}>Trân trọng kính mời</div>
            <div style={{ fontFamily: HAND, fontSize: 40, lineHeight: 1.25, color: "#fff", margin: "6px 0 2px", borderBottom: `1px solid ${GOLD}88`, display: "inline-block", padding: "0 10px" }}>
              {d.guest || "Quý khách"}
            </div>
            <div style={{ fontFamily: CORM, fontSize: 16, opacity: 0.85, marginTop: 8 }}>đến chung vui cùng gia đình chúng tôi</div>
            <span style={{ display: "block", width: 70, height: 1, background: `${GOLD}99`, margin: "20px auto" }} />
            <div style={{ fontFamily: PLAY, fontSize: 15, letterSpacing: ".1em", textTransform: "uppercase" }}>Tiệc cưới sẽ diễn ra vào lúc</div>
            {d.date.valid && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14, marginTop: 16, fontFamily: CORM }}>
                <div style={{ textAlign: "right", fontSize: 14, letterSpacing: ".18em", textTransform: "uppercase", lineHeight: 1.7 }}>
                  {d.date.weekday}<br />{d.startTime && <span style={{ fontSize: 17, letterSpacing: ".06em" }}>{d.startTime}</span>}
                </div>
                <div style={{ fontFamily: PLAY, fontSize: 58, lineHeight: 1, padding: "0 14px", borderLeft: `1px solid ${GOLD}88`, borderRight: `1px solid ${GOLD}88` }}>{d.date.day}</div>
                <div style={{ textAlign: "left", fontSize: 14, letterSpacing: ".18em", textTransform: "uppercase", lineHeight: 1.7 }}>
                  Tháng {d.date.month}<br /><span style={{ fontSize: 17, letterSpacing: ".06em" }}>{d.date.year}</span>
                </div>
              </div>
            )}
            {d.lunarLine && <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 15, opacity: 0.8, marginTop: 10 }}>({d.lunarLine})</div>}
            {times.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 34, marginTop: 20 }}>
                {times.map((t) => (
                  <div key={t.label + t.time}>
                    <div style={{ fontFamily: CORM, fontSize: 12.5, letterSpacing: ".24em", textTransform: "uppercase", opacity: 0.75 }}>{t.label}</div>
                    <div style={{ fontFamily: PLAY, fontSize: 21, marginTop: 4 }}>{t.time}</div>
                  </div>
                ))}
              </div>
            )}
            <MonthCalendar
              date={d.c.wedding_date}
              ink={P.ink} muted={P.muted} accent={P.wine} font={CORM}
              title={(m, y) => <div style={{ fontFamily: PLAY, fontSize: 21, color: WINE, marginBottom: 12 }}>Tháng {m} / {y}</div>}
              style={{ background: CREAM, borderRadius: 12, padding: "18px 12px 12px", marginTop: 24 }}
            />
            {d.calendarHref && (
              <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, fontFamily: CORM, fontSize: 15, textDecoration: "underline", textUnderlineOffset: 4, color: CREAM }}>Thêm vào lịch</a>
            )}
            {d.rsvpOn && (
              <div style={{ marginTop: 18 }}>
                <a href="#xac-nhan" style={{ display: "inline-block", background: CREAM, color: WINE, borderRadius: 999, padding: "12px 28px", fontFamily: CORM, fontSize: 15, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}>Xác nhận tham dự</a>
              </div>
            )}
          </WineCard>
        </Reveal>

        {/* ── Các nghi lễ (nhiều nơi / nhiều ngày) ──────────────────────────── */}
        {d.events.length > 0 && (
          <div>
            {title("Các nghi lễ")}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
              {d.events.map((e, i) => (
                <Reveal key={i} anim="up" delay={i * 90}>
                  <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px", background: "#fffaf4", display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "center", minWidth: 62, borderRight: `1px solid ${LINE}`, paddingRight: 14 }}>
                      <div style={{ fontFamily: PLAY, fontSize: 22, color: accent }}>{e.time || "—"}</div>
                      {e.bits?.valid && <div style={{ fontFamily: CORM, fontSize: 13.5, color: MUTED }}>{e.bits.dotted}</div>}
                    </div>
                    <div>
                      <div style={{ fontFamily: PLAY, fontSize: 17, color: INK }}>{e.label}</div>
                      {e.where && <div style={{ fontFamily: CORM, fontSize: 15, color: MUTED, lineHeight: 1.45, marginTop: 2 }}>{e.where}</div>}
                      {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: accent, textDecoration: "underline", textUnderlineOffset: 3 }}>Chỉ đường</a>}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* ── Lịch trình buổi tiệc ───────────────────────────────────────── */}
        {d.timeline.length > 0 && (
          <Reveal anim="up">
            {title("Lịch trình")}
            <div style={{ position: "relative", margin: "20px auto 0", maxWidth: 300 }}>
              <span style={{ position: "absolute", left: "50%", top: 4, bottom: 4, width: 1, background: LINE }} />
              {d.timeline.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 22px 1fr", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ textAlign: "right", fontFamily: PLAY, fontSize: 19, color: accent }}>{t.time}</div>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: BG, border: `2px solid ${accent}`, margin: "0 auto", position: "relative" }} />
                  <div style={{ fontFamily: CORM, fontSize: 16.5, color: INK }}>{t.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* ── Địa điểm + dress code ──────────────────────────────────────── */}
        {(d.venue.name || d.venue.address || d.mapHref) && (
          <Reveal anim="up">
            <div style={{ position: "relative", textAlign: "center", padding: "6px 0 0" }}>
              <div style={{ fontFamily: PLAY, fontSize: 18, letterSpacing: ".08em", textTransform: "uppercase", color: accent }}>Tiệc cưới sẽ tổ chức tại</div>
              {d.venue.name && <div style={{ fontFamily: PLAY, fontSize: 22, color: INK, marginTop: 10 }}>{d.venue.name}</div>}
              {d.venue.address && <div style={{ fontFamily: CORM, fontSize: 16, color: MUTED, marginTop: 4 }}>{d.venue.address}</div>}
              <MapBox d={d} height={210} radius={12} style={{ marginTop: 16, border: `1px solid ${LINE}` }} />
              {d.mapHref && <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 14, border: `1px solid ${accent}`, color: accent, borderRadius: 999, padding: "9px 26px", fontFamily: CORM, fontSize: 15, fontWeight: 600 }}>Chỉ đường</a>}
            </div>
          </Reveal>
        )}

        {d.infos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
            {d.infos.map((i) => (
              <div key={i.label}>
                <div style={{ fontFamily: CORM, fontSize: 12.5, letterSpacing: ".3em", textTransform: "uppercase", color: MUTED }}>{i.label === "Trang phục" ? "Dress code" : i.label}</div>
                {i.value && <div style={{ fontFamily: PLAY, fontSize: 17, color: INK, marginTop: 4 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
                    {i.swatches.map((s, k) => <span key={k} style={{ width: 28, height: 28, borderRadius: "50%", background: s, boxShadow: "0 3px 8px rgba(0,0,0,.15)" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Câu chuyện ─────────────────────────────────────────────────── */}
        {d.story && (
          <Reveal anim="up">
            <WineCard style={{ textAlign: "left" }}>
              <div style={{ fontFamily: PLAY, fontSize: 21, letterSpacing: ".06em", textTransform: "uppercase", textAlign: "center" }}>Câu chuyện của chúng mình</div>
              <p style={{ fontFamily: CORM, fontSize: 17, lineHeight: 1.7, margin: "16px 0 0", whiteSpace: "pre-line", opacity: 0.92 }}>{d.story}</p>
            </WineCard>
          </Reveal>
        )}

        {/* ── Đếm ngược ──────────────────────────────────────────────────── */}
        <div>
          {title("Còn lại")}
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}
            box={{ background: "#fffaf4", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 0", textAlign: "center" }}
            num={{ fontFamily: PLAY, fontSize: 28, color: accent, lineHeight: 1 }}
            lab={{ fontFamily: CORM, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginTop: 6 }}
          />
        </div>

        {/* ── Xác nhận tham dự ───────────────────────────────────────────── */}
        {d.rsvpOn && (
          <div id="xac-nhan" style={{ scrollMarginTop: 20 }}>
            {title("Xác nhận tham dự")}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <QuickRsvp
                slug={d.slug}
                note={d.c.rsvp_note}
                btn={{ flex: 1, padding: "12px 4px", border: `1px solid ${accent}`, borderRadius: 999, background: "transparent", color: accent, fontFamily: CORM, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                btnOn={{ background: accent, color: CREAM }}
                msgStyle={{ textAlign: "center", fontFamily: CORM, fontSize: 15.5, color: MUTED }}
              />
            </div>
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div>
            {title("Sổ lưu bút")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <div key={i} style={{ background: "var(--dd-blush)", borderRadius: 10, padding: "12px 16px", textAlign: "left" }}>
                  <div style={{ fontFamily: CORM, fontSize: 14, fontWeight: 700, color: WINE }}>{w.guest_name}</div>
                  <div style={{ fontFamily: CORM, fontSize: 16, lineHeight: 1.5, color: INK, marginTop: 2 }}>{w.wish}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.gifts.length > 0 && (
          <div>
            {title("Hộp quà mừng")}
            <GiftBox gifts={d.gifts} note={d.giftNote} box={WINE} ribbon={GOLD} ink={INK} muted={MUTED} card="#fffaf4" font={CORM} style={{ marginTop: 18 }} />
          </div>
        )}
      </div>

      {/* ── Cảm ơn ─────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "30px 26px 120px", textAlign: "center", overflow: "hidden" }}>
        <Colonnade opacity={0.12} />
        {d.thanksPhoto && <Slot src={d.thanksPhoto} height={150} width={150} radius="50%" tint={CREAM} fx="breathe" style={{ margin: "0 auto 18px", border: `3px solid #fff`, boxShadow: "0 10px 24px -12px var(--dd-sh)" }} />}
        <p style={{ position: "relative", fontFamily: PLAY, fontSize: 19, lineHeight: 1.6, color: WINE, margin: 0, whiteSpace: "pre-line" }}>
          {d.thanks || "Sự hiện diện của quý khách là niềm vinh hạnh của gia đình chúng tôi!"}
        </p>
        {d.closing && <div style={{ position: "relative", fontFamily: HAND, fontSize: 30, color: accent, marginTop: 12 }}>{d.closing}</div>}
        <div style={{ position: "relative", fontFamily: PLAY, fontSize: 24, color: accent, marginTop: 18 }}>{d.groom} &amp; {d.bride}</div>
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
