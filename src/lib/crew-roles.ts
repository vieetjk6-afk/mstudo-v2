/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREW_ROLE_LABEL, type BuiltinCrewRole } from "./types.ts";
import { CREW_ROLES_BY_KIND, type ContractKind } from "./contract-kind.ts";
import { phanLoaiLoi } from "./pg-loi.ts";

/**
 * VAI TRÒ THỢ STUDIO TỰ ĐẶT — một chỗ duy nhất để ra chữ hiển thị và danh sách
 * cho ô chọn.
 *
 * Vì sao cần: bảy vai trò có sẵn (Photographer, Trang điểm, …) không đủ cho mọi
 * studio — có nơi cần "Flycam", "Stylist", "MC", "Thợ in album". Trước bản này
 * họ chỉ còn cách chọn "Khác", rồi bảng lương, cổng thợ, tin Zalo đều hiện "Khác".
 *
 * Bảng `studio_crew_roles` (migration vai_tro_tho_tu_dat.sql) giữ HAI loại dòng:
 *
 *   • key = một khoá có sẵn (vd "makeup")  → ĐÈ vai trò có sẵn: đổi tên
 *     (label khác rỗng), ẩn khỏi ô chọn (active = false), đổi thứ tự.
 *   • key = "c_xxxxxx"                      → vai trò studio tự thêm, kèm danh
 *     sách nhóm hợp đồng (kinds) mà nó hiện ra.
 *
 * Ẩn / xoá mềm chỉ bỏ khỏi Ô CHỌN. Chữ hiển thị vẫn tra được — hợp đồng cũ đã
 * gán vai trò đó không được đột nhiên hiện ra "c_8k2m1q".
 *
 * File này KHÔNG nhập gì của app ngoài lib thuần, để node test được thẳng
 * (desktop/test/crew-roles.mjs).
 */

export type CrewRoleRow = {
  id?: string;
  key: string;
  /** Rỗng trên dòng đè vai trò có sẵn = giữ tên mặc định. */
  label: string;
  kinds: ContractKind[] | string[] | null;
  active: boolean;
  position: number;
};

/** Danh sách dòng của studio, hoặc rỗng/không có = chỉ dùng vai trò có sẵn. */
export type CrewRoleList = readonly CrewRoleRow[] | null | undefined;

export type CrewRoleOption = {
  key: string;
  label: string;
  builtin: boolean;
  /** Nhóm hợp đồng mà vai trò hiện trong ô chọn. */
  kinds: ContractKind[];
  /** false = đã ẩn (vai trò có sẵn) hoặc đã xoá mềm (vai trò tự đặt). */
  active: boolean;
  position: number;
};

export const ALL_CONTRACT_KINDS: ContractKind[] = ["shoot", "makeup", "combo"];

/**
 * Bảy khoá có sẵn, theo thứ tự mặc định. Lấy thứ tự của nhóm trọn gói (đủ mọi
 * vai trò) để ô chọn của từng nhóm, khi studio chưa sắp lại gì, ra ĐÚNG như
 * CREW_ROLES_BY_KIND — y như trước khi có vai trò tự đặt.
 */
export const BUILTIN_CREW_ROLES: BuiltinCrewRole[] = [
  ...CREW_ROLES_BY_KIND.combo,
  ...(Object.keys(CREW_ROLE_LABEL) as BuiltinCrewRole[]).filter((k) => !CREW_ROLES_BY_KIND.combo.includes(k)),
];

/**
 * "Khác" KHÔNG ẩn được: là lối thoát cuối cùng của mọi ô chọn. Ẩn nó đi thì
 * studio gặp một việc lạ là không còn chỗ nào để chọn.
 */
export const UNHIDEABLE_CREW_ROLE: BuiltinCrewRole = "other";

export function isBuiltinCrewRole(key: string | null | undefined): key is BuiltinCrewRole {
  return !!key && Object.prototype.hasOwnProperty.call(CREW_ROLE_LABEL, key);
}

function kindsOfBuiltin(key: BuiltinCrewRole): ContractKind[] {
  return ALL_CONTRACT_KINDS.filter((k) => CREW_ROLES_BY_KIND[k].includes(key));
}

function cleanKinds(v: CrewRoleRow["kinds"]): ContractKind[] {
  const list = Array.isArray(v) ? v : [];
  return ALL_CONTRACT_KINDS.filter((k) => list.includes(k));
}

/**
 * Chữ hiển thị của một vai trò.
 * Thứ tự: tên studio đặt (đè hoặc tự thêm) → tên có sẵn → chính khoá thô.
 */
export function crewRoleLabel(key: string | null | undefined, custom?: CrewRoleList): string {
  if (!key) return "";
  const row = custom?.find((r) => r.key === key);
  const own = row?.label?.trim();
  if (own) return own;
  if (isBuiltinCrewRole(key)) return CREW_ROLE_LABEL[key];
  return key;
}

