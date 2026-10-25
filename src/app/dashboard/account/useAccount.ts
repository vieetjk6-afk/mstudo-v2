"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn "Tài khoản & bảo mật" — bản cũ (AccountPanel)
   và bản mới (AccountV2) chỉ khác nhau ở cách vẽ: tên hiển thị, thương hiệu
   studio, đổi email, đặt/đổi mật khẩu, đăng xuất.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AccountProps = {
  userId: string;
  email: string;
  fullName: string | null;
  plan: string;
  planExpiresAt: string | null;
  planCycle: string | null;
  createdAt: string;
  providers: string[];
  hasPassword: boolean;
  role: string;
  studioBrandName: string | null;
  studioLogo: string | null;
};

export type Flash = { ok: boolean; text: string } | null;

export function useAccount({
  userId,
  email,
  fullName,
  plan,
  hasPassword: initialHasPassword,
  role,
  studioBrandName,
  studioLogo,
}: Pick<AccountProps, "userId" | "email" | "fullName" | "plan" | "hasPassword" | "role" | "studioBrandName" | "studioLogo">) {
  const router = useRouter();
  const supabase = createClient();

  // ── Name ────────────────────────────────────────────────────────
  const [name, setName] = useState(fullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<Flash>(null);

  // ── Email ────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Flash>(null);

  // ── Password ─────────────────────────────────────────────────────
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<Flash>(null);

  // ── Studio brand (white-label) ────────────────────────────────────
  const canBrand = plan === "studio" || role === "admin";
  const [brandName, setBrandName] = useState(studioBrandName ?? "");
  const [brandLogo, setBrandLogo] = useState(studioLogo ?? "");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<Flash>(null);

  function flash(set: (v: Flash) => void, msg: { ok: boolean; text: string }) {
    set(msg);
    setTimeout(() => set(null), 4000);
  }

  async function saveBrand(nextLogo?: string) {
    setBrandSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ studio_brand_name: brandName.trim() || null, studio_logo_url: (nextLogo ?? brandLogo) || null })
      .eq("id", userId);
    setBrandSaving(false);
    flash(setBrandMsg, error ? { ok: false, text: "Lỗi: " + error.message } : { ok: true, text: "Đã lưu thương hiệu studio." });
    if (!error) router.refresh();
  }

  // ── Sign out ──────────────────────────────────────────────────────
  const [signingOut, setSigningOut] = useState(false);

  // ── Save display name ─────────────────────────────────────────────
  async function saveName() {
    if (!name.trim()) return;
    setNameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", (await supabase.auth.getUser()).data.user!.id);
    setNameSaving(false);
    flash(setNameMsg, error ? { ok: false, text: "Lỗi: " + error.message } : { ok: true, text: "Đã lưu tên hiển thị." });
    if (!error) router.refresh();
  }

  // ── Change / set email ────────────────────────────────────────────
  async function changeEmail() {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      flash(setEmailMsg, { ok: false, text: "Vui lòng nhập email hợp lệ." });
      return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailSaving(false);
    flash(
      setEmailMsg,
      error
        ? { ok: false, text: "Lỗi: " + error.message }
        : { ok: true, text: "Đã gửi link xác nhận đến email mới. Kiểm tra hộp thư và bấm xác nhận." }
    );
    if (!error) setNewEmail("");
  }

  // ── Change / set password ─────────────────────────────────────────
  async function savePassword() {
    if (newPw.length < 8) {
      flash(setPwMsg, { ok: false, text: "Mật khẩu phải có ít nhất 8 ký tự." });
      return;
    }
    if (newPw !== confirmPw) {
      flash(setPwMsg, { ok: false, text: "Mật khẩu xác nhận không khớp." });
      return;
    }
    setPwSaving(true);

    // If account has no password yet (OAuth-only), set password directly.
    // If already has password, verify current first via re-auth.
    if (hasPassword && currentPw) {
      // Re-sign-in to verify current password before allowing change
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      });
      if (signInErr) {
        setPwSaving(false);
        flash(setPwMsg, { ok: false, text: "Mật khẩu hiện tại không đúng." });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      flash(setPwMsg, { ok: false, text: "Lỗi: " + error.message });
    } else {
      flash(setPwMsg, { ok: true, text: hasPassword ? "Đã đổi mật khẩu thành công." : "Đã tạo mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng email + mật khẩu." });
      setHasPassword(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwForm(false);
    }
  }

  /** Đóng form mật khẩu và xoá mọi ô đã gõ (nút "Huỷ"). */
  function cancelPassword() {
    setShowPwForm(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwMsg(null);
  }

  // ── Sign out ──────────────────────────────────────────────────────
  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pwStrength: "weak" | "fair" | "strong" | null =
    newPw.length === 0 ? null : newPw.length < 8 ? "weak" : newPw.length < 12 ? "fair" : "strong";

  return {
    name, setName, nameSaving, nameMsg, saveName,
    newEmail, setNewEmail, emailSaving, emailMsg, changeEmail,
    hasPassword, showPwForm, setShowPwForm,
    currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
    showCurrent, setShowCurrent, showNew, setShowNew,
    pwSaving, pwMsg, savePassword, cancelPassword, pwStrength,
    canBrand, brandName, setBrandName, brandLogo, setBrandLogo, brandSaving, brandMsg, saveBrand,
    signingOut, signOut,
  };
}

export type AccountState = ReturnType<typeof useAccount>;
