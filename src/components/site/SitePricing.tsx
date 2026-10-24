"use client";

import { useMemo, useState } from "react";
import { vnd } from "@/lib/types";
// CSS .s-*/.sp-* của website studio — tách khỏi globals để trang khác không phải tải.
import "@/components/site/site.css";
import {
  buildPriceView,
  bullets,
  packageBookHref,
  pricingGrouping,
  pricingLayout,
  type PriceListView,
  type PricingLayout,
  type SitePriceItem,
} from "@/lib/site-pricing";

/* ─────────────────────────────────────────────────────────────────────────────
   Khối BẢNG GIÁ của website studio — dùng chung cho trang đã xuất bản
   (SiteRenderer) và khung soạn (CanvasBuilder) nên hai bên hiện y như nhau.

   • Chia theo LOẠI bảng giá (cưới / đính hôn / sự kiện…): dạng tab hoặc xếp dọc.
   • Trong mỗi loại, chia tiếp theo NHÓM (category) studio đã đặt.
   • 3 kiểu trình bày: thẻ (card), gọn (compact), bảng (table).
   • Dòng giá 0đ ("Phát sinh thêm", "Lưu ý"…) tách xuống cuối dạng ghi chú.
   Toàn bộ màu/bo góc lấy từ biến --s-* nên tự khớp theme của trang.
   ───────────────────────────────────────────────────────────────────────────── */

export default function SitePricing({
  items,
  config,
  labels = {},
  bookingHref = null,
  fontVar,
  editable = false,
}: {
  items: SitePriceItem[];
  config: Record<string, unknown> | null | undefined;
  labels?: Record<string, string>;
  bookingHref?: string | null;
  fontVar?: string;
  /** Trong khung soạn: chặn điều hướng khi bấm nút đặt lịch. */
  editable?: boolean;
}) {
  const views = useMemo(() => buildPriceView(items, config, labels), [items, config, labels]);
  const layout = pricingLayout(config);
  const grouping = pricingGrouping(config);
  const showNotes = config?.showNotes !== false;
  const showBook = config?.showBook !== false && !!bookingHref;

  const [active, setActive] = useState(0);
  if (!views.length) return null;

  const tabbed = grouping === "tabs" && views.length > 1;
  const shown = tabbed ? [views[Math.min(active, views.length - 1)]] : views;

  return (
    <div className="sp-root">
      {tabbed && (
        <div className="sp-tabs" role="tablist">
          {views.map((v, i) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={i === (active < views.length ? active : 0)}
              className={`sp-tab${i === (active < views.length ? active : 0) ? " is-active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setActive(i); }}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {shown.map((view) => (
        <section key={view.key} className="sp-list">
          {!tabbed && views.length > 1 && (
            <h3 className="sp-list-title" style={{ fontFamily: fontVar }}>{view.label}</h3>
          )}

          {view.groups.map((g) => (
            <div key={g.name} className="sp-group">
              <div className="sp-group-h">
                <span>{g.name}</span>
                <i />
              </div>
              <Packages
                layout={layout}
                items={g.items.filter((i) => i.price > 0)}
                listKey={view.key}
                listLabel={view.label}
                bookingHref={showBook ? bookingHref : null}
                fontVar={fontVar}
                editable={editable}
              />
            </div>
          ))}

          {showNotes && view.notes.length > 0 && (
            <div className="sp-notes">
              {view.notes.map((g) => (
                <div key={g.name} className="sp-note">
                  <p className="sp-note-h">{g.name}</p>
                  <ul>
                    {g.items.flatMap((it) => bullets(it.description)).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Packages({
  layout, items, listKey, listLabel, bookingHref, fontVar, editable,
}: {
  layout: PricingLayout;
  items: SitePriceItem[];
  listKey: string;
  listLabel: string;
  bookingHref: string | null;
  fontVar?: string;
  editable: boolean;
}) {
  if (!items.length) return null;
  const href = (name: string) => packageBookHref(bookingHref, listKey, `${listLabel} · ${name}`);
  const stop = (e: React.MouseEvent) => { if (editable) e.preventDefault(); };

  if (layout === "table") {
    return (
      <div className="sp-table">
        {items.map((it) => (
          <div key={it.id} className="sp-row">
            <div className="sp-row-main">
              <p className="sp-row-name">{it.name}</p>
              {it.description && <p className="sp-row-desc">{bullets(it.description).join(" · ")}</p>}
            </div>
            <div className="sp-row-end">
              <span className="sp-price" style={{ fontFamily: fontVar }}>
                {vnd(it.price)}{it.unit ? <em> {it.unit}</em> : null}
              </span>
              {bookingHref && <a className="sp-link" href={href(it.name) ?? "#"} onClick={stop}>Đặt lịch</a>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div className="sp-compact">
        {items.map((it) => {
          const list = bullets(it.description);
          return (
            <div key={it.id} className="sp-mini">
              <div className="sp-mini-h">
                <p className="sp-mini-name">{it.name}</p>
                <span className="sp-price" style={{ fontFamily: fontVar }}>
                  {vnd(it.price)}{it.unit ? <em> {it.unit}</em> : null}
                </span>
              </div>
              {list.length > 0 && (
                <ul className="sp-mini-list">
                  {list.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              {bookingHref && <a className="sp-link" href={href(it.name) ?? "#"} onClick={stop}>Đặt lịch gói này →</a>}
            </div>
          );
        })}
      </div>
    );
  }

  // card — thẻ đầy đủ, gói cao nhất trong nhóm được đánh dấu.
  const top = Math.max(...items.map((i) => i.price));
  return (
    <div className="sp-cards">
      {items.map((it) => {
        const featured = items.length > 1 && it.price === top;
        return (
          <div key={it.id} className={`sp-card${featured ? " is-feat" : ""}`}>
            {featured && <span className="sp-badge">Đầy đủ nhất</span>}
            <p className="sp-card-name" style={{ fontFamily: fontVar }}>{it.name}</p>
            <p className="sp-card-price" style={{ fontFamily: fontVar }}>
              {vnd(it.price)}{it.unit ? <em> {it.unit}</em> : null}
            </p>
            {it.description && (
              <ul className="sp-card-list">
                {bullets(it.description).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            {bookingHref && (
              <a className={`sp-btn${featured ? " is-solid" : ""}`} href={href(it.name) ?? "#"} onClick={stop}>
                Chọn gói này
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { PriceListView };
