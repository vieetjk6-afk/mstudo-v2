import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// HOA LÁ VINTAGE — bố cục "khung viền kép, đối xứng tuyệt đối"
//
// Nét riêng so với 9 mẫu còn lại:
//   · KHUNG VIỀN KÉP bao quanh TOÀN BỘ thiệp, có hoa thị ở bốn góc
//   · mọi khối căn GIỮA đối xứng, ngăn nhau bằng dải hoa văn ❧ chứ không
//     phải đường kẻ hay khoảng trắng
//   · ảnh đều là KHUNG OVAL: một ảnh lớn giữa trang, hai ảnh nhỏ đối xứng
//   · đếm ngược là một hàng số ngăn bằng hoa thị, không có ô khung nào
//   · dặn dò viết thành từng dòng căn giữa, không đóng khung
// ════════════════════════════════════════════════════════════════════════════

const BG = "#f7f2e7", INK = "#463c2c", DARK = "#3b3222", MUTED = "#8c7c5c", LINE = "#c9bb9a", PAPER = "rgba(255,253,247,.72)";
const SERIF = "var(--font-cormorant), serif";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const HAND = "var(--font-script), cursive";

const PETALS = [
  { left: "8%", size: 12, color: "#d98fa0", dur: 13, delay: 0, opacity: 0.7 },
  { left: "38%", size: 10, color: "#c2ae7a", dur: 17, delay: 3, opacity: 0.7 },
  { left: "68%", size: 14, color: "#9db98c", dur: 15, delay: 6, opacity: 0.6 },
  { left: "88%", size: 9, color: "#d98fa0", dur: 19, delay: 9, opacity: 0.6 },
];

