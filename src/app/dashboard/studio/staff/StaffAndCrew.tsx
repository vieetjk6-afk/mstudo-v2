"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, UserCog, UsersRound } from "lucide-react";
import StaffManager, { type StaffRow } from "./StaffManager";
import RankingList, { type RankRow } from "./RankingList";
import CrewManager from "../crew/CrewManager";
import type { StudioCrew } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÂN SỰ — một màn, hai tab.

     Nhân viên & phân quyền  tài khoản đăng nhập của studio + vai trò
     Đội ngũ thợ             sổ thợ freelancer (không có tài khoản)
     Xếp hạng                ai nhận nhiều buổi nhất, kiếm được bao nhiêu

   Trước đây là hai màn riêng, mà sidebar chỉ dẫn tới một cái — cái kia phải gõ
   ⌘K mới tới. Cả hai đều trả lời cùng một câu hỏi "ai làm cho studio này", nên
   gộp lại và để sidebar trỏ vào đây.

   Tab lưu vào query string (?tab=crew) chứ không phải state đơn thuần: link
   trong ⌘K và route /crew cũ đều trỏ thẳng vào tab thợ được, và người dùng tải
   lại trang không bị nhảy về tab đầu.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "staff" | "crew" | "ranking";

export default function StaffAndCrew({
  staffProps,
  crewProps,
  /** Nhân viên/quản lý chi nhánh không quản tài khoản → chỉ mở được tab thợ. */
  canSeeStaffTab,
  ranked,
}: {
  staffProps: {
    initial: StaffRow[];
    branches: { id: string; name: string }[];
    canManageRoles: boolean;
    canAssignBranch: boolean;
    lockedBranchName: string | null;
  };
  crewProps: {
    ownerId: string;
    initial: StudioCrew[];
    stats: Record<string, { total: number; accepted: number; declined: number }>;
    registerUrl: string;
    registerError: string | null;
    branches: { id: string; name: string }[];
  };
  canSeeStaffTab: boolean;
  /** Bảng xếp hạng thợ — gộp từ màn /ranking cũ. */
  ranked: RankRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("tab");
  const fromUrl: Tab = q === "crew" ? "crew" : q === "ranking" ? "ranking" : "staff";
  const [tab, setTab] = useState<Tab>(canSeeStaffTab ? fromUrl : "crew");

  function go(next: Tab) {
    setTab(next);
    // replace (không push): bấm qua lại giữa hai tab không nên nhồi lịch sử
    // trình duyệt, nút Back phải đưa về màn TRƯỚC đó.
    router.replace(next === "staff" ? "/dashboard/studio/staff" : `/dashboard/studio/staff?tab=${next}`, { scroll: false });
  }

  const TABS: { key: Tab; label: string; icon: typeof UserCog; count: number }[] = [
    { key: "staff", label: "Nhân viên & phân quyền", icon: UserCog, count: staffProps.initial.length },
    { key: "crew", label: "Đội ngũ thợ", icon: UsersRound, count: crewProps.initial.length },
    { key: "ranking", label: "Xếp hạng", icon: Trophy, count: ranked.length },
  ];

  return (
    <div className="page-in flex flex-col gap-3.5">
      {canSeeStaffTab && (
        <div className="hscroll gap-2">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => go(t.key)}
                className="flex flex-none items-center gap-1.5 rounded-[11px] px-[15px] py-[9px] text-[13px]"
                style={
                  on
                    ? { background: "var(--acS)", border: "1px solid var(--acM)", color: "var(--ac)", fontWeight: 700 }
                    : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx2)", fontWeight: 550 }
                }
                aria-pressed={on}
              >
                <t.icon size={16} />
                {t.label}
                <span
                  className="tnum min-w-[19px] rounded-[20px] px-1.5 text-center text-[11px] font-bold"
                  style={on ? { background: "var(--ac)", color: "#fff" } : { background: "var(--bd2)", color: "var(--tx2)" }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div key={tab} className="animate-[vkFade_.3s_ease_both]">
        {tab === "ranking" ? (
          <RankingList ranked={ranked} />
        ) : tab === "staff" && canSeeStaffTab ? (
          <StaffManager {...staffProps} />
        ) : (
          <CrewManager {...crewProps} />
        )}
      </div>
    </div>
  );
}
