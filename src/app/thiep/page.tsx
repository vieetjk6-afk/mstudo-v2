import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { mainUrl } from "@/lib/hosts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thiệp cưới online",
  description: "Thiệp cưới online — tạo và chia sẻ thiệp cưới đẹp, miễn phí.",
};

/** Root landing for the thiệp host (thiep.<domain>). A bare visit lands here. */
export default function ThiepLanding() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center" style={{ background: "#fbf7f2", color: "#3a3530", fontFamily: "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif" }}>
      <div className="max-w-md">
        <Heart className="mx-auto mb-4" style={{ color: "#b08968" }} />
        <h1 className="font-serif text-4xl">Thiệp cưới online</h1>
        <p className="mx-auto mt-4 text-base" style={{ color: "rgba(58,53,48,0.62)" }}>
          Mỗi thiệp có một đường dẫn riêng do studio cung cấp. Nếu bạn vừa nhận được link,
          hãy mở đúng đường dẫn đó để xem thiệp.
        </p>
        <a href={mainUrl("/")} className="mt-6 inline-block rounded-full px-5 py-2.5 text-sm text-white" style={{ background: "#b08968" }}>
          Về trang chủ
        </a>
      </div>
    </main>
  );
}
