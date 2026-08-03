"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, Image as ImageIcon, CheckSquare, ExternalLink, Settings2, Globe, Tag } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl } from "@/lib/drive";
import { createClient } from "@/lib/supabase/client";
import PlanUsage from "@/components/PlanUsage";
import { Panel, EmptyState } from "@/components/studio/ui";
import StudioTrialButton from "@/components/StudioTrialButton";

export interface AlbumRow {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  status: "draft" | "published";
  watermark_enabled: boolean;
  download_enabled: boolean;
  phase?: "selection" | "delivery";
  // Đếm ảnh + 1 ảnh bìa dự phòng (thay vì kéo toàn bộ drive_file_id mọi ảnh).
  photoCount: number;
  coverFallback: string | null;
  selections: { count: number }[];
}

export default function AlbumList({ albums, showTrial = false, trialUsed = false, canDelivery = true, canWatermark = true }: { albums: AlbumRow[]; showTrial?: boolean; trialUsed?: boolean; canDelivery?: boolean; canWatermark?: boolean }) {
  const { t } = useLang();

  return (
    <div className="animate-fade-in">
      <PlanUsage />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-light text-accent">{t("myAlbums")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/studio/album-categories" className="btn-ghost">
            <Tag size={16} /> Loại album
          </Link>
          <Link href="/dashboard/site" className="btn-ghost">
            <Globe size={16} /> Website riêng
          </Link>
          <Link href="/dashboard/create" className="btn-primary">
            <Plus size={16} /> Tạo album chọn ảnh
          </Link>
          {canDelivery && (
            <Link href="/dashboard/create?phase=delivery" className="btn-primary">
              <Plus size={16} /> Tạo album hoàn thiện
            </Link>
          )}
        </div>
      </div>

      {showTrial && (
        <div className="mb-6 card p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: "rgba(184,137,58,.4)", background: "rgba(184,137,58,.07)" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--gold)" }}>Trải nghiệm gói Studio miễn phí 1 ngày</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text2)" }}>Hợp đồng, lịch chụp, quản lý khách hàng và toàn bộ tính năng Studio trong 24 giờ.</p>
          </div>
          <div className="shrink-0">
            <StudioTrialButton used={trialUsed} />
          </div>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <p className="text-accent-muted">{t("noAlbums")}</p>
          <Link href="/dashboard/create" className="btn-ghost mt-4">
            <Plus size={16} /> Tạo album chọn ảnh
          </Link>
        </div>
      ) : (
        <AlbumTabs albums={albums} canDelivery={canDelivery} canWatermark={canWatermark} />
      )}
    </div>
  );
}

// Tách thư viện thành 2 TAB theo giai đoạn: ALBUM CHỌN ẢNH (phase 'selection') và
// ALBUM GIAO KHÁCH (phase 'delivery') — cùng kiểu tab với trang Hợp đồng.
// Dùng --gold/--accentInk chứ không phải --brand: trang này chạy trong CẢ hai
// chrome (StudioShell và header thường), mà --brand chỉ có trong .studio-shell.
function AlbumTabs({ albums, canDelivery, canWatermark }: { albums: AlbumRow[]; canDelivery: boolean; canWatermark: boolean }) {
  const deliveryAlbums = albums.filter((a) => (a.phase ?? "selection") === "delivery");
  const selectionAlbums = albums.filter((a) => (a.phase ?? "selection") !== "delivery");
  const [tab, setTab] = useState<"selection" | "delivery">("selection");

  const grid = (rows: AlbumRow[]) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((a) => (
        <AlbumCard key={a.id} a={a} canDelivery={canDelivery} canWatermark={canWatermark} />
      ))}
    </div>
  );

  // Gói không dùng giao khách và cũng chưa có album giao khách nào → giữ một lưới
  // gọn như trước, thêm tab rỗng chỉ làm rối.
  if (!canDelivery && deliveryAlbums.length === 0) return grid(albums);

  const rows = tab === "delivery" ? deliveryAlbums : selectionAlbums;

  return (
    <div>
      <div role="tablist" aria-label="Nhóm album" className="mb-4 flex flex-wrap gap-2">
        {([
          ["selection", "Album chọn ảnh", selectionAlbums.length, ImageIcon],
          ["delivery", "Album giao khách", deliveryAlbums.length, CheckSquare],
        ] as const).map(([key, label, count, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
            style={
              tab === key
                ? { background: "var(--ac)", color: "#fff" }
                : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }
            }
          >
            <Icon size={13} /> {label} ({count})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ImageIcon}
            title={tab === "delivery" ? "Chưa có album giao khách nào" : "Chưa có album chọn ảnh nào"}
            hint={tab === "delivery"
              ? "Chuyển một album sang giai đoạn Giao khách, hoặc tạo album hoàn thiện."
              : "Tất cả album đang ở nhóm Giao khách — tạo album chọn ảnh mới khi có buổi chụp xong."}
          />
        </Panel>
      ) : (
        grid(rows)
      )}
    </div>
  );
}

