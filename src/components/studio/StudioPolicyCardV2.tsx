"use client";

import { Ban, Check, Copy, Gift, HardDrive, Landmark, MapPin, Percent, ReceiptText, Save, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Callout, Field, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { cancelClauseText } from "@/lib/contract-cancel";
import { useStudioPolicy, type StudioPolicyProps } from "./useStudioPolicy";

/* ═══════════════════════════════════════════════════════════════════════════
   CHÍNH SÁCH STUDIO — giao diện mới. Cùng logic với StudioPolicyCard
   (./useStudioPolicy). Bản cũ là một thẻ dài; bản mới chia bốn khối theo nghĩa
   (lưu trữ & báo giá · giữ ngày & giới thiệu · huỷ hợp đồng · vị trí studio),
   một nút Lưu chung ở cuối — vẫn ghi đúng ba lượt như cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

function NumField({
  icon: Icon,
  label,
  suffix,
  value,
  onChange,
  min = 0,
  max,
  step,
  hint,
  id,
}: {
  icon?: LucideIcon;
  label: string;
  suffix?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: React.ReactNode;
  id: string;
}) {
  return (
    <Field
      htmlFor={id}
      label={
        <span className="flex items-center gap-1.5">
          {Icon ? <Icon size={14} style={{ color: "var(--tx3)" }} /> : null}
          {label}
        </span>
      }
      hint={hint}
    >
      <div className="flex items-center gap-2">
        <input id={id} type="number" min={min} max={max} step={step} className={`${inputCls} min-w-0`} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix ? <span className="flex-none text-[13px]" style={{ color: "var(--tx3)" }}>{suffix}</span> : null}
      </div>
    </Field>
  );
}

export default function StudioPolicyCardV2(props: StudioPolicyProps) {
  const p = useStudioPolicy(props);
  const clause = cancelClauseText({
    earlyDays: Math.max(0, Math.round(p.cancel.earlyDays) || 0),
    earlyPct: p.pct(p.cancel.earlyPct),
    latePct: p.pct(p.cancel.latePct),
  });

  return (
    <Stack gap={16}>
      <Section icon={ShieldCheck} title="Lưu trữ, báo giá & cọc hợp đồng" desc="Áp dụng cho album và báo giá tạo từ giờ trở đi. Bản ghi cũ giữ nguyên hạn đã đặt.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField
            id="pol-months"
            icon={HardDrive}
            label="Giữ ảnh gốc sau khi giao"
            suffix="tháng"
            max={120}
            value={p.months}
            onChange={p.setMonths}
            hint={p.months > 0 ? `Album giao khách sẽ được nhắc dọn ảnh gốc sau ${p.months} tháng. mstudo không tự xoá gì.` : "0 = không đặt hạn, giữ ảnh gốc vô thời hạn."}
          />
          <NumField
            id="pol-days"
            icon={ReceiptText}
            label="Hiệu lực báo giá"
            suffix="ngày"
            max={365}
            value={p.days}
            onChange={p.setDays}
            hint={
              p.days > 0
                ? `Báo giá hết hiệu lực sau ${p.days} ngày kể từ khi gửi khách. Khách vẫn xem được, chỉ không bấm đồng ý được nữa.`
                : "0 = không đặt hạn, báo giá có hiệu lực tới khi bạn huỷ."
            }
          />
          <NumField
            id="pol-deppct"
            icon={Percent}
            label="Cọc hợp đồng gợi ý"
            suffix="% giá trị HĐ"
            max={100}
            value={p.depPct}
            onChange={p.setDepPct}
            hint={
              p.depPct > 0
                ? `Đợt cọc đầu tiên của hợp đồng mới tự điền ${p.depPct}% giá trị (làm tròn lên 500k). Sửa lại từng hợp đồng vẫn được.`
                : "0 = không gợi ý, bạn tự nhập số tiền từng đợt."
            }
          />
        </div>
      </Section>

      <Section icon={Gift} title="Giữ ngày & giới thiệu" desc="Cọc khi khách đặt lịch, thưởng cho người giới thiệu và ưu đãi cho khách mới.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            id="pol-deposit"
            icon={Landmark}
            label="Cọc giữ ngày"
            suffix="đ"
            step={50000}
            value={p.deposit}
            onChange={p.setDeposit}
            hint={p.deposit > 0 ? "Khách đặt lịch xong thấy ngay mã QR chuyển cọc. Cần khai tài khoản nhận tiền ở Gói & bảng giá." : "0 = tắt, khách đặt lịch xong studio liên hệ rồi mới tính."}
          />
          <NumField
            id="pol-reward"
            icon={Gift}
            label="Thưởng người giới thiệu"
            suffix="đ"
            step={50000}
            value={p.reward}
            onChange={p.setReward}
            hint="Ghi vào sổ giới thiệu khi khách mới chốt hợp đồng. mstudo không tự chi tiền."
          />
          <NumField
            id="pol-discount"
            icon={Gift}
            label="Ưu đãi khách mới"
            suffix="đ"
            step={50000}
            value={p.discount}
            onChange={p.setDiscount}
            hint={p.discount > 0 ? "Hiện trên form đặt lịch để khách có lý do nhập SĐT người giới thiệu." : "0 = form đặt lịch không hỏi SĐT người giới thiệu."}
          />
        </div>
      </Section>

      {/* Chỉ là GỢI Ý số tiền hoàn khi bấm "Huỷ HĐ" — studio luôn sửa được số cuối cùng. */}
      <Section icon={Ban} title="Chính sách huỷ hợp đồng" desc="Gợi ý số tiền hoàn khi bấm Huỷ hợp đồng — bạn vẫn sửa được số cuối cùng.">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField id="pol-early-days" label="Huỷ sớm là trước ngày chụp từ" suffix="ngày" max={365} value={p.cancel.earlyDays} onChange={(n) => p.setCancel((c) => ({ ...c, earlyDays: n }))} />
            <NumField id="pol-early-pct" label="Huỷ sớm: hoàn" suffix="% đã thu" max={100} value={p.cancel.earlyPct} onChange={(n) => p.setCancel((c) => ({ ...c, earlyPct: n }))} />
            <NumField id="pol-late-pct" label="Huỷ muộn hơn: hoàn" suffix="% đã thu" max={100} value={p.cancel.latePct} onChange={(n) => p.setCancel((c) => ({ ...c, latePct: n }))} />
          </div>
          <div className="rounded-[12px] p-3.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] font-semibold">Điều khoản gợi ý cho hợp đồng mẫu</p>
              <button
                type="button"
                className={btn("secondary", "sm")}
                onClick={() => {
                  navigator.clipboard?.writeText(clause);
                  p.setClauseCopied(true);
                  setTimeout(() => p.setClauseCopied(false), 1500);
                }}
              >
                {p.clauseCopied ? <Check size={14} /> : <Copy size={14} />} {p.clauseCopied ? "Đã chép" : "Chép điều khoản"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ fontFamily: "inherit", color: "var(--tx2)" }}>{clause}</pre>
          </div>
        </div>
      </Section>

      <Section icon={MapPin} title="Vị trí studio" desc="Để màn Lịch làm việc ước lượng đường đi tới điểm chụp. Không bắt buộc.">
        <Field
          htmlFor="pol-addr"
          hint={
            p.coords
              ? `Đã có toạ độ ${p.coords.lat.toFixed(5)}, ${p.coords.lng.toFixed(5)} — màn Lịch làm việc sẽ ước lượng đường đi tới điểm chụp.`
              : "Dán link Google Maps để lấy toạ độ. Bỏ trống vẫn xem được dự báo thời tiết, chỉ không có ước lượng đường đi."
          }
        >
          <input
            id="pol-addr"
            className={inputCls}
            value={p.addr}
            onChange={(e) => p.onAddr(e.target.value)}
            placeholder="Dán link Google Maps của studio, hoặc gõ địa chỉ"
            aria-label="Vị trí studio"
          />
        </Field>
      </Section>

      {p.err && <Callout tone="red">{p.err}</Callout>}
      {p.locNote && <Callout tone="amber">{p.locNote}</Callout>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={p.save} disabled={p.saving} className={btn("primary")}>
          {p.saved ? <Check size={16} /> : <Save size={16} />} {p.saving ? "Đang lưu…" : p.saved ? "Đã lưu" : "Lưu chính sách"}
        </button>
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Một nút lưu cho cả bốn khối.</p>
      </div>
    </Stack>
  );
}
