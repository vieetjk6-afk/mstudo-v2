"use client";

import { useState } from "react";
import { Check, FilePlus2, Lock, PenLine, Plus, Tag, Trash2, X } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Empty, Field, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Modal } from "@/components/v2/kit-client";
import { vnd } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { addendumLabel, addendumTotal, type ContractAddendum } from "@/lib/contract-addenda";
import { emptyAddendumLine, useContractAddenda, type AddendumDraft, type ContractAddendaProps } from "./ContractAddenda";

/* ═══════════════════════════════════════════════════════════════════════════
   PHỤ LỤC — giao diện mới (tab Hạng mục, chỉ hiện khi khách đã ký). Cùng logic
   với thẻ bản cũ (useContractAddenda): mỗi phụ lục một dòng có nhãn trạng thái,
   soạn / sửa trong ngăn kéo, xác nhận thay khách và xoá đều hỏi lại bằng hộp
   thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractAddendaV2(props: ContractAddendaProps) {
  const { canEdit } = props;
  const a = useContractAddenda(props);
  const { addenda, draft, setDraft, confirming, setConfirming, busy } = a;
  const [delTarget, setDelTarget] = useState<ContractAddendum | null>(null);

  return (
    <div data-testid="contract-addenda" className="contents">
      <Section
        title="Phụ lục hợp đồng"
        icon={FilePlus2}
        desc="Thêm/bớt dịch vụ sau khi khách đã ký. Chỉ cộng vào tổng khi khách ký ở trang của họ, hoặc studio xác nhận thay."
        actions={
          canEdit ? (
            <button
              type="button"
              className={btn("secondary", "sm")}
              disabled={!!draft}
              onClick={() => setDraft({ title: "", note: "", lines: [emptyAddendumLine()] })}
              aria-label="Tạo phụ lục"
            >
              <Plus size={15} /> <span className="hidden sm:inline">Tạo phụ lục</span>
            </button>
          ) : undefined
        }
        flush
      >
        {addenda.length === 0 ? (
          <Empty
            compact
            icon={FilePlus2}
            title="Chưa có phụ lục nào"
            hint={canEdit ? "Khách muốn thêm buổi chụp, thêm album… thì tạo phụ lục rồi gửi khách ký." : "Chỉ chủ studio hoặc quản lý tạo được phụ lục."}
          />
        ) : (
          <ul>
            {addenda.map((x) => (
              <AddendumRow
                key={x.id}
                a={x}
                canEdit={canEdit}
                busy={busy}
                onEdit={() => a.edit(x)}
                onConfirm={() => setConfirming({ id: x.id, name: "" })}
                onDelete={() => setDelTarget(x)}
              />
            ))}
          </ul>
        )}
      </Section>

      {draft && (
        <DraftDrawer
          draft={draft}
          setDraft={setDraft}
          total={a.draftTotal}
          busy={busy}
          onSave={a.saveDraft}
          onClose={() => setDraft(null)}
        />
      )}

      <Modal
        open={!!confirming}
        onClose={() => (busy ? undefined : setConfirming(null))}
        icon={Check}
        title="Xác nhận phụ lục thay khách?"
        desc="Dùng khi khách đã đồng ý qua điện thoại / Zalo. Phụ lục khoá lại và cộng ngay vào tổng hợp đồng."
        width={460}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirming(null)} disabled={busy}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("primary")}
              disabled={busy || !confirming?.name.trim()}
              onClick={() => confirming && a.confirmFor(confirming.id, confirming.name)}
            >
              <Check size={16} /> {busy ? "Đang xác nhận…" : "Xác nhận"}
            </button>
          </>
        }
      >
        {confirming && (
          <Field label="Tên người đồng ý (khách)" htmlFor="ad-confirm-name" hint="Ghi vào nhật ký phụ lục.">
            <input
              id="ad-confirm-name"
              className={inputCls}
              autoFocus
              placeholder="vd: Nguyễn Thị Lan Phương"
              value={confirming.name}
              onChange={(e) => setConfirming({ id: confirming.id, name: e.target.value })}
            />
          </Field>
        )}
      </Modal>

      <Modal
        open={!!delTarget}
        onClose={() => (busy ? undefined : setDelTarget(null))}
        icon={Trash2}
        title={delTarget ? `Xoá ${addendumLabel(delTarget)}?` : ""}
        desc="Phụ lục nháp này sẽ biến mất khỏi trang hợp đồng của khách."
        width={440}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setDelTarget(null)} disabled={busy}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("danger")}
              disabled={busy}
              onClick={async () => {
                if (delTarget && (await a.remove(delTarget.id))) setDelTarget(null);
              }}
            >
              {busy ? "Đang xoá…" : "Xoá phụ lục"}
            </button>
          </>
        }
      />
    </div>
  );
}

/* ── Một phụ lục ── */
function AddendumRow({
  a,
  canEdit,
  busy,
  onEdit,
  onConfirm,
  onDelete,
}: {
  a: ContractAddendum;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onDelete: () => void;
}) {
  const total = addendumTotal(a.lines);
  const editable = !a.signed_at && canEdit;
  return (
    <li className="px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-[14px] font-semibold">{addendumLabel(a)}</p>
            {a.signed_at ? (
              <Badge tone="green" icon={Lock}>
                {a.signed_by === "studio" ? "Studio xác nhận thay" : "Khách đã ký"}
              </Badge>
            ) : (
              <Badge tone="amber" dot>
                Chờ khách ký
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {a.signed_at ? `${a.signed_name ?? ""} · ${fmtDateTime(a.signed_at)}` : "Khách ký ở trang hợp đồng của họ · chưa tính vào tổng"}
          </p>
        </div>
        <span className="v2-num flex-none pt-0.5 text-[14.5px] font-semibold" style={{ color: total < 0 ? "var(--am)" : "var(--tx)" }}>
          {total >= 0 ? "+" : ""}
          {vnd(total)}
        </span>
        {editable && (
          <Menu
            label={`Thao tác cho ${addendumLabel(a)}`}
            width={240}
            items={[
              { label: "Sửa phụ lục", icon: PenLine, onClick: onEdit, disabled: busy },
              { label: "Xác nhận thay khách", icon: Check, onClick: onConfirm, disabled: busy, hint: "Đã thoả thuận qua điện thoại / Zalo" },
              "divider",
              { label: "Xoá phụ lục", icon: Trash2, danger: true, onClick: onDelete, disabled: busy },
            ]}
          />
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1 rounded-[10px] px-3 py-2.5 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
        {a.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate" style={{ color: l.unit_price < 0 ? "var(--am)" : undefined }}>
              {l.name}
              {l.qty > 1 ? ` × ${l.qty}` : ""}
            </span>
            <span className="v2-num flex-none">{vnd(l.qty * l.unit_price)}</span>
          </li>
        ))}
      </ul>
      {a.note && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {a.note}
        </p>
      )}
    </li>
  );
}

/* ── Soạn / sửa phụ lục (ngăn kéo) ── */
function DraftDrawer({
  draft,
  setDraft,
  total,
  busy,
  onSave,
  onClose,
}: {
  draft: AddendumDraft;
  setDraft: (d: AddendumDraft | null) => void;
  total: number;
  busy: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const setLine = (idx: number, patch: Partial<AddendumDraft["lines"][number]>) =>
    setDraft({ ...draft, lines: draft.lines.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
  return (
    <Drawer
      open
      onClose={onClose}
      title={draft.id ? "Sửa phụ lục" : "Tạo phụ lục"}
      desc="Khách ký ở trang hợp đồng của họ thì phụ lục mới cộng vào tổng."
      width={540}
      footer={
        <>
          <span className="mr-auto self-center text-[13px]" style={{ color: "var(--tx2)" }}>
            Tổng phụ lục <b className="v2-num" style={{ color: "var(--tx)" }}>{vnd(total)}</b>
          </span>
          <button type="button" className={btn("ghost")} onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button type="button" className={btn("primary")} onClick={onSave} disabled={busy}>
            {busy ? "Đang lưu…" : draft.id ? "Lưu phụ lục" : "Tạo phụ lục"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tiêu đề" htmlFor="ad-title">
          <input
            id="ad-title"
            className={inputCls}
            placeholder="vd: Thêm buổi chụp pre-wedding"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <p className="v2-label">Các dòng</p>
          {draft.lines.length === 0 && (
            <Callout tone="amber" icon={Tag}>
              Phụ lục cần ít nhất một dòng có tên.
            </Callout>
          )}
          {draft.lines.map((l, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-2 rounded-[12px] p-2.5"
              style={{
                border: `1px solid ${l.discount ? "color-mix(in srgb, var(--am) 35%, var(--bd))" : "var(--bd)"}`,
                background: l.discount ? "var(--amS)" : "var(--sf)",
              }}
            >
              <input
                className={`${inputCls} min-w-0 flex-[1_1_100%] sm:flex-[1_1_200px]`}
                placeholder={l.discount ? "Giảm giá" : "Tên dịch vụ"}
                aria-label={l.discount ? "Tên khoản giảm" : "Tên dịch vụ"}
                value={l.name}
                onChange={(e) => setLine(idx, { name: e.target.value })}
                style={l.discount ? { color: "var(--am)" } : undefined}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                <input
                  type="number"
                  min={1}
                  className={`${inputCls} !w-[64px] flex-none text-center`}
                  aria-label="Số lượng"
                  title="Số lượng"
                  value={l.discount ? 1 : l.qty}
                  disabled={l.discount}
                  onChange={(e) => setLine(idx, { qty: Number(e.target.value) || 1 })}
                />
                <MoneyInput
                  className={`${inputCls} min-w-0 flex-1 text-right sm:!w-[132px] sm:flex-none`}
                  value={l.unit_price}
                  onChange={(n) => setLine(idx, { unit_price: n })}
                  ariaLabel={l.discount ? "Số tiền giảm" : "Đơn giá"}
                  placeholder="0"
                />
                <button
                  type="button"
                  className={iconBtn()}
                  aria-label="Xoá dòng"
                  title="Xoá dòng"
                  onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== idx) })}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn("secondary", "sm")} onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyAddendumLine()] })}>
              <Plus size={15} /> Thêm dòng
            </button>
            <button
              type="button"
              className={btn("ghost", "sm")}
              style={{ color: "var(--am)" }}
              onClick={() => setDraft({ ...draft, lines: [...draft.lines, { ...emptyAddendumLine(), name: "Giảm giá", discount: true }] })}
            >
              <Tag size={15} /> Thêm giảm giá
            </button>
          </div>
        </div>

        <Field label="Ghi chú cho khách (tuỳ chọn)" htmlFor="ad-note">
          <textarea id="ad-note" className={inputCls} rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </Field>
      </div>
    </Drawer>
  );
}
