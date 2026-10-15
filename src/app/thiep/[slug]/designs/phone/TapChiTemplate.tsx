import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { alpha, contrast, ensureContrast, mix, safeHex } from "@/lib/wedding-palette";
import PhotoViewer from "./PhotoViewer";
import { Ambient, MapBox, MonthCalendar, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, initial, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// BÌA TẠP CHÍ — thiệp cưới dựng như một số tạp chí đặc biệt
//
// Nét riêng:
//   · bìa: ảnh tràn màn hình, TÊN BÁO "WEDDING" khổ lớn, các dòng tít bìa
//     ("Độc quyền", "Trang 04…"), MÃ VẠCH in ngày cưới ở góc
//   · MỤC LỤC "Trong số này" — bấm từng dòng để nhảy tới mục đó
//   · đầu mỗi mục là SỐ TRANG + tên chuyên mục, câu chuyện tình viết như BÀI BÁO
//     có chữ cái đầu lớn (drop cap) và TRÍCH DẪN NỔI
//   · lịch trình có biểu tượng tròn, đếm ngược đè lên dải ảnh lia ngang
//   · bìa sau: "Thank you!", mã vạch, "— Hết —"
//   · mở thiệp: TRANG BÌA LẬT RA như mở một cuốn tạp chí (xem CardIntro)
//
// Màu: giấy xám ấm + một màu mực cặp đôi chọn (mặc định nâu espresso).
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_INK = "#4b3427";
const PLAY = "var(--font-playfair), serif";
const CORM = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-hand), cursive";

function palette(color?: string) {
  const main = safeHex(color, DEFAULT_INK);
  const paper = mix("#e2dfd8", main, 0.06);
  const ink = ensureContrast(main, paper, 7, "#000000");
  return {
    main, paper, ink,
    sheet: mix("#f5f4f0", main, 0.025),
    muted: mix(ink, paper, 0.4),
    line: alpha(ink, 0.55),
    hair: alpha(ink, 0.18),
    onMain: contrast("#ffffff", main) >= 3 ? "#ffffff" : ensureContrast(mix(main, "#000000", 0.7), main, 4.5),
  };
}
type Pal = ReturnType<typeof palette>;

/** Mã vạch trang trí dựng từ một chuỗi (ngày cưới) — không phải mã quét được. */
function Barcode({ text, ink, bg = "#ffffff", width = 104 }: { text: string; ink: string; bg?: string; width?: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of `*${text}*`) {
    const c = ch.charCodeAt(0);
    for (let k = 0; k < 4; k++) {
      const w = 1 + ((c >> k) & 1) + ((c >> (k + 3)) & 1) * 0.6;
      if (k % 2 === 0) bars.push({ x, w });
      x += w + 1.1;
    }
  }
  return (
    <div style={{ display: "inline-block", background: bg, padding: "6px 8px 4px", lineHeight: 1 }}>
      <svg viewBox={`0 0 ${x} 30`} width={width} height={30} preserveAspectRatio="none" aria-hidden style={{ display: "block" }}>
        {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={30} style={{ fill: ink }} />)}
      </svg>
      <div style={{ fontFamily: SANS, fontSize: 9, letterSpacing: ".32em", color: ink, textAlign: "center", marginTop: 3 }}>{text}</div>
    </div>
  );
}

/** Đầu chuyên mục: số trang + tên mục, hai bên kẻ chỉ — như đầu trang tạp chí. */
function Folio({ no, title, P, id }: { no: string; title: string; P: Pal; id?: string }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SANS, fontSize: 10.5, letterSpacing: ".3em", textTransform: "uppercase", color: P.muted, scrollMarginTop: 16 }}>
      <span style={{ fontFamily: PLAY, fontSize: 15, letterSpacing: 0, color: P.ink }}>{no}</span>
      <span style={{ flex: 1, height: 1, background: P.hair }} />
      <span>{title}</span>
    </div>
  );
}

