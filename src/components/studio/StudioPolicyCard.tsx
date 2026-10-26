"use client";

import { Check, Save, HardDrive, ReceiptText, Landmark, Gift, Percent, MapPin, Ban, Copy } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { cancelClauseText } from "@/lib/contract-cancel";
import StudioPolicyCardV2 from "./StudioPolicyCardV2";
import { useStudioPolicy, type StudioPolicyProps } from "./useStudioPolicy";

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
export default function StudioPolicyCard(props: StudioPolicyProps) {
  return useUiV2() ? <StudioPolicyCardV2 {...props} /> : <StudioPolicyCardV1 {...props} />;
}

function StudioPolicyCardV1(props: StudioPolicyProps) {
  const {
    months, setMonths, days, setDays, deposit, setDeposit, depPct, setDepPct, reward, setReward, discount, setDiscount,
    addr, onAddr, coords, saving, saved, err, locNote, cancel, setCancel, clauseCopied, setClauseCopied, pct, save,
  } = useStudioPolicy(props);

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

      {/* ── Chính sách huỷ ─────────────────────────────────────────────────
          Chỉ là GỢI Ý số tiền hoàn khi bấm "Huỷ HĐ" — studio luôn sửa được số
          cuối cùng, vì huỷ là chuyện thương lượng với khách. */}
      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="flex items-center gap-1.5 text-sm font-medium"><Ban size={14} /> Chính sách huỷ hợp đồng</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Huỷ sớm là trước ngày chụp từ</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={365} className="input" value={cancel.earlyDays} onChange={(e) => setCancel((c) => ({ ...c, earlyDays: Number(e.target.value) }))} />
              <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>ngày</span>
            </div>
          </div>
          <div>
            <label className="label">Huỷ sớm: hoàn</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className="input" value={cancel.earlyPct} onChange={(e) => setCancel((c) => ({ ...c, earlyPct: Number(e.target.value) }))} />
              <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>% đã thu</span>
            </div>
          </div>
          <div>
            <label className="label">Huỷ muộn hơn: hoàn</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className="input" value={cancel.latePct} onChange={(e) => setCancel((c) => ({ ...c, latePct: Number(e.target.value) }))} />
              <span className="flex-none text-sm" style={{ color: "var(--text3)" }}>% đã thu</span>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg p-3 text-[12px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <p className="mb-1 font-medium" style={{ color: "var(--text2)" }}>Điều khoản gợi ý cho hợp đồng mẫu</p>
          <pre className="whitespace-pre-wrap" style={{ fontFamily: "inherit", color: "var(--text2)" }}>{cancelClauseText({ earlyDays: Math.max(0, Math.round(cancel.earlyDays) || 0), earlyPct: pct(cancel.earlyPct), latePct: pct(cancel.latePct) })}</pre>
          <button
            type="button"
            className="btn-ghost mt-2 px-2.5 py-1 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(cancelClauseText({ earlyDays: Math.max(0, Math.round(cancel.earlyDays) || 0), earlyPct: pct(cancel.earlyPct), latePct: pct(cancel.latePct) }));
              setClauseCopied(true);
              setTimeout(() => setClauseCopied(false), 1500);
            }}
          >
            {clauseCopied ? <Check size={13} /> : <Copy size={13} />} {clauseCopied ? "Đã chép" : "Chép điều khoản"}
          </button>
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
