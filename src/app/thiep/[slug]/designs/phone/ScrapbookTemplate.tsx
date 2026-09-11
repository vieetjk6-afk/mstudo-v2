import type { CSSProperties } from "react";
import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// SCRAPBOOK — bố cục "trang sổ dán tay"
//
// Nét riêng so với 9 mẫu còn lại:
//   · KHÔNG khối nào thẳng: mọi thứ xoay lệch mỗi cái một góc, dán BĂNG DÍNH
//   · lịch trình viết trên GIẤY KẺ DÒNG, có lỗ gáy đục bên trái
//   · dặn dò là các TỜ NOTE nhiều màu dán chồng lệch nhau
//   · lời chúc là sticky note xoay ngẫu nhiên đều, không phải danh sách thẳng
//   · các mục ngăn nhau bằng dải BĂNG DÍNH WASHI chứ không phải đường kẻ
// ════════════════════════════════════════════════════════════════════════════

const BG = "#e9e3d6", INK = "#3a3227", BROWN = "#7a6a4e", PAPER = "#fffdf6", NOTE = "#fdf6d8", DASH = "#b6a98c";
const HAND = "var(--font-caveat), cursive";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";
const SHADOW = "0 8px 18px -10px rgba(70,60,40,.6)";
const NOTE_COLORS = ["#fdf6d8", "#e3f0dc", "#fbe0e4", "#e0ecf7"];

/** Góc xoay ổn định theo chỉ số — không dùng random để SSR và client khớp nhau. */
const tilt = (i: number) => [-2.4, 1.8, -1.2, 2.6, -3, 1.2][i % 6];

