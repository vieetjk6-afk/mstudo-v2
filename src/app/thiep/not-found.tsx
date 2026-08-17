import { Heart } from "lucide-react";

// Local not-found for the thiệp host — overrides the global not-found.tsx
// (which redirects signed-out visitors to the marketing home page). Guests of a
// wedding invitation must stay on the thiệp domain and see a friendly notice
// instead of being bounced away.
export default function ThiepNotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center" style={{ background: "#fbf7f2", color: "#3a3530", fontFamily: "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif" }}>
      <div className="max-w-md">
        <Heart className="mx-auto mb-4" style={{ color: "#b08968" }} />
        <h1 className="font-serif text-3xl">Không tìm thấy thiệp cưới</h1>
        <p className="mx-auto mt-4 text-base" style={{ color: "rgba(58,53,48,0.62)" }}>
          Đường dẫn có thể chưa đúng, hoặc thiệp chưa được xuất bản. Vui lòng kiểm tra lại link
          mà cô dâu chú rể đã gửi cho bạn.
        </p>
      </div>
    </main>
  );
}
