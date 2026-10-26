"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Trạng thái + thao tác của thông báo "tìm ảnh theo khuôn mặt chưa bật được" —
   dùng chung cho bản cũ (FaceSetupNotice) và bản giao diện mới
   (FaceSetupNoticeV2). Xem ghi chú đầu FaceSetupNotice.tsx. */

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
export const DUONG_DAN_SQL = "/api/setup-sql/khuon-mat";

/*
 * NHỚ THEO PHIÊN (sessionStorage) để thư viện album không hỏi lại mỗi lần mở.
 *
 *   · BANG_DU — hai bảng đã có. Chỉ nhớ khi ĐỦ: còn thiếu thì lần mở sau phải
 *     hỏi lại, studio vừa chạy SQL xong là banner biến mất ngay.
 *   · MOI_TRUONG — cronSecret / mã project / link SQL Editor. Đều đến từ biến
 *     môi trường của máy chủ, cả phiên không đổi.
 * "Kiểm tra lại" bỏ qua cả hai. Trình duyệt chặn storage → coi như chưa nhớ.
 */
const KHOA_BANG_DU = "mstudo:face-setup:bang-du";
const KHOA_MOI_TRUONG = "mstudo:face-setup:moi-truong";
type MoiTruong = { cronSecret?: boolean; duAn?: string | null; sqlEditor?: string | null };
function docNho(khoa: string): string | null {
  try {
    return sessionStorage.getItem(khoa);
  } catch {
    return null;
  }
}
function ghiNho(khoa: string, giaTri: string | null) {
  try {
    if (giaTri === null) sessionStorage.removeItem(khoa);
    else sessionStorage.setItem(khoa, giaTri);
  } catch {
    /* storage bị chặn — lần sau hỏi lại, không sao */
  }
}

export function useFaceSetupNotice() {
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
  /**
   * Project Supabase mà app ĐANG THẬT SỰ nói chuyện, cùng link mở thẳng SQL
   * Editor của nó.
   *
   * Đây là hàng rào cho kiểu hỏng đã ngốn tám vòng: trên máy studio thường còn
   * mở sẵn cả project CŨ. Chạy SQL trong tab đó thì Supabase báo "Success" đàng
   * hoàng, mà app vẫn không thấy bảng nào — không lỗi, không manh mối, và studio
   * hoàn toàn có lý khi nói "tôi chạy rồi". Bấm đúng link dưới đây thì không
   * chạy nhầm project được nữa.
   */
  const [duAn, setDuAn] = useState<{ ma: string | null; sqlEditor: string | null }>({ ma: null, sqlEditor: null });

  useEffect(() => {
    let alive = true;
    // Phiên này đã thấy đủ bảng (và không phải bấm "Kiểm tra lại") → khỏi hỏi.
    if (nhip === 0 && docNho(KHOA_BANG_DU) === "1") {
      queueMicrotask(() => {
        if (alive) setMissing([]);
      });
      return () => {
        alive = false;
      };
    }
    const supabase = createClient();
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
             * kéo về nhiều nhất một hàng: không đáng gì — và chỉ MỘT cột.
             * Cột `album_id` vì cả hai bảng đều có (album_faces KHÔNG có `id`:
             * chọn `id` ở đó là lỗi "column does not exist" và banner báo nhầm
             * là thiếu bảng).
             */
            const { error } = await supabase.from(t).select("album_id").limit(1);
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
      const thieu = probes.filter((x): x is string => x !== null);
      ghiNho(KHOA_BANG_DU, thieu.length === 0 ? "1" : null);
      if (alive) setMissing(thieu);
    })();
    return () => {
      alive = false;
    };
    // `nhip` đổi khi bấm "Kiểm tra lại" — chạy xong SQL thì thấy ngay banner biến
    // mất, thay vì phải đoán rồi tải lại cả trang.
  }, [nhip]);

  useEffect(() => {
    if (!missing) return;
    let alive = true;
    const apDung = (d: MoiTruong) => {
      if (!alive) return;
      setDuAn({ ma: d.duAn ?? null, sqlEditor: d.sqlEditor ?? null });
      // Cảnh báo cron chỉ khi phần bảng đã sạch: còn thiếu bảng thì việc phải
      // làm đã rõ rồi, thêm một cảnh báo nữa chỉ làm loãng.
      setThieuCron(missing.length === 0 && d.cronSecret === false);
    };
    void (async () => {
      const daNho = docNho(KHOA_MOI_TRUONG);
      if (daNho) {
        try {
          apDung(JSON.parse(daNho) as MoiTruong);
          return;
        } catch {
          ghiNho(KHOA_MOI_TRUONG, null);
        }
      }
      try {
        // `lite=1`: chỉ biến môi trường (cron, mã project) — KHÔNG quét ảnh /
        // khuôn mặt của mười album như bản chẩn đoán đầy đủ.
        const res = await fetch("/api/face-status?lite=1", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as MoiTruong;
        // Chỉ nhớ khi cron ĐÃ ổn: còn thiếu CRON_SECRET thì studio sẽ đặt biến,
        // Redeploy rồi tải lại trang — lúc đó phải hỏi lại để cảnh báo tự tắt.
        if (d.cronSecret !== false) {
          ghiNho(KHOA_MOI_TRUONG, JSON.stringify({ cronSecret: d.cronSecret, duAn: d.duAn ?? null, sqlEditor: d.sqlEditor ?? null }));
        }
        apDung(d);
      } catch {
        /* im lặng — xem ghi chú ở khai báo state */
      }
    })();
    return () => {
      alive = false;
    };
  }, [missing]);

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

  /** "Kiểm tra lại": bỏ mọi thứ đã nhớ trong phiên rồi hỏi database lần nữa. */
  function kiemTraLai() {
    ghiNho(KHOA_BANG_DU, null);
    ghiNho(KHOA_MOI_TRUONG, null);
    setMissing(null);
    setNhip((n) => n + 1);
  }

  return { missing, copied, thieuCron, duAn, chepSql, kiemTraLai };
}
