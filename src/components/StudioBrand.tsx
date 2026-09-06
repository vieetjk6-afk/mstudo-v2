// White-label brand mark shown to customers: the studio's logo if uploaded,
// otherwise its name. No hooks, so it works in both server and client trees.
export default function StudioBrand({
  name,
  logoUrl,
  href,
  className = "",
  height = 36,
}: {
  name: string;
  logoUrl?: string | null;
  href?: string;
  className?: string;
  height?: number;
}) {
  const inner = logoUrl ? (
    <img src={logoUrl} alt={name} style={{ height, width: "auto" }} className="object-contain" />
  ) : (
    <span className="font-serif font-medium" style={{ fontSize: 20, letterSpacing: 0.2 }}>{name}</span>
  );
  const cls = `flex items-center ${className}`;
  return href ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
