"use client";

import { useState } from "react";
import Logo from "./Logo";
import LangSwitch from "./LangSwitch";
import ThemeSwitch, { type VjkTheme } from "./ThemeSwitch";
import BookingButton from "./BookingButton";
import ChatWidget from "./ChatWidget";
import { VJK_CSS } from "./styles";
import { BRAND, CONTACT, SERVICES, UI, tr, type Lang } from "@/lib/vieetjk/content";

function IconFacebook() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.53-1.5H17V3.6c-.28-.04-1.25-.12-2.37-.12-2.35 0-3.96 1.43-3.96 4.07v2.27H8v3.1h2.67V21h2.83Z" />
    </svg>
  );
}
function IconTiktok() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.5 3h-3v13.1a2.42 2.42 0 1 1-2.42-2.42c.17 0 .34.02.5.06v-3.05a5.47 5.47 0 1 0 4.92 5.44V9.9a7.3 7.3 0 0 0 4.5 1.52V8.4a4.28 4.28 0 0 1-2.4-.75 4.29 4.29 0 0 1-.5-1.83Z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function VieetjkChrome({
  children,
  bookingToken,
  logoUrl = null,
  active = "",
  lang,
  theme = "dark",
}: {
  children: React.ReactNode;
  bookingToken: string | null;
  logoUrl?: string | null;
  active?: string;
  lang: Lang;
  theme?: VjkTheme;
}) {
  const [open, setOpen] = useState(false);
  const book = bookingToken ? `/book/${bookingToken}` : CONTACT.phoneHref;

  const nav = [
    { href: "/", label: tr(lang, UI.navHome), slug: "" },
    ...SERVICES.map((s) => ({ href: `/${s.slug}`, label: tr(lang, s.navLabel), slug: s.slug })),
    { href: "/#lien-he", label: tr(lang, UI.navContact), slug: "lien-he" },
  ];

  return (
    <div className={`vjk-root${theme === "light" ? " light" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: VJK_CSS }} />

      <header className="vjk-header">
        <div className="vjk-wrap vjk-headin">
          {/* <a> chứ không phải <Link>: trang này được REWRITE từ <studio>.mstudo.com
              sang /site/<studio>, nên "/" phải là một lượt tải thật để middleware
              dựng lại đúng ngữ cảnh tenant. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" aria-label={BRAND.name}>
            <Logo src={logoUrl} theme={theme} />
          </a>
          <nav className="vjk-nav">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className={active && active === n.slug ? "active" : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeSwitch theme={theme} />
            <LangSwitch lang={lang} />
            <span className="head"><BookingButton token={bookingToken} lang={lang} label={tr(lang, UI.book)} align="right" /></span>
            <button className="vjk-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <div className="vjk-mobnav">
            {nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</a>
            ))}
            <div style={{ marginTop: 16 }}>
              <BookingButton token={bookingToken} lang={lang} label={tr(lang, UI.bookNow)} />
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="vjk-footer" id="lien-he">
        <div className="vjk-wrap">
          <div className="vjk-foot-grid">
            <div>
              {/* <a> chứ không phải <Link>: trang này được REWRITE từ <studio>.mstudo.com
                  sang /site/<studio>, nên "/" phải là một lượt tải thật để middleware
                  dựng lại đúng ngữ cảnh tenant. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" aria-label={BRAND.name}><Logo src={logoUrl} theme={theme} height={34} /></a>
              <p style={{ marginTop: 16, maxWidth: "34ch" }}>{tr(lang, BRAND.tagline)}. {tr(lang, BRAND.heroSub)}</p>
              <div className="vjk-foot-social">
                <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
                <a href={CONTACT.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><IconTiktok /></a>
                <a href={`mailto:${CONTACT.email}`} aria-label="Email"><IconMail /></a>
              </div>
            </div>
            <div>
              <h4>{tr(lang, UI.services)}</h4>
              {SERVICES.map((s) => (
                <a key={s.slug} href={`/${s.slug}`}>{tr(lang, s.navLabel)}</a>
              ))}
              <a href={book}>{tr(lang, UI.book)}</a>
            </div>
            <div>
              <h4>{tr(lang, UI.navContact)}</h4>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">facebook.com/vieetjk</a>
              <p>{tr(lang, CONTACT.address)}</p>
            </div>
          </div>
          <div className="vjk-foot-bottom">
            <span>{tr(lang, BRAND.copyright)}</span>
            <span>{tr(lang, BRAND.tagline)}</span>
          </div>
        </div>
      </footer>

      {/* Trợ lý tư vấn tự động (AI) — nổi góc phải, mọi trang vieetjk. */}
      <ChatWidget lang={lang} />
    </div>
  );
}
