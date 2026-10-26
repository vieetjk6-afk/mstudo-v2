import Link from "next/link";
import { Lock } from "lucide-react";
import { Empty, btn } from "@/components/v2/kit";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ "CẦN GÓI CAO HƠN" của ba tab Lịch làm việc — giao diện mới. Dựng ở
   server (ShootTab / StudioTab / TeamTab) khi gói hiện tại chưa có tính năng;
   cùng chữ, cùng đường nâng cấp như thẻ cũ, hình theo <Empty> của bộ khối.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PlanLockedV2({ title, hint, cta }: { title: string; hint: string; cta: string }) {
  return (
    <div className="v2-card mx-auto w-full max-w-[560px]">
      <Empty
        icon={Lock}
        title={title}
        hint={hint}
        action={
          <Link href="/dashboard/upgrade" className={btn("primary")}>
            {cta}
          </Link>
        }
      />
    </div>
  );
}
