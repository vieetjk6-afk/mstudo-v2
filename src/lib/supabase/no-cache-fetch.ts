/*
 * KHÔNG `import "server-only"` ở đây, có lý do: file này được
 * desktop/test/fetch-khong-cache.mjs nạp thẳng bằng `node
 * --experimental-strip-types`, mà gói `server-only` chỉ phân giải được bên
 * trong Next. Không mất mát gì: hai nơi dùng nó (admin.ts giữ khoá dịch vụ,
 * server.ts dùng next/headers) vốn đã không thể lọt sang phía trình duyệt.
 */

/**
 * `fetch` cho mọi client Supabase phía MÁY CHỦ — ép `cache: "no-store"`.
 *
 * ĐÂY LÀ CHỖ CHỮA MỘT LỖI ĐÃ NGỐN NHIỀU VÒNG CHẨN ĐOÁN SAI.
 *
 * Next 14 vá đè `fetch` toàn cục và cho vào Data Cache. Trong Route Handler,
 * `export const dynamic = "force-dynamic"` KHÔNG tắt được bộ nhớ đệm đó — nó
 * chỉ nói "đừng dựng sẵn trang", không nói gì về fetch bên trong. Đo bằng một
 * route dựng riêng (force-dynamic, gọi ba loại request tới một máy chủ đếm):
 *
 *     gọi route 3 lần  →  máy chủ đích CHỈ nhận được:
 *         GET /dem      (1 lần, lẽ ra 3)
 *         PATCH /tang   (1 lần, lẽ ra 3)   ← CẢ LỆNH GHI cũng bị nuốt
 *         HEAD /dem     (1 lần, lẽ ra 3)
 *
 * Nghĩa là: request thứ hai trở đi KHÔNG BAO GIỜ rời khỏi máy chủ, mà vẫn nhận
 * được thân trả lời của lần đầu. Với Supabase, PostgREST đi bằng đúng `fetch`
 * đó, nên hệ quả là:
 *
 *   • Câu SELECT lặp lại y hệt → mãi mãi trả về ảnh chụp của lần đầu.
 *   • Câu UPDATE lặp lại y hệt → KHÔNG chạy, nhưng vẫn trả về "đã ghi N dòng"
 *     lấy từ cache. Mọi vòng kiểm "ghi có ăn không" đều bị lừa.
 *
 * Đó chính là chuyện đã xảy ra với bộ quét khuôn mặt: log production ngày 06/09
 * cho thấy tám lượt liên tiếp báo quét 37–47 ảnh và ghi mốc thành công, trong
 * khi database chỉ nhận đúng MỘT mẻ (51/343 ảnh) và mọi lượt đọc sau đó vẫn
 * thấy nguyên 343 ảnh chưa quét. Các vòng trước đổ cho trigger, cho RLS, cho
 * bản sao chỉ-đọc — không phải, thủ phạm nằm ở tầng fetch của chính app.
 *
 * Vì sao phần còn lại của app vẫn chạy: khoá cache là URL + init, mà hầu hết
 * câu lệnh mang id/payload khác nhau mỗi lần nên không đụng nhau. Bộ quét là ca
 * bệnh nặng vì nó lặp lại ĐÚNG một câu — và tự nuôi vòng lặp: đọc bị cache trả
 * về cùng danh sách ảnh → câu UPDATE dựng ra cũng y hệt → lại trúng cache.
 *
 * KHÔNG ĐƯỢC bỏ tuỳ chọn này để "tối ưu". Dữ liệu studio là dữ liệu giao dịch:
 * hợp đồng, thanh toán, lịch chụp. Một câu đọc cũ ở đây không nhanh hơn, nó
 * SAI. Muốn nhớ tạm thì dùng `unstable_cache` ở đúng chỗ cần (xem getSiteMeta
 * trong app/layout.tsx), nơi thời gian sống được khai rõ ràng.
 */
export const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });
