"use client";

import { useEffect, useMemo, useState } from "react";
import { VIDEO_CATEGORY } from "@/lib/types";
import { categoryLabel } from "@/lib/category";

/* ═══════════════════════════════════════════════════════════════════════════
   THƯ MỤC ALBUM (/album) — logic dùng chung cho bản cũ (AlbumBrowse.tsx) và
   bản giao diện mới (AlbumBrowseV2.tsx): ngôn ngữ, tìm theo tên / số điện
   thoại, ảnh ↔ video, lọc loại album / năm, nhóm theo tháng, "xem thêm".
   ═══════════════════════════════════════════════════════════════════════════ */

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

const isVideoCat = (c: string | null) => (c ?? "").trim().toLowerCase() === VIDEO_CATEGORY;
function periodKey(d: string | null, months: readonly string[], other: string) {
  if (!d) return other;
  const dt = new Date(d);
  return `${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

const yearKey = (d: string | null, other: string) => (d ? String(new Date(d).getFullYear()) : other);

/** Số album hiện sẵn mỗi tháng; còn lại sau nút "Xem thêm". */
export const PER_MONTH = 4;

export function useAlbumBrowse(galleries: GalleryCard[]) {
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

  return {
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
    shownImages,
    imageGroups,
    videoYears,
    shownVideos,
    current,
  };
}
