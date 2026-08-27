"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Check, Copy, Facebook, MessageCircle, Music2, Plug, TriangleAlert, Unplug } from "lucide-react";
import { PLATFORM_INFO, PLATFORMS, platformColor, type Platform } from "@/lib/inbox/platforms";
import type { ChannelPublic } from "@/lib/inbox/types";
import { Panel, PanelHead } from "@/components/studio/ui";

/* ═══════════════════════════════════════════════════════════════════════════
   NỐI KÊNH VÀO HỘP THƯ.

   Mỗi nền tảng nối một kiểu, và màn này phải nói thẳng kiểu nào cần gì:
     • Facebook / Instagram — MỘT nút "Kết nối Facebook". Studio đăng nhập, tích
       chọn Trang, xong; hệ thống tự lấy token, tự bật nhận tin, tự nối luôn
       Instagram liên kết. Đường dán token thủ công vẫn còn nhưng thu sau một
       nút — nó dành cho studio đã có Meta App riêng, không phải mặc định.
     • Zalo — dùng lại tài khoản đã kết nối ở màn "Kết nối", bấm một nút.
     • TikTok — khai URL cầu nối của đối tác nhắn tin, vì TikTok chưa cho nối
       thẳng như Meta. Màn này phải nói ra điều đó thay vì để người dùng đi tìm
       một ô "Page Access Token" không tồn tại.
     • Chatbox website — không phải nối gì, tự chạy khi có khách nhắn.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  channels: ChannelPublic[];
  zaloReady: boolean;
  zaloChannel: "oa" | "personal" | null;
  /** Nền tảng đã khai Meta App chưa — quyết định có hiện nút một chạm không. */
  metaOAuthReady: boolean;
}

/**
 * Kết quả quay về từ Facebook (?meta=…). Facebook chỉ redirect được kèm tham số
 * URL, nên phải dịch chúng ra câu tiếng Việt tại đây — nếu không studio quay về
 * một trang trông y như lúc họ rời đi và không biết mình đã nối được hay chưa.
 */
