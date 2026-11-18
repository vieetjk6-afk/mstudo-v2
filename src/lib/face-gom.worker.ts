/// <reference lib="webworker" />
import { tinhNguoi, type FaceRow } from "./face-gom-tinh";
import type { KnownPerson } from "./face-group";

/*
 * Gom khuôn mặt trong LUỒNG RIÊNG của trình duyệt studio: album lớn mất vài chục
 * giây tính toán, chạy trên luồng chính thì cả trang đứng hình suốt chừng ấy.
 * Nhận { list, known }, trả { nguoi } hoặc { loi }.
 */
self.onmessage = (e: MessageEvent<{ list: FaceRow[]; known: KnownPerson[] }>) => {
  try {
    const nguoi = tinhNguoi(e.data.list, e.data.known);
    (self as unknown as Worker).postMessage({ nguoi });
  } catch (err) {
    (self as unknown as Worker).postMessage({ loi: err instanceof Error ? err.message : String(err) });
  }
};
