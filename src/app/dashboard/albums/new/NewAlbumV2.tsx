"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FolderOpen, Plus, Send, Zap } from "lucide-react";
import { Field, PageHead, Stack, btn, inputCls } from "@/components/v2/kit";
import { useNewAlbum } from "./useNewAlbum";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM MỚI (chỉ cần tên) — giao diện mới. Cùng logic với bản cũ
   (./useNewAlbum): tạo album nháp rồi mở trang album để thêm ảnh. Sắp xếp:
   một ô tên + MỘT nút chính, nói trước hai việc tiếp theo, và lối tắt sang
   "Tạo nhanh từ Google Drive" cho ai đã có sẵn thư mục ảnh.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NewAlbumV2() {
  const { title, setTitle, loading, error, create } = useNewAlbum();
  return (
    <Stack className="mx-auto w-full max-w-[640px]">
      <Link href="/dashboard/albums" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--tx3)" }}>
        <ArrowLeft size={15} /> Thư viện album
      </Link>

      <PageHead title="Album mới" desc="Đặt tên trước, thêm ảnh và gửi khách ở bước sau." />

      <form onSubmit={create} className="v2-card">
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
          <Field label="Tên album" hint="Khách thấy tên này ở đầu trang album. Sửa lại được bất cứ lúc nào." error={error ?? undefined}>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="VD: Lan & Minh · Tiệc cưới"
            />
          </Field>
          <div className="flex flex-col gap-2.5 rounded-[12px] px-4 py-3.5" style={{ background: "var(--sf2)" }}>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>Sau khi tạo</p>
            <NextStep n={1} icon={FolderOpen}>Thêm thư mục Google Drive, ảnh tự đồng bộ về album</NextStep>
            <NextStep n={2} icon={Send}>Gửi link cho khách chọn ảnh ngay trên điện thoại</NextStep>
          </div>
        </div>
        <div className="flex justify-end px-4 py-4 sm:px-6" style={{ borderTop: "1px solid var(--bd2)" }}>
          <button disabled={loading || !title.trim()} className={btn("primary", "lg", "w-full sm:w-auto")}>
            <Plus size={17} /> {loading ? "Đang tạo…" : "Tạo album"}
          </button>
        </div>
      </form>

      <Link href="/dashboard/create" className="v2-card v2-card-link flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className="v2-section-icon"><Zap size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Đã có sẵn thư mục ảnh trên Drive?</span>
          <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>Tạo nhanh: dán link, đặt tuỳ chọn và lấy luôn link + mã QR gửi khách.</span>
        </span>
        <ArrowRight size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
      </Link>
    </Stack>
  );
}

function NextStep({ n, icon: Icon, children }: { n: number; icon: typeof Send; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--tx2)" }}>
      <span className="v2-num flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
        {n}
      </span>
      <Icon size={15} className="flex-none" style={{ color: "var(--tx3)" }} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
