"use client";

import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════════
   TÌM ẢNH THEO KHUÔN MẶT — phần logic "GỬI MỘT ẢNH CỦA MÌNH", dùng chung cho
   khối cũ (./FaceFinder) và ngăn kéo của giao diện mới (./FaceFinderV2).

   Trình duyệt chỉ thu nhỏ ảnh còn ~800 px rồi gửi lên
   /api/album/[slug]/face-match; máy chủ nhận diện và trả về "bạn là người nào
   trong album". Không tải mô hình nào về máy khách, ảnh gửi lên không được lưu.
   Xem ghi chú đầy đủ ở ./FaceFinder.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Cạnh dài nhất của ảnh khách gửi lên. Đủ cho bộ dò, mà nhẹ cho mạng 3G. */
const UPLOAD_EDGE = 800;

export function useFaceSearch({
  slug,
  password = "",
  onPick,
}: {
  /** Slug album — để gọi đúng route so khuôn mặt. */
  slug: string;
  /** Mật khẩu album (nếu có): route so mặt đi qua đúng cánh cửa như ảnh. */
  password?: string;
  /** Tìm ra người → lọc lưới theo người đó. */
  onPick: (id: string | null) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Thu nhỏ ảnh khách chọn và vẽ lại thành JPEG trước khi gửi.
   *
   * Ba việc trong một bước, và cả ba đều cần: (a) 4 MB ảnh gốc từ điện thoại
   * xuống còn ~100 KB, (b) HEIC/PNG/WebP đều thành JPEG — máy chủ chỉ đọc JPEG,
   * (c) xoay đúng chiều, vì trình duyệt đã áp EXIF khi vẽ ảnh ra canvas.
   */
  async function toJpeg(file: File): Promise<Blob | null> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = url;
      });
      if (!img || !img.naturalWidth) return null;
      const k = Math.min(1, UPLOAD_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
      return await new Promise<Blob | null>((resolve) => cv.toBlob(resolve, "image/jpeg", 0.9));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Khách gửi một ảnh có mặt mình → hỏi máy chủ "tôi là ai trong album này". */
  async function search(file: File): Promise<boolean> {
    setNote(null);
    try {
      setBusy(t("faceLoading"));
      const jpg = await toJpeg(file);
      if (!jpg) {
        setNote(t("faceNoSupport"));
        return false;
      }
      setBusy(t("faceSearching"));
      const body = new FormData();
      body.append("file", jpg, "toi.jpg");
      if (password) body.append("password", password);
      const res = await fetch(`/api/album/${encodeURIComponent(slug)}/face-match`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        personId?: string;
        faces?: number;
        error?: string;
      };
      if (data.personId) {
        onPick(data.personId);
        // Nhiều mặt trong ảnh khách gửi thì máy chủ lấy mặt TO NHẤT. Nói ra, vì
        // nếu nó chọn nhầm người thì khách phải hiểu tại sao mà chọn lại ảnh.
        const many = (data.faces ?? 1) > 1 ? ` ${t("faceUsedBiggest")}` : "";
        setNote(`${t("faceFound")}${many}`);
        return true;
      }
      setNote(
        data.error === "khong_thay_mat"
          ? t("faceNoneInPhoto")
          : data.error === "khong_khop"
            ? t("faceNoMatch")
            : t("faceFailed")
      );
      return false;
    } catch {
      setNote(t("faceFailed"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Thuộc tính cho ô chọn file ẩn: chọn LẠI đúng file vừa rồi vẫn chạy. */
  const fileInputProps = {
    ref: fileRef,
    type: "file" as const,
    accept: "image/*",
    hidden: true,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      // Xoá giá trị để chọn LẠI đúng file vừa rồi vẫn kích hoạt onChange.
      e.target.value = "";
      if (f) void search(f);
    },
  };

  return { busy, note, setNote, fileRef, fileInputProps, search, openPicker: () => fileRef.current?.click() };
}

export type FaceSearch = ReturnType<typeof useFaceSearch>;
