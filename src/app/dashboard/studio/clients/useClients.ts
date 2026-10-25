"use client";

import { useMemo, useState } from "react";
import { LEAD_SOURCE_LABEL } from "@/lib/lead-source";
import { fmtDate } from "@/lib/date";
import {
  exportClients,
  clientsCsvRows,
  downloadCsv,
  stamp,
  type ClientExportRow,
  type ExportStudio,
} from "@/lib/studio-export";
import type { ClientAgg } from "./ClientsView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Khách hàng (bản cũ ClientsView và bản mới
   ClientsV2): tìm, lọc, sắp xếp, số liệu đầu trang, xuất Excel/CSV. Hai bản chỉ
   khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

const digits = (s: string) => (s || "").replace(/\D/g, "");

/** Đường tới hồ sơ khách — dùng chung cho bảng (máy tính) và thẻ (điện thoại). */
export const clientHref = (c: ClientAgg) => `/dashboard/studio/clients/${encodeURIComponent(digits(c.phone) || c.key)}`;
export const sourceLabel = (c: ClientAgg) => (c.source ? LEAD_SOURCE_LABEL[c.source] || c.source : "Không rõ nguồn");
export const lastLabel = (c: ClientAgg) => (c.last ? `gần nhất ${fmtDate(c.last)}` : "chưa có buổi nào");
export const debtOf = (c: ClientAgg) => Math.max(0, c.value - c.collected);
export const zaloUrl = (phone: string) => `https://zalo.me/${digits(phone)}`;

/** Lời mời khách cũ quay lại — một câu cho mọi nút "Mời lại". */
export const inviteBackMessage = (c: ClientAgg) =>
  `Xin chào ${c.name}, đã lâu chưa được phục vụ anh/chị. Studio đang có ưu đãi cho khách cũ, anh/chị có dịp nào muốn chụp lại không ạ? Cảm ơn anh/chị!`;

/** Nhóm lọc. Bản cũ chỉ dùng "all" và "old" (nút "Lâu chưa quay lại"). */
export type ClientSegment = "all" | "old" | "returning" | "debt";
export type ClientSort = "recent" | "value" | "count";

export function useClients(clients: ClientAgg[], studio: ExportStudio) {
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<ClientSegment>("all");
  const [sort, setSort] = useState<ClientSort>("recent");
  const [exporting, setExporting] = useState(false);

  // "Lâu chưa quay lại": lần chụp gần nhất đã quá 6 tháng.
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const isOld = (c: ClientAgg) => !!c.last && c.last < cutoff;
  const oldCount = clients.filter(isOld).length;
  const returning = clients.filter((c) => c.count > 1).length;
  const debtCount = clients.filter((c) => debtOf(c) > 0).length;
  const totalSpent = clients.reduce((s, c) => s + c.value, 0);
  const totalDebt = clients.reduce((s, c) => s + debtOf(c), 0);
  const returnPct = clients.length ? Math.round((returning / clients.length) * 100) : 0;
  const avgValue = clients.length ? Math.round(totalSpent / clients.length) : 0;

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (segment === "old" && !isOld(c)) return false;
      if (segment === "returning" && c.count <= 1) return false;
      if (segment === "debt" && debtOf(c) <= 0) return false;
      if (!n) return true;
      return c.name.toLowerCase().includes(n) || c.phone.toLowerCase().includes(n);
    });
    const sorted = [...list];
    if (sort === "value") sorted.sort((a, b) => b.value - a.value);
    else if (sort === "count") sorted.sort((a, b) => b.count - a.count || b.value - a.value);
    else sorted.sort((a, b) => (b.last || "").localeCompare(a.last || ""));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, segment, cutoff, sort]);

  /** Dòng dữ liệu cho file xuất ra — đúng danh sách đang lọc/sắp xếp. */
  function exportRows(): ClientExportRow[] {
    return filtered.map((c) => ({
      name: c.name,
      phone: c.phone,
      jobs: c.count,
      value: c.value,
      collected: c.collected,
      last: c.last,
      source: c.source ? LEAD_SOURCE_LABEL[c.source] || c.source : "",
    }));
  }

  const SEGMENT_WORD: Record<ClientSegment, string> = {
    all: "tất cả khách",
    old: "khách lâu chưa quay lại",
    returning: "khách quay lại",
    debt: "khách còn nợ",
  };
  const exportMeta = () => [
    `Danh sách: ${SEGMENT_WORD[segment]}${q.trim() ? ` · từ khoá "${q.trim()}"` : ""} · ${filtered.length} khách`,
    `Ngày xuất: ${stamp()}`,
  ];

  async function exportExcel() {
    setExporting(true);
    try {
      await exportClients(studio, exportRows(), exportMeta(), "khach-hang");
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    downloadCsv(clientsCsvRows(studio, exportRows(), exportMeta()), "khach-hang");
  }

  return {
    q, setQ, segment, setSegment, sort, setSort, exporting,
    isOld, oldCount, returning, debtCount, totalSpent, totalDebt, returnPct, avgValue,
    filtered, exportExcel, exportCsv,
  };
}
