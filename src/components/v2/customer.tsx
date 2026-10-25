import type { StudioBrandInfo } from "@/lib/studio-brand";

/* ═══════════════════════════════════════════════════════════════════════════
   KHUNG TRANG KHÁCH — giao diện mới. Trang khách (hợp đồng, báo giá, album,
   cổng khách, đặt lịch, form, voucher, cổng thợ…) không có khung studio, nên
   dùng khung này để nhận đúng bộ màu V2 (`.client-doc.ui-v2` ở globals.css) và
   một đầu trang thương hiệu thống nhất. Bật hay không do `customerUiV2(ownerId)`
   ở @/lib/ui-server quyết định (page.tsx gọi, truyền xuống).

   Mọi khối bên trong dùng bộ khối ./kit.tsx + ./kit-client.tsx như khu quản lý.
   ═══════════════════════════════════════════════════════════════════════════ */

export function CustomerRootV2({
  children,
  theme = "light",
  className = "",
}: {
  children: React.ReactNode;
  /** Trang tự hỗ trợ nền tối (cổng khách, album) thì truyền theme đang dùng. */
  theme?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={`client-doc ui-v2 min-h-screen ${className}`} data-theme={theme} style={{ background: "var(--bg)", color: "var(--tx)" }}>
      {children}
    </div>
  );
}

/** Đầu trang: logo + tên studio bên trái, phần phải tuỳ trang (nút liên hệ, trạng thái…). */
export function CustomerHeaderV2({
  brand,
  sub,
  right,
}: {
  brand: StudioBrandInfo;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const initials = brand.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header
      className="sticky top-0 z-30"
      style={{ background: "var(--topbar)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--bd)" }}
    >
      <div
        className="mx-auto flex h-[60px] w-full max-w-[1080px] items-center gap-3"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="h-9 w-9 flex-none rounded-[10px] object-cover" />
        ) : (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[13px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{brand.name}</p>
          {sub ? <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
        </div>
        {right ? <div className="flex flex-none items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

/** Cột nội dung trang khách: rộng tối đa 1080px (tài liệu) hoặc tuỳ `width`. */
export function CustomerMainV2({ children, width = 1080 }: { children: React.ReactNode; width?: number }) {
  return (
    <main
      className="mx-auto w-full min-w-0 pb-16 pt-6"
      style={{ maxWidth: width, paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
    >
      {children}
    </main>
  );
}
