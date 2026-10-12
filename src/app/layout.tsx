import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Cormorant_Garamond, Manrope, Dancing_Script, Great_Vibes, Be_Vietnam_Pro, Playfair_Display, Playpen_Sans, Lora } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import { getSiteMeta } from "@/lib/site-meta";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InAppBrowserPrompt from "@/components/InAppBrowserPrompt";

// Font UI chính (mọi trang) → preload để tránh nháy chữ.
const hanken = Hanken_Grotesk({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hanken",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  display: "swap",
});

// Serif nhấn nhá — chỉ dùng ở các trang khách (album, thiệp, story, báo giá…),
// KHÔNG dùng trong dashboard/landing → preload:false để mọi trang khác khỏi tải
// ~6 file woff2 (3 weight × 2 style); trang nào dùng vẫn tự nạp qua CSS.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  fallback: ["Georgia", "Times New Roman", "serif"],
  display: "swap",
  preload: false,
});

// Các font dưới đây CHỈ dùng ở một số trang (landing / thiệp cưới / love story)
// → preload:false để KHÔNG tải phông trên mọi trang (nhanh hơn); vẫn tự nạp khi
// trang tương ứng dùng tới biến CSS của font.
const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  display: "swap",
  preload: false,
});

// Font của khu QUẢN LÝ STUDIO (bản thiết kế 2.0) — chỉ .studio-shell dùng tới
// nên preload:false: các trang khách/landing khỏi phải tải thêm 5 file woff2.
const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  display: "swap",
  preload: false,
});

// Script font for wedding-invitation templates (cinematic/story couple names).
const dancing = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-script",
  fallback: ["Georgia", "cursive"],
  display: "swap",
  preload: false,
});

// Handwriting font riêng cho TÊN KHÁCH MỜI (bì thư, phần lời mời, love story).
const greatVibes = Great_Vibes({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-hand",
  fallback: ["Georgia", "cursive"],
  display: "swap",
  preload: false,
});

// Bộ phông của các mẫu "thiệp điện thoại" (sen, sơn mài, giấy dó, song hỷ,
// vintage, scrapbook…). Chỉ trang thiệp dùng tới → preload:false.
// Chỉ chọn phông CÓ bộ dấu tiếng Việt để tên cô dâu chú rể không bị vỡ dấu.
const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  fallback: ["Georgia", "Times New Roman", "serif"],
  display: "swap",
  preload: false,
});

// Chữ viết tay cho mẫu "scrapbook". Caveat (bản thiết kế gốc) KHÔNG có bộ dấu
// tiếng Việt → dùng Playpen Sans, cùng chất viết tay thoải mái mà đủ dấu.
const playpen = Playpen_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-caveat",
  fallback: ["Segoe Script", "cursive"],
  display: "swap",
  preload: false,
});

const lora = Lora({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  fallback: ["Georgia", "serif"],
  display: "swap",
  preload: false,
});

// Browser-tab title / description are admin-editable (Cài đặt → Trình duyệt).
// Falls back to the defaults if Supabase isn't reachable or unset.
//
// KHÔNG đọc headers() ở đây: layout gốc gọi headers() là MỌI trang thành
// dynamic — ISR của showcase / gia / banggia chết hẳn, lượt xem nào cũng chạy
// hàm (tốn Fast Origin Transfer). Phần phụ thuộc host đã chuyển đi:
//   • favicon / icon iOS → /api/brand-icon (đọc Host, 302 sang logo studio trên
//     tên miền riêng, hoặc favicon admin đặt trên host mstudo);
//   • tiêu đề trên tên miền studio → mỗi trang khách tự đặt (generateMetadata
//     của /site, /a, /album, /portal, /q, /c…).
// appleWebApp.title bỏ trống có chủ ý: iOS lấy tên từ manifest của trang (album
// / portal có manifest riêng mang tên studio, host chính là "mstudo") — đặt cứng
// "mstudo" ở đây sẽ đè tên studio trên màn hình chính của khách.
export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await getSiteMeta();
  return {
    title,
    description,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
    icons: {
      icon: "/api/brand-icon",
      shortcut: "/api/brand-icon",
      apple: "/api/brand-icon?apple=1",
    },
  };
}

export const viewport: Viewport = {
  // Khớp `--bg` của nền SÁNG (globals.css) — mặc định của app khi chưa ai chọn.
  // Người đã chọn nền tối được ThemeProvider ghi đè thẻ này lúc gắn (xem
  // `apply()` ở @/lib/theme): màu ở đây không theo `prefers-color-scheme` được,
  // vì nền của app do lựa chọn của người dùng quyết định chứ không theo máy.
  themeColor: "#f4f3f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: script ở <head> ĐỔI data-theme trước khi React
    // hydrate (đó là cách duy nhất để không nháy nền sáng rồi mới sang tối), nên
    // React luôn thấy thuộc tính này lệch với bản dựng ở server. Chỉ tắt cảnh báo
    // đúng một cấp <html> — con cháu vẫn được kiểm tra bình thường.
    <html lang="vi" data-theme="light" suppressHydrationWarning className={`${hanken.variable} ${cormorant.variable} ${manrope.variable} ${beVietnam.variable} ${dancing.variable} ${greatVibes.variable} ${playfair.variable} ${playpen.variable} ${lora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <LangProvider>{children}</LangProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        {/* Trang gửi khách mở trong Zalo / Facebook → cảnh báo nổi "Mở bằng trình duyệt". */}
        <InAppBrowserPrompt />
      </body>
    </html>
  );
}
