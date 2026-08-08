"use client";

import { useEffect, useState } from "react";
import { Monitor, Download, ShieldAlert, FileSpreadsheet, FileJson, FileText, Laptop, Trash2, RefreshCw, Plus, Copy, Check } from "lucide-react";
import RestorePanel from "./RestorePanel";
import { Panel, PanelHead, Pill, EmptyState } from "@/components/studio/ui";

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
  const RELEASES_PAGE = "https://github.com/vieetjk01/Studio/releases";
  const [dl, setDl] = useState<{ url: string; ver: string | null }>({
    url: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || RELEASES_PAGE,
    ver: null,
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("https://api.github.com/repos/vieetjk01/Studio/releases/tags/desktop-dev", {
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
        body: JSON.stringify({ name: `Máy đăng ký ${new Date().toLocaleDateString("vi-VN")}` }),
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

  /* Bốn việc app làm — bản thiết kế bày thành lưới 2 cột thẻ viền nhỏ. */
  const FEATURES: [typeof FileSpreadsheet, string, string][] = [
    [FileText, "Lưu hợp đồng tự động", "Khách vừa ký là có PDF + Word trong thư mục bạn chọn."],
    [FileSpreadsheet, "Xuất Excel hằng ngày", "Toàn bộ khách, báo giá, thu chi, lương — tự chạy nền."],
    [FileJson, "Sao lưu đầy đủ", "Một file .json khôi phục lại được cả studio khi cần."],
    [RefreshCw, "Đồng bộ hai chiều", "Sửa trên web hay trên máy đều về cùng một chỗ."],
  ];

  return (
    <div className="page-in grid max-w-[1020px] items-start gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* ══ Cột trái — ứng dụng và thiết bị ═════════════════════════════ */}
      <div className="flex flex-col gap-3.5">
        <Panel className="px-5 py-[18px]">
          <div className="flex items-center gap-3.5">
            <span className="flex-none rounded-[12px] p-[11px]" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
              <Monitor size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>mstudo Desktop{dl.ver ? ` ${dl.ver}` : ""}</p>
              <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>Windows 10/11 · 64-bit · file <code>-setup.exe</code></p>
            </div>
            <Pill tone={active.length > 0 ? "green" : "gray"}>
              {active.length > 0 ? `${active.length}/${limit} máy đang kết nối` : "Chưa kết nối máy nào"}
            </Pill>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {FEATURES.map(([Icon, t, s]) => (
              <div key={t} className="flex gap-2.5 rounded-[11px] p-3" style={{ border: "1px solid var(--bd)" }}>
                <Icon size={18} className="mt-px flex-none" style={{ color: "var(--tx2)" }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{t}</p>
                  <p className="mt-0.5 text-[11.5px] leading-[1.5]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{s}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Download size={18} /> Tải cho Windows
            </a>
            <button
              onClick={pair}
              disabled={pairing}
              className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{ border: "1px solid var(--bd)" }}
            >
              <Plus size={17} /> Kết nối thiết bị mới
            </button>
          </div>

          {/* Cảnh báo SmartScreen — khối chú thích nền phụ, không phải hộp đỏ. */}
          <div className="mt-4 flex gap-2.5 rounded-[10px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
            <ShieldAlert size={17} className="mt-px flex-none" style={{ color: "var(--am)" }} />
            <p className="text-[11.5px] leading-[1.55]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              Windows có thể chặn bằng <b>SmartScreen</b> vì bản cài chưa mua chứng chỉ ký số — bấm <b>More info → Run anyway</b>.
              File bị “khoá”: chuột phải <code>-setup.exe</code> → <b>Properties</b> → tick <b>Unblock</b>.
              Nếu báo <b>Smart App Control blocked an app</b> (chỉ Windows 11 cài mới): <b>Settings → Privacy &amp; security → Windows Security → App &amp; browser control → Smart App Control → Off</b> rồi cài lại.
            </p>
          </div>
        </Panel>

        {/* ── Thiết bị đã kết nối ─────────────────────────────────────── */}
        <Panel>
          <PanelHead icon={Laptop} tone="brand" title="Thiết bị của bạn" count={`${active.length}/${limit}`} note="Dán mã kết nối vào app trên máy tính" />

          <div className="px-4 pt-3">
            {acct && (
              <p className="text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                Máy đăng ký ở đây đồng bộ dữ liệu của tài khoản <b style={{ color: "var(--tx2)" }}>{acct.name || acct.email}</b>
                {acct.name && acct.email ? ` (${acct.email})` : ""}.
              </p>
            )}
            {pairErr && (
              <p className="mt-2 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{pairErr}</p>
            )}
            {!migrated && (
              <p className="mt-2 rounded-[10px] px-3 py-2.5 text-[11.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                Cơ sở dữ liệu chưa có bảng thiết bị — chạy <code>supabase/schema.sql</code> mới nhất trong Supabase SQL Editor.
              </p>
            )}
            {pairToken && (
              <div className="mt-2.5 rounded-[11px] p-3.5" style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}>
                <p className="text-[12.5px] font-semibold">
                  Mã kết nối cho <b>{acct?.name || acct?.email || "tài khoản này"}</b> — chỉ hiện MỘT lần, dán ngay vào app:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-[9px] px-3 py-2 text-[11.5px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>{pairToken}</code>
                  <button
                    onClick={() => copyText(pairToken, "token")}
                    className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    {copied === "token" ? <Check size={14} /> : <Copy size={14} />} {copied === "token" ? "Đã chép" : "Chép mã"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px]" style={{ color: "var(--tx3)" }}>Địa chỉ máy chủ:</span>
                  <code className="rounded-[7px] px-2 py-1 text-[11px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>{serverUrl}</code>
                  <button onClick={() => copyText(serverUrl, "server")} className="flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--ac)" }}>
                    {copied === "server" ? <Check size={12} /> : <Copy size={12} />} {copied === "server" ? "Đã chép" : "Chép"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3">
            {loading && <p className="px-4 pb-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>Đang tải…</p>}
            {!loading && active.length === 0 && (
              <EmptyState icon={Laptop} title="Chưa có thiết bị nào" hint="Tải bản cài, mở app rồi dán mã kết nối để đăng ký máy đầu tiên." />
            )}
            {active.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-[13px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf2)", color: "var(--tx2)", lineHeight: 0 }}>
                  <Laptop size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{d.name || "Máy tính Windows"}</p>
                  <p className="tnum mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {d.app_version ? `v${d.app_version} · ` : ""}Đồng bộ cuối: {fmtTime(d.last_sync_at)}
                  </p>
                </div>
                <button
                  onClick={() => revoke(d.id)}
                  className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-[7px] text-[12px] font-semibold"
                  style={{ background: "var(--rdS)", color: "var(--rd)" }}
                >
                  <Trash2 size={14} /> Thu hồi
                </button>
              </div>
            ))}
            <button
              onClick={load}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-[12.5px] font-semibold"
              style={{ borderTop: "1px solid var(--bd2)", color: "var(--ac)" }}
            >
              <RefreshCw size={14} /> Làm mới danh sách
            </button>
          </div>
        </Panel>
      </div>

      {/* ══ Cột phải — xuất dữ liệu và khôi phục ═════════════════════════ */}
      <div className="flex flex-col gap-3.5">
        <Panel>
          <PanelHead icon={FileSpreadsheet} tone="green" title="Xuất dữ liệu ngay" note="Cùng dữ liệu app tự lưu" />
          <p className="px-4 pt-3 text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Không cần chờ app trên máy — tải Excel từng mảng hoặc bản sao lưu đầy đủ ngay tại đây.
          </p>
          <div className="mt-2.5">
            {EXPORTS.map(([type, label, desc]) => (
              <a
                key={type}
                href={`/api/desktop/export?type=${type}`}
                className="flex items-center gap-3 px-4 py-[11px]"
                style={{ borderTop: "1px solid var(--bd2)" }}
              >
                <FileSpreadsheet size={18} className="flex-none" style={{ color: "var(--gn)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{label} <span style={{ color: "var(--tx3)", fontWeight: 500 }}>.xlsx</span></span>
                  <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{desc}</span>
                </span>
                <Download size={15} className="flex-none" style={{ color: "var(--tx3)" }} />
              </a>
            ))}
            <a href="/api/desktop/export?type=backup" className="flex items-center gap-3 px-4 py-[11px]" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
              <FileJson size={18} className="flex-none" style={{ color: "var(--ac)" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">Bản sao lưu đầy đủ <span style={{ color: "var(--tx3)", fontWeight: 500 }}>.json</span></span>
                <span className="block text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>Toàn bộ hợp đồng, báo giá, thu chi, lương, lịch — dùng để khôi phục khi cần.</span>
              </span>
              <Download size={15} className="flex-none" style={{ color: "var(--tx3)" }} />
            </a>
          </div>
          <p className="m-4 rounded-[10px] px-3.5 py-3 text-[11.5px] leading-[1.55]" style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}>
            Bản sao lưu tải về chỉ nằm trên máy của bạn. Nên giữ thêm một bản trên ổ ngoài hoặc Drive để phòng hỏng ổ cứng.
          </p>
        </Panel>

        {/* Khôi phục ngược từ bản sao lưu */}
        <RestorePanel />
      </div>
    </div>
  );
}
