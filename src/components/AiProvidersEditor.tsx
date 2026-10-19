"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Bot, Check, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { Field } from "@/components/admin/Section";
import {
  EFFORT_LABEL,
  MAX_PROVIDERS,
  PROVIDER_PRESETS,
  presetOf,
  type ProviderType,
  type PublicProvider,
} from "@/lib/vieetjk/provider-types";

/**
 * Ô nhập API key AI — dùng chung cho hai nơi:
 *   scope "shared" → Quản trị hệ thống: key chung cho mọi studio
 *   scope "studio" → trang Chatbox: key riêng của studio, bot dùng trước key chung
 *
 * Máy chủ không bao giờ gửi khoá đầy đủ xuống đây, chỉ bản đã che (keyMask). Ô
 * khoá để trống khi lưu = giữ nguyên khoá cũ của mục đó.
 */

type Row = {
  uid: string;
  id?: string;
  type: ProviderType;
  label: string;
  model: string;
  baseUrl: string;
  effort: string;
  key: string;
  keyMask?: string;
};

type TestState = { busy: true } | { busy?: false; ok: boolean; msg: string };

type Info = { error: string | null; envCount?: number; sharedCount?: number };

let seq = 0;
const nextUid = () => `r${++seq}`;

function fromPublic(p: PublicProvider): Row {
  return {
    uid: nextUid(),
    id: p.id,
    type: p.type,
    label: p.label ?? "",
    model: p.model,
    baseUrl: p.baseUrl ?? "",
    effort: p.effort ?? "",
    key: "",
    keyMask: p.keyMask,
  };
}

function blankRow(type: ProviderType): Row {
  const pr = presetOf(type);
  return { uid: nextUid(), type, label: "", model: pr.model, baseUrl: "", effort: pr.effort, key: "" };
}

function toPayload(r: Row) {
  return { id: r.id, type: r.type, label: r.label, model: r.model, baseUrl: r.baseUrl, effort: r.effort, key: r.key };
}

const STORE_ERROR: Record<string, string> = {
  missing_table:
    "Chưa chạy migration ai_providers.sql trên Supabase. Mở SQL Editor, chạy supabase/cap-nhat.sql (hoặc riêng supabase/migrations/ai_providers.sql) rồi tải lại trang.",
  decrypt_failed:
    "Không giải mã được key đã lưu — khoá mã hoá trên máy chủ đã đổi. Nhập lại API key cho từng nguồn rồi bấm Lưu.",
  db_error: "Không đọc được cấu hình AI từ cơ sở dữ liệu. Thử tải lại trang.",
};

