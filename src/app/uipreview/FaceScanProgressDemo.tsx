"use client";

import FaceFinder from "@/app/a/[slug]/FaceFinder";
import { LangProvider } from "@/lib/i18n";

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
          <p className="mb-1 font-semibold">Đang quét dở (mới được 210 / 700 ảnh)</p>
          <FaceFinder {...chung} scan={{ daQuet: 210, tong: 700 }} />
        </div>
        <div>
          <p className="mb-1 font-semibold">Vừa bắt đầu (chưa quét tấm nào)</p>
          <FaceFinder {...chung} scan={{ daQuet: 0, tong: 700 }} />
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
      </div>
    </LangProvider>
  );
}
