"use client";

import { DatabaseBackup, Upload, AlertTriangle } from "lucide-react";
import { LABELS, useRestore } from "./useRestore";

/**
 * Khôi phục ngược dữ liệu từ file mstudo-backup-*.json (tạo bởi nút "Bản sao
 * lưu đầy đủ" hoặc client desktop). Xem trước số liệu từng mảng → xác nhận →
 * gửi theo lô nhỏ (≤ ~900KB) để nằm trong giới hạn request của Vercel.
 * Logic chung ở ./useRestore; giao diện mới ở ./RestorePanelV2.
 */

export default function RestorePanel() {
  const { fileRef, fileName, preview, overwrite, setOverwrite, phase, progress, result, error, onFile, apply } = useRestore();

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <DatabaseBackup size={20} style={{ color: "var(--brand)" }} />
        <h2 className="font-serif text-xl font-medium">Khôi phục dữ liệu từ bản sao lưu</h2>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
        Chọn file <code>mstudo-backup-*.json</code> — hệ thống xem trước từng mảng rồi mới khôi phục.
        Mặc định chỉ THÊM bản ghi bị mất, không đụng dữ liệu đang có.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="btn-ghost inline-flex items-center gap-2 text-sm" disabled={phase === "applying" || phase === "previewing"}>
          <Upload size={14} /> {fileName ? `Đã chọn: ${fileName}` : "Chọn file sao lưu…"}
        </button>
        {phase === "previewing" && <span className="text-sm" style={{ color: "var(--text2)" }}>Đang đối chiếu với dữ liệu hiện tại…</span>}
      </div>

      {error && <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "#fbeaea", color: "#8f3d3d" }}>{error}</p>}

      {preview.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                <th className="p-2.5 text-left font-semibold">Mảng dữ liệu</th>
                <th className="p-2.5 text-right font-semibold">Trong file</th>
                <th className="p-2.5 text-right font-semibold">Sẽ thêm mới</th>
                <th className="p-2.5 text-right font-semibold">Đã có (trùng)</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.table} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="p-2.5">{LABELS[p.table] || p.table}</td>
                  <td className="p-2.5 text-right">{p.total}</td>
                  <td className="p-2.5 text-right font-semibold" style={{ color: "#1f9d63" }}>{p.total - p.exists}</td>
                  <td className="p-2.5 text-right" style={{ color: "var(--text2)" }}>{p.exists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(phase === "ready" || phase === "applying") && (
        <>
          <label className="mt-4 flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={phase === "applying"} />
            <span>
              <b>Ghi đè bản ghi trùng</b> bằng dữ liệu trong file
              <span className="block text-xs" style={{ color: "var(--text2)" }}>
                <AlertTriangle size={11} className="mr-1 inline" />
                Chỉ bật khi muốn quay về đúng trạng thái lúc sao lưu — thay đổi sau thời điểm đó trên các bản ghi trùng sẽ mất.
              </span>
            </span>
          </label>
          <button onClick={apply} disabled={phase === "applying"} className="btn-primary mt-4">
            {phase === "applying" ? progress || "Đang khôi phục…" : "Khôi phục dữ liệu"}
          </button>
        </>
      )}

      {result && phase === "done" && (
        <div className="mt-4 rounded-xl p-4 text-sm" style={{ background: "var(--surface2)" }}>
          <b>Hoàn tất:</b> thêm mới {result.inserted} · ghi đè {result.updated} · bỏ qua (đã có) {result.skipped_existing} · không hợp lệ {result.skipped_invalid}
          {result.errors.length > 0 && (
            <div className="mt-2" style={{ color: "#8f3d3d" }}>
              {result.errors.slice(0, 5).map((e, i) => <div key={i}>⚠ {e}</div>)}
              {result.errors.length > 5 && <div>… và {result.errors.length - 5} lỗi khác</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
