"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, CalendarHeart, Check, Copy, Download, ExternalLink, FileSpreadsheet, FileText, Filter, Heart, Loader2,
  Pencil, Plus, QrCode, Users,
} from "lucide-react";
import { thiepUrl } from "@/lib/hosts";
import { weddingEditMessage } from "@/lib/share-messages";
import { daysFromToday, fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { getTemplateMeta } from "../../../thiep/[slug]/templates";
import {
  Badge, Callout, Empty, GroupLabel, PageHead, Stack, Stat, StatGrid, Toolbar, btn, iconBtn,
} from "@/components/v2/kit";
import { Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { CreativeTabsV2, QrModalV2, ToastV2, countdown } from "./CreativeV2Parts";
import { coupleName, useThiepList, type InvitationRow, type ThiepListProps } from "./useThiepList";

/* ═══════════════════════════════════════════════════════════════════════════
   THIỆP CƯỚI — giao diện mới. Cùng dữ liệu, cùng thao tác với ThiepListView
   (bản cũ, logic chung ở ./useThiepList); khác ở cách sắp xếp:
     • Dải tab Thiệp · Love Story · Slide, rồi đầu trang có MỘT nút chính.
     • 3 số liệu: số thiệp (đang hiển thị / nháp) · khách đã xác nhận · tiệc
       sắp tới (kèm cặp gần nhất).
     • Một thanh lọc: tìm theo tên cặp đôi · trạng thái.
     • Thiệp nhóm theo NGÀY CƯỚI: sắp cưới (gần nhất trước) · chưa đặt ngày ·
       đã cưới — thứ studio cần nhìn để nhắc khách chốt danh sách.
     • Thẻ: bìa thiệp (hoặc bảng màu của mẫu), nhãn trạng thái, đếm ngược,
       số khách xác nhận; một nút chữ "Mở trình sửa", hai nút icon (chép link
       gửi cặp đôi, xem thiệp) và menu ⋯ (mã QR, xuất Excel/CSV, hợp đồng).
   ═══════════════════════════════════════════════════════════════════════════ */

type StatusFilter = "all" | "live" | "draft";
type Live = InvitationRow & { _couple: string; _days: number | null };

export default function ThiepListV2({ rows, ownerId, studio }: ThiepListProps) {
  const t = useThiepList({ ownerId, studio });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const live: Live[] = useMemo(
    () => rows.map((r) => ({ ...r, _couple: coupleName(r.config), _days: r.config.wedding_date ? daysFromToday(r.config.wedding_date) : null })),
    [rows],
  );

  const stats = useMemo(() => {
    const upcoming = live.filter((r) => r._days != null && r._days >= 0).sort((a, b) => a._days! - b._days!);
    return {
      total: live.length,
      published: live.filter((r) => r.published).length,
      drafts: live.filter((r) => !r.published).length,
      rsvp: live.reduce((n, r) => n + (r.rsvp_count || 0), 0),
      withRsvp: live.filter((r) => r.rsvp_count > 0).length,
      upcoming: upcoming.length,
      next: upcoming[0] ?? null,
    };
  }, [live]);

  const filtered = useMemo(() => {
    const needle = noAccent(q.trim());
    return live.filter((r) => {
      if (status === "live" && !r.published) return false;
      if (status === "draft" && r.published) return false;
      if (needle && !noAccent(`${r._couple} ${r.slug}`).includes(needle)) return false;
      return true;
    });
  }, [live, q, status]);

  // Nhóm theo ngày cưới: sắp cưới (gần nhất trước) → chưa đặt ngày → đã cưới.
  const groups = useMemo(() => {
    const soon = filtered.filter((r) => r._days != null && r._days >= 0).sort((a, b) => a._days! - b._days!);
    const none = filtered.filter((r) => r._days == null);
    const past = filtered.filter((r) => r._days != null && r._days < 0).sort((a, b) => b._days! - a._days!);
    return [
      { key: "soon", label: "Sắp cưới", rows: soon, dot: "var(--ac)" },
      { key: "none", label: "Chưa đặt ngày cưới", rows: none, dot: "var(--am)" },
      { key: "past", label: "Đã cưới", rows: past, dot: "var(--tx3)" },
    ].filter((g) => g.rows.length > 0);
  }, [filtered]);

  const filtering = q.trim() !== "" || status !== "all";
  const createBtn = (
    <button type="button" onClick={t.createNew} disabled={t.creating} className={btn("primary")}>
      {t.creating ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Tạo thiệp cưới
    </button>
  );
  const exportingRow = t.exporting ? rows.find((r) => r.id === t.exporting) : null;

  return (
    <Stack>
      <CreativeTabsV2 active="thiep" />

      <PageHead
        desc="Thiệp cưới online tặng khách: gửi link để cặp đôi tự điền nội dung, khách mời xác nhận dự tiệc ngay trên thiệp."
        actions={createBtn}
      />

      {t.err && (
        <Callout tone="red" icon={AlertCircle} title="Không tạo được thiệp">
          {t.err}
        </Callout>
      )}

      {rows.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Heart}
            title="Chưa có thiệp cưới nào"
            hint="Tạo thiệp rồi gửi link sửa cho cặp đôi tự điền tên, ngày cưới, ảnh. Cũng tạo được ngay trong hợp đồng: mở hợp đồng, bấm “Tạo thiệp cưới tặng khách”."
            action={createBtn}
          />
        </div>
      ) : (
        <>
          <StatGrid cols={3}>
            <Stat icon={Heart} tone="brand" label="Thiệp cưới" value={stats.total} sub={`${stats.published} đang hiển thị · ${stats.drafts} nháp`} />
            <Stat
              icon={Users}
              tone="green"
              label="Khách đã xác nhận"
              value={stats.rsvp.toLocaleString("vi-VN")}
              valueTone={stats.rsvp ? "green" : undefined}
              sub={stats.withRsvp ? `Trên ${stats.withRsvp} thiệp` : "Chưa có khách nào xác nhận"}
            />
            <Stat
              icon={CalendarHeart}
              tone="blue"
              label="Tiệc sắp tới"
              value={stats.upcoming}
              sub={stats.next ? `Gần nhất ${fmtDate(stats.next.config.wedding_date)} · ${stats.next._couple || "chưa đặt tên"}` : "Chưa có tiệc nào sắp tới"}
            />
          </StatGrid>

          <div className="v2-card v2-card-pad flex flex-col gap-3">
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên cô dâu, chú rể…" className="w-full" />
              </div>
              <Segmented<StatusFilter>
                label="Trạng thái thiệp"
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
                {filtered.length} / {rows.length} thiệp khớp bộ lọc ·{" "}
                <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setStatus("all"); }}>
                  Xoá lọc
                </button>
              </p>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <div className="v2-card">
              <Empty compact icon={Filter} title="Không có thiệp nào khớp bộ lọc" hint="Thử tìm bằng tên khác hoặc chọn lại trạng thái." />
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: g.dot }} />
                  <GroupLabel count={`${g.rows.length} thiệp`}>{g.label}</GroupLabel>
                </div>
                <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
                  {g.rows.map((r) => (
                    <ThiepCardV2
                      key={r.id}
                      r={r}
                      copied={t.copied === `edit-${r.id}`}
                      exporting={t.exporting === r.id}
                      onCopy={(editUrl) => t.copy(weddingEditMessage(editUrl), `edit-${r.id}`)}
                      onQr={(viewUrl) => void t.openQr(r._couple || "(chưa đặt tên)", viewUrl)}
                      onExport={(kind) => void t.exportGuests(r, kind)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <QrModalV2 qr={t.qr} hint="Quét mã để mở thiệp cưới. In ra đặt ở bàn đón khách." onClose={() => t.setQr(null)} onPrint={t.printQr} />

      {t.copied ? <ToastV2>Đã chép link sửa kèm lời nhắn, dán gửi cặp đôi qua Zalo hoặc Messenger</ToastV2> : null}
      {exportingRow ? <ToastV2>Đang xuất danh sách khách mời…</ToastV2> : null}
    </Stack>
  );
}

/* ── Thẻ thiệp ──────────────────────────────────────────────────────────── */
function ThiepCardV2({
  r,
  copied,
  exporting,
  onCopy,
  onQr,
  onExport,
}: {
  r: Live;
  copied: boolean;
  exporting: boolean;
  onCopy: (editUrl: string) => void;
  onQr: (viewUrl: string) => void;
  onExport: (kind: "xlsx" | "csv") => void;
}) {
  const meta = getTemplateMeta(r.template);
  const editUrl = thiepUrl(`/sua/${r.edit_token}`);
  const viewUrl = thiepUrl(`/${r.slug}`);
  const cd = countdown(r._days);
  const cover = r.config.cover_url;
  const initials = [r.config.groom_name, r.config.bride_name]
    .filter(Boolean)
    .map((n) => (n as string).trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "")
    .join(" & ");

  return (
    <article className="v2-card v2-card-link group flex flex-col overflow-hidden">
      <div className="flex min-[560px]:flex-col">
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Mở trình sửa thiệp ${r._couple || ""}`}
          className="relative m-3 mr-0 block aspect-square w-[92px] flex-none overflow-hidden rounded-[12px] min-[560px]:m-0 min-[560px]:aspect-[4/3] min-[560px]:w-full min-[560px]:rounded-none"
          style={{ background: meta.bg }}
        >
          {cover ? (
            <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center" style={{ color: meta.ink }}>
              <span
                className="text-[22px] leading-none min-[560px]:text-[34px]"
                style={{ fontFamily: meta.serif ? "var(--font-cormorant), serif" : undefined, fontWeight: meta.serif ? 500 : 650 }}
              >
                {initials || <Heart size={26} style={{ color: meta.accent }} />}
              </span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] min-[560px]:block" style={{ color: meta.accent }}>
                Save the date
              </span>
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
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <a href={editUrl} target="_blank" rel="noreferrer" className="block truncate text-[15px] font-semibold" title={r._couple}>
                {r._couple || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên cặp đôi</span>}
              </a>
              <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Mẫu {meta.label}
                {r.config.wedding_date ? <> · Cưới {fmtDate(r.config.wedding_date)}</> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-[560px]:hidden">
              <Badge tone={r.published ? "green" : "gray"} dot>{r.published ? "Đang hiển thị" : "Nháp"}</Badge>
            </span>
            <Badge tone={cd.tone}>{cd.label}</Badge>
            <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
              <Users size={13} style={{ color: "var(--tx3)" }} />
              <b className="v2-num" style={{ color: r.rsvp_count ? "var(--tx)" : "var(--tx3)" }}>{r.rsvp_count}</b> xác nhận
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
        <a href={viewUrl} target="_blank" rel="noreferrer" className={iconBtn()} aria-label="Xem thiệp như khách" title="Xem thiệp như khách">
          <ExternalLink size={16} />
        </a>
        <Menu
          label={`Thêm thao tác với thiệp ${r._couple}`}
          width={250}
          items={[
            { label: "Mã QR · in để bàn đón khách", icon: QrCode, onClick: () => onQr(viewUrl) },
            "divider",
            {
              label: exporting ? "Đang xuất…" : "Xuất danh sách khách (Excel)",
              hint: "Có dòng tổng số khách, số suất",
              icon: FileSpreadsheet,
              onClick: () => onExport("xlsx"),
              disabled: exporting,
            },
            { label: "Xuất bản CSV", hint: "Cho công cụ khác", icon: Download, onClick: () => onExport("csv"), disabled: exporting },
            ...(r.contract_id
              ? (["divider", { label: "Mở hợp đồng", icon: FileText, href: `/dashboard/studio/contracts/${r.contract_id}` }] as const)
              : []),
          ]}
        />
      </div>
    </article>
  );
}
