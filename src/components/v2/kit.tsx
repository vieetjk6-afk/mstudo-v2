import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   BỘ KHỐI GIAO DIỆN MỚI (v2) — phần THUẦN, không hook, dùng được cả ở server
   component. Phần có tương tác (menu ⋯, tab, ngăn kéo, popup, công tắc) ở
   ./kit-client.tsx. Kiểu dáng nằm ở globals.css, khối "BỘ KHỐI V2".

   Luật bố cục chung của mọi màn V2 (xem docs/giao-dien-moi.md):
     • Tiêu đề màn đã có trên topbar → nội dung mở đầu bằng <PageHead> gồm một
       câu mô tả ngắn + nút. Chỉ MỘT nút "primary" mỗi màn; thao tác phụ dùng
       "secondary", ít dùng thì dồn vào <Menu> ⋯.
     • Số liệu đầu trang: tối đa 4 <Stat> trong <StatGrid>.
     • Bộ lọc: một <Toolbar> — ô tìm + <Segmented> + vài <select>. Lọc hiếm
       dùng cho vào <Drawer>.
     • Nội dung chia khối bằng <Section>/<Card>; khoảng cách giữa khối 20px
       (`v2-stack`).
     • Danh sách: <ListRow> (điện thoại thành thẻ), hoặc bảng `.v2-table`.
     • Màu chỉ mang nghĩa: green = xong/đã thu · amber = chờ/thiếu ·
       red = quá hạn/lỗi · blue = thông tin · brand = màu chủ đạo.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Tone = "green" | "amber" | "red" | "blue" | "brand" | "gray" | "violet" | "teal";

const TONE_VAR: Record<Tone, [string, string]> = {
  green: ["var(--gn)", "var(--gnS)"],
  amber: ["var(--am)", "var(--amS)"],
  red: ["var(--rd)", "var(--rdS)"],
  blue: ["var(--bl)", "var(--blS)"],
  brand: ["var(--ac)", "var(--acS)"],
  gray: ["var(--tx2)", "var(--nuS)"],
  violet: ["var(--pu)", "var(--puS)"],
  teal: ["var(--tl)", "var(--tlS)"],
};
export const toneFg = (t: Tone) => TONE_VAR[t][0];
export const toneBg = (t: Tone) => TONE_VAR[t][1];

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

/* ── Nút ─────────────────────────────────────────────────────────────────── */
export type BtnVariant = "primary" | "secondary" | "ghost" | "soft" | "danger";
export type BtnSize = "sm" | "md" | "lg";

/** Lớp CSS của nút — dùng cho cả <button> lẫn <Link>/<a>. */
export function btn(variant: BtnVariant = "secondary", size: BtnSize = "md", extra = "") {
  return cx("v2-btn", `v2-btn-${variant}`, size !== "md" && `v2-btn-${size}`, extra);
}

/** Nút chỉ có icon (36×36, tròn nhẹ). Bắt buộc có `label` cho trình đọc màn hình. */
export function iconBtn(extra = "") {
  return cx("v2-icon-btn", extra);
}

/* ── Đầu trang ───────────────────────────────────────────────────────────── */
export function PageHead({
  title,
  desc,
  actions,
  children,
}: {
  /** Thường bỏ trống — topbar đã có tên màn. Chỉ đặt khi màn là trang con. */
  title?: React.ReactNode;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="v2-pagehead">
      <div className="min-w-0 flex-1">
        {title ? <h2 className="v2-pagehead-title">{title}</h2> : null}
        {desc ? <p className="v2-pagehead-desc">{desc}</p> : null}
        {children}
      </div>
      {actions ? <div className="v2-pagehead-actions">{actions}</div> : null}
    </div>
  );
}

/* ── Khối & thẻ ──────────────────────────────────────────────────────────── */
export function Card({
  children,
  className,
  padded = true,
  style,
  ...rest
}: { children: React.ReactNode; className?: string; padded?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("v2-card", padded && "v2-card-pad", className)} style={style}>
      {children}
    </div>
  );
}

