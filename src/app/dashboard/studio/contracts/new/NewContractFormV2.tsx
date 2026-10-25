"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarX2,
  Check,
  CircleAlert,
  Info,
  Landmark,
  Lock,
  Package,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
  AlertTriangle,
  History,
  Save,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import MoneyInput from "@/components/MoneyInput";
import AlbumModePicker from "@/components/AlbumModePicker";
import { crewRoleLabel } from "@/lib/crew-roles";
import { SHOOT_TYPE_LABEL, vnd, vndShort, type ShootType } from "@/lib/types";
import { contractKind, kindHasPhotoWork, CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contract-kind";
import { fmtDate, fmtDow } from "@/lib/date";
import { Avatar, Badge, Callout, Empty, Field, Section, Stack, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, SearchInput, Switch } from "@/components/v2/kit-client";
import QuickContractBoxV2 from "./QuickContractBoxV2";
import {
  AddRowButton,
  ChoiceRow,
  HideCreateFab,
  MobileActionBar,
  PriceEditor,
  PriceText,
  RowGroup,
  RowList,
  SubHead,
  SumRow,
} from "./form-v2-parts";
import { STEPS, useNewContractForm, type NewContractFormProps } from "./useNewContractForm";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO HỢP ĐỒNG — giao diện mới. Cùng 6 bước, cùng dữ liệu, cùng luật với bản
   cũ (logic chung ở ./useNewContractForm); khác ở cách sắp xếp:
     • Trái (màn rộng): thanh bước DỌC — mỗi bước kèm một dòng tóm tắt điều đã
       nhập, bấm để quay lại. Màn hẹp hơn: một dải tiến độ gọn ở đầu.
     • Giữa: MỘT khối cho bước đang làm, ô nhập hai cột, báo lỗi ngay dưới ô.
     • Phải (máy tính): thẻ tóm tắt ghim — khách, ngày, hạng mục, tổng, cọc —
       và nút chính duy nhất ("Tiếp: …" / "Tạo & gửi khách ký").
     • Điện thoại: thanh ghim đáy gồm lùi lại · tổng · nút chính.
     • Tạo nhanh bằng AI: một dải mỏng ở bước đầu, bấm mới mở hộp thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

const LAST = STEPS.length - 1;

/** Chữ giữ chỗ ở bảng soát lại (bước Kiểm tra) — hiện nhạt. */
const EMPTY_REVIEW = new Set(["Chưa có tên", "Chưa chọn", "Không có", "Chưa chọn ngày", "Chưa đặt giờ", "Chưa có", "Chưa phân công", "Chưa chia đợt"]);

const fmtPhone = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : s;
};

