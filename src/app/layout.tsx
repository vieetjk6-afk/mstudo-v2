import type { Metadata, Viewport } from "next";
import "./fonts";
import "./font-vars.css";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import { getSiteMeta } from "@/lib/site-meta";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InAppBrowserPrompt from "@/components/InAppBrowserPrompt";

// Phông chữ: tự phục vụ từ gói @fontsource (./fonts.ts) — KHÔNG next/font/google,
// vì nó tải font từ Google lúc build và đã nhiều lần làm hỏng cả lượt deploy.
// Biến CSS giữ nguyên tên cũ (./font-vars.css).

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
    <html lang="vi" data-theme="light" suppressHydrationWarning>
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
