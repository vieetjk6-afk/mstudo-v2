"use client";

import { ClipboardList, FileText, Plus, Trash2, Wand2 } from "lucide-react";
import { Empty, Field, btn, inputCls } from "@/components/v2/kit";
import { Menu } from "@/components/v2/kit-client";
import { fullClauseText } from "@/lib/contract-clauses";
import { PaneItemV2 } from "./settings-v2";
import type { ServicesState } from "./useServices";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐIỀU KHOẢN DỊCH VỤ — giao diện mới (tab đầu của ServicesTemplatesTabsV2).
   Cùng logic với ServicesManager (./useServices). Cột trái: danh sách dịch vụ;
   cột phải: trình sửa tên + bộ điều khoản. Có thay đổi là hiện thanh Lưu dính
   đáy (ở màn cha). Điện thoại: danh sách trước, trình sửa sau.
   ═══════════════════════════════════════════════════════════════════════════ */

const clauseCount = (t: string) => t.split("\n").filter((l) => l.trim()).length;

export default function ServicesV2({ s, onCreate }: { s: ServicesState; onCreate: () => void }) {
  /** Chuyển dịch vụ: có thay đổi chưa lưu thì hỏi trước. */
  function pick(id: string) {
    const next = s.services.find((x) => x.id === id);
    if (!next || next.id === s.selId) return;
    if (s.dirty && !confirm(`Bỏ thay đổi chưa lưu ở “${s.sel?.name}”?`)) return;
    s.select(next);
  }

  if (s.services.length === 0) {
    return (
      <div className="v2-card">
        <Empty
          icon={ClipboardList}
          title="Chưa có dịch vụ nào"
          hint="Tạo dịch vụ đầu tiên (chụp cưới, kỷ yếu, doanh nghiệp…) và soạn bộ điều khoản riêng cho nó."
          action={
            <button type="button" onClick={onCreate} disabled={s.busy} className={btn("primary")}>
              <Plus size={17} /> Tạo dịch vụ đầu tiên
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="v2-card overflow-hidden lg:sticky lg:top-[84px]">
        <div className="px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <p className="v2-section-title">Dịch vụ</p>
          <p className="v2-section-desc">{s.services.length} dịch vụ · mỗi dịch vụ một bộ điều khoản</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-220px)]">
          {s.services.map((x) => {
            const active = x.id === s.selId;
            const text = active ? s.clauses : x.clauses;
            return (
              <PaneItemV2
                key={x.id}
                icon={FileText}
                active={active}
                onClick={() => pick(x.id)}
                title={(active ? s.name : x.name) || "Dịch vụ"}
                sub={text.trim() ? `${clauseCount(text)} dòng điều khoản` : "Chưa có điều khoản"}
                trailing={active && s.dirty ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} title="Chưa lưu" /> : null}
              />
            );
          })}
        </div>
      </div>

      {s.sel ? (
        <section className="v2-card">
          <header className="v2-section-head">
            <span className="v2-section-icon"><ClipboardList size={17} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="v2-section-title truncate">{s.name || "Dịch vụ"}</h3>
              <p className="v2-section-desc">Tạo hợp đồng hay báo giá chọn dịch vụ này thì áp bộ điều khoản bên dưới.</p>
            </div>
            <Menu
              label="Thao tác với dịch vụ"
              width={240}
              items={[
                {
                  label: "Thay bằng điều khoản mẫu",
                  hint: "Chèn bộ điều khoản soạn sẵn",
                  icon: Wand2,
                  onClick: () => {
                    if (!s.clauses.trim() || confirm("Thay toàn bộ điều khoản đang soạn bằng bộ điều khoản mẫu?")) s.setClauses(fullClauseText());
                  },
                },
                "divider",
                { label: "Xoá dịch vụ", hint: "Hợp đồng/báo giá đã tạo không đổi", icon: Trash2, danger: true, onClick: () => s.sel && void s.deleteService(s.sel) },
              ]}
            />
          </header>
          <div className="v2-card-pad flex flex-col gap-4">
            <Field label="Tên dịch vụ">
              <input className={inputCls} value={s.name} onChange={(e) => s.setName(e.target.value)} placeholder="VD: Chụp phóng sự cưới" />
            </Field>
            <Field
              label={
                <span className="flex items-center justify-between gap-2">
                  Điều khoản hợp đồng
                  <span className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>{clauseCount(s.clauses)} dòng</span>
                </span>
              }
              hint="Mỗi dòng một ý. Khách đọc bộ điều khoản này trong hợp đồng và báo giá."
            >
              <textarea
                className={`${inputCls} !min-h-[440px] font-mono text-[13px] leading-relaxed`}
                value={s.clauses}
                onChange={(e) => s.setClauses(e.target.value)}
                placeholder="Nhập điều khoản riêng cho dịch vụ này…"
              />
            </Field>
            {!s.clauses.trim() ? (
              <button type="button" onClick={() => s.setClauses(fullClauseText())} className={btn("soft", "md", "self-start")}>
                <Wand2 size={16} /> Dùng bộ điều khoản mẫu
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
