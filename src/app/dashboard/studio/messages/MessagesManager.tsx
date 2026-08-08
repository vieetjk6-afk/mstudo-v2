"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { useUndoToast } from "@/components/studio/UndoToast";
import type { MessageTemplate } from "@/lib/types";

const SAMPLE_TEMPLATES: { title: string; body: string }[] = [
  { title: "Nhắc lịch chụp", body: "Chào anh/chị {tên}, studio xin nhắc lịch chụp ngày {ngày} lúc {giờ} tại {địa điểm}. Anh/chị chuẩn bị giúp em & có mặt đúng giờ nhé. Hẹn gặp anh/chị ạ! 📸" },
  { title: "Xác nhận đặt cọc", body: "Em đã nhận cọc {số tiền} cho hợp đồng \"{tên HĐ}\". Cảm ơn anh/chị, studio đã giữ lịch ngày {ngày} cho mình ạ." },
  { title: "Nhắc thanh toán", body: "Anh/chị ơi, hợp đồng \"{tên HĐ}\" còn lại {số tiền}. Anh/chị thanh toán giúp em trước ngày {ngày} nhé. Em gửi mã QR/STK ở cổng hợp đồng ạ. Cảm ơn anh/chị!" },
  { title: "Giao ảnh", body: "Ảnh của anh/chị đã hoàn thiện! Mời anh/chị xem & tải tại: {link}. Nếu cần chỉnh thêm anh/chị nhắn em trong 7 ngày nhé ạ." },
  { title: "Xin đánh giá", body: "Cảm ơn anh/chị đã tin tưởng studio! Anh/chị dành chút thời gian đánh giá giúp em tại {link} (mục \"Đánh giá studio\") nhé, em rất trân trọng ạ. 🙏" },
  { title: "Mời khách cũ quay lại", body: "Đã lâu chưa được phục vụ anh/chị. Studio đang có ưu đãi riêng cho khách cũ, anh/chị có dịp nào muốn chụp lại (sinh nhật, kỷ niệm…) thì nhắn em nhé ạ!" },
  { title: "Gửi bảng giá", body: "Dạ studio gửi anh/chị bảng giá các gói: {link}. Anh/chị xem rồi cho em biết gói phù hợp để em tư vấn thêm nhé ạ." },
  { title: "Nhắc chọn ảnh", body: "Anh/chị ơi, album chọn ảnh đã sẵn sàng tại {link}. Anh/chị chọn giúp em những tấm ưng ý nhất để bên em tiến hành chỉnh sửa nhé. Cảm ơn anh/chị ạ!" },
];

export default function MessagesManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: MessageTemplate[];
}) {
  const supabase = createClient();
  const { run, view } = useUndoToast();
  const [list, setList] = useState<MessageTemplate[]>(initial);
  const [f, setF] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function add() {
    if (!f.body.trim()) return;
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
    }
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

  /** Xoá có hoàn tác: hàng biến mất ngay, 5 giây sau mới xoá thật. */
  function remove(id: string) {
    const idx = list.findIndex((m) => m.id === id);
    const row = list[idx];
    if (!row) return;
    setList((p) => p.filter((m) => m.id !== id));
    run({
      label: `Đã xoá mẫu “${row.title || "chưa đặt tên"}”`,
      commit: async () => { await supabase.from("message_templates").delete().eq("id", id); },
      undo: () => setList((p) => { const n = [...p]; n.splice(idx, 0, row); return n; }),
    });
  }

  function copy(m: MessageTemplate) {
    navigator.clipboard?.writeText(m.body);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="page-in">
      {view}
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
