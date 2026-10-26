"use client";

import { CalendarPlus, Copy, Check, IdCard, UserPlus } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import { CREW_PROFILE_FIELDS as FIELDS, useCalendarSync, useProfileEditor, useCrewRegister } from "./useCrewPortal";

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

// FIELDS (các mục hồ sơ studio cần) và thao tác sửa hồ sơ / đăng ký / bật đồng
// bộ lịch nằm ở ./useCrewPortal — dùng chung với giao diện mới.

/** Hồ sơ của thợ ở từng studio — studio nhập gì thì hiện thế, trống thì thợ tự điền. */
export function CrewProfileCard({ profiles, phone, session, onSaved }: { profiles: CrewProfile[]; phone: string; session: string | null; onSaved: () => void }) {
  const { openId, setOpenId, draft, setDraft, saving, open, save } = useProfileEditor(phone, session, onSaved);

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
  const { draft, setDraft, captcha, setCaptcha, state, submit } = useCrewRegister(phone, crewToken);

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
export function CrewCalendarSync({ phone, session, token, onToken }: { phone: string; session: string | null; token: string | null; onToken: (t: string) => void }) {
  const { busy, copied, url, enable, copy } = useCalendarSync(phone, session, token, onToken);

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
              onClick={copy}
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
