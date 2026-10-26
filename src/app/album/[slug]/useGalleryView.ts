"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterByPerson, type PersonChip } from "@/lib/face-people";
import type { TienDoQuet } from "@/lib/face-pending";
import { studioUrl } from "@/lib/hosts";
import { fullImageUrl } from "@/lib/drive";
import { useFullImageWidth } from "@/lib/use-img-width";
import type { Feedback } from "@/lib/types";
import type { PrintState } from "@/lib/album-print-rules";
import { usePrintPicks } from "./PrintPicker";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM GIAO KHÁCH (/album/[slug]) — TOÀN BỘ LOGIC, dùng chung cho bản cũ
   (GalleryView.tsx) và bản giao diện mới (GalleryViewV2.tsx): mở khoá, nạp nền
   phần ảnh còn lại, chọn ảnh để chia sẻ, ảnh in tặng, lọc theo người / thư mục,
   khung xem ảnh, gửi cảm nhận. Chuyển nguyên văn từ GalleryView — hai bản chỉ
   khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Lang = "vi" | "en";
const TR = {
  vi: {
    enterPw: "Nhập mật khẩu để xem album",
    pwHint: "Mật khẩu là",
    pwHintBold: "số điện thoại",
    pwHintSuffix: "của bạn.",
    pwWrong: "Mật khẩu không đúng",
    pwOpening: "Đang mở…",
    pwEnter: "Vào xem",
    downloadAll: "Tải cả album",
    driveAlbum: "Tải album (Drive)",
    driveDownload: "Tải file chỉnh sửa",
    driveDownloadOne: "Tải file chỉnh sửa",
    dlPhoto: "Tải ảnh",
    download: "Tải ảnh",
    original: "Ảnh gốc",
    photoCount: "ảnh",
    tabAll: "Tất cả",
    viewAlbum: "Xem album",
    feedbackTitle: "Cảm nhận của bạn",
    fbThanks: "Cảm ơn bạn đã gửi cảm nhận!",
    fbPending: "Studio sẽ xem và đăng lên trang trong thời gian tới.",
    fbReply: "Studio trả lời",
    fbNamePh: "Tên của bạn",
    fbContentPh: "Chia sẻ cảm nhận của bạn về bộ ảnh…",
    fbSend: "Gửi cảm nhận",
    fbSending: "Đang gửi…",
    fbErr: "Không gửi được cảm nhận, vui lòng thử lại.",
    fbEmpty: "Chưa có cảm nhận nào.",
    fbGuest: "Khách",
  },
  en: {
    enterPw: "Enter password to view this album",
    pwHint: "Password is your",
    pwHintBold: "phone number",
    pwHintSuffix: ".",
    pwWrong: "Wrong password",
    pwOpening: "Opening…",
    pwEnter: "Enter",
    downloadAll: "Download album",
    driveAlbum: "Download album (Drive)",
    driveDownload: "Download edited files",
    driveDownloadOne: "Download edited files",
    dlPhoto: "Download",
    download: "Download photos",
    original: "Original files",
    photoCount: "photos",
    tabAll: "All",
    viewAlbum: "View album",
    feedbackTitle: "Your feedback",
    fbThanks: "Thank you for your feedback!",
    fbPending: "The studio will review it and publish it shortly.",
    fbReply: "Studio replied",
    fbNamePh: "Your name",
    fbContentPh: "Share your thoughts about this photo set…",
    fbSend: "Send feedback",
    fbSending: "Sending…",
    fbErr: "Couldn't send your feedback, please try again.",
    fbEmpty: "No feedback yet.",
    fbGuest: "Guest",
  },
} as const;

export interface GalleryPhoto { id: string; drive_file_id: string; name: string; source_id: string | null; position: number; is_video?: boolean; }

export const isVideo = (p: GalleryPhoto) => p.is_video || /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i.test(p.name);
export interface GallerySource { id: string; name: string; position: number; }
export interface GalleryDriveFolder { name: string; url: string; }
export interface GalleryInfo { id: string; slug: string; title: string; event_date: string | null; cover_url: string | null; hasPassword: boolean; allowDownload?: boolean; driveIsEdited?: boolean; watermark?: string | null; }

