/**
 * LƯỢT GOM KHUÔN MẶT TỰ ĐỘNG — phần luật thuần.
 *
 * Studio không bấm gì cả: mở màn album là app tự quét nền, gom nhóm, lưu xuống;
 * khách mở link là tìm được theo khuôn mặt. Mọi quyết định "quét tấm nào, khi
 * nào gom lại, khi nào coi là xong" nằm ở đây để kiểm được mà không cần trình
 * duyệt.
 *
 * Một điều phải nói thẳng và không giấu đi đâu được: MÔ HÌNH PHẢI CHẠY Ở ĐÂU ĐÓ.
 * Nó chạy trên máy studio, trong tab đang mở. Không có cách nào vừa miễn phí,
 * vừa không cần máy studio, vừa không bắt điện thoại khách tải 26 MB. Nên lượt
 * quét phải chịu được việc bị cắt ngang giữa chừng — đó là lý do có bảng
 * `album_faces` và cột `photos.faces_scanned_at`.
 */

/** Một tấm ảnh trong album, theo góc nhìn của lượt quét. */
export type ScanPhoto = {
  id: string;
  drive_file_id: string;
  name: string;
  /** Đã quét rồi hay chưa (photos.faces_scanned_at). */
  faces_scanned_at?: string | null;
};

/** Một khuôn mặt đã lưu trong kho. */
export type StoredFace = {
  photo_id: string;
  at: number;
  box: number[];
  descriptor: number[];
  sharpness: number;
};

/**
 * Bao nhiêu tấm cho một lượt ghi.
 *
 * Nhỏ thì ghi vặt quá nhiều; to thì đóng tab giữa chừng mất cả mẻ. 12 tấm là
 * khoảng 15–30 giây trên máy để bàn — mất chừng đó công thì chấp nhận được.
 */
export const CHUNK = 12;

/**
 * Trần số ảnh quét trong MỘT lần mở màn.
 *
 * Không phải giới hạn kỹ thuật mà là phép lịch sự: studio mở album để làm việc
 * khác, không phải để máy chạy nóng hàng giờ. Hết trần thì dừng, lần mở sau chạy
 * tiếp — và vì đã lưu từng mẻ nên không mất gì.
 */
export const PER_VISIT = 400;

/** Những tấm còn phải quét, theo đúng thứ tự album. */
export function pending(photos: readonly ScanPhoto[]): ScanPhoto[] {
  return photos.filter((p) => !p.faces_scanned_at);
}

/** Cắt danh sách thành từng mẻ để ghi dần. */
export function chunks<T>(list: readonly T[], size = CHUNK): T[][] {
  if (size <= 0) return [list.slice()];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Tiến độ để hiện cho studio. */
export type Progress = { done: number; total: number; percent: number };

export function progressOf(photos: readonly ScanPhoto[]): Progress {
  const total = photos.length;
  const done = total - pending(photos).length;
  return { done, total, percent: total === 0 ? 100 : Math.round((done / total) * 100) };
}

/**
 * Có nên gom nhóm lại không.
 *
 * Chỉ gom khi ĐÃ QUÉT HẾT. Gom giữa chừng thì các nhóm nhảy lung tung sau mỗi
 * mẻ, và studio nhìn vào sẽ không tin cái gì cả — cùng lý do vì sao thuật toán
 * gom có hạt giống cố định.
 *
 * `savedPeople` là số người đang có trong DB: đã quét hết mà chưa có ai thì phải
 * gom; đã có rồi thì thôi, trừ khi có ảnh mới (`freshFaces`) vừa được thêm vào.
 */
export function shouldCluster(
  photos: readonly ScanPhoto[],
  savedPeople: number,
  freshFaces: number
): boolean {
  if (photos.length === 0) return false;
  if (pending(photos).length > 0) return false;
  return savedPeople === 0 || freshFaces > 0;
}

/**
 * Trạng thái để hiện một dòng chữ cho studio.
 *
 * Cố ý phân biệt "chưa có ảnh" với "đã xong mà không thấy ai": hai tình huống
 * rất khác nhau, và gộp chúng thành một câu chung là cách chắc chắn để studio
 * không hiểu chuyện gì đang xảy ra.
 */
export type AutoState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "scanning"; progress: Progress }
  | { kind: "clustering" }
  | { kind: "done"; people: number }
  | { kind: "none" }
  | { kind: "paused"; progress: Progress }
  | { kind: "error"; message: string };

export function stateOf(args: {
  photos: readonly ScanPhoto[];
  savedPeople: number;
  running: boolean;
  clustering: boolean;
  stoppedForNow: boolean;
  /** Đã đọc xong danh sách ảnh chưa. Xem ghi chú ngay dưới. */
  loaded: boolean;
  error?: string | null;
}): AutoState {
  const { photos, savedPeople, running, clustering, stoppedForNow, loaded, error } = args;
  if (error) return { kind: "error", message: error };
  /*
   * "CHƯA TẢI XONG" phải khác "ĐÃ TẢI, KHÔNG CÓ ẢNH" — và đây không phải chuyện
   * chỉn chu, đây là lỗi đã tốn năm vòng qua lại.
   *
   * Danh sách ảnh khởi tạo bằng mảng rỗng. Nếu câu đọc hỏng (mất mạng, thiếu
   * bảng, RLS chặn) thì mảng ấy KHÔNG BAO GIỜ được điền, và màn hình báo "Chưa
   * có ảnh nào trong album" — nói sai về một thứ studio nhìn thấy tận mắt là có,
   * rồi họ đi tìm nguyên nhân ở hoàn toàn chỗ khác.
   */
  if (!loaded) return { kind: "loading" };
  if (photos.length === 0) return { kind: "empty" };
  if (clustering) return { kind: "clustering" };
  const p = progressOf(photos);
  if (running) return { kind: "scanning", progress: p };
  if (p.done < p.total) return { kind: "paused", progress: p };
  return savedPeople > 0 ? { kind: "done", people: savedPeople } : { kind: "none" };
}