/**
 * Toàn bộ vai trò của studio (cả đã ẩn), đã gộp dòng đè, xếp theo thứ tự.
 * Dùng cho khối quản lý vai trò; ô chọn thì dùng `crewRolesFor`.
 *
 * Vai trò có sẵn chưa có dòng đè đứng ở vị trí 0..6 theo thứ tự mặc định; vai
 * trò tự thêm mặc định xếp sau. Bằng vị trí thì có sẵn đứng trước.
 */
export function allCrewRoles(custom?: CrewRoleList): CrewRoleOption[] {
  const rows = custom ?? [];
  const out: CrewRoleOption[] = BUILTIN_CREW_ROLES.map((key, i) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      label: crewRoleLabel(key, rows),
      builtin: true,
      kinds: kindsOfBuiltin(key),
      active: key === UNHIDEABLE_CREW_ROLE ? true : row ? row.active !== false : true,
      position: row && Number.isFinite(row.position) ? row.position : i,
    };
  });
  for (const r of rows) {
    if (!r.key || isBuiltinCrewRole(r.key)) continue;
    if (out.some((o) => o.key === r.key)) continue;
    out.push({
      key: r.key,
      label: crewRoleLabel(r.key, rows),
      builtin: false,
      kinds: cleanKinds(r.kinds),
      active: r.active !== false,
      position: Number.isFinite(r.position) ? r.position : 1000,
    });
  }
  return out
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.position - b.o.position || Number(b.o.builtin) - Number(a.o.builtin) || a.i - b.i)
    .map((x) => x.o);
}

/**
 * Vai trò cho ô chọn.
 *
 * `kind` = nhóm hợp đồng (null = mọi nhóm, dùng cho sổ thợ chưa gắn hợp đồng).
 * `keep` = giá trị đang chọn: nếu nó đã bị ẩn hoặc không thuộc nhóm này thì vẫn
 * thêm vào cuối, kẻo ô chọn tự nhảy sang giá trị khác và lần lưu sau âm thầm đổi
 * vai trò của thợ.
 */
export function crewRolesFor(
  kind: ContractKind | null | undefined,
  custom?: CrewRoleList,
  keep?: string | null
): { key: string; label: string }[] {
  const all = allCrewRoles(custom);
  const list = all
    .filter((o) => o.active && (!kind || o.kinds.includes(kind)))
    .map((o) => ({ key: o.key, label: o.label }));
  if (keep && !list.some((o) => o.key === keep)) list.push({ key: keep, label: crewRoleLabel(keep, custom) });
  return list;
}

/**
 * Khoá cho vai trò tự thêm: `c_` + 8 ký tự ngẫu nhiên. Tiền tố riêng nên không
 * bao giờ trùng khoá có sẵn, kể cả khi app thêm vai trò có sẵn mới về sau.
 */
export function newCrewRoleKey(rand: () => number = Math.random): string {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(rand() * abc.length) % abc.length];
  return `c_${s}`;
}

/**
 * Đọc vai trò của MỘT studio. `db` là client Supabase bất kỳ (trình duyệt qua
 * RLS, hoặc service-role phía server — đã lọc theo owner_id ngay ở đây).
 *
 * Chưa chạy migration (bảng chưa có) hay lỗi gì khác → trả rỗng = chỉ vai trò
 * có sẵn. Một bảng phụ cho chữ hiển thị không được làm hỏng cả trang.
 */
export async function loadCrewRoles(db: any, ownerId: string | null | undefined): Promise<CrewRoleRow[]> {
  if (!ownerId) return [];
  const m = await loadCrewRolesMany(db, [ownerId]);
  return m.get(ownerId) ?? [];
}

/** Như `loadCrewRoles` nhưng cho nhiều studio một lượt (cron, cổng thợ). */
export async function loadCrewRolesMany(db: any, ownerIds: (string | null | undefined)[]): Promise<Map<string, CrewRoleRow[]>> {
  const ids = Array.from(new Set(ownerIds.filter((x): x is string => !!x)));
  const out = new Map<string, CrewRoleRow[]>();
  if (!ids.length) return out;
  try {
    const { data, error } = await db
      .from("studio_crew_roles")
      .select("id, owner_id, key, label, kinds, active, position")
      .in("owner_id", ids)
      .order("position");
    if (error) {
      if (phanLoaiLoi(error) !== "thieu-bang") console.warn("[crew-roles] không đọc được vai trò:", error.message);
      return out;
    }
    for (const r of (data ?? []) as (CrewRoleRow & { owner_id: string })[]) {
      const list = out.get(r.owner_id) ?? [];
      list.push({ id: r.id, key: r.key, label: r.label ?? "", kinds: r.kinds ?? [], active: r.active !== false, position: r.position ?? 0 });
      out.set(r.owner_id, list);
    }
  } catch {
    /* mất mạng / client lạ: lùi về vai trò có sẵn */
  }
  return out;
}
