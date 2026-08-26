"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import { Monitor, Download, ShieldAlert, FileSpreadsheet, FileJson, Laptop, Trash2, RefreshCw, Plus, Copy, Check } from "lucide-react";
import RestorePanel from "./RestorePanel";

/**
 * Trang MStudo Desktop: tải bản cài Windows, quản lý thiết bị (tối đa 2 máy),
 * và xuất dữ liệu ngay trên web (dùng chung API với client desktop).
 */

type Device = { id: string; name: string; app_version: string | null; last_sync_at: string | null; revoked_at: string | null; created_at: string };

const EXPORTS: [string, string, string][] = [
  ["customers", "Khách hàng", "Danh bạ khách gộp từ hợp đồng"],
  ["quotes", "Báo giá", "Danh sách báo giá + tổng tiền"],
  ["expenses", "Chi tiêu", "Sổ chi tiêu, kèm mã hợp đồng"],
  ["payroll", "Bảng lương", "Lương thợ/nhân viên theo hợp đồng"],
  ["bookings", "Đặt lịch", "Yêu cầu đặt lịch + lịch ghi chú"],
  ["staff", "Nhân viên & sổ thợ", "Tài khoản nhân viên + sổ thợ"],
];

const fmtTime = (s: string | null) => {
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

export default function DesktopPanel() {
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
