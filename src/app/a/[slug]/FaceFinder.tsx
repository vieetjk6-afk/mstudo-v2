"use client";

import { useMemo, useRef, useState } from "react";
import { ScanFace, Upload, X } from "lucide-react";
import { thumbnailUrl } from "@/lib/drive";
import { faceCrop, type PersonChip } from "@/lib/face-people";
import { nearestPerson } from "@/lib/face-group";
import { useLang } from "@/lib/i18n";

/**
 * TÌM ẢNH THEO KHUÔN MẶT — phía khách.
 *
 * Hai đường, và chúng có cái giá rất khác nhau:
 *
 *  1. CHỌN MỘT MẶT trong album. Studio đã quét một lần và lưu sẵn cả khuôn mặt
 *     lẫn danh sách ảnh, nên đây chỉ là tra bảng: **không tải một byte mô hình
 *     nào**, chạy được trên mọi điện thoại, bấm là ra ngay. Ảnh mặt cắt bằng CSS
 *     ngay trên thumbnail album đã tải sẵn.
 *  2. TẢI ẢNH CỦA MÌNH LÊN. Cái này bắt buộc phải có mô hình trên máy khách để
 *     biến khuôn mặt trong ảnh họ chọn thành vector — khoảng 20 MB. Nên nó CHỈ
 *     tải khi khách tự bấm, và nói rõ dung lượng trước.
 *
 * Ảnh khách chọn KHÔNG rời khỏi máy: nhận diện chạy trong trình duyệt, thứ duy
 * nhất được so là vector 128 số, và cũng chỉ so ngay tại chỗ.
 */

/** Số mặt hiện sẵn; còn lại nằm sau nút "xem thêm". */
const FIRST_ROW = 10;

export default function FaceFinder({
  people,
  activeId,
  onPick,
  driveIdOf,
}: {
  people: PersonChip[];
  activeId: string | null;
  onPick: (id: string | null) => void;
  /** id ảnh → id file Drive, để lấy thumbnail làm ảnh mặt. */
  driveIdOf: Map<string, string>;
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
   * Khách chọn một ảnh có mặt mình → tìm xem mình là ai trong album.
   *
   * Nhập mô-đun bằng `import()` động, không nhập tĩnh: hai mô-đun này kéo theo
   * đường nạp mô hình, và trang chọn ảnh phải nhẹ cho cả những khách không bao
   * giờ dùng tới chức năng này.
   */
  async function search(file: File) {
    setNote(null);
    try {
      setBusy(t("faceLoading"));
      const [{ loadFaceModel, detectFull, faceScanSupported }, { loadRecognizer, embedFace, faceEmbedSupported }] =
        await Promise.all([import("@/lib/face-detect"), import("@/lib/face-embed")]);
      if (!faceScanSupported() || !faceEmbedSupported()) {
        setNote(t("faceNoSupport"));
        return;
      }
      const [detector, recog] = await Promise.all([loadFaceModel(), loadRecognizer()]);

      setBusy(t("faceSearching"));
      const full = await detectFull(detector, { key: "up", name: file.name, file }, 0);
      if (full.metrics.faces.length === 0) {
        setNote(t("faceNoneInPhoto"));
        return;
      }
      // Nhiều mặt thì lấy mặt TO NHẤT: ảnh khách tự chọn để "tìm tôi" gần như
      // luôn là ảnh họ đứng gần máy nhất. Đoán khác đi cũng không có căn cứ nào
      // tốt hơn, nên nói thẳng ra là đã chọn mặt lớn nhất.
      let at = 0;
      for (let i = 1; i < full.metrics.faces.length; i++) {
        const a = full.metrics.faces[i].box;
        const b = full.metrics.faces[at].box;
        if (a.w * a.h > b.w * b.h) at = i;
      }
      const v = await embedFace(recog, full.canvas, full.width, full.height, full.landmarks[at]);
      if (!v) {
        setNote(t("faceNoneInPhoto"));
        return;
      }
      const hit = nearestPerson(v, people.map((p) => ({ id: p.id, descriptor: p.descriptor })));
      if (!hit) {
        setNote(t("faceNoMatch"));
        return;
      }
      onPick(hit.id);
      const many = full.metrics.faces.length > 1 ? ` ${t("faceUsedBiggest")}` : "";
      setNote(`${t("faceFound")}${many}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("faceFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (people.length === 0) return null;

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
                  // eslint-disable-next-line @next/next/no-img-element
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
