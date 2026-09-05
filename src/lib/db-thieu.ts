/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { phanLoaiLoi } from "./pg-loi";

/**
 * DATABASE ĐANG CHẠY CÒN THIẾU MIGRATION NÀO — phần dùng chung.
 *
 * Hai route cần đúng câu trả lời này và phải KHÔNG BAO GIỜ lệch nhau:
 * /api/db-status (báo cáo cho người đọc) và /api/setup-sql/bu-thieu (dựng file
 * SQL để dán). Lệch nhau nghĩa là file dán vào thiếu đúng cái mà báo cáo vừa
 * nói là thiếu — nên chúng dùng chung một hàm, không chép hai bản.
 *
 * Bản kê `supabase/kiem-tra.json` do build-setup-all.mjs sinh: mỗi migration
 * khai những bảng nó tạo và những cột nó thêm, XẾP THEO ĐÚNG THỨ TỰ CHẠY.
 */

export type Muc = { file: string; mo_ta: string; bang: string[]; cot: string[] };
export type BanKe = { capNhat: string[]; muc: Muc[] };
export type MucThieu = {
  file: string;
  moTa: string;
  thieuBang: string[];
  thieuCot: string[];
  ok: boolean;
};

/** Số câu hỏi chạy song song. Đủ nhanh mà không đấm vào giới hạn PostgREST. */
const SONG_SONG = 8;

export async function docBanKe(): Promise<BanKe> {
  return JSON.parse(await readFile(join(process.cwd(), "supabase", "kiem-tra.json"), "utf8")) as BanKe;
}

async function theoLo<T, R>(list: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += n) out.push(...(await Promise.all(list.slice(i, i + n).map(fn))));
  return out;
}

export type KetQuaBang = { bang: string; thieuBang: boolean; thieuCot: string[]; loiKhac: string | null };

/**
 * Hỏi database từng bảng một.
 *
 * MỘT LƯỢT GỌI CHO MỖI BẢNG, không phải mỗi cột: chọn hết các cột cần kiểm
 * trong cùng một câu `select`. Bảng nào vấp thì mới hỏi lại từng cột — câu gộp
 * chỉ nêu được cột ĐẦU TIÊN nó gặp, mà báo cáo thiếu một trong năm cột thì
 * studio chạy xong vẫn thấy đỏ và không hiểu vì sao.
 */
export async function soiDatabase(db: any, ke: BanKe): Promise<MucThieu[]> {
  const cotCuaBang = new Map<string, Set<string>>();
  for (const m of ke.muc) {
    for (const b of m.bang) if (!cotCuaBang.has(b)) cotCuaBang.set(b, new Set());
    for (const c of m.cot) {
      const [b, cot] = c.split(".");
      if (!cotCuaBang.has(b)) cotCuaBang.set(b, new Set());
      cotCuaBang.get(b)!.add(cot);
    }
  }

  const ketQua = await theoLo([...cotCuaBang.entries()], SONG_SONG, async ([bang, cot]): Promise<KetQuaBang> => {
    const { error } = await db.from(bang).select(cot.size ? [...cot].join(",") : "*").limit(1);
    if (!error) return { bang, thieuBang: false, thieuCot: [], loiKhac: null };
    const loai = phanLoaiLoi(error);
    if (loai === "thieu-bang") return { bang, thieuBang: true, thieuCot: [], loiKhac: null };
    if (loai !== "thieu-cot") {
      return { bang, thieuBang: false, thieuCot: [], loiKhac: `${error.code ?? ""} ${error.message ?? ""}`.trim() };
    }
    const thieu: string[] = [];
    for (const c of cot) {
      const { error: e } = await db.from(bang).select(c).limit(1);
      if (e && phanLoaiLoi(e) === "thieu-cot") thieu.push(c);
    }
    return { bang, thieuBang: false, thieuCot: thieu, loiKhac: null };
  });

  const theoBang = new Map(ketQua.map((r) => [r.bang, r]));
  return ke.muc.map((m) => {
    const thieuBang = m.bang.filter((b) => theoBang.get(b)?.thieuBang);
    const thieuCot = m.cot.filter((c) => {
      const [b, cot] = c.split(".");
      const r = theoBang.get(b);
      // Bảng thiếu hẳn thì cột của nó không kể riêng — nói một lần là đủ.
      return r && !r.thieuBang && r.thieuCot.includes(cot);
    });
    return { file: m.file, moTa: m.mo_ta, thieuBang, thieuCot, ok: thieuBang.length === 0 && thieuCot.length === 0 };
  });
}

