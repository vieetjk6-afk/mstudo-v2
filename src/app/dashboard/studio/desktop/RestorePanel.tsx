"use client";

import { useRef, useState } from "react";
import { DatabaseBackup, Upload, AlertTriangle } from "lucide-react";
import { Panel, PanelHead } from "@/components/studio/ui";

/**
 * Khôi phục ngược dữ liệu từ file mstudo-backup-*.json (tạo bởi nút "Bản sao
 * lưu đầy đủ" hoặc client desktop). Xem trước số liệu từng mảng → xác nhận →
 * gửi theo lô nhỏ (≤ ~900KB) để nằm trong giới hạn request của Vercel.
 */

type Backup = { format?: string; version?: number; exported_at?: string; tables?: Record<string, Record<string, unknown>[]> };
type PreviewRow = { table: string; total: number; exists: number };
type Result = { inserted: number; updated: number; skipped_existing: number; skipped_invalid: number; errors: string[] };

// Cha trước, con sau — để bản ghi con luôn có cha khi khôi phục.
const ORDER = [
  "studio_contracts", "studio_quotes", "studio_expenses", "studio_bookings", "studio_events",
  "studio_crew", "studio_packages", "studio_pricelist", "studio_equipment",
  "contract_items", "contract_crew", "contract_payments", "contract_payment_plan",
  "contract_products", "contract_quote_options", "contract_tasks", "quote_items",
];
const LABELS: Record<string, string> = {
  studio_contracts: "Hợp đồng", studio_quotes: "Báo giá", studio_expenses: "Chi tiêu",
  studio_bookings: "Đặt lịch", studio_events: "Lịch ghi chú", studio_crew: "Sổ thợ",
  studio_packages: "Gói buổi chụp", studio_pricelist: "Bảng giá", studio_equipment: "Thiết bị",
  contract_items: "Hạng mục HĐ", contract_crew: "Thợ theo HĐ", contract_payments: "Thanh toán HĐ",
  contract_payment_plan: "Đợt thanh toán", contract_products: "Sản phẩm HĐ",
  contract_quote_options: "Gói báo giá HĐ", contract_tasks: "Việc cần làm HĐ", quote_items: "Hạng mục báo giá",
};

