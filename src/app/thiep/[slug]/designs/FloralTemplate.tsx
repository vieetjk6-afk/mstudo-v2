import type { CSSProperties } from "react";
import { MapPin, Calendar, Clock, Quote, Flower2 } from "lucide-react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtDate, readConfig, GiftCard, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Hoa: hồng pastel, cánh hoa bay, ảnh bìa khung VÒM, gallery POLAROID nghiêng.
const PAL = { bg: "#fdf3f4", surface: "#ffffff", text: "#4a373c", muted: "rgba(74,55,60,0.6)", border: "rgba(215,122,147,0.24)", accent: "#d77a93" };
const PETALS = ["🌸", "🌷", "🌹", "🏵️", "💮"];

export default function FloralTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const wrap: CSSProperties & Record<string, string> = {
    "--wed-accent": accent, background: PAL.bg, color: PAL.text,
    fontFamily: c.font === "sans" ? "var(--font-hanken)" : "var(--font-cormorant)",
  };
  const sprig = <p className="my-3 text-center text-2xl">🌿🌸🌿</p>;

  return (
    <main style={wrap} className="relative min-h-screen overflow-x-hidden">
      <style>{`@keyframes flFall{0%{transform:translateY(-10vh) rotate(0);opacity:0}10%{opacity:.9}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}
        @keyframes flSway{0%,100%{transform:translateX(0)}50%{transform:translateX(14px)}}`}</style>

      {/* falling petals */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="absolute text-xl" style={{ left: `${(i * 11 + 5) % 100}%`, animation: `flFall ${9 + (i % 5)}s linear ${i * 1.3}s infinite` }}>{PETALS[i % PETALS.length]}</span>
        ))}
      </div>

      {/* Cover — arch frame */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <Reveal anim="zoom" className="relative z-10">
          {c.cover_url ? (
            <div className="mx-auto mb-7 h-72 w-56 overflow-hidden shadow-lg sm:h-96 sm:w-72" style={{ borderRadius: "50% 50% 12px 12px / 35% 35% 12px 12px", border: `4px solid ${accent}` }}>
              <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : <Flower2 className="mx-auto mb-4" size={40} style={{ color: accent }} />}
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: accent }}>Save the date</p>
          <h1 className="mt-3 font-serif text-5xl italic leading-tight sm:text-6xl" style={{ color: accent }}>{groom}<span className="mx-2">&amp;</span>{bride}</h1>
          {c.wedding_date && <p className="mt-4 font-serif text-xl">{fmtDate(c.wedding_date)}</p>}
          {c.cover_quote && <p className="mx-auto mt-3 max-w-md text-sm italic" style={{ color: PAL.muted }}>“{c.cover_quote}”</p>}
        </Reveal>
      </section>

      {c.wedding_date && (
        <Reveal anim="up"><section className="px-6 py-14 text-center">
          {sprig}<h2 className="font-serif text-3xl italic" style={{ color: accent }}>Đếm ngược</h2>
          <div className="mt-6"><Countdown date={c.wedding_date} /></div>
        </section></Reveal>
      )}

      {c.story && (
        <section className="mx-auto max-w-2xl px-6 py-14 text-center">
          <Reveal anim="up">{sprig}<h2 className="font-serif text-3xl italic" style={{ color: accent }}>Chuyện tình yêu</h2>
          <p className="mt-5 whitespace-pre-line text-lg leading-relaxed" style={{ color: PAL.muted }}>{c.story}</p></Reveal>
        </section>
      )}

      {events.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-3xl italic" style={{ color: accent }}>Sự kiện cưới</h2></Reveal>
          <div className="mt-9 grid gap-6 sm:grid-cols-2">
            {events.map((e, i) => (
              <Reveal key={i} anim={i % 2 ? "right" : "left"} delay={i * 80}>
                <div className="rounded-[26px] p-6 text-center shadow-sm" style={{ background: PAL.surface, borderTop: `4px solid ${accent}` }}>
                  <p className="text-xl">🌷</p>
                  <p className="mt-1 font-serif text-2xl italic" style={{ color: accent }}>{e.label || "Sự kiện"}</p>
                  {(e.date || e.time) && <p className="mt-2 flex items-center justify-center gap-2 text-sm"><Calendar size={14} /> {fmtDate(e.date)} {e.time && (<><Clock size={14} /> {e.time}</>)}</p>}
                  {e.venue && <p className="mt-2 font-medium">{e.venue}</p>}
                  {e.address && <p className="text-sm" style={{ color: PAL.muted }}>{e.address}</p>}
                  {e.map_url && <a href={e.map_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs underline" style={{ color: accent }}><MapPin size={12} /> Bản đồ</a>}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      {gallery.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-3xl italic" style={{ color: accent }}>Khoảnh khắc</h2></Reveal>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
            {gallery.map((src, i) => (
              <Reveal key={i} anim="up" delay={(i % 4) * 70}>
                <div className="bg-white p-2 pb-6 shadow-md transition-transform hover:rotate-0" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg)` }}>
                  <img src={src} alt="" className="h-44 w-36 object-cover sm:h-52 sm:w-44" loading="lazy" />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {hasGift && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="font-serif text-3xl italic" style={{ color: accent }}>Hộp mừng cưới</h2>
          {c.gift_note && <p className="mx-auto mt-3 max-w-md text-sm italic" style={{ color: PAL.muted }}>{c.gift_note}</p>}
          <div className="mt-7 flex flex-wrap justify-center gap-5">
            <GiftCard title="chú rể" bank={c.groom_bank} defaultName={groom} pal={{ ...PAL, accent }} round={24} />
            <GiftCard title="cô dâu" bank={c.bride_bank} defaultName={bride} pal={{ ...PAL, accent }} round={24} />
          </div>
        </section></Reveal>
      )}

      {c.rsvp_enabled !== false && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-16 text-center">
          {sprig}<h2 className="font-serif text-3xl italic" style={{ color: accent }}>Xác nhận tham dự</h2>
          <p className="mx-auto mb-7 mt-3 max-w-md text-sm" style={{ color: PAL.muted }}>Rất mong được đón bạn đến chung vui 💕</p>
          <RsvpForm slug={inv.slug} note={c.rsvp_note} />
        </section></Reveal>
      )}

      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-3xl italic" style={{ color: accent }}>Sổ lưu bút</h2></Reveal>
          <div className="mt-8 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
            {wishes.map((w, i) => (
              <Reveal key={i} anim="up" delay={(i % 4) * 60}>
                <div className="break-inside-avoid rounded-[22px] p-4 text-left shadow-sm" style={{ background: PAL.surface }}>
                  <Quote size={15} style={{ color: accent }} /><p className="mt-1 text-sm leading-relaxed">{w.wish}</p>
                  <p className="mt-2 text-xs font-medium" style={{ color: accent }}>— {w.guest_name}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      <footer className="px-6 py-14 text-center">
        {sprig}<p className="font-serif text-4xl italic" style={{ color: accent }}>{groom} &amp; {bride}</p>
        <p className="mt-2 text-xs" style={{ color: PAL.muted }}>Thiệp cưới online 💐</p>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
