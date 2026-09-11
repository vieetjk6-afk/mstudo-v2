import type { ReactNode } from "react";
import MusicPlayer from "../../MusicPlayer";
import type { TemplateProps } from "../../shared";
import { MapBox, PhoneCountdown, PhoneShell, QuickRsvp, Reveal, Slot, phoneData } from "./kit";

// ════════════════════════════════════════════════════════════════════════════
// 3D GLASS — bố cục "băng thẻ kính vuốt ngang"
//
// Nét riêng so với 9 mẫu còn lại:
//   · phần nội dung chính (lịch trình, chuyện tình, địa điểm, hai họ, dặn dò)
//     nằm trong MỘT BĂNG VUỐT NGANG — đọc bằng cách quẹt, không cuộn dọc
//   · thẻ kế tiếp luôn ló ra một mẩu ở mép phải để người xem biết còn phải vuốt
//   · chân dung là thẻ NGANG: ảnh vuông bên trái, chữ bên phải
//   · album là lưới so le hai cỡ, không phải ba ô bằng nhau
// ════════════════════════════════════════════════════════════════════════════

const INK = "#fff", DIM = "rgba(255,255,255,.7)", DIM2 = "rgba(255,255,255,.92)";
const GLASS = { background: "rgba(255,255,255,.13)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,.3)" };
const TINT = "rgba(255,255,255,.12)";
const SANS = "var(--font-be-vietnam), system-ui, sans-serif";

