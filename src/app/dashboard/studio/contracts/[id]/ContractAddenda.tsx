"use client";

import { useState } from "react";
import { FilePlus2, Lock, Plus, Trash2, Check, PenLine, Tag } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { vnd, type ContractItem } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { addendumLabel, addendumTotal, type AddendumLine, type ContractAddendum } from "@/lib/contract-addenda";

/* ═══════════════════════════════════════════════════════════════════════════
   PHỤ LỤC — thẻ dưới bảng hạng mục, CHỈ hiện khi khách đã ký hợp đồng.

   Hạng mục gốc lúc đó đã khoá (trigger dưới DB). Thêm/bớt dịch vụ đi bằng phụ
   lục: bản nháp studio sửa thoải mái, khách ký ở cổng khách — hoặc studio bấm
   "Xác nhận thay khách" khi đã thoả thuận qua điện thoại. Chỉ lúc đó các dòng
   mới vào tổng hợp đồng.
   ═══════════════════════════════════════════════════════════════════════════ */

type Draft = { id?: string; title: string; note: string; lines: (AddendumLine & { discount?: boolean })[] };

const emptyLine = (): Draft["lines"][number] => ({ name: "", description: null, qty: 1, unit_price: 0 });

export default function ContractAddenda({
  contractId,
  initialAddenda,
  canEdit,
  onChanged,
  toast,
}: {
  contractId: string;
  initialAddenda: ContractAddendum[];
  /** Nhân viên thường chỉ xem — tạo phụ lục là thay đổi giá. */
  canEdit: boolean;
  /** Báo cho trình sửa hợp đồng khi các dòng đã ký thay đổi (để cập nhật tổng). */
  onChanged: (addendumItems: ContractItem[]) => void;
  toast: (m: string) => void;
}) {
  const [addenda, setAddenda] = useState<ContractAddendum[]>(initialAddenda);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/contracts/${contractId}/addenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(
          j.error === "no_lines" ? "Phụ lục cần ít nhất một dòng có tên."
          : j.error === "already_signed" ? "Phụ lục này đã được ký — không sửa được nữa."
          : j.error === "forbidden" ? "Bạn không có quyền tạo phụ lục."
          : `Lỗi: ${j.error || res.status}`
        );
        return false;
      }
      setAddenda(j.addenda ?? []);
      onChanged(j.addendumItems ?? []);
      return true;
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const lines = draft.lines.map((l) => ({
      name: l.name,
      description: l.description,
      qty: l.discount ? 1 : l.qty,
      unit_price: (l.discount ? -1 : 1) * Math.abs(l.unit_price || 0),
    }));
    const ok = await call({ action: draft.id ? "update" : "create", addendumId: draft.id, title: draft.title, note: draft.note, lines });
    if (ok) {
      setDraft(null);
      toast(draft.id ? "Đã lưu phụ lục." : "Đã tạo phụ lục — gửi khách ký ở trang hợp đồng của khách.");
    }
  }

  function edit(a: ContractAddendum) {
    setDraft({
      id: a.id,
      title: a.title,
      note: a.note ?? "",
      lines: a.lines.map((l) => ({ ...l, discount: l.unit_price < 0, unit_price: Math.abs(l.unit_price) })),
    });
  }

  const draftTotal = draft
    ? draft.lines.reduce((s, l) => s + (l.discount ? -Math.abs(l.unit_price || 0) : (l.qty || 0) * (l.unit_price || 0)), 0)
    : 0;

  return (
    <div className="card p-6" data-testid="contract-addenda">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-medium">Phụ lục hợp đồng</h2>
        {canEdit && !draft && (
          <button onClick={() => setDraft({ title: "", note: "", lines: [emptyLine()] })} className="btn-ghost px-2.5 py-1.5 text-xs">
            <FilePlus2 size={14} /> Tạo phụ lục
          </button>
        )}
      </div>
      <p className="mb-4 text-[12px]" style={{ color: "var(--text3)" }}>
        Thêm/bớt dịch vụ sau khi khách đã ký. Phụ lục chỉ cộng vào tổng hợp đồng khi khách ký ở trang của họ, hoặc khi
        studio xác nhận thay (đã thoả thuận qua điện thoại / Zalo).
      </p>

      {addenda.length === 0 && !draft && (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có phụ lục nào.</p>
      )}

      <div className="space-y-3">
        {addenda.map((a) => {
          const total = addendumTotal(a.lines);
          return (
            <div key={a.id} className="rounded-[11px] p-3.5" style={{ border: "1px solid var(--border)", background: "var(--surface2)" }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold">{addendumLabel(a)}</p>
                  {a.signed_at ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: "var(--gn)" }}>
                      <Lock size={12} />
                      {a.signed_by === "studio" ? "Studio xác nhận thay khách" : "Khách đã ký"} · {a.signed_name} · {fmtDateTime(a.signed_at)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--am)" }}>Chờ khách ký — chưa tính vào tổng hợp đồng</p>
                  )}
                </div>
                <span className="tnum flex-none text-[14px] font-bold">{total >= 0 ? "+" : ""}{vnd(total)}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
                {a.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
                    <span className="tnum flex-none">{vnd(l.qty * l.unit_price)}</span>
                  </li>
                ))}
              </ul>
              {a.note && <p className="mt-2 text-[12px]" style={{ color: "var(--text3)" }}>{a.note}</p>}
              {!a.signed_at && canEdit && (
                confirming?.id === a.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className="input min-w-0 flex-1 py-1.5 text-[12.5px]"
                      placeholder="Tên người đồng ý (khách) — ghi vào nhật ký"
                      value={confirming.name}
                      onChange={(e) => setConfirming({ id: a.id, name: e.target.value })}
                    />
                    <button
                      disabled={busy || !confirming.name.trim()}
                      onClick={async () => {
                        if (await call({ action: "confirm", addendumId: a.id, name: confirming.name })) {
                          setConfirming(null);
                          toast("Đã xác nhận phụ lục — đã cộng vào tổng hợp đồng.");
                        }
                      }}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      <Check size={14} /> Xác nhận
                    </button>
                    <button onClick={() => setConfirming(null)} className="btn-ghost px-3 py-1.5 text-xs">Thôi</button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button onClick={() => edit(a)} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs"><PenLine size={13} /> Sửa</button>
                    <button onClick={() => setConfirming({ id: a.id, name: "" })} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs"><Check size={13} /> Xác nhận thay khách</button>
                    <button
                      onClick={async () => { if (confirm(`Xoá ${addendumLabel(a)}?`) && (await call({ action: "delete", addendumId: a.id }))) toast("Đã xoá phụ lục."); }}
                      disabled={busy}
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                      style={{ color: "var(--rd)" }}
                    >
                      <Trash2 size={13} /> Xoá
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {draft && (
        <div className="mt-3 rounded-[11px] p-3.5" style={{ border: "1px solid var(--acM)" }}>
          <input
            className="input mb-2"
            placeholder="Tiêu đề (vd: Thêm buổi chụp pre-wedding)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="space-y-2">
            {draft.lines.map((l, idx) => {
              const setLine = (patch: Partial<Draft["lines"][number]>) =>
                setDraft({ ...draft, lines: draft.lines.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
              return (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    className="input col-span-12 sm:col-span-6"
                    placeholder={l.discount ? "Giảm giá" : "Tên dịch vụ"}
                    value={l.name}
                    onChange={(e) => setLine({ name: e.target.value })}
                    style={l.discount ? { color: "var(--s-amber)" } : undefined}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input col-span-3 text-center sm:col-span-2"
                    value={l.discount ? 1 : l.qty}
                    disabled={l.discount}
                    onChange={(e) => setLine({ qty: Number(e.target.value) || 1 })}
                  />
                  <MoneyInput className="input col-span-7 text-right sm:col-span-3" value={l.unit_price} onChange={(n) => setLine({ unit_price: n })} />
                  <button
                    onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== idx) })}
                    className="col-span-2 flex items-center justify-center sm:col-span-1"
                    style={{ color: "var(--text3)" }}
                    aria-label="Xoá dòng"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })} className="btn-ghost px-2.5 py-1.5 text-xs">
              <Plus size={14} /> Thêm dòng
            </button>
            <button
              onClick={() => setDraft({ ...draft, lines: [...draft.lines, { ...emptyLine(), name: "Giảm giá", discount: true }] })}
              className="btn-ghost px-2.5 py-1.5 text-xs"
              style={{ color: "var(--s-amber)" }}
            >
              <Tag size={14} /> Thêm giảm giá
            </button>
          </div>
          <textarea
            className="input mt-2"
            rows={2}
            placeholder="Ghi chú cho khách (tuỳ chọn)"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px]" style={{ color: "var(--text2)" }}>
              Tổng phụ lục: <b className="tnum">{vnd(draftTotal)}</b>
            </span>
            <div className="flex-1" />
            <button onClick={() => setDraft(null)} className="btn-ghost">Huỷ</button>
            <button onClick={saveDraft} disabled={busy} className="btn-primary">
              {busy ? "Đang lưu…" : draft.id ? "Lưu phụ lục" : "Tạo phụ lục"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
