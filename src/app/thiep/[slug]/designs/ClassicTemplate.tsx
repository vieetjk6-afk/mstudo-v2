import type { CSSProperties } from "react";
import { Heart, MapPin, Calendar, Clock, Quote } from "lucide-react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtDate, readConfig, GiftCard, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Cổ điển: đối xứng, trang nhã, timeline DỌC, ảnh bìa zoom chậm (Ken Burns).
const PAL = { bg: "#fbf7f2", surface: "#ffffff", text: "#3a3530", muted: "rgba(58,53,48,0.6)", border: "rgba(58,53,48,0.14)", accent: "#b08968" };

export default function ClassicTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const wrap: CSSProperties & Record<string, string> = {
    "--wed-accent": accent,
    background: PAL.bg, color: PAL.text,
    fontFamily: c.font === "sans" ? "var(--font-hanken)" : "var(--font-cormorant)",
  };
  const line = <div className="mx-auto my-5 flex items-center justify-center gap-2"><span className="h-px w-12" style={{ background: accent }} /><Heart size={13} style={{ color: accent }} /><span className="h-px w-12" style={{ background: accent }} /></div>;

  return (
    <main style={wrap} className="min-h-screen overflow-x-hidden">
      <style>{`@keyframes clKen{0%{transform:scale(1)}100%{transform:scale(1.12)}}`}</style>

      {/* Cover */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        {c.cover_url && (<>
          <img src={c.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ animation: "clKen 14s ease-out forwards" }} />
          <div className="absolute inset-0 bg-black/35" />
        </>)}
        <Reveal anim="fade" className={`relative z-10 ${c.cover_url ? "text-white" : ""}`}>
          <p className="mb-5 text-xs uppercase tracking-[0.4em] opacity-80">Save the date</p>
          <div className="mx-auto inline-block border-y px-8 py-6" style={{ borderColor: c.cover_url ? "rgba(255,255,255,.5)" : accent }}>
            <h1 className="font-serif text-5xl leading-tight sm:text-7xl">{groom}</h1>
            <p className="my-2 font-serif text-2xl italic" style={{ color: c.cover_url ? "#fff" : accent }}>&amp;</p>
            <h1 className="font-serif text-5xl leading-tight sm:text-7xl">{bride}</h1>
          </div>
          {c.wedding_date && <p className="mt-6 font-serif text-xl tracking-wide sm:text-2xl">{fmtDate(c.wedding_date)}</p>}
          {c.cover_quote && <p className="mx-auto mt-4 max-w-md text-sm italic opacity-90">“{c.cover_quote}”</p>}
        </Reveal>
      </section>

      {c.wedding_date && (
        <Reveal anim="up"><section className="px-6 py-16 text-center">
          <h2 className="font-serif text-3xl" style={{ color: accent }}>Đếm ngược</h2>
          <div className="mt-7"><Countdown date={c.wedding_date} /></div>
        </section></Reveal>
      )}

      {c.story && (
        <section className="mx-auto max-w-2xl px-6 py-14 text-center">
          <Reveal anim="up">{line}<h2 className="font-serif text-3xl" style={{ color: accent }}>Chuyện tình yêu</h2>
          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed" style={{ color: PAL.muted }}>{c.story}</p></Reveal>
        </section>
      )}

      {/* Events — vertical timeline */}
      {events.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 py-14">
          <Reveal anim="up"><h2 className="text-center font-serif text-3xl" style={{ color: accent }}>Sự kiện cưới</h2></Reveal>
          <div className="relative mt-10 pl-8">
            <span className="absolute left-2 top-2 bottom-2 w-px" style={{ background: accent }} />
            {events.map((e, i) => (
              <Reveal key={i} anim="left" delay={i * 80}>
                <div className="relative mb-9">
                  <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4" style={{ background: accent, boxShadow: `0 0 0 4px ${PAL.bg}` }} />
                  <p className="font-serif text-2xl" style={{ color: accent }}>{e.label || "Sự kiện"}</p>
                  {(e.date || e.time) && <p className="mt-1 flex items-center gap-2 text-sm"><Calendar size={14} /> {fmtDate(e.date)} {e.time && (<><Clock size={14} /> {e.time}</>)}</p>}
                  {e.venue && <p className="mt-1 font-medium">{e.venue}</p>}
                  {e.address && <p className="text-sm" style={{ color: PAL.muted }}>{e.address}</p>}
                  {e.map_url && <a href={e.map_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs underline" style={{ color: accent }}><MapPin size={12} /> Bản đồ</a>}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      {gallery.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-3xl" style={{ color: accent }}>Khoảnh khắc</h2></Reveal>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((src, i) => (
              <Reveal key={i} anim="zoom" delay={(i % 3) * 90}>
                <img src={src} alt="" className="aspect-[3/4] w-full rounded-lg object-cover shadow-sm" loading="lazy" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {hasGift && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="font-serif text-3xl" style={{ color: accent }}>Hộp mừng cưới</h2>
          {c.gift_note && <p className="mx-auto mt-3 max-w-md text-sm italic" style={{ color: PAL.muted }}>{c.gift_note}</p>}
          <div className="mt-7 flex flex-wrap justify-center gap-5">
            <GiftCard title="chú rể" bank={c.groom_bank} defaultName={groom} pal={{ ...PAL, accent }} />
            <GiftCard title="cô dâu" bank={c.bride_bank} defaultName={bride} pal={{ ...PAL, accent }} />
          </div>
        </section></Reveal>
      )}

      {c.rsvp_enabled !== false && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-16 text-center">
          {line}<h2 className="font-serif text-3xl" style={{ color: accent }}>Xác nhận tham dự</h2>
          <p className="mx-auto mb-7 mt-3 max-w-md text-sm" style={{ color: PAL.muted }}>Sự hiện diện của bạn là niềm vinh hạnh của chúng tôi.</p>
          <RsvpForm slug={inv.slug} note={c.rsvp_note} />
        </section></Reveal>
      )}

      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-3xl" style={{ color: accent }}>Sổ lưu bút</h2></Reveal>
          <div className="mt-8 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
            {wishes.map((w, i) => (
              <Reveal key={i} anim="up" delay={(i % 4) * 60}>
                <div className="break-inside-avoid rounded-2xl p-4 text-left shadow-sm" style={{ background: PAL.surface, border: `1px solid ${PAL.border}` }}>
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
        {line}<p className="font-serif text-3xl" style={{ color: accent }}>{groom} &amp; {bride}</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs" style={{ color: PAL.muted }}>Thiệp cưới online <Heart size={11} /></p>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
