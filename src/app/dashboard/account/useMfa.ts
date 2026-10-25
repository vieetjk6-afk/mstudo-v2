"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Bật / tắt xác thực 2 lớp (TOTP) bằng Supabase Auth MFA — logic dùng chung
 * của MfaCard (bản cũ) và khối "Xác thực 2 lớp" của AccountV2 (bản mới).
 *
 * Bật: enroll → quét mã QR bằng app xác thực → nhập mã để xác minh. Chỉ khi xác
 * minh xong yếu tố mới có hiệu lực — enroll dở dang bị gỡ ngay để lần sau bắt
 * đầu lại sạch sẽ. Tắt: Supabase đòi phiên aal2, tức phải vừa nhập mã.
 */
export type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };

async function logEvent(event: "enroll" | "unenroll") {
  await fetch("/api/account/mfa-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

/**
 * `seed`: CHỈ cho màn xem trước (/uipreview) — có thì dùng danh sách yếu tố
 * này và không hỏi Supabase.
 */
export function useMfa(seed?: { factors: Factor[] }) {
  const [supabase] = useState(() => createClient());
  const [factors, setFactors] = useState<Factor[] | null>(seed?.factors ?? null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified"));
  }
  useEffect(() => {
    if (seed) return;
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

  /** Chỉ giữ chữ số, tối đa 6 ký tự — ô nhập mã từ app. */
  const setCodeDigits = (v: string) => setCode(v.replace(/\D/g, "").slice(0, 6));

  const on = (factors?.length ?? 0) > 0;
  return { factors, enrolling, code, setCodeDigits, msg, busy, on, start, confirm, cancelEnroll, disable };
}

export type MfaState = ReturnType<typeof useMfa>;
