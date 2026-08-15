"use client";

import { useState } from "react";
import { Check, Save, HardDrive, ReceiptText } from "lucide-react";
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
}: {
  ownerId: string;
  initialStorageMonths: number;
  initialQuoteValidDays: number;
}) {
  const supabase = createClient();
  const [months, setMonths] = useState(initialStorageMonths);
  const [days, setDays] = useState(initialQuoteValidDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        storage_months: Math.max(0, Math.min(120, Math.round(months) || 0)),
        quote_valid_days: Math.max(0, Math.min(365, Math.round(days) || 0)),
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

      {err && <p className="mt-3 text-xs" style={{ color: "var(--s-red)" }}>{err}</p>}

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saved ? <Check size={15} /> : <Save size={15} />} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu chính sách"}
      </button>
    </div>
  );
}
