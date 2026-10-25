"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ClipboardList, Clock, FileText, Link as LinkIcon, MapPin, MessageSquareWarning, Navigation, PenLine, Send } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import SignaturePad from "@/components/SignaturePad";
import { Badge, Field, Section, btn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { fmtDateTime } from "@/lib/date";
import { intakeIsWedding } from "@/lib/types";
import { studioUrl } from "@/lib/hosts";
import { intakeViewHref } from "@/lib/notifications";
import { cleanIntakeLocation, intakeDirections } from "@/lib/intake-text";
import { ClientLinks, SendOptions, ViewedLine, type V2Ctx } from "./ContractV2Shared";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab KÝ & GỬI (giao diện mới): gửi cổng khách → chữ ký hai bên → yêu cầu
   chỉnh sửa của khách → form thông tin buổi chụp → brief từ khách.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractV2Send({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { f, props } = ed;
  const { contract, studioHost, services } = props;
  const signedB = !!contract.client_signed_at;

  return (
    <>
      <Section title="Gửi hợp đồng cho khách" icon={Send} desc="Khách xem hợp đồng, lịch, ảnh và thanh toán trên cổng riêng. Mật khẩu là số điện thoại của khách.">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SendOptions ed={ed} />
          <div className="flex flex-col gap-3 rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Trạng thái:
              </span>
              {signedB ? (
                <Badge tone="green" icon={Check}>
                  Khách đã ký
                </Badge>
              ) : ed.clientViewedAt ? (
                <Badge tone="blue">Khách đã xem, chưa ký</Badge>
              ) : (
                <Badge tone="amber">Khách chưa mở</Badge>
              )}
            </div>
            <ViewedLine ed={ed} />
            <ClientLinks ed={ed} className="-ml-2.5" />
          </div>
        </div>
      </Section>

      <Signatures ctx={ctx} />

      {ed.openRequests.length > 0 && (
        <Section id="v2-requests" title={`Khách yêu cầu chỉnh sửa (${ed.openRequests.length})`} icon={MessageSquareWarning} desc="Sửa xong thì bấm “Đã xử lý”." flush>
          <ul>
            {ed.openRequests.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px]">{r.message}</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    {fmtDateTime(r.created_at)}
                  </p>
                </div>
                <button type="button" className={btn("secondary", "sm", "flex-none")} onClick={() => ed.resolveRequest(r.id)}>
                  <Check size={15} /> Đã xử lý
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <IntakeSection ctx={ctx} wedding={intakeIsWedding(contract.shoot_type, services.find((s) => s.id === f.service_id)?.name)} studioHost={studioHost} />

      {contract.brief_submitted_at && (
        <Section title="Brief từ khách" icon={FileText} desc={`Gửi lúc ${fmtDateTime(contract.brief_submitted_at)}`}>
          <dl className="flex flex-col gap-2 text-[13.5px]">
            {contract.brief_concept && <BriefRow k="Concept" v={contract.brief_concept} />}
            {contract.brief_outfit && <BriefRow k="Trang phục / người" v={contract.brief_outfit} />}
            {contract.brief_refs && <BriefRow k="Tham khảo" v={contract.brief_refs} breakAll />}
            {contract.brief_note && <BriefRow k="Khác" v={contract.brief_note} />}
          </dl>
        </Section>
      )}
    </>
  );
}

function BriefRow({ k, v, breakAll = false }: { k: string; v: string; breakAll?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt style={{ color: "var(--tx3)" }}>{k}</dt>
      <dd className={breakAll ? "break-all" : ""}>{v}</dd>
    </div>
  );
}

/* ── Chữ ký hai bên ── */
function Signatures({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { contract } = ed.props;
  const { savedSig, drawNew } = ed;
  const busy = ed.busy === "sign";
  // Đã ký Bên A thì mặc định chỉ hiện chữ ký; bấm "Ký lại" mới mở phần ký.
  const [resign, setResign] = useState(false);
  const showPad = !contract.studio_signed_at || resign;

  return (
    <Section id="v2-sign" title="Chữ ký hai bên" icon={PenLine} desc="Hiện trên bản PDF hợp đồng.">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bên B — khách */}
        <div className="flex flex-col gap-2 rounded-[14px] p-4" style={{ border: "1px solid var(--bd)" }}>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.02em]" style={{ color: "var(--tx3)" }}>
            Bên B · Khách hàng
          </p>
          {contract.client_signed_at ? (
            <>
              <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--gn)" }}>
                <CheckCircle2 size={17} /> Khách đã ký hợp đồng
              </p>
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {contract.client_signed_name || ed.f.client_name} · {fmtDateTime(contract.client_signed_at)}
              </p>
              {contract.client_signature && (
                <img src={contract.client_signature} alt="Chữ ký của khách" className="h-16 w-fit rounded-[8px] bg-white p-1" style={{ border: "1px solid var(--bd2)" }} />
              )}
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--am)" }}>
                <Clock size={17} /> Khách chưa ký
              </p>
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Khách ký trên cổng hợp đồng. Khách đặt cọc cũng được tính là đã chốt.
              </p>
              <button type="button" className={btn("secondary", "sm", "mt-1 w-fit")} onClick={ctx.openSend}>
                <Send size={15} /> Gửi khách ký
              </button>
            </>
          )}
        </div>

        {/* Bên A — studio */}
        <div className="flex flex-col gap-3 rounded-[14px] p-4" style={{ border: `1px solid ${ed.studioSigned ? "var(--bd)" : "color-mix(in srgb, var(--am) 45%, var(--bd))"}` }}>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.02em]" style={{ color: "var(--tx3)" }}>
            Bên A · Studio
          </p>
          {contract.studio_signed_at && (
            <div className="flex flex-wrap items-center gap-3">
              {contract.studio_signature && (
                <img src={contract.studio_signature} alt="Chữ ký studio" className="h-14 rounded-[8px] bg-white p-1" style={{ border: "1px solid var(--bd2)" }} />
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--gn)" }}>
                  <CheckCircle2 size={17} /> Đã ký
                </p>
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {contract.studio_signed_name} · {fmtDateTime(contract.studio_signed_at)}
                </p>
              </div>
              {!resign && (
                <button type="button" className={btn("ghost", "sm", "ml-auto")} onClick={() => setResign(true)}>
                  Ký lại
                </button>
              )}
            </div>
          )}

          {showPad &&
            (savedSig && !drawNew ? (
              <div className="flex flex-col gap-3" data-testid="saved-signature">
                <div className="flex flex-wrap items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--sf2)" }}>
                  <img src={savedSig.signature} alt="Chữ ký đã lưu" className="h-14 rounded-[8px] bg-white p-1" />
                  <div className="min-w-0">
                    <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                      Chữ ký đã lưu
                    </p>
                    <p className="truncate text-[14px] font-semibold">{savedSig.name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => ed.saveStudioSignature(true)} disabled={busy} className={btn("primary")}>
                    <PenLine size={16} /> {busy ? "Đang ký…" : contract.studio_signed_at ? "Ký lại bằng chữ ký đã lưu" : "Ký bằng chữ ký đã lưu"}
                  </button>
                  <button type="button" onClick={() => ed.setDrawNew(true)} className={btn("ghost")}>
                    Ký tay chữ ký khác
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Người ký (đại diện studio)" htmlFor="sg-name">
                  <input id="sg-name" className={inputCls} placeholder="Họ tên người ký" value={ed.studioSignName} onChange={(e) => ed.setStudioSignName(e.target.value)} />
                </Field>
                <Field label={contract.studio_signed_at ? "Chữ ký (ký lại nếu muốn thay)" : "Chữ ký"}>
                  <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
                    <SignaturePad onChange={ed.setStudioSignature} />
                  </div>
                </Field>
                <Switch checked={ed.rememberSig} onChange={ed.setRememberSig} label="Lưu chữ ký này" desc="Lần sau ký một chạm." />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => ed.saveStudioSignature(false)} disabled={busy} className={btn("primary")}>
                    <PenLine size={16} /> {busy ? "Đang lưu…" : "Lưu chữ ký Bên A"}
                  </button>
                  {savedSig && (
                    <button type="button" onClick={() => ed.setDrawNew(false)} className={btn("ghost")}>
                      Dùng chữ ký đã lưu
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Form thông tin buổi chụp (khách điền; gửi kèm khi nhắc lịch) ── */
function IntakeSection({ ctx, wedding, studioHost }: { ctx: V2Ctx; wedding: boolean; studioHost: string | null }) {
  const { ed } = ctx;
  const { f } = ed;
  const { contract } = ed.props;
  const submitted = !!contract.intake_submitted_at;
  const formUrl = contract.intake_token ? studioUrl(studioHost, `/form/${contract.intake_token}`) : null;
  const msg = formUrl
    ? submitted
      ? `Chào ${f.client_name || "anh/chị"}, anh/chị kiểm tra & bổ sung/sửa lại giúp studio thông tin buổi chụp tại: ${formUrl} (mở form rồi bấm "Chỉnh sửa / bổ sung").`
      : `Chào ${f.client_name || "anh/chị"}, anh/chị điền giúp studio một số thông tin cho buổi chụp tại: ${formUrl}`
    : "";
  const intake = contract.intake;

  return (
    <Section
      title="Form thông tin buổi chụp"
      icon={ClipboardList}
      desc={
        submitted
          ? `Khách đã điền · ${fmtDateTime(contract.intake_submitted_at!)}`
          : wedding
            ? "Khách điền tên & SĐT cô dâu/chú rể, mốc giờ trong ngày, vị trí nhà gái/nhà trai & nơi đãi tiệc (có bản đồ)."
            : "Khách điền tên người làm việc trực tiếp, SĐT, thời gian bắt đầu, vị trí (có bản đồ) & ghi chú."
      }
    >
      <div className="flex flex-col gap-4">
        {!formUrl && !submitted && (
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>
            Chưa có link form cho hợp đồng này — tải lại trang để tạo.
          </p>
        )}
        {formUrl && (
          <div className="flex flex-wrap gap-2">
            <a href={formUrl} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
              <LinkIcon size={15} /> Mở form
            </a>
            <MessengerButton link={f.client_messenger} label={submitted ? "Yêu cầu nhập lại / bổ sung" : "Gửi cho khách"} message={msg} className={btn("secondary", "sm")} />
            <ZaloSendButton
              phone={f.client_phone}
              name={f.client_name}
              audience="client"
              contractId={contract.id}
              savedName={contract.zalo_name}
              kind="intake_form"
              message={msg}
              className={btn("secondary", "sm")}
              wrapClassName="w-auto"
            />
          </div>
        )}

        {submitted && intake && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {intake.type === "psc" ? (
                <>
                  <IntakeSide
                    title="Nhà gái (cô dâu)"
                    rows={[
                      ["Tên", intake.bride?.name],
                      ["SĐT", intake.bride?.phone],
                      ["Makeup", intake.bride?.makeup_time],
                      ["Giờ lễ", intake.bride?.ceremony_time],
                    ]}
                    location={cleanIntakeLocation(intake.bride?.location)}
                  />
                  <IntakeSide
                    title="Nhà trai (chú rể)"
                    rows={[
                      ["Tên", intake.groom?.name],
                      ["SĐT", intake.groom?.phone],
                      ["Xuất phát", intake.groom?.depart_time],
                      ["Giờ lễ", intake.groom?.ceremony_time],
                    ]}
                    location={cleanIntakeLocation(intake.groom?.location)}
                  />
                  {(intake.reception?.time || intake.reception?.location) && (
                    <IntakeSide title="Tiệc cưới / địa điểm khác" rows={[["Giờ đãi tiệc", intake.reception?.time]]} location={cleanIntakeLocation(intake.reception?.location)} />
                  )}
                </>
              ) : (
                <IntakeSide
                  title="Thông tin khách"
                  rows={[
                    ["Người làm việc trực tiếp", intake.contact_name],
                    ["SĐT", intake.contact_phone],
                    ["Thời gian bắt đầu", intake.start_time],
                  ]}
                  location={cleanIntakeLocation(intake.location)}
                />
              )}
            </div>
            {intake.note && (
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Ghi chú: {intake.note}
              </p>
            )}
            <Link href={intakeViewHref(contract.id)} className={btn("secondary", "md", "w-fit")}>
              <Send size={15} /> Xem riêng & gửi từng phần cho thợ
            </Link>
          </>
        )}
      </div>
    </Section>
  );
}

function IntakeSide({
  title,
  rows,
  location,
}: {
  title: string;
  rows: [string, string | undefined | null][];
  location?: { lat: number | null; lng: number | null; mapUrl: string } | null;
}) {
  const dir = location ? intakeDirections(location) : null;
  return (
    <div className="rounded-[12px] p-3.5" style={{ background: "var(--sf2)" }}>
      <p className="text-[13.5px] font-semibold">{title}</p>
      <dl className="mt-1.5 flex flex-col gap-1 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt style={{ color: "var(--tx3)" }}>{k}</dt>
            <dd className="text-right font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {location && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
          <a href={location.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: "var(--ac)" }}>
            <MapPin size={13} /> Xem vị trí
          </a>
          {dir && (
            <a href={dir} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: "var(--ac)" }}>
              <Navigation size={13} /> Chỉ đường
            </a>
          )}
        </div>
      )}
    </div>
  );
}
