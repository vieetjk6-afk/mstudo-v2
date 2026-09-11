import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// GIẤY DÓ & MỰC NHO — bố cục "tờ giấy dó, ngày cưới cỡ đại"
//
// Nét riêng so với 9 mẫu còn lại:
//   · NGÀY CƯỚI in cỡ đại chiếm nửa trang, ngăn với phần chữ bằng một nét dọc
//   · ảnh là DẢI PHIM CUỘN NGANG viền giấy, không phải lưới
//   · chương trình là BẢNG CÓ DÒNG CHẤM NỐI (tên lễ …… giờ) kiểu mục lục sách
//   · hai họ đặt trong dấu ngoặc 「 」 kiểu thư pháp
//   · đếm ngược chỉ là bốn con số trần, cách nhau bằng dấu chấm giữa
// ════════════════════════════════════════════════════════════════════════════

const BG = "#efe7d6", INK = "#23201b", RED = "#b2342c", MUTED = "#7c7263", LINE = "#c9bda4", PAPER = "#f7f2e5";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function GiayDoTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || RED;
  const lab = { fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase" as const, color: MUTED };

  return (
    <PhoneShell
      card={BG} page="#ddd2ba" ink={INK} font={SANS} radius={6} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.45, backgroundImage: "repeating-linear-gradient(90deg,rgba(120,105,80,.14) 0 1px,transparent 1px 5px)" }} />}
    >
      <style>{`@keyframes gdSeal{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}`}</style>

      <div style={{ padding: "26px 22px 48px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ writingMode: "vertical-rl", fontFamily: "var(--font-playfair), serif", fontSize: 19, letterSpacing: ".42em", color: accent, paddingTop: 4 }}>THIỆP HỒNG</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <div style={lab}>Trân trọng báo tin</div>
            <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.06 }}>{d.bride}</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 24, color: accent }}>kết duyên cùng</div>
            <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.06 }}>{d.groom}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 1, background: LINE }} />
          <div style={{ width: 52, height: 52, border: `2px solid ${accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontFamily: "var(--font-playfair), serif", fontSize: 12, lineHeight: 1.1, textAlign: "center", letterSpacing: ".08em", animation: "gdSeal 8s ease-in-out infinite" }}>HỶ<br />SỰ</div>
          <div style={{ flex: 1, height: 1, background: LINE }} />
        </div>

        {/* ── NGÀY CƯỚI CỠ ĐẠI ─────────────────────────────────────────── */}
        {d.date.valid && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1px 1fr", gap: 18, alignItems: "center", borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "20px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 0.86, letterSpacing: "-.02em" }}>{d.date.day}</div>
              <div style={{ fontSize: 11, letterSpacing: ".3em", color: MUTED, marginTop: 8 }}>THÁNG {d.date.month}</div>
            </div>
            <div style={{ background: LINE, alignSelf: "stretch" }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.85 }}>
              <div style={{ fontFamily: SERIF, fontSize: 22 }}>{d.date.weekday}</div>
              <div style={{ color: MUTED }}>năm {d.date.year}</div>
              {d.lunar && <div style={{ color: MUTED }}>{d.lunar}</div>}
              {d.reception && <div style={{ color: MUTED }}>{d.reception}</div>}
            </div>
          </div>
        )}

        <div style={{ border: `1px solid ${LINE}`, padding: 8, background: PAPER }}>
          <Slot src={d.hero} height={320} label="Ảnh cưới" tint="rgba(120,105,80,.08)" lazy={false} />
        </div>

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={lab}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 42, lineHeight: 1.12, marginTop: 2 }}>{d.guest}</div>
          </div>
        )}

        {/* ── DẢI PHIM: cuộn ngang, mỗi tấm một khung giấy ──────────────── */}
        {d.photos.length > 1 && (
          <div style={{ marginLeft: -22, marginRight: -22 }}>
            <div className="wed-swipe" style={{ gap: 10, padding: "0 22px" }}>
              {d.photos.slice(1).map((src, i) => (
                <div key={i} style={{ border: `1px solid ${LINE}`, padding: 6, background: PAPER }}>
                  <Slot src={src} height={190} width={148} tint="rgba(120,105,80,.08)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {(d.quote || d.story) && (
          <div style={{ fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.8, textAlign: "center", color: "#3c372e", whiteSpace: "pre-line" }}>
            {d.quote ? `“${d.quote}”` : d.story}
          </div>
        )}

        {/* Hai họ trong dấu ngoặc thư pháp */}
        {d.hasFamilies && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {([["Nhà trai", d.families.groom], ["Nhà gái", d.families.bride]] as const).map(([title, body]) => (
              <div key={title} style={{ position: "relative", padding: "18px 10px 18px 16px" }}>
                <span style={{ position: "absolute", left: 0, top: 0, width: 14, height: 14, borderLeft: `2px solid ${accent}`, borderTop: `2px solid ${accent}` }} />
                <span style={{ position: "absolute", right: 0, bottom: 0, width: 14, height: 14, borderRight: `2px solid ${accent}`, borderBottom: `2px solid ${accent}` }} />
                <div style={{ ...lab, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.8, whiteSpace: "pre-line" }}>{body || "—"}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── CHƯƠNG TRÌNH: dòng chấm nối kiểu mục lục ──────────────────── */}
        {d.events.length > 0 && (
          <div>
            <div style={{ ...lab, marginBottom: 14 }}>Chương trình</div>
            {d.events.map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 19, flex: "none" }}>{e.label}</span>
                  <span style={{ flex: 1, borderBottom: `1px dotted ${LINE}`, transform: "translateY(-4px)" }} />
                  <span style={{ fontFamily: SERIF, fontSize: 19, color: accent, flex: "none" }}>{[e.date, e.time].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                {e.where && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 2 }}>{e.where}</div>}
              </div>
            ))}
          </div>
        )}

        {d.portraits.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" }}>
            {d.portraits.map((p) => (
              <div key={p.role + p.name}>
                <Slot src={p.photo} height={140} radius={2} tint={PAPER} label={p.role} style={{ border: `1px solid ${LINE}` }} />
                <div style={{ ...lab, marginTop: 8 }}>{p.role}</div>
                <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.2 }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{p.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={{ border: `1px solid ${LINE}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, background: PAPER }}>
            <div style={lab}>Địa điểm</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, background: accent, color: PAPER, fontSize: 11, letterSpacing: ".24em" }}>XEM CHỈ ĐƯỜNG</a>
            )}
          </div>
        )}

        {/* Đếm ngược: bốn con số trần */}
        <div style={{ textAlign: "center" }}>
          <div style={{ ...lab, marginBottom: 10 }}>Còn lại</div>
          <PhoneCountdown
            date={d.countdownTo}
            labels={["ngày", "giờ", "phút", "giây"]}
            wrap={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 14 }}
            box={{ display: "flex", alignItems: "baseline", gap: 4 }}
            num={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1 }}
            lab={{ fontSize: 11, color: MUTED }}
          />
        </div>

        {/* Dặn dò: danh sách gạch đứt màu triện */}
        {d.infos.length > 0 && (
          <div>
            {d.infos.map((i) => (
              <div key={i.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px dashed ${accent}` }}>
                <span style={{ ...lab, letterSpacing: ".22em", flex: "none" }}>{i.label}</span>
                <span style={{ fontFamily: SERIF, fontSize: 19, textAlign: "right" }}>
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
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Xác nhận tham dự</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${INK}`, background: "transparent", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: INK, color: BG }}
              msgStyle={{ fontSize: 13, color: accent }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div>
            <div style={{ ...lab, marginBottom: 8 }}>Sổ lưu bút</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ borderBottom: "1px solid #d8ceb8", padding: "10px 2px", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 14, lineHeight: 1.7 }}>
                {w.wish} <span style={{ fontStyle: "normal", fontSize: 11, color: MUTED }}>— {w.guest_name}</span>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Mừng cưới</div>
            {d.giftNote && <p style={{ margin: 0, fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 13.5, color: MUTED, lineHeight: 1.7 }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ display: "flex", gap: 14, alignItems: "center", border: `1px solid ${LINE}`, padding: 16, background: PAPER }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: MUTED }}>{g.bank.name}</div>
                  <div style={{ color: MUTED }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.closing) && (
          <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: accent, whiteSpace: "pre-line", lineHeight: 1.7 }}>
            {d.closing || d.thanks}
          </div>
        )}
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
