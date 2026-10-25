"use client";

import { MessageCircle, Check, X, AlertTriangle, Loader2, QrCode, BadgeCheck, ExternalLink } from "lucide-react";
import { eventCfg } from "@/lib/zalo/events";
import { EVENTS, qrSrc, useZalo } from "./useZalo";

export default function ZaloPanel() {
  // Logic dùng chung với bản mới (ZaloPanelV2) — xem ./useZalo.
  const {
    st, connecting, qr, savingEvt, testPhone, setTestPhone, testMsg, setTestMsg, testState, testErr, ketQuaOA,
    autoEvents, kenh, coOA, scanned, noiOA, doiKenh, ngatOA, toggle, connectPersonal, disconnect, sendTest,
  } = useZalo();

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-[#0068FF]" />
        <h2 className="font-serif text-xl font-medium">Tự động nhắn tin Zalo</h2>
        {st?.connected && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--gnS)] px-2.5 py-1 text-xs text-[var(--gn)]">
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
        <div className="mt-4 flex gap-2 rounded-lg bg-[var(--gnS)] p-3 text-xs text-[var(--gn)]">
          <Check size={16} className="mt-0.5 shrink-0" />
          <div>Đã kết nối Official Account. Từ giờ tin tự động gửi qua kênh chính thống.</div>
        </div>
      )}
      {ketQuaOA === "loi" && (
        <div className="mt-4 flex gap-2 rounded-lg bg-[var(--rdS)] p-3 text-xs text-[var(--rd)]">
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
                borderColor: kenh === id ? "#0068FF" : "var(--bd)",
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
        <div className="mt-4 flex gap-2 rounded-lg bg-[var(--amS)] p-3 text-xs text-[var(--am)]">
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
            <span className="text-xs text-[var(--rd)]">Lỗi: {st.lastError}</span>
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
              <span className="text-xs text-[var(--am)]">Máy chủ chưa cài zca-js — liên hệ hỗ trợ để bật.</span>
            )}
          </>
        )}
        {st?.lastError && !st.connected && !connecting && (
          <span className="text-xs text-[var(--rd)]">Lỗi: {st.lastError}</span>
        )}
      </div>
      )}

      {/* QR để quét — chỉ của kênh cá nhân */}
      {kenh === "personal" && connecting && !st?.connected && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-[var(--bd)] p-5">
          {scanned ? (
            <>
              <Loader2 size={28} className="animate-spin text-[var(--gn)]" />
              <p className="text-sm text-[var(--gn)]">Đã quét — đang hoàn tất đăng nhập…</p>
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
        <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--bd)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--sf2)] text-xs opacity-70">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mốc</th>
                <th className="px-3 py-2 text-center font-medium">Gửi khách</th>
                <th className="px-3 py-2 text-center font-medium">Gửi thợ</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e) => {
                const cfg = eventCfg(autoEvents, e.key);
                return (
                  <tr key={e.key} className="border-t border-[var(--bd2)]">
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
        <div className="mt-6 rounded-xl border border-[var(--bd)] p-4">
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
          {testState === "ok" && <p className="mt-1 text-xs text-[var(--gn)]">Đã gửi ✓</p>}
          {testState === "fail" && <p className="mt-1 text-xs text-[var(--rd)]">Lỗi: {testErr}</p>}
        </div>
      )}
    </div>
  );
}
