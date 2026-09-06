"use client";

import { useState } from "react";
import { Phone, MessageCircle, ChevronDown, Check, RotateCcw, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";

export interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  interest: string | null;
  transcript: { role: "user" | "assistant"; content: string }[] | null;
  status: "new" | "contacted" | "closed";
  created_at: string;
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function zaloUrl(phone: string): string {
  return `https://zalo.me/${phone.replace(/\D/g, "")}`;
}

export default function LeadsView({ leads }: { leads: Lead[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Lead[]>(leads);
  const [openId, setOpenId] = useState<string | null>(null);

  async function setStatus(id: string, status: Lead["status"]) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("website_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  }

  const newCount = rows.filter((r) => r.status === "new").length;

  if (rows.length === 0) {
    return (
      <div className="page-in max-w-[760px]">
        <Panel>
          <EmptyState
            icon={Inbox}
            title="Chưa có yêu cầu nào"
            hint="Khách để lại số điện thoại qua chatbox trên website sẽ hiện ở đây, kèm báo Zalo cho bạn."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page-in max-w-[760px]">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Khách nhắn từ website và chatbox. Gọi hoặc nhắn Zalo lại rồi đánh dấu đã liên hệ.
        </p>
        {newCount > 0 && (
          <span className="flex-none rounded-[20px] px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            {newCount} yêu cầu mới
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {rows.map((r) => {
          const open = openId === r.id;
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name || "Khách (chưa cho tên)"}</span>
                    {r.status === "new" && (
                      <span className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>mới</span>
                    )}
                    {r.status === "contacted" && (
                      <span className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--gnS)", color: "var(--gn)" }}>đã liên hệ</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px]" style={{ color: "var(--text3)" }}>
                    {fmt(r.created_at)}
                    {r.interest && <> · {r.interest.slice(0, 80)}</>}
                  </div>
                </div>

                {r.phone && (
                  <div className="flex items-center gap-2">
                    <a href={`tel:${r.phone}`} className="btn-ghost px-2.5 py-1.5 text-xs" title="Gọi">
                      <Phone size={14} /> {r.phone}
                    </a>
                    <a href={zaloUrl(r.phone)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs" title="Nhắn Zalo">
                      <MessageCircle size={14} /> Zalo
                    </a>
                  </div>
                )}

                <button onClick={() => setOpenId(open ? null : r.id)} className="btn-ghost px-2.5 py-1.5 text-xs">
                  Hội thoại <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>

                {r.status === "new" ? (
                  <button onClick={() => setStatus(r.id, "contacted")} className="btn-primary px-2.5 py-1.5 text-xs">
                    <Check size={14} /> Đã liên hệ
                  </button>
                ) : (
                  <button onClick={() => setStatus(r.id, "new")} className="btn-ghost px-2.5 py-1.5 text-xs" title="Đánh dấu lại là mới">
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              {open && (
                <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
                  {(r.transcript ?? []).length === 0 ? (
                    <p className="text-[13px]" style={{ color: "var(--text3)" }}>Không có nội dung hội thoại.</p>
                  ) : (
                    <div className="grid gap-2">
                      {(r.transcript ?? []).map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] leading-relaxed"
                            style={
                              m.role === "user"
                                ? { background: "var(--ac)", color: "#fff" }
                                : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }
                            }
                          >
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
