"use client";

import { useState } from "react";
import { Check, Save, HardDrive, ReceiptText, Landmark, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hai chính sách chạy NGẦM của studio, đặt một lần rồi thôi:
 *
 *  • Giữ ảnh gốc bao nhiêu tháng sau khi giao khách — quyết định hạn dọn Drive
 *    của mọi album giao sau này.
 *  • Báo giá có hiệu lực bao nhiêu ngày — điền sẵn khi bấm "đánh dấu đã gửi".
 *
 * Cả hai chỉ áp cho bản ghi MỚI. Album/báo giá đã có hạn riêng thì giữ nguyên,
 * nếu không một lần đổi chính sách sẽ âm thầm dời hạn của hàng trăm bản ghi cũ.
 */
export default function StudioPolicyCard({
  ownerId,
  initialStorageMonths,
  initialQuoteValidDays,
  initialDeposit = 0,
  initialReferralReward = 0,
  initialReferralDiscount = 0,
}: {
  ownerId: string;
  initialStorageMonths: number;
  initialQuoteValidDays: number;
  /** Cọc giữ ngày khi khách đặt lịch (VND). 0 = tắt. */
  initialDeposit?: number;
  /** Thưởng cho người giới thiệu (VND). 0 = tắt chương trình. */
  initialReferralReward?: number;
  /** Ưu đãi cho khách được giới thiệu (VND). */
  initialReferralDiscount?: number;
}) {
  const supabase = createClient();
  const [months, setMonths] = useState(initialStorageMonths);
  const [days, setDays] = useState(initialQuoteValidDays);
  const [deposit, setDeposit] = useState(initialDeposit);
  const [reward, setReward] = useState(initialReferralReward);
  const [discount, setDiscount] = useState(initialReferralDiscount);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const money = (n: number) => Math.max(0, Math.min(100_000_000, Math.round(n) || 0));

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        storage_months: Math.max(0, Math.min(120, Math.round(months) || 0)),
        quote_valid_days: Math.max(0, Math.min(365, Math.round(days) || 0)),
        booking_deposit: money(deposit),
        referral_reward: money(reward),
        referral_discount: money(discount),
      })
      .eq("id", ownerId);
    setSaving(false);
    if (error) return setErr(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="card p-5">
      <h2 className="font-serif text-lg font-medium">Chính sách studio</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
        Áp dụng cho album và báo giá tạo từ giờ trở đi. Bản ghi cũ giữ nguyên hạn đã đặt.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label flex items-center gap-1.5">
            <HardDrive size={14} /> Giữ ảnh gốc sau khi giao
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              className="input"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
            <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>tháng</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
            {months > 0
              ? `Album giao khách sẽ được nhắc dọn ảnh gốc sau ${months} tháng. mstudo không tự xoá gì.`
              : "0 = không đặt hạn, giữ ảnh gốc vô thời hạn."}
          </p>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <ReceiptText size={14} /> Hiệu lực báo giá
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={365}
              className="input"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
            <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>ngày</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
            {days > 0
              ? `Báo giá hết hiệu lực sau ${days} ngày kể từ khi gửi khách. Khách vẫn xem được, chỉ không bấm đồng ý được nữa.`
              : "0 = không đặt hạn, báo giá có hiệu lực tới khi bạn huỷ."}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm font-medium">Giữ ngày &amp; giới thiệu</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label flex items-center gap-1.5">
              <Landmark size={14} /> Cọc giữ ngày
            </label>
            <input type="number" min={0} step={50000} className="input" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
              {deposit > 0
                ? "Khách đặt lịch xong thấy ngay mã QR chuyển cọc. Cần khai tài khoản nhận tiền ở Gói & bảng giá."
                : "0 = tắt, khách đặt lịch xong studio liên hệ rồi mới tính."}
            </p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Gift size={14} /> Thưởng người giới thiệu
            </label>
            <input type="number" min={0} step={50000} className="input" value={reward} onChange={(e) => setReward(Number(e.target.value))} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
              Ghi vào sổ giới thiệu khi khách mới chốt hợp đồng. mstudo không tự chi tiền.
            </p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Gift size={14} /> Ưu đãi khách mới
            </label>
            <input type="number" min={0} step={50000} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
              {discount > 0
                ? "Hiện trên form đặt lịch để khách có lý do nhập SĐT người giới thiệu."
                : "0 = form đặt lịch không hỏi SĐT người giới thiệu."}
            </p>
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-xs" style={{ color: "var(--s-red)" }}>{err}</p>}

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saved ? <Check size={15} /> : <Save size={15} />} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu chính sách"}
      </button>
    </div>
  );
}
