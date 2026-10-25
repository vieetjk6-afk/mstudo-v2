"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { isDeliveryPhase } from "@/lib/album-phase";
import { studioUrl } from "@/lib/hosts";
import { thumbnailUrl, isFolderLink, stripExtension } from "@/lib/drive";
import { fetchAllPhotos } from "@/lib/photos";
import { storageUntil } from "@/lib/storage-lifecycle";
import type { AlbumPrintInfo } from "./AlbumPrintPanel";
import type { Album, AlbumSource, Photo, SourceKind, AlbumPhase, SourceStage } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn album (bản cũ AlbumEditor và bản mới
   AlbumEditorV2): form cài đặt, giai đoạn chọn/giao, nguồn Drive + đồng bộ,
   ảnh bìa, xoá ảnh, lượt khách chọn, hạn lưu trữ, album song sinh của hợp
   đồng. Hai bản chỉ khác nhau ở cách vẽ — mọi truy vấn nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

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

/** Một link "chia sẻ ảnh đã chọn" khách tạo cho người khác xem (bảng album_shares). */
export type CustomerShare = {
  token: string;
  /** id ảnh (photos.id) — link rất cũ có thể lưu drive_file_id. */
  photoIds: string[];
  createdAt: string;
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

/** Hợp đồng gắn album này (để hiện thẻ "Album của hợp đồng …"). */
export type LinkedContractInfo = {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  /** Chế độ album của hợp đồng (@/lib/album-mode) — null = hợp đồng cũ. */
  albumMode: "desktop" | "manual" | null;
  /** Album này là album của hợp đồng (selection_album_id), không phải album giao riêng. */
  isSelectionAlbum: boolean;
};

/** Prop của màn album — page.tsx dựng, bản cũ và bản mới nhận y hệt. */
export type AlbumEditorProps = {
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
  /** Tên bạn Zalo đã nhớ (album, hoặc hợp đồng gắn album) — nút "Gửi Zalo cho <tên>". */
  zaloSavedName?: string | null;
  /** Ảnh khách đã bấm chọn (bảng selections), gộp theo mã chọn ở ngay màn này. */
  selections?: AlbumPick[];
  /** Chính sách lưu trữ ảnh gốc của studio (tháng). 0 = giữ vô hạn. */
  storageMonths?: number;
  /** Album giao khách của cùng hợp đồng (nếu album này là album chọn ảnh). */
  deliveryTwin?: DeliveryTwin | null;
  linkedContract?: LinkedContractInfo | null;
  /** Ảnh in tặng khách đã gửi (null = hợp đồng không tặng in). */
  printInfo?: AlbumPrintInfo | null;
  /** Link khách tự tạo để chia sẻ một nhóm ảnh cho người khác xem. */
  customerShares?: CustomerShare[];
  /** ?tab=… trên URL (vd thông báo "khách chọn ảnh in" mở thẳng tab Giao khách). */
  initialTab?: string;
};

/** Đầu vào của hook: prop đã điền giá trị mặc định ở component. */
type EditorInput = {
  album: Album;
  initialSources: AlbumSource[];
  initialPhotos: Photo[];
  canDelivery: boolean;
  canPinHome: boolean;
  canWatermark: boolean;
  studioName: string;
  studioHost: string | null;
  selections: AlbumPick[];
  storageMonths: number;
  deliveryTwin: DeliveryTwin | null;
  linkedContract: LinkedContractInfo | null;
};

function formOf(album: Album, studioName: string) {
  return {
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
  };
}
export type AlbumForm = ReturnType<typeof formOf>;

/** So form với bản đã lưu — ô số nhập "12" và giá trị 12 coi là một. */
function sameForm(a: AlbumForm, b: AlbumForm) {
  return (Object.keys(a) as (keyof AlbumForm)[]).every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
}

export function useAlbumEditor({
  album,
  initialSources,
  initialPhotos,
  canDelivery,
  canPinHome,
  canWatermark,
  studioName,
  studioHost,
  selections,
  storageMonths,
  deliveryTwin,
  linkedContract,
}: EditorInput) {
  const { t } = useLang();
  const supabase = createClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  // Tab "Lượt chọn": lọc theo mã chọn (session) và theo "chỉ ảnh có ghi chú".
  const [pickSession, setPickSession] = useState<string>("all");
  const [notesOnly, setNotesOnly] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

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

  const [form, setForm] = useState(() => formOf(album, studioName));
  // Bản đã lưu gần nhất — giao diện mới dùng để biết còn thay đổi chưa lưu.
  const [savedForm, setSavedForm] = useState(() => formOf(album, studioName));
  const dirty = !sameForm(form, savedForm);
  const resetForm = () => setForm(savedForm);
  const [hasPassword, setHasPassword] = useState(!!album.password_hash);
  const [newPassword, setNewPassword] = useState("");

  // Cùng luật với trang khách: album đời đầu chỉ có cờ `is_gallery` (phase còn
  // null) mà màn này ghi "Chọn ảnh" thì studio thấy một đằng, khách thấy một nẻo.
  const [phase, setPhase] = useState<AlbumPhase>(isDeliveryPhase(album) ? "delivery" : "selection");
  const [phaseBusy, setPhaseBusy] = useState(false);
  // Album của hợp đồng "Nhập link ảnh riêng" (@/lib/album-mode).
  const manualContract = !!linkedContract && linkedContract.albumMode === "manual" && linkedContract.isSelectionAlbum;
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
    else {
      setSavedForm(form);
      flash(t("saved"));
    }
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

  async function addSource(e?: React.FormEvent) {
    e?.preventDefault();
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
    // Ảnh bìa lưu NGAY (không chờ nút Lưu) nên bản đã lưu cũng đổi theo.
    setSavedForm((f) => ({ ...f, cover_url: url }));
    await supabase.from("albums").update({ cover_url: url }).eq("id", album.id);
    flash(t("saved"));
  }

  async function removePhoto(id: string) {
    await supabase.from("photos").delete().eq("id", id);
    setPhotos(photos.filter((p) => p.id !== id));
  }

  const clientLink = studioUrl(studioHost, `/a/${form.slug}`);

  /** Nút "Tải file chỉnh sửa" bên album khách còn thiếu điều kiện nào. */
  const deliveryMissing: string[] = [];
  if (!sources.some((x) => x.stage === "delivery" && x.drive_url)) deliveryMissing.push("chưa lưu link Drive giao khách ở trên");
  if (!form.download_enabled) deliveryMissing.push("đang tắt “Cho phép khách tải ảnh xuống”");
  if (form.status !== "published") deliveryMissing.push("album chưa xuất bản");

  return {
    t,
    deleting, deleteAlbum,
    form, setForm, savedForm, dirty, resetForm, saving, saveSettings,
    hasPassword, newPassword, setNewPassword, savePassword,
    phase, phaseBusy, switchPhase, manualContract,
    twinTakesOver, twinBusy, twinBackToSelection,
    storageDate, storageBusy, extendStorage, clearStorage,
    sources, photos, newSource, setNewSource, addSource, removeSource, sync, syncing,
    editedUrl, setEditedUrl, deliveryBusy, saveDeliveryLink, deliveryMissing,
    msg, flash,
    deliveryCount, selectionCount, photoGroups, splitBySource, deliveryFolders,
    photoById, pickSessions, pickSession, setPickSession, notesOnly, setNotesOnly,
    visiblePicks, pickedIds, notedCount, copiedList, copyPickList, exportPickList,
    setCover, removePhoto, clientLink,
  };
}

/** Toàn bộ trạng thái + thao tác của màn album — truyền xuống các tab của bản mới. */
export type AlbumEditorState = ReturnType<typeof useAlbumEditor>;
