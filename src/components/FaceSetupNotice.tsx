"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
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
 * Lấy SQL từ CHÍNH APP NÀY, không phải từ GitHub.
 *
 * Bản trước chỉ đưa một link GitHub và một nút "chép link". Studio phải rời app,
 * mở GitHub, tìm nút raw, bôi đen cả file rồi mới dán được vào Supabase — và qua
 * sáu vòng trao đổi việc đó vẫn chưa xong lần nào. Nút ở đây phải đưa đúng thứ
 * họ cần dán: NỘI DUNG SQL, nằm sẵn trong clipboard.
 *
 * Vẫn là GÓI RIÊNG của tính năng này, KHÔNG phải cap-nhat.sql. Lý do đắt giá:
 * SQL Editor chạy cả file trong MỘT transaction. cap-nhat.sql gộp 9 migration,
 * nên một hàng rào của tính năng khác (thiếu `studio_appointments` chẳng hạn)
 * bật lên là TOÀN BỘ file rollback — kể cả hai bảng khuôn mặt vốn chỉ cần
 * `albums` và `photos`. Chuyện đó đã xảy ra thật, và người dùng thì thấy "đã
 * chạy SQL" mà bảng vẫn không có.
 */
const DUONG_DAN_SQL = "/api/setup-sql/khuon-mat";

export default function FaceSetupNotice() {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<"" | "dang" | "xong" | "hong">("");
  const [nhip, setNhip] = useState(0);
  /**
   * Mắt xích thứ hai, và là mắt xích VÔ HÌNH NHẤT: thiếu biến CRON_SECRET thì
   * chính app trả 401 cho cron của Vercel, nên không album nào được quét — bảng
   * đủ, code đúng, mà vẫn không có khuôn mặt nào và không có lỗi ở đâu cả.
   *
   * Kiểm RIÊNG, sau khi phần bảng đã sạch, và qua một route của máy chủ (trình
   * duyệt không thấy biến môi trường). Hỏng thì im lặng: đây là cảnh báo thêm,
   * không được phép tự nó thành một báo động giả.
   */
  const [thieuCron, setThieuCron] = useState(false);

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
    // `nhip` đổi khi bấm "Kiểm tra lại" — chạy xong SQL thì thấy ngay banner biến
    // mất, thay vì phải đoán rồi tải lại cả trang.
  }, [nhip]);

  useEffect(() => {
    // Chỉ hỏi khi phần bảng đã sạch: còn thiếu bảng thì việc phải làm đã rõ rồi,
    // thêm một cảnh báo nữa chỉ làm loãng.
    if (!missing || missing.length > 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/face-status", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { ok?: boolean; cronSecret?: boolean };
        if (alive && d.ok === true && d.cronSecret === false) setThieuCron(true);
      } catch {
        /* im lặng — xem ghi chú ở khai báo state */
      }
    })();
    return () => {
      alive = false;
    };
  }, [missing]);

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
          một chuỗi ngẫu nhiên dài bất kỳ, rồi <b>Redeploy</b>. Sau đó khoảng 5 phút là lượt quét đầu chạy.
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3, #777)" }}>
          Biến này cũng đang chặn cả nhắc lịch chụp, gửi Zalo và các tác vụ dọn dẹp.
        </p>
      </div>
    );
  }

  /** Tải nội dung SQL rồi đặt thẳng vào clipboard. */
  async function chepSql() {
    setCopied("dang");
    try {
      const res = await fetch(DUONG_DAN_SQL, { cache: "no-store" });
      const sql = await res.text();
      if (!res.ok || sql.length < 100) throw new Error("khong lay duoc");
      await navigator.clipboard.writeText(sql);
      setCopied("xong");
      setTimeout(() => setCopied(""), 3000);
    } catch {
      // Clipboard bị trình duyệt chặn là chuyện có thật (không phải HTTPS, hoặc
      // quyền bị từ chối). Nói ra và chừa sẵn đường mở tab, chứ đừng im lặng.
      setCopied("hong");
    }
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
          Mở <b>Supabase → SQL Editor → New query</b>, dán vào, bấm <b>Run</b>.
        </li>
        <li>Quay lại đây bấm <b>Kiểm tra lại</b>. Bảng này biến mất là xong.</li>
      </ol>
      {/* Nói rõ SAU ĐÓ studio không phải làm gì nữa. Bản trước còn bắt mở từng
          album cho trình duyệt quét, và đó chính là bước studio thấy thừa. */}
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx3, #777)" }}>
        Chạy xong là hết việc: máy chủ tự quét khuôn mặt cho mọi album đã phát hành, studio không phải mở
        hay bấm gì thêm. Chạy lại nhiều lần vô hại.
      </p>
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
          onClick={() => {
            setMissing(null);
            setNhip((n) => n + 1);
          }}
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
