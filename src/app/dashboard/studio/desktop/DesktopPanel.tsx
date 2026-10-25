"use client";

import { Monitor, Download, ShieldAlert, FileSpreadsheet, FileJson, Laptop, Trash2, RefreshCw, Plus, Copy, Check } from "lucide-react";
import RestorePanel from "./RestorePanel";
import { EXPORTS, fmtTime, useDesktopPanel } from "./useDesktopPanel";

/**
 * Trang MStudo Desktop: tải bản cài Windows, quản lý thiết bị (tối đa 2 máy),
 * và xuất dữ liệu ngay trên web (dùng chung API với client desktop).
 * Logic chung ở ./useDesktopPanel; giao diện mới ở ./DesktopPanelV2.
 */

export default function DesktopPanel() {
  const {
    migrated, limit, loading, pairing, pairToken, pairErr, copied, acct, dl, downloadUrl, serverUrl,
    load, revoke, pair, copyText, active,
  } = useDesktopPanel();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Tải app */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl" style={{ background: "var(--brandSoft)" }}>
            <Monitor size={24} style={{ color: "var(--brand)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-medium">MStudo Desktop cho Windows</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
              Ứng dụng chạy trên máy tính: tự động lưu hợp đồng (PDF + Word) về thư mục bạn chọn ngay khi khách ký,
              và tự xuất Excel toàn bộ dữ liệu hằng ngày để chống mất dữ liệu.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download className="btn-primary inline-flex items-center gap-2"><Download size={16} /> Tải bản cài đặt{dl.ver ? ` (${dl.ver})` : ""}</a>
              <span className="text-xs" style={{ color: "var(--text2)" }}>Windows 10/11 · 64-bit · file <code>-setup.exe</code></span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl p-4 text-sm" style={{ background: "var(--surface2)" }}>
          <ShieldAlert size={18} className="mt-0.5 flex-none" style={{ color: "var(--brand)" }} />
          <div style={{ color: "var(--text2)" }}>
            <b style={{ color: "var(--text)" }}>Khi cài đặt, Windows có thể hiện cảnh báo SmartScreen</b> vì ứng dụng chưa mua chứng chỉ ký số.
            Bấm <b>“More info” → “Run anyway”</b> (Thông tin thêm → Vẫn chạy) để tiếp tục — file cài chỉ tải từ trang này là an toàn.
            {" "}Nếu file bị “khoá”: chuột phải file <code>-setup.exe</code> → <b>Properties</b> → tick <b>Unblock</b> → OK rồi mở lại.
            <br />
            <span className="mt-1 inline-block">
              Máy hiện <b style={{ color: "var(--text)" }}>“Smart App Control blocked an app…”</b> (chỉ có trên Windows 11 cài mới): vào
              {" "}<b>Settings → Privacy &amp; security → Windows Security → App &amp; browser control → Smart App Control → Off</b> rồi cài lại.
              {" "}<i>(Tắt Smart App Control là một chiều — chỉ nên làm trên máy của bạn.)</i>
            </span>
          </div>
        </div>
      </div>

      {/* Thiết bị */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium">Thiết bị của bạn</h2>
          <div className="flex items-center gap-2">
            <button onClick={pair} disabled={pairing} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus size={14} /> Kết nối thiết bị mới</button>
            <button onClick={load} className="btn-ghost inline-flex items-center gap-2 text-sm"><RefreshCw size={14} /> Làm mới</button>
          </div>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
          Tối đa {limit} máy hoạt động cho mỗi tài khoản. Bấm “Kết nối thiết bị mới” để lấy mã, rồi dán vào ứng dụng MStudo Desktop trên máy tính.
        </p>
        {acct && (
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Thiết bị đăng ký ở đây sẽ đồng bộ dữ liệu của tài khoản{" "}
            <b style={{ color: "var(--text)" }}>{acct.name || acct.email}</b>
            {acct.name && acct.email ? ` (${acct.email})` : ""}.
          </p>
        )}
        {pairErr && <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "#fbeaea", color: "#8f3d3d" }}>{pairErr}</p>}
        {pairToken && (
          <div className="mt-3 rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-medium">
              Mã kết nối cho tài khoản <b>{acct?.name || acct?.email || "này"}</b> — chỉ hiện MỘT lần, hãy dán ngay vào app:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>{pairToken}</code>
              <button onClick={() => copyText(pairToken, "token")} className="btn-ghost inline-flex flex-none items-center gap-1.5 text-sm">
                {copied === "token" ? <Check size={14} /> : <Copy size={14} />} {copied === "token" ? "Đã chép" : "Chép mã"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text2)" }}>Địa chỉ máy chủ:</span>
              <code className="rounded px-2 py-1 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>{serverUrl}</code>
              <button onClick={() => copyText(serverUrl, "server")} className="btn-ghost inline-flex items-center gap-1.5 text-xs">
                {copied === "server" ? <Check size={12} /> : <Copy size={12} />} {copied === "server" ? "Đã chép" : "Chép"}
              </button>
            </div>
          </div>
        )}
        {!migrated && (
          <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            Cơ sở dữ liệu chưa có bảng thiết bị — chạy <code>supabase/schema.sql</code> mới nhất trong Supabase SQL Editor.
          </p>
        )}
        <div className="mt-4 space-y-2">
          {loading && <p className="text-sm" style={{ color: "var(--text2)" }}>Đang tải…</p>}
          {!loading && active.length === 0 && (
            <p className="rounded-xl p-4 text-sm" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              Chưa có thiết bị nào. Cài MStudo Desktop rồi đăng nhập để đăng ký máy đầu tiên.
            </p>
          )}
          {active.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl p-4" style={{ background: "var(--surface2)" }}>
              <Laptop size={20} className="flex-none" style={{ color: "var(--brand)" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name || "Máy tính Windows"}</div>
                <div className="text-xs" style={{ color: "var(--text2)" }}>
                  {d.app_version ? `v${d.app_version} · ` : ""}Đồng bộ cuối: {fmtTime(d.last_sync_at)}
                </div>
              </div>
              <button onClick={() => revoke(d.id)} title="Thu hồi thiết bị" className="btn-ghost inline-flex items-center gap-1.5 text-sm" style={{ color: "#c05050" }}>
                <Trash2 size={14} /> Thu hồi
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Xuất dữ liệu ngay */}
      <div className="card p-6">
        <h2 className="font-serif text-xl font-medium">Xuất dữ liệu ngay</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
          Không cần chờ client — tải Excel từng mảng hoặc bản sao lưu đầy đủ ngay tại đây (cùng dữ liệu client sẽ tự lưu).
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {EXPORTS.map(([type, label, desc]) => (
            <a key={type} href={`/api/desktop/export?type=${type}`} className="flex items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-80" style={{ background: "var(--surface2)" }}>
              <FileSpreadsheet size={20} className="flex-none" style={{ color: "#1f9d63" }} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label} (.xlsx)</span>
                <span className="block truncate text-xs" style={{ color: "var(--text2)" }}>{desc}</span>
              </span>
            </a>
          ))}
          <a href="/api/desktop/export?type=backup" className="flex items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-80 sm:col-span-2" style={{ background: "var(--surface2)" }}>
            <FileJson size={20} className="flex-none" style={{ color: "var(--brand)" }} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Bản sao lưu đầy đủ (.json)</span>
              <span className="block text-xs" style={{ color: "var(--text2)" }}>Toàn bộ hợp đồng, báo giá, chi tiêu, lương, lịch… — dùng để khôi phục dữ liệu khi cần</span>
            </span>
          </a>
        </div>
      </div>

      {/* Khôi phục ngược từ bản sao lưu */}
      <RestorePanel />
    </div>
  );
}
