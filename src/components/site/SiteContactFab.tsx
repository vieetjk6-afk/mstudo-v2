"use client";

import { useState } from "react";
import { MessageCircle, Phone, Calendar, X } from "lucide-react";
// CSS .s-*/.sp-* của website studio — tách khỏi globals để trang khác không phải tải.
import "@/components/site/site.css";

/* ─────────────────────────────────────────────────────────────────────────────
   Nút liên hệ NỔI ở góc phải website studio.

   Khách Việt hầu như luôn nhắn Zalo / gọi trực tiếp thay vì điền form, nên nút
   này rút đường liên hệ xuống còn một cú bấm ở mọi vị trí cuộn của trang.
   Dữ liệu lấy từ thông tin studio đã có (điện thoại, Facebook, link đặt lịch) —
   không cần nhập lại. Studio bật/tắt từng nút trong trình tạo website.
   ───────────────────────────────────────────────────────────────────────────── */

export type FabConfig = {
  /** Tắt hẳn nút nổi. */
  off?: boolean;
  phone?: boolean;
  zalo?: boolean;
  messenger?: boolean;
  booking?: boolean;
};

/** Số điện thoại VN → dạng chỉ chữ số để ghép link zalo.me / tel:. */
function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/** Link Messenger từ giá trị Facebook studio nhập (URL, @page hay tên page). */
function messengerHref(fb: string): string | null {
  const v = fb.trim();
  if (!v) return null;
  const m = v.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?#]+)/i);
  const id = (m ? m[1] : v).replace(/^@/, "").trim();
  if (!id) return null;
  return `https://m.me/${encodeURIComponent(id)}`;
}

export default function SiteContactFab({
  phone,
  facebook,
  bookingHref,
  config = {},
}: {
  phone?: string | null;
  facebook?: string | null;
  bookingHref?: string | null;
  config?: FabConfig;
}) {
  const [open, setOpen] = useState(false);
  if (config.off) return null;

  const tel = phone ? digits(phone) : "";
  const mess = config.messenger !== false && facebook ? messengerHref(facebook) : null;

  const items: { key: string; label: string; href: string; icon: React.ReactNode; external?: boolean }[] = [];
  if (config.booking !== false && bookingHref) {
    items.push({ key: "book", label: "Đặt lịch", href: bookingHref, icon: <Calendar size={17} /> });
  }
  if (config.zalo !== false && tel) {
    items.push({ key: "zalo", label: "Chat Zalo", href: `https://zalo.me/${tel.replace(/^\+/, "")}`, icon: <ZaloMark />, external: true });
  }
  if (mess) {
    items.push({ key: "mess", label: "Messenger", href: mess, icon: <MessageCircle size={17} />, external: true });
  }
  if (config.phone !== false && tel) {
    items.push({ key: "tel", label: phone as string, href: `tel:${tel}`, icon: <Phone size={16} /> });
  }
  if (items.length === 0) return null;

  return (
    <div className="s-fab-wrap">
      {open && (
        <div className="s-fab-menu">
          {items.map((it) => (
            <a
              key={it.key}
              href={it.href}
              className="s-fab-item"
              target={it.external ? "_blank" : undefined}
              rel={it.external ? "noreferrer" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="s-fab-ico">{it.icon}</span>
              <span>{it.label}</span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className="s-fab"
        aria-label={open ? "Đóng liên hệ" : "Liên hệ studio"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

/** Dấu Zalo dạng SVG (bong bóng chat + chữ Z) — bộ icon đang dùng không có Zalo.
    Chỉ một chữ "Z" để còn đọc được ở cỡ 19px, tên đầy đủ nằm ở nhãn bên cạnh. */
function ZaloMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.9 3 2.8 6.5 2.8 10.9c0 2.5 1.3 4.7 3.4 6.2-.1.9-.5 2.2-1.2 3.3-.2.3.1.7.5.6 1.9-.6 3.3-1.5 4.1-2.1.8.2 1.6.3 2.4.3 5.1 0 9.2-3.5 9.2-7.9C21.2 6.5 17.1 3 12 3Z"
      />
      <text x="12" y="14.6" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--s-accent, #fff)" fontFamily="system-ui, sans-serif">
        Z
      </text>
    </svg>
  );
}
