"use client";

import { useMemo, useState } from "react";
import { Check, Copy, MessageCircle, MessageSquareText, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { Empty, Field, PageHead, Stack, btn, inputCls } from "@/components/v2/kit";
import { Menu, SearchInput, Tabs } from "@/components/v2/kit-client";
import { noAccent } from "@/lib/studio-nav";
import type { MessageTemplate } from "@/lib/types";
import { PaneItemV2 } from "../services/settings-v2";
import { SAMPLE_TEMPLATES, useMessages } from "./useMessages";
import ZaloPanelV2 from "./ZaloPanelV2";

/* ═══════════════════════════════════════════════════════════════════════════
   MẪU TIN NHẮN — giao diện mới. Cùng dữ liệu, cùng thao tác với MessagesManager
   + ZaloPanel (bản cũ xếp chồng hai khối trên một trang). Khác ở cách sắp xếp:
     • Hai tab: Mẫu tin nhắn (việc hằng ngày) · Zalo tự động (cài một lần).
     • Mẫu tin là màn "danh sách | xem": cột trái các mẫu (có ô tìm), cột phải
       nội dung mẫu đang chọn với chỗ trống {tên}, {ngày}… được tô nổi và MỘT
       nút "Chép nội dung". Thêm mẫu mở trình soạn ngay ở cột phải, có nút chèn
       nhanh các chỗ trống.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "templates" | "zalo";
const SLOTS = ["{tên}", "{ngày}", "{giờ}", "{địa điểm}", "{số tiền}", "{tên HĐ}", "{link}"];

/** Tô nổi các chỗ trống {…} trong nội dung mẫu. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(\{[^{}\n]{1,24}\})/g);
  return (
    <p className="whitespace-pre-wrap text-[14px] leading-[1.7]" style={{ color: "var(--tx)" }}>
      {parts.map((p, i) =>
        /^\{[^{}\n]{1,24}\}$/.test(p) ? (
          <span key={i} className="rounded-[6px] px-1 font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

export default function MessagesV2({ ownerId, initial }: { ownerId: string; initial: MessageTemplate[] }) {
  const m = useMessages(ownerId, initial);
  const [tab, setTab] = useState<Tab>("templates");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [composing, setComposing] = useState(false);

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return n ? m.list.filter((x) => noAccent(`${x.title} ${x.body}`).includes(n)) : m.list;
  }, [m.list, q]);
  const sel = m.list.find((x) => x.id === selId) ?? (composing ? null : m.list[0] ?? null);

  async function save() {
    const created = await m.add();
    if (created) {
      setSelId(created.id);
      setComposing(false);
    }
  }

  const seedItem = {
    label: `Thêm ${SAMPLE_TEMPLATES.length} mẫu có sẵn`,
    hint: "Nhắc lịch, nhắc cọc, giao ảnh, xin đánh giá…",
    icon: Sparkles,
    disabled: m.busy,
    onClick: () => void m.seedSamples(),
  };

  return (
    <Stack>
      <PageHead
        desc={
          tab === "templates"
            ? "Tin soạn sẵn để chép nhanh gửi khách qua Zalo, Messenger hay email — sửa chỗ trống {tên}, {ngày}… khi gửi."
            : "Studio tự nhắn khách và thợ ở các mốc hợp đồng qua Zalo."
        }
        actions={
          tab === "templates" ? (
            <>
              <Menu label="Thêm mẫu có sẵn" width={260} items={[seedItem]} />
              {/* Nút chính của màn là "Chép nội dung" — thêm mẫu là thao tác phụ. */}
              <button type="button" onClick={() => setComposing(true)} className={btn("secondary")}>
                <Plus size={17} /> Thêm mẫu tin
              </button>
            </>
          ) : null
        }
      />

      <Tabs<Tab>
        label="Mẫu tin nhắn"
        value={tab}
        onChange={setTab}
        options={[
          { value: "templates", label: "Mẫu tin nhắn", icon: MessageSquareText, count: m.list.length },
          { value: "zalo", label: "Zalo tự động", icon: MessageCircle },
        ]}
      />

      {tab === "zalo" ? (
        <ZaloPanelV2 />
      ) : m.list.length === 0 && !composing ? (
        <div className="v2-card">
          <Empty
            icon={MessageSquareText}
            title="Chưa có mẫu tin nào"
            hint="Thêm bộ mẫu có sẵn để có ngay tin nhắc lịch, nhắc cọc, giao ảnh, xin đánh giá — hoặc tự soạn mẫu riêng."
            action={
              <>
                <button type="button" onClick={() => void m.seedSamples()} disabled={m.busy} className={btn("soft")}>
                  <Sparkles size={16} /> Thêm {SAMPLE_TEMPLATES.length} mẫu có sẵn
                </button>
                <button type="button" onClick={() => setComposing(true)} className={btn("secondary")}>
                  <Plus size={16} /> Tự soạn mẫu
                </button>
              </>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="v2-card overflow-hidden lg:sticky lg:top-[84px]">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <SearchInput value={q} onChange={setQ} placeholder="Tìm mẫu tin…" className="w-full" />
            </div>
            <div className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-240px)]">
              {shown.length === 0 ? (
                <Empty compact icon={Search} title="Không có mẫu nào khớp" />
              ) : (
                shown.map((x) => (
                  <PaneItemV2
                    key={x.id}
                    icon={MessageSquareText}
                    active={!composing && sel?.id === x.id}
                    onClick={() => {
                      setComposing(false);
                      setSelId(x.id);
                    }}
                    title={x.title}
                    sub={x.body}
                  />
                ))
              )}
            </div>
          </div>

          {composing ? (
            <section className="v2-card">
              <header className="v2-section-head">
                <span className="v2-section-icon"><Plus size={17} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="v2-section-title">Mẫu tin mới</h3>
                  <p className="v2-section-desc">Dùng chỗ trống để sửa nhanh khi gửi.</p>
                </div>
              </header>
              <div className="v2-card-pad flex flex-col gap-4">
                <Field label="Tiêu đề" hint="Để trống sẽ đặt là “Mẫu”.">
                  <input className={inputCls} value={m.f.title} onChange={(e) => m.setF((p) => ({ ...p, title: e.target.value }))} placeholder="VD: Nhắc lịch chụp" autoFocus />
                </Field>
                <Field label="Nội dung">
                  <textarea
                    className={`${inputCls} !min-h-[200px]`}
                    value={m.f.body}
                    onChange={(e) => m.setF((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Chào anh/chị {tên}, studio xin nhắc lịch chụp ngày {ngày}…"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chèn chỗ trống</span>
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => m.setF((p) => ({ ...p, body: `${p.body}${p.body && !p.body.endsWith(" ") ? " " : ""}${s}` }))}
                      className="inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-semibold"
                      style={{ background: "var(--acS)", color: "var(--ac)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setComposing(false)} className={btn("ghost")}>
                    <X size={16} /> Huỷ
                  </button>
                  <button type="button" onClick={() => void save()} disabled={m.busy || !m.f.body.trim()} className={btn("primary")}>
                    <Check size={16} /> {m.busy ? "Đang lưu…" : "Lưu mẫu"}
                  </button>
                </div>
              </div>
            </section>
          ) : sel ? (
            <section className="v2-card">
              <header className="v2-section-head">
                <span className="v2-section-icon"><MessageSquareText size={17} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="v2-section-title truncate">{sel.title}</h3>
                  <p className="v2-section-desc">{sel.body.length} ký tự</p>
                </div>
                <Menu
                  label={`Thao tác với mẫu ${sel.title}`}
                  items={[
                    {
                      label: "Xoá mẫu",
                      icon: Trash2,
                      danger: true,
                      onClick: () => {
                        if (confirm(`Xoá mẫu “${sel.title}”?`)) void m.remove(sel.id);
                      },
                    },
                  ]}
                />
              </header>
              <div className="v2-card-pad flex flex-col gap-4">
                <div className="rounded-[16px] rounded-tl-[4px] px-4 py-3.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
                  <Body text={sel.body} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => m.copy(sel)}
                    className={btn(m.copiedId === sel.id ? "soft" : "primary")}
                  >
                    {m.copiedId === sel.id ? <Check size={16} /> : <Copy size={16} />} {m.copiedId === sel.id ? "Đã chép" : "Chép nội dung"}
                  </button>
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Dán vào Zalo / Messenger rồi sửa các chỗ tô màu.</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Stack>
  );
}
