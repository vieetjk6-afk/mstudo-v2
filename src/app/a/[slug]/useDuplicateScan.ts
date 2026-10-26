"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { thumbnailUrl } from "@/lib/drive";
import { duplicateGroups, type DuplicateGroup } from "@/lib/photo-ai";
import { scanPhotos, scanSupported, type ScanItem, type ScanProgress } from "@/lib/photo-ai-scan";

/* ═══════════════════════════════════════════════════════════════════════════
   GỢI Ý ẢNH NA NÁ NHAU — phần logic (quét, tiến độ, dừng, lọc chuỗi), dùng
   chung cho khối cũ (./AlbumDuplicateFinder) và ngăn kéo của giao diện mới
   (./DuplicatesV2). Lý do của từng luật (không tự chạy, không đụng vào lựa
   chọn, quét qua ảnh xem trước) ghi ở đầu ./AlbumDuplicateFinder.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FinderPhoto = { id: string; drive_file_id: string; name: string };

/**
 * Trần số ảnh một lượt quét. Album cưới trọn gói có thể 3.000 tấm; quét từng ấy
 * trên điện thoại là mấy phút máy nóng ran. 600 tấm là chỗ mà lợi ích còn rõ
 * ràng hơn cái giá phải trả.
 */
export const SCAN_CAP = 600;

export function useDuplicateScan({
  photos,
  disliked,
  groups,
  onGroups,
}: {
  /** Ảnh theo ĐÚNG thứ tự bấm máy — luật gom nhóm dựa vào thứ tự đó. */
  photos: FinderPhoto[];
  /** Ảnh khách đã đánh dấu KHÔNG THÍCH — không bày lại nữa. */
  disliked: ReadonlySet<string>;
  groups: DuplicateGroup[] | null;
  onGroups: (g: DuplicateGroup[] | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Trình duyệt có giải mã ảnh trong nền được không — HỎI TRONG EFFECT, không
  // hỏi lúc dựng.
  //
  // `scanSupported()` đọc `window`, nên gọi thẳng khi dựng sẽ ra `false` ở máy
  // chủ và `true` ở lượt hydrate đầu tiên. Hai bên khác nhau là React vứt bỏ
  // toàn bộ HTML máy chủ đã dựng và vẽ lại cả trang album bằng JavaScript —
  // chậm hơn, nháy màn hình, và một loạt lỗi hydrate trong console. Bài kiểm
  // tra ở /uipreview/anh-trung-khach bắt được đúng lỗi này.
  //
  // Đổi lại, lượt vẽ đầu tiên KHÔNG có khối gợi ý và nó hiện ra ngay sau đó.
  // Đúng như vậy: khối này là phần thêm, không phải thứ khách chờ để đọc.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(scanSupported()), []);
  const scanList = useMemo(() => photos.slice(0, SCAN_CAP), [photos]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    onGroups(null);
    setProgress({ done: 0, total: scanList.length, failed: 0, current: "" });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // 640px: đủ để so trùng. raw=1: quét bằng fetch() nên cần byte cùng miền
      // (/api/img chỉ trả byte khi URL có raw=1; thiếu thì 302 sang Google không
      // có CORS → fetch hỏng). Đã quét một lần thì service worker giữ lại.
      const items: ScanItem[] = scanList.map((p) => ({
        key: p.id,
        name: p.name,
        url: `${thumbnailUrl(p.drive_file_id, 640)}&raw=1`,
      }));
      const outcome = await scanPhotos(items, setProgress, ac.signal);
      if (!outcome.aborted || outcome.metrics.length > 0) {
        onGroups(duplicateGroups(outcome.metrics));
      }
    } catch {
      onGroups([]);
    }
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }, [busy, scanList, onGroups]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /**
   * Chuỗi để BÀY RA, đã bỏ những tấm khách đánh dấu không thích.
   *
   * Cả album theo một luật: ảnh không thích thì biến khỏi chỗ chọn ảnh. Nếu khối
   * này không theo, khách vừa gạt một tấm đi xong lại thấy nó nằm nguyên đây.
   * Chuỗi còn dưới hai tấm thì không còn là chuỗi — bỏ luôn.
   */
  const shown = useMemo(() => {
    if (!groups) return null;
    const out: DuplicateGroup[] = [];
    for (const g of groups) {
      const keys = g.keys.filter((k) => !disliked.has(k));
      if (keys.length < 2) continue;
      out.push({ keys, bestKey: keys.includes(g.bestKey) ? g.bestKey : keys[0] });
    }
    return out;
  }, [groups, disliked]);

  const dupCount = useMemo(
    () => (shown ?? []).reduce((n, g) => n + g.keys.length - 1, 0),
    [shown]
  );

  return { supported, busy, progress, run, stop, abortRef, scanList, byId, shown, dupCount };
}

export type DuplicateScan = ReturnType<typeof useDuplicateScan>;
