"use client";

import Link from "next/link";
import { Search, Calendar, Lock, Pin, Play } from "lucide-react";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { categoryLabel } from "@/lib/category";
import { PER_MONTH, useAlbumBrowse, type GalleryCard } from "./useAlbumBrowse";

/* Thư mục album — GIAO DIỆN CŨ. Logic (tìm, lọc, nhóm theo tháng) ở
   ./useAlbumBrowse, dùng chung với bản giao diện mới ./AlbumBrowseV2. */

export type { GalleryCard } from "./useAlbumBrowse";

function catLabel(cat: string | null, custom: string | null) {
  return categoryLabel(cat, custom);
}

export default function AlbumBrowse({ galleries }: { galleries: GalleryCard[] }) {
  const {
    tr,
    query,
    setQuery,
    results,
    setResults,
    searching,
    runSearch,
    media,
    setMedia,
    cat,
    setCat,
    year,
    setYear,
    expanded,
    setExpanded,
    images,
    videos,
    imageCats,
    imageGroups,
    videoYears,
    current,
  } = useAlbumBrowse(galleries);

  return (
    <main className="min-h-screen pb-24">
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 md:px-10"
        style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}
      >
        <Brand />
        <div className="flex items-center gap-3">
          <Link href="/#dat-lich" className="btn-ghost px-4 py-2 text-[13.5px]">{tr.bookBtn}</Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 pt-8 md:px-10">
        <p className="eyebrow mb-1.5">{tr.eyebrow}</p>
        <h1 className="font-serif text-[clamp(30px,5vw,52px)] font-medium leading-none">{tr.title}</h1>
        <p className="mt-3 text-[14.5px]" style={{ color: "var(--text2)" }}>
          {tr.subtitle1} <b style={{ color: "var(--text)" }}>{tr.subtitle2}</b> {tr.subtitle3}
        </p>

        <form onSubmit={runSearch} className="mt-6 flex max-w-md gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr.searchPh} className="input pl-[42px]" />
          </div>
          <button className="btn-primary whitespace-nowrap">{searching ? tr.searching : tr.searchBtn}</button>
          {results && (
            <button type="button" onClick={() => { setResults(null); setQuery(""); }} className="btn-ghost whitespace-nowrap">{tr.clearBtn}</button>
          )}
        </form>

        <div className="mt-6 inline-flex rounded-full p-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button onClick={() => setMedia("image")} className="rounded-full px-5 py-1.5 text-[13.5px] font-medium transition-colors" style={media === "image" ? { background: "var(--accent)", color: "var(--accentInk)" } : { color: "var(--text2)" }}>
            {tr.mediaImages} ({images.length})
          </button>
          <button onClick={() => setMedia("video")} className="rounded-full px-5 py-1.5 text-[13.5px] font-medium transition-colors" style={media === "video" ? { background: "var(--accent)", color: "var(--accentInk)" } : { color: "var(--text2)" }}>
            {tr.mediaVideos} ({videos.length})
          </button>
        </div>

        {/* Sub-filter: categories (image) or years (video) */}
        {media === "image" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <CatTab active={cat === "all"} onClick={() => setCat("all")}>{tr.filterAll}</CatTab>
            {imageCats.map((c) => (
              <CatTab key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>{c.label}</CatTab>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <CatTab active={year === "all"} onClick={() => setYear("all")}>{tr.filterAll}</CatTab>
            {videoYears.map((y) => (
              <CatTab key={y} active={year === y} onClick={() => setYear(y)}>{y === tr.other ? y : `${tr.yearPrefix}${y}`}</CatTab>
            ))}
          </div>
        )}

        {current.length === 0 ? (
          <p className="py-20 text-center text-sm" style={{ color: "var(--text3)" }}>
            {results ? tr.noResults : media === "video" ? tr.noVideos : tr.noPhotos}
          </p>
        ) : media === "video" || results ? (
          <div className="mt-8">
            <Grid items={current} video={media === "video"} dateLocale={tr.dateLocale} />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {imageGroups!.map(([period, items]) => {
              const isOpen = expanded[period];
              const vis = isOpen ? items : items.slice(0, PER_MONTH);
              return (
                <section key={period}>
                  <h2 className="mb-4 font-serif text-2xl font-medium">{period}</h2>
                  <Grid items={vis} dateLocale={tr.dateLocale} />
                  {items.length > PER_MONTH && (
                    <div className="mt-4 text-center">
                      <button onClick={() => setExpanded((e) => ({ ...e, [period]: !isOpen }))} className="btn-ghost">
                        {isOpen ? tr.collapse : `${tr.viewMore} (${items.length - PER_MONTH})`}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function CatTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-[13px] transition-colors"
      style={active ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
    >
      {children}
    </button>
  );
}

function Grid({ items, video, dateLocale }: { items: GalleryCard[]; video?: boolean; dateLocale: string }) {
  return (
    <div className="grid gap-[clamp(14px,2vw,20px)] [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {items.map((g) => (
        <Link
          key={g.slug}
          href={`/album/${g.slug}`}
          className="group relative overflow-hidden rounded-xl animate-[vkFade_.5s_ease_both]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="relative aspect-[4/5] overflow-hidden">
            {g.cover_url ? (
              <img src={g.cover_url} alt={g.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0" style={{ background: "var(--surface2)" }} />
            )}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,0) 55%)" }} />
            {video && (
              <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(10,10,12,.5)", color: "#fff", backdropFilter: "blur(6px)" }}>
                <Play size={20} fill="currentColor" strokeWidth={0} />
              </span>
            )}
            <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "rgba(10,10,12,.6)", color: "#fff", backdropFilter: "blur(6px)" }}>
              {catLabel(g.category, g.category_label)}
            </span>
            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(10,10,12,.6)", color: "#fff", backdropFilter: "blur(6px)" }}>
              {g.gallery_pinned ? <Pin size={12} /> : <Lock size={12} />}
            </span>
            <div className="absolute inset-x-3 bottom-3">
              <h3 className="font-serif text-xl font-medium leading-tight text-white">{g.title}</h3>
              {g.event_date && (
                <p className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>
                  <Calendar size={11} /> {new Date(g.event_date).toLocaleDateString(dateLocale)}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
