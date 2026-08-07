"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Lock, Shield, CreditCard, LogOut,
  Check, AlertCircle, Eye, EyeOff, Loader2, KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LogoUpload from "@/components/LogoUpload";

const PLAN_LABEL: Record<string, string> = {
  free: "Miễn phí",
  basic: "Basic",
  photographer: "Photographer",
  studio: "Studio",
};

const PLAN_COLOR: Record<string, string> = {
  free: "var(--text3)",
  basic: "var(--s-blue)",
  photographer: "var(--s-amber)",
  studio: "var(--s-green)",
};

type Props = {
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

export default function AccountPanel({
  userId,
  email,
  fullName,
  plan,
  planExpiresAt,
  planCycle,
  createdAt,
  providers,
  hasPassword: initialHasPassword,
  role,
  studioBrandName,
  studioLogo,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // ── Name ────────────────────────────────────────────────────────
  const [name, setName] = useState(fullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Email ────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Password ─────────────────────────────────────────────────────
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Studio brand (white-label) ────────────────────────────────────
  const canBrand = plan === "studio" || role === "admin";
  const [brandName, setBrandName] = useState(studioBrandName ?? "");
  const [brandLogo, setBrandLogo] = useState(studioLogo ?? "");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  function flash(set: (v: { ok: boolean; text: string } | null) => void, msg: { ok: boolean; text: string }) {
    set(msg);
    setTimeout(() => set(null), 4000);
  }

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

  // ── Sign out ──────────────────────────────────────────────────────
  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  const planExpiry = planExpiresAt ? new Date(planExpiresAt).toLocaleDateString("vi-VN") : null;
  const joinDate = new Date(createdAt).toLocaleDateString("vi-VN");
  const pwStrength = newPw.length === 0 ? null : newPw.length < 8 ? "weak" : newPw.length < 12 ? "fair" : "strong";

  return (
    <div className="page-in mx-auto max-w-xl space-y-5">
      <div className="mb-2">
        <h1 className="font-serif text-2xl font-medium">Tài khoản</h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text3)" }}>Quản lý thông tin đăng nhập và bảo mật</p>
      </div>

      {/* ── Account summary ──────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
            style={{ background: "var(--brandSoft)", color: "var(--brand)" }}
          >
            {(name || email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name || "Chưa đặt tên"}</p>
            <p className="truncate text-sm" style={{ color: "var(--text3)" }}>{email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: `color-mix(in srgb, ${PLAN_COLOR[plan] ?? "var(--text3)"} 15%, transparent)`, color: PLAN_COLOR[plan] ?? "var(--text3)" }}
              >
                {PLAN_LABEL[plan] ?? plan}
              </span>
              {planExpiry && (
                <span className="text-[11px]" style={{ color: "var(--text3)" }}>
                  {planCycle === "monthly" ? "Tháng" : "Năm"} · hết hạn {planExpiry}
                </span>
              )}
              <span className="text-[11px]" style={{ color: "var(--text3)" }}>Tham gia {joinDate}</span>
            </div>
          </div>
        </div>

        {/* Provider badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {providers.map((p) => (
            <span key={p} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              <Shield size={11} />
              {p === "email" ? "Email / Mật khẩu" : p === "google" ? "Google" : p}
            </span>
          ))}
        </div>
      </div>

      {/* ── Display name ─────────────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <User size={15} style={{ color: "var(--brand)" }} /> Tên hiển thị
        </h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Họ và tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
          />
          <button onClick={saveName} disabled={nameSaving || !name.trim()} className="btn-primary px-4 text-sm">
            {nameSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Lưu
          </button>
        </div>
        {nameMsg && <Feedback msg={nameMsg} />}
      </section>

      {/* ── Studio brand (white-label) — Studio plan only ──────────────── */}
      {canBrand && (
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Shield size={15} style={{ color: "var(--brand)" }} /> Thương hiệu studio
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
            Logo &amp; tên hiển thị cho khách trên trang chọn ảnh, giao ảnh, hợp đồng, báo giá &amp; favicon — thay cho thương hiệu mstudo.
          </p>
          <div className="mb-3">
            <LogoUpload
              ownerId={userId}
              value={brandLogo}
              onChange={(url) => { setBrandLogo(url); saveBrand(url); }}
              label="Logo studio"
            />
          </div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text2)" }}>Tên thương hiệu hiển thị cho khách</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={fullName ?? "Tên studio"}
            />
            <button onClick={() => saveBrand()} disabled={brandSaving} className="btn-primary px-4 text-sm">
              {brandSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Lưu
            </button>
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--text3)" }}>Để trống = dùng tên tài khoản ({fullName || "chưa đặt"}).</p>
          {brandMsg && <Feedback msg={brandMsg} />}
        </section>
      )}

      {/* ── Email ────────────────────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Mail size={15} style={{ color: "var(--brand)" }} /> Email đăng nhập
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
          Email hiện tại: <span className="font-medium" style={{ color: "var(--text2)" }}>{email}</span>
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="Email mới"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changeEmail()}
          />
          <button onClick={changeEmail} disabled={emailSaving || !newEmail.trim()} className="btn-primary px-4 text-sm">
            {emailSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Đổi
          </button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
          Sau khi đổi, bạn sẽ nhận email xác nhận tại địa chỉ mới. Bấm link trong email để hoàn tất.
        </p>
        {emailMsg && <Feedback msg={emailMsg} />}
      </section>

      {/* ── Password ─────────────────────────────────────────────────── */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Lock size={15} style={{ color: "var(--brand)" }} />
              {hasPassword ? "Mật khẩu" : "Tạo mật khẩu"}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text3)" }}>
              {hasPassword
                ? "Đăng nhập bằng email + mật khẩu đang hoạt động."
                : "Tài khoản chưa có mật khẩu. Tạo mật khẩu để đăng nhập không cần Google."}
            </p>
          </div>
          <button
            onClick={() => setShowPwForm((v) => !v)}
            className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
          >
            <KeyRound size={13} />
            {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
          </button>
        </div>

        {showPwForm && (
          <div className="mt-4 space-y-3">
            {hasPassword && (
              <div>
                <label className="label">Mật khẩu hiện tại</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    className="input pr-10"
                    placeholder="Mật khẩu hiện tại"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text3)" }}
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="label">{hasPassword ? "Mật khẩu mới" : "Mật khẩu"}</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text3)" }}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength indicator */}
              {pwStrength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1">
                    {["weak", "fair", "strong"].map((level, i) => {
                      const active = (pwStrength === "weak" && i === 0) || (pwStrength === "fair" && i <= 1) || (pwStrength === "strong");
                      return (
                        <div key={level} className="h-1 w-8 rounded-full transition-colors"
                          style={{ background: active ? (pwStrength === "weak" ? "var(--s-red)" : pwStrength === "fair" ? "var(--s-amber)" : "var(--s-green)") : "var(--surface2)" }} />
                      );
                    })}
                  </div>
                  <span className="text-[11px]" style={{ color: pwStrength === "weak" ? "var(--s-red)" : pwStrength === "fair" ? "var(--s-amber)" : "var(--s-green)" }}>
                    {pwStrength === "weak" ? "Yếu" : pwStrength === "fair" ? "Trung bình" : "Mạnh"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="label">Xác nhận mật khẩu</label>
              <input
                type="password"
                className="input"
                placeholder="Nhập lại mật khẩu"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePassword()}
                autoComplete="new-password"
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="mt-1 text-[11px]" style={{ color: "var(--s-red)" }}>Mật khẩu không khớp.</p>
              )}
            </div>

            {pwMsg && <Feedback msg={pwMsg} />}

            <div className="flex gap-2 pt-1">
              <button onClick={savePassword} disabled={pwSaving || !newPw || !confirmPw} className="btn-primary px-4 text-sm">
                {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
              </button>
              <button onClick={() => { setShowPwForm(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}
                className="btn-ghost px-4 text-sm">
                Huỷ
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      <section className="card p-5" style={{ borderColor: "rgba(224,116,111,.3)" }}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--s-red)" }}>
          <CreditCard size={15} /> Phiên đăng nhập
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Đăng xuất khỏi tài khoản</p>
            <p className="text-xs" style={{ color: "var(--text3)" }}>Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.</p>
          </div>
          <button onClick={signOut} disabled={signingOut} className="btn-danger shrink-0 px-4 py-2 text-sm">
            {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Đăng xuất
          </button>
        </div>
      </section>
    </div>
  );
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } }) {
  return (
    <div className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      style={{
        background: msg.ok ? "var(--s-greenS)" : "var(--s-redS)",
        color: msg.ok ? "var(--s-green)" : "var(--s-red)",
      }}
    >
      {msg.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
      {msg.text}
    </div>
  );
}
