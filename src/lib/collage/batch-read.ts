/* ═══════════════════════════════════════════════════════════════════════════
   ĐỌC THEO LÔ CÓ HẠN GIỜ — phần thuần của route /api/album/[slug]/collage/photos
   (src/lib/album-collage.ts), tách ra để kiểm thử bằng node không cần DB.

   Vì sao có: bản đầu đọc khuôn mặt cả album bằng cách lật trang `order by …
   offset` NỐI ĐUÔI nhau, không hạn giờ — album lớn / DB chậm là màn ghép quay
   vòng "Đang mở album…" mãi (lỗi thật, 11/2026). Nay đọc theo lô id (khoá
   chính), song song, và dừng đúng hạn; lô nào đọc xong mới được tính.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Chạy `fn` cho từng phần tử, tối đa `n` lượt cùng lúc. */
export async function runPool<T>(items: readonly T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
}

export type LotQuery = (ids: string[], signal: AbortSignal) => PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * Đọc các dòng thuộc `ids`, mỗi lượt một lô `size` id, tối đa `parallel` lượt
 * cùng lúc. Lô trả về chạm trần `cap` dòng (PostgREST cắt lặng lẽ ở max-rows)
 * thì chia đôi đọc lại cho đủ. `done` = id thuộc các lô đã đọc XONG — lô lỗi
 * hoặc bị cắt vì hết giờ thì id của nó không có trong `done`.
 */
export async function readByIds<R>(
  ids: readonly string[],
  query: LotQuery,
  signal: AbortSignal,
  opts: { size?: number; parallel?: number; cap?: number } = {},
): Promise<{ rows: R[]; done: Set<string> }> {
  const size = Math.max(1, opts.size ?? 100);
  const cap = opts.cap ?? 1000;
  const rows: R[] = [];
  const done = new Set<string>();
  // Hết giờ là thôi chờ NGAY, kể cả lượt đọc không nghe signal (kết nối treo):
  // phần đã đọc xong vẫn được trả về.
  const stop = new Promise<{ data: null; error: string }>((resolve) => {
    const fire = () => resolve({ data: null, error: "aborted" });
    if (signal.aborted) fire();
    else signal.addEventListener("abort", fire, { once: true });
  });
  const read = async (part: string[]): Promise<void> => {
    if (signal.aborted || !part.length) return;
    let res: { data: unknown[] | null; error: unknown };
    try {
      res = await Promise.race([query(part, signal), stop]);
    } catch {
      return;
    }
    if (signal.aborted || res.error || !res.data) return;
    if (res.data.length >= cap && part.length > 1) {
      const mid = Math.ceil(part.length / 2);
      await Promise.all([read(part.slice(0, mid)), read(part.slice(mid))]);
      return;
    }
    rows.push(...(res.data as R[]));
    for (const id of part) done.add(id);
  };
  const lots: string[][] = [];
  for (let i = 0; i < ids.length; i += size) lots.push(ids.slice(i, i + size));
  await runPool(lots, opts.parallel ?? 6, read);
  return { rows, done };
}

/**
 * Chạy `work` với một AbortSignal tự bật sau `ms` mili giây. Trả kết quả của
 * `work` (nó tự quyết dùng được bao nhiêu khi bị cắt) và `cut` = đã hết giờ.
 * `work` treo hẳn, không nghe signal, vẫn bị bỏ đúng hạn → `fallback`.
 */
export async function withDeadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<{ value: T; cut: boolean }> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      ctl.abort();
      // Cho `work` một nhịp để trả phần đã có sau khi nghe signal.
      setTimeout(() => resolve(fallback), 50);
    }, Math.max(0, ms));
  });
  try {
    const value = await Promise.race([work(ctl.signal).catch(() => fallback), late]);
    return { value, cut: ctl.signal.aborted };
  } finally {
    clearTimeout(timer);
  }
}
