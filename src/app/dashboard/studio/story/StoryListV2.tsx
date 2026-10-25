"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, CalendarHeart, Check, Copy, ExternalLink, FileText, Filter, Loader2, MessageCircleHeart, Pencil, Plus,
  QrCode, Sparkles,
} from "lucide-react";
import { studioUrl } from "@/lib/hosts";
import { storyEditMessage } from "@/lib/share-messages";
import { daysFromToday, fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { Badge, Callout, Empty, GroupLabel, PageHead, Stack, Stat, StatGrid, Toolbar, btn, iconBtn } from "@/components/v2/kit";
import { Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { CreativeTabsV2, QrModalV2, ToastV2, countdown } from "../thiep/CreativeV2Parts";
import { useStoryList, type StoryListProps, type StoryRow } from "./useStoryList";

/* ═══════════════════════════════════════════════════════════════════════════
   LOVE STORY — giao diện mới. Cùng dữ liệu, cùng thao tác với StoryListView
   (bản cũ, logic chung ở ./useStoryList); khác ở cách sắp xếp:
     • Dải tab Thiệp · Love Story · Slide, đầu trang có MỘT nút chính.
     • 3 số liệu: số trang (đang hiển thị / nháp) · lời chúc · sự kiện sắp tới.
     • Một thanh lọc: tìm theo tên cặp đôi · trạng thái.
     • Trang nhóm theo NGÀY SỰ KIỆN: sắp diễn ra · chưa đặt ngày · đã diễn ra.
     • Thẻ: ảnh đại diện, nhãn trạng thái, đếm ngược, số lời chúc; một nút chữ
       "Mở trình sửa", hai nút icon (chép link gửi cặp đôi, xem trang) và menu
       ⋯ (mã QR, hợp đồng).
   ═══════════════════════════════════════════════════════════════════════════ */

type StatusFilter = "all" | "live" | "draft";
type Live = StoryRow & { _couple: string; _days: number | null };

const WORDS = { none: "Chưa đặt ngày", past: "Đã diễn ra", today: "Diễn ra hôm nay" };

export default function StoryListV2({ rows, ownerId, studioHost }: StoryListProps) {
  const t = useStoryList({ ownerId, studioHost });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const live: Live[] = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        _couple: [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & "),
        _days: r.config.event_date ? daysFromToday(r.config.event_date) : null,
      })),
    [rows],
  );

  const stats = useMemo(() => {
    const upcoming = live.filter((r) => r._days != null && r._days >= 0).sort((a, b) => a._days! - b._days!);
    return {
      total: live.length,
      published: live.filter((r) => r.published).length,
      drafts: live.filter((r) => !r.published).length,
      wishes: live.reduce((n, r) => n + (r.wish_count || 0), 0),
      withWishes: live.filter((r) => r.wish_count > 0).length,
      upcoming: upcoming.length,
      next: upcoming[0] ?? null,
    };
  }, [live]);

  const filtered = useMemo(() => {
    const needle = noAccent(q.trim());
    return live.filter((r) => {
      if (status === "live" && !r.published) return false;
      if (status === "draft" && r.published) return false;
      if (needle && !noAccent(`${r._couple} ${r.slug} ${r.config.event_label ?? ""}`).includes(needle)) return false;
      return true;
    });
  }, [live, q, status]);

  const groups = useMemo(() => {
    const soon = filtered.filter((r) => r._days != null && r._days >= 0).sort((a, b) => a._days! - b._days!);
    const none = filtered.filter((r) => r._days == null);
    const past = filtered.filter((r) => r._days != null && r._days < 0).sort((a, b) => b._days! - a._days!);
    return [
      { key: "soon", label: "Sắp diễn ra", rows: soon, dot: "var(--ac)" },
      { key: "none", label: "Chưa đặt ngày sự kiện", rows: none, dot: "var(--am)" },
      { key: "past", label: "Đã diễn ra", rows: past, dot: "var(--tx3)" },
    ].filter((g) => g.rows.length > 0);
  }, [filtered]);

  const filtering = q.trim() !== "" || status !== "all";
  const createBtn = (
    <button type="button" onClick={t.createNew} disabled={t.creating} className={btn("primary")}>
      {t.creating ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Tạo Love Story
    </button>
  );

  return (
    <Stack>
      <CreativeTabsV2 active="story" />

      <PageHead
        desc="Trang chia sẻ khoảnh khắc của cặp đôi: ảnh, video lấy từ Google Drive của khách, kèm sổ lời chúc cho quan khách."
        actions={createBtn}
      />

      {t.err && (
        <Callout tone="red" icon={AlertCircle} title="Không tạo được trang">
          {t.err}
        </Callout>
      )}

      {rows.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Sparkles}
            title="Chưa có trang Love Story nào"
            hint="Tạo trang rồi gửi link sửa cho cặp đôi: họ dán thư mục ảnh Google Drive, viết câu chuyện, quan khách để lại lời chúc."
            action={createBtn}
          />
        </div>
      ) : (
        <>
          <StatGrid cols={3}>
            <Stat icon={Sparkles} tone="brand" label="Trang Love Story" value={stats.total} sub={`${stats.published} đang hiển thị · ${stats.drafts} nháp`} />
            <Stat
              icon={MessageCircleHeart}
              tone="green"
              label="Lời chúc"
              value={stats.wishes.toLocaleString("vi-VN")}
              valueTone={stats.wishes ? "green" : undefined}
              sub={stats.withWishes ? `Trên ${stats.withWishes} trang` : "Chưa có lời chúc nào"}
            />
            <Stat
              icon={CalendarHeart}
              tone="blue"
              label="Sự kiện sắp tới"
              value={stats.upcoming}
              sub={stats.next ? `Gần nhất ${fmtDate(stats.next.config.event_date)} · ${stats.next._couple || "chưa đặt tên"}` : "Chưa có sự kiện nào sắp tới"}
            />
          </StatGrid>

          <div className="v2-card v2-card-pad flex flex-col gap-3">
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên cô dâu, chú rể…" className="w-full" />
              </div>
              <Segmented<StatusFilter>
                label="Trạng thái trang"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Tất cả", count: stats.total },
                  { value: "live", label: "Đang hiển thị", count: stats.published },
                  { value: "draft", label: "Nháp", count: stats.drafts },
                ]}
              />
            </Toolbar>
            {filtering ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {filtered.length} / {rows.length} trang khớp bộ lọc ·{" "}
                <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setStatus("all"); }}>
                  Xoá lọc
                </button>
              </p>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <div className="v2-card">
              <Empty compact icon={Filter} title="Không có trang nào khớp bộ lọc" hint="Thử tìm bằng tên khác hoặc chọn lại trạng thái." />
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: g.dot }} />
                  <GroupLabel count={`${g.rows.length} trang`}>{g.label}</GroupLabel>
                </div>
                <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
                  {g.rows.map((r) => (
                    <StoryCardV2
                      key={r.id}
                      r={r}
                      studioHost={studioHost}
                      copied={t.copied === `e-${r.id}`}
                      onCopy={(editUrl) => t.copy(storyEditMessage(editUrl), `e-${r.id}`)}
                      onQr={(viewUrl) => void t.openQr(r._couple || "(chưa đặt tên)", viewUrl)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <QrModalV2 qr={t.qr} hint="Quét mã để xem Love Story. In ra đặt ở bàn ký tên để quan khách gửi lời chúc." onClose={() => t.setQr(null)} onPrint={t.printQr} />
      {t.copied ? <ToastV2>Đã chép link sửa kèm lời nhắn, dán gửi cặp đôi qua Zalo hoặc Messenger</ToastV2> : null}
    </Stack>
  );
}

/* ── Thẻ trang Love Story ───────────────────────────────────────────────── */
function StoryCardV2({
  r,
  studioHost,
  copied,
  onCopy,
  onQr,
}: {
  r: Live;
  studioHost: string | null;
  copied: boolean;
  onCopy: (editUrl: string) => void;
  onQr: (viewUrl: string) => void;
}) {
  const editUrl = studioUrl(studioHost, `/story/sua/${r.edit_token}`);
  const viewUrl = studioUrl(studioHost, `/story/${r.slug}`);
  const cd = countdown(r._days, WORDS);
  const cover = r.config.cover_url;
  // Màu nhấn do cặp đôi chọn (dữ liệu của trang) — chỉ dùng tô nền ảnh trống.
  const accent = /^#[0-9a-f]{3,8}$/i.test(r.config.accent ?? "") ? r.config.accent! : "var(--ac)";
  const sub = [r.config.event_label, r.config.event_date ? fmtDate(r.config.event_date) : null].filter(Boolean).join(" · ") || r.config.tagline || "Chưa có thông tin sự kiện";

  return (
    <article className="v2-card v2-card-link group flex flex-col overflow-hidden">
      <div className="flex min-[560px]:flex-col">
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Mở trình sửa Love Story ${r._couple}`}
          className="relative m-3 mr-0 block aspect-square w-[92px] flex-none overflow-hidden rounded-[12px] min-[560px]:m-0 min-[560px]:aspect-[4/3] min-[560px]:w-full min-[560px]:rounded-none"
          style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${accent} 26%, var(--sf)), var(--sf2))` }}
        >
          {cover ? (
            <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          ) : (
            <span className="flex h-full items-center justify-center" style={{ color: `color-mix(in srgb, ${accent} 70%, var(--tx))` }}>
              <Sparkles size={28} />
            </span>
          )}
          <span className="absolute left-3 top-3 hidden min-[560px]:block">
            <span
              className="v2-badge"
              style={{ background: "rgba(255,255,255,.94)", color: r.published ? "var(--gn)" : "var(--tx2)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            >
              <span className="v2-badge-dot" style={{ background: r.published ? "var(--gn)" : "var(--tx3)" }} />
              {r.published ? "Đang hiển thị" : "Nháp"}
            </span>
          </span>
        </a>

        <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 pb-1 pt-3">
          <div className="min-w-0">
            <a href={editUrl} target="_blank" rel="noreferrer" className="block truncate text-[15px] font-semibold" title={r._couple}>
              {r._couple || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên cặp đôi</span>}
            </a>
            <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }} title={sub}>{sub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-[560px]:hidden">
              <Badge tone={r.published ? "green" : "gray"} dot>{r.published ? "Đang hiển thị" : "Nháp"}</Badge>
            </span>
            <Badge tone={cd.tone}>{cd.label}</Badge>
            <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
              <MessageCircleHeart size={13} style={{ color: "var(--tx3)" }} />
              <b className="v2-num" style={{ color: r.wish_count ? "var(--tx)" : "var(--tx3)" }}>{r.wish_count}</b> lời chúc
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 px-4 pb-4 pt-3">
        <a href={editUrl} target="_blank" rel="noreferrer" className={btn("secondary", "sm", "flex-1")}>
          <Pencil size={15} /> Mở trình sửa
        </a>
        <button
          type="button"
          onClick={() => onCopy(editUrl)}
          className={iconBtn()}
          aria-label="Chép link sửa kèm lời nhắn gửi cặp đôi"
          title="Chép link sửa kèm lời nhắn gửi cặp đôi"
          style={copied ? { color: "var(--gn)" } : undefined}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <a href={viewUrl} target="_blank" rel="noreferrer" className={iconBtn()} aria-label="Xem trang như khách" title="Xem trang như khách">
          <ExternalLink size={16} />
        </a>
        <Menu
          label={`Thêm thao tác với trang ${r._couple}`}
          width={250}
          items={[
            { label: "Mã QR · in để bàn ký tên", icon: QrCode, onClick: () => onQr(viewUrl) },
            ...(r.contract_id
              ? (["divider", { label: "Mở hợp đồng", icon: FileText, href: `/dashboard/studio/contracts/${r.contract_id}` }] as const)
              : []),
          ]}
        />
      </div>
    </article>
  );
}
