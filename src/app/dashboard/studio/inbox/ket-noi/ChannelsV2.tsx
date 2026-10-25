"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, CircleAlert, Copy, Facebook, Globe, Instagram, MessageCircle, Music2, Plug,
  TriangleAlert, Unplug, type LucideIcon,
} from "lucide-react";
import { Badge, Callout, Field, GroupLabel, PageHead, Section, Stack, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, Switch } from "@/components/v2/kit-client";
import { PLATFORM_INFO, PLATFORMS, platformColor, type Platform } from "@/lib/inbox/platforms";
import { useChannels, type ChannelsProps } from "./useChannels";

/* ═══════════════════════════════════════════════════════════════════════════
   NỐI KÊNH VÀO HỘP THƯ — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ChannelsManager (bản cũ, logic chung ở ./useChannels); khác ở cách sắp xếp:
     • Lưới thẻ kênh: mỗi nền tảng một thẻ — nhãn trạng thái (Đang nhận tin /
       Có lỗi / Chưa nối), công tắc AI cho cả kênh, ngắt kết nối trong ⋯; kênh
       chưa nối có nút "Cách nối" nhảy xuống đúng khối hướng dẫn.
     • Mỗi cách nối là một khối với các bước đánh số. Nút chính duy nhất là
       "Kết nối Facebook" (một chạm); đường dán token thủ công thu sau một nút.
   ═══════════════════════════════════════════════════════════════════════════ */

