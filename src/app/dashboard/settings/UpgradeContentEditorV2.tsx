"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Heading, Plus, Trash2 } from "lucide-react";
import { Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import type { Plan } from "@/lib/plans";
import { PLANS, isSection, type UpgradeContentState } from "./useUpgradeContent";

/* ═══════════════════════════════════════════════════════════════════════════
   NỘI DUNG TRANG NÂNG CẤP — trình sửa ở giao diện mới (một khối của
   SettingsPanelV2). Cùng dữ liệu & cách lưu với UpgradeContentEditor (bản cũ,
   ./useUpgradeContent); khác ở cách sắp xếp:
     • Sửa TỪNG gói một (chọn gói ở hàng nút) thay vì 5 khung cùng lúc.
     • Bảng so sánh gập lại mặc định; mở ra là một lưới gọn có hàng tiêu đề
       cột, nút lên / xuống / xoá nhỏ ở mỗi dòng.
     • Lưu bằng thanh "có thay đổi" chung của màn (không có nút lưu riêng).
   ═══════════════════════════════════════════════════════════════════════════ */

const CELL_COLS: { key: Plan; short: string }[] = [
  { key: "free", short: "Free" },
  { key: "basic", short: "Basic" },
  { key: "photographer", short: "Photog." },
  { key: "photographer_plus", short: "Photog. Plus" },
  { key: "studio", short: "Studio" },
];

export default function UpgradeContentEditorV2({ c }: { c: UpgradeContentState }) {
  const { uc, setUc } = c;
  const [plan, setPlan] = useState<Plan>("studio");
  const [tableOpen, setTableOpen] = useState(false);
  const p = uc.plans[plan];
  const patchPlan = (patch: Partial<typeof p>) => setUc({ ...uc, plans: { ...uc.plans, [plan]: { ...uc.plans[plan], ...patch } } });
  const featureRows = uc.compare.filter((r) => !isSection(r)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Tiêu đề trang">
          <input className={inputCls} value={uc.headline} onChange={(e) => setUc({ ...uc, headline: e.target.value })} />
        </Field>
        <Field label="Mô tả ngắn dưới tiêu đề">
          <input className={inputCls} value={uc.subheadline} onChange={(e) => setUc({ ...uc, subheadline: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="v2-label">Tên & điểm nổi bật từng gói</p>
          <Segmented<Plan>
            size="sm"
            label="Chọn gói để sửa"
            value={plan}
            onChange={setPlan}
            options={PLANS.map((x) => ({ value: x.key, label: x.label }))}
          />
        </div>
        <div className="grid gap-4 rounded-[14px] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={{ background: "var(--sf2)" }}>
          <div className="flex flex-col gap-4">
            <Field label="Tên gói hiển thị">
              <input className={inputCls} value={p.label} onChange={(e) => patchPlan({ label: e.target.value })} placeholder="Tên gói hiển thị" />
            </Field>
            <Field label="Dòng khuyến mãi" hint="Hiện nổi bật dưới danh sách tính năng. Để trống để ẩn.">
              <textarea
                className={inputCls}
                rows={3}
                value={p.promo ?? ""}
                onChange={(e) => patchPlan({ promo: e.target.value })}
                placeholder="Banner khuyến mãi (tùy chọn)"
              />
            </Field>
          </div>
          <Field label="Điểm nổi bật" hint={`Mỗi dòng = 1 gạch đầu dòng · ${p.features.filter((f) => f.trim()).length} dòng`}>
            <textarea
              className={inputCls}
              style={{ minHeight: 196 }}
              value={p.features.join("\n")}
              onChange={(e) => patchPlan({ features: e.target.value.split("\n") })}
              placeholder="Mỗi dòng là một điểm nổi bật"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="v2-label">Bảng so sánh tính năng</p>
            <p className="v2-field-hint">
              {featureRows} dòng. Mỗi ô: gõ <b>✓</b> (có), <b>✗</b> hoặc để trống (không), hoặc chữ tuỳ ý (vd “5 / tháng”, “∞”, “Sắp ra mắt”).
            </p>
          </div>
          <button type="button" onClick={() => setTableOpen((v) => !v)} className={btn("secondary", "sm")} aria-expanded={tableOpen}>
            {tableOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {tableOpen ? "Thu gọn" : "Mở để sửa"}
          </button>
        </div>

        {tableOpen ? (
          <div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--bd2)" }}>
            <div
              className="hidden items-center gap-1.5 px-3 py-2 text-[12px] font-semibold sm:grid"
              style={{ gridTemplateColumns: "84px minmax(0,1.7fr) repeat(5,minmax(0,1fr))", background: "var(--sf2)", color: "var(--tx3)" }}
            >
              <span />
              <span>Tính năng</span>
              {CELL_COLS.map((x) => (
                <span key={x.key} className="text-center">{x.short}</span>
              ))}
            </div>
            {uc.compare.map((row, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 px-3 py-2 sm:grid sm:items-center"
                style={{
                  gridTemplateColumns: "84px minmax(0,1.7fr) repeat(5,minmax(0,1fr))",
                  borderTop: "1px solid var(--bd2)",
                  background: isSection(row) ? "color-mix(in srgb, var(--ac) 5%, var(--sf))" : undefined,
                }}
              >
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => c.moveRow(i, -1)} disabled={i === 0} className={iconBtn("!h-7 !w-7")} aria-label="Đưa lên" title="Lên">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => c.moveRow(i, 1)} disabled={i === uc.compare.length - 1} className={iconBtn("!h-7 !w-7")} aria-label="Đưa xuống" title="Xuống">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" onClick={() => c.removeRow(i)} className={iconBtn("!h-7 !w-7")} aria-label="Xoá dòng" title="Xoá" style={{ color: "var(--rd)" }}>
                    <Trash2 size={14} />
                  </button>
                  <span className="ml-1 text-[11.5px] sm:hidden" style={{ color: "var(--tx3)" }}>{isSection(row) ? "Tiêu đề nhóm" : "Dòng tính năng"}</span>
                </div>
                {isSection(row) ? (
                  <input
                    className={`${inputCls} font-semibold sm:col-span-6`}
                    value={row.section}
                    onChange={(e) => c.editRow(i, { section: e.target.value })}
                    placeholder="Tên nhóm (vd: Album & ảnh)"
                    aria-label="Tên nhóm"
                  />
                ) : (
                  <>
                    <input className={inputCls} value={row.label} onChange={(e) => c.editRow(i, { label: e.target.value })} placeholder="Tên tính năng" aria-label="Tên tính năng" />
                    <div className="grid grid-cols-5 gap-1.5 sm:contents">
                      {CELL_COLS.map((x) => (
                        <input
                          key={x.key}
                          className={`${inputCls} !px-1.5 text-center text-[13px]`}
                          value={row[x.key]}
                          onChange={(e) => c.editRow(i, { [x.key]: e.target.value })}
                          placeholder={x.short}
                          aria-label={`${row.label || "Tính năng"} — ${x.short}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 px-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
              <button type="button" onClick={c.addFeatureRow} className={btn("secondary", "sm")}>
                <Plus size={15} /> Thêm dòng
              </button>
              <button type="button" onClick={c.addSectionRow} className={btn("ghost", "sm")}>
                <Heading size={15} /> Thêm tiêu đề nhóm
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
