"use client";

import { Check } from "lucide-react";
import { TEMPLATE_GROUPS, WEDDING_TEMPLATE_CATALOG, type WeddingTemplateMeta } from "../../../[slug]/templates";

// Bộ chọn mẫu: mỗi thẻ là một BẢN THU NHỎ vẽ bằng CSS theo đúng bảng màu và
// kiểu chữ của mẫu, kèm ảnh bìa thật của cặp đôi nếu đã tải lên. Bấm vào thẻ là
// khung xem trước bên cạnh đổi sang mẫu đó ngay (chưa lưu cho tới khi bấm Lưu).

function Mini({ t, cover, bride, groom, wide }: { t: WeddingTemplateMeta; cover?: string; bride: string; groom: string; wide: boolean }) {
  const font = t.serif ? "var(--font-cormorant), serif" : "var(--font-be-vietnam), system-ui, sans-serif";
  const faint = t.dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.12)";
  const line = (w: string) => <span style={{ display: "block", height: 3, width: w, borderRadius: 2, background: faint }} />;

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: font, height: "100%", display: "flex", flexDirection: "column", gap: 5, padding: wide ? 8 : 7, overflow: "hidden" }}>
      <div style={{ height: wide ? "46%" : "38%", borderRadius: 3, overflow: "hidden", background: faint, flex: "none" }}>
        {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      <div style={{ textAlign: "center", lineHeight: 1.1, flex: "none" }}>
        <div style={{ fontSize: wide ? 13 : 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bride}</div>
        <div style={{ fontSize: 8, color: t.accent }}>&amp;</div>
        <div style={{ fontSize: wide ? 13 : 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{groom}</div>
      </div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center", flex: "none" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ width: 13, height: 15, borderRadius: 2, border: `1px solid ${t.accent}`, opacity: 0.8 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center", marginTop: 1 }}>
        {line("70%")}{line("55%")}
        <span style={{ marginTop: 2, display: "block", height: 6, width: "48%", borderRadius: 99, background: t.accent }} />
      </div>
    </div>
  );
}

export default function TemplateGallery({
  value, onChange, cover, bride, groom,
}: {
  value: string;
  onChange: (name: string) => void;
  cover?: string;
  bride: string;
  groom: string;
}) {
  return (
    <div className="space-y-5">
      {TEMPLATE_GROUPS.map((g) => {
        const items = WEDDING_TEMPLATE_CATALOG.filter((t) => t.group === g.key);
        const wide = g.key === "long";
        return (
          <div key={g.key}>
            <p className="text-sm font-medium text-stone-700">{g.title} <span className="font-normal text-stone-400">· {items.length} mẫu</span></p>
            <p className="mb-2 text-xs text-stone-400">{g.hint}</p>
            <div className={`grid gap-2 ${wide ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
              {items.map((t) => {
                const on = value === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => onChange(t.name)}
                    aria-pressed={on}
                    title={t.tagline}
                    className={`group overflow-hidden rounded-xl border text-left transition ${on ? "border-rose-500 ring-2 ring-rose-200" : "border-stone-200 hover:border-rose-300"}`}
                  >
                    <div className="relative" style={{ aspectRatio: wide ? "4 / 3" : "9 / 14" }}>
                      <Mini t={t} cover={cover} bride={bride} groom={groom} wide={wide} />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white shadow">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <div className="border-t border-stone-100 px-2 py-1.5">
                      <span className="block truncate text-xs font-medium text-stone-700">{t.label}</span>
                      <span className="block truncate text-[11px] text-stone-400">{t.tagline}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
