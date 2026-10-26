"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { fullImageUrl, stripExtension } from "@/lib/drive";
import { filterByView, type AlbumView } from "@/lib/album-dislike";
import { filterByPerson, type PersonChip } from "@/lib/face-people";
import type { TienDoQuet } from "@/lib/face-pending";
import {
  applyEdit,
  isPending,
  markSynced,
  mergeFromServer,
  newLedger,
  type AlbumLedger,
  type AlbumPicks,
  type SaveActivity,
} from "@/lib/album-offline";
import { loadLedger, saveLedger } from "@/lib/album-store";
import { triggerDownload } from "@/lib/download";
import { useFullImageWidth } from "@/lib/use-img-width";
import { studioUrl } from "@/lib/hosts";
import type { DriveFolder } from "@/components/DriveFolderLinks";
import { duplicatesToHide, type DuplicateGroup } from "@/lib/photo-ai";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM CHỌN ẢNH (/a/[slug]) — TOÀN BỘ LOGIC, dùng chung cho bản cũ
   (CustomerAlbum.tsx) và bản giao diện mới (CustomerAlbumV2.tsx).

   Chuyển nguyên văn từ CustomerAlbum: mở khoá, sổ lựa chọn trên máy + đồng bộ
   lên studio, chọn / không thích / ghi chú, báo "đã chọn xong", chia sẻ, chép
   / xuất danh sách, lọc theo người, ẩn ảnh trùng, khung xem ảnh. Hai bản chỉ
   khác nhau ở cách VẼ; mọi thay đổi hành vi sửa ở đây một lần.

   Phần duy nhất bản cũ không có: `onlyUnpicked` (tab "Chưa chọn" của bản mới).
   Mặc định tắt nên bản cũ chạy y như trước.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PublicPhoto {
  id: string;
  drive_file_id: string;
  name: string;
  source_id: string | null;
  position: number;
}
export interface PublicSource {
  id: string;
  name: string;
  position: number;
}
export interface PublicAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url?: string | null;
  selection_limit: number | null;
  watermark_enabled: boolean;
  watermark_text: string | null;
  hasPassword: boolean;
  /** Tải ảnh ngay trong app (byte đi qua hệ thống) — khoá theo gói. */
  allowDownload: boolean;
  /** Mở thư mục Drive của studio — mọi gói, vì Google tự phục vụ file. */
  allowDrive: boolean;
  allowNotes: boolean;
}

