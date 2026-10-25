"use client";

import { Fragment, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Search } from "lucide-react";
import PushToggle from "@/components/PushToggle";
import { Empty, GroupLabel, PageHead, Stack, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/date";
import { notificationHref, notificationMeta, notificationText } from "@/lib/notifications";
import type { StudioNotification } from "@/lib/types";
import { useNotifications } from "./useNotifications";

/* ═══════════════════════════════════════════════════════════════════════════
   THÔNG BÁO — giao diện mới. Cùng logic với NotificationsList
   (./useNotifications); khác ở cách sắp xếp:
     • Lọc nhanh Tất cả / Chưa đọc + lọc theo loại (khách ký, thanh toán…).
     • Một danh sách gọn, nhóm theo NGÀY. Chưa đọc: chữ đậm + chấm màu chủ đạo;
       đã đọc: chữ thường. Bấm là đánh dấu đã đọc và mở đúng chỗ (như bản cũ).
     • "Đánh dấu tất cả đã đọc" ở đầu trang; bật thông báo đẩy xuống cuối — đó
       là việc cài một lần.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filter = "all" | "unread";

export default function NotificationsV2({ initial }: { initial: StudioNotification[] }) {
  const n = useNotifications(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState("all");

  const today = fmtDate(todayVN());
  const yesterday = fmtDate(new Date(Date.now() - 86_400_000));
  const dayLabel = (d: string) => (d === today ? "Hôm nay" : d === yesterday ? "Hôm qua" : d);

  const kinds = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of n.items) m.set(x.kind, notificationMeta(x.kind).label);
    return [...m.entries()];
  }, [n.items]);

  const groups = useMemo(() => {
    const out: { day: string; rows: StudioNotification[] }[] = [];
    for (const x of n.items) {
      if (filter === "unread" && x.read) continue;
      if (kind !== "all" && x.kind !== kind) continue;
      const d = fmtDate(x.created_at);
      const last = out[out.length - 1];
      if (last && last.day === d) last.rows.push(x);
      else out.push({ day: d, rows: [x] });
    }
    return out;
  }, [n.items, filter, kind]);

  return (
    <Stack className="max-w-[900px]">
      <PageHead
        desc="Khách ký hợp đồng, chuyển cọc, thợ nhận hay từ chối việc… Bấm một dòng để mở đúng chỗ."
        actions={
          n.unreadCount > 0 ? (
            <button type="button" onClick={() => void n.markRead(n.items.filter((x) => !x.read).map((x) => x.id))} className={btn("secondary")}>
              <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
            </button>
          ) : null
        }
      />

      {n.items.length === 0 ? (
        <div className="v2-card">
          <Empty icon={Bell} title="Chưa có thông báo nào" hint="Khách ký hợp đồng, chuyển cọc hay thợ nhận job đều báo về đây." />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <Segmented<Filter>
                label="Lọc thông báo"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Tất cả", count: n.items.length },
                  { value: "unread", label: "Chưa đọc", count: n.unreadCount },
                ]}
              />
              {kinds.length > 1 ? (
                <select aria-label="Loại thông báo" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">Mọi loại</option>
                  {kinds.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              ) : null}
            </Toolbar>
          </div>

          {groups.length === 0 ? (
            <Empty compact icon={filter === "unread" ? CheckCheck : Search} title={filter === "unread" ? "Đã đọc hết" : "Không có thông báo nào khớp"} hint={filter === "unread" ? "Không còn thông báo nào chưa đọc." : undefined} />
          ) : (
            groups.map((g) => (
              <Fragment key={g.day}>
                <div className="px-4 pb-2 pt-4 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <GroupLabel count={g.rows.length}>{dayLabel(g.day)}</GroupLabel>
                </div>
                {g.rows.map((x) => {
                  const { Icon, fg, soft } = notificationMeta(x.kind);
                  const href = notificationHref(x);
                  const clickable = !x.read || !!href;
                  const body = (
                    <>
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: soft, color: fg }}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px]" style={{ fontWeight: x.read ? 450 : 650, color: x.read ? "var(--tx2)" : "var(--tx)", textWrap: "pretty" }}>
                          {notificationText(x)}
                        </p>
                        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {fmtDateTime(x.created_at).slice(0, 5)} · {notificationMeta(x.kind).label}
                        </p>
                      </div>
                      {!x.read ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--ac)" }} aria-label="Chưa đọc" /> : null}
                      {href ? <ChevronRight size={16} className="flex-none" style={{ color: "var(--tx3)" }} /> : null}
                    </>
                  );
                  return clickable ? (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => n.openNotification(x)}
                      className="v2-row v2-row-link w-full !items-start text-left"
                      style={x.read ? undefined : { background: "color-mix(in srgb, var(--acS) 55%, transparent)" }}
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={x.id} className="v2-row !items-start">{body}</div>
                  );
                })}
              </Fragment>
            ))
          )}
        </div>
      )}

      <PushToggle />
    </Stack>
  );
}
