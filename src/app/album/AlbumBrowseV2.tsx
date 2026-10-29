"use client";

import Link from "next/link";
import { Calendar, CalendarPlus, Film, Images, Lock, Pin, Play, SearchX } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { categoryLabel } from "@/lib/category";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import { Empty, GroupLabel, btn } from "@/components/v2/kit";
import { SearchInput, Segmented } from "@/components/v2/kit-client";
import { ChipRow, ChipV2 } from "@/app/a/[slug]/album-v2-ui";
import { PER_MONTH, useAlbumBrowse, type GalleryCard } from "./useAlbumBrowse";
import { fmtDate } from "@/lib/date";

/* ═══════════════════════════════════════════════════════════════════════════
   THƯ MỤC ALBUM (/album) — giao diện mới. Cùng dữ liệu, cùng tìm kiếm với
   AlbumBrowse (bản cũ; logic chung ở ./useAlbumBrowse). Một ô tìm + nút tìm,
   một nút chọn Ảnh / Video, hàng chip loại album (hoặc năm), album nhóm theo
   tháng, thẻ bìa dọc có nhãn loại + khoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AlbumBrowseV2({ galleries }: { galleries: GalleryCard[] }) {
  const b = useAlbumBrowse(galleries);
  const { tr } = b;
  const { theme } = useTheme();

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={{ name: "mstudo", logoUrl: "/logo-mark.svg" }}
        sub={tr.title}
        right={
          <Link href="/#dat-lich" className={btn("secondary", "sm")}>
            <CalendarPlus size={15} /> {tr.bookBtn}
          </Link>
        }
      />
      <CustomerMainV2 width={1080}>
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--tx3)" }}>
              {tr.eyebrow}
            </p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight sm:text-[30px]" style={{ letterSpacing: "-0.4px" }}>
              {tr.title}
            </h1>
            <p className="mt-1.5 max-w-[60ch] text-[14px]" style={{ color: "var(--tx2)" }}>
              {tr.subtitle1} <b style={{ color: "var(--tx)" }}>{tr.subtitle2}</b> {tr.subtitle3}
            </p>
          </div>

          <form onSubmit={b.runSearch} className="flex max-w-[560px] gap-2">
            <SearchInput value={b.query} onChange={b.setQuery} placeholder={tr.searchPh} className="min-w-0 flex-1" />
            <button className={btn("primary", "md", "flex-none")}>{b.searching ? tr.searching : tr.searchBtn}</button>
            {b.results && (
              <button
                type="button"
                onClick={() => {
                  b.setResults(null);
                  b.setQuery("");
                }}
                className={btn("ghost", "md", "flex-none")}
              >
                {tr.clearBtn}
              </button>
            )}
          </form>

          <div className="flex flex-col gap-3">
            <div>
            <Segmented
              label="Loại nội dung"
              value={b.media}
              onChange={b.setMedia}
              options={[
                { value: "image", label: tr.mediaImages, count: b.images.length },
                { value: "video", label: tr.mediaVideos, count: b.videos.length },
              ]}
            />
            </div>
            {b.media === "image" ? (
              b.imageCats.length > 0 && (
                <ChipRow label="Loại album">
                  <ChipV2 on={b.cat === "all"} onClick={() => b.setCat("all")}>
                    {tr.filterAll}
                  </ChipV2>
                  {b.imageCats.map((c) => (
                    <ChipV2 key={c.slug} on={b.cat === c.slug} onClick={() => b.setCat(c.slug)}>
                      {c.label}
                    </ChipV2>
                  ))}
                </ChipRow>
              )
            ) : (
              b.videoYears.length > 0 && (
                <ChipRow label="Năm">
                  <ChipV2 on={b.year === "all"} onClick={() => b.setYear("all")}>
                    {tr.filterAll}
                  </ChipV2>
                  {b.videoYears.map((y) => (
                    <ChipV2 key={y} on={b.year === y} onClick={() => b.setYear(y)}>
                      {y === tr.other ? y : `${tr.yearPrefix}${y}`}
                    </ChipV2>
                  ))}
                </ChipRow>
              )
            )}
          </div>

          {b.current.length === 0 ? (
            <div className="v2-card">
              <Empty
                icon={b.results ? SearchX : b.media === "video" ? Film : Images}
                title={b.results ? tr.noResults : b.media === "video" ? tr.noVideos : tr.noPhotos}
              />
            </div>
          ) : b.media === "video" || b.results ? (
            <CardGrid items={b.current} video={b.media === "video"} dateLocale={tr.dateLocale} />
          ) : (
            <div className="flex flex-col gap-8">
              {b.imageGroups!.map(([period, items]) => {
                const open = b.expanded[period];
                const vis = open ? items : items.slice(0, PER_MONTH);
                return (
                  <section key={period} className="flex flex-col gap-3">
                    <GroupLabel count={`${items.length} album`}>{period}</GroupLabel>
                    <CardGrid items={vis} dateLocale={tr.dateLocale} />
                    {items.length > PER_MONTH && (
                      <button type="button" onClick={() => b.setExpanded((e) => ({ ...e, [period]: !open }))} className={btn("secondary", "md", "self-center")}>
                        {open ? tr.collapse : `${tr.viewMore} (${items.length - PER_MONTH})`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </CustomerMainV2>
    </CustomerRootV2>
  );
}

function CardGrid({ items, video }: { items: GalleryCard[]; video?: boolean; dateLocale?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((g) => (
        <Link key={g.slug} href={`/album/${g.slug}`} className="v2-card v2-card-link group flex flex-col overflow-hidden">
          <div className="relative aspect-[4/5] overflow-hidden" style={{ background: "var(--sf2)" }}>
            {g.cover_url ? (
              <img src={g.cover_url} alt={g.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--tx3)" }}>
                <Images size={28} />
              </span>
            )}
            {video && (
              <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(10,10,12,.5)", color: "#fff", backdropFilter: "blur(6px)" }}>
                <Play size={20} fill="currentColor" strokeWidth={0} />
              </span>
            )}
            <span className="v2-badge absolute left-2.5 top-2.5" style={{ background: "rgba(10,10,12,.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
              {categoryLabel(g.category, g.category_label)}
            </span>
            <span
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full"
              title={g.gallery_pinned ? "Album công khai" : "Cần mật khẩu"}
              style={{ background: "rgba(10,10,12,.55)", color: "#fff", backdropFilter: "blur(6px)" }}
            >
              {g.gallery_pinned ? <Pin size={13} /> : <Lock size={13} />}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2.5">
            <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{g.title}</p>
            {g.event_date && (
              <p className="flex items-center gap-1 text-[12px]" style={{ color: "var(--tx3)" }}>
                <Calendar size={12} /> {fmtDate(g.event_date)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
