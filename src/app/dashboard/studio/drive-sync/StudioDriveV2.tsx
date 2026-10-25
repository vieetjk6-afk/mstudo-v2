"use client";

import Link from "next/link";
import {
  AlertTriangle, Check, ChevronRight, Download, FolderPlus, FolderTree, HardDrive, Info, ListChecks, Loader2, Monitor, Plus,
  Save, Trash2, Unplug,
} from "lucide-react";
import { Badge, Callout, Field, PageHead, Progress, Section, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { ROLE_LABEL, useStudioDrive, type DriveRole } from "./useStudioDrive";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỒNG BỘ GOOGLE DRIVE — giao diện mới. Cùng dữ liệu, cùng thao tác với
   StudioDriveCard (bản cũ, logic chung ở ./useStudioDrive); khác ở cách xếp:
     • Thẻ kết nối: Drive đã nối chưa (nhãn trạng thái) + MỘT nút kết nối /
       ngắt; dải dưới nói có bao nhiêu máy đang chạy MStudo Desktop.
     • "Cách để ảnh tự đồng bộ": 3 bước đánh số, bước xong tự tích xanh.
     • "Thư mục trên Drive": sơ đồ đường dẫn + thư mục gốc + mẫu thư mục trong
       mỗi hợp đồng (công tắc "Đồng bộ Drive" từng thư mục); sửa là hiện thanh
       Lưu dính đáy.
     • "Tạo thư mục ngay trên web" tách riêng một khối.
   ═══════════════════════════════════════════════════════════════════════════ */

function PathChips({ parts }: { parts: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parts.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          <span className="rounded-[8px] px-2 py-1 text-[12.5px] font-semibold" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>{p}</span>
          {i < parts.length - 1 ? <ChevronRight size={14} style={{ color: "var(--tx3)" }} /> : null}
        </span>
      ))}
    </div>
  );
}

