"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ VOUCHER ƯU ĐÃI — một mẫu dùng chung cho trang khách (/voucher/…) và màn
   hợp đồng của studio, kèm bản ẢNH PNG để khách lưu về điện thoại.

   Ảnh vẽ bằng canvas thay vì chụp DOM: không cần thư viện, chữ luôn nét trên
   máy Retina, và ảnh giống hệt nhau dù mở ở máy nào.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TicketData = {
  studio: string;
  title: string;
  /** "Giảm 10% (tối đa 2.000.000đ)" */
  value: string;
  code: string;
  /** "31/12/2027" hoặc null = không thời hạn */
  expires: string | null;
  recipient?: string | null;
  /** Ảnh QR (data URL) trỏ về trang voucher. */
  qr: string | null;
  /** "Đã dùng" / "Hết hạn"… — null khi còn dùng được. */
  stateLabel?: string | null;
  /** Điều kiện dùng ("Áp dụng cho gói phóng sự cưới", "Không quy đổi tiền mặt"…). */
  terms?: string[];
};

const INK = "#2b2118";
const GOLD = "#b8863b";
const PAPER = "#fbf6ee";

export function VoucherTicket({ d }: { d: TicketData }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-[20px]"
      style={{ background: PAPER, color: INK, boxShadow: "0 10px 40px rgba(0,0,0,.18)", border: `1px solid ${GOLD}55` }}
    >
      <div className="px-5 pb-4 pt-5 text-center">
        <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "2px", color: GOLD }}>{d.studio}</p>
        <p className="mt-1 text-[13px]" style={{ color: `${INK}bb` }}>{d.title}</p>
        <p className="mt-2 text-[26px] font-extrabold leading-tight" style={{ letterSpacing: "-.5px" }}>{d.value}</p>
        {d.recipient && <p className="mt-1 text-[12.5px]" style={{ color: `${INK}99` }}>Dành tặng {d.recipient}</p>}
      </div>
      <div className="relative mx-5 border-t border-dashed" style={{ borderColor: `${GOLD}88` }} />
      <div className="flex items-center gap-4 px-5 py-4">
        {d.qr && (
          <img src={d.qr} alt="Mã QR voucher" className="h-[104px] w-[104px] flex-none rounded-[10px] bg-white p-1.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: "1.2px", color: `${INK}88` }}>Mã voucher</p>
          <p className="font-mono text-[19px] font-bold tracking-wider">{d.code}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: `${INK}99` }}>
            {d.expires ? `Hạn dùng đến ${d.expires}` : "Không giới hạn thời gian"}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: `${INK}88` }}>Quét mã để đặt lịch kèm ưu đãi</p>
        </div>
      </div>
      {d.terms && d.terms.length > 0 && (
        <ul className="space-y-0.5 px-5 pb-4 text-[11px] leading-snug" style={{ color: `${INK}99` }}>
          {d.terms.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      )}
      {d.stateLabel && (
        <div
          className="absolute right-3 top-3 rotate-6 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase"
          style={{ border: "2px solid #b33a3a", color: "#b33a3a", background: "#fff8" }}
        >
          {d.stateLabel}
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Cắt chữ cho vừa bề ngang, thêm "…" nếu tràn. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Vẽ thẻ thành PNG (1080×1350, tỉ lệ ảnh dọc của điện thoại). */
export async function voucherImageBlob(d: TicketData): Promise<Blob | null> {
  const W = 1080;
  const terms = d.terms ?? [];
  const H = 1350 + (terms.length ? 24 + terms.length * 40 : 0);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const font = (w: number, px: number, mono = false) =>
    `${w} ${px}px ${mono ? "ui-monospace, Menlo, Consolas, monospace" : "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif"}`;

  ctx.fillStyle = "#efe6d8";
  ctx.fillRect(0, 0, W, H);
  const x = 70, y = 70, w = W - 140, h = H - 140, r = 48;
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = `${GOLD}99`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = font(700, 34);
  ctx.fillText(fit(ctx, d.studio.toUpperCase(), w - 120), W / 2, y + 110);
  ctx.fillStyle = `${INK}bb`;
  ctx.font = font(400, 38);
  ctx.fillText(fit(ctx, d.title, w - 120), W / 2, y + 175);
  // Giá trị: một dòng nếu vừa; không thì tách phần "(tối đa …)" xuống dòng
  // nhỏ hơn, thay vì cắt mất số tiền — đó là chữ khách cần đọc nhất.
  ctx.fillStyle = INK;
  ctx.font = font(800, 84);
  let valueBottom = y + 290;
  const cut = d.value.indexOf(" (");
  if (ctx.measureText(d.value).width > w - 100 && cut > 0) {
    ctx.fillText(fit(ctx, d.value.slice(0, cut), w - 100), W / 2, y + 290);
    ctx.font = font(700, 46);
    ctx.fillText(fit(ctx, d.value.slice(cut + 1), w - 100), W / 2, y + 355);
    valueBottom = y + 355;
  } else {
    ctx.fillText(fit(ctx, d.value, w - 100), W / 2, y + 290);
  }
  if (d.recipient) {
    ctx.fillStyle = `${INK}99`;
    ctx.font = font(400, 34);
    ctx.fillText(fit(ctx, `Dành tặng ${d.recipient}`, w - 120), W / 2, valueBottom + 58);
  }

  ctx.strokeStyle = `${GOLD}aa`;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(x + 50, y + 450);
  ctx.lineTo(x + w - 50, y + 450);
  ctx.stroke();
  ctx.setLineDash([]);

  const qrSize = 420;
  if (d.qr) {
    const img = await loadImage(d.qr);
    if (img) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(W / 2 - qrSize / 2 - 20, y + 480, qrSize + 40, qrSize + 40, 24);
      ctx.fill();
      ctx.drawImage(img, W / 2 - qrSize / 2, y + 500, qrSize, qrSize);
    }
  }
  ctx.fillStyle = `${INK}88`;
  ctx.font = font(700, 28);
  ctx.fillText("MÃ VOUCHER", W / 2, y + 1010);
  ctx.fillStyle = INK;
  ctx.font = font(700, 64, true);
  ctx.fillText(d.code, W / 2, y + 1078);
  ctx.fillStyle = `${INK}99`;
  ctx.font = font(400, 32);
  ctx.fillText(d.expires ? `Hạn dùng đến ${d.expires}` : "Không giới hạn thời gian", W / 2, y + 1132);
  ctx.fillStyle = `${INK}88`;
  ctx.font = font(400, 28);
  ctx.fillText("Quét mã để đặt lịch kèm ưu đãi", W / 2, y + 1176);
  ctx.font = font(400, 27);
  terms.forEach((t, i) => ctx.fillText(fit(ctx, `• ${t}`, w - 100), W / 2, y + 1236 + i * 40));

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}

/**
 * Lưu ảnh voucher: trên điện thoại mở bảng chia sẻ (có "Lưu hình ảnh" / gửi
 * Zalo), không được thì tải file PNG như bình thường.
 */
export async function saveVoucherImage(d: TicketData): Promise<boolean> {
  const blob = await voucherImageBlob(d);
  if (!blob) return false;
  const name = `voucher-${d.code}.png`;
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Voucher ${d.code}` });
      return true;
    } catch (e) {
      // Khách chủ động huỷ thì thôi; lỗi khác (trình duyệt chặn) mới tải file.
      if ((e as DOMException)?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
