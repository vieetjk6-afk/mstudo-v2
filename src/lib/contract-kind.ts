import type { ShootType } from "@/lib/types";

/**
 * PHÂN LOẠI HỢP ĐỒNG — gom các gói dịch vụ thành ba nhóm làm việc khác nhau.
 *
 * Vì sao cần: studio ảnh cưới bán hai nghề khác hẳn nhau. Hợp đồng chụp thì
 * việc là chọn ảnh → sửa ảnh → giao album. Hợp đồng makeup / thuê đồ thì việc
 * là thử đồ → giữ đồ → trả đồ → hoàn cọc, không có tấm ảnh nào để chọn. Trước
 * bản này app chỉ có MỘT danh sách hạng mục và MỘT danh sách việc gieo cho mọi
 * hợp đồng: hợp đồng chụp vẫn hiện chip "Makeup cô dâu", còn hợp đồng makeup bị
 * gieo sẵn "Chọn ảnh, Chỉnh sửa ảnh" — studio phải xoá tay từng dòng.
 *
 * KHÔNG thêm trường mới vào database: suy thẳng từ `studio_contracts.shoot_type`
 * vốn đã có. Thêm một trường "loại hợp đồng" song song thì hai trường cùng nói
 * một chuyện và sớm muộn cũng lệch nhau (hợp đồng loại Makeup mà gói dịch vụ
 * lại là Chụp ảnh), không ai biết tin cái nào.
 */
export type ContractKind = "shoot" | "makeup" | "combo";

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  shoot: "Chụp / quay",
  makeup: "Makeup & thuê đồ",
  combo: "Trọn gói",
};

/**
 * Gói dịch vụ → nhóm. `other` ("Khác") về nhóm chụp vì đây là app cho studio
 * ảnh: gói không tên thì khả năng cao vẫn là việc chụp.
 */
export function contractKind(shootType: ShootType | null | undefined): ContractKind {
  switch (shootType) {
    case "makeup":
    case "rental":
      return "makeup";
    case "wedding":       // "Trọn gói ngày cưới" = chụp + makeup đi cùng nhau
      return "combo";
    default:
      return "shoot";
  }
}

/** Nhóm này có thuê đồ không (váy cưới, áo dài, vest, phụ kiện). */
export function kindHasRental(kind: ContractKind): boolean {
  return kind === "makeup" || kind === "combo";
}

/** Nhóm này có việc hậu kỳ ảnh không (chọn ảnh, sửa ảnh, album). */
export function kindHasPhotoWork(kind: ContractKind): boolean {
  return kind === "shoot" || kind === "combo";
}

const ITEMS_SHOOT = [
  "Gói chụp phóng sự",
  "Quay phim phóng sự",
  "Chụp prewedding",
  "Album in",
  "Ảnh phóng ép gỗ",
  "Thêm thợ chụp",
  "Thêm giờ",
];

const ITEMS_MAKEUP = [
  "Makeup cô dâu",
  "Makeup mẹ / họ nhà",
  "Làm tóc",
  "Thuê váy cưới",
  "Thuê áo dài",
  "Thuê vest chú rể",
  "Phụ kiện (mấn, voan, giày)",
  "Đi tỉnh / ngoài giờ",
];

/**
 * Hạng mục gợi ý (viên "Thêm nhanh") theo từng nhóm.
 *
 * Trọn gói = hợp của hai nhóm kia, KHÔNG phải một danh sách viết tay riêng:
 * viết tay thì mỗi lần sửa một bên là hai bên lệch nhau.
 */
export const PRESET_ITEMS_BY_KIND: Record<ContractKind, string[]> = {
  shoot: ITEMS_SHOOT,
  makeup: ITEMS_MAKEUP,
  combo: ["Trọn gói ngày cưới", ...ITEMS_SHOOT, ...ITEMS_MAKEUP],
};

const TASKS_SHOOT = ["Chọn ảnh", "Chỉnh sửa ảnh", "Duyệt cùng khách", "Giao sản phẩm"];
const TASKS_MAKEUP = ["Chốt mẫu tóc & makeup", "Thử đồ", "Giữ đồ cho ngày cưới", "Trả đồ & kiểm đồ", "Hoàn cọc đồ"];

/**
 * Việc gieo sẵn khi tạo hợp đồng. Đây là danh sách NGẮN, đúng việc phải làm —
 * gieo thừa thì studio phải xoá tay, mà xoá tay thì lần sau họ bỏ luôn không
 * dùng checklist nữa.
 */
export const DEFAULT_TASKS_BY_KIND: Record<ContractKind, string[]> = {
  shoot: TASKS_SHOOT,
  makeup: TASKS_MAKEUP,
  combo: [...TASKS_MAKEUP, ...TASKS_SHOOT],
};

/** Việc gợi ý thêm (viên bấm để chèn) — rộng hơn danh sách gieo sẵn. */
export const PRESET_TASKS_BY_KIND: Record<ContractKind, string[]> = {
  shoot: ["Liên hệ xác nhận lịch", "Chuẩn bị thiết bị", "Chụp / Quay", ...TASKS_SHOOT, "Làm album / video", "Xin đánh giá"],
  makeup: ["Liên hệ xác nhận lịch", "Chốt lịch thử đồ", ...TASKS_MAKEUP, "Giặt / bảo trì đồ", "Xin đánh giá"],
  combo: [
    "Liên hệ xác nhận lịch",
    "Chốt lịch thử đồ",
    ...TASKS_MAKEUP,
    "Chụp / Quay",
    ...TASKS_SHOOT,
    "Làm album / video",
    "Xin đánh giá",
  ],
};

/**
 * Gói dịch vụ xếp theo nhóm — dùng để chia ô chọn thành các mục có tiêu đề,
 * cho studio thấy ngay "Trang điểm" thuộc nhóm nào.
 *
 * Suy ra từ SHOOT_TYPES + contractKind() chứ không viết tay: thêm một gói dịch
 * vụ mới mà quên thêm vào đây thì nó biến mất khỏi ô chọn.
 */
export function shootTypesByKind(all: ShootType[]): Record<ContractKind, ShootType[]> {
  const ra: Record<ContractKind, ShootType[]> = { shoot: [], makeup: [], combo: [] };
  for (const t of all) ra[contractKind(t)].push(t);
  return ra;
}
