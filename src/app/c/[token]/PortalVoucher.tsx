"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Gift, Download, ExternalLink } from "lucide-react";
import { VoucherTicket, saveVoucherImage, type TicketData } from "@/components/voucher/VoucherTicket";
import { fmtDate } from "@/lib/date";

export type PortalLoyalty = {
  stage: "teaser" | "pending" | "issued" | "cancelled";
  /** % voucher khách được tặng — theo mốc giá trị hợp đồng này, dùng cho hợp đồng sau. */
  percent: number;
  /** "Giảm 10% (tối đa 2.000.000đ)" — máy chủ dựng sẵn. */
  value: string;
  /** Mốc cao hơn kế tiếp ("Hợp đồng từ 30.000.000đ được tặng voucher 10%.") — chỉ khi chưa phát. */
  hint?: string | null;
  title: string;
  missing: string[];
  /** Điều kiện dùng — in dưới lời mời và trên tấm voucher. */
  terms?: string[];
  voucher: { code: string; expires_on: string | null; public_token: string | null; status: string; title: string } | null;
};

/**
 * Voucher ưu đãi trên cổng hợp đồng của khách — theo đúng vòng đời chương trình:
 *   · chưa ký   → lời mời "Ký & đặt cọc để nhận voucher X%" (thu hút chốt)
 *   · đã ký     → "voucher kích hoạt khi studio xác nhận cọc"
 *   · đủ điều kiện → tấm voucher thật: QR, lưu ảnh, mở trang đặt lịch
 */
export default function PortalVoucher({ l, studioName, clientName }: { l: PortalLoyalty; studioName: string; clientName: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const v = l.voucher;
  // Đọc origin SAU khi gắn vào trang: dựng ở máy chủ thì chưa có window, lệch
  // với bản ở trình duyệt là lỗi hydration.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = v?.public_token && origin ? `${origin}/voucher/${v.public_token}` : null;

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [link]);

  if (l.stage === "cancelled") return null;

  if (l.stage === "issued" && v) {
    const ticket: TicketData = {
      studio: studioName,
      title: v.title,
      value: l.value,
      code: v.code,
      expires: v.expires_on ? fmtDate(v.expires_on) : null,
      recipient: clientName,
      qr,
      stateLabel: v.status === "redeemed" ? "Đã dùng" : null,
      terms: l.terms,
    };
    return (
      <div className="rounded-[16px] px-4 py-5" style={{ background: "#efe6d8", color: "#2b2118" }} data-testid="portal-voucher">
        <p className="mb-3 text-center text-[13.5px] font-bold">🎉 Bạn được tặng voucher {l.value.replace(/^Giảm/, "giảm")} cho lần chụp sau!</p>
        <VoucherTicket d={ticket} />
        <div className="mx-auto mt-4 flex max-w-[360px] gap-2">
          <button
            onClick={async () => { setSaving(true); try { await saveVoucherImage(ticket); } finally { setSaving(false); } }}
            disabled={!qr || saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold disabled:opacity-60"
            style={{ background: "#2b2118", color: "#fbf6ee" }}
          >
            <Download size={15} /> {saving ? "Đang tạo ảnh…" : "Lưu về điện thoại"}
          </button>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold"
              style={{ background: "#fbf6ee", border: "1px solid #b8863b77" }}
            >
              <ExternalLink size={15} /> Đặt lịch / xem
            </a>
          )}
        </div>
      </div>
    );
  }

  // Chưa phát: lời mời (trước khi ký) hoặc chờ studio xác nhận (đã ký).
  return (
    <div
      className="flex items-start gap-3 rounded-[16px] px-4 py-4"
      style={{ background: "linear-gradient(135deg, #fbf3e4, #f3e3c6)", border: "1px solid #b8863b66", color: "#2b2118" }}
      data-testid="portal-voucher"
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px]" style={{ background: "#2b2118", color: "#f3d9a4" }}>
        <Gift size={22} />
      </span>
      <div className="min-w-0 flex-1">
        {l.stage === "teaser" ? (
          <>
            <p className="text-[14.5px] font-extrabold leading-snug">
              🎁 Ký hợp đồng &amp; đặt cọc để nhận voucher {l.value.replace(/^Giảm/, "giảm")} cho lần chụp sau
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: "#2b2118bb", textWrap: "pretty" }}>
              {studioName} tặng voucher theo giá trị hợp đồng này — hợp đồng càng lớn, % tặng càng cao. Lần sau đặt lịch được giảm đúng {l.percent}% giá trị hợp đồng mới.
            </p>
            {l.hint && <p className="mt-1 text-[12.5px] font-bold" style={{ color: "#8a5a17" }}>✨ {l.hint}</p>}
          </>
        ) : (
          <>
            <p className="text-[14.5px] font-extrabold leading-snug">🎁 Voucher {l.value.replace(/^Giảm/, "giảm")} đang chờ kích hoạt</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "#2b2118bb", textWrap: "pretty" }}>
              Voucher sẽ hiện ở đây ngay khi {l.missing.length ? l.missing.map((s) => s.toLowerCase()).join(" và ") : "studio xác nhận"}.
            </p>
          </>
        )}
        {l.terms && l.terms.length > 0 && (
          <p className="mt-1.5 text-[11.5px]" style={{ color: "#2b211899" }}>{l.terms.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}
