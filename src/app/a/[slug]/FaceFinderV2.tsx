"use client";

import { ScanFace, Upload, X } from "lucide-react";
import { faceCrop, type PersonChip } from "@/lib/face-people";
import { conDangQuet, type TienDoQuet } from "@/lib/face-pending";
import { useLang } from "@/lib/i18n";
import { btn } from "@/components/v2/kit";
import { Drawer } from "@/components/v2/kit-client";
import type { FaceSearch } from "./useFaceSearch";
import { useAlbumImg } from "./album-v2-ui";

/* ═══════════════════════════════════════════════════════════════════════════
   TÌM ẢNH THEO KHUÔN MẶT — giao diện mới: một ngăn kéo (điện thoại: trượt từ
   đáy lên). Cùng dữ liệu và cùng đường "gửi ảnh của bạn" với khối cũ
   ./FaceFinder (logic ở ./useFaceSearch). Dùng cho cả album chọn ảnh lẫn album
   giao khách.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Có nên hiện lối vào công cụ này không: có người, hoặc máy chủ còn đang quét. */
export function faceToolAvailable(people: PersonChip[], scan: TienDoQuet | null) {
  return people.length > 0 || (!!scan && conDangQuet(scan));
}

/** Ảnh thẻ khuôn mặt — cắt bằng CSS ngay trên thumbnail đã có. */
export function FaceAvatar({ person, driveIdOf, size = 64, ring = false }: { person: PersonChip; driveIdOf: Map<string, string>; size?: number; ring?: boolean }) {
  const img = useAlbumImg();
  const { t } = useLang();
  const crop = faceCrop(person.coverBox);
  const drive = person.coverPhotoId ? driveIdOf.get(person.coverPhotoId) : undefined;
  return (
    <span
      className="block flex-none overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--sf2)",
        outline: ring ? "2.5px solid var(--ac)" : "1px solid var(--bd)",
        outlineOffset: ring ? 2 : 0,
      }}
    >
      {drive ? (
        <img
          src={img.thumb(drive, 400)}
          alt={person.name || t("faceOnePerson")}
          loading="lazy"
          className="block w-full"
          style={
            crop
              ? { height: "auto", transform: crop.transform, transformOrigin: crop.transformOrigin }
              : // Chưa có khung mặt (album lưu từ bản trước): đành lấy cả tấm.
                { height: "100%", objectFit: "cover" }
          }
        />
      ) : null}
    </span>
  );
}

export default function FaceFinderV2({
  open,
  onClose,
  people,
  activeId,
  onPick,
  driveIdOf,
  scan,
  search,
}: {
  open: boolean;
  onClose: () => void;
  people: PersonChip[];
  activeId: string | null;
  onPick: (id: string | null) => void;
  driveIdOf: Map<string, string>;
  scan: TienDoQuet | null;
  /** Đường "gửi ảnh của bạn" — giữ ở trang (./useFaceSearch) để đóng ngăn kéo không mất kết quả. */
  search: FaceSearch;
}) {
  const { t } = useLang();
  const preparing = people.length === 0 && !!scan && conDangQuet(scan);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("faceFindTitle")}
      desc={t("faceFinderDesc")}
      width={480}
      footer={
        activeId ? (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              search.setNote(null);
              onClose();
            }}
            className={btn("secondary", "md", "w-full sm:w-auto")}
          >
            <X size={16} /> {t("faceClear")}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {preparing ? (
          <div className="flex items-start gap-3 rounded-[12px] p-3.5" style={{ background: "var(--sf2)" }}>
            <ScanFace size={20} style={{ color: "var(--ac)", flex: "none", marginTop: 1 }} />
            <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>
              {t("facePreparing").replace("{n}", String(scan!.daQuet)).replace("{m}", String(scan!.tong))}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {people.map((p) => {
              const on = activeId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick(on ? null : p.id);
                    search.setNote(null);
                    onClose();
                  }}
                  aria-pressed={on}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-[12px] py-1"
                  title={p.name || undefined}
                >
                  <FaceAvatar person={p} driveIdOf={driveIdOf} ring={on} />
                  <span className="w-full truncate text-center text-[12px] font-medium" style={{ color: on ? "var(--ac)" : "var(--tx2)" }}>
                    {p.name || `${p.photoIds.length} ${t("photos")}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {people.length > 0 && (
          <div className="flex flex-col gap-2.5 rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
            <div>
              <p className="text-[14px] font-semibold">{t("faceFindByPhoto")}</p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {t("faceUploadCost")}
              </p>
            </div>
            <button type="button" onClick={search.openPicker} disabled={!!search.busy} className={btn("secondary", "md", "self-start")}>
              <Upload size={16} /> {search.busy ?? t("faceUpload")}
            </button>
            <input {...search.fileInputProps} />
            {search.note ? (
              <p className="text-[13px] font-medium" style={{ color: "var(--tx2)" }}>
                {search.note}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Drawer>
  );
}