export default function StudioDriveV2() {
  const d = useStudioDrive();
  const { state, tpl } = d;
  const hasDevice = d.devices !== null && d.devices > 0;

  const steps = [
    {
      done: hasDevice,
      title: "Tải và cài MStudo Desktop trên máy tính (Windows 10/11)",
      body: (
        <div className="flex flex-col items-start gap-2">
          <span>App chạy nền trên máy chứa ảnh; không có app thì Drive không tự đồng bộ.</span>
          <Link href="/dashboard/studio/desktop" className={btn("secondary", "sm")}>
            <Download size={14} /> Tải MStudo Desktop
          </Link>
        </div>
      ),
    },
    {
      done: !!state?.connected,
      title: "Kết nối Google Drive của studio",
      body: <>Bấm <b>Kết nối Google Drive</b> ở thẻ phía trên và chọn tài khoản Google chứa ảnh của studio. Chỉ làm một lần.</>,
    },
    {
      done: hasDevice,
      title: "Mở app, kết nối máy và chọn thư mục gốc",
      body: (
        <>
          Ở trang <Link href="/dashboard/studio/desktop" className="font-semibold underline underline-offset-2" style={{ color: "var(--ac)" }}>MStudo Desktop</Link> bấm{" "}
          <b>Kết nối thiết bị mới</b>, chép <b>mã kết nối</b> và <b>địa chỉ máy chủ</b> dán vào app. Sau đó: biểu tượng khay →{" "}
          <i>Bảng điều khiển &amp; đồng bộ</i> → <i>Chọn thư mục gốc</i> (nơi chứa ảnh/video trên máy). Từ đó mỗi hợp đồng đã ký tự có
          thư mục; ảnh bỏ vào thư mục trên máy sẽ <b>tự tải lên Drive</b>, JPG Goc thành album chọn ảnh, File ChinhSua thành gallery giao khách.
        </>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const status =
    state === null ? (
      <Badge tone="gray" icon={Loader2}>Đang kiểm tra…</Badge>
    ) : !state.configured ? (
      <Badge tone="red" dot>Máy chủ chưa cấu hình</Badge>
    ) : state.connected ? (
      <Badge tone="green" dot>Đã kết nối</Badge>
    ) : (
      <Badge tone="amber" dot>Chưa kết nối</Badge>
    );

  const renderGroup = (group: "photo" | "video", label: string, hint: string) =>
    tpl && (
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <p className="text-[13.5px] font-semibold">{label}</p>
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{hint}</p>
        </div>
        <div className="flex flex-col gap-2">
          {tpl[group].map((n, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-[12px] p-2 sm:flex-nowrap" style={{ background: "var(--sf2)" }}>
              <input
                value={n.name}
                onChange={(e) => d.editNode(group, i, { name: e.target.value })}
                placeholder="Tên thư mục"
                aria-label="Tên thư mục"
                className={`${inputCls} min-w-0 basis-full sm:flex-1`}
              />
              <select
                value={n.role || "none"}
                onChange={(e) => d.editNode(group, i, { role: e.target.value === "none" ? null : (e.target.value as DriveRole) })}
                aria-label={`Vai trò của thư mục ${n.name || "mới"}`}
                className={`${inputCls} min-w-0 flex-1 sm:!w-[200px] sm:flex-none`}
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="flex-none px-1 [&_.v2-switch-row]:py-0">
                <Switch checked={!n.excluded} onChange={(on) => d.editNode(group, i, { excluded: !on })} label={<span className="whitespace-nowrap text-[12.5px]">Lên Drive</span>} />
              </div>
              <button type="button" onClick={() => d.removeNode(group, i)} className={iconBtn()} aria-label={`Xoá thư mục ${n.name || "mới"}`} title="Xoá" style={{ color: "var(--rd)" }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => d.addNode(group)} className={btn("ghost", "sm", "mt-1.5 -ml-1")}>
          <Plus size={14} /> Thêm thư mục
        </button>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <Stack>
        <PageHead desc="Kết nối Drive của studio một lần. Khi hợp đồng đã ký, MStudo Desktop tạo thư mục theo tên hợp đồng và tự tải ảnh/video lên: JPG Goc thành album chọn ảnh, File ChinhSua thành gallery giao khách." />

        {d.flash && <Callout tone="blue" icon={Info}>{d.flash}</Callout>}

        {/* ── Thẻ kết nối ─────────────────────────────────────────────── */}
        <div className="v2-card overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <span
                className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px]"
                style={state?.connected ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--acS)", color: "var(--ac)" }}
              >
                <HardDrive size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold">Google Drive của studio</p>
                  {status}
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>
                  {state?.connected
                    ? `Hợp đồng đã ký tự đồng bộ vào thư mục gốc “${state.rootFolderName || "MStudo"}”.`
                    : "Chọn tài khoản Google chứa ảnh của studio. Chỉ làm một lần."}
                </p>
              </div>
            </div>
            {state?.configured ? (
              state.connected ? (
                <button type="button" onClick={d.disconnect} disabled={d.busy} className={btn("danger", "md", "w-full sm:w-auto")}>
                  <Unplug size={16} /> Ngắt kết nối
                </button>
              ) : (
                <a href="/api/studio/drive/connect" className={btn("primary", "md", "w-full sm:w-auto")}>
                  <HardDrive size={16} /> Kết nối Google Drive
                </a>
              )
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px] sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
            <Monitor size={15} className="flex-none" style={{ color: hasDevice ? "var(--gn)" : "var(--tx3)" }} />
            <span className="min-w-0 flex-1" style={{ color: "var(--tx2)" }}>
              {hasDevice
                ? `Đang có ${d.devices} máy chạy MStudo Desktop.`
                : "Chưa có máy nào chạy MStudo Desktop — không có app thì Drive không tự đồng bộ."}
            </span>
            {!hasDevice && (
              <Link href="/dashboard/studio/desktop" className="text-[13px] font-semibold" style={{ color: "var(--ac)" }}>
                Tải app
              </Link>
            )}
          </div>
        </div>

        {state && !state.configured && (
          <Callout tone="red" icon={AlertTriangle} title="Máy chủ chưa cấu hình OAuth">
            Cần đặt <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
            <code>GOOGLE_STUDIO_DRIVE_REDIRECT_URI</code> (…/api/studio/drive/callback) và chạy migration <code>studio_drive_sync.sql</code>.
          </Callout>
        )}

        {/* ── Ba bước ─────────────────────────────────────────────────── */}
        <Section
          icon={ListChecks}
          title="Cách để ảnh/video tự đồng bộ lên Drive"
          desc={doneCount === steps.length ? "Đã xong cả 3 bước." : `Đã xong ${doneCount}/${steps.length} bước.`}
          actions={<div className="w-24"><Progress value={(doneCount / steps.length) * 100} tone={doneCount === steps.length ? "green" : "brand"} /></div>}
        >
          <ol className="flex flex-col gap-4">
            {steps.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={st.done ? { background: "var(--gn)", color: "#fff" } : { background: "var(--acS)", color: "var(--ac)" }}
                >
                  {st.done ? <Check size={15} strokeWidth={2.6} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[14px] font-semibold" style={st.done ? { color: "var(--tx2)" } : undefined}>{st.title}</p>
                  <div className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>{st.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Thư mục trên Drive ──────────────────────────────────────── */}
        <Section icon={FolderTree} title="Thư mục trên Drive" desc="Giống hệt trên Drive và trên máy. Loại dịch vụ và tháng chỉ tạo một lần, hợp đồng sau lưu đúng vào đó.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: "var(--sf2)" }}>
              <PathChips parts={[state?.rootFolderName || "Thư mục gốc", "Loại dịch vụ", "Thang(ngày thực hiện)", "Tên hợp đồng"]} />
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Trong thư mục hợp đồng có <code>Photo/JPG Goc · Raw · File ChinhSua</code> (và <code>Video</code> nếu có quay).
              </p>
            </div>

            {state?.connected && tpl ? (
              <>
                <Field
                  label="Thư mục gốc trên Drive"
                  hint={
                    <>
                      App tạo thư mục này trong Drive của bạn; bên trong tự chia theo loại dịch vụ rồi tháng. Bạn có thể tự kéo nó vào bất kỳ đâu trong
                      Drive — app vẫn đồng bộ đúng.{state.rootCreated ? " Đổi tên ở đây sẽ đổi luôn trên Drive." : ""}
                    </>
                  }
                >
                  <input value={d.rootName} onChange={(e) => d.setRootName(e.target.value)} placeholder="MStudo" className={`${inputCls} max-w-sm`} />
                </Field>

                <div className="h-px" style={{ background: "var(--bd2)" }} />

                <div>
                  <p className="text-[14px] font-semibold">Mẫu thư mục trong mỗi hợp đồng</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Áp dụng cho hợp đồng tạo cây SAU khi lưu. Tắt “Lên Drive” để giữ thư mục chỉ ở máy (vd Raw, Video gốc).
                  </p>
                </div>
                {renderGroup("photo", "Photo/", "ảnh")}
                {renderGroup("video", "Video/", "khi hợp đồng có quay")}

                {!d.dirty && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={d.saveTemplate} disabled={d.busy} className={btn("secondary")}>
                      {d.busy ? <Loader2 size={15} className="animate-spin" /> : d.saved ? <Check size={15} /> : <Save size={15} />}
                      {d.saved ? "Đã lưu" : "Lưu mẫu thư mục"}
                    </button>
                    {d.saved ? <Badge tone="green" icon={Check}>Đã lưu</Badge> : null}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--tx3)" }}>
                {state === null ? "Đang kiểm tra kết nối…" : "Kết nối Google Drive để đặt thư mục gốc và mẫu thư mục cho mỗi hợp đồng."}
              </p>
            )}
          </div>
        </Section>

        {/* ── Tạo thư mục ngay trên web ───────────────────────────────── */}
        <Section icon={FolderPlus} title="Tạo thư mục cho hợp đồng ngay trên web" desc="Dành cho lúc không mở MStudo Desktop.">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
              Chạy cho mọi hợp đồng đã chốt mà chưa có thư mục; hợp đồng đã có thì bỏ qua, bấm lại không tạo trùng.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={d.makeAllFolders} disabled={d.foldersBusy} className={btn("secondary")}>
                {d.foldersBusy ? <Loader2 size={15} className="animate-spin" /> : <FolderPlus size={15} />}
                {d.foldersBusy ? "Đang tạo…" : "Tạo thư mục cho các hợp đồng còn thiếu"}
              </button>
              {d.foldersMsg && <span className="text-[13px]" style={{ color: "var(--tx2)" }}>{d.foldersMsg}</span>}
            </div>
            {/* Nút trên chỉ tạo thư mục TRÊN DRIVE — máy chủ không với tới ổ đĩa của studio. */}
            <Callout tone="gray" icon={Info}>
              Nút này chỉ tạo thư mục <b>trên Drive</b>. Thư mục <b>trên máy</b> do MStudo Desktop tạo, và nó cần bạn đã chọn{" "}
              <b>Thư mục gốc ảnh/video</b> một lần: biểu tượng khay → <i>Bảng điều khiển &amp; đồng bộ</i> → <i>Chọn thư mục gốc</i>. Chưa chọn
              thì desktop bỏ qua im lặng và máy sẽ không có thư mục nào.
            </Callout>
          </div>
        </Section>

        {/* Thanh lưu dính đáy khi mẫu thư mục có thay đổi chưa lưu. */}
        {d.dirty && (
          <div className="sticky bottom-[80px] z-40 lg:bottom-5">
            <div className="v2-card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ boxShadow: "var(--sh-pop)" }}>
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} />
              <p className="min-w-0 flex-1 text-[13.5px] font-semibold">Mẫu thư mục có thay đổi chưa lưu</p>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <button type="button" onClick={d.resetTemplate} disabled={d.busy} className={btn("ghost")}>
                  Huỷ thay đổi
                </button>
                <button type="button" onClick={d.saveTemplate} disabled={d.busy} className={btn("primary")}>
                  {d.busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {d.busy ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Stack>
    </div>
  );
}
