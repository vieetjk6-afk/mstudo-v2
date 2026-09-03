"use client";

import { useState } from "react";
import { Check, Save, Zap, ListChecks, Bell, MessageSquare, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AUTOMATION_RULES,
  clampDays,
  effectiveConfig,
  type ActionKind,
  type AutomationConfig,
} from "@/lib/automations";

/* ═══════════════════════════════════════════════════════════════════════════
   VIỆC TỰ ĐỘNG — màn cấu hình.

   TÁM luật, mỗi luật một công tắc. Cố ý KHÔNG có trình dựng luật: không chọn
   điều kiện, không soạn hành động, không thêm luật thứ chín từ giao diện. Studio
   cần tám việc đúng, bật/tắt được, sửa được số ngày và câu chữ — xem ghi chú đầu
   src/lib/automations.ts.

   Ba luật gửi Zalo cho KHÁCH đều TẮT sẵn và có nhãn cảnh báo riêng: một tin nhắn
   tự động gửi sai lúc là thứ khách nhìn thấy, nên studio phải tự đọc lại câu chữ
   rồi mới bật.
   ═══════════════════════════════════════════════════════════════════════════ */

const ACTION_META: Record<ActionKind, { label: string; icon: typeof Bell; tone: string }> = {
  task: { label: "Tạo việc", icon: ListChecks, tone: "var(--ac)" },
  notify: { label: "Báo chuông", icon: Bell, tone: "var(--bl, var(--ac))" },
  zalo: { label: "Gửi Zalo cho khách", icon: MessageSquare, tone: "var(--am)" },
};

type Row = { enabled: boolean; days: number; message: string };

export default function AutomationsCard({
  ownerId,
  initial,
}: {
  ownerId: string;
  /** Cấu hình đã lưu, theo khoá luật. Thiếu khoá nào thì dùng mặc định của luật. */
  initial: Record<string, AutomationConfig | undefined>;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(AUTOMATION_RULES.map((r) => [r.key, effectiveConfig(r, initial[r.key])]))
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (key: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  async function save() {
    setSaving(true);
    setErr(null);
    // upsert theo (owner_id, rule) — khoá unique của bảng. Ghi CẢ TÁM dòng một
    // lượt: studio bấm Lưu là chốt trọn bộ, không phải lưu từng luật.
    const payload = AUTOMATION_RULES.map((r) => ({
      owner_id: ownerId,
      rule: r.key,
      enabled: rows[r.key].enabled,
      offset_days: r.days === null ? null : clampDays(rows[r.key].days),
      // Câu chữ trùng y hệt mặc định thì lưu null, để lần sau sửa câu mặc định
      // trong code là studio được hưởng bản mới — chứ không bị đóng đinh bản cũ.
      message: rows[r.key].message.trim() === r.message.trim() ? null : rows[r.key].message.trim() || null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("studio_automations").upsert(payload, { onConflict: "owner_id,rule" });
    setSaving(false);
    if (error) {
      // Chưa chạy migration automations.sql thì bảng chưa tồn tại — nói rõ, đừng
      // để studio bấm Lưu mãi mà không hiểu vì sao không đổi gì.
      const missing = error.code === "42P01" || error.code === "PGRST205";
      return setErr(
        missing
          ? "Cần chạy supabase/migrations/automations.sql trước khi bật việc tự động."
          : error.message
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const onCount = AUTOMATION_RULES.filter((r) => rows[r.key].enabled).length;

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
        <Zap size={18} style={{ color: "var(--ac)" }} /> Việc tự động
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
        Tám luật chạy mỗi ngày theo trạng thái hợp đồng. Mỗi luật chỉ chạy <b>một lần</b> cho mỗi hợp đồng
        (mỗi đợt thanh toán với luật quá hạn), nên bật lên không sợ bị nhắc lặp.
        Đang bật <b>{onCount}/{AUTOMATION_RULES.length}</b>.
      </p>

      <div className="mt-4 flex flex-col">
        {AUTOMATION_RULES.map((r) => {
          const row = rows[r.key];
          const meta = ACTION_META[r.action];
          const Icon = meta.icon;
          const open = openKey === r.key;
          const edited = row.message.trim() !== r.message.trim();
          return (
            <div key={r.key} className="py-3" style={{ borderTop: "1px solid var(--bd2, var(--border))" }}>
              <div className="flex items-start gap-3">
                {/* Công tắc */}
                <button
                  onClick={() => set(r.key, { enabled: !row.enabled })}
                  role="switch"
                  aria-checked={row.enabled}
                  aria-label={r.label}
                  className="mt-0.5 flex h-[22px] w-[38px] flex-none items-center rounded-full px-[3px] transition-colors"
                  style={{ background: row.enabled ? "var(--ac)" : "var(--surface2, var(--sf2))", border: "1px solid var(--border)" }}
                >
                  <span
                    className="h-[16px] w-[16px] rounded-full bg-white transition-transform"
                    style={{ transform: row.enabled ? "translateX(15px)" : "translateX(0)", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold">
                    {r.label}
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                      style={{ background: "var(--surface2, var(--sf2))", color: meta.tone }}
                    >
                      <Icon size={11} /> {meta.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
                    {r.hint}
                  </p>

                  {row.enabled && (
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      {r.days !== null && (
                        <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text2)" }}>
                          Số ngày
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={row.days}
                            onChange={(e) => set(r.key, { days: Number(e.target.value) })}
                            className="input w-[70px] py-1 text-center"
                          />
                        </label>
                      )}
                      <button
                        onClick={() => setOpenKey(open ? null : r.key)}
                        className="rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold"
                        style={{ background: "var(--surface2, var(--sf2))", border: "1px solid var(--border)", color: "var(--text2)" }}
                      >
                        {open ? "Ẩn câu chữ" : edited ? "Câu chữ (đã sửa)" : "Sửa câu chữ"}
                      </button>
                      {r.action === "zalo" && (
                        <span className="text-[11px] font-semibold" style={{ color: "var(--am)" }}>
                          Tin này gửi thẳng cho khách — đọc lại trước khi lưu.
                        </span>
                      )}
                    </div>
                  )}

                  {open && (
                    <div className="mt-2">
                      <textarea
                        className="input resize-y text-[12.5px]"
                        rows={3}
                        value={row.message}
                        onChange={(e) => set(r.key, { message: e.target.value })}
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                          Ô thay được: <code>{"{khach}"}</code> <code>{"{hopdong}"}</code> <code>{"{ngay}"}</code>{" "}
                          <code>{"{conlai}"}</code> <code>{"{quahan}"}</code> <code>{"{dot}"}</code>{" "}
                          <code>{"{tien}"}</code>. Ô không có dữ liệu sẽ tự biến mất.
                        </p>
                        {edited && (
                          <button
                            onClick={() => set(r.key, { message: r.message })}
                            className="flex items-center gap-1 text-[11px] font-semibold"
                            style={{ color: "var(--text2)" }}
                          >
                            <RotateCcw size={11} /> về câu mặc định
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-xs" style={{ color: "var(--s-red, var(--danger))" }}>{err}</p>}

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saved ? <Check size={15} /> : <Save size={15} />} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu việc tự động"}
      </button>
    </div>
  );
}
