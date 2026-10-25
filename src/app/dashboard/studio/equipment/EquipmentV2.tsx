"use client";

import { useMemo, useState } from "react";
import {
  Aperture, Battery, Camera, Eye, HardDrive, Lightbulb, Mic, Package, Plane, Plus, Search, Trash2, type LucideIcon,
} from "lucide-react";
import { Badge, Empty, Field, GroupLabel, InfoList, PageHead, Stack, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Modal, SearchInput, Segmented } from "@/components/v2/kit-client";
import type { StudioEquipment } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import type { EquipmentManagerProps } from "./EquipmentManager";
import { emptyEquipmentForm, useEquipment, type EquipmentForm } from "./useEquipment";

/* ═══════════════════════════════════════════════════════════════════════════
   THIẾT BỊ — giao diện mới. Cùng dữ liệu, cùng thao tác với EquipmentManager
   (bản cũ, logic chung ở ./useEquipment); khác ở cách bày:
     • Không còn khung "Thêm thiết bị" chiếm 1/3 màn — nút chính mở hộp thoại
       (có "Thêm & nhập tiếp" để khai cả túi máy một lượt).
     • Một thanh: tìm · nhóm thiết bị (đếm theo nhóm) · tình trạng (khi có máy
       ngừng dùng).
     • Lưới thẻ gom theo nhóm, mỗi thẻ một nhãn tình trạng. Bấm thẻ mở ngăn chi
       tiết; xoá nằm trong ⋯ và ngăn chi tiết, có hỏi lại.
   ═══════════════════════════════════════════════════════════════════════════ */

type State = "all" | "active" | "inactive";

const NO_CAT = "__none__";
const catKey = (e: StudioEquipment) => e.category?.trim() || NO_CAT;
const catLabel = (k: string) => (k === NO_CAT ? "Chưa phân loại" : k);

/** Nhóm gợi ý khi thêm thiết bị (cộng với nhóm studio đã dùng). */
const SUGGEST = ["Máy ảnh", "Ống kính", "Đèn", "Âm thanh", "Flycam", "Phụ kiện"];

/** Icon theo nhóm/tên — chỉ để dễ nhìn, không ảnh hưởng dữ liệu. */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/lens|ống kính|(^|\s)ống(\s|$)|\d+-\d+\s?mm|f\/?\d/i, Aperture],
  [/máy ảnh|máy quay|camera|body|sony|canon|nikon|fuji|lumix|a7/i, Camera],
  [/đèn|light|flash|godox|softbox|led/i, Lightbulb],
  [/mic|âm thanh|thu âm|audio|rode/i, Mic],
  [/flycam|drone|dji|mavic/i, Plane],
  [/thẻ nhớ|ổ cứng|ssd|(^|\s)sd(\s|$)|cfexpress/i, HardDrive],
  [/pin|sạc|battery/i, Battery],
];
const iconOf = (e: StudioEquipment): LucideIcon => ICON_RULES.find(([re]) => re.test(`${e.category ?? ""} ${e.name}`))?.[1] ?? Package;

