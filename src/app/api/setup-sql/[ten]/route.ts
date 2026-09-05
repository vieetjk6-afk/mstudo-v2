import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { docBanKe, dungSqlBuThieu, soiDatabase } from "@/lib/db-thieu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// "bu-thieu" phải soi cả trăm bảng trước khi dựng được file.
export const maxDuration = 60;

/**
 * PHỤC VỤ THẲNG NỘI DUNG FILE SQL, dạng văn bản thuần.
 *
 * Vì sao cần: bảng báo "chưa chạy SQL" trước đây chỉ đưa một LINK GitHub và một
 * nút "chép link". Studio phải rời app, mở GitHub, tìm nút raw, bôi đen cả file
 * rồi mới dán được vào Supabase — và qua sáu vòng trao đổi thì việc đó vẫn chưa
 * xong lần nào. Nút chép trong app cần chính NỘI DUNG SQL, không phải một đường
 * dẫn tới nội dung ấy.
 *
 * Mở thẳng URL này trong tab cũng dùng được: nó trả `text/plain`, nên Ctrl+A rồi
 * Ctrl+C là xong — không có cú pháp tô màu, không có số dòng lẫn vào.
 *
 * Cần đăng nhập. Repo vốn công khai nên đây không phải bí mật, nhưng không có lý
 * do gì để phát schema cho người lạ.
 */

/** Chỉ ba file này. Danh sách trắng, không ghép đường dẫn từ tham số. */
const CHO_PHEP: Record<string, string> = {
  "khuon-mat": "khuon-mat.sql",
  "cap-nhat": "cap-nhat.sql",
  "setup-all": "setup-all.sql",
};

export async function GET(_req: Request, { params }: { params: { ten: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /*
   * "bu-thieu" KHÔNG phải file có sẵn: nó được dựng ngay lúc gọi, gồm đúng những
   * migration mà database ĐANG CHẠY còn thiếu, theo đúng thứ tự chạy.
   *
   * Vì sao không đưa `cap-nhat.sql` cho xong: gói đó cố định 9 file, mà database
   * này còn thiếu cả một migration NGOÀI gói — và một file TRONG gói lại có hàng
   * rào đòi migration ngoài kia phải chạy trước. SQL Editor chạy cả file trong
   * MỘT transaction, nên hàng rào bật lên là cả gói rollback, không cái nào được
   * tạo. Đúng cái bẫy đã làm mất mấy vòng đầu.
   */
  if (params.ten === "bu-thieu") {
    const ke = await docBanKe();
    const sql = await dungSqlBuThieu(await soiDatabase(createAdminClient(), ke));
    return new NextResponse(sql, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const file = CHO_PHEP[params.ten];
  if (!file) {
    return NextResponse.json(
      { error: "khong_co_file", coThe: [...Object.keys(CHO_PHEP), "bu-thieu"] },
      { status: 404 }
    );
  }
  // `next.config.mjs` khai báo supabase/*.sql trong outputFileTracingIncludes —
  // thiếu khai báo đó thì build vẫn xanh còn trên Vercel file không tồn tại.
  const path = join(process.cwd(), "supabase", file);
  if (!existsSync(path)) {
    return NextResponse.json({ error: "thieu_file_tren_may_chu", path }, { status: 500 });
  }
  const sql = await readFile(path, "utf8");
  return new NextResponse(sql, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // File chỉ đổi khi deploy lại, nhưng đây là thứ studio mở đúng lúc đang
      // sửa lỗi — phục vụ bản cũ ở đây là kéo dài thêm một vòng nữa.
      "Cache-Control": "no-store",
    },
  });
}
