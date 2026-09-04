"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  HeartOff,
  Check,
  Copy,
  Download,
  FileText,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ListChecks,
  ZoomIn,
  ZoomOut,
  Share2,
  Send,
  Undo2,
} from "lucide-react";
import StudioBrand from "@/components/StudioBrand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import InstallPwaButton from "@/components/InstallPwaButton";
import ShareDialog from "@/components/ShareDialog";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl, fullImageUrl, stripExtension } from "@/lib/drive";
import PhotoZoom, { type PhotoZoomHandle } from "@/components/PhotoZoom";
import { filterByView, type AlbumView } from "@/lib/album-dislike";
import {
  applyEdit,
  isPending,
  markSynced,
  mergeFromServer,
  newLedger,
  syncBadge,
  type AlbumLedger,
  type AlbumPicks,
  type SaveActivity,
} from "@/lib/album-offline";
import { loadLedger, saveLedger } from "@/lib/album-store";
import { triggerDownload, downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { studioUrl } from "@/lib/hosts";
import { ICON_HALO } from "@/lib/album-icon";
import { ALBUM_TITLE_FONT } from "@/lib/album-title";
import AlbumCover from "@/components/AlbumCover";
import DriveFolderLinks, { type DriveFolder } from "@/components/DriveFolderLinks";
import AlbumDuplicateFinder from "./AlbumDuplicateFinder";
import { duplicatesToHide, type DuplicateGroup } from "@/lib/photo-ai";

interface PublicPhoto {
  id: string;
  drive_file_id: string;
  name: string;
  source_id: string | null;
  position: number;
}
interface PublicSource {
  id: string;
  name: string;
  position: number;
}
interface PublicAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url?: string | null;
  selection_limit: number | null;
  watermark_enabled: boolean;
  watermark_text: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
  allowNotes: boolean;
}

// One shared selection per album (the share link belongs to one client), so it
// persists and is visible from any browser that opens the link.
const SHARED = "shared";

