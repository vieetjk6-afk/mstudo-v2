"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FolderOpen, ImagePlus, PackageCheck, Plus, RefreshCw } from "lucide-react";
import AlbumModePicker, { type AlbumModeStatus } from "@/components/AlbumModePicker";
import { ALBUM_MODE_LABEL, needsDesktopWarning, readinessHints, type AlbumMode } from "@/lib/album-mode";

type Source = { id: string; name: string; url: string; stage: "selection" | "delivery" };
type AlbumInfo = {
  id: string;
  title: string;
  slug: string;
  status: string;
  phase: "selection" | "delivery";
  photoCount: number;
  deliveryPhotos: number;
  sources: Source[];
};
type Snapshot = {
  mode: AlbumMode | null;
  migrated: boolean;
  status: string | null;
  readiness: AlbumModeStatus & { ready: boolean };
  selectionAlbumId: string | null;
  galleryAlbumId: string | null;
  album: AlbumInfo | null;
};

/**
 * Tab Sản phẩm → "Album ảnh của hợp đồng": chế độ album (album mặc định từ
 * mstudo desktop / nhập link ảnh riêng) và — với chế độ nhập link riêng — MỘT
 * album dùng cho cả chọn ảnh lẫn giao hoàn thiện: dán link Drive ảnh chọn, dán
 * link ảnh hoàn thiện, chuyển sang giao khách. Mọi thao tác qua
 * /api/studio/contract-album (kiểm quyền theo hợp đồng, nhân viên dùng được).
 */
