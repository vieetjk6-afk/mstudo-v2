"use client";

import { useState } from "react";
import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import WeddingRenderer from "@/app/thiep/[slug]/WeddingRenderer";
import PreviewPane from "@/app/thiep/sua/[token]/editor/PreviewPane";
import TemplateGallery from "@/app/thiep/sua/[token]/editor/TemplateGallery";
import { WEDDING_TEMPLATE_CATALOG } from "@/app/thiep/[slug]/templates";

/**
 * Xem trước BỘ MẪU THIỆP CƯỚI bằng dữ liệu giả — mười tấm thiệp điện thoại
 * (và bộ trang dài) xếp cạnh nhau trong khung 390px như cầm điện thoại.
 *
 * Vì sao cần: thiệp thật nằm sau Supabase + token chỉnh sửa, không mở bằng tay
 * được; màn này dựng thẳng component nên soát được màu, phông, khoảng cách và
 * cả các khối "thiếu dữ liệu" (chưa có ảnh, chưa có lời chúc).
 */

const PHOTO = (seed: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${seed * 47},45%,72%)"/><stop offset="1" stop-color="hsl(${seed * 47 + 40},40%,52%)"/></linearGradient></defs><rect width="600" height="800" fill="url(%23g)"/><circle cx="300" cy="330" r="120" fill="rgba(255,255,255,.35)"/><text x="300" y="720" font-family="sans-serif" font-size="44" fill="rgba(255,255,255,.85)" text-anchor="middle">ảnh ${seed}</text></svg>`,
  )}`;

const CONFIG: WeddingConfig = {
  bride_name: "Phương Nhi",
  groom_name: "Anh Tuấn",
  bride_role: "Trưởng nữ",
  groom_role: "Út nam",
  bride_subtitle: "Con Ông Đặng Văn Sơn và Bà Trịnh Thu Hà",
  groom_subtitle: "Con Ông Vũ Đình Hải và Bà Lê Thị Mai",
  bride_photo: PHOTO(3),
  groom_photo: PHOTO(4),
  bride_family: "Ông Đặng Văn Sơn\nBà Trịnh Thu Hà",
  groom_family: "Ông Vũ Đình Hải\nBà Lê Thị Mai",
  wedding_date: "2027-01-16",
  lunar_date: "Nhằm ngày 19 tháng Chạp năm Bính Ngọ",
  reception_time: "Đón khách từ 17:00",
  location: "Đà Lạt",
  cover_url: PHOTO(1),
  cover_quote: "Mười năm đi chung một con đường, hôm nay tụi mình xin phép rẽ vào cùng một nhà.",
  story: "2019 — chung một quán cà phê, khác bàn.\n2021 — chung một chuyến tàu về Đà Lạt.\n2027 — chung một cái tên trên tấm thiệp này.",
  gallery: [PHOTO(2), PHOTO(5), PHOTO(6), PHOTO(7), PHOTO(8), PHOTO(9)],
  events: [
    { label: "Lễ Vu quy", date: "2027-01-15", time: "08:00", venue: "Tư gia nhà gái", address: "42 Nguyễn Du, P.7, Đà Lạt" },
    { label: "Lễ Tân hôn", date: "2027-01-16", time: "11:00", venue: "Tư gia nhà trai", address: "9 Hồ Tùng Mậu, Đà Lạt" },
    { label: "Tiệc cưới", date: "2027-01-16", time: "17:30", venue: "Dalat Palace Heritage", address: "2 Trần Phú, Phường 3, TP. Đà Lạt" },
  ],
  venue_name: "Dalat Palace Heritage",
  venue_address: "2 Trần Phú, Phường 3, TP. Đà Lạt",
  map_url: "https://www.google.com/maps?q=Dalat+Palace+Heritage",
  dress_code: ["#f3e4d7", "#c98a93", "#7f6a5b"],
  dress_code_note: "Kem · hồng sen",
  hashtag: "#NhiVeNhaTuan",
  parking_note: "Bãi B, lối vào Hồ Tùng Mậu — miễn phí",
  hotline: "0903 221 118 (chị Hạnh)",
  closing_line: "Hân hạnh được đón tiếp",
  thanks_note: "Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại.",
  thanks_photo: PHOTO(10),
  gift_enabled: true,
  gift_note: "Sự hiện diện của bạn đã là món quà quý nhất với tụi mình.",
  bride_bank: { holder: "DANG PHUONG NHI", account: "0601160127", bin: "970403", name: "Sacombank" },
  guest_greeting: "Trân trọng kính mời",
  rsvp_enabled: true,
  guestbook_enabled: true,
};

const WISHES = [
  { guest_name: "Minh Khoa", wish: "Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long!", created_at: "" },
  { guest_name: "Thu Hà", wish: "Mừng đám cưới của tụi em, sớm có tin vui nha!", created_at: "" },
];

export default function ThiepDemo() {
  const [guest, setGuest] = useState(true);
  const [empty, setEmpty] = useState(false);

  const config: WeddingConfig = empty
    ? { bride_name: "Phương Nhi", groom_name: "Anh Tuấn", wedding_date: "2027-01-16" }
    : CONFIG;

  return (
    <div style={{ background: "#ece7dd", minHeight: "100vh", padding: "20px 16px 80px" }}>
      <style>{`
        /* Khung giả lập điện thoại: thiệp thật cao 100vh, ở đây bó lại 840px. */
        .thiep-demo main { min-height: 0 !important; }
        .thiep-demo { width: 390px; height: 840px; overflow: hidden auto; border-radius: 18px; box-shadow: 0 20px 40px -18px rgba(60,50,40,.5); background: #fff; scrollbar-width: none; }
      `}</style>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, fontSize: 13, fontFamily: "system-ui" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={guest} onChange={(e) => setGuest(e.target.checked)} /> có tên khách mời
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> thiệp mới tinh (chưa nhập gì)
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        {WEDDING_TEMPLATE_CATALOG.filter((t) => t.group === "phone").map((t) => {
          const inv = { id: t.name, owner_id: "", contract_id: null, slug: "demo", edit_token: "demo", template: t.name, config, published: true, created_at: "", updated_at: "" } as WeddingInvitation;
          return (
            <div key={t.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: "system-ui", fontSize: 13, color: "#5f594e" }}>
                <b>{t.label}</b> — {t.tagline} <code style={{ fontSize: 11, color: "#8a8274" }}>{t.name}</code>
              </div>
              <div className="thiep-demo">
                <WeddingRenderer inv={inv} wishes={empty ? [] : WISHES} guest={guest ? "Chị Ngọc Hân" : ""} preview />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Khung XEM TRƯỚC của trình chỉnh sửa (cột phải) + bộ chọn mẫu (cột trái) với
 * dữ liệu giả: soát được đúng thứ khó mở bằng tay nhất — thiệp render bên
 * trong iframe, đổi mẫu là khung bên cạnh đổi theo ngay.
 */
export function ThiepEditorDemo() {
  const [template, setTemplate] = useState("sen");
  const inv = { id: "demo", owner_id: "", contract_id: null, slug: "demo", edit_token: "demo", template, config: CONFIG, published: true, created_at: "", updated_at: "" } as WeddingInvitation;
  return (
    <div style={{ display: "flex", gap: 0, height: "100vh", background: "#fafaf9", fontFamily: "system-ui" }}>
      <div style={{ flex: "1 1 58%", overflow: "auto", padding: 16 }}>
        <TemplateGallery value={template} onChange={setTemplate} cover={CONFIG.cover_url} bride="Phương Nhi" groom="Anh Tuấn" />
      </div>
      <div style={{ flex: "0 0 42%", borderLeft: "1px solid #e7e5e4", background: "#fff" }}>
        <PreviewPane inv={inv} wishes={WISHES} guest="Chị Ngọc Hân" publicUrl="/thiep/demo" />
      </div>
    </div>
  );
}
