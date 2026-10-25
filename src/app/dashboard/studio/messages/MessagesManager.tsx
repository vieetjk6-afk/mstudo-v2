"use client";

import { Plus, Trash2, Copy, Check, Sparkles } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import type { MessageTemplate } from "@/lib/types";
import { useMessages } from "./useMessages";

export default function MessagesManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: MessageTemplate[];
}) {
  // Logic dùng chung với bản mới (MessagesV2) — xem ./useMessages.
  const { list, f, setF, busy, copiedId, add, seedSamples, remove, copy } = useMessages(ownerId, initial);

  return (
    <div className="page-in">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Tin soạn sẵn (nhắc lịch, xin đánh giá, nhắc công nợ…) để chép nhanh gửi Zalo / Messenger / email.
      </p>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <Panel className="h-fit p-[18px]">
          <h2 className="mb-3.5 text-[14px] font-bold">Thêm mẫu tin</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="field sm:col-span-1"><label className="label">Tiêu đề</label><input className="input" value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="field field-top sm:col-span-2"><label className="label">Nội dung</label><textarea className="input min-h-[120px]" value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} /></div>
            </div>
            <button
              onClick={add}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
            >
              <Plus size={16} /> {busy ? "Đang lưu…" : "Lưu mẫu"}
            </button>
            <button
              onClick={seedSamples}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
            >
              <Sparkles size={16} /> Thêm 8 mẫu có sẵn
            </button>
            <p className="text-[11px]" style={{ color: "var(--tx3)" }}>Mẫu dùng các chỗ trống như {"{tên}"}, {"{ngày}"}, {"{số tiền}"}, {"{link}"} — sửa lại khi gửi.</p>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          {list.length === 0 ? (
            <Panel>
              <EmptyState icon={Sparkles} title="Chưa có mẫu tin nào" hint='Bấm "Thêm 8 mẫu có sẵn" để có ngay bộ tin nhắc lịch, nhắc cọc, giao ảnh, xin đánh giá.' />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((m) => (
                <Panel key={m.id} className="px-4 py-3.5">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-bold">{m.title}</p>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => copy(m)}
                        className="flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
                        style={copiedId === m.id ? { background: "var(--gnS)", color: "var(--gn)" } : { border: "1px solid var(--bd)" }}
                      >
                        {copiedId === m.id ? <Check size={14} /> : <Copy size={14} />} {copiedId === m.id ? "Đã chép" : "Chép"}
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        aria-label="Xoá mẫu"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]"
                        style={{ border: "1px solid var(--bd)", color: "var(--tx3)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-[1.6]" style={{ color: "var(--tx2)" }}>{m.body}</p>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
