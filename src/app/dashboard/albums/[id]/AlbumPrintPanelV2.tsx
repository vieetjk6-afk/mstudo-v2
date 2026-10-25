"use client";

import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, FileText, FolderInput, Loader2, Printer, RotateCcw, Unplug } from "lucide-react";
import { stripExtension } from "@/lib/drive";
import { fmtDate } from "@/lib/date";
import { PRINT_FOLDER_NAME } from "@/lib/album-print-rules";
import { Badge, Callout, Empty, Field, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { Menu } from "@/components/v2/kit-client";
import type { AlbumPrintInfo } from "./AlbumPrintPanel";
import { useAlbumPrint } from "./useAlbumPrint";
import { Thumb, codesText, copyText, downloadText } from "./album-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   ẢNH IN TẶNG — giao diện mới (tab "Ảnh in" của màn album). Cùng logic với
   AlbumPrintPanel (./useAlbumPrint); sắp xếp lại:
     • Đầu khối: được tặng bao nhiêu · khách đã gửi · đã chuyển in chưa.
     • Số ảnh tặng (album lẻ nhập ngay, tự lưu) hoặc link sửa ở hợp đồng.
     • Lưới ảnh khách chọn in + MỘT nút chép vào thư mục "Ảnh in"; chép mã ảnh
       và "cho khách chọn lại" dồn vào menu ⋯.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AlbumPrintPanelV2({
  albumId,
  albumSlug,
  info,
  photos,
  hasDeliveryFolder,
  onToast,
}: {
  albumId: string;
  albumSlug: string;
  info: AlbumPrintInfo;
  photos: { id: string; drive_file_id: string }[];
  hasDeliveryFolder: boolean;
  onToast?: (m: string) => void;
}) {
  const p = useAlbumPrint({ albumId, info, photos });
  const names = info.picks.map((x) => x.photo_name);

  const status =
    p.copiedAt ? (
      <Badge tone="green" icon={CheckCircle2}>Đã chuyển in {fmtDate(p.copiedAt)}</Badge>
    ) : p.n > 0 ? (
      <Badge tone="amber" dot>Chờ chuyển in</Badge>
    ) : (
      <Badge tone="gray" dot>Khách chưa gửi</Badge>
    );

  return (
    <Stack gap={16}>
      <Section
        icon={Printer}
        title={`Ảnh in tặng khách${p.quota > 0 ? ` · ${p.quota} ảnh` : ""}`}
        desc={
          p.quota === 0 && p.n === 0
            ? "Đặt số ảnh in tặng, album giao khách sẽ có thêm phần “Chọn ảnh in” cho khách."
            : p.n === 0
              ? "Ở album giao khách, khách bấm “Chọn ảnh in”, chọn rồi gửi. Bạn nhận thông báo khi khách gửi."
              : `Khách đã gửi ${p.n}${p.quota > 0 ? `/${p.quota}` : ""} ảnh${info.sentAt ? ` ngày ${fmtDate(info.sentAt)}` : ""}.` +
                (p.copiedAt ? " Đã chuyển đi in, khách không sửa được nữa." : "")
        }
        actions={status}
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          {info.contractId ? (
            <div>
              <p className="v2-label">Số ảnh in tặng</p>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)" }}>
                Theo hợp đồng: <b style={{ color: "var(--tx)" }}>{info.contractQuota > 0 ? `${info.contractQuota} ảnh` : "chưa đặt"}</b>
              </p>
            </div>
          ) : (
            <Field
              label={
                <span className="flex items-center gap-2">
                  Số ảnh in tặng cho album này
                  <span className="text-[12px] font-normal" style={{ color: p.quotaSaved === "saved" ? "var(--gn)" : "var(--tx3)" }}>
                    {p.quotaSaved === "saving" ? "Đang lưu…" : p.quotaSaved === "saved" ? "Đã lưu" : ""}
                  </span>
                </span>
              }
              hint="Để trống là không tặng in. Tự lưu khi bạn gõ."
            >
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  style={{ maxWidth: 120 }}
                  inputMode="numeric"
                  placeholder="0"
                  value={p.albumQuota}
                  onChange={(e) => p.changeQuota(e.target.value)}
                  aria-label="Số ảnh in tặng cho album này"
                />
                <span className="text-[13.5px]" style={{ color: "var(--tx2)" }}>ảnh</span>
              </div>
            </Field>
          )}
          {info.contractId ? (
            <Link href={`/dashboard/studio/contracts/${info.contractId}?tab=album`} className={btn("secondary", "sm", "self-start md:self-auto")}>
              <ExternalLink size={15} /> Sửa ở hợp đồng
            </Link>
          ) : null}
        </div>
      </Section>

      <Section
        title="Ảnh khách chọn để in"
        desc={p.n > 0 ? `${p.n} ảnh` : undefined}
        flush={p.n === 0}
        actions={
          p.n > 0 ? (
            <>
              <button
                type="button"
                onClick={() => p.call("copy")}
                disabled={p.busy || !hasDeliveryFolder}
                className={btn("soft", "sm")}
              >
                {p.busy ? <Loader2 size={15} className="animate-spin" /> : <FolderInput size={15} />}
                {p.busy ? "Đang chép…" : `Chép vào thư mục “${PRINT_FOLDER_NAME}”`}
              </button>
              <Menu
                label="Thao tác với ảnh in"
                width={240}
                items={[
                  {
                    label: `Chép ${names.length} mã ảnh`,
                    icon: Copy,
                    onClick: async () => {
                      if (await copyText(codesText(names))) onToast?.(`Đã chép ${names.length} mã ảnh in`);
                    },
                  },
                  { label: "Tải danh sách .txt", icon: FileText, onClick: () => downloadText(codesText(names), `${albumSlug}-anh-in`) },
                  ...(p.copiedAt
                    ? (["divider", { label: "Cho khách chọn lại", hint: "Mở khoá để khách sửa ảnh in", icon: RotateCcw, onClick: () => p.call("unlock"), disabled: p.busy }] as const)
                    : []),
                ]}
              />
            </>
          ) : null
        }
      >
        {p.n === 0 ? (
          <Empty compact icon={Printer} title="Khách chưa gửi ảnh in" hint="Ảnh khách chọn để in sẽ hiện ở đây, kèm nút chép thẳng vào Drive." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2.5 min-[520px]:grid-cols-4 min-[900px]:grid-cols-6">
              {info.picks.map((x) => (
                <figure key={x.photo_id} className="min-w-0">
                  <div className="aspect-square overflow-hidden rounded-[10px]" style={{ background: "var(--sf2)" }}>
                    <Thumb fileId={p.driveOf.get(x.photo_id)} alt={x.photo_name} w={240} />
                  </div>
                  <figcaption className="v2-num mt-1 truncate text-[12px]" style={{ color: "var(--tx2)" }} title={x.photo_name}>
                    {stripExtension(x.photo_name)}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {hasDeliveryFolder
                ? `Tạo thư mục “${PRINT_FOLDER_NAME}” ngay trong thư mục Drive giao file hoàn thiện rồi chép ảnh vào. Bấm lại nhiều lần không tạo ảnh trùng.`
                : "Chưa có link Drive giao file hoàn thiện. Lưu link ở tab Giao khách trước."}
            </p>
          </div>
        )}
      </Section>

      {p.needConnect && (
        <Callout
          tone="amber"
          icon={Unplug}
          title="Cần kết nối Google Drive một lần"
          action={
            <a href="/api/filter/drive/connect" className={btn("secondary", "sm")}>
              Kết nối Drive
            </a>
          }
        >
          Dùng chung với công cụ Lọc ảnh, để app tạo thư mục và chép ảnh. Đăng nhập đúng tài khoản Google sở hữu thư mục giao
          khách, xong quay lại đây bấm chép lần nữa.
        </Callout>
      )}
      {p.err && <Callout tone="red" title="Chưa làm được">{p.err}</Callout>}
      {p.result && (
        <Callout
          tone="green"
          icon={CheckCircle2}
          title={`Đã chép ${p.result.copied} ảnh vào thư mục “${PRINT_FOLDER_NAME}”`}
          action={
            <a href={p.result.folderUrl} target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>
              <ExternalLink size={15} /> Mở thư mục
            </a>
          }
        >
          {p.result.skipped ? `Bỏ qua ${p.result.skipped} ảnh đã có. ` : ""}
          {p.result.failed.length > 0 ? `${p.result.failed.length} ảnh lỗi, bấm chép lại để thử tiếp.` : ""}
        </Callout>
      )}
    </Stack>
  );
}
