"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  FileText,
  MessageSquareText,
  ImageOff,
  Check,
  Trash2,
  Plus,
  Star,
  ExternalLink,
  Users,
  Save,
  Images,
  PackageCheck,
  ArrowRight,
  FolderOpen,
  HardDrive,
  HardDriveDownload,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { isDeliveryPhase } from "@/lib/album-phase";
import { studioUrl } from "@/lib/hosts";
import ShareButton from "@/components/ShareButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import { thumbnailUrl, isFolderLink, stripExtension } from "@/lib/drive";
import { fetchAllPhotos } from "@/lib/photos";
import { CATEGORY_PRESETS, slugifyVi } from "@/lib/category";
import { fmtDate } from "@/lib/date";
import { storageUntil, storageState, storageLabel, STORAGE_EXTEND_CHOICES } from "@/lib/storage-lifecycle";
import type { Album, AlbumSource, Photo, SourceKind, AlbumPhase, SourceStage } from "@/lib/types";

/* ── Tab của màn cài đặt album (bản thiết kế, màn "Album chọn ảnh") ──────────
   Trước đây mọi thứ nằm trong một lưới 3 cột: cột trái cài đặt dài dằng dặc,
   cột phải nguồn ảnh + lưới ảnh. Gom vào tab để mỗi lần chỉ thấy đúng việc
   đang làm, thứ tự đi theo cách studio dùng thật. */
const ALBUM_TABS = [
  ["photos", "Ảnh"],
  ["picked", "Lượt chọn"],
  ["sources", "Nguồn ảnh"],
  ["settings", "Cài đặt"],
  ["deliver", "Giao khách"],
] as const;
type AlbumTab = (typeof ALBUM_TABS)[number][0];

/** Một dòng khách bấm chọn (bảng selections) — đủ để dựng tab "Lượt chọn". */
export type AlbumPick = {
  id: string;
  photo_id: string;
  photo_name: string;
  session_id: string;
  client_name: string | null;
  client_note: string | null;
  photographer_note: string | null;
  created_at: string;
};

/**
 * Album GIAO KHÁCH của cùng hợp đồng (hợp đồng đồng bộ Drive có hai album). Khi
 * nó đã sẵn sàng, link khách của album chọn ảnh tự chuyển sang đó.
 */
export type DeliveryTwin = {
  id: string;
  slug: string;
  title: string;
  status: string;
  phase: string | null;
  is_gallery: boolean | null;
};

