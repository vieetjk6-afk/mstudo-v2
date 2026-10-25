"use client";

import { useState } from "react";
import {
  Check, ChevronDown, CircleAlert, Copy, Download, FileJson, FileSpreadsheet, KeyRound, Laptop, Monitor, Plus, RefreshCw,
  ShieldAlert, Trash2,
} from "lucide-react";
import { Badge, Callout, Empty, PageHead, Section, Stack, btn, iconBtn } from "@/components/v2/kit";
import { EXPORTS, fmtTime, useDesktopPanel } from "./useDesktopPanel";
import RestorePanelV2 from "./RestorePanelV2";

/* ═══════════════════════════════════════════════════════════════════════════
   MSTUDO DESKTOP — giao diện mới. Cùng dữ liệu, cùng thao tác với
   DesktopPanel (bản cũ, logic chung ở ./useDesktopPanel); khác ở cách xếp:
     • Thẻ ứng dụng: số máy đang kết nối (nhãn) + MỘT nút chính "Tải bản cài";
       cảnh báo SmartScreen gập lại thành "Windows chặn khi cài?" với các bước.
     • Thiết bị: mã kết nối mới hiện thành 3 bước (chép mã · chép địa chỉ máy
       chủ · dán vào app); mỗi máy một dòng, nút thu hồi.
     • Xuất dữ liệu: danh sách tải gọn; bản sao lưu đầy đủ đứng đầu.
     • Khôi phục: 3 bước đánh số (./RestorePanelV2).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DesktopPanelV2() {
  const p = useDesktopPanel();
  const [helpOpen, setHelpOpen] = useState(false);

  const copyBtn = (text: string, tag: string, label: string) => (
    <button type="button" onClick={() => p.copyText(text, tag)} className={btn("secondary", "sm", "flex-none")} aria-label={label}>
      {p.copied === tag ? <Check size={14} style={{ color: "var(--gn)" }} /> : <Copy size={14} />} {p.copied === tag ? "Đã chép" : "Chép"}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <Stack>
        <PageHead desc="Ứng dụng chạy trên máy tính Windows: tự lưu hợp đồng (PDF + Word) về thư mục bạn chọn ngay khi khách ký, và tự xuất Excel toàn bộ dữ liệu hằng ngày để chống mất dữ liệu." />

        {/* ── Thẻ ứng dụng ────────────────────────────────────────────── */}
        <div className="v2-card overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Monitor size={23} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold">MStudo Desktop cho Windows</p>
                  {p.loading ? null : p.active.length ? (
                    <Badge tone="green" dot>{p.active.length}/{p.limit} máy đang kết nối</Badge>
                  ) : (
                    <Badge tone="gray" dot>Chưa có máy nào</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>
                  Windows 10/11 · 64-bit · file <code>-setup.exe</code>{p.dl.ver ? ` · bản ${p.dl.ver}` : ""}
                </p>
              </div>
            </div>
            <a href={p.downloadUrl} target="_blank" rel="noopener noreferrer" download className={btn("primary", "md", "w-full sm:w-auto")}>
              <Download size={16} /> Tải bản cài đặt{p.dl.ver ? ` (${p.dl.ver})` : ""}
            </a>
          </div>

          <div style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] font-semibold sm:px-5"
            >
              <ShieldAlert size={16} className="flex-none" style={{ color: "var(--am)" }} />
              <span className="min-w-0 flex-1">Windows báo chặn khi cài? Xem cách mở</span>
              <ChevronDown size={16} className="flex-none transition-transform" style={{ color: "var(--tx3)", transform: helpOpen ? "rotate(180deg)" : undefined }} />
            </button>
            {helpOpen && (
              <ol className="flex flex-col gap-3 px-4 pb-4 text-[13px] leading-relaxed sm:px-5" style={{ color: "var(--tx2)" }}>
                {[
                  <>
                    <b style={{ color: "var(--tx)" }}>Cảnh báo SmartScreen</b> (ứng dụng chưa mua chứng chỉ ký số): bấm <b>“More info” → “Run anyway”</b>{" "}
                    (Thông tin thêm → Vẫn chạy). File cài chỉ tải từ trang này là an toàn.
                  </>,
                  <>
                    <b style={{ color: "var(--tx)" }}>File bị “khoá”</b>: chuột phải file <code>-setup.exe</code> → <b>Properties</b> → tick <b>Unblock</b> → OK rồi mở lại.
                  </>,
                  <>
                    <b style={{ color: "var(--tx)" }}>“Smart App Control blocked an app…”</b> (chỉ có trên Windows 11 cài mới): vào{" "}
                    <b>Settings → Privacy &amp; security → Windows Security → App &amp; browser control → Smart App Control → Off</b> rồi cài lại.{" "}
                    <i>(Tắt Smart App Control là một chiều — chỉ nên làm trên máy của bạn.)</i>
                  </>,
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="v2-num flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ── Thiết bị ────────────────────────────────────────────────── */}
        <Section
          icon={Laptop}
          title="Thiết bị của bạn"
          desc={`Tối đa ${p.limit} máy hoạt động cho mỗi tài khoản.`}
          actions={
            <>
              <button type="button" onClick={p.load} className={iconBtn()} aria-label="Làm mới danh sách thiết bị" title="Làm mới">
                <RefreshCw size={16} className={p.loading ? "animate-spin" : undefined} />
              </button>
              <button type="button" onClick={p.pair} disabled={p.pairing} className={btn("secondary", "sm", "hidden sm:inline-flex")}>
                <Plus size={15} /> Kết nối thiết bị mới
              </button>
            </>
          }
          flush
        >
          <div className="flex flex-col gap-3 px-4 pt-4 sm:px-5">
            <button type="button" onClick={p.pair} disabled={p.pairing} className={btn("secondary", "md", "w-full sm:hidden")}>
              <Plus size={16} /> Kết nối thiết bị mới
            </button>
            {p.acct && (
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Thiết bị đăng ký ở đây sẽ đồng bộ dữ liệu của tài khoản <b style={{ color: "var(--tx)" }}>{p.acct.name || p.acct.email}</b>
                {p.acct.name && p.acct.email ? ` (${p.acct.email})` : ""}.
              </p>
            )}
            {p.pairErr && <Callout tone="red" icon={CircleAlert}>{p.pairErr}</Callout>}
            {p.pairToken && (
              <div className="rounded-[14px] p-4" style={{ background: "var(--acS)", border: "1px solid color-mix(in srgb, var(--ac) 22%, transparent)" }}>
                <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <KeyRound size={16} style={{ color: "var(--ac)" }} />
                  Mã kết nối cho tài khoản {p.acct?.name || p.acct?.email || "này"} — chỉ hiện MỘT lần
                </p>
                <ol className="mt-3 flex flex-col gap-3">
                  <li className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>1. Chép mã kết nối</span>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>{p.pairToken}</code>
                      {copyBtn(p.pairToken, "token", "Chép mã kết nối")}
                    </div>
                  </li>
                  <li className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>2. Chép địa chỉ máy chủ</span>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>{p.serverUrl}</code>
                      {copyBtn(p.serverUrl, "server", "Chép địa chỉ máy chủ")}
                    </div>
                  </li>
                  <li className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>3. Dán cả hai vào ứng dụng MStudo Desktop trên máy tính.</li>
                </ol>
              </div>
            )}
            {!p.migrated && (
              <Callout tone="amber" icon={CircleAlert}>
                Cơ sở dữ liệu chưa có bảng thiết bị — chạy <code>supabase/schema.sql</code> mới nhất trong Supabase SQL Editor.
              </Callout>
            )}
          </div>

          <div className="mt-3" style={{ borderTop: "1px solid var(--bd2)" }}>
            {p.loading && p.active.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Đang tải…</p>
            ) : p.active.length === 0 ? (
              <Empty compact icon={Laptop} title="Chưa có thiết bị nào" hint="Cài MStudo Desktop rồi bấm “Kết nối thiết bị mới” để đăng ký máy đầu tiên." />
            ) : (
              p.active.map((d) => (
                <div key={d.id} className="v2-row">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--sf2)", color: "var(--ac)" }}>
                    <Laptop size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="v2-row-title">{d.name || "Máy tính Windows"}</p>
                    <p className="v2-row-sub">
                      {d.app_version ? `v${d.app_version} · ` : ""}Đồng bộ cuối: {fmtTime(d.last_sync_at)}
                    </p>
                  </div>
                  <button type="button" onClick={() => p.revoke(d.id)} className={btn("danger", "sm", "!px-2.5 sm:!px-[11px]")} title="Thu hồi thiết bị" aria-label={`Thu hồi ${d.name || "máy tính"}`}>
                    <Trash2 size={14} /> <span className="hidden sm:inline">Thu hồi</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* ── Xuất dữ liệu ────────────────────────────────────────────── */}
        <Section icon={FileSpreadsheet} title="Xuất dữ liệu ngay" desc="Không cần chờ app — cùng dữ liệu ứng dụng sẽ tự lưu." flush>
          <a href="/api/desktop/export?type=backup" className="v2-row v2-row-link" style={{ background: "var(--sf2)" }}>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <FileJson size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="v2-row-title">Bản sao lưu đầy đủ (.json)</p>
              <p className="v2-row-sub">Toàn bộ hợp đồng, báo giá, chi tiêu, lương, lịch… — dùng để khôi phục khi cần</p>
            </div>
            <Download size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
          </a>
          <div className="grid md:grid-cols-2">
            {EXPORTS.map(([type, label, desc]) => (
              <a key={type} href={`/api/desktop/export?type=${type}`} className="v2-row v2-row-link md:odd:border-r" style={{ borderColor: "var(--bd2)" }}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                  <FileSpreadsheet size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title">{label} <span className="font-normal" style={{ color: "var(--tx3)" }}>.xlsx</span></p>
                  <p className="v2-row-sub">{desc}</p>
                </div>
                <Download size={16} className="flex-none" style={{ color: "var(--tx3)" }} />
              </a>
            ))}
          </div>
        </Section>

        <RestorePanelV2 />
      </Stack>
    </div>
  );
}
