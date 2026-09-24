"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap, Copy, Check, RefreshCw, Pause, Play, Eye, EyeOff, ExternalLink } from "lucide-react";
import { vnd } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { Pill, type ToneKey } from "@/components/studio/ui";
import { useToast } from "@/components/studio/Toast";
import { BANK_TXN_STATUS_LABEL, BANK_TXN_NOTE_LABEL } from "@/lib/bank-reconcile";

/**
 * Tự xác nhận chuyển khoản qua SePay.
 *
 * Studio đăng ký SePay (có gói miễn phí), liên kết tài khoản ngân hàng, rồi dán
 * URL webhook + khoá ở đây vào SePay. Từ đó mỗi khoản tiền vào có mã đợt
 * (MSxxxxxxxx, đã in sẵn trong mọi mã QR của đợt) tự được ghi thu. Giao dịch
 * không có mã hiện ở danh sách dưới để gán tay.
 */

type Hook = { secret: string; enabled: boolean; last_event_at: string | null; created_at: string };
type Txn = {
  id: string;
  amount: number;
  content: string | null;
  gateway: string | null;
  txn_at: string | null;
  created_at: string;
  status: "matched" | "unmatched" | "mismatch" | "ignored";
  note: string | null;
  contract_id: string | null;
  booking_id: string | null;
};
type OpenPlan = {
  id: string;
  label: string;
  amount: number;
  due_date: string | null;
  contract: { id: string; code: string | null; title: string; client_name: string | null } | null;
};

const STATUS_TONE: Record<Txn["status"], ToneKey> = {
  matched: "green",
  unmatched: "amber",
  mismatch: "red",
  ignored: "gray",
};

