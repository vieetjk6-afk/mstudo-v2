"use client";

import Link from "next/link";
import {
  Bot, Check, CircleAlert, FilePlus2, Inbox, Plug, Search, Send, User, UserCheck, X,
} from "lucide-react";
import { platformColor, platformLabel, type Platform } from "@/lib/inbox/platforms";
import { EmptyState } from "@/components/studio/ui";
import { useUiV2 } from "@/components/v2/UiV2Context";
import InboxV2 from "./InboxV2";
import { fmtTime, senderLabel, useInbox, type InboxFilter, type InboxProps } from "./useInbox";

/* ═══════════════════════════════════════════════════════════════════════════
   MÀN HỘP THƯ — hai cột trên máy tính, một cột có nút quay lại trên điện thoại.
   Logic chung ở ./useInbox; giao diện mới (ba cột) ở ./InboxV2.

   Ba điều màn này phải luôn nói thật, vì sai thì mất khách chứ không chỉ xấu:
     • Ai đang trả lời — bot hay người. Mỗi bong bóng ghi rõ nguồn.
     • Tin đã tới khách chưa. Gửi hỏng hiện viền đỏ + lý do, không im lặng.
     • Còn được nhắn lại không. Hết cửa sổ 24h/48h thì KHOÁ ô soạn kèm giải
       thích, thay vì để nhân viên gõ xong mới nhận lỗi từ nền tảng.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filter = InboxFilter;
type Props = InboxProps;

export default function InboxView(props: Props) {
  return useUiV2() ? <InboxV2 {...props} /> : <InboxViewV1 {...props} />;
}

function InboxViewV1(props: Props) {
  const { staff, channels, meId, canManageChannels } = props;
  const {
    rows, activeId, active, messages, filter, setFilter, platformFilter, setPlatformFilter, query, setQuery,
    draft, setDraft, sending, sendError, mobileThread, setMobileThread, bottomRef,
    openConversation, filtered, unreadTotal, patchActive, send, replyOpen, blockedReason,
  } = useInbox(props);

  if (rows.length === 0) {
    return (
      <div className="page-in max-w-[760px]">
        <div className="card p-2">
          <EmptyState
            icon={Inbox}
            title="Chưa có tin nhắn nào"
            hint="Nối Zalo, Facebook hoặc Instagram để tin nhắn của khách đổ về đây. Chatbox website thì tự chạy sẵn."
          />
        </div>
        {canManageChannels && (
          <div className="mt-3 text-center">
            <Link href="/dashboard/studio/inbox/ket-noi" className="btn-primary">
              <Plug size={15} /> Nối mạng xã hội
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-in">
      {/* ── Thanh lọc ─────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `Tất cả (${rows.length})`],
            ["unread", `Chưa đọc${unreadTotal ? ` (${unreadTotal})` : ""}`],
            ["mine", "Của tôi"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="rounded-[20px] px-3 py-1.5 text-[13px] font-medium"
            style={
              filter === key
                ? { background: "var(--ac)", color: "#fff" }
                : { background: "var(--sf2)", color: "var(--tx2)" }
            }
          >
            {label}
          </button>
        ))}

        <select
          className="input h-[34px] w-auto py-0 text-[13px]"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as Platform | "all")}
          aria-label="Lọc theo kênh"
        >
          <option value="all">Mọi kênh</option>
          {channels.map((c) => (
            <option key={c.id} value={c.platform}>
              {platformLabel(c.platform)}
            </option>
          ))}
        </select>

        <div className="relative min-w-[160px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
          <input
            className="input h-[34px] w-full pl-8 text-[13px]"
            placeholder="Tìm tên khách, số điện thoại…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {canManageChannels && (
          <Link href="/dashboard/studio/inbox/ket-noi" className="btn-ghost px-2.5 py-1.5 text-xs">
            <Plug size={14} /> Kênh
          </Link>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        {/* ── Danh sách hội thoại ─────────────────────────────────────────── */}
        <div className={`card overflow-hidden ${mobileThread ? "hidden lg:block" : ""}`}>
          <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-6 text-center text-[13px]" style={{ color: "var(--tx3)" }}>
                Không có hội thoại nào khớp bộ lọc.
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className="flex w-full items-start gap-2.5 border-b p-3 text-left"
                style={{
                  borderColor: "var(--bd2)",
                  background: c.id === activeId ? "var(--acS)" : "transparent",
                }}
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: platformColor(c.platform) }}
                  title={platformLabel(c.platform)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{c.contactName}</span>
                    {c.unread > 0 && (
                      <span
                        className="flex-none rounded-full px-1.5 text-[10px] font-bold"
                        style={{ background: "var(--rd)", color: "#fff" }}
                      >
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    )}
                    {!c.aiEnabled && (
                      <span className="flex-none" title="Nhân viên đang tiếp quản">
                        <UserCheck size={12} style={{ color: "var(--gn)" }} />
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                    {c.lastDirection === "out" ? "Bạn: " : ""}
                    {c.lastMessage || "(chưa có tin)"}
                  </span>
                </span>
                <span className="flex-none text-[11px]" style={{ color: "var(--tx3)" }}>
                  {fmtTime(c.lastMessageAt)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Khung chat ──────────────────────────────────────────────────── */}
        <div className={`card flex flex-col overflow-hidden ${mobileThread ? "" : "hidden lg:flex"}`}>
          {!active ? (
            <div className="p-2">
              <EmptyState icon={Inbox} title="Chọn một hội thoại" hint="Bấm vào khách ở danh sách bên trái để xem và trả lời." />
            </div>
          ) : (
            <>
              <div
                className="flex flex-wrap items-center gap-2 border-b p-3"
                style={{ borderColor: "var(--bd2)" }}
              >
                <button
                  onClick={() => setMobileThread(false)}
                  className="btn-ghost px-2 py-1.5 text-xs lg:hidden"
                  aria-label="Quay lại danh sách"
                >
                  ←
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{active.contactName}</span>
                    <span
                      className="flex-none rounded-[20px] px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "var(--sf2)", color: platformColor(active.platform) }}
                    >
                      {platformLabel(active.platform)}
                    </span>
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--tx3)" }}>
                    {active.contactPhone || "chưa có số điện thoại"}
                    {active.assigneeId && <> · phụ trách: {staff[active.assigneeId] || "nhân viên"}</>}
                  </div>
                </div>

                {/* Công tắc AI — chữ nói rõ trạng thái HIỆN TẠI, không phải hành
                    động, để nhìn lướt là biết bot đang nói hay người đang nói. */}
                <button
                  onClick={() => patchActive({ aiEnabled: !active.aiEnabled })}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                  title={active.aiEnabled ? "Tắt để tự trả lời" : "Bật lại cho trợ lý AI trả lời"}
                >
                  {active.aiEnabled ? (
                    <>
                      <Bot size={14} style={{ color: "var(--ac)" }} /> AI đang trả lời
                    </>
                  ) : (
                    <>
                      <User size={14} /> Bạn đang trả lời
                    </>
                  )}
                </button>

                {active.assigneeId !== meId && (
                  <button onClick={() => patchActive({ assignee: "me", aiEnabled: false })} className="btn-primary px-2.5 py-1.5 text-xs">
                    <UserCheck size={14} /> Tôi tiếp quản
                  </button>
                )}

                {/* Chốt được khách trong chat → mở màn tạo hợp đồng với nguyên đoạn
                    chat dán sẵn vào ô Tạo nhanh, khỏi chép tay tên/SĐT/giá. */}
                <Link
                  href={`/dashboard/studio/contracts/new?inbox=${active.id}`}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                  title="Tạo hợp đồng từ cuộc trò chuyện này"
                >
                  <FilePlus2 size={14} /> Tạo hợp đồng
                </Link>

                <button
                  onClick={() => patchActive({ status: active.status === "open" ? "closed" : "open" })}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                >
                  {active.status === "open" ? <><Check size={14} /> Xong</> : <><X size={14} /> Mở lại</>}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 360px)", minHeight: "260px" }}>
                {messages.map((m) => {
                  const mine = m.direction === "out";
                  const failed = m.status === "failed";
                  return (
                    <div key={m.id} className={`mb-2.5 flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[78%]">
                        <div
                          className="rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
                          style={{
                            background: mine ? (m.sender === "ai" ? "var(--blS)" : "var(--acS)") : "var(--sf2)",
                            border: failed ? "1px solid var(--rd)" : "1px solid transparent",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {m.body || <em style={{ color: "var(--tx3)" }}>(chỉ có tệp đính kèm)</em>}
                          {m.attachments?.map((a, i) => (
                            <a
                              key={i}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1.5 block text-[12px] underline"
                            >
                              📎 {a.name || a.type}
                            </a>
                          ))}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 px-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                          {senderLabel(m, staff)} · {fmtTime(m.created_at)}
                          {failed && (
                            <span className="flex items-center gap-1" style={{ color: "var(--rd)" }}>
                              <CircleAlert size={11} /> chưa gửi được{m.error ? `: ${m.error}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* ── Ô soạn tin ────────────────────────────────────────────── */}
              <div className="border-t p-3" style={{ borderColor: "var(--bd2)" }}>
                {!replyOpen ? (
                  <p
                    className="rounded-[12px] p-2.5 text-[12px]"
                    style={{ background: "var(--amS)", color: "var(--am)" }}
                  >
                    {blockedReason}
                  </p>
                ) : (
                  <>
                    {active.aiEnabled && (
                      <p className="mb-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>
                        Trợ lý AI đang trả lời hội thoại này — bạn gửi tin là AI tự ngừng.
                      </p>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        className="input min-h-[42px] flex-1 resize-y py-2 text-[13px]"
                        rows={2}
                        placeholder="Nhập câu trả lời cho khách…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary px-3 py-2">
                        <Send size={15} /> {sending ? "Đang gửi…" : "Gửi"}
                      </button>
                    </div>
                    {sendError && (
                      <p className="mt-1.5 text-[12px]" style={{ color: "var(--rd)" }}>
                        {sendError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
