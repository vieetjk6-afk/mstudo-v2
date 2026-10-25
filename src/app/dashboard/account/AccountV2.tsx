"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowUpRight, Check, CircleCheck, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, Monitor,
  Palette, ShieldCheck, ShieldOff, Smartphone, UserRound, type LucideIcon,
} from "lucide-react";
import LogoUpload from "@/components/LogoUpload";
import { Avatar, Badge, Callout, Card, Field, InfoList, Progress, Section, Stack, btn, inputCls, type Tone } from "@/components/v2/kit";
import { fmtDate } from "@/lib/date";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import { useAccount, type AccountProps, type AccountState, type Flash } from "./useAccount";
import { useMfa, type Factor, type MfaState } from "./useMfa";

/* ═══════════════════════════════════════════════════════════════════════════
   TÀI KHOẢN & BẢO MẬT — giao diện mới. Cùng logic với AccountPanel + MfaCard
   (bản cũ, ./useAccount và ./useMfa); khác ở cách sắp xếp:
     • Cột trái (máy tính, dính khi cuộn): thẻ hồ sơ — tên, email, gói, hạn,
       cách đăng nhập — và thẻ "Mức bảo vệ" cho biết ngay còn thiếu gì
       (mật khẩu, xác thực 2 lớp), bấm là nhảy tới đúng khối.
     • Cột phải: các khối Thông tin · Thương hiệu studio · Mật khẩu ·
       Xác thực 2 lớp · Thiết bị. Form đổi email / mật khẩu chỉ mở khi bấm.
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVIDER_LABEL: Record<string, string> = { email: "Email & mật khẩu", google: "Google" };
const CYCLE_LABEL: Record<string, string> = { month: "Theo tháng", monthly: "Theo tháng", year: "Theo năm", yearly: "Theo năm", trial: "Dùng thử" };

export default function AccountV2(props: AccountProps & { mfaSeed?: { factors: Factor[] } }) {
  const a = useAccount(props);
  const m = useMfa(props.mfaSeed);

  return (
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[84px]">
        <ProfileCard p={props} a={a} />
        <ProtectionCard hasPassword={a.hasPassword} m={m} />
      </aside>

      <Stack>
        <InfoSection p={props} a={a} />
        {a.canBrand ? <BrandSection p={props} a={a} /> : null}
        <PasswordSection p={props} a={a} />
        <MfaSection m={m} />
        <DeviceSection a={a} />
      </Stack>
    </div>
  );
}

/* ── Cột trái ─────────────────────────────────────────────────────────── */

function ProfileCard({ p, a }: { p: AccountProps; a: AccountState }) {
  const plan = p.plan as Plan;
  const planName = PLAN_LABEL[plan] ?? p.plan;
  const paid = p.plan !== "free";
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-14" style={{ background: "linear-gradient(120deg, var(--acS), color-mix(in srgb, var(--ac) 22%, var(--sf)))" }} />
      <div className="-mt-8 px-5 pb-5">
        <span className="inline-flex rounded-full" style={{ boxShadow: "0 0 0 4px var(--sf)", background: "var(--sf)" }}>
          <Avatar name={a.name || p.email} size={60} />
        </span>
        <p className="mt-2.5 truncate text-[17px] font-semibold">{a.name || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên</span>}</p>
        <p className="truncate text-[13px]" style={{ color: "var(--tx3)" }}>{p.email}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone={paid ? "brand" : "gray"}>Gói {planName}</Badge>
          {p.role === "admin" ? <Badge tone="violet">Quản trị viên</Badge> : null}
        </div>
        <div className="mt-3">
          <InfoList
            items={[
              ...(p.planCycle && paid ? [{ label: "Chu kỳ", value: CYCLE_LABEL[p.planCycle] ?? p.planCycle }] : []),
              ...(p.planExpiresAt ? [{ label: "Hết hạn", value: fmtDate(p.planExpiresAt) }] : []),
              { label: "Tham gia", value: fmtDate(p.createdAt) },
              {
                label: "Đăng nhập bằng",
                value: p.providers.length ? p.providers.map((x) => PROVIDER_LABEL[x] ?? x).join(", ") : "—",
              },
            ]}
          />
        </div>
        <Link href="/dashboard/upgrade" className={btn("secondary", "md", "mt-3 w-full")}>
          Gói phần mềm <ArrowUpRight size={15} />
        </Link>
      </div>
    </Card>
  );
}

