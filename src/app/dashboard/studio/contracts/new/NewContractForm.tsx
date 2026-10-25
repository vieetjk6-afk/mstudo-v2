"use client";

import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import MoneyInput from "@/components/MoneyInput";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  Package,
  Plus,
  Trash2,
  Pencil,
  Send,
  AlertTriangle,
  CircleAlert,
  Landmark,
  RotateCcw,
  Sparkles,
  History,
  CalendarX2,
  Lock,
} from "lucide-react";
import { crewRoleLabel } from "@/lib/crew-roles";
import { SHOOT_TYPE_LABEL, vnd, type ShootType } from "@/lib/types";
import { contractKind, kindHasPhotoWork, CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contract-kind";
import AlbumModePicker from "@/components/AlbumModePicker";
import { fmtDate, fmtDow } from "@/lib/date";
import { avatarStyle, avatarColor, initials } from "@/lib/avatar";
import { useUiV2 } from "@/components/v2/UiV2Context";
import QuickContractBox from "./QuickContractBox";
import NewContractFormV2 from "./NewContractFormV2";
import { STEPS, useNewContractForm, type NewContractFormProps } from "./useNewContractForm";

/* Kiểu dữ liệu nằm ở ./useNewContractForm (phần logic dùng chung) — xuất lại ở
   đây để page.tsx và nơi khác vẫn nhập từ đúng chỗ cũ. */
export type { TemplateOption, ServiceOption, PackageOption, RecentClient } from "./useNewContractForm";

/** Giao diện mới bật → bản V2; không thì bản cũ y nguyên. Hai bản dùng chung
 *  mọi state và luật ở ./useNewContractForm. */
export default function NewContractForm(props: NewContractFormProps) {
  return useUiV2() ? <NewContractFormV2 {...props} /> : <NewContractFormV1 {...props} />;
}

function NewContractFormV1(props: NewContractFormProps) {
  const {
    templates, services, packages, roster, crewRoles, recentClients, bank, initialQuickText, quickSourceNote,
    step, setStep, canNext,
    clientQuery, setClientQuery, clientName, setClientName, clientPhone, setClientPhone, phoneOk,
    filteredClients, pickClient, returningHit, savedNameDiffers,
    serviceId, changeService, setShowAllLists, shootType, setShootType, templateId, pickTemplate,
    selectedService, template, nhomDichVu, mainPkgId, mainPkg, extraIds, extras, priceOf, priceEdited,
    pickMain, toggleExtra, setPkgPriceFor, clearPkgPrice, customLines, addCustomLine, patchCustomLine, removeCustomLine,
    customPreview, listLabel, serviceListKeys, filteringLists, visiblePackages, packageGroups,
    lines, total, payroll, profit, marginPct, marginTone, thinMargin,
    eventDate, setEventDate, startTime, setStartTime, endTime, setEndTime, location, setLocation,
    picked, toggleCrew, setCrewSalary, sameDay, clashes,
    instalments, planTotal, patchInstalment, addInstalment, removeInstalment,
    title, setTitle, autoTitle, addChecklist, setAddChecklist, makePhoto, setMakePhoto, makeVideo, setMakeVideo,
    setAlbumMode, setAlbumModeTouched, albumStatus, setAlbumStatus, effectiveAlbumMode,
    briefNote, setBriefNote, internalNote, setInternalNote,
    quick, quickContext, applyQuick,
    saving, err, create,
  } = useNewContractForm(props);

  /* ── Khối dùng lại ───────────────────────────────────────────────────────── */
  const panel = "rounded-[14px]";
  const panelStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const eyebrow = "text-[11px] font-extrabold uppercase";
  const eyebrowStyle = { letterSpacing: ".5px", color: "var(--tx3)" } as const;
  const fieldLabel = "mb-1.5 block text-[11px] font-bold uppercase";
  const fieldLabelStyle = { letterSpacing: ".4px", color: "var(--tx3)" } as const;
  const inputCls = "w-full rounded-[10px] px-3 py-2.5 text-[13px]";
  const inputStyle = { border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" } as const;

  /* ── Thanh hành động ──────────────────────────────────────────────────────
     Dựng MỘT LẦN rồi đặt vào hai chỗ tuỳ khổ màn (React tái dùng element vô
     tư): máy tính ghim ngay dưới thanh 5 bước ở ĐẦU trang; điện thoại ghim ĐÁY
     màn, ngay trên thanh điều hướng — ngón cái với tới được mà không phải cuộn
     hết một bước dài. Trước đây thanh này nằm cuối trang nên mỗi lần sang bước
     mới đều phải cuộn xuống đáy tìm nút. */
  /* Khách cũ: hiện ở bước Khách hàng VÀ bước Kiểm tra (Tạo nhanh nhảy thẳng
     tới Kiểm tra nên không đi qua bước Khách hàng). */
  const returningBanner = returningHit ? (
    <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-[11px] px-3.5 py-2.5" style={{ background: "var(--blS)" }}>
      <History size={17} style={{ flex: "none", color: "var(--bl)" }} />
      <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        <b style={{ color: "var(--tx)" }}>Khách cũ</b> — đã có {returningHit.count} hợp đồng
        {returningHit.name ? <> với tên <b>{returningHit.name}</b></> : null}
        {returningHit.last ? <>, show gần nhất {fmtDate(returningHit.last)}</> : null}.
      </p>
      {savedNameDiffers && (
        <button
          type="button"
          onClick={() => setClientName(returningHit.name)}
          className="flex-none rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
          style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--bl)" }}
        >
          Dùng tên đã lưu
        </button>
      )}
    </div>
  ) : null;

  /* Trùng lịch: thợ trùng giờ là cảnh báo đỏ; chỉ "cùng ngày có show khác" là
     thông tin vàng. Không chặn tạo — studio quyết. */
  const conflictBanner =
    clashes.length > 0 || sameDay.length > 0 ? (
      <div
        className="mb-4 flex gap-2.5 rounded-[11px] px-3.5 py-3"
        style={{ background: clashes.some((c) => c.overlap) ? "var(--rdS)" : "var(--amS)" }}
      >
        <CalendarX2 size={18} style={{ flex: "none", marginTop: 1, color: clashes.some((c) => c.overlap) ? "var(--rd)" : "var(--am)" }} />
        <div className="min-w-0 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
          {clashes.length > 0 ? (
            <>
              <p className="font-bold" style={{ color: "var(--tx)" }}>Nhân sự có thể trùng lịch</p>
              <ul className="mt-0.5">
                {clashes.map((c, i) => (
                  <li key={i}>
                    <b>{c.crewName}</b> {c.overlap ? "đang đi" : "cũng có mặt ở"}{" "}
                    <Link href={`/dashboard/studio/contracts/${c.contract.id}`} className="font-semibold underline" target="_blank">
                      {c.contract.code || c.contract.title || "hợp đồng khác"}
                    </Link>
                    {c.contract.client_name ? ` (${c.contract.client_name})` : ""} · {c.otherTime}
                    {!c.overlap && " — chưa đủ giờ để so, kiểm tra lại"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {sameDay.length > 0 && (
            <p className={clashes.length ? "mt-1.5" : ""}>
              {clashes.length ? null : <b style={{ color: "var(--tx)" }}>Ngày này đã có show khác. </b>}
              {sameDay.length} hợp đồng {clashes.length ? "khác " : ""}cùng ngày:{" "}
              {sameDay
                .slice(0, 4)
                .map((c) => [c.code || c.title, c.client_name, c.event_time?.slice(0, 5)].filter(Boolean).join(" · "))
                .join("; ")}
              {sameDay.length > 4 ? `; +${sameDay.length - 4}` : ""}
            </p>
          )}
        </div>
      </div>
    ) : null;

  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/dashboard/studio/contracts"
        className="rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold sm:text-[13px]"
        style={{ color: "var(--tx3)" }}
      >
        Huỷ
      </Link>
      <button
        type="button"
        onClick={() => create("draft")}
        disabled={!!saving || !phoneOk}
        className="rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold disabled:opacity-50 sm:text-[13px]"
        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
      >
        {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
      </button>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="ml-auto flex items-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold sm:px-4 sm:text-[13px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          {/* Trên điện thoại chỉ còn mũi tên — bốn nút chữ đầy đủ là tràn hàng. */}
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
        </button>
      )}

      {step < STEPS.length - 1 ? (
        <button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          disabled={!canNext}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50 sm:px-5 sm:text-[13px] ${step === 0 ? "ml-auto" : ""}`}
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          {step === 0 ? "Nhập khách" : step === 1 ? "Chọn gói" : step === 2 ? "Đặt lịch" : step === 3 ? "Chia tiền" : "Xem lại"}
          <ArrowRight size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => create("send")}
          disabled={!!saving}
          className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50 sm:px-5 sm:text-[13px]"
          style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 2px 8px color-mix(in srgb, var(--ac) 30%, transparent)" }}
        >
          <Send size={17} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách ký"}
        </button>
      )}
    </div>
  );

  return (
    <div className="page-in mx-auto flex max-w-[900px] flex-col gap-3.5">
      {/* ── Đầu trang GHIM: 5 bước + (máy tính) thanh hành động ─────────────
          Neo dưới topbar của StudioShell bằng --topbar-h. Cuộn nội dung dài
          không làm mất chỗ đứng: luôn thấy đang ở bước nào và bấm đi tiếp được
          ngay. */}
      <div
        className="sticky z-20 flex flex-col gap-2.5 pb-2.5 pt-1"
        style={{ top: "var(--topbar-h)", background: "var(--bg)" }}
      >
        {/* ── Thanh 5 bước ───────────────────────────────────────────────────
            Bấm được vào bước đã qua để quay lại sửa; bước chưa tới thì không. */}
        <div className={`${panel} flex items-start px-3 py-3 sm:px-4 sm:py-4`} style={panelStyle}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = s.icon;
            const lineC = i <= step ? "var(--ac)" : "var(--bd)";
            return (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-[7px]">
                <div className="flex w-full items-center">
                  <span className="h-0.5 flex-1" style={{ background: i === 0 ? "transparent" : lineC }} />
                  <button
                    type="button"
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    aria-current={current ? "step" : undefined}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
                    style={
                      done
                        ? { background: "var(--gn)", color: "#fff", border: "1.5px solid var(--gn)" }
                        : current
                          ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" }
                          : { background: "var(--sf2)", color: "var(--tx3)", border: "1.5px solid var(--bd)" }
                    }
                  >
                    {done ? <Check size={17} /> : <Icon size={17} />}
                  </button>
                  <span className="h-0.5 flex-1" style={{ background: i === STEPS.length - 1 ? "transparent" : (i < step ? "var(--ac)" : "var(--bd)") }} />
                </div>
                <span
                  className="text-center text-[11.5px]"
                  style={{ color: current ? "var(--ac)" : done ? "var(--tx2)" : "var(--tx3)", fontWeight: current ? 700 : 550 }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Máy tính: nút thao tác nằm ngay dưới 5 bước. Điện thoại dùng bản ghim
            đáy màn ở cuối file này. */}
        <div className={`${panel} hidden px-3 py-2.5 sm:block`} style={panelStyle}>{actionBar}</div>
      </div>

      {/* ── Tạo nhanh: chỉ ở bước đầu — đã đi vào từng bước thì là nhập tay. ── */}
      {step === 0 && (
        <QuickContractBox
          context={quickContext}
          onApply={applyQuick}
          initialText={initialQuickText}
          sourceNote={quickSourceNote}
        />
      )}

      {/* ── Nội dung bước ──────────────────────────────────────────────────── */}
      <div className={`${panel} px-5 py-5`} style={panelStyle}>
        <h3 className="text-[16px] font-bold">{STEPS[step].title}</h3>
        <p className="mb-4 mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{STEPS[step].hint}</p>

        {/* ── Bước 1 · Loại dịch vụ ──────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {/* Ô này trước đây CHỈ hiện khi studio chưa cấu hình điều khoản
                  dịch vụ — studio nào đã cấu hình thì không có đường nào đánh
                  dấu hợp đồng là makeup, và mọi hợp đồng đều nhận nhóm chụp.
                  Chia mục theo nhóm để thấy ngay lựa chọn này kéo theo gì. */}
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-shoot">Loại dịch vụ</label>
                <select id="nc-shoot" className={inputCls} style={inputStyle} value={shootType} onChange={(e) => setShootType(e.target.value as ShootType)}>
                  {(Object.keys(nhomDichVu) as ContractKind[]).map((k) => (
                    <optgroup key={k} label={CONTRACT_KIND_LABEL[k]}>
                      {nhomDichVu[k].map((t) => <option key={t} value={t}>{SHOOT_TYPE_LABEL[t]}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                  Nhóm <b>{CONTRACT_KIND_LABEL[contractKind(shootType)]}</b> — hạng mục gợi ý và việc cần làm đổi theo nhóm này.
                </p>
              </div>
              {services.length > 0 && (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-svc">Điều khoản áp dụng</label>
                  <select id="nc-svc" className={inputCls} style={inputStyle} value={serviceId} onChange={(e) => changeService(e.target.value)}>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                    Quyết định điều khoản in vào hợp đồng, và bảng giá hiện ra ở bước Gói dịch vụ.
                  </p>
                </div>
              )}
              {templates.length > 0 && (
                <div>
                  <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-tpl">Tạo từ mẫu hợp đồng</label>
                  <select id="nc-tpl" className={inputCls} style={inputStyle} value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                    <option value="">— Không dùng mẫu —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.contract_template_items?.length || 0} hạng mục)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bước 2 · Khách hàng ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            {/* NHẬP TAY ĐẶT TRÊN ĐẦU: phần lớn hợp đồng là khách mới, mà trước
                đây hai ô này nằm cuối bước, sau cả danh sách khách cũ và một nút
                "khách mới" phải bấm mới hiện ra. Giờ gõ được ngay; chọn khách cũ
                bên dưới thì hai ô này tự điền. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-name">Tên khách hàng</label>
                <input id="nc-name" className={inputCls} style={inputStyle} placeholder="Nguyễn Văn A" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-phone">Số điện thoại</label>
                <input
                  id="nc-phone"
                  className={inputCls}
                  style={{ ...inputStyle, borderColor: clientPhone && !phoneOk ? "var(--rd)" : "var(--bd)" }}
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="0901234567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </div>

            {clientPhone && !phoneOk && (
              <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--rd)" }}>
                SĐT phải đủ 10 số — khách dùng chính số này làm mật khẩu mở cổng hợp đồng.
              </p>
            )}
            {returningBanner}

            {recentClients.length > 0 && (
              <>
                <p className={`mb-2 mt-[18px] ${eyebrow}`} style={eyebrowStyle}>Hoặc chọn khách cũ</p>
                <div className="relative mb-2.5">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
                  <input
                    className={`${inputCls} pl-10`}
                    style={inputStyle}
                    placeholder="Tìm theo tên hoặc số điện thoại…"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
                {/* min-w-0: lưới không khai báo cột lấy min-content của item làm
                    sàn track, mà item có `truncate` (nowrap) nên track phình rộng
                    hơn thẻ và danh sách tràn ra ngoài. Xem NewQuoteForm. */}
                <div className="grid min-w-0 gap-2">
                  {filteredClients.length === 0 ? (
                    <p className="py-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      Không có khách cũ nào khớp “{clientQuery}” — cứ gõ thẳng vào hai ô trên.
                    </p>
                  ) : (
                    filteredClients.map((c) => {
                      const on = clientPhone.replace(/\D/g, "") === c.phone.replace(/\D/g, "") && !!c.phone;
                      return (
                        <button
                          key={`${c.phone}-${c.name}`}
                          type="button"
                          onClick={() => pickClient(c)}
                          className="flex min-w-0 items-center gap-3 rounded-[11px] px-3.5 py-3 text-left"
                          style={{
                            border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                            background: on ? "var(--acS)" : "var(--sf)",
                          }}
                        >
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={avatarStyle(c.name)}>
                            {initials(c.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold">{c.name}</span>
                            <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                              {[c.phone || "chưa có SĐT", `${c.count} hợp đồng`, c.last ? `gần nhất ${fmtDate(c.last)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          {on && <Check size={20} style={{ flex: "none", color: "var(--ac)" }} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

          </div>
        )}

        {/* ── Bước 3 · Gói dịch vụ ────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            {packages.length === 0 ? (
              <div className="rounded-[11px] px-4 py-5 text-center" style={{ border: "1px dashed var(--bd)" }}>
                <p className="text-[13px] font-semibold">Bảng giá đang trống</p>
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Thêm gói vào{" "}
                  <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>bảng giá</Link>{" "}
                  để chọn nhanh ở đây — hoặc dùng mẫu hợp đồng, hoặc nhập <b>gói riêng</b> ngay bên dưới.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className={eyebrow} style={eyebrowStyle}>Gói chính</p>
                  {/* Đang lọc theo dịch vụ thì nói rõ, và luôn để sẵn đường xem
                      lại toàn bộ — bảng giá không đặt theo dịch vụ vẫn dùng được. */}
                  {serviceListKeys && (
                    <button
                      type="button"
                      onClick={() => setShowAllLists((v) => !v)}
                      className="text-[11.5px] font-semibold underline"
                      style={{ color: "var(--ac)" }}
                    >
                      {filteringLists
                        ? `Đang hiện bảng giá ${selectedService?.name ?? ""} — xem tất cả`
                        : "Chỉ hiện bảng giá của dịch vụ này"}
                    </button>
                  )}
                </div>
                <p className="mb-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Chọn gói rồi <b>sửa thẳng ô giá</b> nếu đã thương lượng khác bảng giá — bảng giá gốc không đổi.
                </p>
                <div className="grid min-w-0 gap-2">
                  {packageGroups.map(([key, list]) => (
                    <div key={key} className="grid min-w-0 gap-2">
                      {packageGroups.length > 1 && (
                        <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>{listLabel(key)}</p>
                      )}
                      {list.map((p) => {
                        const on = mainPkgId === p.id;
                        const edited = priceEdited(p);
                        return (
                          /* Không còn là MỘT nút: gói đã chọn phải sửa được giá
                             ngay tại chỗ, mà <input> không đặt trong <button>
                             được (bấm vào ô là bấm cả nút). Nên tách: nút chọn
                             chiếm phần tên, ô giá nằm ngoài nút. */
                          <div
                            key={p.id}
                            className="flex min-w-0 items-center gap-2 rounded-[11px] pr-2.5"
                            style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                          >
                            <button
                              type="button"
                              onClick={() => pickMain(p.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left"
                              aria-pressed={on}
                            >
                              <Package size={19} style={{ flex: "none", color: on ? "var(--ac)" : "var(--tx3)" }} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                                <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                                  {on && edited
                                    ? `Giá bảng giá ${vnd(p.price)} — đang dùng giá sửa`
                                    : [p.category, p.description, p.unit].filter(Boolean).join(" · ") || "Gói trong bảng giá"}
                                </span>
                              </span>
                            </button>
                            {on ? (
                              <span className="flex flex-none items-center gap-1">
                                <MoneyInput
                                  value={priceOf(p)}
                                  onChange={(n) => setPkgPriceFor(p.id, n)}
                                  placeholder="Giá"
                                  ariaLabel={`Giá gói ${p.name}`}
                                  className="tnum w-[112px] rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                                  style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                                />
                                {edited && (
                                  <button
                                    type="button"
                                    onClick={() => clearPkgPrice(p.id)}
                                    aria-label={`Hoàn giá bảng giá cho ${p.name}`}
                                    title={`Hoàn về ${vnd(p.price)}`}
                                    className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                                    style={{ color: "var(--tx3)" }}
                                  >
                                    <RotateCcw size={15} />
                                  </button>
                                )}
                              </span>
                            ) : (
                              <strong className="tnum flex-none whitespace-nowrap text-[13.5px]">{vnd(p.price)}</strong>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <p className={`mb-2 mt-[18px] ${eyebrow}`} style={eyebrowStyle}>Hạng mục thêm</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visiblePackages.filter((p) => p.id !== mainPkgId).map((x) => {
                    const on = extraIds.includes(x.id);
                    const edited = priceEdited(x);
                    return (
                      <div
                        key={x.id}
                        className="flex min-w-0 items-center gap-2 rounded-[10px] pr-2"
                        style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExtra(x.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3.5 text-left"
                          aria-pressed={on}
                        >
                          {on ? <Check size={18} style={{ flex: "none", color: "var(--ac)" }} /> : <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />}
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{x.name}</span>
                        </button>
                        {on ? (
                          <span className="flex flex-none items-center gap-0.5">
                            <MoneyInput
                              value={priceOf(x)}
                              onChange={(n) => setPkgPriceFor(x.id, n)}
                              placeholder="Giá"
                              ariaLabel={`Giá hạng mục ${x.name}`}
                              className="tnum w-[104px] rounded-[8px] px-2 py-1.5 text-right text-[12.5px] font-bold"
                              style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                            />
                            {edited && (
                              <button
                                type="button"
                                onClick={() => clearPkgPrice(x.id)}
                                aria-label={`Hoàn giá bảng giá cho ${x.name}`}
                                title={`Hoàn về ${vnd(x.price)}`}
                                className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
                                style={{ color: "var(--tx3)" }}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </span>
                        ) : (
                          <strong className="tnum flex-none whitespace-nowrap text-[12.5px]">{vnd(x.price)}</strong>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Gói riêng ───────────────────────────────────────────────────
                Gói KHÔNG có trong bảng giá: khách đặt thêm một buổi chụp lạ,
                gộp combo theo thoả thuận riêng, hay thuê một món thiết bị cho
                đúng lần này. Trước đây studio phải tạo hợp đồng rồi mở màn chi
                tiết mới thêm được hạng mục — mà bước Thanh toán ở đây đã chia
                cọc theo tổng, nên cọc chia thiếu ngay từ lúc tạo. Cũng là đường
                đi duy nhất khi bảng giá còn trống. */}
            <div className="mt-[18px]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={eyebrow} style={eyebrowStyle}>Gói riêng (không có trong bảng giá)</p>
                {customLines.length > 0 && (
                  <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>Chỉ dùng cho hợp đồng này</span>
                )}
              </div>
              <div className="grid gap-2">
                {customLines.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-[11px] px-3 py-2.5" style={{ border: "1px solid var(--bd)" }}>
                    <input
                      className="min-w-[150px] flex-1 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold"
                      style={inputStyle}
                      value={c.name}
                      aria-label={`Tên gói riêng ${i + 1}`}
                      placeholder="VD: Chụp thêm buổi ở Đà Lạt"
                      onChange={(e) => patchCustomLine(i, { name: e.target.value })}
                    />
                    <span className="flex flex-none items-center gap-1.5">
                      <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>SL</span>
                      <input
                        type="number"
                        min={1}
                        className="tnum w-[62px] rounded-[8px] px-2 py-2 text-center text-[13px] font-semibold"
                        style={inputStyle}
                        value={c.qty}
                        aria-label={`Số lượng gói riêng ${i + 1}`}
                        onChange={(e) => patchCustomLine(i, { qty: Number(e.target.value) })}
                      />
                    </span>
                    <MoneyInput
                      value={c.unit_price}
                      onChange={(n) => patchCustomLine(i, { unit_price: n })}
                      placeholder="Đơn giá"
                      ariaLabel={`Đơn giá gói riêng ${i + 1}`}
                      className="tnum w-[124px] flex-none rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomLine(i)}
                      aria-label={`Bỏ gói riêng ${i + 1}`}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomLine}
                  className="flex items-center justify-center gap-1.5 rounded-[11px] py-3 text-[12.5px] font-semibold"
                  style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
                >
                  <Plus size={16} /> Nhập gói riêng
                </button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="mt-4 flex items-baseline justify-between rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                <span className="text-[12.5px] font-semibold">{lines.length} hạng mục</span>
                <strong className="tnum text-[17px]" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(total)}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Bước 4 · Lịch & nhân sự ─────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Ngày chụp</label>
                <DateInput value={eventDate} onChange={setEventDate} />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Bắt đầu</label>
                <TimeInput value={startTime} onChange={setStartTime} ariaLabel="Giờ bắt đầu" />
              </div>
              <div>
                <label className={fieldLabel} style={fieldLabelStyle}>Kết thúc</label>
                <TimeInput value={endTime} onChange={setEndTime} ariaLabel="Giờ kết thúc" placeholder="18:00" />
              </div>
            </div>
            <p className="mb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Giờ bắt đầu là giờ của hợp đồng; giờ kết thúc lưu thành ca của từng người được phân công bên dưới.
            </p>
            <div className="mb-4">
              <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-loc">Địa điểm</label>
              <input id="nc-loc" className={inputCls} style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nhà hàng, studio, ngoại cảnh…" />
            </div>

            <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Phân công nhân sự</p>
            {roster.length === 0 ? (
              <div className="rounded-[11px] px-4 py-5 text-center" style={{ border: "1px dashed var(--bd)" }}>
                <p className="text-[13px] font-semibold">Sổ thợ đang trống</p>
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Thêm người vào{" "}
                  <Link href="/dashboard/studio/staff?tab=crew" className="font-semibold underline" style={{ color: "var(--ac)" }}>Đội ngũ</Link>{" "}
                  để phân công ngay tại đây — hoặc phân công sau ở màn chi tiết.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {roster.map((r) => {
                  const on = picked.find((x) => x.id === r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-[11px] px-3 py-2.5"
                      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
                    >
                      <button type="button" onClick={() => toggleCrew(r)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: avatarColor(r.name || r.phone) }}
                        >
                          {initials(r.name || r.phone)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">{r.name || r.phone}</span>
                          <span className="block truncate text-[10.5px]" style={{ color: "var(--tx3)" }}>{crewRoleLabel(r.role, crewRoles)}</span>
                        </span>
                      </button>
                      {on ? (
                        <span className="w-[104px] flex-none">
                          <MoneyInput
                            value={on.salary}
                            onChange={(n) => setCrewSalary(r.id, n)}
                            placeholder="Tiền công"
                            className="w-full rounded-[8px] px-2 py-1.5 text-right text-[12px] tnum"
                          />
                        </span>
                      ) : (
                        <Plus size={18} style={{ flex: "none", color: "var(--tx3)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {picked.length > 0 && (
              <p className="mt-3 text-[12px]" style={{ color: "var(--tx3)" }}>
                {picked.length} người · tiền công <b className="tnum" style={{ color: "var(--tx2)" }}>{vnd(payroll)}</b>
              </p>
            )}
            {conflictBanner && <div className="mt-3 [&>div]:mb-0">{conflictBanner}</div>}
          </div>
        )}

        {/* ── Bước 5 · Thanh toán ─────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="mb-4 grid gap-2">
              {instalments.map((p, i) => {
                const pct = total > 0 ? Math.round((p.amount / total) * 100) : 0;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2.5 rounded-[11px] px-3.5 py-3" style={{ border: "1px solid var(--bd)" }}>
                    <span
                      className="tnum flex h-8 w-11 flex-none items-center justify-center rounded-[8px] text-[12px] font-bold"
                      style={{ background: "var(--acS)", color: "var(--ac)" }}
                    >
                      {pct}%
                    </span>
                    <input
                      className="min-w-[130px] flex-1 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold"
                      style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                      value={p.label}
                      aria-label={`Tên đợt ${i + 1}`}
                      onChange={(e) => patchInstalment(i, { label: e.target.value })}
                    />
                    <span className="w-[140px] flex-none">
                      <DateInput value={p.due} onChange={(v) => patchInstalment(i, { due: v })} />
                    </span>
                    <span className="w-[130px] flex-none">
                      <MoneyInput
                        value={p.amount}
                        onChange={(n) => patchInstalment(i, { amount: n })}
                        placeholder="Số tiền"
                        className="tnum w-full rounded-[8px] px-2.5 py-2 text-right text-[13px] font-bold"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInstalment(i)}
                      aria-label="Bỏ đợt này"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addInstalment}
                className="flex items-center justify-center gap-1.5 rounded-[11px] py-3 text-[12.5px] font-semibold"
                style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
              >
                <Plus size={16} /> Thêm đợt thanh toán
              </button>
              {instalments.length > 1 && total > 0 && (
                <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Sửa tiền cọc (hoặc đợt bất kỳ ở trên) thì <b>đợt cuối tự đổi</b> cho khớp tổng {vnd(total)}.
                </p>
              )}
            </div>

            {planTotal !== total && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--amS)" }}>
                <CircleAlert size={18} style={{ flex: "none", color: "var(--am)" }} />
                <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  Tổng các đợt là <b className="tnum">{vnd(planTotal)}</b>, lệch{" "}
                  <b className="tnum">{vnd(Math.abs(total - planTotal))}</b> so với giá trị hợp đồng{" "}
                  <b className="tnum">{vnd(total)}</b>. Sửa lại nếu không cố ý.
                </p>
              </div>
            )}

            <p className={`mb-2 ${eyebrow}`} style={eyebrowStyle}>Hình thức nhận tiền</p>
            {/* Tài khoản nhận tiền khai ở mục "Thông tin liên hệ" của Gói & bảng
                giá (các cột pl_bank_*), KHÔNG phải /dashboard/settings — trang đó
                là cấu hình nền tảng mstudo và chặn non-admin, nên link cũ đá chủ
                studio về /dashboard. */}
            <div className="flex items-start gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <Landmark size={18} style={{ flex: "none", color: "var(--ac)" }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                {bank?.account
                  ? <>Khách quét mã VietQR hoặc chuyển vào <b>{[bank.name, bank.account, bank.holder].filter(Boolean).join(" · ")}</b>. Mã QR sinh sẵn theo từng đợt trong cổng khách.</>
                  : <>Chưa khai báo tài khoản nhận tiền — cổng khách sẽ không có mã QR. Khai báo trong <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>Gói &amp; bảng giá</Link>.</>}
              </p>
            </div>
          </div>
        )}

        {/* ── Bước 6 · Kiểm tra lần cuối ──────────────────────────────────── */}
        {step === 5 && (
          <div>
            {quick && (
              <div
                className="mb-4 flex gap-2.5 rounded-[11px] px-3.5 py-3"
                style={{ background: quick.missing.length ? "var(--amS)" : "var(--gnS)" }}
              >
                <Sparkles size={18} style={{ flex: "none", marginTop: 1, color: quick.missing.length ? "var(--am)" : "var(--gn)" }} />
                <div className="min-w-0 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  <p className="font-bold" style={{ color: "var(--tx)" }}>
                    {quick.source === "ai" ? "AI đã điền sẵn hợp đồng" : "Đã điền sẵn hợp đồng"} — kiểm tra kỹ trước khi gửi khách.
                  </p>
                  {quick.missing.length > 0 ? (
                    <p>
                      Còn thiếu: <b>{quick.missing.join(", ")}</b>. Bấm vào dòng tương ứng bên dưới để bổ sung.
                    </p>
                  ) : (
                    <p>Đủ các thông tin chính. Bấm vào dòng bất kỳ để sửa.</p>
                  )}
                  {quick.source === "rules" && (
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      Đang dùng bộ đọc cơ bản (chưa cấu hình AI hoặc AI không phản hồi) — câu chữ càng rõ nhãn “Tên: …, SĐT: …” càng chính xác.
                    </p>
                  )}
                </div>
              </div>
            )}
            {conflictBanner}
            {returningHit && <div className="-mt-1 mb-4">{returningBanner}</div>}
            <div className="mb-4 overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              {([
                [1, "Khách hàng", [clientName || "Chưa có tên", clientPhone].filter(Boolean).join(" · ")],
                [0, "Dịch vụ", selectedService?.name || SHOOT_TYPE_LABEL[shootType]],
                // Giá hiện ở đây là giá ĐÃ SỬA, không phải giá bảng giá — nếu
                // in giá niêm yết thì bước soát lại sẽ khẳng định một con số
                // khác với con số thật đang nằm trong hợp đồng.
                [2, "Gói chính", mainPkg ? `${mainPkg.name} · ${vnd(priceOf(mainPkg))}${priceEdited(mainPkg) ? " (đã sửa giá)" : ""}` : template ? `Mẫu: ${template.name}` : "Chưa chọn"],
                [2, "Hạng mục thêm", extras.length ? extras.map((x) => `${x.name} · ${vnd(priceOf(x))}`).join(", ") : "Không có"],
                [2, "Gói riêng", customPreview || "Không có"],
                [3, "Ngày chụp", eventDate ? `${fmtDow(eventDate)} · ${fmtDate(eventDate)}` : "Chưa chọn ngày"],
                [3, "Khung giờ", startTime || endTime ? [startTime, endTime].filter(Boolean).join(" – ") : "Chưa đặt giờ"],
                [3, "Địa điểm", location || "Chưa có"],
                [3, "Nhân sự", picked.length ? picked.map((c) => c.name || c.phone).join(", ") : "Chưa phân công"],
                [4, "Đợt thanh toán", instalments.length ? instalments.map((p) => `${p.label} ${vnd(p.amount)}`).join(" · ") : "Chưa chia đợt"],
              ] as [number, string, string][]).map(([goto, label, value], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(goto)}
                  className="flex w-full items-center gap-3.5 px-4 py-3 text-left"
                  style={{ borderBottom: "1px solid var(--bd2)" }}
                >
                  <span className="w-[110px] flex-none text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>{label}</span>
                  <span className="min-w-0 flex-1 text-[13px] font-semibold">{value}</span>
                  <Pencil size={16} style={{ flex: "none", color: "var(--tx3)" }} />
                </button>
              ))}
            </div>

            <div className="rounded-[12px] px-4 py-4" style={{ border: "1px solid var(--bd)" }}>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 py-1 text-[13px]">
                  <span className="min-w-0 truncate" style={{ color: "var(--tx2)" }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                  <strong className="tnum flex-none">{vnd(l.qty * l.unit_price)}</strong>
                </div>
              ))}
              <div className="mt-1.5 flex items-baseline justify-between pt-2.5" style={{ borderTop: "1px solid var(--bd)" }}>
                <span className="text-[13.5px] font-bold">Tổng hợp đồng</span>
                <strong className="tnum text-[22px]" style={{ color: "var(--ac)", letterSpacing: "-.6px" }}>{vnd(total)}</strong>
              </div>
              <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--bd2)" }}>
                <div className="flex justify-between py-0.5 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>Tiền công nhân sự</span>
                  <strong className="tnum">− {vnd(payroll)}</strong>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between pt-2.5 text-[12.5px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                <span style={{ color: "var(--tx2)" }}>Lợi nhuận dự kiến</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold" style={{ background: marginTone.soft, color: marginTone.fg }}>
                    {marginPct}%
                  </span>
                  <strong className="tnum text-[15px]" style={{ color: marginTone.fg }}>{vnd(profit)}</strong>
                </span>
              </div>
            </div>

            {/* Cảnh báo lãi mỏng — tính năng mới số 3 của bản thiết kế. */}
            {thinMargin && (
              <div
                className="mt-3 flex gap-2.5 rounded-[11px] px-3.5 py-3"
                style={{ background: "var(--rdS)", border: "1px solid color-mix(in srgb, var(--rd) 25%, transparent)" }}
              >
                <AlertTriangle size={18} style={{ flex: "none", color: "var(--rd)", marginTop: 1 }} />
                <div>
                  <p className="text-[13px] font-bold" style={{ color: "var(--rd)" }}>Hợp đồng này lãi mỏng</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                    Biên lợi nhuận chỉ {marginPct}% ({vnd(profit)} trên {vnd(total)}) sau khi trả {vnd(payroll)} tiền công.
                    Chi phí in ấn và phát sinh chưa tính vào đây. Cân nhắc tăng giá hoặc bớt người trước khi gửi khách ký.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3.5 grid gap-2 rounded-[11px] px-3.5 py-3 sm:grid-cols-2" style={{ background: "var(--sf2)" }}>
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-title">Tên hợp đồng</label>
                <input
                  id="nc-title"
                  className={inputCls}
                  style={{ ...inputStyle, background: "var(--sf)" }}
                  placeholder={autoTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} style={fieldLabelStyle} htmlFor="nc-brief">Yêu cầu riêng của khách</label>
                <textarea
                  id="nc-brief"
                  rows={2}
                  className={inputCls}
                  style={{ ...inputStyle, background: "var(--sf)" }}
                  placeholder="Không bắt buộc — VD: cô dâu muốn tông ảnh nhẹ, có 2 bé đi cùng"
                  value={briefNote}
                  onChange={(e) => setBriefNote(e.target.value)}
                />
                <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                  Lưu vào mục Brief — <b>khách xem được</b> trong cổng hợp đồng. Nhận xét nội bộ ghi ở ô dưới.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={`${fieldLabel} flex items-center gap-1`} style={fieldLabelStyle} htmlFor="nc-internal">
                  <Lock size={12} /> Ghi chú nội bộ
                </label>
                <textarea
                  id="nc-internal"
                  rows={2}
                  className={inputCls}
                  style={{ ...inputStyle, background: "var(--sf)" }}
                  placeholder="Chỉ người trong studio thấy — VD: khách quen, đã bớt 1tr; nhớ mang thêm đèn"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                <input type="checkbox" checked={addChecklist} onChange={(e) => setAddChecklist(e.target.checked)} />
                Thêm checklist hậu kỳ mặc định
              </label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  <input type="checkbox" checked={makePhoto} onChange={(e) => setMakePhoto(e.target.checked)} />
                  Tạo thư mục ảnh
                </label>
                <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  <input type="checkbox" checked={makeVideo} onChange={(e) => setMakeVideo(e.target.checked)} />
                  Có quay phim
                </label>
              </div>
            </div>

            {/* Album ảnh của hợp đồng — chỉ nhóm có hậu kỳ ảnh (cùng luật với tab Sản phẩm). */}
            {kindHasPhotoWork(contractKind(shootType)) && (
              <div className="mt-3.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                <p className={fieldLabel} style={fieldLabelStyle}>Album ảnh của hợp đồng</p>
                <AlbumModePicker
                  name="nc-album-mode"
                  value={effectiveAlbumMode}
                  status={albumStatus}
                  onStatus={setAlbumStatus}
                  onChange={(m) => {
                    setAlbumModeTouched(true);
                    setAlbumMode(m);
                  }}
                />
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>
                  Đổi lại được sau ở tab Sản phẩm của hợp đồng.
                </p>
              </div>
            )}

            <div className="mt-3.5 flex gap-2.5 rounded-[11px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <Send size={18} style={{ flex: "none", color: "var(--ac)" }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                Bấm “Tạo &amp; gửi khách ký” sẽ tạo hợp đồng rồi mở thẳng tab gửi khách: chép link cổng, gửi Zalo/Messenger/email.
                Khách mở link bằng số điện thoại của mình, ký điện tử và thấy mã QR chuyển cọc.
              </p>
            </div>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
            {err}
          </p>
        )}
      </div>

      {/* ── Điện thoại: thanh hành động GHIM ĐÁY ────────────────────────────
          Ngồi ngay TRÊN thanh điều hướng đáy của StudioShell (cao 52px + vùng an
          toàn của máy).

          Dùng `sticky` chứ KHÔNG `fixed`: thẻ <main> bao ngoài có
          `overflow-x: clip`, và hiệu ứng vào trang `page-in` chạy transform —
          hai thứ này đều có thể biến một phần tử `fixed` thành neo theo thẻ cha
          thay vì theo màn hình. `sticky` neo theo vùng cuộn nên không dính.
          Phần tử vẫn chiếm chỗ ở CUỐI luồng nên không che mất nội dung nào, và
          khoảng đệm ngay sau nó cho nó chỗ bám tới tận đáy trang (phần tử dính
          chỉ chạy trong hộp NỘI DUNG của thẻ cha, padding không tính). */}
      <div
        className="sticky z-30 sm:hidden"
        style={{ bottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className={`${panel} px-3 py-2.5`}
          style={{ ...panelStyle, boxShadow: "0 -6px 20px rgba(20, 15, 25, .12)" }}
        >
          {actionBar}
        </div>
      </div>
      <div className="h-12 sm:hidden" />
    </div>
  );
}
