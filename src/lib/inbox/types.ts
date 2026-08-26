import type { Platform } from "./platforms";

/** Một kênh đã nối (dòng của inbox_channels). `secret` KHÔNG bao giờ ra client. */
export interface ChannelRow {
  id: string;
  owner_id: string;
  platform: Platform;
  external_id: string;
  name: string | null;
  status: "connected" | "disconnected" | "error";
  secret: string | null;
  ai_mode: "auto" | "off";
  last_error: string | null;
  connected_at: string | null;
  updated_at: string;
}

/** Trạng thái kênh an toàn để trả ra trình duyệt (đã bỏ token). */
export interface ChannelPublic {
  id: string;
  platform: Platform;
  externalId: string;
  name: string | null;
  status: ChannelRow["status"];
  aiMode: ChannelRow["ai_mode"];
  lastError: string | null;
  connectedAt: string | null;
}

export interface ContactRow {
  id: string;
  owner_id: string;
  channel_id: string;
  external_user_id: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export interface ConversationRow {
  id: string;
  owner_id: string;
  channel_id: string;
  contact_id: string;
  status: "open" | "closed";
  ai_enabled: boolean;
  assignee_id: string | null;
  last_message: string | null;
  last_message_at: string;
  last_direction: "in" | "out" | null;
  /** Mốc tin cuối của KHÁCH — quyết định còn trong cửa sổ nhắn lại hay không. */
  last_inbound_at: string | null;
  unread: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender: "customer" | "ai" | "staff" | "system";
  sender_id: string | null;
  sender_name: string | null;
  body: string;
  attachments: Attachment[];
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
}

export interface Attachment {
  type: "image" | "file" | "sticker" | "audio" | "video";
  url: string;
  name?: string;
}

/** Một tin của khách vừa tới, đã chuẩn hoá từ webhook của nền tảng bất kỳ. */
export interface IncomingMessage {
  /** Id người nhắn trên nền tảng đó (psid, uid, sessionId…). */
  externalUserId: string;
  body: string;
  attachments?: Attachment[];
  /** Id tin trên nền tảng gốc — dùng để chống ghi trùng khi webhook bắn lại. */
  externalId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
}

/** Hội thoại kèm thông tin kênh và người nhắn — hình dạng dùng cho giao diện. */
export interface ConversationView {
  id: string;
  platform: Platform;
  channelName: string | null;
  contactName: string;
  contactAvatar: string | null;
  contactPhone: string | null;
  status: ConversationRow["status"];
  aiEnabled: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  lastDirection: "in" | "out" | null;
  unread: number;
  /** Tin cuối của KHÁCH — quyết định còn được nhắn lại hay đã quá cửa sổ. */
  lastInboundAt: string | null;
}