export default function VintageTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#b0724f";
  const lab = { fontSize: 10, letterSpacing: ".34em", textTransform: "uppercase" as const, color: MUTED };

  /** Dải hoa văn ngăn giữa các mục — mô-típ lặp đặc trưng của mẫu này. */
  const Orn = ({ big = false }: { big?: boolean }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: accent }}>
      <span style={{ width: big ? 60 : 34, height: 1, background: LINE }} />
      <span style={{ fontSize: big ? 15 : 12, opacity: 0.85 }}>❧</span>
      <span style={{ width: big ? 60 : 34, height: 1, background: LINE }} />
    </div>
  );

  const corner = (pos: React.CSSProperties) => (
    <span style={{ position: "absolute", fontSize: 13, color: accent, opacity: 0.75, lineHeight: 1, ...pos }}>❦</span>
  );

  return (
    <PhoneShell
      card={BG} page="#e6dfcd" ink={INK} font={SANS} radius={8} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {PETALS.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: p.left, top: 0, width: p.size, height: p.size, borderRadius: "60% 20% 60% 20%", background: p.color, opacity: p.opacity, animation: `vtPetal ${p.dur}s linear infinite ${p.delay}s` }} />
          ))}
        </div>
      }
    >
      <style>{`
        @keyframes vtPetal{0%{transform:translateY(-40px) rotate(0deg);opacity:0}12%{opacity:.9}100%{transform:translateY(1500px) rotate(320deg);opacity:0}}
        @keyframes vtSway{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
      `}</style>

      {/* ══ KHUNG VIỀN KÉP bao trọn thiệp ═══════════════════════════════ */}
      <div style={{ padding: 12 }}>
        <div style={{ border: `1px solid ${LINE}`, padding: 4 }}>
          <div style={{ position: "relative", border: `1px solid ${LINE}`, padding: "34px 20px 40px", display: "flex", flexDirection: "column", gap: 26, textAlign: "center" }}>
            {corner({ top: 6, left: 8 })}
            {corner({ top: 6, right: 8 })}
            {corner({ bottom: 6, left: 8 })}
            {corner({ bottom: 6, right: 8 })}

            <div>
              <div style={lab}>{d.guestLabel}</div>
              <div className="wed-ink" style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.06, color: DARK, marginTop: 12 }}>{d.bride}</div>
              <div style={{ fontFamily: HAND, fontSize: 28, color: accent, animation: "vtSway 6s ease-in-out infinite" }}>&amp;</div>
              <div className="wed-ink-2" style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.06, color: DARK }}>{d.groom}</div>
              {d.date.valid && <div style={{ marginTop: 12, fontSize: 11, letterSpacing: ".3em", color: MUTED }}>{d.date.day} THÁNG {d.date.month} · {d.date.year}</div>}
              {d.dateSub && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{d.dateSub}</div>}
              {d.reception && <div style={{ fontSize: 12.5, color: MUTED }}>{d.reception}</div>}
            </div>

            {d.guest && (
              <>
                <Orn />
                <div style={{ fontFamily: HAND, fontSize: 40, lineHeight: 1.12, color: DARK }}>{d.guest}</div>
              </>
            )}

            <Orn big />

            {/* Ảnh lớn khung OVAL giữa trang */}
            <Reveal anim="fade">
              <Slot src={d.hero} height={320} radius="50% / 42%" border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" label="Ảnh cưới" lazy={false} fx="kb" style={{ padding: 0 }} />
            </Reveal>

            {d.quote && (
              <div style={{ fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 18, lineHeight: 1.8, color: "#5a4d39" }}>“{d.quote}”</div>
            )}

            {d.story && (
              <>
                <Orn />
                <div style={lab}>Chuyện tình yêu</div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.9, color: INK, whiteSpace: "pre-line" }}>{d.story}</p>
              </>
            )}

            {/* Hai ảnh nhỏ OVAL đối xứng */}
            {d.pair.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                {d.pair.map((src, i) => (
                  <Slot key={i} src={src} height={150} width={124} radius="50% / 44%" border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" fx="zoom" />
                ))}
              </div>
            )}

            <Orn />

            {/* Đếm ngược: một hàng số ngăn bằng hoa thị */}
            <PhoneCountdown
              date={d.countdownTo}
              labels={["ngày", "giờ", "phút", "giây"]}
              wrap={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 12 }}
              box={{ textAlign: "center", position: "relative", padding: "0 8px" }}
              num={{ fontFamily: SERIF, fontSize: 34, color: DARK, lineHeight: 1 }}
              lab={{ fontSize: 9.5, letterSpacing: ".2em", color: MUTED, marginTop: 4 }}
            />

            {d.hasFamilies && (
              <>
                <Orn />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, fontSize: 13.5, lineHeight: 1.8 }}>
                  <div><div style={{ ...lab, marginBottom: 6 }}>Nhà trai</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
                  <div><div style={{ ...lab, marginBottom: 6 }}>Nhà gái</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
                </div>
              </>
            )}

            {/* Chân dung: hai khung oval XẾP DỌC, mỗi cái một mục riêng */}
            {d.portraits.map((p) => (
              <div key={p.role + p.name}>
                <Orn />
                <Slot src={p.photo} height={168} width={138} radius="50% / 44%" border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" label="" style={{ margin: "18px auto 10px" }} />
                <div style={lab}>{p.role}</div>
                <div style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1.2, color: DARK }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginTop: 4 }}>{p.sub}</div>}
              </div>
            ))}

            {/* Chương trình: căn giữa, mỗi mục ngăn bằng hoa văn */}
            {d.events.length > 0 && (
              <>
                <Orn big />
                <div style={lab}>Chương trình</div>
                {d.events.map((e, i) => (
                  <div key={i}>
                    {i > 0 && <div style={{ marginBottom: 18 }}><Orn /></div>}
                    <div style={{ fontFamily: SERIF, fontSize: 26, color: accent, lineHeight: 1.1 }}>{e.time || e.date || "—"}</div>
                    <div style={{ fontSize: 15, marginTop: 4 }}>{e.label}</div>
                    {e.where && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginTop: 2 }}>{e.where}</div>}
                  </div>
                ))}
              </>
            )}

            {(d.venue.name || d.venue.address || d.mapHref) && (
              <>
                <Orn big />
                <div style={{ border: `1px solid ${LINE}`, padding: 18, background: PAPER, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={lab}>Địa điểm</div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>
                    {d.venue.name && <strong>{d.venue.name}</strong>}
                    {d.venue.name && d.venue.address && <br />}
                    {d.venue.address}
                  </div>
                  <MapBox d={d} height={130} />
                  {d.mapHref && (
                    <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ padding: 13, border: `1px solid ${DARK}`, color: DARK, fontSize: 11, letterSpacing: ".24em" }}>XEM CHỈ ĐƯỜNG</a>
                  )}
                </div>
              </>
            )}

            {/* Dặn dò: từng dòng căn giữa, không đóng khung */}
            {d.infos.length > 0 && (
              <>
                <Orn />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {d.infos.map((i) => (
                    <div key={i.label}>
                      <div style={{ ...lab, letterSpacing: ".24em" }}>{i.label}</div>
                      {i.value && <div style={{ fontFamily: SERIF, fontSize: 21, color: DARK, marginTop: 2 }}>{i.value}</div>}
                      {i.swatches && (
                        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 6 }}>
                          {i.swatches.map((s, k) => <span key={k} style={{ width: 18, height: 18, borderRadius: "50%", background: s, border: `1px solid ${LINE}` }} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {d.trio.length > 0 && (
              <>
                <Orn big />
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {d.trio.map((src, i) => (
                    <Slot key={i} src={src} height={190} radius="50% / 34%" border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" fx="zoom" />
                  ))}
                </div>
              </>
            )}

            {d.rsvpOn && (
              <>
                <Orn big />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={lab}>Bạn sẽ đến chứ?</div>
                  <QuickRsvp
                    slug={d.slug}
                    note={d.c.rsvp_note}
                    labels={["Có", "Chưa chắc", "Không"]}
                    btn={{ flex: 1, padding: "13px 4px", border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: 13, cursor: "pointer" }}
                    btnOn={{ background: accent, color: "#fffdf7" }}
                    msgStyle={{ fontSize: 13, color: accent }}
                  />
                </div>
              </>
            )}

            {d.wishesOn && wishes.length > 0 && (
              <>
                <Orn />
                <div style={lab}>Sổ lưu bút</div>
                <div>
                  {wishes.slice(0, 8).map((w, i) => (
                    <div key={i} style={{ borderBottom: `1px dotted ${LINE}`, padding: "12px 2px", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 14, lineHeight: 1.7 }}>
                      {w.wish} <span style={{ fontStyle: "normal", fontSize: 11, color: MUTED }}>— {w.guest_name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {d.gifts.length > 0 && (
              <>
                <Orn />
                <div style={lab}>Mừng cưới</div>
                {d.giftNote && <p style={{ margin: 0, fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 13.5, color: MUTED, lineHeight: 1.7 }}>{d.giftNote}</p>}
                <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                  {d.gifts.map((g) => (
                    <div key={g.title} style={{ border: `1px solid ${LINE}`, padding: 12, background: PAPER, width: 150 }}>
                      <img src={g.qr} alt="" width={126} height={126} style={{ width: "100%", height: "auto", background: "#fff" }} />
                      <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.55 }}>{g.bank.holder || g.fallbackName}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{g.bank.name}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{g.bank.account?.replace(/\s/g, "")}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(d.thanks || d.thanksPhoto) && (
              <>
                <Orn big />
                <div style={lab}>Lời cảm ơn</div>
                {d.thanksPhoto && <Slot src={d.thanksPhoto} height={168} width={138} radius="50% / 44%" border={`1px solid ${LINE}`} tint="rgba(160,140,100,.1)" label="" style={{ margin: "14px auto 0" }} />}
                {d.thanks && <p style={{ margin: "14px 0 0", fontFamily: "var(--font-lora), serif", fontStyle: "italic", fontSize: 15, lineHeight: 1.85, color: "#5a4d39", whiteSpace: "pre-line" }}>{d.thanks}</p>}
              </>
            )}

            {d.closing && (
              <>
                <Orn />
                <div style={{ fontFamily: HAND, fontSize: 24, color: accent, whiteSpace: "pre-line", lineHeight: 1.5 }}>{d.closing}</div>
              </>
            )}

            <Orn big />
            <footer>
              <div style={{ fontFamily: SERIF, fontSize: 30, color: DARK }}>{d.bride} &amp; {d.groom}</div>
              <div style={{ ...lab, marginTop: 6 }}>Thiệp cưới online</div>
            </footer>
          </div>
        </div>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
