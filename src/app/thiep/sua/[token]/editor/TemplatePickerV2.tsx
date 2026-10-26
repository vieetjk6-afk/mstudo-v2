"use client";

import { Check } from "lucide-react";
import { GroupLabel } from "@/components/v2/kit";
import { Drawer } from "@/components/v2/kit-client";
import { TEMPLATE_GROUPS, WEDDING_TEMPLATE_CATALOG, type WeddingTemplateMeta } from "../../../[slug]/templates";
import { Mini } from "./TemplateGallery";

/* ═══════════════════════════════════════════════════════════════════════════
   BỘ CHỌN MẪU THIỆP — giao diện mới: lưới mẫu gọn trong ngăn kéo. Bản thu nhỏ
   của từng mẫu dùng CHUNG với bản cũ (Mini ở ./TemplateGallery — vẽ đúng bảng
   màu và kiểu chữ của mẫu, kèm ảnh bìa thật của cặp đôi). Bấm một mẫu là áp
   dụng ngay vào khung xem trước rồi đóng ngăn kéo; chỉ khi Lưu mới tới khách.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Dải màu gợi ý trên thẻ mẫu (mẫu đổi được cả bảng màu). */
function Dots({ t }: { t: WeddingTemplateMeta }) {
  if (!t.color) return null;
  return (
    <span className="ml-auto flex flex-none" title="Đổi được màu">
      {t.color.swatches.slice(0, 4).map((sw, k) => (
        <span key={sw.hex} className="h-2.5 w-2.5 rounded-full" style={{ background: sw.hex, marginLeft: k ? -3 : 0, boxShadow: "0 0 0 1.5px var(--sf)" }} />
      ))}
    </span>
  );
}

/** Thẻ "mẫu đang dùng" trong khối Mẫu thiệp. */
export function CurrentTemplateV2({
  meta, cover, bride, groom, action,
}: {
  meta: WeddingTemplateMeta;
  cover?: string;
  bride: string;
  groom: string;
  action: React.ReactNode;
}) {
  const wide = meta.group === "long";
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex-none overflow-hidden rounded-[10px]" style={{ width: wide ? 112 : 76, aspectRatio: wide ? "4 / 3" : "9 / 14", border: "1px solid var(--bd)" }}>
        <Mini t={meta} cover={cover} bride={bride} groom={groom} wide={wide} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--tx3)" }}>
          {wide ? "Trang thiệp dài" : "Thiệp điện thoại"}
        </p>
        <p className="flex w-full items-center gap-2 text-[15px] font-semibold">
          <span className="truncate">{meta.label}</span>
        </p>
        <p className="line-clamp-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>{meta.tagline}</p>
        <div className="mt-1.5">{action}</div>
      </div>
    </div>
  );
}

export default function TemplatePickerV2({
  open, onClose, value, onChange, cover, bride, groom,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (name: string) => void;
  cover?: string;
  bride: string;
  groom: string;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title="Chọn mẫu thiệp"
      desc="Bấm một mẫu để xem ngay trên khung xem trước. Đổi thoải mái — chỉ khi bấm “Lưu” mới áp dụng cho khách."
    >
      <div className="flex flex-col gap-6">
        {TEMPLATE_GROUPS.map((g) => {
          const items = WEDDING_TEMPLATE_CATALOG.filter((t) => t.group === g.key);
          const wide = g.key === "long";
          return (
            <section key={g.key} className="flex flex-col gap-2.5">
              <div>
                <GroupLabel count={`${items.length} mẫu`}>{g.title}</GroupLabel>
                <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>{g.hint}</p>
              </div>
              <div className={`grid gap-2.5 ${wide ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
                {items.map((t) => {
                  const on = value === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => { onChange(t.name); onClose(); }}
                      aria-pressed={on}
                      title={t.tagline}
                      className="overflow-hidden rounded-[12px] text-left transition-shadow"
                      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, boxShadow: on ? "0 0 0 2px var(--ac)" : undefined, background: "var(--sf)" }}
                    >
                      <div className="relative" style={{ aspectRatio: wide ? "4 / 3" : "9 / 14" }}>
                        <Mini t={t} cover={cover} bride={bride} groom={groom} wide={wide} />
                        {on && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--ac)", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}>
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-1.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                        <span className="flex items-center gap-1 text-[12.5px] font-semibold">
                          <span className="truncate">{t.label}</span>
                          <Dots t={t} />
                        </span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{t.tagline}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}