export default function EquipmentV2({ ownerId, initial }: EquipmentManagerProps) {
  const { list, add, remove } = useEquipment(ownerId, initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [state, setState] = useState<State>("all");
  const [peekId, setPeekId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<StudioEquipment | null>(null);

  const inactiveCount = list.filter((e) => !e.active).length;

  // Nhóm theo thứ tự chữ cái, "Chưa phân loại" xuống cuối.
  const cats = useMemo(() => {
    const keys = [...new Set(list.map(catKey))];
    return keys.sort((a, b) => (a === NO_CAT ? 1 : b === NO_CAT ? -1 : a.localeCompare(b, "vi")));
  }, [list]);

  const pool = useMemo(() => {
    const n = q.trim().toLowerCase();
    return list.filter((e) => {
      if (state === "active" && !e.active) return false;
      if (state === "inactive" && e.active) return false;
      if (!n) return true;
      return [e.name, e.category, e.note].some((v) => v?.toLowerCase().includes(n));
    });
  }, [list, q, state]);
  const shown = cat === "all" ? pool : pool.filter((e) => catKey(e) === cat);

  const peek = peekId ? (list.find((e) => e.id === peekId) ?? null) : null;
  const filtering = !!q.trim() || cat !== "all" || state !== "all";

  return (
    <Stack>
      <PageHead
        desc="Máy ảnh, ống kính, đèn, phụ kiện của studio — gom theo nhóm để biết mình đang có gì."
        actions={
          <button type="button" className={btn("primary")} onClick={() => setAdding(true)}>
            <Plus size={17} /> Thêm thiết bị
          </button>
        }
      />

      {list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Camera}
            title="Chưa có thiết bị nào"
            hint="Thêm body, ống kính, đèn… để cả đội biết studio đang có gì và món nào đang ngừng dùng."
            action={
              <button type="button" className={btn("secondary")} onClick={() => setAdding(true)}>
                <Plus size={16} /> Thêm thiết bị đầu tiên
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="v2-card v2-card-pad flex flex-col gap-3">
            <Toolbar>
              <div className="min-w-[220px] flex-[1_1_240px]">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, nhóm, ghi chú…" className="w-full" />
              </div>
              {inactiveCount > 0 && (
                <select aria-label="Tình trạng" className={inputCls} value={state} onChange={(e) => setState(e.target.value as State)}>
                  <option value="all">Mọi tình trạng</option>
                  <option value="active">Đang dùng</option>
                  <option value="inactive">Ngừng dùng</option>
                </select>
              )}
              {cats.length > 1 && (
                <div className="w-full min-w-0">
                  <Segmented<string>
                    label="Nhóm thiết bị"
                    value={cat}
                    onChange={setCat}
                    options={[
                      { value: "all", label: "Tất cả", count: pool.length },
                      ...cats.map((k) => ({ value: k, label: catLabel(k), count: pool.filter((e) => catKey(e) === k).length })),
                    ]}
                  />
                </div>
              )}
            </Toolbar>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {filtering ? `${shown.length} / ${list.length} thiết bị khớp bộ lọc` : `${list.length} thiết bị · ${cats.length} nhóm`}
              {inactiveCount && !filtering ? ` · ${inactiveCount} ngừng dùng` : ""}
              {filtering ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="font-semibold"
                    style={{ color: "var(--ac)" }}
                    onClick={() => {
                      setQ("");
                      setCat("all");
                      setState("all");
                    }}
                  >
                    Xoá lọc
                  </button>
                </>
              ) : null}
            </p>
          </div>

          {shown.length === 0 ? (
            <div className="v2-card">
              <Empty compact icon={Search} title="Không tìm thấy thiết bị phù hợp" hint="Thử gõ ít chữ hơn hoặc chọn nhóm “Tất cả”." />
            </div>
          ) : (
            cats
              .filter((k) => shown.some((e) => catKey(e) === k))
              .map((k) => {
                const items = shown.filter((e) => catKey(e) === k);
                return (
                  <section key={k} className="flex flex-col gap-2.5">
                    {cat === "all" ? <GroupLabel count={`${items.length} thiết bị`}>{catLabel(k)}</GroupLabel> : null}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
                      {items.map((e) => (
                        <EquipmentCard key={e.id} e={e} onOpen={() => setPeekId(e.id)} onDelete={() => setConfirm(e)} />
                      ))}
                    </div>
                  </section>
                );
              })
          )}
        </>
      )}

      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={peek?.name ?? ""}
        desc={peek ? catLabel(catKey(peek)) : undefined}
        width={440}
        footer={
          peek ? (
            <button type="button" className={btn("danger")} onClick={() => setConfirm(peek)}>
              <Trash2 size={16} /> Xoá khỏi sổ
            </button>
          ) : null
        }
      >
        {peek ? <EquipmentPeek e={peek} /> : null}
      </Drawer>

      {adding ? (
        <AddEquipmentModal
          cats={[...new Set([...cats.filter((k) => k !== NO_CAT), ...SUGGEST])]}
          add={add}
          onClose={() => setAdding(false)}
        />
      ) : null}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={Trash2}
        title="Xoá thiết bị khỏi sổ?"
        desc={confirm ? `“${confirm.name}” sẽ bị xoá khỏi sổ thiết bị. Không hoàn tác được.` : undefined}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirm(null)}>
              Giữ lại
            </button>
            <button
              type="button"
              className={btn("danger")}
              onClick={() => {
                const id = confirm?.id;
                setConfirm(null);
                if (!id) return;
                if (peekId === id) setPeekId(null);
                void remove(id);
              }}
            >
              <Trash2 size={16} /> Xoá
            </button>
          </>
        }
      />
    </Stack>
  );
}

