"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

/*
 * Trỏ vào GÓI RIÊNG của tính năng này, KHÔNG phải cap-nhat.sql.
 *
 * Lý do đắt giá: SQL Editor chạy cả file trong MỘT transaction. cap-nhat.sql gộp
 * 9 migration, nên một hàng rào của tính năng khác (thiếu `studio_appointments`
 * chẳng hạn) bật lên là TOÀN BỘ file rollback — kể cả hai bảng khuôn mặt vốn chỉ
 * cần `albums` và `photos`. Chuyện đó đã xảy ra thật, và người dùng thì thấy
 * "đã chạy SQL" mà bảng vẫn không có.
 */
const FILE_SQL =
  "https://github.com/vieetjk6-afk/mstudo-v2/blob/main/supabase/khuon-mat.sql";

export default function FaceSetupNotice() {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    void (async () => {
      const probes = await Promise.all(
        ["album_people", "album_faces"].map(async (t) => {
          try {
            /*
             * `limit(1)` chứ KHÔNG `head: true`.
             *
             * Với `head: true` thì PostgREST trả về một phản hồi KHÔNG CÓ THÂN,
             * nên câu lỗi về rỗng và phép nhận dạng bên dưới không khớp gì cả —
             * banner sẽ không bao giờ hiện, đúng vào lúc cần nhất. Bài kiểm ở
             * /uipreview/bao-chua-chay-sql bắt được chính điều đó. Đổi lại là
             * kéo về nhiều nhất một hàng: không đáng gì.
             */
            const { error } = await supabase.from(t).select("*").limit(1);
            if (!error) return null;
            // Thiếu BẢNG là lỗi schema; bị RLS chặn hay bảng rỗng thì không phải
            // chuyện của thông báo này. Xét CẢ mã lỗi lẫn câu chữ: 42P01 là
            // undefined_table của Postgres, PGRST205 là "không thấy bảng trong
            // schema cache" của PostgREST, và câu chữ để phòng khi mã đổi.
            const code = (error as { code?: string }).code ?? "";
            return code === "42P01" ||
              code === "PGRST205" ||
              /does not exist|schema cache/i.test(error.message ?? "")
              ? t
              : null;
          } catch {
            // Mất mạng: im lặng. Nói "chưa chạy SQL" khi thật ra là rớt mạng thì
            // lại đẩy studio đi sai hướng lần nữa.
            return null;
          }
        })
      );
      if (alive) setMissing(probes.filter((x): x is string => x !== null));
    })();
    return () => {
      alive = false;
    };
  }, []);

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
        Database còn thiếu bảng <b>{missing.join(", ")}</b>. Mở{" "}
        <a href={FILE_SQL} target="_blank" rel="noreferrer" style={{ color: "var(--ac, #0a7)", textDecoration: "underline" }}>
          supabase/khuon-mat.sql
        </a>{" "}
        → copy toàn bộ → dán vào <b>Supabase → SQL Editor</b> → Run. Một lần là xong, chạy lại nhiều lần vô hại.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(FILE_SQL).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="mt-2 flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
        style={{ background: "var(--sf, #fff)", border: "1px solid var(--bd, #ddd)" }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Đã chép link" : "Chép link file SQL"}
      </button>
    </div>
  );
}
