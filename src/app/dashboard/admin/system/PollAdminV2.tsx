"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, Vote } from "lucide-react";
import { Badge, Callout, Empty, Field, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { fmtDateTime } from "@/lib/date";

type AdminPoll = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  active: boolean;
  counts: number[];
  voters: number;
  audience: "everyone" | "owners";
  created_at: string;
};

/** Bình chọn đầu tiên điền sẵn — câu hỏi chuyển sang giao diện mới. */
const PRESET = {
  question: "Chuyển giao diện mới thành giao diện mặc định",
  options: ["Chuyển hoàn toàn qua giao diện mới", "Có thể chuyển lại giao diện cũ", "Dùng giao diện cũ, góp ý thêm rồi chuyển qua giao diện mới"],
  multi: true,
};

/**
 * Cài đặt hệ thống → BÌNH CHỌN. Admin tạo câu hỏi + phương án; bình chọn mở ngay
 * và hiện thành thẻ nổi trong dashboard của mọi tài khoản thuộc đối tượng (xem
 * @/components/PollCard). Bên dưới là kết quả từng bình chọn, đóng / mở lại được.
 */
export default function PollAdminV2() {
  const [polls, setPolls] = useState<AdminPoll[] | null>(null);
  const [missingTable, setMissingTable] = useState(false);
  const [question, setQuestion] = useState(PRESET.question);
  const [options, setOptions] = useState<string[]>(PRESET.options);
  const [multi, setMulti] = useState(PRESET.multi);
  const [ownersOnly, setOwnersOnly] = useState(false);
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/polls", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setPolls([]);
      return;
    }
    const j = (await res.json()) as { polls: AdminPoll[]; missingTable?: boolean };
    setPolls(j.polls);
    setMissingTable(!!j.missingTable);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = !busy && !!question.trim() && filled.length >= 2;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), options: filled, multi, audience: ownersOnly ? "owners" : "everyone", push }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setMsg({ tone: "red", text: `Chưa tạo được bình chọn${j.error ? `: ${j.error}` : ""}.` });
      return;
    }
    const j = (await res.json()) as { pushed?: number };
    setMsg({ tone: "green", text: `Đã mở bình chọn — người dùng thấy thẻ bình chọn ở lần mở dashboard tới${push ? ` · đẩy tới ${j.pushed ?? 0} thiết bị` : ""}.` });
    setQuestion("");
    setOptions(["", ""]);
    void load();
  }

  async function setActive(p: AdminPoll, active: boolean) {
    const res = await fetch("/api/admin/polls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, active }),
    }).catch(() => null);
    if (!res?.ok) {
      setMsg({ tone: "red", text: "Chưa đổi được trạng thái bình chọn." });
      return;
    }
    void load();
  }

  return (
    <Section id="binh-chon" icon={Vote} title="Bình chọn" desc="Hỏi ý kiến người dùng: thẻ bình chọn hiện nổi trong dashboard cho tới khi họ bỏ phiếu.">
      <div className="flex flex-col gap-5">
        {missingTable ? (
          <Callout tone="amber" title="Database chưa có bảng bình chọn">
            Mở Supabase → SQL Editor, dán toàn bộ file <code>supabase/binh-chon.sql</code> rồi Run một lần.
          </Callout>
        ) : null}

        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Câu hỏi" htmlFor="poll-q">
            <input id="poll-q" className={inputCls} maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <Field label="Phương án" hint="Từ 2 tới 8 phương án">
            <div className="flex flex-col gap-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={inputCls}
                    maxLength={120}
                    value={o}
                    placeholder={`Phương án ${i + 1}`}
                    aria-label={`Phương án ${i + 1}`}
                    onChange={(e) => setOptions((cur) => cur.map((x, k) => (k === i ? e.target.value : x)))}
                  />
                  <button
                    type="button"
                    className={iconBtn()}
                    aria-label={`Bỏ phương án ${i + 1}`}
                    disabled={options.length <= 2}
                    onClick={() => setOptions((cur) => cur.filter((_, k) => k !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {options.length < 8 ? (
                <button type="button" className={btn("ghost", "sm", "self-start")} onClick={() => setOptions((cur) => [...cur, ""])}>
                  <Plus size={15} /> Thêm phương án
                </button>
              ) : null}
            </div>
          </Field>
          <div className="rounded-[12px] px-3.5 py-1" style={{ border: "1px solid var(--bd2)" }}>
            <Switch checked={multi} onChange={setMulti} label="Chọn nhiều phương án" desc="Tắt thì mỗi người chỉ chọn một." />
            <Switch checked={ownersOnly} onChange={setOwnersOnly} label="Chỉ chủ tài khoản" desc="Tắt thì mọi tài khoản đều thấy, kể cả nhân viên." />
            <Switch checked={push} onChange={setPush} label="Đẩy web push" desc="Báo tới điện thoại chủ studio kể cả khi không mở webapp." />
          </div>
          {msg ? (
            <Callout tone={msg.tone} icon={msg.tone === "green" ? Check : undefined}>
              {msg.text}
            </Callout>
          ) : null}
          <div className="flex justify-end">
            <button type="submit" disabled={!canCreate} className={btn("primary")}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Vote size={16} />} Mở bình chọn
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>Kết quả</p>
          {polls === null ? (
            <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Đang tải…</p>
          ) : polls.length === 0 ? (
            <Empty compact icon={Vote} title="Chưa có bình chọn nào" />
          ) : (
            polls.map((p) => {
              const total = p.counts.reduce((s, n) => s + n, 0);
              return (
                <div key={p.id} className="rounded-[12px] p-4" style={{ border: "1px solid var(--bd2)" }}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">{p.question}</p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                        {fmtDateTime(p.created_at)} · {p.voters} người đã bình chọn · {p.multi ? "nhiều lựa chọn" : "một lựa chọn"} ·{" "}
                        {p.audience === "owners" ? "chủ tài khoản" : "mọi tài khoản"}
                      </p>
                    </div>
                    <Badge tone={p.active ? "green" : "gray"} dot>
                      {p.active ? "Đang mở" : "Đã đóng"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {p.options.map((o, i) => {
                      const n = p.counts[i] ?? 0;
                      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2 text-[13px]">
                            <span className="min-w-0 flex-1">{o}</span>
                            <span className="tabular-nums font-semibold">{n}</span>
                            <span className="w-10 text-right tabular-nums" style={{ color: "var(--tx3)" }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
                            <div className="h-full" style={{ width: `${pct}%`, background: "var(--ac)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" className={btn("secondary", "sm")} onClick={() => void setActive(p, !p.active)}>
                      {p.active ? "Đóng bình chọn" : "Mở lại"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Section>
  );
}
