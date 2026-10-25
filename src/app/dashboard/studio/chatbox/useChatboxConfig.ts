"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Cấu hình chatbox (bản cũ ChatboxConfig và bản
   mới ChatboxConfigV2): lời chào + kiến thức/FAQ, lưu vào website_chat_config.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Gợi ý trong ô kiến thức — dùng chung cho hai bản. */
export const PLACEHOLDER = `Ví dụ bạn có thể viết:

• Giọng văn: thân thiện, xưng "studio" và gọi khách là "anh/chị".
• Chính sách cọc: đặt cọc 30% để giữ lịch, hoàn cọc nếu báo trước 7 ngày.
• Thời gian giao ảnh: cưới 20-30 ngày, sự kiện 3-5 ngày.
• Khu vực nhận chụp: Quảng Ngãi và các tỉnh lân cận; ngoại tỉnh phụ thu đi lại.
• Khuyến mãi hiện tại: giảm 10% cho khách đặt trong tháng này.
• Câu hỏi hay gặp:
  - Hỏi "có quay flycam không?" → Có, báo giá riêng tùy buổi.
  - Hỏi "chụp ngoài trời được không?" → Được, tư vấn địa điểm theo mùa.
• Luôn mời khách để lại số điện thoại hoặc đặt lịch khi họ quan tâm.`;

export function useChatboxConfig({ ownerId, greeting, instructions }: { ownerId: string; greeting: string; instructions: string }) {
  const supabase = createClient();
  const [g, setG] = useState(greeting);
  const [ins, setIns] = useState(instructions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Bản đã lưu — để bản mới biết có thay đổi chưa lưu.
  const [base, setBase] = useState({ g: greeting, ins: instructions });
  const dirty = g !== base.g || ins !== base.ins;
  const reset = () => {
    setG(base.g);
    setIns(base.ins);
  };

  async function save() {
    setSaving(true);
    setErr(null);
    setSaved(false);
    const { error } = await supabase.from("website_chat_config").upsert(
      {
        owner_id: ownerId,
        greeting: g.trim() || null,
        instructions: ins.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );
    setSaving(false);
    if (error) {
      setErr("Lưu thất bại. Vui lòng thử lại.");
      return;
    }
    setBase({ g, ins });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return { g, setG, ins, setIns, saving, saved, err, dirty, reset, save };
}
