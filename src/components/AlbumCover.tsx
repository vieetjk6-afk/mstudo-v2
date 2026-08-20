"use client";

import { ChevronDown } from "lucide-react";
import { ALBUM_TITLE_ON_COVER } from "@/lib/album-title";

/**
 * Ảnh bìa album của khách — CHIẾM TRỌN MÀN HÌNH trên cả máy tính lẫn điện
 * thoại, tên album nằm giữa ảnh, nút "Xem album" ngay dưới tên; kéo xuống (hoặc
 * bấm nút) là tới phần nội dung.
 *
 * Vì sao 100svh chứ không phải 100vh: trên điện thoại 100vh tính CẢ thanh địa
 * chỉ của trình duyệt, nên nút bấm bị đẩy xuống dưới mép màn hình và khách
 * không thấy. svh là chiều cao thật đang nhìn thấy.
 *
 * Lớp phủ tối rất nhẹ là bắt buộc chứ không phải trang trí: ảnh bìa do studio
 * tự chọn, gặp tấm nền sáng (váy cưới, tường trắng) thì chữ trắng biến mất nếu
 * không có gì đỡ phía sau.
 */
export default function AlbumCover({
  url,
  title,
  eyebrow,
  note,
  buttonLabel,
  onView,
}: {
  url: string;
  title: string;
  /** Dòng nhỏ phía trên tên album (vd "Studio X đã chia sẻ với bạn"). */
  eyebrow?: string | null;
  /** Dòng nhỏ phía dưới tên album (vd ngày chụp). */
  note?: string | null;
  buttonLabel: string;
  onView: () => void;
}) {
  return (
    <section className="relative h-[100svh] min-h-[460px] w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      {/* Hai lớp: dải dọc cho mép trên/dưới, và một vệt tối hình bầu dục ngay
          sau khối chữ. Ảnh bìa cưới hay là nền trắng — váy, tường sáng — nếu
          chỉ có dải dọc nhạt thì chữ trắng chìm hẳn vào ảnh. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 78% 46% at 50% 48%, rgba(0,0,0,.34), rgba(0,0,0,0) 70%)," +
            "linear-gradient(to bottom, rgba(0,0,0,.34), rgba(0,0,0,.12) 30%, rgba(0,0,0,.18) 68%, rgba(0,0,0,.48))",
        }}
      />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        {eyebrow && (
          <p
            className="mb-3 text-[11.5px] uppercase tracking-[0.24em]"
            style={{ color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.75)" }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-[16ch] text-[clamp(30px,5.4vw,68px)] leading-[1.1]" style={ALBUM_TITLE_ON_COVER}>
          {title}
        </h1>
        {note && (
          <p
            className="mt-2.5 text-[13px] tracking-[0.16em]"
            style={{ color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.75)" }}
          >
            {note}
          </p>
        )}
        <button
          onClick={onView}
          className="mt-7 inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[14px] font-semibold backdrop-blur-sm transition-transform active:scale-95"
          style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.65)", color: "#fff" }}
        >
          {buttonLabel} <ChevronDown size={16} />
        </button>
      </div>
    </section>
  );
}