export default function AiProvidersEditor({ scope }: { scope: "shared" | "studio" }) {
  const endpoint = scope === "shared" ? "/api/admin/ai-providers" : "/api/studio/ai-providers";
  const [rows, setRows] = useState<Row[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        const list: PublicProvider[] = Array.isArray(d.providers) ? d.providers : [];
        setRows(list.map(fromPublic));
        setSavedCount(list.length);
        setInfo({ error: d.error ?? null, envCount: d.envCount, sharedCount: d.sharedCount });
      })
      .catch(() => setLoadErr("Không tải được cấu hình AI. Thử tải lại trang."));
  }, [endpoint]);

  function edit(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
    setMsg(null);
  }

  function changeType(i: number, type: ProviderType) {
    const pr = presetOf(type);
    edit(i, { type, model: pr.model, effort: pr.effort, baseUrl: "" });
  }

  function move(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const out = [...rs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
    setDirty(true);
  }

  function remove(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
    setDirty(true);
    setMsg(null);
  }

  function add() {
    setRows((rs) => [...rs, blankRow(PROVIDER_PRESETS[0].type)]);
    setDirty(true);
  }

  async function test(r: Row) {
    setTests((t) => ({ ...t, [r.uid]: { busy: true } }));
    let next: TestState;
    try {
      const res = await fetch(`${endpoint}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: toPayload(r) }),
      });
      const d = await res.json().catch(() => ({}));
      next = d.ok
        ? { ok: true, msg: `Chạy được · ${(d.ms / 1000).toFixed(1)} giây · AI trả lời: “${d.sample}”` }
        : { ok: false, msg: d.error || "Không thử được." };
    } catch {
      next = { ok: false, msg: "Lỗi kết nối, thử lại." };
    }
    setTests((t) => ({ ...t, [r.uid]: next }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: rows.map(toPayload) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || "Không lưu được." });
        return;
      }
      const list: PublicProvider[] = Array.isArray(d.providers) ? d.providers : [];
      setRows(list.map(fromPublic));
      setSavedCount(list.length);
      setTests({});
      setInfo((x) => (x ? { ...x, error: null } : x));
      setDirty(false);
      setMsg({ ok: true, text: "Đã lưu — áp dụng ngay, không cần deploy lại." });
    } catch {
      setMsg({ ok: false, text: "Lỗi kết nối, thử lại." });
    } finally {
      setSaving(false);
    }
  }

  const status = statusLine(scope, savedCount, info);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Bot size={18} />
        <h2 className="text-base font-medium text-accent">
          {scope === "shared" ? "Nhà cung cấp AI · key dùng chung" : "Key AI riêng của studio (tuỳ chọn)"}
        </h2>
      </div>
      <p className="mt-1 text-sm text-accent-muted">
        {scope === "shared"
          ? "Dùng cho chatbox website, AI trả lời trong Hộp thư và tạo hợp đồng nhanh của mọi studio. Studio nào tự nhập key riêng thì dùng key của họ trước, key chung làm dự phòng."
          : "Dùng cho chatbox website, AI trả lời trong Hộp thư và tạo hợp đồng nhanh của studio. Phí AI tính vào tài khoản của bạn ở nhà cung cấp; key hỏng hoặc hết hạn mức thì bot tự chuyển sang AI chung của hệ thống (nếu có)."}
      </p>

      {loadErr ? (
        <Notice warn text={loadErr} />
      ) : info === null ? (
        <span className="mt-4 inline-flex items-center gap-2 text-sm text-accent-muted">
          <Loader2 size={15} className="animate-spin" /> Đang tải…
        </span>
      ) : (
        <>
          {info.error && STORE_ERROR[info.error] && <Notice warn text={STORE_ERROR[info.error]} />}
          {status && <Notice warn={status.warn} text={status.text} />}

          {PROVIDER_PRESETS.map((p) => (
            <datalist key={p.type} id={`ai-models-${scope}-${p.type}`}>
              {p.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          ))}

          <div className="mt-4 space-y-3">
            {rows.map((r, i) => {
              const pr = presetOf(r.type);
              const t = tests[r.uid];
              return (
                <div key={r.uid} className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: "var(--text3)" }}>#{i + 1}</span>
                    <span className="mr-auto text-sm font-medium">{r.label || pr.name}</span>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost text-xs" aria-label="Đưa lên">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="btn-ghost text-xs" aria-label="Đưa xuống">
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" onClick={() => test(r)} disabled={t?.busy} className="btn-ghost gap-1 text-xs">
                      {t?.busy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Thử
                    </button>
                    <button type="button" onClick={() => remove(i)} className="btn-ghost text-xs" aria-label="Xoá nguồn này">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Loại">
                      <select className="input" value={r.type} onChange={(e) => changeType(i, e.target.value as ProviderType)}>
                        {PROVIDER_PRESETS.map((p) => (
                          <option key={p.type} value={p.type}>{p.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Model">
                      <input
                        className="input"
                        list={`ai-models-${scope}-${r.type}`}
                        value={r.model}
                        onChange={(e) => edit(i, { model: e.target.value })}
                        placeholder="Tên model"
                        maxLength={120}
                      />
                    </Field>
                    <Field
                      label="API key"
                      note={
                        r.keyMask
                          ? `Đã lưu: ${r.keyMask} — để trống để giữ nguyên.`
                          : pr.keyUrl
                          ? `Lấy key tại ${pr.keyUrl}`
                          : undefined
                      }
                    >
                      <input
                        className="input font-mono"
                        type="password"
                        autoComplete="off"
                        value={r.key}
                        onChange={(e) => edit(i, { key: e.target.value })}
                        placeholder={r.keyMask ? "•••••• (giữ nguyên key đã lưu)" : pr.keyHint}
                        maxLength={500}
                      />
                    </Field>
                    <Field label="Địa chỉ API (tuỳ chọn)" note={pr.baseUrlHint}>
                      <input
                        className="input"
                        value={r.baseUrl}
                        onChange={(e) => edit(i, { baseUrl: e.target.value })}
                        placeholder="https://…"
                        maxLength={300}
                      />
                    </Field>
                    {pr.efforts.length > 0 && (
                      <Field
                        label="Mức suy nghĩ"
                        note={
                          r.type === "anthropic"
                            ? "Chỉ Claude đời 4.6 trở lên nhận. Model cũ hơn (vd claude-haiku-4-5) thì chọn “Mặc định”."
                            : undefined
                        }
                      >
                        <select className="input" value={r.effort} onChange={(e) => edit(i, { effort: e.target.value })}>
                          <option value="">Mặc định của model</option>
                          {pr.efforts.map((e) => (
                            <option key={e} value={e}>{EFFORT_LABEL[e] ?? e}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Tên gợi nhớ (tuỳ chọn)">
                      <input
                        className="input"
                        value={r.label}
                        onChange={(e) => edit(i, { label: e.target.value })}
                        placeholder={pr.name}
                        maxLength={60}
                      />
                    </Field>
                  </div>

                  {t && !t.busy && (
                    <p className="mt-3 text-[12.5px]" style={{ color: t.ok ? "#4caf72" : "var(--danger)" }}>
                      {t.ok ? "✓ " : "✗ "}
                      {t.msg}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={add} disabled={rows.length >= MAX_PROVIDERS} className="btn-ghost gap-1.5 text-sm">
              <Plus size={15} /> Thêm nguồn AI
            </button>
            <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : msg?.ok ? <Check size={15} /> : null}
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            {msg && (
              <span className="text-[13px]" style={{ color: msg.ok ? "var(--gold)" : "var(--danger)" }}>{msg.text}</span>
            )}
            {dirty && !msg && <span className="text-[12.5px]" style={{ color: "var(--text3)" }}>Có thay đổi chưa lưu.</span>}
          </div>

          <p className="mt-3 text-[12px]" style={{ color: "var(--text3)" }}>
            Thứ tự từ trên xuống = thứ tự bot thử; nguồn trên lỗi hoặc hết hạn mức thì tự chuyển sang nguồn dưới. Bấm{" "}
            <b>Thử</b> để kiểm key trước khi lưu. Key được mã hoá trên máy chủ và không bao giờ hiện lại đầy đủ.
          </p>
        </>
      )}
    </div>
  );
}

function statusLine(scope: "shared" | "studio", saved: number, info: Info | null): { warn: boolean; text: string } | null {
  if (!info || info.error) return null;
  if (scope === "shared") {
    if (saved > 0) return { warn: false, text: `Đang dùng ${saved} nguồn bên dưới cho mọi studio.` };
    if (info.envCount) {
      return {
        warn: false,
        text: `Chưa nhập nguồn nào ở đây → hệ thống đang dùng ${info.envCount} nguồn khai trong biến CHAT_PROVIDERS / GEMINI_API_KEY trên Vercel. Lưu nguồn ở đây thì trang này được dùng thay.`,
      };
    }
    return { warn: true, text: "Chưa có nguồn AI nào — chatbox, Hộp thư và tạo hợp đồng nhanh đang chạy không có AI." };
  }
  if (saved > 0) return { warn: false, text: `Đang dùng ${saved} key riêng của studio.` };
  if (info.sharedCount) {
    return { warn: false, text: "Studio đang dùng AI chung của hệ thống. Chỉ cần nhập key riêng nếu muốn dùng tài khoản AI của studio." };
  }
  return { warn: true, text: "Hệ thống chưa có AI chung — nhập key riêng để bật AI cho studio." };
}

function Notice({ warn, text }: { warn?: boolean; text: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-ink-800 p-3 text-sm" style={{ color: "var(--text2)" }}>
      {warn ? (
        <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: "#e0a34f" }} />
      ) : (
        <Check size={15} className="mt-0.5 shrink-0" style={{ color: "#4caf72" }} />
      )}
      <span>{text}</span>
    </div>
  );
}
