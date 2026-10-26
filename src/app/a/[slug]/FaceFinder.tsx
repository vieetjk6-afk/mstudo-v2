"use client";

import { useMemo, useState } from "react";
import { ScanFace, Upload, X } from "lucide-react";
import { thumbnailUrl } from "@/lib/drive";
import { faceCrop, type PersonChip } from "@/lib/face-people";
import { conDangQuet, type TienDoQuet } from "@/lib/face-pending";
import { useLang } from "@/lib/i18n";
import { useFaceSearch } from "./useFaceSearch";

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

export default function FaceFinder({
  people,
  activeId,
  onPick,
  driveIdOf,
  slug,
  password = "",
  scan = null,
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
  /**
   * Tiến độ quét của máy chủ (@/lib/face-pending), hoặc null khi không có gì
   * đang chạy — kể cả khi gói của studio không mở tính năng này.
   */
  scan?: TienDoQuet | null;
}) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  // Đường "gửi một ảnh của mình" — logic chung với ngăn kéo của giao diện mới.
  const { busy, note, setNote, fileRef, fileInputProps } = useFaceSearch({ slug, password, onPick });

  const shown = useMemo(
    () => (expanded ? people : people.slice(0, FIRST_ROW)),
    [people, expanded]
  );

  // Chưa có khuôn mặt nào. Hai trường hợp rất khác nhau và phải nói khác nhau:
  // máy chủ CÒN ĐANG QUÉT (album vừa tạo) thì hẹn khách quay lại; quét xong mà
  // không thấy mặt nào thì thôi, ẩn hẳn. Trả về `null` cho cả hai — như bản
  // trước — chính là thứ khiến studio nhìn album và kết luận "không có tính năng".
  if (people.length === 0) {
    if (!scan || !conDangQuet(scan)) return null;
    return (
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text3)" }}>
        <ScanFace size={14} style={{ color: "var(--accent)" }} />{" "}
        {t("facePreparing").replace("{n}", String(scan.daQuet)).replace("{m}", String(scan.tong))}
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
        <input {...fileInputProps} />
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
