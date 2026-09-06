import type { CSSProperties } from "react";
import { MapPin, Calendar, Clock, Quote, Gem } from "lucide-react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtDate, readConfig, GiftCard, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Sang trọng: nền tối, chữ vàng lớn, khung mảnh, gạch vàng, tên có ánh kim (shimmer).
const PAL = { bg: "#15110d", surface: "rgba(255,255,255,0.04)", text: "#ece6da", muted: "rgba(236,230,218,0.6)", border: "rgba(201,168,106,0.3)", accent: "#c9a86a" };

export default function ElegantTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const wrap: CSSProperties & Record<string, string> = {
    "--wed-accent": accent, background: PAL.bg, color: PAL.text,
    fontFamily: c.font === "sans" ? "var(--font-hanken)" : "var(--font-cormorant)",
  };
  const rule = <div className="mx-auto my-6 flex items-center justify-center gap-3"><span className="h-px w-16" style={{ background: accent }} /><Gem size={14} style={{ color: accent }} /><span className="h-px w-16" style={{ background: accent }} /></div>;

  return (
    <main style={wrap} className="min-h-screen overflow-x-hidden">
      <style>{`@keyframes elShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .el-shine{background:linear-gradient(100deg,${accent} 30%,#fff7e6 50%,${accent} 70%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:elShine 5s linear infinite}`}</style>

      {/* Cover */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        {c.cover_url && (<>
          <img src={c.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(21,17,13,.55),rgba(21,17,13,.92))" }} />
        </>)}
        <Reveal anim="fade" className="relative z-10">
          <div className="mx-auto inline-block p-8" style={{ border: `1px solid ${accent}`, outline: `3px solid ${PAL.bg}`, outlineOffset: 4 }}>
            <p className="mb-5 text-[11px] uppercase tracking-[0.5em]" style={{ color: accent }}>The Wedding of</p>
            <h1 className="el-shine font-serif text-5xl leading-none sm:text-7xl">{groom}</h1>
            <p className="my-3 font-serif text-3xl italic" style={{ color: accent }}>&amp;</p>
            <h1 className="el-shine font-serif text-5xl leading-none sm:text-7xl">{bride}</h1>
          </div>
          {c.wedding_date && <p className="mt-7 text-sm uppercase tracking-[0.3em]" style={{ color: PAL.muted }}>{fmtDate(c.wedding_date)}</p>}
          {c.cover_quote && <p className="mx-auto mt-4 max-w-md text-sm italic" style={{ color: PAL.muted }}>“{c.cover_quote}”</p>}
        </Reveal>
      </section>

      {c.wedding_date && (
        <Reveal anim="up"><section className="px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.4em]" style={{ color: accent }}>Countdown</p>
          <div className="mt-7"><Countdown date={c.wedding_date} /></div>
        </section></Reveal>
      )}

      {c.story && (
        <section className="mx-auto max-w-2xl px-6 py-14 text-center">
          <Reveal anim="up">{rule}<h2 className="font-serif text-4xl" style={{ color: accent }}>Chuyện tình yêu</h2>
          <p className="mt-6 whitespace-pre-line text-lg leading-loose" style={{ color: PAL.muted }}>{c.story}</p></Reveal>
        </section>
      )}

      {events.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-4xl" style={{ color: accent }}>Sự kiện</h2></Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {events.map((e, i) => (
              <Reveal key={i} anim="up" delay={i * 90}>
                <div className="p-7 text-center" style={{ border: `1px solid ${PAL.border}`, background: PAL.surface }}>
                  <p className="font-serif text-2xl" style={{ color: accent }}>{e.label || "Sự kiện"}</p>
                  <div className="mx-auto my-3 h-px w-10" style={{ background: accent }} />
                  {(e.date || e.time) && <p className="flex items-center justify-center gap-2 text-sm"><Calendar size={14} /> {fmtDate(e.date)} {e.time && (<><Clock size={14} /> {e.time}</>)}</p>}
                  {e.venue && <p className="mt-2 font-medium">{e.venue}</p>}
                  {e.address && <p className="text-sm" style={{ color: PAL.muted }}>{e.address}</p>}
                  {e.map_url && <a href={e.map_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs" style={{ color: accent }}><MapPin size={12} /> Bản đồ</a>}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} dark pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      {gallery.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-4xl" style={{ color: accent }}>Khoảnh khắc</h2></Reveal>
          <div className="mt-9 columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
            {gallery.map((src, i) => (
              <Reveal key={i} anim="zoom" delay={(i % 3) * 80}>
                <div className="overflow-hidden" style={{ border: `1px solid ${PAL.border}` }}>
                  <img src={src} alt="" className="w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {hasGift && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="font-serif text-4xl" style={{ color: accent }}>Hộp mừng cưới</h2>
          {c.gift_note && <p className="mx-auto mt-3 max-w-md text-sm italic" style={{ color: PAL.muted }}>{c.gift_note}</p>}
          <div className="mt-7 flex flex-wrap justify-center gap-5">
            <GiftCard title="chú rể" bank={c.groom_bank} defaultName={groom} pal={{ ...PAL, accent }} round={2} />
            <GiftCard title="cô dâu" bank={c.bride_bank} defaultName={bride} pal={{ ...PAL, accent }} round={2} />
          </div>
        </section></Reveal>
      )}

      {c.rsvp_enabled !== false && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-6 py-16 text-center">
          {rule}<h2 className="font-serif text-4xl" style={{ color: accent }}>Xác nhận tham dự</h2>
          <p className="mx-auto mb-7 mt-3 max-w-md text-sm" style={{ color: PAL.muted }}>Hân hạnh được đón tiếp quý khách.</p>
          <RsvpForm slug={inv.slug} note={c.rsvp_note} />
        </section></Reveal>
      )}

      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <Reveal anim="up"><h2 className="font-serif text-4xl" style={{ color: accent }}>Sổ lưu bút</h2></Reveal>
          <div className="mt-8 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
            {wishes.map((w, i) => (
              <Reveal key={i} anim="up" delay={(i % 4) * 60}>
                <div className="break-inside-avoid p-4 text-left" style={{ background: PAL.surface, border: `1px solid ${PAL.border}` }}>
                  <Quote size={15} style={{ color: accent }} /><p className="mt-1 text-sm leading-relaxed">{w.wish}</p>
                  <p className="mt-2 text-xs font-medium" style={{ color: accent }}>— {w.guest_name}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} dark pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      <footer className="px-6 py-16 text-center">
        {rule}<p className="el-shine font-serif text-4xl">{groom} &amp; {bride}</p>
        <p className="mt-3 text-xs" style={{ color: PAL.muted }}>Thiệp cưới online</p>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
