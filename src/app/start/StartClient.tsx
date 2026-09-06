"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Link2, Lock, Send, QrCode, Images, MessageSquarePlus } from "lucide-react";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CreateAlbumFlow, { CreateHero } from "@/components/CreateAlbumFlow";
import { createClient } from "@/lib/supabase/client";
import { imgUrl } from "@/lib/hosts";

const STEPS = [
  { Icon: Link2, title: "1 · Dán link Google Drive", desc: "Chia sẻ thư mục ở chế độ “Anyone with the link”, rồi dán vào — có thể thêm nhiều thư mục." },
  { Icon: Lock, title: "2 · Tuỳ chọn", desc: "Đặt mật khẩu, giới hạn số ảnh được chọn, và watermark tên studio nếu muốn." },
  { Icon: QrCode, title: "3 · Tạo & gửi", desc: "Đăng nhập Google rồi bấm tạo — nhận ngay link và mã QR để gửi cho khách." },
  { Icon: Images, title: "4 · Khách chọn ảnh", desc: "Khách mở link, chọn ảnh thích, ghi chú, rồi gửi lại — không cần đăng nhập." },
  { Icon: MessageSquarePlus, title: "5 · Nhận lựa chọn", desc: "Xem danh sách ảnh khách chọn kèm ghi chú trong Bảng điều khiển, xuất danh sách / tải ZIP." },
];

export default function StartClient() {
  const guideRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setLoggedIn(!!data.user));
  }, []);

  // React 19: useRef<T>(null) cho ra RefObject<T | null>, không còn RefObject<T>.
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="min-h-screen pb-24">
      <header
        className="sticky top-0 z-40 flex flex-wrap items-center gap-3 px-6 py-3.5 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--bg) 80%, transparent)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Brand href="/start" />
        <nav className="mx-auto hidden items-center gap-1 md:flex">
          <button onClick={() => scrollTo(createRef)} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text)" }}>
            Tạo trang chọn
          </button>
          <Link href="/dashboard/filter" className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text2)" }}>
            Lọc ảnh
          </Link>
          <a href={imgUrl("/dashboard/compress")} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text2)" }}>
            Nén ảnh
          </a>
          <button onClick={() => scrollTo(guideRef)} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text2)" }}>
            Hướng dẫn
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          {loggedIn ? (
            <Link href="/dashboard" className="btn-ghost px-4 py-2 text-[13.5px]">
              Bảng điều khiển
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost px-4 py-2 text-[13.5px]">
              Đăng nhập
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1340px] px-6 pt-[clamp(28px,5vw,56px)] md:px-10">
        <div ref={createRef} className="animate-[vkFade_.5s_ease_both]">
          <CreateHero />
          <CreateAlbumFlow />
        </div>

        {/* Usage guide */}
        <section ref={guideRef} className="mt-[clamp(48px,7vw,88px)] scroll-mt-20">
          <div className="mb-7">
            <p className="eyebrow mb-1.5">Hướng dẫn</p>
            <h2 className="font-serif text-[clamp(28px,4vw,44px)] font-medium leading-none">Cách sử dụng</h2>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {STEPS.map((s) => (
              <div key={s.title} className="card p-6">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)" }}>
                  <s.Icon size={20} />
                </span>
                <h3 className="mb-1.5 font-medium">{s.title}</h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text2)" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Send size={18} style={{ color: "var(--gold)" }} />
            <p className="text-[13.5px]" style={{ color: "var(--text2)" }}>
              Mẹo: thư mục Drive phải để chế độ chia sẻ <b style={{ color: "var(--text)" }}>“Anyone with the link”</b> thì hệ thống mới đọc được ảnh.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
