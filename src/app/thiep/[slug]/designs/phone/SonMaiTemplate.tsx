import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// SƠN MÀI — bố cục "hai cột, dải chữ dọc chạy suốt trang"
//
// Nét riêng so với 9 mẫu còn lại:
//   · một DẢI DỌC viền vàng bám bên trái SUỐT chiều cao thiệp, chữ xoay dọc
//   · mở đầu bằng CHỮ, không có ảnh lớn — ảnh ngang xuất hiện sau tên
//   · lịch trình là SỔ KẺ DÒNG đánh số 01–0n, không phải danh sách giờ
//   · ảnh TRÀN ra mép phải, phá khung lề của cột chữ
//   · hai họ xếp DỌC thành hai khối, mỗi khối có nhãn dọc riêng
//   · dặn dò là danh sách nhãn–giá trị một cột, không phải lưới 2×2
// ════════════════════════════════════════════════════════════════════════════

const BG = "#101a2e", INK = "#f5efe1", GOLD = "#d6b266", STEEL = "#9fb0cc", BODY = "#e8e2d4";
const LINE = "rgba(214,178,102,.4)";
const HAIR = "rgba(214,178,102,.22)";
const TINT = "rgba(255,255,255,.12)";
const SERIF = "var(--font-playfair), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function SonMaiTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || GOLD;
  const lab = { fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase" as const, color: accent };
  // Ảnh tràn ra mép phải: bù đúng phần padding của cột chữ.
  const bleedRight = { marginRight: -20 };

  const rail = (
    <div style={{ height: "100%", borderRight: `1px solid ${LINE}`, background: "rgba(214,178,102,.05)" }}>
      <div style={{ position: "sticky", top: 0, height: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ writingMode: "vertical-rl", fontFamily: SERIF, fontSize: 13, letterSpacing: ".5em", color: accent, opacity: 0.9 }}>
          SONG HỶ LÂM MÔN
        </div>
      </div>
    </div>
  );

  return (
    <PhoneShell
      card={BG} page="#0a1120" ink={INK} font={SANS} radius={14} accent={accent} rail={rail} railWidth={46}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3, backgroundImage: "radial-gradient(rgba(214,178,102,.25) 1px,transparent 1px),radial-gradient(rgba(214,178,102,.12) 1px,transparent 1px)", backgroundSize: "22px 22px,11px 11px", backgroundPosition: "0 0,7px 9px" }} />}
    >
      <div style={{ padding: "34px 20px 46px", display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Mở đầu bằng chữ — ảnh để sau */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL }}>Thiệp mời dự lễ thành hôn</div>
          <div className="wed-ink" style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.1 }}>{d.bride}</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: accent, letterSpacing: ".2em" }}>✦</div>
          <div className="wed-ink-2" style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.1 }}>{d.groom}</div>
          {d.date.valid && <div style={{ marginTop: 8, fontSize: 12, letterSpacing: ".22em", color: accent }}>{d.date.weekday.toUpperCase()} · {d.date.dotted}</div>}
          {d.dateSub && <div style={{ fontSize: 12.5, color: STEEL }}>{d.dateSub}</div>}
          {d.reception && <div style={{ fontSize: 12.5, color: STEEL }}>{d.reception}</div>}
        </div>

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: LINE, border: `1px solid ${LINE}` }}
          box={{ background: BG, padding: "14px 2px", textAlign: "center" }}
          num={{ fontFamily: SERIF, fontSize: 26, color: accent }}
          lab={{ fontSize: 9, color: STEEL, letterSpacing: ".14em" }}
        />

        {/* Ảnh ngang TRÀN mép phải */}
        <Slot src={d.hero} height={280} tint={TINT} label="Ảnh cưới" lazy={false} fx="kb" style={bleedRight} />

        {d.guest && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL }}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 40, lineHeight: 1.15, color: INK }}>{d.guest}</div>
          </div>
        )}

        {/* Hai họ: hai khối XẾP DỌC, nhãn dọc bên trái mỗi khối */}
        {d.hasFamilies && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([["Nhà trai", d.families.groom], ["Nhà gái", d.families.bride]] as const).map(([title, body]) => body && (
              <div key={title} style={{ display: "flex", gap: 14, border: `1px solid ${LINE}`, padding: "16px 18px" }}>
                <div style={{ writingMode: "vertical-rl", fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: accent, flex: "none" }}>{title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line", color: BODY }}>{body}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lịch trình: SỔ KẺ DÒNG đánh số */}
        {d.events.length > 0 && (
          <div>
            <div style={{ ...lab, marginBottom: 12 }}>Lịch trình</div>
            <div style={{ borderTop: `1px solid ${LINE}` }}>
              {d.events.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 12, alignItems: "baseline", padding: "14px 0", borderBottom: `1px solid ${HAIR}` }}>
                  <span style={{ fontFamily: SERIF, fontSize: 13, color: accent, opacity: 0.75 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.5, color: BODY }}>
                    {e.label}
                    {e.where && <span style={{ display: "block", fontSize: 12.5, color: STEEL, marginTop: 2 }}>{e.where}</span>}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: 15, color: accent, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chân dung: ảnh trái — chữ phải, xếp thành hai hàng ngang */}
        {d.portraits.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {d.portraits.map((p) => (
              <div key={p.role + p.name} style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Slot src={p.photo} height={92} width={92} radius={2} tint={TINT} label="" style={{ flex: "none", border: `1px solid ${LINE}` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL }}>{p.role}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.2 }}>{p.name}</div>
                  {p.sub && <div style={{ fontSize: 12.5, color: STEEL, lineHeight: 1.55, marginTop: 3 }}>{p.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {d.quote && (
          <Reveal anim="blur">
            <div style={{ textAlign: "center", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.8, color: BODY }}>“{d.quote}”</div>
          </Reveal>
        )}

        {d.story && (
          <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 16 }}>
            <div style={{ ...lab, marginBottom: 8 }}>Chuyện của chúng mình</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line", color: BODY }}>{d.story}</p>
          </div>
        )}

        {/* Ảnh phụ tràn mép phải, xếp dọc */}
        {d.pair.map((src, i) => <Slot key={i} src={src} height={200} tint={TINT} style={bleedRight} fx="zoom" />)}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ border: `1px solid ${LINE}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, color: BODY }}>
            <div style={lab}>Địa điểm</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, background: accent, color: BG, fontWeight: 600, fontSize: 12, letterSpacing: ".18em" }}>CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        {/* Dặn dò: danh sách nhãn–giá trị MỘT CỘT, kẻ dòng */}
        {d.infos.length > 0 && (
          <div>
            <div style={{ ...lab, marginBottom: 10 }}>Dặn dò</div>
            <div style={{ borderTop: `1px solid ${HAIR}` }}>
              {d.infos.map((i) => (
                <div key={i.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${HAIR}` }}>
                  <span style={{ fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: STEEL, flex: "none" }}>{i.label}</span>
                  <span style={{ fontSize: 14, color: BODY, textAlign: "right" }}>
                    {i.value}
                    {i.swatches && (
                      <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, verticalAlign: "middle" }}>
                        {i.swatches.map((s, k) => <span key={k} style={{ width: 16, height: 16, borderRadius: "50%", background: s, border: `1px solid ${LINE}` }} />)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.trio.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 1, ...bleedRight }}>
            <Slot src={d.trio[0]} height={230} tint={TINT} style={{ gridRow: "span 2" }} />
            {d.trio[1] && <Slot src={d.trio[1]} height={114.5} tint={TINT} />}
            {d.trio[2] && <Slot src={d.trio[2]} height={114.5} tint={TINT} />}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Xác nhận</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: accent, color: BG }}
              msgStyle={{ fontSize: 13, color: "#f0dcae" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Lời chúc</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${accent}`, padding: "10px 14px", color: BODY, fontSize: 13, lineHeight: 1.6 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: STEEL, marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Mừng cưới</div>
            {d.giftNote && <p style={{ margin: 0, fontSize: 13, color: STEEL, lineHeight: 1.6 }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ display: "flex", gap: 14, alignItems: "center", border: `1px solid ${LINE}`, padding: 16 }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7, color: BODY }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: accent }}>{g.bank.name}</div>
                  <div style={{ color: accent }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <Reveal anim="left">
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 22, display: "flex", gap: 16, alignItems: "center" }}>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={88} width={88} tint={TINT} label="" style={{ flex: "none", border: `1px solid ${LINE}` }} />}
              <div>
                <div style={lab}>Lời cảm ơn</div>
                {d.thanks && <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.8, color: BODY, whiteSpace: "pre-line" }}>{d.thanks}</p>}
              </div>
            </div>
          </Reveal>
        )}

        {d.closing && (
          <div style={{ fontFamily: SERIF, fontSize: 19, color: accent, whiteSpace: "pre-line", lineHeight: 1.6 }}>{d.closing}</div>
        )}

        <footer style={{ borderTop: `1px solid ${LINE}`, paddingTop: 22 }}>
          <div style={{ fontFamily: SERIF, fontSize: 26, color: accent }}>{d.bride} &amp; {d.groom}</div>
          <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: STEEL, marginTop: 6 }}>Thiệp cưới online</div>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
