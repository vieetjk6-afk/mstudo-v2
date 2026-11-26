"use client";

import { Activity, AlertTriangle, Check, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { Badge, Callout, Progress, Section, btn, type Tone } from "@/components/v2/kit";
import { fmtSize, fmtWhen } from "./useAutoBackup";
import { ago, cronStatus, healthIssues, usageTone, type CronStatus, type SystemHealth, type SystemHealthState, type UsageThang } from "./useSystemHealth";
import { doiRaByte } from "@/lib/luu-luong-rules";

/* Khối "Sức khoẻ hệ thống" của SystemV2: một dòng kết luận, rồi tới bằng chứng
   — việc tự động chạy đêm, dung lượng so với trần gói Free, SQL tự chạy lúc
   deploy, lỗi 7 ngày. Trên điện thoại mỗi việc là một thẻ xếp dọc (không bảng
   rộng) nên không tràn ngang. */

const ST: Record<CronStatus, { tone: Tone; text: string }> = {
  ok: { tone: "green", text: "OK" },
  fail: { tone: "red", text: "LỖI" },
  stale: { tone: "amber", text: "QUÁ HẠN" },
  never: { tone: "gray", text: "chưa chạy" },
};

const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : fmtSize(b));

function Usage({ label, used, limit, note }: { label: string; used: number; limit: number; note?: string }) {
  const tone = usageTone(used, limit);
  return (
    <div className="min-w-0 flex-1 rounded-[12px] p-3.5" style={{ border: "1px solid var(--bd2)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[13px] font-medium" style={{ color: "var(--tx)" }}>{label}</p>
        <p className="text-[12.5px] tabular-nums" style={{ color: tone === "green" ? "var(--tx2)" : `var(--${tone === "red" ? "rd" : "am"})` }}>
          {fmtBytes(used)} / {fmtBytes(limit)} · {Math.round((used / limit) * 100)}%
        </p>
      </div>
      <div className="mt-2"><Progress value={(used / limit) * 100} tone={tone} /></div>
      {note ? <p className="mt-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>{note}</p> : null}
    </div>
  );
}

/** Lưu lượng tháng này — Supabase (app tự đếm, ước tính) và Vercel (API chi phí). */
function LuuLuong({ u }: { u: UsageThang }) {
  const [y, m] = u.thang.split("-");
  const sp = u.supabase;
  const maxNgay = Math.max(1, ...sp.theoNgay.map((d) => d.bytes));
  const coTran = u.vercel.filter((v) => v.tran != null);
  const khac = u.vercel.filter((v) => v.tran == null);
  return (
    <div className="flex flex-col gap-2" data-testid="luu-luong">
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Lưu lượng tháng {m}/{y}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Usage
          label="Supabase (ước tính)"
          used={sp.bytes}
          limit={sp.tran}
          note={`Máy chủ ${fmtBytes(sp.mayChu)} · trình duyệt ${fmtBytes(sp.trinhDuyet)} · dự báo cuối tháng ~${fmtBytes(sp.duBao)}. App tự đếm, không gồm ảnh tải thẳng từ Storage — số chính xác ở Supabase → Usage.`}
        />
        {coTran.map((v) => (
          <Usage key={v.service} label={`Vercel · ${v.service}`} used={doiRaByte(v.quantity, v.unit) ?? 0} limit={v.tran!} note={`Trần gói Hobby · cập nhật ${u.vercelCapNhat ?? "—"}`} />
        ))}
      </div>
      {sp.theoNgay.length > 1 ? (
        <div className="rounded-[12px] px-3.5 py-2.5" style={{ border: "1px solid var(--bd2)" }}>
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Supabase theo ngày</p>
          <div className="mt-1.5 flex h-12 items-end gap-[3px]" aria-hidden>
            {sp.theoNgay.map((d) => (
              <div key={d.day} title={`${d.day}: ${fmtBytes(d.bytes)}`} className="min-w-0 flex-1 rounded-t-[3px]" style={{ height: `${Math.max(4, (d.bytes / maxNgay) * 100)}%`, background: "var(--ac)", opacity: 0.75 }} />
            ))}
          </div>
        </div>
      ) : null}
      {u.vercel.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: u.vercelLoi ? "var(--am)" : "var(--tx3)" }}>
          {u.vercelLoi
            ? `Chưa đọc được số liệu Vercel: ${u.vercelLoi}`
            : "Chưa có số liệu Vercel — workflow GitHub “Đo lưu lượng” ghi mỗi ngày (dùng secret VERCEL_TOKEN, VERCEL_ORG_ID, SUPABASE_DB_URL)."}
        </p>
      ) : khac.length > 0 ? (
        <details className="rounded-[12px] px-3.5 py-2" style={{ border: "1px solid var(--bd2)" }}>
          <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--tx2)" }}>Các mục Vercel khác</summary>
          <ul className="mt-2 text-[12.5px]">
            {khac.map((v) => (
              <li key={`${v.service}|${v.unit}`} className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="min-w-0 truncate" style={{ color: "var(--tx2)" }}>{v.service}</span>
                <span className="flex-none tabular-nums" style={{ color: "var(--tx3)" }}>
                  {v.quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} {v.unit ?? ""}
                  {v.cost > 0 ? ` · $${v.cost.toFixed(2)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Body({ h, onResolve }: { h: SystemHealth; onResolve: (signatures: string[]) => void }) {
  if (!h.migrated) {
    return (
      <Callout tone="amber" icon={AlertTriangle} title="Cần cập nhật cơ sở dữ liệu">
        Chưa có bảng nhật ký vận hành nên chưa theo dõi được gì.{" "}
        {h.setupSql ? (
          <>Mở <a href={h.setupSql} target="_blank" rel="noopener noreferrer" className="underline">file SQL này</a>, chép toàn bộ rồi chạy trong Supabase SQL Editor.</>
        ) : (
          <>Chạy <code>supabase/cap-nhat.sql</code> trong Supabase SQL Editor (hoặc chờ lượt deploy tự chạy).</>
        )}
      </Callout>
    );
  }
  const issues = healthIssues(h);
  const st = h.stats;
  return (
    <div className="flex flex-col gap-4">
      {issues.length === 0 ? (
        <Callout tone="green" icon={Check} title="Mọi thứ đang chạy bình thường" />
      ) : (
        <Callout tone={issues.some((x) => /lỗi|hỏng|CRON_SECRET/i.test(x)) ? "red" : "amber"} icon={AlertTriangle} title={`${issues.length} việc cần xem`}>
          {issues.join(" · ")}
        </Callout>
      )}
      {!h.cronSecretSet ? (
        <Callout tone="red" icon={AlertTriangle}>
          Chưa đặt biến môi trường <code>CRON_SECRET</code> trên Vercel — mọi việc tự động đang bị khoá (401) và không để lại dòng nào dưới đây.
        </Callout>
      ) : null}

      {/* ── Việc tự động chạy đêm ── */}
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>Việc tự động chạy đêm</p>
        <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd2)" }}>
          {h.crons.map((c, i) => {
            const s = ST[cronStatus(c)];
            return (
              <div
                key={c.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_84px]"
                style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}
              >
                <p className="min-w-0 truncate text-[13.5px] font-medium" style={{ color: "var(--tx)" }} title={c.name}>{c.label}</p>
                <div className="justify-self-end sm:order-3"><Badge tone={s.tone} dot>{s.text}</Badge></div>
                <p className="col-span-2 min-w-0 text-[12.5px] sm:order-2 sm:col-span-1" style={{ color: "var(--tx3)" }}>
                  {c.last ? (
                    <>
                      <span style={{ color: "var(--tx2)" }}>{fmtWhen(c.last.at)}</span> · {ago(c.last.at)}
                      {c.last.durationMs != null ? ` · ${(c.last.durationMs / 1000).toFixed(1)}s` : ""}
                    </>
                  ) : (
                    "Chưa có lượt chạy nào được ghi"
                  )}
                  {c.last && !c.last.ok && c.lastOkAt ? <> · lần tốt gần nhất {ago(c.lastOkAt)}</> : null}
                </p>
                {c.last?.summary ? (
                  <p
                    className="col-span-2 min-w-0 break-words text-[12px] sm:order-4 sm:col-span-3"
                    style={{ color: c.last.ok ? "var(--tx3)" : "var(--rd)", fontFamily: c.last.ok ? undefined : "var(--font-mono, ui-monospace, monospace)" }}
                  >
                    {c.last.summary}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lưu lượng tháng này ── */}
      {h.usage ? <LuuLuong u={h.usage} /> : null}

      {/* ── Dung lượng ── */}
      {st ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Usage label="Database" used={st.db_bytes} limit={h.limits.dbBytes} note="Trần gói Supabase Free: 500 MB" />
            <Usage label="Lưu trữ file" used={st.storage_bytes} limit={h.limits.storageBytes} note={`Trần 1 GB · ${st.buckets.reduce((n, b) => n + b.objects, 0).toLocaleString("vi-VN")} file`} />
          </div>
          <details className="rounded-[12px] px-3.5 py-2" style={{ border: "1px solid var(--bd2)" }}>
            <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--tx2)" }}>Bảng lớn nhất & từng bucket</summary>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <ul className="min-w-0 text-[12.5px]">
                {st.tables.map((t) => (
                  <li key={t.name} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="min-w-0 truncate font-mono" style={{ color: "var(--tx2)" }}>{t.name}</span>
                    <span className="flex-none tabular-nums" style={{ color: "var(--tx3)" }}>{fmtBytes(t.bytes)} · ~{t.rows.toLocaleString("vi-VN")} dòng</span>
                  </li>
                ))}
              </ul>
              <ul className="min-w-0 text-[12.5px]">
                {st.buckets.length === 0 ? <li style={{ color: "var(--tx3)" }}>Chưa có file nào trong Storage.</li> : null}
                {st.buckets.map((b) => (
                  <li key={b.bucket} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="min-w-0 truncate font-mono" style={{ color: "var(--tx2)" }}>{b.bucket}</span>
                    <span className="flex-none tabular-nums" style={{ color: "var(--tx3)" }}>{fmtBytes(b.bytes)} · {b.objects.toLocaleString("vi-VN")} file</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      ) : null}

      {/* ── SQL tự chạy khi deploy ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" style={{ color: "var(--tx2)" }}>
        <span className="font-medium" style={{ color: "var(--tx)" }}>SQL tự chạy khi deploy</span>
        {h.sql ? (
          <>
            <Badge tone={h.sql.ok ? "green" : "red"} dot>{h.sql.ok ? "Đã chạy" : "HỎNG"}</Badge>
            <span>{fmtWhen(h.sql.at)} · {ago(h.sql.at)}</span>
            {h.sql.sha ? <span className="font-mono text-[12px]" style={{ color: "var(--tx3)" }}>bản {h.sql.sha}{h.sql.gitSha ? ` · commit ${h.sql.gitSha}` : ""}</span> : null}
          </>
        ) : (
          <Badge tone="gray" dot>Chưa bật</Badge>
        )}
      </div>
      {h.sql && !h.sql.ok && h.sql.error ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[10px] p-3 text-[12px]" style={{ background: "var(--sf2)", color: "var(--rd)" }}>{h.sql.error}</pre>
      ) : null}

      {/* ── Lỗi gần đây ── */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            Lỗi trong 7 ngày
            {h.errorsResolved ? <span className="font-normal"> · {h.errorsResolved} lỗi đã xử lý đang ẩn</span> : null}
          </p>
          {h.canResolve && h.errors.length > 1 ? (
            <button type="button" onClick={() => onResolve(h.errors.map((e) => e.signature))} className={btn("ghost", "sm")}>
              <CheckCheck size={14} /> Đã xử lý hết
            </button>
          ) : null}
        </div>
        {h.errors.length === 0 ? (
          <p className="rounded-[12px] px-3.5 py-3 text-[13px]" style={{ border: "1px dashed var(--bdS)", color: "var(--tx3)" }}>
            {h.errorsResolved ? "Không còn lỗi nào chưa xử lý" : "Không có lỗi nào trong 7 ngày"}
          </p>
        ) : (
          <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd2)" }}>
            {h.errors.map((e, i) => (
              <div key={e.signature} className="flex min-w-0 flex-col gap-0.5 px-3.5 py-2.5" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-[13px]" style={{ color: "var(--tx)" }}>{e.message}</p>
                  {h.canResolve ? (
                    <button
                      type="button"
                      onClick={() => onResolve([e.signature])}
                      className={btn("ghost", "sm", "flex-none")}
                      title="Ẩn lỗi này. Nếu nó xảy ra lại, nó sẽ tự hiện lại."
                    >
                      <Check size={14} /> Đã xử lý
                    </button>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: "var(--tx3)" }}>
                  <Badge tone={e.source === "server" ? "red" : "blue"}>{e.source === "server" ? "máy chủ" : "trình duyệt"}</Badge>
                  <span className="tabular-nums">{e.count.toLocaleString("vi-VN")} lần</span>
                  <span>· {ago(e.lastAt)}</span>
                  {e.path ? <span className="min-w-0 break-all font-mono">{e.path}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HealthV2({ health }: { health: SystemHealthState }) {
  const h = health.data;
  return (
    <Section
      id="suc-khoe"
      icon={Activity}
      title="Sức khoẻ hệ thống"
      desc="Đêm qua mọi thứ có chạy không, dung lượng còn bao nhiêu, và có lỗi gì mới."
      actions={
        <button type="button" onClick={() => void health.reload()} disabled={health.loading} className={btn("secondary", "sm")}>
          {health.loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Làm mới
        </button>
      }
    >
      {h ? (
        <Body h={h} onResolve={(sigs) => void health.resolve(sigs)} />
      ) : health.failed ? (
        <Callout tone="red" icon={AlertTriangle}>Không đọc được số liệu sức khoẻ hệ thống. Bấm Làm mới để thử lại.</Callout>
      ) : (
        <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--tx3)" }}>
          <Loader2 size={15} className="animate-spin" /> Đang kiểm tra…
        </span>
      )}
    </Section>
  );
}
