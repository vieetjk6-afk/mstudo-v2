"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { eventCfg } from "@/lib/zalo/events";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của khối "Tự động nhắn tin Zalo" (bản cũ ZaloPanel và
   bản mới ZaloPanelV2): trạng thái kết nối, kênh OA / cá nhân, đăng nhập QR,
   bật/tắt từng mốc gửi tự động, gửi thử. Mọi lời gọi /api/studio/zalo/* ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AutoCfg = { client?: boolean; crew?: boolean; templateId?: string };

export type Status = {
  connected: boolean;
  channel?: string | null;
  status?: string;
  displayName?: string | null;
  self?: { id?: string; name?: string; avatar?: string } | null;
  autoEvents?: Record<string, AutoCfg>;
  connectedAt?: string | null;
  lastError?: string | null;
  qr?: string | null;
  phase?: string | null;
  personalAvailable?: boolean;
  /** Máy chủ đã khai ZALO_OA_APP_ID/SECRET/REDIRECT chưa. /status vốn đã trả
   *  về trường này từ lâu, chỉ là giao diện chưa đọc tới. */
  oaConfigured?: boolean;
  oaId?: string | null;
};

export const EVENTS: { key: string; label: string; audiences: ("client" | "crew")[] }[] = [
  { key: "booking_confirm", label: "Xác nhận đặt lịch", audiences: ["client"] },
  { key: "deposit_confirm", label: "Xác nhận đã nhận cọc", audiences: ["client"] },
  { key: "payment_done", label: "Xác nhận đã thanh toán đủ", audiences: ["client"] },
  { key: "shoot_reminder", label: "Nhắc lịch chụp (trước 1 ngày)", audiences: ["client", "crew"] },
  { key: "payment_due", label: "Nhắc thanh toán tới hạn", audiences: ["client"] },
  { key: "select_ready", label: "Mời khách chọn ảnh", audiences: ["client"] },
  { key: "delivery_ready", label: "Báo đã giao ảnh", audiences: ["client"] },
  { key: "portal_link", label: "Hoàn thành → gửi link trang riêng của khách", audiences: ["client"] },
];

/** QR có thể là data URL sẵn hoặc base64 thô → chuẩn hoá về src hợp lệ. */
export function qrSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

