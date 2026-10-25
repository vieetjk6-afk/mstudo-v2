"use client";

import { Bot, Lightbulb, MessageSquare, ScrollText } from "lucide-react";
import { Callout, Field, PageHead, Section, Stack, inputCls } from "@/components/v2/kit";
import { SaveBarV2, ToastV2 } from "../services/settings-v2";
import { PLACEHOLDER, useChatboxConfig } from "./useChatboxConfig";

/* ═══════════════════════════════════════════════════════════════════════════
   CẤU HÌNH CHATBOX — giao diện mới. Cùng logic với ChatboxConfig
   (./useChatboxConfig). Khác ở cách sắp xếp:
     • Hai cột trên máy tính: bên trái hai khối soạn (Lời chào · Kiến thức, FAQ
       & luật trả lời), bên phải khung chat xem trước lời chào + mẹo viết.
     • Không còn nút Lưu cuối form: có thay đổi là hiện thanh Lưu dính đáy.
     • Key AI riêng của studio (chỉ chủ studio — page.tsx quyết định) thành
       khối riêng ở dưới.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_GREETING = "Xin chào! Studio có thể giúp gì cho anh/chị hôm nay?";

export default function ChatboxConfigV2({
  ownerId,
  greeting,
  instructions,
  aiKeys,
}: {
  ownerId: string;
  greeting: string;
  instructions: string;
  /** Khối key AI riêng (AiProvidersEditor) — chỉ chủ studio, page.tsx dựng sẵn. */
  aiKeys?: React.ReactNode;
}) {
  const c = useChatboxConfig({ ownerId, greeting, instructions });

  return (
    <Stack>
      <PageHead desc="Bot đã tự biết dịch vụ và bảng giá của studio — ở đây bạn bổ sung lời chào, chính sách, câu trả lời mẫu và giọng văn. Lưu là áp dụng ngay." />

      {c.err ? <Callout tone="red">{c.err}</Callout> : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section icon={MessageSquare} title="Lời chào mở đầu" desc="Câu bot chào khi khách mở khung chat. Để trống sẽ dùng lời chào mặc định.">
            <Field hint={<span className="v2-num">{c.g.length}/400</span>}>
              <input value={c.g} onChange={(e) => c.setG(e.target.value)} placeholder={DEFAULT_GREETING} className={inputCls} maxLength={400} aria-label="Lời chào mở đầu" />
            </Field>
          </Section>

          <Section
            icon={ScrollText}
            title="Kiến thức, FAQ & luật trả lời"
            desc="Viết tự nhiên: chính sách, thời gian giao, khu vực, khuyến mãi, câu hỏi hay gặp, giọng văn… Bot ưu tiên làm theo phần này."
          >
            <Field hint={<span className="v2-num">{c.ins.length}/8000 ký tự</span>}>
              <textarea
                value={c.ins}
                onChange={(e) => c.setIns(e.target.value)}
                placeholder={PLACEHOLDER}
                className={`${inputCls} !min-h-[380px] resize-y font-mono text-[13px] leading-relaxed`}
                maxLength={8000}
                aria-label="Kiến thức, FAQ và luật trả lời"
              />
            </Field>
          </Section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[84px]">
          <div className="v2-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: "var(--ac)", color: "#fff" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
                <Bot size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">Trợ lý tư vấn</p>
                <p className="text-[11.5px] opacity-80">Xem trước trên website</p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-4" style={{ background: "var(--sf2)" }}>
              <div className="max-w-[88%] rounded-[14px] rounded-tl-[4px] px-3.5 py-2.5 text-[13.5px]" style={{ background: "var(--sf)", border: "1px solid var(--bd2)" }}>
                {c.g.trim() || DEFAULT_GREETING}
              </div>
              <div className="ml-auto max-w-[80%] rounded-[14px] rounded-tr-[4px] px-3.5 py-2.5 text-[13.5px]" style={{ background: "var(--acS)", color: "var(--tx)" }}>
                Studio có nhận chụp ngoài trời không ạ?
              </div>
              <div className="max-w-[88%] rounded-[14px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--sf)", border: "1px solid var(--bd2)", color: "var(--tx3)" }}>
                Bot trả lời dựa trên dịch vụ, bảng giá và phần kiến thức bạn viết.
              </div>
            </div>
          </div>
          <Callout tone="blue" icon={Lightbulb} title="Mẹo viết">
            Viết ngắn gọn theo gạch đầu dòng. Không cần nhập lại dịch vụ hay bảng giá. Tránh ghi thông tin nhạy cảm (mật khẩu, tài khoản ngân hàng…).
          </Callout>
        </div>
      </div>

      {/* Khối key AI có sẵn khung + tiêu đề riêng, đặt thẳng vào luồng. */}
      {aiKeys ? <div className="min-w-0">{aiKeys}</div> : null}

      <SaveBarV2 show={c.dirty} label="Cấu hình chatbox có thay đổi chưa lưu" saving={c.saving} onSave={() => void c.save()} onReset={c.reset} saveLabel="Lưu cấu hình" />
      <ToastV2>{c.saved ? "Đã lưu — áp dụng ngay cho khách đang chat." : null}</ToastV2>
    </Stack>
  );
}
