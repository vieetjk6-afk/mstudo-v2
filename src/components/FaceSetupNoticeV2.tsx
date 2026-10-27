"use client";

import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Callout, btn } from "@/components/v2/kit";
import { DUONG_DAN_SQL, useFaceSetupNotice } from "./useFaceSetupNotice";

/* ═══════════════════════════════════════════════════════════════════════════
   BÁO "TÌM ẢNH THEO KHUÔN MẶT CHƯA BẬT ĐƯỢC" — giao diện mới. Cùng logic với
   FaceSetupNotice (./useFaceSetupNotice): hỏi database hai bảng khuôn mặt, rồi
   biến cron. Không thiếu gì thì không hiện gì. Hình là một <Callout> amber, ba
   bước + nút Chép SQL / Kiểm tra lại nằm ngay trong khối.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FaceSetupNoticeState = ReturnType<typeof useFaceSetupNotice>;

export default function FaceSetupNoticeV2() {
  return <FaceSetupNoticeV2View s={useFaceSetupNotice()} />;
}

/** Phần hình — tách riêng để màn xem trước dựng được với dữ liệu giả. */
export function FaceSetupNoticeV2View({ s }: { s: FaceSetupNoticeState }) {
  const { missing, copied, thieuCron, duAn, chepSql, kiemTraLai } = s;
  const body = "text-[13px] leading-relaxed";

  if (missing && missing.length === 0 && thieuCron) {
    return (
      <Callout tone="amber" icon={AlertTriangle} title="Bảng đã có, nhưng máy chủ chưa quét được">
        <p className={body}>
          Vercel còn thiếu biến <b>CRON_SECRET</b>, nên app tự trả 401 cho mọi tác vụ định giờ — kể cả lượt quét khuôn
          mặt. Vào <b>Vercel → Settings → Environment Variables</b>, thêm <b>CRON_SECRET</b> với một chuỗi ngẫu nhiên dài bất
          kỳ, rồi <b>Redeploy</b>. Bộ quét tự chạy vào ban đêm (0h–7h); muốn quét ngay thì chạy tay workflow <b>Quét khuôn mặt</b> ở tab Actions trên GitHub.
        </p>
        <p className={`${body} mt-1`} style={{ color: "var(--tx3)" }}>
          Biến này cũng đang chặn cả nhắc lịch chụp, gửi Zalo và các tác vụ dọn dẹp.
        </p>
      </Callout>
    );
  }

  if (!missing || missing.length === 0) return null;

  return (
    <Callout tone="amber" icon={AlertTriangle} title="Tìm ảnh theo khuôn mặt chưa bật được">
      <p className={body}>
        Database còn thiếu bảng <b>{missing.join(", ")}</b>. Ba bước, một lần là xong:
      </p>
      <ol className={`${body} mt-1 list-decimal pl-5`}>
        <li>Bấm <b>Chép SQL</b> bên dưới — toàn bộ nội dung file vào clipboard luôn.</li>
        <li>
          {duAn.sqlEditor ? (
            <>
              Mở{" "}
              <a href={duAn.sqlEditor} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--ac)" }}>
                SQL Editor của project {duAn.ma}
              </a>{" "}
              (link này trỏ đúng project app đang dùng), dán vào, bấm <b>Run</b>.
            </>
          ) : (
            <>Mở <b>Supabase → SQL Editor → New query</b>, dán vào, bấm <b>Run</b>.</>
          )}
        </li>
        <li>Quay lại đây bấm <b>Kiểm tra lại</b>. Khối này biến mất là xong.</li>
      </ol>
      <p className={`${body} mt-1`} style={{ color: "var(--tx3)" }}>
        Chạy xong là hết việc: máy chủ tự quét khuôn mặt cho mọi album đã phát hành, studio không phải mở hay bấm gì thêm.
        Chạy lại nhiều lần vô hại.
      </p>
      {duAn.ma && (
        <p className={`${body} mt-1 font-medium`} style={{ color: "var(--am)" }}>
          Phải đúng project <b>{duAn.ma}</b>. Chạy nhầm project khác thì Supabase vẫn báo <i>Success</i> mà khối này không
          biến mất.
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void chepSql()} className={btn("secondary", "sm")}>
          {copied === "xong" ? <Check size={14} /> : <Copy size={14} />}
          {copied === "dang" ? "Đang lấy…" : copied === "xong" ? "Đã chép SQL — dán vào Supabase" : "Chép SQL"}
        </button>
        <button type="button" onClick={kiemTraLai} className={btn("ghost", "sm")}>
          <RefreshCw size={14} /> Kiểm tra lại
        </button>
        {/* Đường lùi khi clipboard bị chặn: mở SQL ra tab, Ctrl+A rồi Ctrl+C. */}
        <a href={DUONG_DAN_SQL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium underline" style={{ color: "var(--ac)" }}>
          <ExternalLink size={13} /> mở SQL trong tab mới
        </a>
      </div>
      {copied === "hong" && (
        <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: "var(--am)" }}>
          Trình duyệt không cho chép tự động. Bấm “mở SQL trong tab mới”, rồi Ctrl+A → Ctrl+C.
        </p>
      )}
    </Callout>
  );
}
