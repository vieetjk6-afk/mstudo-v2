"use client";

import { useState } from "react";
import { CalendarPlus, Copy, Check, IdCard, UserPlus } from "lucide-react";
import Turnstile from "@/components/Turnstile";

export type CrewProfile = {
  id: string;
  owner_id: string;
  studio_name: string;
  name: string | null;
  email: string | null;
  equipment: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account: string | null;
  skills: string | null;
  status: string | null;
  self_filled_at: string | null;
};

/**
 * Hồ sơ thợ gọn đúng những gì studio cần để xếp việc và trả lương. SĐT không
 * nằm trong danh sách này vì nó là danh tính của thợ — hiện ra để đối chiếu chứ
 * không sửa được.
 */
const FIELDS: { key: keyof CrewProfile; label: string; type?: string }[] = [
  { key: "name", label: "Họ tên (trùng tên trên tài khoản ngân hàng)" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Địa chỉ" },
  { key: "bank_name", label: "Tên ngân hàng" },
  { key: "bank_account", label: "Số tài khoản" },
  { key: "skills", label: "Kỹ năng (chụp, quay, dựng…)" },
  { key: "equipment", label: "Thiết bị (body, lens, gimbal…)" },
];

/** Hồ sơ của thợ ở từng studio — studio nhập gì thì hiện thế, trống thì thợ tự điền. */
export function CrewProfileCard({ profiles, phone, onSaved }: { profiles: CrewProfile[]; phone: string; onSaved: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function open(p: CrewProfile) {
    setOpenId(p.id);
    const d: Record<string, string> = {};
    for (const f of FIELDS) d[f.key as string] = (p[f.key] as string | null) ?? "";
    setDraft(d);
  }

  async function save(p: CrewProfile) {
    setSaving(true);
    const res = await fetch("/api/crew/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", phone, studioId: p.owner_id, profile: draft }),
    });
    setSaving(false);
    if (res.ok) { setOpenId(null); onSaved(); }
  }

  if (profiles.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
        <IdCard size={16} style={{ color: "var(--gold)" }} /> Thông tin của tôi
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
        Studio nhập sẵn phần nào thì hiện phần đó. Chỗ nào còn trống bạn tự điền giúp.
      </p>

      <div className="space-y-3">
        {profiles.map((p) => {
          const filled = FIELDS.filter((f) => (p[f.key] as string | null)?.trim());
          const missing = FIELDS.length - filled.length;
          return (
            <div key={p.id} className="rounded-xl p-3" style={{ background: "var(--surface2)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.studio_name}</p>
                  <p className="text-[11px]" style={{ color: p.status === "pending" ? "var(--s-amber)" : "var(--text3)" }}>
                    {p.status === "pending" ? "Đang chờ studio duyệt" : missing > 0 ? `Còn ${missing} mục chưa điền` : "Đã đủ thông tin"}
                  </p>
                </div>
                <button onClick={() => (openId === p.id ? setOpenId(null) : open(p))} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                  {openId === p.id ? "Đóng" : "Sửa"}
                </button>
              </div>

              {openId === p.id && (
                <div className="mt-3 space-y-2">
                  <input className="input" readOnly value={phone} aria-label="Số điện thoại" title="Số điện thoại là danh tính của bạn, không sửa được ở đây" />
                  {FIELDS.map((f) => (
                    <input
                      key={f.key as string}
                      className="input"
                      type={f.type ?? "text"}
                      placeholder={f.label}
                      aria-label={f.label}
                      value={draft[f.key as string] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key as string]: e.target.value }))}
                    />
                  ))}
                  <button onClick={() => save(p)} disabled={saving} className="btn-primary w-full">Lưu thông tin</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Xin vào sổ thợ của MỘT studio — chỉ hiện khi vào bằng link riêng của studio. */
export function CrewRegisterCard({ studioName, crewToken, phone }: { studioName: string; crewToken: string; phone: string }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "already">("idle");

  async function submit() {
    if (!phone.trim() || !captcha) return;
    setState("sending");
    const res = await fetch("/api/crew/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", phone, crewToken, captcha, profile: draft }),
    });
    const j = (await res.json().catch(() => ({}))) as { already?: boolean };
    setState(res.ok ? (j.already ? "already" : "done") : "idle");
  }

  if (state === "done" || state === "already") {
    return (
      <div className="card p-5 text-center">
        <Check size={20} className="mx-auto" style={{ color: "var(--s-green)" }} />
        <p className="mt-2 text-sm">
          {state === "already" ? `Bạn đã có trong sổ thợ của ${studioName}.` : `Đã gửi đăng ký tới ${studioName}. Chờ studio duyệt nhé.`}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
        <UserPlus size={16} style={{ color: "var(--gold)" }} /> Đăng ký làm thợ của {studioName}
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
        Điền thông tin để studio thêm bạn vào sổ thợ. Studio duyệt xong bạn sẽ nhận được lịch tại đây.
      </p>
      <div className="space-y-2">
        <input className="input" readOnly value={phone} aria-label="Số điện thoại" />
        {FIELDS.map((f) => (
          <input
            key={f.key as string}
            className="input"
            type={f.type ?? "text"}
            placeholder={f.label}
            aria-label={f.label}
            value={draft[f.key as string] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key as string]: e.target.value }))}
          />
        ))}
        <Turnstile onVerify={setCaptcha} onExpire={() => setCaptcha(null)} onError={() => setCaptcha(null)} />
        <button onClick={submit} disabled={state === "sending" || !captcha || !phone.trim()} className="btn-primary w-full">
          {state === "sending" ? "Đang gửi…" : "Gửi đăng ký"}
        </button>
      </div>
    </div>
  );
}

/**
 * Đồng bộ sang Google Lịch bằng feed .ics.
 *
 * Không dùng OAuth Google: thợ không có tài khoản trong hệ thống nên không có
 * chỗ gắn refresh token cho tử tế. Dán URL vào Google Calendar là xong, một
 * chiều app → lịch, không xin quyền gì của thợ.
 */
export function CrewCalendarSync({ phone, token, onToken }: { phone: string; token: string | null; onToken: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/crew-calendar/${token}` : "";

  async function enable() {
    setBusy(true);
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "calendar_token", phone }),
    });
    setBusy(false);
    const j = (await res.json().catch(() => ({}))) as { token?: string };
    if (j.token) onToken(j.token);
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
        <CalendarPlus size={16} style={{ color: "var(--gold)" }} /> Đồng bộ Google Lịch
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
        Lịch của bạn (kể cả ca công ty) sẽ tự hiện trong Google Lịch. Một chiều — Google Lịch không sửa ngược lại được.
      </p>

      {!token ? (
        <button onClick={enable} disabled={busy} className="btn-primary w-full">
          {busy ? "Đang tạo…" : "Bật đồng bộ"}
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <input className="input flex-1 text-[11px]" readOnly value={url} aria-label="Link lịch" onFocus={(e) => e.currentTarget.select()} />
            <button
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-ghost shrink-0"
              aria-label={copied ? "Đã sao chép" : "Sao chép"}
              title="Sao chép"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
            Google Lịch → <b>Lịch khác</b> → <b>Từ URL</b> → dán link trên. Giữ link riêng cho mình: ai có link là xem được lịch của bạn.
          </p>
        </>
      )}
    </div>
  );
}
