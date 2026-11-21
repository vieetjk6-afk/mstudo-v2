/// <reference lib="webworker" />
import * as jpegNs from "jpeg-js";

/*
 * Giải mã JPEG cho bộ quét khuôn mặt trong LUỒNG RIÊNG.
 *
 * jpeg-js là JavaScript thuần, chạy đồng bộ: một ảnh quét 800 px mất vài chục tới
 * vài trăm ms. Trên luồng chính, mỗi tấm là một lần trang đứng hình — bộ tự quét
 * chạy nền cả buổi nên studio thấy app "giật" liên tục. Cùng thư viện, cùng tham
 * số với bản trên luồng chính, nên điểm ảnh y hệt (dòng DB vẫn không phân biệt
 * được với dòng máy chủ ghi).
 *
 * Nhận { id, bytes }, trả { id, data, width, height } (data chuyển quyền, không
 * sao chép) hoặc { id, loi }.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jpeg: any = (jpegNs as any).default ?? jpegNs;

self.onmessage = (e: MessageEvent<{ id: number; bytes: Uint8Array }>) => {
  const { id, bytes } = e.data;
  try {
    const dec = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
    const data = dec.data as Uint8Array;
    (self as unknown as Worker).postMessage({ id, data, width: dec.width, height: dec.height }, [data.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, loi: err instanceof Error ? err.message : String(err) });
  }
};
