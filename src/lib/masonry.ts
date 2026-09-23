"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/** Khe giữa các ảnh (px) — hẹp để lưới liền mạch, nhưng đủ tách từng tấm. */
export const MASONRY_GAP = 6;
/** Dòng lưới rất mảnh: ảnh chiếm bao nhiêu dòng thì cao bấy nhiêu. */
const ROW = 4;
/** Tỉ lệ tạm (cao/rộng) cho ảnh CHƯA đo được — 3:2 nằm ngang, dạng phổ biến nhất. */
const FALLBACK_RATIO = 2 / 3;

/**
 * Ảnh cách khung nhìn xa hơn chừng này (theo % chiều cao màn hình, tính cả trên
 * lẫn dưới) thì NHẢ byte ảnh ra, cuộn lại gần thì gắn lại. 150% ≈ một màn hình
 * rưỡi mỗi phía: đủ xa để khách cuộn qua cuộn lại không thấy ảnh chớp, đủ gần
 * để bộ nhớ không phình.
 */
const KEEP_MARGIN = "150%";
/** Ảnh 1×1 trong suốt — chỗ đứng của ảnh đã nhả, không gọi thêm request nào. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Lưới ảnh kiểu "gạch xây" nhưng ĐẶT ẢNH TỪ TRÁI SANG PHẢI.
 *
 * Hai cách làm sẵn có đều hỏng một nửa yêu cầu:
 *  - Cột CSS (`columns-2` / `columns-4`) xếp hết ảnh dọc cột này mới sang cột
 *    kia, nên ảnh thứ hai rơi tuốt xuống dưới thay vì nằm cạnh ảnh đầu.
 *  - Lưới thường thì mỗi hàng cao bằng tấm cao nhất, để lại khoảng trống dưới
 *    những tấm thấp hơn — trái với yêu cầu "gần như không có khoảng cách".
 *
 * Cách ở đây: CSS grid với dòng mảnh 4px; mỗi ảnh chiếm số dòng tính từ TỈ LỆ
 * THẬT của nó (đọc naturalWidth/naturalHeight khi ảnh tải xong). Ảnh giữ đúng
 * tỉ lệ, khe gần bằng 0, và trình duyệt vẫn đặt ảnh lần lượt trái → phải như
 * khi đọc.
 *
 * HAI VIỆC GIỮ CHO ĐIỆN THOẠI KHÔNG LAG KHI CUỘN SÂU
 *
 * 1. Đo xong KHÔNG dựng lại cây React. Album cưới 2–3 nghìn tấm: mỗi ảnh tải
 *    xong lại setState là React đối chiếu lại cả nghìn ô, 80ms một lần, đúng
 *    lúc khách đang cuộn. Giờ số dòng lưới được ghi THẲNG vào style của ô
 *    (`tileRef`), không đụng tới React. `tileStyle` vẫn trả đúng con số đó cho
 *    lượt dựng đầu nên hai đường luôn khớp.
 *
 * 2. Ảnh ra khỏi vùng quanh khung nhìn thì NHẢ ra. Một tấm 400×600 đã giải mã
 *    nằm trong RAM ≈ 1MB; cuộn qua 1500 tấm là ~1,5GB — Safari trên iPhone tụt
 *    dần rồi tự tải lại trang. Thẻ <img> vẫn nằm nguyên chỗ (ô đã có sẵn chiều
 *    cao nên không nhảy layout), chỉ có byte ảnh được trả về; cuộn lại thì gắn
 *    src cũ, lấy từ cache trình duyệt nên gần như tức thì.
 *
 * `ref` gắn vào khung BAO các lưới (mọi mục con rộng bằng nhau) — chỉ cần đo
 * một chỗ là đủ cho tất cả.
 */
