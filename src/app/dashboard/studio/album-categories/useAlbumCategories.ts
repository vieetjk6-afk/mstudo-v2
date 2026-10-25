"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugifyVi } from "@/lib/category";

/* Phần LOGIC dùng chung của màn "Loại album" (bản cũ AlbumCategoriesManager
   và bản mới AlbumCategoriesV2): đổi tên một loại (gộp nếu trùng), gỡ loại
   khỏi mọi album của studio. Loại album không có bảng riêng — nó sinh ra từ
   cột category của album, nên "thêm loại" là đặt loại cho một album. */

export type Cat = { slug: string; label: string; count: number };
export type AlbumCategoriesProps = { ownerId: string; initial: Cat[] };

export function useAlbumCategories({ ownerId, initial }: AlbumCategoriesProps) {
  const supabase = createClient();
  const [cats, setCats] = useState<Cat[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  async function rename(cat: Cat) {
    const label = draft.trim();
    if (!label) return;
    const newSlug = slugifyVi(label) || cat.slug;
    setBusy(true);
    const { error } = await supabase
      .from("albums")
      .update({ category: newSlug, category_label: label })
      .eq("owner_id", ownerId)
      .eq("category", cat.slug);
    setBusy(false);
    if (error) return flash(error.message);
    // Gộp nếu slug mới trùng loại đã có.
    setCats((prev) => {
      const others = prev.filter((c) => c.slug !== cat.slug);
      const merged = others.find((c) => c.slug === newSlug);
      if (merged) {
        return others.map((c) => (c.slug === newSlug ? { ...c, label, count: c.count + cat.count } : c));
      }
      return [...others, { slug: newSlug, label, count: cat.count }].sort((a, b) => b.count - a.count);
    });
    setEditing(null);
    flash("Đã lưu");
  }

  async function remove(cat: Cat) {
    if (!confirm(`Bỏ loại "${cat.label}" khỏi ${cat.count} album? (Album vẫn giữ nguyên, chỉ gỡ phân loại.)`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("albums")
      .update({ category: null, category_label: null })
      .eq("owner_id", ownerId)
      .eq("category", cat.slug);
    setBusy(false);
    if (error) return flash(error.message);
    setCats((prev) => prev.filter((c) => c.slug !== cat.slug));
    flash("Đã gỡ loại");
  }

  return { cats, editing, setEditing, draft, setDraft, busy, msg, rename, remove };
}
