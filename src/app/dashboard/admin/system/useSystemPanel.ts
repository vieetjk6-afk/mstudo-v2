"use client";

import { useRef, useState } from "react";
import { Gift, Settings, Users } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Cài đặt hệ thống" (bản cũ SystemPanel và bản mới
   SystemV2): gửi thông báo toàn studio, tải bản sao lưu, đọc thử rồi khôi phục
   bản sao lưu. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Target = "everyone" | "all" | "studio" | "booking";

export const TARGET_LABEL: Record<Target, string> = {
  everyone: "Tất cả tài khoản",
  all: "Tất cả studio",
  studio: "Chỉ gói Studio",
  booking: "Chỉ Photographer / Basic",
};

// Nhãn khớp với nhóm "Quản trị hệ thống" trong sidebar — cùng một màn thì phải
// cùng một tên, nếu không admin tưởng là hai chỗ khác nhau.
export const SHORTCUTS = [
  { href: "/dashboard/admin", label: "Người dùng & studio", desc: "Tài khoản, gói, quyền, DUYỆT yêu cầu nâng cấp & mã giảm giá", icon: Users },
  { href: "/dashboard/admin/affiliate", label: "Quản lý Affiliate", desc: "Hoa hồng, tỉ lệ, thanh toán", icon: Gift },
  { href: "/dashboard/settings", label: "Cấu hình mstudo", desc: "Cấu hình nền tảng, gói & giá, nội dung trang nâng cấp, góp ý", icon: Settings },
];

export function useSystemPanel() {
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

  return {
    message, setMessage, target, setTarget, important, setImportant, push, setPush, sending, sendMsg, sendBroadcast,
    backing, backupMsg, downloadBackup,
    fileRef, restoreDoc, preview, restoring, restoreMsg, restoreErr, pickBackupFile, applyRestore,
  };
}

export type SystemState = ReturnType<typeof useSystemPanel>;
