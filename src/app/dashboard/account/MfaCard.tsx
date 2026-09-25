"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Bật / tắt xác thực 2 lớp (TOTP) bằng Supabase Auth MFA.
 *
 * Bật: enroll → quét mã QR bằng app xác thực → nhập mã để xác minh. Chỉ khi xác
 * minh xong yếu tố mới có hiệu lực — enroll dở dang bị gỡ ngay để lần sau bắt
 * đầu lại sạch sẽ. Tắt: Supabase đòi phiên aal2, tức phải vừa nhập mã.
 */
type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };

async function logEvent(event: "enroll" | "unenroll") {
  await fetch("/api/account/mfa-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

export default function MfaCard() {
  const [supabase] = useState(() => createClient());
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified"));
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true);
    setMsg(null);
    // Dọn yếu tố chưa xác minh còn sót từ lần bật dở trước (Supabase giới hạn số yếu tố).
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of (all?.all ?? []) as Factor[]) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `mstudo ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) return setMsg({ tone: "err", text: `Chưa bật được: ${error?.message ?? "lỗi không rõ"}. Kiểm tra MFA (TOTP) đã bật trong Supabase → Authentication.` });
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code });
    setBusy(false);
    if (error) return setMsg({ tone: "err", text: "Mã chưa đúng — nhập mã 6 số đang hiện trên app (đổi mỗi 30 giây)." });
    setEnrolling(null);
    setCode("");
    setMsg({ tone: "ok", text: "Đã bật xác thực 2 lớp. Lần đăng nhập sau sẽ hỏi mã từ app." });
    await logEvent("enroll");
    refresh();
  }

  async function cancelEnroll() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
    setCode("");
  }

  async function disable(f: Factor) {
    if (!window.confirm("Tắt xác thực 2 lớp? Tài khoản sẽ chỉ còn bảo vệ bằng mật khẩu.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    setBusy(false);
    if (error) {
      return setMsg({ tone: "err", text: /aal2|AAL2/i.test(error.message) ? "Cần đăng xuất rồi đăng nhập lại (có nhập mã) trước khi tắt." : `Chưa tắt được: ${error.message}` });
    }
    setMsg({ tone: "ok", text: "Đã tắt xác thực 2 lớp." });
    await logEvent("unenroll");
    refresh();
  }

  const on = (factors?.length ?? 0) > 0;
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
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
