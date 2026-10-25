"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, DatabaseBackup, FileJson, Loader2, Upload } from "lucide-react";
import { Callout, Section, btn } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { LABELS, useRestore } from "./useRestore";

/* ═══════════════════════════════════════════════════════════════════════════
   KHÔI PHỤC TỪ BẢN SAO LƯU — giao diện mới. Cùng logic với RestorePanel (bản
   cũ, ở ./useRestore); xếp thành 3 bước đánh số: chọn file → xem trước từng
   mảng → khôi phục (công tắc ghi đè bản ghi trùng).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RestorePanelV2() {
  const r = useRestore();
  const busy = r.phase === "applying" || r.phase === "previewing";
  const newCount = r.preview.reduce((s, p) => s + (p.total - p.exists), 0);
  const dupCount = r.preview.reduce((s, p) => s + p.exists, 0);

  const step = (n: number, title: string, active: boolean, children: React.ReactNode) => (
    <li className="flex gap-3">
      <span
        className="v2-num flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold"
        style={active ? { background: "var(--acS)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13.5px] font-semibold" style={active ? undefined : { color: "var(--tx3)" }}>{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );

  return (
    <Section
      icon={DatabaseBackup}
      title="Khôi phục từ bản sao lưu"
      desc="Mặc định chỉ THÊM bản ghi bị mất, không đụng dữ liệu đang có."
    >
      <ol className="flex flex-col gap-5">
        {step(
          1,
          "Chọn file mstudo-backup-*.json",
          true,
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={r.fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                r.onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => r.fileRef.current?.click()} className={btn("secondary")} disabled={busy}>
              {r.fileName ? <FileJson size={16} /> : <Upload size={16} />}
              <span className="max-w-[240px] truncate">{r.fileName ? r.fileName : "Chọn file sao lưu…"}</span>
            </button>
            {r.phase === "previewing" && (
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                <Loader2 size={14} className="animate-spin" /> Đang đối chiếu với dữ liệu hiện tại…
              </span>
            )}
          </div>,
        )}

        {step(
          2,
          "Xem trước từng mảng dữ liệu",
          r.preview.length > 0,
          r.preview.length > 0 ? (
            <div className="v2-table-wrap overflow-x-auto rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Mảng dữ liệu</th>
                    <th className="num">Trong file</th>
                    <th className="num">Sẽ thêm mới</th>
                    <th className="num">Đã có (trùng)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.preview.map((p) => (
                    <tr key={p.table}>
                      <td>{LABELS[p.table] || p.table}</td>
                      <td className="num">{p.total}</td>
                      <td className="num font-semibold" style={{ color: "var(--gn)" }}>{p.total - p.exists}</td>
                      <td className="num" style={{ color: "var(--tx3)" }}>{p.exists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Chọn file xong, hệ thống đếm sẵn bao nhiêu bản ghi sẽ thêm mới và bao nhiêu đã có.</p>
          ),
        )}

        {step(
          3,
          "Khôi phục",
          r.phase === "ready" || r.phase === "applying",
          r.phase === "ready" || r.phase === "applying" ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-[12px] px-3" style={{ background: "var(--sf2)" }}>
                <Switch
                  checked={r.overwrite}
                  onChange={r.setOverwrite}
                  disabled={r.phase === "applying"}
                  label="Ghi đè bản ghi trùng bằng dữ liệu trong file"
                  desc="Chỉ bật khi muốn quay về đúng trạng thái lúc sao lưu — thay đổi sau thời điểm đó trên các bản ghi trùng sẽ mất."
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={r.apply} disabled={r.phase === "applying"} className={btn(r.overwrite ? "danger" : "soft")}>
                  {r.phase === "applying" ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}
                  {r.phase === "applying" ? r.progress || "Đang khôi phục…" : "Khôi phục dữ liệu"}
                </button>
                {r.phase === "ready" && (
                  <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Thêm {newCount} bản ghi mới · {r.overwrite ? `ghi đè ${dupCount}` : `bỏ qua ${dupCount}`} bản ghi đã có
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Nên thực hiện khi vắng thao tác khác trên tài khoản.</p>
          ),
        )}
      </ol>

      {r.error && (
        <div className="mt-4">
          <Callout tone="red" icon={CircleAlert}>{r.error}</Callout>
        </div>
      )}

      {r.result && r.phase === "done" && (
        <div className="mt-4">
          <Callout tone={r.result.errors.length ? "amber" : "green"} icon={r.result.errors.length ? AlertTriangle : CheckCircle2} title="Hoàn tất khôi phục">
            Thêm mới {r.result.inserted} · ghi đè {r.result.updated} · bỏ qua (đã có) {r.result.skipped_existing} · không hợp lệ {r.result.skipped_invalid}
            {r.result.errors.length > 0 && (
              <div className="mt-1.5" style={{ color: "var(--rd)" }}>
                {r.result.errors.slice(0, 5).map((e, i) => <div key={i}>⚠ {e}</div>)}
                {r.result.errors.length > 5 && <div>… và {r.result.errors.length - 5} lỗi khác</div>}
              </div>
            )}
          </Callout>
        </div>
      )}
    </Section>
  );
}
