import type { CSSProperties } from "react";
import { MapPin, ArrowDown, Quote } from "lucide-react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import StoryGallery from "../StoryGallery";
import { fmtDate, fmtShort, readConfig, GiftCard, ExtraSections, ThanksBlock, type TemplateProps } from "../shared";

// Hiện đại: tối giản, sans đậm, bố cục SPLIT, số mục cỡ lớn, gallery kiểu STORY.
const PAL = { bg: "#ffffff", surface: "#f5f6f4", text: "#1c1d1b", muted: "rgba(28,29,27,0.55)", border: "rgba(28,29,27,0.12)", accent: "#2f7d77" };

function Index({ n, accent }: { n: string; accent: string }) {
  return <span className="block font-sans text-6xl font-extrabold leading-none sm:text-7xl" style={{ color: accent, opacity: 0.18 }}>{n}</span>;
}

export default function ModernTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const wrap: CSSProperties & Record<string, string> = {
    "--wed-accent": accent, background: PAL.bg, color: PAL.text,
    fontFamily: c.font === "serif" ? "var(--font-cormorant)" : "var(--font-hanken)",
  };

  return (
    <main style={wrap} className="min-h-screen overflow-x-hidden">
      {/* Cover — split */}
      <section className="grid min-h-screen md:grid-cols-2">
        <Reveal anim="left" className="flex flex-col justify-center px-8 py-16 sm:px-14">
          <p className="text-xs font-semibold uppercase tracking-[0.4em]" style={{ color: accent }}>We&apos;re getting married</p>
          <h1 className="mt-6 font-sans text-6xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl">{groom}</h1>
          <span className="my-2 font-sans text-4xl font-light" style={{ color: accent }}>&amp;</span>
          <h1 className="font-sans text-6xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl">{bride}</h1>
          {c.wedding_date && <p className="mt-8 text-lg font-medium">{fmtDate(c.wedding_date)}</p>}
          {c.cover_quote && <p className="mt-3 max-w-sm text-sm" style={{ color: PAL.muted }}>{c.cover_quote}</p>}
          <ArrowDown className="mt-10 animate-bounce" size={22} style={{ color: accent }} />
        </Reveal>
        <div className="relative min-h-[50vh] md:min-h-screen" style={{ background: PAL.surface }}>
          {c.cover_url && (
            <img src={c.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
      </section>

      {c.wedding_date && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-8 py-20">
          <Index n="01" accent={accent} />
          <h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Đếm ngược</h2>
          <div className="mt-8"><Countdown date={c.wedding_date} /></div>
        </section></Reveal>
      )}

      {c.story && (
        <section className="mx-auto max-w-3xl px-8 py-20">
          <Reveal anim="up"><Index n="02" accent={accent} />
          <h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Câu chuyện</h2>
          <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-relaxed" style={{ color: PAL.muted }}>{c.story}</p></Reveal>
        </section>
      )}

      {events.length > 0 && (
        <section className="mx-auto max-w-3xl px-8 py-20">
          <Reveal anim="up"><Index n="03" accent={accent} /><h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Sự kiện</h2></Reveal>
          <div className="mt-8 divide-y" style={{ borderColor: PAL.border }}>
            {events.map((e, i) => (
              <Reveal key={i} anim="up" delay={i * 70}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-5" style={{ borderColor: PAL.border }}>
                  <div>
                    <p className="font-sans text-lg font-bold uppercase">{e.label || "Sự kiện"}</p>
                    {e.venue && <p className="text-sm" style={{ color: PAL.muted }}>{e.venue}{e.address ? ` · ${e.address}` : ""}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{fmtShort(e.date)}{e.time ? ` · ${e.time}` : ""}</p>
                    {e.map_url && <a href={e.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><MapPin size={12} /> Bản đồ</a>}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ExtraSections c={c} groom={groom} bride={bride} guest={guest} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      {/* Gallery — story style */}
      {gallery.length > 0 && (
        <section className="mx-auto max-w-3xl px-8 py-20">
          <Reveal anim="up"><Index n="04" accent={accent} />
          <h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Khoảnh khắc</h2>
          <p className="mt-2 text-sm" style={{ color: PAL.muted }}>Chạm hai bên để chuyển ảnh ⟵ ⟶</p></Reveal>
          <Reveal anim="zoom" className="mt-8"><StoryGallery images={gallery} /></Reveal>
        </section>
      )}

      {hasGift && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-8 py-20">
          <Index n="05" accent={accent} /><h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Mừng cưới</h2>
          {c.gift_note && <p className="mt-2 text-sm" style={{ color: PAL.muted }}>{c.gift_note}</p>}
          <div className="mt-7 flex flex-wrap gap-5">
            <GiftCard title="chú rể" bank={c.groom_bank} defaultName={groom} pal={{ ...PAL, accent }} round={14} />
            <GiftCard title="cô dâu" bank={c.bride_bank} defaultName={bride} pal={{ ...PAL, accent }} round={14} />
          </div>
        </section></Reveal>
      )}

      {c.rsvp_enabled !== false && (
        <Reveal anim="up"><section className="mx-auto max-w-3xl px-8 py-20">
          <Index n="06" accent={accent} /><h2 className="-mt-6 font-sans text-2xl font-bold uppercase tracking-tight">Xác nhận tham dự</h2>
          <p className="mb-7 mt-2 text-sm" style={{ color: PAL.muted }}>Phản hồi giúp chúng tôi chuẩn bị chu đáo hơn.</p>
          <RsvpForm slug={inv.slug} note={c.rsvp_note} />
        </section></Reveal>
      )}

      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section className="mx-auto max-w-3xl px-8 py-20">
          <Reveal anim="up"><h2 className="font-sans text-2xl font-bold uppercase tracking-tight">Sổ lưu bút</h2></Reveal>
          <div className="mt-8 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
            {wishes.map((w, i) => (
              <Reveal key={i} anim="up" delay={(i % 4) * 60}>
                <div className="break-inside-avoid rounded-lg p-4 text-left" style={{ background: PAL.surface }}>
                  <Quote size={15} style={{ color: accent }} /><p className="mt-1 text-sm leading-relaxed">{w.wish}</p>
                  <p className="mt-2 text-xs font-semibold uppercase" style={{ color: accent }}>— {w.guest_name}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ThanksBlock note={c.thanks_note} photo={c.thanks_photo} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />

      <footer className="px-8 py-20 text-center" style={{ background: PAL.surface }}>
        <p className="font-sans text-4xl font-extrabold uppercase tracking-tight">{groom} &amp; {bride}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.3em]" style={{ color: PAL.muted }}>Thiệp cưới online</p>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
