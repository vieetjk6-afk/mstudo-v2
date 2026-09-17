"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Check, X, AlertTriangle, Loader2, QrCode, BadgeCheck, ExternalLink } from "lucide-react";

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
  /** Máy chủ đã khai ZALO_OA_APP_ID/SECRET/REDIRECT chưa. /status vốn đã trả
   *  về trường này từ lâu, chỉ là giao diện chưa đọc tới. */
  oaConfigured?: boolean;
  oaId?: string | null;
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
        // Kênh OA: Zalo chỉ cho gửi tin tự do trong 48h sau khi khách nhắn tới;
        // ngoài khung đó phải dùng mẫu ZNS đã duyệt. Mã thô không nói lên điều đó.
        oa_needs_template_or_uid:
          "Kênh Official Account cần mẫu ZNS đã duyệt (hoặc khách phải vừa nhắn cho OA trong 48h). Chọn mẫu ở phần cấu hình, hoặc tạm chuyển sang kênh cá nhân.",
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
        Tự động nhắn khách &amp; thợ ở các mốc hợp đồng (nhắc lịch chụp, mời chọn ảnh, báo giao
        ảnh…). Chỉ dùng được với gói Studio.
      </p>

      {/* Kết quả quay về từ cổng cấp quyền OA */}
      {ketQuaOA === "ok" && (
        <div className="mt-4 flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <Check size={16} className="mt-0.5 shrink-0" />
          <div>Đã kết nối Official Account. Từ giờ tin tự động gửi qua kênh chính thống.</div>
        </div>
      )}
      {ketQuaOA === "loi" && (
        <div className="mt-4 flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <X size={16} className="mt-0.5 shrink-0" />
          <div>Chưa cấp quyền được cho Official Account. Thử lại, hoặc kiểm tra xem tài khoản Zalo đang đăng nhập có phải quản trị viên của OA không.</div>
        </div>
      )}

      {/* Chọn kênh gửi — CHỈ hiện khi máy chủ đã bật OA. Chưa bật thì màn này
          giữ nguyên như trước, studio đang dùng không thấy gì khác. */}
      {coOA && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([
            { id: "oa" as const, ten: "Official Account", mo: "Chính thống, không lo bị khoá. Gửi theo mẫu ZNS đã duyệt.", Icon: BadgeCheck },
            { id: "personal" as const, ten: "Tài khoản cá nhân", mo: "Đăng nhập bằng QR. Nhắn tự do nhưng có rủi ro bị Zalo tạm khoá.", Icon: QrCode },
          ]).map(({ id, ten, mo, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => doiKenh(id)}
              aria-pressed={kenh === id}
              className="rounded-xl border p-3 text-left transition"
              style={{
                borderColor: kenh === id ? "#0068FF" : "rgba(255,255,255,.12)",
                background: kenh === id ? "rgba(0,104,255,.08)" : "transparent",
              }}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon size={15} className={kenh === id ? "text-[#0068FF]" : "opacity-60"} />
                {ten}
                {kenh === id && <Check size={14} className="ml-auto text-[#0068FF]" />}
              </span>
              <span className="mt-1 block text-xs opacity-65">{mo}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cảnh báo rủi ro — chỉ đúng với kênh CÁ NHÂN. Kênh OA là chính thống
          nên dán cảnh báo này lên đó là nói sai và làm studio ngại dùng. */}
      {kenh === "personal" && (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Lưu ý:</b> đây là kênh dùng tài khoản Zalo cá nhân (không chính thống). Gửi tin tự động
            có thể khiến Zalo <b>tạm khoá tài khoản</b> nếu gửi quá nhiều hoặc cho người lạ. Chỉ nên
            nhắn khách/thợ <b>đã kết bạn</b>, số lượng vừa phải. Studio tự chịu trách nhiệm khi bật.
          </div>
        </div>
      )}

      {/* Kết nối / trạng thái — kênh OA đi đường riêng (OAuth), kênh cá nhân
          vẫn là luồng QR như cũ. */}
      {coOA && kenh === "oa" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {st?.connected ? (
            <>
              <span className="inline-flex items-center gap-2 text-sm">
                <BadgeCheck size={16} className="text-[#0068FF]" />
                Official Account: <b>{st.displayName || st.oaId || "đã kết nối"}</b>
              </span>
              <button type="button" onClick={ngatOA} className="btn-ghost px-3 py-1.5 text-xs">
                <X size={14} /> Ngắt kết nối
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={noiOA} className="btn-primary px-4 py-2 text-sm">
                <ExternalLink size={15} /> Kết nối Official Account
              </button>
              <span className="text-xs opacity-60">
                Sang Zalo cấp quyền rồi tự quay lại đây. Cần là quản trị viên của OA.
              </span>
            </>
          )}
          {st?.lastError && !st.connected && (
            <span className="text-xs text-rose-400">Lỗi: {st.lastError}</span>
          )}
        </div>
      ) : (
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
      )}

      {/* QR để quét — chỉ của kênh cá nhân */}
      {kenh === "personal" && connecting && !st?.connected && (
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
          {kenh === "oa"
            ? "Kênh Official Account gửi theo mẫu ZNS đã được Zalo duyệt. Nhắc lịch chụp chạy tự động hằng ngày; các mốc khác gửi khi bạn thao tác trên hợp đồng."
            : "Chỉ gửi được cho người đã kết bạn Zalo với tài khoản đang đăng nhập. Nhắc lịch chụp chạy tự động hằng ngày; các mốc khác gửi khi bạn thao tác trên hợp đồng."}
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
