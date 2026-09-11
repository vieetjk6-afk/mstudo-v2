"use client";

import { createContext, useContext, useMemo } from "react";

/**
 * Chế độ XEM TRƯỚC: bật khi thiệp được render bên trong trình chỉnh sửa
 * (khung điện thoại cạnh form) thay vì trang thiệp thật.
 *
 * - `preview`  : khối cố định (nút nhạc) chuyển sang dính trong khung, form
 *                RSVP không gửi dữ liệu thật, bì thư mở thiệp bị bỏ qua.
 * - `thumb`    : ảnh thu nhỏ trong bộ chọn mẫu — tắt luôn animation nặng và
 *                mọi tương tác.
 */
export type PreviewState = { preview: boolean; thumb: boolean };

const PreviewCtx = createContext<PreviewState>({ preview: false, thumb: false });

export function PreviewProvider({ preview = true, thumb = false, children }: { preview?: boolean; thumb?: boolean; children: React.ReactNode }) {
  const value = useMemo(() => ({ preview, thumb }), [preview, thumb]);
  return <PreviewCtx.Provider value={value}>{children}</PreviewCtx.Provider>;
}

export function usePreview(): PreviewState {
  return useContext(PreviewCtx);
}
