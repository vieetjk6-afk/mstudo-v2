"use client";

import { useState } from "react";
import { Check, Save, HardDrive, ReceiptText, Landmark, Gift, Percent, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { coordsInText } from "@/lib/weather";

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
  initialContractDepositPercent = 25,
  initialReferralReward = 0,
  initialReferralDiscount = 0,
  initialStudioAddress = "",
  initialStudioLat = null,
  initialStudioLng = null,
}: {
  ownerId: string;
  initialStorageMonths: number;
  initialQuoteValidDays: number;
  /** Cọc giữ ngày khi khách đặt lịch (VND). 0 = tắt. */
  initialDeposit?: number;
  /** % cọc gợi ý khi lập đợt thanh toán của hợp đồng. 0 = không gợi ý. */
  initialContractDepositPercent?: number;
  /** Thưởng cho người giới thiệu (VND). 0 = tắt chương trình. */
  initialReferralReward?: number;
  /** Ưu đãi cho khách được giới thiệu (VND). */
  initialReferralDiscount?: number;
  /** Địa chỉ + toạ độ studio — điểm xuất phát để ước lượng đường đi tới điểm chụp. */
  initialStudioAddress?: string;
  initialStudioLat?: number | null;
  initialStudioLng?: number | null;
}) {
  const supabase = createClient();
  const [months, setMonths] = useState(initialStorageMonths);
  const [days, setDays] = useState(initialQuoteValidDays);
  const [deposit, setDeposit] = useState(initialDeposit);
  const [depPct, setDepPct] = useState(initialContractDepositPercent);
  const [reward, setReward] = useState(initialReferralReward);
  const [discount, setDiscount] = useState(initialReferralDiscount);
  const [addr, setAddr] = useState(initialStudioAddress);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialStudioLat != null && initialStudioLng != null ? { lat: initialStudioLat, lng: initialStudioLng } : null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);

  /** Dán link Google Maps (hoặc "lat,lng") → tự đọc ra toạ độ. */
  function onAddr(v: string) {
    setAddr(v);
    const c = coordsInText(v);
    if (c) setCoords(c);
  }

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
        contract_deposit_percent: Math.max(0, Math.min(100, Math.round(depPct) || 0)),
        referral_reward: money(reward),
        referral_discount: money(discount),
      })
      .eq("id", ownerId);
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }

    // Vị trí studio ghi ở lượt RIÊNG, và lỗi ở đây KHÔNG được làm hỏng phần trên.
    // Project chưa chạy supabase/migrations/weather.sql thì ba cột này chưa tồn
    // tại; nhồi chung một lượt update là cả thẻ chính sách không lưu được gì.
    setLocNote(null);
    const { error: locErr } = await supabase
      .from("profiles")
      .update({
        studio_address: addr.trim().slice(0, 300) || null,
        studio_lat: coords?.lat ?? null,
        studio_lng: coords?.lng ?? null,
      })
      .eq("id", ownerId);
    if (locErr) {
      // 42703 = cột không tồn tại; PGRST204 = schema cache của PostgREST chưa có cột.
      const missing = locErr.code === "42703" || locErr.code === "PGRST204" || /column .* does not exist/i.test(locErr.message);
      setLocNote(
        missing
          ? "Đã lưu chính sách. Riêng vị trí studio cần chạy supabase/migrations/weather.sql trước."
          : `Đã lưu chính sách, nhưng chưa lưu được vị trí studio: ${locErr.message}`
      );
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="card p-5">
      <h2 className="font-serif text-lg font-medium">Chính sách studio</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
        Áp dụng cho album và báo giá tạo từ giờ trở đi. Bản ghi cũ giữ nguyên hạn đã đặt.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div>
          <label className="label flex items-center gap-1.5">
            <Percent size={14} /> Cọc hợp đồng gợi ý
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={depPct}
              onChange={(e) => setDepPct(Number(e.target.value))}
            />
            <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>% giá trị HĐ</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
            {depPct > 0
              ? `Đợt cọc đầu tiên của hợp đồng mới tự điền ${depPct}% giá trị (làm tròn lên 500k). Sửa lại từng hợp đồng vẫn được.`
              : "0 = không gợi ý, bạn tự nhập số tiền từng đợt."}
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

      {/* ── Vị trí studio ───────────────────────────────────────────────────
          Dùng để ƯỚC LƯỢNG thời gian di chuyển tới điểm chụp trên màn Lịch làm
          việc. Không bắt buộc: bỏ trống thì lịch vẫn hiện dự báo thời tiết, chỉ
          không có dòng "≈ 18 km · 25 phút từ studio". */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <label className="label flex items-center gap-1.5">
          <MapPin size={14} /> Vị trí studio
        </label>
        <input
          className="input"
          value={addr}
          onChange={(e) => onAddr(e.target.value)}
          placeholder="Dán link Google Maps của studio, hoặc gõ địa chỉ"
        />
        <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
          {coords
            ? `Đã có toạ độ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — màn Lịch làm việc sẽ ước lượng đường đi tới điểm chụp.`
            : "Dán link Google Maps để lấy toạ độ. Bỏ trống vẫn xem được dự báo thời tiết, chỉ không có ước lượng đường đi."}
        </p>
      </div>

      {err && <p className="mt-3 text-xs" style={{ color: "var(--s-red)" }}>{err}</p>}
      {locNote && <p className="mt-3 text-xs" style={{ color: "var(--warn)" }}>{locNote}</p>}

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saved ? <Check size={15} /> : <Save size={15} />} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu chính sách"}
      </button>
    </div>
  );
}
