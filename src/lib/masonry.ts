"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Khe giữa các ảnh (px) — hẹp để lưới liền mạch, nhưng đủ tách từng tấm. */
export const MASONRY_GAP = 6;
/** Dòng lưới rất mảnh: ảnh chiếm bao nhiêu dòng thì cao bấy nhiêu. */
const ROW = 4;
/** Tỉ lệ tạm (cao/rộng) cho ảnh CHƯA đo được — 3:2 nằm ngang, dạng phổ biến nhất. */
const FALLBACK_RATIO = 2 / 3;

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
 * `ref` gắn vào khung BAO các lưới (mọi mục con rộng bằng nhau) — chỉ cần đo
 * một chỗ là đủ cho tất cả.
 */
export function useMasonry(colsMobile = 2, colsDesktop = 4) {
  const [colWidth, setColWidth] = useState(0);
  const node = useRef<HTMLElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const ratios = useRef(new Map<string, number>());
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bề rộng một cột = bề rộng lưới trừ khe, chia số cột đang dùng. Cần con số
  // này mới đổi được tỉ lệ ảnh thành số dòng lưới.
  const measure = useCallback(() => {
    const el = node.current;
    if (!el) return;
    const cols = window.matchMedia("(min-width: 768px)").matches ? colsDesktop : colsMobile;
    const w = el.clientWidth;
    if (w > 0) setColWidth((w - MASONRY_GAP * (cols - 1)) / cols);
  }, [colsMobile, colsDesktop]);

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

  useEffect(() => () => ro.current?.disconnect(), []);

  // Ảnh tải xong mới biết tỉ lệ thật. Gom nhiều ảnh vào MỘT lần dựng lại:
  // album cưới vài nghìn tấm, mỗi tấm một lần setState là đứng máy.
  const onImgLoad = useCallback((id: string, img: HTMLImageElement) => {
    if (ratios.current.has(id)) return;
    const r = img.naturalHeight / img.naturalWidth;
    if (!r || !Number.isFinite(r)) return;
    ratios.current.set(id, r);
    if (flush.current == null) {
      flush.current = setTimeout(() => {
        flush.current = null;
        bump();
      }, 80);
    }
  }, []);

  useEffect(() => () => { if (flush.current) clearTimeout(flush.current); }, []);

  /**
   * Props gắn vào thẻ <img>. Có cả `ref` chứ không chỉ `onLoad`: ảnh nằm sẵn
   * trong bộ nhớ đệm (hoặc tải xong trước khi React gắn tay xử lý) thì sự kiện
   * load KHÔNG bắn nữa, đo qua ref mới không sót.
   */
  const imgProps = useCallback(
    (id: string) => ({
      onLoad: (e: { currentTarget: HTMLImageElement }) => onImgLoad(id, e.currentTarget),
      ref: (el: HTMLImageElement | null) => {
        if (el?.complete && el.naturalWidth) onImgLoad(id, el);
      },
    }),
    [onImgLoad]
  );

  /** Style cho MỘT ô ảnh: chiếm bao nhiêu dòng lưới. */
  const tileStyle = useCallback(
    (id: string): CSSProperties => {
      const r = ratios.current.get(id) ?? FALLBACK_RATIO;
      const h = (colWidth || 200) * r;
      const span = Math.max(1, Math.round((h + MASONRY_GAP) / (ROW + MASONRY_GAP)));
      return { gridRowEnd: `span ${span}` };
    },
    [colWidth]
  );

  /** Style cho khung lưới (số cột đặt bằng class grid-cols-* để theo breakpoint). */
  const gridStyle: CSSProperties = { gridAutoRows: `${ROW}px`, gap: `${MASONRY_GAP}px` };

  return { ref, gridStyle, tileStyle, imgProps };
}
