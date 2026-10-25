"use client";

import { useEffect, useState } from "react";
import type { Platform } from "@/lib/inbox/platforms";
import type { ChannelPublic } from "@/lib/inbox/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC màn Nối kênh vào hộp thư — dùng chung cho bản cũ (ChannelsManager) và
   bản giao diện mới (ChannelsV2): gọi /api/inbox/channels, đọc kết quả quay về
   từ Facebook, các ô nhập thủ công. Hai bản chỉ khác ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ChannelsProps {
  channels: ChannelPublic[];
  zaloReady: boolean;
  zaloChannel: "oa" | "personal" | null;
  /** Nền tảng đã khai Meta App chưa — quyết định có hiện nút một chạm không. */
  metaOAuthReady: boolean;
}

export type FbResult = { tone: "ok" | "warn" | "err"; text: string };

/**
 * Kết quả quay về từ Facebook (?meta=…). Facebook chỉ redirect được kèm tham số
 * URL, nên phải dịch chúng ra câu tiếng Việt tại đây — nếu không studio quay về
 * một trang trông y như lúc họ rời đi và không biết mình đã nối được hay chưa.
 */
export function metaResult(params: URLSearchParams): FbResult | null {
  const code = params.get("meta");
  if (!code) return null;
  const pages = Number(params.get("pages") || 0);
  const ig = Number(params.get("ig") || 0);
  switch (code) {
    case "connected": {
      const parts = [`Đã nối ${pages} Trang Facebook`];
      if (ig) parts.push(`${ig} tài khoản Instagram`);
      const done = `${parts.join(" và ")}. Nhắn thử một tin từ tài khoản khác để kiểm tra.`;
      return params.get("warn")
        ? { tone: "warn", text: `${done} Có Trang chưa bật được nhận tin — xem cột trạng thái phía trên.` }
        : { tone: "ok", text: done };
    }
    case "cancelled":
      return { tone: "warn", text: "Bạn đã huỷ ở màn hình Facebook. Chưa nối Trang nào." };
    case "no_page":
      return {
        tone: "warn",
        text: "Tài khoản Facebook đó không quản lý Trang nào, hoặc bạn chưa tích chọn Trang. Meta không cho nhắn tin qua trang cá nhân — studio cần một Trang.",
      };
    case "not_configured":
      return { tone: "err", text: "Nền tảng chưa khai Meta App nên chưa dùng được nút kết nối một chạm." };
    default:
      return { tone: "err", text: "Nối Facebook không thành công. Thử lại, hoặc dùng cách nối thủ công bên dưới." };
  }
}

export function useChannels({ channels: initial }: ChannelsProps) {
  const [channels, setChannels] = useState<ChannelPublic[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // URL webhook phải là tên miền THẬT của studio, nên chỉ dựng được ở trình duyệt.
  useEffect(() => setOrigin(window.location.origin), []);

  const [form, setForm] = useState({ platform: "facebook" as Platform, externalId: "", token: "", name: "" });
  const [tiktok, setTiktok] = useState({ externalId: "", relayUrl: "", relaySecret: "" });
  const [manualMeta, setManualMeta] = useState(false);
  const [fbResult, setFbResult] = useState<FbResult | null>(null);

  // Đọc kết quả Facebook trả về rồi DỌN tham số khỏi thanh địa chỉ: để nguyên
  // thì bấm F5 lại hiện "đã nối 2 Trang" trong khi chẳng có gì vừa xảy ra.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const res = metaResult(params);
    if (!res) return;
    setFbResult(res);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/inbox/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Không thực hiện được. Kiểm tra lại thông tin.");
        return false;
      }
      const list = await fetch("/api/inbox/channels", { cache: "no-store" });
      if (list.ok) setChannels(((await list.json()) as { channels: ChannelPublic[] }).channels);
      return true;
    } finally {
      setBusy(false);
    }
  }

  const byPlatform = (p: Platform) => channels.find((c) => c.platform === p && c.status === "connected");

  /** Bật/tắt trợ lý AI cho toàn bộ một kênh. */
  const toggleAi = (ch: ChannelPublic) => call({ action: "ai-mode", channelId: ch.id, aiMode: ch.aiMode === "auto" ? "off" : "auto" });
  const disconnect = (ch: ChannelPublic) => call({ action: "disconnect", channelId: ch.id });

  async function linkZalo() {
    const ok = await call({ action: "link-zalo" });
    if (ok) setNotice("Đã nối Zalo vào hộp thư.");
  }

  async function connectManual() {
    const ok = await call({
      platform: form.platform,
      externalId: form.externalId.trim(),
      pageAccessToken: form.token.trim(),
      name: form.name.trim(),
    });
    if (ok) {
      setForm({ ...form, externalId: "", token: "", name: "" });
      setNotice("Đã nối kênh. Nhắn thử một tin từ tài khoản khác để kiểm tra.");
    }
  }

  async function connectTiktok() {
    const ok = await call({
      platform: "tiktok",
      externalId: tiktok.externalId.trim(),
      relayUrl: tiktok.relayUrl.trim(),
      relaySecret: tiktok.relaySecret.trim(),
      name: tiktok.externalId.trim(),
    });
    if (ok) {
      setTiktok({ externalId: "", relayUrl: "", relaySecret: "" });
      setNotice("Đã nối TikTok. Nhờ đối tác gửi thử một tin để kiểm tra.");
    }
  }

  const canConnectManual = !busy && !!form.externalId.trim() && !!form.token.trim();
  const canConnectTiktok = !busy && !!tiktok.externalId.trim() && !!tiktok.relayUrl.trim() && !!tiktok.relaySecret.trim();

  return {
    channels, busy, error, notice, origin, form, setForm, tiktok, setTiktok, manualMeta, setManualMeta, fbResult,
    byPlatform, toggleAi, disconnect, linkZalo, connectManual, connectTiktok, canConnectManual, canConnectTiktok,
  };
}