/** Khối có đầu (tiêu đề + mô tả + nút bên phải) và thân. */
export function Section({
  title,
  desc,
  icon: Icon,
  actions,
  children,
  flush = false,
  className,
  id,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** true = thân không đệm (bảng, danh sách sát mép). */
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("v2-card", className)}>
      <header className="v2-section-head">
        {Icon ? (
          <span className="v2-section-icon">
            <Icon size={17} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">{title}</h3>
          {desc ? <p className="v2-section-desc">{desc}</p> : null}
        </div>
        {actions ? <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={flush ? "" : "v2-card-pad"}>{children}</div>
    </section>
  );
}

/** Xếp các khối theo chiều dọc, cách nhau 20px. */
export function Stack({ children, className, gap = 20 }: { children: React.ReactNode; className?: string; gap?: number }) {
  return (
    <div className={cx("flex min-w-0 flex-col", className)} style={{ gap }}>
      {children}
    </div>
  );
}

/* ── Số liệu ─────────────────────────────────────────────────────────────── */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cx("v2-statgrid", `v2-statgrid-${cols}`)}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
  href,
  valueTone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  /** Tô màu con số (vd công nợ = amber). Mặc định chữ thường. */
  valueTone?: Tone;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="v2-stat-label">{label}</p>
        {Icon ? (
          <span className="v2-stat-icon" style={{ color: toneFg(tone), background: toneBg(tone) }}>
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <p className="v2-stat-value" style={valueTone ? { color: toneFg(valueTone) } : undefined}>
        {value}
      </p>
      {sub ? <p className="v2-stat-sub">{sub}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="v2-card v2-stat v2-card-link">
      {inner}
    </Link>
  ) : (
    <div className="v2-card v2-stat">{inner}</div>
  );
}

/* ── Nhãn ────────────────────────────────────────────────────────────────── */
export function Badge({
  tone = "gray",
  dot = false,
  icon: Icon,
  children,
  solid = false,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  /** Nền đặc (đặt trên ảnh bìa). */
  solid?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="v2-badge"
      style={solid ? { background: toneFg(tone), color: "#fff" } : { background: toneBg(tone), color: toneFg(tone) }}
    >
      {dot ? <span className="v2-badge-dot" style={{ background: solid ? "#fff" : toneFg(tone) }} /> : null}
      {Icon ? <Icon size={12} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

/* ── Thanh công cụ (tìm + lọc) ───────────────────────────────────────────── */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("v2-toolbar", className)}>{children}</div>;
}

/* ── Ô nhập ──────────────────────────────────────────────────────────────── */
/** Lớp CSS chung cho input / select / textarea của giao diện mới. */
export const inputCls = "v2-input";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx("v2-field", className)}>
      {label ? (
        <label className="v2-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="v2-field-error">{error}</p> : hint ? <p className="v2-field-hint">{hint}</p> : null}
    </div>
  );
}

/* ── Danh sách ───────────────────────────────────────────────────────────── */
/** Nhãn nhóm trong danh sách (vd "Tháng 10/2026 · 6 album"). */
export function GroupLabel({ children, count }: { children: React.ReactNode; count?: React.ReactNode }) {
  return (
    <div className="v2-grouplabel">
      <span>{children}</span>
      {count !== undefined ? <span className="v2-grouplabel-count">{count}</span> : null}
    </div>
  );
}

/** Một dòng danh sách: avatar/icon · tiêu đề + dòng phụ · phần phải. */
export function ListRow({
  leading,
  title,
  sub,
  meta,
  trailing,
  href,
  onClick,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Cột giữa phụ (ẩn trên điện thoại). */
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {leading ? <div className="flex-none">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="v2-row-title">{title}</p>
        {sub ? <p className="v2-row-sub">{sub}</p> : null}
      </div>
      {meta ? <div className="hidden min-w-0 flex-none md:block">{meta}</div> : null}
      {trailing ? <div className="flex flex-none items-center gap-2">{trailing}</div> : null}
    </>
  );
  if (href)
    return (
      <Link href={href} className="v2-row v2-row-link">
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="v2-row v2-row-link w-full text-left">
        {body}
      </button>
    );
  return <div className="v2-row">{body}</div>;
}

/** Hai cột nhãn — giá trị (thông tin hợp đồng, khách…). */
export function InfoList({ items }: { items: { label: React.ReactNode; value: React.ReactNode }[] }) {
  return (
    <dl className="v2-info">
      {items.map((it, i) => (
        <div key={i} className="v2-info-row">
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Avatar chữ cái ──────────────────────────────────────────────────────── */
const AV = ["#0b5cc4", "#0f8a8a", "#7c3aed", "#c2410c", "#15803d", "#be185d", "#4a6fa5", "#a16207"];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const n = (name || "?").trim();
  const ini = n.split(/\s+/).map((w) => w[0]).slice(-2).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = AV[h % AV.length];
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, color: c, background: `color-mix(in srgb, ${c} 13%, var(--sf))` }}
      aria-hidden
    >
      {ini}
    </span>
  );
}

/* ── Trống ───────────────────────────────────────────────────────────────── */
export function Empty({
  icon: Icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("v2-empty", compact && "v2-empty-compact")}>
      <span className="v2-empty-icon">
        <Icon size={compact ? 20 : 24} />
      </span>
      <p className="v2-empty-title">{title}</p>
      {hint ? <p className="v2-empty-hint">{hint}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ── Thanh tiến độ ───────────────────────────────────────────────────────── */
export function Progress({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const w = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="v2-progress" role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${w}%`, background: toneFg(tone) }} />
    </div>
  );
}

/* ── Thông báo trong trang ───────────────────────────────────────────────── */
export function Callout({
  tone = "blue",
  icon: Icon,
  title,
  children,
  action,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="v2-callout" style={{ background: toneBg(tone), borderColor: `color-mix(in srgb, ${toneFg(tone)} 22%, transparent)` }}>
      {Icon ? <Icon size={18} style={{ color: toneFg(tone), flex: "none", marginTop: 1 }} /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13.5px] font-semibold" style={{ color: toneFg(tone) }}>{title}</p> : null}
        {children ? <div className="text-[13px]" style={{ color: "var(--tx2)" }}>{children}</div> : null}
      </div>
      {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
    </div>
  );
}