export default function ContractAlbumModeCard({
  contractId,
  status,
  onAlbumIds,
  onModeChange,
  onDelivered,
  toast,
}: {
  contractId: string;
  /** Trạng thái hợp đồng hiện tại — đổi thì tải lại (hoàn thành → nhắc dán link). */
  status: string;
  onAlbumIds: (d: { selectionAlbumId?: string | null; galleryAlbumId?: string | null }) => void;
  onModeChange?: (m: AlbumMode | null) => void;
  onDelivered?: () => void;
  toast: (m: string) => void;
}) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selUrl, setSelUrl] = useState("");
  const [delUrl, setDelUrl] = useState("");

  const apply = useCallback(
    (d: Snapshot) => {
      setSnap(d);
      onModeChange?.(d.mode);
      onAlbumIds({ selectionAlbumId: d.selectionAlbumId, galleryAlbumId: d.galleryAlbumId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    let off = false;
    fetch(`/api/studio/contract-album?contractId=${encodeURIComponent(contractId)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (off) return;
        if (!r.ok) setLoadErr(d?.error || `Lỗi ${r.status}`);
        else apply(d as Snapshot);
      })
      .catch(() => {
        if (!off) setLoadErr("Lỗi mạng khi tải album của hợp đồng.");
      });
    return () => {
      off = true;
    };
  }, [contractId, status, apply]);

  async function post(action: string, extra: Record<string, unknown> = {}, okMsg?: string): Promise<boolean> {
    setBusy(action + (extra.stage ? `:${extra.stage}` : ""));
    try {
      const res = await fetch("/api/studio/contract-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(`Lỗi: ${d?.error || res.status}`);
        return false;
      }
      apply(d as Snapshot);
      if (d?.delivered) onDelivered?.();
      const syncNote = typeof d?.total === "number" ? ` · ${d.total} ảnh/video${d.errors?.length ? ` · ${d.errors.join("; ")}` : ""}` : "";
      if (okMsg) toast(okMsg + syncNote + (d?.delivered ? " · đã chuyển sang giao khách" : ""));
      router.refresh();
      return true;
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function setMode(m: AlbumMode) {
    if (!snap || m === snap.mode) return;
    if (m === "manual" && snap.mode === "desktop" && !confirm("Chuyển hợp đồng sang nhập link ảnh riêng? mstudo desktop sẽ không đồng bộ thư mục của hợp đồng này nữa.")) return;
    await post("set_mode", { mode: m }, m === "manual" ? "Đã chuyển sang nhập link ảnh riêng" : "Đã chuyển sang album mặc định");
  }

  if (loadErr) {
    return (
      <div className="card mb-4 p-5 text-[12.5px]" style={{ color: "var(--text3)" }}>
        {loadErr}
      </div>
    );
  }
  if (!snap) {
    return (
      <div className="card mb-4 p-5 text-[12.5px]" style={{ color: "var(--text3)" }}>
        Đang tải album của hợp đồng…
      </div>
    );
  }
  if (!snap.migrated) {
    return (
      <div className="card mb-4 p-5 text-[12px]" style={{ color: "var(--text3)" }}>
        Muốn chọn “Album mặc định” hay “Nhập link ảnh riêng” cho từng hợp đồng: chạy{" "}
        <code>supabase/migrations/che_do_album_hop_dong.sql</code> (hoặc <code>cap-nhat.sql</code>) trên Supabase.
      </div>
    );
  }

  const al = snap.album;
  const completed = snap.status === "completed";
  const selSources = al?.sources.filter((s) => s.stage === "selection") ?? [];
  const delSources = al?.sources.filter((s) => s.stage === "delivery") ?? [];

  const sourceList = (list: Source[]) =>
    list.length > 0 && (
      <ul className="mb-2 space-y-1">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text2)" }}>
            <FolderOpen size={13} className="flex-none" />
            <span className="truncate">{s.name}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="flex-none underline" style={{ color: "var(--text3)" }}>
              mở
            </a>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="card mb-4 p-6">
      <h2 className="mb-1 font-serif text-lg font-medium">Album ảnh của hợp đồng</h2>
      <p className="mb-4 text-[12px]" style={{ color: "var(--text3)" }}>
        {snap.mode ? `Đang dùng: ${ALBUM_MODE_LABEL[snap.mode]}.` : "Hợp đồng cũ — đang theo cách tự động trước đây. Chọn một chế độ để cố định."}
      </p>

      {/* Album mặc định mà điều kiện đã mất (gỡ máy desktop, ngắt Drive…). */}
      {needsDesktopWarning(snap.mode, snap.readiness) && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl p-3.5 sm:flex-row sm:items-center" style={{ background: "var(--amS)" }}>
          <AlertTriangle size={17} style={{ flex: "none", color: "var(--am)" }} />
          <div className="min-w-0 flex-1 text-[12px]" style={{ color: "var(--text2)" }}>
            <p className="font-semibold" style={{ color: "var(--am)" }}>Album mặc định đang không đồng bộ được</p>
            {readinessHints(snap.readiness).map((h) => (
              <p key={h.key}>• {h.text}</p>
            ))}
          </div>
          <button type="button" className="btn-ghost whitespace-nowrap" disabled={!!busy} onClick={() => setMode("manual")}>
            Chuyển sang nhập link riêng
          </button>
        </div>
      )}

      <AlbumModePicker
        name={`album-mode-${contractId}`}
        value={snap.mode}
        status={snap.readiness}
        onStatus={(r) => setSnap((p) => (p ? { ...p, readiness: { ...p.readiness, ...r, ready: !!r.ready } } : p))}
        disabled={!!busy}
        onChange={setMode}
      />

      {snap.mode === "manual" && (
        <div className="mt-4 space-y-4">
          {!al ? (
            <div className="rounded-xl p-3.5" style={{ background: "var(--surface2)" }}>
              <p className="text-[13px] font-semibold">Chưa có album</p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                Album tự tạo khi khách xác nhận hợp đồng (ký, chuyển cọc hoặc bạn chuyển sang “Khách đã duyệt”). Cần sớm hơn thì tạo ngay.
              </p>
              <button type="button" className="btn-ghost mt-2.5" disabled={!!busy} onClick={() => post("create_album", {}, "Đã tạo album cho hợp đồng")}>
                <Plus size={15} /> {busy === "create_album" ? "Đang tạo…" : "Tạo album cho hợp đồng"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-3" style={{ background: "var(--surface2)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{al.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={al.phase === "delivery" ? { background: "var(--gnS)", color: "var(--success)" } : { background: "var(--surface)", color: "var(--text2)" }}
                    >
                      {al.phase === "delivery" ? "Giao khách" : "Chọn ảnh"}
                    </span>
                    <span>{al.photoCount} ảnh/video</span>
                  </p>
                </div>
                <Link href={`/dashboard/albums/${al.id}`} className="btn-ghost whitespace-nowrap">Mở album</Link>
              </div>

              {/* Link ảnh chọn (stage 'selection'). */}
              <div>
                <label className="label">Dán link Drive ảnh chọn</label>
                {sourceList(selSources)}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input flex-1"
                    inputMode="url"
                    placeholder="https://drive.google.com/drive/folders/…"
                    value={selUrl}
                    onChange={(e) => setSelUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost whitespace-nowrap"
                    disabled={!!busy || !selUrl.trim()}
                    onClick={async () => {
                      if (await post("add_link", { stage: "selection", url: selUrl.trim() }, "Đã thêm link ảnh chọn")) setSelUrl("");
                    }}
                  >
                    <ImagePlus size={15} /> {busy === "add_link:selection" ? "Đang đồng bộ…" : "Thêm & đồng bộ"}
                  </button>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                  Thư mục cần chia sẻ “Bất kỳ ai có đường liên kết”. Thư mục con tự tách thành từng mục trong album.
                </p>
              </div>

              {/* Hoàn thành mà chưa giao: nhắc dán link hoàn thiện, KHÔNG tạo album mới. */}
              {completed && al.phase !== "delivery" && (
                <div className="flex gap-2.5 rounded-xl p-3.5" style={{ background: "var(--amS)" }}>
                  <AlertTriangle size={16} style={{ flex: "none", color: "var(--am)", marginTop: 1 }} />
                  <p className="text-[12px]" style={{ color: "var(--text2)" }}>
                    <b style={{ color: "var(--am)" }}>Dán link ảnh hoàn thiện để giao khách.</b> Hợp đồng đã hoàn thành — album vẫn ở giai đoạn
                    Chọn ảnh tới khi có ảnh hoàn thiện, rồi chuyển sang Giao khách trên cùng link khách đang giữ.
                  </p>
                </div>
              )}

              {/* Link ảnh hoàn thiện (stage 'delivery') + chuyển giai đoạn. */}
              <div>
                <label className="label">Link ảnh hoàn thiện (giao khách)</label>
                {sourceList(delSources)}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input flex-1"
                    inputMode="url"
                    placeholder="Link thư mục Google Drive ảnh đã chỉnh sửa…"
                    value={delUrl}
                    onChange={(e) => setDelUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost whitespace-nowrap"
                    disabled={!!busy || !delUrl.trim()}
                    onClick={async () => {
                      if (await post("add_link", { stage: "delivery", url: delUrl.trim() }, "Đã thêm link ảnh hoàn thiện")) setDelUrl("");
                    }}
                  >
                    <RefreshCw size={15} className={busy === "add_link:delivery" ? "animate-spin" : ""} />{" "}
                    {busy === "add_link:delivery" ? "Đang đồng bộ…" : "Thêm & đồng bộ"}
                  </button>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                  {completed
                    ? "Hợp đồng đã hoàn thành: dán link xong là album tự chuyển sang Giao khách và báo khách."
                    : "Dán sẵn được; album chỉ chuyển sang Giao khách khi hợp đồng hoàn thành hoặc khi bạn bấm chuyển."}
                </p>
                {al.phase !== "delivery" && delSources.length > 0 && (
                  <button
                    type="button"
                    className="btn-ghost mt-2.5"
                    disabled={!!busy}
                    onClick={async () => {
                      if (await post("deliver", {}, "Đã chuyển sang giai đoạn Giao khách")) onDelivered?.();
                    }}
                  >
                    <PackageCheck size={15} /> {busy === "deliver" ? "Đang chuyển…" : `Chuyển sang giao khách${al.deliveryPhotos ? ` (${al.deliveryPhotos} ảnh)` : ""}`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