function metaResult(params: URLSearchParams): { tone: "ok" | "warn" | "err"; text: string } | null {
  const code = params.get("meta");
  if (!code) return null;
  const pages = Number(params.get("pages") || 0);
  const ig = Number(params.get("ig") || 0);
  switch (code) {
    case "connected": {
      const parts = [`Đã nối ${pages} Trang Facebook`];
      if (ig) parts.push(`${ig} tài khoản Instagram`);
      const done = `${parts.join(" và ")}. Nhắn thử một tin từ tài khoản khác để kiểm tra.`;
      return params.get("warn")
        ? { tone: "warn", text: `${done} Có Trang chưa bật được nhận tin — xem cột trạng thái phía trên.` }
        : { tone: "ok", text: done };
    }
    case "cancelled":
      return { tone: "warn", text: "Bạn đã huỷ ở màn hình Facebook. Chưa nối Trang nào." };
    case "no_page":
      return {
        tone: "warn",
        text: "Tài khoản Facebook đó không quản lý Trang nào, hoặc bạn chưa tích chọn Trang. Meta không cho nhắn tin qua trang cá nhân — studio cần một Trang.",
      };
    case "not_configured":
      return { tone: "err", text: "Nền tảng chưa khai Meta App nên chưa dùng được nút kết nối một chạm." };
    default:
      return { tone: "err", text: "Nối Facebook không thành công. Thử lại, hoặc dùng cách nối thủ công bên dưới." };
  }
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

export default function ChannelsManager({ channels: initial, zaloReady, zaloChannel, metaOAuthReady }: Props) {
  const [channels, setChannels] = useState<ChannelPublic[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // URL webhook phải là tên miền THẬT của studio, nên chỉ dựng được ở trình duyệt.
  useEffect(() => setOrigin(window.location.origin), []);

  const [form, setForm] = useState({ platform: "facebook" as Platform, externalId: "", token: "", name: "" });
  const [tiktok, setTiktok] = useState({ externalId: "", relayUrl: "", relaySecret: "" });
  const [manualMeta, setManualMeta] = useState(false);
  const [fbResult, setFbResult] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  // Đọc kết quả Facebook trả về rồi DỌN tham số khỏi thanh địa chỉ: để nguyên
  // thì bấm F5 lại hiện "đã nối 2 Trang" trong khi chẳng có gì vừa xảy ra.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const res = metaResult(params);
    if (!res) return;
    setFbResult(res);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

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
      {fbResult && (
        <p
          className="mb-3 rounded-[12px] p-2.5 text-[13px]"
          style={
            fbResult.tone === "ok"
              ? { background: "var(--gnS)", color: "var(--gn)" }
              : fbResult.tone === "warn"
              ? { background: "var(--amS)", color: "var(--am)" }
              : { background: "var(--rdS)", color: "var(--rd)" }
          }
        >
          {fbResult.text}
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
        <PanelHead icon={Facebook} tone="blue" title="Facebook Messenger & Instagram DM" note="Đăng nhập Facebook và chọn Trang" />
        <div className="p-3">
          {metaOAuthReady ? (
            <>
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Bấm nút dưới, đăng nhập bằng tài khoản Facebook <b>đang quản lý Trang</b> của studio, rồi tích chọn
                Trang. Xong. Hệ thống tự lấy quyền nhắn tin, tự bật nhận tin, và tự nối luôn tài khoản{" "}
                <b>Instagram</b> nào đang liên kết với Trang đó.
              </p>
              <a href="/api/inbox/meta/connect" className="btn-primary mt-2.5">
                <Facebook size={15} /> Kết nối Facebook
              </a>
              <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                Không cần tạo Meta App, không cần token, không cần khai webhook — MStudo đã lo phần đó. Lưu ý: Meta
                chỉ hỗ trợ <b>Trang</b>, không nhắn được qua trang cá nhân.
              </p>
            </>
          ) : (
            <p
              className="rounded-[12px] p-2.5 text-[13px]"
              style={{ background: "var(--amS)", color: "var(--am)" }}
            >
              Nền tảng chưa khai Meta App nên chưa có nút kết nối một chạm. Chủ hệ thống cần đặt{" "}
              <code>META_APP_ID</code>, <code>META_APP_SECRET</code> và <code>META_REDIRECT_URI</code>. Trong lúc chờ,
              vẫn nối tay được bằng Page Access Token bên dưới.
            </p>
          )}

          <button
            type="button"
            className="btn-ghost mt-3 px-2.5 py-1.5 text-xs"
            onClick={() => setManualMeta((v) => !v)}
          >
            {manualMeta ? "Ẩn cách nối thủ công" : "Nối thủ công bằng Page Access Token"}
          </button>

          {/* Đường thủ công GIỮ LẠI chứ không xoá: studio đã có sẵn Meta App
              riêng, hoặc nền tảng chưa khai app, thì đây là lối duy nhất. Nhưng
              nó thu vào sau một nút — không còn là thứ đập vào mắt trước tiên. */}
          {manualMeta && (
          <div className="mt-3 grid gap-2.5">
            {origin && (
              <div className="rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
                <p className="text-[12px]" style={{ color: "var(--tx2)" }}>
                  Trong Meta App → <b>Webhooks</b>, khai URL dưới đây cho cả sản phẩm <b>Messenger</b> lẫn{" "}
                  <b>Instagram</b>, rồi đăng ký sự kiện <code>messages</code>.
                </p>
                <CopyRow label="Callback URL" value={`${origin}/api/inbox/webhook/meta`} />
                <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                  Verify Token là giá trị đặt ở <code>META_VERIFY_TOKEN</code>; App Secret ở{" "}
                  <code>META_APP_SECRET</code>.
                </p>
              </div>
            )}
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
          )}
        </div>
      </Panel>

      {/* ── TikTok ───────────────────────────────────────────────────────── */}
      <Panel className="mt-3">
        <PanelHead icon={Music2} tone="teal" title="TikTok" note="Nối qua cầu nối (đối tác nhắn tin)" />
        <div className="p-3">
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
            TikTok có API nhắn tin cho <b>tài khoản doanh nghiệp</b> (khu vực châu Á – Thái Bình Dương, gồm Việt
            Nam) nhưng còn ở giai đoạn thử nghiệm và thường phải đi qua một <b>đối tác nhắn tin</b> được TikTok
            công nhận. Nên MStudo nối TikTok bằng một <b>cầu nối</b>: đối tác đẩy tin khách vào đây, và MStudo gửi
            tin trả lời ngược lại cho họ.
          </p>

          {origin && (
            <div className="mt-3 rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
              <p className="text-[12px]" style={{ color: "var(--tx2)" }}>
                Đưa địa chỉ này cho đối tác để họ đẩy tin nhắn khách về (kèm header{" "}
                <code>Authorization: Bearer &lt;INBOX_INGEST_SECRET&gt;</code>):
              </p>
              <CopyRow label="Địa chỉ nhận tin" value={`${origin}/api/inbox/ingest`} />
            </div>
          )}

          <div className="mt-3 grid gap-2.5">
            <label className="field">
              <span className="label">Tài khoản TikTok</span>
              <input
                className="input"
                value={tiktok.externalId}
                onChange={(e) => setTiktok({ ...tiktok, externalId: e.target.value })}
                placeholder="vd @maistudio.vn hoặc business id đối tác cấp"
              />
            </label>
            <label className="field">
              <span className="label">URL cầu nối (gửi tin ra)</span>
              <input
                className="input"
                value={tiktok.relayUrl}
                onChange={(e) => setTiktok({ ...tiktok, relayUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span className="label">Khoá ký</span>
              <input
                className="input"
                type="password"
                value={tiktok.relaySecret}
                onChange={(e) => setTiktok({ ...tiktok, relaySecret: e.target.value })}
                placeholder="chuỗi bí mật dùng chung với đối tác"
              />
            </label>
            <div>
              <button
                className="btn-primary"
                disabled={
                  busy || !tiktok.externalId.trim() || !tiktok.relayUrl.trim() || !tiktok.relaySecret.trim()
                }
                onClick={async () => {
                  const ok = await call({
                    platform: "tiktok",
                    externalId: tiktok.externalId.trim(),
                    relayUrl: tiktok.relayUrl.trim(),
                    relaySecret: tiktok.relaySecret.trim(),
                    name: tiktok.externalId.trim(),
                  });
                  if (ok) {
                    setTiktok({ externalId: "", relayUrl: "", relaySecret: "" });
                    setNotice("Đã nối TikTok. Nhờ đối tác gửi thử một tin để kiểm tra.");
                  }
                }}
              >
                <Plug size={15} /> Nối TikTok
              </button>
              <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                MStudo ký mọi tin gửi ra bằng khoá này (header <code>X-Mstudo-Signature</code>) để đối tác biết
                chắc tin đến từ bạn. URL phải là https và không trỏ vào địa chỉ nội bộ.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
