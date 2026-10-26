"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Copy, Check, ExternalLink, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { storyEditMessage } from "@/lib/share-messages";
import MessengerButton from "@/components/MessengerButton";
import type { StoryConfig } from "@/lib/types";

function slugify(s: string): string {
  const base = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return `${base || "love-story"}-${Math.random().toString(36).slice(2, 7)}`;
}

type Existing = { slug: string; edit_token: string; published: boolean } | null;

/** Studio-side card on a contract: create the Love Story page & share its link. */
export default function LoveStoryCard({
  contract, clientName, clientMessenger, studioHost, comingSoon = false,
}: {
  contract: { id: string; owner_id: string; title: string; event_date: string | null; location: string | null };
  clientName: string;
  clientMessenger: string;
  studioHost: string | null;
  comingSoon?: boolean;
}) {
  const supabase = createClient();
  const [row, setRow] = useState<Existing>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<"edit" | "view" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("story_pages").select("slug, edit_token, published").eq("contract_id", contract.id).maybeSingle();
      setRow((data as Existing) ?? null);
      setLoading(false);
    })().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.id]);

  async function create() {
    setCreating(true); setErr(null);
    const config: StoryConfig = {
      wishes_enabled: true,
      event_date: contract.event_date ?? undefined,
      event_venue: contract.location ?? undefined,
      event_label: "Lễ Thành Hôn",
    };
    const { data, error } = await supabase.from("story_pages").insert({
      owner_id: contract.owner_id, contract_id: contract.id,
      slug: slugify(clientName || contract.title),
      edit_token: (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, ""),
      config,
    }).select("slug, edit_token, published").single();
    setCreating(false);
    if (error || !data) { setErr(error?.message || "Không tạo được trang."); return; }
    setRow(data as Existing);
  }

  if (comingSoon) return (
    <div className="card mb-6 p-4" style={{ opacity: 0.85 }}>
      <div className="flex flex-wrap items-center gap-3">
        <Clapperboard size={16} style={{ color: "#d0687a" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>💞 Trang Love Story tặng khách</p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Tính năng đang được hoàn thiện, sẽ sớm có mặt.</p>
        </div>
        <span className="rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--brand)", background: "var(--brandSoft)" }}>Sắp ra mắt</span>
      </div>
    </div>
  );

  if (loading) return null;
  const editUrl = row ? studioUrl(studioHost, `/story/sua/${row.edit_token}`) : "";
  const viewUrl = row ? studioUrl(studioHost, `/story/${row.slug}`) : "";
  function copy(text: string, key: "edit" | "view") { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); }

  return (
    <div className="card mb-6 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Clapperboard size={16} style={{ color: "#d0687a" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>💞 Trang Love Story tặng khách</p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            {row ? "Gửi link để khách tự điền nội dung & dán folder ảnh/video Google Drive của họ." : "Tạo trang chia sẻ khoảnh khắc — ảnh/video lấy từ Drive của khách, kèm sổ lời chúc."}
          </p>
        </div>
        {!row && (
          <button onClick={create} disabled={creating} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />} Tạo Love Story
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

      {row && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <Pencil size={13} style={{ color: "var(--text3)" }} />
            <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text2)" }}>{editUrl}</span>
            <MessengerButton link={clientMessenger} label="Gửi khách sửa" message={storyEditMessage(editUrl)} />
            <button onClick={() => copy(storyEditMessage(editUrl), "edit")} className="btn-ghost px-2.5 py-1.5 text-xs">{copied === "edit" ? <Check size={13} /> : <Copy size={13} />} {copied === "edit" ? "Đã chép lời nhắn" : "Chép link sửa kèm lời nhắn"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExternalLink size={13} style={{ color: "var(--text3)" }} />
            <a href={viewUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm underline" style={{ color: "var(--text2)" }}>{viewUrl}</a>
            <span className="text-[11px]" style={{ color: row.published ? "#7bb38a" : "var(--text3)" }}>{row.published ? "Đang hiển thị" : "Chưa xuất bản"}</span>
            <button onClick={() => copy(viewUrl, "view")} className="btn-ghost px-2.5 py-1.5 text-xs">{copied === "view" ? <Check size={13} /> : <Copy size={13} />} {copied === "view" ? "Đã chép" : "Chép link xem"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