export default function ScrapbookTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#a8734f";
  const title = { fontFamily: HAND, fontSize: 27, color: INK, lineHeight: 1.2 };

  /** Mẩu băng dính washi dán đè lên mép khối. */
  const Tape = ({ style }: { style?: CSSProperties }) => (
    <span
      aria-hidden
      style={{
        position: "absolute", width: 92, height: 24, background: "rgba(215,200,150,.7)",
        backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 3px,transparent 3px 7px)",
        boxShadow: "0 1px 3px rgba(70,60,40,.25)", ...style,
      }}
    />
  );

  /** Dải băng dính ngăn giữa hai mục. */
  const Divider = ({ i }: { i: number }) => (
    <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
      <span
        aria-hidden
        style={{
          width: 120, height: 22, background: "rgba(200,186,140,.55)", transform: `rotate(${tilt(i)}deg)`,
          backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.4) 0 3px,transparent 3px 8px)",
        }}
      />
    </div>
  );

  const paper = (i: number): CSSProperties => ({
    background: PAPER, padding: 18, boxShadow: SHADOW, transform: `rotate(${tilt(i)}deg)`,
    display: "flex", flexDirection: "column", gap: 12, position: "relative",
  });

  return (
    <PhoneShell
      card={BG} page="#d8d0bd" ink={INK} font={SANS} radius={10} accent={accent}
      pattern={<div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "radial-gradient(rgba(120,105,80,.18) 1px,transparent 1px)", backgroundSize: "6px 6px" }} />}
    >
      <style>{`
        @keyframes sbTape{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes sbSway{0%,100%{transform:rotate(-2.4deg)}50%{transform:rotate(1.6deg)}}
      `}</style>

      <div style={{ padding: "26px 20px 52px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontFamily: HAND, fontSize: 23, color: BROWN }}>our little wedding book</div>

        {/* Polaroid lớn: ảnh bìa + tên viết tay dưới đáy khung */}
        <div style={{ background: PAPER, padding: "14px 14px 52px", boxShadow: "0 10px 24px -12px rgba(70,60,40,.6)", transform: "rotate(-2.2deg)", position: "relative" }}>
          <Tape style={{ top: -12, left: "50%", marginLeft: -46, transform: "rotate(-2deg)", animation: "sbTape 7s ease-in-out infinite" }} />
          <Slot src={d.hero} height={250} label="Ảnh polaroid" tint="rgba(120,105,80,.1)" lazy={false} fx="kb" />
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontFamily: HAND, fontSize: 27 }}>{d.bride} &amp; {d.groom}</div>
        </div>

        {/* Tờ note vàng: ngày cưới */}
        <div style={{ background: NOTE, padding: 20, boxShadow: SHADOW, transform: "rotate(1.2deg)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: HAND, fontSize: 31 }}>Tụi mình cưới nhau!</div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            {d.date.valid && <><strong>{d.date.weekday}, {d.date.dotted}</strong>{d.reception ? ` — ${d.reception}` : ""}<br /></>}
            {d.dateSub && <>{d.dateSub}<br /></>}
            {d.quote || "Rất mong có bạn đến chung vui, chụp hình và ăn thật no 🙂"}
          </div>
        </div>

        {d.guest && (
          <div style={{ textAlign: "center", transform: "rotate(-1deg)" }}>
            <div style={{ fontFamily: HAND, fontSize: 19, color: BROWN }}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 40, lineHeight: 1.15 }}>{d.guest}</div>
          </div>
        )}

        {d.pair.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            {d.pair.map((src, i) => (
              <div key={i} style={{ flex: 1, background: PAPER, padding: "10px 10px 34px", boxShadow: SHADOW, transform: `rotate(${i === 0 ? 2.6 : -3}deg)`, position: "relative" }}>
                <Tape style={{ top: -10, left: "50%", marginLeft: -34, width: 68, height: 20, transform: "rotate(3deg)" }} />
                <Slot src={src} height={110} tint="rgba(120,105,80,.1)" fx="zoom" />
              </div>
            ))}
          </div>
        )}

        <Divider i={0} />

        <PhoneCountdown
          date={d.countdownTo}
          labels={["ngày", "giờ", "phút", "giây"]}
          wrap={{ display: "flex", justifyContent: "center", gap: 10 }}
          box={{ background: PAPER, border: `1px dashed ${DASH}`, padding: "12px 0", width: 76, textAlign: "center", boxShadow: SHADOW }}
          boxes={[{ transform: "rotate(-1.5deg)" }, { transform: "rotate(1.5deg)" }, { transform: "rotate(-2deg)" }, { transform: "rotate(2deg)" }]}
          num={{ fontFamily: HAND, fontSize: 31 }}
          lab={{ fontSize: 11, color: BROWN, fontFamily: HAND }}
        />

        {/* Lịch trình trên GIẤY KẺ DÒNG có lỗ gáy */}
        {d.events.length > 0 && (
          <div
            style={{
              position: "relative", padding: "18px 18px 18px 34px", boxShadow: SHADOW, transform: "rotate(-0.8deg)",
              background: PAPER,
              backgroundImage: "repeating-linear-gradient(transparent 0 31px, rgba(120,150,190,.35) 31px 32px)",
              backgroundPosition: "0 14px",
            }}
          >
            <span style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 1, background: "rgba(200,120,120,.5)" }} />
            {[0, 1, 2].map((k) => (
              <span key={k} aria-hidden style={{ position: "absolute", left: 5, top: 40 + k * 70, width: 9, height: 9, borderRadius: "50%", background: BG, boxShadow: "inset 0 1px 2px rgba(0,0,0,.2)" }} />
            ))}
            <div style={{ ...title, marginBottom: 8 }}>Lịch trình ngày vui</div>
            {d.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline", minHeight: 32 }}>
                <span style={{ fontFamily: HAND, fontSize: 21, color: accent, minWidth: 62 }}>{e.time || e.date || "—"}</span>
                <span style={{ fontFamily: HAND, fontSize: 20, lineHeight: 1.55 }}>{[e.label, e.where].filter(Boolean).join(" — ")}</span>
              </div>
            ))}
          </div>
        )}

        {/* Hai họ: hai tấm thẻ dán băng dính */}
        {d.hasFamilies && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {([["Nhà trai", d.families.groom], ["Nhà gái", d.families.bride]] as const).map(([t, body], i) => body && (
              <div key={t} style={{ ...paper(i + 2), padding: "22px 18px 18px" }}>
                <Tape style={{ top: -11, left: 18, width: 76, height: 22, transform: "rotate(-4deg)" }} />
                <div style={{ fontFamily: HAND, fontSize: 22, color: accent }}>{t}</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line" }}>{body}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chân dung: hai polaroid có chú thích viết tay */}
        {d.portraits.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            {d.portraits.map((p, i) => (
              <div key={p.role + p.name} style={{ flex: 1, background: PAPER, padding: "10px 10px 12px", boxShadow: SHADOW, transform: `rotate(${i === 0 ? -2.2 : 2.4}deg)`, position: "relative" }}>
                <Tape style={{ top: -10, right: 10, width: 58, height: 18, transform: "rotate(8deg)" }} />
                <Slot src={p.photo} height={128} tint="rgba(120,105,80,.1)" label="" />
                <div style={{ fontFamily: HAND, fontSize: 17, color: BROWN, marginTop: 6 }}>{p.role}</div>
                <div style={{ fontFamily: HAND, fontSize: 24, lineHeight: 1.1 }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12, color: BROWN, lineHeight: 1.5, marginTop: 3 }}>{p.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {d.story && (
          <div style={paper(3)}>
            <div style={title}>Chuyện của tụi mình</div>
            <div style={{ fontFamily: HAND, fontSize: 21, lineHeight: 1.6, whiteSpace: "pre-line" }}>{d.story}</div>
          </div>
        )}

        <Divider i={1} />

        {(d.venue.name || d.venue.address || d.mapHref) && (
          <div style={paper(4)}>
            <Tape style={{ top: -11, left: "50%", marginLeft: -46, transform: "rotate(2deg)" }} />
            <div style={title}>Tới đây nhé</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              {d.venue.name && <strong>{d.venue.name}</strong>}
              {d.venue.name && d.venue.address && <br />}
              {d.venue.address}
            </div>
            <MapBox d={d} height={130} />
            {d.mapHref && (
              <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 12, background: INK, color: NOTE, fontFamily: HAND, fontSize: 21 }}>Mở bản đồ</a>
            )}
          </div>
        )}

        {/* Dặn dò: các tờ note nhiều màu dán chồng lệch */}
        {d.infos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {d.infos.map((i, k) => (
              <div key={i.label} style={{ width: "46%", background: NOTE_COLORS[k % NOTE_COLORS.length], padding: 14, boxShadow: SHADOW, transform: `rotate(${tilt(k + 1)}deg)` }}>
                <div style={{ fontFamily: HAND, fontSize: 21, color: accent }}>{i.label}</div>
                {i.value && <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{i.value}</div>}
                {i.swatches && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {i.swatches.map((s, j) => <span key={j} style={{ width: 18, height: 18, borderRadius: "50%", background: s, border: "1px solid rgba(255,255,255,.8)" }} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {d.trio.length > 0 && (
          <>
            <div style={{ ...title, textAlign: "center" }}>Vài tấm nữa nè</div>
            <div style={{ display: "flex", gap: 10 }}>
              {d.trio.map((src, i) => (
                <div key={i} style={{ flex: 1, background: PAPER, padding: "8px 8px 26px", boxShadow: SHADOW, animation: `sbSway 9s ease-in-out infinite ${i}s` }}>
                  <Slot src={src} height={94} tint="rgba(120,105,80,.1)" fx="zoom" />
                </div>
              ))}
            </div>
          </>
        )}

        <Divider i={2} />

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...title, textAlign: "center" }}>Bạn đi được không?</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Đi chứ!", "Để xem", "Tiếc quá"]}
              btn={{ flex: 1, padding: "12px 4px", border: `1px dashed ${BROWN}`, background: PAPER, color: INK, fontFamily: HAND, fontSize: 20, cursor: "pointer", boxShadow: SHADOW }}
              btnOn={{ background: NOTE, borderStyle: "solid" }}
              msgStyle={{ textAlign: "center", fontFamily: HAND, fontSize: 21, color: accent }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...title, textAlign: "center" }}>Lời chúc dán lên đây</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ background: NOTE_COLORS[i % NOTE_COLORS.length], padding: 14, boxShadow: SHADOW, fontFamily: HAND, fontSize: 21, lineHeight: 1.45, transform: `rotate(${tilt(i)}deg)`, position: "relative" }}>
                <Tape style={{ top: -10, left: i % 2 ? "auto" : 14, right: i % 2 ? 14 : "auto", width: 54, height: 18, transform: `rotate(${i % 2 ? 6 : -6}deg)` }} />
                {w.wish}
                <div style={{ fontSize: 16, color: BROWN, marginTop: 2 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...title, textAlign: "center" }}>Mừng cưới</div>
            {d.giftNote && <p style={{ margin: 0, fontFamily: HAND, fontSize: 20, color: BROWN, textAlign: "center", lineHeight: 1.5 }}>{d.giftNote}</p>}
            {d.gifts.map((g, i) => (
              <div key={g.title} style={{ display: "flex", gap: 14, alignItems: "center", background: PAPER, padding: 16, boxShadow: SHADOW, transform: `rotate(${tilt(i + 3)}deg)`, position: "relative" }}>
                <Tape style={{ top: -11, left: 20, width: 64, height: 20, transform: "rotate(-5deg)" }} />
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: BROWN }}>{g.bank.name}</div>
                  <div style={{ color: BROWN }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <Reveal anim="rotate">
            <div style={{ ...paper(5), alignItems: "center", textAlign: "center" }}>
              <Tape style={{ top: -11, left: "50%", marginLeft: -46, transform: "rotate(-3deg)" }} />
              <div style={{ ...title, fontSize: 24 }}>Cảm ơn bạn nhiều</div>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={150} width={150} tint="rgba(120,105,80,.1)" label="" style={{ border: `1px solid ${DASH}`, padding: 6 }} />}
              {d.thanks && <p style={{ margin: 0, fontFamily: HAND, fontSize: 21, lineHeight: 1.5, whiteSpace: "pre-line" }}>{d.thanks}</p>}
            </div>
          </Reveal>
        )}

        {d.closing && (
          <div style={{ textAlign: "center", fontFamily: HAND, fontSize: 25, color: BROWN, whiteSpace: "pre-line", lineHeight: 1.4, transform: "rotate(-1deg)" }}>{d.closing}</div>
        )}

        <footer style={{ textAlign: "center", transform: "rotate(0.8deg)" }}>
          <div style={{ fontFamily: HAND, fontSize: 30 }}>{d.bride} &amp; {d.groom}</div>
          <div style={{ fontFamily: HAND, fontSize: 17, color: BROWN }}>thiệp cưới online</div>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
