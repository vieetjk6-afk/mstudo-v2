"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarRange, Copy, Percent, Tags, Trophy, UserCog, UserPlus, UsersRound } from "lucide-react";
import { PageHead, Stack, Stat, StatGrid, btn } from "@/components/v2/kit";
import { Menu, Tabs } from "@/components/v2/kit-client";
import { useStaff } from "./useStaff";
import { useStaffTab, type StaffTab } from "./useStaffTab";
import { StaffCreateDrawer, StaffPanelV2 } from "./StaffManagerV2";
import RankingListV2 from "./RankingListV2";
import { useCrew } from "../crew/useCrew";
import { CrewAddDrawerV2, CrewDrawerV2, CrewPanelV2 } from "../crew/CrewManagerV2";
import CrewRolesDrawerV2 from "../crew/CrewRolesPanelV2";
import type { StaffAndCrewProps } from "./StaffAndCrew";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÂN SỰ — giao diện mới. Cùng dữ liệu, cùng thao tác, cùng phân quyền với
   StaffAndCrew (bản cũ); khác ở cách sắp xếp:
     • Đầu trang: một câu mô tả + nút chính ĐỔI THEO TAB (Tạo nhân viên / Thêm
       thợ), thao tác phụ của sổ thợ (vai trò thợ, link đăng ký, lịch đội ngũ)
       vào nút phụ và menu ⋯.
     • 4 số liệu chung: tài khoản · thợ trong sổ · buổi thợ đã nhận · tỉ lệ nhận.
     • Ba tab gạch chân (Nhân viên & phân quyền · Đội ngũ thợ · Xếp hạng), giữ
       ?tab= trên URL như bản cũ. Người không quản tài khoản (quản lý chi nhánh)
       chỉ thấy sổ thợ, không có thanh tab — đúng như bản cũ.
     • Trạng thái của từng tab nằm ở màn cha, nên chuyển tab không mất gì.
   ═══════════════════════════════════════════════════════════════════════════ */

type Sheet = null | "staff-new" | "crew-new" | "roles";

