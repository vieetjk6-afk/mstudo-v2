"use client";

import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════════
   TÌM ẢNH THEO KHUÔN MẶT — phần logic "TÌM BẰNG MỘT ẢNH CỦA MÌNH", dùng chung
   cho khối cũ (./FaceFinder) và ngăn kéo của giao diện mới (./FaceFinderV2).

   Ảnh được nhận diện NGAY TRÊN MÁY KHÁCH (@/lib/face-embed-browser — cùng ba
   mạng với dữ liệu album nên vector so được), và thứ duy nhất gửi lên
   /api/album/[slug]/face-match là 128 con số. Ảnh không rời khỏi máy. Cái giá:
   lần đầu bấm phải tải mô hình (~13 MB, sau đó nằm trong cache) — nên mô hình
   CHỈ tải khi khách bấm nút, và màn hình nói trước con số đó.
   ═══════════════════════════════════════════════════════════════════════════ */

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

  /** Khách chọn một ảnh có mặt mình → nhận diện tại chỗ → hỏi "tôi là ai trong album". */
  async function search(file: File): Promise<boolean> {
    setNote(null);
    try {
      setBusy(t("faceModelLoading").replace("{p}", "0"));
      // Nạp động: mô hình + thư viện chỉ về máy khi khách thật sự bấm tìm.
      const embed = await import("@/lib/face-embed-browser");
      if (!embed.faceEmbedSupported()) {
        setNote(t("faceDeviceCant"));
        return false;
      }
      let r: { descriptor: number[] | null; soMat: number };
      try {
        r = await embed.vectorAnhKhach(file, {
          onProgress: (p) => setBusy(p.buoc === "xong" ? t("faceLoading") : t("faceModelLoading").replace("{p}", String(p.phanTram))),
        });
      } catch (e) {
        // Ảnh không đọc được là lỗi của tấm ảnh; mọi thứ khác là máy không chạy
        // nổi mô hình (hết bộ nhớ, mất mạng lúc tải) — chỉ sang hàng khuôn mặt.
        setNote(e instanceof Error && e.message === "khong_doc_duoc_anh" ? t("faceNoSupport") : t("faceDeviceCant"));
        return false;
      }
      if (!r.descriptor) {
        setNote(t("faceNoneInPhoto"));
        return false;
      }
      setBusy(t("faceSearching"));
      const res = await fetch(`/api/album/${encodeURIComponent(slug)}/face-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor: r.descriptor, faces: r.soMat, password: password || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { personId?: string; faces?: number; error?: string };
      if (data.personId) {
        onPick(data.personId);
        // Nhiều mặt trong ảnh thì lấy mặt TO NHẤT. Nói ra, vì nếu chọn nhầm
        // người thì khách phải hiểu tại sao mà chọn lại ảnh.
        const many = (data.faces ?? 1) > 1 ? ` ${t("faceUsedBiggest")}` : "";
        setNote(`${t("faceFound")}${many}`);
        return true;
      }
      setNote(data.error === "khong_khop" ? t("faceNoMatch") : t("faceFailed"));
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
