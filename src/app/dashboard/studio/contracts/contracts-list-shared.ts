/**
 * Phần DÙNG CHUNG của danh sách hợp đồng — bản cũ (ContractsListView) và giao
 * diện mới (ContractsListV2) cùng gọi, để file Excel/CSV và các nhãn lọc của
 * hai bản luôn giống hệt nhau, không chép đôi.
 */
import {
  contractTotal,
  sumAmounts,
  CONTRACT_STATUS_LABEL,
  SHOOT_TYPE_LABEL,
} from "@/lib/types";
import type { ContractSort } from "@/lib/contract-filter";
import { CONTRACT_KIND_LABEL } from "@/lib/contract-kind";
import { stamp, type ContractExportRow } from "@/lib/studio-export";
import type { ContractRow } from "./ContractsListView";

/** Nhãn sắp xếp — nói rõ chiều để không phải đoán "gần nhất" là trước hay sau. */
export const SORT_OPTIONS: [ContractSort, string][] = [
  ["default", "Mới tạo trước"],
  ["event_asc", "Ngày thực hiện: cũ → mới"],
  ["event_desc", "Ngày thực hiện: mới → cũ"],
  ["code_asc", "Mã HĐ: A → Z"],
  ["code_desc", "Mã HĐ: Z → A"],
];

/**
 * Lọc theo NGHỀ — trục thứ hai, độc lập với tab trạng thái.
 *
 * Để riêng một dải chứ không nhồi vào hàng tab trạng thái: hai thứ trả lời hai
 * câu hỏi khác nhau ("hợp đồng nào đang chờ duyệt" và "xem việc makeup thôi"),
 * trộn vào một hàng thì thành 10 nút và người dùng không đoán được bấm cái này
 * có tắt cái kia không.
 */
export const NGHE: [string, string][] = [
  ["all", "Mọi nghề"],
  ["shoot", CONTRACT_KIND_LABEL.shoot],
  ["makeup", CONTRACT_KIND_LABEL.makeup],
  ["combo", CONTRACT_KIND_LABEL.combo],
];

/** Tiền của một hợp đồng: tổng giá trị, đã thu, % đã thu (0–100). */
export function contractMoney(c: Pick<ContractRow, "contract_items" | "contract_payments">) {
  const total = contractTotal(c.contract_items || []);
  const collected = sumAmounts(c.contract_payments || []);
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  return { total, collected, pct };
}

/**
 * Dòng dữ liệu cho file xuất ra — đúng danh sách ĐANG THẤY (tab + bộ lọc +
 * thứ tự sắp xếp), để file khớp với màn hình chứ không phải toàn bộ hợp đồng.
 */
export function contractExportRows(list: readonly ContractRow[]): ContractExportRow[] {
  return list.map((c) => {
    const { total, collected } = contractMoney(c);
    return {
      code: c.code || "",
      title: c.title,
      client: c.client_name || "",
      phone: c.client_phone || "",
      service: SHOOT_TYPE_LABEL[c.shoot_type],
      eventDate: c.event_date,
      eventTime: c.event_time,
      status: CONTRACT_STATUS_LABEL[c.status],
      crew: (c.contract_crew || []).map((m) => m.name).filter(Boolean).join(", "),
      total,
      collected,
      balance: total - collected,
    };
  });
}

/**
 * Mô tả bộ lọc đang bật — in ở đầu file để biết file này là của kỳ/lát cắt nào.
 * `view` là nhãn danh sách đang xem (tab + nghề), `extra` là các điều kiện lọc
 * riêng của từng bản giao diện (đã viết sẵn thành chữ).
 */
export function contractExportMeta(
  view: string,
  count: number,
  { q = "", code = "", from = "", to = "" }: { q?: string; code?: string; from?: string; to?: string },
  extra: string[] = []
): string[] {
  const bits = [
    q.trim() && `từ khoá "${q.trim()}"`,
    code.trim() && `mã "${code.trim()}"`,
    from && `từ ngày ${from}`,
    to && `đến ngày ${to}`,
    ...extra,
  ].filter(Boolean);
  return [
    `Danh sách: ${view} · ${count} hợp đồng${bits.length ? ` · lọc theo ${bits.join(", ")}` : ""}`,
    `Ngày xuất: ${stamp()}`,
  ];
}
