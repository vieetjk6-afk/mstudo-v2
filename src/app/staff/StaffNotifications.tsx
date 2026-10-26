"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import { notificationHref, notificationMeta, notificationText } from "@/lib/notifications";
import type { StudioNotification } from "@/lib/types";
import { shortWhen, useStaffNotifications } from "./useStaffPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "THÔNG BÁO" — cùng dòng thông báo với khu quản lý (studio_notifications),
   nhóm theo "Hôm nay" / "Trước đó", bấm vào hàng là đánh dấu đã đọc.

   Icon và màu lấy từ NOTIFICATION_KIND_META (@/lib/notifications) — dùng chung
   với màn Thông báo của khu quản lý, kể cả ba loại mới của cổng nhân viên:
   nhắc lịch, hợp đồng thay đổi, phân công.
   ═══════════════════════════════════════════════════════════════════════════ */

// shortWhen ("vừa xong" / "3 giờ" / "12/07"), nhóm Hôm nay/Trước đó và thao tác
// đánh dấu đã đọc nằm ở ./useStaffPortal — dùng chung với giao diện mới.

export default function StaffNotifications({
  initial, toast,
}: { initial: StudioNotification[]; toast: (m: string) => void }) {
  const { items, unread, groups, markRead, markAllRead, today } = useStaffNotifications(initial, toast);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
          {unread.length > 0 ? `${unread.length} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
        </p>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            className="ml-auto flex flex-none items-center gap-1.5 text-[12.5px] font-bold"
            style={{ color: "var(--ac)" }}
          >
            <CheckCheck size={16} /> Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Panel>
          <EmptyState icon={Bell} title="Chưa có thông báo nào" hint="Nhắc lịch, phân công và thay đổi hợp đồng đều báo về đây." />
        </Panel>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>
              {g.label}
            </p>
            <Panel className="overflow-hidden">
              {g.rows.map((n, i) => {
                const { Icon, fg, soft } = notificationMeta(n.kind);
                const href = notificationHref(n);
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-2.5 px-4 py-3"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--bd2)",
                      background: n.read ? "transparent" : "var(--sf2)",
                    }}
                  >
                    <span className="mt-0.5 flex-none rounded-[11px] p-[7px]" style={{ background: soft, lineHeight: 0 }}>
                      <Icon size={17} style={{ color: fg }} />
                    </span>
                    <button onClick={() => !n.read && markRead([n.id])} className="min-w-0 flex-1 text-left">
                      <span
                        className="block text-[13.5px]"
                        style={{ fontWeight: n.read ? 550 : 700, textWrap: "pretty" }}
                      >
                        {notificationText(n)}
                      </span>
                      {href && (
                        <Link href={href} className="mt-0.5 inline-block text-[12px] font-semibold" style={{ color: "var(--ac)" }}>
                          Xem chi tiết →
                        </Link>
                      )}
                    </button>
                    <div className="flex flex-none flex-col items-end gap-1.5 pt-0.5">
                      <span className="tnum text-[11px]" style={{ color: "var(--tx3)" }}>{shortWhen(n.created_at, today)}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} />}
                    </div>
                  </div>
                );
              })}
            </Panel>
          </div>
        ))
      )}
    </div>
  );
}
