"use client";

import { useMemo, useRef, useState } from "react";
import { ScanFace, Upload, X } from "lucide-react";
import { thumbnailUrl } from "@/lib/drive";
import { faceCrop, type PersonChip } from "@/lib/face-people";
import { useLang } from "@/lib/i18n";

/**
 * TÌM ẢNH THEO KHUÔN MẶT — phía khách.
 *
 * Hai đường, và cả hai đều KHÔNG tải mô hình về máy khách:
 *
 *  1. CHỌN MỘT MẶT trong album. Máy chủ đã quét sẵn và lưu cả khuôn mặt lẫn danh
 *     sách ảnh, nên đây chỉ là tra bảng — bấm là ra ngay. Ảnh mặt cắt bằng CSS
 *     ngay trên thumbnail album đã tải sẵn, không thêm một byte tải nào.
 *  2. GỬI MỘT ẢNH CỦA MÌNH. Trình duyệt chỉ thu nhỏ ảnh còn ~800 px rồi gửi lên
 *     /api/album/[slug]/face-match; máy chủ nhận diện và trả về "bạn là người
 *     nào trong album".
 *
 * VÌ SAO ĐƯỜNG 2 KHÔNG CÒN CHẠY TRONG TRÌNH DUYỆT NHƯ TRƯỚC. Bản trước tải ~20 MB
 * mô hình về máy khách để ảnh không phải rời khỏi máy. Từ khi việc quét album
 * chuyển hẳn lên máy chủ, hai bên căn khuôn mặt theo hai cách khác nhau, nên
 * vector sinh ở trình duyệt không so được với vector trong album — cùng một
 * người vẫn ra "không tìm thấy". Đổi lại khách được nhiều hơn: không tải gì cả,
 * chạy được trên điện thoại yếu. Ảnh gửi lên KHÔNG được lưu ở đâu.
 */

/** Số mặt hiện sẵn; còn lại nằm sau nút "xem thêm". */
const FIRST_ROW = 10;

/** Cạnh dài nhất của ảnh khách gửi lên. Đủ cho bộ dò, mà nhẹ cho mạng 3G. */
const UPLOAD_EDGE = 800;

export default function FaceFinder({
  people,
  activeId,
  onPick,
  driveIdOf,
  slug,
  password = "",
  preparing = false,
}: {
  people: PersonChip[];
  activeId: string | null;
  onPick: (id: string | null) => void;
  /** id ảnh → id file Drive, để lấy thumbnail làm ảnh mặt. */
  driveIdOf: Map<string, string>;
  /** Slug album — để gọi đúng route so khuôn mặt. */
  slug: string;
  /** Mật khẩu album (nếu có): route so mặt đi qua đúng cánh cửa như ảnh. */
  password?: string;
  /** Máy chủ còn đang quét album này — nói ra thay vì hiện một khoảng trống. */
  preparing?: boolean;
}) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(
    () => (expanded ? people : people.slice(0, FIRST_ROW)),
    [people, expanded]
  );

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
  async function search(file: File) {
    setNote(null);
    try {
      setBusy(t("faceLoading"));
      const jpg = await toJpeg(file);
      if (!jpg) {
        setNote(t("faceNoSupport"));
        return;
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
        return;
      }
      setNote(
        data.error === "khong_thay_mat"
          ? t("faceNoneInPhoto")
          : data.error === "khong_khop"
            ? t("faceNoMatch")
            : t("faceFailed")
      );
    } catch {
      setNote(t("faceFailed"));
    } finally {
      setBusy(null);
    }
  }

  // Chưa có khuôn mặt nào. Hai trường hợp rất khác nhau và phải nói khác nhau:
  // máy chủ CÒN ĐANG QUÉT (album vừa tạo) thì hẹn khách quay lại; quét xong mà
  // không thấy mặt nào thì thôi, ẩn hẳn. Trả về `null` cho cả hai — như bản
  // trước — chính là thứ khiến studio nhìn album và kết luận "không có tính năng".
  if (people.length === 0) {
    if (!preparing) return null;
    return (
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text3)" }}>
        <ScanFace size={14} style={{ color: "var(--accent)" }} /> {t("facePreparing")}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <ScanFace size={15} style={{ color: "var(--accent)" }} /> {t("faceFindTitle")}
        </span>
        {activeId && (
          <button
            onClick={() => {
              onPick(null);
              setNote(null);
            }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
          >
            <X size={12} /> {t("faceClear")}
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {shown.map((p) => {
          const on = activeId === p.id;
          const crop = faceCrop(p.coverBox);
          const drive = p.coverPhotoId ? driveIdOf.get(p.coverPhotoId) : undefined;
          return (
            <button
              key={p.id}
              onClick={() => {
                onPick(on ? null : p.id);
                setNote(null);
              }}
              className="w-[74px] text-center"
              title={p.name || undefined}
            >
              <span
                className="mx-auto block h-[64px] w-[64px] overflow-hidden rounded-full"
                style={{
                  background: "var(--surface2)",
                  outline: on ? "2.5px solid var(--accent)" : "1px solid var(--border)",
                  outlineOffset: on ? 2 : 0,
                }}
              >
                {drive ? (
                  <img
                    src={thumbnailUrl(drive, 400)}
                    alt={p.name || t("faceOnePerson")}
                    loading="lazy"
                    className="block w-full"
                    style={
                      crop
                        ? { height: "auto", transform: crop.transform, transformOrigin: crop.transformOrigin }
                        : // Chưa có khung mặt (album lưu từ bản trước): đành lấy cả
                          // tấm. Vẫn hơn là bỏ trống, chỉ là khó nhận ra hơn.
                          { height: "100%", objectFit: "cover" }
                    }
                  />
                ) : null}
              </span>
              <span
                className="mt-1 block truncate text-[11.5px]"
                style={{ color: on ? "var(--accent)" : "var(--text3)" }}
              >
                {p.name || `${p.photoIds.length} ${t("photos")}`}
              </span>
            </button>
          );
        })}

        {!expanded && people.length > FIRST_ROW && (
          <button
            onClick={() => setExpanded(true)}
            className="h-[64px] w-[74px] rounded-full text-[11.5px]"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--text2)" }}
          >
            +{people.length - FIRST_ROW}
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] disabled:opacity-60"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
        >
          <Upload size={13} /> {busy ?? t("faceUpload")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Xoá giá trị để chọn LẠI đúng file vừa rồi vẫn kích hoạt onChange.
            e.target.value = "";
            if (f) void search(f);
          }}
        />
        <span className="text-[11.5px]" style={{ color: "var(--text3)" }}>
          {t("faceUploadCost")}
        </span>
      </div>

      {note && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--text2)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
