"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useMfa } from "./useMfa";

/**
 * Bật / tắt xác thực 2 lớp (TOTP) bằng Supabase Auth MFA. Logic nằm ở ./useMfa
 * (dùng chung với khối "Xác thực 2 lớp" của bản mới AccountV2).
 */
export default function MfaCard() {
  const { factors, enrolling, code, setCodeDigits, msg, busy, on, start, confirm, cancelEnroll, disable } = useMfa();
  return (
    <div className="card mt-4 p-6" data-testid="mfa-card">
      <div className="mb-2 flex items-center gap-2">
        {on ? <ShieldCheck size={19} style={{ color: "var(--s-green, #14855C)" }} /> : <ShieldOff size={19} style={{ color: "var(--text3)" }} />}
        <h2 className="font-serif text-lg font-medium">Xác thực 2 lớp</h2>
        {factors && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={on ? { background: "var(--s-greenS, #E4F4EC)", color: "var(--s-green, #14855C)" } : { background: "var(--surface2)", color: "var(--text3)" }}>
            {on ? "Đang bật" : "Chưa bật"}
          </span>
        )}
      </div>
      <p className="mb-4 text-[13px]" style={{ color: "var(--text2)" }}>
        Ngoài mật khẩu, mỗi lần đăng nhập cần thêm mã 6 số từ app trên điện thoại (Google Authenticator, Microsoft
        Authenticator, 1Password…). Nên bật cho tài khoản chủ studio và kế toán — hai tài khoản thấy toàn bộ tiền và dữ liệu khách.
      </p>

      {enrolling ? (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <img src={enrolling.qr} alt="Mã QR xác thực 2 lớp" className="h-[180px] w-[180px] rounded-lg bg-white p-2" />
          <div>
            <p className="text-[13px]">1. Mở app xác thực → thêm tài khoản → quét mã QR.</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text3)" }}>
              Không quét được? Nhập khoá: <code className="break-all">{enrolling.secret}</code>
            </p>
            <p className="mt-3 text-[13px]">2. Nhập mã 6 số app đang hiện:</p>
            <div className="mt-2 flex gap-2">
              <input
                className="input w-40 text-center font-mono tracking-[.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCodeDigits(e.target.value)}
              />
              <button onClick={confirm} disabled={busy || code.length !== 6} className="btn-primary">Xác nhận</button>
              <button onClick={cancelEnroll} className="btn-ghost">Huỷ</button>
            </div>
          </div>
        </div>
      ) : on ? (
        <ul className="space-y-2">
          {factors!.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
              <span className="text-[13px]">{f.friendly_name || "App xác thực"} · bật từ {new Date(f.created_at).toLocaleDateString("vi-VN")}</span>
              <button onClick={() => disable(f)} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs" style={{ color: "var(--s-red, #C13C3C)" }}>Tắt</button>
            </li>
          ))}
        </ul>
      ) : (
        <button onClick={start} disabled={busy || factors === null} className="btn-primary">
          <ShieldCheck size={15} /> {busy ? "Đang chuẩn bị…" : "Bật xác thực 2 lớp"}
        </button>
      )}

      {msg && (
        <p className="mt-3 text-[12.5px] font-semibold" style={{ color: msg.tone === "ok" ? "var(--s-green, #14855C)" : "var(--s-red, #C13C3C)" }}>{msg.text}</p>
      )}
    </div>
  );
}
