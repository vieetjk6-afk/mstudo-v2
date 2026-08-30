"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { studioUrl } from "@/lib/hosts";
import {
  Plus,
  Image as ImageIcon,
  CheckSquare,
  ExternalLink,
  MoreHorizontal,
  Globe,
  Tag,
  Droplets,
  Filter,
  HeartOff,
  CheckCircle2,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl } from "@/lib/drive";
import { createClient } from "@/lib/supabase/client";
import PlanUsage from "@/components/PlanUsage";
import { Panel } from "@/components/studio/ui";
import StudioTrialButton from "@/components/StudioTrialButton";
import FilterDialog from "@/components/FilterDialog";
import { sortAlbums, pendingSelectionCount } from "@/lib/album-order";
import { isDeliveryPhase } from "@/lib/album-phase";

export interface AlbumRow {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  status: "draft" | "published";
  watermark_enabled: boolean;
  download_enabled: boolean;
  phase?: "selection" | "delivery" | null;
  /** Cờ CŨ của album giao khách — vẫn quyết định khi `phase` còn null. */
  is_gallery?: boolean | null;
  /** Lần gần nhất khách bấm "Đã chọn xong" trên trang album. null = chưa chốt. */
  selection_done_at?: string | null;
  // Đếm ảnh + 1 ảnh bìa dự phòng (thay vì kéo toàn bộ drive_file_id mọi ảnh).
  photoCount: number;
  coverFallback: string | null;
  selections: { count: number }[];
  // Ảnh khách đánh dấu "không thích" — studio cần xoá khỏi Drive gốc.
  dislikes?: { count: number }[];
}

