import Link from "next/link";
import { Lock, Sparkles, type LucideIcon } from "lucide-react";
import { Badge, Empty, Stack, btn } from "@/components/v2/kit";
import { CreativeTabsV2, type CreativeTab } from "./CreativeV2Parts";

/* Thẻ chặn của nhóm sản phẩm sáng tạo ở giao diện mới — dùng ở page.tsx (server):
 *   kind "plan" · tài khoản chưa có gói Studio → nút xem gói;
 *   kind "soon" · tính năng đang "Sắp ra mắt" (khoá với studio, admin vẫn vào).
 * Chỉ đổi cách VẼ; điều kiện chặn vẫn nằm nguyên ở page.tsx. */
export default function CreativeGateV2({
  kind,
  feature,
  hint,
  icon = Sparkles,
  tab,
}: {
  kind: "plan" | "soon";
  /** Màn thuộc nhóm Thiệp · Story · Slide → giữ dải tab để đi sang màn kia. */
  tab?: CreativeTab;
  feature: string;
  hint: string;
  icon?: LucideIcon;
}) {
  const card = (
    <div className="mx-auto w-full max-w-xl">
      <div className="v2-card">
        <Empty
          icon={kind === "plan" ? Lock : icon}
          title={
            <span className="inline-flex flex-wrap items-center justify-center gap-2">
              {feature}
              {kind === "soon" ? <Badge tone="amber" dot>Sắp ra mắt</Badge> : null}
            </span>
          }
          hint={hint}
          action={
            kind === "plan" ? (
              <Link href="/dashboard/upgrade" className={btn("primary")}>
                Xem gói Studio
              </Link>
            ) : undefined
          }
        />
      </div>
    </div>
  );
  return tab ? (
    <Stack>
      <CreativeTabsV2 active={tab} />
      {card}
    </Stack>
  ) : (
    card
  );
}