export default function BankAutoCard() {
  const { toast, toastNode } = useToast();
  const [loading, setLoading] = useState(true);
  const [missingFile, setMissingFile] = useState<string | null>(null);
  const [hook, setHook] = useState<Hook | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [plans, setPlans] = useState<OpenPlan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/studio/bank-hook", { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLoading(false);
    if (j.missing) return setMissingFile(j.file || "supabase/doi-soat-ngan-hang.sql");
    if (!r?.ok) return;
    setHook(j.hook ?? null);
    setTxns(j.txns ?? []);
    setPlans(j.plans ?? []);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  async function act(action: string, extra: Record<string, string> = {}, key = action) {
    setBusy(key);
    const r = await fetch("/api/studio/bank-hook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (j.missing) return setMissingFile(j.file || "supabase/doi-soat-ngan-hang.sql");
    if (!r?.ok) {
      const msg: Record<string, string> = {
        already_paid: "Đợt này vừa được đánh dấu thu rồi.",
        already_matched: "Giao dịch này đã ghi thu.",
        write_failed: "Không ghi được lần thu. Sổ kỳ này đã khoá?",
      };
      toast(msg[j.error] || "Không thực hiện được, thử lại sau.");
      return false;
    }
    await load();
    return true;
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const webhookUrl = origin ? `${origin}/api/bank/sepay` : "/api/bank/sepay";
  const pending = txns.filter((t) => t.status === "unmatched" || t.status === "mismatch");

  return (
    <div className="card p-5" id="tu-xac-nhan">
      {toastNode}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
            <Zap size={18} style={{ color: "var(--ac)" }} /> Tự xác nhận chuyển khoản
          </h2>
          <p className="mt-1 max-w-2xl text-xs" style={{ color: "var(--text3)" }}>
            Nối tài khoản ngân hàng qua <b>SePay</b> (có gói miễn phí). Khách quét QR của đợt nào, tiền về là app tự
            ghi thu đúng đợt đó, báo cho bạn và nhắn Zalo xác nhận cọc cho khách. Bạn không phải mở sao kê để dò nữa.
          </p>
        </div>
        {hook && (
          <Pill tone={hook.enabled ? "green" : "gray"} dot>
            {hook.enabled ? "Đang bật" : "Tạm dừng"}
          </Pill>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text3)" }}>Đang tải…</p>
      ) : missingFile ? (
        <p className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--amS)", color: "var(--am)" }}>
          Database chưa có phần đối soát ngân hàng. Mở{" "}
          <a href="/api/setup-sql/doi-soat-ngan-hang" target="_blank" rel="noreferrer" className="underline">nội dung file {missingFile}</a>,
          chép toàn bộ, dán vào Supabase → SQL Editor rồi Run, sau đó tải lại trang.
        </p>
      ) : !hook ? (
        <div className="mt-4">
          <button className="btn-primary inline-flex items-center gap-1.5" disabled={busy === "enable"} onClick={() => act("enable")}>
            <Zap size={15} /> {busy === "enable" ? "Đang bật…" : "Bật tự xác nhận"}
          </button>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
            Bật xong sẽ có URL webhook và khoá để dán vào SePay. Chưa cấu hình SePay thì chưa có gì thay đổi.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">URL webhook (dán vào SePay)</label>
              <div className="flex items-center gap-2">
                <input className="input font-mono text-xs" readOnly value={webhookUrl} onFocus={(e) => e.target.select()} />
                <button className="btn-ghost flex-none px-2.5 py-2" onClick={() => copy(webhookUrl, "url")} aria-label="Chép URL">
                  {copied === "url" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">API Key (kiểu chứng thực: API Key)</label>
              <div className="flex items-center gap-2">
                <input
                  className="input font-mono text-xs"
                  readOnly
                  type={showKey ? "text" : "password"}
                  value={hook.secret}
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn-ghost flex-none px-2.5 py-2" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Ẩn khoá" : "Hiện khoá"}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button className="btn-ghost flex-none px-2.5 py-2" onClick={() => copy(hook.secret, "key")} aria-label="Chép khoá">
                  {copied === "key" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <details className="mt-3 text-xs" style={{ color: "var(--text2)" }}>
            <summary className="cursor-pointer font-medium">Cách cài trên SePay (5 phút)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Đăng ký tại{" "}
                <a href="https://my.sepay.vn/register" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                  my.sepay.vn <ExternalLink size={11} />
                </a>{" "}
                và chọn gói Miễn phí.
              </li>
              <li>Liên kết tài khoản ngân hàng mà bạn đang dùng để nhận tiền (đúng số tài khoản trên QR của bảng giá).</li>
              <li>Vào <b>Tích hợp WebHooks</b> → <b>Thêm webhooks</b>. Sự kiện: <b>Có tiền vào</b>.</li>
              <li>Dán <b>URL webhook</b> ở trên. Kiểu chứng thực: <b>API Key</b>, rồi dán <b>API Key</b> ở trên.</li>
              <li>Bấm Thêm, rồi dùng nút <b>Gửi thử</b> của SePay: giao dịch thử sẽ hiện ở danh sách bên dưới.</li>
            </ol>
            <p className="mt-2" style={{ color: "var(--text3)" }}>
              Mọi mã QR của đợt thanh toán giờ có sẵn mã đợt (dạng <span className="font-mono">MS…</span>) ở đầu nội dung.
              Cọc giữ ngày dùng mã <span className="font-mono">COC-…</span> có sẵn. Khách sửa mất mã thì giao dịch vào danh sách chờ gán tay.
            </p>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              disabled={!!busy}
              onClick={() => act(hook.enabled ? "pause" : "resume", {}, "toggle")}
            >
              {hook.enabled ? <Pause size={13} /> : <Play size={13} />} {hook.enabled ? "Tạm dừng" : "Bật lại"}
            </button>
            <button
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              disabled={!!busy}
              onClick={async () => {
                if (!confirm("Đổi khoá? Khoá cũ hết hiệu lực ngay, bạn phải dán khoá mới vào SePay.")) return;
                if (await act("rotate")) toast("Đã đổi khoá. Nhớ cập nhật trên SePay.");
              }}
            >
              <RefreshCw size={13} /> Đổi khoá
            </button>
            <span className="text-[11px]" style={{ color: "var(--text3)" }}>
              {hook.last_event_at ? `Lần cuối SePay báo về: ${fmtDateTime(hook.last_event_at)}` : "SePay chưa báo giao dịch nào."}
            </span>
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-medium">
              Giao dịch gần đây{pending.length > 0 && <span style={{ color: "var(--am)" }}> · {pending.length} chờ bạn xử lý</span>}
            </p>
            {txns.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>Chưa có giao dịch nào.</p>
            ) : (
              <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
                {txns.map((t) => {
                  const open = t.status === "unmatched" || t.status === "mismatch";
                  return (
                    <li key={t.id} className="py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            +{vnd(t.amount)}{" "}
                            <span className="text-[11px] font-normal" style={{ color: "var(--text3)" }}>
                              {fmtDateTime(t.txn_at || t.created_at)}{t.gateway ? ` · ${t.gateway}` : ""}
                            </span>
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--text2)" }} title={t.content || ""}>
                            {t.content || "(không có nội dung)"}
                          </p>
                          {t.note && BANK_TXN_NOTE_LABEL[t.note] && (
                            <p className="text-[11px]" style={{ color: "var(--text3)" }}>{BANK_TXN_NOTE_LABEL[t.note]}</p>
                          )}
                        </div>
                        <div className="flex flex-none items-center gap-2">
                          {t.contract_id && (
                            <a href={`/dashboard/studio/contracts/${t.contract_id}?tab=pay`} className="text-xs underline" style={{ color: "var(--text2)" }}>
                              Mở hợp đồng
                            </a>
                          )}
                          {t.booking_id && !t.contract_id && (
                            <a href="/dashboard/studio/bookings" className="text-xs underline" style={{ color: "var(--text2)" }}>
                              Mở đặt lịch
                            </a>
                          )}
                          <Pill tone={STATUS_TONE[t.status]}>{BANK_TXN_STATUS_LABEL[t.status]}</Pill>
                        </div>
                      </div>
                      {open && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            className="input max-w-full py-1.5 text-xs sm:max-w-md"
                            value={pick[t.id] || ""}
                            onChange={(e) => setPick((p) => ({ ...p, [t.id]: e.target.value }))}
                            aria-label="Chọn đợt để gán"
                          >
                            <option value="">Chọn đợt thanh toán để gán…</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {(p.contract?.client_name || p.contract?.title || "Hợp đồng")} · {p.label} · {vnd(p.amount)}
                                {p.amount === t.amount ? " ✓ khớp tiền" : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn-primary px-3 py-1.5 text-xs"
                            disabled={!pick[t.id] || !!busy}
                            onClick={async () => {
                              if (await act("assign", { txnId: t.id, planId: pick[t.id] }, `assign-${t.id}`)) toast("Đã ghi thu vào đợt.");
                            }}
                          >
                            {busy === `assign-${t.id}` ? "Đang ghi…" : "Gán & ghi thu"}
                          </button>
                          <button
                            className="btn-ghost px-3 py-1.5 text-xs"
                            disabled={!!busy}
                            onClick={() => act("ignore", { txnId: t.id }, `ignore-${t.id}`)}
                          >
                            Bỏ qua
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
