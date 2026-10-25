"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notificationHref } from "@/lib/notifications";
import type { StudioNotification } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Thông báo (bản cũ NotificationsList và bản mới
   NotificationsV2): đếm chưa đọc, đánh dấu đã đọc, mở thông báo.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useNotifications(initial: StudioNotification[]) {
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

  return { items, unreadCount, markRead, openNotification };
}