export function useMasonry(colsMobile = 2, colsDesktop = 4) {
  const node = useRef<HTMLElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const io = useRef<IntersectionObserver | null>(null);
  /** id ảnh → tỉ lệ cao/rộng thật, đo một lần rồi giữ. */
  const ratios = useRef(new Map<string, number>());
  /** id ảnh → ô đang mount, để ghi số dòng lưới thẳng vào style. */
  const tiles = useRef(new Map<string, HTMLElement>());
  const imgs = useRef(new Map<string, HTMLImageElement>());
  /** Bề rộng một cột — để trong ref vì đổi nó KHÔNG cần dựng lại React. */
  const colWidth = useRef(0);
  /** Hàm ref/props giữ nguyên danh tính theo id: đổi mỗi lượt dựng là React
   *  tháo ra gắn lại từng thẻ, kéo theo ngắt/nối IntersectionObserver vô ích. */
  const tileRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const imgPropsCache = useRef(new Map<string, ReturnType<typeof makeImgProps>>());

  /** Số dòng lưới của một ô, từ tỉ lệ ảnh và bề rộng cột hiện tại. */
  const spanOf = useCallback((id: string) => {
    const r = ratios.current.get(id) ?? FALLBACK_RATIO;
    const h = (colWidth.current || 200) * r;
    return Math.max(1, Math.round((h + MASONRY_GAP) / (ROW + MASONRY_GAP)));
  }, []);

  const applySpan = useCallback(
    (id: string) => {
      const el = tiles.current.get(id);
      if (el) el.style.gridRowEnd = `span ${spanOf(id)}`;
    },
    [spanOf]
  );

  // Bề rộng một cột = bề rộng lưới trừ khe, chia số cột đang dùng. Cần con số
  // này mới đổi được tỉ lệ ảnh thành số dòng lưới.
  const measure = useCallback(() => {
    const el = node.current;
    if (!el) return;
    const cols = window.matchMedia("(min-width: 768px)").matches ? colsDesktop : colsMobile;
    const w = el.clientWidth;
    if (w <= 0) return;
    const next = (w - MASONRY_GAP * (cols - 1)) / cols;
    if (Math.abs(next - colWidth.current) < 0.5) return; // xoay máy mới tính lại
    colWidth.current = next;
    for (const id of tiles.current.keys()) applySpan(id);
  }, [colsMobile, colsDesktop, applySpan]);

  // Callback ref (không phải useEffect theo []): lưới có thể mount muộn — album
  // đang trống, đang lọc, hay vừa mở khoá mật khẩu — lúc đó effect chạy một lần
  // rồi thôi sẽ không bao giờ đo được.
  const ref = useCallback(
    (el: HTMLElement | null) => {
      ro.current?.disconnect();
      node.current = el;
      if (!el) return;
      measure();
      ro.current = new ResizeObserver(measure);
      ro.current.observe(el);
    },
    [measure]
  );

  /** Ảnh tải xong mới biết tỉ lệ thật → ghi thẳng số dòng vào ô, không setState. */
  const onImgLoad = useCallback(
    (id: string, img: HTMLImageElement) => {
      if (ratios.current.has(id)) return;
      if (img.dataset.mstSrc) return; // đang là ảnh trống của ô đã nhả
      const r = img.naturalHeight / img.naturalWidth;
      if (!r || !Number.isFinite(r) || img.naturalWidth <= 1) return;
      ratios.current.set(id, r);
      applySpan(id);
    },
    [applySpan]
  );

  /** Nhả byte ảnh của ô đã cuộn qua xa. Ô giữ nguyên chỗ, không nhảy layout. */
  function release(img: HTMLImageElement) {
    if (img.dataset.mstSrc) return;
    const src = img.getAttribute("src");
    if (!src || src === BLANK) return;
    img.dataset.mstSrc = src;
    img.src = BLANK;
  }

  /** Cuộn lại gần thì gắn src cũ — cache trình duyệt trả ngay, không tốn mạng. */
  function restore(img: HTMLImageElement) {
    const src = img.dataset.mstSrc;
    if (!src) return;
    delete img.dataset.mstSrc;
    img.src = src;
  }

  const watcher = useCallback(() => {
    if (io.current) return io.current;
    io.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const img = e.target as HTMLImageElement;
          if (e.isIntersecting) restore(img);
          else release(img);
        }
      },
      { rootMargin: `${KEEP_MARGIN} 0px` }
    );
    return io.current;
  }, []);

  useEffect(
    () => () => {
      ro.current?.disconnect();
      io.current?.disconnect();
    },
    []
  );

  function makeImgProps(id: string) {
    return {
      onLoad: (e: { currentTarget: HTMLImageElement }) => onImgLoad(id, e.currentTarget),
      ref: (el: HTMLImageElement | null) => {
        const prev = imgs.current.get(id);
        if (prev && prev !== el) io.current?.unobserve(prev);
        if (!el) {
          imgs.current.delete(id);
          return;
        }
        imgs.current.set(id, el);
        watcher().observe(el);
        // Ảnh nằm sẵn trong bộ nhớ đệm (hoặc tải xong trước khi React gắn tay
        // xử lý) thì sự kiện load KHÔNG bắn nữa — đo qua ref mới không sót.
        if (el.complete && el.naturalWidth > 1) onImgLoad(id, el);
      },
    };
  }

  /** Props gắn vào thẻ <img> của một ô ảnh. */
  const imgProps = useCallback(
    (id: string) => {
      let p = imgPropsCache.current.get(id);
      if (!p) {
        p = makeImgProps(id);
        imgPropsCache.current.set(id, p);
      }
      return p;
    },
    // makeImgProps chỉ dùng ref + onImgLoad (đều ổn định) nên không cần phụ thuộc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Ref gắn vào Ô ẢNH — chỗ nhận số dòng lưới khi đo xong, không qua React. */
  const tileRef = useCallback(
    (id: string) => {
      let f = tileRefs.current.get(id);
      if (!f) {
        f = (el: HTMLElement | null) => {
          if (!el) {
            tiles.current.delete(id);
            return;
          }
          tiles.current.set(id, el);
          applySpan(id);
        };
        tileRefs.current.set(id, f);
      }
      return f;
    },
    [applySpan]
  );

  /**
   * Style cho MỘT ô ảnh ở lượt dựng đầu (sau đó `tileRef` lo cập nhật).
   *
   * ĐÃ THỬ `content-visibility: auto` ở đây (kèm `contain-intrinsic-size` theo
   * số dòng lưới) — nghe thì đúng bài "ô ngoài khung nhìn khỏi vẽ", nhưng ĐO RA
   * CHẬM HƠN HẲN trên chính lưới này (1200 ô, khổ iPhone, `npm run ui:luoi-anh`
   * + đo bằng Performance.getMetrics):
   *     layout   127 lần / 0,41s  →  2203 lần / 2,97s
   *     style     85 lần / 0,28s  →  2172 lần / 0,66s
   *     tác vụ dài  8 lượt / 425ms →  1 lượt / 1886ms
   * Lý do: ô ra vào "vùng đáng vẽ" liên tục khi cuộn, mỗi lần đổi trạng thái là
   * một lần xếp lại — với hàng nghìn ô thì tiền xếp lại đắt hơn tiền vẽ tiết
   * kiệm được. Đừng thêm lại nếu không đo lại và thấy số khác.
   */
  const tileStyle = useCallback(
    (id: string): CSSProperties => ({ gridRowEnd: `span ${spanOf(id)}` }),
    [spanOf]
  );

  /** Style cho khung lưới (số cột đặt bằng class grid-cols-* để theo breakpoint). */
  const gridStyle: CSSProperties = { gridAutoRows: `${ROW}px`, gap: `${MASONRY_GAP}px` };

  return { ref, gridStyle, tileStyle, tileRef, imgProps };
}