export type CustomerAlbumProps = {
  album: PublicAlbum;
  initialPhotos: PublicPhoto[] | null;
  initialSources: PublicSource[] | null;
  initialSelected?: string[];
  initialDisliked?: string[];
  initialNotes?: Record<string, string>;
  shareIds?: string[] | null;
  initialDriveFolders?: DriveFolder[];
  /**
   * Người trong album, do studio gom & đặt tên sẵn (studio quét MỘT LẦN trên máy
   * họ). Khách chỉ nhận danh sách id ảnh — không tải một byte mô hình AI nào.
   */
  initialPeople?: PersonChip[];
  /**
   * Tiến độ quét khuôn mặt của máy chủ (xem @/lib/face-pending), hoặc null khi
   * không có gì đang chạy — kể cả khi gói của studio không mở tính năng này.
   */
  faceScan?: TienDoQuet | null;
  studioName?: string;
  logoUrl?: string | null;
  /** Domain riêng của studio — link chia sẻ phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
};

/** Một mục của lưới: ảnh nhóm theo nguồn Drive, kèm chỉ số trong visiblePhotos. */
export type AlbumSection = { id: string; name: string; items: { p: PublicPhoto; idx: number }[]; ids: string[] };

// One shared selection per album (the share link belongs to one client), so it
// persists and is visible from any browser that opens the link.
const SHARED = "shared";

export function useCustomerAlbum({
  album,
  initialPhotos,
  initialSources,
  initialSelected,
  initialDisliked,
  initialNotes,
  shareIds,
  initialDriveFolders,
  initialPeople,
  faceScan = null,
  studioName = "Studio",
  studioHost = null,
}: CustomerAlbumProps) {
  const { t } = useLang();

  const [unlocked, setUnlocked] = useState(!album.hasPassword);
  const [photos, setPhotos] = useState<PublicPhoto[]>(initialPhotos ?? []);
  const [sources, setSources] = useState<PublicSource[]>(initialSources ?? []);
  // Link thư mục Drive của album. Album có mật khẩu thì server chưa trả về gì
  // cho tới khi mở khoá, nên nhận thêm ở bước unlock().
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>(initialDriveFolders ?? []);
  // Chip lọc theo người. Album có mật khẩu thì server chưa gửi gì cho tới khi mở
  // khoá, nên cũng nhận thêm ở bước unlock() — giống photos/sources.
  const [people, setPeople] = useState<PersonChip[]>(initialPeople ?? []);
  // Album có mật khẩu: server component chưa biết gì trước khi mở khoá, nên tiến
  // độ này đến cùng lượt trả lời của /access.
  const [scan, setScan] = useState<TienDoQuet | null>(faceScan);
  /** Người đang lọc. null = không lọc. */
  const [personId, setPersonId] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  // Vé mở khoá do /access phát ra (album có mật khẩu). Đính kèm mọi lượt ghi /
  // đồng bộ lựa chọn để máy chủ biết khách đã nhập đúng mật khẩu. Album không mật
  // khẩu thì vé rỗng và server không đòi.
  const accessRef = useRef<string>("");
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
  // Bản mới thêm tab "Chưa chọn": vẫn là chế độ "all", chỉ bớt thêm ảnh đã chọn.
  // Bản cũ không bao giờ bật cờ này.
  const [onlyUnpicked, setOnlyUnpicked] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  // Nút "Xem album" trên ảnh bìa cuộn thẳng xuống phần chọn ảnh.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollToContent = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [lbIdx, setLbIdx] = useState<number | null>(null);
  /**
   * Khung xem ảnh đang lật qua danh sách nào.
   *
   * `null` = lưới ảnh (mặc định). Một mảng id = MỘT CHUỖI ảnh na ná nhau trong
   * khối gợi ý: những tấm đó đã bị tách khỏi lưới, nên nếu khung xem cứ bám vào
   * `visiblePhotos` thì khách KHÔNG có đường nào xem lớn chúng — mà xem lớn mới
   * là lúc khách quyết định có lấy thêm tấm nào không.
   *
   * Dùng LẠI đúng khung xem của lưới chứ không dựng khung thứ hai: khách được
   * phóng to, xem chìm/nổi, thả tim, ghi chú y như mọi tấm khác — một khung xem
   * riêng cho ảnh trùng sẽ thiếu mất vài thứ trong số đó và không ai nhớ ra.
   */
  const [lbGroup, setLbGroup] = useState<string[] | null>(null);
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
  /** Cùng việc với `notifyingDone` nhưng đọc được NGAY — xem notifyDone(). */
  const dangBaoRef = useRef(false);
  const [doneSent, setDoneSent] = useState(false);
  // Các chuỗi ảnh na ná nhau (do khách tự bấm tìm) và có đang ẩn bản trùng không.
  // Không lưu xuống sổ ngoại tuyến: đây là kết quả của một lượt quét, không phải
  // lựa chọn của khách — gửi nó lên máy chủ là gửi một thứ studio không cần.
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [hideDupes, setHideDupes] = useState(false);
  // Nút "bỏ chọn tất cả" đã bấm lần một, đang chờ xác nhận. Xoá một buổi chiều
  // ngồi chọn ảnh cưới bằng MỘT cú bấm nhầm là thứ không có đường quay lại — sổ
  // trên máy cũng đã ghi đè, và bản trên máy chủ sẽ bị đè ngay lượt lưu kế tiếp.
  const [resetArmed, setResetArmed] = useState(false);

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
          access: accessRef.current || undefined,
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
      const res = await fetch(`/api/a/${album.slug}/select`, {
        cache: "no-store",
        headers: accessRef.current ? { "x-album-access": accessRef.current } : undefined,
      });
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
    // Chốt bằng REF chứ không bằng state: state chỉ đổi ở lượt dựng sau, nên hai
    // cú chạm sát nhau (hay tay run trên điện thoại) lọt cả hai và studio nhận
    // hai thông báo cho cùng một lần chọn.
    if (dangBaoRef.current) return;
    dangBaoRef.current = true;
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
      dangBaoRef.current = false;
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
        body: JSON.stringify({ access: accessRef.current || undefined }),
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
    dangBaoRef.current = false;
  }

  const limit = album.selection_limit;

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
   * Bỏ TOÀN BỘ lựa chọn: ảnh đã chọn, ảnh không thích, và mọi ghi chú.
   *
   * Đi qua đúng đường của một lượt sửa bình thường (`recordEdit`) chứ không gọi
   * thẳng máy chủ: nhờ vậy nó cũng được sổ trên máy ghi lại, cũng thử lại khi
   * mất mạng, và cũng hoà giải đúng nếu album đang mở trên một điện thoại khác —
   * "xoá hết" là một thay đổi như mọi thay đổi khác, không phải một lối đi riêng.
   */
  function resetPicks() {
    setResetArmed(false);
    if (selectedRef.current.size === 0 && dislikedRef.current.size === 0) return;
    selectedRef.current = new Set();
    dislikedRef.current = new Set();
    notesRef.current = {};
    setSelected(new Set());
    setDisliked(new Set());
    setNotes({});
    // Về lại lưới đầy đủ: đứng ở tab "ảnh đã chọn" sau khi vừa xoá sạch thì
    // khách nhìn thấy một trang trắng và tưởng album hỏng.
    setView("all");
    setOnlyUnpicked(false);
    recordEdit();
    flashToast(t("resetDone"));
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
    accessRef.current = typeof data.access === "string" ? data.access : "";
    setPhotos(data.photos ?? []);
    setSources(data.sources ?? []);
    setDriveFolders(data.driveFolders ?? []);
    setPeople(data.people ?? []);
    setScan((data.faceScan ?? null) as TienDoQuet | null);
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

  /** Người đang lọc — giữ ở đây để cả lưới và dòng đếm dùng chung. */
  const activePerson = useMemo(
    () => people.find((p) => p.id === personId) ?? null,
    [people, personId]
  );
  /** id ảnh → id file Drive, để ảnh bìa chip không phải quét mảng photos mỗi lần vẽ. */
  const driveIdOf = useMemo(
    () => new Map(photos.map((p) => [p.id, p.drive_file_id])),
    [photos]
  );
  // Cỡ ảnh lớn theo màn hình thật (xem @/lib/use-img-width) — dùng để gọi sẵn
  // ảnh kế bên trong khung xem.
  const fullW = useFullImageWidth();

  const visiblePhotos = useMemo(() => {
    const tabbed = activeTab === "all" ? photos : photos.filter((p) => p.source_id === activeTab);
    // Lọc theo người TRƯỚC mọi luật khác: nó là câu hỏi "cho tôi xem ảnh của mẹ
    // tôi", còn "đã chọn / không thích" là cách xem TRONG tập ảnh đó.
    const base = filterByPerson(tabbed, activePerson);
    // Luật lọc (kể cả "ảnh không thích biến khỏi lưới") nằm ở lib dùng chung với
    // route lưu lựa chọn — xem src/lib/album-dislike.ts.
    const viewed = filterByView(base, { view, selected, disliked, shareSet });
    // Tab "Chưa chọn" (chỉ bản mới): chế độ "all" bớt thêm ảnh đã chọn.
    const shown = onlyUnpicked && view === "all" && !shareSet ? viewed.filter((p) => !selected.has(p.id)) : viewed;
    // Ẩn bản trùng CHỈ ở tab "tất cả": vào tab "ảnh đã chọn" mà vẫn bị giấu bớt
    // thì khách đếm lại lựa chọn của mình sẽ ra thiếu.
    return dupHidden && view === "all" ? shown.filter((p) => !dupHidden.has(p.id)) : shown;
  }, [photos, activeTab, activePerson, view, selected, disliked, shareSet, dupHidden, onlyUnpicked]);
  const selectedPhotos = useMemo(() => photos.filter((p) => selected.has(p.id)), [photos, selected]);

  /** Dãy ảnh khung xem đang lật qua — xem ghi chú ở `lbGroup`. */
  const lbPhotos = useMemo(() => {
    if (!lbGroup) return visiblePhotos;
    const byId = new Map(photos.map((p) => [p.id, p]));
    return lbGroup.map((id) => byId.get(id)).filter((p): p is PublicPhoto => !!p);
  }, [lbGroup, visiblePhotos, photos]);

  // Only sources that actually contain photos become tabs/sections (a parent
  // folder with only sub-folders has no direct photos and is skipped).
  const tabSources = useMemo(
    () => sources.filter((s) => photos.some((p) => p.source_id === s.id)),
    [sources, photos]
  );

  // Group visible photos into sections by Drive source (each link = a section),
  // keeping each photo's index within visiblePhotos for lightbox navigation.
  const sections = useMemo((): AlbumSection[] => {
    const indexed = visiblePhotos.map((p, idx) => ({ p, idx }));
    if (activeTab !== "all" || selectedOnly || dislikedOnly || tabSources.length <= 1) {
      return [{ id: "all", name: "", items: indexed, ids: indexed.map((x) => x.p.id) }];
    }
    const byId = new Map<string, { p: PublicPhoto; idx: number }[]>();
    for (const it of indexed) {
      const sid = it.p.source_id ?? "none";
      if (!byId.has(sid)) byId.set(sid, []);
      byId.get(sid)!.push(it);
    }
    const ordered: AlbumSection[] = [];
    for (const s of sources) {
      if (byId.has(s.id)) {
        ordered.push({ id: s.id, name: s.name, items: byId.get(s.id)!, ids: byId.get(s.id)!.map((x) => x.p.id) });
        byId.delete(s.id);
      }
    }
    for (const [sid, items] of byId) ordered.push({ id: sid, name: sid === "none" ? "Khác" : "", items, ids: items.map((x) => x.p.id) });
    return ordered;
  }, [visiblePhotos, sources, selectedOnly, dislikedOnly, activeTab, tabSources.length]);

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

  /** Đóng khung xem. LUÔN trả danh sách về lưới — mở lại từ lưới mà vẫn còn kẹt
   *  trong một chuỗi ảnh trùng thì mũi tên chỉ đi được ba tấm rồi hết. */
  const closeLightbox = useCallback(() => {
    setLbIdx(null);
    setLbGroup(null);
  }, []);

  /** Mở khung xem trên MỘT CHUỖI ảnh na ná nhau, dừng ở tấm được bấm. */
  const openGroup = useCallback((ids: string[], id: string) => {
    setLbGroup(ids);
    setLbIdx(Math.max(0, ids.indexOf(id)));
  }, []);

  /** Mở khung xem từ LƯỚI. Luôn xoá chuỗi đang giữ trước khi mở: quên bước này
   *  thì mở một tấm ở lưới ngay sau khi vừa xem một chuỗi sẽ lật nhầm danh sách. */
  const openFromGrid = useCallback((idx: number) => {
    setLbGroup(null);
    setLbIdx(idx);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lbIdx === null) return;
      if (e.key === "ArrowRight") setLbIdx((i) => (i === null ? i : Math.min(lbPhotos.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLbIdx((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIdx, lbPhotos.length, closeLightbox]);

  // Đánh dấu "không thích" ngay trong lightbox làm ảnh rời khỏi danh sách đang
  // xem. Kẹp lại chỉ số để lightbox trôi sang ảnh kế tiếp, chỉ đóng khi hết ảnh.
  useEffect(() => {
    if (lbIdx === null) return;
    if (lbPhotos.length === 0) closeLightbox();
    else if (lbIdx > lbPhotos.length - 1) setLbIdx(lbPhotos.length - 1);
  }, [lbIdx, lbPhotos.length, closeLightbox]);

  // Preload neighbouring full images so prev/next switches feel instant
  // (otherwise each step fetches a fresh full-size image from Drive and lags).
  useEffect(() => {
    if (lbIdx === null) return;
    for (const off of [1, -1, 2, -2]) {
      const p = lbPhotos[lbIdx + off];
      if (p) {
        const img = new Image();
        img.src = fullImageUrl(p.drive_file_id, fullW);
      }
    }
  }, [lbIdx, lbPhotos, fullW]);

  // Step to the prev/next photo (clamped to the visible list).
  function go(delta: number) {
    setLbIdx((i) => (i === null ? i : Math.max(0, Math.min(lbPhotos.length - 1, i + delta))));
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
    // 60s (trước 20s), and only while the tab is actually on screen. An album
    // left open in a background tab used to poll every 5s forever — 17k requests
    // a day per tab against the Supabase egress quota, for a page nobody is
    // looking at. Lựa chọn của CHÍNH khách đã nằm sẵn trên máy (sổ offline); vòng
    // này chỉ để thấy thay đổi từ thiết bị KHÁC (cô dâu + chú rể cùng chọn), nên
    // chậm hơn một chút không sao — mỗi lượt là một lần gọi hàm trên Vercel.
    // Nothing is lost by waiting: the visibilitychange/focus handlers below
    // refresh the moment the viewer comes back.
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
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

  const lbPhoto = lbIdx !== null ? lbPhotos[lbIdx] ?? null : null;

  return {
    t,
    // mở khoá
    unlocked,
    password,
    setPassword,
    pwError,
    pwLoading,
    unlock,
    // dữ liệu album
    photos,
    sources,
    tabSources,
    driveFolders,
    people,
    scan,
    personId,
    setPersonId,
    activePerson,
    driveIdOf,
    wm,
    limit,
    // lựa chọn
    selected,
    disliked,
    notes,
    selectedPhotos,
    toggle,
    toggleDislike,
    setNote,
    resetPicks,
    resetArmed,
    setResetArmed,
    ledger,
    saveActivity,
    online,
    notifyDone,
    notifyingDone,
    doneSent,
    // xem / lọc
    view,
    setView,
    selectedOnly,
    dislikedOnly,
    onlyUnpicked,
    setOnlyUnpicked,
    activeTab,
    setActiveTab,
    visiblePhotos,
    sections,
    contentRef,
    scrollToContent,
    // ảnh trùng
    dupGroups,
    setDupGroups,
    hideDupes,
    setHideDupes,
    dupHidden,
    // chia sẻ & danh sách
    shareMode,
    shareSet,
    shareUrl,
    setShareUrl,
    shareBusy,
    shareSelected,
    copied,
    copyList,
    exportList,
    // thông báo
    toast,
    flashToast,
    // khung xem
    lbIdx,
    setLbIdx,
    lbGroup,
    lbPhotos,
    lbPhoto,
    closeLightbox,
    openGroup,
    openFromGrid,
    go,
    fullW,
  };
}

export type CustomerAlbumState = ReturnType<typeof useCustomerAlbum>;