export default function StaffAndCrewV2({ staffProps, crewProps, canSeeStaffTab, ranked }: StaffAndCrewProps) {
  const { tab, go } = useStaffTab(canSeeStaffTab);
  const staff = useStaff(staffProps.initial);
  const crew = useCrew(crewProps);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [copied, setCopied] = useState(false);

  // Số liệu: chỉ tính trên dữ liệu người xem đang được thấy.
  const lockedCount = staff.list.filter((s) => !s.is_active).length;
  const inBook = crew.list.filter((c) => c.status !== "pending").length;
  let accepted = 0;
  let invites = 0;
  for (const c of crew.list) {
    const s = crew.statFor(c.phone);
    if (s) {
      accepted += s.accepted;
      invites += s.total;
    }
  }
  const rate = invites ? Math.round((accepted / invites) * 100) : 0;

  const openSheet = (s: Sheet) => {
    staff.setErr(null);
    crew.setErr(null);
    setSheet(s);
  };

  function copyRegister() {
    navigator.clipboard?.writeText(crewProps.registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const actions =
    tab === "staff" && canSeeStaffTab ? (
      staffProps.canManageRoles ? (
        <button type="button" onClick={() => openSheet("staff-new")} className={btn("primary")}>
          <UserPlus size={17} /> Tạo nhân viên
        </button>
      ) : null
    ) : tab === "ranking" && canSeeStaffTab ? null : (
      <>
        <Menu
          label="Thao tác khác với sổ thợ"
          width={250}
          items={[
            {
              label: copied ? "Đã chép link" : "Chép link đăng ký cho thợ",
              hint: "Thợ tự khai thông tin và xin vào sổ",
              icon: Copy,
              disabled: !crewProps.registerUrl,
              onClick: copyRegister,
            },
            { label: "Lịch đội ngũ", hint: "Ai bận, ai rảnh trong tuần", icon: CalendarRange, href: "/dashboard/studio/calendar?tab=team" },
          ]}
        />
        <button type="button" onClick={() => openSheet("roles")} className={btn("secondary")}>
          <Tags size={16} /> <span className="hidden sm:inline">Vai trò thợ</span><span className="sm:hidden">Vai trò</span>
        </button>
        <button type="button" onClick={() => openSheet("crew-new")} className={btn("primary")}>
          <UserPlus size={17} /> Thêm thợ
        </button>
      </>
    );

  const crewCountLabel = (
    <>
      Đội ngũ thợ
      {crew.pending.length ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--am)" }} title={`${crew.pending.length} thợ chờ duyệt`} /> : null}
    </>
  );

  return (
    <Stack>
      <PageHead
        desc={
          tab === "crew" || !canSeeStaffTab ? (
            <>
              Thợ freelancer lưu theo số điện thoại, xem việc của mình ở trang <b>/crew</b>.{" "}
              <Link href="/dashboard/studio/calendar?tab=team" className="font-semibold" style={{ color: "var(--ac)" }}>Lịch cả đội</Link>
            </>
          ) : tab === "ranking" ? (
            "Ai nhận nhiều buổi nhất và kiếm được bao nhiêu từ studio."
          ) : (
            "Tài khoản đăng nhập của studio. Bấm vào một người để đổi vai trò hoặc chi nhánh."
          )
        }
        actions={actions}
      />

      <StatGrid cols={canSeeStaffTab ? 4 : 3}>
        {canSeeStaffTab ? (
          <Stat
            icon={UserCog}
            tone="brand"
            label="Nhân viên"
            value={staff.list.length}
            sub={lockedCount ? `${lockedCount} tài khoản đã khoá` : "Đều đăng nhập được"}
          />
        ) : null}
        <Stat
          icon={UsersRound}
          tone="blue"
          label="Thợ trong sổ"
          value={inBook}
          sub={crew.pending.length ? `${crew.pending.length} thợ đang chờ duyệt` : "Không có ai chờ duyệt"}
        />
        <Stat icon={CalendarCheck2} tone="green" label="Buổi đã nhận" value={accepted} sub={`Trên ${invites} lời mời đã gửi`} />
        <Stat icon={Percent} tone="amber" label="Tỉ lệ nhận" value={invites ? `${rate}%` : "—"} sub="Buổi nhận / lời mời" />
      </StatGrid>

      {canSeeStaffTab ? (
        <Tabs<StaffTab>
          label="Nhân sự"
          value={tab}
          onChange={go}
          options={[
            { value: "staff", label: "Nhân viên & phân quyền", icon: UserCog, count: staff.list.length },
            { value: "crew", label: crewCountLabel, icon: UsersRound, count: crew.list.length },
            { value: "ranking", label: "Xếp hạng", icon: Trophy, count: ranked.length },
          ]}
        />
      ) : null}

      {tab === "ranking" && canSeeStaffTab ? (
        <RankingListV2 ranked={ranked} crewRoles={crew.roles} />
      ) : tab === "staff" && canSeeStaffTab ? (
        <StaffPanelV2
          s={staff}
          branches={staffProps.branches}
          canManageRoles={staffProps.canManageRoles}
          canAssignBranch={staffProps.canAssignBranch}
          lockedBranchName={staffProps.lockedBranchName}
        />
      ) : (
        <CrewPanelV2
          c={crew}
          registerUrl={crewProps.registerUrl}
          registerError={crewProps.registerError}
          branches={crewProps.branches}
          hideErr={sheet !== null || crew.editId !== null}
        />
      )}

      <StaffCreateDrawer s={staff} open={sheet === "staff-new"} onClose={() => setSheet(null)} branches={staffProps.branches} />
      <CrewAddDrawerV2 c={crew} open={sheet === "crew-new"} onClose={() => setSheet(null)} branches={crewProps.branches} />
      <CrewDrawerV2 c={crew} branches={crewProps.branches} />
      <CrewRolesDrawerV2
        open={sheet === "roles"}
        onClose={() => setSheet(null)}
        ownerId={crewProps.ownerId}
        roles={crew.roles}
        onChange={crew.setRoles}
        canEdit={crewProps.canEditCrewRoles}
      />
      {staff.toastNode}
    </Stack>
  );
}