export function useZalo() {
  const [st, setSt] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [savingEvt, setSavingEvt] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Xin chào, đây là tin nhắn thử từ studio qua MStudo.");
  const [testState, setTestState] = useState<null | "sending" | "ok" | "fail">(null);
  const [testErr, setTestErr] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Kết quả chuyến đi sang Zalo cấp quyền OA (đọc từ ?zalo= khi quay về). */
  const [ketQuaOA, setKetQuaOA] = useState<null | "ok" | "loi">(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/studio/zalo/status", { cache: "no-store" }).then((x) => x.json());
    setSt(r);
    if (r.qr) setQr(r.qr);
    return r as Status;
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Cổng OA quay về /dashboard/studio/messages?zalo=oa_connected|error. Trước
  // đây không ai đọc tham số này nên studio cấp quyền xong chỉ thấy trang tải
  // lại, không biết thành hay bại. Đọc xong thì DỌN khỏi URL để F5 không hiện
  // lại thông báo cũ.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const z = sp.get("zalo");
    if (!z) return;
    setKetQuaOA(z === "oa_connected" ? "ok" : "loi");
    sp.delete("zalo");
    const q = sp.toString();
    window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
  }, []);

  const autoEvents = st?.autoEvents ?? {};
  /** Kênh đang dùng. Chưa có gì thì mặc định cá nhân, đúng như máy chủ. */
  const kenh: "oa" | "personal" = st?.channel === "oa" ? "oa" : "personal";
  /** Máy chủ có bật kênh OA không. Không bật thì giao diện giữ NGUYÊN như cũ. */
  const coOA = st?.oaConfigured === true;

  /** Sang Zalo cấp quyền OA. */
  function noiOA() {
    // Cố ý dùng window.location: /api/studio/zalo/oa/connect KHÔNG phải trang
    // Next, nó trả 302 sang tên miền của Zalo. router.push() chỉ điều hướng
    // trong app nên sẽ không đi tới đâu cả.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/studio/zalo/oa/connect";
  }

  /** Đổi kênh gửi mà không đụng tới bảng mốc tự động. */
  async function doiKenh(k: "oa" | "personal") {
    if (k === kenh) return;
    setSt((x) => (x ? { ...x, channel: k } : x));
    await fetch("/api/studio/zalo/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: k }),
    });
    refresh();
  }

  /** Ngắt OA: dùng /disconnect (xoá cả token OA lẫn phiên cá nhân), khác với
   *  nút ngắt của kênh cá nhân vốn chỉ xoá phiên cá nhân. */
  async function ngatOA() {
    if (!confirm("Ngắt kết nối Official Account? Tin tự động sẽ ngừng gửi cho tới khi nối lại.")) return;
    await fetch("/api/studio/zalo/disconnect", { method: "POST" });
    refresh();
  }

  async function saveEvents(next: Record<string, AutoCfg>) {
    setSavingEvt(true);
    setSt((s) => (s ? { ...s, autoEvents: next } : s));
    await fetch("/api/studio/zalo/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Gửi ĐÚNG kênh đang dùng. Trước đây ghi cứng "personal", nên studio đã
      // nối Official Account mà chỉ cần tick một ô ở bảng dưới là kênh bị lật
      // ngược về tài khoản cá nhân — im lặng, không báo gì.
      body: JSON.stringify({ channel: kenh, autoEvents: next }),
    });
    setSavingEvt(false);
  }

  function toggle(key: string, aud: "client" | "crew") {
    const cur = eventCfg(autoEvents, key);
    const next = { ...autoEvents, [key]: { ...cur, [aud]: !cur[aud] } };
    saveEvents(next);
  }

  async function connectPersonal() {
    setConnecting(true);
    setQr(null);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r = await refresh();
      if (r.connected) {
        if (pollRef.current) clearInterval(pollRef.current);
        setConnecting(false);
        setQr(null);
      }
    }, 2000);
    try {
      await fetch("/api/studio/zalo/personal", { method: "POST" }).then((x) => x.json());
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setConnecting(false);
      refresh();
    }
  }

  async function disconnect() {
    if (!confirm("Ngắt kết nối Zalo? Tin tự động sẽ ngừng gửi cho tới khi kết nối lại.")) return;
    await fetch("/api/studio/zalo/personal", { method: "DELETE" });
    setQr(null);
    refresh();
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTestState("sending");
    setTestErr("");
    const res = await fetch("/api/studio/zalo/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toPhone: testPhone.trim(), body: testMsg, kind: "test" }),
    }).then((x) => x.json());
    if (res.ok) setTestState("ok");
    else {
      setTestState("fail");
      const map: Record<string, string> = {
        not_connected: "Chưa kết nối Zalo.",
        no_personal_session: "Phiên hết hạn — kết nối lại.",
        recipient_not_found: "Không tìm thấy Zalo của số này (số sai, chưa có Zalo, hoặc đã tắt 'cho phép tìm bằng SĐT').",
        // Kênh OA: Zalo chỉ cho gửi tin tự do trong 48h sau khi khách nhắn tới;
        // ngoài khung đó phải dùng mẫu ZNS đã duyệt. Mã thô không nói lên điều đó.
        oa_needs_template_or_uid:
          "Kênh Official Account cần mẫu ZNS đã duyệt (hoặc khách phải vừa nhắn cho OA trong 48h). Chọn mẫu ở phần cấu hình, hoặc tạm chuyển sang kênh cá nhân.",
      };
      setTestErr(map[res.error] || res.error || "Gửi thất bại");
    }
  }

  const scanned = st?.phase === "scanned";

  return {
    st, connecting, qr, savingEvt, testPhone, setTestPhone, testMsg, setTestMsg, testState, testErr, ketQuaOA,
    autoEvents, kenh, coOA, scanned, noiOA, doiKenh, ngatOA, toggle, connectPersonal, disconnect, sendTest,
  };
}
