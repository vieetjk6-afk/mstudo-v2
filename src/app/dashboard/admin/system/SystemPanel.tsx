"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  DatabaseBackup,
  Users,
  Gift,
  Settings,
  Send,
  Download,
  Upload,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type Target = "everyone" | "all" | "studio" | "booking";

const TARGET_LABEL: Record<Target, string> = {
  everyone: "Tất cả tài khoản",
  all: "Tất cả studio",
  studio: "Chỉ gói Studio",
  booking: "Chỉ Photographer / Basic",
};

// Nhãn khớp với nhóm "Quản trị hệ thống" trong sidebar — cùng một màn thì phải
// cùng một tên, nếu không admin tưởng là hai chỗ khác nhau.
const SHORTCUTS = [
  { href: "/dashboard/admin", label: "Người dùng & studio", desc: "Tài khoản, gói, quyền, kích hoạt/khóa", icon: Users },
  { href: "/dashboard/admin/affiliate", label: "Quản lý Affiliate", desc: "Hoa hồng, tỉ lệ, thanh toán", icon: Gift },
  { href: "/dashboard/settings", label: "Cấu hình mstudo", desc: "Cấu hình nền tảng, phản hồi, yêu cầu nâng cấp, mã giảm giá", icon: Settings },
];

export default function SystemPanel() {
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<Target>("everyone");
  const [important, setImportant] = useState(false);
  const [push, setPush] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  // Khôi phục
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreDoc, setRestoreDoc] = useState<unknown | null>(null);
  const [preview, setPreview] = useState<{ table: string; rows: number }[] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    if (!window.confirm(`Gửi thông báo này tới "${TARGET_LABEL[target]}"?`)) return;
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), target, push, important }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendMsg(data.error === "empty_message" ? "Chưa nhập nội dung." : `Lỗi: ${data.error ?? "không gửi được"}`);
      } else {
        const extra = push ? ` · đẩy tới ${data.pushed} thiết bị` : "";
        setSendMsg(`Đã gửi tới ${data.sent} studio${extra}.`);
        setMessage("");
      }
    } catch {
      setSendMsg("Lỗi kết nối, thử lại.");
    } finally {
      setSending(false);
    }
  }

  async function downloadBackup() {
    if (backing) return;
    setBacking(true);
    setBackupMsg("Đang thu thập dữ liệu toàn hệ thống…");
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        setBackupMsg("Không tạo được bản sao lưu.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const name = m?.[1] || "mstudo-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const mb = (blob.size / 1048576).toFixed(2);
      setBackupMsg(`Đã tải bản sao lưu (${mb} MB).`);
    } catch {
      setBackupMsg("Lỗi khi tải bản sao lưu.");
    } finally {
      setBacking(false);
    }
  }

  async function pickBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreMsg(null);
    setRestoreErr(null);
    setPreview(null);
    setRestoreDoc(null);
    try {
      const text = await file.text();
      const doc = JSON.parse(text);
      if (doc?.kind !== "mstudo-full-backup" || !doc.data) {
        setRestoreErr("File không phải bản sao lưu MStudo hợp lệ.");
        return;
      }
      // Xem trước số dòng (không ghi gì).
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: doc.kind, data: doc.data, apply: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreErr(`Lỗi đọc bản sao lưu: ${data.error ?? "không rõ"}`);
        return;
      }
      setRestoreDoc(doc);
      setPreview(data.tables ?? []);
    } catch {
      setRestoreErr("Không đọc được file (JSON hỏng?).");
    }
  }

  async function applyRestore() {
    if (!restoreDoc || restoring) return;
    if (!window.confirm(
      "KHÔI PHỤC sẽ ghi đè dữ liệu hiện tại bằng dữ liệu trong bản sao lưu (cập nhật bản ghi trùng khóa, tạo lại bản ghi thiếu). " +
      "Nên tải một bản sao lưu mới trước khi khôi phục. Tiếp tục?"
    )) return;
    setRestoring(true);
    setRestoreMsg("Đang khôi phục dữ liệu…");
    setRestoreErr(null);
    try {
      const doc = restoreDoc as { kind: string; data: unknown };
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: doc.kind, data: doc.data, apply: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreErr(`Khôi phục lỗi: ${data.error ?? "không rõ"}`);
        setRestoreMsg(null);
        return;
      }
      const failed = (data.failed ?? []) as { table: string; error: string }[];
      setRestoreMsg(`Đã khôi phục ${data.totalRestored} bản ghi.`);
      if (failed.length) {
        setRestoreErr("Một số bảng lỗi: " + failed.map((f) => `${f.table} (${f.error})`).join("; "));
      }
      setPreview(null);
      setRestoreDoc(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setRestoreErr("Lỗi kết nối khi khôi phục.");
      setRestoreMsg(null);
    } finally {
      setRestoring(false);
    }
  }

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
