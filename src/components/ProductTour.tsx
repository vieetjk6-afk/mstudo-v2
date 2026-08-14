"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft, HelpCircle, Check } from "lucide-react";

// Tăng version khi muốn tour tự hiện lại cho mọi người sau khi cập nhật nội dung.
const TOUR_KEY = "mstudo_tour_v1";

type Step = { emoji: string; title: string; body: string; href?: string; cta?: string };

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Chào mừng đến mstudo",
    body: "Nền tảng quản lý studio ảnh & cưới tất-cả-trong-một: album chọn ảnh, giao khách, bảng giá, đặt lịch, hợp đồng và website riêng. Dạo nhanh 6 bước để bắt đầu nhé!",
  },
  {
    emoji: "🖼️",
    title: "Tạo album chọn ảnh",
    body: "Thêm link Google Drive (file hoặc folder) để tạo album. Khách xem ảnh có watermark, chọn ảnh theo giới hạn, rồi gửi danh sách về cho bạn. Ảnh của bạn vẫn nằm trên Drive.",
    href: "/dashboard/create",
    cta: "Tạo album",
  },
  {
    emoji: "🏷️",
    title: "Phân loại & trưng bày album",
    body: "Đặt “Loại album” (Cưới, Sự kiện, Doanh nghiệp…) để nhóm và hiển thị riêng từng loại. Tick “Hiện ở trang chủ” để album lên trang công khai/website của bạn.",
    href: "/dashboard/studio/album-categories",
    cta: "Quản lý loại album",
  },
  {
    emoji: "💰",
    title: "Bảng giá & Đặt lịch",
    body: "Nhập bảng giá các gói dịch vụ; khách xem bảng giá và đặt lịch trực tuyến. Mọi yêu cầu đặt lịch về thẳng bảng điều khiển của bạn.",
    href: "/dashboard/studio/pricing",
    cta: "Nhập bảng giá",
  },
  {
    emoji: "🌐",
    title: "Website riêng cho studio",
    body: "Bật trang portfolio/website với tên miền hoặc subdomain riêng — trưng bày album, bảng giá và nhận đặt lịch, không cần biết code.",
    href: "/dashboard/site",
    cta: "Thiết lập website",
  },
  {
    emoji: "📄",
    title: "Hợp đồng, báo giá & khách hàng",
    body: "Soạn hợp đồng, gửi báo giá, quản lý khách và lịch chụp ngay trong mstudo. Cần trợ giúp lại? Bấm nút “?” ở góc phải bất cứ lúc nào.",
    href: "/dashboard/studio",
    cta: "Vào bảng điều khiển",
  },
];

export default function ProductTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  // Tự mở lần đầu (chưa hoàn thành/bỏ qua tour).
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function finish() {
    try {
      localStorage.setItem(TOUR_KEY, "done");
    } catch {
      /* ignore */
    }
    setOpen(false);
    setI(0);
  }

  function replay() {
    setI(0);
    setOpen(true);
  }

  // Cho phép đóng hướng dẫn bằng phím Esc (giống ShareDialog).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <>
      {/* Nút mở lại hướng dẫn */}
      <button
        type="button"
        onClick={replay}
        aria-label="Hướng dẫn sử dụng"
        title="Hướng dẫn sử dụng"
        // Vị trí nằm ở lớp .help-fab để có media query nhấc nút lên khỏi thanh
        // tab đáy trên điện thoại — style inline không viết được media query.
        className="help-fab"
        style={{
          width: 46, height: 46, borderRadius: 999, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--accent)", display: "grid", placeItems: "center",
          boxShadow: "0 10px 30px -12px rgba(0,0,0,.5)", cursor: "pointer",
        }}
      >
        <HelpCircle size={22} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && finish()}
          style={{
            position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center",
            background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", padding: 20,
          }}
        >
          <div
            style={{
              width: "100%", maxWidth: 460, borderRadius: 18, overflow: "hidden",
              background: "var(--surface)", border: "1px solid var(--border)",
              boxShadow: "0 30px 70px -20px rgba(0,0,0,.6)",
            }}
          >
            <div style={{ padding: "26px 26px 0", position: "relative" }}>
              <button
                type="button" onClick={finish} aria-label="Đóng"
                style={{ position: "absolute", top: 16, right: 16, background: "none", border: 0, color: "var(--text3)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
              <div style={{ fontSize: 40, lineHeight: 1 }}>{step.emoji}</div>
              <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "var(--accent)" }}>{step.title}</h2>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--text2)" }}>{step.body}</p>
              {step.href && (
                <a href={step.href} className="btn-ghost" style={{ marginTop: 16, display: "inline-flex", gap: 7 }} onClick={finish}>
                  {step.cta} <ArrowRight size={15} />
                </a>
              )}
            </div>

            {/* Chấm tiến trình */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "22px 0 0" }}>
              {STEPS.map((_, idx) => (
                <span key={idx} style={{
                  width: idx === i ? 22 : 7, height: 7, borderRadius: 99,
                  background: idx === i ? "var(--accent)" : "var(--border)", transition: "all .2s",
                }} />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "18px 22px 22px" }}>
              <button type="button" className="btn-ghost text-xs" onClick={finish}>Bỏ qua</button>
              <div style={{ display: "flex", gap: 8 }}>
                {i > 0 && (
                  <button type="button" className="btn-ghost" onClick={() => setI((v) => v - 1)} style={{ gap: 6 }}>
                    <ArrowLeft size={15} /> Trước
                  </button>
                )}
                {last ? (
                  <button type="button" className="btn-primary" onClick={finish} style={{ gap: 6 }}>
                    Bắt đầu <Check size={15} />
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => setI((v) => v + 1)} style={{ gap: 6 }}>
                    Tiếp <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
