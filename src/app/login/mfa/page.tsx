"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import Brand from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Bước 2 của đăng nhập khi tài khoản đã bật xác thực 2 lớp: nhập mã 6 số từ
 * app Google Authenticator / Microsoft Authenticator / 1Password…
 *
 * dashboard/layout.tsx và staff/layout.tsx chuyển về đây khi phiên mới ở aal1.
 * Qua được thì phiên lên aal2 và điều hướng lại chỗ cũ.
 */
function MfaForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/dashboard");
  const [supabase] = useState(() => createClient());
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal) return void window.location.replace("/login");
      if (aal.currentLevel === "aal2" || aal.nextLevel !== "aal2") return void window.location.replace(next);
      const { data } = await supabase.auth.mfa.listFactors();
      const f = data?.totp?.find((x) => x.status === "verified");
      if (!f) return void window.location.replace(next);
      setFactorId(f.id);
    })();
  }, [supabase, next]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") });
    setBusy(false);
    if (error) {
      setErr("Mã không đúng hoặc đã hết hạn. Mã đổi mỗi 30 giây — nhập mã đang hiện trên app.");
      setCode("");
      return;
    }
    // Tải lại hẳn trang đích để server đọc cookie phiên aal2 mới.
    window.location.replace(next);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={verify} className="card w-full max-w-sm p-7">
        <div className="mb-5 flex justify-center"><Brand /></div>
        <div className="mb-4 flex items-center gap-2.5">
          <ShieldCheck size={22} style={{ color: "var(--ac)" }} />
          <h1 className="text-[18px] font-bold">Xác thực 2 lớp</h1>
        </div>
        <p className="mb-4 text-[13px]" style={{ color: "var(--text2)" }}>
          Mở app xác thực trên điện thoại và nhập mã 6 số của mstudo.
        </p>
        <input
          className="input text-center font-mono text-[22px] tracking-[.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={7}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          disabled={!factorId}
        />
        {err && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--s-red, #C13C3C)" }}>{err}</p>}
        <button type="submit" disabled={busy || code.length !== 6 || !factorId} className="btn-primary mt-4 w-full justify-center">
          {busy ? "Đang kiểm tra…" : "Xác nhận"}
        </button>
        <button type="button" onClick={signOut} className="btn-ghost mt-2 w-full justify-center text-[12.5px]">
          Đăng xuất
        </button>
        <p className="mt-4 text-[11.5px]" style={{ color: "var(--text3)" }}>
          Mất điện thoại? Chủ studio (hoặc quản trị mstudo) gỡ xác thực 2 lớp cho tài khoản của bạn trong Supabase → Authentication → Users.
        </p>
      </form>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}
