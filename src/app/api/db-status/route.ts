import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maDuAn } from "@/lib/supabase-du-an";
import { phanLoaiLoi } from "@/lib/pg-loi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * DATABASE ĐANG CHẠY CÒN THIẾU MIGRATION NÀO?
 *
 * Vì sao route này tồn tại. Suốt một tuần, mọi migration được dán vào SQL Editor
 * của một project KHÁC với project app đang dùng. Supabase báo Success từng lần,
 * app thì thiếu bảng, và không ai biết database thật đang thiếu những gì — vì
 * ngoài app ra không có gì đọc được nó. Bảng báo ở bảng điều khiển chỉ soi đúng
 * hai bảng của tính năng khuôn mặt; câu hỏi thật rộng hơn thế nhiều.
 *
 * Bản kê `supabase/kiem-tra.json` do build-setup-all.mjs sinh ra: mỗi migration
 * khai những bảng nó tạo và những cột nó thêm. Ở đây ta hỏi thẳng database đang
 * chạy từng thứ, rồi trả lời bằng danh sách chính xác cái gì còn thiếu.
 *
 * MỘT LƯỢT GỌI CHO MỖI BẢNG, không phải mỗi cột. Chọn hết các cột cần kiểm
 * trong cùng một câu `select`: bảng không có thì PostgREST trả 42P01, cột không
 * có thì trả 42703 kèm ĐÚNG TÊN cột thiếu. 96 bảng thay vì 355 lượt.
 */

type Muc = { file: string; mo_ta: string; bang: string[]; cot: string[] };
type BanKe = { capNhat: string[]; muc: Muc[] };

/** Số câu hỏi chạy song song. Đủ nhanh mà không đấm vào giới hạn của PostgREST. */
const SONG_SONG = 8;

async function chayTheoLo<T, R>(list: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += n) {
    out.push(...(await Promise.all(list.slice(i, i + n).map(fn))));
  }
  return out;
}

type KetQua = { bang: string; thieuBang: boolean; thieuCot: string[]; loiKhac: string | null };

function moTaLoi(e: { code?: string; message?: string }): string {
  return `${e.code ?? ""} ${e.message ?? ""}`.trim();
}


export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ke: BanKe;
  try {
    ke = JSON.parse(await readFile(join(process.cwd(), "supabase", "kiem-tra.json"), "utf8")) as BanKe;
  } catch (e) {
    return NextResponse.json(
      { error: "thieu_ban_ke", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  // Gom theo BẢNG: một bảng có thể được nhiều migration đụng tới (tạo ở file
  // này, thêm cột ở file kia), và hỏi trùng là tốn lượt gọi vô ích.
  const cotCuaBang = new Map<string, Set<string>>();
  for (const m of ke.muc) {
    for (const b of m.bang) if (!cotCuaBang.has(b)) cotCuaBang.set(b, new Set());
    for (const c of m.cot) {
      const [b, cot] = c.split(".");
      if (!cotCuaBang.has(b)) cotCuaBang.set(b, new Set());
      cotCuaBang.get(b)!.add(cot);
    }
  }

  const db = createAdminClient();
  const ketQua = await chayTheoLo([...cotCuaBang.entries()], SONG_SONG, async ([bang, cot]): Promise<KetQua> => {
    // Chọn cả `id` để câu select không rỗng khi bảng chẳng có cột nào cần kiểm.
    const chon = cot.size ? [...cot].join(",") : "*";
    const { error } = await db.from(bang).select(chon).limit(1);
    if (!error) return { bang, thieuBang: false, thieuCot: [], loiKhac: null };

    const loai = phanLoaiLoi(error);
    if (loai === "thieu-bang") return { bang, thieuBang: true, thieuCot: [], loiKhac: null };
    if (loai !== "thieu-cot") {
      return { bang, thieuBang: false, thieuCot: [], loiKhac: moTaLoi(error) };
    }
    /*
     * Hỏi lại TỪNG CỘT một.
     *
     * Câu gộp chỉ nêu được cột ĐẦU TIÊN nó vấp phải, nên báo cáo sẽ nói "thiếu
     * một cột" trong khi thực tế thiếu năm — và studio chạy migration xong vẫn
     * thấy đỏ, không hiểu tại sao. Chỉ những bảng thật sự có vấn đề mới phải trả
     * giá thêm mấy lượt gọi này.
     */
    const thieu: string[] = [];
    for (const c of cot) {
      const { error: e } = await db.from(bang).select(c).limit(1);
      if (e && phanLoaiLoi(e) === "thieu-cot") thieu.push(c);
    }
    return { bang, thieuBang: false, thieuCot: thieu, loiKhac: null };
  });

  const theoBang = new Map(ketQua.map((r) => [r.bang, r]));
  const muc = ke.muc.map((m) => {
    const thieuBang = m.bang.filter((b) => theoBang.get(b)?.thieuBang);
    const thieuCot = m.cot.filter((c) => {
      const [b, cot] = c.split(".");
      const r = theoBang.get(b);
      // Bảng thiếu hẳn thì cột của nó không kể riêng nữa — nói một lần là đủ.
      return r && !r.thieuBang && r.thieuCot.includes(cot);
    });
    return { file: m.file, moTa: m.mo_ta, thieuBang, thieuCot, ok: thieuBang.length === 0 && thieuCot.length === 0 };
  });

  const chuaChay = muc.filter((m) => !m.ok);
  const trongGoiCapNhat = chuaChay.filter((m) => ke.capNhat.includes(m.file)).map((m) => m.file);
  const ngoaiGoiCapNhat = chuaChay.filter((m) => !ke.capNhat.includes(m.file)).map((m) => m.file);

  return NextResponse.json({
    duAn: maDuAn(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ok: chuaChay.length === 0,
    daKiem: { bang: cotCuaBang.size, migration: ke.muc.length },
    thieu: chuaChay.length,
    // Tách hai nhóm vì cách sửa khác hẳn nhau, xem `viecPhaiLam`.
    trongGoiCapNhat,
    ngoaiGoiCapNhat,
    muc,
    loiLa: ketQua.filter((r) => r.loiKhac).map((r) => ({ bang: r.bang, loi: r.loiKhac })),
    viecPhaiLam:
      chuaChay.length === 0
        ? "Không thiếu gì. Database đang chạy đã có đủ mọi bảng và cột của repo."
        : ngoaiGoiCapNhat.length === 0
          ? "Chạy supabase/cap-nhat.sql (mở /api/setup-sql/cap-nhat để lấy nội dung) trong SQL Editor của ĐÚNG project ở trên."
          : "Thiếu cả migration NGOÀI gói cập nhật — gửi kết quả này cho Claude, đừng tự chạy setup-all.sql lên database đang có dữ liệu.",
  });
}
