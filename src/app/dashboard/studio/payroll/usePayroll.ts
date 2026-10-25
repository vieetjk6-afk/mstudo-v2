"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { summarizeByPerson, type TimesheetRow } from "@/lib/timesheet";
import { crewRoleLabel, type CrewRoleRow } from "@/lib/crew-roles";
import { exportPayroll, payrollCsvRows, downloadCsv, stamp, type ExportStudio, type PayrollExportRow } from "@/lib/studio-export";
import type { PayrollRow } from "./PayrollView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Đối soát tiền công (bản cũ PayrollView và bản
   mới PayrollV2): kỳ, gom theo người / theo job, giờ chấm công, đánh dấu đã
   trả, xuất file. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [{ value: "all", label: "Tất cả thời gian" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` });
  }
  return out;
}

export type PayrollInput = {
  rows: PayrollRow[];
  studio: ExportStudio;
  timesheet?: TimesheetRow[];
  rates?: Record<string, number>;
  crewRoles?: CrewRoleRow[];
};

export function usePayroll({ rows, studio, timesheet = [], crewRoles = [] }: PayrollInput) {
  const supabase = createClient();
  const [month, setMonth] = useState("all");
  const [data, setData] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Thợ ĐÃ TỪ CHỐI buổi chụp thì studio không nợ họ đồng nào — nhưng dòng phân
  // công vẫn nằm nguyên trong contract_crew, và trang này trước đây cộng hết,
  // nên "Tổng tiền công trong kỳ" và "Còn phải trả" bị thổi lên bằng tiền của
  // những người không đi làm. Loại khỏi phần tiền; ai từ chối thì xem ở màn
  // Lịch làm việc / Sổ thợ, không phải ở bảng đối soát lương.
  const inMonth = useMemo(
    () => (month === "all" ? data : data.filter((r) => (r.contract?.event_date || "").startsWith(month))),
    [data, month]
  );
  const declinedCount = useMemo(() => inMonth.filter((r) => r.status === "declined").length, [inMonth]);
  const filtered = useMemo(() => inMonth.filter((r) => r.status !== "declined"), [inMonth]);

  // Gom theo người (số điện thoại nếu có, không thì theo tên).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phone: string | null; rows: PayrollRow[] }>();
    for (const r of filtered) {
      const key = (r.phone && r.phone.replace(/\D/g, "")) || r.name || r.id;
      if (!map.has(key)) map.set(key, { key, name: r.name || r.phone || "—", phone: r.phone, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Gom theo job — nền của "chốt đối soát theo job": job xong là chốt tiền ngay,
  // không đợi cuối tháng.
  const jobs = useMemo(() => {
    const map = new Map<string, { key: string; title: string; code: string | null; date: string | null; rows: PayrollRow[] }>();
    for (const r of filtered) {
      const key = r.contract?.id || "none";
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: r.contract?.title || "Không gắn hợp đồng",
          code: r.contract?.code ?? null,
          date: r.contract?.event_date ?? null,
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [filtered]);

  /**
   * Giờ làm thực tế theo người, LỌC ĐÚNG KỲ đang xem trên màn hình. Không lọc
   * theo kỳ thì cột "giờ làm" sẽ là tổng của mọi tháng trong khi cột tiền chỉ
   * của tháng này — hai con số cạnh nhau mà khác kỳ là cách chắc chắn để người
   * đọc kết luận sai.
   */
  const hoursByPhone = useMemo(() => {
    const inKy = month === "all" ? timesheet : timesheet.filter((r) => r.workDate.startsWith(month));
    return Object.fromEntries(summarizeByPerson(inKy).map((p) => [p.phone, p]));
  }, [timesheet, month]);

  const grandTotal = filtered.reduce((s, r) => s + (r.salary || 0), 0);
  const grandPaid = filtered.filter((r) => r.paid).reduce((s, r) => s + (r.salary || 0), 0);

  async function setPaid(ids: string[], next: boolean) {
    if (ids.length === 0) return;
    setBusy(ids.join(","));
    await supabase
      .from("contract_crew")
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .in("id", ids);
    setData((p) => p.map((x) => (ids.includes(x.id) ? { ...x, paid: next } : x)));
    setBusy(null);
  }

  /** Dòng dữ liệu cho file xuất ra — đúng kỳ đang lọc trên màn hình. */
  function exportRows(): PayrollExportRow[] {
    return filtered.map((r) => ({
      name: r.name,
      phone: r.phone || "",
      role: crewRoleLabel(r.role, crewRoles),
      contract: r.contract?.title || "Không gắn hợp đồng",
      code: r.contract?.code || "",
      date: r.contract?.event_date || null,
      salary: r.salary || 0,
      paid: r.paid,
    }));
  }

  const exportMeta = () => [
    `Kỳ: ${monthOptions().find((m) => m.value === month)?.label || month} · ${filtered.length} lượt job · ${groups.length} nhân sự`,
    `Ngày xuất: ${stamp()}`,
  ];

  async function exportExcel() {
    setExporting(true);
    try {
      await exportPayroll(studio, exportRows(), exportMeta(), `doi-soat-tien-cong-${month}`);
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    downloadCsv(payrollCsvRows(studio, exportRows(), exportMeta()), `doi-soat-tien-cong-${month}`);
  }

  return {
    month, setMonth, filtered, declinedCount, groups, jobs, hoursByPhone,
    grandTotal, grandPaid, busy, setPaid, exporting, exportExcel, exportCsv,
  };
}
