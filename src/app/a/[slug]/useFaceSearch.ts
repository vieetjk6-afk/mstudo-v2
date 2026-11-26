"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import type { PersonChip } from "@/lib/face-people";
import type { TienDoTuQuet } from "@/lib/face-tu-quet";
import { reportClientError } from "@/lib/report-client-error";

/** id của "người" tổng hợp từ kết quả khách tự tìm — không trùng uuid nào. */
export const TOI_ID = "__toi";

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
  selfScan = false,
  driveIdOf,
  upsertPerson,
}: {
  /** Slug album — để gọi đúng route so khuôn mặt. */
  slug: string;
  /** Mật khẩu album (nếu có): route so mặt đi qua đúng cánh cửa như ảnh. */
  password?: string;
  /** Tìm ra người → lọc lưới theo người đó. */
  onPick: (id: string | null) => void;
  /**
   * Khách tự tìm (@/lib/face-tu-quet): không cần studio quét trước. Kết quả là
   * một "người" tổng hợp (TOI_ID) đưa vào danh sách qua `upsertPerson`; ảnh
   * chưa ai quét thì máy khách tự quét tiếp, ảnh khớp hiện dần.
   */
  selfScan?: boolean;
  /** photo_id → drive_file_id của những ảnh khách nhìn thấy (để tự quét). */
  driveIdOf?: ReadonlyMap<string, string>;
  upsertPerson?: (chip: PersonChip) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Tiến độ khách tự quét — null khi không quét. */
  const [tuQuet, setTuQuet] = useState<(TienDoTuQuet & { xong: boolean }) | null>(null);
  const huyRef = useRef<AbortController | null>(null);
  useEffect(() => () => huyRef.current?.abort(), []);

  function dungQuet() {
    huyRef.current?.abort();
    huyRef.current = null;
  }

  /** Đường khách tự tìm: kho + nhóm người của studio, rồi tự quét phần còn lại. */
  async function timTuQuet(descriptor: number[]): Promise<boolean> {
    const { timTrenKho, tuQuetAlbum } = await import("@/lib/face-tu-quet");
    setBusy(t("faceSearching"));
    const kq = await timTrenKho(slug, descriptor, password);
    if ("error" in kq) {
      setNote(t("faceFailed"));
      return false;
    }
    const thay = new Set(kq.photoIds);
    const chip = (): PersonChip => {
      const photoIds = [...thay];
      return { id: TOI_ID, name: t("faceYou"), coverPhotoId: photoIds[0] ?? null, coverBox: null, faceCount: photoIds.length, photoIds };
    };
    upsertPerson?.(chip());
    onPick(TOI_ID);
    const con = driveIdOf ? kq.chuaQuet.filter((id) => driveIdOf.has(id)) : [];
    if (con.length === 0) {
      setNote(thay.size ? t("faceSelfFoundSome").replace("{k}", String(thay.size)) : t("faceNoMatch"));
      return thay.size > 0;
    }
    setBusy(null);
    setNote(null);
    dungQuet();
    const ctrl = new AbortController();
    huyRef.current = ctrl;
    const khopTruoc = thay.size;
    setTuQuet({ daQuet: 0, tong: con.length, khop: khopTruoc, xong: false });
    void tuQuetAlbum({
      slug,
      password,
      ids: con,
      driveIdOf: driveIdOf!,
      toi: descriptor,
      signal: ctrl.signal,
      onKhop: (id) => {
        thay.add(id);
        upsertPerson?.(chip());
      },
      onTienDo: (p) => setTuQuet({ ...p, khop: khopTruoc + p.khop, xong: false }),
    })
      .then((p) => {
        setTuQuet({ ...p, khop: khopTruoc + p.khop, xong: true });
        if (thay.size === 0 && !ctrl.signal.aborted) setNote(t("faceNoMatch"));
      })
      .catch((e) => {
        setTuQuet(null);
        const lyDo = `${e instanceof Error ? e.message : String(e)}`.slice(0, 160);
        reportClientError({ name: "FaceSelfScan", message: `face-tu-quet: ${lyDo} [${navigator.userAgent.slice(0, 90)}]` });
        setNote(`${t("faceDeviceCant")} (${lyDo.slice(0, 60)})`);
      })
      .finally(() => {
        if (huyRef.current === ctrl) huyRef.current = null;
      });
    return true;
  }

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
        if (e instanceof Error && e.message === "khong_doc_duoc_anh") {
          setNote(t("faceNoSupport"));
          return false;
        }
        // Báo LÝ DO THẬT về trang Sức khoẻ (trước đây bị nuốt, không ai biết
        // máy nào hỏng ở bước nào) và hiện mã ngắn để khách / studio chụp lại.
        const nen = await embed.nenDangDung();
        const lyDo = `${e instanceof Error ? e.message : String(e)}`.slice(0, 160);
        reportClientError({ name: "FaceEmbed", message: `face: ${lyDo} [nen=${nen}] [${navigator.userAgent.slice(0, 90)}]` });
        setNote(`${t("faceDeviceCant")} (${nen}: ${lyDo.slice(0, 60)})`);
        return false;
      }
      if (!r.descriptor) {
        setNote(t("faceNoneInPhoto"));
        return false;
      }
      if (selfScan) return await timTuQuet(r.descriptor);
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

  return { busy, note, setNote, fileRef, fileInputProps, search, openPicker: () => fileRef.current?.click(), selfScan, tuQuet, dungQuet };
}

export type FaceSearch = ReturnType<typeof useFaceSearch>;
