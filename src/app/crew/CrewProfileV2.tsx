"use client";

import { CalendarPlus, Check, CheckCircle2, Copy, IdCard, Loader2, Pencil, UserPlus } from "lucide-react";
import { Avatar, Badge, Empty, Field, ListRow, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer } from "@/components/v2/kit-client";
import Turnstile from "@/components/Turnstile";
import type { CrewProfile } from "./CrewExtras";
import {
  CREW_PROFILE_FIELDS, profileMissing, useCalendarSync, useCrewRegister, useProfileEditor, type CrewPortalState,
} from "./useCrewPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "HỒ SƠ" của cổng thợ + thẻ ĐĂNG KÝ vào sổ thợ — giao diện mới. Cùng route
   /api/crew/profile (save, register) và /api/crew (calendar_token) như bản cũ,
   qua các hook chung ở ./useCrewPortal.
   ═══════════════════════════════════════════════════════════════════════════ */

function ProfileFields({
  phone, draft, setDraft,
}: {
  phone: string;
  draft: Record<string, string>;
  setDraft: (fn: (d: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Số điện thoại" hint="Là danh tính của bạn, không sửa được ở đây" className="sm:col-span-2">
        <input className={inputCls} readOnly value={phone} aria-label="Số điện thoại" />
      </Field>
      {CREW_PROFILE_FIELDS.map((f) => (
        <Field key={f.key as string} label={f.label} className={f.key === "bank_name" || f.key === "bank_account" ? undefined : "sm:col-span-2"}>
          <input
            className={inputCls}
            type={f.type ?? "text"}
            aria-label={f.label}
            value={draft[f.key as string] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key as string]: e.target.value }))}
          />
        </Field>
      ))}
    </div>
  );
}

export default function CrewProfileV2({ s }: { s: CrewPortalState }) {
  const editor = useProfileEditor(s.phone, s.session, () => s.load());
  const sync = useCalendarSync(s.phone, s.session, s.calToken, s.setCalToken);
  const editing: CrewProfile | null = s.profiles.find((p) => p.id === editor.openId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2 min-[900px]:items-start">
      <Section icon={IdCard} title="Thông tin của tôi" desc="Studio nhập sẵn phần nào thì hiện phần đó. Chỗ nào còn trống bạn tự điền giúp." flush>
        {s.profiles.length === 0 ? (
          <Empty compact icon={IdCard} title="Chưa có hồ sơ ở studio nào" hint="Khi studio thêm bạn vào sổ thợ, hồ sơ sẽ hiện ở đây." />
        ) : (
          <div>
            {s.profiles.map((p) => {
              const missing = profileMissing(p);
              const pending = p.status === "pending";
              return (
                <ListRow
                  key={p.id}
                  leading={<Avatar name={p.studio_name} size={38} />}
                  title={p.studio_name}
                  sub={pending ? "Đang chờ studio duyệt" : missing > 0 ? `Còn ${missing} mục chưa điền` : "Đã đủ thông tin"}
                  trailing={
                    <>
                      <span className="max-sm:hidden">
                        {pending ? <Badge tone="amber">Chờ duyệt</Badge> : missing > 0 ? <Badge tone="amber">Thiếu {missing}</Badge> : <Badge tone="green" icon={Check}>Đủ</Badge>}
                      </span>
                      <button type="button" onClick={() => editor.open(p)} className={btn("secondary", "sm")}>
                        <Pencil size={14} /> Sửa
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      <Section icon={CalendarPlus} title="Đồng bộ Google Lịch" desc="Lịch của bạn (kể cả ca công ty) tự hiện trong Google Lịch. Một chiều — Google Lịch không sửa ngược lại được.">
        {!s.calToken ? (
          <button type="button" onClick={sync.enable} disabled={sync.busy} className={btn("primary", "md", "w-full")}>
            {sync.busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
            {sync.busy ? "Đang tạo…" : "Bật đồng bộ"}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input className={`${inputCls} min-w-0 flex-1 text-[12px]`} readOnly value={sync.url} aria-label="Link lịch" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={sync.copy} className={iconBtn()} aria-label={sync.copied ? "Đã sao chép" : "Sao chép"} title="Sao chép">
                {sync.copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />}
              </button>
            </div>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]" style={{ color: "var(--tx2)" }}>
              <li>Mở Google Lịch → <b>Lịch khác</b> → <b>Từ URL</b>.</li>
              <li>Dán link trên rồi bấm <b>Thêm lịch</b>.</li>
            </ol>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Giữ link riêng cho mình: ai có link là xem được lịch của bạn.</p>
          </div>
        )}
      </Section>

      <Drawer
        open={!!editing}
        onClose={() => editor.setOpenId(null)}
        title="Thông tin của tôi"
        desc={editing ? `Hồ sơ ở ${editing.studio_name}` : undefined}
        width={520}
        footer={
          editing ? (
            <button type="button" onClick={() => editor.save(editing)} disabled={editor.saving} className={btn("primary", "md", "w-full")}>
              {editor.saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editor.saving ? "Đang lưu…" : "Lưu thông tin"}
            </button>
          ) : undefined
        }
      >
        <ProfileFields phone={s.phone} draft={editor.draft} setDraft={editor.setDraft} />
      </Drawer>
    </div>
  );
}

/** Xin vào sổ thợ của MỘT studio — chỉ hiện khi vào bằng link riêng của studio. */
export function CrewRegisterV2({ studioName, crewToken, phone }: { studioName: string; crewToken: string; phone: string }) {
  const r = useCrewRegister(phone, crewToken);

  if (r.state === "done" || r.state === "already") {
    return (
      <div className="v2-card">
        <Empty
          icon={CheckCircle2}
          title={r.state === "already" ? `Bạn đã có trong sổ thợ của ${studioName}` : `Đã gửi đăng ký tới ${studioName}`}
          hint={r.state === "already" ? "Tra lại số điện thoại để xem lịch và việc được giao." : "Chờ studio duyệt nhé. Duyệt xong bạn sẽ nhận được lịch tại đây."}
        />
      </div>
    );
  }

  return (
    <Section icon={UserPlus} title={`Đăng ký làm thợ của ${studioName}`} desc="Điền thông tin để studio thêm bạn vào sổ thợ. Studio duyệt xong bạn sẽ nhận được lịch tại đây.">
      <div className="flex flex-col gap-4">
        <ProfileFields phone={phone} draft={r.draft} setDraft={r.setDraft} />
        <Turnstile onVerify={r.setCaptcha} onExpire={() => r.setCaptcha(null)} onError={() => r.setCaptcha(null)} />
        <button type="button" onClick={r.submit} disabled={r.state === "sending" || !r.captcha || !phone.trim()} className={btn("primary", "lg", "w-full")}>
          {r.state === "sending" ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
          {r.state === "sending" ? "Đang gửi…" : "Gửi đăng ký"}
        </button>
      </div>
    </Section>
  );
}
