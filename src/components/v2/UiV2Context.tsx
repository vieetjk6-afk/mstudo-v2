"use client";

import { createContext, useContext } from "react";

/**
 * Cho component CLIENT biết đang ở giao diện mới. StudioShellV2 bọc nội dung
 * trong provider này; ngoài khung mới giá trị luôn là false.
 *
 * Cách dùng ở một màn client có bản V2 — đổi KIỂU component chứ không rẽ nhánh
 * giữa chừng, để React gỡ hẳn cây cũ khi người dùng bấm chuyển giao diện
 * (router.refresh giữ nguyên state client, rẽ nhánh sau các hook sẽ làm lệch
 * thứ tự hook):
 *
 *   export default function FooView(props) {
 *     return useUiV2() ? <FooViewV2 {...props} /> : <FooViewV1 {...props} />;
 *   }
 *
 * Màn SERVER thì dùng `isUiV2()` ở @/lib/ui-server.
 */
const Ctx = createContext(false);

export function UiV2Provider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={true}>{children}</Ctx.Provider>;
}

export function useUiV2(): boolean {
  return useContext(Ctx);
}
