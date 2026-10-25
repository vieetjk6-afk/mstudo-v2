"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageTemplate } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Mẫu tin nhắn" (bản cũ MessagesManager và bản mới
   MessagesV2): danh sách mẫu, thêm mẫu, thêm bộ mẫu có sẵn, chép, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SAMPLE_TEMPLATES: { title: string; body: string }[] = [
  { title: "Nhắc lịch chụp", body: "Chào anh/chị {tên}, studio xin nhắc lịch chụp ngày {ngày} lúc {giờ} tại {địa điểm}. Anh/chị chuẩn bị giúp em & có mặt đúng giờ nhé. Hẹn gặp anh/chị ạ! 📸" },
  { title: "Xác nhận đặt cọc", body: "Em đã nhận cọc {số tiền} cho hợp đồng \"{tên HĐ}\". Cảm ơn anh/chị, studio đã giữ lịch ngày {ngày} cho mình ạ." },
  { title: "Nhắc thanh toán", body: "Anh/chị ơi, hợp đồng \"{tên HĐ}\" còn lại {số tiền}. Anh/chị thanh toán giúp em trước ngày {ngày} nhé. Em gửi mã QR/STK ở cổng hợp đồng ạ. Cảm ơn anh/chị!" },
  { title: "Giao ảnh", body: "Ảnh của anh/chị đã hoàn thiện! Mời anh/chị xem & tải tại: {link}. Nếu cần chỉnh thêm anh/chị nhắn em trong 7 ngày nhé ạ." },
  { title: "Xin đánh giá", body: "Cảm ơn anh/chị đã tin tưởng studio! Anh/chị dành chút thời gian đánh giá giúp em tại {link} (mục \"Đánh giá studio\") nhé, em rất trân trọng ạ. 🙏" },
  { title: "Mời khách cũ quay lại", body: "Đã lâu chưa được phục vụ anh/chị. Studio đang có ưu đãi riêng cho khách cũ, anh/chị có dịp nào muốn chụp lại (sinh nhật, kỷ niệm…) thì nhắn em nhé ạ!" },
  { title: "Gửi bảng giá", body: "Dạ studio gửi anh/chị bảng giá các gói: {link}. Anh/chị xem rồi cho em biết gói phù hợp để em tư vấn thêm nhé ạ." },
  { title: "Nhắc chọn ảnh", body: "Anh/chị ơi, album chọn ảnh đã sẵn sàng tại {link}. Anh/chị chọn giúp em những tấm ưng ý nhất để bên em tiến hành chỉnh sửa nhé. Cảm ơn anh/chị ạ!" },
];

export function useMessages(ownerId: string, initial: MessageTemplate[]) {
  const supabase = createClient();
  const [list, setList] = useState<MessageTemplate[]>(initial);
  const [f, setF] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /** Lưu mẫu mới. Trả true khi lưu được (bản mới đóng trình soạn theo kết quả này). */
  async function add() {
    if (!f.body.trim()) return false;
    setBusy(true);
    const { data, error } = await supabase
      .from("message_templates")
      .insert({ owner_id: ownerId, title: f.title.trim() || "Mẫu", body: f.body.trim() })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setList((p) => [data as MessageTemplate, ...p]);
      setF({ title: "", body: "" });
      return data as MessageTemplate;
    }
    return false;
  }

  async function seedSamples() {
    setBusy(true);
    const { data, error } = await supabase
      .from("message_templates")
      .insert(SAMPLE_TEMPLATES.map((t) => ({ owner_id: ownerId, title: t.title, body: t.body })))
      .select("*");
    setBusy(false);
    if (!error && data) setList((p) => [...(data as MessageTemplate[]), ...p]);
  }

  async function remove(id: string) {
    await supabase.from("message_templates").delete().eq("id", id);
    setList((p) => p.filter((m) => m.id !== id));
  }

  function copy(m: MessageTemplate) {
    navigator.clipboard?.writeText(m.body);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return { list, f, setF, busy, copiedId, add, seedSamples, remove, copy };
}
