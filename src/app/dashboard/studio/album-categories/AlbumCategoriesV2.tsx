"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Images, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { noAccent } from "@/lib/studio-nav";
import { Badge, Empty, PageHead, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, SearchInput } from "@/components/v2/kit-client";
import { useAlbumCategories, type AlbumCategoriesProps, type Cat } from "./useAlbumCategories";

/* ═══════════════════════════════════════════════════════════════════════════
   LOẠI ALBUM — giao diện mới. Cùng logic với AlbumCategoriesManager (bản cũ,
   ./useAlbumCategories). Một danh sách gọn: mỗi loại một dòng, đổi tên ngay
   trên dòng (Enter lưu, Esc huỷ), gỡ loại trong menu ⋯. Dòng cuối chỉ cách
   thêm loại mới (loại sinh ra khi đặt cho album, không có bảng riêng).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AlbumCategoriesV2(props: AlbumCategoriesProps) {
  const c = useAlbumCategories(props);
  const [q, setQ] = useState("");
  const total = c.cats.reduce((n, x) => n + x.count, 0);
  const shown = useMemo(() => {
    const needle = noAccent(q.trim());
    return needle ? c.cats.filter((x) => noAccent(`${x.label} ${x.slug}`).includes(needle)) : c.cats;
  }, [c.cats, q]);

  return (
    <Stack className="max-w-[820px]">
      <PageHead
        desc="Bộ phân loại riêng của studio. Loại được tạo khi bạn đặt cho một album, rồi tự gợi ý cho các album sau."
        actions={
          <Link href="/dashboard/albums" className={btn("secondary")}>
            <Images size={16} /> Thư viện album
          </Link>
        }
      />

      {c.cats.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Tag}
            title="Chưa có loại album nào"
            hint="Mở một album, vào tab Cài đặt và gõ “Loại album” (VD: Cưới, Kỷ yếu). Loại đầu tiên sẽ hiện ở đây."
            action={
              <Link href="/dashboard/albums" className={btn("secondary")}>
                Chọn album để đặt loại <ArrowRight size={16} />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <div className="min-w-0 flex-1">
              <p className="v2-section-title">Loại album</p>
              <p className="v2-section-desc">
                {c.cats.length} loại · {total} album đã phân loại
              </p>
            </div>
            {c.cats.length > 6 && <SearchInput value={q} onChange={setQ} placeholder="Tìm loại…" className="w-full sm:w-[220px]" />}
          </div>

          {shown.length === 0 ? (
            <Empty compact icon={Tag} title="Không có loại nào khớp" />
          ) : (
            shown.map((cat) => (
              <CatRow
                key={cat.slug}
                cat={cat}
                editing={c.editing === cat.slug}
                draft={c.draft}
                busy={c.busy}
                onDraft={c.setDraft}
                onEdit={() => {
                  c.setEditing(cat.slug);
                  c.setDraft(cat.label);
                }}
                onCancel={() => c.setEditing(null)}
                onSave={() => void c.rename(cat)}
                onRemove={() => void c.remove(cat)}
              />
            ))
          )}

          {/* Thêm loại = đặt loại cho một album (không có bảng loại riêng). */}
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ border: "1.5px dashed var(--bdS)", color: "var(--tx3)" }}>
              <Plus size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">Thêm loại mới</p>
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Mở một album → Cài đặt → gõ tên loại mới ở ô “Loại album”.</p>
            </div>
            <Link href="/dashboard/albums" className={btn("ghost", "sm", "flex-none")}>
              Chọn album <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {c.msg && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
        >
          {c.msg}
        </div>
      )}
    </Stack>
  );
}

function CatRow({
  cat,
  editing,
  draft,
  busy,
  onDraft,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  cat: Cat;
  editing: boolean;
  draft: string;
  busy: boolean;
  onDraft: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  if (editing) {
    return (
      <div className="v2-row flex-wrap" style={{ background: "var(--acS)" }}>
        <span className="v2-section-icon"><Pencil size={15} /></span>
        <input
          autoFocus
          className={`${inputCls} min-w-0 flex-1 basis-[200px]`}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          aria-label={`Tên mới cho loại ${cat.label}`}
        />
        <div className="ml-auto flex flex-none gap-2">
          <button type="button" onClick={onCancel} className={btn("ghost", "md")}>
            <X size={16} /> Huỷ
          </button>
          <button type="button" onClick={onSave} disabled={busy || !draft.trim()} className={btn("soft", "md")}>
            <Check size={16} /> Lưu
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="v2-row">
      <span className="v2-section-icon"><Tag size={15} /></span>
      <div className="min-w-0 flex-1">
        <p className="v2-row-title">{cat.label}</p>
        <p className="v2-row-sub">
          <span className="sm:hidden">{cat.count} album · </span>
          <span className="v2-num">{cat.slug}</span>
        </p>
      </div>
      <span className="hidden sm:inline-flex">
        <Badge tone="gray">{cat.count} album</Badge>
      </span>
      <button type="button" onClick={onEdit} className={iconBtn()} aria-label={`Đổi tên ${cat.label}`} title="Đổi tên">
        <Pencil size={16} />
      </button>
      <Menu
        label={`Thao tác với loại ${cat.label}`}
        width={220}
        items={[
          { label: "Đổi tên", icon: Pencil, onClick: onEdit },
          "divider",
          { label: "Gỡ loại khỏi album", hint: `${cat.count} album, ảnh giữ nguyên`, icon: Trash2, danger: true, onClick: onRemove, disabled: busy },
        ]}
      />
    </div>
  );
}
