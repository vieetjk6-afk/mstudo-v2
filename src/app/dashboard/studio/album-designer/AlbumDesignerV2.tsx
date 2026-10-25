"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookImage, Check, Clock, Filter, FolderOpen, Loader2, Pencil, Plus, Ruler, Trash2, Wand2,
} from "lucide-react";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { Badge, Empty, Field, GroupLabel, PageHead, Section, Stack, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Menu, Modal, SearchInput, Segmented } from "@/components/v2/kit-client";
import AlbumEditor from "./AlbumEditor";
import { CATS, SIZES, TEMPLATES, type SavedRow } from "./designer-data";
import { useAlbumDesigner } from "./useAlbumDesigner";

/* ═══════════════════════════════════════════════════════════════════════════
   THIẾT KẾ ALBUM — giao diện mới. Cùng API, cùng thao tác với AlbumDesigner
   (bản cũ, logic chung ở ./useAlbumDesigner); khác ở cách sắp xếp:
     • Trang chính: đầu trang có MỘT nút "Tạo album mới"; thanh lọc tìm theo
       tên + khổ in + sắp xếp; album nhóm theo tháng sửa gần nhất.
     • Thẻ album: ảnh minh hoạ cuốn album đúng tỉ lệ khổ + màu trang của mẫu,
       tên, khổ · mẫu, ngày sửa; một nút "Mở để chỉnh", menu ⋯ có Xoá (hỏi lại
       trước khi xoá).
     • Tạo mới: thanh bước Khổ giấy → Bộ mẫu → Dàn trang; mỗi bước là một khối
       có tiêu đề + mô tả, khổ tuỳ chỉnh nằm ngay trong khối khổ giấy.
   ═══════════════════════════════════════════════════════════════════════════ */

type Sort = "recent" | "name";

