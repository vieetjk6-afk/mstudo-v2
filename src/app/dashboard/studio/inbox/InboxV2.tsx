"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bot, Check, CircleAlert, Clock3, FilePlus2, Inbox, Mail, Paperclip, Plug, RotateCcw, Search, Send, User,
  UserCheck, Users,
} from "lucide-react";
import { Avatar, Badge, Empty, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { platformColor, platformLabel, type Platform } from "@/lib/inbox/platforms";
import type { ConversationView, MessageRow } from "@/lib/inbox/types";
import { fmtTime, senderLabel, useInbox, type InboxFilter, type InboxProps } from "./useInbox";

/* ═══════════════════════════════════════════════════════════════════════════
   HỘP THƯ — giao diện mới. Cùng dữ liệu, cùng thao tác với InboxView (bản cũ,
   logic chung ở ./useInbox); khác ở cách sắp xếp:
     • Máy tính rộng: ba cột trong một khung cao bằng màn hình — Hộp thư & kênh
       · danh sách hội thoại · khung chat. Máy tính hẹp: hai cột (bộ lọc gọn
       lên đầu danh sách).
     • Danh sách: avatar có chấm màu kênh, tên đậm khi chưa đọc, giờ, tin cuối,
       số tin chưa đọc, dấu "người đang trả lời".
     • Khung chat: đầu khung nói rõ ai đang trả lời (công tắc AI) + MỘT nút
       chữ theo việc tiếp theo (Tôi tiếp quản / Xong / Mở lại); Tạo hợp đồng
       trong ⋯. Bong bóng gọn, chia theo ngày; tin gửi hỏng viền đỏ kèm lý do.
       Ô soạn dính đáy; hết cửa sổ trả lời thì khoá kèm giải thích.
     • Điện thoại: một cột; mở hội thoại thì khung chat phủ kín màn, có nút
       quay lại danh sách.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Nhãn ngày cho dải phân cách trong khung chat. */
function dayLabel(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Hôm nay";
  if (d.toDateString() === y.toDateString()) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Avatar khách + chấm màu kênh ở góc. */
function ContactAvatar({ c, size = 40 }: { c: ConversationView; size?: number }) {
  return (
    <span className="relative inline-flex flex-none">
      <Avatar name={c.contactName} size={size} />
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full"
        style={{ width: size * 0.32, height: size * 0.32, background: platformColor(c.platform), boxShadow: "0 0 0 2px var(--sf)" }}
        title={platformLabel(c.platform)}
      />
    </span>
  );
}

export default function InboxV2(props: InboxProps) {
  const { staff, channels, meId, canManageChannels } = props;
  const x = useInbox(props);
  const { active } = x;

  if (x.rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="v2-card">
          <Empty
            icon={Inbox}
            title="Chưa có tin nhắn nào"
            hint="Nối Zalo, Facebook hoặc Instagram để tin nhắn của khách đổ về đây. Chatbox website thì tự chạy sẵn."
            action={
              canManageChannels ? (
                <Link href="/dashboard/studio/inbox/ket-noi" className={btn("primary")}>
                  <Plug size={16} /> Nối mạng xã hội
                </Link>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  // Kênh để lọc — gộp theo nền tảng (một nền tảng có thể có nhiều kênh).
  const platforms = channels.reduce<Platform[]>((acc, c) => (acc.includes(c.platform) ? acc : [...acc, c.platform]), []);
  const countBy = (p: Platform) => x.rows.filter((c) => c.platform === p).length;
  const mineCount = x.rows.filter((c) => c.assigneeId === meId).length;

  const folders: { value: InboxFilter; label: string; icon: typeof Inbox; count: number }[] = [
    { value: "all", label: "Tất cả", icon: Inbox, count: x.rows.length },
    { value: "unread", label: "Chưa đọc", icon: Mail, count: x.unreadTotal },
    { value: "mine", label: "Của tôi", icon: UserCheck, count: mineCount },
  ];

  const navItem = (on: boolean, onClick: () => void, children: React.ReactNode, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-[var(--sf2)]"
      style={on ? { background: "var(--acS)", color: "var(--ac)", fontWeight: 650 } : { color: "var(--tx2)", fontWeight: 500 }}
    >
      {children}
    </button>
  );

  /* ── Cột 1: hộp thư & kênh (chỉ máy tính rộng) ──────────────────────── */
  const sidePane = (
    <aside className="hidden min-h-0 flex-col xl:flex" style={{ borderRight: "1px solid var(--bd)", background: "var(--sf2)" }}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="px-2.5 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Hộp thư</p>
        {folders.map((f) =>
          navItem(
            x.filter === f.value,
            () => x.setFilter(f.value),
            <>
              <f.icon size={16} className="flex-none" />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              {f.count ? (
                <span className="v2-num text-[12px] font-semibold" style={{ color: f.value === "unread" ? "var(--rd)" : "var(--tx3)" }}>{f.count}</span>
              ) : null}
            </>,
            f.value,
          ),
        )}

        <p className="mt-4 px-2.5 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Kênh</p>
        {navItem(
          x.platformFilter === "all",
          () => x.setPlatformFilter("all"),
          <>
            <Users size={16} className="flex-none" />
            <span className="min-w-0 flex-1 truncate">Mọi kênh</span>
          </>,
          "all",
        )}
        {platforms.map((p) =>
          navItem(
            x.platformFilter === p,
            () => x.setPlatformFilter(p),
            <>
              <span className="mx-[3px] h-2.5 w-2.5 flex-none rounded-full" style={{ background: platformColor(p) }} />
              <span className="min-w-0 flex-1 truncate">{platformLabel(p)}</span>
              <span className="v2-num text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{countBy(p) || ""}</span>
            </>,
            p,
          ),
        )}
      </div>
      {canManageChannels && (
        <div className="flex-none p-3" style={{ borderTop: "1px solid var(--bd)" }}>
          <Link href="/dashboard/studio/inbox/ket-noi" className={btn("secondary", "sm", "w-full")}>
            <Plug size={14} /> Quản lý kênh
          </Link>
        </div>
      )}
    </aside>
  );

  /* ── Cột 2: danh sách hội thoại ─────────────────────────────────────── */
  const listPane = (
    <section className="flex min-h-0 min-w-0 flex-col lg:border-r" style={{ borderColor: "var(--bd)" }} aria-label="Danh sách hội thoại">
      <div className="flex flex-none flex-col gap-2.5 p-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <SearchInput value={x.query} onChange={x.setQuery} placeholder="Tìm tên khách, số điện thoại…" className="w-full" />
        <div className="flex items-center gap-2 xl:hidden">
          <div className="min-w-0 flex-1 [&_.v2-seg-btn]:flex-1 [&_.v2-seg-btn]:justify-center [&_.v2-seg]:flex [&_.v2-seg]:w-full">
            <Segmented<InboxFilter>
              size="sm"
              label="Lọc hội thoại"
              value={x.filter}
              onChange={x.setFilter}
              options={[
                { value: "all", label: "Tất cả", count: x.rows.length },
                { value: "unread", label: "Chưa đọc", count: x.unreadTotal || undefined },
                { value: "mine", label: "Của tôi" },
              ]}
            />
          </div>
          {canManageChannels && (
            <Link href="/dashboard/studio/inbox/ket-noi" className={iconBtn()} aria-label="Quản lý kênh" title="Quản lý kênh">
              <Plug size={17} />
            </Link>
          )}
        </div>
        <select
          className={`${inputCls} xl:hidden`}
          value={x.platformFilter}
          onChange={(e) => x.setPlatformFilter(e.target.value as Platform | "all")}
          aria-label="Lọc theo kênh"
        >
          <option value="all">Mọi kênh</option>
          {channels.map((c) => (
            <option key={c.id} value={c.platform}>
              {platformLabel(c.platform)}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {x.filtered.length === 0 ? (
          <Empty compact icon={Search} title="Không có hội thoại nào khớp bộ lọc" hint="Chọn “Tất cả”, “Mọi kênh” hoặc gõ ít chữ hơn." />
        ) : (
          x.filtered.map((c) => {
            const on = c.id === x.activeId;
            const unread = c.unread > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => x.openConversation(c.id)}
                aria-current={on ? "true" : undefined}
                className="relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--sf2)]"
                style={{ background: on ? "var(--acS)" : undefined, borderBottom: "1px solid var(--bd2)" }}
              >
                {on ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: "var(--ac)" }} /> : null}
                <ContactAvatar c={c} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[14px] ${unread ? "font-bold" : "font-semibold"}`}>{c.contactName}</span>
                    <span className="v2-num flex-none text-[11.5px]" style={{ color: unread ? "var(--ac)" : "var(--tx3)", fontWeight: unread ? 650 : 500 }}>
                      {fmtTime(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: unread ? "var(--tx2)" : "var(--tx3)", fontWeight: unread ? 550 : 400 }}>
                      {c.lastDirection === "out" ? "Bạn: " : ""}
                      {c.lastMessage || "(chưa có tin)"}
                    </span>
                    {!c.aiEnabled && (
                      <span className="flex-none" title="Nhân viên đang tiếp quản">
                        <UserCheck size={13} style={{ color: "var(--gn)" }} />
                      </span>
                    )}
                    {c.status === "closed" && (
                      <span className="flex-none" title="Đã xong">
                        <Check size={13} style={{ color: "var(--tx3)" }} />
                      </span>
                    )}
                    {unread ? (
                      <span
                        className="v2-num flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold"
                        style={{ background: "var(--rd)", color: "#fff" }}
                      >
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );

  /* ── Cột 3: khung chat ──────────────────────────────────────────────── */
  const threadMenu: MenuItem[] = active
    ? [
        { label: "Tạo hợp đồng", hint: "Dán sẵn đoạn chat vào ô Tạo nhanh", icon: FilePlus2, href: `/dashboard/studio/contracts/new?inbox=${active.id}` },
        ...(active.assigneeId !== meId
          ? ([
              "divider",
              active.status === "open"
                ? { label: "Đánh dấu xong", icon: Check, onClick: () => void x.patchActive({ status: "closed" }) }
                : { label: "Mở lại hội thoại", icon: RotateCcw, onClick: () => void x.patchActive({ status: "open" }) },
            ] as MenuItem[])
          : []),
      ]
    : [];

  const mainAction = !active ? null : active.assigneeId !== meId ? (
    <button type="button" onClick={() => void x.patchActive({ assignee: "me", aiEnabled: false })} className={btn("soft", "sm")}>
      <UserCheck size={15} /> Tôi tiếp quản
    </button>
  ) : active.status === "open" ? (
    <button type="button" onClick={() => void x.patchActive({ status: "closed" })} className={btn("secondary", "sm")}>
      <Check size={15} /> Xong
    </button>
  ) : (
    <button type="button" onClick={() => void x.patchActive({ status: "open" })} className={btn("secondary", "sm")}>
      <RotateCcw size={15} /> Mở lại
    </button>
  );

  // Công tắc AI — chữ nói rõ trạng thái HIỆN TẠI (ai đang trả lời), không phải hành động.
  const aiToggle = active ? (
    <button
      type="button"
      onClick={() => void x.patchActive({ aiEnabled: !active.aiEnabled })}
      title={active.aiEnabled ? "Tắt để tự trả lời" : "Bật lại cho trợ lý AI trả lời"}
      aria-pressed={active.aiEnabled}
      className="inline-flex h-8 flex-none items-center gap-2 rounded-full py-0 pl-2.5 pr-1.5 text-[12.5px] font-semibold transition-colors"
      style={
        active.aiEnabled
          ? { background: "var(--acS)", color: "var(--ac)" }
          : { background: "var(--gnS)", color: "var(--gn)" }
      }
    >
      {active.aiEnabled ? <Bot size={15} /> : <User size={15} />}
      {active.aiEnabled ? "AI đang trả lời" : "Bạn đang trả lời"}
      <span
        className="relative h-[18px] w-[30px] flex-none rounded-full"
        style={{ background: active.aiEnabled ? "var(--ac)" : "var(--bdS, var(--bd))" }}
        aria-hidden
      >
        <span
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform"
          style={{ left: 2, transform: active.aiEnabled ? "translateX(12px)" : "none", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}
        />
      </span>
    </button>
  ) : null;

  let lastDay = "";
  const bubbles = x.messages.map((m: MessageRow) => {
    const mine = m.direction === "out";
    const failed = m.status === "failed";
    const ai = m.sender === "ai";
    const day = dayLabel(m.created_at);
    const sep = day !== lastDay;
    lastDay = day;
    const bubbleStyle: React.CSSProperties = failed
      ? { background: "var(--rdS)", color: "var(--tx)", border: "1px solid var(--rd)", borderBottomRightRadius: 6 }
      : !mine
        ? { background: "var(--sf)", color: "var(--tx)", border: "1px solid var(--bd)", borderBottomLeftRadius: 6 }
        : ai
          ? { background: "var(--acS)", color: "var(--tx)", border: "1px solid transparent", borderBottomRightRadius: 6 }
          : { background: "var(--ac)", color: "#fff", border: "1px solid transparent", borderBottomRightRadius: 6 };
    return (
      <Fragment key={m.id}>
        {sep && (
          <div className="my-3 flex justify-center first:mt-0">
            <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
              {day}
            </span>
          </div>
        )}
        <div className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
          <div className={`flex max-w-[82%] flex-col sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
            <div className="rounded-[16px] px-3.5 py-2 text-[13.5px] leading-relaxed" style={{ ...bubbleStyle, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {m.body || <em style={{ opacity: 0.7 }}>(chỉ có tệp đính kèm)</em>}
              {m.attachments?.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium underline underline-offset-2"
                >
                  <Paperclip size={13} className="flex-none" /> {a.name || a.type}
                </a>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 px-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {ai ? <Bot size={12} /> : null}
              {senderLabel(m, staff)} · {fmtTime(m.created_at)}
              {failed && (
                <span className="flex items-center gap-1 font-medium" style={{ color: "var(--rd)" }}>
                  <CircleAlert size={12} /> chưa gửi được{m.error ? `: ${m.error}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </Fragment>
    );
  });

  const threadPane = (
    <section
      aria-label="Khung chat"
      className={`${x.mobileThread ? "fixed inset-0 z-[70] flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col lg:static lg:z-auto`}
      style={{ background: "var(--sf)" }}
    >
      {!active ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty icon={Inbox} title="Chọn một hội thoại" hint="Bấm vào khách ở danh sách để xem và trả lời." />
        </div>
      ) : (
        <>
          <header className="flex flex-none items-center gap-3 px-3 py-2.5 sm:px-4" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <button type="button" onClick={() => x.setMobileThread(false)} className={iconBtn("-ml-1 lg:hidden")} aria-label="Quay lại danh sách">
              <ArrowLeft size={19} />
            </button>
            <ContactAvatar c={active} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[15px] font-semibold">{active.contactName}</p>
                {active.status === "closed" ? <Badge tone="gray" icon={Check}>Đã xong</Badge> : null}
              </div>
              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                <span style={{ color: platformColor(active.platform), fontWeight: 600 }}>{platformLabel(active.platform)}</span>
                {" · "}
                {active.contactPhone || "chưa có số điện thoại"}
                {active.assigneeId && <> · phụ trách: {staff[active.assigneeId] || "nhân viên"}</>}
              </p>
            </div>
            <Menu label="Thêm thao tác với hội thoại" width={250} items={threadMenu} />
          </header>
          {/* Dải trạng thái: ai đang trả lời + việc tiếp theo. */}
          <div className="flex flex-none items-center gap-2 px-3 py-2 sm:px-4" style={{ borderBottom: "1px solid var(--bd)", background: "var(--sf2)" }}>
            {aiToggle}
            <span className="flex-1" />
            {mainAction}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" style={{ background: "var(--bg)" }}>
            {bubbles}
            <div ref={x.bottomRef} />
          </div>

          {/* ── Ô soạn tin (dính đáy khung) ─────────────────────────────── */}
          <div className="flex-none px-3 pb-3 pt-2.5 sm:px-4" style={{ borderTop: "1px solid var(--bd)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            {!x.replyOpen ? (
              <div className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px]" style={{ background: "var(--amS)", color: "var(--am)" }}>
                <Clock3 size={16} className="mt-px flex-none" />
                <span>{x.blockedReason}</span>
              </div>
            ) : (
              <>
                {active.aiEnabled && (
                  <p className="mb-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                    <Bot size={13} className="flex-none" style={{ color: "var(--ac)" }} />
                    Trợ lý AI đang trả lời hội thoại này — bạn gửi tin là AI tự ngừng.
                  </p>
                )}
                <div
                  className="flex items-end gap-2 rounded-[14px] p-1.5 pl-3 transition-shadow focus-within:shadow-[0_0_0_3px_var(--acM)]"
                  style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                >
                  <textarea
                    className="max-h-[160px] min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-snug outline-none"
                    rows={Math.min(5, Math.max(1, x.draft.split("\n").length))}
                    placeholder="Nhập câu trả lời cho khách…"
                    aria-label="Nội dung tin nhắn"
                    value={x.draft}
                    onChange={(e) => x.setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        x.send();
                      }
                    }}
                    style={{ color: "var(--tx)" }}
                  />
                  <button
                    type="button"
                    onClick={x.send}
                    disabled={x.sending || !x.draft.trim()}
                    className={btn("primary", "md", "!px-3.5")}
                    aria-label="Gửi tin"
                  >
                    <Send size={16} /> <span className="hidden sm:inline">{x.sending ? "Đang gửi…" : "Gửi"}</span>
                  </button>
                </div>
                {x.sendError ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--rd)" }}>
                    <CircleAlert size={13} className="flex-none" /> {x.sendError}
                  </p>
                ) : (
                  <p className="mt-1.5 hidden text-[11.5px] sm:block" style={{ color: "var(--tx3)" }}>
                    Enter để gửi · Shift + Enter để xuống dòng
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );

  return (
    <div className="v2-card overflow-hidden lg:-mb-8 lg:h-[calc(100dvh-112px)] lg:min-h-[560px]">
      <div className="grid h-full lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[228px_340px_minmax(0,1fr)]">
        {sidePane}
        {listPane}
        {threadPane}
      </div>
    </div>
  );
}
