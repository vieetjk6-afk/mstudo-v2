"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Lock, Shield, CreditCard, LogOut,
  Check, AlertCircle, Eye, EyeOff, Loader2, KeyRound, Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LogoUpload from "@/components/LogoUpload";
import { Panel } from "@/components/studio/ui";

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

  /* Bản thiết kế: hồ sơ là DANH SÁCH DÒNG chỉ đọc, bấm bút chì mới mở ô sửa —
     không phải bốn ô nhập bày sẵn như bản cũ. */
  const [openField, setOpenField] = useState<"name" | "email" | "brand" | null>(null);

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

  const providerLabel = providers.map((p) => (p === "email" ? "Email / mật khẩu" : p === "google" ? "Google" : p)).join(" · ");

  return (
    <div className="page-in grid max-w-[1000px] items-start gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ══ Cột trái — hồ sơ và thương hiệu ══════════════════════════════ */}
      <div className="flex flex-col gap-3.5">
        <Panel className="px-5 py-[18px]">
          <div className="flex items-center gap-3.5">
            <span
              className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full text-[17px] font-extrabold"
              style={{ background: "var(--acS)", color: "var(--ac)" }}
            >
              {(name || email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>{name || "Chưa đặt tên"}</p>
              <p className="mt-px text-[12.5px]" style={{ color: "var(--tx3)" }}>Tham gia mstudo từ {joinDate}</p>
            </div>
            <span
              className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-[4px] text-[11.5px] font-semibold"
              style={{ background: `color-mix(in srgb, ${PLAN_COLOR[plan] ?? "var(--tx3)"} 14%, transparent)`, color: PLAN_COLOR[plan] ?? "var(--tx3)" }}
            >
              {PLAN_LABEL[plan] ?? plan}
            </span>
          </div>

          <div className="mt-4">
            {/* Tên hiển thị */}
            <FieldRow
              icon={User}
              label="Tên hiển thị"
              value={name || "Chưa đặt"}
              open={openField === "name"}
              onToggle={() => setOpenField(openField === "name" ? null : "name")}
            >
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Họ và tên"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                />
                <SaveBtn busy={nameSaving} disabled={!name.trim()} onClick={saveName} />
              </div>
              {nameMsg && <Feedback msg={nameMsg} />}
            </FieldRow>

            {/* Email đăng nhập */}
            <FieldRow
              icon={Mail}
              label="Email đăng nhập"
              value={email}
              open={openField === "email"}
              onToggle={() => setOpenField(openField === "email" ? null : "email")}
            >
              <div className="flex gap-2">
                <input
                  type="email"
                  className="input flex-1"
                  placeholder="Email mới"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && changeEmail()}
                />
                <SaveBtn busy={emailSaving} disabled={!newEmail.trim()} onClick={changeEmail} label="Đổi" />
              </div>
              <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Sau khi đổi, bấm link xác nhận gửi tới địa chỉ mới thì mới có hiệu lực.
              </p>
              {emailMsg && <Feedback msg={emailMsg} />}
            </FieldRow>

            {/* Phương thức đăng nhập — chỉ đọc */}
            <FieldRow
              icon={Shield}
              label="Đăng nhập bằng"
              value={providerLabel || "—"}
              note={hasPassword ? "Có mật khẩu" : undefined}
            />
          </div>
        </Panel>

        {/* ── Thương hiệu studio (white-label) — chỉ gói Studio ─────────── */}
        {canBrand && (
          <Panel className="px-5 py-[18px]">
            <p className="text-[13.5px] font-bold">Thương hiệu studio</p>
            <p className="mt-1 text-[11.5px] leading-[1.55]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Logo &amp; tên hiển thị cho khách trên trang chọn ảnh, giao ảnh, hợp đồng, báo giá và favicon — thay cho thương hiệu mstudo.
            </p>
            <div className="my-3.5">
              <LogoUpload
                ownerId={userId}
                value={brandLogo}
                onChange={(url) => { setBrandLogo(url); saveBrand(url); }}
                label="Logo studio"
              />
            </div>
            <label className="label mb-1 block uppercase">Tên hiển thị cho khách</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={fullName ?? "Tên studio"}
              />
              <SaveBtn busy={brandSaving} onClick={() => saveBrand()} />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>Để trống = dùng tên tài khoản ({fullName || "chưa đặt"}).</p>
            {brandMsg && <Feedback msg={brandMsg} />}
          </Panel>
        )}
      </div>

      {/* ══ Cột phải — bảo mật và vùng nguy hiểm ═════════════════════════ */}
      <div className="flex flex-col gap-2.5">
        {/* Mật khẩu */}
        <Panel className="px-[17px] py-[15px]">
          <div className="flex items-center gap-3">
            <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
              <Lock size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">{hasPassword ? "Mật khẩu" : "Chưa có mật khẩu"}</p>
              <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                {hasPassword ? "Đăng nhập bằng email + mật khẩu đang hoạt động." : "Tạo mật khẩu để đăng nhập không cần Google."}
              </p>
            </div>
            <button
              onClick={() => setShowPwForm((v) => !v)}
              className="flex-none whitespace-nowrap rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold"
              style={{ border: "1px solid var(--bd)" }}
            >
              <KeyRound size={13} className="mr-1 inline" />
              {hasPassword ? "Đổi" : "Tạo"}
            </button>
          </div>

          {showPwForm && (
            <div className="mt-3.5 space-y-3 border-t pt-3.5" style={{ borderColor: "var(--bd2)" }}>
              {hasPassword && (
                <div>
                  <label className="label mb-1 block uppercase">Mật khẩu hiện tại</label>
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
                      style={{ color: "var(--tx3)" }}
                    >
                      {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="label mb-1 block uppercase">{hasPassword ? "Mật khẩu mới" : "Mật khẩu"}</label>
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
                    style={{ color: "var(--tx3)" }}
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Thanh đo độ mạnh — 3 vạch, màu theo mức */}
                {pwStrength && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex gap-1">
                      {["weak", "fair", "strong"].map((level, i) => {
                        const active = (pwStrength === "weak" && i === 0) || (pwStrength === "fair" && i <= 1) || (pwStrength === "strong");
                        return (
                          <div key={level} className="h-1 w-8 rounded-full"
                            style={{ background: active ? (pwStrength === "weak" ? "var(--rd)" : pwStrength === "fair" ? "var(--am)" : "var(--gn)") : "var(--bd2)" }} />
                        );
                      })}
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: pwStrength === "weak" ? "var(--rd)" : pwStrength === "fair" ? "var(--am)" : "var(--gn)" }}>
                      {pwStrength === "weak" ? "Yếu" : pwStrength === "fair" ? "Trung bình" : "Mạnh"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="label mb-1 block uppercase">Xác nhận mật khẩu</label>
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
                  <p className="mt-1 text-[11px]" style={{ color: "var(--rd)" }}>Mật khẩu không khớp.</p>
                )}
              </div>

              {pwMsg && <Feedback msg={pwMsg} />}

              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={savePassword}
                  disabled={pwSaving || !newPw || !confirmPw}
                  className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-50"
                  style={{ background: "var(--ac)", color: "#fff" }}
                >
                  {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
                </button>
                <button
                  onClick={() => { setShowPwForm(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}
                  className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)" }}
                >
                  Huỷ
                </button>
              </div>
            </div>
          )}
        </Panel>

        {/* Gói phần mềm */}
        <Panel className="flex items-center gap-3 px-[17px] py-[15px]">
          <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--blS)", color: "var(--bl)", lineHeight: 0 }}>
            <CreditCard size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold">Gói {PLAN_LABEL[plan] ?? plan}</p>
            <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {planExpiry ? `${planCycle === "monthly" ? "Trả tháng" : "Trả năm"} · hết hạn ${planExpiry}` : "Không giới hạn thời gian"}
            </p>
          </div>
          <a
            href="/dashboard/upgrade"
            className="flex-none whitespace-nowrap rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold"
            style={{ border: "1px solid var(--bd)" }}
          >
            Xem gói
          </a>
        </Panel>

        {/* Vùng nguy hiểm */}
        <Panel className="px-[17px] py-[15px]" >
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--rd)" }}>Vùng nguy hiểm</p>
          <p className="mb-3 mt-1 text-[12px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Đăng xuất sẽ kết thúc phiên trên thiết bị này. Dữ liệu studio không bị ảnh hưởng — bạn đăng nhập lại là thấy đủ.
          </p>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={{ background: "var(--rdS)", color: "var(--rd)" }}
          >
            {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Đăng xuất khỏi tài khoản
          </button>
        </Panel>
      </div>
    </div>
  );
}

/* ── Một dòng hồ sơ: nhãn viết hoa 11px/700 + giá trị 13.5px, bút chì mở ô sửa ── */
function FieldRow({
  icon: Icon, label, value, note, open, onToggle, children,
}: {
  icon: React.ElementType; label: string; value: string; note?: string;
  open?: boolean; onToggle?: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="border-t py-3" style={{ borderColor: "var(--bd2)" }}>
      <div className="flex items-center gap-3">
        <Icon size={18} style={{ flex: "none", color: "var(--tx3)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>{label}</p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold">{value}</p>
        </div>
        {note ? <span className="flex-none text-[11px] font-semibold" style={{ color: "var(--gn)" }}>{note}</span> : null}
        {onToggle ? (
          <button
            onClick={onToggle}
            aria-label={`Sửa ${label.toLowerCase()}`}
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px]"
            style={{ color: open ? "var(--ac)" : "var(--tx3)", background: open ? "var(--acS)" : "transparent" }}
          >
            <Pencil size={15} />
          </button>
        ) : null}
      </div>
      {open && children ? <div className="mt-2.5 pl-[30px]">{children}</div> : null}
    </div>
  );
}

/** Nút lưu cạnh ô nhập — cùng chiều cao ô nhập, bo 10px, màu nhấn. */
function SaveBtn({ busy, disabled, onClick, label = "Lưu" }: { busy: boolean; disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 text-[12.5px] font-semibold disabled:opacity-50"
      style={{ background: "var(--ac)", color: "#fff" }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      {label}
    </button>
  );
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } }) {
  return (
    <div className="mt-2.5 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold"
      style={{
        background: msg.ok ? "var(--gnS)" : "var(--rdS)",
        color: msg.ok ? "var(--gn)" : "var(--rd)",
      }}
    >
      {msg.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
      {msg.text}
    </div>
  );
}
