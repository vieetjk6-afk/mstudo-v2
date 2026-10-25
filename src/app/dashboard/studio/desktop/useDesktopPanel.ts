"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC màn MStudo Desktop — dùng chung cho bản cũ (DesktopPanel) và bản giao
   diện mới (DesktopPanelV2): link tải bản cài mới nhất, danh sách thiết bị,
   tạo mã kết nối, thu hồi máy, tài khoản đang cấp mã. Hai bản chỉ khác ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Device = { id: string; name: string; app_version: string | null; last_sync_at: string | null; revoked_at: string | null; created_at: string };

export const EXPORTS: [string, string, string][] = [
  ["customers", "Khách hàng", "Danh bạ khách gộp từ hợp đồng"],
  ["quotes", "Báo giá", "Danh sách báo giá + tổng tiền"],
  ["expenses", "Chi tiêu", "Sổ chi tiêu, kèm mã hợp đồng"],
  ["payroll", "Bảng lương", "Lương thợ/nhân viên theo hợp đồng"],
  ["bookings", "Đặt lịch", "Yêu cầu đặt lịch + lịch ghi chú"],
  ["staff", "Nhân viên & sổ thợ", "Tài khoản nhân viên + sổ thợ"],
];

export const fmtTime = (s: string | null) => {
  if (!s) return "Chưa đồng bộ";
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Repo chứa GitHub Releases của bản cài desktop. Mặc định vẫn là repo CŨ vì nó
// CÔNG KHAI: mstudo-v2 là repo riêng tư, nên cả trang Releases lẫn GitHub API của
// nó đều trả 404 cho trình duyệt của studio. Khi nào có repo công khai mới cho
// bản cài thì đặt NEXT_PUBLIC_DESKTOP_RELEASES_REPO, không phải sửa code.
const RELEASES_REPO = process.env.NEXT_PUBLIC_DESKTOP_RELEASES_REPO || "vieetjk01/Studio";
const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases`;

export function useDesktopPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [limit, setLimit] = useState(2);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [pairToken, setPairToken] = useState("");
  const [pairErr, setPairErr] = useState("");
  const [copied, setCopied] = useState("");
  // Tài khoản mà mã kết nối này thuộc về. Studio có nhiều tài khoản mà dán nhầm
  // mã sang máy đang dùng cho studio khác thì app đồng bộ đúng dữ liệu của TÀI
  // KHOẢN CẤP MÃ — nhìn bề ngoài y hệt "đồng bộ thiếu". Nói rõ ngay tại đây.
  const [acct, setAcct] = useState<{ name: string; email: string } | null>(null);
  // Link tải: mặc định là env cấu hình sẵn, nếu trống thì trang Releases. Sau đó
  // tự lấy file .exe MỚI NHẤT trực tiếp từ GitHub (kênh desktop-dev — cùng nguồn
  // bộ tự cập nhật đọc) để nút luôn ra link .exe đúng bản mới, không phụ thuộc env.
  const [dl, setDl] = useState<{ url: string; ver: string | null }>({
    url: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || RELEASES_PAGE,
    ver: null,
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/tags/desktop-dev`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!r.ok) return;
        const rel = await r.json();
        const setups = (rel.assets || []).filter((a: { name?: string }) => /-setup\.exe$/i.test(a.name || ""));
        if (!setups.length) return;
        const parseVer = (n: string) => { const m = /(\d+\.\d+\.\d+)/.exec(n || ""); return m ? m[1] : "0"; };
        const cmp = (a: string, b: string) => {
          const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
          for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
          return 0;
        };
        const best = setups.reduce(
          (x: { name: string; browser_download_url: string }, a: { name: string; browser_download_url: string }) =>
            cmp(parseVer(a.name), parseVer(x.name)) > 0 ? a : x,
          setups[0]
        );
        if (alive && best?.browser_download_url) setDl({ url: best.browser_download_url, ver: parseVer(best.name) });
      } catch { /* giữ link mặc định */ }
    })();
    return () => { alive = false; };
  }, []);
  const downloadUrl = dl.url;
  const serverUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function load() {
    setLoading(true);
    try {
      fetch("/api/desktop/whoami")
        .then((x) => (x.ok ? x.json() : null))
        .then((j) => j?.account && setAcct({ name: j.account.name || "", email: j.account.email || "" }))
        .catch(() => {});
      const r = await fetch("/api/desktop/devices");
      const j = await r.json();
      setDevices(j.devices ?? []);
      setMigrated(j.migrated !== false);
      if (j.limit) setLimit(j.limit);
    } catch { /* */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function revoke(id: string) {
    if (!confirm("Thu hồi thiết bị này? Máy đó sẽ ngừng đồng bộ ngay lập tức.")) return;
    await fetch(`/api/desktop/devices?id=${id}`, { method: "DELETE" });
    load();
  }

  // Tạo mã kết nối cho máy mới — token chỉ hiện MỘT lần, dán vào app desktop.
  async function pair() {
    setPairing(true); setPairErr(""); setPairToken("");
    try {
      const r = await fetch("/api/desktop/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Máy đăng ký ${fmtDate(new Date())}` }),
      });
      const j = await r.json();
      if (!r.ok) {
        setPairErr(j.error === "device_limit" ? `Đã đạt giới hạn ${limit} máy — thu hồi một thiết bị cũ trước.` : "Không tạo được mã kết nối. Đã chạy schema.sql mới nhất chưa?");
      } else {
        setPairToken(j.token);
        load();
      }
    } catch { setPairErr("Không tạo được mã kết nối."); }
    setPairing(false);
  }

  async function copyText(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(""), 2000); } catch { /* */ }
  }

  const active = devices.filter((d) => !d.revoked_at);

  return {
    devices, migrated, limit, loading, pairing, pairToken, pairErr, copied, acct, dl, downloadUrl, serverUrl,
    load, revoke, pair, copyText, active,
  };
}
