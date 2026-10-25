"use client";

import { Check, MessageSquare } from "lucide-react";
import { PLACEHOLDER, useChatboxConfig } from "./useChatboxConfig";

export default function ChatboxConfig({
  ownerId,
  greeting,
  instructions,
}: {
  ownerId: string;
  greeting: string;
  instructions: string;
}) {
  // Logic dùng chung với bản mới (ChatboxConfigV2) — xem ./useChatboxConfig.
  const { g, setG, ins, setIns, saving, saved, err, save } = useChatboxConfig({ ownerId, greeting, instructions });

  return (
    <div className="mx-auto max-w-3xl page-in">
      <div className="mb-6">
        <p className="eyebrow mb-1.5 flex items-center gap-1.5"><MessageSquare size={13} /> Website</p>
        <h1 className="text-[19px] font-bold" style={{ letterSpacing: "-.4px" }}>Cấu hình chatbox</h1>
        <p className="mt-3 text-[15px]" style={{ color: "var(--text2)" }}>
          Dạy trợ lý trả lời theo ý bạn. Bot luôn biết dịch vụ &amp; bảng giá studio; ở đây bạn bổ
          sung lời chào, chính sách, câu trả lời mẫu và giọng văn. Lưu là áp dụng ngay.
        </p>
      </div>

      <div className="card p-6">
        <label className="mb-1.5 block text-sm font-medium">Lời chào mở đầu</label>
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
          Câu bot chào khi khách mở khung chat. Để trống sẽ dùng lời chào mặc định.
        </p>
        <input
          value={g}
          onChange={(e) => setG(e.target.value)}
          placeholder="Xin chào! Studio có thể giúp gì cho anh/chị hôm nay?"
          className="input"
          maxLength={400}
        />

        <label className="mb-1.5 mt-6 block text-sm font-medium">Kiến thức, FAQ &amp; luật trả lời</label>
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
          Viết tự nhiên: chính sách, thời gian giao, khu vực, khuyến mãi, câu hỏi hay gặp, giọng
          văn, điều nên/không nên nói… Bot sẽ ưu tiên làm theo phần này.
        </p>
        <textarea
          value={ins}
          onChange={(e) => setIns(e.target.value)}
          placeholder={PLACEHOLDER}
          className="input min-h-[320px] resize-y font-mono text-[13px] leading-relaxed"
          maxLength={8000}
        />
        <p className="mt-1 text-right text-[11.5px]" style={{ color: "var(--text3)" }}>{ins.length}/8000</p>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saved ? <Check size={15} /> : null} {saving ? "Đang lưu…" : saved ? "Đã lưu" : "Lưu cấu hình"}
          </button>
          {err && <span className="text-[13px]" style={{ color: "var(--danger)" }}>{err}</span>}
          {saved && <span className="text-[13px]" style={{ color: "var(--gold)" }}>Áp dụng ngay cho khách đang chat.</span>}
        </div>
      </div>

      <p className="mt-4 text-[12.5px]" style={{ color: "var(--text3)" }}>
        Mẹo: viết rõ ràng, ngắn gọn theo gạch đầu dòng. Không cần nhập lại dịch vụ/bảng giá — bot
        đã tự lấy từ hệ thống. Tránh ghi thông tin nhạy cảm (mật khẩu, tài khoản ngân hàng…).
      </p>
    </div>
  );
}
