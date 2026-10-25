import Link from "next/link";
import { Lock, ShieldOff, Sparkles, type LucideIcon } from "lucide-react";
import { Badge, Empty, btn } from "@/components/v2/kit";

/* Thẻ chặn của nhóm Kết nối & tích hợp ở giao diện mới (Hộp thư, Nối kênh,
 * Đồng bộ Drive, MStudo Desktop) — dùng ở page.tsx (server):
 *   kind "plan" · gói chưa đủ → nút xem gói;
 *   kind "soon" · tính năng đang "Sắp ra mắt" (khoá với studio, admin vẫn vào);
 *   kind "role" · chỉ chủ studio / quản lý được vào.
 * Chỉ đổi cách VẼ; điều kiện chặn vẫn nằm nguyên ở page.tsx. */
export default function IntegrationGateV2({
  kind,
  title,
  hint,
  icon,
  action,
}: {
  kind: "plan" | "soon" | "role";
  title: string;
  hint: string;
  icon?: LucideIcon;
  /** Nút dẫn đi (mặc định: "plan" → Xem gói). */
  action?: { href: string; label: string };
}) {
  const act = action ?? (kind === "plan" ? { href: "/dashboard/upgrade", label: "Xem các gói" } : undefined);
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="v2-card">
        <Empty
          icon={icon ?? (kind === "plan" ? Lock : kind === "role" ? ShieldOff : Sparkles)}
          title={
            <span className="inline-flex flex-wrap items-center justify-center gap-2">
              {title}
              {kind === "soon" ? <Badge tone="amber" dot>Sắp ra mắt</Badge> : null}
            </span>
          }
          hint={hint}
          action={
            act ? (
              <Link href={act.href} className={btn(kind === "plan" ? "primary" : "secondary")}>
                {act.label}
              </Link>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
