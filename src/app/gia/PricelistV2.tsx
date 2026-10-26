import { Banknote, CalendarCheck, Check, FileText, Info, Phone, Star, Tags } from "lucide-react";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { Empty, InfoList, Section, Stack, btn, iconBtn } from "@/components/v2/kit";
import type { PosterContact, PosterList, PosterTheme } from "@/components/PricelistPoster";
import { CustomerRootAuto, StickyActionBar } from "@/app/c/[token]/DocPartsV2";
import { vnd, type PricelistItem } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   BẢNG GIÁ CÔNG KHAI (/banggia, /gia/<token>) — giao diện mới. Cùng dữ liệu,
   cùng link với PricelistPoster (bản cũ): tab theo bảng giá (?list=), gói theo
   nhóm, gói "Đầy đủ nhất", lưu ý, điều khoản, liên hệ & chuyển khoản, nút
   "Chọn gói & đặt lịch" mang tên gói sang form đặt lịch (?pkg=).

   Màu studio tự chọn ở Bảng giá vẫn được tôn trọng: `pl_accent` thành màu chủ
   đạo của cả trang (nút, giá, gói nổi bật), `pl_bg` + `pl_text` tô dải đầu
   trang. Phần thân dùng bộ màu V2 để chữ luôn đủ tương phản.
   ═══════════════════════════════════════════════════════════════════════════ */

const bullets = (d: string | null) => (d || "").split("\n").map((s) => s.trim()).filter(Boolean);

