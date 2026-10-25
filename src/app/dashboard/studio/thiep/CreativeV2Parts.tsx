"use client";

import Link from "next/link";
import { Download, Heart, Presentation, Printer, Sparkles, type LucideIcon } from "lucide-react";
import { btn, type Tone } from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh dùng chung của nhóm "Thiệp · Story · Slide" ở giao diện mới.
   ThiepTabs (src/components/studio) là bản cũ; bản mới dùng dải tab gạch chân
   của bộ khối V2 và nhận `active` thay vì đọc pathname (để màn xem trước — chạy
   ở /uipreview — vẫn tô đúng tab).
   ═══════════════════════════════════════════════════════════════════════════ */

export type CreativeTab = "thiep" | "story" | "slide";

const TABS: { key: CreativeTab; href: string; label: string; icon: LucideIcon }[] = [
  { key: "thiep", href: "/dashboard/studio/thiep", label: "Thiệp cưới", icon: Heart },
  { key: "story", href: "/dashboard/studio/story", label: "Love Story", icon: Sparkles },
  { key: "slide", href: "/dashboard/studio/slide", label: "Slide cưới", icon: Presentation },
];

/** Dải tab đi giữa ba màn của nhóm (sidebar gộp chúng thành một mục). */
export function CreativeTabsV2({ active }: { active: CreativeTab }) {
  return (
    <nav aria-label="Thiệp · Story · Slide" className="v2-tabs">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href} aria-current={on ? "page" : undefined} className={`v2-tab${on ? " is-on" : ""}`}>
            <t.icon size={16} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Nhãn đếm ngược tới ngày cưới / ngày sự kiện (số ngày từ hôm nay, âm = đã qua). */
export function countdown(
  days: number | null,
  words: { none: string; past: string; today: string } = { none: "Chưa có ngày cưới", past: "Đã cưới", today: "Cưới hôm nay" },
): { label: string; tone: Tone } {
  if (days == null) return { label: words.none, tone: "amber" };
  if (days < 0) return { label: words.past, tone: "gray" };
  if (days === 0) return { label: words.today, tone: "green" };
  return { label: `Còn ${days} ngày`, tone: days <= 14 ? "amber" : "blue" };
}

/** Popup mã QR: ảnh QR (nền trắng nướng sẵn để quét được cả ở nền tối) + tải / in. */
export function QrModalV2({
  qr,
  hint,
  onClose,
  onPrint,
}: {
  qr: { couple: string; url: string; img: string } | null;
  hint: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <Modal
      open={!!qr}
      onClose={onClose}
      title={qr?.couple ?? ""}
      desc={hint}
      width={400}
      footer={
        qr ? (
          <>
            <a href={qr.img} download={`qr-${qr.couple}.png`} className={btn("secondary")}>
              <Download size={16} /> Tải ảnh
            </a>
            <button type="button" onClick={onPrint} className={btn("primary")}>
              <Printer size={16} /> In mã QR
            </button>
          </>
        ) : null
      }
    >
      {qr ? (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-[14px] p-3" style={{ background: "#fff", border: "1px solid var(--bd)" }}>
            <img src={qr.img} alt={`Mã QR ${qr.couple}`} className="h-52 w-52" />
          </div>
          <p className="w-full break-all text-center text-[12px]" style={{ color: "var(--tx3)" }}>{qr.url}</p>
        </div>
      ) : null}
    </Modal>
  );
}

/** Thông báo nổi đáy màn (chép link, đang xuất…). Có `onClick` thì bấm để đóng. */
export function ToastV2({ children, tone = "default", onClick }: { children: React.ReactNode; tone?: "default" | "red"; onClick?: () => void }) {
  const cls = "fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6";
  const style: React.CSSProperties =
    tone === "red" ? { background: "var(--rd)", color: "#fff", boxShadow: "var(--sh-pop)" } : { background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-pop)" };
  return onClick ? (
    <button type="button" role="status" onClick={onClick} className={cls} style={style} title="Bấm để đóng">
      {children}
    </button>
  ) : (
    <div role="status" className={cls} style={style}>
      {children}
    </div>
  );
}

/**
 * Hộp thoại CHẶN (không có nút đóng, bấm nền không tắt) — cho việc đang chạy
 * phải chờ xong hoặc huỷ bằng nút riêng (đang xuất video, đang xuất file in).
 */
export function BlockingDialogV2({ title, desc, children }: { title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="v2-overlay v2-overlay-center">
      <div className="v2-overlay-bg" />
      <div role="alertdialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="v2-modal" style={{ maxWidth: 420 }}>
        <h3 className="text-[17px] font-semibold">{title}</h3>
        {desc ? <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)" }}>{desc}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
