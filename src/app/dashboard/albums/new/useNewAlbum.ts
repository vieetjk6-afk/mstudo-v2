"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

/* Phần LOGIC dùng chung của trang "Album mới" chỉ cần tên (bản cũ page.tsx và
   bản mới NewAlbumV2): tạo album nháp rồi mở trang album để thêm ảnh. */

function slugify(s: string) {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "album"}-${suffix}`;
}

export function useNewAlbum() {
  const { t } = useLang();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("albums")
      .insert({ owner_id: user.id, title, slug: slugify(title) })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? t("error"));
      setLoading(false);
      return;
    }
    router.push(`/dashboard/albums/${data.id}`);
  }

  return { t, title, setTitle, loading, error, create };
}
