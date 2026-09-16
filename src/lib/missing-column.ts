/**
 * Nhận ra lỗi "database chưa có cột này" từ Supabase/PostgREST.
 *
 * Vì sao cần: mỗi cột mới đi kèm một migration mà chủ studio phải tự chạy trên
 * Supabase của mình. Giữa lúc bản mới lên và lúc họ chạy SQL, mã nguồn đã đọc
 * và ghi cột đó rồi. Nếu không chịu được khoảng giữa ấy thì:
 *
 *   · select có tên cột → PostgREST trả 400 và CẢ trang hỏng, không chỉ mất một ô
 *   · insert có tên cột → ghi hỏng; chỗ nào xoá-rồi-chèn thì mất sạch dữ liệu cũ
 *
 * Nên chỗ nào chạm cột mới cũng thử bản đầy đủ trước, dính lỗi này thì lùi về
 * bản không có cột đó. Chạy SQL xong là tự khắc dùng bản đầy đủ, không cần
 * đụng lại mã nguồn.
 *
 * Mã lỗi: 42703 = undefined_column (Postgres), PGRST204 = PostgREST không tìm
 * thấy cột trong lược đồ đã nạp.
 */
export function isMissingColumn(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const code = e.code || "";
  if (code !== "42703" && code !== "PGRST204") return false;
  // Không có tên cột trong thông báo thì cứ coi là đúng cột đang nghi — thà
  // lùi một bước còn hơn để nguyên lỗi chặn cả trang.
  return !e.message || e.message.includes(column);
}

/** Bỏ một khoá khỏi từng dòng sắp ghi (dùng khi lùi về bản không có cột đó). */
export function withoutColumn<T extends Record<string, unknown>>(rows: T[], column: string): Omit<T, never>[] {
  return rows.map((r) => {
    const copy = { ...r };
    delete copy[column];
    return copy;
  });
}