export default function PricelistV2({
  contact,
  items,
  lists,
  selected,
  tabBase,
  bookHref,
  theme,
  clauses = "",
}: {
  contact: PosterContact;
  items: PricelistItem[];
  lists: PosterList[];
  selected: string;
  tabBase: string;
  bookHref: string;
  theme?: PosterTheme;
  clauses?: string;
}) {
  const o = contact;
  const selectedList = lists.find((l) => l.key === selected) || lists[0];
  const hasBank = o.pl_bank_holder || o.pl_bank_account || o.pl_bank_name;
  const studio = o.full_name || "Studio";
  const tel = o.pl_phone ? `tel:${o.pl_phone.replace(/[^\d+]/g, "")}` : null;

  // Cùng cách chia nhóm với bản cũ: nhóm có giá là gói, nhóm toàn giá 0 là lưu ý.
  const groups: { name: string; items: PricelistItem[] }[] = [];
  for (const it of items) {
    const cat = it.category?.trim() || "Gói dịch vụ";
    let g = groups.find((x) => x.name === cat);
    if (!g) {
      g = { name: cat, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  const pkgGroups = groups.filter((g) => g.items.some((i) => i.price > 0));
  const noteGroups = groups.filter((g) => g.items.every((i) => i.price === 0));
  const pkgHref = (it: PricelistItem) => {
    const pkg = `${selectedList?.label || ""} · ${it.name}`;
    const sep = bookHref.includes("?") ? "&" : "?";
    return bookHref.includes("/book/") ? `${bookHref}${sep}pkg=${encodeURIComponent(pkg)}` : bookHref;
  };

  // Màu studio: accent → --ac-base (khung V2 tự trộn ra các sắc nhạt/đậm).
  const rootStyle = theme?.accent ? ({ ["--ac-base" as string]: theme.accent } as React.CSSProperties) : undefined;
  const bandBg = theme?.bg || "var(--acS)";
  const bandInk = theme?.text || "var(--tx)";
  const bandMuted = theme?.text ? `color-mix(in srgb, ${theme.text} 70%, transparent)` : "var(--tx2)";
  const bandLine = theme?.text ? `color-mix(in srgb, ${theme.text} 22%, transparent)` : "var(--bd)";

  return (
    <div style={rootStyle}>
      <CustomerRootAuto>
        <CustomerHeaderV2
          brand={{ name: studio, logoUrl: theme?.logo || null }}
          sub="Bảng giá dịch vụ"
          right={
            <>
              {tel ? (
                <a href={tel} className={iconBtn()} aria-label="Gọi studio" title={`Gọi ${o.pl_phone}`}>
                  <Phone size={18} />
                </a>
              ) : null}
              <a href={bookHref} className={btn("primary", "sm", "hidden sm:inline-flex")}>
                <CalendarCheck size={15} /> Đặt lịch
              </a>
            </>
          }
        />

        {/* Dải đầu trang — màu nền/chữ studio chọn cho bảng giá. */}
        <section style={{ background: bandBg, color: bandInk, borderBottom: `1px solid ${bandLine}` }}>
          <div
            className="mx-auto w-full max-w-[1080px] py-7 sm:py-10"
            style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: bandMuted }}>
              {studio}
            </p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.6px] sm:text-[34px]" style={{ textWrap: "balance" }}>
              {selectedList?.title || "Bảng giá dịch vụ"}
            </h1>
            <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed" style={{ color: bandMuted, textWrap: "pretty" }}>
              Chọn gói phù hợp rồi đặt lịch trực tuyến — studio sẽ liên hệ xác nhận với bạn.
            </p>
            {lists.length > 1 && (
              <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Chọn bảng giá">
                {lists.map((l) => {
                  const on = l.key === selected;
                  return (
                    <a
                      key={l.key}
                      href={`${tabBase}?list=${l.key}`}
                      aria-current={on ? "page" : undefined}
                      className="inline-flex h-9 flex-none items-center rounded-full px-4 text-[13.5px] font-semibold"
                      style={on ? { background: "var(--ac)", color: "#fff" } : { background: "transparent", color: bandInk, border: `1px solid ${bandLine}` }}
                    >
                      {l.label}
                    </a>
                  );
                })}
              </nav>
            )}
          </div>
        </section>

        <CustomerMainV2>
          {items.length === 0 ? (
            <div className="v2-card">
              <Empty icon={Tags} title="Chưa cập nhật bảng giá" hint="Liên hệ studio để nhận báo giá chi tiết." />
            </div>
          ) : (
            <Stack gap={28}>
              {pkgGroups.map((g) => {
                const top = Math.max(...g.items.map((i) => i.price));
                return (
                  <section key={g.name} aria-label={g.name}>
                    <div className="mb-3 flex items-baseline gap-2">
                      <h2 className="text-[18px] font-bold tracking-[-0.3px] sm:text-[20px]">{g.name}</h2>
                      <span className="text-[13px]" style={{ color: "var(--tx3)" }}>
                        {g.items.length} gói
                      </span>
                    </div>
                    <div className="grid gap-4 pt-1 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                      {g.items.map((it) => {
                        const featured = it.price === top && g.items.length > 1;
                        return (
                          <article
                            key={it.id}
                            className="v2-card relative flex flex-col p-5"
                            style={featured ? { borderColor: "var(--ac)", boxShadow: "0 0 0 1px var(--ac), 0 10px 30px -18px color-mix(in srgb, var(--ac) 60%, transparent)" } : undefined}
                          >
                            {featured && (
                              <span
                                className="absolute -top-3 left-5 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold"
                                style={{ background: "var(--ac)", color: "#fff" }}
                              >
                                <Star size={11} fill="currentColor" /> Đầy đủ nhất
                              </span>
                            )}
                            <p className="text-[16px] font-semibold leading-snug">{it.name}</p>
                            <p className="mt-1.5 text-[26px] font-bold tracking-[-0.6px]" style={{ color: "var(--ac)", fontVariantNumeric: "tabular-nums" }}>
                              {vnd(it.price)}
                              {it.unit ? (
                                <span className="ml-1 text-[13px] font-medium tracking-normal" style={{ color: "var(--tx3)" }}>
                                  / {it.unit}
                                </span>
                              ) : null}
                            </p>
                            <ul className="mt-4 flex flex-1 flex-col gap-2">
                              {bullets(it.description).map((b, i) => (
                                <li key={i} className="flex items-start gap-2 text-[14px] leading-snug" style={{ color: "var(--tx2)" }}>
                                  <Check size={16} className="mt-[1px] flex-none" style={{ color: "var(--ac)" }} />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                            <a href={pkgHref(it)} className={btn(featured ? "primary" : "secondary", "md", "mt-5 w-full")}>
                              <CalendarCheck size={16} /> Chọn gói &amp; đặt lịch
                            </a>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {noteGroups.length > 0 && (
                <Section icon={Info} title="Lưu ý">
                  <div className="grid gap-5 md:grid-cols-2">
                    {noteGroups.map((g) => (
                      <div key={g.name}>
                        <p className="text-[14px] font-semibold">{g.name}</p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {g.items
                            .flatMap((it) => bullets(it.description))
                            .map((b, i) => (
                              <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                                <span className="mt-[9px] h-1 w-1 flex-none rounded-full" style={{ background: "var(--tx3)" }} />
                                <span>{b}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {clauses.trim() && (
                <Section icon={FileText} title="Điều khoản dịch vụ">
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[13.5px] font-semibold" style={{ color: "var(--ac)" }}>
                      <span className="group-open:hidden">Xem điều khoản</span>
                      <span className="hidden group-open:inline">Thu gọn</span>
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                      {clauses}
                    </p>
                  </details>
                </Section>
              )}

              <div className="grid items-start gap-4 md:grid-cols-2">
                {(o.pl_phone || o.pl_facebook || hasBank) && (
                  <Section icon={Banknote} title="Liên hệ & chuyển khoản">
                    <InfoList
                      items={[
                        ...(o.full_name ? [{ label: "Studio", value: o.full_name }] : []),
                        ...(o.pl_phone
                          ? [{ label: "Điện thoại", value: <a href={tel!} style={{ color: "var(--ac)" }}>{o.pl_phone}</a> }]
                          : []),
                        ...(o.pl_facebook ? [{ label: "Facebook", value: <span className="break-all">{o.pl_facebook}</span> }] : []),
                        ...(o.pl_bank_holder ? [{ label: "Chủ tài khoản", value: o.pl_bank_holder }] : []),
                        ...(o.pl_bank_account ? [{ label: "Số tài khoản", value: <span style={{ fontVariantNumeric: "tabular-nums" }}>{o.pl_bank_account}</span> }] : []),
                        ...(o.pl_bank_name ? [{ label: "Ngân hàng", value: o.pl_bank_name }] : []),
                      ]}
                    />
                  </Section>
                )}
                <div className="v2-card flex flex-col items-start gap-3 p-5" style={{ background: "var(--acS)", borderColor: "var(--acM)" }}>
                  <p className="text-[17px] font-bold tracking-[-0.3px]">Sẵn sàng đặt lịch?</p>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    Để đảm bảo chất lượng dịch vụ &amp; tránh trùng lịch, quý khách vui lòng book lịch và chốt hợp đồng sớm nhất.
                  </p>
                  <a href={bookHref} className={btn("primary", "lg")}>
                    <CalendarCheck size={18} /> Chọn gói &amp; đặt lịch
                  </a>
                </div>
              </div>
            </Stack>
          )}
          <div className="h-14 sm:hidden" aria-hidden />
        </CustomerMainV2>

        {/* Điện thoại: gọi + đặt lịch luôn trong tầm tay. */}
        <div className="sm:hidden">
          <StickyActionBar show>
            {tel ? (
              <a href={tel} className={btn("secondary", "md")} aria-label="Gọi studio">
                <Phone size={16} /> Gọi
              </a>
            ) : null}
            <a href={bookHref} className={btn("primary", "md", "flex-1")}>
              <CalendarCheck size={16} /> Chọn gói &amp; đặt lịch
            </a>
          </StickyActionBar>
        </div>
      </CustomerRootAuto>
    </div>
  );
}
