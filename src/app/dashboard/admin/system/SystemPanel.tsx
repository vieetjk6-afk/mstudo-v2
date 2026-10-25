"use client";

import Link from "next/link";
import {
  Megaphone,
  DatabaseBackup,
  Send,
  Download,
  Upload,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { SHORTCUTS, TARGET_LABEL, useSystemPanel, type Target } from "./useSystemPanel";

export default function SystemPanel() {
  // Logic dùng chung với bản mới (SystemV2) — xem ./useSystemPanel.
  const {
    message, setMessage, target, setTarget, important, setImportant, push, setPush, sending, sendMsg, sendBroadcast,
    backing, backupMsg, downloadBackup,
    fileRef, preview, restoring, restoreMsg, restoreErr, pickBackupFile, applyRestore,
  } = useSystemPanel();

  return (
    <div className="page-in">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck size={22} style={{ color: "var(--brand)" }} />
        <h1 className="font-serif text-2xl font-medium">Bảng điều khiển hệ thống</h1>
      </div>

      {/* Quản lý nhanh */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card flex items-start gap-3 p-4 transition-colors hover:border-[var(--brand)]"
            style={{ borderColor: "var(--border)" }}
          >
            <s.icon size={20} style={{ color: "var(--brand)", flex: "none" }} className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--text3)" }}>{s.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Thông báo tới studio */}
        <form onSubmit={sendBroadcast} className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone size={18} style={{ color: "#c78bd1" }} />
            <h2 className="text-base font-semibold">Thông báo tới studio</h2>
          </div>
          <p className="mb-3 text-[12px]" style={{ color: "var(--text3)" }}>
            Thông báo hiện ngay trong webapp: chuông thông báo + bảng nổi khi người dùng đăng nhập
            hoặc đang sử dụng. Bật &ldquo;quan trọng&rdquo; để hiện popup giữa màn hình.
          </p>
          <textarea
            className="input min-h-[110px] w-full resize-y"
            placeholder="Nội dung thông báo… ví dụ: Hệ thống bảo trì lúc 23h tối nay, vui lòng lưu công việc."
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              className="input px-3 py-2 text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
            >
              <option value="everyone">{TARGET_LABEL.everyone}</option>
              <option value="all">{TARGET_LABEL.all}</option>
              <option value="studio">{TARGET_LABEL.studio}</option>
              <option value="booking">{TARGET_LABEL.booking}</option>
            </select>
            <button type="submit" disabled={sending || !message.trim()} className="btn-primary gap-2">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Gửi thông báo
            </button>
            <span className="text-[11px]" style={{ color: "var(--text3)" }}>{message.length}/1000</span>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px]" style={{ color: "var(--text2)" }}>
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
            Thông báo quan trọng — hiện popup nổi giữa màn hình, người dùng phải xác nhận
          </label>
          <label className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--text2)" }}>
            <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
            Đẩy web push (báo cả khi không mở webapp)
          </label>
          {sendMsg && (
            <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--brandSoft)", color: "var(--brand)" }}>
              {sendMsg}
            </div>
          )}
        </form>

        {/* Sao lưu toàn hệ thống */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <DatabaseBackup size={18} style={{ color: "var(--brand)" }} />
            <h2 className="text-base font-semibold">Sao lưu toàn hệ thống</h2>
          </div>
          <p className="mb-4 text-[12px]" style={{ color: "var(--text3)" }}>
            Tải về một file JSON chứa toàn bộ dữ liệu ứng dụng của mọi studio (hợp đồng, khách hàng,
            báo giá, thu chi, album, thông báo…). Dùng để lưu trữ an toàn hoặc khôi phục khi cần.
            <br />
            <span style={{ color: "var(--text3)" }}>
              Lưu ý: chỉ gồm dữ liệu ứng dụng — không chứa mật khẩu đăng nhập hay ảnh gốc trên Google Drive.
            </span>
          </p>
          <button onClick={downloadBackup} disabled={backing} className="btn-primary gap-2">
            {backing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Tải bản sao lưu đầy đủ
          </button>
          {backupMsg && (
            <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              {backupMsg}
            </div>
          )}
        </div>
      </div>

      {/* Khôi phục hệ thống */}
      <div className="card mt-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Upload size={18} style={{ color: "#e0b85c" }} />
          <h2 className="text-base font-semibold">Khôi phục hệ thống</h2>
        </div>
        <p className="mb-4 text-[12px]" style={{ color: "var(--text3)" }}>
          Chọn file JSON đã sao lưu để phục hồi dữ liệu. Bản ghi trùng khóa sẽ được cập nhật, bản ghi
          thiếu sẽ được tạo lại. Thao tác này <b>không xóa</b> dữ liệu hiện có không nằm trong bản sao lưu.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickBackupFile} className="text-sm" />
        </div>

        {restoreErr && (
          <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)" }}>
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{restoreErr}</span>
          </div>
        )}

        {preview && (
          <div className="mt-4">
            <div className="mb-2 flex items-start gap-2 rounded-md px-3 py-2 text-[13px]" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", color: "var(--gold)" }}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Bản sao lưu chứa dữ liệu dưới đây. Kiểm tra kỹ rồi bấm khôi phục — dữ liệu hiện tại sẽ bị ghi đè bằng các bản ghi này.</span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <tbody>
                  {preview.map((t) => (
                    <tr key={t.table} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-1.5" style={{ color: "var(--text2)" }}>{t.table}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{t.rows.toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={applyRestore} disabled={restoring} className="btn-primary mt-3 gap-2">
              {restoring ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Khôi phục toàn bộ
            </button>
          </div>
        )}

        {restoreMsg && (
          <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--brandSoft)", color: "var(--brand)" }}>
            {restoreMsg}
          </div>
        )}
      </div>
    </div>
  );
}
