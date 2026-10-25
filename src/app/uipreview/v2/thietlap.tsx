/* Màn xem trước GIAO DIỆN MỚI của nhóm "thietlap" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import StaffAndCrew from "@/app/dashboard/studio/staff/StaffAndCrew";
import type { RankRow } from "@/app/dashboard/studio/staff/RankingList";
import type { StudioCrew } from "@/lib/types";
import type { CrewRoleRow } from "@/lib/crew-roles";

type Screen = { title: string; render: () => React.ReactNode; bare?: boolean };

/* ── Nhân sự ─────────────────────────────────────────────────────────────── */
const D = "2026-10-01";
const crew: StudioCrew[] = [
  ...f.roster,
  { id: "sc3", owner_id: "o1", name: "Phan Đức Long", phone: "0933555777", role: "cameraman", note: "Có flycam", branch_id: "b2", created_at: `${D}T00:00:00Z`, email: "long@gmail.com", skills: "Quay phóng sự, dựng" },
  { id: "sc4", owner_id: "o1", name: "Ngô Bảo Châu", phone: "0912888999", role: "makeup", note: null, branch_id: null, created_at: `${D}T00:00:00Z` },
  { id: "sc5", owner_id: "o1", name: "Đinh Thị Mai", phone: "0977666555", role: "photographer", note: null, branch_id: null, created_at: `${D}T00:00:00Z`, status: "pending" },
  { id: "sc6", owner_id: "o1", name: "Vũ Hoàng", phone: "0909000111", role: "c_flycam1", note: "Chỉ nhận cuối tuần", branch_id: "b1", created_at: `${D}T00:00:00Z` },
];
const crewStats = {
  "0987654321": { total: 14, accepted: 12, declined: 1 },
  "0901112223": { total: 9, accepted: 5, declined: 3 },
  "0933555777": { total: 6, accepted: 6, declined: 0 },
  "0909000111": { total: 4, accepted: 1, declined: 2 },
};
const crewRoles: CrewRoleRow[] = [
  { key: "c_flycam1", label: "Flycam", kinds: ["shoot", "combo"], active: true, position: 7 },
  { key: "makeup", label: "Trang điểm cô dâu", kinds: ["makeup", "combo"], active: true, position: 3 },
];
const ranked: RankRow[] = [
  { key: "0987654321", name: "Trần Minh Quân", role: "photographer", jobs: 14, accepted: 12, earned: 18_400_000 },
  { key: "0933555777", name: "Phan Đức Long", role: "cameraman", jobs: 6, accepted: 6, earned: 12_000_000 },
  { key: "0901112223", name: "Lê Thị Hồng Nhung Phương Thảo", role: "assistant", jobs: 9, accepted: 5, earned: 4_500_000 },
  { key: "0909000111", name: "Vũ Hoàng", role: "c_flycam1", jobs: 4, accepted: 1, earned: 1_500_000 },
];
const staffProps = (over: Partial<Parameters<typeof StaffAndCrew>[0]["staffProps"]> = {}) => ({
  initial: [
    ...f.staffRows,
    { id: "u4", email: "linh@maistudio.vn", full_name: "Đặng Mỹ Linh", studio_role: "branch_manager", studio_branch_id: null, is_active: true, created_at: "2026-08-02T03:00:00Z" },
  ],
  branches: f.branches,
  canManageRoles: true,
  canAssignBranch: true,
  lockedBranchName: null,
  ...over,
});
const crewProps = (over: Partial<Parameters<typeof StaffAndCrew>[0]["crewProps"]> = {}) => ({
  ownerId: "o1",
  initial: crew,
  stats: crewStats,
  registerUrl: "https://mstudo.com/crew/join/7f3k9p2m",
  registerError: null,
  branches: f.branches,
  crewRoles,
  canEditCrewRoles: true,
  ...over,
});

export const SCREENS_THIETLAP: Record<string, Screen> = {
  "v2-nhan-su": {
    title: "Giao diện mới — Nhân sự (nhân viên & phân quyền)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps()} crewProps={crewProps()} ranked={ranked} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-quan-ly": {
    title: "Giao diện mới — Nhân sự (quản lý: không đổi được vai trò)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps({ canManageRoles: false })} crewProps={crewProps({ canEditCrewRoles: true })} ranked={ranked} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-chi-nhanh": {
    title: "Giao diện mới — Sổ thợ (quản lý chi nhánh: chỉ thấy tab thợ)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew
          canSeeStaffTab={false}
          staffProps={staffProps({ canManageRoles: false, canAssignBranch: false, lockedBranchName: "Cơ sở Quận 1" })}
          crewProps={crewProps({ canEditCrewRoles: false, registerUrl: "", registerError: "column profiles.crew_token does not exist" })}
          ranked={ranked}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-trong": {
    title: "Giao diện mới — Nhân sự (chưa có ai)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps({ initial: [] })} crewProps={crewProps({ initial: [], stats: {} })} ranked={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
};
