"use client";

import { useEffect } from "react";
import FaceFinder from "@/app/a/[slug]/FaceFinder";
import { LangProvider, useLang } from "@/lib/i18n";
import { FaceScanCardView } from "@/app/dashboard/albums/[id]/FaceScanCardV2";
import type { FaceScanView } from "@/app/dashboard/albums/[id]/useFaceLocalScan";

/**
 * ALBUM ĐANG QUÉT DỞ — câu chữ mà khách đọc khi chưa có khuôn mặt nào.
 *
 * Đây là trạng thái ĐẮT NHẤT để mở bằng tay: phải có một album thật với vài trăm
 * ảnh, quét được đúng một phần, rồi mở trang khách trước khi cron quét xong. Nên
 * trước đây không ai nhìn thấy nó, và nó đã sai suốt: câu cũ hứa "vài phút nữa
 * bạn quay lại nhé" cho một việc mất hàng giờ. Khách quay lại sau năm phút, đọc
 * lại đúng câu đó, và kết luận tính năng hỏng — trong khi bộ quét chạy đúng.
 *
 * Hai điều màn này để canh:
 *   1. Con số hiện ra THẬT (210/700), không phải chữ "{n}/{m}" lọt ra ngoài.
 *   2. Quét xong mà album không có mặt người thì khối này BIẾN MẤT HẲN, không
 *      để lại một lời hẹn treo mãi.
 */
export default function FaceScanProgressDemo() {
  /*
   * CỬA KIỂM THỬ cho desktop/test/face-embed-browser.mjs: đưa bộ nhận diện của
   * trình duyệt ra `window` để Playwright cho nó chạy trên ảnh mẫu rồi so vector
   * với bộ quét máy chủ. Nạp động — màn xem trước này không tải mô hình nào cho
   * tới khi bài kiểm thử gọi.
   */
  useEffect(() => {
    (window as unknown as { __faceEmbed?: unknown }).__faceEmbed = () => import("@/lib/face-embed-browser");
  }, []);
  const chung = {
    people: [],
    activeId: null,
    onPick: () => {},
    driveIdOf: new Map<string, string>(),
    slug: "xem-truoc",
  };
  return (
    <LangProvider>
      <div className="mx-auto max-w-[560px] space-y-6 text-[13px]">
        <div>
          <p className="mb-1 font-semibold">Studio đang quét dở trên máy mình (210 / 700 ảnh)</p>
          <FaceFinder {...chung} scan={{ daQuet: 210, tong: 700 }} />
        </div>
        <div>
          <p className="mb-1 font-semibold">Máy chủ tự quét ban đêm (FACE_SERVER_SCAN=1), mới 210 / 700</p>
          <FaceFinder {...chung} scan={{ daQuet: 210, tong: 700, mayChu: true }} />
        </div>
        <div>
          <p className="mb-1 font-semibold">Chưa ai bắt đầu quét (máy chủ không tự quét)</p>
          <FaceFinder {...chung} scan={null} />
          <p style={{ color: "var(--tx3)" }}>↑ phải trống hoàn toàn — không hứa một lượt quét không ai chạy</p>
        </div>
        <div>
          <p className="mb-1 font-semibold">Quét xong, album không có mặt người</p>
          <FaceFinder {...chung} scan={{ daQuet: 700, tong: 700 }} />
          <p style={{ color: "var(--tx3)" }}>↑ phải trống hoàn toàn</p>
        </div>
        <div>
          <p className="mb-1 font-semibold">Gói không có tính năng</p>
          <FaceFinder {...chung} scan={null} />
          <p style={{ color: "var(--tx3)" }}>↑ phải trống hoàn toàn</p>
        </div>
        <SelfieCopy />
      </div>
    </LangProvider>
  );
}

/** Câu chữ của đường "tìm bằng ảnh của bạn" ở từng bước — để soát bằng mắt. */
function SelfieCopy() {
  const { t } = useLang();
  const dong = [
    ["Trước khi bấm", t("faceUploadCost")],
    ["Đang tải mô hình", t("faceModelLoading").replace("{p}", "42")],
    ["Đang nhận diện", t("faceLoading")],
    ["Đang so", t("faceSearching")],
    ["Tìm thấy", `${t("faceFound")} ${t("faceUsedBiggest")}`],
    ["Ảnh không có mặt", t("faceNoneInPhoto")],
    ["Không khớp ai", t("faceNoMatch")],
    ["Máy không chạy nổi", t("faceDeviceCant")],
  ];
  return (
    <div>
      <p className="mb-1 font-semibold">Khách tìm bằng ảnh của mình — câu chữ từng bước</p>
      <ul className="space-y-1" data-testid="selfie-copy">
        {dong.map(([k, v]) => (
          <li key={k}>
            <span style={{ color: "var(--tx3)" }}>{k}:</span> {v}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Thẻ "Tìm theo khuôn mặt" của studio ở mọi trạng thái (dữ liệu giả). */
export function FaceScanCardStatesDemo() {
  const goc: FaceScanView = { phase: "nghi", status: { tong: 700, daQuet: 0, conLai: 700, nguoi: 0, mayChuQuet: false }, napPct: 0, dang: null, hongTam: 0, loi: null, backend: null };
  const st = (daQuet: number, nguoi: number, mayChuQuet = false) => ({ tong: 700, daQuet, conLai: 700 - daQuet, nguoi, mayChuQuet });
  const ds: [string, FaceScanView][] = [
    ["Chưa quét", goc],
    ["Đang tải bộ nhận diện", { ...goc, phase: "nap", napPct: 42 }],
    ["Đang quét 210 / 700", { ...goc, phase: "quet", status: st(210, 0), dang: "DSC_4470.JPG", hongTam: 2, backend: "webgl" }],
    ["Tạm dừng", { ...goc, phase: "dung", status: st(210, 9) }],
    ["Dừng vì lỗi", { ...goc, phase: "dung", status: st(210, 0), loi: "Không tải được ảnh từ Drive (http-403). Kiểm tra mạng / quyền chia sẻ thư mục rồi bấm quét tiếp." }],
    ["Đang gom", { ...goc, phase: "gom", status: st(700, 9) }],
    ["Xong, 23 người", { ...goc, status: st(700, 23) }],
    ["Máy chủ cũng tự quét (FACE_SERVER_SCAN=1)", { ...goc, status: st(210, 9, true) }],
    ["Gói không có tính năng", { ...goc, phase: "khoa-goi", status: null }],
    ["Chưa chạy SQL", { ...goc, phase: "thieu-bang", status: null }],
  ];
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5 p-4">
      {ds.map(([ten, v]) => (
        <div key={ten}>
          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{ten}</p>
          <FaceScanCardView v={v} onStart={() => {}} onPause={() => {}} />
        </div>
      ))}
    </div>
  );
}
