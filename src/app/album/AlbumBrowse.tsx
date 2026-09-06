"use client";

import { useEffect, useMemo, useState } from "react";

type Lang = "vi" | "en";
const TR = {
  vi: {
    bookBtn: "Đặt lịch",
    eyebrow: "Bộ sưu tập",
    title: "Album khách hàng",
    subtitle1: "Tìm album theo tên hoặc số điện thoại. Mở album cần nhập mật khẩu là",
    subtitle2: "số điện thoại",
    subtitle3: "của khách.",
    searchPh: "Tên album hoặc số điện thoại…",
    searching: "Đang tìm…",
    searchBtn: "Tìm",
    clearBtn: "Xóa",
    mediaImages: "Hình ảnh",
    mediaVideos: "Video",
    filterAll: "Tất cả",
    yearPrefix: "Năm ",
    other: "Khác",
    noResults: "Không tìm thấy album phù hợp.",
    noVideos: "Chưa có video nào.",
    noPhotos: "Chưa có album ảnh nào.",
    collapse: "Thu gọn",
    viewMore: "Xem thêm",
    dateLocale: "vi-VN",
    months: ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"],
  },
  en: {
    bookBtn: "Book",
    eyebrow: "Collection",
    title: "Customer albums",
    subtitle1: "Find albums by name or phone number. Opening an album requires the password:",
    subtitle2: "phone number",
    subtitle3: "of the customer.",
    searchPh: "Album name or phone number…",
    searching: "Searching…",
    searchBtn: "Search",
    clearBtn: "Clear",
    mediaImages: "Photos",
    mediaVideos: "Videos",
    filterAll: "All",
    yearPrefix: "",
    other: "Other",
    noResults: "No matching albums found.",
    noVideos: "No videos yet.",
    noPhotos: "No photo albums yet.",
    collapse: "Collapse",
    viewMore: "View more",
    dateLocale: "en-GB",
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  },
} as const;
import Link from "next/link";
import { Search, Calendar, Lock, Pin, Play } from "lucide-react";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { VIDEO_CATEGORY } from "@/lib/types";
import { categoryLabel } from "@/lib/category";

export interface GalleryCard {
  slug: string;
  title: string;
  client_name: string | null;
  event_date: string | null;
  category: string | null;
  category_label: string | null;
  cover_url: string | null;
  gallery_pinned: boolean;
}

function catLabel(cat: string | null, custom: string | null) {
  return categoryLabel(cat, custom);
}
const isVideoCat = (c: string | null) => (c ?? "").trim().toLowerCase() === VIDEO_CATEGORY;
function periodKey(d: string | null, months: readonly string[], other: string) {
  if (!d) return other;
  const dt = new Date(d);
  return `${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

const yearKey = (d: string | null, other: string) => (d ? String(new Date(d).getFullYear()) : other);

export default function AlbumBrowse({ galleries }: { galleries: GalleryCard[] }) {
  const [lang, setLangState] = useState<Lang>("vi");
  useEffect(() => {
    const stored = localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "en") setLangState("en");
  }, []);
  const tr = TR[lang];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GalleryCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [media, setMedia] = useState<"image" | "video">("image");
  const [cat, setCat] = useState("all");
  const [year, setYear] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const PER_MONTH = 4;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return setResults(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/album/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.galleries ?? []);
    } catch {
      setResults([]); // lỗi mạng: đừng treo spinner vô hạn
    } finally {
      setSearching(false);
    }
  }

  const base = results ?? galleries;
  const images = useMemo(() => base.filter((g) => !isVideoCat(g.category)), [base]);
  const videos = useMemo(() => base.filter((g) => isVideoCat(g.category)), [base]);

  // Distinct image categories actually in use (the studio's own labels).
  const imageCats = useMemo(() => {
    const seen = new Set<string>();
    const out: { slug: string; label: string }[] = [];
    for (const g of images) {
      const c = g.category?.trim();
      if (c && !seen.has(c)) { seen.add(c); out.push({ slug: c, label: categoryLabel(c, g.category_label) }); }
    }
    return out;
  }, [images]);

  // Image mode: filter by category, group by month.
  const shownImages = useMemo(
    () => (cat === "all" ? images : images.filter((g) => g.category?.trim() === cat)),
    [images, cat]
  );
  const imageGroups = useMemo(() => {
    if (results) return null;
    const map = new Map<string, GalleryCard[]>();
    for (const g of shownImages) {
      const k = periodKey(g.event_date, tr.months, tr.other);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return [...map.entries()];
  }, [shownImages, results, tr]);

  // Video mode: filter by year.
  const videoYears = useMemo(
    () => [...new Set(videos.map((g) => yearKey(g.event_date, tr.other)))],
    [videos, tr]
  );
  const shownVideos = useMemo(
    () => (year === "all" ? videos : videos.filter((g) => yearKey(g.event_date, tr.other) === year)),
    [videos, year, tr]
  );

  const current = media === "image" ? shownImages : shownVideos;

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
