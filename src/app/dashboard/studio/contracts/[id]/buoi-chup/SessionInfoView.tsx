"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Copy, Link as LinkIcon, MapPin, Phone, Send, Share2, UserPlus } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import { useToast } from "@/components/studio/Toast";
import ZaloSendButton from "@/components/ZaloSendButton";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { CREW_ROLE_LABEL, type ContractCrew, type ContractIntake } from "@/lib/types";
import { CREW_SIDE_LABEL } from "@/lib/crew-show";
import {
  intakeSections, intakeMessage, sectionText, defaultKeysForSide,
  type IntakeSection, type IntakeSectionKey,
} from "@/lib/intake-text";

type CrewRow = Pick<ContractCrew, "id" | "name" | "phone" | "role" | "side" | "event_id">;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SessionInfoView({
  contract, formUrl, crew, studioName,
}: {
  contract: {
    id: string;
    title: string;
    clientName: string;
    eventDate: string | null;
    eventTime: string | null;
    location: string | null;
    intake: ContractIntake | null;
    submittedAt: string | null;
  };
  formUrl: string | null;
  crew: CrewRow[];
  studioName: string;
}) {
  const { toast, toastNode } = useToast();
  const sections = useMemo(() => intakeSections(contract.intake), [contract.intake]);
  const date = contract.eventDate ? fmtDate(contract.eventDate) : null;
  // Web Share chỉ có trên trình duyệt (chủ yếu điện thoại) — dò sau khi mount
  // để bản vẽ server và client khớp nhau.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy(text: string, what = "Đã chép") {
    toast((await copyText(text)) ? what : "Không chép được — hãy chọn chữ và chép tay");
  }
  async function share(text: string) {
    try {
      await navigator.share({ text });
    } catch {
      /* người dùng đóng bảng chia sẻ */
    }
  }

  return (
    <div className="page-in max-w-[860px]">
      <Link
        href={`/dashboard/studio/contracts/${contract.id}?tab=send`}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: "var(--tx2)" }}
      >
        <ArrowLeft size={15} /> Về hợp đồng
      </Link>

      <Panel className="mb-3.5 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-none rounded-[9px] p-1.5" style={{ background: "var(--tlS)", lineHeight: 0 }}>
            <ClipboardList size={18} style={{ color: "var(--tl)" }} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-bold" style={{ textWrap: "pretty" }}>Thông tin buổi chụp</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {contract.title}
              {contract.clientName ? ` · ${contract.clientName}` : ""}
              {date ? ` · ${date}` : ""}
              {contract.eventTime ? ` ${contract.eventTime.slice(0, 5)}` : ""}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>
              {contract.submittedAt ? `Khách điền lúc ${fmtDateTime(contract.submittedAt)}` : "Khách chưa điền form"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {formUrl && (
            <a href={formUrl} target="_blank" rel="noreferrer" className="act-btn">
              <LinkIcon size={14} /> Mở form
            </a>
          )}
          {sections.length > 0 && (
            <button
              type="button"
              className="act-btn"
              onClick={() => copy(intakeMessage({ sections, title: contract.title, date, studio: studioName }), "Đã chép toàn bộ thông tin")}
            >
              <Copy size={14} /> Chép tất cả
            </button>
          )}
          {sections.length > 0 && canShare && (
            <button type="button" className="act-btn" onClick={() => share(intakeMessage({ sections, title: contract.title, date, studio: studioName }))}>
              <Share2 size={14} /> Chia sẻ
            </button>
          )}
        </div>
      </Panel>

      {sections.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardList}
            title="Chưa có thông tin buổi chụp"
            hint="Gửi link form cho khách ở tab “Ký & thực hiện” của hợp đồng. Khách điền xong, thông tin hiện ở đây để gửi riêng cho từng thợ."
          />
        </Panel>
      ) : (
        <>
          <div className="mb-3.5 grid gap-2.5 sm:grid-cols-2">
            {sections.map((s) => (
              <SectionCard
                key={s.key}
                s={s}
                onCopy={() => copy(sectionText(s), `Đã chép: ${s.title}`)}
                onShare={canShare ? () => share(sectionText(s)) : undefined}
              />
            ))}
          </div>

          <Panel className="p-4">
            <p className="flex items-center gap-2 text-[14px] font-bold">
              <Send size={16} style={{ color: "var(--ac)" }} /> Gửi riêng cho thợ
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Chọn phần cần gửi cho từng người. Thợ đã gán nhà trai / nhà gái được chọn sẵn đúng phần nhà đó (kèm tiệc &amp; ghi chú).
            </p>

            <div className="mt-3 flex flex-col gap-2.5">
              {crew.length === 0 && (
                <p className="rounded-[10px] px-3 py-2.5 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                  Hợp đồng chưa có thợ. Thêm thợ ở tab “Nhân sự” của hợp đồng, hoặc gửi cho người khác bên dưới.
                </p>
              )}
              {crew.map((c) => (
                <SendRow
                  key={c.id}
                  sections={sections}
                  initialKeys={defaultKeysForSide(sections, c.side)}
                  name={c.name}
                  sub={[CREW_ROLE_LABEL[c.role] ?? c.role, c.side ? CREW_SIDE_LABEL[c.side] : null, c.phone].filter(Boolean).join(" · ")}
                  phone={c.phone}
                  buildMessage={(keys) => intakeMessage({ sections, keys, title: contract.title, date, to: c.name, studio: studioName })}
                  contractId={contract.id}
                  onCopy={(t) => copy(t, `Đã chép tin cho ${c.name}`)}
                  onShare={canShare ? share : undefined}
                />
              ))}
              <SendRow
                sections={sections}
                initialKeys={sections.map((s) => s.key)}
                name="Người khác"
                sub="Nhập SĐT hoặc chọn bạn Zalo"
                icon
                askPhone
                buildMessage={(keys) => intakeMessage({ sections, keys, title: contract.title, date, studio: studioName })}
                contractId={contract.id}
                onCopy={(t) => copy(t, "Đã chép tin")}
                onShare={canShare ? share : undefined}
              />
            </div>
          </Panel>
        </>
      )}
      {toastNode}
    </div>
  );
}

