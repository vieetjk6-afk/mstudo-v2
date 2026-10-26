"use client";

import { Bell, Check, Heart, ListChecks, Mail, MessageSquare, RotateCcw, Save, Zap } from "lucide-react";
import { Badge, Section, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { AUTOMATION_RULES, type ActionKind, type AutomationConfig } from "@/lib/automations";
import { useAutomations } from "./useAutomations";

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC TỰ ĐỘNG — giao diện mới. Cùng logic với AutomationsCard (./useAutomations):
   mỗi luật một công tắc, sửa số ngày và câu chữ, một nút Lưu cho trọn bộ.
   Màu nhãn hành động mang nghĩa: tin gửi thẳng cho KHÁCH là amber (cần đọc lại
   trước khi bật), việc nội bộ là brand / blue.
   ═══════════════════════════════════════════════════════════════════════════ */

const ACTION_META: Record<ActionKind, { label: string; icon: typeof Bell; tone: Tone }> = {
  task: { label: "Tạo việc", icon: ListChecks, tone: "brand" },
  notify: { label: "Báo chuông", icon: Bell, tone: "blue" },
  zalo: { label: "Gửi Zalo cho khách", icon: MessageSquare, tone: "amber" },
  email: { label: "Gửi email cho khách", icon: Mail, tone: "amber" },
  invitation: { label: "Tạo & gửi thiệp cho khách", icon: Heart, tone: "amber" },
};

export default function AutomationsCardV2({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: Record<string, AutomationConfig | undefined>;
}) {
  const a = useAutomations(ownerId, initial);
  const total = AUTOMATION_RULES.length;

  return (
    <Section
      icon={Zap}
      title="Việc tự động"
      desc={
        <>
          {total} luật chạy mỗi ngày theo trạng thái hợp đồng. Mỗi luật chỉ chạy <b>một lần</b> cho mỗi hợp đồng (mỗi đợt
          thanh toán với luật quá hạn), nên bật lên không sợ bị nhắc lặp.
        </>
      }
      actions={<Badge tone={a.onCount ? "green" : "gray"} dot>Đang bật {a.onCount}/{total}</Badge>}
      flush
    >
      <div>
        {AUTOMATION_RULES.map((r, i) => {
          const row = a.rows[r.key];
          const meta = ACTION_META[r.action];
          const open = a.openKey === r.key;
          const edited = row.message.trim() !== r.message.trim();
          const toClient = r.action === "zalo" || r.action === "email" || r.action === "invitation";
          return (
            <div key={r.key} className="px-4 py-2 sm:px-5" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
              <Switch
                checked={row.enabled}
                onChange={(v) => a.set(r.key, { enabled: v })}
                label={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-semibold">{r.label}</span>
                    <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                  </span>
                }
                desc={
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed">
                    {r.hint}
                    {r.fallback === "email" && (
                      <> Chưa nối Zalo (hoặc khách không có số) thì gửi <b>email</b> — một trong hai, không gửi cả hai.</>
                    )}
                  </span>
                }
              />

              {row.enabled && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {r.days !== null && (
                    <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                      Số ngày
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={row.days}
                        onChange={(e) => a.set(r.key, { days: Number(e.target.value) })}
                        className={`${inputCls} text-center`}
                        style={{ width: 76, height: 32 }}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => a.setOpenKey(open ? null : r.key)}
                    className={btn("ghost", "sm", r.days === null ? "-ml-2.5" : "")}
                    aria-expanded={open}
                  >
                    {open ? "Ẩn câu chữ" : edited ? "Câu chữ (đã sửa)" : "Sửa câu chữ"}
                  </button>
                  {toClient && (
                    <span className="text-[12px] font-semibold" style={{ color: "var(--am)" }}>
                      Tin này gửi thẳng cho khách — đọc lại trước khi lưu.
                    </span>
                  )}
                </div>
              )}

              {open && (
                <div className="mb-3 flex flex-col gap-1.5">
                  <textarea
                    className={`${inputCls} resize-y`}
                    rows={3}
                    value={row.message}
                    onChange={(e) => a.set(r.key, { message: e.target.value })}
                    aria-label={`Câu chữ — ${r.label}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 text-[12px] leading-relaxed" style={{ color: "var(--tx3)" }}>
                      Ô thay được: <code>{"{khach}"}</code> <code>{"{hopdong}"}</code> <code>{"{ngay}"}</code>{" "}
                      <code>{"{conlai}"}</code> <code>{"{quahan}"}</code> <code>{"{dot}"}</code> <code>{"{tien}"}</code>
                      {r.action === "invitation" && <> <code>{"{link}"}</code> (link sửa thiệp — xoá đi thì link tự nối vào cuối)</>}
                      . Ô không có dữ liệu sẽ tự biến mất.
                    </p>
                    {edited && (
                      <button type="button" onClick={() => a.set(r.key, { message: r.message })} className={btn("ghost", "sm")}>
                        <RotateCcw size={14} /> Về câu mặc định
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
        {a.err ? (
          <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--rd)" }}>{a.err}</p>
        ) : (
          <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Bấm Lưu để áp dụng trọn bộ luật.</p>
        )}
        <button type="button" onClick={a.save} disabled={a.saving} className={btn("primary")}>
          {a.saved ? <Check size={16} /> : <Save size={16} />} {a.saving ? "Đang lưu…" : a.saved ? "Đã lưu" : "Lưu việc tự động"}
        </button>
      </div>
    </Section>
  );
}