export default function NewContractFormV2(props: NewContractFormProps) {
  const f = useNewContractForm(props);
  const {
    templates, services, packages, roster, crewRoles, recentClients, bank,
    step, setStep, canNext, phoneOk, clientName, clientPhone, selectedService, shootType, lines, total,
    eventDate, startTime, endTime, location, picked, instalments, saving, err, create,
  } = f;

  /* ── Tóm tắt từng bước (thanh bước + tóm tắt) ───────────────────────────── */
  const stepNote = [
    selectedService?.name || SHOOT_TYPE_LABEL[shootType],
    clientName.trim() || (clientPhone ? fmtPhone(clientPhone) : ""),
    lines.length ? `${lines.length} hạng mục · ${vndShort(total)}` : "",
    eventDate ? [fmtDate(eventDate), picked.length ? `${picked.length} người` : null].filter(Boolean).join(" · ") : "",
    instalments.length ? `${instalments.length} đợt · cọc ${vndShort(instalments[0]?.amount || 0)}` : "",
    "Soát lại rồi tạo",
  ];

  /* Bước hiện tại chưa đủ để đi tiếp → nói rõ thiếu gì (nút chính đang mờ). */
  const blockReason = canNext
    ? null
    : step === 1
      ? "Nhập số điện thoại đủ 10 số để đi tiếp."
      : step === 2
        ? "Chọn một gói (hoặc nhập gói riêng) để đi tiếp."
        : null;

  const marginKey: Tone = total <= 0 ? "gray" : f.marginPct < 45 ? "red" : f.marginPct < 60 ? "amber" : "green";
  const deposit = instalments[0]?.amount ?? 0;

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => setStep((s) => s - 1);

  /* ── Nút chính: một chỗ, đặt ở thẻ tóm tắt (máy tính) và thanh đáy (điện thoại) ── */
  const primary = (compact: boolean) =>
    step < LAST ? (
      <button type="button" className={btn("primary", compact ? "md" : "lg", compact ? "" : "w-full")} onClick={goNext} disabled={!canNext}>
        {compact ? "Tiếp tục" : `Tiếp: ${STEPS[step + 1].label}`} <ArrowRight size={17} />
      </button>
    ) : (
      <button type="button" className={btn("primary", compact ? "md" : "lg", compact ? "" : "w-full")} onClick={() => create("send")} disabled={!!saving}>
        <Send size={16} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách ký"}
      </button>
    );

  const saveDraftItem = {
    label: saving === "draft" ? "Đang lưu…" : "Lưu nháp",
    icon: Save,
    onClick: () => create("draft"),
    disabled: !!saving || !phoneOk,
    hint: phoneOk ? "Tạo hợp đồng nháp rồi mở màn chi tiết" : "Cần SĐT khách đủ 10 số",
  };

  /* ── Thông báo dùng ở nhiều bước ─────────────────────────────────────────── */
  const returningCallout = f.returningHit ? (
    <Callout
      tone="blue"
      icon={History}
      title="Khách cũ"
      action={
        f.savedNameDiffers ? (
          <button type="button" className={btn("secondary", "sm")} onClick={() => f.setClientName(f.returningHit!.name)}>
            Dùng tên đã lưu
          </button>
        ) : null
      }
    >
      Đã có {f.returningHit.count} hợp đồng
      {f.returningHit.name ? <> với tên <b style={{ color: "var(--tx)" }}>{f.returningHit.name}</b></> : null}
      {f.returningHit.last ? <>, show gần nhất {fmtDate(f.returningHit.last)}</> : null}.
    </Callout>
  ) : null;

  const overlap = f.clashes.some((c) => c.overlap);
  const conflictCallout =
    f.clashes.length > 0 || f.sameDay.length > 0 ? (
      <Callout
        tone={overlap ? "red" : "amber"}
        icon={CalendarX2}
        title={f.clashes.length > 0 ? "Nhân sự có thể trùng lịch" : "Ngày này đã có show khác"}
      >
        {f.clashes.length > 0 ? (
          <ul className="mt-0.5 space-y-0.5">
            {f.clashes.map((c, i) => (
              <li key={i}>
                <b style={{ color: "var(--tx)" }}>{c.crewName}</b> {c.overlap ? "đang đi" : "cũng có mặt ở"}{" "}
                <Link href={`/dashboard/studio/contracts/${c.contract.id}`} className="font-semibold underline" target="_blank">
                  {c.contract.code || c.contract.title || "hợp đồng khác"}
                </Link>
                {c.contract.client_name ? ` (${c.contract.client_name})` : ""} · {c.otherTime}
                {!c.overlap && " — chưa đủ giờ để so, kiểm tra lại"}
              </li>
            ))}
          </ul>
        ) : null}
        {f.sameDay.length > 0 ? (
          <p className={f.clashes.length ? "mt-1" : ""}>
            {f.sameDay.length} hợp đồng {f.clashes.length ? "khác " : ""}cùng ngày:{" "}
            {f.sameDay
              .slice(0, 4)
              .map((c) => [c.code || c.title, c.client_name, c.event_time?.slice(0, 5)].filter(Boolean).join(" · "))
              .join("; ")}
            {f.sameDay.length > 4 ? `; +${f.sameDay.length - 4}` : ""}
          </p>
        ) : null}
      </Callout>
    ) : null;

  /* ═══ Nội dung từng bước ═══════════════════════════════════════════════════ */
  const stepBody = (() => {
    switch (step) {
      /* ── 1 · Loại dịch vụ ─────────────────────────────────────────────── */
      case 0:
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Loại dịch vụ"
              htmlFor="nc2-shoot"
              hint={<>Nhóm <b>{CONTRACT_KIND_LABEL[contractKind(shootType)]}</b> — hạng mục gợi ý và việc cần làm đổi theo nhóm này.</>}
            >
              <select id="nc2-shoot" className={inputCls} value={shootType} onChange={(e) => f.setShootType(e.target.value as ShootType)}>
                {(Object.keys(f.nhomDichVu) as ContractKind[]).map((k) => (
                  <optgroup key={k} label={CONTRACT_KIND_LABEL[k]}>
                    {f.nhomDichVu[k].map((t) => (
                      <option key={t} value={t}>{SHOOT_TYPE_LABEL[t]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {services.length > 0 && (
              <Field label="Điều khoản áp dụng" htmlFor="nc2-svc" hint="Quyết định điều khoản in vào hợp đồng và bảng giá hiện ở bước Gói dịch vụ.">
                <select id="nc2-svc" className={inputCls} value={f.serviceId} onChange={(e) => f.changeService(e.target.value)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {templates.length > 0 && (
              <Field label="Tạo từ mẫu hợp đồng" htmlFor="nc2-tpl" hint="Kéo sẵn hạng mục của mẫu vào hợp đồng." className="sm:col-span-2">
                <select id="nc2-tpl" className={inputCls} value={f.templateId} onChange={(e) => f.pickTemplate(e.target.value)}>
                  <option value="">— Không dùng mẫu —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.contract_template_items?.length || 0} hạng mục)
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        );

      /* ── 2 · Khách hàng ───────────────────────────────────────────────── */
      case 1:
        return (
          <Stack gap={18}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên khách hàng" htmlFor="nc2-name">
                <input id="nc2-name" className={inputCls} placeholder="Nguyễn Văn A" value={clientName} onChange={(e) => f.setClientName(e.target.value)} />
              </Field>
              <Field
                label="Số điện thoại"
                htmlFor="nc2-phone"
                error={clientPhone && !phoneOk ? "SĐT phải đủ 10 số — khách dùng chính số này làm mật khẩu mở cổng hợp đồng." : undefined}
                hint="Khách dùng số này để mở cổng hợp đồng."
              >
                <input
                  id="nc2-phone"
                  className={inputCls}
                  style={clientPhone && !phoneOk ? { borderColor: "var(--rd)" } : undefined}
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="0901234567"
                  value={clientPhone}
                  aria-invalid={!!clientPhone && !phoneOk}
                  onChange={(e) => f.setClientPhone(e.target.value)}
                />
              </Field>
            </div>
            {returningCallout}

            {recentClients.length > 0 && (
              <div>
                <SubHead title="Hoặc chọn khách cũ" aside={`${recentClients.length} khách gần đây`} />
                <SearchInput value={f.clientQuery} onChange={f.setClientQuery} placeholder="Tìm theo tên hoặc số điện thoại…" className="mb-2.5" />
                {f.filteredClients.length === 0 ? (
                  <p className="rounded-[12px] px-3.5 py-3 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                    Không có khách cũ nào khớp “{f.clientQuery}” — cứ gõ thẳng vào hai ô trên.
                  </p>
                ) : (
                  <RowList>
                    {f.filteredClients.map((c) => {
                      const on = !!c.phone && clientPhone.replace(/\D/g, "") === c.phone.replace(/\D/g, "");
                      return (
                        <button
                          key={`${c.phone}-${c.name}`}
                          type="button"
                          onClick={() => f.pickClient(c)}
                          aria-pressed={on}
                          className="flex w-full min-w-0 items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--sf2)]"
                          style={on ? { background: "color-mix(in srgb, var(--ac) 6%, var(--sf))" } : undefined}
                        >
                          <Avatar name={c.name} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{c.name}</span>
                            <span className="block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                              {[c.phone ? fmtPhone(c.phone) : "chưa có SĐT", `${c.count} hợp đồng`, c.last ? `gần nhất ${fmtDate(c.last)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          {on ? <Check size={18} style={{ flex: "none", color: "var(--ac)" }} /> : null}
                        </button>
                      );
                    })}
                  </RowList>
                )}
              </div>
            )}
          </Stack>
        );

      /* ── 3 · Gói dịch vụ ──────────────────────────────────────────────── */
      case 2:
        return (
          <Stack gap={22}>
            {packages.length === 0 ? (
              <div className="rounded-[12px]" style={{ border: "1px dashed var(--bd)" }}>
                <Empty
                  compact
                  icon={Package}
                  title="Bảng giá đang trống"
                  hint={
                    <>
                      Thêm gói vào{" "}
                      <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>bảng giá</Link>{" "}
                      để chọn nhanh ở đây — hoặc dùng mẫu hợp đồng, hoặc nhập <b>gói riêng</b> ngay bên dưới.
                    </>
                  }
                />
              </div>
            ) : (
              <>
                <div>
                  <SubHead
                    title="Gói chính"
                    aside={
                      f.serviceListKeys ? (
                        <button type="button" onClick={() => f.setShowAllLists((v) => !v)} className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--ac)" }}>
                          {f.filteringLists ? `Đang lọc theo ${selectedService?.name ?? "dịch vụ"} · Xem tất cả` : "Chỉ hiện bảng giá của dịch vụ này"}
                        </button>
                      ) : null
                    }
                  />
                  <RowList>
                    {f.packageGroups.map(([key, list]) => (
                      <div key={key} className="min-w-0 [&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]">
                        {f.packageGroups.length > 1 && <RowGroup>{f.listLabel(key)}</RowGroup>}
                        {list.map((p) => {
                          const on = f.mainPkgId === p.id;
                          const edited = f.priceEdited(p);
                          return (
                            <ChoiceRow
                              key={p.id}
                              mode="radio"
                              on={on}
                              onToggle={() => f.pickMain(p.id)}
                              title={p.name}
                              sub={
                                on && edited
                                  ? `Giá bảng giá ${vnd(p.price)} — đang dùng giá đã sửa`
                                  : [p.category, p.description?.split("\n")[0], p.unit].filter(Boolean).join(" · ") || "Gói trong bảng giá"
                              }
                              right={
                                on ? (
                                  <PriceEditor
                                    value={f.priceOf(p)}
                                    onChange={(n) => f.setPkgPriceFor(p.id, n)}
                                    edited={edited}
                                    onReset={() => f.clearPkgPrice(p.id)}
                                    listPrice={p.price}
                                    ariaLabel={`Giá gói ${p.name}`}
                                  />
                                ) : (
                                  <PriceText value={p.price} />
                                )
                              }
                            />
                          );
                        })}
                      </div>
                    ))}
                  </RowList>
                  <p className="mt-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Đã thương lượng khác bảng giá? Chọn gói rồi <b style={{ color: "var(--tx2)" }}>sửa thẳng ô giá</b> — bảng giá gốc không đổi.
                  </p>
                </div>

                {f.visiblePackages.some((p) => p.id !== f.mainPkgId) && (
                  <div>
                    <SubHead title="Hạng mục thêm" aside={f.extraIds.length ? `Đã chọn ${f.extraIds.length}` : "Tick để cộng thêm"} />
                    <RowList>
                      {f.visiblePackages
                        .filter((p) => p.id !== f.mainPkgId)
                        .map((x) => {
                          const on = f.extraIds.includes(x.id);
                          return (
                            <ChoiceRow
                              key={x.id}
                              mode="check"
                              on={on}
                              onToggle={() => f.toggleExtra(x.id)}
                              title={x.name}
                              sub={f.packageGroups.length > 1 ? f.listLabel(x.list_key || "khac") : x.category || undefined}
                              right={
                                on ? (
                                  <PriceEditor
                                    value={f.priceOf(x)}
                                    onChange={(n) => f.setPkgPriceFor(x.id, n)}
                                    edited={f.priceEdited(x)}
                                    onReset={() => f.clearPkgPrice(x.id)}
                                    listPrice={x.price}
                                    ariaLabel={`Giá hạng mục ${x.name}`}
                                  />
                                ) : (
                                  <PriceText value={x.price} muted />
                                )
                              }
                            />
                          );
                        })}
                    </RowList>
                  </div>
                )}
              </>
            )}

            {/* Gói riêng — hạng mục gõ tay cho đúng hợp đồng này. */}
            <div>
              <SubHead title="Gói riêng" aside="Không có trong bảng giá · chỉ dùng cho hợp đồng này" />
              <div className="grid gap-2">
                {f.customLines.length > 0 && (
                  <RowList>
                    {f.customLines.map((c, i) => (
                      <div key={i} className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_64px_132px_auto]">
                        <input
                          className={`${inputCls} col-span-3 sm:col-span-1`}
                          value={c.name}
                          aria-label={`Tên gói riêng ${i + 1}`}
                          placeholder="VD: Chụp thêm buổi ở Đà Lạt"
                          onChange={(e) => f.patchCustomLine(i, { name: e.target.value })}
                        />
                        <input
                          type="number"
                          min={1}
                          className={`${inputCls} tnum text-center`}
                          value={c.qty}
                          aria-label={`Số lượng gói riêng ${i + 1}`}
                          title="Số lượng"
                          onChange={(e) => f.patchCustomLine(i, { qty: Number(e.target.value) })}
                        />
                        <MoneyInput
                          value={c.unit_price}
                          onChange={(n) => f.patchCustomLine(i, { unit_price: n })}
                          placeholder="Đơn giá"
                          ariaLabel={`Đơn giá gói riêng ${i + 1}`}
                          className={`${inputCls} tnum text-right font-semibold`}
                        />
                        <button type="button" onClick={() => f.removeCustomLine(i)} aria-label={`Bỏ gói riêng ${i + 1}`} className={iconBtn()}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </RowList>
                )}
                <AddRowButton onClick={f.addCustomLine}>
                  <Plus size={16} /> Nhập gói riêng
                </AddRowButton>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="flex items-baseline justify-between rounded-[12px] px-4 py-3" style={{ background: "var(--sf2)" }}>
                <span className="text-[13px] font-medium" style={{ color: "var(--tx2)" }}>{lines.length} hạng mục trong hợp đồng</span>
                <strong className="tnum text-[18px]" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(total)}</strong>
              </div>
            )}
          </Stack>
        );

      /* ── 4 · Lịch & nhân sự ───────────────────────────────────────────── */
      case 3:
        return (
          <Stack gap={20}>
            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Ngày chụp" className="col-span-2 sm:col-span-1">
                  <DateInput value={eventDate} onChange={f.setEventDate} className={inputCls} />
                </Field>
                <Field label="Bắt đầu">
                  <TimeInput value={startTime} onChange={f.setStartTime} ariaLabel="Giờ bắt đầu" className={inputCls} />
                </Field>
                <Field label="Kết thúc">
                  <TimeInput value={endTime} onChange={f.setEndTime} ariaLabel="Giờ kết thúc" placeholder="18:00" className={inputCls} />
                </Field>
              </div>
              <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                Giờ bắt đầu là giờ của hợp đồng; giờ kết thúc lưu thành ca của từng người được phân công bên dưới.
              </p>
            </div>
            <Field label="Địa điểm" htmlFor="nc2-loc">
              <input id="nc2-loc" className={inputCls} value={location} onChange={(e) => f.setLocation(e.target.value)} placeholder="Nhà hàng, studio, ngoại cảnh…" />
            </Field>

            {conflictCallout}

            <div>
              <SubHead
                title="Phân công nhân sự"
                aside={picked.length > 0 ? <>{picked.length} người · tiền công <b className="tnum" style={{ color: "var(--tx2)" }}>{vnd(f.payroll)}</b></> : "Bấm để chọn người đi"}
              />
              {roster.length === 0 ? (
                <div className="rounded-[12px]" style={{ border: "1px dashed var(--bd)" }}>
                  <Empty
                    compact
                    icon={Users}
                    title="Sổ thợ đang trống"
                    hint={
                      <>
                        Thêm người vào{" "}
                        <Link href="/dashboard/studio/staff?tab=crew" className="font-semibold underline" style={{ color: "var(--ac)" }}>Đội ngũ</Link>{" "}
                        để phân công ngay tại đây — hoặc phân công sau ở màn chi tiết.
                      </>
                    }
                  />
                </div>
              ) : (
                <RowList>
                  {roster.map((r) => {
                    const on = picked.find((x) => x.id === r.id);
                    return (
                      <div
                        key={r.id}
                        className="flex min-w-0 items-center gap-2 pr-3"
                        style={on ? { background: "color-mix(in srgb, var(--ac) 6%, var(--sf))" } : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => f.toggleCrew(r)}
                          aria-pressed={!!on}
                          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ac)]"
                        >
                          <Avatar name={r.name || r.phone} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{r.name || r.phone}</span>
                            <span className="block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{crewRoleLabel(r.role, crewRoles)}</span>
                          </span>
                          {/* Đã chọn: nền nhạt + ô tiền công đủ nói lên điều đó — điện thoại bỏ dấu ✓ để tên khỏi bị cắt. */}
                          {on ? <Check size={17} className="hidden sm:block" style={{ flex: "none", color: "var(--ac)" }} /> : <Plus size={17} style={{ flex: "none", color: "var(--tx3)" }} />}
                        </button>
                        {on ? (
                          <MoneyInput
                            value={on.salary}
                            onChange={(n) => f.setCrewSalary(r.id, n)}
                            placeholder="Tiền công"
                            ariaLabel={`Tiền công ${r.name || r.phone}`}
                            className={`${inputCls} tnum flex-none text-right`}
                            style={{ width: 120, height: 34 }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </RowList>
              )}
            </div>
          </Stack>
        );

      /* ── 5 · Thanh toán ───────────────────────────────────────────────── */
      case 4:
        return (
          <Stack gap={20}>
            <div className="grid gap-2">
              {instalments.length > 0 && (
                <RowList>
                  {instalments.map((p, i) => {
                    const pct = total > 0 ? Math.round((p.amount / total) * 100) : 0;
                    return (
                      /* Hai dòng: tên đợt + số tiền ở trên (thứ hay sửa), hạn thu ở dưới.
                         Điện thoại: tên đợt một mình một dòng, hạn thu + số tiền dòng dưới. */
                      <div
                        key={i}
                        className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 px-3 py-3 [grid-template-areas:'pct_label_label_del'_'due_due_amt_amt'] md:grid-cols-[48px_minmax(0,1fr)_150px_auto] md:[grid-template-areas:'pct_label_amt_del'_'._due_._.']"
                      >
                        <span className="tnum flex h-[38px] items-center justify-center rounded-[10px] text-[12.5px] font-bold [grid-area:pct]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                          {pct}%
                        </span>
                        <input className={`${inputCls} font-medium [grid-area:label]`} value={p.label} aria-label={`Tên đợt ${i + 1}`} onChange={(e) => f.patchInstalment(i, { label: e.target.value })} />
                        <MoneyInput
                          value={p.amount}
                          onChange={(n) => f.patchInstalment(i, { amount: n })}
                          placeholder="Số tiền"
                          ariaLabel={`Số tiền đợt ${i + 1}`}
                          className={`${inputCls} tnum text-right font-semibold [grid-area:amt]`}
                        />
                        <button type="button" onClick={() => f.removeInstalment(i)} aria-label="Bỏ đợt này" className={`${iconBtn()} [grid-area:del]`}>
                          <Trash2 size={16} />
                        </button>
                        <DateInput
                          value={p.due}
                          onChange={(v) => f.patchInstalment(i, { due: v })}
                          className={inputCls}
                          wrapperClassName="[grid-area:due] md:max-w-[220px]"
                          placeholder="Hạn thu"
                        />
                      </div>
                    );
                  })}
                </RowList>
              )}
              <AddRowButton onClick={f.addInstalment}>
                <Plus size={16} /> Thêm đợt thanh toán
              </AddRowButton>
              {instalments.length > 1 && total > 0 && (
                <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                  Sửa tiền cọc (hoặc đợt bất kỳ ở trên) thì <b style={{ color: "var(--tx2)" }}>đợt cuối tự đổi</b> cho khớp tổng {vnd(total)}.
                </p>
              )}
            </div>

            {f.planTotal !== total && (
              <Callout tone="amber" icon={CircleAlert} title="Tổng các đợt chưa khớp hợp đồng">
                Tổng các đợt là <b className="tnum">{vnd(f.planTotal)}</b>, lệch <b className="tnum">{vnd(Math.abs(total - f.planTotal))}</b> so với giá trị hợp đồng{" "}
                <b className="tnum">{vnd(total)}</b>. Sửa lại nếu không cố ý.
              </Callout>
            )}

            <div>
              <SubHead title="Hình thức nhận tiền" />
              <div className="flex items-start gap-3 rounded-[12px] px-4 py-3" style={{ background: "var(--sf2)" }}>
                <Landmark size={18} style={{ flex: "none", color: "var(--ac)", marginTop: 1 }} />
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  {bank?.account ? (
                    <>
                      Khách quét mã VietQR hoặc chuyển vào <b style={{ color: "var(--tx)" }}>{[bank.name, bank.account, bank.holder].filter(Boolean).join(" · ")}</b>. Mã QR sinh sẵn theo từng đợt trong cổng khách.
                    </>
                  ) : (
                    <>
                      Chưa khai báo tài khoản nhận tiền — cổng khách sẽ không có mã QR. Khai báo trong{" "}
                      <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>Gói &amp; bảng giá</Link>.
                    </>
                  )}
                </p>
              </div>
            </div>
          </Stack>
        );

      /* ── 6 · Kiểm tra ─────────────────────────────────────────────────── */
      default:
        return (
          <Stack gap={20}>
            {f.quick && (
              <Callout
                tone={f.quick.missing.length ? "amber" : "green"}
                icon={Sparkles}
                title={`${f.quick.source === "ai" ? "AI đã điền sẵn hợp đồng" : "Đã điền sẵn hợp đồng"} — kiểm tra kỹ trước khi gửi khách.`}
              >
                {f.quick.missing.length > 0 ? (
                  <p>Còn thiếu: <b style={{ color: "var(--tx)" }}>{f.quick.missing.join(", ")}</b>. Bấm vào dòng tương ứng bên dưới để bổ sung.</p>
                ) : (
                  <p>Đủ các thông tin chính. Bấm vào dòng bất kỳ để sửa.</p>
                )}
                {f.quick.source === "rules" && (
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                    Đang dùng bộ đọc cơ bản (chưa cấu hình AI hoặc AI không phản hồi) — câu chữ càng rõ nhãn “Tên: …, SĐT: …” càng chính xác.
                  </p>
                )}
              </Callout>
            )}
            {conflictCallout}
            {returningCallout}

            <RowList>
              {([
                [1, "Khách hàng", [clientName || "Chưa có tên", clientPhone].filter(Boolean).join(" · ")],
                [0, "Dịch vụ", selectedService?.name || SHOOT_TYPE_LABEL[shootType]],
                // Giá ở đây là giá ĐÃ SỬA (con số thật trong hợp đồng), không phải giá bảng giá.
                [2, "Gói chính", f.mainPkg ? `${f.mainPkg.name} · ${vnd(f.priceOf(f.mainPkg))}${f.priceEdited(f.mainPkg) ? " (đã sửa giá)" : ""}` : f.template ? `Mẫu: ${f.template.name}` : "Chưa chọn"],
                [2, "Hạng mục thêm", f.extras.length ? f.extras.map((x) => `${x.name} · ${vnd(f.priceOf(x))}`).join(", ") : "Không có"],
                [2, "Gói riêng", f.customPreview || "Không có"],
                [3, "Ngày chụp", eventDate ? `${fmtDow(eventDate)} · ${fmtDate(eventDate)}` : "Chưa chọn ngày"],
                [3, "Khung giờ", startTime || endTime ? [startTime, endTime].filter(Boolean).join(" – ") : "Chưa đặt giờ"],
                [3, "Địa điểm", location || "Chưa có"],
                [3, "Nhân sự", picked.length ? picked.map((c) => c.name || c.phone).join(", ") : "Chưa phân công"],
                [4, "Đợt thanh toán", instalments.length ? instalments.map((p) => `${p.label} ${vnd(p.amount)}`).join(" · ") : "Chưa chia đợt"],
              ] as [number, string, string][]).map(([goto, label, value], i) => {
                // Chữ giữ chỗ (chưa nhập gì) thì nhạt đi — có dữ liệu thật thì đậm.
                const empty = EMPTY_REVIEW.has(value);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(goto)}
                    className="group flex w-full min-w-0 items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--sf2)]"
                  >
                    <span className="w-[104px] flex-none pt-px text-[12.5px] sm:w-[120px]" style={{ color: "var(--tx3)" }}>{label}</span>
                    <span className="min-w-0 flex-1 break-words text-[13.5px]" style={{ color: empty ? "var(--tx3)" : "var(--tx)", fontWeight: empty ? 400 : 500 }}>
                      {value}
                    </span>
                    <Pencil size={15} className="mt-0.5 flex-none opacity-50 transition-opacity group-hover:opacity-100" style={{ color: "var(--tx3)" }} />
                  </button>
                );
              })}
            </RowList>

            <div className="rounded-[12px] px-4 py-3.5" style={{ border: "1px solid var(--bd)" }}>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 py-1 text-[13.5px]">
                  <span className="min-w-0 truncate" style={{ color: "var(--tx2)" }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                  <span className="tnum flex-none font-medium">{vnd(l.qty * l.unit_price)}</span>
                </div>
              ))}
              <div className={lines.length ? "mt-2 border-t pt-2" : ""} style={{ borderColor: "var(--bd)" }}>
                <SumRow label="Tổng hợp đồng" value={vnd(total)} strong />
              </div>
              <div className="mt-1.5 border-t border-dashed pt-1.5" style={{ borderColor: "var(--bd)" }}>
                <SumRow label="Tiền công nhân sự" value={`− ${vnd(f.payroll)}`} />
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[13px]" style={{ color: "var(--tx2)" }}>Lợi nhuận dự kiến</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={marginKey}>{f.marginPct}%</Badge>
                    <strong className="tnum text-[15px]" style={{ color: f.marginTone.fg }}>{vnd(f.profit)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {f.thinMargin && (
              <Callout tone="red" icon={AlertTriangle} title="Hợp đồng này lãi mỏng">
                Biên lợi nhuận chỉ {f.marginPct}% ({vnd(f.profit)} trên {vnd(total)}) sau khi trả {vnd(f.payroll)} tiền công. Chi phí in ấn và phát sinh chưa tính vào
                đây. Cân nhắc tăng giá hoặc bớt người trước khi gửi khách ký.
              </Callout>
            )}
          </Stack>
        );
    }
  })();

  /* Khối "Tuỳ chọn khi tạo" — chỉ ở bước Kiểm tra, tách thành khối riêng cho gọn. */
  const optionsSection =
    step === LAST ? (
      <Section title="Tuỳ chọn khi tạo" desc="Không bắt buộc — để trống thì dùng mặc định." icon={Pencil}>
        <Stack gap={16}>
          <Field label="Tên hợp đồng" htmlFor="nc2-title" hint="Để trống thì tự đặt theo dịch vụ và ngày chụp.">
            <input id="nc2-title" className={inputCls} placeholder={f.autoTitle} value={f.title} onChange={(e) => f.setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Yêu cầu riêng của khách"
              htmlFor="nc2-brief"
              hint={<>Lưu vào mục Brief — <b>khách xem được</b> trong cổng hợp đồng.</>}
            >
              <textarea
                id="nc2-brief"
                rows={3}
                className={inputCls}
                placeholder="VD: cô dâu muốn tông ảnh nhẹ, có 2 bé đi cùng"
                value={f.briefNote}
                onChange={(e) => f.setBriefNote(e.target.value)}
              />
            </Field>
            <Field
              label={<span className="inline-flex items-center gap-1.5"><Lock size={13} /> Ghi chú nội bộ</span>}
              htmlFor="nc2-internal"
              hint="Chỉ người trong studio thấy."
            >
              <textarea
                id="nc2-internal"
                rows={3}
                className={inputCls}
                placeholder="VD: khách quen, đã bớt 1tr; nhớ mang thêm đèn"
                value={f.internalNote}
                onChange={(e) => f.setInternalNote(e.target.value)}
              />
            </Field>
          </div>
          <div className="rounded-[12px] px-4 py-1" style={{ border: "1px solid var(--bd)" }}>
            <Switch checked={f.addChecklist} onChange={f.setAddChecklist} label="Thêm checklist hậu kỳ mặc định" desc="Việc cần làm gieo sẵn theo nhóm dịch vụ" />
            <div style={{ borderTop: "1px solid var(--bd2)" }} />
            <Switch checked={f.makePhoto} onChange={f.setMakePhoto} label="Tạo thư mục ảnh" />
            <div style={{ borderTop: "1px solid var(--bd2)" }} />
            <Switch checked={f.makeVideo} onChange={f.setMakeVideo} label="Có quay phim" />
          </div>
          {kindHasPhotoWork(contractKind(shootType)) && (
            <Field label="Album ảnh của hợp đồng" hint="Đổi lại được sau ở tab Sản phẩm của hợp đồng.">
              <AlbumModePicker
                name="nc2-album-mode"
                value={f.effectiveAlbumMode}
                status={f.albumStatus}
                onStatus={f.setAlbumStatus}
                onChange={(m) => {
                  f.setAlbumModeTouched(true);
                  f.setAlbumMode(m);
                }}
              />
            </Field>
          )}
          <Callout tone="brand" icon={Send}>
            Bấm “Tạo &amp; gửi khách ký” sẽ tạo hợp đồng rồi mở thẳng tab gửi khách: chép link cổng, gửi Zalo/Messenger/email. Khách mở link bằng số điện
            thoại của mình, ký điện tử và thấy mã QR chuyển cọc.
          </Callout>
        </Stack>
      </Section>
    ) : null;

  /* ═══ Thanh bước dọc (màn rộng) ═══════════════════════════════════════════ */
  const stepRail = (
    <nav aria-label="Các bước tạo hợp đồng" className="v2-card p-2">
      <ol>
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const reachable = i <= step;
          return (
            <li key={s.label} className="relative">
              {i < LAST && (
                <span
                  aria-hidden
                  className="absolute left-[25px] top-[42px] w-[2px] rounded-full"
                  style={{ bottom: -6, background: i < step ? "var(--ac)" : "var(--bd2)" }}
                />
              )}
              <button
                type="button"
                onClick={() => reachable && setStep(i)}
                disabled={!reachable}
                aria-current={current ? "step" : undefined}
                className="flex w-full items-start gap-3 rounded-[11px] px-2.5 py-2.5 text-left transition-colors enabled:hover:bg-[var(--sf2)] disabled:cursor-default"
                style={current ? { background: "var(--acS)" } : undefined}
              >
                <span
                  className="tnum relative z-[1] flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={
                    done
                      ? { background: "var(--ac)", color: "#fff" }
                      : current
                        ? { background: "var(--ac)", color: "#fff", boxShadow: "0 0 0 4px var(--acM)" }
                        : { background: "var(--sf)", color: "var(--tx3)", border: "1.5px solid var(--bd)" }
                  }
                >
                  {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 pt-[3px]">
                  <span className="block text-[13.5px]" style={{ color: current ? "var(--ac)" : reachable ? "var(--tx)" : "var(--tx3)", fontWeight: current ? 650 : 550 }}>
                    {s.label}
                  </span>
                  {reachable && stepNote[i] && i !== LAST ? (
                    <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--tx3)" }}>{stepNote[i]}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 border-t px-1 pt-1.5" style={{ borderColor: "var(--bd2)" }}>
        <Link href="/dashboard/studio/contracts" className={btn("ghost", "sm", "w-full justify-start")}>
          <X size={15} /> Huỷ, về danh sách
        </Link>
      </div>
    </nav>
  );

  /* ═══ Dải tiến độ gọn (màn hẹp) ═══════════════════════════════════════════ */
  const stepBar = (
    <div className="v2-card px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">
          <span className="tnum mr-1.5 font-medium" style={{ color: "var(--tx3)" }}>Bước {step + 1}/{STEPS.length}</span>
          {STEPS[step].label}
        </p>
        <Menu
          label="Thao tác khác"
          items={[saveDraftItem, "divider", { label: "Huỷ, về danh sách", icon: X, href: "/dashboard/studio/contracts" }]}
        />
      </div>
      <div className="mt-2 flex gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => i <= step && setStep(i)}
            disabled={i > step}
            aria-label={`Bước ${i + 1}: ${s.label}`}
            aria-current={i === step ? "step" : undefined}
            className="flex h-4 flex-1 items-center disabled:cursor-default"
          >
            <span className="h-[5px] w-full rounded-full" style={{ background: i <= step ? "var(--ac)" : "var(--bd2)", opacity: i < step ? 0.55 : 1 }} />
          </button>
        ))}
      </div>
    </div>
  );

  /* ═══ Thẻ tóm tắt (máy tính) ══════════════════════════════════════════════ */
  const shownLines = lines.slice(0, 4);
  const summary = (
    <aside className="v2-card overflow-hidden" aria-label="Tóm tắt hợp đồng">
      <div className="flex items-center gap-2 px-5 pb-3 pt-4">
        <h3 className="flex-1 text-[15px] font-semibold">Tóm tắt</h3>
        <Badge tone="gray">Nháp</Badge>
      </div>

      <div className="px-5 pb-3">
        {clientName.trim() || clientPhone ? (
          <div className="flex items-center gap-3">
            <Avatar name={clientName || clientPhone} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{clientName.trim() || "Chưa có tên"}</p>
              <p className="truncate text-[12.5px]" style={{ color: clientPhone && !phoneOk ? "var(--rd)" : "var(--tx3)" }}>
                {clientPhone ? fmtPhone(clientPhone) : "Chưa có SĐT"}
                {f.returningHit ? " · khách cũ" : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có khách hàng</p>
        )}
      </div>

      <dl className="space-y-1.5 border-t px-5 py-3 text-[13px]" style={{ borderColor: "var(--bd2)" }}>
        {[
          ["Dịch vụ", selectedService?.name || SHOOT_TYPE_LABEL[shootType]],
          ["Ngày chụp", eventDate ? `${fmtDow(eventDate)} · ${fmtDate(eventDate)}${startTime ? ` · ${startTime}` : ""}` : null],
          ["Địa điểm", location.trim() || null],
          ["Nhân sự", picked.length ? `${picked.length} người` : null],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-[74px] flex-none" style={{ color: "var(--tx3)" }}>{k}</dt>
            <dd className="min-w-0 flex-1 truncate text-right" style={{ color: v ? "var(--tx)" : "var(--tx3)", fontWeight: v ? 500 : 400 }}>{v || "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t px-5 py-3" style={{ borderColor: "var(--bd2)" }}>
        {lines.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có hạng mục nào</p>
        ) : (
          <>
            {shownLines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-0.5 text-[13px]">
                <span className="min-w-0 truncate" style={{ color: "var(--tx2)" }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                <span className="tnum flex-none">{vnd(l.qty * l.unit_price)}</span>
              </div>
            ))}
            {lines.length > shownLines.length && (
              <p className="pt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>+ {lines.length - shownLines.length} hạng mục khác</p>
            )}
          </>
        )}
        <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--bd2)" }}>
          <SumRow label="Tổng hợp đồng" value={vnd(total)} strong />
          {deposit > 0 && <SumRow label={instalments[0]?.label || "Cọc"} value={vnd(deposit)} sub={instalments.length > 1 ? `Chia ${instalments.length} đợt` : undefined} />}
          {picked.length > 0 && total > 0 && (
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[13px]" style={{ color: "var(--tx2)" }}>Lãi dự kiến</span>
              <Badge tone={marginKey}>{f.marginPct}% · {vndShort(f.profit)}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-5 pb-4 pt-3.5" style={{ borderColor: "var(--bd2)", background: "var(--sf2)" }}>
        {primary(false)}
        {blockReason ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
            <Info size={14} style={{ flex: "none", marginTop: 1 }} /> {blockReason}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className={btn("secondary", "md", "w-full")} onClick={goBack} disabled={step === 0}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <button
            type="button"
            className={btn("secondary", "md", "w-full")}
            onClick={() => create("draft")}
            disabled={!!saving || !phoneOk}
            title={phoneOk ? "Tạo hợp đồng nháp rồi mở màn chi tiết" : "Cần SĐT khách đủ 10 số"}
          >
            {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <HideCreateFab />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px] min-[1360px]:grid-cols-[208px_minmax(0,1fr)_300px]">
        {/* Trái — thanh bước dọc (chỉ màn rộng) */}
        <div className="sticky top-[80px] hidden min-[1360px]:block">{stepRail}</div>

        {/* Giữa — nội dung bước */}
        <Stack gap={16} className="min-w-0">
          <div className="min-[1360px]:hidden">{stepBar}</div>

          {step === 0 && (
            <QuickContractBoxV2
              context={f.quickContext}
              onApply={f.applyQuick}
              initialText={f.initialQuickText}
              sourceNote={f.quickSourceNote}
            />
          )}

          {err && (
            <Callout tone="red" icon={CircleAlert} title="Chưa tạo được hợp đồng">
              {err}
            </Callout>
          )}

          <Section title={STEPS[step].title} desc={STEPS[step].hint} icon={STEPS[step].icon}>
            {stepBody}
            {blockReason ? (
              <p className="mt-4 flex items-start gap-1.5 text-[12.5px] xl:hidden" style={{ color: "var(--tx3)" }}>
                <Info size={14} style={{ flex: "none", marginTop: 2 }} /> {blockReason}
              </p>
            ) : null}
          </Section>

          {optionsSection}
        </Stack>

        {/* Phải — tóm tắt ghim (máy tính) */}
        <div className="sticky top-[80px] hidden xl:block">{summary}</div>
      </div>

      {/* Điện thoại — thanh ghim đáy */}
      <MobileActionBar>
        {step > 0 ? (
          <button type="button" onClick={goBack} aria-label="Quay lại bước trước" className={iconBtn()} style={{ border: "1px solid var(--bd)" }}>
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="tnum truncate text-[15px] font-bold" style={{ color: total > 0 ? "var(--tx)" : "var(--tx3)", letterSpacing: "-.2px" }}>
            {total > 0 ? vnd(total) : "Chưa có giá"}
          </p>
          <p className="tnum truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {deposit > 0 ? `Cọc ${vnd(deposit)}` : `Bước ${step + 1}/${STEPS.length} · ${STEPS[step].label}`}
          </p>
        </div>
        {primary(true)}
      </MobileActionBar>
    </div>
  );
}
