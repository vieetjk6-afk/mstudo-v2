import type { Metadata } from "next";
import Link from "next/link";
import {
  HUONG_DAN_TAO_HOP_DONG,
  VIDEO_TAO_HOP_DONG,
  anhCuaBuoc,
  chiaDam,
  type BuocHuongDan,
} from "@/lib/huong-dan-hop-dong";

export const metadata: Metadata = {
  title: "Hướng dẫn tạo hợp đồng — mstudo",
  description:
    "Video và ảnh hướng dẫn từng bước tạo hợp đồng trong mstudo: chọn khách, chọn gói, đặt lịch và phân công, chia đợt thu, gửi khách ký.",
};

/**
 * TRANG HƯỚNG DẪN TẠO HỢP ĐỒNG.
 *
 * Ảnh và video ở đây KHÔNG vẽ tay: `npm run huong-dan:hop-dong` mở đúng màn tạo
 * hợp đồng của app rồi bấm qua 5 bước, quay lại và chụp lại (xem
 * scripts/huong-dan-tao-hop-dong.mjs). Chữ lấy từ src/lib/huong-dan-hop-dong.ts
 * — cùng nguồn với chữ in trên ảnh, nên trang và ảnh không thể nói khác nhau.
 *
 * Trang CÔNG KHAI có chủ đích: studio gửi link này cho thợ mới hoặc cộng tác
 * viên chưa có tài khoản, khỏi phải ngồi cạnh chỉ từng nút.
 */
export default function HuongDanTaoHopDongPage() {
  const [moMan, ...cacBuoc] = HUONG_DAN_TAO_HOP_DONG;

  return (
    <main
      className="mx-auto max-w-[980px] px-5 py-10 sm:px-7 sm:py-14"
      style={{ color: "var(--text)" }}
    >
      <Link href="/" className="text-[13.5px] font-semibold" style={{ color: "var(--ac)" }}>
        ← mstudo.com
      </Link>

      <h1 className="mt-5 text-[30px] font-bold leading-tight sm:text-[38px]" style={{ letterSpacing: "-.8px" }}>
        Hướng dẫn tạo hợp đồng
      </h1>
      <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed" style={{ color: "var(--text2)" }}>
        Từ lúc bấm <b>+ Hợp đồng mới</b> tới lúc khách ký điện tử: 5 bước, mỗi bước một câu hỏi. Xem video một
        lượt cho quen tay, rồi cuộn xuống xem ảnh từng bước khi cần tra lại.
      </p>

      {/* ── Video ──────────────────────────────────────────────────────────── */}
      <section className="mt-8">
        {/* `playsInline`: thiếu nó thì Safari trên iPhone nuốt luôn video vào
            trình phát toàn màn hình của hệ thống ngay khi bấm play. */}
        <video
          controls
          playsInline
          preload="metadata"
          poster={anhCuaBuoc(moMan)}
          className="w-full rounded-[16px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf2)" }}
        >
          {VIDEO_TAO_HOP_DONG.map((v) => (
            <source key={v.src} src={v.src} type={v.type} />
          ))}
          Trình duyệt không mở được video. Cuộn xuống xem ảnh từng bước bên dưới.
        </video>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: "var(--text3)" }}>
          {/* Không ghi độ dài video: mỗi lần chạy lại script là con số đổi, mà
              chẳng ai nhớ sửa dòng này theo. */}
          <span>Video quay trên chính giao diện của app · dữ liệu trong ví dụ là dữ liệu mẫu · không có tiếng.</span>
          {/* Đường tải về để gửi cho thợ qua Zalo, không phải ai cũng mở link web. */}
          <a href={VIDEO_TAO_HOP_DONG[0].src} download className="font-semibold underline" style={{ color: "var(--ac)" }}>
            Tải video về máy
          </a>
        </p>
      </section>

      {/* ── Tóm tắt 5 bước ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-[19px] font-bold">Năm bước, nhìn một lượt</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {cacBuoc.map((b, i) => (
            <li
              key={b.ten}
              className="flex items-center gap-3 rounded-[12px] px-3.5 py-3"
              style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
            >
              <span
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                {i + 1}
              </span>
              <a href={`#${b.ten}`} className="text-[14px] font-semibold">
                {b.tieuDe}
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Từng bước ──────────────────────────────────────────────────────── */}
      {HUONG_DAN_TAO_HOP_DONG.map((b) => (
        <ChiTietBuoc key={b.ten} buoc={b} />
      ))}

      {/* ── Sau khi bấm tạo ────────────────────────────────────────────────── */}
      <section className="mt-12 rounded-[16px] px-5 py-5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <h2 className="text-[19px] font-bold">Sau khi bấm “Tạo &amp; gửi khách ký”</h2>
        <ul className="mt-3 grid gap-2 text-[14px] leading-relaxed" style={{ color: "var(--text2)" }}>
          <li>App mở thẳng màn chi tiết hợp đồng, đứng sẵn ở tab <b>Ký và thực hiện</b>.</li>
          <li>Chép link cổng khách rồi gửi qua Zalo / Messenger / email. Khách mở link, nhập <b>số điện thoại của chính họ</b> để vào.</li>
          <li>Khách đọc điều khoản, ký điện tử, và thấy mã QR chuyển tiền của từng đợt thu.</li>
          <li>Hợp đồng vẫn là <b>nháp</b> cho tới khi bạn bấm gửi thật — app không tự đánh dấu “đã gửi” thay bạn.</li>
          <li>Mọi thứ nhập ở 5 bước đều sửa lại được trong màn chi tiết: hạng mục, nhân sự, đợt thu, thuê đồ, checklist hậu kỳ.</li>
        </ul>
      </section>

      <p className="mt-10 text-[12px]" style={{ color: "var(--text3)" }}>
        Ảnh và video trên trang này được chụp tự động từ giao diện thật của app, nên luôn khớp bản đang chạy.
      </p>
    </main>
  );
}

function ChiTietBuoc({ buoc }: { buoc: BuocHuongDan }) {
  return (
    <section id={buoc.ten} className="mt-12 scroll-mt-6">
      <span
        className="inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase"
        style={{ background: "var(--ac)", color: "#fff", letterSpacing: ".6px" }}
      >
        {buoc.tag}
      </span>
      <h2 className="mt-2.5 text-[23px] font-bold" style={{ letterSpacing: "-.4px" }}>
        {buoc.tieuDe}
      </h2>
      <ol className="mt-3 grid gap-1.5 pl-5 text-[14.5px] leading-relaxed" style={{ color: "var(--text2)", listStyle: "decimal" }}>
        {buoc.y.map((dong, i) => (
          <li key={i}>
            {chiaDam(dong).map((p, j) =>
              p.dam ? (
                <b key={j} style={{ color: "var(--text)" }}>
                  {p.chu}
                </b>
              ) : (
                <span key={j}>{p.chu}</span>
              )
            )}
          </li>
        ))}
      </ol>
      <img
        src={anhCuaBuoc(buoc)}
        alt={`Màn hình mstudo ở bước: ${buoc.tieuDe}`}
        loading="lazy"
        className="mt-4 w-full rounded-[14px]"
        style={{ border: "1px solid var(--bd)" }}
      />
    </section>
  );
}
