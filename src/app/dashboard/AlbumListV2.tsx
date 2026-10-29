"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Plus, Image as ImageIcon, ExternalLink, Globe, Tag, Filter, HeartOff, CheckCircle2,
  Images, Clock, MousePointerClick, Settings2, Pencil, ListChecks, ChevronDown, Camera, Send,
} from "lucide-react";
import { studioUrl } from "@/lib/hosts";
import { thumbnailUrl } from "@/lib/drive";
import { createClient } from "@/lib/supabase/client";
import PlanUsage from "@/components/PlanUsage";
import type { PlanUsageData } from "@/lib/plan-usage";
import StudioTrialButton from "@/components/StudioTrialButton";
import FaceSetupNotice from "@/components/FaceSetupNotice";
import { pendingSelectionCount, sortAlbums } from "@/lib/album-order";
import { isDeliveryPhase } from "@/lib/album-phase";
import { storageUntil } from "@/lib/storage-lifecycle";
import { noAccent } from "@/lib/studio-nav";
import {
  Badge, Callout, Empty, GroupLabel, PageHead, Progress, Stat, StatGrid, Stack, Toolbar, btn, iconBtn, inputCls,
} from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, Switch } from "@/components/v2/kit-client";
import type { AlbumRow } from "./AlbumList";
import { fmtDate } from "@/lib/date";

const FilterDialog = dynamic(() => import("@/components/FilterDialog"), { ssr: false });

