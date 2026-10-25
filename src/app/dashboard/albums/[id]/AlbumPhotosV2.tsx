"use client";

import { useMemo, useState } from "react";
import {
  Check, Copy, ExternalLink, FileText, FolderOpen, Heart, ImageIcon, Images, Link2, MessageSquareText, Plus, RefreshCw,
  Star, Trash2,
} from "lucide-react";
import { isFolderLink, stripExtension, thumbnailUrl } from "@/lib/drive";
import { noAccent } from "@/lib/studio-nav";
import { Badge, Empty, Field, InfoList, Toolbar, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import type { Photo, SourceStage } from "@/lib/types";
import type { AlbumEditorState, AlbumPick } from "./useAlbumEditor";
import { Thumb, codesText, copyText, downloadText, shortCode } from "./album-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab "Ảnh" của màn album (giao diện mới) + ngăn kéo xem nhanh một ảnh +
   ngăn kéo nguồn ảnh Google Drive. Logic ở ./useAlbumEditor.
   ═══════════════════════════════════════════════════════════════════════════ */

type Stage = "all" | "selection" | "delivery";
type Only = "all" | "picked" | "unpicked";

export function PhotosTabV2({
  e,
  slug,
  selections,
  onOpenSources,
  onPickedTab,
}: {
  e: AlbumEditorState;
  slug: string;
  selections: AlbumPick[];
  onOpenSources: () => void;
  onPickedTab: () => void;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage>("all");
  const [only, setOnly] = useState<Only>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const both = e.deliveryCount > 0 && e.selectionCount > 0;
  const hasPicks = e.pickedIds.size > 0;

  const groups = useMemo(() => {
    const needle = noAccent(q.trim());
    return e.photoGroups
      .filter((g) => stage === "all" || g.key === stage)
      .map((g) => ({
        ...g,
        photos: g.photos.filter((p) => {
          if (only === "picked" && !e.pickedIds.has(p.id)) return false;
          if (only === "unpicked" && e.pickedIds.has(p.id)) return false;
          if (needle && !noAccent(p.name).includes(needle)) return false;
          return true;
        }),
      }))
      .filter((g) => g.photos.length > 0);
  }, [e.photoGroups, e.pickedIds, q, stage, only]);

  const shown = groups.flatMap((g) => g.photos);
  const filtering = q.trim() !== "" || stage !== "all" || only !== "all";
  const fileBase = `${slug}-${stage === "delivery" ? "anh-giao-khach" : stage === "selection" ? "anh-chon" : "tat-ca-anh"}`;
  const open = openId ? e.photos.find((p) => p.id === openId) ?? null : null;

  async function copyNames(names: string[], what: string) {
    if (await copyText(codesText(names))) e.flash(`Đã chép ${names.length} mã ${what}`);
  }

  if (e.photos.length === 0) {
    return (
      <div className="v2-card">
        <Empty
          icon={Images}
          title="Album chưa có ảnh"
          hint="Thêm link thư mục Google Drive (chia sẻ “Bất kỳ ai có đường liên kết”), ảnh sẽ tự đồng bộ về album."
          action={
            <>
              <button type="button" onClick={onOpenSources} className={btn("secondary")}>
                <Plus size={16} /> Thêm nguồn ảnh
              </button>
              {e.sources.length > 0 && (
                <button type="button" onClick={() => void e.sync()} disabled={e.syncing} className={btn("ghost")}>
                  <RefreshCw size={16} className={e.syncing ? "animate-spin" : ""} /> {e.syncing ? "Đang đồng bộ…" : "Đồng bộ lại"}
                </button>
              )}
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="v2-card v2-card-pad flex flex-col gap-3">
        <Toolbar>
          <div className="min-w-[200px] flex-1">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên file…" className="w-full" />
          </div>
          {both && (
            <Segmented<Stage>
              label="Bộ ảnh"
              value={stage}
              onChange={setStage}
              options={[
                { value: "all", label: "Tất cả", count: e.photos.length },
                { value: "selection", label: "Ảnh chọn", count: e.selectionCount },
                { value: "delivery", label: "Ảnh giao", count: e.deliveryCount },
              ]}
            />
          )}
          {/* Ô lọc + nút nguồn + ⋯ đi chung một hàng (điện thoại không vỡ thành ba hàng). */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {hasPicks && (
              <select
                aria-label="Lọc theo khách chọn"
                className={`${inputCls} min-w-0 flex-1 sm:flex-none`}
                style={{ width: "auto" }}
                value={only}
                onChange={(ev) => setOnly(ev.target.value as Only)}
              >
                <option value="all">Mọi ảnh</option>
                <option value="picked">Khách đã chọn ({e.pickedIds.size})</option>
                <option value="unpicked">Khách chưa chọn</option>
              </select>
            )}
            <button type="button" onClick={onOpenSources} className={btn("secondary")}>
              <FolderOpen size={16} /> Nguồn Drive
              <span className="v2-num text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{e.sources.length}</span>
            </button>
            <Menu
              label="Thao tác với ảnh"
              width={250}
              items={[
                {
                  label: `Chép ${shown.length} mã ảnh`,
                  hint: filtering ? "Đúng các ảnh đang hiện" : "Tất cả ảnh trong album",
                  icon: Copy,
                  onClick: () => void copyNames(shown.map((p) => p.name), "ảnh"),
                  disabled: shown.length === 0,
                },
                { label: "Tải danh sách .txt", icon: FileText, onClick: () => downloadText(codesText(shown.map((p) => p.name)), fileBase), disabled: shown.length === 0 },
                "divider",
                {
                  label: e.syncing ? "Đang đồng bộ…" : "Đồng bộ lại từ Drive",
                  icon: RefreshCw,
                  onClick: () => void e.sync(),
                  disabled: e.syncing || e.sources.length === 0,
                },
              ]}
            />
          </div>
        </Toolbar>
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {filtering ? (
            <>
              Đang hiện {shown.length}/{e.photos.length} ảnh ·{" "}
              <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setStage("all"); setOnly("all"); }}>
                Xoá lọc
              </button>
            </>
          ) : hasPicks ? (
            <>
              Ảnh có dấu <Check size={12} className="inline -mt-0.5" /> là ảnh khách đã chọn ({e.pickedIds.size}/{e.photos.length}). Bấm vào ảnh để đặt làm bìa hoặc gỡ.{" "}
              <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={onPickedTab}>
                Xem riêng ảnh khách chọn
              </button>
            </>
          ) : (
            "Bấm vào ảnh để xem lớn, đặt làm ảnh bìa hoặc gỡ khỏi album."
          )}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="v2-card">
          <Empty compact icon={ImageIcon} title="Không có ảnh nào khớp" hint="Thử từ khoá khác hoặc bỏ bớt bộ lọc." />
        </div>
      ) : (
        groups.map((g) => {
          const secs = e.splitBySource(g.photos);
          const n = g.photos.length;
          return (
            <section key={g.key} className="v2-card overflow-hidden">
              <header className="v2-section-head">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: g.key === "delivery" ? "var(--bl)" : "var(--ac)" }} />
                <div className="min-w-0 flex-1">
                  <h3 className="v2-section-title">{g.label}</h3>
                  <p className="v2-section-desc">
                    {n} ảnh{secs.length > 1 ? ` · ${secs.length} thư mục` : ""}
                  </p>
                </div>
                <Menu
                  label={`Mã ảnh · ${g.label}`}
                  width={230}
                  items={[
                    { label: `Chép ${n} mã ảnh`, icon: Copy, onClick: () => void copyNames(g.photos.map((p) => p.name), g.label.toLowerCase()) },
                    {
                      label: "Tải danh sách .txt",
                      icon: FileText,
                      onClick: () => downloadText(codesText(g.photos.map((p) => p.name)), `${slug}-${g.key === "delivery" ? "anh-giao-khach" : "anh-chon"}`),
                    },
                  ]}
                />
              </header>
              <div className="v2-card-pad flex flex-col gap-5">
                {secs.map((sec) => (
                  <div key={`${g.key}-${sec.id}`} className="flex flex-col gap-2.5">
                    {sec.name && (
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
                        <FolderOpen size={14} /> {sec.name}
                        <span className="font-normal" style={{ color: "var(--tx3)" }}>· {sec.photos.length} ảnh</span>
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 min-[640px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1280px]:grid-cols-6">
                      {sec.photos.map((p) => (
                        <PhotoTile
                          key={p.id}
                          p={p}
                          picked={e.pickedIds.has(p.id)}
                          cover={e.form.cover_url === thumbnailUrl(p.drive_file_id, 800)}
                          onOpen={() => setOpenId(p.id)}
                          onCover={() => void e.setCover(p.drive_file_id)}
                          onRemove={() => void e.removePhoto(p.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <PhotoDrawer
        e={e}
        photo={open}
        picks={open ? selections.filter((s) => s.photo_id === open.id) : []}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function PhotoTile({
  p,
  picked,
  cover,
  onOpen,
  onCover,
  onRemove,
}: {
  p: Photo;
  picked: boolean;
  cover: boolean;
  onOpen: () => void;
  onCover: () => void;
  onRemove: () => void;
}) {
  const quick = "flex h-7 w-7 items-center justify-center rounded-[8px] text-white";
  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[3/2] w-full overflow-hidden rounded-[10px]"
        style={{ background: "var(--sf2)" }}
        aria-label={`Xem ảnh ${p.name}`}
      >
        <Thumb fileId={p.drive_file_id} alt={p.name} />
        <span
          className="pointer-events-none absolute inset-0 rounded-[10px]"
          style={{ boxShadow: picked ? "inset 0 0 0 2px var(--ac)" : "inset 0 0 0 1px var(--bd2)" }}
        />
        {cover && (
          <span className="absolute left-1.5 top-1.5">
            <Badge tone="brand" solid icon={Star}>Bìa</Badge>
          </span>
        )}
        {picked && (
          <span
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}
            title="Khách đã chọn ảnh này"
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </button>
      {/* Thao tác nhanh khi rê chuột (máy tính). Điện thoại: bấm ảnh mở ngăn kéo. */}
      <div className="pointer-events-none absolute bottom-[26px] right-1.5 hidden gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 lg:flex">
        {!cover && (
          <button type="button" onClick={onCover} className={quick} style={{ background: "rgba(10,14,22,.62)" }} title="Đặt làm ảnh bìa" aria-label="Đặt làm ảnh bìa">
            <Star size={14} />
          </button>
        )}
        <button type="button" onClick={onRemove} className={quick} style={{ background: "rgba(10,14,22,.62)" }} title="Gỡ khỏi album" aria-label="Gỡ ảnh khỏi album">
          <Trash2 size={14} />
        </button>
      </div>
      <p className="v2-num mt-1 truncate text-[12px]" style={{ color: "var(--tx2)" }} title={p.name}>
        {stripExtension(p.name)}
      </p>
    </div>
  );
}

function PhotoDrawer({
  e,
  photo,
  picks,
  onClose,
}: {
  e: AlbumEditorState;
  photo: Photo | null;
  picks: AlbumPick[];
  onClose: () => void;
}) {
  if (!photo) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const src = e.sources.find((s) => s.id === photo.source_id);
  const isCover = e.form.cover_url === thumbnailUrl(photo.drive_file_id, 800);
  const notes = picks.map((s) => (s.client_note || s.photographer_note || "").trim()).filter(Boolean);
  const who = Array.from(new Set(picks.map((s) => s.client_name || `Mã ${shortCode(s.session_id)}`)));
  return (
    <Drawer
      open
      onClose={onClose}
      title={stripExtension(photo.name)}
      desc={src?.stage === "delivery" ? "Ảnh giao khách" : "Ảnh chọn"}
      width={520}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              void e.removePhoto(photo.id);
              onClose();
            }}
            className={btn("danger")}
          >
            <Trash2 size={16} /> Gỡ khỏi album
          </button>
          <button type="button" onClick={() => void e.setCover(photo.drive_file_id)} disabled={isCover} className={btn("primary")}>
            <Star size={16} /> {isCover ? "Đang là ảnh bìa" : "Đặt làm ảnh bìa"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="aspect-[3/2] overflow-hidden rounded-[12px]" style={{ background: "var(--sf2)" }}>
          <Thumb fileId={photo.drive_file_id} alt={photo.name} w={1200} eager />
        </div>
        <InfoList
          items={[
            { label: "Tên file", value: <span className="v2-num break-all">{photo.name}</span> },
            { label: "Thư mục", value: src?.name || "—" },
            {
              label: "Khách chọn",
              value: picks.length ? (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <Badge tone="brand" icon={Heart}>Đã chọn</Badge>
                  <span style={{ color: "var(--tx2)" }}>{who.join(", ")}</span>
                </span>
              ) : (
                <span style={{ color: "var(--tx3)" }}>Chưa chọn</span>
              ),
            },
          ]}
        />
        {notes.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-[12px] p-3" style={{ background: "var(--acS)" }}>
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
              <MessageSquareText size={14} /> Ghi chú của khách
            </p>
            {notes.map((n, i) => (
              <p key={i} className="text-[13.5px]" style={{ color: "var(--tx)" }}>“{n}”</p>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}

/* ── Ngăn kéo nguồn ảnh Google Drive ─────────────────────────────────────── */
export function SourcesDrawerV2({
  e,
  open,
  onClose,
  canDelivery,
}: {
  e: AlbumEditorState;
  open: boolean;
  onClose: () => void;
  canDelivery: boolean;
}) {
  const countBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of e.photos) m.set(p.source_id ?? "", (m.get(p.source_id ?? "") ?? 0) + 1);
    return m;
  }, [e.photos]);
  const url = e.newSource.url.trim();
  const kindHint = url ? (isFolderLink(url) ? "Thư mục Drive" : /drive\.google\.com|docs\.google\.com/.test(url) ? "Ảnh lẻ trên Drive" : null) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nguồn ảnh Google Drive"
      desc="Thư mục hoặc ảnh lẻ mà album lấy ảnh về"
      width={520}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>
            Đóng
          </button>
          <button
            type="button"
            onClick={() => void e.sync()}
            disabled={e.syncing || e.sources.length === 0}
            className={btn("primary")}
          >
            <RefreshCw size={16} className={e.syncing ? "animate-spin" : ""} /> {e.syncing ? "Đang đồng bộ…" : "Đồng bộ ảnh"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {e.sources.length === 0 ? (
          <div className="rounded-[12px]" style={{ border: "1px dashed var(--bd)" }}>
            <Empty compact icon={FolderOpen} title="Chưa có nguồn ảnh" hint="Dán link thư mục Google Drive ở dưới để lấy ảnh về album." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
            {e.sources.map((s) => (
              <div key={s.id} className="v2-row" style={{ padding: "10px 12px" }}>
                <span className="v2-section-icon" style={{ width: 34, height: 34, ...(s.stage === "delivery" ? { background: "var(--blS)", color: "var(--bl)" } : {}) }}>
                  {s.kind === "folder" ? <FolderOpen size={16} /> : <ImageIcon size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold">{s.name}</span>
                    <Badge tone={s.stage === "delivery" ? "blue" : "brand"}>{s.stage === "delivery" ? "Giao" : "Chọn"}</Badge>
                  </p>
                  <p className="v2-row-sub">
                    {countBy.get(s.id) ?? 0} ảnh · {s.drive_url}
                  </p>
                </div>
                <a href={s.drive_url} target="_blank" rel="noopener noreferrer" className={iconBtn()} aria-label={`Mở ${s.name} trên Drive`} title="Mở trên Drive">
                  <ExternalLink size={16} />
                </a>
                <button type="button" onClick={() => void e.removeSource(s.id)} className={iconBtn()} aria-label={`Xoá nguồn ${s.name}`} title="Xoá nguồn" style={{ color: "var(--rd)" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={(ev) => void e.addSource(ev)} className="flex flex-col gap-3 rounded-[12px] p-4" style={{ background: "var(--sf2)" }}>
          <p className="text-[14px] font-semibold">Thêm nguồn ảnh</p>
          {canDelivery && (
            <Segmented<SourceStage>
              label="Loại ảnh"
              size="sm"
              value={e.newSource.stage}
              onChange={(v) => e.setNewSource({ ...e.newSource, stage: v })}
              options={[
                { value: "selection", label: "Ảnh chọn" },
                { value: "delivery", label: "Ảnh giao khách" },
              ]}
            />
          )}
          <Field label="Link Google Drive" hint={kindHint ? `Nhận ra: ${kindHint}` : "Thư mục cần chia sẻ “Bất kỳ ai có đường liên kết”."}>
            <div className="relative">
              <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
              <input
                className={inputCls}
                style={{ paddingLeft: 36 }}
                placeholder="https://drive.google.com/drive/folders/…"
                value={e.newSource.url}
                onChange={(ev) => e.setNewSource({ ...e.newSource, url: ev.target.value })}
              />
            </div>
          </Field>
          <Field label="Tên hiển thị" hint="Không bắt buộc. Album có nhiều thư mục thì tên này thành tên mục.">
            <input
              className={inputCls}
              placeholder="VD: Lễ gia tiên"
              value={e.newSource.name}
              onChange={(ev) => e.setNewSource({ ...e.newSource, name: ev.target.value })}
            />
          </Field>
          <button type="submit" disabled={!url || e.syncing} className={btn("secondary", "md", "self-start")}>
            <Plus size={16} /> Thêm và đồng bộ
          </button>
        </form>
      </div>
    </Drawer>
  );
}
