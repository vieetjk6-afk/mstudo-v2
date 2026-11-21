/*
 * ĐẾM LƯU LƯỢNG SUPABASE PHÍA MÁY CHỦ (ước tính egress).
 *
 * Supabase không có API công khai trả số egress, mà dự án từng bị khoá vì vượt
 * 5 GB/tháng của gói Free. Nên app tự đếm: mọi request tới Supabase đi qua
 * `demFetch` (gắn ở @/lib/supabase/admin và server) — lấy số byte thân trả lời
 * (header content-length, không có thì đo thân), cộng dồn trong bộ nhớ theo ngày
 * UTC, rồi xả vào bảng system_usage (hàm usage_add) khoảng 30 giây một lần.
 *
 * Chỉ là ƯỚC TÍNH: không gồm header, ảnh / file tải thẳng từ Storage, và phần
 * chưa kịp xả khi máy chủ bị tắt. Đủ để thấy xu hướng và cảnh báo sớm.
 *
 * KHÔNG `import "server-only"` (như @/lib/no-store-fetch): bài kiểm thử nạp
 * thẳng file này bằng node.
 */
import { createClient as taoClient } from "@supabase/supabase-js";
import { BoDem, doDaiTheoHeader, laSupabase } from "./luu-luong-rules";

const dem = new BoDem();
let xaLanCuoi = Date.now();
let dangXa = false;
/** Chưa chạy migration (thiếu hàm usage_add) → thôi xả một lúc cho đỡ phí. */
let nghiDen = 0;

const XA_SAU_MS = 30_000;
const XA_KHI_BYTE = 5 * 1024 * 1024;

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function urlCua(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

/** Ghi nhận một trả lời từ Supabase. Không bao giờ ném, không làm chậm request. */
export function ghiNhan(res: Response): void {
  const n = doDaiTheoHeader(res.headers);
  if (n !== null) dem.cong(n, 1);
  else if (res.body) {
    dem.cong(0, 1);
    // Đo thân trên một bản sao, không chờ: người gọi vẫn đọc bản gốc như thường.
    // Đọc từng khúc rồi bỏ, chỉ cộng độ dài — arrayBuffer() trước đây gom NGUYÊN
    // một bản sao thứ hai của thân trả lời vào RAM (kể cả file tải từ Storage).
    const body = res.clone().body;
    if (body) {
      void (async () => {
        const reader = body.getReader();
        let n = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            n += value?.byteLength ?? 0;
          }
          dem.cong(n, 0);
        } catch { /* luồng hỏng — bỏ qua lượt đo này */ }
      })();
    }
  } else dem.cong(0, 1);
  canXa();
}

function canXa(): void {
  if (dangXa || dem.rong() || Date.now() < nghiDen) return;
  if (Date.now() - xaLanCuoi < XA_SAU_MS && dem.tong() < XA_KHI_BYTE) return;
  dangXa = true;
  setTimeout(() => void xa().finally(() => (dangXa = false)), 0);
}

/** Xả bộ đếm vào database. Lỗi thì trả số lại cho lần sau. */
export async function xa(): Promise<void> {
  const ds = dem.layRa();
  xaLanCuoi = Date.now();
  if (ds.length === 0) return;
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  // fetch THƯỜNG (không qua demFetch): lượt xả không tự đếm chính nó.
  const db = taoClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: "no-store" }) },
  });
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i];
    const { error } = await db.rpc("usage_add", { p_day: d.ngay, p_source: "supabase-may-chu", p_metric: "egress", p_bytes: d.bytes, p_requests: d.requests });
    if (error) {
      if (/usage_add|schema cache|does not exist|PGRST202/i.test(`${error.code} ${error.message}`)) {
        nghiDen = Date.now() + 10 * 60_000; // chưa chạy migration: bỏ số này, nghỉ 10 phút
      } else dem.traLai(ds.slice(i)); // lỗi tạm: giữ lại phần chưa xả
      return;
    }
  }
}

/** Bọc một fetch để đếm byte các trả lời từ Supabase. */
export function demFetch(base: typeof fetch): typeof fetch {
  return async (input, init) => {
    const res = await base(input, init);
    try {
      if (laSupabase(urlCua(input), supabaseUrl())) ghiNhan(res);
    } catch {
      /* đếm hỏng thì thôi — không bao giờ làm hỏng request */
    }
    return res;
  };
}
