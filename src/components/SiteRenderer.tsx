import HtmlEmbed from "@/components/HtmlEmbed";
import SiteNav from "@/components/SiteNav";
import SitePricing from "@/components/site/SitePricing";
import SiteContactFab, { type FabConfig } from "@/components/site/SiteContactFab";
import SiteViewPing from "@/components/site/SiteViewPing";
import { SITE_BLOCK_LABEL, type SiteBlock } from "@/lib/types";
import { buildPriceView } from "@/lib/site-pricing";
import { mapEmbedSrc, mapOpenHref } from "@/lib/site-map";
import type { SiteData } from "@/lib/site-loader";

const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);
const lines = (v: unknown) => str(v).split("\n").map((s) => s.trim()).filter(Boolean);

function isLightHex(hex?: string): boolean {
  if (!hex) return false;
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** Extract a YouTube/Vimeo embed URL from a pasted link. */
function embedUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function SiteRenderer({ data, demo = false }: { data: SiteData; demo?: boolean }) {
  const { site, blocks, owner } = data;
  const t = site.theme || {};
  const name = owner?.full_name || site.subdomain || "Studio";
  const fontVar = t.font === "sans" ? "var(--font-hanken, 'Hanken Grotesk'), system-ui, sans-serif" : "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif";

  const dark = (t.mode ?? (isLightHex(t.bg) ? "light" : "dark")) === "dark";
  const wrap = {
    "--s-bg": t.bg || "#0c0c0d",
    "--s-text": t.text || "#ececec",
    "--s-accent": t.accent || "#c7a76b",
    "--s-accentInk": isLightHex(t.accent) ? "#171717" : "#ffffff",
    "--s-border": dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    "--s-card": dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
    "--s-radius": t.radius === "sharp" ? "0px" : "14px",
    "--s-maxw": "100%",
    background: "var(--s-bg)",
    color: "var(--s-text)",
    minHeight: "100vh",
    // KHÔNG dùng overflow-x:hidden ở đây — nó sẽ phá position:sticky của menu.
    // Full-bleed dùng width:100% (không 100vw) nên vốn không gây tràn ngang.
  } as React.CSSProperties;

  // Advanced: user-authored CSS applied site-wide (scoped under the site root).
  // Bỏ '<'/'>' để chặn thoát khỏi <style> (vd "</style><img onerror=...>") → XSS.
  // Ngoài ra siết thêm để chống rò rỉ dữ liệu / UI-redress bằng CSS:
  //   • @import  → tải CSS ngoài (có thể chứa quy tắc theo dõi/exfil).
  //   • url(...) trỏ ra host ngoài → gửi request kèm thông tin ra máy chủ lạ.
  //   • expression(...) → thực thi mã trên IE cũ.
  // url() nội bộ (data:, /, cùng origin) vẫn được giữ để ảnh nền hoạt động.
  // Giải mã escape CSS trước khi lọc: nếu không, `@\69mport` / `u\72l(...)` /
  // `\3c/style>` sẽ vượt qua các regex bên dưới. Giải mã ra ký tự tương đương
  // (an toàn về ngữ nghĩa) rồi mới strip `<>` và loại at-rule/url ngoài.
  const decodeCssEscapes = (css: string) =>
    css
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => {
        const cp = parseInt(hex, 16);
        if (!cp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "";
        return String.fromCodePoint(cp);
      })
      .replace(/\\(.)/g, "$1");
  const stripCssThreats = (css: string) =>
    css
      .replace(/@import[^;]*;?/gi, "")
      .replace(/expression\s*\(/gi, "(")
      .replace(/url\(\s*(['"]?)\s*(?:https?:)?\/\/[^)]*\)/gi, "url()");
  // Thứ tự: decode → bỏ `<>` (chặn thoát <style>) → loại threat.
  const safeCss = t.customCss ? stripCssThreats(decodeCssEscapes(String(t.customCss)).replace(/[<>]/g, "")) : "";
  const customCssTag = safeCss ? <style dangerouslySetInnerHTML={{ __html: safeCss }} /> : null;

  const navPos = t.navPosition || "top";
  const maxw = t.contentWidth === "full" ? "100%" : 1040;
  // Menu rộng hơn thân trang một chút (giống vieetjk.com) để logo/nút không sát chữ.
  const navMax = t.contentWidth === "full" ? "100%" : 1180;
  const navItems = blocks
    .filter((b) => b.type !== "hero" && b.config?.navHidden !== true)
    .map((b) => ({ id: b.id, label: str(b.config?.navLabel) || str(b.config?.heading) || SITE_BLOCK_LABEL[b.type] }));
  const bookingHref = owner?.booking_token ? `/book/${owner.booking_token}` : null;

  const brand = t.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={t.logo} alt={name} style={{ height: 36, width: "auto" }} />
  ) : (
    <span className="s-brand-name" style={{ fontFamily: fontVar }}>{name}</span>
  );

  const content =
    blocks.length === 0 ? (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontFamily: fontVar, fontSize: 40 }}>{name}</h1>
          <p style={{ opacity: 0.6, marginTop: 8 }}>Trang đang được hoàn thiện.</p>
        </div>
      </div>
    ) : (
      (() => {
        // Render theo ĐOẠN: khối full-bleed (hero / html full) chiếm nguyên bề
        // rộng trang bằng width:100% (KHÔNG dùng 100vw → tránh lệch do thanh
        // cuộn); các khối thường gom vào cột giới hạn (căn giữa).
        const out: React.ReactNode[] = [];
        let boxed: React.ReactNode[] = [];
        const flush = () => {
          if (!boxed.length) return;
          out.push(
            <div key={`box-${out.length}`} style={{ maxWidth: maxw, margin: "0 auto", width: "100%", display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
              {boxed}
            </div>,
          );
          boxed = [];
        };
        for (const b of blocks) {
          const isHero = b.type === "hero";
          const isFullHtml = b.type === "html" && b.config?.width !== "contained";
          if (isHero || isFullHtml) {
            flush();
            out.push(
              <div id={`sec-${b.id}`} key={b.id} style={{ width: "100%", scrollMarginTop: 80 }}>
                <Block block={b} data={data} fontVar={fontVar} demo={demo} />
              </div>,
            );
          } else {
            const half = b.config?.width === "half";
            boxed.push(
              <div id={`sec-${b.id}`} key={b.id} style={{ flex: half ? "1 1 calc(50% - 0.5px)" : "1 1 100%", minWidth: half ? 300 : 0, scrollMarginTop: 80 }}>
                <Block block={b} data={data} fontVar={fontVar} demo={demo} />
              </div>,
            );
          }
        }
        flush();
        return <div style={{ width: "100%" }}>{out}</div>;
      })()
    );

  const footer = (
    <footer style={{ borderTop: "1px solid var(--s-border)", padding: "28px 24px", textAlign: "center", fontSize: 13, opacity: 0.55 }}>
      © {name}
    </footer>
  );

  // Đếm lượt xem — chỉ trên trang thật (bản xem trước của studio không tính).
  const viewPing = !demo && <SiteViewPing siteId={site.id} />;

  // Nút liên hệ nổi — dùng luôn thông tin studio đã có, studio bật/tắt trong
  // trình tạo website (theme.fab).
  const fab = blocks.length > 0 && (
    <SiteContactFab
      phone={owner?.pl_phone ?? null}
      facebook={owner?.pl_facebook ?? null}
      bookingHref={bookingHref}
      config={(t.fab || {}) as FabConfig}
    />
  );

  // Top / bottom navigation — responsive header (hamburger trên mobile).
  if (navPos === "top" || navPos === "bottom") {
    const bottom = navPos === "bottom";
    const bar = blocks.length > 0 && (
      <SiteNav
        items={navItems}
        bookingHref={bookingHref}
        logo={t.logo || null}
        name={name}
        bottom={bottom}
        fontVar={fontVar}
        maxWidth={navMax}
      />
    );
    return (
      <div style={wrap} id="top" className={bottom ? "s-has-bottom-nav" : undefined}>
        {customCssTag}
        {!bottom && bar}
        {content}
        {footer}
        {/* leave room so the fixed bottom bar doesn't cover the footer */}
        {bottom && blocks.length > 0 && <div style={{ height: 72 }} />}
        {bottom && bar}
        {fab}
        {viewPing}
      </div>
    );
  }

  // Left / right sidebar navigation.
  return (
    <div style={wrap} id="top">
      {customCssTag}
      <div className="s-shell" style={{ display: "flex", flexDirection: navPos === "right" ? "row-reverse" : "row", minHeight: "100vh" }}>
        {blocks.length > 0 && (
          <aside
            className="s-sidebar"
            style={{
              width: 240,
              flexShrink: 0,
              position: "sticky",
              top: 0,
              alignSelf: "flex-start",
              height: "100vh",
              padding: "30px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 22,
              borderRight: navPos === "left" ? "1px solid var(--s-border)" : undefined,
              borderLeft: navPos === "right" ? "1px solid var(--s-border)" : undefined,
            }}
          >
            <a href="#top" className="s-brand">{brand}</a>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
              {navItems.map((n) => (
                <a key={n.id} href={`#sec-${n.id}`} className="s-navlink">{n.label}</a>
              ))}
            </nav>
            {bookingHref && (
              <a href={bookingHref} className="s-cta" style={{ marginTop: "auto", justifyContent: "center" }}>Đặt lịch</a>
            )}
          </aside>
        )}
        <main style={{ flex: 1, minWidth: 0 }}>
          {content}
          {footer}
        </main>
      </div>
      {fab}
      {viewPing}
    </div>
  );
}

/** Khung một khối nội dung: khoảng thở đều nhau + đầu đề (nhãn nhỏ + tiêu đề). */
function Section({
  children, fontVar, heading, eyebrow, center = false, alt = false,
}: {
  children: React.ReactNode;
  fontVar: string;
  heading?: string;
  eyebrow?: string;
  center?: boolean;
  alt?: boolean;
}) {
  return (
    <section
      style={{
        maxWidth: "var(--s-maxw)",
        margin: "0 auto",
        padding: "clamp(48px,7vw,88px) clamp(20px,5vw,28px)",
        background: alt ? "var(--s-card)" : undefined,
      }}
    >
      {(heading || eyebrow) && (
        <div className={`s-sec-head${center ? " is-center" : ""}`}>
          {eyebrow && <span className="s-eyebrow">{eyebrow}</span>}
          {heading && <h2 className="s-h2" style={{ fontFamily: fontVar }}>{heading}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

function Block({ block, data, fontVar, demo = false }: { block: SiteBlock; data: SiteData; fontVar: string; demo?: boolean }) {
  const c = block.config || {};
  const t = data.site.theme || {};
  const { owner, albums, pricelist, priceLabels, feedback } = data;
  const name = owner?.full_name || data.site.subdomain || "Studio";
  const bookingHref = owner?.booking_token ? `/book/${owner.booking_token}` : null;
  const eyebrow = str(c.eyebrow) || undefined;
  const center = c.align === "center";

  switch (block.type) {
    case "hero": {
      const img = str(c.image);
      const left = t.heroAlign === "left";
      const heroH = t.heroSize === "small" ? "42vh" : t.heroSize === "large" ? "74vh" : "54vh";
      return (
        <section
          style={{
            position: "relative",
            minHeight: heroH,
            display: "flex",
            alignItems: "center",
            justifyContent: left ? "flex-start" : "center",
            textAlign: left ? "left" : "center",
            padding: left ? "clamp(40px,8vw,90px) 6vw" : "clamp(40px,8vw,90px) 24px",
            backgroundImage: img ? `linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.58)), url(${img})` : undefined,
            backgroundSize: "cover",
            // Tiêu điểm ảnh bìa (chỉnh khi chủ thể lệch): center/top/left/right…
            backgroundPosition: str(c.imagePos, "center"),
            color: img ? "#fff" : undefined,
          }}
        >
          <div style={{ maxWidth: 820, position: "relative" }}>
            {eyebrow && <span className="s-eyebrow" style={{ color: img ? "#fff" : undefined, opacity: img ? 0.86 : 1, marginBottom: 14 }}>{eyebrow}</span>}
            <h1 style={{ fontFamily: fontVar, fontSize: "clamp(36px,7vw,72px)", lineHeight: 1.05, marginTop: eyebrow ? 12 : 0 }}>{str(c.heading, name)}</h1>
            {str(c.subheading) && <p style={{ marginTop: 16, fontSize: "clamp(15px,1.7vw,19px)", opacity: 0.88, maxWidth: "56ch", marginLeft: left ? 0 : "auto", marginRight: left ? 0 : "auto" }}>{str(c.subheading)}</p>}
            {bookingHref && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26, justifyContent: left ? "flex-start" : "center" }}>
                <a href={bookingHref} className="s-cta">{str(c.button, "Đặt lịch")}</a>
              </div>
            )}
          </div>
        </section>
      );
    }
    case "about": {
      const img = str(c.image);
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Giới thiệu")} eyebrow={eyebrow} center={center}>
          <div style={{ display: "grid", gap: "clamp(22px,3vw,40px)", gridTemplateColumns: img ? "repeat(auto-fit,minmax(280px,1fr))" : "1fr", alignItems: "center" }}>
            <div style={{ lineHeight: 1.75, opacity: 0.88, fontSize: "clamp(14.5px,1.3vw,16px)" }}>
              {lines(c.text).map((p, i) => <p key={i} style={{ marginBottom: 12 }}>{p}</p>)}
            </div>
            {img && <img src={img} alt="" loading="lazy" style={{ width: "100%", borderRadius: "var(--s-radius)", objectFit: "cover", aspectRatio: "4/5", maxHeight: 560 }} />}
          </div>
        </Section>
      );
    }
    case "gallery": {
      const ids = Array.isArray(c.album_ids) ? (c.album_ids as string[]) : [];
      const picked = ids.length ? ids.map((id) => albums.find((a) => a.id === id)).filter(Boolean) as typeof albums : albums;
      if (picked.length === 0 && !demo) return null;
      const cols = Number(t.galleryCols) || 0;
      const minW = cols === 2 ? 320 : cols === 3 ? 250 : cols === 4 ? 190 : 250;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Bộ sưu tập")} eyebrow={eyebrow} center={center}>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: `repeat(auto-fill,minmax(${minW}px,1fr))` }}>
            {picked.length > 0
              ? picked.map((a) => (
                  <a key={a.id} href={`/album/${a.slug}`} className="s-tile">
                    {a.cover_url && <img src={a.cover_url} alt={a.title} loading="lazy" decoding="async" />}
                    <span className="s-tile-cap">{a.title}</span>
                  </a>
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="s-tile">
                    <img src={`https://picsum.photos/seed/vk-demo${i}/600/450`} alt="" />
                    <span className="s-tile-cap">Album mẫu {i + 1}</span>
                  </div>
                ))}
          </div>
          {picked.length === 0 && demo && <p style={{ marginTop: 12, fontSize: 12, opacity: 0.55 }}>(Ảnh mẫu — sẽ thay bằng album của bạn khi xuất bản)</p>}
        </Section>
      );
    }
    case "pricing": {
      // Chia theo loại bảng giá + nhóm, và chỉ hiện các loại studio đã chọn.
      const views = buildPriceView(pricelist, c, priceLabels);
      if (views.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Bảng giá")} eyebrow={eyebrow} center={center}>
          <SitePricing items={pricelist} config={c} labels={priceLabels} bookingHref={bookingHref} fontVar={fontVar} />
        </Section>
      );
    }
    case "testimonials": {
      if (feedback.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Khách hàng nói gì")} eyebrow={eyebrow} center={center}>
          <div className="s-grid s-grid--2">
            {feedback.map((f) => (
              <div key={f.id} className="s-card">
                {f.rating ? <p style={{ color: "var(--s-accent)", letterSpacing: 2 }}>{"★".repeat(f.rating)}</p> : null}
                <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.7, opacity: 0.9 }}>{f.content}</p>
                {f.client_name && <p style={{ marginTop: 10, fontSize: 13, opacity: 0.6 }}>— {f.client_name}</p>}
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case "contact": {
      const rows: { k: string; v: React.ReactNode }[] = [];
      if (owner?.pl_phone) rows.push({ k: "Điện thoại", v: <a href={`tel:${owner.pl_phone}`} style={{ color: "inherit" }}>{owner.pl_phone}</a> });
      if (str(c.email)) rows.push({ k: "Email", v: <a href={`mailto:${str(c.email)}`} style={{ color: "inherit" }}>{str(c.email)}</a> });
      if (owner?.pl_facebook) rows.push({ k: "Facebook", v: owner.pl_facebook });
      if (str(c.address)) rows.push({ k: "Địa chỉ", v: str(c.address) });
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Liên hệ")} eyebrow={eyebrow} center={center}>
          <div style={{ display: "grid", gap: "clamp(20px,3vw,36px)", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 2 }}>
              {rows.map((r) => (
                <div key={r.k} style={{ display: "flex", gap: 14, padding: "11px 0", borderBottom: "1px solid var(--s-border)", fontSize: 15 }}>
                  <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".08em", paddingTop: 2 }}>{r.k}</span>
                  <span style={{ fontWeight: 500 }}>{r.v}</span>
                </div>
              ))}
            </div>
            {bookingHref && (
              <div className="s-card" style={{ textAlign: "center" }}>
                <p style={{ fontFamily: fontVar, fontSize: 20 }}>{str(c.bookHeading, "Giữ ngày đẹp của bạn")}</p>
                <p style={{ marginTop: 8, fontSize: 13.5, opacity: 0.75, lineHeight: 1.6 }}>{str(c.bookText, "Gửi yêu cầu đặt lịch, studio sẽ liên hệ xác nhận sớm nhất.")}</p>
                <a href={bookingHref} className="s-cta" style={{ marginTop: 18 }}>Đặt lịch ngay</a>
              </div>
            )}
          </div>
        </Section>
      );
    }
    case "video": {
      const url = embedUrl(str(c.url));
      if (!url) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Video")} eyebrow={eyebrow} center={center}>
          <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: "var(--s-radius)", overflow: "hidden" }}>
            <iframe src={url} title="video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
          </div>
        </Section>
      );
    }
    case "social": {
      const links: { label: string; url: string }[] = [
        { label: "Facebook", url: str(c.facebook) },
        { label: "Instagram", url: str(c.instagram) },
        { label: "TikTok", url: str(c.tiktok) },
        { label: "YouTube", url: str(c.youtube) },
      ].filter((l) => l.url);
      if (links.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Theo dõi")} eyebrow={eyebrow} center={center}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {links.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer" style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid var(--s-border)", color: "inherit", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
                {l.label}
              </a>
            ))}
          </div>
        </Section>
      );
    }
    case "faq": {
      const items = lines(c.items)
        .map((line) => { const [q, ...a] = line.split("|"); return { q: q.trim(), a: a.join("|").trim() }; })
        .filter((x) => x.q);
      if (items.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Câu hỏi thường gặp")} eyebrow={eyebrow} center={center}>
          <div>
            {items.map((it, i) => (
              <details key={i} className="s-faq" open={i === 0}>
                <summary>{it.q}</summary>
                {it.a && <p className="s-faq-a">{it.a}</p>}
              </details>
            ))}
          </div>
        </Section>
      );
    }
    case "services": {
      const items = lines(c.items)
        .map((line) => { const [title, ...d] = line.split("|"); return { title: title.trim(), desc: d.join("|").trim() }; })
        .filter((x) => x.title);
      if (items.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Dịch vụ")} eyebrow={eyebrow} center={center}>
          <div className="s-grid s-grid--3">
            {items.map((it, i) => (
              <div key={i} className="s-card">
                <span style={{ color: "var(--s-accent)", fontFamily: fontVar, fontSize: 22, fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                <p style={{ fontFamily: fontVar, fontSize: 19, marginTop: 6 }}>{it.title}</p>
                {it.desc && <p style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.65, fontSize: 14 }}>{it.desc}</p>}
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case "stats": {
      const items = lines(c.items)
        .map((line) => { const [value, ...l] = line.split("|"); return { value: value.trim(), label: l.join("|").trim() }; })
        .filter((x) => x.value);
      if (items.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading)} eyebrow={eyebrow} center={center}>
          <div className="s-stats">
            {items.map((it, i) => (
              <div key={i}>
                <p className="s-stat-v" style={{ fontFamily: fontVar }}>{it.value}</p>
                {it.label && <p className="s-stat-l">{it.label}</p>}
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case "cta": {
      return (
        <section style={{ maxWidth: "var(--s-maxw)", margin: "0 auto", padding: "clamp(20px,3vw,28px)" }}>
          <div style={{ borderRadius: "var(--s-radius)", border: "1px solid var(--s-border)", padding: "clamp(30px,6vw,60px)", textAlign: "center", background: "color-mix(in srgb, var(--s-accent) 8%, transparent)" }}>
            {eyebrow && <span className="s-eyebrow">{eyebrow}</span>}
            <h2 style={{ fontFamily: fontVar, fontSize: "clamp(26px,4vw,40px)", marginTop: eyebrow ? 10 : 0 }}>{str(c.heading, "Sẵn sàng lưu giữ khoảnh khắc của bạn?")}</h2>
            {str(c.text) && <p style={{ marginTop: 12, opacity: 0.85, lineHeight: 1.65, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }}>{str(c.text)}</p>}
            {bookingHref && (
              <a href={bookingHref} className="s-cta" style={{ marginTop: 24 }}>{str(c.button, "Đặt lịch")}</a>
            )}
          </div>
        </section>
      );
    }
    case "team": {
      const items = lines(c.items)
        .map((line) => { const [n, role, img] = line.split("|"); return { n: (n || "").trim(), role: (role || "").trim(), img: (img || "").trim() }; })
        .filter((x) => x.n);
      if (items.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Đội ngũ")} eyebrow={eyebrow} center={center}>
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", textAlign: "center" }}>
            {items.map((it, i) => (
              <div key={i}>
                <div style={{ width: 118, height: 118, margin: "0 auto", borderRadius: 999, overflow: "hidden", border: "1px solid var(--s-border)", background: "var(--s-card)" }}>
                  {it.img && <img src={it.img} alt={it.n} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <p style={{ fontFamily: fontVar, fontSize: 17, marginTop: 12 }}>{it.n}</p>
                {it.role && <p style={{ opacity: 0.7, fontSize: 13, marginTop: 2 }}>{it.role}</p>}
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case "quote": {
      if (!str(c.text)) return null;
      return (
        <section style={{ maxWidth: "var(--s-maxw)", margin: "0 auto", padding: "clamp(48px,7vw,80px) 24px", textAlign: "center" }}>
          <p style={{ fontFamily: fontVar, fontSize: "clamp(22px,3.4vw,34px)", lineHeight: 1.45, fontStyle: "italic", maxWidth: "34ch", marginLeft: "auto", marginRight: "auto" }}>
            “{str(c.text)}”
          </p>
          {str(c.author) && <p style={{ marginTop: 18, color: "var(--s-accent)", fontWeight: 600, fontSize: 13.5, letterSpacing: ".06em", textTransform: "uppercase" }}>{str(c.author)}</p>}
        </section>
      );
    }
    case "logos": {
      const items = lines(c.items);
      if (items.length === 0) return null;
      return (
        <Section fontVar={fontVar} heading={str(c.heading)} eyebrow={eyebrow} center={center}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(22px,4vw,44px)", alignItems: "center", justifyContent: "center" }}>
            {items.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" style={{ height: 38, maxWidth: 160, objectFit: "contain", opacity: 0.65, filter: "grayscale(1)" }} />
            ))}
          </div>
        </Section>
      );
    }
    case "map": {
      const addr = str(c.address);
      // Ưu tiên link Google Maps studio dán (ghim đúng vị trí); nếu chưa có thì
      // vẫn tìm theo địa chỉ chữ như trước.
      const src = mapEmbedSrc(str(c.mapUrl), addr);
      if (!src) return null;
      const open = mapOpenHref(str(c.mapUrl), addr);
      return (
        <Section fontVar={fontVar} heading={str(c.heading, "Địa chỉ")} eyebrow={eyebrow} center={center}>
          {(addr || open) && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 16, justifyContent: center ? "center" : "flex-start" }}>
              {addr && <p style={{ opacity: 0.78 }}>{addr}</p>}
              {open && (
                <a href={open} target="_blank" rel="noreferrer" style={{ color: "var(--s-accent)", fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>
                  Chỉ đường →
                </a>
              )}
            </div>
          )}
          <div style={{ borderRadius: "var(--s-radius)", overflow: "hidden", border: "1px solid var(--s-border)" }}>
            <iframe
              title={addr || "Bản đồ"}
              src={src}
              style={{ width: "100%", height: Number(c.height) || 360, border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Section>
      );
    }
    case "html": {
      // User-authored HTML/embed for their own public site. CSP (script-src
      // whitelist) is the safety net against injected external scripts.
      const html = str(c.html);
      if (!html) return null;
      const heading = str(c.heading);
      // Contained = boxed widget; otherwise full-bleed (the wrapper already
      // breaks it out to 100vw) so the embed owns the whole page width.
      if (c.width === "contained") {
        return (
          <Section fontVar={fontVar} heading={heading || undefined} eyebrow={eyebrow} center={center}>
            <HtmlEmbed html={html} />
          </Section>
        );
      }
      return (
        <div style={{ width: "100%" }}>
          {heading && <h2 style={{ fontFamily: fontVar, fontSize: 30, textAlign: "center", margin: "32px 0 0" }}>{heading}</h2>}
          <HtmlEmbed html={html} />
        </div>
      );
    }
    default:
      return null;
  }
}
