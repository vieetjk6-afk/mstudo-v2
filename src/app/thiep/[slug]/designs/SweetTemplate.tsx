import type { CSSProperties } from "react";
import { Heart, MapPin, Calendar, Shirt, MessageCircleHeart } from "lucide-react";
import Reveal from "../Reveal";
import Countdown from "../Countdown";
import RsvpForm from "../RsvpForm";
import MusicPlayer from "../MusicPlayer";
import { fmtDate, fmtShort, readConfig, GiftCard, GuestBlock, type TemplateProps } from "../shared";

/**
 * "Ngọt ngào" — thiệp cuộn dọc đầy đủ, tông hồng pastel (theo mẫu tham khảo):
 * bìa ảnh cưới, hồ sơ cô dâu/chú rể (ảnh tròn + vai vế + cha mẹ), lịch trình
 * "Ngày trọng đại", chỉ đường, dress code, album, đếm ngược, mừng cưới, sổ lưu
 * bút, xác nhận tham dự, và lời cảm ơn. Có sẵn nội dung mẫu để chỉnh sau.
 */
const PAL = { bg: "#fbeef0", surface: "#fff8f6", text: "#5a3f42", muted: "rgba(90,63,66,0.6)", border: "rgba(201,138,134,0.24)", accent: "#c98a86" };
const DEFAULT_DRESS = ["#f3d0d4", "#c98a86", "#8ba888", "#d9c6a5"];

const initial = (s?: string) => (s || "").trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "";

