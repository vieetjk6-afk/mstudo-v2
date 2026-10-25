import Link from "next/link";
import {
  ArrowRight, ChevronRight, CopyCheck, FileImage, FolderInput, HardDrive, ListChecks, Minimize2, Share2, Stamp, Lock,
} from "lucide-react";
import { Badge, Card, PageHead, Stack, btn } from "@/components/v2/kit";

/* ═══════════════════════════════════════════════════════════════════════════
   CÔNG CỤ ẢNH — giao diện mới. Cùng số liệu với bản cũ (page.tsx tải sẵn);
   khác ở cách sắp xếp:
     • Công cụ dùng nhiều nhất (Lọc ảnh khách chọn) là thẻ lớn đầu trang, có
       sẵn 3 bước làm và MỘT nút chính.
     • Nén ảnh & watermark: bốn lối vào thẳng từng công cụ con.
     • Đồng bộ Drive: thẻ gọn bên cạnh, nói rõ trạng thái theo gói.
   ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { icon: ListChecks, title: "Mã ảnh khách chọn", desc: "Lấy từ album hoặc dán danh sách khách gửi" },
  { icon: FolderInput, title: "Thư mục ảnh gốc", desc: "Trên máy tính hoặc Google Drive, kể cả RAW" },
  { icon: CopyCheck, title: "Bắt đầu lọc", desc: "Ảnh khớp được chép sang thư mục riêng" },
];

const COMPRESS_TOOLS = [
  { tool: "social", icon: Share2, title: "Chuẩn mạng xã hội", desc: "Đúng khổ Facebook, Instagram, TikTok, Zalo" },
  { tool: "compress", icon: Minimize2, title: "Nén ảnh", desc: "Nhẹ file, giữ nét" },
  { tool: "watermark", icon: Stamp, title: "Gắn watermark", desc: "Chữ hoặc logo studio" },
  { tool: "convert", icon: FileImage, title: "Đổi định dạng", desc: "JPEG · PNG · WebP" },
];

export default function ToolsV2({
  albumCount,
  compressRuns,
  driveReady,
}: {
  albumCount: number;
  compressRuns: number;
  driveReady: boolean;
}) {
  return (
    <Stack>
      <PageHead desc="Ba việc lặp đi lặp lại sau mỗi buổi chụp — tách ảnh khách chọn, nén & đóng dấu, và nối thư mục Drive." />

      {/* ── Thẻ lớn: Lọc ảnh khách chọn ─────────────────────────── */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex flex-col p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--ac)", color: "#fff" }}>
                <CopyCheck size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold">Lọc ảnh khách chọn</h3>
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {albumCount ? `${albumCount} album đang có để đối chiếu` : "Chưa có album nào để đối chiếu"}
                </p>
              </div>
            </div>
            <p className="mt-3.5 text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              Khách gửi danh sách tên file — công cụ tự tách đúng những ảnh đó (cả JPG lẫn RAW) ra một thư mục riêng để bạn mang đi chỉnh.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-5">
              <Link href="/dashboard/filter" className={btn("primary", "lg")}>
                Mở công cụ lọc <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <ol className="grid gap-px border-t lg:border-l lg:border-t-0" style={{ background: "var(--bd)", borderColor: "var(--bd)" }}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-center gap-3.5 px-5 py-4 sm:px-6" style={{ background: "var(--sf2)" }}>
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: "var(--acS)", color: "var(--ac)" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{s.title}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{s.desc}</p>
                </div>
                <s.icon size={18} style={{ color: "var(--tx3)", flex: "none" }} />
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── Nén ảnh & watermark ───────────────────────────────── */}
        <section className="v2-card overflow-hidden">
          <header className="v2-section-head">
            <span className="v2-section-icon"><Minimize2 size={17} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="v2-section-title">Nén ảnh & watermark</h3>
              <p className="v2-section-desc">Chạy ngay trong trình duyệt — ảnh không tải lên máy chủ.</p>
              <div className="mt-2">
                <Badge tone={compressRuns > 0 ? "blue" : "gray"}>
                  {compressRuns > 0 ? `${compressRuns} lượt xử lý trong 30 ngày qua` : "Chưa dùng trong 30 ngày qua"}
                </Badge>
              </div>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ background: "var(--bd)" }}>
            {COMPRESS_TOOLS.map((t) => (
              <Link
                key={t.tool}
                href={`/dashboard/compress?tool=${t.tool}`}
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--sf2)]"
                style={{ background: "var(--sf)" }}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--sf2)", color: "var(--ac)" }}>
                  <t.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{t.title}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{t.desc}</span>
                </span>
                <ChevronRight size={17} style={{ color: "var(--tx3)", flex: "none" }} />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Đồng bộ Google Drive ──────────────────────────────── */}
        <section className="v2-card flex h-full flex-col">
          <header className="v2-section-head">
            <span className="v2-section-icon"><HardDrive size={17} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="v2-section-title">Đồng bộ Google Drive</h3>
            </div>
            {driveReady ? (
              <Badge tone="green" dot>Đang bật</Badge>
            ) : (
              <Badge tone="gray" icon={Lock}>Gói Studio</Badge>
            )}
          </header>
          <div className="v2-card-pad flex flex-1 flex-col gap-4">
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              Nối thư mục Drive của studio vào mstudo: ảnh mới trong thư mục tự lên album, không phải tải lại từng lần.
            </p>
            <Link
              href={driveReady ? "/dashboard/studio/drive-sync" : "/dashboard/upgrade"}
              className={btn("secondary", "md", "mt-auto w-full")}
            >
              {driveReady ? "Mở cấu hình đồng bộ" : "Xem gói Studio"} <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
    </Stack>
  );
}
