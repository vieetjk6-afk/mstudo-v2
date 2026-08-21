"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

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
    fbNamePh: "Tên của bạn",
    fbContentPh: "Chia sẻ cảm nhận của bạn về bộ ảnh…",
    fbSend: "Gửi cảm nhận",
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
    fbNamePh: "Your name",
    fbContentPh: "Share your thoughts about this photo set…",
    fbSend: "Send feedback",
    fbEmpty: "No feedback yet.",
    fbGuest: "Guest",
  },
} as const;
import {
  Lock, ChevronLeft, ChevronRight, ChevronDown, X, Download, Calendar, Star, Send, Check, Play, Heart, Share2, ExternalLink,
} from "lucide-react";
import DriveFolderLinks from "@/components/DriveFolderLinks";
import StudioBrand from "@/components/StudioBrand";
import Turnstile from "@/components/Turnstile";
import ShareButton from "@/components/ShareButton";
import ShareDialog from "@/components/ShareDialog";
import { studioUrl } from "@/lib/hosts";
import { thumbnailUrl, fullImageUrl } from "@/lib/drive";
import { downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { ALBUM_TITLE_FONT } from "@/lib/album-title";
import AlbumCover from "@/components/AlbumCover";
import type { Feedback } from "@/lib/types";

interface P { id: string; drive_file_id: string; name: string; source_id: string | null; position: number; is_video?: boolean; }

const isVideo = (p: P) => p.is_video || /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i.test(p.name);
interface S { id: string; name: string; position: number; }
interface DriveFolder { name: string; url: string; }
interface G { id: string; slug: string; title: string; event_date: string | null; cover_url: string | null; hasPassword: boolean; allowDownload?: boolean; driveIsEdited?: boolean; watermark?: string | null; }

export default function GalleryView({
  gallery, initialPhotos, totalPhotos = null, initialSources, initialDriveFolders = [], initialOriginalFolders = [], feedback, shareIds, studioName = "Studio", logoUrl = null, studioHost = null,
}: {
  gallery: G;
  initialPhotos: P[] | null;
  totalPhotos?: number | null;
  initialSources: S[] | null;
  initialDriveFolders?: DriveFolder[];
  initialOriginalFolders?: DriveFolder[];
  feedback: Feedback[];
  shareIds?: string[] | null;
  studioName?: string;
  logoUrl?: string | null;
  /** Domain riêng của studio — link chia sẻ phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
}) {
  const wm = gallery.watermark || null;
  const [unlocked, setUnlocked] = useState(!gallery.hasPassword);
  const [photos, setPhotos] = useState<P[]>(initialPhotos ?? []);
  const [sources, setSources] = useState<S[]>(initialSources ?? []);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>(initialDriveFolders);
  // Link Drive file gốc ở giai đoạn chọn ảnh (JPG Goc) — hiện trong album hoàn thiện.
  const [originalFolders, setOriginalFolders] = useState<DriveFolder[]>(initialOriginalFolders);
  const allowDownload = gallery.allowDownload !== false;
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("all");
  // Lưới ảnh: 2 cột trên điện thoại, 4 cột trên máy tính, đặt ảnh trái → phải.
  const masonry = useMasonry(2, 4);
  // Nút "Xem album" ở ảnh bìa cuộn thẳng xuống lưới ảnh.
  const photosRef = useRef<HTMLDivElement | null>(null);
  const scrollToPhotos = useCallback(() => {
    photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);

  // Client-side photo selection → build a "share only these" link.
  const shareMode = shareIds != null && shareIds.length > 0;
  const shareSet = useMemo(() => (shareIds ? new Set(shareIds) : null), [shareIds]);

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
        let more: P[] = [];
        try {
          const res = await fetch(`/api/album/${gallery.slug}/photos?offset=${offset}&limit=${Math.min(2000, total - offset)}`);
          if (!res.ok) return;
          more = (await res.json()).photos ?? [];
        } catch { return; /* giữ những gì đã có nếu mạng lỗi */ }
        if (cancelled || more.length === 0) return;
        setPhotos((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
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
  const [fbList, setFbList] = useState<Feedback[]>(feedback);
  const [fbSent, setFbSent] = useState(false);
  const [fbCaptcha, setFbCaptcha] = useState<string | null>(null);
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
  const visible = useMemo(() => {
    let base = activeTab === "all" ? photos : photos.filter((p) => p.source_id === activeTab);
    if (shareSet) base = base.filter((p) => shareSet.has(p.id));
    return base;
  }, [photos, activeTab, shareSet]);
  const sections = useMemo(() => {
    const idx = visible.map((p, i) => ({ p, i }));
    if (activeTab !== "all" || tabSources.length <= 1) return [{ id: "all", name: "", items: idx }];
    const m = new Map<string, { p: P; i: number }[]>();
    idx.forEach((it) => { const k = it.p.source_id ?? "none"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(it); });
    const out: { id: string; name: string; items: { p: P; i: number }[] }[] = [];
    for (const s of sources) if (m.has(s.id)) { out.push({ id: s.id, name: s.name, items: m.get(s.id)! }); m.delete(s.id); }
    for (const [k, items] of m) out.push({ id: k, name: "", items });
    return out;
  }, [visible, sources, tabSources.length, activeTab]);

  // Tải lũy tiến: album cưới thường 1500–3000 ảnh; mount tất cả cùng lúc làm
  // nặng hydration + hàng nghìn DOM node. Chỉ dựng một "cửa sổ" ảnh và tăng dần
  // khi cuộn tới đáy. Chỉ số `i` vẫn theo `visible` nên lightbox/chọn ảnh/điều
  // hướng phím KHÔNG đổi — chỉ ít node hơn được render tại một thời điểm.
  const RENDER_BATCH = 250;
  const [renderLimit, setRenderLimit] = useState(RENDER_BATCH);
  useEffect(() => { setRenderLimit(RENDER_BATCH); }, [activeTab, shareSet, photos]);
  // Dùng CALLBACK REF (không phải effect theo visible.length): quan sát lại mỗi khi
  // sentinel gắn/mount lại — kể cả khi đổi sang tab CÙNG SỐ ẢNH (renderLimit reset
  // làm sentinel mount lại nhưng visible.length không đổi → effect cũ không chạy lại).
  const ioRef = useRef<IntersectionObserver | null>(null);
  const visibleCountRef = useRef(visible.length);
  visibleCountRef.current = visible.length;
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    ioRef.current?.disconnect();
    if (!node) return;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRenderLimit((n) => (n < visibleCountRef.current ? n + RENDER_BATCH : n));
        }
      },
      { rootMargin: "800px 0px" }
    );
    ioRef.current.observe(node);
  }, []);

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
      if (p && !isVideo(p)) { const im = new Image(); im.src = fullImageUrl(p.drive_file_id, 1600); }
    }
  }, [lbIdx, visible]);

  function go(delta: number) {
    setLbIdx((i) => (i === null ? i : Math.max(0, Math.min(visible.length - 1, i + delta))));
  }
  function onSwipeDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    swipe.current = { x: e.clientX, y: e.clientY };
  }
  function onSwipeMove(e: React.PointerEvent) {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setSwipeDx(dx);
  }
  function onSwipeUp() {
    if (!swipe.current) return;
    const dx = swipeDx;
    swipe.current = null;
    setSwipeDx(0);
    if (dx <= -50) go(1);
    else if (dx >= 50) go(-1);
  }


  async function sendFeedback() {
    if (!fbContent.trim() || !fbCaptcha) return;
    const res = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: gallery.id, clientName: fbName, rating: fbRating, content: fbContent, captcha: fbCaptcha }),
    });
    if (res.ok) {
      setFbSent(true);
      setFbList([{ id: Math.random().toString(), album_id: gallery.id, client_name: fbName || null, rating: fbRating, content: fbContent, approved: true, created_at: new Date().toISOString() }, ...fbList]);
      setFbContent(""); setFbName("");
    }
  }

  // ── Password gate ──
  if (!unlocked) {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10"><StudioBrand name={studioName} logoUrl={logoUrl} /></header>
        <div className="flex flex-1 items-center justify-center px-6">
          <form onSubmit={unlock} className="card w-full max-w-sm p-8 text-center">
            <Lock className="mx-auto mb-4" size={26} style={{ color: "var(--gold)" }} />
            <h1 className="font-serif text-2xl font-medium">{gallery.title}</h1>
            <p className="mb-1 mt-2 text-sm" style={{ color: "var(--text2)" }}>{tr.enterPw}</p>
            <p className="mb-6 text-[12.5px]" style={{ color: "var(--gold)" }}>{tr.pwHint} <b>{tr.pwHintBold}</b>{tr.pwHintSuffix}</p>
            <input type="text" inputMode="numeric" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="input mb-4 text-center" placeholder="09xx xxx xxx" />
            {pwError && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{tr.pwWrong}</p>}
            <button disabled={pwLoading} className="btn-primary w-full">{pwLoading ? tr.pwOpening : tr.pwEnter}</button>
          </form>
        </div>
      </main>
    );
  }

  const lb = lbIdx !== null ? visible[lbIdx] : null;

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5 md:px-10" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <StudioBrand name={studioName} logoUrl={logoUrl} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!shareMode && selected.size > 0 && (
            <button onClick={shareSelected} disabled={shareBusy} className="btn-primary px-3 py-1.5 text-[13px]">
              <Share2 size={14} />
              {shareBusy ? "Đang tạo link…" : `Chia sẻ ${selected.size} ảnh đã chọn`}
            </button>
          )}
          {/* Nút chính của album giao khách: mở thẳng thư mục FILE CHỈNH SỬA trên
              Drive (nguồn giai đoạn "delivery", AlbumEditor đặt tên "File ChinhSua").
              Google tự nén và phục vụ nên không tốn byte nào của Vercel/Supabase.
              Ẩn ở chế độ chia sẻ chọn lọc vì link Drive trỏ CẢ thư mục → sẽ lộ
              toàn album chứ không riêng mấy ảnh được chia sẻ. */}
          {/* MỘT nút "Tải ảnh" duy nhất: bên trong gộp cả file đã chỉnh sửa
              (thư mục giao khách) lẫn ảnh gốc giai đoạn chọn ảnh. Trước đây là
              hai nút riêng nằm cạnh nhau, khách phải tự đoán nút nào là nút
              mình cần. Ẩn thư mục giao khách ở chế độ chia sẻ chọn lọc vì link
              Drive mở CẢ thư mục → sẽ lộ toàn album. */}
          {!shareMode && downloadFolders.length > 0 && (
            <DriveDownload folders={downloadFolders} label={tr.download} labelOne={tr.download} accent />
          )}
          {!shareMode && <ShareButton path={studioUrl(studioHost, `/album/${gallery.slug}`)} title={gallery.title} className="btn-ghost px-3 py-1.5 text-[13px]" />}
        </div>
      </header>

      {/* Ảnh bìa chiếm trọn màn hình, tên album ở giữa, nút "Xem album" ngay
          dưới — xem src/components/AlbumCover.tsx. */}
      {gallery.cover_url && (
        <AlbumCover
          url={gallery.cover_url}
          title={gallery.title}
          note={gallery.event_date ? new Date(gallery.event_date).toLocaleDateString("vi-VN") : null}
          buttonLabel={tr.viewAlbum}
          onView={scrollToPhotos}
        />
      )}

      <div className="mx-auto max-w-[1800px] px-4 md:px-6" style={{ marginTop: gallery.cover_url ? "24px" : "28px", position: "relative" }}>
        {!gallery.cover_url && (
          <h1 className="text-[clamp(34px,6vw,64px)] leading-[1.06]" style={ALBUM_TITLE_FONT}>{gallery.title}</h1>
        )}
        <p className="mt-2 flex items-center gap-3 text-[13.5px]" style={{ color: "var(--text2)" }}>
          {gallery.event_date && !gallery.cover_url && (<span className="flex items-center gap-1"><Calendar size={13} /> {new Date(gallery.event_date).toLocaleDateString("vi-VN")}</span>)}
          <span>{shareMode ? visible.length : (totalPhotos ?? photos.length)} {tr.photoCount}</span>
        </p>
        {shareMode ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--gold)" }}>
            <Share2 size={14} /> {shareIds!.length} ảnh được chia sẻ
          </div>
        ) : null}

        {/* tabs */}
        {tabSources.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Tab active={activeTab === "all"} onClick={() => setActiveTab("all")}>{tr.tabAll}</Tab>
            {tabSources.map((s) => (<Tab key={s.id} active={activeTab === s.id} onClick={() => setActiveTab(s.id)}>{s.name} <span className="opacity-60">{photos.filter((p) => p.source_id === s.id).length}</span></Tab>))}
          </div>
        )}

        {/* sections — mỗi thư mục con là một mục riêng, có tiêu đề + số ảnh */}
        <div
          ref={(el) => { photosRef.current = el; masonry.ref(el); }}
          className="mt-7 space-y-9 scroll-mt-20"
        >
          {sections.map((sec) => {
            // Chỉ dựng các ảnh nằm trong cửa sổ hiện tại (i < renderLimit).
            const items = sec.items.filter((it) => it.i < renderLimit);
            if (items.length === 0) return null;
            return (
            <section key={sec.id}>
              {sec.name && (
                <h2 className="mb-3 font-serif text-xl font-medium">
                  {sec.name}
                  <span className="ml-2 text-[13px] font-normal" style={{ color: "var(--text3)" }}>· {sec.items.length} {tr.photoCount}</span>
                </h2>
              )}
              {/* Lưới ảnh kiểu collage: 2 cột trên điện thoại, 4 cột trên máy tính,
                  khe gần như bằng 0, KHÔNG bo góc và KHÔNG cắt ảnh — mỗi tấm giữ
                  đúng tỉ lệ gốc, và ảnh được đặt lần lượt TRÁI → PHẢI
                  (xem src/lib/masonry.ts). */}
              <div className="grid grid-cols-2 md:grid-cols-4" style={masonry.gridStyle}>
                {items.map(({ p, i }) => {
                  const isSel = selected.has(p.id);
                  return (
                  <div key={p.id} className="group relative cursor-pointer overflow-hidden" style={{ background: "var(--surface)", ...masonry.tileStyle(p.id) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img {...masonry.imgProps(p.id)} onClick={() => setLbIdx(i)} role="button" tabIndex={0} aria-label={`Xem ${p.name}`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLbIdx(i); } }} src={thumbnailUrl(p.drive_file_id, 400)} alt={p.name} loading="lazy" decoding="async" draggable={false} onContextMenu={(e) => wm && e.preventDefault()} className="block h-full w-full cursor-zoom-in select-none object-cover" />
                    {wm && (
                      <div className="pointer-events-none absolute inset-0 z-[2] flex flex-wrap content-center items-center justify-center gap-x-8 gap-y-6 opacity-20">
                        {Array.from({ length: 8 }).map((_, wi) => (
                          <span key={wi} className="rotate-[-30deg] whitespace-nowrap text-xs font-semibold tracking-widest text-white">{wm}</span>
                        ))}
                      </div>
                    )}
                    {isSel && <div className="pointer-events-none absolute inset-0 z-[2]" style={{ boxShadow: "inset 0 0 0 2px var(--gold)" }} />}
                    {isVideo(p) && (
                      <span onClick={() => setLbIdx(i)} className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(10,10,12,.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
                        <Play size={20} fill="currentColor" strokeWidth={0} />
                      </span>
                    )}
                    {/* Chỉ còn TRÁI TIM: không nền, không viền tròn, cỡ nhỏ lại. */}
                    {!shareMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                        title={isSel ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                        aria-label={isSel ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                        aria-pressed={isSel}
                        className="absolute right-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isSel ? "var(--gold)" : "#fff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.75))" }}
                      >
                        <Heart size={16} fill={isSel ? "currentColor" : "none"} strokeWidth={isSel ? 0 : 2.2} />
                      </button>
                    )}
                    {/* Nút tải từng ảnh đã bỏ khỏi lưới — chỉ còn trong khung xem
                        ảnh lớn (bấm vào ảnh), để lưới thật gọn. */}
                  </div>
                  );
                })}
              </div>
            </section>
            );
          })}
          {/* Sentinel: khi lọt vào tầm nhìn (kể cả trước 800px) sẽ nạp thêm ảnh. */}
          {renderLimit < visible.length && (
            <div ref={sentinelRef} className="flex justify-center py-6 text-[13px]" style={{ color: "var(--text3)" }}>
              Đang tải thêm ảnh… ({renderLimit}/{visible.length})
            </div>
          )}
        </div>

        {/* Feedback */}
        <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-serif text-2xl font-medium">{tr.feedbackTitle}</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              {fbSent ? (
                <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--success)" }}><Check size={18} /> {tr.fbThanks}</div>
              ) : (
                <>
                  <input value={fbName} onChange={(e) => setFbName(e.target.value)} placeholder={tr.fbNamePh} className="input mb-3" />
                  <div className="mb-3 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setFbRating(n)} aria-label={`${n} sao`} aria-pressed={n <= fbRating} className="p-1" style={{ color: n <= fbRating ? "var(--gold)" : "var(--text3)" }}>
                        <Star size={22} fill={n <= fbRating ? "currentColor" : "none"} strokeWidth={n <= fbRating ? 0 : 2} />
                      </button>
                    ))}
                  </div>
                  <textarea value={fbContent} onChange={(e) => setFbContent(e.target.value)} placeholder={tr.fbContentPh} className="input min-h-[90px] resize-y" />
                  <Turnstile onVerify={onFbCaptcha} onExpire={() => setFbCaptcha(null)} onError={() => setFbCaptcha(null)} className="mt-3" />
                  <button onClick={sendFeedback} disabled={!fbCaptcha} className="btn-primary mt-3 w-full"><Send size={15} /> {tr.fbSend}</button>
                </>
              )}
            </div>
            <div className="space-y-3">
              {fbList.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text3)" }}>{tr.fbEmpty}</p>
              ) : fbList.map((f) => (
                <div key={f.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.client_name || tr.fbGuest}</span>
                    {f.rating ? <span className="flex items-center gap-0.5" style={{ color: "var(--gold)" }}>{Array.from({ length: f.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" strokeWidth={0} />)}</span> : null}
                  </div>
                  <p className="mt-1 text-[13.5px]" style={{ color: "var(--text2)" }}>{f.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lb && lbIdx !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col" style={{
            background: "rgba(6,6,8,.94)",
            backdropFilter: "blur(8px)",
            // Khung xem ảnh LUÔN là nền tối, còn giao diện mặc định của app là
            // chủ đề SÁNG (data-theme="light"): --text2 là xám đậm, --surface
            // gần trắng. Nút nào không tự đặt màu sẽ thành chữ đậm trên nền đen
            // — đúng lỗi "bấm vào xem ảnh mất nút chọn / không chọn": nút vẫn ở
            // đó và vẫn bấm được, chỉ là không nhìn thấy. Ghi đè bộ biến ngay
            // tại gốc khung xem để MỌI thứ bên trong đọc được, thay vì đi vá
            // màu từng nút. `color` phải đặt tường minh: thẻ nào thừa kế màu
            // chữ từ body thì đã nhận giá trị TÍNH TOÁN của chủ đề sáng rồi,
            // ghi đè biến không cứu được.
            color: "#f4f3f1",
            "--text": "#f4f3f1",
            "--text2": "rgba(244,243,241,.72)",
            "--text3": "rgba(244,243,241,.55)",
            "--surface": "rgba(255,255,255,.12)",
            "--surface2": "rgba(255,255,255,.18)",
            "--border": "rgba(255,255,255,.22)",
            "--border2": "rgba(255,255,255,.3)",
          } as React.CSSProperties}>
          <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[13px]" style={{ color: "var(--text2)" }}>{lbIdx + 1} / {visible.length}</span>
            <div className="flex-1" />
            {gallery.allowDownload !== false && (
              isVideo(lb) ? (
                <a href={`https://drive.google.com/file/d/${lb.drive_file_id}/view`} target="_blank" rel="noopener noreferrer" aria-label={tr.dlPhoto} title={tr.dlPhoto} className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}><Download size={17} /></a>
              ) : (
                <button type="button" onClick={() => downloadImage(lb.drive_file_id, lb.name, wm)} aria-label={tr.dlPhoto} title={tr.dlPhoto} className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}><Download size={17} /></button>
              )
            )}
            <button onClick={() => setLbIdx(null)} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}><X size={17} /></button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-1 md:p-4"
            style={{ touchAction: "pan-y" }}
            onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button")) onSwipeDown(e); }}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeUp}
          >
            {/* Chỉ còn dấu < > chồng lên ảnh: bỏ nền + viền để ảnh chiếm chỗ tối đa. */}
            <button onClick={() => setLbIdx(Math.max(0, lbIdx - 1))} disabled={lbIdx === 0} aria-label="Ảnh trước" className="absolute left-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:opacity-20 md:w-14" style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}><ChevronLeft size={34} strokeWidth={1.6} /></button>
            {isVideo(lb) ? (
              <iframe
                src={`https://drive.google.com/file/d/${lb.drive_file_id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="aspect-video w-full max-w-4xl rounded"
                style={{ border: "none", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}
              />
            ) : (
              <div
                className="relative inline-block"
                style={{ transform: `translateX(${swipeDx}px)`, transition: swipe.current ? "none" : "transform .18s ease" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={lb.id} src={fullImageUrl(lb.drive_file_id, 1600)} alt={lb.name} draggable={false} decoding="async" onContextMenu={(e) => wm && e.preventDefault()} className="max-h-[82vh] max-w-full select-none rounded object-contain" style={{ boxShadow: "0 30px 80px rgba(0,0,0,.6)", backgroundImage: `url(${thumbnailUrl(lb.drive_file_id, 400)})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
                {wm && (
                  <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-12 gap-y-10 opacity-20">
                    {Array.from({ length: 12 }).map((_, wi) => (
                      <span key={wi} className="rotate-[-30deg] whitespace-nowrap text-base font-semibold tracking-widest text-white">{wm}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setLbIdx(Math.min(visible.length - 1, lbIdx + 1))} disabled={lbIdx >= visible.length - 1} aria-label="Ảnh sau" className="absolute right-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:opacity-20 md:w-14" style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}><ChevronRight size={34} strokeWidth={1.6} /></button>
          </div>
        </div>
      )}

      <ShareDialog
        url={shareUrl}
        title={`Chia sẻ ${selected.size} ảnh đã chọn`}
        subtitle="Gửi link này cho người khác — họ sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => setShareUrl(null)}
      />
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full px-4 py-1.5 text-[13px] transition-colors" style={active ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
      {children}
    </button>
  );
}

/**
 * "Tải album" = link Drive. Một folder → link trực tiếp; nhiều folder → menu thả
 * xuống liệt kê từng thư mục. Khách tải trực tiếp từ Google Drive (giữ nguyên
 * chất lượng gốc), không qua ZIP nén.
 */
function DriveDownload({ folders, label, labelOne, accent = false }: { folders: DriveFolder[]; label: string; labelOne: string; accent?: boolean }) {
  // File chỉnh sửa là thứ khách vào album để lấy → nút chính. "File gốc" là
  // phụ, để nguyên kiểu chìm cho khỏi tranh chỗ.
  const cls = `${accent ? "btn-primary" : "btn-ghost"} px-3 py-1.5 text-[13px]`;
  return <DriveFolderLinks folders={folders} label={label} labelOne={labelOne} className={cls} />;
}
