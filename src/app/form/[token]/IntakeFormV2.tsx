"use client";

import { useState } from "react";
import { Check, CircleAlert, Heart, Info, Loader2, MapPinned, Pencil, Send, StickyNote, UserRound, Users } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import LocationPicker from "@/components/LocationPicker";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { Callout, Card, Field, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { CustomerRootAuto, StickyActionBar, useInView } from "@/app/c/[token]/DocPartsV2";
import { useIntakeForm, type IntakeFormProps } from "./useIntakeForm";

/* ═══════════════════════════════════════════════════════════════════════════
   FORM THÔNG TIN BUỔI CHỤP — giao diện mới. Cùng state, cùng lời gọi máy chủ
   với bản cũ (./useIntakeForm). Khách mở từ tin nhắn Zalo nên: đầu trang mang
   thương hiệu studio, mỗi phần một khối có số thứ tự, ô nhập cao dễ bấm, và
   MỘT nút "Gửi thông tin" (điện thoại: dính dưới đáy khi nút cuối trang khuất).
   ═══════════════════════════════════════════════════════════════════════════ */

/* Ô tìm / dán link trong LocationPicker có biểu tượng bên trái (pl-7); lớp
   `.ui-v2 .input` đặt lại padding nên phải trả lại khoảng chừa cho biểu tượng. */
const LOC_FIX = "[&_input.pl-7]:!pl-7";

export default function IntakeFormV2(props: IntakeFormProps & { brand: StudioBrandInfo }) {
  const { token, clientName, title, studio, submitted, brand } = props;
  const f = useIntakeForm(props);
  const [submitEl, setSubmitEl] = useState<HTMLDivElement | null>(null);
  const submitInView = useInView(submitEl);
  const who = clientName || "anh/chị";

  const submitBtn = (size: "md" | "lg", extra = "") => (
    <button type="button" onClick={f.submit} disabled={f.busy} className={btn("primary", size, extra)}>
      {f.busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} {submitted ? "Cập nhật thông tin" : "Gửi thông tin cho studio"}
    </button>
  );

  return (
    <CustomerRootAuto>
      <CustomerHeaderV2 brand={brand} sub="Thông tin buổi chụp" />
      {f.done ? (
        <CustomerMainV2 width={520}>
          <div className="flex min-h-[calc(100dvh-170px)] flex-col justify-center">
            <Card className="text-center">
              <div className="flex flex-col items-center px-1 py-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                  <Check size={28} strokeWidth={2.6} />
                </span>
                <h1 className="mt-4 text-[22px] font-bold tracking-[-0.4px]">Đã gửi thông tin</h1>
                <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                  Cảm ơn {who} đã cung cấp thông tin. Studio đã nhận và sẽ chuẩn bị chu đáo cho buổi chụp ạ!
                </p>
                <p className="mt-4 text-[13px]" style={{ color: "var(--tx3)" }}>
                  Điền chưa xong hoặc có sai sót? Anh/chị có thể sửa và gửi lại.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    f.setErr("");
                    f.setDone(false);
                  }}
                  className={btn("secondary", "md", "mt-3")}
                >
                  <Pencil size={15} /> Chỉnh sửa / bổ sung thông tin
                </button>
              </div>
            </Card>
          </div>
        </CustomerMainV2>
      ) : (
        <>
          <CustomerMainV2 width={760}>
            <Stack gap={16}>
              <header className="v2-card p-4 sm:p-6">
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {title || "Buổi chụp của bạn"}
                </p>
                <h1 className="mt-1 text-[22px] font-bold leading-snug tracking-[-0.4px] sm:text-[24px]">Thông tin buổi chụp</h1>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                  Kính gửi {who}, vui lòng điền giúp studio một số thông tin để chuẩn bị chu đáo.{" "}
                  {f.isPsc ? "Gồm 3 phần: nhà gái, nhà trai và tiệc cưới." : "Chỉ mất khoảng một phút."}
                </p>
                {submitted && (
                  <div className="mt-4">
                    <Callout tone="blue" icon={Info}>
                      Anh/chị đã gửi thông tin trước đó. Sửa hoặc bổ sung rồi bấm <b>Cập nhật thông tin</b>.
                    </Callout>
                  </div>
                )}
              </header>

              {f.isPsc ? (
                <>
                  <Section icon={Heart} title="Phần 1 · Nhà gái (cô dâu)">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Tên cô dâu">
                        <input className={inputCls} value={f.brideName} onChange={(e) => f.setBrideName(e.target.value)} placeholder="Họ và tên cô dâu" />
                      </Field>
                      <Field label="SĐT cô dâu">
                        <input className={inputCls} type="tel" inputMode="tel" value={f.bridePhone} onChange={(e) => f.setBridePhone(e.target.value)} placeholder="09xxxxxxxx" />
                      </Field>
                      <Field label="Giờ makeup">
                        <TimeInput className={inputCls} value={f.brideMakeup} onChange={f.setBrideMakeup} ariaLabel="Giờ makeup" />
                      </Field>
                      <Field label="Giờ làm lễ nhà gái">
                        <TimeInput className={inputCls} value={f.brideCeremony} onChange={f.setBrideCeremony} ariaLabel="Giờ làm lễ nhà gái" />
                      </Field>
                    </div>
                    <Field label="Vị trí nhà gái" className="mt-4">
                      <div className={LOC_FIX}><LocationPicker token={token} value={f.brideLoc} onChange={f.setBrideLoc} /></div>
                    </Field>
                  </Section>

                  <Section icon={UserRound} title="Phần 2 · Nhà trai (chú rể)">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Tên chú rể">
                        <input className={inputCls} value={f.groomName} onChange={(e) => f.setGroomName(e.target.value)} placeholder="Họ và tên chú rể" />
                      </Field>
                      <Field label="SĐT chú rể">
                        <input className={inputCls} type="tel" inputMode="tel" value={f.groomPhone} onChange={(e) => f.setGroomPhone(e.target.value)} placeholder="09xxxxxxxx" />
                      </Field>
                      <Field label="Giờ nhà trai xuất phát">
                        <TimeInput className={inputCls} value={f.groomDepart} onChange={f.setGroomDepart} ariaLabel="Giờ nhà trai xuất phát" />
                      </Field>
                      <Field label="Giờ làm lễ nhà trai">
                        <TimeInput className={inputCls} value={f.groomCeremony} onChange={f.setGroomCeremony} ariaLabel="Giờ làm lễ nhà trai" />
                      </Field>
                    </div>
                    <Field label="Vị trí nhà trai" className="mt-4">
                      <div className={LOC_FIX}><LocationPicker token={token} value={f.groomLoc} onChange={f.setGroomLoc} /></div>
                    </Field>
                  </Section>

                  <Section icon={MapPinned} title="Phần 3 · Tiệc cưới / địa điểm khác">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Giờ đãi tiệc">
                        <TimeInput className={inputCls} value={f.receptionTime} onChange={f.setReceptionTime} ariaLabel="Giờ đãi tiệc" />
                      </Field>
                    </div>
                    <Field label="Vị trí nơi đãi tiệc" className="mt-4">
                      <div className={LOC_FIX}><LocationPicker token={token} value={f.receptionLoc} onChange={f.setReceptionLoc} /></div>
                    </Field>
                  </Section>
                </>
              ) : (
                <Section icon={Users} title="Người liên hệ & địa điểm" desc="Người studio làm việc trực tiếp tại buổi chụp.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tên người làm việc trực tiếp">
                      <input className={inputCls} value={f.contactName} onChange={(e) => f.setContactName(e.target.value)} placeholder="Người studio liên hệ tại buổi chụp" />
                    </Field>
                    <Field label="Số điện thoại liên hệ">
                      <input className={inputCls} type="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => f.setContactPhone(e.target.value)} placeholder="09xxxxxxxx" />
                    </Field>
                    <Field label="Thời gian bắt đầu">
                      <TimeInput className={inputCls} value={f.startTime} onChange={f.setStartTime} ariaLabel="Thời gian bắt đầu" />
                    </Field>
                  </div>
                  <Field label="Vị trí" className="mt-4">
                    <div className={LOC_FIX}><LocationPicker token={token} value={f.genLoc} onChange={f.setGenLoc} /></div>
                  </Field>
                </Section>
              )}

              <Section icon={StickyNote} title="Ghi chú thêm cho studio" desc="Không bắt buộc.">
                <textarea className={inputCls} rows={3} value={f.note} onChange={(e) => f.setNote(e.target.value)} placeholder="Yêu cầu riêng, lưu ý về địa điểm, giờ giấc…" />
              </Section>

              {f.err && (
                <Callout tone="red" icon={CircleAlert}>
                  {f.err}
                </Callout>
              )}

              <div ref={setSubmitEl} className="flex flex-col items-center gap-2">
                {submitBtn("lg", "w-full sm:w-auto sm:min-w-[280px]")}
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  — {studio || brand.name || "Studio"} —
                </p>
              </div>
            </Stack>
            <div className="h-16 lg:hidden" aria-hidden />
          </CustomerMainV2>

          <StickyActionBar show={!submitInView}>{submitBtn("md", "flex-1")}</StickyActionBar>
        </>
      )}
    </CustomerRootAuto>
  );
}
