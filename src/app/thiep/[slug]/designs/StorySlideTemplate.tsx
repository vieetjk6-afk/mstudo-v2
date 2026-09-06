"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtShort, readConfig, vietqrUrl, ExtraSections, type TemplateProps } from "../shared";

// Story — trải nghiệm "story trượt" toàn màn hình (430×760): thanh tiến trình,
// chạm hai bên để chuyển, nút "Tham gia ♥" mở trang chi tiết (RSVP). Port 1b.
const ACCENT = "#e8c9a8";

function useCountdown(date?: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!date || now == null) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  let diff = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(diff / 86400); diff -= d * 86400;
  const h = Math.floor(diff / 3600); diff -= h * 3600;
  const m = Math.floor(diff / 60); const s = diff - m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: String(d), h: pad(h), m: pad(m), s: pad(s) };
}

export default function StorySlideTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || ACCENT;
  const cm = "var(--font-cormorant), serif";
  const sc = "var(--font-script), cursive";
  const cd = useCountdown(c.wedding_date);
  const bg = (i: number) => gallery[i % gallery.length] || c.cover_url || "";

  // Build slides based on available content.
  const slides: { key: string; bg: string; node: React.ReactNode }[] = [];
  slides.push({
    key: "cover", bg: c.cover_url || bg(0),
    node: (
      <div style={{ position: "absolute", left: 34, right: 34, bottom: 120, textAlign: "center", color: "#fff" }}>
        <div style={{ fontFamily: sc, fontSize: 36, color: accent }}>{c.cover_quote || "Save our love story"}</div>
        <div style={{ fontFamily: cm, fontSize: 76, fontWeight: 500, lineHeight: 0.9, marginTop: 6 }}>{groom} <span style={{ fontStyle: "italic", color: accent }}>&amp;</span> {bride}</div>
        {c.wedding_date && <div style={{ fontSize: 14, letterSpacing: ".28em", textTransform: "uppercase", marginTop: 14 }}>{fmtShort(c.wedding_date)}</div>}
      </div>
    ),
  });
  if (cd) slides.push({
    key: "cd", bg: bg(1),
    node: (
      <div style={{ position: "absolute", left: 34, right: 34, bottom: 70, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>Còn lại</div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center", marginTop: 16 }}>
          {([["d", "Ngày"], ["h", "Giờ"], ["m", "Phút"], ["s", "Giây"]] as const).map(([k, lb]) => (
            <div key={k} style={{ flex: 1, background: "rgba(255,255,255,.12)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 12, padding: "12px 4px" }}>
              <div style={{ fontFamily: cm, fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{cd[k]}</div>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.85, marginTop: 4 }}>{lb}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  });
  if (events.length > 0) slides.push({
    key: "events", bg: bg(2),
    node: (<>
      <div style={{ position: "absolute", top: 64, left: 0, right: 0, textAlign: "center" }}><div style={{ fontFamily: cm, fontSize: 40, fontWeight: 600, color: "#fff" }}>Sự kiện cưới</div></div>
      <div style={{ position: "absolute", left: 26, right: 26, bottom: 60, display: "flex", flexDirection: "column", gap: 12, color: "#fff" }}>
        {events.slice(0, 3).map((e, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.12)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>{e.label}</div>
            <div style={{ fontFamily: cm, fontSize: 24, fontWeight: 600 }}>{[e.time, fmtShort(e.date)].filter(Boolean).join(" — ")}</div>
            {(e.venue || e.address) && <div style={{ fontSize: 12.5, opacity: 0.85 }}>{[e.venue, e.address].filter(Boolean).join(", ")}</div>}
          </div>
        ))}
      </div>
    </>),
  });
  if (gallery.length > 0) slides.push({
    key: "album", bg: bg(3),
    node: (<div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", textAlign: "center", color: "#fff" }}><div style={{ fontFamily: sc, fontSize: 44, color: accent, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>Album của chúng mình</div></div>),
  });
  if (c.story) slides.push({
    key: "story", bg: bg(4),
    node: (
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 64, color: "#fff" }}>
        <div style={{ fontFamily: sc, fontSize: 38, color: accent }}>Chuyện của chúng mình</div>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 14, whiteSpace: "pre-line" }}>{c.story}</p>
      </div>
    ),
  });
  slides.push({
    key: "thanks", bg: bg(5),
    node: (
      <div style={{ position: "absolute", left: 32, right: 32, bottom: 74, textAlign: "center", color: "#fff" }}>
        <div style={{ fontFamily: cm, fontSize: 30, fontWeight: 600 }}>Cảm ơn bạn rất nhiều</div>
        <p style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.7, margin: "10px 0 18px" }}>Sự hiện diện của bạn là món quà quý giá nhất trong ngày trọng đại của chúng mình.</p>
        <div style={{ fontFamily: sc, fontSize: 30, color: accent }}>{groom} &amp; {bride}</div>
      </div>
    ),
  });

  const N = slides.length;
  const [i, setI] = useState(0);
  const [prog, setProg] = useState(0);
  const [landing, setLanding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const stop = useCallback(() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; }, []);

  const go = useCallback((next: number) => {
    setI(((next % N) + N) % N); setProg(0);
  }, [N]);

  useEffect(() => {
    if (landing) { stop(); return; }
    const dur = 5200, t0 = performance.now();
    const step = (n: number) => {
      const p = Math.min(1, (n - t0) / dur);
      setProg(p);
      if (p >= 1) { setI((cur) => ((cur + 1) % N)); return; }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => stop();
  }, [i, landing, N, stop]);

  return (
    <div style={{ width: "100%", maxWidth: 430, height: "100dvh", maxHeight: 820, margin: "0 auto", position: "relative", overflow: "hidden", background: "#000", fontFamily: "var(--font-manrope), sans-serif", color: "#fff" }}>
      <style>{`@keyframes sskb{0%{transform:scale(1.02)}100%{transform:scale(1.16)}}@keyframes sshint{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* progress bars */}
      <div style={{ position: "absolute", top: 14, left: 16, right: 16, display: "flex", gap: 5, zIndex: 30 }}>
        {slides.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,.35)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", borderRadius: 3, width: k < i ? "100%" : k === i ? `${Math.round(prog * 100)}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* slides */}
      {slides.map((s, k) => (
        <div key={s.key} style={{ position: "absolute", inset: 0, opacity: k === i ? 1 : 0, transition: "opacity .7s ease", pointerEvents: k === i ? "auto" : "none" }}>
          {s.bg && <div style={{ position: "absolute", inset: 0, backgroundImage: `url('${s.bg}')`, backgroundSize: "cover", backgroundPosition: "50% 38%", animation: "sskb 10s ease-in-out infinite alternate" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(8,5,6,.82),rgba(8,5,6,.12) 45%,rgba(8,5,6,.45))" }} />
          {k === 0 && <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", color: "#f2e3d3", fontSize: 12, letterSpacing: ".5em", textTransform: "uppercase", fontWeight: 600 }}>Save the date</div>}
          {s.node}
          {k === 0 && <div style={{ position: "absolute", bottom: 92, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 12, letterSpacing: ".14em", animation: "sshint 1.8s ease-in-out infinite" }}>Chạm để xem tiếp →</div>}
        </div>
      ))}

      {/* tap zones */}
      <button aria-label="prev" onClick={() => go(i - 1)} style={{ position: "absolute", top: 56, bottom: 96, left: 0, width: "34%", border: "none", background: "transparent", cursor: "pointer", zIndex: 25 }} />
      <button aria-label="next" onClick={() => go(i + 1)} style={{ position: "absolute", top: 56, bottom: 96, right: 0, width: "66%", border: "none", background: "transparent", cursor: "pointer", zIndex: 25 }} />

      {/* JOIN */}
      <button onClick={() => setLanding(true)} style={{ position: "absolute", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 40, border: "none", cursor: "pointer", background: accent, color: "#1a1014", fontWeight: 800, fontSize: 14, letterSpacing: ".14em", textTransform: "uppercase", padding: "15px 34px", borderRadius: 999, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>Tham gia ♥</button>

      {/* LANDING */}
      {landing && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#14100f", overflowY: "auto" }}>
          <div style={{ position: "relative", height: 260, overflow: "hidden" }}>
            {(c.cover_url || bg(0)) && <div style={{ position: "absolute", inset: 0, backgroundImage: `url('${c.cover_url || bg(0)}')`, backgroundSize: "cover", backgroundPosition: "50% 40%", animation: "sskb 12s ease-in-out infinite alternate" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,#14100f,rgba(20,16,15,.2) 55%,rgba(20,16,15,.5))" }} />
            <button onClick={() => setLanding(false)} style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: 999, border: "none", background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 16, cursor: "pointer", zIndex: 2 }}>✕</button>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: 11, letterSpacing: ".4em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>Bạn được mời</div>
              <div style={{ fontFamily: cm, fontSize: 52, fontWeight: 600, lineHeight: 0.95, marginTop: 4 }}>{groom} &amp; {bride}</div>
              {c.wedding_date && <div style={{ fontSize: 12.5, letterSpacing: ".2em", textTransform: "uppercase", marginTop: 8 }}>{fmtShort(c.wedding_date)}</div>}
            </div>
          </div>

          <div style={{ padding: "24px 24px 40px", color: "#f0e6e2" }}>
            {c.rsvp_enabled !== false && (
              <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 18, padding: 20 }}>
                <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, textAlign: "center", color: "#fff" }}>Xác nhận tham dự</div>
                <p style={{ fontSize: 12.5, color: "#b09aa0", textAlign: "center", margin: "6px 0 16px" }}>Cho chúng mình biết bạn có thể đến nhé!</p>
                <RsvpForm slug={inv.slug} note={c.rsvp_note} />
              </div>
            )}

            {events.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map((e, k) => (
                  <div key={k} style={{ display: "flex", gap: 14, alignItems: "center", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ flex: "0 0 auto", fontFamily: cm, fontSize: 22, fontWeight: 600, color: accent, width: 64 }}>{e.time || ""}</div>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{e.label}</div><div style={{ fontSize: 12, color: "#b09aa0" }}>{[e.venue, e.address].filter(Boolean).join(", ")}</div></div>
                  </div>
                ))}
                {events.find((e) => e.map_url) && <a href={events.find((e) => e.map_url)!.map_url} target="_blank" rel="noreferrer" style={{ textAlign: "center", textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#1a1014", background: accent, borderRadius: 12, padding: 13 }}>Chỉ đường tới địa điểm</a>}
              </div>
            )}

            <ExtraSections c={c} groom={groom} bride={bride} guest={guest} dark pal={{ accent, surface: "rgba(255,255,255,.06)", text: "#f0e6e2", muted: "#b09aa0", border: "rgba(255,255,255,.16)" }} />

            {hasGift && (
              <>
                {c.gift_note && <p style={{ fontSize: 13, fontStyle: "italic", color: "#b09aa0", textAlign: "center", margin: "0 auto 12px", maxWidth: 420, whiteSpace: "pre-line" }}>{c.gift_note}</p>}
                <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                {[{ b: c.groom_bank, who: "Chú rể" }, { b: c.bride_bank, who: "Cô dâu" }].filter((x) => x.b?.account).map((x, k) => (
                  <div key={k} style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: 14, fontSize: 12, color: "#f0e6e2", textAlign: "center" }}>
                    {vietqrUrl(x.b) && (
                      <img src={vietqrUrl(x.b)!} alt="" width={110} height={110} style={{ width: "100%", maxWidth: 110, height: "auto", borderRadius: 8, background: "#fff", margin: "0 auto 6px" }} />
                    )}
                    {x.who} · {x.b?.name}<br /><b style={{ fontSize: 14 }}>{x.b?.account?.replace(/\s/g, "")}</b>
                  </div>
                ))}
                </div>
              </>
            )}

            {c.guestbook_enabled !== false && wishes.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {wishes.slice(0, 20).map((w, k) => (
                  <div key={k} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "12px 14px" }}>
                    <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 4px" }}>{w.wish}</p>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: accent }}>— {w.guest_name}</div>
                  </div>
                ))}
              </div>
            )}

            {(c.thanks_note || c.thanks_photo) && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                {c.thanks_photo && (
                  <div style={{ margin: "0 auto 14px", width: 150, height: 150, borderRadius: "50%", overflow: "hidden", border: `2px solid ${accent}` }}>
                    <img src={c.thanks_photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {c.thanks_note && <p style={{ maxWidth: 420, margin: "0 auto", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", color: "#b09aa0", whiteSpace: "pre-line" }}>{c.thanks_note}</p>}
              </div>
            )}
            <div style={{ fontFamily: sc, textAlign: "center", fontSize: 30, color: accent, marginTop: 22 }}>Cảm ơn bạn ❤</div>
          </div>
        </div>
      )}

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </div>
  );
}