function ProtectionCard({ hasPassword, m }: { hasPassword: boolean; m: MfaState }) {
  const loading = m.factors === null;
  const checks: { label: string; ok: boolean; okText: string; badText: string; href: string }[] = [
    { label: "Mật khẩu", ok: hasPassword, okText: "Đã đặt", badText: "Chưa có", href: "#mat-khau" },
    { label: "Xác thực 2 lớp", ok: m.on, okText: "Đang bật", badText: loading ? "Đang kiểm tra…" : "Chưa bật", href: "#xac-thuc" },
  ];
  const score = checks.filter((c) => c.ok).length;
  const tone: Tone = score === checks.length ? "green" : score === 0 ? "red" : "amber";
  const verdict = score === checks.length ? "Tài khoản được bảo vệ tốt" : score === 0 ? "Tài khoản đang dễ bị lộ" : "Nên bật thêm xác thực 2 lớp";
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="v2-section-title">Mức bảo vệ</p>
        <span className="text-[12.5px] font-semibold" style={{ color: `var(--${tone === "green" ? "gn" : tone === "red" ? "rd" : "am"})` }}>
          {score}/{checks.length}
        </span>
      </div>
      <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>{loading ? "Đang kiểm tra…" : verdict}</p>
      <div className="mt-3">
        <Progress value={(score / checks.length) * 100} tone={loading ? "gray" : tone} />
      </div>
      <div className="mt-3 flex flex-col">
        {checks.map((c) => (
          <a key={c.label} href={c.href} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 transition-colors hover:bg-[var(--sf2)]">
            {c.ok ? (
              <CircleCheck size={17} style={{ color: "var(--gn)", flex: "none" }} />
            ) : (
              <AlertCircle size={17} style={{ color: loading && c.label !== "Mật khẩu" ? "var(--tx3)" : "var(--am)", flex: "none" }} />
            )}
            <span className="min-w-0 flex-1 text-[13.5px] font-medium">{c.label}</span>
            <span className="text-[12.5px]" style={{ color: c.ok ? "var(--gn)" : "var(--tx3)" }}>{c.ok ? c.okText : c.badText}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}

/* ── Cột phải ─────────────────────────────────────────────────────────── */

/** Dòng báo kết quả lưu (xanh = được, đỏ = lỗi). */
function FlashNote({ msg }: { msg: Flash }) {
  if (!msg) return null;
  return (
    <Callout tone={msg.ok ? "green" : "red"} icon={msg.ok ? Check : AlertCircle}>
      {msg.text}
    </Callout>
  );
}

function InfoSection({ p, a }: { p: AccountProps; a: AccountState }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const nameDirty = a.name.trim() !== "" && a.name.trim() !== (p.fullName ?? "").trim();
  return (
    <Section id="thong-tin" icon={UserRound} title="Thông tin cá nhân" desc="Tên và email bạn dùng để đăng nhập mstudo.">
      <div className="flex flex-col gap-5">
        <Field label="Tên hiển thị" htmlFor="acc-name">
          <div className="flex gap-2">
            <input
              id="acc-name"
              className={`${inputCls} min-w-0 flex-1`}
              placeholder="Họ và tên"
              value={a.name}
              onChange={(e) => a.setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && a.saveName()}
            />
            <button type="button" onClick={() => void a.saveName()} disabled={a.nameSaving || !nameDirty} className={btn(nameDirty ? "primary" : "secondary")}>
              {a.nameSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Lưu
            </button>
          </div>
        </Field>
        <FlashNote msg={a.nameMsg} />

        <div className="flex flex-col gap-2">
          <p className="v2-label">Email đăng nhập</p>
          <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-3.5 py-2.5" style={{ background: "var(--sf2)" }}>
            <Mail size={16} style={{ color: "var(--tx3)", flex: "none" }} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p.email}</span>
            {!emailOpen ? (
              <button type="button" onClick={() => setEmailOpen(true)} className={btn("ghost", "sm")}>
                Đổi email
              </button>
            ) : null}
          </div>
          {emailOpen ? (
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  className={`${inputCls} min-w-0 flex-1`}
                  placeholder="Email mới"
                  aria-label="Email mới"
                  value={a.newEmail}
                  autoFocus
                  onChange={(e) => a.setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && a.changeEmail()}
                />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" onClick={() => { setEmailOpen(false); a.setNewEmail(""); }} className={btn("ghost")}>
                    Huỷ
                  </button>
                  <button type="button" onClick={() => void a.changeEmail()} disabled={a.emailSaving || !a.newEmail.trim()} className={btn("primary")}>
                    {a.emailSaving ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Gửi xác nhận
                  </button>
                </div>
              </div>
              <p className="v2-field-hint">Bạn sẽ nhận email xác nhận ở địa chỉ mới. Bấm link trong email để hoàn tất.</p>
            </div>
          ) : null}
          <FlashNote msg={a.emailMsg} />
        </div>
      </div>
    </Section>
  );
}

function BrandSection({ p, a }: { p: AccountProps; a: AccountState }) {
  const dirty = a.brandName.trim() !== (p.studioBrandName ?? "").trim();
  return (
    <Section
      icon={Palette}
      title="Thương hiệu studio"
      desc="Logo và tên hiện cho khách trên trang chọn ảnh, giao ảnh, hợp đồng, báo giá — thay cho thương hiệu mstudo."
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Tên thương hiệu hiện cho khách" hint={`Để trống thì dùng tên tài khoản (${p.fullName || "chưa đặt"}).`} htmlFor="acc-brand">
            <div className="flex gap-2">
              <input
                id="acc-brand"
                className={`${inputCls} min-w-0 flex-1`}
                value={a.brandName}
                onChange={(e) => a.setBrandName(e.target.value)}
                placeholder={p.fullName ?? "Tên studio"}
              />
              <button type="button" onClick={() => void a.saveBrand()} disabled={a.brandSaving} className={btn(dirty ? "primary" : "secondary")}>
                {a.brandSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Lưu
              </button>
            </div>
          </Field>
        </div>
        <div className="max-w-[460px]">
          <LogoUpload
            ownerId={p.userId}
            value={a.brandLogo}
            onChange={(url) => { a.setBrandLogo(url); a.saveBrand(url); }}
            label="Logo studio"
          />
        </div>
        <FlashNote msg={a.brandMsg} />
      </div>
    </Section>
  );
}

const STRENGTH: Record<"weak" | "fair" | "strong", { label: string; tone: Tone; value: number }> = {
  weak: { label: "Yếu", tone: "red", value: 33 },
  fair: { label: "Trung bình", tone: "amber", value: 66 },
  strong: { label: "Mạnh", tone: "green", value: 100 },
};

function PasswordInput({
  id, value, onChange, show, onToggle, placeholder, autoComplete, onEnter,
}: {
  id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
  placeholder: string; autoComplete: string; onEnter?: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        className={inputCls}
        style={{ paddingRight: 42 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px]"
        style={{ color: "var(--tx3)" }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PasswordSection({ p, a }: { p: AccountProps; a: AccountState }) {
  const strength = a.pwStrength ? STRENGTH[a.pwStrength] : null;
  const mismatch = !!a.confirmPw && a.confirmPw !== a.newPw;
  return (
    <Section
      id="mat-khau"
      icon={KeyRound}
      title={a.hasPassword ? "Mật khẩu" : "Tạo mật khẩu"}
      desc={a.hasPassword ? "Đăng nhập bằng email + mật khẩu đang hoạt động." : "Tài khoản chưa có mật khẩu. Tạo mật khẩu để đăng nhập không cần Google."}
    >
      {!a.showPwForm ? (
        <div className="flex flex-col gap-3">
          {a.hasPassword ? (
            <div className="flex items-center gap-3 rounded-[12px] py-2 pl-3.5 pr-2" style={{ background: "var(--sf2)" }}>
              <span className="font-mono text-[15px] tracking-[3px]" style={{ color: "var(--tx2)" }}>••••••••</span>
              <span className="hidden sm:inline-flex"><Badge tone="green" dot>Đang dùng</Badge></span>
              <button type="button" onClick={() => a.setShowPwForm(true)} className={btn("secondary", "sm", "ml-auto")}>
                <KeyRound size={15} /> Đổi mật khẩu
              </button>
            </div>
          ) : (
            <Callout tone="amber" icon={AlertCircle} title="Chưa có mật khẩu">
              Bạn đang đăng nhập bằng {p.providers.filter((x) => x !== "email").map((x) => PROVIDER_LABEL[x] ?? x).join(", ") || "tài khoản liên kết"}. Tạo mật khẩu để vẫn vào được khi không dùng cách đó.
              <button type="button" onClick={() => a.setShowPwForm(true)} className={btn("secondary", "sm", "mt-2.5 flex")}>
                <KeyRound size={15} /> Tạo mật khẩu
              </button>
            </Callout>
          )}
          <FlashNote msg={a.pwMsg} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {a.hasPassword ? (
            <Field label="Mật khẩu hiện tại" htmlFor="pw-current">
              <PasswordInput
                id="pw-current"
                value={a.currentPw}
                onChange={a.setCurrentPw}
                show={a.showCurrent}
                onToggle={() => a.setShowCurrent((v) => !v)}
                placeholder="Mật khẩu hiện tại"
                autoComplete="current-password"
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Field label={a.hasPassword ? "Mật khẩu mới" : "Mật khẩu"} htmlFor="pw-new">
                <PasswordInput
                  id="pw-new"
                  value={a.newPw}
                  onChange={a.setNewPw}
                  show={a.showNew}
                  onToggle={() => a.setShowNew((v) => !v)}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                />
              </Field>
              {strength ? (
                <div className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1"><Progress value={strength.value} tone={strength.tone} /></div>
                  <span className="text-[12px] font-semibold" style={{ color: `var(--${strength.tone === "red" ? "rd" : strength.tone === "amber" ? "am" : "gn"})` }}>
                    {strength.label}
                  </span>
                </div>
              ) : null}
            </div>
            <Field label="Nhập lại mật khẩu" htmlFor="pw-confirm" error={mismatch ? "Mật khẩu không khớp." : undefined}>
              <input
                id="pw-confirm"
                type="password"
                className={inputCls}
                placeholder="Nhập lại mật khẩu"
                value={a.confirmPw}
                onChange={(e) => a.setConfirmPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && a.savePassword()}
                autoComplete="new-password"
                style={mismatch ? { borderColor: "var(--rd)" } : undefined}
              />
            </Field>
          </div>
          <FlashNote msg={a.pwMsg} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={a.cancelPassword} className={btn("ghost")}>
              Huỷ
            </button>
            <button type="button" onClick={() => void a.savePassword()} disabled={a.pwSaving || !a.newPw || !a.confirmPw} className={btn("primary")}>
              {a.pwSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {a.hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function MfaSection({ m }: { m: MfaState }) {
  return (
    <Section
      id="xac-thuc"
      icon={m.on ? ShieldCheck : ShieldOff}
      title="Xác thực 2 lớp"
      desc="Thêm mã 6 số từ app mỗi lần đăng nhập."
      actions={m.factors ? (m.on ? <Badge tone="green" dot>Đang bật</Badge> : <Badge tone="amber" dot>Chưa bật</Badge>) : null}
    >
      <div className="flex flex-col gap-4">
        {m.enrolling ? (
          <div className="grid items-start gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <img
              src={m.enrolling.qr}
              alt="Mã QR xác thực 2 lớp"
              className="mx-auto h-[172px] w-[172px] rounded-[14px] p-2"
              style={{ background: "#fff", border: "1px solid var(--bd)" }}
            />
            <ol className="flex min-w-0 flex-col gap-4">
              <Step n={1} title="Quét mã QR bằng app xác thực">
                Mở app → thêm tài khoản → quét mã bên cạnh.
                <span className="mt-1 block text-[12px]" style={{ color: "var(--tx3)" }}>
                  Không quét được? Nhập khoá <code className="break-all rounded px-1 py-0.5 font-mono" style={{ background: "var(--sf2)", color: "var(--tx)" }}>{m.enrolling.secret}</code>
                </span>
              </Step>
              <Step n={2} title="Nhập mã 6 số app đang hiện">
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className={`${inputCls} w-[150px] text-center font-mono tracking-[.3em]`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Mã 6 số"
                    placeholder="••••••"
                    value={m.code}
                    onChange={(e) => m.setCodeDigits(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && m.code.length === 6 && m.confirm()}
                  />
                  <button type="button" onClick={() => void m.confirm()} disabled={m.busy || m.code.length !== 6} className={btn("primary")}>
                    <Check size={15} /> Xác nhận
                  </button>
                  <button type="button" onClick={() => void m.cancelEnroll()} className={btn("ghost")}>
                    Huỷ
                  </button>
                </div>
              </Step>
            </ol>
          </div>
        ) : m.on ? (
          <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd2)" }}>
            {m.factors!.map((f) => (
              <div key={f.id} className="v2-row">
                <span className="v2-section-icon" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                  <Smartphone size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title">{f.friendly_name || "App xác thực"}</p>
                  <p className="v2-row-sub">Bật từ {new Date(f.created_at).toLocaleDateString("vi-VN")}</p>
                </div>
                <button type="button" onClick={() => void m.disable(f)} disabled={m.busy} className={btn("danger", "sm")}>
                  Tắt
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
              Dùng Google Authenticator, Microsoft Authenticator, 1Password… Nên bật cho tài khoản chủ studio và kế toán — hai tài khoản thấy toàn bộ tiền và dữ liệu khách.
            </p>
            <button type="button" onClick={() => void m.start()} disabled={m.busy || m.factors === null} className={btn("primary", "md", "flex-none")}>
              <ShieldCheck size={16} /> {m.busy ? "Đang chuẩn bị…" : "Bật xác thực 2 lớp"}
            </button>
          </div>
        )}
        {m.msg ? (
          <Callout tone={m.msg.tone === "ok" ? "green" : "red"} icon={m.msg.tone === "ok" ? Check : AlertCircle}>
            {m.msg.text}
          </Callout>
        ) : null}
      </div>
    </Section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: "var(--acS)", color: "var(--ac)" }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[13.5px]">
        <p className="font-semibold">{title}</p>
        <div style={{ color: "var(--tx2)" }}>{children}</div>
      </div>
    </li>
  );
}

/** "Chrome · Windows" — đoán thô từ user-agent, chỉ để người dùng nhận ra thiết bị. */
function deviceLabel(ua: string): { label: string; mobile: boolean } {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Trình duyệt";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Mobi|Android|iPhone|iPad/.test(ua) };
}

function DeviceSection({ a }: { a: AccountState }) {
  // Đọc user-agent SAU khi gắn vào trang — đọc lúc render là lệch HTML máy chủ.
  const [dev, setDev] = useState<{ label: string; mobile: boolean } | null>(null);
  useEffect(() => setDev(deviceLabel(navigator.userAgent)), []);
  const Icon: LucideIcon = dev?.mobile ? Smartphone : Monitor;
  return (
    <Section id="thiet-bi" icon={Monitor} title="Thiết bị & phiên đăng nhập" desc="Đăng xuất thì lần sau cần đăng nhập lại." flush>
      <div className="v2-row">
        <span className="v2-section-icon" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="v2-row-title">Thiết bị này</p>
          <p className="v2-row-sub">{dev ? `${dev.label} · ` : ""}đang đăng nhập</p>
        </div>
        <button type="button" onClick={() => void a.signOut()} disabled={a.signingOut} className={btn("danger", "sm")}>
          {a.signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Đăng xuất
        </button>
      </div>
    </Section>
  );
}
