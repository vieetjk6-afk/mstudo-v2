/**
 * Màn "không tìm thấy" cho các trang KHÁCH của studio (báo giá, thẻ quà, biểu
 * mẫu…). Vì sao cần: `notFound()` mà không có not-found.tsx riêng thì rơi xuống
 * src/app/not-found.tsx — trang đó chuyển về trang chủ mStudo. Khách bấm một link
 * báo giá cũ/đã xoá bị đưa sang trang quảng cáo phần mềm, mất hẳn thương hiệu
 * studio và không biết phải làm gì. Cùng kiểu với màn lỗi của /book/[token].
 */
export default function CustomerNotFound({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="card max-w-md p-8">
        <h1 className="font-serif text-2xl font-medium">{title}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>{message}</p>
      </div>
    </div>
  );
}