function EquipmentTile({ e, size = 42 }: { e: StudioEquipment; size?: number }) {
  const Icon = iconOf(e);
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[12px]"
      style={{ width: size, height: size, background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd2)" }}
    >
      <Icon size={size * 0.45} />
    </span>
  );
}

function EquipmentCard({ e, onOpen, onDelete }: { e: StudioEquipment; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="v2-card v2-card-link relative flex items-start gap-3 p-3.5" style={e.active ? undefined : { opacity: 0.72 }}>
      {/* Lớp bấm phủ cả thẻ → mở chi tiết; menu ⋯ nằm trên lớp này. */}
      <button type="button" className="absolute inset-0 rounded-[16px]" aria-label={`Xem ${e.name}`} onClick={onOpen} />
      <EquipmentTile e={e} />
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{e.name}</p>
        <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {e.note || "Không có ghi chú"}
        </p>
        <div className="mt-2">
          {e.active ? (
            <Badge tone="green" dot>
              Đang dùng
            </Badge>
          ) : (
            <Badge tone="gray" dot>
              Ngừng dùng
            </Badge>
          )}
        </div>
      </div>
      <div className="relative -mr-1.5 -mt-1.5 flex-none">
        <Menu
          label={`Thao tác cho ${e.name}`}
          items={[
            { label: "Xem chi tiết", icon: Eye, onClick: onOpen },
            "divider",
            { label: "Xoá khỏi sổ", icon: Trash2, danger: true, onClick: onDelete },
          ]}
        />
      </div>
    </div>
  );
}

function EquipmentPeek({ e }: { e: StudioEquipment }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <EquipmentTile e={e} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{e.name}</p>
          <div className="mt-1.5">
            {e.active ? (
              <Badge tone="green" dot>
                Đang dùng
              </Badge>
            ) : (
              <Badge tone="gray" dot>
                Ngừng dùng
              </Badge>
            )}
          </div>
        </div>
      </div>
      <InfoList
        items={[
          { label: "Nhóm", value: catLabel(catKey(e)) },
          { label: "Ghi chú", value: e.note || "—" },
          { label: "Ngày thêm vào sổ", value: fmtDate(e.created_at) || "—" },
        ]}
      />
    </div>
  );
}

function AddEquipmentModal({
  cats,
  add,
  onClose,
}: {
  cats: string[];
  add: (f: EquipmentForm) => Promise<boolean>;
  onClose: () => void;
}) {
  const [f, setF] = useState<EquipmentForm>(emptyEquipmentForm);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);

  async function save(keepOpen: boolean) {
    if (!f.name.trim()) return;
    setBusy(true);
    const ok = await add(f);
    setBusy(false);
    if (!ok) return;
    if (keepOpen) {
      // Giữ nhóm vừa chọn — thường khai cả túi đồ cùng nhóm một lượt.
      setF({ ...emptyEquipmentForm(), category: f.category });
      setSaved((n) => n + 1);
    } else onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={Camera}
      title="Thêm thiết bị"
      desc={saved ? `Đã thêm ${saved} thiết bị. Nhập tiếp món sau hoặc đóng lại.` : "Tên càng rõ càng dễ tìm, ví dụ kèm số thứ tự máy."}
      footer={
        <>
          <button type="button" className={btn("secondary")} onClick={() => save(true)} disabled={busy || !f.name.trim()}>
            Thêm & nhập tiếp
          </button>
          <button type="button" className={btn("primary")} onClick={() => save(false)} disabled={busy || !f.name.trim()}>
            <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm vào sổ"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên thiết bị" htmlFor="eq-name">
          <input
            id="eq-name"
            className={inputCls}
            placeholder="VD: Sony A7IV #1"
            value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            autoFocus
          />
        </Field>
        <Field label="Nhóm" htmlFor="eq-cat" hint="Chọn nhóm có sẵn hoặc gõ nhóm mới.">
          <input
            id="eq-cat"
            className={inputCls}
            list="eq-cat-list"
            placeholder="Máy ảnh / Ống kính / Đèn…"
            value={f.category}
            onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
          />
          <datalist id="eq-cat-list">
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Ghi chú" htmlFor="eq-note">
          <input
            id="eq-note"
            className={inputCls}
            placeholder="Tuỳ chọn — số seri, tình trạng…"
            value={f.note}
            onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
          />
        </Field>
      </div>
    </Modal>
  );
}
