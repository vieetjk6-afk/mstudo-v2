"use client";

import dynamic from "next/dynamic";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AiProvidersEditor from "@/components/AiProvidersEditor";
import SystemPanel from "./SystemPanel";
import AdminDriveCard from "./AdminDriveCard";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const SystemV2 = dynamic(() => import("./SystemV2"));

/**
 * Màn "Cài đặt hệ thống": giao diện mới (SystemV2 — mục lục trái + từng khối)
 * hay bản cũ (SystemPanel, thẻ Drive, thẻ AI xếp chồng). Đổi KIỂU component
 * chứ không rẽ nhánh sau hook — xem UiV2Context.
 */
export default function SystemScreen() {
  return useUiV2() ? (
    <SystemV2 ai={<AiProvidersEditor scope="shared" />} />
  ) : (
    <div className="space-y-6">
      <SystemPanel />
      <AdminDriveCard />
      <AiProvidersEditor scope="shared" />
    </div>
  );
}