const ICON: Record<Platform, LucideIcon> = {
  website: Globe,
  zalo_oa: MessageCircle,
  zalo_personal: MessageCircle,
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
};
const ANCHOR: Record<Platform, string | null> = {
  website: null,
  zalo_oa: "noi-zalo",
  zalo_personal: "noi-zalo",
  facebook: "noi-meta",
  instagram: "noi-meta",
  tiktok: "noi-tiktok",
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{label}</p>
      <div className="flex items-center gap-1.5 rounded-[10px] py-1 pl-3 pr-1" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <code className="min-w-0 flex-1 truncate text-[12.5px]">{value}</code>
        <button
          type="button"
          className={iconBtn("!h-8 !w-8")}
          aria-label={copied ? "Đã chép" : `Chép ${label}`}
          title={copied ? "Đã chép" : "Chép"}
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
          {copied ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

/** Danh sách bước đánh số. */
function Steps({ items }: { items: { title: React.ReactNode; body?: React.ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span
            className="v2-num flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold"
            style={{ background: "var(--acS)", color: "var(--ac)" }}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[13.5px] font-semibold">{it.title}</p>
            {it.body ? <div className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>{it.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ChannelsV2(props: ChannelsProps) {
  const { zaloReady, zaloChannel, metaOAuthReady } = props;
  const c = useChannels(props);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const fbTone: Record<"ok" | "warn" | "err", Tone> = { ok: "green", warn: "amber", err: "red" };

  return (
    <Stack>
      <PageHead
        desc="Nối mạng xã hội để tin nhắn khách đổ chung về hộp thư. Trợ lý AI trả lời trước; tắt AI ở kênh nào thì nhân viên tự trả lời kênh đó."
        actions={
          <Link href="/dashboard/studio/inbox" className={btn("secondary")}>
            <ArrowLeft size={16} /> Về hộp thư
          </Link>
        }
      />

      {c.error && <Callout tone="red" icon={CircleAlert}>{c.error}</Callout>}
      {c.notice && <Callout tone="green" icon={CheckCircle2}>{c.notice}</Callout>}
      {c.fbResult && (
        <Callout tone={fbTone[c.fbResult.tone]} icon={c.fbResult.tone === "ok" ? CheckCircle2 : c.fbResult.tone === "warn" ? TriangleAlert : CircleAlert}>
          {c.fbResult.text}
        </Callout>
      )}

      {/* ── Thẻ từng kênh ────────────────────────────────────────────────── */}
      <div className="-mb-2">
        <GroupLabel count={`${PLATFORMS.filter((p) => c.byPlatform(p)).length}/${PLATFORMS.length} đang nhận tin`}>Kênh của bạn</GroupLabel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PLATFORMS.map((p) => {
          const info = PLATFORM_INFO[p];
          const ch = c.byPlatform(p);
          const Icon = ICON[p];
          const color = platformColor(p);
          const anchor = ANCHOR[p];
          return (
            <div key={p} className="v2-card flex flex-col p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]"
                  style={{ background: `color-mix(in srgb, ${color} 13%, var(--sf))`, color }}
                >
                  <Icon size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{info.label}</p>
                  {/* Chỉ hiện tên riêng khi nó KHÁC nhãn kênh. */}
                  {ch?.name && ch.name !== info.label ? (
                    <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{ch.name}</p>
                  ) : null}
                </div>
                {ch ? (
                  ch.lastError ? <Badge tone="red" dot>Có lỗi</Badge> : <Badge tone="green" dot>Đang nhận tin</Badge>
                ) : (
                  <Badge tone="gray">Chưa nối</Badge>
                )}
              </div>

              <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed" style={{ color: ch?.lastError ? "var(--rd)" : "var(--tx2)" }}>
                {ch ? (ch.lastError ? `Lỗi gần nhất: ${ch.lastError}` : "Tin nhắn của khách ở kênh này đang đổ về hộp thư.") : info.hint}
              </p>

              <div className="mt-3 flex min-h-[38px] items-center gap-2 pt-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                {ch ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <Switch
                        checked={ch.aiMode === "auto"}
                        onChange={() => void c.toggleAi(ch)}
                        disabled={c.busy}
                        label={ch.aiMode === "auto" ? "AI đang trả lời" : "AI đang tắt"}
                      />
                    </div>
                    {p !== "website" && (
                      <Menu
                        label={`Thao tác với kênh ${info.label}`}
                        items={[{ label: "Ngắt kết nối", hint: "Ngừng nhận tin từ kênh này", icon: Unplug, danger: true, disabled: c.busy, onClick: () => void c.disconnect(ch) }]}
                      />
                    )}
                  </>
                ) : anchor ? (
                  <button type="button" onClick={() => jump(anchor)} className={btn("ghost", "sm", "-ml-2")}>
                    <Plug size={14} /> Cách nối <ChevronDown size={14} />
                  </button>
                ) : (
                  <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Tự chạy khi có khách nhắn</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Zalo ─────────────────────────────────────────────────────────── */}
      <div id="noi-zalo" style={{ scrollMarginTop: 80 }}>
        <Section
          icon={MessageCircle}
          title="Zalo"
          desc="Dùng lại tài khoản Zalo bạn đã kết nối."
          actions={zaloReady ? <Badge tone="green" dot>{zaloChannel === "oa" ? "Official Account" : "Zalo cá nhân"}</Badge> : <Badge tone="gray">Chưa kết nối Zalo</Badge>}
        >
          {zaloReady ? (
            <div className="flex flex-col gap-4">
              <Steps
                items={[
                  ...(zaloChannel === "oa" && c.origin
                    ? [
                        {
                          title: "Khai webhook trong Zalo App",
                          body: (
                            <div className="flex flex-col gap-2.5">
                              <span>
                                Vào <b>developers.zalo.me</b> → Zalo App của bạn → mục <b>Webhook</b>, dán URL này và bật sự kiện
                                &ldquo;Người dùng gửi tin nhắn&rdquo;.
                              </span>
                              <CopyField label="URL webhook Zalo OA" value={`${c.origin}/api/inbox/webhook/zalo`} />
                            </div>
                          ),
                        },
                      ]
                    : []),
                  {
                    title: "Đưa tin nhắn Zalo về hộp thư",
                    body: (
                      <div className="flex flex-col items-start gap-2.5">
                        <span>
                          Đã kết nối kênh <b>{zaloChannel === "oa" ? "Official Account" : "Zalo cá nhân"}</b>. Bấm nút dưới để đưa tin nhắn
                          của kênh này về hộp thư.
                        </span>
                        <button type="button" className={btn("secondary")} disabled={c.busy} onClick={() => void c.linkZalo()}>
                          <Plug size={16} /> Nối Zalo vào hộp thư
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
              {zaloChannel === "personal" && (
                <Callout tone="amber" icon={TriangleAlert} title="Zalo cá nhân không có webhook">
                  Muốn NHẬN tin phải chạy thêm tiến trình lắng nghe (<code>scripts/zalo-inbox-worker.mjs</code>) trên máy studio hoặc
                  một máy chủ nhỏ. Tự động hoá tài khoản cá nhân cũng vi phạm điều khoản của Zalo và có thể bị khoá tài khoản.
                </Callout>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>Chưa kết nối Zalo. Kết nối Zalo trước rồi quay lại đây.</p>
              <Link href="/dashboard/connections" className={btn("secondary", "sm")}>
                Kết nối Zalo trước
              </Link>
            </div>
          )}
        </Section>
      </div>

      {/* ── Facebook / Instagram ─────────────────────────────────────────── */}
      <div id="noi-meta" style={{ scrollMarginTop: 80 }}>
        <Section icon={Facebook} title="Facebook Messenger & Instagram DM" desc="Đăng nhập Facebook và chọn Trang — không cần token, không cần khai webhook.">
          <div className="flex flex-col gap-4">
            {metaOAuthReady ? (
              <>
                <Steps
                  items={[
                    { title: "Bấm “Kết nối Facebook”", body: "Trình duyệt chuyển sang trang đăng nhập Facebook." },
                    {
                      title: "Đăng nhập và tích chọn Trang",
                      body: <>Dùng tài khoản Facebook <b>đang quản lý Trang</b> của studio. Meta chỉ hỗ trợ <b>Trang</b>, không nhắn được qua trang cá nhân.</>,
                    },
                    {
                      title: "Xong",
                      body: <>Hệ thống tự lấy quyền nhắn tin, tự bật nhận tin, và tự nối luôn tài khoản <b>Instagram</b> đang liên kết với Trang đó.</>,
                    },
                  ]}
                />
                <div className="flex flex-wrap items-center gap-3 pl-9">
                  <a href="/api/inbox/meta/connect" className={btn("primary")}>
                    <Facebook size={16} /> Kết nối Facebook
                  </a>
                  <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Không cần tạo Meta App — MStudo đã lo phần đó.</span>
                </div>
              </>
            ) : (
              <Callout tone="amber" icon={TriangleAlert} title="Chưa có nút kết nối một chạm">
                Nền tảng chưa khai Meta App. Chủ hệ thống cần đặt <code>META_APP_ID</code>, <code>META_APP_SECRET</code> và{" "}
                <code>META_REDIRECT_URI</code>. Trong lúc chờ, vẫn nối tay được bằng Page Access Token bên dưới.
              </Callout>
            )}

            <div style={{ borderTop: "1px solid var(--bd2)" }} className="pt-3">
              <button type="button" className={btn("ghost", "sm", "-ml-2")} onClick={() => c.setManualMeta((v) => !v)} aria-expanded={c.manualMeta}>
                <ChevronDown size={15} style={{ transform: c.manualMeta ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
                {c.manualMeta ? "Ẩn cách nối thủ công" : "Nối thủ công bằng Page Access Token"}
              </button>

              {/* Đường thủ công GIỮ LẠI: studio có Meta App riêng, hoặc nền tảng
                  chưa khai app, thì đây là lối duy nhất — nhưng thu sau một nút. */}
              {c.manualMeta && (
                <div className="mt-3 flex flex-col gap-4 rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
                  {c.origin && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
                        Trong Meta App → <b>Webhooks</b>, khai URL dưới đây cho cả sản phẩm <b>Messenger</b> lẫn <b>Instagram</b>, rồi
                        đăng ký sự kiện <code>messages</code>.
                      </p>
                      <CopyField label="Callback URL" value={`${c.origin}/api/inbox/webhook/meta`} />
                      <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                        Verify Token là giá trị đặt ở <code>META_VERIFY_TOKEN</code>; App Secret ở <code>META_APP_SECRET</code>.
                      </p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kênh">
                      <select className={inputCls} value={c.form.platform} onChange={(e) => c.setForm({ ...c.form, platform: e.target.value as Platform })}>
                        <option value="facebook">Facebook Messenger</option>
                        <option value="instagram">Instagram DM</option>
                      </select>
                    </Field>
                    <Field label={c.form.platform === "facebook" ? "Page ID" : "Instagram Business ID"}>
                      <input className={inputCls} value={c.form.externalId} onChange={(e) => c.setForm({ ...c.form, externalId: e.target.value })} placeholder="vd 1027465..." />
                    </Field>
                    <Field label="Page Access Token">
                      <input className={inputCls} type="password" value={c.form.token} onChange={(e) => c.setForm({ ...c.form, token: e.target.value })} placeholder="EAAG..." />
                    </Field>
                    <Field label="Tên hiển thị (tuỳ chọn)">
                      <input className={inputCls} value={c.form.name} onChange={(e) => c.setForm({ ...c.form, name: e.target.value })} placeholder="vd Studio ABC - Fanpage" />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={btn("secondary")} disabled={!c.canConnectManual} onClick={() => void c.connectManual()}>
                      <Plug size={16} /> Nối kênh
                    </button>
                    <span className="text-[12px]" style={{ color: "var(--tx3)" }}>Token được mã hoá trước khi lưu và không bao giờ hiện lại trên giao diện.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── TikTok ───────────────────────────────────────────────────────── */}
      <div id="noi-tiktok" style={{ scrollMarginTop: 80 }}>
        <Section icon={Music2} title="TikTok" desc="Nối qua cầu nối của đối tác nhắn tin.">
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
              TikTok có API nhắn tin cho <b>tài khoản doanh nghiệp</b> (khu vực châu Á – Thái Bình Dương, gồm Việt Nam) nhưng còn ở
              giai đoạn thử nghiệm và thường phải đi qua một <b>đối tác nhắn tin</b> được TikTok công nhận. Nên MStudo nối TikTok bằng
              một <b>cầu nối</b>: đối tác đẩy tin khách vào đây, và MStudo gửi tin trả lời ngược lại cho họ.
            </p>
            <Steps
              items={[
                ...(c.origin
                  ? [
                      {
                        title: "Đưa địa chỉ nhận tin cho đối tác",
                        body: (
                          <div className="flex flex-col gap-2.5">
                            <span>
                              Đối tác đẩy tin nhắn khách về địa chỉ này, kèm header <code>Authorization: Bearer &lt;INBOX_INGEST_SECRET&gt;</code>.
                            </span>
                            <CopyField label="Địa chỉ nhận tin" value={`${c.origin}/api/inbox/ingest`} />
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  title: "Điền thông tin cầu nối",
                  body: (
                    <div className="mt-1 grid gap-3 sm:grid-cols-2">
                      <Field label="Tài khoản TikTok" className="sm:col-span-2">
                        <input className={inputCls} value={c.tiktok.externalId} onChange={(e) => c.setTiktok({ ...c.tiktok, externalId: e.target.value })} placeholder="vd @maistudio.vn hoặc business id đối tác cấp" />
                      </Field>
                      <Field label="URL cầu nối (gửi tin ra)">
                        <input className={inputCls} value={c.tiktok.relayUrl} onChange={(e) => c.setTiktok({ ...c.tiktok, relayUrl: e.target.value })} placeholder="https://…" />
                      </Field>
                      <Field label="Khoá ký">
                        <input className={inputCls} type="password" value={c.tiktok.relaySecret} onChange={(e) => c.setTiktok({ ...c.tiktok, relaySecret: e.target.value })} placeholder="chuỗi bí mật dùng chung với đối tác" />
                      </Field>
                    </div>
                  ),
                },
                {
                  title: "Nối và nhắn thử",
                  body: (
                    <div className="flex flex-col items-start gap-2.5">
                      <button type="button" className={btn("secondary")} disabled={!c.canConnectTiktok} onClick={() => void c.connectTiktok()}>
                        <Plug size={16} /> Nối TikTok
                      </button>
                      <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                        MStudo ký mọi tin gửi ra bằng khoá này (header <code>X-Mstudo-Signature</code>) để đối tác biết chắc tin đến từ bạn.
                        URL phải là https và không trỏ vào địa chỉ nội bộ.
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Section>
      </div>
    </Stack>
  );
}
