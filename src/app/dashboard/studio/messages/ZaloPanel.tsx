"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Check, X, AlertTriangle, Loader2, QrCode } from "lucide-react";

type AutoCfg = { client?: boolean; crew?: boolean; templateId?: string };

type Status = {
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
};

const EVENTS: { key: string; label: string; audiences: ("client" | "crew")[] }[] = [
  { key: "booking_confirm", label: "Xác nhận đặt lịch", audiences: ["client"] },
  { key: "deposit_confirm", label: "Xác nhận đã nhận cọc", audiences: ["client"] },
  { key: "shoot_reminder", label: "Nhắc lịch chụp (trước 1 ngày)", audiences: ["client", "crew"] },
  { key: "payment_due", label: "Nhắc thanh toán tới hạn", audiences: ["client"] },
  { key: "select_ready", label: "Mời khách chọn ảnh", audiences: ["client"] },
  { key: "delivery_ready", label: "Báo đã giao ảnh", audiences: ["client"] },
];

/** QR có thể là data URL sẵn hoặc base64 thô → chuẩn hoá về src hợp lệ. */
function qrSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

export default function ZaloPanel() {
  const [st, setSt] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [savingEvt, setSavingEvt] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Xin chào, đây là tin nhắn thử từ studio qua MStudo.");
  const [testState, setTestState] = useState<null | "sending" | "ok" | "fail">(null);
  const [testErr, setTestErr] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const autoEvents = st?.autoEvents ?? {};

  async function saveEvents(next: Record<string, AutoCfg>) {
    setSavingEvt(true);
    setSt((s) => (s ? { ...s, autoEvents: next } : s));
    await fetch("/api/studio/zalo/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "personal", autoEvents: next }),
    });
    setSavingEvt(false);
  }

  function toggle(key: string, aud: "client" | "crew") {
    const cur = autoEvents[key] ?? {};
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
      };
      setTestErr(map[res.error] || res.error || "Gửi thất bại");
    }
  }

  const scanned = st?.phase === "scanned";

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-[#0068FF]" />
        <h2 className="font-serif text-xl font-medium">Tự động nhắn tin Zalo</h2>
        {st?.connected && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-400">
            <Check size={13} /> Đã kết nối
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm opacity-70">
        Đăng nhập tài khoản Zalo của studio để tự động nhắn khách &amp; thợ ở các mốc hợp đồng (nhắc
        lịch chụp, mời chọn ảnh, báo giao ảnh…). Chỉ dùng được với gói Studio.
      </p>

      {/* Cảnh báo rủi ro */}
      <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <b>Lưu ý:</b> đây là kênh dùng tài khoản Zalo cá nhân (không chính thống). Gửi tin tự động
          có thể khiến Zalo <b>tạm khoá tài khoản</b> nếu gửi quá nhiều hoặc cho người lạ. Chỉ nên
          nhắn khách/thợ <b>đã kết bạn</b>, số lượng vừa phải. Studio tự chịu trách nhiệm khi bật.
        </div>
      </div>

      {/* Kết nối / trạng thái */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {st?.connected ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm">
              {st.self?.avatar ? (
                <img src={st.self.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : null}
              Tài khoản: <b>{st.displayName || st.self?.name || "đã kết nối"}</b>
            </span>
            <button type="button" onClick={disconnect} className="btn-ghost px-3 py-1.5 text-xs">
              <X size={14} /> Ngắt kết nối
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={connectPersonal}
              disabled={connecting || st?.personalAvailable === false}
              className="btn-primary px-4 py-2 text-sm"
            >
              {connecting ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
              {connecting ? "Đang chờ quét…" : "Đăng nhập Zalo bằng QR"}
            </button>
            {st?.personalAvailable === false && (
              <span className="text-xs text-amber-400">Máy chủ chưa cài zca-js — liên hệ hỗ trợ để bật.</span>
            )}
          </>
        )}
        {st?.lastError && !st.connected && !connecting && (
          <span className="text-xs text-rose-400">Lỗi: {st.lastError}</span>
        )}
      </div>

      {/* QR để quét */}
      {connecting && !st?.connected && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-white/10 p-5">
          {scanned ? (
            <>
              <Loader2 size={28} className="animate-spin text-emerald-400" />
              <p className="text-sm text-emerald-400">Đã quét — đang hoàn tất đăng nhập…</p>
            </>
          ) : qr ? (
            <>
              <img src={qrSrc(qr)} alt="Zalo QR" className="h-52 w-52 rounded bg-white p-2" />
              <p className="text-center text-xs opacity-70">
                Mở Zalo trên điện thoại → <b>Cá nhân</b> → biểu tượng quét mã → quét QR này. Giữ trang
                mở đến khi kết nối xong.
              </p>
            </>
          ) : (
            <>
              <Loader2 size={28} className="animate-spin opacity-60" />
              <p className="text-xs opacity-70">Đang tạo mã QR…</p>
            </>
          )}
        </div>
      )}

      {/* Bật/tắt tự động theo mốc */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          Tự động gửi theo mốc
          {savingEvt && <Loader2 size={13} className="animate-spin opacity-60" />}
        </div>
        {/* overflow-x-auto (không phải hidden): vẫn bo góc như cũ nhưng nếu bảng
            rộng hơn khung thì cuộn ngang được, không bị cắt mất cột. */}
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs opacity-70">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mốc</th>
                <th className="px-3 py-2 text-center font-medium">Gửi khách</th>
                <th className="px-3 py-2 text-center font-medium">Gửi thợ</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e) => {
                const cfg = autoEvents[e.key] ?? {};
                return (
                  <tr key={e.key} className="border-t border-white/5">
                    <td className="px-3 py-2">{e.label}</td>
                    <td className="px-3 py-2 text-center">
                      {e.audiences.includes("client") ? (
                        <input type="checkbox" checked={!!cfg.client} onChange={() => toggle(e.key, "client")} className="h-4 w-4 accent-[#0068FF]" />
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.audiences.includes("crew") ? (
                        <input type="checkbox" checked={!!cfg.crew} onChange={() => toggle(e.key, "crew")} className="h-4 w-4 accent-[#0068FF]" />
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs opacity-55">
          Chỉ gửi được cho người đã kết bạn Zalo với tài khoản đang đăng nhập. Nhắc lịch chụp chạy tự
          động hằng ngày; các mốc khác gửi khi bạn thao tác trên hợp đồng.
        </p>
      </div>

      {/* Gửi thử */}
      {st?.connected && (
        <div className="mt-6 rounded-xl border border-white/10 p-4">
          <div className="text-sm font-medium">Gửi thử</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Số điện thoại (đã kết bạn Zalo)"
              className="input flex-1"
            />
            <button type="button" onClick={sendTest} disabled={testState === "sending"} className="btn-primary px-4 py-2 text-sm">
              {testState === "sending" ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} Gửi thử
            </button>
          </div>
          <textarea value={testMsg} onChange={(e) => setTestMsg(e.target.value)} rows={2} className="input mt-2 w-full" />
          {testState === "ok" && <p className="mt-1 text-xs text-emerald-400">Đã gửi ✓</p>}
          {testState === "fail" && <p className="mt-1 text-xs text-rose-400">Lỗi: {testErr}</p>}
        </div>
      )}
    </div>
  );
}