export default function CustomerAlbum({
  album,
  initialPhotos,
  initialSources,
  initialSelected,
  initialDisliked,
  initialNotes,
  shareIds,
  initialDriveFolders,
  studioName = "Studio",
  logoUrl = null,
  studioHost = null,
}: {
  album: PublicAlbum;
  initialPhotos: PublicPhoto[] | null;
  initialSources: PublicSource[] | null;
  initialSelected?: string[];
  initialDisliked?: string[];
  initialNotes?: Record<string, string>;
  shareIds?: string[] | null;
  initialDriveFolders?: DriveFolder[];
  studioName?: string;
  logoUrl?: string | null;
  /** Domain riêng của studio — link chia sẻ phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
}) {
  const { t } = useLang();

  const [unlocked, setUnlocked] = useState(!album.hasPassword);
  const [photos, setPhotos] = useState<PublicPhoto[]>(initialPhotos ?? []);
  const [sources, setSources] = useState<PublicSource[]>(initialSources ?? []);
  // Link thư mục Drive của album. Album có mật khẩu thì server chưa trả về gì
  // cho tới khi mở khoá, nên nhận thêm ở bước unlock().
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>(initialDriveFolders ?? []);

  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []));
  // Ảnh khách KHÔNG THÍCH: ẩn khỏi lưới chọn, chỉ hiện ở tab riêng để khách xem
  // lại / bỏ đánh dấu. Studio dùng danh sách này để xoá file trên Drive gốc.
  const [disliked, setDisliked] = useState<Set<string>>(new Set(initialDisliked ?? []));
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes ?? {});
  // Ba chế độ xem: tất cả (đã ẩn ảnh không thích) · chỉ ảnh đã chọn · ảnh không thích.
  const [view, setView] = useState<AlbumView>("all");
  const selectedOnly = view === "selected";
  const dislikedOnly = view === "disliked";
  const [activeTab, setActiveTab] = useState<string>("all");
  // Lưới ảnh: 2 cột trên điện thoại, 4 cột trên máy tính, đặt ảnh trái → phải.
  const masonry = useMasonry(2, 4);
  // Nút "Xem album" trên ảnh bìa cuộn thẳng xuống phần chọn ảnh.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollToContent = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [lbIdx, setLbIdx] = useState<number | null>(null);
  // Mức phóng chỉ để bật/tắt nút "thu nhỏ" — cử chỉ (chụm ngón, kéo, vuốt, lăn
  // chuột) do PhotoZoom lo và KHÔNG render lại trang, xem @/components/PhotoZoom.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef<PhotoZoomHandle>(null);
  // Vùng nền của khung xem ảnh — nơi PhotoZoom bắt cử chỉ.
  const lbStage = useRef<HTMLDivElement | null>(null);
  // Trạng thái lưu. `ledger` là sổ trên máy (xem @/lib/album-offline): nó — chứ
  // không phải lượt fetch gần nhất — mới là nguồn sự thật cho "đã lưu hay chưa".
  const [ledger, setLedger] = useState<AlbumLedger>(() =>
    newLedger(album.slug, { selected: initialSelected ?? [], disliked: initialDisliked ?? [], notes: initialNotes ?? {} }, Date.now())
  );
  const [saveActivity, setSaveActivity] = useState<SaveActivity>("idle");
  const [online, setOnline] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notifyingDone, setNotifyingDone] = useState(false);
  const [doneSent, setDoneSent] = useState(false);
  // Các chuỗi ảnh na ná nhau (do khách tự bấm tìm) và có đang ẩn bản trùng không.
  // Không lưu xuống sổ ngoại tuyến: đây là kết quả của một lượt quét, không phải
  // lựa chọn của khách — gửi nó lên máy chủ là gửi một thứ studio không cần.
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [hideDupes, setHideDupes] = useState(false);

  const wm = album.watermark_enabled ? album.watermark_text || studioName : null;

  // Share-mode: viewing a pre-filtered set of photos shared by the customer.
  const shareMode = shareIds != null && shareIds.length > 0;
  const shareSet = useMemo(() => shareIds ? new Set(shareIds) : null, [shareIds]);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  async function shareSelected() {
    if (selected.size === 0 || shareBusy) return;
    setShareBusy(true);
    // Domain studio (nếu đã bật website riêng) chứ không phải host khách đang
    // mở — khách có thể vào từ link mstudo.com, link chia sẻ vẫn phải là của studio.
    const rel = `/a/${album.slug}`;
    const built = studioUrl(studioHost, rel);
    const abs = /^https?:\/\//i.test(built) ? built : `${window.location.origin}${rel}`;
    try {
      const res = await fetch(`/api/album/${album.slug}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: [...selected] }),
      });
      if (res.ok) {
        const { token } = await res.json();
        setShareUrl(`${abs}?s=${token}`);
      } else {
        setShareUrl(`${abs}?share=${[...selected].join(",")}`);
      }
    } catch {
      setShareUrl(`${abs}?share=${[...selected].join(",")}`);
    }
    setShareBusy(false);
  }

  // Refs hold the latest selection so the debounced save uses fresh data.
  const selectedRef = useRef(selected);
  const dislikedRef = useRef(disliked);
  const notesRef = useRef(notes);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sổ trên máy, bản ref — để lượt lưu đã hẹn giờ và các trình xử lý sự kiện đọc
  // được bản mới nhất mà không phải phụ thuộc vào vòng render.
  const ledgerRef = useRef(ledger);
  const savingRef = useRef(false);
  // Hẹn giờ THỬ LẠI, tách khỏi `saveTimer` (hẹn giờ gộp lượt bấm): `saveTimer`
  // có giá trị nghĩa là "khách vừa bấm, chờ 250ms gộp lại", còn thử lại là việc
  // của mạng — hai thứ này lẫn vào nhau thì vòng đọc lại sẽ bị chặn vĩnh viễn
  // khi đang mất mạng.
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(0);
  // Máy chủ đã TỪ CHỐI hẳn bản này (quá hạn mức, album đóng): dừng mọi lượt gửi
  // lại tự động cho tới khi khách thao tác tiếp. Không có cờ này thì khối
  // `finally` bên dưới lại hẹn giờ gửi tiếp sau 250ms và ta có một vòng lặp vô
  // hạn nã 4xx vào máy chủ.
  const rejectedRef = useRef(false);

  /** Ghi sổ vào state + ổ đĩa. Mọi thay đổi sổ đều phải đi qua đây. */
  const commitLedger = useCallback((next: AlbumLedger) => {
    ledgerRef.current = next;
    setLedger(next);
    void saveLedger(next);
  }, []);

  /** Bản lựa chọn khách đang thấy trên máy này. */
  const currentPicks = useCallback((): AlbumPicks => {
    const sel = [...selectedRef.current];
    const dis = [...dislikedRef.current];
    const noteMap: Record<string, string> = {};
    for (const id of [...sel, ...dis]) if (notesRef.current[id]?.trim()) noteMap[id] = notesRef.current[id];
    return { selected: sel, disliked: dis, notes: noteMap };
  }, []);

  /** Đưa một bản lựa chọn (đã hoà giải) lên màn hình. */
  const applyPicks = useCallback((p: AlbumPicks) => {
    const sel = new Set(p.selected);
    const dis = new Set(p.disliked);
    selectedRef.current = sel;
    dislikedRef.current = dis;
    notesRef.current = p.notes;
    setSelected(sel);
    setDisliked(dis);
    setNotes(p.notes);
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) return;
    // Lùi dần 3s → 6s → 12s… tối đa 1 phút. Khách ngồi chọn ảnh trong vùng sóng
    // yếu cả tiếng: thử lại mỗi 3 giây suốt cả tiếng là đốt pin vô ích.
    retryDelay.current = Math.min(retryDelay.current ? retryDelay.current * 2 : 3000, 60_000);
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      void saveNowRef.current?.();
    }, retryDelay.current);
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (savingRef.current) return; // một lượt đang bay; xong nó sẽ tự gửi tiếp nếu còn chờ
    const l = ledgerRef.current;
    if (!isPending(l)) {
      setSaveActivity("idle");
      return;
    }
    // Chụp lại mốc + bản ĐANG GỬI. Khách bấm thêm giữa chừng thì `editedAt` đã
    // nhảy lên, và markSynced sẽ chỉ đóng dấu tới đúng mốc này — lượt bấm mới
    // vẫn còn trong hàng chờ thay vì bị coi là đã lưu.
    const sentAt = l.editedAt;
    const sentPicks = l.picks;
    savingRef.current = true;
    setSaveActivity("saving");
    try {
      const res = await fetch(`/api/a/${album.slug}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: SHARED,
          photoIds: sentPicks.selected,
          dislikedIds: sentPicks.disliked,
          notes: sentPicks.notes,
        }),
        keepalive: true,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveActivity("failed");
        // 4xx là máy chủ TỪ CHỐI (quá hạn mức, album đóng…) — thử lại cũng chỉ
        // bị từ chối tiếp, nên báo cho khách một câu rồi thôi. 429/5xx là trục
        // trặc tạm thời thì cứ thử lại.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          rejectedRef.current = true;
          flashToast(`${t("saveErr")} (${d.error ?? res.status})`);
        } else {
          scheduleRetry();
        }
        return;
      }
      retryDelay.current = 0;
      rejectedRef.current = false;
      commitLedger(markSynced(ledgerRef.current, sentAt, sentPicks));
      setSaveActivity("idle");
    } catch {
      // Mất mạng. KHÔNG báo toast: lựa chọn đã nằm an toàn trên máy, và viên
      // trạng thái đã nói "chờ mạng" — hiện thêm thông báo lỗi mỗi lần bấm chỉ
      // làm khách tưởng mình mất công chọn lại.
      setSaveActivity("failed");
      scheduleRetry();
    } finally {
      savingRef.current = false;
      // Bấm thêm trong lúc gửi → gửi tiếp ngay bản mới. KHÔNG làm điều này khi
      // máy chủ vừa từ chối hẳn: gửi lại cũng chỉ bị từ chối tiếp.
      if (!rejectedRef.current && isPending(ledgerRef.current) && !retryTimer.current && !saveTimer.current) {
        saveTimer.current = setTimeout(() => void saveNowRef.current?.(), 250);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.slug, commitLedger, scheduleRetry]);

  // `scheduleRetry` và khối `finally` ở trên cần gọi lại chính `saveNow` — giữ
  // qua ref để hai callback không phải phụ thuộc lẫn nhau vòng tròn.
  const saveNowRef = useRef<(() => Promise<void>) | null>(null);
  saveNowRef.current = saveNow;

  /**
   * Khách vừa chạm vào lựa chọn: ghi xuống MÁY trước (đồng bộ, không thể hỏng),
   * rồi mới hẹn giờ gửi lên máy chủ.
   */
  const recordEdit = useCallback(() => {
    commitLedger(applyEdit(ledgerRef.current, currentPicks(), Date.now()));
    // Khách vừa đổi lựa chọn ⇒ bản mới có thể được máy chủ nhận (ví dụ vừa bỏ
    // chọn để về dưới hạn mức), nên bỏ cờ từ chối và cho gửi lại.
    rejectedRef.current = false;
    if (retryTimer.current) {
      // Khách vừa thao tác ⇒ thử lại ngay, đừng bắt chờ hết nhịp lùi.
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryDelay.current = 0;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNowRef.current?.(), 250);
  }, [commitLedger, currentPicks]);

  // Flush a pending save immediately (e.g. before the page unloads).
  const flush = useCallback(() => {
    if (saveTimer.current) void saveNow();
  }, [saveNow]);

  /**
   * Gộp bản của máy chủ vào sổ. `fromDisk` = lần đầu mở trang: đọc sổ đã cất
   * trên máy ra để hoà giải với bản máy chủ mà server component vừa dựng.
   */
  const hydrate = useCallback(
    async (server: AlbumPicks, fromDisk: boolean) => {
      const stored = fromDisk ? await loadLedger(album.slug) : ledgerRef.current;
      const out = mergeFromServer(stored, server, album.slug, Date.now());
      applyPicks(out.picks);
      commitLedger(out.ledger);
      // `rejectedRef`: máy chủ đã từ chối hẳn bản này. Vòng đọc lại chạy mỗi 20
      // giây, nên nếu vẫn đẩy thì cứ 20 giây khách lại ăn một thông báo lỗi y
      // như cũ. Chờ khách thao tác tiếp (recordEdit bỏ cờ) rồi hãy gửi.
      if (out.needsPush && !rejectedRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void saveNowRef.current?.(), 250);
      }
    },
    [album.slug, applyPicks, commitLedger]
  );

  // Keep the shared selection in sync with other people viewing the same link.
  // Không còn "cửa sổ ân hạn" theo thời gian như trước: sổ biết chính xác thay
  // đổi nào chưa lên máy chủ, nên hoà giải theo từng ảnh (xem @/lib/album-offline)
  // thay vì chặn cả lượt đọc.
  const refresh = useCallback(async () => {
    if (saveTimer.current || savingRef.current) return; // có bản đang chờ gửi — đọc sau
    try {
      const res = await fetch(`/api/a/${album.slug}/select`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      await hydrate(
        { selected: data.selected ?? [], disliked: data.disliked ?? [], notes: data.notes ?? {} },
        false
      );
    } catch {
      /* mất mạng — sổ trên máy vẫn nguyên, thử lại ở nhịp sau */
    }
  }, [album.slug, hydrate]);

  // Khách bấm "đã chọn xong" → lưu nốt lựa chọn rồi báo studio (chuông + push +
  // Zalo). Giữ cờ doneSent để đổi nhãn nút; vẫn cho báo lại nếu khách đổi ý.
  async function notifyDone() {
    if (notifyingDone) return;
    setNotifyingDone(true);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await saveNow();
    // CHỐT QUAN TRỌNG: chỉ báo "khách đã chọn xong" khi lựa chọn THẬT SỰ đã lên
    // máy chủ. Trước đây lượt lưu hỏng vẫn gửi thông báo, nên studio nhận tin
    // "chọn xong 42 ảnh" rồi mở ra thấy danh sách cũ — tệ hơn cả không báo gì.
    if (isPending(ledgerRef.current)) {
      setNotifyingDone(false);
      flashToast(
        online
          ? "Chưa gửi xong lựa chọn lên studio. Đợi viên “Đã lưu” rồi báo lại nhé."
          : "Đang mất mạng. Lựa chọn đã lưu trên máy — có mạng lại rồi bấm báo studio."
      );
      return;
    }
    try {
      const res = await fetch(`/api/a/${album.slug}/done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setDoneSent(true);
        flashToast("Đã báo studio bạn chọn xong ✓");
      } else {
        flashToast("Không gửi được thông báo, thử lại sau.");
      }
    } catch {
      flashToast("Mất kết nối khi báo studio.");
    }
    setNotifyingDone(false);
  }

  const limit = album.selection_limit;
  const atLimit = limit != null && selected.size >= limit;

  function toggle(id: string) {
    const next = new Set(selectedRef.current);
    if (next.has(id)) next.delete(id);
    else {
      if (limit != null && next.size >= limit) {
        flashToast(t("limitReached"));
        return;
      }
      next.add(id);
      // Thích lại một ảnh đã đánh dấu không thích ⇒ bỏ khỏi danh sách không thích.
      if (dislikedRef.current.has(id)) {
        const d = new Set(dislikedRef.current);
        d.delete(id);
        dislikedRef.current = d;
        setDisliked(d);
      }
    }
    selectedRef.current = next;
    setSelected(next);
    recordEdit();
  }

  // Không thích / bỏ không thích. Khi đánh dấu không thích: ảnh rời khỏi lựa chọn
  // (hai trạng thái loại trừ nhau) và bị ẩn khỏi lưới, chuyển sang tab riêng.
  function toggleDislike(id: string) {
    const next = new Set(dislikedRef.current);
    const adding = !next.has(id);
    if (adding) next.add(id);
    else next.delete(id);
    dislikedRef.current = next;
    setDisliked(next);

    if (adding && selectedRef.current.has(id)) {
      const s = new Set(selectedRef.current);
      s.delete(id);
      selectedRef.current = s;
      setSelected(s);
    }
    recordEdit();
    flashToast(adding ? t("dislikedMoved") : t("undislikedBack"));
  }

  /**
   * Thêm nhiều ảnh vào lựa chọn một lượt (nút "chọn bản nét nhất của mọi nhóm").
   *
   * Dừng đúng ở hạn mức chứ không bỏ cả lượt: album giới hạn 100 ảnh mà khách
   * bấm nút gợi ý 120 tấm thì thêm được 100 vẫn hơn là không thêm gì — và câu
   * báo nói rõ đã dừng vì chạm hạn mức.
   */
  function selectMany(ids: string[]) {
    const next = new Set(selectedRef.current);
    let added = 0;
    let stopped = false;
    for (const id of ids) {
      if (next.has(id)) continue;
      if (limit != null && next.size >= limit) {
        stopped = true;
        break;
      }
      next.add(id);
      added++;
      // Chọn một ảnh đang bị đánh dấu không thích ⇒ bỏ khỏi danh sách đó, y hệt
      // luật của `toggle` — hai trạng thái này loại trừ nhau.
      if (dislikedRef.current.has(id)) {
        const d = new Set(dislikedRef.current);
        d.delete(id);
        dislikedRef.current = d;
        setDisliked(d);
      }
    }
    if (added === 0) {
      flashToast(stopped ? t("limitReached") : t("dupPicked"));
      return;
    }
    selectedRef.current = next;
    setSelected(next);
    recordEdit();
    flashToast(stopped ? t("limitReached") : t("dupPicked"));
  }

  function setNote(id: string, text: string) {
    const next = { ...notesRef.current, [id]: text };
    notesRef.current = next;
    setNotes(next);
    recordEdit();
  }

  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwError(false);
    const res = await fetch(`/api/a/${album.slug}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setPwLoading(false);
    if (!res.ok) {
      setPwError(true);
      return;
    }
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setSources(data.sources ?? []);
    setDriveFolders(data.driveFolders ?? []);
    // Album có mật khẩu: server component chưa gửi lựa chọn nào, nên bản của máy
    // chủ đến ở đây. Vẫn phải hoà giải với sổ trên máy — khách nhập mật khẩu lại
    // sau khi chọn dở lúc mất mạng là đúng tình huống cần cứu.
    await hydrate(
      { selected: data.selected ?? [], disliked: data.disliked ?? [], notes: data.notes ?? {} },
      true
    );
    setUnlocked(true);
  }

  // Các tấm bị ẩn khi khách bật "chỉ hiện bản nét nhất". Ảnh khách ĐÃ CHỌN không
  // bao giờ nằm trong đây — một tấm biến mất khỏi lưới ngay sau khi vừa bấm chọn
  // là lỗi khó chịu nhất mà tính năng này có thể gây ra.
  const dupHidden = useMemo(
    () => (hideDupes && dupGroups ? duplicatesToHide(dupGroups, selected) : null),
    [hideDupes, dupGroups, selected]
  );

  const visiblePhotos = useMemo(() => {
    const base = activeTab === "all" ? photos : photos.filter((p) => p.source_id === activeTab);
    // Luật lọc (kể cả "ảnh không thích biến khỏi lưới") nằm ở lib dùng chung với
    // route lưu lựa chọn — xem src/lib/album-dislike.ts.
    const shown = filterByView(base, { view, selected, disliked, shareSet });
    // Ẩn bản trùng CHỈ ở tab "tất cả": vào tab "ảnh đã chọn" mà vẫn bị giấu bớt
    // thì khách đếm lại lựa chọn của mình sẽ ra thiếu.
    return dupHidden && view === "all" ? shown.filter((p) => !dupHidden.has(p.id)) : shown;
  }, [photos, activeTab, view, selected, disliked, shareSet, dupHidden]);
  const selectedPhotos = useMemo(() => photos.filter((p) => selected.has(p.id)), [photos, selected]);

  // Only sources that actually contain photos become tabs/sections (a parent
  // folder with only sub-folders has no direct photos and is skipped).
  const tabSources = useMemo(
    () => sources.filter((s) => photos.some((p) => p.source_id === s.id)),
    [sources, photos]
  );

  // Group visible photos into sections by Drive source (each link = a section),
  // keeping each photo's index within visiblePhotos for lightbox navigation.
  const sections = useMemo(() => {
    const indexed = visiblePhotos.map((p, idx) => ({ p, idx }));
    if (activeTab !== "all" || selectedOnly || dislikedOnly || tabSources.length <= 1) {
      return [{ id: "all", name: "", items: indexed }];
    }
    const byId = new Map<string, { p: PublicPhoto; idx: number }[]>();
    for (const it of indexed) {
      const sid = it.p.source_id ?? "none";
      if (!byId.has(sid)) byId.set(sid, []);
      byId.get(sid)!.push(it);
    }
    const ordered: { id: string; name: string; items: { p: PublicPhoto; idx: number }[] }[] = [];
    for (const s of sources) {
      if (byId.has(s.id)) {
        ordered.push({ id: s.id, name: s.name, items: byId.get(s.id)! });
        byId.delete(s.id);
      }
    }
    for (const [sid, items] of byId) ordered.push({ id: sid, name: sid === "none" ? "Khác" : "", items });
    return ordered;
  }, [visiblePhotos, sources, selectedOnly, dislikedOnly, activeTab, tabSources.length]);

  // Tải lũy tiến: chỉ dựng một "cửa sổ" ảnh và tăng dần khi cuộn tới đáy (album
  // chọn ảnh có thể vài nghìn tấm). Chỉ số `idx` vẫn theo visiblePhotos nên
  // lightbox/chọn ảnh không đổi.
  const RENDER_BATCH = 250;
  const [renderLimit, setRenderLimit] = useState(RENDER_BATCH);
  useEffect(() => { setRenderLimit(RENDER_BATCH); }, [activeTab, view, shareSet, photos]);
  // Callback ref: quan sát lại sentinel mỗi khi nó mount lại (kể cả khi đổi sang
  // tab CÙNG SỐ ẢNH sau khi renderLimit reset — effect theo visible.length sẽ bỏ sót).
  const ioRef = useRef<IntersectionObserver | null>(null);
  const visibleCountRef = useRef(visiblePhotos.length);
  visibleCountRef.current = visiblePhotos.length;
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

  function copyList() {
    navigator.clipboard.writeText(selectedPhotos.map((p) => stripExtension(p.name)).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    flashToast(t("copied"));
  }
  function exportList() {
    const text = selectedPhotos
      .map((p) => {
        const note = notes[p.id]?.trim();
        return stripExtension(p.name) + (note ? ` — ${note}` : "");
      })
      .join("\n");
    triggerDownload(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `${album.slug}-selection.txt`
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lbIdx === null) return;
      if (e.key === "ArrowRight") setLbIdx((i) => (i === null ? i : Math.min(visiblePhotos.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLbIdx((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") setLbIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIdx, visiblePhotos.length]);

  // Đổi ảnh / mở khung xem → về mức phóng 1. Bản thân khung ảnh tự dựng lại
  // (key theo id ảnh) nên đã ở mức 1; đây chỉ là đồng bộ nhãn cho nút bấm.
  useEffect(() => {
    setZoom(1);
  }, [lbIdx]);

  // Đánh dấu "không thích" ngay trong lightbox làm ảnh rời khỏi danh sách đang
  // xem. Kẹp lại chỉ số để lightbox trôi sang ảnh kế tiếp, chỉ đóng khi hết ảnh.
  useEffect(() => {
    if (lbIdx === null) return;
    if (visiblePhotos.length === 0) setLbIdx(null);
    else if (lbIdx > visiblePhotos.length - 1) setLbIdx(visiblePhotos.length - 1);
  }, [lbIdx, visiblePhotos.length]);

  // Preload neighbouring full images so prev/next switches feel instant
  // (otherwise each step fetches a fresh 1600px image from Drive and lags).
  useEffect(() => {
    if (lbIdx === null) return;
    for (const off of [1, -1, 2, -2]) {
      const p = visiblePhotos[lbIdx + off];
      if (p) {
        const img = new Image();
        img.src = fullImageUrl(p.drive_file_id, 1600);
      }
    }
  }, [lbIdx, visiblePhotos]);

  // Step to the prev/next photo (clamped to the visible list).
  function go(delta: number) {
    setLbIdx((i) => (i === null ? i : Math.max(0, Math.min(visiblePhotos.length - 1, i + delta))));
  }
  // Load the current selection immediately on open (don't wait for SSR/poll),
  // keep it in sync, and flush any pending save before the page goes away.
  // Sổ trên máy: đọc ra NGAY khi mở trang và hoà giải với bản máy chủ do server
  // component dựng sẵn. Đây là chỗ lựa chọn của lần trước (bấm khi mất mạng, rồi
  // đóng tab) được cứu về — và cũng là chỗ nó được gửi nốt lên studio.
  useEffect(() => {
    if (!unlocked || album.hasPassword) return; // album có mật khẩu: unlock() đã hoà giải
    void hydrate(
      { selected: initialSelected ?? [], disliked: initialDisliked ?? [], notes: initialNotes ?? {} },
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, album.slug]);

  // Có mạng lại → gửi ngay bản đang chờ, không đợi hết nhịp lùi. Trình duyệt báo
  // `online` khá sớm (có sóng nhưng chưa ra được internet) nên lượt gửi này vẫn
  // có thể hỏng — hỏng thì `scheduleRetry` lại lùi tiếp, không mất gì.
  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      // `rejectedRef` cố ý KHÔNG được bỏ ở đây: 4xx là máy chủ từ chối nội dung,
      // không liên quan gì tới việc có mạng hay không.
      if (navigator.onLine && !rejectedRef.current && isPending(ledgerRef.current)) {
        retryDelay.current = 0;
        void saveNowRef.current?.();
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Dọn hẹn giờ khi rời trang, và gửi nốt bản đang chờ.
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    refresh(); // fresh load right away — avoids showing stale/empty picks
    // 20s, and only while the tab is actually on screen. An album left open in
    // a background tab used to poll every 5s forever — 17k requests a day per
    // tab against the Supabase egress quota, for a page nobody is looking at.
    // Nothing is lost by waiting: the visibilitychange/focus handlers below
    // refresh the moment the viewer comes back.
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 20_000);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else refresh();
    };
    const onHide = () => flush();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [unlocked, refresh, flush]);

  // ── Password gate ──────────────────────────────────────────────
  if (!unlocked) {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <StudioBrand name={studioName} logoUrl={logoUrl} />
          <LanguageSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-6">
          <form onSubmit={unlock} className="card w-full max-w-sm p-8 text-center animate-[vkPop_.4s_ease_both]">
            <Lock className="mx-auto mb-4" size={26} style={{ color: "var(--gold)" }} />
            <h1 className="font-serif text-2xl font-medium">{album.title}</h1>
            <p className="mb-6 mt-1 text-sm" style={{ color: "var(--text2)" }}>
              {t("enterPassword")}
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mb-4 text-center"
              placeholder="••••••"
            />
            {pwError && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{t("wrongPassword")}</p>}
            <button disabled={pwLoading} className="btn-primary w-full">
              {pwLoading ? t("loading") : t("enter")}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const lbPhoto = lbIdx !== null ? visiblePhotos[lbIdx] : null;

  // ── Gallery ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-32">
      <header
        className="sticky top-0 z-40 flex h-16 items-center gap-3 px-5 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--bg) 80%, transparent)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <StudioBrand name={studioName} logoUrl={logoUrl} />
        <div
          className="ml-auto flex min-w-0 items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[12.5px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: shareMode ? "var(--gold)" : "#3fbf7f" }} />
          <span className="truncate">
            {shareMode ? `${shareIds!.length} ảnh được chia sẻ` : "Album được chia sẻ · chế độ khách"}
          </span>
        </div>
        {/* Cài album lên màn hình chính. Tự ẩn khi đã cài hoặc khi trình duyệt
            không hỗ trợ, nên không có gì để dọn ở trường hợp thường. Không hiện
            ở chế độ xem link chia sẻ: đó là ảnh của người khác gửi cho xem. */}
        {!shareMode && <InstallPwaButton variant="pill" label="Lưu album" />}
        <LanguageSwitcher />
      </header>

      {/* Ảnh bìa studio đã chọn — chiếm trọn màn hình, tên album ở giữa,
          nút "Xem album" ngay dưới (xem src/components/AlbumCover.tsx). */}
      {album.cover_url && (
        <AlbumCover
          url={album.cover_url}
          title={album.title}
          eyebrow={`${studioName} đã chia sẻ với bạn`}
          buttonLabel="Xem album"
          onView={scrollToContent}
        />
      )}

      <div ref={contentRef} className="mx-auto max-w-[1800px] scroll-mt-16 px-4 pt-7 md:px-6">
        <div className="animate-[vkFade_.5s_ease_both]">
          {!album.cover_url && (
            <>
              <p className="mb-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text3)" }}>
                {studioName} đã chia sẻ với bạn
              </p>
              <h1 className="mb-1 text-[clamp(34px,6vw,64px)] leading-[1.06]" style={ALBUM_TITLE_FONT}>
                {album.title}
              </h1>
            </>
          )}
          <p className="text-[13.5px]" style={{ color: "var(--text2)" }}>
            {photos.length} {t("photos")}
            {album.description ? ` · ${album.description}` : ""}
          </p>
        </div>

        {/* Link tabs — switch between Drive sources */}
        {tabSources.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className="rounded-full px-4 py-1.5 text-[13px] transition-colors"
              style={activeTab === "all" ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            >
              Tất cả
            </button>
            {tabSources.map((s) => {
              // Số hiển thị đúng bằng số ảnh tab đó đang cho xem: chế độ thường ẩn
              // ảnh không thích, tab "Không thích" chỉ đếm ảnh bị loại.
              const n = photos.filter(
                (p) => p.source_id === s.id && (dislikedOnly ? disliked.has(p.id) : !disliked.has(p.id))
              ).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className="rounded-full px-4 py-1.5 text-[13px] transition-colors"
                  style={activeTab === s.id ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
                >
                  {s.name}
                  <span className="ml-1.5 opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sticky toolbar */}
        <div
          className={`sticky top-[64px] z-20 mt-6 mb-7 flex flex-wrap items-center gap-2.5 rounded-2xl p-3 animate-[vkFade_.5s_ease_both]${shareMode ? " justify-between" : ""}`}
          style={{
            background: "color-mix(in srgb, var(--bg2) 86%, transparent)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border)",
          }}
        >
          {shareMode ? (
            <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--gold)" }}>
              <Share2 size={14} /> {shareIds!.length} ảnh được chia sẻ
            </span>
          ) : (
            <>
              {/* Bộ lọc: CHỈ biểu tượng + số lượng. Tên đầy đủ hiện khi rê chuột
                  (title) để người dùng vẫn biết nút làm gì. */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setView((v) => (v === "selected" ? "all" : "selected"))}
                    title={selectedOnly ? t("viewingSelected") : t("selectedCount")}
                    aria-label={selectedOnly ? t("viewingSelected") : t("selectedCount")}
                    aria-pressed={selectedOnly}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
                    style={
                      selectedOnly
                        ? { background: "var(--accent)", color: "var(--accentInk)", border: "1px solid var(--accent)" }
                        : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
                    }
                  >
                    <Heart size={15} fill={selectedOnly ? "currentColor" : "none"} />
                    <span className="tabular-nums">{selected.size}</span>
                  </button>
                  {/* Tab riêng cho ảnh không thích — chỉ hiện khi khách đã loại ảnh nào. */}
                  {(disliked.size > 0 || dislikedOnly) && (
                    <button
                      onClick={() => setView((v) => (v === "disliked" ? "all" : "disliked"))}
                      title={t("dislikedCount")}
                      aria-label={t("dislikedCount")}
                      aria-pressed={dislikedOnly}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
                      style={
                        dislikedOnly
                          ? { background: "var(--danger)", color: "#fff", border: "1px solid var(--danger)" }
                          : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
                      }
                    >
                      <HeartOff size={15} />
                      <span className="tabular-nums">{disliked.size}</span>
                    </button>
                  )}
                </div>
                {/* Số lượng ảnh nằm ngay dưới cụm biểu tượng, không chen ngang hàng. */}
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text3)" }}>
                  {dislikedOnly
                    ? `${disliked.size} ảnh không thích`
                    : selectedOnly
                      ? `${selected.size} ảnh đã chọn`
                      : `${selected.size}${limit != null ? `/${limit}` : ""} đã chọn · ${photos.length - disliked.size} ảnh`}
                  <SyncPill ledger={ledger} activity={saveActivity} online={online} />
                </span>
              </div>
            </>
          )}

          <div className="flex-1" />

          {/* Tải cả album từ Drive. Ẩn ở chế độ chia sẻ chọn lọc: link Drive mở
              CẢ thư mục nên sẽ lộ toàn album chứ không riêng mấy ảnh được chia sẻ. */}
          {!shareMode && album.allowDownload && driveFolders.length > 0 && (
            <DriveFolderLinks
              folders={driveFolders}
              label={t("driveFolderPick")}
              labelOne={t("driveFolder")}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] transition-colors"
            />
          )}
          {/* Thao tác phụ trên danh sách đã chọn gom vào MỘT menu "Tác vụ" cho
              thanh công cụ gọn: chép danh sách · xuất .txt · chia sẻ. Riêng nút
              "Báo studio" để hẳn bên ngoài vì đó là việc chính khách cần làm. */}
          {!shareMode && (
            <TaskMenu
              items={[
                {
                  key: "copy",
                  icon: copied ? <Check size={15} /> : <Copy size={15} />,
                  label: copied ? t("copied") : t("copyList"),
                  onClick: copyList,
                  disabled: selected.size === 0,
                },
                {
                  key: "export",
                  icon: <FileText size={15} />,
                  label: t("exportList"),
                  onClick: exportList,
                  disabled: selected.size === 0,
                },
                {
                  key: "share",
                  icon: <Share2 size={15} />,
                  label: shareBusy ? "Đang tạo link…" : "Chia sẻ ảnh đã chọn",
                  onClick: shareSelected,
                  disabled: selected.size === 0 || shareBusy,
                },
              ]}
            />
          )}
          {/* Báo studio đã chọn xong — CTA chính, để riêng ngoài menu cho dễ thấy. */}
          {!shareMode && (selected.size > 0 || disliked.size > 0) && (
            <button
              onClick={notifyDone}
              disabled={notifyingDone}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={
                doneSent
                  ? { background: "var(--success)", color: "#04150d", border: "1px solid var(--success)" }
                  : { background: "var(--accent)", color: "var(--accentInk)", border: "1px solid var(--accent)" }
              }
            >
              {doneSent ? <Check size={15} /> : <Send size={15} />}
              {notifyingDone ? "Đang gửi…" : doneSent ? "Báo lại studio" : "Đã chọn xong · Báo studio"}
            </button>
          )}
        </div>

        {/* Gợi ý ảnh na ná nhau. Chỉ hiện ở tab "tất cả" và khi album đủ nhiều
            ảnh để có chuyện trùng — album 12 tấm đã là bản studio lọc sẵn, thêm
            một khối công cụ vào đó chỉ làm khách phân tâm. Chế độ xem link chia
            sẻ cũng không cần: đó là một tập ảnh khách đã chọn xong. */}
        {!shareMode && view === "all" && photos.length >= 24 && (
          <AlbumDuplicateFinder
            photos={photos}
            selected={selected}
            groups={dupGroups}
            onGroups={(g) => {
              setDupGroups(g);
              // Quét xong và CÓ nhóm → ẩn bớt bản trùng ngay: đó đúng là thứ
              // khách vừa bấm nút để có. Chỉ ẩn khỏi lưới, không đụng vào lựa
              // chọn, và có công tắc tắt ngay trong khối gợi ý.
              setHideDupes(!!g && g.length > 0);
            }}
            hide={hideDupes}
            onHide={setHideDupes}
            onSelectMany={selectMany}
            onToggle={toggle}
            atLimit={atLimit}
          />
        )}

        {/* Empty filtered state */}
        {visiblePhotos.length === 0 ? (
          <div className="py-20 text-center animate-[vkFade_.4s_ease_both]" style={{ color: "var(--text3)" }}>
            <p className="mb-1.5 font-serif text-2xl" style={{ color: "var(--text2)" }}>
              {dislikedOnly
                ? t("noDislikedPhotos")
                : selectedOnly
                  ? t("noSelectedPhotos")
                  : photos.length === 0
                    ? "Album chưa có ảnh nào"
                    : disliked.size > 0
                      ? "Mọi ảnh ở đây đã được đánh dấu không thích"
                      : t("loading")}
            </p>
          </div>
        ) : (
          // Sections — each Drive source shown separately, left-to-right
          <div ref={masonry.ref} className="space-y-9">
            {sections.map((sec) => {
              // Chỉ dựng ảnh trong cửa sổ hiện tại (idx < renderLimit).
              const items = sec.items.filter((it) => it.idx < renderLimit);
              if (items.length === 0) return null;
              return (
              <section key={sec.id}>
                {sec.name && (
                  <h2 className="mb-3 font-serif text-xl font-medium">
                    {sec.name}
                    <span className="ml-2 text-[13px] font-normal" style={{ color: "var(--text3)" }}>
                      · {sec.items.length} ảnh
                    </span>
                  </h2>
                )}
                {/* Lưới ảnh kiểu collage: 2 cột trên điện thoại, 4 cột trên máy
                    tính, khe gần như bằng 0, KHÔNG bo góc và KHÔNG cắt ảnh —
                    mỗi tấm giữ đúng tỉ lệ gốc, và ảnh được đặt lần lượt
                    TRÁI → PHẢI (xem src/lib/masonry.ts). */}
                <div className="grid grid-cols-2 md:grid-cols-4" style={masonry.gridStyle}>
            {items.map(({ p, idx }) => {
              const isSel = selected.has(p.id);
              const isDis = disliked.has(p.id);
              const note = notes[p.id];
              return (
                <div
                  key={p.id}
                  className="overflow-hidden animate-[vkPop_.45s_ease_both]"
                  style={{ background: "var(--surface)", ...masonry.tileStyle(p.id) }}
                >
                  <div className="relative h-full w-full">
                    <div
                      className="pointer-events-none absolute inset-0 z-[3]"
                      style={
                        isDis
                          ? { boxShadow: "inset 0 0 0 2px var(--danger)" }
                          : isSel
                            ? { boxShadow: "inset 0 0 0 2px var(--gold)" }
                            : undefined
                      }
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailUrl(p.drive_file_id, 400)}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      role="button"
                      tabIndex={0}
                      aria-label={`Xem ảnh ${stripExtension(p.name)}`}
                      onClick={() => setLbIdx(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setLbIdx(idx);
                        }
                      }}
                      onContextMenu={(e) => wm && e.preventDefault()}
                      className="block h-full w-full cursor-zoom-in select-none object-cover"
                      {...masonry.imgProps(p.id)}
                    />
                    {wm && (
                      <div className="pointer-events-none absolute inset-0 z-[2] flex flex-wrap content-center items-center justify-center gap-x-8 gap-y-6 opacity-20">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <span key={i} className="rotate-[-30deg] whitespace-nowrap text-xs font-semibold tracking-widest text-white">
                            {wm}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* heart select — large tap target for mobile. Ảnh đang ở mục
                        không thích thì chỉ còn nút hoàn tác, không cho thích luôn. */}
                    {!shareMode && !isDis && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(p.id);
                        }}
                        title={isSel ? t("deselect") : t("selectThis")}
                        aria-label={isSel ? t("deselect") : t("selectThis")}
                        aria-pressed={isSel}
                        className="absolute right-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isSel ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                      >
                        <Heart size={16} fill={isSel ? "currentColor" : "none"} strokeWidth={isSel ? 0 : 2.2} />
                      </button>
                    )}
                    {/* Không thích (góc trái) — bấm là ảnh ẩn khỏi lưới, sang tab
                        riêng. Ở tab "Không thích" nút này thành hoàn tác. */}
                    {!shareMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDislike(p.id);
                        }}
                        title={isDis ? t("undislike") : t("dislikeThis")}
                        aria-label={isDis ? t("undislike") : t("dislikeThis")}
                        className="absolute left-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isDis ? "var(--danger)" : "#fff", filter: ICON_HALO }}
                      >
                        {isDis ? <Undo2 size={16} /> : <HeartOff size={16} strokeWidth={2.2} />}
                      </button>
                    )}

                    {/* Ghi chú: trước là một dải chữ dưới mỗi ảnh làm lưới rời
                        rạc. Giờ chỉ còn biểu tượng nhỏ ở góc — bấm mở ảnh lớn để
                        viết; sáng màu vàng khi ảnh đã có ghi chú. */}
                    {album.allowNotes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLbIdx(idx);
                        }}
                        title={note?.trim() || "Thêm ghi chú"}
                        aria-label={note?.trim() ? `Ghi chú: ${note.trim()}` : "Thêm ghi chú"}
                        className="absolute bottom-1 left-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: note?.trim() ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                      >
                        <FileText size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
                </div>
              </section>
              );
            })}
            {/* Sentinel: nạp thêm ảnh khi cuộn gần tới đáy. */}
            {renderLimit < visiblePhotos.length && (
              <div ref={sentinelRef} className="flex justify-center py-6 text-[13px]" style={{ color: "var(--text3)" }}>
                Đang tải thêm ảnh… ({renderLimit}/{visiblePhotos.length})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lbPhoto && lbIdx !== null && (
        <div
          className="fixed inset-0 z-[80] flex flex-col animate-[vkOverlay_.3s_ease_both]"
          style={{
            background: "rgba(6,6,8,.93)",
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
          } as React.CSSProperties}
        >
          <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[13px]" style={{ color: "var(--text2)" }}>
              {lbIdx + 1} / {visiblePhotos.length}
            </span>
            <div className="flex-1" />
            {album.allowDownload && (
              <button
                type="button"
                onClick={() => downloadImage(lbPhoto.drive_file_id, lbPhoto.name, wm)}
                title={t("downloadPhoto")}
                aria-label={t("downloadPhoto")}
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
              >
                <Download size={17} />
              </button>
            )}
            <button onClick={() => zoomRef.current?.zoomBy(1 / 1.5)} disabled={zoom <= 1} title="Thu nhỏ" className="flex h-10 w-10 items-center justify-center rounded-lg disabled:opacity-40" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              <ZoomOut size={17} />
            </button>
            <button onClick={() => zoomRef.current?.zoomBy(1.5)} title="Phóng to" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              <ZoomIn size={17} />
            </button>
            <button
              onClick={() => setLbIdx(null)}
              aria-label="Đóng"
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <div ref={lbStage} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1 md:p-4">
              <button
                onClick={() => setLbIdx(Math.max(0, lbIdx - 1))}
                disabled={lbIdx === 0}
                aria-label="Ảnh trước"
                className="absolute left-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-20 md:w-14"
                style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
              >
                <ChevronLeft size={34} strokeWidth={1.6} />
              </button>
              {/* Khung ngoài KHÔNG bị transform, nên kích thước của nó bằng đúng
                  ảnh ở mức thu phóng 1 — hai nút vì thế dính đúng GÓC ẢNH, và
                  không phóng to/thu nhỏ theo khi khách zoom ảnh. */}
              <div className="relative inline-flex">
                <PhotoZoom
                  key={lbPhoto.id}
                  ref={zoomRef}
                  stageRef={lbStage}
                  onSwipe={go}
                  onZoomChange={setZoom}
                  className="relative inline-flex"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={lbPhoto.id}
                    src={fullImageUrl(lbPhoto.drive_file_id, 1600)}
                    alt={lbPhoto.name}
                    draggable={false}
                    decoding="async"
                    onContextMenu={(e) => wm && e.preventDefault()}
                    className="max-h-[calc(100dvh-232px)] max-w-full select-none rounded object-contain md:max-h-[80vh]"
                    style={{
                      boxShadow: "0 30px 80px rgba(0,0,0,.6)",
                      // Show the cached grid thumbnail behind while the full image
                      // decodes, so the picture changes immediately on prev/next.
                      backgroundImage: `url(${thumbnailUrl(lbPhoto.drive_file_id, 400)})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                  {wm && (
                    <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-12 gap-y-10 overflow-hidden opacity-30">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className="rotate-[-30deg] whitespace-nowrap text-base font-semibold tracking-widest text-white drop-shadow">
                          {wm}
                        </span>
                      ))}
                    </div>
                  )}
                </PhotoZoom>
                {/* Không thích (góc trái) và thích (góc phải) — cùng vị trí với
                    lưới ảnh bên ngoài để khách chỉ phải học một chỗ. */}
                {!shareMode && (
                  <button
                    onClick={() => toggleDislike(lbPhoto.id)}
                    title={disliked.has(lbPhoto.id) ? t("undislike") : t("dislikeThis")}
                    aria-label={disliked.has(lbPhoto.id) ? t("undislike") : t("dislikeThis")}
                    aria-pressed={disliked.has(lbPhoto.id)}
                    className="absolute left-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center transition-transform active:scale-90"
                    style={{ color: disliked.has(lbPhoto.id) ? "var(--danger)" : "#fff", filter: ICON_HALO }}
                  >
                    {disliked.has(lbPhoto.id) ? <Undo2 size={24} /> : <HeartOff size={24} strokeWidth={2.2} />}
                  </button>
                )}
                {!shareMode && !disliked.has(lbPhoto.id) && (
                  <button
                    onClick={() => toggle(lbPhoto.id)}
                    title={selected.has(lbPhoto.id) ? t("deselect") : t("selectThis")}
                    aria-label={selected.has(lbPhoto.id) ? t("deselect") : t("selectThis")}
                    aria-pressed={selected.has(lbPhoto.id)}
                    className="absolute right-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center transition-transform active:scale-90"
                    style={{ color: selected.has(lbPhoto.id) ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                  >
                    <Heart size={24} fill={selected.has(lbPhoto.id) ? "currentColor" : "none"} strokeWidth={selected.has(lbPhoto.id) ? 0 : 2.4} />
                  </button>
                )}
              </div>
              {/* Điện thoại: nhấn giữ ảnh là Safari/Chrome lưu thẳng vào thư
                  viện Ảnh của máy — không tốn thêm băng thông vì ảnh đã tải sẵn.
                  Chỉ hiện trên máy cảm ứng (hover:none) và khi album KHÔNG bật
                  watermark: watermark là lớp phủ, nhấn giữ sẽ lấy được ảnh sạch
                  nên thao tác đó đang bị chặn có chủ đích. */}
              {album.allowDownload && !wm && (
                <p
                  className="pointer-events-none absolute inset-x-0 bottom-1 hidden px-4 text-center text-[11.5px] [@media(hover:none)]:block"
                  style={{ color: "rgba(255,255,255,.55)" }}
                >
                  {t("saveToPhotosHint")}
                </p>
              )}
              <button
                onClick={() => setLbIdx(Math.min(visiblePhotos.length - 1, lbIdx + 1))}
                disabled={lbIdx >= visiblePhotos.length - 1}
                aria-label="Ảnh sau"
                className="absolute right-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-20 md:w-14"
                style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
              >
                <ChevronRight size={34} strokeWidth={1.6} />
              </button>
            </div>

            {album.allowNotes && (
              <aside
                className="flex w-full flex-none flex-col gap-2 border-t p-3 md:w-[340px] md:gap-4 md:overflow-y-auto md:border-l md:border-t-0 md:p-7"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                    <FileText size={16} style={{ color: "var(--gold)" }} /> {t("note")}
                  </h3>
                  <p className="mt-1 hidden text-[12.5px] leading-relaxed md:block" style={{ color: "var(--text3)" }}>
                    {disliked.has(lbPhoto.id)
                      ? "Cho studio biết vì sao bạn không thích ảnh này (tuỳ chọn)."
                      : "Để lại ghi chú để studio biết bạn muốn chỉnh sửa gì cho ảnh này."}
                  </p>
                </div>
                {/* Ô nhập để lộ hẳn ra: viền vàng khi CHƯA có ghi chú nên khách
                    nhìn là biết gõ được vào đây, không phải đoán. */}
                <textarea
                  value={notes[lbPhoto.id] ?? ""}
                  onChange={(e) => setNote(lbPhoto.id, e.target.value)}
                  placeholder="Viết ghi chú cho ảnh này…"
                  rows={2}
                  className="min-h-[54px] w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none md:min-h-[110px] md:py-3"
                  style={{
                    background: "var(--surface)",
                    border: notes[lbPhoto.id]?.trim() ? "1px solid var(--border)" : "1.5px solid var(--gold)",
                    color: "var(--text)",
                  }}
                />
                <div className="mt-auto hidden border-t pt-4 md:block" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--text2)" }}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: disliked.has(lbPhoto.id)
                          ? "var(--danger)"
                          : selected.has(lbPhoto.id)
                            ? "#3fbf7f"
                            : "var(--text3)",
                      }}
                    />
                    {disliked.has(lbPhoto.id)
                      ? "Ảnh này đã chuyển sang mục Không thích"
                      : selected.has(lbPhoto.id)
                        ? "Ảnh này đã được chọn"
                        : "Ảnh chưa được chọn"}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2.5 rounded-xl px-5 py-3.5 animate-[vkToast_.35s_ease_both]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "#3fbf7f" }} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <ShareDialog
        url={shareUrl}
        title={`Chia sẻ ${selected.size} ảnh đã chọn`}
        subtitle="Gửi link này — người nhận sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => setShareUrl(null)}
      />
    </main>
  );
}

