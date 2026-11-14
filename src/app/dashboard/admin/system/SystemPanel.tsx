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
import { fmtSize, fmtWhen, isStale, useAutoBackup } from "./useAutoBackup";
import { RATE_LIMIT_SQL_URL, useRateLimitMode } from "./useRateLimitMode";

export default function SystemPanel() {
  const ab = useAutoBackup();
  const rl = useRateLimitMode();
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

      {rl === "memory" && (
        <div className="mb-6 flex items-start gap-2 rounded-md px-3 py-2 text-[13px]" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", color: "var(--text2)" }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--gold)" }} />
          <span>
            <b>Chống dò mật khẩu album / SĐT hợp đồng đang đếm riêng trong từng máy chủ</b> — gửi dồn là lọt giới hạn. Mở{" "}
            <a href={RATE_LIMIT_SQL_URL} target="_blank" rel="noopener noreferrer" className="underline">file SQL này</a>, chép rồi chạy trong
            Supabase SQL Editor, hoặc đặt UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN trên Vercel.
          </span>
        </div>
      )}

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
            Toàn bộ dữ liệu ứng dụng của mọi studio (hợp đồng, khách hàng,
            báo giá, thu chi, album, thông báo…). Dùng để lưu trữ an toàn hoặc khôi phục khi cần.
            <br />
            <span style={{ color: "var(--text3)" }}>
              Lưu ý: chỉ gồm dữ liệu ứng dụng — không chứa mật khẩu đăng nhập, token kết nối hay ảnh gốc trên Google Drive.
            </span>
          </p>
          <div className="mb-4 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[13px] font-semibold">
              Tự động lên Google Drive của admin ·{" "}
              {ab.status === null ? "đang kiểm tra…" : !ab.status.connected ? "CHƯA BẬT (cần kết nối Drive ở thẻ bên dưới)" : ab.status.files[0] ? `bản mới nhất ${fmtWhen(ab.status.files[0].createdTime)} (${fmtSize(ab.status.files[0].size)})` : "chưa có bản nào"}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--text3)" }}>
              Chạy mỗi đêm (~03h giờ VN), giữ {ab.status?.keep ?? 14} bản gần nhất trong thư mục riêng tư “mstudo · Sao lưu hệ thống”.
              Cài Google Drive cho máy tính trên máy admin là file tự về máy.
            </div>
            {isStale(ab.status) && (
              <div className="mt-1 text-[12px]" style={{ color: "var(--danger)" }}>Bản mới nhất đã cũ — sao lưu tự động có thể đang hỏng.</div>
            )}
            <button onClick={() => void ab.runNow()} disabled={ab.running || !ab.status?.connected} className="btn-ghost mt-2 gap-2 text-xs">
              {ab.running ? <Loader2 size={14} className="animate-spin" /> : <DatabaseBackup size={14} />} Sao lưu ngay lên Drive
            </button>
            {ab.msg && (
              <div className="mt-2 text-[12px]" style={{ color: ab.msg.tone === "green" ? "var(--brand)" : "var(--danger)" }}>{ab.msg.text}</div>
            )}
          </div>
          <button onClick={downloadBackup} disabled={backing} className="btn-primary gap-2">
            {backing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Tải bản sao lưu về máy (.json.gz)
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
          Chọn file sao lưu (.json.gz trên Drive / tải về máy, hoặc .json bản cũ) để phục hồi dữ liệu. Bản ghi trùng khóa sẽ được cập nhật, bản ghi
          thiếu sẽ được tạo lại. Thao tác này <b>không xóa</b> dữ liệu hiện có không nằm trong bản sao lưu.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="application/json,.json,application/gzip,.gz" onChange={pickBackupFile} className="text-sm" />
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
                      <td className="px-3 py-1.5" style={{ color: "var(--text2)" }}>
                        {t.table}
                        {t.skip && <span className="ml-2 text-[11px]" style={{ color: "var(--text3)" }}>(nhật ký — không khôi phục)</span>}
                      </td>
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
