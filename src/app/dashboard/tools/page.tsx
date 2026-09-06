import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { CopyCheck, Minimize2, HardDrive, ArrowRight } from "lucide-react";
import StudioDenied from "@/components/StudioDenied";

export const dynamic = "force-dynamic";

/**
 * Màn "Công cụ ảnh" của bản thiết kế (mục 45): ba thẻ công cụ, mỗi thẻ có icon
 * nền nhạt màu nhấn, tên, mô tả một câu, một dòng số liệu thật và nút mở.
 *
 * Trước đây mục nav "Công cụ ảnh" trỏ THẲNG vào công cụ lọc ảnh, nên nén ảnh và
 * gắn watermark (đã có ở /dashboard/compress) không có đường nào tới.
 */
export default async function PhotoToolsPage() {
  const profile = await requireStudio("booking");
  if (!profile) return <StudioDenied message="Công cụ ảnh dành cho tài khoản gói Photographer trở lên." />;

  const supabase = await createClient();
  const since = new Date(Date.now() - 29 * 86400_000).toISOString();

  // Số liệu thật cho từng thẻ — không bịa con số minh hoạ như bản HTML thiết kế.
  // (studio_drive bị revoke với vai trò `authenticated` nên không đọc ở đây;
  // thẻ Drive nói theo quyền của gói thay vì con số.)
  const [{ count: albumCount }, { count: compressRuns }] = await Promise.all([
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    supabase
      .from("compress_usages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.actingUserId)
      .gte("created_at", since),
  ]);

  const driveReady = profile.studioTier === "full";

  const TOOLS: { icon: typeof CopyCheck; title: string; desc: string; stat: string; cta: string; href: string }[] = [
    {
      icon: CopyCheck,
      title: "Lọc ảnh khách chọn",
      desc: "Khách gửi danh sách tên file — công cụ tự tách đúng những ảnh đó ra một thư mục riêng để bạn mang đi chỉnh.",
      stat: albumCount ? `${albumCount} album đang có để đối chiếu` : "Chưa có album nào để đối chiếu",
      cta: "Mở công cụ lọc",
      href: "/dashboard/filter",
    },
    {
      icon: Minimize2,
      title: "Nén ảnh & watermark",
      desc: "Xuất ảnh đúng khổ chuẩn Facebook / Instagram / TikTok / Zalo cho khỏi vỡ ảnh, nén nhẹ, đóng watermark tên studio và đổi định dạng — chạy ngay trong trình duyệt, ảnh không tải lên máy chủ.",
      stat: (compressRuns ?? 0) > 0 ? `${compressRuns} lượt xử lý trong 30 ngày qua` : "Chưa dùng trong 30 ngày qua",
      cta: "Mở nén ảnh & chuẩn MXH",
      href: "/dashboard/compress",
    },
    {
      icon: HardDrive,
      title: "Đồng bộ Google Drive",
      desc: "Nối thư mục Drive của studio vào mstudo: ảnh mới trong thư mục tự lên album, không phải tải lại từng lần.",
      stat: driveReady ? "Đang bật cho studio của bạn" : "Chỉ có ở gói Studio",
      cta: driveReady ? "Mở cấu hình đồng bộ" : "Xem gói Studio",
      href: driveReady ? "/dashboard/studio/drive-sync" : "/dashboard/upgrade",
    },
  ];

  return (
    <div className="page-in max-w-[1000px]">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Ba việc lặp đi lặp lại sau mỗi buổi chụp — tách ảnh khách chọn, nén &amp; đóng dấu, và nối thư mục Drive.
      </p>

      <div className="grid gap-3 min-[720px]:grid-cols-2 min-[1080px]:grid-cols-3">
        {TOOLS.map(({ icon: Icon, title, desc, stat, cta, href }) => (
          <div
            key={href}
            className="flex flex-col rounded-[14px] p-[18px]"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
          >
            <span
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--acS)", color: "var(--ac)" }}
            >
              <Icon size={22} />
            </span>
            <p className="mt-3.5 text-[15px] font-bold">{title}</p>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {desc}
            </p>
            <p className="mt-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>{stat}</p>
            <Link
              href={href}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold"
              style={{ background: "var(--acS)", color: "var(--ac)" }}
            >
              {cta} <ArrowRight size={15} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
