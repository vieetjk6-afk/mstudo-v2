"use client";

import { Landmark, Palette, QrCode, RotateCcw } from "lucide-react";
import LogoUpload from "@/components/LogoUpload";
import { VietQR } from "@/components/VietQR";
import { Empty, Field, Section, btn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { BANKS } from "@/lib/banks";
import { DEFAULT_APPEARANCE, type Appearance, type PricingState } from "./usePricing";

/* ═══════════════════════════════════════════════════════════════════════════
   GÓI & BẢNG GIÁ — hai tab cài đặt của bản mới (PricingV2): Liên hệ & chuyển
   khoản (kèm xem trước mã QR và thẻ tự xác nhận chuyển khoản của chủ studio),
   Giao diện bảng giá (công tắc hiện điều khoản, màu, logo, xem trước). Nút Lưu
   nằm ở thanh dính đáy của màn cha.
   ═══════════════════════════════════════════════════════════════════════════ */

export function ContactTabV2({ p, bankAuto }: { p: PricingState; bankAuto?: React.ReactNode }) {
  const { c, setC } = p;
  const field = (k: keyof typeof c) => ({ value: c[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setC((x) => ({ ...x, [k]: e.target.value })) });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section icon={Landmark} title="Liên hệ & chuyển khoản" desc="In trên mọi bảng giá gửi khách.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số điện thoại">
              <input className={inputCls} type="tel" {...field("pl_phone")} />
            </Field>
            <Field label="Facebook">
              <input className={inputCls} placeholder="fb.com/…" {...field("pl_facebook")} />
            </Field>
            <Field label="Ngân hàng" hint="Chọn ngân hàng để tạo mã QR chuyển khoản." className="sm:col-span-2">
              <select
                className={inputCls}
                value={c.pl_bank_bin}
                onChange={(e) => {
                  const b = BANKS.find((x) => x.bin === e.target.value);
                  setC((x) => ({ ...x, pl_bank_bin: e.target.value, pl_bank_name: b ? b.name : x.pl_bank_name }));
                }}
              >
                <option value="">— Chọn ngân hàng —</option>
                {BANKS.map((b) => (
                  <option key={b.bin} value={b.bin}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tài khoản">
              <input className={inputCls} inputMode="numeric" {...field("pl_bank_account")} />
            </Field>
            <Field label="Chủ tài khoản">
              <input className={inputCls} {...field("pl_bank_holder")} />
            </Field>
          </div>
        </Section>

        <Section icon={QrCode} title="Mã QR chuyển khoản" desc="Xem trước — mã mở, khách tự nhập số tiền.">
          {c.pl_bank_bin && c.pl_bank_account ? (
            <div className="flex flex-col items-center gap-2">
              <VietQR bank={{ bin: c.pl_bank_bin, account: c.pl_bank_account, holder: c.pl_bank_holder, name: c.pl_bank_name }} amount={0} addInfo="" />
              <p className="text-center text-[12px]" style={{ color: "var(--tx3)" }}>
                Trong hợp đồng / công nợ, QR tự điền sẵn số tiền.
              </p>
            </div>
          ) : (
            <Empty compact icon={QrCode} title="Chưa có mã QR" hint="Chọn ngân hàng và nhập số tài khoản để xem mã." />
          )}
        </Section>
      </div>
      {bankAuto ? <div className="min-w-0">{bankAuto}</div> : null}
    </div>
  );
}

export function AppearanceTabV2({ p, ownerId }: { p: PricingState; ownerId: string }) {
  const { ap, setAp } = p;
  const color = (k: keyof Appearance) => ap[k] || DEFAULT_APPEARANCE[k];
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Section icon={Palette} title="Màu & logo" desc="Áp cho mọi bảng giá gửi khách.">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ["pl_bg", "Màu nền"],
                ["pl_text", "Màu chữ"],
                ["pl_accent", "Màu nhấn"],
              ] as [keyof Appearance, string][]).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color(key)}
                      onChange={(e) => setAp((x) => ({ ...x, [key]: e.target.value }))}
                      className="h-[38px] w-11 flex-none cursor-pointer rounded-[10px]"
                      style={{ border: "1px solid var(--bd)", background: "transparent" }}
                      aria-label={`${label} — bảng màu`}
                    />
                    <input className={inputCls} value={ap[key]} placeholder={DEFAULT_APPEARANCE[key]} onChange={(e) => setAp((x) => ({ ...x, [key]: e.target.value }))} aria-label={label} />
                  </div>
                </Field>
              ))}
            </div>
            <div className="max-w-[420px]">
              <LogoUpload ownerId={ownerId} value={ap.pl_logo_url} onChange={(url) => setAp((x) => ({ ...x, pl_logo_url: url }))} />
            </div>
            <button type="button" onClick={() => setAp(DEFAULT_APPEARANCE)} className={btn("ghost", "sm", "self-start")}>
              <RotateCcw size={15} /> Về màu mặc định
            </button>
          </div>
        </Section>

        <Section icon={Landmark} title="Nội dung hiện trên bảng giá">
          <Switch
            checked={p.showClauses}
            onChange={() => void p.toggleShowClauses()}
            label="Hiện điều khoản của dịch vụ"
            desc="Bảng giá công khai in kèm bộ điều khoản của dịch vụ tương ứng. Bật/tắt là lưu ngay."
          />
        </Section>
      </div>

      {/* Xem trước bảng giá với màu đang chọn — màu do studio đặt nên dùng mã màu thật. */}
      <div className="v2-card overflow-hidden lg:sticky lg:top-[84px]">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <p className="v2-section-title">Xem trước</p>
          <p className="v2-section-desc">Khách thấy bảng giá như thế này</p>
        </div>
        <div className="p-4">
          <div className="rounded-[14px] p-5" style={{ background: color("pl_bg"), color: color("pl_text") }}>
            <div className="flex items-center gap-2.5">
              {ap.pl_logo_url ? <img src={ap.pl_logo_url} alt="Logo" className="h-8 w-8 rounded object-contain" /> : null}
              <p className="text-[15px] font-bold">Bảng giá chụp cưới</p>
            </div>
            <div className="mt-4 rounded-[10px] p-3.5" style={{ background: "rgba(255,255,255,.55)" }}>
              <p className="text-[13px] font-semibold">Phóng sự cưới trọn ngày</p>
              <p className="mt-0.5 text-[18px] font-bold" style={{ color: color("pl_accent") }}>10.000.000đ</p>
              <p className="mt-1 text-[12px] opacity-75">2 thợ chụp · album 30x30 · giao ảnh 20 ngày</p>
            </div>
            <div className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: color("pl_accent") }}>
              Đặt lịch ngay
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
