"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forgetDevice, readPhone, readSnapshot, rememberPhone, saveSnapshot } from "@/lib/portal-device";
import { apptTimeRange, apptTitle } from "@/lib/appointments";
import { fullImageUrl, thumbnailUrl } from "@/lib/drive";
import { useFullImageWidth } from "@/lib/use-img-width";
import type { AppointmentKind } from "@/lib/types";
import type { PortalVideo } from "./PortalVideos";
import type { PortalPayload, PortalPlanRow } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của cổng khách — bản cũ (ContractPortalView, PaymentPanel,
   AlbumView) và bản giao diện mới (…V2) gọi CÙNG các hook ở đây, nên cổng SĐT,
   bản chụp khi mất mạng, báo đã chuyển khoản, đánh giá sao… chạy y hệt nhau dù
   khách đang xem giao diện nào. Chỉ phần vẽ là khác.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bản chụp để đọc khi mất mạng — cắt bớt danh sách ảnh trước khi cất.
 *
 * localStorage chỉ có ~5 MB cho cả origin. Album giao khách trả về tới 400 ảnh
 * (xem /api/c/[token]); cất trọn thì có ngày vượt hạn mức, và khi ghi lỗi thì
 * MẤT CẢ bản chụp — kể cả phần tiến độ, lịch hẹn, thanh toán vốn chỉ vài KB và
 * là thứ khách cần đọc offline nhất. Giữ 120 ảnh đầu là đủ để trang album mở ra
 * còn có cái xem (ảnh đã xem nằm trong cache của service worker), phần còn lại
 * chờ có mạng.
 */
const SNAPSHOT_PHOTOS = 120;

function trimForSnapshot(p: PortalPayload): PortalPayload {
  if (!p.album || p.album.photos.length <= SNAPSHOT_PHOTOS) return p;
  return { ...p, album: { ...p.album, photos: p.album.photos.slice(0, SNAPSHOT_PHOTOS) } };
}

/* ── Cổng SĐT + tải dữ liệu ─────────────────────────────────────────────── */
export function usePortalSession(token: string) {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Số điện thoại đã mở khoá — giữ lại để gửi kèm mọi thao tác ghi sau đó
   *  (báo đã chuyển khoản, gửi đánh giá): endpoint kiểm SĐT ở MỌI lần gọi. */
  const [unlocked, setUnlocked] = useState("");

  /**
   * Bản chụp đang được đọc thay cho dữ liệu thật (mất mạng). `null` = đang xem
   * dữ liệu vừa lấy từ máy chủ. Cầm mốc thời gian để nói thẳng với khách bản này
   * cũ bao lâu — số tiền còn nợ là thứ không được phép hiện ra mà im lặng.
   */
  const [staleAt, setStaleAt] = useState<number | null>(null);
  /** Đang tự mở khoá bằng số đã nhớ trên máy → chưa vẽ cổng chặn, khỏi nháy. */
  const [autoTrying, setAutoTrying] = useState(() => !!readPhone(token));

  /** Gọi cổng khách. Trả `true` khi mở được. */
  const open = useCallback(
    async (p: string, remember: boolean): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/c/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: p }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          // Số nhớ trên máy không còn khớp (studio sửa lại SĐT khách): xoá bản
          // nhớ để lần sau hỏi lại, thay vì cứ tự thử rồi cứ báo lỗi.
          if (j.error === "wrong_phone") forgetDevice(token);
          return { ok: false, error: j.error };
        }
        const payload = (await res.json()) as PortalPayload;
        setData(payload);
        setUnlocked(p);
        setStaleAt(null);
        if (remember) rememberPhone(token, p);
        saveSnapshot(token, trimForSnapshot(payload));
        return { ok: true };
      } catch {
        // Mất mạng. Có bản chụp thì mở ở CHẾ ĐỘ ĐỌC — hợp đồng cưới chạy nhiều
        // tháng, khách mở app ra chỉ để xem "hôm nào thử đồ" thì không có lý gì
        // bắt phải có internet.
        const snap = readSnapshot<PortalPayload>(token);
        if (snap) {
          setData(snap.data);
          setUnlocked(p);
          setStaleAt(snap.at);
          return { ok: true };
        }
        return { ok: false, error: "offline" };
      }
    },
    [token]
  );

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await open(phone, true);
    setLoading(false);
    if (!r.ok) {
      setErr(
        r.error === "wrong_phone"
          ? "Số điện thoại không khớp. Vui lòng kiểm tra lại."
          : r.error === "not_found"
            ? "Không tìm thấy hợp đồng."
            : r.error === "offline"
              ? "Đang mất mạng và máy này chưa có bản lưu. Hãy thử lại khi có mạng."
              : "Có lỗi xảy ra, thử lại sau."
      );
    }
  }

  // Máy này đã mở khoá trước đó → tự mở lại. Đây là điều biến cổng khách từ một
  // trang web phải nhập số mỗi lần thành một app bấm vào là thấy.
  useEffect(() => {
    const saved = readPhone(token);
    if (!saved) return;
    let alive = true;
    void open(saved, false).then((r) => {
      if (!alive) return;
      setAutoTrying(false);
      if (!r.ok && r.error === "wrong_phone") setErr("Studio đã cập nhật số điện thoại. Vui lòng nhập lại số mới.");
    });
    return () => { alive = false; };
  }, [token, open]);

  return { phone, setPhone, data, loading, err, unlocked, staleAt, autoTrying, unlock };
}

