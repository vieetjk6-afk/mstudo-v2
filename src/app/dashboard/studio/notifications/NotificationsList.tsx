"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PushToggle from "@/components/PushToggle";
import { Panel, EmptyState } from "@/components/studio/ui";
import { notificationHref, notificationMeta } from "@/lib/notifications";
import type { StudioNotification } from "@/lib/types";

export default function NotificationsList({ initial }: { initial: StudioNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState<StudioNotification[]>(initial);
  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((p) => p.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    const supabase = createClient();
    await supabase.from("studio_notifications").update({ read: true }).in("id", ids);
  }

  function openNotification(n: StudioNotification) {
    if (!n.read) markRead([n.id]); // fire-and-forget; UI updates optimistically
    const href = notificationHref(n);
    if (href) router.push(href);
  }

  return (
    <div className="page-in max-w-[860px]">
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Mọi hoạt động của studio theo thời gian.</p>
        {unreadCount > 0 && (
          <span className="flex-none rounded-[20px] px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
            {unreadCount} chưa đọc
          </span>
        )}
        {unreadCount > 0 && (
          <button
            onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
            className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
          >
            <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="mb-3.5">
        <PushToggle />
      </div>

      {items.length === 0 ? (
        <Panel>
          <EmptyState icon={Bell} title="Chưa có thông báo nào" hint="Khách ký hợp đồng, chuyển cọc hay thợ nhận job đều báo về đây." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => {
            const { Icon, fg } = notificationMeta(n.kind);
            const href = notificationHref(n);
            const clickable = !n.read || !!href;
            return (
              <div
                key={n.id}
                onClick={() => clickable && openNotification(n)}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openNotification(n); } }}
                className="flex items-start gap-3 rounded-[14px] px-4 py-3.5"
                style={{
                  cursor: clickable ? "pointer" : "default",
                  // Chưa đọc: nền pha màu nhấn + viền trái màu nhấn. Đã đọc: chìm hẳn.
                  background: n.read ? "var(--sf)" : "var(--acS)",
                  border: "1px solid var(--bd)",
                  borderLeft: n.read ? "3px solid var(--bd)" : "3px solid var(--ac)",
                  opacity: n.read ? 0.78 : 1,
                }}
              >
                <span className="mt-0.5 flex-none rounded-[9px] p-1.5" style={{ background: "var(--sf2)", lineHeight: 0 }}>
                  <Icon size={17} style={{ color: fg }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]" style={{ fontWeight: n.read ? 500 : 700, textWrap: "pretty" }}>{n.message}</p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {new Date(n.created_at).toLocaleString("vi-VN")}
                    {href && <span style={{ color: "var(--ac)", fontWeight: 600 }}> · Xem chi tiết →</span>}
                  </p>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: "var(--ac)" }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
