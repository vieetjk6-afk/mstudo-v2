"use client";

import { useState } from "react";
import { retryAltHost } from "@/lib/drive";

/**
 * <img> cho ẢNH BÌA album (thẻ thư viện album, bộ sưu tập ngoài website, trang
 * duyệt album). Hỏng thì tự thử các host Google còn lại (retryAltHost); hết
 * đường thì ẩn ảnh đi để lộ nền ô phía sau — không hiện icon ảnh vỡ "?".
 *
 * Dùng được trong server component (vd SiteRenderer) vì phần onError nằm ở đây.
 */
export default function CoverImg(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // Gắn với src: đổi ảnh bìa thì <img> mới (key) và trạng thái hỏng reset.
  const src = String(props.src ?? "");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      key={src}
      {...props}
      style={failed ? { ...props.style, visibility: "hidden" } : props.style}
      onError={(e) => {
        if (!retryAltHost(e)) setFailedSrc(src);
      }}
    />
  );
}
