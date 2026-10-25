"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { escapeHtml } from "@/lib/html-escape";
import type { StoryConfig } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Love Story (bản cũ StoryListView và bản mới
   StoryListV2): tạo trang, chép link sửa, mã QR + in. Hai bản chỉ khác nhau ở
   cách vẽ — mọi truy vấn nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StoryRow = {
  id: string; slug: string; edit_token: string; published: boolean;
  config: StoryConfig; contract_id: string | null; wish_count: number;
};

/** Prop của màn Love Story — page.tsx dựng, bản cũ và bản mới nhận y hệt. */
export type StoryListProps = { rows: StoryRow[]; ownerId: string; studioHost: string | null };

function slugify(s: string): string {
  const base = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return `${base || "love-story"}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useStoryList({ ownerId, studioHost }: Pick<StoryListProps, "ownerId" | "studioHost">) {
  const supabase = createClient();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<{ couple: string; url: string; img: string } | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500);
  }
  async function createNew() {
    setCreating(true); setErr(null);
    const editToken = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
    const { data, error } = await supabase.from("story_pages").insert({ owner_id: ownerId, slug: slugify("love-story"), edit_token: editToken, config: { wishes_enabled: true } }).select("edit_token").single();
    setCreating(false);
    if (error || !data) { setErr(error?.message || "Không tạo được trang."); return; }
    window.open(studioUrl(studioHost, `/story/sua/${data.edit_token}`), "_blank");
    router.refresh();
  }
  async function openQr(couple: string, url: string) {
    const QRCode = (await import("qrcode")).default;
    const img = await QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#a9527f", light: "#ffffff" } });
    setQr({ couple, url, img });
  }
  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=520,height=680"); if (!w) return;
    // Tên cô dâu/chú rể do KHÁCH tự nhập qua link token — phải thoát HTML, nếu
    // không cửa sổ in (cùng origin với dashboard) sẽ chạy script của khách.
    const couple = escapeHtml(qr.couple);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${couple}</title><style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#a9527f}h1{font-size:26px;margin:0 0 4px}p{color:#8c847d;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}.u{font-size:12px;word-break:break-all}</style></head><body><h1>${couple}</h1><p>Quét mã để xem Love Story</p><img alt="Mã QR trang Love Story" src="${escapeHtml(qr.img)}"/><p class="u">${escapeHtml(qr.url)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return { copied, creating, err, qr, setQr, copy, createNew, openQr, printQr };
}
