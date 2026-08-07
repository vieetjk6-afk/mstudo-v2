"use client";

import { useState } from "react";
import { Check, MessageSquare, Bot, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel } from "@/components/studio/ui";

const PLACEHOLDER = `Ví dụ bạn có thể viết:

• Giọng văn: thân thiện, xưng "studio" và gọi khách là "anh/chị".
• Chính sách cọc: đặt cọc 30% để giữ lịch, hoàn cọc nếu báo trước 7 ngày.
• Thời gian giao ảnh: cưới 20-30 ngày, sự kiện 3-5 ngày.
• Khu vực nhận chụp: Quảng Ngãi và các tỉnh lân cận; ngoại tỉnh phụ thu đi lại.
• Khuyến mãi hiện tại: giảm 10% cho khách đặt trong tháng này.
• Câu hỏi hay gặp:
  - Hỏi "có quay flycam không?" → Có, báo giá riêng tùy buổi.
  - Hỏi "chụp ngoài trời được không?" → Được, tư vấn địa điểm theo mùa.
• Luôn mời khách để lại số điện thoại hoặc đặt lịch khi họ quan tâm.`;

export default function ChatboxConfig({
  ownerId,
  greeting,
  instructions,
}: {
  ownerId: string;
  greeting: string;
  instructions: string;
}) {
  const supabase = createClient();
  const [g, setG] = useState(greeting);
  const [ins, setIns] = useState(instructions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  /* Bot đã tự biết những khối này — nói rõ để studio không nhập lại. */
  const KNOWN: [string, string][] = [
    ["Dịch vụ studio", "Lấy từ mục Dịch vụ & điều khoản"],
    ["Bảng giá & gói chụp", "Lấy từ mục Gói & bảng giá"],
    ["Lịch còn trống", "Lấy từ Lịch làm việc"],
    ["Đặt lịch & để lại số", "Bot tự tạo yêu cầu mới"],
  ];

  return (
    <div className="page-in grid max-w-[1000px] items-start gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ══ Cột trái — kiến thức và luật trả lời ═════════════════════════ */}
      <Panel className="px-[18px] py-4">
        <div className="mb-3.5 flex items-center gap-[11px]">
          <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
            <Bot size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Trợ lý chatbox</p>
            <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>Trả lời khách 24/7 theo kịch bản của bạn</p>
          </div>
        </div>

        <label className="label mb-1 block uppercase">Lời chào mở đầu</label>
        <input
          value={g}
          onChange={(e) => setG(e.target.value)}
          placeholder="Xin chào! Studio có thể giúp gì cho anh/chị hôm nay?"
          className="input w-full"
          maxLength={400}
        />
        <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
          Câu bot chào khi khách mở khung chat. Để trống thì dùng lời chào mặc định.
        </p>

        <label className="label mb-1 mt-4 block uppercase">Kiến thức, FAQ &amp; luật trả lời</label>
        <textarea
          value={ins}
          onChange={(e) => setIns(e.target.value)}
          placeholder={PLACEHOLDER}
          className="input min-h-[320px] w-full resize-y font-mono text-[12.5px] leading-[1.6]"
          maxLength={8000}
        />
        <p className="tnum mt-1 text-right text-[11px]" style={{ color: "var(--tx3)" }}>{ins.length}/8000</p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: saved ? "var(--gn)" : "var(--ac)", color: "#fff" }}
          >
            {saved ? <Check size={15} /> : null} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu cấu hình"}
          </button>
          {err && <span className="text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</span>}
          {saved && <span className="text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>Áp dụng ngay cho khách đang chat.</span>}
        </div>
      </Panel>

      {/* ══ Cột phải — trang web và những gì bot đã biết ═════════════════ */}
      <div className="flex flex-col gap-3.5">
        <Panel className="px-[18px] py-4">
          <div className="flex items-center gap-[11px]">
            <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--gnS)", color: "var(--gn)", lineHeight: 0 }}>
              <Globe size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">Trang web của bạn</p>
              <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>Chatbox chạy trên chính trang này</p>
            </div>
          </div>
          <a
            href="/dashboard/site"
            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-semibold"
            style={{ background: "var(--acS)", color: "var(--ac)" }}
          >
            Sửa giao diện trang →
          </a>
        </Panel>

        <Panel className="px-[18px] py-4">
          <p className="text-[13.5px] font-bold">Bot đã tự biết sẵn</p>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Không cần nhập lại những mục dưới đây — bot đọc thẳng từ hệ thống.
          </p>
          <div className="mt-3 grid gap-2">
            {KNOWN.map(([n, src]) => (
              <div key={n} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5" style={{ border: "1px solid var(--bd)" }}>
                <Check size={16} className="flex-none" style={{ color: "var(--gn)" }} />
                <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{n}</span>
                <span className="flex-none text-[10.5px]" style={{ color: "var(--tx3)" }}>{src}</span>
              </div>
            ))}
          </div>
          <p className="mt-3.5 rounded-[10px] px-3.5 py-3 text-[11.5px] leading-[1.55]" style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}>
            <MessageSquare size={12} className="mr-1 inline" />
            Viết luật theo gạch đầu dòng, ngắn và rõ. Tránh ghi thông tin nhạy cảm (mật khẩu, số tài khoản) — bot có thể đọc lại cho khách.
          </p>
        </Panel>
      </div>
    </div>
  );
}
