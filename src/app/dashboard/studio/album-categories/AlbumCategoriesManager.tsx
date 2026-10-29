"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useAlbumCategories, type AlbumCategoriesProps } from "./useAlbumCategories";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const AlbumCategoriesV2 = dynamic(() => import("./AlbumCategoriesV2"));

/** Giao diện mới có bản riêng (AlbumCategoriesV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function AlbumCategoriesManager(props: AlbumCategoriesProps) {
  return useUiV2() ? <AlbumCategoriesV2 {...props} /> : <AlbumCategoriesManagerV1 {...props} />;
}

function AlbumCategoriesManagerV1(props: AlbumCategoriesProps) {
  const { cats, editing, setEditing, draft, setDraft, busy, msg, rename, remove } = useAlbumCategories(props);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/albums" className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-muted hover:text-accent">
        <ArrowLeft size={15} /> Thư viện album
      </Link>

      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium flex items-center gap-2"><Tag size={20} /> Loại album</h1>
        <p className="mt-1 text-sm text-accent-muted">
          Bộ phân loại riêng của studio bạn. Loại được tạo khi bạn đặt cho album (ở trang sửa album) và sẽ tự
          xuất hiện làm gợi ý cho các album khác. Ở đây bạn có thể đổi tên hoặc gỡ một loại.
        </p>
      </div>

      {msg && <div className="mb-4 rounded-md border border-ink-800 px-3 py-2 text-sm text-accent">{msg}</div>}

      {cats.length === 0 ? (
        <div className="card p-8 text-center text-sm text-accent-muted">
          Chưa có loại album nào. Vào một album → đặt “Loại album” để tạo loại đầu tiên.
        </div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {cats.map((c) => (
            <div key={c.slug} className="flex items-center gap-3 p-3.5">
              {editing === c.slug ? (
                <>
                  <input
                    autoFocus
                    className="input flex-1"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && rename(c)}
                  />
                  <button className="btn-primary px-3" disabled={busy} onClick={() => rename(c)} aria-label="Lưu"><Check size={15} /></button>
                  <button className="btn-ghost px-3" onClick={() => setEditing(null)} aria-label="Huỷ"><X size={15} /></button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="font-medium text-accent">{c.label}</div>
                    <div className="text-xs text-accent-muted">{c.count} album · <code>{c.slug}</code></div>
                  </div>
                  <button className="btn-ghost px-3" onClick={() => { setEditing(c.slug); setDraft(c.label); }} aria-label="Đổi tên"><Pencil size={15} /></button>
                  <button className="btn-ghost px-3" style={{ color: "#e5484d" }} disabled={busy} onClick={() => remove(c)} aria-label="Gỡ loại"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