function AlbumCard({ a, canDelivery = true, canWatermark = true }: { a: AlbumRow; canDelivery?: boolean; canWatermark?: boolean }) {
  const { t } = useLang();
  const supabase = createClient();
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState(a.status);
  const [watermark, setWatermark] = useState(a.watermark_enabled);
  const [download, setDownload] = useState(a.download_enabled);
  const [phase, setPhase] = useState<"selection" | "delivery">(a.phase ?? "selection");
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

  const cover =
    a.cover_url || (a.coverFallback ? thumbnailUrl(a.coverFallback, 800) : null);

  async function patch(fields: Record<string, unknown>) {
    await supabase.from("albums").update(fields).eq("id", a.id);
  }

  return (
    <div ref={cardRef} className="card group relative overflow-hidden">
      {/* Cover → editor */}
      <Link href={`/dashboard/albums/${a.id}`} className="relative block aspect-[4/3] bg-ink-850">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={a.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-600">
            <ImageIcon size={32} />
          </div>
        )}
        <span
          className="absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide"
          style={status === "published"
            ? { background: "var(--success)", color: "#04150d" }
            : { background: "var(--surface2)", color: "var(--text2)" }}
        >
          {status === "published" ? t("published") : t("draft")}
        </span>
        {canDelivery && (
          <span
            className="absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide"
            style={phase === "delivery"
              ? { background: "var(--success)", color: "#04150d" }
              : { background: "var(--gold)", color: "#1a1205" }}
          >
            {phase === "delivery" ? "Giao khách" : "Chọn ảnh"}
          </span>
        )}
      </Link>

      <div className="p-4">
        <h3 className="truncate font-medium text-accent">{a.title}</h3>
        <div className="mt-2 flex items-center gap-4 text-xs text-accent-muted">
          <span className="flex items-center gap-1">
            <ImageIcon size={13} /> {a.photoCount ?? 0} {t("photos")}
          </span>
          <span className="flex items-center gap-1">
            <CheckSquare size={13} /> {a.selections?.[0]?.count ?? 0} {t("selections")}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Link href={`/dashboard/albums/${a.id}/selections`} className="btn-primary flex-1 min-h-[44px] py-2.5 text-xs">
            <CheckSquare size={13} /> {t("customerSelections")}
          </Link>
          <button onClick={() => setMenu((v) => !v)} className="btn-ghost min-h-[44px] py-2.5 text-xs" title="Bật/tắt nhanh">
            <Settings2 size={13} /> {t("edit")}
          </button>
          <Link href={`/a/${a.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Mở trang album (tab mới)" title="Mở trang album" className="btn-ghost min-h-[44px] py-2.5 text-xs">
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Quick toggles */}
      {menu && (
        <>
        {/* Backdrop: chạm/nhấp ra ngoài để đóng popover (trước đây chỉ đóng bằng nút "Đóng"). */}
        <button
          type="button"
          aria-label="Đóng bảng cài đặt nhanh"
          onClick={() => setMenu(false)}
          className="absolute inset-0 z-10 cursor-default"
        />
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl p-3 shadow-xl" style={{ background: "var(--bg2)", border: "1px solid var(--border2)" }}>
          <Toggle label="Đã xuất bản" on={status === "published"} onChange={(v) => { setStatus(v ? "published" : "draft"); patch({ status: v ? "published" : "draft" }); }} />
          {canDelivery && (
            <Toggle label="Giao khách (ảnh hoàn thiện)" on={phase === "delivery"} onChange={(v) => { const next = v ? "delivery" : "selection"; setPhase(next); patch({ phase: next }); }} />
          )}
          {/* Watermark: chỉ Photographer Plus & Studio — ảnh có watermark buộc phải
              đi qua proxy khi khách tải, ảnh thường tải thẳng từ Drive. */}
          {canWatermark && (
            <Toggle label="Watermark" on={watermark} onChange={(v) => { setWatermark(v); patch({ watermark_enabled: v }); }} />
          )}
          <Toggle label="Cho tải xuống" on={download} onChange={(v) => { setDownload(v); patch({ download_enabled: v }); }} />
          <div className="mt-2 flex gap-2">
            <Link href={`/dashboard/albums/${a.id}`} className="btn-ghost flex-1 py-1.5 text-xs">Chỉnh sửa đầy đủ</Link>
            <button onClick={() => setMenu(false)} className="btn-ghost py-1.5 text-xs">Đóng</button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-center justify-between py-1.5 text-sm text-accent">
      <span>{label}</span>
      <span className="relative h-[22px] w-[40px] flex-shrink-0 rounded-full transition-all" style={on ? { background: "var(--gold)" } : { background: "var(--surface)", border: "1px solid var(--border2)" }}>
        <span className="absolute top-[3px] h-4 w-4 rounded-full transition-all" style={on ? { left: "20px", background: "var(--accentInk)" } : { left: "3px", background: "var(--text2)" }} />
      </span>
    </button>
  );
}