export default function SweetTemplate({ inv, wishes, guest }: TemplateProps) {
  const { c, groom, bride, events, gallery, hasGift } = readConfig(inv);
  const accent = c.accent || PAL.accent;
  const soft = `${accent}1f`;
  const brideRole = c.bride_role || "Trưởng nữ";
  const groomRole = c.groom_role || "Út nam";
  const dress = c.dress_code?.length ? c.dress_code : DEFAULT_DRESS;
  const thanks = c.thanks_note || "Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại 💛";
  const location = c.location || "Việt Nam";
  const bridePhoto = c.bride_photo || gallery[0] || c.cover_url;
  const groomPhoto = c.groom_photo || gallery[1] || c.cover_url;
  const thanksPhoto = c.thanks_photo || c.cover_url || gallery[0];

  const wrap: CSSProperties & Record<string, string> = {
    "--wed-accent": accent,
    background: PAL.bg, color: PAL.text,
    fontFamily: c.font === "sans" ? "var(--font-hanken)" : "var(--font-cormorant)",
  };
  const eyebrow = (t: string) => <p className="text-[11px] uppercase tracking-[0.34em]" style={{ color: accent }}>{t}</p>;
  const heart = <div className="mx-auto my-6 flex items-center justify-center"><Heart size={20} style={{ color: accent, fill: accent }} /></div>;

  const Profile = ({ role, name, photo, sub }: { role: string; name: string; photo?: string; sub?: string }) => (
    <Reveal anim="up" className="text-center">
      <div className="mx-auto mb-5 h-52 w-52 overflow-hidden rounded-full" style={{ border: `3px solid ${accent}`, background: soft }}>
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : <div className="flex h-full w-full items-center justify-center text-5xl" style={{ color: accent }}>{initial(name)}</div>}
      </div>
      {eyebrow(role)}
      <h3 className="mt-1 text-3xl" style={{ fontFamily: "var(--font-hand), cursive", color: PAL.text }}>{name}</h3>
      {sub && <p className="mx-auto mt-2 max-w-xs text-sm" style={{ color: PAL.muted }}>{sub}</p>}
    </Reveal>
  );

  return (
    <main style={wrap} className="min-h-screen overflow-x-hidden">
      <style>{`@keyframes swKen{0%{transform:scale(1.04)}100%{transform:scale(1.14)}}`}</style>

      {/* Thanh monogram cố định */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3" style={{ background: `${PAL.bg}cc`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${PAL.border}` }}>
        <span className="text-lg tracking-[0.2em]" style={{ fontFamily: "var(--font-cormorant)", color: accent }}>{initial(bride)} <span style={{ fontStyle: "italic" }}>&amp;</span> {initial(groom)}</span>
        <Heart size={16} style={{ color: accent }} />
      </div>

      {/* Bìa */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        {c.cover_url && (<>
          <img src={c.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ animation: "swKen 16s ease-out forwards" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.42))" }} />
        </>)}
        <Reveal anim="fade" className={`relative z-10 ${c.cover_url ? "text-white" : ""}`}>
          <p className="mb-4 text-xs uppercase tracking-[0.4em] opacity-90">Chúng tôi sẽ kết hôn</p>
          <h1 className="text-5xl leading-tight sm:text-6xl" style={{ fontFamily: "var(--font-cormorant)" }}>{bride}</h1>
          <p className="my-1 text-2xl italic" style={{ color: c.cover_url ? "#fff" : accent }}>&amp;</p>
          <h1 className="text-5xl leading-tight sm:text-6xl" style={{ fontFamily: "var(--font-cormorant)" }}>{groom}</h1>
          {c.wedding_date && <p className="mt-5 text-xl tracking-[0.2em]">{fmtShort(c.wedding_date).replace(/\//g, ".")}</p>}
          <p className="mt-2 text-xs uppercase tracking-[0.3em] opacity-90">{location}</p>
          <a href="#rsvp" className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ background: accent }}>Gửi lời chúc <Heart size={14} style={{ fill: "#fff" }} /></a>
        </Reveal>
      </section>

      {/* Hồ sơ cô dâu & chú rể */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-3xl gap-14 sm:grid-cols-2">
          <Profile role={brideRole} name={bride} photo={bridePhoto} sub={c.bride_subtitle} />
          <Profile role={groomRole} name={groom} photo={groomPhoto} sub={c.groom_subtitle} />
        </div>
      </section>

      {c.cover_quote && (
        <section className="px-6 pb-4 text-center">{heart}
          <Reveal anim="up"><p className="mx-auto max-w-xl text-lg italic" style={{ color: PAL.muted }}>“{c.cover_quote}”</p></Reveal>
        </section>
      )}

      {/* Câu chuyện */}
      {c.story && (
        <section className="mx-auto max-w-2xl px-6 py-12 text-center">
          <Reveal anim="up">{eyebrow("Chuyện của chúng mình")}
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed" style={{ color: PAL.muted }}>{c.story}</p></Reveal>
        </section>
      )}

      {/* Lịch trình — Ngày trọng đại */}
      {events.length > 0 && (
        <section className="px-6 py-14" style={{ background: soft }}>
          <Reveal anim="up" className="text-center">{heart}{eyebrow("Lịch trình")}
            <h2 className="mt-1 text-4xl" style={{ fontFamily: "var(--font-hand), cursive", color: PAL.text }}>Ngày Trọng Đại</h2></Reveal>
          <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
            {events.map((e, i) => (
              <Reveal key={i} anim="up" className="rounded-2xl p-6 text-center" style={{ background: PAL.surface, border: `1px solid ${PAL.border}` }}>
                <Heart size={16} className="mx-auto mb-2" style={{ color: accent, fill: accent }} />
                <h3 className="text-2xl" style={{ fontFamily: "var(--font-cormorant)", color: accent }}>{e.label || "Sự kiện"}</h3>
                {e.date && <p className="mt-2 flex items-center justify-center gap-1.5 text-sm"><Calendar size={14} style={{ color: accent }} /> {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}</p>}
                {e.venue && <p className="mt-1 flex items-center justify-center gap-1.5 text-sm" style={{ color: PAL.muted }}><MapPin size={14} style={{ color: accent }} /> {e.venue}</p>}
                {e.address && <p className="mt-0.5 text-xs" style={{ color: PAL.muted }}>{e.address}</p>}
                {(e.map_url || c.map_url) && (
                  <a href={(e.map_url || c.map_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium" style={{ borderColor: accent, color: accent }}><MapPin size={13} /> Chỉ đường</a>
                )}
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Tên khách mời (sau phần Ngày Trọng Đại) */}
      {guest && <GuestBlock name={guest} label={c.guest_greeting?.trim() || "Trân trọng kính mời"} pal={{ accent, surface: PAL.surface, text: PAL.text, muted: PAL.muted, border: PAL.border }} />}

      {/* Đếm ngược */}
      {c.wedding_date && (
        <section className="px-6 py-14 text-center">{eyebrow("Đếm ngược đến ngày vui")}
          <div className="mt-6"><Countdown date={c.wedding_date} /></div>
        </section>
      )}

      {/* Dress code */}
      <section className="px-6 py-14 text-center" style={{ background: soft }}>
        <Reveal anim="up">
          <Shirt size={26} className="mx-auto" style={{ color: accent }} />
          {eyebrow("Màu trang phục · Dress code")}
          <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-3">
            {dress.map((col, i) => <span key={i} className="h-11 w-11 rounded-full" style={{ background: col, border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.12)" }} />)}
          </div>
          {c.dress_code_note && <p className="mx-auto mt-4 max-w-md text-sm" style={{ color: PAL.muted }}>{c.dress_code_note}</p>}
        </Reveal>
      </section>

      {/* Album ảnh cưới */}
      {gallery.length > 0 && (
        <section className="px-6 py-14 text-center">
          <Reveal anim="up">{heart}<h2 className="text-4xl" style={{ fontFamily: "var(--font-hand), cursive", color: PAL.text }}>Album Ảnh Cưới</h2></Reveal>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((g, i) => (
              <Reveal key={i} anim="fade" className="overflow-hidden rounded-xl" style={{ aspectRatio: "3/4" }}>
                <img src={g} alt="" className="h-full w-full object-cover" loading="lazy" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Mừng cưới (QR) */}
      {hasGift && (
        <section className="px-6 py-14 text-center" style={{ background: soft }}>
          <Reveal anim="up">{eyebrow("Hộp mừng cưới")}
            {c.gift_note && <p className="mx-auto mt-3 max-w-md text-sm italic" style={{ color: PAL.muted }}>{c.gift_note}</p>}
            <div className="mx-auto mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
              <GiftCard title="chú rể" bank={c.groom_bank} defaultName={groom} pal={PAL} />
              <GiftCard title="cô dâu" bank={c.bride_bank} defaultName={bride} pal={PAL} />
            </div>
          </Reveal>
        </section>
      )}

      {/* Sổ lưu bút */}
      {c.guestbook_enabled !== false && wishes.length > 0 && (
        <section className="px-6 py-14">
          <Reveal anim="up" className="text-center">{eyebrow("Sổ lưu bút")}
            <h2 className="mt-1 text-3xl" style={{ fontFamily: "var(--font-cormorant)", color: accent }}>Lời chúc phúc</h2></Reveal>
          <div className="mx-auto mt-7 max-w-xl space-y-3">
            {wishes.slice(0, 30).map((w, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: PAL.surface, border: `1px solid ${PAL.border}` }}>
                <p className="text-[15px] italic" style={{ color: PAL.text }}>“{w.wish}”</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: accent }}>{w.guest_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Xác nhận tham dự */}
      {c.rsvp_enabled !== false && (
        <section id="rsvp" className="px-6 py-16" style={{ background: soft }}>
          <Reveal anim="up" className="text-center">
            <MessageCircleHeart size={26} className="mx-auto" style={{ color: accent }} />
            {eyebrow("Xác nhận tham dự")}
            <h2 className="mt-1 text-3xl" style={{ fontFamily: "var(--font-cormorant)", color: accent }}>Gửi lời chúc đến chúng mình</h2>
          </Reveal>
          <div className="mt-8"><RsvpForm slug={inv.slug} note={c.rsvp_note} /></div>
        </section>
      )}

      {/* Lời cảm ơn */}
      <footer className="px-6 py-16 text-center">
        {c.wedding_date && <p className="text-sm italic" style={{ color: PAL.muted }}>{fmtDate(c.wedding_date)} • {location}</p>}
        {thanksPhoto && (
          <div className="mx-auto my-7 h-40 w-40 overflow-hidden rounded-full" style={{ border: `3px solid ${accent}` }}>
            <img src={thanksPhoto} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {eyebrow("Thank you")}
        <h3 className="mt-1 text-3xl" style={{ fontFamily: "var(--font-hand), cursive", color: PAL.text }}>{bride} &amp; {groom}</h3>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: PAL.muted }}>{thanks}</p>
      </footer>

      {c.music_url && <MusicPlayer url={c.music_url} autoplay={c.music_autoplay} />}
    </main>
  );
}
