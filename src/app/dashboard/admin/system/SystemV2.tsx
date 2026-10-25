"use client";

import Link from "next/link";
import {
  AlertTriangle, Bot, Check, DatabaseBackup, Download, FileJson, HardDrive, Loader2, Megaphone, Send, Unplug, Upload,
} from "lucide-react";
import { Badge, Callout, Field, ListRow, PageHead, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { SectionNavV2 } from "@/app/dashboard/settings/SectionNavV2";
import { useAdminDrive, type DriveStatus } from "./useAdminDrive";
import { SHORTCUTS, TARGET_LABEL, useSystemPanel, type Target } from "./useSystemPanel";

/* ═══════════════════════════════════════════════════════════════════════════
   CÀI ĐẶT HỆ THỐNG (admin) — giao diện mới. Cùng logic với SystemPanel +
   AdminDriveCard (bản cũ, ./useSystemPanel và ./useAdminDrive); khác ở cách
   sắp xếp:
     • Mục lục bên trái (máy tính): Thông báo · Sao lưu · Khôi phục · Lưu trữ
       Drive · AI; dưới mục lục là lối tắt sang các màn quản trị khác.
     • Mỗi việc một khối có câu giải thích ngắn; công tắc thay cho ô tích.
     • Khôi phục: chọn file → xem trước số dòng từng bảng → nút khôi phục
       màu đỏ (ghi đè dữ liệu), như cũ hỏi lại trước khi chạy.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SystemV2({ ai, driveSeed }: { ai?: React.ReactNode; driveSeed?: DriveStatus }) {
  const s = useSystemPanel();
  const drive = useAdminDrive(driveSeed);
  const ds = drive.state;

  const shortcuts = (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>Màn quản trị khác</p>
      {SHORTCUTS.map((x) => (
        <Link key={x.href} href={x.href} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium hover:bg-[var(--sf2)]" style={{ color: "var(--tx2)" }}>
          <x.icon size={15} className="flex-none" />
          <span className="truncate">{x.label}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <SectionNavV2
        items={[
          { id: "thong-bao", label: "Thông báo tới studio", icon: Megaphone },
          { id: "sao-luu", label: "Sao lưu", icon: DatabaseBackup },
          { id: "khoi-phuc", label: "Khôi phục", icon: Upload },
          {
            id: "luu-tru",
            label: "Lưu trữ Drive",
            icon: HardDrive,
            badge: ds?.connected ? <span className="h-2 w-2 rounded-full" style={{ background: ds.ok ? "var(--gn)" : "var(--am)" }} /> : null,
          },
          ...(ai ? [{ id: "ai", label: "Nhà cung cấp AI", icon: Bot }] : []),
        ]}
        footer={shortcuts}
      />

      <Stack className="min-w-0">
        <PageHead desc="Gửi thông báo cho mọi studio, sao lưu & khôi phục toàn bộ dữ liệu, chọn nơi lưu ảnh người dùng tải lên." />

        {/* ── Thông báo ─────────────────────────────────────────────────── */}
        <Section id="thong-bao" icon={Megaphone} title="Thông báo tới studio" desc="Hiện ngay trong webapp: chuông thông báo + bảng nổi khi người dùng đăng nhập hoặc đang dùng.">
          <form onSubmit={s.sendBroadcast} className="flex flex-col gap-4">
            <Field label="Nội dung" hint={`${s.message.length}/1000 ký tự`} htmlFor="bc-msg">
              <textarea
                id="bc-msg"
                className={inputCls}
                rows={4}
                maxLength={1000}
                placeholder="Ví dụ: Hệ thống bảo trì lúc 23h tối nay, vui lòng lưu công việc."
                value={s.message}
                onChange={(e) => s.setMessage(e.target.value)}
              />
            </Field>
            <Field label="Gửi tới" htmlFor="bc-target" className="sm:max-w-[320px]">
              <select id="bc-target" className={inputCls} value={s.target} onChange={(e) => s.setTarget(e.target.value as Target)}>
                {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
                  <option key={t} value={t}>{TARGET_LABEL[t]}</option>
                ))}
              </select>
            </Field>
            <div className="rounded-[12px] px-3.5 py-1" style={{ border: "1px solid var(--bd2)" }}>
              <Switch
                checked={s.important}
                onChange={s.setImportant}
                label="Thông báo quan trọng"
                desc="Hiện popup nổi giữa màn hình, người dùng phải bấm xác nhận."
              />
              <Switch checked={s.push} onChange={s.setPush} label="Đẩy web push" desc="Báo cả khi người dùng không mở webapp." />
            </div>
            {s.sendMsg ? <Callout tone="blue" icon={Check}>{s.sendMsg}</Callout> : null}
            <div className="flex justify-end">
              <button type="submit" disabled={s.sending || !s.message.trim()} className={btn("primary")}>
                {s.sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi thông báo
              </button>
            </div>
          </form>
        </Section>

        {/* ── Sao lưu ───────────────────────────────────────────────────── */}
        <Section
          id="sao-luu"
          icon={DatabaseBackup}
          title="Sao lưu toàn hệ thống"
          desc="Một file JSON chứa toàn bộ dữ liệu ứng dụng của mọi studio: hợp đồng, khách hàng, báo giá, thu chi, album, thông báo…"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
                Chỉ gồm dữ liệu ứng dụng — không chứa mật khẩu đăng nhập hay ảnh gốc trên Google Drive.
              </p>
              <button type="button" onClick={() => void s.downloadBackup()} disabled={s.backing} className={btn("secondary", "md", "flex-none")}>
                {s.backing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Tải bản sao lưu
              </button>
            </div>
            {s.backupMsg ? <Callout tone="gray">{s.backupMsg}</Callout> : null}
          </div>
        </Section>

        {/* ── Khôi phục ─────────────────────────────────────────────────── */}
        <Section
          id="khoi-phuc"
          icon={Upload}
          title="Khôi phục từ bản sao lưu"
          desc="Bản ghi trùng khóa được cập nhật, bản ghi thiếu được tạo lại. Không xoá dữ liệu nằm ngoài bản sao lưu."
        >
          <div className="flex flex-col gap-3">
            <input ref={s.fileRef} type="file" accept="application/json,.json" onChange={s.pickBackupFile} className="hidden" aria-hidden tabIndex={-1} />
            <div className="flex flex-col gap-3 rounded-[12px] p-3.5 sm:flex-row sm:items-center" style={{ border: "1px dashed var(--bdS)" }}>
              <span className="v2-section-icon" style={{ background: "var(--sf2)", color: "var(--tx2)" }}><FileJson size={17} /></span>
              <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
                Chọn file <b>.json</b> đã tải ở mục Sao lưu. Bước này chỉ <b>đọc thử</b>, chưa ghi gì.
              </p>
              <button type="button" onClick={() => s.fileRef.current?.click()} className={btn("secondary", "md", "flex-none")}>
                <Upload size={16} /> Chọn file
              </button>
            </div>

            {s.restoreErr ? <Callout tone="red" icon={AlertTriangle}>{s.restoreErr}</Callout> : null}

            {s.preview ? (
              <div className="flex flex-col gap-3">
                <Callout tone="amber" icon={AlertTriangle} title="Kiểm tra kỹ trước khi khôi phục">
                  Dữ liệu hiện tại sẽ bị ghi đè bằng các bản ghi dưới đây. Nên tải một bản sao lưu mới trước.
                </Callout>
                <div className="max-h-60 overflow-y-auto rounded-[12px]" style={{ border: "1px solid var(--bd2)" }}>
                  <table className="v2-table">
                    <thead>
                      <tr>
                        <th>Bảng</th>
                        <th className="num">Số dòng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.preview.map((t) => (
                        <tr key={t.table}>
                          <td className="!py-2 font-mono text-[12.5px]" style={{ color: "var(--tx2)" }}>{t.table}</td>
                          <td className="num !py-2 font-semibold">{t.rows.toLocaleString("vi-VN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => void s.applyRestore()} disabled={s.restoring} className={btn("danger")}>
                    {s.restoring ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Khôi phục toàn bộ
                  </button>
                </div>
              </div>
            ) : null}

            {s.restoreMsg ? <Callout tone="green" icon={Check}>{s.restoreMsg}</Callout> : null}
          </div>
        </Section>

        {/* ── Lưu trữ Drive ─────────────────────────────────────────────── */}
        <Section
          id="luu-tru"
          icon={HardDrive}
          title="Lưu trữ ảnh người dùng · Google Drive"
          desc="Bật thì mọi ảnh/logo người dùng tải lên vào một thư mục riêng trên Drive của admin — không tốn dung lượng Supabase."
        >
          {ds === null ? (
            <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--tx3)" }}>
              <Loader2 size={15} className="animate-spin" /> Đang kiểm tra…
            </span>
          ) : !ds.configured ? (
            <Callout tone="amber" icon={AlertTriangle} title="Chưa cấu hình OAuth">
              Cần đặt biến môi trường <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
              <code>GOOGLE_ADMIN_DRIVE_REDIRECT_URI</code> (…/api/admin/drive/callback) và chạy migration <code>admin_drive.sql</code> (bảng{" "}
              <code>admin_drive</code>).
            </Callout>
          ) : ds.connected ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {ds.ok ? <Badge tone="green" dot>Đã kết nối</Badge> : <Badge tone="amber" dot>Kết nối lỗi</Badge>}
                  <span className="text-[13.5px] font-medium" style={{ color: ds.ok ? "var(--gn)" : "var(--am)" }}>
                    {ds.ok ? "File mới đang vào Drive." : "Có token nhưng Drive KHÔNG dùng được."}
                  </span>
                </div>
                <button type="button" onClick={() => void drive.disconnect()} disabled={drive.busy} className={btn("ghost", "sm", "flex-none")}>
                  <Unplug size={15} /> Ngắt kết nối
                </button>
              </div>
              {/* Kết nối hỏng mà vẫn báo xanh chính là cách dung lượng Supabase âm
                  thầm phình lên — nói thẳng lỗi ra đây. */}
              {!ds.ok ? (
                <Callout tone="amber" icon={AlertTriangle}>
                  Mọi upload đang rơi về Supabase Storage. Bấm <b>Ngắt kết nối</b> rồi kết nối lại.
                  {ds.error ? <span className="mt-1 block font-mono text-[12px]" style={{ color: "var(--tx3)" }}>{ds.error}</span> : null}
                </Callout>
              ) : null}
              {ds.lastUploadError ? (
                <Callout tone="gray">
                  Lỗi upload gần nhất: <span className="font-mono">{ds.lastUploadError}</span>
                </Callout>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Badge tone="gray" dot>Chưa kết nối</Badge>
                <span className="text-[13px]" style={{ color: "var(--tx2)" }}>Hệ thống đang tự lưu trên Supabase.</span>
              </div>
              <a href="/api/admin/drive/connect" className={btn("secondary", "md", "flex-none")}>
                <HardDrive size={16} /> Kết nối Google Drive
              </a>
            </div>
          )}
        </Section>

        {ai ? <div id="ai" className="scroll-mt-24">{ai}</div> : null}

        {/* Lối tắt — trên điện thoại không có cột trái nên để ở cuối trang. */}
        <div className="v2-card overflow-hidden lg:hidden">
          <p className="v2-section-title px-4 pt-3.5">Màn quản trị khác</p>
          <div className="mt-1">
            {SHORTCUTS.map((x) => (
              <ListRow
                key={x.href}
                href={x.href}
                leading={<span className="v2-section-icon"><x.icon size={16} /></span>}
                title={x.label}
                sub={x.desc}
              />
            ))}
          </div>
        </div>
      </Stack>
    </div>
  );
}