export default function AlbumList({ albums, showTrial = false, trialUsed = false, canDelivery = true, canWatermark = true, studioHost = null }: { albums: AlbumRow[]; showTrial?: boolean; trialUsed?: boolean; canDelivery?: boolean; canWatermark?: boolean; /** Domain riêng của studio — link mở album phải mang tên miền đó. */ studioHost?: string | null }) {
  return (
    <div className="page-in">
      <PlanUsage />

      {/* ── Dòng mô tả + hành động ──────────────────────────────────────────
          Bản thiết kế không lặp lại tiêu đề màn ở đây (topbar đã có), chỉ một
          câu nói rõ màn này là gì rồi tới nút tạo album. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Album chọn ảnh và album giao khách — đồng bộ thẳng từ Google Drive của studio.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/dashboard/studio/album-categories" className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
            <Tag size={16} /> Loại album
          </Link>
          <Link href="/dashboard/site" className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
            <Globe size={16} /> Website riêng
          </Link>
          <Link href="/dashboard/create" className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--ac)", color: "#fff" }}>
            <Plus size={16} /> Tạo album chọn ảnh
          </Link>
          {canDelivery && (
            <Link href="/dashboard/create?phase=delivery" className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <Plus size={16} /> Tạo album hoàn thiện
            </Link>
          )}
        </div>
      </div>

      {showTrial && (
        <Panel className="mb-3.5 flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center" >
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold" style={{ color: "var(--ac)" }}>Trải nghiệm gói Studio miễn phí 1 ngày</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>Hợp đồng, lịch chụp, quản lý khách hàng và toàn bộ tính năng Studio trong 24 giờ.</p>
          </div>
          <div className="flex-none">
            <StudioTrialButton used={trialUsed} />
          </div>
        </Panel>
      )}

      {albums.length === 0 ? (
        <AlbumEmpty
          title="Chưa có album nào"
          hint="Tạo album đầu tiên để khách chọn ảnh ngay trên điện thoại — ảnh lấy thẳng từ thư mục Google Drive của studio."
          cta="Tạo album chọn ảnh"
          href="/dashboard/create"
        />
      ) : (
        <AlbumTabs albums={albums} canDelivery={canDelivery} canWatermark={canWatermark} studioHost={studioHost} />
      )}
    </div>
  );
}

/** Trạng thái trống có hướng dẫn (tính năng mới số 10 của bản thiết kế). */
function AlbumEmpty({ title, hint, cta, href }: { title: string; hint: string; cta: string; href: string }) {
  return (
    <Panel className="px-5 py-14 text-center">
      <span className="mx-auto flex h-[62px] w-[62px] items-center justify-center rounded-[16px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
        <ImageIcon size={30} />
      </span>
      <p className="mt-3.5 text-[15px] font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-[340px] text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{hint}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
        <Plus size={18} /> {cta}
      </Link>
    </Panel>
  );
}

// Tách thư viện thành 2 TAB theo giai đoạn: ALBUM CHỌN ẢNH (phase 'selection') và
// ALBUM GIAO KHÁCH (phase 'delivery') — cùng kiểu tab với trang Hợp đồng.
function AlbumTabs({ albums, canDelivery, canWatermark, studioHost }: { albums: AlbumRow[]; canDelivery: boolean; canWatermark: boolean; studioHost: string | null }) {
  const deliveryAlbums = sortAlbums(albums.filter((a) => isDeliveryPhase(a)));
  const selectionAlbums = sortAlbums(albums.filter((a) => !isDeliveryPhase(a)));
  const [tab, setTab] = useState<"selection" | "delivery">("selection");
  const doneCount = pendingSelectionCount(albums);

  const grid = (rows: AlbumRow[]) => (
    // 5 thẻ một hàng trên màn rộng: ba thẻ trải hết 1100px làm mỗi thẻ dài ngoẵng
    // và lệch tỉ lệ so với ảnh bìa. Bậc thang xuống 4 · 3 · 2 · 1 theo bề ngang.
    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[820px]:grid-cols-3 min-[1060px]:grid-cols-4 min-[1320px]:grid-cols-5">
      {rows.map((a) => (
        <AlbumCard key={a.id} a={a} canDelivery={canDelivery} canWatermark={canWatermark} studioHost={studioHost} />
      ))}
    </div>
  );

  // Gói không dùng giao khách và cũng chưa có album giao khách nào → giữ một lưới
  // gọn như trước, thêm tab rỗng chỉ làm rối.
  // Băng nhắc việc: thông báo đẩy lướt qua rồi trôi, còn dòng này ở lại cho tới
  // khi studio xử lý xong. Chỉ hiện khi thực sự có album đang chờ.
  const banner = doneCount > 0 ? (
    <div
      className="mb-3.5 flex flex-wrap items-center gap-2 rounded-[12px] px-[15px] py-[11px] text-[12.5px] font-semibold"
      style={{ background: "var(--gnS)", color: "var(--gn)", border: "1px solid var(--bd)" }}
    >
      <CheckCircle2 size={16} style={{ flex: "none" }} />
      {doneCount === 1 ? "1 album khách đã chọn xong" : `${doneCount} album khách đã chọn xong`} — đang chờ studio lọc ảnh.
      <span className="font-medium" style={{ color: "var(--tx2)" }}>Đã đưa lên đầu danh sách.</span>
    </div>
  ) : null;

  if (!canDelivery && deliveryAlbums.length === 0) return <>{banner}{grid(sortAlbums(albums))}</>;

  const rows = tab === "delivery" ? deliveryAlbums : selectionAlbums;

  return (
    <div>
      {banner}
      <div
        role="tablist"
        aria-label="Nhóm album"
        className="mb-3.5 inline-flex flex-wrap gap-[3px] rounded-[11px] p-[3px]"
        style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
      >
        {([
          ["selection", "Album chọn ảnh", selectionAlbums.length],
          ["delivery", "Album giao khách", deliveryAlbums.length],
        ] as const).map(([key, label, count]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
              style={{
                color: on ? "var(--ac)" : "var(--tx2)",
                background: on ? "var(--sf)" : "transparent",
                boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none",
              }}
            >
              {label}
              <span className="text-[11px] font-bold opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <AlbumEmpty
          title={tab === "delivery" ? "Chưa có album giao khách nào" : "Chưa có album chọn ảnh nào"}
          hint={tab === "delivery"
            ? "Chuyển một album sang giai đoạn Giao khách, hoặc tạo album hoàn thiện để gửi ảnh đã chỉnh cho khách."
            : "Tất cả album đang ở nhóm Giao khách — tạo album chọn ảnh mới khi có buổi chụp xong."}
          cta={tab === "delivery" ? "Tạo album hoàn thiện" : "Tạo album chọn ảnh"}
          href={tab === "delivery" ? "/dashboard/create?phase=delivery" : "/dashboard/create"}
        />
      ) : (
        grid(rows)
      )}
    </div>
  );
}

/**
 * Thẻ album của bản thiết kế: ảnh bìa 104px có pill giai đoạn, tên album, dòng
 * phụ (ảnh · đã chọn), thanh tiến độ chọn ảnh, rồi chân thẻ ghi trạng thái
 * watermark / xuất bản và nút ba chấm mở bảng bật-tắt nhanh.
 */
function AlbumCard({ a, canDelivery = true, canWatermark = true, studioHost = null }: { a: AlbumRow; canDelivery?: boolean; canWatermark?: boolean; studioHost?: string | null }) {
  const { t } = useLang();
  const supabase = createClient();
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState(a.status);
  const [watermark, setWatermark] = useState(a.watermark_enabled);
  const [download, setDownload] = useState(a.download_enabled);
  // Đọc giai đoạn CÙNG luật với trang khách: album đời đầu chỉ có cờ is_gallery
  // (phase null) mà hiện nhãn "Chọn ảnh" thì studio thấy một đằng, khách thấy
  // một nẻo — đúng cái bẫy đã gây lệch trước đây.
  const [phase, setPhase] = useState<"selection" | "delivery">(isDeliveryPhase(a) ? "delivery" : "selection");
  const [doneAt, setDoneAt] = useState<string | null>(a.selection_done_at ?? null);
  const [filterOpen, setFilterOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Đóng menu bật/tắt nhanh khi nhấp RA NGOÀI card (card khác hoặc vùng trang) —
  // backdrop trong card chỉ chặn nhấp trong chính card này.
  useEffect(() => {
    if (!menu) return;
    function onDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const cover = a.cover_url || (a.coverFallback ? thumbnailUrl(a.coverFallback, 800) : null);
  const picked = a.selections?.[0]?.count ?? 0;
  const photos = a.photoCount ?? 0;
  const pct = photos > 0 ? Math.min(100, Math.round((picked / photos) * 100)) : 0;
  const dislikes = a.dislikes?.[0]?.count ?? 0;
  // Khách đã bấm "Đã chọn xong" ⇒ tới lượt studio. Chỉ coi là chốt khi album có
  // ảnh: một album rỗng mang mốc chốt là dữ liệu cũ còn sót, không phải việc.
  const done = !!doneAt && photos > 0;

  async function patch(fields: Record<string, unknown>) {
    await supabase.from("albums").update(fields).eq("id", a.id);
  }

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-[14px]"
      style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
    >
      {/* Ảnh bìa theo tỉ lệ 4:3 — thẻ hẹp hơn nên bìa cao hơn con số 104px cứng
          của bản thiết kế, giữ đúng tỉ lệ ở mọi bậc lưới. */}
      <Link href={`/dashboard/albums/${a.id}`} className="relative block aspect-[4/3]" style={{ background: "var(--sf2)" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={a.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center" style={{ color: "var(--tx3)" }}>
            <ImageIcon size={26} />
          </span>
        )}
        {done && (
          <span
            className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold"
            style={{ background: "var(--gn)", color: "#fff" }}
          >
            <CheckCircle2 size={12} /> Đã chọn xong
          </span>
        )}
        {canDelivery && (
          <span
            className="absolute left-2.5 top-2.5 rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold"
            style={phase === "delivery"
              ? { background: "var(--gnS)", color: "var(--gn)" }
              : { background: "var(--acS)", color: "var(--ac)" }}
          >
            {phase === "delivery" ? "Giao khách" : "Chọn ảnh"}
          </span>
        )}
      </Link>

      <div className="px-[15px] pb-[15px] pt-[13px]">
        <p className="text-[13.5px] font-bold leading-snug" style={{ textWrap: "pretty" }}>{a.title}</p>
        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
          {photos} ảnh · {picked} lượt chọn
          {/* Có ảnh khách không thích ⇒ nhắc ngay ở thẻ album (bấm vào trang
              Lựa chọn khách để xoá trên Drive gốc). */}
          {dislikes > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-1 font-semibold" style={{ color: "var(--danger)" }}>
              <HeartOff size={12} /> {dislikes} không thích
            </span>
          )}
        </p>

        <div className="mb-[5px] mt-2.5 h-[5px] overflow-hidden rounded-[4px]" style={{ background: "var(--bd2)" }}>
          <div className="h-full rounded-[4px]" style={{ width: `${pct}%`, background: "var(--ac)" }} />
        </div>
        <p className="text-[11.5px] font-semibold" style={{ color: done ? "var(--gn)" : "var(--tx2)" }}>
          {photos === 0
            ? "Chưa nạp ảnh vào album"
            : done
              // Nói rõ VIỆC TIẾP THEO, không chỉ nói con số: đây là album duy
              // nhất trong thư viện đang chờ studio động tay.
              ? `Khách đã chốt ${picked}/${photos} ảnh · chờ lọc`
              : picked === 0
                ? "Khách chưa chọn ảnh nào"
                : `Khách đã chọn ${picked}/${photos} ảnh`}
        </p>

        <div className="mt-[11px] flex items-center gap-2 pt-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: watermark ? "var(--ac)" : "var(--tx3)" }}>
            <Droplets size={13} /> {watermark ? "Có watermark" : "Không watermark"}
          </span>
          <span className="ml-auto text-[11px] font-semibold" style={{ color: status === "published" ? "var(--gn)" : "var(--tx3)" }}>
            {status === "published" ? "Đã xuất bản" : "Nháp"}
          </span>
          <Link
            href={studioUrl(studioHost, `/a/${a.slug}`)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mở trang album (tab mới)"
            title="Mở trang album"
            className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px]"
            style={{ color: "var(--tx3)" }}
          >
            <ExternalLink size={15} />
          </Link>
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Bật/tắt nhanh"
            title="Bật/tắt nhanh"
            className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px]"
            style={{ color: "var(--tx3)" }}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>

        <Link
          href={`/dashboard/albums/${a.id}/selections`}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold"
          style={{ background: "var(--acS)", color: "var(--ac)" }}
        >
          <CheckSquare size={14} /> {t("customerSelections")}
        </Link>
      </div>

      {/* Bảng bật/tắt nhanh */}
      {menu && (
        <>
          {/* Backdrop: chạm/nhấp ra ngoài để đóng popover. */}
          <button
            type="button"
            aria-label="Đóng bảng cài đặt nhanh"
            onClick={() => setMenu(false)}
            className="absolute inset-0 z-10 cursor-default"
          />
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-[12px] p-3" style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "0 12px 34px rgba(20,15,25,.22)" }}>
            {/* Album ở lại giai đoạn "Chọn ảnh" sau khi lọc xong thì không có
                tín hiệu nào gỡ mốc chờ — nên phải có nút gỡ tay, nếu không cái
                nhãn xanh dính vĩnh viễn và thư viện mất luôn tác dụng xếp việc. */}
            {done && (
              <button
                type="button"
                onClick={() => { setDoneAt(null); setMenu(false); patch({ selection_done_at: null }); }}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-bold"
                style={{ background: "var(--gnS)", color: "var(--gn)" }}
              >
                <CheckCircle2 size={14} /> Đã lọc xong — bỏ đánh dấu
              </button>
            )}
            <Toggle label="Đã xuất bản" on={status === "published"} onChange={(v) => { setStatus(v ? "published" : "draft"); patch({ status: v ? "published" : "draft" }); }} />
            {canDelivery && (
              <Toggle
                label="Giao khách (ảnh hoàn thiện)"
                on={phase === "delivery"}
                onChange={(v) => {
                  const next = v ? "delivery" : "selection";
                  setPhase(next);
                  // Chuyển sang GIAO KHÁCH nghĩa là đã lọc xong đợt chọn này —
                  // gỡ luôn mốc chờ, nếu không album cứ nằm mãi đầu thư viện.
                  if (v && doneAt) {
                    setDoneAt(null);
                    patch({ phase: next, selection_done_at: null });
                  } else {
                    patch({ phase: next });
                  }
                }}
              />
            )}
            {/* Watermark: chỉ Photographer Plus & Studio — ảnh có watermark buộc phải
                đi qua proxy khi khách tải, ảnh thường tải thẳng từ Drive. */}
            {canWatermark && (
              <Toggle label="Watermark" on={watermark} onChange={(v) => { setWatermark(v); patch({ watermark_enabled: v }); }} />
            )}
            <Toggle label="Cho tải xuống" on={download} onChange={(v) => { setDownload(v); patch({ download_enabled: v }); }} />
            {/* Mở POPUP công cụ lọc ảnh ngay trong quản lý album. Popup render Ở
                NGOÀI khối menu này: nhấp vào popup nằm ngoài card nên menu tự
                đóng, nếu popup nằm trong menu thì nó bị gỡ theo. */}
            {phase !== "delivery" && (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
              >
                <Filter size={13} /> Lọc ảnh (Drive / máy tính)
              </button>
            )}
            <div className="mt-2 flex gap-2">
              <Link href={`/dashboard/albums/${a.id}`} className="flex-1 rounded-[9px] py-2 text-center text-[12px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                Chỉnh sửa đầy đủ
              </Link>
              <button onClick={() => setMenu(false)} className="rounded-[9px] px-3 py-2 text-[12px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                Đóng
              </button>
            </div>
          </div>
        </>
      )}

      {filterOpen && (
        <FilterDialog albumId={a.id} albumTitle={a.title} onClose={() => setFilterOpen(false)} />
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-center justify-between gap-3 py-1.5 text-[12.5px] font-medium">
      <span className="min-w-0 text-left">{label}</span>
      <span className="relative h-[22px] w-[40px] flex-none rounded-full transition-all" style={on ? { background: "var(--ac)" } : { background: "var(--sf2)", border: "1px solid var(--bd)" }}>
        <span className="absolute top-[3px] h-4 w-4 rounded-full transition-all" style={on ? { left: "20px", background: "#fff" } : { left: "3px", background: "var(--tx3)" }} />
      </span>
    </button>
  );
}
