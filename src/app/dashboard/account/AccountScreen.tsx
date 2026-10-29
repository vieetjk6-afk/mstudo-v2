"use client";

import dynamic from "next/dynamic";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AccountPanel from "./AccountPanel";
import MfaCard from "./MfaCard";
import type { AccountProps } from "./useAccount";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const AccountV2 = dynamic(() => import("./AccountV2"));

/**
 * Màn "Tài khoản & bảo mật": giao diện mới (AccountV2 — hồ sơ, mật khẩu, xác
 * thực 2 lớp, thiết bị trong một bố cục) hay bản cũ (AccountPanel + MfaCard
 * xếp chồng). Đổi KIỂU component chứ không rẽ nhánh sau hook — xem UiV2Context.
 */
export default function AccountScreen(props: AccountProps) {
  return useUiV2() ? (
    <AccountV2 {...props} />
  ) : (
    <>
      <AccountPanel {...props} />
      <MfaCard />
    </>
  );
}