/**
 * Menu "Tác vụ" — gom chép danh sách / xuất danh sách / chia sẻ / báo studio vào
 * một nút thả xuống. Trước đây bốn nút này nằm rời trên thanh công cụ và tràn
 * hàng trên điện thoại.
 */
type TaskItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
};

/**
 * VIÊN TRẠNG THÁI LƯU — thứ khách cần thấy nhất trên trang này.
 *
 * Album chọn ảnh được mở trên điện thoại, thường ở nơi mạng kém. Trước đây trang
 * không nói gì cả: mất mạng thì lượt bấm im lặng bay mất, khách chỉ phát hiện ra
 * ở lần mở lại. Giờ mọi lượt bấm đã nằm trên máy, nên viên này chỉ còn việc nói
 * thật về việc studio đã nhận chưa. Chữ và tông do @/lib/album-offline quyết
 * (kiểm thử ở desktop/test/album-offline.mjs) — ở đây chỉ vẽ.
 */
function SyncPill({ ledger, activity, online }: { ledger: AlbumLedger; activity: SaveActivity; online: boolean }) {
  const badge = syncBadge(ledger, activity, online);
  const tone =
    badge.tone === "ok"
      ? { dot: "var(--success)", fg: "var(--text2)" }
      : badge.tone === "wait"
        ? { dot: "var(--gold)", fg: "var(--gold)" }
        : { dot: "var(--text3)", fg: "var(--text2)" };
  return (
    <span
      title={badge.detail}
      aria-live="polite"
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: tone.fg }}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full${badge.tone === "busy" ? " animate-pulse" : ""}`}
        style={{ background: tone.dot }}
      />
      {badge.text}
    </span>
  );
}

function TaskMenu({ items }: { items: TaskItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tác vụ"
        className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
      >
        <ListChecks size={15} /> Tác vụ
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 min-w-[250px] max-w-[80vw] rounded-xl p-1.5 shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                disabled={it.disabled}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface2)] disabled:opacity-40 disabled:hover:bg-transparent"
                style={{ color: it.accent ? "var(--accent)" : "var(--text)", fontWeight: it.accent ? 700 : 500 }}
              >
                <span className="flex-shrink-0">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