/** Tiêu đề trong khung ngoặc chỉ (nét ngang chạy tới chữ, nét dọc rủ xuống) — "Timeline of / THE WEDDING". */
function Bracket({ top, bottom, P, align = "left" }: { top: string; bottom?: string; P: Pal; align?: "left" | "right" }) {
  const right = align === "right";
  return (
    <div style={{ position: "relative", padding: "0 6px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: right ? "row-reverse" : "row" }}>
        <span aria-hidden className="wed-rule" style={{ flex: 1, height: 1, background: P.line, transformOrigin: right ? "right" : "left" }} />
        <span style={{ fontFamily: PLAY, fontSize: 30, lineHeight: 1.15, color: P.ink }}>{top}</span>
      </div>
      {bottom && <div style={{ textAlign: right ? "left" : "right", fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", color: P.ink, marginTop: 2, padding: "0 4px" }}>{bottom}</div>}
      <span aria-hidden style={{ position: "absolute", top: 18, bottom: 0, [right ? "right" : "left"]: 0, width: 1, background: P.line }} />
    </div>
  );
}

/** Biểu tượng tròn nền mực cho từng mốc lịch trình. */
function Dot({ label, P }: { label: string; P: Pal }) {
  const k = label.toLowerCase();
  const s = { fill: "none", stroke: P.onMain, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span style={{ width: 34, height: 34, borderRadius: "50%", background: P.main, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: `0 0 0 4px ${P.sheet}` }}>
      <svg viewBox="0 0 24 24" width={17} height={17} aria-hidden>
        {/đón|khách/.test(k) ? <><path {...s} d="M4 20V9l8-5 8 5v11" /><path {...s} d="M10 20v-6h4v6" /></>
          : /lễ|hôn|nghi|vu quy|gia tiên/.test(k) ? <><circle {...s} cx="9" cy="14" r="5" /><circle {...s} cx="15" cy="14" r="5" /></>
          : /tiệc|khai|ăn|nhập/.test(k) ? <><path {...s} d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" /><path {...s} d="M16 3c-2 2-2 6 0 8v10" /></>
          : /ảnh|chụp|giao lưu|nhảy|nhạc/.test(k) ? <><rect {...s} x="3" y="7" width="18" height="13" rx="2" /><circle {...s} cx="12" cy="13.5" r="3.5" /></>
          : <path {...s} d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />}
      </svg>
    </span>
  );
}

export default function TapChiTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const P = palette(d.accent);
  const album = [...d.pair, ...d.trio];
  const collage = [d.pair[0], d.hero, d.pair[1]];
  const portraits = d.portraits.slice().reverse(); // chú rể trước
  const label = { fontFamily: SANS, fontSize: 10.5, letterSpacing: ".3em", textTransform: "uppercase" as const, color: P.muted };
  const body = { fontFamily: CORM, fontSize: 17, lineHeight: 1.62, color: P.ink };
  const sheet = { background: P.sheet, borderRadius: 22, boxShadow: `0 18px 40px -28px ${alpha(P.ink, 0.6)}` };
  const issue = d.date.valid ? d.date.dotted : "";

  // Mục lục: chỉ liệt kê mục THẬT SỰ có trên thiệp này.
  const toc = [
    { id: "tc-loi-moi", title: "Lời mời" },
    { id: "tc-doi-uyen-uong", title: "Cô dâu & chú rể" },
    d.events.length ? { id: "tc-su-kien", title: "Các nghi lễ" } : null,
    d.timeline.length ? { id: "tc-lich-trinh", title: "Lịch trình buổi tiệc" } : null,
    d.story ? { id: "tc-chuyen-tinh", title: "Chuyện tình yêu" } : null,
    album.length ? { id: "tc-album", title: "Album ảnh cưới" } : null,
    d.rsvpOn ? { id: "tc-xac-nhan", title: "Xác nhận tham dự" } : null,
  ].filter(Boolean) as { id: string; title: string }[];
  const no = (id: string) => String(toc.findIndex((t) => t.id === id) + 1).padStart(2, "0");

  return (
    <PhoneShell card={P.paper} page={mix(P.paper, P.ink, 0.12)} ink={P.ink} font={SANS} radius={18} accent={P.main}>
      <style>{`html { scroll-behavior: smooth; }
        @keyframes tcSlide { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: none } }
        .tc-line { animation: tcSlide .9s cubic-bezier(.2,.8,.3,1) both; }`}</style>

      {/* ── BÌA ─────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", height: "min(100svh, 860px)", minHeight: 640, overflow: "hidden", background: P.paper }}>
        <Slot src={d.hero} height="100%" fx="kb" lazy={false} tint={mix(P.paper, P.ink, 0.1)}
          style={{ position: "absolute", inset: 0 }}
          fallback={<span style={{ fontFamily: PLAY, fontSize: 120, color: alpha(P.ink, 0.18) }}>{initial(d.groom)}{initial(d.bride)}</span>} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(P.paper, 0.96)} 0%, ${alpha(P.paper, 0.55)} 20%, transparent 36%, transparent 55%, rgba(0,0,0,.62) 100%)` }} />
        <Ambient kind="grain" color={alpha(P.ink, 0.5)} color2="rgba(255,226,190,.35)" opacity={0.55} />

        <div style={{ position: "relative", zIndex: 2, padding: "16px 18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...label, fontSize: 9.5, color: P.ink }}>
            <span>Vol. 01 · Ấn bản đặc biệt</span><span>{issue}</span>
          </div>
          <div style={{ fontFamily: PLAY, fontSize: 15, fontStyle: "italic", color: P.ink, marginTop: 10, lineHeight: 1 }}>The</div>
          <div className="wed-ink" style={{ fontFamily: PLAY, fontWeight: 700, fontSize: 76, lineHeight: 0.86, letterSpacing: "-.02em", color: P.ink }}>WEDDING</div>
          <div style={{ height: 2, background: P.ink, marginTop: 8 }} />
          <div style={{ ...label, fontSize: 9.5, color: P.ink, marginTop: 6 }}>Số đặc biệt · Hôn lễ của {d.groom} &amp; {d.bride}</div>
        </div>

        {/* dòng tít bìa */}
        <div style={{ position: "absolute", zIndex: 2, left: 18, top: "39%", maxWidth: 190, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.45)" }}>
          <span className="tc-line" style={{ display: "inline-block", background: P.main, color: P.onMain, fontFamily: SANS, fontSize: 9.5, fontWeight: 700, letterSpacing: ".24em", padding: "4px 8px", textShadow: "none" }}>ĐỘC QUYỀN</span>
          <div className="tc-line" style={{ fontFamily: PLAY, fontSize: 21, lineHeight: 1.15, marginTop: 8, animationDelay: ".15s" }}>Câu chuyện của chúng mình</div>
          {toc.slice(2, 5).map((t, i) => (
            <div key={t.id} className="tc-line" style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".06em", marginTop: 8, animationDelay: `${0.3 + i * 0.15}s` }}>
              <b style={{ fontFamily: PLAY, fontSize: 14 }}>{no(t.id)}</b> · {t.title}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", zIndex: 2, left: 18, right: 18, bottom: 22, color: "#fff" }}>
          <div className="wed-float" style={{ fontFamily: HAND, fontSize: 46, lineHeight: 1, opacity: 0.92 }}>Forever</div>
          <div className="wed-ink-2" style={{ fontFamily: PLAY, fontSize: 38, lineHeight: 1.05, textShadow: "0 4px 22px rgba(0,0,0,.4)" }}>{d.groom}<br />&amp; {d.bride}</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".34em" }}>{d.date.valid ? d.date.spaced : ""}</div>
            {issue && <Barcode text={issue.replace(/\./g, "")} ink="#111111" />}
          </div>
        </div>
      </section>

      {/* ── Ngày lớn ───────────────────────────────────────────────────── */}
      {d.date.valid && (
        <Reveal anim="up">
          <section style={{ padding: "34px 18px 8px", textAlign: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", color: P.ink }}>
              <div style={{ borderTop: `1px solid ${P.line}`, borderBottom: `1px solid ${P.line}`, padding: "6px 0", fontFamily: PLAY, fontSize: 17 }}>{d.date.weekday}</div>
              <div style={{ borderLeft: `1px solid ${P.line}`, borderRight: `1px solid ${P.line}`, padding: "0 18px" }}>
                <div style={{ fontFamily: PLAY, fontSize: 18 }}>Tháng {Number(d.date.month)}</div>
                <div style={{ fontFamily: PLAY, fontSize: 52, lineHeight: 1 }}>{d.date.day}</div>
              </div>
              <div style={{ borderTop: `1px solid ${P.line}`, borderBottom: `1px solid ${P.line}`, padding: "6px 0", fontFamily: PLAY, fontSize: 17 }}>{d.date.year}</div>
            </div>
            <div style={{ ...label, marginTop: 16, color: P.ink }}>Greatest day · Ngày trọng đại</div>
            {d.lunarLine && <div style={{ ...body, fontStyle: "italic", fontSize: 15, color: P.muted, marginTop: 4 }}>({d.lunarLine})</div>}
          </section>
        </Reveal>
      )}

      <div style={{ padding: "26px 18px 10px", display: "flex", flexDirection: "column", gap: 44 }}>
        {/* ── Mục lục ──────────────────────────────────────────────────── */}
        <Reveal anim="wipe">
          <div style={{ ...sheet, padding: "22px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontFamily: PLAY, fontSize: 26, color: P.ink }}>Trong số này</div>
              <div style={{ ...label, fontSize: 9.5 }}>Chạm để đọc</div>
            </div>
            <div style={{ marginTop: 10 }}>
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "10px 0", borderTop: `1px solid ${P.hair}`, color: P.ink }}>
                  <span style={{ fontFamily: PLAY, fontSize: 22, width: 34 }}>{no(t.id)}</span>
                  <span style={{ flex: 1, fontFamily: CORM, fontSize: 18 }}>{t.title}</span>
                  <span aria-hidden style={{ fontFamily: SANS, fontSize: 14, color: P.muted }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        {d.quote && (
          <p style={{ ...body, fontFamily: PLAY, fontStyle: "italic", fontSize: 20, lineHeight: 1.45, textAlign: "center", margin: 0, whiteSpace: "pre-line" }}>“{d.quote}”</p>
        )}

        {/* ── 01 · Lời mời ─────────────────────────────────────────────── */}
        <div>
          <Folio no={no("tc-loi-moi")} title="Lời mời" P={P} id="tc-loi-moi" />
          <Reveal anim="up">
            <div style={{ ...sheet, marginTop: 16, padding: "26px 18px 28px", textAlign: "center" }}>
              {(d.hasFamilies || d.homes.groom || d.homes.bride) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${P.hair}`, borderRadius: 16, padding: "14px 8px", marginBottom: 20 }}>
                  {([["Nhà trai", d.families.groom, d.homes.groom], ["Nhà gái", d.families.bride, d.homes.bride]] as const).map(([k, fam, home], i) => (
                    <div key={k} style={{ borderLeft: i ? `1px solid ${P.hair}` : undefined, padding: "0 6px" }}>
                      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: P.ink }}>{k}</div>
                      <div style={{ fontFamily: CORM, fontSize: 14.5, lineHeight: 1.5, color: P.ink, marginTop: 6, whiteSpace: "pre-line" }}>{fam || "—"}</div>
                      {home && <div style={{ fontFamily: CORM, fontStyle: "italic", fontSize: 13.5, color: P.muted, marginTop: 4, whiteSpace: "pre-line" }}>{home}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: P.ink }}>Trân trọng kính mời</div>
              <div style={{ fontFamily: HAND, fontSize: 36, color: P.ink, margin: "6px 0 2px" }}>{d.guest || "Bạn và Gia Đình"}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: P.muted, lineHeight: 1.7 }}>Đến dự buổi tiệc chung vui<br />cùng gia đình chúng tôi</div>
              <div style={{ fontFamily: PLAY, fontSize: 36, lineHeight: 1.12, color: P.ink, marginTop: 18 }}>
                {d.groom}<div style={{ fontFamily: HAND, fontSize: 30, lineHeight: 1, margin: "4px 0" }}>&amp;</div>{d.bride}
              </div>
            </div>
          </Reveal>
        </div>

        {/* ── Ảnh ghép + lễ thành hôn ───────────────────────────────────── */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: PLAY, fontSize: 32, color: P.ink }}>Lễ Thành Hôn</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 8, alignItems: "center", margin: "18px -4px 20px" }}>
            {collage.map((src, i) => (
              <Reveal key={i} anim={i === 1 ? "focus" : i ? "right" : "left"} delay={i * 120}>
                <div className="wed-tilt" style={{ background: "#fff", padding: 5, boxShadow: `0 14px 26px -16px ${alpha(P.ink, 0.7)}`, rotate: i === 1 ? "0deg" : i ? "3deg" : "-3deg" }}>
                  <Slot src={src} height={i === 1 ? 220 : 160} tint={mix(P.paper, P.ink, 0.08)} fx={i === 1 ? "zoom gloss" : "develop"} label="" />
                </div>
              </Reveal>
            ))}
          </div>
          <div style={{ ...label, color: P.ink }}>Vào lúc</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14, marginTop: 8, color: P.ink }}>
            <div style={{ fontFamily: CORM, fontSize: 18, textAlign: "right" }}>{d.startTime || "—"}</div>
            <div style={{ borderLeft: `1px solid ${P.line}`, borderRight: `1px solid ${P.line}`, padding: "0 18px" }}>
              <div style={{ fontFamily: CORM, fontSize: 14 }}>{d.date.weekday}</div>
              <div style={{ fontFamily: PLAY, fontSize: 40, lineHeight: 1 }}>{d.date.day}</div>
              <div style={{ fontFamily: CORM, fontSize: 14 }}>Tháng {Number(d.date.month) || "—"}</div>
            </div>
            <div style={{ fontFamily: CORM, fontSize: 18, textAlign: "left" }}>năm {d.date.year}</div>
          </div>
          {d.lunarLine && <div style={{ ...body, fontStyle: "italic", fontSize: 14.5, color: P.muted, marginTop: 10 }}>({d.lunarLine})</div>}
          {(d.venue.name || d.venue.address) && (
            <div style={{ marginTop: 14 }}>
              {d.venue.name && <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: P.ink }}>Tại {d.venue.name}</div>}
              {d.venue.address && <div style={{ ...body, fontSize: 15, color: P.muted }}>{d.venue.address}</div>}
            </div>
          )}
          {d.date.valid && (
            <Reveal anim="up">
              <div style={{ ...sheet, marginTop: 22, padding: "18px 12px 12px" }}>
                <MonthCalendar date={d.c.wedding_date} ink={P.ink} muted={P.muted} accent={P.main} heartInk={P.onMain} font={SANS}
                  title={(m, y) => <div style={{ fontFamily: PLAY, fontSize: 22, color: P.ink, marginBottom: 12 }}>Tháng {m} · {y}</div>} />
                {d.calendarHref && (
                  <a href={d.calendarHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, border: `1px solid ${P.line}`, borderRadius: 999, padding: "8px 18px", fontFamily: SANS, fontSize: 12, color: P.ink }}>📅 Thêm vào lịch</a>
                )}
              </div>
            </Reveal>
          )}
        </div>

        {/* ── 02 · Cô dâu & chú rể ──────────────────────────────────────── */}
        <div>
          <Folio no={no("tc-doi-uyen-uong")} title="Cô dâu & chú rể" P={P} id="tc-doi-uyen-uong" />
          <div style={{ textAlign: "center", fontFamily: PLAY, fontSize: 30, color: P.ink, margin: "18px 0 4px" }}>Cô dâu · Chú rể</div>
          <div style={{ width: 44, height: 2, background: P.ink, margin: "0 auto 22px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {portraits.map((p, i) => {
              const bio = i ? d.bios.bride : d.bios.groom;
              return (
                <Reveal key={p.role} anim={i ? "right" : "left"}>
                  <Slot src={p.photo} height={360} radius={18} tint={mix(P.paper, P.ink, 0.08)} fx="zoom parallax"
                    fallback={<span style={{ fontFamily: PLAY, fontSize: 90, color: alpha(P.ink, 0.25) }}>{initial(p.name)}</span>} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 14 }}>
                    <span style={{ ...label, color: P.ink, letterSpacing: ".4em" }}>{i ? "Bride" : "Groom"}</span>
                    <span style={{ flex: 1, height: 1, background: P.hair }} />
                  </div>
                  <div style={{ fontFamily: PLAY, fontSize: 32, color: P.ink, marginTop: 4 }}>{p.name}</div>
                  {p.sub && <div style={{ ...body, fontStyle: "italic", fontSize: 15, color: P.muted }}>{p.sub}</div>}
                  {bio && <p style={{ ...body, fontSize: 16, margin: "6px 0 0" }}>{bio}</p>}
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* ── 03 · Các nghi lễ ──────────────────────────────────────────── */}
        {d.events.length > 0 && (
          <div>
            <Folio no={no("tc-su-kien")} title="Các nghi lễ" P={P} id="tc-su-kien" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              {d.events.map((e, i) => (
                <Reveal key={i} anim="up" delay={i * 90}>
                  <div style={{ ...sheet, padding: "20px 18px", textAlign: "center" }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: P.ink }}>{e.label}</div>
                    <div style={{ fontFamily: SANS, fontSize: 12.5, color: P.ink, marginTop: 8 }}>
                      {[e.time, e.bits?.valid ? e.bits.weekday : undefined].filter(Boolean).join(" · ")}
                    </div>
                    {e.bits?.valid && <div style={{ fontFamily: PLAY, fontSize: 20, letterSpacing: ".3em", color: P.ink, marginTop: 4 }}>{e.bits.day} . {e.bits.month} . {e.bits.year}</div>}
                    {e.venue && <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: P.ink, marginTop: 10 }}>Tại {e.venue}</div>}
                    {e.address && <div style={{ ...body, fontSize: 15, color: P.muted }}>{e.address}</div>}
                    {e.href && <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, background: P.main, color: P.onMain, borderRadius: 999, padding: "8px 20px", fontFamily: SANS, fontSize: 11.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Chỉ đường</a>}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* ── 04 · Lịch trình ───────────────────────────────────────────── */}
        {d.timeline.length > 0 && (
          <div>
            <Folio no={no("tc-lich-trinh")} title="Lịch trình" P={P} id="tc-lich-trinh" />
            <div style={{ marginTop: 14 }}><Bracket top="Timeline of" bottom="The Wedding" P={P} /></div>
            {d.pair[1] && <Slot src={d.pair[1]} height={210} radius={4} tint={P.sheet} fx="develop" style={{ margin: "6px 0 18px", border: "6px solid #fff", boxShadow: `0 14px 26px -16px ${alpha(P.ink, 0.7)}` }} />}
            <div style={{ ...sheet, padding: "22px 20px", position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", left: 36, top: 34, bottom: 34, width: 1, background: P.hair }} />
              {d.timeline.map((t, i) => (
                <Reveal key={i} anim="left" delay={i * 110}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
                    <Dot label={t.label} P={P} />
                    <div style={{ fontFamily: PLAY, fontSize: 18, color: P.ink, width: 56 }}>{t.time}</div>
                    <div style={{ fontFamily: CORM, fontSize: 17, color: P.ink }}>{t.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* ── 05 · Chuyện tình: viết như bài báo ─────────────────────────── */}
        {d.story && (
          <div>
            <Folio no={no("tc-chuyen-tinh")} title="Chuyện tình yêu" P={P} id="tc-chuyen-tinh" />
            <Reveal anim="up">
              <div style={{ fontFamily: PLAY, fontSize: 30, lineHeight: 1.15, color: P.ink, margin: "16px 0 4px" }}>Chúng mình đã gặp nhau như thế nào?</div>
              <div style={{ ...label, marginBottom: 14 }}>Bài: {d.groom} &amp; {d.bride}</div>
              <p className="tc-article" style={{ ...body, fontSize: 17.5, margin: 0, whiteSpace: "pre-line", textAlign: "justify" }}>{d.story}</p>
              <style>{`.tc-article::first-letter { font-family: var(--font-playfair), serif; float: left; font-size: 64px; line-height: .82; padding: 6px 8px 0 0; color: ${P.ink}; }`}</style>
            </Reveal>
          </div>
        )}
      </div>

      {/* ── Đếm ngược trên dải ảnh ─────────────────────────────────────── */}
      <section style={{ position: "relative", marginTop: 40, height: 300, overflow: "hidden", color: "#fff" }}>
        <Slot src={d.trio[0] || d.hero} height="100%" fx="pan" tint={mix(P.paper, P.ink, 0.25)} style={{ position: "absolute", inset: 0 }} label="" />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.55))" }} />
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div style={{ fontFamily: PLAY, fontStyle: "italic", fontSize: 26, textAlign: "center", textShadow: "0 2px 14px rgba(0,0,0,.4)" }}>We will become a family in</div>
          <PhoneCountdown
            date={d.countdownTo}
            wrap={{ display: "flex", gap: 10, marginTop: 18 }}
            box={{ width: 68, padding: "10px 0", textAlign: "center", border: "1px solid rgba(255,255,255,.6)", borderRadius: 12, background: "rgba(255,255,255,.12)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            num={{ fontFamily: PLAY, fontSize: 28, lineHeight: 1 }}
            lab={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: ".2em", textTransform: "uppercase", marginTop: 4, opacity: 0.85 }}
          />
        </div>
      </section>

      <div style={{ padding: "40px 18px 10px", display: "flex", flexDirection: "column", gap: 44 }}>
        {/* ── 06 · Album ────────────────────────────────────────────────── */}
        {album.length > 0 && (
          <div>
            <Folio no={no("tc-album")} title="Album" P={P} id="tc-album" />
            <div style={{ marginTop: 14 }}><Bracket top="Album" bottom="Anniversary" P={P} align="right" /></div>
            <PhotoViewer photos={album} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              {album.map((src, i) => {
                const wide = i % 5 === 0;
                return (
                  <Reveal key={i} anim={wide ? "wipe" : i % 2 ? "iris" : "focus"} delay={(i % 2) * 110} style={{ gridColumn: wide ? "1 / -1" : undefined }}>
                    <Slot src={src} pv={i} height={wide ? 250 : 200} radius={4} tint={P.sheet} fx="zoom" />
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 9.5, letterSpacing: ".24em", color: P.muted, marginTop: 5 }}>
                      <span>ẢNH {String(i + 1).padStart(2, "0")}</span><span>{issue}</span>
                    </div>
                  </Reveal>
                );
              })}
            </PhotoViewer>
          </div>
        )}

        {/* ── 07 · Xác nhận ─────────────────────────────────────────────── */}
        {d.rsvpOn && (
          <div>
            <Folio no={no("tc-xac-nhan")} title="Xác nhận" P={P} id="tc-xac-nhan" />
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <div style={label}>Xác nhận</div>
              <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: P.ink, marginTop: 4 }}>Bạn sẽ đến chứ?</div>
              <p style={{ ...body, fontSize: 15.5, color: P.muted, margin: "8px 0 18px" }}>Chúng tôi rất vui nếu được chào đón bạn trong ngày trọng đại. Xin hãy cho chúng tôi biết để chuẩn bị chu đáo nhất!</p>
              {d.trio[1] && (
                <div className="wed-tilt" style={{ display: "inline-block", width: "82%", background: "#fff", padding: 6, rotate: "-2.5deg", boxShadow: `14px 14px 0 -6px ${alpha(P.ink, 0.9)}`, marginBottom: 22 }}>
                  <Slot src={d.trio[1]} height={220} tint={P.sheet} fx="zoom" />
                </div>
              )}
            </div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "12px 4px", border: `1px solid ${P.ink}`, borderRadius: 999, background: "transparent", color: P.ink, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: P.main, color: P.onMain, borderColor: P.main }}
              msgStyle={{ textAlign: "center", fontFamily: CORM, fontSize: 16, color: P.ink }}
              formWrap={{ background: P.sheet, borderRadius: 16, padding: 14, color: P.ink }}
            />
          </div>
        )}

        {/* ── Lời chúc ──────────────────────────────────────────────────── */}
        {d.wishesOn && wishes.length > 0 && (
          <div>
            <Bracket top="Lời chúc từ khách mời" P={P} />
            <div style={{ border: `3px solid ${P.ink}`, padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {wishes.slice(0, 8).map((w, i) => (
                <div key={i} style={{ ...sheet, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ ...body, fontStyle: "italic", fontSize: 16 }}>“{w.wish}”</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: P.muted, marginTop: 6 }}>— {w.guest_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Share the love ────────────────────────────────────────────── */}
        {d.gifts.length > 0 && (
          <Reveal anim="up">
            <div style={{ textAlign: "center", fontFamily: PLAY, fontSize: 38, color: P.ink }}>Share <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: ".2em", verticalAlign: "middle" }}>THE</span> Love</div>
            {d.giftNote && <p style={{ ...body, textAlign: "center", fontSize: 15, color: P.muted, margin: "4px 0 0" }}>{d.giftNote}</p>}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {d.gifts.map((g) => (
                <div key={g.title} style={{ width: 160, textAlign: "center" }}>
                  <div style={{ background: "#fff", padding: 8, border: `2px solid ${P.ink}` }}>
                    <img src={g.qr} alt={`Mã QR mừng ${g.title}`} width={140} height={140} style={{ width: "100%", height: "auto" }} />
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: P.ink, marginTop: 8 }}>{g.bank.holder || g.fallbackName}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, color: P.ink }}>{g.bank.account?.replace(/\s/g, "")}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, color: P.muted }}>{g.bank.name}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* ── Địa chỉ tiệc cưới ──────────────────────────────────────────── */}
      {(d.mapEmbed || d.mapImage || d.mapHref || d.venue.address) && (
        <section style={{ marginTop: 34 }}>
          <div style={{ ...label, textAlign: "center", fontSize: 12, fontWeight: 700, color: P.ink, marginBottom: 14 }}>Vị trí</div>
          <div style={{ background: P.main, padding: "0 16px 18px" }}>
            <div style={{ width: 210, margin: "0 auto", background: P.main, borderRadius: "999px 999px 0 0", textAlign: "center", padding: "12px 0 6px", transform: "translateY(-30px)", marginBottom: -30, fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: P.onMain }}>Địa chỉ tiệc cưới</div>
            <div style={{ background: P.sheet, borderRadius: 18, padding: 6 }}>
              <MapBox d={d} height={220} radius={14} />
              {!d.mapEmbed && !d.mapImage && <div style={{ ...body, textAlign: "center", padding: 16 }}>{d.venue.address}</div>}
            </div>
            {d.mapHref && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: P.sheet, color: P.ink, borderRadius: 999, padding: "9px 26px", fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Chỉ đường</a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Bìa sau ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "48px 22px 120px", textAlign: "center" }}>
        <Reveal anim="focus">
          <div style={{ fontFamily: PLAY, fontWeight: 700, fontSize: 52, color: P.ink, textShadow: `3px 4px 0 ${alpha(P.ink, 0.18)}` }}>Thank you!</div>
        </Reveal>
        <p style={{ ...body, fontStyle: "italic", fontSize: 16.5, color: P.muted, margin: "10px auto 0", maxWidth: 300, whiteSpace: "pre-line" }}>
          {d.thanks || "Sự hiện diện của bạn là niềm vinh hạnh cho gia đình chúng tôi.\nChân thành cảm ơn!"}
        </p>
        {d.closing && <div style={{ fontFamily: HAND, fontSize: 30, color: P.ink, marginTop: 10 }}>{d.closing}</div>}
        <div style={{ ...label, marginTop: 26, color: P.ink }}>— Hết —</div>
        <div style={{ marginTop: 14 }}>{issue && <Barcode text={issue.replace(/\./g, "")} ink={P.ink} bg={P.sheet} width={120} />}</div>
        <div style={{ ...label, fontSize: 9, marginTop: 10 }}>© {d.date.year || "2026"} · {d.groom} &amp; {d.bride}</div>
      </section>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