function monthKey(iso?: string | null) {
  return iso ? iso.slice(0, 7) : "";
}
function monthLabel(key: string) {
  if (!key) return "Không rõ ngày";
  const [y, m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export default function AlbumDesignerV2() {
  const d = useAlbumDesigner();
  const [q, setQ] = useState("");
  const [sizeF, setSizeF] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [confirmDel, setConfirmDel] = useState<SavedRow | null>(null);

  const sizes = useMemo(() => [...new Set(d.saved.map((s) => s.size?.name).filter(Boolean) as string[])], [d.saved]);

  const filtered = useMemo(() => {
    const needle = noAccent(q.trim());
    const rows = d.saved.filter((s) => {
      if (sizeF && s.size?.name !== sizeF) return false;
      if (needle && !noAccent(`${s.name} ${s.tpl?.name ?? ""}`).includes(needle)) return false;
      return true;
    });
    return sort === "name"
      ? [...rows].sort((a, b) => a.name.localeCompare(b.name, "vi"))
      : [...rows].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }, [d.saved, q, sizeF, sort]);

  const groups = useMemo(() => {
    if (sort === "name") return [{ key: "all", label: "Tất cả album", rows: filtered }];
    const by = new Map<string, SavedRow[]>();
    for (const s of filtered) by.set(monthKey(s.updated_at), [...(by.get(monthKey(s.updated_at)) ?? []), s]);
    return [...by].map(([k, rows]) => ({ key: k, label: monthLabel(k), rows }));
  }, [filtered, sort]);

  // ── Trình dàn trang (bản mới tự chọn qua AlbumEditor) ─────────────────────
  if (d.step === "editor" && d.edSize && d.edTpl) {
    return <AlbumEditor size={d.edSize} tpl={d.edTpl} initial={d.initial} onBack={() => d.setStep("home")} />;
  }

  const filtering = q.trim() !== "" || sizeF !== "" || sort !== "recent";
  const createBtn = (
    <button type="button" onClick={d.startNew} className={btn("primary")}>
      <Plus size={17} /> Tạo album mới
    </button>
  );

  /* ── Trang chính: album đã lưu ─────────────────────────────────────────── */
  if (d.step === "home") {
    return (
      <Stack>
        <PageHead
          desc="Dàn trang album in từ thư mục ảnh Google Drive: chọn khổ, chọn mẫu, AI rải ảnh rồi xuất PDF chuẩn nhà in. Album được lưu lại, làm dở quay lại làm tiếp."
          actions={createBtn}
        />

        {d.loadingSaved ? (
          <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4" aria-busy="true" aria-label="Đang tải album">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="v2-card overflow-hidden">
                <div className="aspect-[4/3] animate-pulse" style={{ background: "var(--sf2)" }} />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: "var(--sf2)" }} />
                  <div className="h-3 w-1/2 animate-pulse rounded" style={{ background: "var(--sf2)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : d.saved.length === 0 ? (
          <div className="v2-card">
            <Empty
              icon={BookImage}
              title="Chưa có album nào"
              hint="Ba bước là có album in: chọn khổ giấy, chọn bộ mẫu, dán link thư mục ảnh Drive rồi bấm “Tự thiết kế cả album”. Chỉnh tay từng trang nếu muốn, xong xuất PDF gửi nhà in."
              action={createBtn}
            />
          </div>
        ) : (
          <>
            <div className="v2-card v2-card-pad flex flex-col gap-3">
              <Toolbar>
                <div className="min-w-[200px] flex-1">
                  <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên album, tên mẫu…" className="w-full" />
                </div>
                {sizes.length > 1 && (
                  <select aria-label="Khổ in" className={inputCls} value={sizeF} onChange={(e) => setSizeF(e.target.value)}>
                    <option value="">Mọi khổ</option>
                    {sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <select aria-label="Sắp xếp album" className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recent">Sửa gần nhất</option>
                  <option value="name">Tên A → Z</option>
                </select>
              </Toolbar>
              {filtering ? (
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {filtered.length} / {d.saved.length} album ·{" "}
                  <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setSizeF(""); setSort("recent"); }}>
                    Xoá lọc
                  </button>
                </p>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <div className="v2-card">
                <Empty compact icon={Filter} title="Không có album nào khớp bộ lọc" hint="Thử tìm bằng tên khác hoặc chọn lại khổ in." />
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.key} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} />
                    <GroupLabel count={`${g.rows.length} album`}>{g.label}</GroupLabel>
                  </div>
                  <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
                    {g.rows.map((s) => (
                      <DesignCardV2
                        key={s.id}
                        s={s}
                        opening={d.opening === s.id}
                        busy={!!d.opening}
                        onOpen={() => void d.openSaved(s.id)}
                        onDelete={() => setConfirmDel(s)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}

        <Modal
          open={!!confirmDel}
          onClose={() => setConfirmDel(null)}
          icon={Trash2}
          title="Xoá album này?"
          desc={confirmDel ? `“${confirmDel.name}” sẽ bị xoá cùng toàn bộ trang đã dàn. Không khôi phục được.` : undefined}
          width={420}
          footer={
            <>
              <button type="button" onClick={() => setConfirmDel(null)} className={btn("ghost")}>Giữ lại</button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDel) void d.del(confirmDel.id);
                  setConfirmDel(null);
                }}
                className={btn("danger")}
              >
                <Trash2 size={16} /> Xoá album
              </button>
            </>
          }
        />
      </Stack>
    );
  }

  /* ── Tạo mới: khổ giấy → bộ mẫu ───────────────────────────────────────── */
  const steps: { key: "size" | "template" | "editor"; label: string; hint: string }[] = [
    { key: "size", label: "Khổ giấy", hint: d.edSize ? d.edSize.name : "Chọn khổ in" },
    { key: "template", label: "Bộ mẫu", hint: "Phông chữ, màu trang" },
    { key: "editor", label: "Dàn trang", hint: "Rải ảnh, chỉnh, xuất file" },
  ];
  const at = d.step === "size" ? 0 : 1;

  return (
    <Stack>
      <button type="button" onClick={() => d.setStep("home")} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--tx3)" }}>
        <ArrowLeft size={15} /> Album của bạn
      </button>

      <ol className="v2-card grid grid-cols-3 gap-1 p-2" aria-label="Các bước tạo album">
        {steps.map((st, i) => {
          const on = i === at;
          const ok = i < at;
          const clickable = i <= 1 && (i === 0 || !!d.edSize);
          return (
            <li key={st.key} className="min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && d.setStep(st.key as "size" | "template")}
                aria-current={on ? "step" : undefined}
                className="flex w-full min-w-0 items-center gap-2.5 rounded-[11px] px-2 py-2 text-left sm:px-3"
                style={{ background: on ? "var(--acS)" : "transparent", cursor: clickable ? "pointer" : "default" }}
              >
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={{ background: on ? "var(--ac)" : ok ? "var(--gnS)" : "var(--sf2)", color: on ? "#fff" : ok ? "var(--gn)" : "var(--tx3)" }}
                >
                  {ok ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: on ? "var(--ac)" : i > at ? "var(--tx3)" : "var(--tx)" }}>
                    {st.label}
                  </span>
                  <span className="hidden truncate text-[12px] sm:block" style={{ color: "var(--tx3)" }}>{st.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {d.step === "size" && (
        <Section icon={Ruler} title="Chọn khổ album" desc="Khổ in cố định trước khi thiết kế — mỗi trang dàn là một spread hai mặt.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SIZES.map((s) => {
              const ar = s.w / s.h, maxPx = 76;
              const pw = ar >= 1 ? maxPx : maxPx * ar, ph = ar >= 1 ? maxPx / ar : maxPx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => d.chooseSize(s)}
                  className="v2-card v2-card-link flex flex-col gap-1 p-3 text-left"
                  style={{ boxShadow: "none" }}
                >
                  <span className="mb-1 flex h-[92px] items-center justify-center rounded-[10px]" style={{ background: "var(--sf2)" }}>
                    <span style={{ width: pw, height: ph, border: "2px solid var(--ac)", borderRadius: 5, background: "var(--acS)" }} />
                  </span>
                  <span className="text-[14px] font-semibold">{s.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    {s.dim}
                  </span>
                  <span className="mt-0.5"><Badge tone={s.tag === "Bán chạy nhất" ? "brand" : "gray"}>{s.tag}</Badge></span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[14px] p-3.5" style={{ background: "var(--sf2)" }}>
            <div className="min-w-[160px] flex-1">
              <p className="text-[14px] font-semibold">Khổ tuỳ chỉnh</p>
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Nhập kích thước một trang (cm).</p>
            </div>
            <Field label="Rộng (cm)" className="w-[104px]">
              <input value={d.customW} onChange={(e) => d.setCustomW(e.target.value)} inputMode="decimal" className={inputCls} aria-label="Rộng (cm)" />
            </Field>
            <Field label="Cao (cm)" className="w-[104px]">
              <input value={d.customH} onChange={(e) => d.setCustomH(e.target.value)} inputMode="decimal" className={inputCls} aria-label="Cao (cm)" />
            </Field>
            <button
              type="button"
              onClick={() => {
                const w = parseFloat(d.customW) || 30, h = parseFloat(d.customH) || 30;
                d.chooseSize({ id: "custom", name: `Tùy chỉnh ${w}×${h}`, dim: `${w} × ${h} cm`, w, h, tag: "Tùy chỉnh" });
              }}
              className={btn("primary", "md", "w-full sm:w-auto")}
            >
              Tiếp tục <ArrowRight size={16} />
            </button>
          </div>
        </Section>
      )}

      {d.step === "template" && (
        <Section
          icon={Wand2}
          title="Chọn bộ mẫu"
          desc={
            <>
              Phông chữ, màu trang và phong cách dàn trang.{" "}
              {d.edSize ? (
                <>
                  Khổ đã chọn: <b style={{ color: "var(--tx)" }}>{d.edSize.name}</b> ·{" "}
                  <button type="button" onClick={() => d.setStep("size")} className="font-semibold" style={{ color: "var(--ac)" }}>Đổi khổ</button>
                </>
              ) : null}
            </>
          }
        >
          <div className="mb-4">
            <Segmented
              label="Nhóm mẫu"
              value={d.cat}
              onChange={d.setCat}
              options={CATS.map((c) => ({ value: c, label: c, count: c === "Tất cả" ? TEMPLATES.length : TEMPLATES.filter((t) => t.cat === c).length }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter((t) => d.cat === "Tất cả" || t.cat === d.cat).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => d.chooseTpl(t)}
                className="v2-card v2-card-link group flex flex-col overflow-hidden text-left"
                style={{ boxShadow: "none" }}
              >
                {/* Màu trang + phông của chính bộ mẫu (màu nội dung album). */}
                <span className="flex h-[128px] items-center justify-center" style={{ background: t.page, borderBottom: "1px solid var(--bd2)" }}>
                  <span style={{ fontFamily: t.font, color: t.ink, fontSize: 28, textTransform: t.upper ? "uppercase" : "none", letterSpacing: t.upper ? ".08em" : undefined }}>
                    {t.sample}
                  </span>
                </span>
                <span className="flex items-center gap-2 px-3.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{t.name}</span>
                    <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>{t.cat}</span>
                  </span>
                  <span className={btn("soft", "sm")}>Dùng mẫu</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </Stack>
  );
}

/* ── Thẻ album đã lưu ───────────────────────────────────────────────────── */
function DesignCardV2({
  s,
  opening,
  busy,
  onOpen,
  onDelete,
}: {
  s: SavedRow;
  opening: boolean;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const ar = s.size?.w && s.size?.h ? (2 * s.size.w) / s.size.h : 2; // spread = hai trang
  // Cuốn album minh hoạ vừa khung 4:3: rộng tối đa 78% bề ngang, cao tối đa
  // 62% bề cao (= 46.5% bề ngang) — tính ra % bề ngang theo tỉ lệ spread.
  const w = Math.min(78, 46.5 * ar);
  const page = s.tpl?.page || "var(--sf)";
  const ink = s.tpl?.ink || "var(--tx)";

  return (
    <article className="v2-card v2-card-link group flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        aria-label={`Mở album ${s.name}`}
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
        style={{ background: "var(--sf2)" }}
      >
        <span
          className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]"
          style={{ width: `${w}%`, aspectRatio: `${ar}`, background: page, borderRadius: 3, boxShadow: "0 10px 26px rgba(0,0,0,.16), 0 1px 3px rgba(0,0,0,.12)" }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(0,0,0,.10)" }} />
          <span className="truncate px-3" style={{ fontFamily: s.tpl?.font, color: ink, fontSize: 18, opacity: 0.85 }}>{s.tpl?.name}</span>
        </span>
        <span className="absolute left-3 top-3">
          <span className="v2-badge" style={{ background: "rgba(255,255,255,.94)", color: "var(--tx2)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
            <Ruler size={12} strokeWidth={2.4} /> {s.size?.name}
          </span>
        </span>
        {opening ? (
          <span className="absolute inset-0 flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--sf) 55%, transparent)" }}>
            <Loader2 size={26} className="animate-spin" style={{ color: "var(--ac)" }} />
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold" title={s.name}>{s.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <Clock size={12} className="flex-none" /> Sửa {fmtDate(s.updated_at)} · Mẫu {s.tpl?.name}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <button type="button" onClick={onOpen} disabled={busy} className={btn("secondary", "sm", "flex-1")}>
            {opening ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} {opening ? "Đang mở…" : "Mở để chỉnh"}
          </button>
          <Menu
            label={`Thêm thao tác với ${s.name}`}
            items={[
              { label: "Mở để chỉnh", icon: FolderOpen, onClick: onOpen, disabled: busy },
              "divider",
              { label: "Xoá album", icon: Trash2, danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>
    </article>
  );
}
