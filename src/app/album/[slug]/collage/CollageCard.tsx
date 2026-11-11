"use client";

import dynamic from "next/dynamic";
import { LayoutGrid, LoaderCircle } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { PrintVerifyDialog } from "../PrintPicker";
import type { CollageEntry } from "./useCollageEntry";
import type { CollageStudioProps } from "./CollageStudio";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ "GHÉP ẢNH ĐĂNG MẠNG XÃ HỘI" trong album giao khách + lớp mở màn ghép.

   Màn ghép (CollageStudio) nặng — bộ dàn trang, màn sửa, bộ xuất ảnh — nên nạp
   CHẬM: chỉ tải khi khách bấm vào, người chỉ xem / tải ảnh không phải tải thêm
   byte nào.
   ═══════════════════════════════════════════════════════════════════════════ */

const CollageStudio = dynamic(() => import("./CollageStudio"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: "rgba(10,12,18,.55)" }}>
      <span className="flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold" style={{ background: "#fff", color: "#222" }}>
        <LoaderCircle size={17} className="animate-spin" /> Đang mở…
      </span>
    </div>
  ),
});

const TITLE = "Ghép ảnh đăng mạng xã hội";
const NOTE = "Chọn những tấm đẹp nhất, thêm lời bạn muốn viết — máy tự ghép nhiều layout để đăng Facebook, Instagram, Story. Sửa từng layout theo ý rồi tải về.";
const NOTE_VERIFY = " Cô dâu, chú rể xác nhận số điện thoại đã đăng ký với studio để dùng.";

/** Thẻ giao diện mới (GalleryViewV2). */
export function CollageCardV2({ entry }: { entry: CollageEntry }) {
  if (!entry.enabled) return null;
  return (
    <div className="v2-card v2-card-pad flex flex-wrap items-center gap-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: "var(--acS)", color: "var(--ac)" }}>
        <LayoutGrid size={20} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14.5px] font-semibold">{TITLE}</p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          {NOTE}
          {entry.verified ? "" : NOTE_VERIFY}
        </p>
      </div>
      <button type="button" onClick={entry.open} className={btn("soft", "md", "w-full sm:w-auto")}>
        <LayoutGrid size={16} /> Ghép ảnh
      </button>
    </div>
  );
}

/** Thẻ giao diện cũ (GalleryView). */
export function CollageCardV1({ entry }: { entry: CollageEntry }) {
  if (!entry.enabled) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)" }}>
        <LayoutGrid size={19} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14.5px] font-semibold">{TITLE}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
          {NOTE}
          {entry.verified ? "" : NOTE_VERIFY}
        </p>
      </div>
      <button type="button" onClick={entry.open} className="btn-primary px-4 py-2 text-[13px]">
        <LayoutGrid size={15} /> Ghép ảnh
      </button>
    </div>
  );
}

/**
 * Hộp xác nhận SĐT (cùng hộp với ảnh in) + màn ghép khi đang mở. Đặt một lần ở
 * cuối trang album.
 */
export function CollageLayer({ entry, ...studio }: { entry: CollageEntry } & Omit<CollageStudioProps, "coupleKey" | "onClose" | "onNeedVerify">) {
  if (!entry.enabled) return null;
  return (
    <>
      <PrintVerifyDialog
        pp={entry}
        Icon={LayoutGrid}
        title="Ghép ảnh — dành cho cô dâu, chú rể"
        desc="Nhập số điện thoại của cô dâu hoặc chú rể đã đăng ký với studio để ghép ảnh từ album của bạn."
      />
      {entry.studioOpen && <CollageStudio {...studio} coupleKey={entry.key} onClose={entry.close} onNeedVerify={entry.needVerify} />}
    </>
  );
}