export default function AlbumEditor({
  album,
  initialSources,
  initialPhotos,
  canDelivery = true,
  canPinHome = true,
  canWatermark = true,
  studioName = "Studio",
  studioHost = null,
  studioCats = [],
  contractId = null,
  clientPhone = null,
  clientName = null,
  selections = [],
  storageMonths = 6,
  deliveryTwin = null,
}: {
  album: Album;
  initialSources: AlbumSource[];
  initialPhotos: Photo[];
  canDelivery?: boolean;
  canPinHome?: boolean;
  canWatermark?: boolean;
  studioName?: string;
  studioHost?: string | null;
  studioCats?: { slug: string; label: string }[];
  contractId?: string | null;
  clientPhone?: string | null;
  clientName?: string | null;
  /** Ảnh khách đã bấm chọn (bảng selections), gộp theo mã chọn ở ngay màn này. */
  selections?: AlbumPick[];
  /** Chính sách lưu trữ ảnh gốc của studio (tháng). 0 = giữ vô hạn. */
  storageMonths?: number;
  /** Album giao khách của cùng hợp đồng (nếu album này là album chọn ảnh). */
  deliveryTwin?: DeliveryTwin | null;
}) {
  const { t } = useLang();
  const supabase = createClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<AlbumTab>("photos");
  // Tab "Lượt chọn": lọc theo mã chọn (session) và theo "chỉ ảnh có ghi chú".
  const [pickSession, setPickSession] = useState<string>("all");
  const [notesOnly, setNotesOnly] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  async function deleteAlbum() {
    if (!confirm("Xóa album này? Thao tác không thể hoàn tác. (Số album đã tạo trong tháng vẫn được tính.)")) return;
    setDeleting(true);
    const { error } = await supabase.from("albums").delete().eq("id", album.id);
    if (error) {
      setDeleting(false);
      flash(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const [form, setForm] = useState({
    title: album.title,
    description: album.description ?? "",
    slug: album.slug,
    selection_limit: album.selection_limit ?? "",
    watermark_enabled: album.watermark_enabled,
    watermark_text: album.watermark_text ?? studioName,
    watermark_delivery: album.watermark_delivery ?? false,
    gallery_pinned: album.gallery_pinned ?? false,
    download_enabled: album.download_enabled ?? true,
    status: album.status,
    cover_url: album.cover_url,
    is_showcase: album.is_showcase,
    is_pinned: album.is_pinned,
    kind: album.kind ?? "",
    category: album.category ?? "",
    category_label: album.category_label ?? "",
  });
  const [hasPassword, setHasPassword] = useState(!!album.password_hash);
  const [newPassword, setNewPassword] = useState("");

  // Cùng luật với trang khách: album đời đầu chỉ có cờ `is_gallery` (phase còn
  // null) mà màn này ghi "Chọn ảnh" thì studio thấy một đằng, khách thấy một nẻo.
  const [phase, setPhase] = useState<AlbumPhase>(isDeliveryPhase(album) ? "delivery" : "selection");
  const [phaseBusy, setPhaseBusy] = useState(false);
  // Link khách của album này có đang bị chuyển sang album giao khách của hợp
  // đồng không — điều kiện phải khớp Y HỆT src/app/a/[slug]/page.tsx.
  const [twinPhase, setTwinPhase] = useState<string | null>(
    deliveryTwin ? deliveryTwin.phase ?? (deliveryTwin.is_gallery ? "delivery" : "selection") : null
  );
  const [twinBusy, setTwinBusy] = useState(false);
  const twinTakesOver =
    !!deliveryTwin && deliveryTwin.status === "published" && phase !== "delivery" && twinPhase === "delivery";
  // Hạn lưu trữ ảnh gốc trên Drive (null = giữ vô hạn).
  const [storageDate, setStorageDate] = useState<string | null>(album.storage_until ?? null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [sources, setSources] = useState<AlbumSource[]>(initialSources);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);

  const [newSource, setNewSource] = useState<{ name: string; url: string; stage: SourceStage }>({ name: "", url: "", stage: "selection" });
  // Link ảnh đã CHỈNH SỬA (giao khách) — studio nhập ở giai đoạn giao. Ảnh trong
  // thư mục này hiện cho khách ở album giao; ảnh gốc khách đã chọn tự thành "File gốc".
  const [editedUrl, setEditedUrl] = useState(
    initialSources.find((s) => s.stage === "delivery" && s.kind === "folder")?.drive_url ?? ""
  );
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  // A photo's stage comes from the source it was synced from.
  const stageById = new Map(sources.map((s) => [s.id, s.stage]));
  const deliveryPhotos = photos.filter((p) => stageById.get(p.source_id ?? "") === "delivery");
  const deliveryCount = deliveryPhotos.length;
  const selectionCount = photos.length - deliveryCount;

  /* ── Lưới ảnh tách theo GIAI ĐOẠN rồi tới THƯ MỤC CON ───────────────────────
     Album đã chuyển sang giao khách thì ảnh giai đoạn giao lên đầu — đó là bộ
     ảnh studio đang làm việc, và ảnh bìa gần như luôn chọn từ đó. Hai giai đoạn
     nằm ở hai mục riêng nên đặt bìa cho từng bộ không bị lẫn. Trong mỗi mục,
     nếu link Drive có thư mục con (sync tự tách thành nhiều nguồn) thì mỗi thư
     mục con lại là một mục nhỏ có tiêu đề riêng. */
  const [photoStage, setPhotoStage] = useState<"all" | "delivery" | "selection">("all");

  const photoGroups = useMemo(() => {
    const stages = new Map(sources.map((s) => [s.id, s.stage]));
    const del: Photo[] = [];
    const sel: Photo[] = [];
    for (const p of photos) {
      if (stages.get(p.source_id ?? "") === "delivery") del.push(p);
      else sel.push(p);
    }
    const groups = [
      { key: "delivery" as const, label: "Ảnh giao khách", photos: del },
      { key: "selection" as const, label: "Ảnh chọn", photos: sel },
    ];
    return phase === "delivery" ? groups : [groups[1], groups[0]];
  }, [photos, sources, phase]);

  /** Tách một nhóm ảnh thành các mục nhỏ theo thư mục (nguồn) Drive. */
  const splitBySource = useCallback(
    (list: Photo[]) => {
      const bySrc = new Map<string, Photo[]>();
      for (const p of list) {
        const k = p.source_id ?? "none";
        if (!bySrc.has(k)) bySrc.set(k, []);
        bySrc.get(k)!.push(p);
      }
      if (bySrc.size <= 1) return [{ id: "one", name: "", photos: list }];
      const out: { id: string; name: string; photos: Photo[] }[] = [];
      for (const src of sources) {
        const got = bySrc.get(src.id);
        if (got) {
          out.push({ id: src.id, name: src.name, photos: got });
          bySrc.delete(src.id);
        }
      }
      for (const [k, items] of bySrc) out.push({ id: k, name: "Khác", photos: items });
      return out;
    },
    [sources]
  );
  // Delivery folder sources can be opened straight on Drive (0 Fast Origin Transfer,
  // true originals — Google serves the download, not us).
  const deliveryFolders = sources.filter((s) => s.stage === "delivery" && s.kind === "folder");

  /* ── Lượt khách chọn ──────────────────────────────────────────────────────
     Gộp theo MÃ CHỌN (session_id): mỗi lần một người mở link khách rồi bấm tim
     là một mã riêng — cô dâu chọn một mã, mẹ cô dâu chọn mã khác. Studio xem
     ngay tại màn này thay vì nhảy sang trang khác. */
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const pickSessions = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; count: number; at: string }>();
    for (const s of selections) {
      const cur = map.get(s.session_id);
      if (cur) {
        cur.count += 1;
        if (s.created_at > cur.at) cur.at = s.created_at;
        if (!cur.name && s.client_name) cur.name = s.client_name;
      } else {
        map.set(s.session_id, { id: s.session_id, name: s.client_name, count: 1, at: s.created_at });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.at.localeCompare(a.at));
  }, [selections]);

  /** Ảnh hiện trong tab: chỉ ảnh ĐÃ CHỌN, lọc thêm theo mã và theo ghi chú. */
  const visiblePicks = useMemo(() => {
    let rows = selections;
    if (pickSession !== "all") rows = rows.filter((s) => s.session_id === pickSession);
    if (notesOnly) rows = rows.filter((s) => (s.client_note || s.photographer_note || "").trim());
    // Cùng một ảnh có thể được nhiều mã chọn — khi xem "Tất cả" thì gộp làm một
    // và giữ lại mọi ghi chú để không mất ý khách.
    if (pickSession !== "all") return rows;
    const byPhoto = new Map<string, AlbumPick>();
    for (const s of rows) {
      const cur = byPhoto.get(s.photo_id);
      if (!cur) { byPhoto.set(s.photo_id, { ...s }); continue; }
      const note = [cur.client_note, s.client_note].filter(Boolean).join(" · ");
      cur.client_note = note || null;
    }
    return Array.from(byPhoto.values());
  }, [selections, pickSession, notesOnly]);

  /** Id ảnh khách đã chọn — tab "Ảnh" viền đậm + gắn dấu tích cho những ảnh này. */
  const pickedIds = useMemo(() => new Set(selections.map((s) => s.photo_id)), [selections]);

  const notedCount = useMemo(
    () => selections.filter((s) => (s.client_note || s.photographer_note || "").trim()).length,
    [selections]
  );

  /** Chép danh sách tên file (bỏ đuôi) đúng thứ đang hiện — đem đi lọc ảnh. */
  function copyPickList() {
    const text = visiblePicks.map((s) => stripExtension(s.photo_name)).join("\n");
    navigator.clipboard?.writeText(text);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 1800);
  }

  /** Tải .txt kèm ghi chú — file này studio hay gửi cho thợ chỉnh ảnh. */
  function exportPickList() {
    const text = visiblePicks
      .map((s) => {
        const note = (s.client_note || s.photographer_note || "").trim();
        return stripExtension(s.photo_name) + (note ? ` — ${note}` : "");
      })
      .join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${album.slug}-anh-khach-chon.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }


  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase
      .from("albums")
      .update({
        title: form.title,
        description: form.description || null,
        slug: form.slug,
        selection_limit:
          form.selection_limit === "" ? null : Number(form.selection_limit),
        watermark_enabled: canWatermark && form.watermark_enabled,
        watermark_text: form.watermark_text || null,
        watermark_delivery: canWatermark && form.watermark_delivery,
        gallery_pinned: canPinHome ? form.gallery_pinned : false,
        download_enabled: form.download_enabled,
        status: form.status,
        cover_url: form.cover_url,
        is_showcase: form.is_showcase,
        is_pinned: form.is_pinned,
        kind: form.kind || null,
        category: form.category || null,
        category_label: form.category_label || null,
      })
      .eq("id", album.id);
    setSaving(false);
    if (error) flash(error.message);
    else flash(t("saved"));
  }

  async function savePassword() {
    const res = await fetch(`/api/albums/${album.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setHasPassword(data.hasPassword);
      setNewPassword("");
      flash(t("saved"));
    } else flash(data.error ?? t("error"));
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSource.url.trim()) return;
    const kind: SourceKind = isFolderLink(newSource.url) ? "folder" : "file";
    const { data, error } = await supabase
      .from("album_sources")
      .insert({
        album_id: album.id,
        name: newSource.name || (kind === "folder" ? "Folder" : "File"),
        drive_url: newSource.url.trim(),
        kind,
        stage: newSource.stage,
        position: sources.length,
      })
      .select("*")
      .single();
    if (error) return flash(error.message);
    setSources([...sources, data as AlbumSource]);
    setNewSource({ name: "", url: "", stage: newSource.stage });
    // Auto-sync so photos & thumbnails appear immediately after adding a source.
    await sync();
  }

  // Lưu link ảnh đã chỉnh sửa (giao khách): tạo/cập nhật nguồn stage 'delivery'
  // rồi đồng bộ ảnh. Ảnh trong thư mục này là ảnh hiện cho khách ở album giao.
  //
  // Nếu thư mục có THƯ MỤC CON, bước sync sau đó tự tách mỗi thư mục con thành
  // một nguồn riêng (kế thừa stage 'delivery') — album giao khách vì thế hiện
  // đúng từng mục nhỏ thay vì trộn chung một đống.
  async function saveDeliveryLink() {
    const url = editedUrl.trim();
    if (!url || deliveryBusy) return;
    setDeliveryBusy(true);
    const kind: SourceKind = isFolderLink(url) ? "folder" : "file";
    const delivery = sources.filter((s) => s.stage === "delivery");
    // Nguồn "gốc" của giai đoạn giao là cái đang giữ đúng link này, nếu không có
    // thì lấy nguồn giao đầu tiên (những cái còn lại là thư mục con tự tách ra).
    const existing = delivery.find((s) => s.drive_url === url) ?? delivery[0];
    let next = sources;
    if (existing) {
      const { error } = await supabase.from("album_sources").update({ drive_url: url, kind }).eq("id", existing.id);
      if (error) { setDeliveryBusy(false); return flash(error.message); }
      next = sources.map((s) => (s.id === existing.id ? { ...s, drive_url: url, kind } : s));
      // Đổi sang link khác ⇒ các thư mục con tách ra từ link CŨ không còn đúng
      // nữa; xoá đi để sync tách lại theo link mới (ảnh xoá theo cascade).
      const stale = delivery.filter((s) => s.id !== existing.id && s.drive_url !== url).map((s) => s.id);
      if (existing.drive_url !== url && stale.length > 0) {
        await supabase.from("album_sources").delete().in("id", stale);
        next = next.filter((s) => !stale.includes(s.id));
        setPhotos((prev) => prev.filter((ph) => !stale.includes(ph.source_id ?? "")));
      }
      setSources(next);
    } else {
      const { data, error } = await supabase
        .from("album_sources")
        .insert({ album_id: album.id, name: "File ChinhSua", drive_url: url, kind, stage: "delivery", position: sources.length })
        .select("*")
        .single();
      if (error) { setDeliveryBusy(false); return flash(error.message); }
      setSources([...sources, data as AlbumSource]);
    }
    await sync();
    setDeliveryBusy(false);
  }

  // Switch which phase the client link exposes (selection ↔ delivery). Plans
  // without delivery can still switch BACK to selection (escape a stuck album),
  // but can't switch into delivery.
  async function switchPhase(next: AlbumPhase) {
    if (!canDelivery && next === "delivery") return;
    setPhaseBusy(true);
    // Lần ĐẦU sang giai đoạn giao khách là mốc bắt đầu đếm hạn lưu trữ ảnh gốc.
    // Chỉ đặt một lần: chuyển tới chuyển lui không được đẩy hạn ra xa mãi.
    const patch: Record<string, unknown> = { phase: next };
    if (next === "delivery" && !album.delivered_at) {
      const now = new Date();
      patch.delivered_at = now.toISOString();
      patch.storage_until = storageUntil(now, storageMonths);
    }
    const { error } = await supabase.from("albums").update(patch).eq("id", album.id);
    setPhaseBusy(false);
    if (error) return flash(error.message);
    setPhase(next);
    if (patch.storage_until) setStorageDate(patch.storage_until as string);
    flash(next === "delivery" ? "Đã chuyển sang giai đoạn Giao khách" : "Đã chuyển về giai đoạn Chọn ảnh");
    router.refresh();
  }

  /**
   * Đưa album GIAO KHÁCH của hợp đồng về giai đoạn chọn ảnh, để link khách quay
   * lại chính album này. Dùng khi studio bấm hoàn thành sớm (thu đủ tiền) mà
   * hậu kỳ chưa xong: khách cần tiếp tục chọn ảnh chứ không phải xem ảnh giao.
   */
  async function twinBackToSelection() {
    if (!deliveryTwin) return;
    setTwinBusy(true);
    const { error } = await supabase.from("albums").update({ phase: "selection" }).eq("id", deliveryTwin.id);
    setTwinBusy(false);
    if (error) return flash(error.message);
    setTwinPhase("selection");
    flash("Link khách đã quay lại album chọn ảnh này");
    router.refresh();
  }

  /** Gia hạn lưu trữ ảnh gốc thêm N tháng kể từ HÔM NAY. */
  async function extendStorage(months: number) {
    const next = storageUntil(new Date(), months);
    setStorageBusy(true);
    const { error } = await supabase
      .from("albums")
      // storage_notice_at về null để lần tới sắp hết hạn vẫn được nhắc lại.
      .update({ storage_until: next, storage_notice_at: null })
      .eq("id", album.id);
    setStorageBusy(false);
    if (error) return flash(error.message);
    setStorageDate(next);
    flash(`Đã gia hạn lưu trữ tới ${next}`);
  }

  /** Bỏ hạn — giữ ảnh gốc vô thời hạn. */
  async function clearStorage() {
    setStorageBusy(true);
    const { error } = await supabase.from("albums").update({ storage_until: null, storage_notice_at: null }).eq("id", album.id);
    setStorageBusy(false);
    if (error) return flash(error.message);
    setStorageDate(null);
    flash("Đã bỏ hạn — giữ ảnh gốc vô thời hạn");
  }

  async function removeSource(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("album_sources").delete().eq("id", id);
    setSources(sources.filter((s) => s.id !== id));
    setPhotos(photos.filter((p) => p.source_id !== id));
  }

  async function sync() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch(`/api/albums/${album.id}/sync`, { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) return flash(data.error ?? t("error"));

    const fresh = await fetchAllPhotos(supabase, album.id, "*");
    setPhotos(fresh as Photo[]);
    // refresh sources too (sync may have auto-added sub-folder sources)
    const { data: freshSources } = await supabase
      .from("album_sources")
      .select("*")
      .eq("album_id", album.id)
      .order("position");
    if (freshSources) setSources(freshSources as AlbumSource[]);
    flash(
      `${data.total} ${t("photos")}` +
        (data.errors?.length ? ` · ${data.errors.join("; ")}` : "")
    );
  }

  async function setCover(fileId: string) {
    const url = thumbnailUrl(fileId, 800);
    setForm((f) => ({ ...f, cover_url: url }));
    await supabase.from("albums").update({ cover_url: url }).eq("id", album.id);
    flash(t("saved"));
  }

  async function removePhoto(id: string) {
    await supabase.from("photos").delete().eq("id", id);
    setPhotos(photos.filter((p) => p.id !== id));
  }

  const clientLink = studioUrl(studioHost, `/a/${form.slug}`);

  return (
    <div className="page-in pb-16">
      {/* ── Đầu màn: quay lại · tên album + dòng phụ · hành động ────────────
          Đúng hàng đầu của bản thiết kế; nút phụ dồn phải, nút chính là link
          gửi khách. Vẫn wrap được vì trên điện thoại hàng này dài hơn màn. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/albums"
          aria-label="Về thư viện album"
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-bold" style={{ letterSpacing: "-.4px" }}>{form.title}</h1>
          <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {[
              phase === "delivery" ? "Album giao khách" : "Album chọn ảnh",
              `${photos.length} ảnh`,
              form.status === "published" ? "đã xuất bản" : "đang là nháp",
            ].join(" · ")}
          </p>
        </div>

        {/* Trên điện thoại: lưới 2 cột, mọi nút bằng nhau và bằng chiều cao —
            trước đây 7 nút với 3 cỡ chữ khác nhau tự wrap thành các hàng so le.
            Từ 820px trở lên trở về dải ngang dồn phải như bản thiết kế.
            Thứ tự cũng xếp lại theo việc: xem → chia sẻ → thêm ảnh → xoá. */}
        <div className="ml-auto grid w-full grid-cols-2 items-center gap-2 min-[820px]:flex min-[820px]:w-auto min-[820px]:flex-wrap">
          <Link href={`/dashboard/albums/${album.id}/selections`} className="act-btn">
            <Users size={16} /> {t("customerSelections")}
          </Link>
          {/* Lọc ảnh NGAY từ cài đặt album — mở popup công cụ lọc tại chỗ (nguồn
              Drive hoặc máy tính). Chỉ hiện ở album chọn ảnh; giai đoạn giao
              khách không lọc theo danh sách khách chọn nữa. Khuôn mặt thì KHÔNG
              có mặt ở màn này chút nào — máy chủ tự quét, xem
              @/lib/face-scan-server. */}
          {phase !== "delivery" && <FilterPhotosButton albumId={album.id} albumTitle={form.title} className="act-btn" />}
          <a href={clientLink} target="_blank" rel="noreferrer" className="act-btn">
            <ExternalLink size={16} /> Mở link khách
          </a>
          <ShareButton path={clientLink} title={form.title} className="act-btn" />
          {/* Ô nhập số điện thoại + nút gửi nên chiếm cả hàng trên điện thoại,
              nhồi vào nửa hàng thì ô nhập chỉ còn vài chục pixel. */}
          <div className="col-span-2 min-[820px]:col-auto">
            <ZaloSendButton
              phone={clientPhone || album.client_phone}
              name={clientName || album.client_name}
              contractId={contractId}
              audience="client"
              kind="album_share"
              askPhone
              className="act-btn act-btn-auto flex-1"
              message={`Chào ${clientName || album.client_name || "anh/chị"}, mời anh/chị xem album ảnh tại: ${clientLink}`}
            />
          </div>
          <button onClick={() => setTab("sources")} className="act-btn act-btn-primary">
            <Plus size={16} /> Tải thêm ảnh
          </button>
          <button onClick={deleteAlbum} disabled={deleting} className="act-btn act-btn-danger">
            <Trash2 size={15} /> {deleting ? "Đang xóa…" : t("delete")}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-3.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
          {msg}
        </div>
      )}

      {/* KHÔNG có bảng gom khuôn mặt ở đây, và đó là chủ ý.
          Bản trước quét khuôn mặt ngay trên màn này: studio mở album ra là trình
          duyệt chạy ngầm. Studio nói thẳng bước đó thừa — studio không tìm mặt
          bao giờ, chỉ KHÁCH mới cần. Giờ máy chủ tự quét (cron
          /api/cron/face-scan). Muốn xem đã quét tới đâu thì gọi
          GET /api/albums/<id>/face-scan; muốn chạy ngay thì POST cùng đường dẫn. */}

      {/* Hợp đồng đồng bộ Drive có HAI album. Khi album giao khách đã sẵn sàng,
          link khách của album chọn ảnh tự chuyển sang đó — nhìn ở màn này thì
          album vẫn ghi "Chọn ảnh" mà bấm link lại ra trang giao khách. Nói
          thẳng ra, kèm nút đưa ngược về. */}
      {twinTakesOver && deliveryTwin && (
        <div className="mb-3.5 flex flex-col gap-2.5 rounded-[12px] p-3.5 sm:flex-row sm:items-center" style={{ background: "var(--amS)", border: "1px solid var(--am)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold" style={{ color: "var(--am)" }}>
              Link khách đang mở album giao khách
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
              Hợp đồng đã có album “{deliveryTwin.title}”, nên link khách của album chọn ảnh này tự chuyển sang đó.
              Hậu kỳ chưa xong thì đưa về để khách chọn ảnh tiếp.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <Link href={`/dashboard/albums/${deliveryTwin.id}`} className="act-btn">
              Mở album giao khách
            </Link>
            <button onClick={twinBackToSelection} disabled={twinBusy} className="act-btn act-btn-primary">
              <ArrowLeft size={15} /> {twinBusy ? "Đang đổi…" : "Về giai đoạn Chọn ảnh"}
            </button>
          </div>
        </div>
      )}

      {/* ── Bốn thẻ số liệu ───────────────────────────────────────────────
          Bản thiết kế đặt ngay dưới đầu màn: ảnh trong album, ảnh khách chọn,
          nguồn ảnh và trạng thái công bố — nhìn là biết album đang tới đâu. */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        {([
          [String(photos.length), "Ảnh trong album", "photos"],
          [String(selections.length), pickSessions.length > 1 ? `Lượt khách chọn · ${pickSessions.length} mã` : "Lượt khách chọn", "picked"],
          [String(sources.length), "Nguồn ảnh Drive", "sources"],
          [form.status === "published" ? "Đã xuất bản" : "Nháp", phase === "delivery" ? "Giai đoạn giao khách" : "Giai đoạn chọn ảnh", "settings"],
        ] as [string, string, AlbumTab][]).map(([v, l, go]) => {
          const on = tab === go;
          return (
            <button
              key={l}
              onClick={() => setTab(go)}
              className="rounded-[14px] px-4 py-3.5 text-left"
              style={{ background: on ? "var(--acS)" : "var(--sf)", border: `1px solid ${on ? "var(--acM)" : "var(--bd)"}` }}
            >
              <p className="tnum text-[22px] font-bold" style={{ letterSpacing: "-.6px", color: on ? "var(--ac)" : "var(--tx)" }}>{v}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx2)" }}>{l}</p>
            </button>
          );
        })}
      </div>

      {/* ── Thẻ nội dung có tab ───────────────────────────────────────────── */}
      <div>
        <div role="tablist" aria-label="Nội dung album" className="flex gap-0.5 overflow-x-auto rounded-[14px] px-3" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
          {ALBUM_TABS.map(([key, label]) => {
            const on = tab === key;
            const badge = key === "photos" ? photos.length : key === "picked" ? selections.length : key === "sources" ? sources.length : 0;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="flex flex-none items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-3 text-[13px]"
                style={{
                  color: on ? "var(--ac)" : "var(--tx2)",
                  fontWeight: on ? 700 : 550,
                  borderBottom: `2px solid ${on ? "var(--ac)" : "transparent"}`,
                }}
              >
                {label}
                {badge > 0 && (
                  <span className="rounded-[20px] px-1.5 text-[10.5px] font-bold" style={{ background: on ? "var(--acS)" : "var(--sf2)", color: on ? "var(--ac)" : "var(--tx3)" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 space-y-3.5">

          {/* Ảnh: lưới ảnh đã đồng bộ về album */}
          {tab === "photos" && (
            <>
            {/* Photos */}
            <div className="card p-6">
              <h2 className="mb-4 flex flex-wrap items-center gap-2 text-sm font-medium uppercase tracking-wide text-accent-muted">
                {photos.length} {t("photos")}
                {deliveryCount > 0 && (
                  <span className="flex gap-1.5 normal-case">
                    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}>{selectionCount} chọn</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>{deliveryCount} giao</span>
                  </span>
                )}
              </h2>
              {pickedIds.size > 0 && (
                <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  Ảnh viền đậm kèm dấu tích là ảnh khách đã chọn ({pickedIds.size}/{photos.length}).{" "}
                  <button onClick={() => setTab("picked")} className="font-semibold underline" style={{ color: "var(--ac)" }}>
                    Xem riêng ảnh khách chọn
                  </button>
                </p>
              )}
              {/* Lọc theo giai đoạn — chỉ có nghĩa khi album có cả hai bộ ảnh. */}
              {deliveryCount > 0 && selectionCount > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {([
                    ["all", `Tất cả · ${photos.length}`],
                    ["delivery", `Ảnh giao khách · ${deliveryCount}`],
                    ["selection", `Ảnh chọn · ${selectionCount}`],
                  ] as ["all" | "delivery" | "selection", string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPhotoStage(key)}
                      className="rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                      style={photoStage === key
                        ? { background: "var(--ac)", color: "#fff" }
                        : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {photoGroups.map((g) => {
                if (g.photos.length === 0) return null;
                if (photoStage !== "all" && photoStage !== g.key) return null;
                const showGroupHead = deliveryCount > 0 && selectionCount > 0;
                return (
                  <div key={g.key} className="mb-5 last:mb-0">
                    {showGroupHead && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-[6px] px-2 py-0.5 text-[11px] font-bold"
                          style={g.key === "delivery"
                            ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                            : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                        >
                          {g.label}
                        </span>
                        <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                          {g.photos.length} ảnh · bấm ★ trên ảnh để đặt làm ảnh bìa
                        </span>
                      </div>
                    )}
                    {splitBySource(g.photos).map((sec) => (
                      <div key={`${g.key}-${sec.id}`} className="mb-3.5 last:mb-0">
                        {sec.name && (
                          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>
                            {sec.name}
                            <span className="ml-1.5 font-normal" style={{ color: "var(--tx3)" }}>· {sec.photos.length} ảnh</span>
                          </p>
                        )}
                        {/* Lưới ảnh 6 cột như bản thiết kế, tỉ lệ 3:2, khe 10px. */}
                        <div className="grid grid-cols-3 gap-2.5 min-[700px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1280px]:grid-cols-6">
                          {sec.photos.map((p) => {
                            const isPicked = pickedIds.has(p.id);
                            return (
                            <div
                              key={p.id}
                              className="group relative aspect-[3/2] overflow-hidden rounded-[9px]"
                              style={{ background: "var(--sf2)", border: isPicked ? "2px solid var(--ac)" : "1px solid var(--bd2)" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={thumbnailUrl(p.drive_file_id, 400)}
                                alt={p.name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                                <button
                                  onClick={() => setCover(p.drive_file_id)}
                                  title={t("setCover")}
                                  aria-label={t("setCover")}
                                  className="rounded bg-ink-900/80 p-1.5 text-accent-gold hover:bg-ink-800"
                                >
                                  <Star size={14} />
                                </button>
                                <button
                                  onClick={() => removePhoto(p.id)}
                                  aria-label={t("delete")}
                                  className="rounded bg-ink-900/80 p-1.5 hover:bg-ink-800"
                                  style={{ color: "var(--danger)" }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {isPicked && (
                                <span
                                  className="absolute right-1 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full"
                                  style={{ background: "var(--ac)", color: "#fff" }}
                                  title="Khách đã chọn ảnh này"
                                >
                                  <Check size={13} />
                                </span>
                              )}
                              {form.cover_url === thumbnailUrl(p.drive_file_id, 800) && (
                                <span className="absolute left-1.5 top-1.5 rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "var(--ac)", color: "#fff" }}>
                                  {t("cover")}
                                </span>
                              )}
                              <span
                                className="pointer-events-none absolute bottom-1 left-1.5 max-w-[85%] truncate text-[9px]"
                                style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.75)", fontFamily: "ui-monospace, monospace" }}
                              >
                                {stripExtension(p.name)}
                              </span>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {photos.length === 0 && (
                <p className="text-sm text-accent-muted">
                  {t("addSource")} → {t("syncDrive")}
                </p>
              )}
            </div>
            </>
          )}

          {/* Lượt chọn: chỉ ảnh khách ĐÃ chọn, lọc theo mã chọn và theo ghi chú */}
          {tab === "picked" && (
            <>
            <div className="card p-5">
              {selections.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-[15px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                    <ImageOff size={26} />
                  </span>
                  <p className="mt-3 text-[14px] font-bold">Khách chưa chọn ảnh nào</p>
                  <p className="mx-auto mt-1 max-w-[360px] text-[12px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Gửi link album cho khách; mỗi lần một người mở link và bấm tim là một <b>mã chọn</b> riêng, hiện ngay ở đây.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mã chọn: mỗi phiên khách bấm chọn là một mã */}
                  <p className="eyebrow mb-2">Mã chọn ({pickSessions.length})</p>
                  <div className="mb-3.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPickSession("all")}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                      style={pickSession === "all"
                        ? { background: "var(--ac)", color: "#fff" }
                        : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      Tất cả
                      <span className="text-[11px] font-bold opacity-75">{selections.length}</span>
                    </button>
                    {pickSessions.map((g) => {
                      const on = pickSession === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setPickSession(g.id)}
                          title={`Mã ${g.id}`}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                          style={on
                            ? { background: "var(--ac)", color: "#fff" }
                            : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                        >
                          <span style={{ fontFamily: "ui-monospace, monospace" }}>{g.id.slice(0, 6).toUpperCase()}</span>
                          {g.name ? <span className="font-normal opacity-80">· {g.name}</span> : null}
                          <span className="text-[11px] font-bold opacity-75">{g.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Thanh hành động: lọc ghi chú · chép danh sách · tải .txt */}
                  <div className="mb-3.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setNotesOnly((v) => !v)}
                      aria-pressed={notesOnly}
                      className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                      style={notesOnly
                        ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid var(--acM)" }
                        : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      <MessageSquareText size={15} /> Chỉ ảnh có ghi chú
                      <span className="text-[11px] font-bold opacity-75">{notedCount}</span>
                    </button>
                    <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                      Đang hiện {visiblePicks.length} ảnh · ảnh khách không chọn được ẩn đi
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button
                        onClick={copyPickList}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                      >
                        {copiedList ? <Check size={15} /> : <Copy size={15} />} {copiedList ? "Đã chép" : "Chép danh sách"}
                      </button>
                      <button
                        onClick={exportPickList}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                      >
                        <FileText size={15} /> Tải .txt
                      </button>
                      <Link
                        href={`/dashboard/albums/${album.id}/selections`}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ background: "var(--acS)", color: "var(--ac)" }}
                      >
                        <HardDriveDownload size={15} /> Tải ảnh gốc
                      </Link>
                    </div>
                  </div>

                  {visiblePicks.length === 0 ? (
                    <p className="rounded-[10px] px-3.5 py-8 text-center text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                      {notesOnly ? "Không có ảnh nào kèm ghi chú trong bộ lọc này." : "Mã chọn này chưa có ảnh nào."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 min-[700px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1280px]:grid-cols-6">
                      {visiblePicks.map((s) => {
                        const p = photoById.get(s.photo_id);
                        const note = (s.client_note || s.photographer_note || "").trim();
                        return (
                          <div key={s.id} className="overflow-hidden rounded-[9px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
                            <div className="relative aspect-[3/2]">
                              {p ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumbnailUrl(p.drive_file_id, 400)} alt={s.photo_name} loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[10.5px]" style={{ color: "var(--tx3)" }}>Ảnh đã bị gỡ</span>
                              )}
                              {note && (
                                <span
                                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full"
                                  style={{ background: "var(--ac)", color: "#fff" }}
                                  title={note}
                                >
                                  <MessageSquareText size={13} />
                                </span>
                              )}
                            </div>
                            <p className="truncate px-2 pt-1.5 text-[11px] font-semibold">{stripExtension(s.photo_name)}</p>
                            <p className="line-clamp-2 px-2 pb-2 pt-px text-[10.5px] leading-snug" style={{ color: note ? "var(--tx2)" : "var(--tx3)" }}>
                              {note || "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            </>
          )}

          {/* Nguồn ảnh: các thư mục / link Drive nạp vào album */}
          {tab === "sources" && (
            <>
            {/* Sources */}
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-accent-muted">
                {t("sources")}
              </h2>

              <ul className="mb-4 space-y-2">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-ink-800 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-accent">
                        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-accent-muted">
                          {s.kind}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] uppercase"
                          style={s.stage === "delivery"
                            ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                            : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                        >
                          {s.stage === "delivery" ? "Giao" : "Chọn"}
                        </span>
                        {s.name}
                      </div>
                      <div className="truncate text-xs text-ink-600">{s.drive_url}</div>
                    </div>
                    <button
                      onClick={() => removeSource(s.id)}
                      className="text-accent-muted hover:text-red-400"
                      aria-label={t("delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
                {sources.length === 0 && (
                  <li className="text-sm text-accent-muted">—</li>
                )}
              </ul>

              <form onSubmit={addSource} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_2fr_auto]">
                <select
                  className="input"
                  value={newSource.stage}
                  onChange={(e) =>
                    setNewSource({ ...newSource, stage: e.target.value as SourceStage })
                  }
                >
                  <option value="selection">Ảnh chọn</option>
                  {canDelivery && <option value="delivery">Ảnh giao</option>}
                </select>
                <input
                  className="input"
                  placeholder={t("sourceName")}
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder={t("driveLink")}
                  value={newSource.url}
                  onChange={(e) =>
                    setNewSource({ ...newSource, url: e.target.value })
                  }
                />
                <button className="btn-ghost whitespace-nowrap">
                  <Plus size={15} /> {t("addSource")}
                </button>
              </form>

              <button
                onClick={sync}
                disabled={syncing || sources.length === 0}
                className="btn-primary mt-4"
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
                {syncing ? t("syncing") : t("syncDrive")}
              </button>
            </div>

            </>
          )}

          {/* Cài đặt: tên, đường dẫn, giới hạn chọn, watermark, mật khẩu */}
          {tab === "settings" && (
            <>
            {/* Settings */}
            <div className="card space-y-4 p-6 lg:col-span-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-accent-muted">
                {t("settings")}
              </h2>

              <div>
                <label className="label">{t("albumTitle")}</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("description")}</label>
                <textarea
                  className="input min-h-[70px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("slug")}</label>
                <input
                  className="input"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">{t("selectionLimit")}</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  placeholder={t("unlimited")}
                  value={form.selection_limit}
                  onChange={(e) =>
                    setForm({ ...form, selection_limit: e.target.value })
                  }
                />
              </div>

              {canWatermark ? (
                <div className="rounded-md border border-ink-800 p-3">
                  <label className="flex items-center gap-2 text-sm text-accent">
                    <input
                      type="checkbox"
                      checked={form.watermark_enabled}
                      onChange={(e) =>
                        setForm({ ...form, watermark_enabled: e.target.checked })
                      }
                    />
                    {t("enableWatermark")}
                  </label>
                  {form.watermark_enabled && (
                    <input
                      className="input mt-3"
                      placeholder={t("watermarkText")}
                      value={form.watermark_text}
                      onChange={(e) =>
                        setForm({ ...form, watermark_text: e.target.value })
                      }
                    />
                  )}
                  <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
                    Bật watermark để chữ tự gắn lên ảnh khi khách xem (kể cả ảnh phóng to) — chống chụp màn hình.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-ink-800 p-3">
                  <p className="text-sm text-accent">{t("enableWatermark")}</p>
                  <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
                    Watermark có ở gói <strong>Photographer Plus</strong> và <strong>Studio</strong>.
                    Ảnh không watermark được tải thẳng từ Google Drive nên nhanh hơn và
                    không giới hạn lượt tải.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                <input
                  type="checkbox"
                  checked={form.download_enabled}
                  onChange={(e) => setForm({ ...form, download_enabled: e.target.checked })}
                />
                Cho phép khách tải ảnh xuống
              </label>

              {canDelivery && canWatermark && (
                <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                  <input
                    type="checkbox"
                    checked={form.watermark_delivery}
                    onChange={(e) => setForm({ ...form, watermark_delivery: e.target.checked })}
                  />
                  Watermark cả ở giai đoạn Giao khách
                </label>
              )}

              {/* "Show on homepage" only applies to the delivery phase. */}
              {phase === "delivery" && canPinHome && (
                <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                  <input
                    type="checkbox"
                    checked={form.gallery_pinned}
                    onChange={(e) => setForm({ ...form, gallery_pinned: e.target.checked })}
                  />
                  Hiện ở trang chủ công khai (khách xem không cần mật khẩu)
                </label>
              )}
              {phase === "delivery" && canDelivery && !canPinHome && (
                <Link href="/dashboard/upgrade" className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm" style={{ color: "var(--text3)" }}>
                  🔒 Hiện ở trang chủ công khai — nâng cấp gói Photographer/Studio
                </Link>
              )}

              <div>
                <label className="label">Loại album (phân loại)</label>
                <input
                  className="input"
                  list="album-category-presets"
                  placeholder="VD: Cưới, Sự kiện, Doanh nghiệp…"
                  value={form.category_label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setForm({ ...form, category_label: label, category: slugifyVi(label) });
                  }}
                />
                <datalist id="album-category-presets">
                  {/* Loại của CHÍNH studio đã dùng (ưu tiên), rồi tới gợi ý mẫu. */}
                  {studioCats.map((c) => (
                    <option key={`s-${c.slug}`} value={c.label} />
                  ))}
                  {CATEGORY_PRESETS.filter((p) => !studioCats.some((c) => c.slug === p.slug)).map((c) => (
                    <option key={`p-${c.slug}`} value={c.label} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-accent-muted">
                  Tự đặt loại theo ý bạn — loại mới sẽ tự lưu để chọn cho album khác.{" "}
                  <Link href="/dashboard/studio/album-categories" className="underline">Quản lý loại album</Link>
                </p>
              </div>

              <div>
                <label className="label">{t("status")}</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as Album["status"] })
                  }
                >
                  <option value="draft">{t("draft")}</option>
                  <option value="published">{t("published")}</option>
                </select>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="btn-primary w-full"
              >
                <Save size={15} /> {saving ? t("saving") : t("save")}
              </button>

              {/* Password */}
              <div className="rounded-md border border-ink-800 p-3">
                <label className="label">{t("albumPassword")}</label>
                <p className="mb-2 text-xs text-accent-muted">{t("passwordHint")}</p>
                <input
                  type="text"
                  className="input"
                  placeholder={hasPassword ? "•••••• (đã đặt)" : ""}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button onClick={savePassword} className="btn-ghost mt-3 w-full text-xs">
                  {hasPassword && !newPassword ? t("remove") : t("save")}
                </button>
              </div>
            </div>
            </>
          )}

          {/* Giao khách: đổi giai đoạn, link ảnh đã chỉnh, tải bản gốc */}
          {tab === "deliver" && (
            <>
            {/* Project phase: which set of photos the client link currently shows. */}
            <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={phase === "delivery"
                    ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                    : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                >
                  {phase === "delivery" ? <PackageCheck size={18} /> : <Images size={18} />}
                </span>
                <div>
                  <p className="text-sm font-medium text-accent">
                    Giai đoạn hiện tại: {phase === "delivery" ? "Giao khách (ảnh hoàn thiện)" : "Chọn ảnh (ảnh gốc)"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text3)" }}>
                    {phase === "delivery"
                      ? "Khách đang xem & tải ảnh hoàn thiện qua link dự án."
                      : "Khách đang chọn ảnh gốc qua link dự án."}
                  </p>
                </div>
              </div>
              {canDelivery ? (
                <button
                  onClick={() => switchPhase(phase === "delivery" ? "selection" : "delivery")}
                  disabled={phaseBusy}
                  className="btn-ghost whitespace-nowrap"
                >
                  {phase === "delivery" ? (
                    <><ArrowLeft size={15} /> Về giai đoạn Chọn ảnh</>
                  ) : (
                    <>Chuyển sang Giao khách <ArrowRight size={15} /></>
                  )}
                </button>
              ) : phase === "delivery" ? (
                // Stuck in delivery on a plan that no longer allows it — let them out.
                <button onClick={() => switchPhase("selection")} disabled={phaseBusy} className="btn-ghost whitespace-nowrap">
                  <ArrowLeft size={15} /> Về giai đoạn Chọn ảnh
                </button>
              ) : (
                <Link href="/dashboard/upgrade" className="btn-ghost whitespace-nowrap" title="Nâng cấp để dùng giao khách">
                  🔒 Giao khách (nâng cấp gói)
                </Link>
              )}
            </div>

            {/* Hạn lưu trữ ảnh gốc — chỉ có nghĩa sau khi đã giao khách.
                Hệ thống KHÔNG tự xoá gì: nó nhắc trước hạn, còn dọn Drive hay
                gia hạn là quyết định của studio. */}
            {album.delivered_at && (() => {
              const st = storageState(storageDate);
              const tone =
                st === "expired" ? { fg: "var(--s-red)", bg: "color-mix(in srgb, var(--s-red) 12%, transparent)" }
                : st === "warn" ? { fg: "var(--s-amber)", bg: "color-mix(in srgb, var(--s-amber) 12%, transparent)" }
                : { fg: "var(--text2)", bg: "var(--surface2)" };
              return (
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-accent">
                        <HardDrive size={16} /> Lưu trữ ảnh gốc trên Drive
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
                        Giao khách ngày {fmtDate(album.delivered_at.slice(0, 10))}
                        {storageDate ? ` · dự kiến dọn ảnh gốc ngày ${fmtDate(storageDate)}` : ""}
                      </p>
                    </div>
                    <span className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                      {storageLabel(storageDate)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11.5px]" style={{ color: "var(--text3)" }}>
                    mstudo không tự xoá ảnh. Tới hạn bạn sẽ được nhắc để tự dọn thư mục gốc trên Drive, hoặc gia hạn thêm.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {STORAGE_EXTEND_CHOICES.map((m) => (
                      <button key={m} onClick={() => extendStorage(m)} disabled={storageBusy} className="btn-ghost px-3 py-1.5 text-xs">
                        + {m} tháng
                      </button>
                    ))}
                    {storageDate && (
                      <button onClick={clearStorage} disabled={storageBusy} className="btn-ghost px-3 py-1.5 text-xs" style={{ color: "var(--text3)" }}>
                        Giữ vô thời hạn
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Delivery phase: studio pastes the EDITED-photos folder link. Those photos
                are what the client sees in the delivery gallery; the originals the client
                picked earlier auto-surface as the "File gốc" button (see getOriginalFolders). */}
            {phase === "delivery" && (
              <div className="card p-5">
                <label className="label">Link ảnh đã chỉnh sửa (hiện cho khách ở album giao)</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input flex-1"
                    placeholder="Dán link thư mục Google Drive ảnh đã chỉnh sửa…"
                    value={editedUrl}
                    onChange={(e) => setEditedUrl(e.target.value)}
                  />
                  <button
                    onClick={saveDeliveryLink}
                    disabled={deliveryBusy || syncing || !editedUrl.trim()}
                    className="btn-primary whitespace-nowrap"
                  >
                    {deliveryBusy ? "Đang lưu…" : "Lưu & đồng bộ"}
                  </button>
                </div>
                <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                  Ảnh trong thư mục này sẽ hiện ở album giao khách. Ảnh gốc khách đã chọn ở
                  giai đoạn trước tự thành nút <b>“Ảnh gốc”</b> để khách xem/tải trên
                  Drive. Thư mục cần chia sẻ ở chế độ “ai có link xem được”. Nếu thư mục
                  có <b>thư mục con</b>, mỗi thư mục con tự thành một mục riêng ở album giao khách.
                </p>

                {/* Thư mục con đã tách được — studio nhìn là biết album giao khách
                    đang chia thành mấy mục và mỗi mục bao nhiêu ảnh. */}
                {deliveryFolders.length > 1 && (
                  <div className="mt-3 rounded-[10px] p-3" style={{ background: "var(--sf2)" }}>
                    <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                      Thư mục giao khách đã tách riêng ({deliveryFolders.length})
                    </p>
                    <ul className="space-y-1">
                      {deliveryFolders.map((f) => (
                        <li key={f.id} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                          <FolderOpen size={13} className="flex-none" />
                          <span className="truncate">{f.name}</span>
                          <span className="flex-none font-semibold">
                            · {photos.filter((ph) => ph.source_id === f.id).length} ảnh
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nói thẳng nút "Tải file chỉnh sửa" bên album khách đã hiện chưa và
                    còn thiếu gì — ba điều kiện nằm ở ba màn hình khác nhau, không nói
                    ra thì studio không có cách nào đoán. */}
                {(() => {
                  const missing: string[] = [];
                  if (!sources.some((x) => x.stage === "delivery" && x.drive_url)) missing.push("chưa lưu link Drive giao khách ở trên");
                  if (!form.download_enabled) missing.push("đang tắt “Cho phép khách tải ảnh xuống”");
                  if (form.status !== "published") missing.push("album chưa xuất bản");
                  return (
                    <p
                      className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                      style={
                        missing.length
                          ? { background: "color-mix(in srgb, var(--s-amber) 12%, transparent)", color: "var(--s-amber)" }
                          : { background: "color-mix(in srgb, var(--s-green) 12%, transparent)", color: "var(--s-green)" }
                      }
                    >
                      {missing.length
                        ? `Nút “Tải file chỉnh sửa” CHƯA hiện với khách — ${missing.join("; ")}.`
                        : "Nút “Tải file chỉnh sửa” đang hiện ở đầu album giao khách."}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Delivery phase: download the finished album at ORIGINAL quality from Drive. */}
            {phase === "delivery" && deliveryFolders.length > 0 && (
              <div className="card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>
                    <HardDriveDownload size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-accent">Tải album gốc từ Drive</p>
                    <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
                      Tải toàn bộ ảnh giao khách ở chất lượng gốc (không nén, không watermark) trực tiếp
                      từ Google Drive — Google tự nén và phục vụ, không tốn băng thông máy chủ.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {deliveryFolders.map((s) => (
                        <a
                          key={s.id}
                          href={s.drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost"
                          title="Mở thư mục trên Google Drive để tải trực tiếp (không tốn băng thông máy chủ)"
                        >
                          <FolderOpen size={15} /> Mở thư mục Drive{deliveryFolders.length > 1 ? ` · ${s.name}` : ""}
                        </a>
                      ))}
                    </div>
                    {deliveryFolders.length > 0 && (
                      <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                        Mẹo: “Mở thư mục Drive” cho phép tải cả album trực tiếp từ Google (nhanh & không tốn băng thông máy chủ).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            </>
          )}

        </div>
      </div>
    </div>
  );
}
