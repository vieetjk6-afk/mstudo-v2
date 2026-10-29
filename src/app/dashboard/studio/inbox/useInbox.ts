"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canReply, replyBlockedReason, type Platform } from "@/lib/inbox/platforms";
import type { ChannelPublic, ConversationView, MessageRow } from "@/lib/inbox/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC của màn Hộp thư — dùng chung cho bản cũ (InboxView) và bản giao diện
   mới (InboxV2): danh sách hội thoại, mở hội thoại, realtime, lọc, đổi trạng
   thái (AI / tiếp quản / xong), gửi tin. Hai bản chỉ khác ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type InboxFilter = "all" | "unread" | "mine";

export interface InboxProps {
  conversations: ConversationView[];
  firstMessages: MessageRow[];
  staff: Record<string, string>;
  channels: ChannelPublic[];
  meId: string;
  /** id chủ studio (owner_id của các bảng inbox) — khác meId khi nhân viên đăng nhập. */
  ownerId: string;
  canManageChannels: boolean;
}

export function fmtTime(ts: string): string {
  try {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export function senderLabel(m: MessageRow, staff: Record<string, string>): string {
  if (m.sender === "customer") return "Khách";
  if (m.sender === "ai") return "Trợ lý AI";
  if (m.sender === "system") return "Hệ thống";
  return m.sender_name || (m.sender_id ? staff[m.sender_id] : "") || "Nhân viên";
}

export function useInbox({ conversations: initial, firstMessages, meId, ownerId }: InboxProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ConversationView[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [messages, setMessages] = useState<MessageRow[]>(firstMessages);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Trên điện thoại chỉ đủ chỗ cho một cột: mở hội thoại thì ẩn danh sách.
  const [mobileThread, setMobileThread] = useState(false);

  const active = rows.find((c) => c.id === activeId) ?? null;
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/inbox/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { conversations: ConversationView[] };
    setRows(json.conversations);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    // Sang hội thoại KHÁC: xoá nháp + khung chat cũ — để nguyên thì bấm Enter là
    // gửi câu soạn cho khách A sang khách B, và tin của A hiện dưới tên B.
    if (id !== activeIdRef.current) {
      setDraft("");
      setMessages([]);
    }
    activeIdRef.current = id;
    setActiveId(id);
    setMobileThread(true);
    setSendError(null);
    const res = await fetch(`/api/inbox/conversations/${id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json = (await res.json()) as { conversation: ConversationView; messages: MessageRow[] };
    // Bấm nhanh A rồi B: lượt tải của A về sau thì bỏ, không đè lên khung của B.
    if (activeIdRef.current !== id) return;
    setMessages(json.messages);
    setRows((cur) => cur.map((c) => (c.id === id ? { ...c, ...json.conversation } : c)));
  }, []);

  /* ── Realtime ───────────────────────────────────────────────────────────
     Nghe cả bảng tin lẫn bảng hội thoại. Tin mới của hội thoại đang mở thì nạp
     lại khung chat; mọi thay đổi khác chỉ làm mới danh sách bên trái. Cố ý nạp
     lại qua API thay vì tự ghép dòng từ payload: payload không kèm tên kênh và
     tên người, ghép tay sẽ ra những dòng thiếu thông tin nhấp nháy trên màn. */
  /* Lọc theo owner_id NGAY TẠI server realtime: RLS vẫn chặn dòng của studio khác,
     nhưng không có filter thì Realtime phải kiểm RLS cho từng thay đổi của MỌI
     studio rồi mới loại — tốn tài nguyên và tăng độ trễ khi hệ thống đông. */
  useEffect(() => {
    const ownerFilter = `owner_id=eq.${ownerId}`;
    const channel = supabase
      .channel("inbox-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inbox_messages", filter: ownerFilter }, (payload) => {
        const convId = (payload.new as { conversation_id?: string })?.conversation_id;
        if (convId && convId === activeIdRef.current) {
          fetch(`/api/inbox/conversations/${convId}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j && setMessages(j.messages))
            .catch(() => {});
        }
        refreshList();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inbox_conversations", filter: ownerFilter }, () => {
        refreshList();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshList, ownerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "mine" && c.assigneeId !== meId) return false;
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (q && !`${c.contactName} ${c.lastMessage ?? ""} ${c.contactPhone ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, filter, platformFilter, query, meId]);

  // Đếm HỘI THOẠI còn tin chưa đọc, không phải tổng số tin — khách nhắn liên
  // tiếp 8 tin vẫn chỉ là một việc phải xử lý. Cùng cách đếm với badge sidebar
  // (/api/studio/nav-badges), nếu không hai con số trên cùng màn sẽ lệch nhau.
  const unreadTotal = rows.filter((c) => c.unread > 0).length;

  async function patchActive(patch: { aiEnabled?: boolean; status?: "open" | "closed"; assignee?: "me" | null }) {
    if (!active) return;
    const res = await fetch(`/api/inbox/conversations/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { aiEnabled: boolean; status: ConversationView["status"]; assigneeId: string | null };
    setRows((cur) =>
      cur.map((c) =>
        c.id === active.id
          ? { ...c, aiEnabled: json.aiEnabled, status: json.status, assigneeId: json.assigneeId }
          : c
      )
    );
  }

  async function send() {
    const text = draft.trim();
    if (!text || !active || sending) return;
    setSending(true);
    setSendError(null);
    const res = await fetch("/api/inbox/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: active.id, text }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSending(false);
    if (!res.ok) {
      setSendError(json.error || "Không gửi được tin. Thử lại hoặc gọi cho khách.");
      // Tin hỏng vẫn được ghi lại nên vẫn phải nạp khung chat để nhân viên thấy.
      openConversation(active.id);
      return;
    }
    setDraft("");
    openConversation(active.id);
  }

  const replyOpen = active ? canReply(active.platform, active.lastInboundAt) : false;
  const blockedReason = active ? replyBlockedReason(active.platform) : "";

  return {
    rows, activeId, active, messages, filter, setFilter, platformFilter, setPlatformFilter, query, setQuery,
    draft, setDraft, sending, sendError, mobileThread, setMobileThread, bottomRef,
    openConversation, filtered, unreadTotal, patchActive, send, replyOpen, blockedReason,
  };
}
