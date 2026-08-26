"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Check, Copy, Facebook, MessageCircle, Plug, TriangleAlert, Unplug } from "lucide-react";
import { PLATFORM_INFO, PLATFORMS, platformColor, type Platform } from "@/lib/inbox/platforms";
import type { ChannelPublic } from "@/lib/inbox/types";
import { Panel, PanelHead } from "@/components/studio/ui";

/* ═══════════════════════════════════════════════════════════════════════════
   NỐI KÊNH VÀO HỘP THƯ.

   Mỗi nền tảng nối một kiểu, và màn này phải nói thẳng kiểu nào cần gì:
     • Facebook / Instagram — dán Page ID + Page Access Token, rồi khai URL
       webhook bên Meta. Việc khai webhook nằm NGOÀI app nên URL phải hiện sẵn
       kèm nút chép, chứ không bắt người dùng tự ghép.
     • Zalo — dùng lại tài khoản đã kết nối ở màn "Kết nối", bấm một nút.
     • Chatbox website — không phải nối gì, tự chạy khi có khách nhắn.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  channels: ChannelPublic[];
  zaloReady: boolean;
  zaloChannel: "oa" | "personal" | null;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <p className="text-[12px] font-medium" style={{ color: "var(--tx2)" }}>
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-[10px] px-2.5 py-1.5 text-[12px]"
          style={{ background: "var(--sf2)" }}
        >
          {value}
        </code>
        <button
          type="button"
          className="btn-ghost flex-none px-2 py-1.5 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {}
            );
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Đã chép" : "Chép"}
        </button>
      </div>
    </div>
  );
}

export default function ChannelsManager({ channels: initial, zaloReady, zaloChannel }: Props) {
  const [channels, setChannels] = useState<ChannelPublic[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // URL webhook phải là tên miền THẬT của studio, nên chỉ dựng được ở trình duyệt.
  useEffect(() => setOrigin(window.location.origin), []);

  const [form, setForm] = useState({ platform: "facebook" as Platform, externalId: "", token: "", name: "" });

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/inbox/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Không thực hiện được. Kiểm tra lại thông tin.");
        return false;
      }
      const list = await fetch("/api/inbox/channels", { cache: "no-store" });
      if (list.ok) setChannels(((await list.json()) as { channels: ChannelPublic[] }).channels);
      return true;
    } finally {
      setBusy(false);
    }
  }

  const byPlatform = (p: Platform) => channels.find((c) => c.platform === p && c.status === "connected");

  return (
    <div className="page-in max-w-[760px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Nối mạng xã hội để tin nhắn khách đổ chung về hộp thư.
        </p>
        <Link href="/dashboard/studio/inbox" className="btn-ghost px-2.5 py-1.5 text-xs">
          Về hộp thư
        </Link>
      </div>

      {error && (
        <p className="mb-3 rounded-[12px] p-2.5 text-[13px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-[12px] p-2.5 text-[13px]" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
          {notice}
        </p>
      )}

      {/* ── Trạng thái từng kênh ─────────────────────────────────────────── */}
      <Panel>
        <PanelHead icon={Plug} tone="brand" title="Kênh của bạn" />
        <div className="grid gap-2 p-3">
          {PLATFORMS.map((p) => {
            const info = PLATFORM_INFO[p];
            const ch = byPlatform(p);
            return (
              <div key={p} className="flex flex-wrap items-center gap-2.5 rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: platformColor(p) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">
                    {info.label}
                    {/* Chỉ hiện tên riêng khi nó KHÁC nhãn kênh — kênh website
                        đặt tên mặc định trùng nhãn, in cả hai thành "Chatbox
                        website · Chatbox website". */}
                    {ch?.name && ch.name !== info.label && (
                      <span style={{ color: "var(--tx3)" }}> · {ch.name}</span>
                    )}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--tx3)" }}>
                    {ch ? `Đang nhận tin${ch.lastError ? ` · lỗi gần nhất: ${ch.lastError}` : ""}` : info.hint}
                  </div>
                </div>

                {ch ? (
                  <>
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => call({ action: "ai-mode", channelId: ch.id, aiMode: ch.aiMode === "auto" ? "off" : "auto" })}
                      title="Bật/tắt trợ lý AI cho toàn bộ kênh này"
                    >
                      <Bot size={14} style={{ color: ch.aiMode === "auto" ? "var(--ac)" : "var(--tx3)" }} />
                      {ch.aiMode === "auto" ? "AI bật" : "AI tắt"}
                    </button>
                    {p !== "website" && (
                      <button
                        className="btn-ghost px-2.5 py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => call({ action: "disconnect", channelId: ch.id })}
                      >
                        <Unplug size={14} /> Ngắt
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                    chưa nối
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── Zalo ─────────────────────────────────────────────────────────── */}
      <Panel className="mt-3">
        <PanelHead icon={MessageCircle} tone="blue" title="Zalo" note="Dùng lại tài khoản Zalo bạn đã kết nối" />
        <div className="p-3">
          {zaloReady ? (
            <>
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Đã kết nối kênh <b>{zaloChannel === "oa" ? "Official Account" : "Zalo cá nhân"}</b>. Bấm nút dưới để
                đưa tin nhắn của kênh này về hộp thư.
              </p>
              <button
                className="btn-primary mt-2.5"
                disabled={busy}
                onClick={async () => {
                  const ok = await call({ action: "link-zalo" });
                  if (ok) setNotice("Đã nối Zalo vào hộp thư.");
                }}
              >
                <Plug size={15} /> Nối Zalo vào hộp thư
              </button>
              {zaloChannel === "oa" && origin && (
                <div className="mt-3 rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
                  <p className="text-[12px]" style={{ color: "var(--tx2)" }}>
                    Vào <b>developers.zalo.me</b> → Zalo App của bạn → mục <b>Webhook</b>, dán URL này và bật sự kiện
                    &ldquo;Người dùng gửi tin nhắn&rdquo;:
                  </p>
                  <CopyRow label="URL webhook Zalo OA" value={`${origin}/api/inbox/webhook/zalo`} />
                </div>
              )}
              {zaloChannel === "personal" && (
                <div
                  className="mt-3 flex gap-2 rounded-[12px] p-2.5 text-[12px]"
                  style={{ background: "var(--amS)", color: "var(--am)" }}
                >
                  <TriangleAlert size={15} className="mt-0.5 flex-none" />
                  <span>
                    Zalo cá nhân không có webhook: muốn NHẬN tin phải chạy thêm tiến trình lắng nghe
                    (<code>scripts/zalo-inbox-worker.mjs</code>) trên máy studio hoặc một máy chủ nhỏ. Tự động hoá tài
                    khoản cá nhân cũng vi phạm điều khoản của Zalo và có thể bị khoá tài khoản.
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
              Chưa kết nối Zalo.{" "}
              <Link href="/dashboard/connections" className="underline">
                Kết nối Zalo trước
              </Link>{" "}
              rồi quay lại đây.
            </p>
          )}
        </div>
      </Panel>

      {/* ── Facebook / Instagram ─────────────────────────────────────────── */}
      <Panel className="mt-3">
        <PanelHead icon={Facebook} tone="blue" title="Facebook Messenger & Instagram DM" note="Cần một Meta App có quyền nhắn tin cho trang" />
        <div className="p-3">
          {origin && (
            <div className="rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
              <p className="text-[12px]" style={{ color: "var(--tx2)" }}>
                Trong Meta App → <b>Webhooks</b>, khai URL và token dưới đây cho cả sản phẩm{" "}
                <b>Messenger</b> lẫn <b>Instagram</b>, rồi đăng ký sự kiện <code>messages</code>.
              </p>
              <CopyRow label="Callback URL" value={`${origin}/api/inbox/webhook/meta`} />
              <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                Verify Token là giá trị bạn đặt ở biến môi trường <code>META_VERIFY_TOKEN</code>; App Secret đặt ở{" "}
                <code>META_APP_SECRET</code>.
              </p>
            </div>
          )}

          <div className="mt-3 grid gap-2.5">
            <label className="field">
              <span className="label">Kênh</span>
              <select
                className="input"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
              >
                <option value="facebook">Facebook Messenger</option>
                <option value="instagram">Instagram DM</option>
              </select>
            </label>
            <label className="field">
              <span className="label">
                {form.platform === "facebook" ? "Page ID" : "Instagram Business ID"}
              </span>
              <input
                className="input"
                value={form.externalId}
                onChange={(e) => setForm({ ...form, externalId: e.target.value })}
                placeholder="vd 1027465..."
              />
            </label>
            <label className="field">
              <span className="label">Page Access Token</span>
              <input
                className="input"
                type="password"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                placeholder="EAAG..."
              />
            </label>
            <label className="field">
              <span className="label">Tên hiển thị (tuỳ chọn)</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="vd Studio ABC - Fanpage"
              />
            </label>
            <div>
              <button
                className="btn-primary"
                disabled={busy || !form.externalId.trim() || !form.token.trim()}
                onClick={async () => {
                  const ok = await call({
                    platform: form.platform,
                    externalId: form.externalId.trim(),
                    pageAccessToken: form.token.trim(),
                    name: form.name.trim(),
                  });
                  if (ok) {
                    setForm({ ...form, externalId: "", token: "", name: "" });
                    setNotice("Đã nối kênh. Nhắn thử một tin từ tài khoản khác để kiểm tra.");
                  }
                }}
              >
                <Plug size={15} /> Nối kênh
              </button>
              <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                Token được mã hoá trước khi lưu và không bao giờ hiện lại trên giao diện.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