function chunkBySize(rows: Record<string, unknown>[], maxChars = 900_000, maxRows = 200) {
  const out: Record<string, unknown>[][] = [];
  let cur: Record<string, unknown>[] = [], size = 0;
  for (const r of rows) {
    const len = JSON.stringify(r).length;
    if (cur.length && (size + len > maxChars || cur.length >= maxRows)) { out.push(cur); cur = []; size = 0; }
    cur.push(r); size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

export default function RestorePanel() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [phase, setPhase] = useState<"idle" | "previewing" | "ready" | "applying" | "done">("idle");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function onFile(f?: File | null) {
    setError(""); setPreview([]); setResult(null); setPhase("idle");
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as Backup;
      if (parsed.format !== "mstudo-backup" || !parsed.tables) throw new Error("bad");
      setData(parsed); setFileName(f.name);
      setPhase("previewing");
      const rows: PreviewRow[] = [];
      for (const t of ORDER) {
        const list = parsed.tables[t] || [];
        if (!list.length) continue;
        let exists = 0;
        for (const part of chunkBySize(list.map((r) => ({ id: r.id })), 400_000, 800)) {
          const r = await fetch("/api/desktop/restore", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "preview", table: t, rows: part }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "preview_failed");
          exists += (j.exists as string[]).length;
        }
        rows.push({ table: t, total: list.length, exists });
        setPreview([...rows]);
      }
      setPhase("ready");
    } catch {
      setError("File không đúng định dạng mstudo-backup hoặc không đọc được.");
      setData(null); setPhase("idle");
    }
  }

  async function apply() {
    if (!data?.tables) return;
    const newCount = preview.reduce((s, p) => s + (p.total - p.exists), 0);
    const dupCount = preview.reduce((s, p) => s + p.exists, 0);
    const msg = overwrite
      ? `Khôi phục ${newCount} bản ghi mới VÀ GHI ĐÈ ${dupCount} bản ghi đang có bằng dữ liệu trong file?`
      : `Khôi phục ${newCount} bản ghi mới (bỏ qua ${dupCount} bản ghi đã có)?`;
    if (!confirm(msg + "\n\nNên thực hiện khi vắng thao tác khác trên tài khoản.")) return;
    setPhase("applying"); setError("");
    const total: Result = { inserted: 0, updated: 0, skipped_existing: 0, skipped_invalid: 0, errors: [] };
    try {
      for (const t of ORDER) {
        const list = data.tables[t] || [];
        if (!list.length) continue;
        const parts = chunkBySize(list);
        for (let i = 0; i < parts.length; i++) {
          setProgress(`Đang khôi phục ${LABELS[t] || t} (lô ${i + 1}/${parts.length})…`);
          const r = await fetch("/api/desktop/restore", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "apply", table: t, rows: parts[i], overwrite }),
          });
          const j = (await r.json()) as Result & { error?: string };
          if (!r.ok) throw new Error(j.error || "restore_failed");
          total.inserted += j.inserted; total.updated += j.updated;
          total.skipped_existing += j.skipped_existing; total.skipped_invalid += j.skipped_invalid;
          total.errors.push(...(j.errors || []));
        }
      }
      setResult(total); setPhase("done"); setProgress("");
    } catch (e) {
      setError("Khôi phục bị dừng: " + ((e as Error).message || e) + " — chạy lại với cùng file để tiếp tục (bản ghi đã vào sẽ tự bỏ qua).");
      setResult(total); setPhase("ready"); setProgress("");
    }
  }

  return (
    <Panel>
      <PanelHead icon={DatabaseBackup} tone="amber" title="Khôi phục từ bản sao lưu" />
      <div className="p-4">
        <p className="text-[11.5px] leading-[1.55]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Chọn file <code>mstudo-backup-*.json</code> — hệ thống xem trước từng mảng rồi mới khôi phục.
          Mặc định chỉ THÊM bản ghi bị mất, không đụng dữ liệu đang có.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={phase === "applying" || phase === "previewing"}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-60"
            style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
          >
            <Upload size={15} /> {fileName ? `Đã chọn: ${fileName}` : "Chọn file sao lưu…"}
          </button>
          {phase === "previewing" && <span className="text-[12px]" style={{ color: "var(--tx3)" }}>Đang đối chiếu với dữ liệu hiện tại…</span>}
        </div>

        {error && (
          <p className="mt-2.5 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{error}</p>
        )}

        {preview.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-[11px]" style={{ border: "1px solid var(--bd)" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th>Mảng dữ liệu</th>
                  <th style={{ textAlign: "right" }}>Trong file</th>
                  <th style={{ textAlign: "right" }}>Thêm mới</th>
                  <th style={{ textAlign: "right" }}>Đã có</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {preview.map((p) => (
                  <tr key={p.table}>
                    <td className="font-semibold">{LABELS[p.table] || p.table}</td>
                    <td style={{ textAlign: "right" }}>{p.total}</td>
                    <td className="font-bold" style={{ textAlign: "right", color: "var(--gn)" }}>{p.total - p.exists}</td>
                    <td style={{ textAlign: "right", color: "var(--tx3)" }}>{p.exists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(phase === "ready" || phase === "applying") && (
          <>
            <label className="mt-3.5 flex items-start gap-2.5 text-[12.5px]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={phase === "applying"} />
              <span>
                <b>Ghi đè bản ghi trùng</b> bằng dữ liệu trong file
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--am)", textWrap: "pretty" }}>
                  <AlertTriangle size={11} className="mr-1 inline" />
                  Chỉ bật khi muốn quay về đúng trạng thái lúc sao lưu — thay đổi sau thời điểm đó trên bản ghi trùng sẽ mất.
                </span>
              </span>
            </label>
            <button
              onClick={apply}
              disabled={phase === "applying"}
              className="mt-3.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              {phase === "applying" ? progress || "Đang khôi phục…" : "Khôi phục dữ liệu"}
            </button>
          </>
        )}

        {result && phase === "done" && (
          <div className="mt-3.5 rounded-[10px] px-3.5 py-3 text-[12.5px]" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
            <b>Hoàn tất:</b> thêm mới {result.inserted} · ghi đè {result.updated} · bỏ qua (đã có) {result.skipped_existing} · không hợp lệ {result.skipped_invalid}
            {result.errors.length > 0 && (
              <div className="mt-1.5" style={{ color: "var(--rd)" }}>
                {result.errors.slice(0, 5).map((e, i) => <div key={i}>⚠ {e}</div>)}
                {result.errors.length > 5 && <div>… và {result.errors.length - 5} lỗi khác</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
