"use client";

import Link from "next/link";
import { ArrowLeft, Check, ClipboardList, Copy, ExternalLink, MapPin, Navigation, Phone, Send, Share2, UserPlus, Users } from "lucide-react";
import ZaloSendButton from "@/components/ZaloSendButton";
import { Avatar, Badge, Callout, Empty, Section, btn, iconBtn } from "@/components/v2/kit";
import { fmtDateTime } from "@/lib/date";
import { crewRoleLabel } from "@/lib/crew-roles";
import { CREW_SIDE_LABEL } from "@/lib/crew-show";
import { intakeMessage, sectionText, defaultKeysForSide, intakeDirections, type IntakeSection, type IntakeSectionKey } from "@/lib/intake-text";
import { useSendRow, useSessionInfo, type SessionInfoProps } from "./useSessionInfo";

/* ═══════════════════════════════════════════════════════════════════════════
   THÔNG TIN BUỔI CHỤP — giao diện mới. Cùng dữ liệu và thao tác với bản cũ
   (logic chung ở ./useSessionInfo); bố cục theo màn hợp đồng V2:
     • Thẻ đầu: tên màn · hợp đồng · trạng thái form, ba con số (ngày chụp,
       địa điểm, lúc khách điền) và MỘT nút chính "Chép tất cả".
     • Khối "Khách đã điền": mỗi phần (nhà gái / nhà trai / tiệc…) một thẻ có
       nút chép / chia sẻ, link bản đồ.
     • Khối "Gửi riêng cho thợ": mỗi người một dòng, chọn phần cần gửi rồi gửi
       Zalo / chép tin / chia sẻ.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SessionInfoViewV2({ contract, formUrl, crew, studioName, crewRoles = [] }: SessionInfoProps) {
  const { toastNode, sections, date, canShare, copy, share } = useSessionInfo(contract);
  const back = `/dashboard/studio/contracts/${contract.id}?tab=send`;
  const has = sections.length > 0;
  const allText = () => intakeMessage({ sections, title: contract.title, date, studio: studioName });
  const when = date ? `${date}${contract.eventTime ? ` · ${contract.eventTime.slice(0, 5)}` : ""}` : null;

  const actions = (mobile: boolean) => (
    <>
      {has && (
        <button type="button" className={btn("primary", "md", mobile ? "!flex-1" : "")} onClick={() => copy(allText(), "Đã chép toàn bộ thông tin")}>
          <Copy size={16} /> Chép tất cả
        </button>
      )}
      {formUrl && (
        <a href={formUrl} target="_blank" rel="noreferrer" className={btn(has ? "secondary" : "primary", "md", mobile && !has ? "!flex-1" : "")}>
          <ExternalLink size={16} /> Mở form
        </a>
      )}
      {has && canShare && (
        <button type="button" className={mobile ? iconBtn() : btn("ghost")} style={mobile ? { border: "1px solid var(--bd)" } : undefined} onClick={() => share(allText())} aria-label="Chia sẻ">
          <Share2 size={16} /> {mobile ? null : "Chia sẻ"}
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* ── Thẻ đầu ── */}
      <header className="v2-card overflow-hidden">
        <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
          <Link href={back} aria-label="Về hợp đồng" title="Về hợp đồng" className={iconBtn("-ml-1.5 -mt-0.5")}>
            <ArrowLeft size={18} />
          </Link>
          <span className="hidden h-12 w-12 flex-none items-center justify-center rounded-[14px] sm:flex" style={{ background: "var(--tlS)", color: "var(--tl)" }}>
            <ClipboardList size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1 className="text-[18px] font-bold tracking-[-0.3px] sm:text-[20px]">Thông tin buổi chụp</h1>
              {contract.submittedAt ? (
                <Badge tone="green" icon={Check}>
                  Khách đã điền
                </Badge>
              ) : (
                <Badge tone="amber" dot>
                  Khách chưa điền
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-[13px]" style={{ color: "var(--tx3)" }} title={contract.title}>
              {contract.clientName ? <span className="font-semibold" style={{ color: "var(--tx2)" }}>{contract.clientName}</span> : null}
              {contract.clientName && contract.title ? " · " : ""}
              {contract.title}
            </p>
          </div>
          <div className="hidden flex-none items-center gap-2 sm:flex">{actions(false)}</div>
        </div>

        <dl className="grid sm:grid-cols-3" style={{ borderTop: "1px solid var(--bd2)" }}>
          <Fact label="Ngày chụp" className="sm:[border-right:1px_solid_var(--bd2)]">
            {when ?? <span style={{ color: "var(--tx3)" }}>Chưa có ngày</span>}
          </Fact>
          <Fact label="Địa điểm" className="[border-top:1px_solid_var(--bd2)] sm:[border-right:1px_solid_var(--bd2)] sm:[border-top:0]">
            <span className="line-clamp-2 text-[13.5px] leading-snug" style={{ color: contract.location ? "var(--tx)" : "var(--tx3)" }}>
              {contract.location || "Chưa có địa điểm"}
            </span>
          </Fact>
          <Fact label="Form thông tin" className="[border-top:1px_solid_var(--bd2)] sm:[border-top:0]">
            <span style={{ color: contract.submittedAt ? "var(--gn)" : "var(--am)" }}>
              {contract.submittedAt ? `Điền lúc ${fmtDateTime(contract.submittedAt)}` : "Khách chưa điền form"}
            </span>
          </Fact>
        </dl>

        {(has || formUrl) && <div className="flex items-center gap-2 px-4 pb-4 sm:hidden">{actions(true)}</div>}
      </header>

      {!has ? (
        <Section title="Thông tin khách điền" icon={ClipboardList}>
          <Empty
            icon={ClipboardList}
            title="Chưa có thông tin buổi chụp"
            hint="Gửi link form cho khách ở tab “Ký & gửi” của hợp đồng. Khách điền xong, thông tin hiện ở đây để gửi riêng cho từng thợ."
            action={
              <Link href={back} className={btn("secondary")}>
                <Send size={16} /> Gửi form cho khách
              </Link>
            }
          />
        </Section>
      ) : (
        <>
          <Section
            title="Khách đã điền"
            icon={ClipboardList}
            desc="Mỗi phần chép hoặc chia sẻ riêng được — gửi đúng phần cho đúng người."
            actions={<Badge tone="gray">{sections.length} phần</Badge>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {sections.map((s) => (
                <PartCard key={s.key} s={s} onCopy={() => copy(sectionText(s), `Đã chép: ${s.title}`)} onShare={canShare ? () => share(sectionText(s)) : undefined} />
              ))}
            </div>
          </Section>

          <Section
            title="Gửi riêng cho thợ"
            icon={Send}
            desc="Chọn phần cần gửi cho từng người. Thợ đã gán nhà trai / nhà gái được chọn sẵn đúng phần nhà đó (kèm tiệc & ghi chú)."
            flush
          >
            {crew.length === 0 && (
              <div className="px-4 pt-4 sm:px-5">
                <Callout
                  tone="blue"
                  icon={Users}
                  action={
                    <Link href={`/dashboard/studio/contracts/${contract.id}?tab=crew`} className={btn("secondary", "sm")}>
                      Phân công
                    </Link>
                  }
                >
                  Hợp đồng chưa có thợ. Thêm thợ ở tab “Ê-kíp & lịch”, hoặc gửi cho người khác bên dưới.
                </Callout>
              </div>
            )}
            <ul>
              {crew.map((c) => (
                <SendRowV2
                  key={c.id}
                  sections={sections}
                  initialKeys={defaultKeysForSide(sections, c.side)}
                  name={c.name}
                  sub={[crewRoleLabel(c.role, crewRoles), c.side ? CREW_SIDE_LABEL[c.side] : null, c.phone].filter(Boolean).join(" · ")}
                  phone={c.phone}
                  buildMessage={(keys) => intakeMessage({ sections, keys, title: contract.title, date, to: c.name, studio: studioName })}
                  contractId={contract.id}
                  onCopy={(t) => copy(t, `Đã chép tin cho ${c.name}`)}
                  onShare={canShare ? share : undefined}
                />
              ))}
              <SendRowV2
                sections={sections}
                initialKeys={sections.map((s) => s.key)}
                name="Người khác"
                sub="Nhập SĐT hoặc chọn bạn Zalo"
                other
                buildMessage={(keys) => intakeMessage({ sections, keys, title: contract.title, date, studio: studioName })}
                contractId={contract.id}
                onCopy={(t) => copy(t, "Đã chép tin")}
                onShare={canShare ? share : undefined}
              />
            </ul>
          </Section>
        </>
      )}
      {toastNode}
    </div>
  );
}

/* ── Ô số liệu của thẻ đầu ── */
function Fact({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 sm:py-3.5 ${className}`}>
      <dt className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>
        {label}
      </dt>
      <dd className="mt-1 text-[14px] font-semibold">{children}</dd>
    </div>
  );
}

/* ── Một phần khách đã điền ── */
function PartCard({ s, onCopy, onShare }: { s: IntakeSection; onCopy: () => void; onShare?: () => void }) {
  const dir = s.location ? intakeDirections(s.location) : null;
  return (
    <div className="flex min-w-0 flex-col rounded-[14px] p-4" style={{ border: "1px solid var(--bd)" }}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[14px] font-semibold">{s.title}</p>
        <button type="button" className={iconBtn("!h-8 !w-8")} onClick={onCopy} aria-label={`Chép ${s.title}`} title="Chép phần này">
          <Copy size={16} />
        </button>
        {onShare && (
          <button type="button" className={iconBtn("!h-8 !w-8")} onClick={onShare} aria-label={`Chia sẻ ${s.title}`} title="Chia sẻ phần này">
            <Share2 size={16} />
          </button>
        )}
      </div>
      <dl className="mt-2 flex flex-1 flex-col">
        {s.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-1.5 text-[13.5px]" style={{ borderTop: "1px solid var(--bd2)" }}>
            <dt style={{ color: "var(--tx3)" }}>{r.label}</dt>
            <dd className="min-w-0 break-words" style={{ whiteSpace: "pre-wrap" }}>
              {r.tel ? (
                <a href={`tel:${r.value.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--ac)" }}>
                  <Phone size={13} /> {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {s.location && (
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={s.location.mapUrl} target="_blank" rel="noreferrer" className={btn("soft", "sm")}>
            <MapPin size={15} /> Xem vị trí
          </a>
          {dir && (
            <a href={dir} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
              <Navigation size={15} /> Chỉ đường
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Một người nhận: chọn phần cần gửi + gửi Zalo / chép / chia sẻ. */
function SendRowV2({
  sections,
  initialKeys,
  name,
  sub,
  phone,
  other = false,
  buildMessage,
  contractId,
  onCopy,
  onShare,
}: {
  sections: IntakeSection[];
  initialKeys: IntakeSectionKey[];
  name: string;
  sub: string;
  phone?: string | null;
  /** Dòng "Người khác": hỏi SĐT khi gửi Zalo. */
  other?: boolean;
  buildMessage: (keys: IntakeSectionKey[]) => string;
  contractId: string;
  onCopy: (text: string) => void;
  onShare?: (text: string) => void;
}) {
  const { keys, picked, message, toggle } = useSendRow(sections, initialKeys, buildMessage);
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <div className="flex min-w-0 items-center gap-3">
        {other ? (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
            <UserPlus size={17} />
          </span>
        ) : (
          <Avatar name={name} />
        )}
        <div className="min-w-0 flex-1">
          <p className="v2-row-title">{name}</p>
          <p className="v2-row-sub">{sub}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:pl-12" role="group" aria-label={`Phần gửi cho ${name}`}>
        {sections.map((s) => {
          const on = keys.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold"
              style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "transparent", color: on ? "var(--ac)" : "var(--tx2)" }}
            >
              {on && <Check size={13} strokeWidth={2.6} />}
              {s.title.replace(/\s*\(.*\)$/, "")}
            </button>
          );
        })}
      </div>
      {picked.length === 0 ? (
        <p className="text-[12.5px] sm:pl-12" style={{ color: "var(--tx3)" }}>
          Chọn ít nhất một phần để gửi.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-2 sm:pl-12">
          <ZaloSendButton
            phone={phone}
            name={name}
            audience="crew"
            contractId={contractId}
            kind="intake_crew"
            askPhone={other}
            message={message}
            className={btn("secondary", "sm")}
            wrapClassName="w-auto"
          />
          <button type="button" onClick={() => onCopy(message)} className={btn("secondary", "sm")}>
            <Copy size={15} /> Chép tin
          </button>
          {onShare && (
            <button type="button" onClick={() => onShare(message)} className={btn("ghost", "sm")}>
              <Share2 size={15} /> Chia sẻ
            </button>
          )}
        </div>
      )}
    </li>
  );
}
