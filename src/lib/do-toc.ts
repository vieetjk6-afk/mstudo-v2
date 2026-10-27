/**
 * Đồng hồ đo từng bước của một lượt dựng trang — ghi MỘT dòng log
 * `[do-toc] <trang> tong=…ms <bước>=…ms …` để đọc trong Vercel → Logs khi một
 * màn bị báo chậm. Không đổi kết quả của bước nào, chỉ ghi lại lúc nó xong.
 *
 * `lanh` = lượt đầu tiên của tiến trình máy chủ này (cold start): thời gian
 * khởi động hàm nằm NGOÀI số `tong`, nên dòng có `lanh` mà tong nhỏ nghĩa là
 * chậm do khởi động chứ không phải do truy vấn.
 */
let lanDau = true;

export function doToc(trang: string) {
  const t0 = performance.now();
  const lanh = lanDau;
  lanDau = false;
  const moc: string[] = [];
  const ms = () => Math.round(performance.now() - t0);

  return {
    /** Ghi mốc khi `p` xong (tính từ đầu lượt, nên đo được cả bước chạy song song). */
    buoc<T>(ten: string, p: Promise<T>): Promise<T> {
      return p.finally(() => moc.push(`${ten}=${ms()}`));
    },
    xong() {
      console.log(`[do-toc] ${trang} tong=${ms()}ms ${moc.join(" ")}${lanh ? " lanh" : ""}`);
    },
  };
}