/** Máy dùng chung: xoá số đã nhớ + bản chụp dữ liệu trên máy này rồi mở lại trang. */
export function forgetThisDevice(token: string) {
  forgetDevice(token);
  location.reload();
}

/* ── Lịch trình khách xem ───────────────────────────────────────────────── */
export type PortalTimelineItem = {
  key: string;
  date: string;
  time: string;
  title: string;
  place: string;
  note: string | null;
  kind: AppointmentKind | null;
  done: boolean;
};

/**
 * Lịch trình khách xem = lịch hẹn (studio_appointments) + các mốc ghi chú của
 * hợp đồng (studio_events). Gộp hai nguồn rồi sắp theo ngày: khách chỉ quan
 * tâm "ngày nào làm gì", không quan tâm studio lưu ở bảng nào.
 */
export function usePortalTimeline(data: PortalPayload, today: string): PortalTimelineItem[] {
  return useMemo(() => {
    const fromAppts = data.appointments.map((a) => ({
      key: `a-${a.id}`,
      date: a.appt_date,
      time: a.start_time ? apptTimeRange(a) : "",
      title: apptTitle(a),
      place: [a.room, a.location].filter(Boolean).join(" · "),
      note: a.note,
      kind: a.kind,
      done: a.status === "done" || (a.status !== "cancelled" && a.appt_date < today),
    }));
    const fromEvents = data.milestones.map((m) => ({
      key: `e-${m.id}`,
      date: m.event_date,
      time: m.event_time ?? "",
      title: m.title,
      place: "",
      note: m.note,
      kind: null as null,
      done: m.event_date < today,
    }));
    return [...fromAppts, ...fromEvents].sort((x, y) => x.date.localeCompare(y.date) || x.time.localeCompare(y.time));
  }, [data.appointments, data.milestones, today]);
}

