"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { DUONG_DAN_SQL, useFaceSetupNotice } from "./useFaceSetupNotice";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const FaceSetupNoticeV2 = dynamic(() => import("./FaceSetupNoticeV2"));

/**
 * BÁO KHI TÍNH NĂNG TÌM ẢNH THEO KHUÔN MẶT CHƯA BẬT ĐƯỢC.
 *
 * Vì sao phải có, và vì sao nó phải TO và nằm ngay đầu bảng điều khiển: một
 * migration chưa chạy là thứ HOÀN TOÀN VÔ HÌNH trong app này. Bảng thiếu thì màn
 * liên quan chỉ đơn giản là trống, hoặc tệ hơn, nói sai ("chưa có ảnh nào").
 * Chủ studio không có cách nào biết, và đã mất năm vòng qua lại để đi tìm lý do
 * ở chỗ khác.
 *
 * Nên: hỏi thẳng database xem hai bảng ấy có chưa, và nếu chưa thì nói ĐÚNG việc
 * phải làm, ngay chỗ họ nhìn đầu tiên. Không có bảng nào thiếu thì không hiện gì
 * cả — đây không phải chỗ để nhắc nhở người đã làm xong.
 */

export default function FaceSetupNotice() {
  return useUiV2() ? <FaceSetupNoticeV2 /> : <FaceSetupNoticeV1 />;
}

function FaceSetupNoticeV1() {
  const { missing, copied, thieuCron, duAn, chepSql, kiemTraLai } = useFaceSetupNotice();

  if (missing && missing.length === 0 && thieuCron) {
    return (
      <div
        className="mb-4 rounded-[12px] px-4 py-3.5"
        style={{ background: "var(--amS, #fff7ed)", border: "1px solid var(--am, #c2410c)" }}
      >
        <p className="flex items-center gap-2 text-[13.5px] font-bold" style={{ color: "var(--am, #c2410c)" }}>
          <AlertTriangle size={16} /> Bảng đã có, nhưng máy chủ chưa quét được
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, #444)" }}>
          Vercel còn thiếu biến <b>CRON_SECRET</b>, nên app tự trả 401 cho mọi tác vụ định giờ — kể cả lượt
          quét khuôn mặt. Vào <b>Vercel → Settings → Environment Variables</b>, thêm <b>CRON_SECRET</b> với
          một chuỗi ngẫu nhiên dài bất kỳ, rồi <b>Redeploy</b>. Bộ quét tự chạy vào ban đêm (0h–7h); muốn quét ngay thì chạy tay workflow <b>Quét khuôn mặt</b> ở tab Actions trên GitHub.
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3, #777)" }}>
          Biến này cũng đang chặn cả nhắc lịch chụp, gửi Zalo và các tác vụ dọn dẹp.
        </p>
      </div>
    );
  }

  if (!missing || missing.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-[12px] px-4 py-3.5"
      style={{ background: "var(--amS, #fff7ed)", border: "1px solid var(--am, #c2410c)" }}
    >
      <p className="flex items-center gap-2 text-[13.5px] font-bold" style={{ color: "var(--am, #c2410c)" }}>
        <AlertTriangle size={16} /> Tìm ảnh theo khuôn mặt chưa bật được
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, #444)" }}>
        Database còn thiếu bảng <b>{missing.join(", ")}</b>. Ba bước, một lần là xong:
      </p>
      <ol className="mt-1.5 ml-4 list-decimal text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, #444)" }}>
        <li>Bấm <b>Chép SQL</b> bên dưới — toàn bộ nội dung file vào clipboard luôn.</li>
        <li>
          {duAn.sqlEditor ? (
            <>
              Mở{" "}
              <a
                href={duAn.sqlEditor}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--ac, #0a7)", textDecoration: "underline", fontWeight: 700 }}
              >
                SQL Editor của project {duAn.ma}
              </a>{" "}
              (link này trỏ đúng project app đang dùng), dán vào, bấm <b>Run</b>.
            </>
          ) : (
            <>Mở <b>Supabase → SQL Editor → New query</b>, dán vào, bấm <b>Run</b>.</>
          )}
        </li>
        <li>Quay lại đây bấm <b>Kiểm tra lại</b>. Bảng này biến mất là xong.</li>
      </ol>
      {/* Nói rõ SAU ĐÓ studio không phải làm gì nữa. Bản trước còn bắt mở từng
          album cho trình duyệt quét, và đó chính là bước studio thấy thừa. */}
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx3, #777)" }}>
        Chạy xong là hết việc: máy chủ tự quét khuôn mặt cho mọi album đã phát hành, studio không phải mở
        hay bấm gì thêm. Chạy lại nhiều lần vô hại.
      </p>
      {duAn.ma && (
        // Cái bẫy im lặng nhất sau lần chuyển project: chạy SQL trong tab project
        // CŨ thì Supabase vẫn báo Success, mà app không thấy bảng nào.
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--am, #c2410c)" }}>
          Phải đúng project <b>{duAn.ma}</b>. Chạy nhầm project khác thì Supabase vẫn báo <i>Success</i> mà
          bảng này không biến mất.
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void chepSql()}
          className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--am, #c2410c)", color: "#fff" }}
        >
          {copied === "xong" ? <Check size={13} /> : <Copy size={13} />}{" "}
          {copied === "dang" ? "Đang lấy…" : copied === "xong" ? "Đã chép SQL — dán vào Supabase" : "Chép SQL"}
        </button>
        <button
          type="button"
          onClick={kiemTraLai}
          className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--sf, #fff)", border: "1px solid var(--bd, #ddd)" }}
        >
          <RefreshCw size={13} /> Kiểm tra lại
        </button>
        {/* Đường lùi khi clipboard bị chặn: mở SQL ra tab, Ctrl+A rồi Ctrl+C.
            Route trả text/plain nên không lẫn số dòng hay tô màu vào. */}
        <a
          href={DUONG_DAN_SQL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--ac, #0a7)", textDecoration: "underline" }}
        >
          <ExternalLink size={12} /> mở SQL trong tab mới
        </a>
      </div>
      {copied === "hong" && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--am, #c2410c)" }}>
          Trình duyệt không cho chép tự động. Bấm “mở SQL trong tab mới”, rồi Ctrl+A → Ctrl+C.
        </p>
      )}
    </div>
  );
}
