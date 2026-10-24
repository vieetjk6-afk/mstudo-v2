"use client";

import { useEffect, useRef, type ImgHTMLAttributes } from "react";
import { retryViaProxy } from "@/lib/drive";

/**
 * Ảnh bìa album (cover_url = /api/img → 302 sang CDN Google). Google thỉnh
 * thoảng từ chối (429/403, nhất là khi một trang tải nhiều ảnh cùng lúc) →
 * khách thấy ô trống với icon ảnh hỏng, tải lại thì lúc hiện lúc không. Hỏng
 * thì thử host Google còn lại, rồi tới proxy đọc byte — bìa chỉ vài tấm mỗi
 * trang nên đi proxy không tốn bao nhiêu.
 *
 * Dùng được trong server component (SiteRenderer). Ảnh SSR có thể hỏng TRƯỚC
 * khi React gắn onError lúc hydrate → effect kiểm tra lại một lần khi mount.
 */
export default function CoverImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const im = ref.current;
    if (im && im.complete && im.naturalWidth === 0 && im.src) retryViaProxy({ currentTarget: im });
  }, []);
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img ref={ref} {...props} onError={retryViaProxy} />;
}
