"use client";

import { useRef, useState } from "react";
import { Gift, Settings, Users } from "lucide-react";
import { BACKUP_TABLES, RESTORE_SKIP_TABLES, chunkRows } from "@/lib/admin/backup-tables";

type BackupDoc = { kind?: string; data: Record<string, unknown> };

/**
 * Đọc file sao lưu: .json (bản cũ / tải tay trước đây) hoặc .json.gz (bản tải
 * về và bản tự động trên Drive). Nhận gzip theo 2 byte đầu (1f 8b) chứ không
 * theo đuôi file — trình duyệt / Drive đôi khi bỏ mất ".gz" lúc tải.
 */
async function readBackupFile(file: File): Promise<BackupDoc> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const gz = head[0] === 0x1f && head[1] === 0x8b;
  const text = gz
    ? await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : await file.text();
  return JSON.parse(text) as BackupDoc;
}

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
  const [restoreDoc, setRestoreDoc] = useState<BackupDoc | null>(null);
  const [preview, setPreview] = useState<{ table: string; rows: number; skip: boolean }[] | null>(null);
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
      const name = m?.[1] || "mstudo-backup.json.gz";
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
      const doc = await readBackupFile(file);
      if (doc?.kind !== "mstudo-full-backup" || !doc.data || typeof doc.data !== "object") {
        setRestoreErr("File không phải bản sao lưu MStudo hợp lệ.");
        return;
      }
      // Xem trước ngay trên trình duyệt (không gửi gì lên máy chủ): bản cũ gửi
      // CẢ file lên chỉ để đếm dòng, và hỏng với file > 4,5 MB.
      const rows = (t: string) => (Array.isArray(doc.data[t]) ? doc.data[t].length : 0);
      setRestoreDoc(doc);
      setPreview(
        BACKUP_TABLES.filter((t) => rows(t) > 0).map((t) => ({ table: t, rows: rows(t), skip: RESTORE_SKIP_TABLES.has(t) })),
      );
    } catch {
      setRestoreErr("Không đọc được file (hỏng, hoặc không phải .json / .json.gz).");
    }
  }

  async function applyRestore() {
    if (!restoreDoc || restoring) return;
    if (!window.confirm(
      "KHÔI PHỤC sẽ ghi đè dữ liệu hiện tại bằng dữ liệu trong bản sao lưu (cập nhật bản ghi trùng khóa, tạo lại bản ghi thiếu). " +
      "Nên tải một bản sao lưu mới trước khi khôi phục. Tiếp tục?"
    )) return;
    setRestoring(true);
    setRestoreErr(null);
    const doc = restoreDoc as BackupDoc;
    // Lần lượt bảng cha → con, mỗi lô một request nhỏ. Lô lỗi (thường vì khoá
    // ngoại tới dòng của bảng đứng sau) được thử lại một lượt ở cuối.
    type Lo = { table: string; rows: unknown[] };
    const queue: Lo[] = [];
    for (const table of BACKUP_TABLES) {
      if (RESTORE_SKIP_TABLES.has(table)) continue;
      const rows = Array.isArray(doc.data[table]) ? (doc.data[table] as unknown[]) : [];
      for (const part of chunkRows(rows)) queue.push({ table, rows: part });
    }
    let restored = 0;
    const send = async (lo: Lo): Promise<string | null> => {
      try {
        const res = await fetch("/api/admin/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lo),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return String(data.error ?? `HTTP ${res.status}`);
        restored += Number(data.restored ?? lo.rows.length);
        return null;
      } catch {
        return "lỗi kết nối";
      }
    };
    try {
      let failed: (Lo & { error: string })[] = [];
      for (let i = 0; i < queue.length; i++) {
        setRestoreMsg(`Đang khôi phục ${queue[i].table}… (${i + 1}/${queue.length} lô)`);
        const err = await send(queue[i]);
        if (err) failed.push({ ...queue[i], error: err });
      }
      if (failed.length) {
        setRestoreMsg(`Thử lại ${failed.length} lô lỗi…`);
        const again: typeof failed = [];
        for (const f of failed) {
          const err = await send(f);
          if (err) again.push({ ...f, error: err });
        }
        failed = again;
      }
      setRestoreMsg(`Đã khôi phục ${restored.toLocaleString("vi-VN")} bản ghi.`);
      if (failed.length) {
        const byTable = new Map<string, string>();
        for (const f of failed) if (!byTable.has(f.table)) byTable.set(f.table, f.error);
        setRestoreErr("Một số bảng lỗi: " + [...byTable].map(([t, e]) => `${t} (${e})`).join("; "));
      }
      setPreview(null);
      setRestoreDoc(null);
      if (fileRef.current) fileRef.current.value = "";
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