function SectionCard({ s, onCopy, onShare }: { s: IntakeSection; onCopy: () => void; onShare?: () => void }) {
  return (
    <Panel className="flex flex-col p-3.5">
      <p className="text-[13.5px] font-bold">{s.title}</p>
      <dl className="mt-1.5 flex-1 space-y-1 text-[13px]">
        {s.rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="flex-none" style={{ color: "var(--tx3)", minWidth: 72 }}>{r.label}</dt>
            <dd className="min-w-0 break-words" style={{ color: "var(--tx)", whiteSpace: "pre-wrap" }}>
              {r.tel ? (
                <a href={`tel:${r.value.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--ac)" }}>
                  <Phone size={12} /> {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {s.location && (
        <a
          href={s.location.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold"
          style={{ color: "var(--bl)" }}
        >
          <MapPin size={13} /> Xem vị trí / chỉ đường
        </a>
      )}
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={onCopy} className="act-btn flex-1">
          <Copy size={14} /> Chép
        </button>
        {onShare && (
          <button type="button" onClick={onShare} className="act-btn flex-1">
            <Share2 size={14} /> Chia sẻ
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Một người nhận: chọn phần cần gửi + gửi Zalo / chép / chia sẻ. */
function SendRow({
  sections, initialKeys, name, sub, phone, askPhone = false, icon = false, buildMessage, contractId, onCopy, onShare,
}: {
  sections: IntakeSection[];
  initialKeys: IntakeSectionKey[];
  name: string;
  sub: string;
  phone?: string | null;
  askPhone?: boolean;
  icon?: boolean;
  buildMessage: (keys: IntakeSectionKey[]) => string;
  contractId: string;
  onCopy: (text: string) => void;
  onShare?: (text: string) => void;
}) {
  const [keys, setKeys] = useState<IntakeSectionKey[]>(initialKeys);
  // Giữ thứ tự hiển thị của các phần, không theo thứ tự bấm.
  const picked = sections.map((s) => s.key).filter((k) => keys.includes(k));
  const message = buildMessage(picked);
  const toggle = (k: IntakeSectionKey) => setKeys((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <div className="rounded-[12px] p-3" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
      <div className="flex items-center gap-2">
        {icon && <UserPlus size={15} style={{ color: "var(--tx3)" }} />}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{name}</p>
          <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{sub}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Phần gửi cho ${name}`}>
        {sections.map((s) => {
          const on = keys.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{
                border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                background: on ? "var(--acS)" : "transparent",
                color: on ? "var(--ac)" : "var(--tx2)",
              }}
            >
              {on ? "✓ " : ""}
              {s.title.replace(/\s*\(.*\)$/, "")}
            </button>
          );
        })}
      </div>
      {picked.length === 0 ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>Chọn ít nhất một phần để gửi.</p>
      ) : (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <ZaloSendButton
            phone={phone}
            name={name}
            audience="crew"
            contractId={contractId}
            kind="intake_crew"
            askPhone={askPhone}
            message={message}
            className="act-btn"
          />
          <button type="button" onClick={() => onCopy(message)} className="act-btn">
            <Copy size={14} /> Chép tin
          </button>
          {onShare && (
            <button type="button" onClick={() => onShare(message)} className="act-btn">
              <Share2 size={14} /> Chia sẻ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