/* ═══════════════════════════════════════════════════════════════════════════
   THƯ VIỆN ALBUM — giao diện mới. Cùng dữ liệu, cùng thao tác với AlbumList
   (bản cũ); khác ở cách sắp xếp:
     • 4 số liệu đầu trang: tổng album · khách đã chốt · đang chờ khách · ảnh đã chọn.
     • Một thanh lọc: tìm theo tên · nhóm (tất cả / chọn ảnh / giao khách) ·
       trạng thái · tháng tạo.
     • Album khách đã chốt nổi lên nhóm "Cần lọc ảnh"; còn lại nhóm theo tháng.
     • Thẻ: bìa lớn có nhãn trạng thái + số ảnh, MỘT nút chính theo việc tiếp
       theo, còn lại vào menu ⋯. Bật/tắt nhanh mở ngăn kéo bên phải.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  albums: AlbumRow[];
  showTrial?: boolean;
  trialUsed?: boolean;
  canDelivery?: boolean;
  canWatermark?: boolean;
  canFaceSearch?: boolean;
  studioHost?: string | null;
  planUsage?: PlanUsageData | null;
};

type Phase = "selection" | "delivery";
type Live = AlbumRow & { _phase: Phase; _done: boolean };
type StatusFilter = "all" | "done" | "waiting" | "empty" | "draft";

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ["all", "Mọi trạng thái"],
  ["done", "Khách đã chốt"],
  ["waiting", "Đang chờ khách"],
  ["empty", "Chưa có ảnh"],
  ["draft", "Nháp"],
];

/** "2026-11" theo giờ VN — cắt chuỗi UTC thì album tạo 0h–7h sáng ngày 1 rơi sang tháng trước. */
function monthKey(iso?: string | null) {
  const d = fmtDate(iso); // dd/mm/yyyy theo giờ VN
  return d ? `${d.slice(6)}-${d.slice(3, 5)}` : "";
}
function monthLabel(key: string) {
  if (!key) return "Không rõ ngày";
  const [y, m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}
function fmtDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function AlbumListV2({
  albums,
  showTrial = false,
  trialUsed = false,
  canDelivery = true,
  canWatermark = true,
  canFaceSearch = true,
  studioHost = null,
  planUsage = null,
}: Props) {
  // Thay đổi ngay tại thư viện (đổi giai đoạn, bỏ đánh dấu đã chốt) ghi đè lên
  // dữ liệu server để thẻ chuyển nhóm NGAY, không phải tải lại trang.
  const [patches, setPatches] = useState<Record<string, Partial<AlbumRow>>>({});
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"all" | Phase>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [month, setMonth] = useState("");
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [filterFor, setFilterFor] = useState<AlbumRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const live: Live[] = useMemo(
    () =>
      albums.map((a) => {
        const p = { ...a, ...patches[a.id] };
        return { ...p, _phase: isDeliveryPhase(p) ? "delivery" : "selection", _done: !!p.selection_done_at && (p.photoCount ?? 0) > 0 };
      }),
    [albums, patches],
  );

  const stats = useMemo(() => {
    const picks = live.reduce((n, a) => n + (a.selections?.[0]?.count ?? 0), 0);
    const waiting = live.filter((a) => a._phase === "selection" && a.status === "published" && !a._done && (a.photoCount ?? 0) > 0).length;
    return {
      total: live.length,
      published: live.filter((a) => a.status === "published").length,
      done: pendingSelectionCount(live),
      waiting,
      picks,
      selection: live.filter((a) => a._phase === "selection").length,
      delivery: live.filter((a) => a._phase === "delivery").length,
    };
  }, [live]);

  const months = useMemo(() => {
    const set = new Set(live.map((a) => monthKey(a.created_at)).filter(Boolean));
    return [...set].sort().reverse();
  }, [live]);

  const filtered = useMemo(() => {
    const needle = noAccent(q.trim());
    return live.filter((a) => {
      if (group !== "all" && a._phase !== group) return false;
      if (month && monthKey(a.created_at) !== month) return false;
      if (status === "done" && !a._done) return false;
      if (status === "waiting" && !(a._phase === "selection" && a.status === "published" && !a._done && (a.photoCount ?? 0) > 0)) return false;
      if (status === "empty" && (a.photoCount ?? 0) > 0) return false;
      if (status === "draft" && a.status !== "draft") return false;
      if (needle && !noAccent(`${a.title} ${a.slug}`).includes(needle)) return false;
      return true;
    });
  }, [live, q, group, month, status]);

  // Nhóm hiển thị: album chờ lọc lên đầu (đúng thứ tự ưu tiên của sortAlbums),
  // phần còn lại theo tháng tạo, mới nhất trước.
  const groups = useMemo(() => {
    const done = sortAlbums(filtered.filter((a) => a._done));
    const rest = filtered
      .filter((a) => !a._done)
      .sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
    const byMonth = new Map<string, Live[]>();
    for (const a of rest) {
      const k = monthKey(a.created_at);
      byMonth.set(k, [...(byMonth.get(k) ?? []), a]);
    }
    const out: { key: string; label: string; rows: Live[]; tone?: "green" }[] = [];
    if (done.length) out.push({ key: "done", label: "Cần lọc ảnh", rows: done, tone: "green" });
    for (const [k, rows] of byMonth) out.push({ key: k, label: monthLabel(k), rows });
    return out;
  }, [filtered]);

  const filtering = q || group !== "all" || status !== "all" || month;
  const settingsAlbum = settingsFor ? live.find((a) => a.id === settingsFor) ?? null : null;

  function patchLocal(id: string, p: Partial<AlbumRow>) {
    setPatches((cur) => ({ ...cur, [id]: { ...cur[id], ...p } }));
  }

  const createMenu = (
    <Menu
      width={250}
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} aria-expanded={open} className={btn("primary")}>
          <Plus size={17} /> Tạo album <ChevronDown size={15} className="-mr-1 opacity-80" />
        </button>
      )}
      items={[
        { label: "Album chọn ảnh", hint: "Khách chọn ảnh từ Google Drive", icon: MousePointerClick, href: "/dashboard/create" },
        ...(canDelivery
          ? [{ label: "Album hoàn thiện", hint: "Gửi ảnh đã chỉnh cho khách", icon: Send, href: "/dashboard/create?phase=delivery" }]
          : []),
      ]}
    />
  );

  return (
    <Stack>
      <FaceSetupNotice />

      <PageHead
        desc="Album chọn ảnh và album giao khách, đồng bộ thẳng từ Google Drive của studio."
        actions={
          <>
            <Menu
              items={[
                { label: "Loại album", icon: Tag, href: "/dashboard/studio/album-categories" },
                { label: "Website riêng", icon: Globe, href: "/dashboard/site" },
              ]}
            />
            {createMenu}
          </>
        }
      />

      {showTrial && (
        <Callout
          tone="brand"
          title="Trải nghiệm gói Studio miễn phí 1 ngày"
          action={<StudioTrialButton used={trialUsed} />}
        >
          Hợp đồng, lịch chụp, quản lý khách hàng và toàn bộ tính năng Studio trong 24 giờ.
        </Callout>
      )}

      <StatGrid>
        <Stat icon={Images} tone="brand" label="Tổng số album" value={stats.total} sub={`${stats.published} đang xuất bản`} />
        <Stat icon={CheckCircle2} tone="green" label="Khách đã chốt" value={stats.done} valueTone={stats.done ? "green" : undefined} sub="Sẵn sàng lọc ảnh" />
        <Stat icon={Clock} tone="amber" label="Đang chờ khách" value={stats.waiting} valueTone={stats.waiting ? "amber" : undefined} sub="Khách đang duyệt ảnh" />
        <Stat icon={ListChecks} tone="blue" label="Ảnh đã chọn" value={stats.picks.toLocaleString("vi-VN")} sub="Tổng lượt khách chọn" />
      </StatGrid>

      {albums.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={ImageIcon}
            title="Chưa có album nào"
            hint="Tạo album đầu tiên để khách chọn ảnh ngay trên điện thoại. Ảnh lấy thẳng từ thư mục Google Drive của studio."
            action={
              <Link href="/dashboard/create" className={btn("primary")}>
                <Plus size={17} /> Tạo album chọn ảnh
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="v2-card v2-card-pad flex flex-col gap-3">
            <Toolbar>
              <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên album, khách…" className="min-w-[220px] flex-1" />
              {(canDelivery || stats.delivery > 0) && (
                <Segmented
                  label="Nhóm album"
                  value={group}
                  onChange={setGroup}
                  options={[
                    { value: "all", label: "Tất cả", count: stats.total },
                    { value: "selection", label: "Chọn ảnh", count: stats.selection },
                    { value: "delivery", label: "Giao khách", count: stats.delivery },
                  ]}
                />
              )}
              <select aria-label="Trạng thái" className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                {STATUS_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {months.length > 1 && (
                <select aria-label="Tháng tạo" className={`${inputCls} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="">Mọi tháng</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              )}
            </Toolbar>
            {filtering ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {filtered.length} / {albums.length} album khớp bộ lọc ·{" "}
                <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setGroup("all"); setStatus("all"); setMonth(""); }}>
                  Xoá lọc
                </button>
              </p>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <div className="v2-card">
              <Empty compact icon={Filter} title="Không có album nào khớp bộ lọc" hint="Thử bỏ bớt điều kiện lọc hoặc tìm bằng từ khác." />
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {g.tone === "green" ? <span className="h-2 w-2 rounded-full" style={{ background: "var(--gn)" }} /> : <span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} />}
                  <GroupLabel count={`${g.rows.length} album`}>{g.label}</GroupLabel>
                </div>
                <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
                  {g.rows.map((a, i) => (
                    <AlbumCardV2
                      key={a.id}
                      a={a}
                      eager={i < 4 && g === groups[0]}
                      canDelivery={canDelivery}
                      studioHost={studioHost}
                      onSettings={() => setSettingsFor(a.id)}
                      onFilter={() => setFilterFor(a)}
                      onClearDone={() => {
                        patchLocal(a.id, { selection_done_at: null });
                        void createClient().from("albums").update({ selection_done_at: null }).eq("id", a.id);
                        setToast(`Đã bỏ đánh dấu “${a.title}”`);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <PlanUsage initial={planUsage} />

      <AlbumSettingsDrawer
        album={settingsAlbum}
        onClose={() => setSettingsFor(null)}
        canDelivery={canDelivery}
        canWatermark={canWatermark}
        canFaceSearch={canFaceSearch}
        onPatch={patchLocal}
        onPhaseChanged={(a, p) => setToast(`Đã chuyển “${a.title}” sang ${p === "delivery" ? "Giao khách" : "Chọn ảnh"}`)}
        onOpenFilter={(a) => {
          setSettingsFor(null);
          setFilterFor(a);
        }}
      />

      {filterFor && <FilterDialog albumId={filterFor.id} albumTitle={filterFor.title} onClose={() => setFilterFor(null)} />}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
        >
          {toast}
        </div>
      )}
    </Stack>
  );
}

/* ── Thẻ album ──────────────────────────────────────────────────────────── */
function AlbumCardV2({
  a,
  eager,
  canDelivery,
  studioHost,
  onSettings,
  onFilter,
  onClearDone,
}: {
  a: Live;
  eager: boolean;
  canDelivery: boolean;
  studioHost: string | null;
  onSettings: () => void;
  onFilter: () => void;
  onClearDone: () => void;
}) {
  const cover = a.cover_url || (a.coverFallback ? thumbnailUrl(a.coverFallback, 480) : null);
  const picked = a.selections?.[0]?.count ?? 0;
  const photos = a.photoCount ?? 0;
  const dislikes = a.dislikes?.[0]?.count ?? 0;
  const pct = photos > 0 ? Math.min(100, (picked / photos) * 100) : 0;
  const publicUrl = studioUrl(studioHost, `/a/${a.slug}`);

  // Nhãn trạng thái trên bìa: nói đúng VIỆC đang ở đâu.
  const state: { label: string; tone: "green" | "amber" | "gray" | "blue"; icon: typeof Clock } =
    a._phase === "delivery"
      ? { label: "Giao khách", tone: "blue", icon: Send }
      : a._done
        ? { label: "Khách đã chốt", tone: "green", icon: CheckCircle2 }
        : a.status !== "published"
          ? { label: "Nháp", tone: "gray", icon: Pencil }
          : photos === 0
            ? { label: "Chưa có ảnh", tone: "gray", icon: ImageIcon }
            : { label: "Đang chờ khách", tone: "amber", icon: Clock };

  return (
    <article className="v2-card v2-card-link group flex flex-col overflow-hidden">
      <Link href={`/dashboard/albums/${a.id}`} className="relative block aspect-[4/3] overflow-hidden" style={{ background: "var(--sf2)" }}>
        {cover ? (
          <img
            src={cover}
            alt={a.title}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full items-center justify-center" style={{ color: "var(--tx3)" }}>
            <Camera size={30} />
          </span>
        )}
        <span className="absolute left-3 top-3">
          <span className="v2-badge" style={{ background: "rgba(255,255,255,.94)", color: `var(--${{ green: "gn", amber: "am", gray: "tx2", blue: "bl" }[state.tone]})`, boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
            <state.icon size={12} strokeWidth={2.4} /> {state.label}
          </span>
        </span>
        <span
          className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-2.5 pt-8 text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,.62), transparent)" }}
        >
          <span>{photos} ảnh</span>
          {a._phase === "selection" && photos > 0 ? (
            <span>
              Đã chọn <span style={{ color: picked ? "#8ff0bd" : "#fff" }}>{picked}</span>
            </span>
          ) : null}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/dashboard/albums/${a.id}`} className="block truncate text-[15px] font-semibold" title={a.title}>
              {a.title}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {fmtDay(a.created_at)}
              {canDelivery ? <>· {a._phase === "delivery" ? "Album giao khách" : "Album chọn ảnh"}</> : null}
            </p>
          </div>
          <Menu
            items={[
              { label: "Chỉnh sửa album", icon: Pencil, href: `/dashboard/albums/${a.id}` },
              { label: "Lựa chọn của khách", icon: ListChecks, href: `/dashboard/albums/${a.id}/selections` },
              { label: "Mở trang khách", icon: ExternalLink, href: publicUrl, external: true },
              "divider",
              { label: "Lọc ảnh · gom khuôn mặt", icon: Filter, onClick: onFilter },
              { label: "Cài đặt nhanh", icon: Settings2, onClick: onSettings },
              ...(a._done ? (["divider", { label: "Đã lọc xong, bỏ đánh dấu", icon: CheckCircle2, onClick: onClearDone }] as const) : []),
            ]}
          />
        </div>

        {a._phase === "selection" && photos > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress value={pct} tone={a._done ? "green" : "brand"} />
            </div>
            <span className="v2-num text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>
              {picked}/{photos}
            </span>
          </div>
        ) : null}

        {dislikes > 0 ? (
          <Badge tone="red" icon={HeartOff}>{dislikes} ảnh khách không thích</Badge>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-1">
          {a._done ? (
            <button type="button" onClick={onFilter} className={btn("primary", "sm", "flex-1")}>
              <Filter size={15} /> Lọc ảnh
            </button>
          ) : (
            <Link href={`/dashboard/albums/${a.id}/selections`} className={btn("secondary", "sm", "flex-1")}>
              <ListChecks size={15} /> Xem lựa chọn
            </Link>
          )}
          <button type="button" onClick={onSettings} className={iconBtn()} aria-label="Cài đặt nhanh" title="Cài đặt nhanh">
            <Settings2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Ngăn kéo cài đặt nhanh ─────────────────────────────────────────────── */
function AlbumSettingsDrawer({
  album,
  onClose,
  canDelivery,
  canWatermark,
  canFaceSearch,
  onPatch,
  onPhaseChanged,
  onOpenFilter,
}: {
  album: Live | null;
  onClose: () => void;
  canDelivery: boolean;
  canWatermark: boolean;
  canFaceSearch: boolean;
  onPatch: (id: string, p: Partial<AlbumRow>) => void;
  onPhaseChanged: (a: AlbumRow, p: Phase) => void;
  onOpenFilter: (a: AlbumRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const id = album?.id;

  useEffect(() => {
    setErr(null);
    setFaceCount(null);
    if (!id || !canFaceSearch) return;
    let alive = true;
    void createClient()
      .from("album_people")
      .select("id", { count: "exact", head: true })
      .eq("album_id", id)
      .then(({ count, error }) => {
        if (!alive) return;
        // Thiếu BẢNG khác hẳn "chưa gom" — xem ghi chú cùng chỗ ở AlbumList.
        if (error) setFaceCount(/does not exist|schema cache|relation/i.test(error.message) ? -1 : 0);
        else setFaceCount(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, [id, canFaceSearch]);

  if (!album) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const a = album;
  const supabase = createClient();

  async function patch(fields: Record<string, unknown>) {
    const { error } = await supabase.from("albums").update(fields).eq("id", a.id);
    if (error) setErr(error.message);
  }

  /** Cùng luật với AlbumList.switchPhase / AlbumEditor.switchPhase. */
  async function switchPhase(next: Phase) {
    if (next === a._phase || busy) return;
    if (next === "delivery" && !canDelivery) return;
    setBusy(true);
    setErr(null);
    const fields: Record<string, unknown> = { phase: next };
    const clearDone = next === "delivery" && !!a.selection_done_at;
    if (clearDone) fields.selection_done_at = null;
    if (next === "delivery") {
      const { data: cur } = await supabase.from("albums").select("delivered_at").eq("id", a.id).maybeSingle();
      if (cur && !(cur as { delivered_at?: string | null }).delivered_at) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: prof } = user
          ? await supabase.from("profiles").select("storage_months").eq("id", user.id).maybeSingle()
          : { data: null };
        const now = new Date();
        fields.delivered_at = now.toISOString();
        fields.storage_until = storageUntil(now, (prof as { storage_months?: number } | null)?.storage_months ?? 6);
      }
    }
    const { error } = await supabase.from("albums").update(fields).eq("id", a.id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onPatch(a.id, { phase: next, ...(clearDone ? { selection_done_at: null } : {}) });
    onPhaseChanged(a, next);
  }

  const faceText = !canFaceSearch
    ? "Gói Photographer Plus / Studio mới có"
    : faceCount === null
      ? "Đang xem…"
      : faceCount === -1
        ? "Chưa bật, cần chạy supabase/cap-nhat.sql"
        : faceCount === 0
          ? "Chưa gom, khách chưa tìm được theo mặt"
          : `Đã gom ${faceCount} người`;

  return (
    <Drawer
      open
      onClose={onClose}
      title={a.title}
      desc="Cài đặt nhanh, lưu ngay khi bấm"
      width={420}
      footer={
        <Link href={`/dashboard/albums/${a.id}`} className={btn("secondary", "md", "w-full sm:w-auto")}>
          <Pencil size={15} /> Chỉnh sửa đầy đủ
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="v2-label">Giai đoạn album</p>
          <Segmented
            label="Giai đoạn album"
            value={a._phase}
            onChange={(v) => switchPhase(v)}
            options={[
              { value: "selection", label: busy && a._phase !== "selection" ? "Đang chuyển…" : "Chọn ảnh" },
              { value: "delivery", label: busy && a._phase !== "delivery" ? "Đang chuyển…" : canDelivery || a._phase === "delivery" ? "Giao khách" : "Giao khách (gói cao hơn)" },
            ]}
          />
        </div>

        <div className="flex flex-col">
          <Switch
            label="Đã xuất bản"
            desc="Khách mở được link album"
            checked={a.status === "published"}
            onChange={(v) => {
              onPatch(a.id, { status: v ? "published" : "draft" });
              void patch({ status: v ? "published" : "draft" });
            }}
          />
          {canWatermark && (
            <Switch
              label="Watermark"
              desc="Đóng dấu logo studio lên ảnh xem trước"
              checked={a.watermark_enabled}
              onChange={(v) => {
                onPatch(a.id, { watermark_enabled: v });
                void patch({ watermark_enabled: v });
              }}
            />
          )}
          <Switch
            label="Cho tải xuống"
            desc="Khách tải được ảnh về máy"
            checked={a.download_enabled}
            onChange={(v) => {
              onPatch(a.id, { download_enabled: v });
              void patch({ download_enabled: v });
            }}
          />
        </div>

        <div className="v2-card v2-card-pad flex flex-col gap-3" style={{ boxShadow: "none", background: "var(--sf2)" }}>
          <div>
            <p className="text-[13.5px] font-semibold">Lọc ảnh · gom khuôn mặt</p>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Khuôn mặt: {faceText}</p>
          </div>
          <button type="button" onClick={() => onOpenFilter(a)} className={btn("secondary", "sm", "self-start")}>
            <Filter size={15} /> Mở công cụ lọc ảnh
          </button>
        </div>

        {a._done && (
          <button
            type="button"
            className={btn("soft", "md")}
            onClick={() => {
              onPatch(a.id, { selection_done_at: null });
              void patch({ selection_done_at: null });
            }}
          >
            <CheckCircle2 size={16} /> Đã lọc xong, bỏ đánh dấu
          </button>
        )}

        {err ? <p className="text-[12.5px]" style={{ color: "var(--rd)" }}>Không lưu được: {err}</p> : null}
      </div>
    </Drawer>
  );
}
