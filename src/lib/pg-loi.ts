/**
 * ĐỌC LỖI CỦA POSTGREST: thiếu BẢNG hay thiếu CỘT?
 *
 * Vì sao đáng một file riêng có kiểm thử. Bản đầu của /api/db-status xét chuỗi
 * "does not exist" TRƯỚC mã lỗi. Postgres báo cột thiếu bằng đúng câu
 * `column profiles.xyz does not exist`, nên MỌI cột thiếu đều bị đọc thành BẢNG
 * thiếu — và bản chẩn đoán nói database đang thiếu `profiles`, cái bảng mà không
 * có nó thì không ai đăng nhập nổi.
 *
 * Một chẩn đoán sai kiểu đó tệ hơn hẳn không có chẩn đoán: nó đẩy người ta đi
 * chạy `setup-all.sql` lên database đang có dữ liệu thật. Nên luật này phải
 * đứng riêng và phải có bài kiểm giữ.
 *
 * Thứ tự xét là chủ ý: MÃ LỖI trước (chính xác tuyệt đối, do Postgres/PostgREST
 * quy định), rồi mới tới câu chữ — và câu chữ cũng phải phân biệt được
 * `relation` với `column`.
 */

export type LoaiThieu = "thieu-bang" | "thieu-cot" | "khac";

export function phanLoaiLoi(e: { code?: string | null; message?: string | null } | null): LoaiThieu {
  if (!e) return "khac";
  const code = e.code ?? "";
  const msg = e.message ?? "";
  // 42P01 undefined_table (Postgres) · PGRST205 không thấy bảng trong schema cache
  if (code === "42P01" || code === "PGRST205") return "thieu-bang";
  // 42703 undefined_column (Postgres) · PGRST204 không thấy cột trong schema cache
  if (code === "42703" || code === "PGRST204") return "thieu-cot";
  if (/could not find the table|relation .* does not exist/i.test(msg)) return "thieu-bang";
  if (/column .* does not exist|could not find the '[^']*' column/i.test(msg)) return "thieu-cot";
  // "schema cache" đứng một mình thì không nói được là bảng hay cột — PostgREST
  // dùng đúng cụm đó cho cả hai. Thà trả "khác" còn hơn đoán bừa.
  return "khac";
}