export type GalleryViewProps = {
  gallery: GalleryInfo;
  initialPhotos: GalleryPhoto[] | null;
  /** Khuôn mặt máy chủ đã gom sẵn — khách bấm để lọc, không tải mô hình nào. */
  initialPeople?: PersonChip[];
  /**
   * Tiến độ quét khuôn mặt của máy chủ (xem @/lib/face-pending), hoặc null khi
   * không có gì đang chạy — kể cả khi gói của studio không mở tính năng này.
   */
  faceScan?: TienDoQuet | null;
  totalPhotos?: number | null;
  initialSources: GallerySource[] | null;
  initialDriveFolders?: GalleryDriveFolder[];
  initialOriginalFolders?: GalleryDriveFolder[];
  feedback: Feedback[];
  shareIds?: string[] | null;
  studioName?: string;
  logoUrl?: string | null;
  /** Domain riêng của studio — link chia sẻ phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
  /** Ảnh in tặng của hợp đồng (null = hợp đồng không tặng in). */
  print?: PrintState | null;
};

export type GallerySection = { id: string; name: string; items: { p: GalleryPhoto; i: number }[]; ids: string[] };

export function useGalleryView({
  gallery, initialPhotos, initialPeople, faceScan = null, totalPhotos = null, initialSources, initialDriveFolders = [], initialOriginalFolders = [], feedback, shareIds, studioHost = null, print = null,
}: GalleryViewProps) {
  const wm = gallery.watermark || null;
  const [unlocked, setUnlocked] = useState(!gallery.hasPassword);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos ?? []);
  const [people, setPeople] = useState<PersonChip[]>(initialPeople ?? []);
  /** Khuôn mặt đang lọc. null = xem cả album. */
  const [personId, setPersonId] = useState<string | null>(null);
  const [sources, setSources] = useState<GallerySource[]>(initialSources ?? []);
  const [driveFolders, setDriveFolders] = useState<GalleryDriveFolder[]>(initialDriveFolders);
  // Link Drive file gốc ở giai đoạn chọn ảnh (JPG Goc) — hiện trong album hoàn thiện.
  const [originalFolders, setOriginalFolders] = useState<GalleryDriveFolder[]>(initialOriginalFolders);
  const allowDownload = gallery.allowDownload !== false;
  const [password, setPassword] = useState("");
  // Album có mật khẩu: cờ "máy chủ đang quét khuôn mặt" đến cùng lượt mở khoá.
  const [scan, setScan] = useState<TienDoQuet | null>(faceScan);
  const [pwError, setPwError] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  // Vé mở khoá (album có mật khẩu) — đính vào lượt gửi ảnh in.
  const [access, setAccess] = useState<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState("all");
  // Nút "Xem album" ở ảnh bìa cuộn thẳng xuống lưới ảnh.
  const photosRef = useRef<HTMLDivElement | null>(null);
  // Thẻ "Bạn được tặng N ảnh in" — xem scrollToPhotos bên dưới.
  const printCardRef = useRef<HTMLDivElement | null>(null);
  const [lbIdx, setLbIdx] = useState<number | null>(null);

  // Client-side photo selection → build a "share only these" link.
  const shareMode = shareIds != null && shareIds.length > 0;
  const shareSet = useMemo(() => (shareIds ? new Set(shareIds) : null), [shareIds]);
  // Ảnh in tặng — không có ở link chia sẻ chọn lọc (người nhận link không phải khách).
  const pp = usePrintPicks(gallery.slug, shareMode ? null : print, access);
  const printing = pp.enabled && pp.mode;
  // Nút "Xem album" ở ảnh bìa: khách còn chưa gửi ảnh in thì dừng ở thẻ chọn ảnh
  // in (nằm ngay trên lưới) — cuộn thẳng xuống lưới là khách lướt qua thẻ đó.
  const scrollToPhotos = () => {
    const target = pp.needsAction && printCardRef.current ? printCardRef.current : photosRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Nạp nền phần ảnh CÒN LẠI: SSR chỉ gửi lô đầu để HTML nhẹ + nhanh; số còn lại
  // lấy qua API có CDN cache. Bỏ qua khi có mật khẩu (access route trả đủ sau khi
  // mở khoá) hoặc chế độ share (đã gửi đủ ảnh cần thiết).
  useEffect(() => {
    if (gallery.hasPassword || shareMode || totalPhotos == null) return;
    if (photos.length >= totalPhotos) return;
    const total: number = totalPhotos;
    let cancelled = false;
    (async () => {
      // Lặp qua nhiều trang: API giới hạn limit ≤ 2000/lần nên album lớn cần vài
      // lượt. Dừng khi đủ tổng, trang rỗng, hoặc chạm mốc an toàn.
      let offset = photos.length;
      for (let guard = 0; !cancelled && offset < total && guard < 50; guard++) {
        let more: GalleryPhoto[] = [];
        try {
          const res = await fetch(`/api/album/${gallery.slug}/photos?offset=${offset}&limit=${Math.min(2000, total - offset)}`);
          if (!res.ok) return;
          more = (await res.json()).photos ?? [];
        } catch { return; /* giữ những gì đã có nếu mạng lỗi */ }
        if (cancelled || more.length === 0) return;
        // Album 2–3 nghìn ảnh: gắn thêm một lô vào danh sách bắt React tính lại
        // cả lưới. startTransition để việc đó nhường chỗ cho thao tác của khách
        // (cuộn, bấm tim, mở ảnh) thay vì khoá luồng chính giữa chừng.
        startTransition(() => {
          setPhotos((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...more.filter((p) => !seen.has(p.id))];
          });
        });
        offset += more.length;
      }
    })();
    return () => { cancelled = true; };
    // Chạy một lần sau khi mount cho album hiện tại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery.slug]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function shareSelected() {
    if (selected.size === 0 || shareBusy) return;
    setShareBusy(true);
    const base = studioUrl(studioHost, `/album/${gallery.slug}`);
    const abs = /^https?:\/\//i.test(base) ? base : `${window.location.origin}${base}`;
    try {
      // Store the picks server-side and use a short ?s=token link.
      const res = await fetch(`/api/album/${gallery.slug}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: [...selected] }),
      });
      if (res.ok) {
        const { token } = await res.json();
        setShareUrl(`${abs}?s=${token}`);
      } else {
        setShareUrl(`${abs}?share=${[...selected].join(",")}`); // fallback
      }
    } catch {
      setShareUrl(`${abs}?share=${[...selected].join(",")}`); // offline fallback
    }
    setShareBusy(false);
  }

  // Album khách chốt tiếng Việt: nút VI/EN nằm trong hàng nút đầu trang, thêm
  // vào là hàng đó tràn và vỡ bố cục trên điện thoại. Bộ chữ TR.en giữ lại
  // nguyên trong file để bật lại được khi cần.
  const lang: Lang = "vi";
  const tr = TR[lang];

  // feedback form
  const [fbName, setFbName] = useState("");
  const [fbRating, setFbRating] = useState(5);
  const [fbContent, setFbContent] = useState("");
  const [fbList] = useState<Feedback[]>(feedback);
  const [fbSent, setFbSent] = useState(false);
  const [fbCaptcha, setFbCaptcha] = useState<string | null>(null);
  const [fbSending, setFbSending] = useState(false);
  const [fbErr, setFbErr] = useState(false);
  const onFbCaptcha = useCallback((t: string) => setFbCaptcha(t), []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true); setPwError(false);
    const res = await fetch(`/api/album/${gallery.slug}/access`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setPwLoading(false);
    if (!res.ok) return setPwError(true);
    const data = await res.json();
    setPhotos(data.photos ?? []); setSources(data.sources ?? []);
    setDriveFolders(data.driveFolders ?? []);
    setOriginalFolders(data.originalFolders ?? []);
    setPeople(data.people ?? []);
    setScan((data.faceScan ?? null) as TienDoQuet | null);
    setAccess(typeof data.access === "string" ? data.access : undefined);
    setUnlocked(true);
  }

  // Danh sách thư mục cho nút "Tải ảnh": file đã chỉnh sửa trước (thứ khách vào
  // album để lấy), rồi tới ảnh gốc giai đoạn chọn ảnh. Tên từng dòng nói rõ
  // đang tải gì, vì giờ cả hai nằm chung một menu.
  const downloadFolders = useMemo(() => {
    const edited = allowDownload
      ? driveFolders.map((f) => ({
          ...f,
          name: gallery.driveIsEdited
            ? `${tr.driveDownloadOne}${driveFolders.length > 1 && f.name ? ` · ${f.name}` : ""}`
            : f.name || tr.driveAlbum,
        }))
      : [];
    const originals = originalFolders.map((f) => ({
      ...f,
      name: `${tr.original}${originalFolders.length > 1 && f.name ? ` · ${f.name}` : ""}`,
    }));
    return [...edited, ...originals];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveFolders, originalFolders, allowDownload, gallery.driveIsEdited]);

  const tabSources = useMemo(() => sources.filter((s) => photos.some((p) => p.source_id === s.id)), [sources, photos]);
  const activePerson = useMemo(() => people.find((p) => p.id === personId) ?? null, [people, personId]);
  /** id ảnh → id file Drive, để ảnh thẻ khuôn mặt không phải quét mảng mỗi lần vẽ. */
  const driveIdOf = useMemo(() => new Map(photos.map((p) => [p.id, p.drive_file_id])), [photos]);
  // Cỡ ảnh lớn theo màn hình thật (xem @/lib/use-img-width).
  const fullW = useFullImageWidth();
  const visible = useMemo(() => {
    let base = activeTab === "all" ? photos : photos.filter((p) => p.source_id === activeTab);
    if (shareSet) base = base.filter((p) => shareSet.has(p.id));
    if (printing && pp.onlyPicked) base = base.filter((p) => pp.picks.has(p.id));
    // Lọc theo khuôn mặt SAU cùng: nó là câu hỏi "cho tôi xem ảnh của mẹ tôi",
    // còn tab nguồn và chế độ chia sẻ là phạm vi đang xem.
    return filterByPerson(base, activePerson);
  }, [photos, activeTab, shareSet, activePerson, printing, pp.onlyPicked, pp.picks]);
  const sections = useMemo((): GallerySection[] => {
    const idx = visible.map((p, i) => ({ p, i }));
    const keo = (id: string, name: string, items: { p: GalleryPhoto; i: number }[]) => ({ id, name, items, ids: items.map((x) => x.p.id) });
    if (activeTab !== "all" || tabSources.length <= 1) return [keo("all", "", idx)];
    const m = new Map<string, { p: GalleryPhoto; i: number }[]>();
    idx.forEach((it) => { const k = it.p.source_id ?? "none"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(it); });
    const out: GallerySection[] = [];
    for (const s of sources) if (m.has(s.id)) { out.push(keo(s.id, s.name, m.get(s.id)!)); m.delete(s.id); }
    for (const [k, items] of m) out.push(keo(k, "", items));
    return out;
  }, [visible, sources, tabSources.length, activeTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lbIdx === null) return;
      if (e.key === "ArrowRight") setLbIdx((i) => (i === null ? i : Math.min(visible.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLbIdx((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") setLbIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIdx, visible.length]);

  // Preload neighbouring full images so prev/next feels instant.
  useEffect(() => {
    if (lbIdx === null) return;
    for (const off of [1, -1, 2, -2]) {
      const p = visible[lbIdx + off];
      if (p && !isVideo(p)) { const im = new Image(); im.src = fullImageUrl(p.drive_file_id, fullW); }
    }
  }, [lbIdx, visible, fullW]);

  function go(delta: number) {
    setLbIdx((i) => (i === null ? i : Math.max(0, Math.min(visible.length - 1, i + delta))));
  }

  async function sendFeedback() {
    // Chốt chống bấm nhiều lần: mạng chậm thì trước đây khách bấm lại được và gửi
    // trùng. `fbSending` khoá nút trong lúc đang bay.
    if (!fbContent.trim() || !fbCaptcha || fbSending) return;
    setFbSending(true);
    setFbErr(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: gallery.id, clientName: fbName, rating: fbRating, content: fbContent, captcha: fbCaptcha }),
      });
      if (res.ok) {
        setFbSent(true);
        // KHÔNG chèn cảm nhận vừa gửi vào danh sách bên cạnh nữa. Danh sách đó là
        // những cảm nhận studio ĐÃ DUYỆT cho hiện; cảm nhận mới vào ở trạng thái
        // chờ duyệt, nên chèn vào là nói với khách một điều không đúng ("đã đăng")
        // rồi tải lại trang là nó biến mất. Lời cảm ơn nói rõ là còn chờ duyệt.
        setFbContent(""); setFbName("");
      } else {
        // Trước đây thất bại thì im lặng — khách không biết đã gửi được chưa.
        setFbErr(true);
      }
    } catch {
      setFbErr(true);
    } finally {
      setFbSending(false);
    }
  }

  return {
    tr,
    wm,
    // mở khoá
    unlocked,
    password,
    setPassword,
    pwError,
    pwLoading,
    unlock,
    // dữ liệu
    photos,
    sources,
    tabSources,
    people,
    scan,
    personId,
    setPersonId,
    activePerson,
    driveIdOf,
    allowDownload,
    downloadFolders,
    // xem / lọc
    activeTab,
    setActiveTab,
    visible,
    sections,
    photosRef,
    printCardRef,
    scrollToPhotos,
    // chia sẻ
    shareMode,
    shareSet,
    selected,
    setSelected,
    toggleSelect,
    shareUrl,
    setShareUrl,
    shareBusy,
    shareSelected,
    // ảnh in
    pp,
    printing,
    // khung xem
    lbIdx,
    setLbIdx,
    go,
    fullW,
    // cảm nhận
    fbName,
    setFbName,
    fbRating,
    setFbRating,
    fbContent,
    setFbContent,
    fbList,
    fbSent,
    fbCaptcha,
    setFbCaptcha,
    fbSending,
    fbErr,
    onFbCaptcha,
    sendFeedback,
  };
}

export type GalleryViewState = ReturnType<typeof useGalleryView>;