/* ── Thanh toán: đợt tiếp theo, mã QR, báo đã chuyển khoản ──────────────── */
export function usePortalPayment({
  token, phone, total, paid, plan, contractCode, toast,
}: {
  token: string;
  phone: string;
  total: number;
  paid: number;
  plan: PortalPlanRow[];
  contractCode: string | null;
  toast: (m: string) => void;
}) {
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const [qrOpen, setQrOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  /** Đợt tiếp theo phải thu = đợt chưa thu, hạn gần nhất. */
  const nextDue = useMemo(() => plan.find((p) => !p.paid) ?? null, [plan]);
  const qrAmount = nextDue?.amount ?? remaining;
  const addInfo = `${contractCode ? `${contractCode} ` : ""}${nextDue?.label ?? "Thanh toan hop dong"}`.slice(0, 50);

  async function reportPaid() {
    setReporting(true);
    // Bọc try/catch: khách bấm nút này ở quầy ngân hàng, trong thang máy, ở nơi
    // mạng chập chờn. Không bọc thì `fetch` ném ra ngoài, nút kẹt vĩnh viễn ở
    // "Đang gửi…" và khách không biết studio đã nhận hay chưa. Báo chuyển khoản
    // KHÔNG được xếp hàng lại gửi sau: khách phải biết ngay là chưa gửi được để
    // còn nhắn Zalo cho studio.
    let res: Response;
    try {
      res = await fetch(`/api/c/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", phone }),
      });
    } catch {
      setReporting(false);
      toast("Đang mất mạng — chưa báo được studio. Vui lòng thử lại khi có mạng.");
      return;
    }
    setReporting(false);
    if (res.ok) {
      toast("Đã báo studio — cảm ơn bạn!");
      setQrOpen(false);
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    toast(j.message || "Chưa gửi được thông báo, thử lại sau.");
  }

  return { remaining, pct, qrOpen, setQrOpen, reporting, reportPaid, nextDue, qrAmount, addInfo };
}

/* ── Album hoàn thiện: ảnh, video, link tải ─────────────────────────────── */
export function useAlbumContent(data: PortalPayload) {
  const album = data.album;
  const photos = useMemo(() => (album?.photos ?? []).filter((p) => !p.is_video), [album]);
  const albumVideos = useMemo(() => (album?.photos ?? []).filter((p) => p.is_video), [album]);
  // Link studio dán tay trên hợp đồng (YouTube / Drive / Google Photos…).
  const linkVideos = useMemo(() => data.final_links?.videos ?? [], [data.final_links]);
  const albumLink = data.final_links?.album_url ?? null;
  const originalsLink = data.final_links?.originals_url ?? null;
  const canDownload = !!album?.download_enabled;

  /** Một danh sách phát chung: video dán link trước (thường là phim chính đã
   *  dựng), rồi tới video nằm trong album Drive. */
  const videos = useMemo<PortalVideo[]>(() => {
    const fromLinks = linkVideos.map((v, i) => ({
      key: `link-${i}`,
      title: v.title || (linkVideos.length > 1 ? `Video ${i + 1}` : "Video hoàn thiện"),
      kind: v.kind ?? "other",
      embed: v.embed,
      poster: v.poster ?? null,
      openUrl: v.url,
      // Link Drive studio tự dán = studio đã chủ ý chia sẻ file đó cho khách.
      downloadUrl: v.drive_id ? `/api/img?id=${encodeURIComponent(v.drive_id)}&dl=1` : null,
    }));
    const fromAlbum = albumVideos.map((v) => ({
      key: v.id,
      title: v.name.replace(/\.[a-z0-9]{2,4}$/i, ""),
      kind: "drive" as const,
      embed: `https://drive.google.com/file/d/${v.drive_file_id}/preview`,
      poster: thumbnailUrl(v.drive_file_id, 1024),
      openUrl: `https://drive.google.com/file/d/${v.drive_file_id}/view`,
      downloadUrl: canDownload ? `/api/img?id=${encodeURIComponent(v.drive_file_id)}&dl=1` : null,
    }));
    return [...fromLinks, ...fromAlbum];
  }, [linkVideos, albumVideos, canDownload]);

  const hasContent = !!album || !!albumLink || !!originalsLink || videos.length > 0;
  /** Không có ảnh nhưng có video → mở thẳng tab Video, khỏi bắt khách bấm thêm. */
  const firstTab: "photos" | "videos" = photos.length === 0 && !albumLink && videos.length > 0 ? "videos" : "photos";
  const coverW = useFullImageWidth();
  const cover = album?.cover_url || (photos[0] ? fullImageUrl(photos[0].drive_file_id, coverW) : null);

  return { album, photos, albumVideos, videos, albumLink, originalsLink, canDownload, hasContent, firstTab, cover };
}

/* ── Đánh giá sao + chia sẻ ─────────────────────────────────────────────── */
export function usePortalRating(token: string, phone: string, toast: (m: string) => void) {
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  // Chốt bằng ref: chạm 3★ rồi 5★ trước khi lượt đầu trả về thì máy chủ ghi HAI
  // đánh giá công khai (mỗi lượt POST là một dòng mới) và studio nhận hai thông báo.
  const sendingRef = useRef(false);

  async function sendRating(stars: number) {
    if (sendingRef.current || rated) return;
    sendingRef.current = true;
    try {
      await doSend(stars);
    } finally {
      sendingRef.current = false;
    }
  }

  async function doSend(stars: number) {
    setRating(stars);
    // Mất mạng → `fetch` ném ra ngoài, sao đã sáng lên mà đánh giá không tới
    // studio và khách tưởng đã gửi. Nói thật thay vì im lặng.
    let res: Response;
    try {
      res = await fetch(`/api/c/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", phone, rating: stars, message: "" }),
      });
    } catch {
      setRating(0);
      toast("Đang mất mạng — chưa gửi được đánh giá. Thử lại khi có mạng nhé.");
      return;
    }
    if (res.ok) {
      setRated(true);
      toast("Cảm ơn bạn đã đánh giá!");
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    toast(j.message || "Chưa gửi được đánh giá, thử lại sau.");
  }

  return { rating, rated, sendRating };
}

/** Chia sẻ trang đang mở (bảng chia sẻ của máy, không có thì chép link). */
export async function sharePortalPage(title: string, toast: (m: string) => void) {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Đã sao chép đường dẫn album.");
  } catch {
    toast("Không chia sẻ được — hãy sao chép đường dẫn trên trình duyệt.");
  }
}
