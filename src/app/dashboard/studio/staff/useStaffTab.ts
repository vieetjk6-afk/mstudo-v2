"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* Tab đang mở của màn Nhân sự — dùng chung cho bản cũ (StaffAndCrew) và bản mới
 * (StaffAndCrewV2). Tab lưu vào query string (?tab=crew): link trong ⌘K và route
 * /crew cũ trỏ thẳng vào tab thợ được, tải lại trang không bị nhảy về tab đầu. */

export type StaffTab = "staff" | "crew" | "ranking";

export function useStaffTab(canSeeStaffTab: boolean) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("tab");
  const fromUrl: StaffTab = q === "crew" ? "crew" : q === "ranking" ? "ranking" : "staff";
  const [tab, setTab] = useState<StaffTab>(canSeeStaffTab ? fromUrl : "crew");

  function go(next: StaffTab) {
    setTab(next);
    // replace (không push): bấm qua lại giữa hai tab không nên nhồi lịch sử
    // trình duyệt, nút Back phải đưa về màn TRƯỚC đó.
    router.replace(next === "staff" ? "/dashboard/studio/staff" : `/dashboard/studio/staff?tab=${next}`, { scroll: false });
  }

  return { tab, go };
}