/**
 * Dựng file SQL gồm ĐÚNG những migration còn thiếu, theo đúng thứ tự chạy.
 *
 * Vì sao không bảo studio dán `cap-nhat.sql`: gói đó cố định 9 file, mà database
 * này còn thiếu cả `studio_appointments.sql` nằm NGOÀI gói — và `crew_timesheet`
 * trong gói lại có hàng rào đòi bảng đó phải tồn tại trước. SQL Editor chạy cả
 * file trong MỘT transaction, nên hàng rào bật lên là cả chín migration rollback
 * và không cái nào được tạo. Chuyện đó đã xảy ra thật.
 *
 * Thứ tự lấy nguyên từ bản kê (đã xếp theo ORDER của build-setup-all.mjs), nên
 * phụ thuộc giữa các file luôn được thoả.
 */
export async function dungSqlBuThieu(thieu: MucThieu[]): Promise<string> {
  const can = thieu.filter((m) => !m.ok);
  const vach = "-- " + "═".repeat(72);
  const dau = [
    vach,
    "-- mstudo — BÙ ĐÚNG NHỮNG MIGRATION DATABASE NÀY CÒN THIẾU",
    "--",
    "-- File này được dựng RIÊNG cho database đang chạy, ngay lúc bạn mở đường dẫn",
    "-- này — không phải file có sẵn trong repo. Nó gồm đúng những migration mà",
    "-- /api/db-status vừa đo là còn thiếu, xếp theo đúng thứ tự chạy.",
    "--",
    "-- Cách dùng: copy TOÀN BỘ → Supabase → SQL Editor của đúng project → Run.",
    "-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.",
    "--",
    ...(can.length === 0
      ? ["-- KHÔNG THIẾU GÌ CẢ. Không cần chạy gì."]
      : can.map((m) => {
          const chi = [
            ...m.thieuBang.map((b) => `bảng ${b}`),
            ...m.thieuCot.map((c) => `cột ${c}`),
          ].join(", ");
          return `--   • ${m.file} — ${chi}`;
        })),
    vach,
    "",
  ];
  if (can.length === 0) return dau.join("\n") + "\n";

  const than: string[] = [];
  for (const m of can) {
    const sql = await readFile(join(process.cwd(), "supabase", m.file), "utf8");
    than.push("", vach, `-- ▶ ${m.file} — ${m.moTa}`, vach, "", sql.trim(), "");
  }

  // Câu cuối: bảng kết quả để NHÌN THẤY là đã chạy đúng chỗ. Một file toàn
  // CREATE/ALTER kết thúc bằng "Success. No rows returned." — với người không
  // đọc SQL thì câu đó đọc y như "chẳng có gì xảy ra", và chạy nhầm project
  // cũng cho ra đúng câu ấy.
  const kiem: string[] = [];
  for (const m of can) {
    for (const b of m.thieuBang) kiem.push(`select '${b}' as thu, to_regclass('public.${b}') is not null as co`);
    for (const c of m.thieuCot) {
      const [bang, cot] = c.split(".");
      kiem.push(
        `select '${c}', exists (select 1 from information_schema.columns` +
          ` where table_schema='public' and table_name='${bang}' and column_name='${cot}')`
      );
    }
  }
  const cuoi = [
    "",
    vach,
    "-- KIỂM TRA — bảng kết quả dưới đây là BẰNG CHỨNG đã chạy đúng chỗ.",
    "-- Cột `co` phải là `t` (true) hết.",
    vach,
    kiem.join("\nunion all\n") + ";",
    "",
  ];
  return [...dau, ...than, ...cuoi].join("\n");
}