export default function GlassTemplate({ inv, wishes, guest }: TemplateProps) {
  const d = phoneData(inv, guest);
  const accent = d.accent || "#ff9ad5";
  const lab = { fontSize: 10, letterSpacing: ".28em", textTransform: "uppercase" as const, color: DIM };

  // Một "trang" trong băng vuốt ngang.
  const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ ...GLASS, borderRadius: 28, padding: 22, width: "calc(100% - 56px)", display: "flex", flexDirection: "column", gap: 14, color: INK }}>
      <div style={lab}>{title}</div>
      {children}
    </div>
  );

  const panels: ReactNode[] = [];
  if (d.events.length > 0) {
    panels.push(
      <Panel key="lich" title="Lịch trình">
        {d.events.map((e, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "0 0 14px" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14.5 }}>
              <span>{e.label}</span>
              <span style={{ color: DIM, whiteSpace: "nowrap" }}>{[e.date, e.time].filter(Boolean).join(" · ")}</span>
            </div>
            {e.where && <div style={{ fontSize: 12.5, color: DIM, marginTop: 4, lineHeight: 1.55 }}>{e.where}</div>}
          </div>
        ))}
      </Panel>,
    );
  }
  if (d.story || d.quote) {
    panels.push(
      <Panel key="chuyen" title="Chuyện của tụi mình">
        {d.quote && <div style={{ fontSize: 15, lineHeight: 1.7, fontStyle: "italic", color: INK }}>“{d.quote}”</div>}
        {d.story && <div style={{ fontSize: 14, lineHeight: 1.8, color: DIM2, whiteSpace: "pre-line" }}>{d.story}</div>}
      </Panel>,
    );
  }
  if (d.venue.name || d.venue.address || d.mapHref) {
    panels.push(
      <Panel key="dd" title="Địa điểm">
        <div style={{ fontSize: 15, lineHeight: 1.6 }}>
          {d.venue.name && <strong>{d.venue.name}</strong>}
          {d.venue.name && d.venue.address && <br />}
          {d.venue.address}
        </div>
        <MapBox d={d} radius={18} height={130} />
        {d.mapHref && (
          <a href={d.mapHref} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", padding: 13, borderRadius: 99, background: "rgba(255,255,255,.92)", color: "#1b2a4a", fontWeight: 600, fontSize: 14 }}>Chỉ đường</a>
        )}
      </Panel>,
    );
  }
  if (d.hasFamilies) {
    panels.push(
      <Panel key="hoho" title="Hai họ">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13.5, lineHeight: 1.75 }}>
          <div><div style={{ ...lab, marginBottom: 4 }}>Nhà trai</div><span style={{ whiteSpace: "pre-line" }}>{d.families.groom || "—"}</span></div>
          <div><div style={{ ...lab, marginBottom: 4 }}>Nhà gái</div><span style={{ whiteSpace: "pre-line" }}>{d.families.bride || "—"}</span></div>
        </div>
      </Panel>,
    );
  }
  if (d.infos.length > 0) {
    panels.push(
      <Panel key="dando" title="Dặn dò">
        {d.infos.map((i) => (
          <div key={i.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 14 }}>
            <span style={{ ...lab, letterSpacing: ".2em", flex: "none" }}>{i.label}</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {i.value}
              {i.swatches && (
                <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, verticalAlign: "middle" }}>
                  {i.swatches.map((s, k) => <span key={k} style={{ width: 16, height: 16, borderRadius: "50%", background: s, border: "1px solid rgba(255,255,255,.6)" }} />)}
                </span>
              )}
            </span>
          </div>
        ))}
      </Panel>,
    );
  }

  return (
    <PhoneShell
      card="linear-gradient(160deg,#1b2a4a,#2d1b4a 50%,#0f2e3e)" page="#111a2c" ink={INK} font={SANS} radius={38} accent={accent}
      pattern={
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 230, height: 230, right: -60, top: 60, borderRadius: "50%", background: "linear-gradient(140deg,#ff9ad5,#8f7bff)", filter: "blur(2px)", opacity: 0.85, animation: "glFloat 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 150, height: 150, left: -40, top: 380, borderRadius: "50%", background: "linear-gradient(140deg,#7bf0ff,#4d8bff)", opacity: 0.8, animation: "glFloat 12s ease-in-out infinite 1s" }} />
          <div style={{ position: "absolute", width: 190, height: 190, right: -50, bottom: 120, borderRadius: "50%", background: "linear-gradient(140deg,#ffd98f,#ff7bb4)", opacity: 0.7, animation: "glFloat 11s ease-in-out infinite 2s" }} />
        </div>
      }
    >
      <style>{`@keyframes glFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>

      <div style={{ padding: "34px 22px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...lab, color: "rgba(255,255,255,.75)" }}>We&apos;re getting married</div>

        <div style={{ ...GLASS, borderRadius: 32, padding: "30px 22px", boxShadow: "0 20px 50px -20px rgba(0,0,0,.6)", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="wed-ink" style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.06, letterSpacing: "-.02em" }}>{d.bride}</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,.65)", letterSpacing: ".3em" }}>×</div>
          <div className="wed-ink-2" style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.06, letterSpacing: "-.02em" }}>{d.groom}</div>
          {d.date.valid && (
            <div style={{ marginTop: 14, fontSize: 12, letterSpacing: ".26em", color: "rgba(255,255,255,.75)" }}>
              {d.date.weekday.toUpperCase()} · {d.date.dotted}{d.reception ? ` · ${d.reception}` : ""}
            </div>
          )}
          {d.dateSub && <div style={{ fontSize: 12.5, color: DIM }}>{d.dateSub}</div>}
        </div>

        {d.guest && (
          <div style={{ textAlign: "center" }}>
            <div style={lab}>{d.guestLabel}</div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 40, lineHeight: 1.1 }}>{d.guest}</div>
          </div>
        )}

        <PhoneCountdown
          date={d.countdownTo}
          labels={["NGÀY", "GIỜ", "PHÚT", "GIÂY"]}
          wrap={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}
          box={{ ...GLASS, backdropFilter: "blur(14px)", borderRadius: 20, padding: "14px 2px", textAlign: "center" }}
          num={{ fontWeight: 700, fontSize: 24, color: INK }}
          lab={{ fontSize: 9, color: "rgba(255,255,255,.6)", letterSpacing: ".14em" }}
        />

        <Slot src={d.hero} height={260} radius={28} border="1px solid rgba(255,255,255,.3)" tint={TINT} label="Ảnh bìa" lazy={false} fx="kb" />
      </div>

      {/* ══ BĂNG THẺ KÍNH VUỐT NGANG ═══════════════════════════════════ */}
      {panels.length > 0 && (
        <>
          <div style={{ ...lab, padding: "0 22px 10px", display: "flex", justifyContent: "space-between" }}>
            <span>Vuốt ngang để xem</span>
            <span aria-hidden>→</span>
          </div>
          <div className="wed-swipe" style={{ gap: 12, padding: "0 22px 6px" }}>
            {panels}
          </div>
        </>
      )}

      <div style={{ padding: "26px 22px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Chân dung: thẻ NGANG, ảnh vuông bên trái */}
        {d.portraits.map((p) => (
          <div key={p.role + p.name} style={{ ...GLASS, borderRadius: 26, padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
            <Slot src={p.photo} height={92} width={92} radius={20} tint={TINT} label="" style={{ flex: "none" }} />
            <div style={{ minWidth: 0 }}>
              <div style={lab}>{p.role}</div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
              {p.sub && <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.55, marginTop: 3 }}>{p.sub}</div>}
            </div>
          </div>
        ))}

        {/* Album: lưới so le hai cỡ */}
        {d.trio.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Slot src={d.trio[0]} height={d.trio.length > 1 ? 230 : 160} radius={22} border="1px solid rgba(255,255,255,.26)" tint={TINT} fx="zoom" style={{ gridRow: d.trio.length > 2 ? "span 2" : undefined }} />
            {d.trio[1] && <Slot src={d.trio[1]} height={d.trio[2] ? 110 : 230} radius={22} border="1px solid rgba(255,255,255,.26)" tint={TINT} fx="zoom" />}
            {d.trio[2] && <Slot src={d.trio[2]} height={110} radius={22} border="1px solid rgba(255,255,255,.26)" tint={TINT} fx="zoom" />}
          </div>
        )}

        {d.rsvpOn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, color: INK }}>
            <div style={lab}>RSVP</div>
            <QuickRsvp
              slug={d.slug}
              note={d.c.rsvp_note}
              labels={["Đi chứ", "Chưa chắc", "Bận mất"]}
              btn={{ flex: 1, padding: "13px 4px", borderRadius: 18, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.14)", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              btnOn={{ background: "#fff", color: "#1b2a4a" }}
              msgStyle={{ fontSize: 13, color: "#ffd6f7" }}
            />
          </div>
        )}

        {d.wishesOn && wishes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lab}>Lời chúc</div>
            {wishes.slice(0, 8).map((w, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 18, padding: "12px 16px", fontSize: 13, lineHeight: 1.6 }}>
                {w.wish}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.65)", marginTop: 4 }}>— {w.guest_name}</div>
              </div>
            ))}
          </div>
        )}

        {d.gifts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lab}>Mừng cưới</div>
            {d.giftNote && <p style={{ margin: 0, fontSize: 13, color: DIM, lineHeight: 1.6 }}>{d.giftNote}</p>}
            {d.gifts.map((g) => (
              <div key={g.title} style={{ ...GLASS, borderRadius: 24, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                <img src={g.qr} alt="" width={74} height={74} style={{ width: 74, height: 74, flex: "none", borderRadius: 16, background: "#fff", objectFit: "contain" }} />
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {g.bank.holder || g.fallbackName}
                  <div style={{ color: DIM }}>{g.bank.name}</div>
                  <div style={{ color: DIM }}>{g.bank.account?.replace(/\s/g, "")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(d.thanks || d.thanksPhoto) && (
          <Reveal anim="up">
            <div style={{ ...GLASS, borderRadius: 28, padding: 22, display: "flex", gap: 16, alignItems: "center" }}>
              {d.thanksPhoto && <Slot src={d.thanksPhoto} height={92} width={92} radius={22} tint={TINT} label="" style={{ flex: "none" }} />}
              <div>
                <div style={lab}>Lời cảm ơn</div>
                {d.thanks && <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.8, color: DIM2, whiteSpace: "pre-line" }}>{d.thanks}</p>}
              </div>
            </div>
          </Reveal>
        )}

        {d.closing && (
          <div style={{ textAlign: "center", fontSize: 15, lineHeight: 1.75, color: DIM2, whiteSpace: "pre-line" }}>{d.closing}</div>
        )}

        <footer style={{ textAlign: "center", paddingTop: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em" }}>{d.bride} &amp; {d.groom}</div>
          <div style={{ ...lab, marginTop: 8 }}>Thiệp cưới online</div>
        </footer>
      </div>

      {d.c.music_url && <MusicPlayer url={d.c.music_url} autoplay={d.c.music_autoplay} />}
    </PhoneShell>
  );
}
