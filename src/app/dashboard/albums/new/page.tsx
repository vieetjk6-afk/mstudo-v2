"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import NewAlbumV2 from "./NewAlbumV2";
import { useNewAlbum } from "./useNewAlbum";

/** Giao diện mới có bản riêng (NewAlbumV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function NewAlbumPage() {
  return useUiV2() ? <NewAlbumV2 /> : <NewAlbumPageV1 />;
}

function NewAlbumPageV1() {
  const { t, title, setTitle, loading, error, create } = useNewAlbum();

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-accent-muted hover:text-accent">
        <ArrowLeft size={15} /> {t("back")}
      </Link>
      <form onSubmit={create} className="card p-8">
        <h1 className="mb-6 text-xl font-light text-accent">{t("newAlbum")}</h1>
        <label className="label">{t("albumTitle")}</label>
        <input
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input mb-6"
          placeholder="Wedding — A & B"
        />
        {error && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button disabled={loading} className="btn-primary w-full">
          {loading ? t("saving") : t("newAlbum")}
        </button>
      </form>
    </div>
  );
}
