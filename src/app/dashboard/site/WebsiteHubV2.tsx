"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot, Copy, ExternalLink, EyeOff, Globe, LayoutTemplate, Lock, MessageSquareText, PencilRuler, Rocket, Search,
} from "lucide-react";
import { Badge, Callout, Empty, PageHead, Section, Stack, btn } from "@/components/v2/kit";
import { Menu, Switch, type MenuItem } from "@/components/v2/kit-client";
import CustomDomain from "@/components/CustomDomain";
import { createClient } from "@/lib/supabase/client";
import type { Site } from "@/lib/types";
import { useSitePublishing } from "./useSiteSettings";
import { DomainStateBadge, SeoFields, SubdomainField, ToastV2, blockIcon } from "./SiteSettingsV2";
import { chatRules, updatedAgo, DEFAULT_GREETING } from "./hub-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   WEBSITE & CHATBOX — giao diện mới. Bản cũ (WebsiteHub) chỉ để XEM tình
   trạng rồi đẩy mọi việc sang trình dựng; bản mới sắp lại thành:
     • Thẻ trạng thái: địa chỉ trang, đang công khai hay chưa, cập nhật lúc
       nào, lượt xem — MỘT nút chính "Mở trình dựng"; "Xem trang", chép link,
       gỡ xuất bản nằm cạnh / trong ⋯.
     • Cột trái: Địa chỉ trang (công tắc công khai + tên miền phụ + tên miền
       riêng) và SEO & chia sẻ — sửa ngay tại đây, cùng đường lưu với trình
       dựng (../useSiteSettings).
     • Cột phải: Trợ lý chatbox (lời chào + kịch bản) và danh sách khối nội
       dung trên trang.
   ═══════════════════════════════════════════════════════════════════════════ */

export type WebsiteHubV2Props = {
  site: Site;
  stats: { today: number; week: number; month: number };
  blocks: { id: string; type: string; label: string; visible: boolean }[];
  greeting: string;
  instructions: string;
  canPublish: boolean;
  canCustomDomain: boolean;
  mainHost: string;
};

export default function WebsiteHubV2({
  site, stats, blocks, greeting, instructions, canPublish, canCustomDomain, mainHost,
}: WebsiteHubV2Props) {
  const supabase = useMemo(() => createClient(), []);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(m: string, ms = 2200) {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }

  const pub = useSitePublishing({ site, supabase, mainHost, canPublish, flash });

  // Địa chỉ đang chạy: tên miền riêng trước, rồi tới tên miền phụ (đã lưu).
  const host = site.custom_domain || (pub.savedSub && mainHost ? `${pub.savedSub}.${mainHost}` : "");
  const liveUrl = host ? `https://${host}` : "";
  const ago = updatedAgo(site.updated_at);
  const rules = chatRules(instructions);
  const shown = blocks.filter((b) => b.visible).length;

  function copyLink() {
    if (!liveUrl) return;
    navigator.clipboard?.writeText(liveUrl).then(
      () => flash("Đã chép link trang"),
      () => flash("Không chép được — bấm giữ link để chép tay."),
    );
  }

  const menu: MenuItem[] = [
    ...(liveUrl
      ? ([
          { label: "Chép link trang", hint: host, icon: Copy, onClick: copyLink },
          { label: "Mở trang", icon: ExternalLink, href: liveUrl, external: true },
        ] as MenuItem[])
      : []),
    ...(pub.published
      ? ([
          ...(liveUrl ? (["divider"] as MenuItem[]) : []),
          { label: "Gỡ xuất bản", hint: "Khách sẽ không mở được trang", icon: EyeOff, danger: true, onClick: () => void pub.togglePublish(), disabled: pub.busy || !canPublish },
        ] as MenuItem[])
      : []),
  ];

  const stat = (v: number, l: string) => (
    <div className="min-w-0">
      <p className="v2-num text-[19px] font-bold leading-tight" style={{ letterSpacing: "-.4px" }}>{v.toLocaleString("vi-VN")}</p>
      <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>{l}</p>
    </div>
  );

  return (
    <Stack>
      <PageHead desc="Trang giới thiệu của studio và trợ lý chatbox trả lời khách 24/7. Nội dung trang sửa trong trình dựng; địa chỉ, SEO sửa ngay tại đây." />

      {/* ── Thẻ trạng thái ─────────────────────────────────────────────── */}
      <div className="v2-card overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span
              className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px]"
              style={pub.published ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
            >
              <Globe size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 max-w-full truncate text-[17px] font-bold sm:text-[19px]" style={{ letterSpacing: "-.3px" }} title={host}>
                  {host || "Chưa có địa chỉ trang"}
                </p>
                {pub.published ? <Badge tone="green" dot>Đang công khai</Badge> : <Badge tone="amber" dot>Chưa xuất bản</Badge>}
              </div>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>
                {ago ? `Cập nhật ${ago} · ` : ""}
                {blocks.length ? `${shown}/${blocks.length} khối đang hiện` : "Chưa có khối nội dung"}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Link href="/dashboard/site/builder" className={btn("primary", "md", "flex-1 md:flex-none")}>
              <PencilRuler size={16} /> {blocks.length ? "Mở trình dựng" : "Dựng trang"}
            </Link>
            {liveUrl && pub.published ? (
              <a href={liveUrl} target="_blank" rel="noreferrer" className={btn("secondary", "md", "flex-1 md:flex-none")}>
                <ExternalLink size={16} /> Xem trang
              </a>
            ) : null}
            {menu.length ? <Menu label="Thêm thao tác với trang" width={250} items={menu} /> : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
          {stat(stats.today, "Xem hôm nay")}
          {stat(stats.week, "7 ngày qua")}
          {stat(stats.month, "30 ngày qua")}
        </div>
      </div>

      {!pub.published &&
        (canPublish ? (
          <Callout
            tone="amber"
            icon={Rocket}
            title="Trang chưa xuất bản"
            action={
              <button type="button" onClick={() => void pub.togglePublish()} disabled={pub.busy} className={btn("soft", "sm")}>
                Xuất bản ngay
              </button>
            }
          >
            Khách chưa mở được trang. Đặt tên miền phụ bên dưới rồi xuất bản.
          </Callout>
        ) : (
          <Callout
            tone="amber"
            icon={Lock}
            title="Gói hiện tại chưa xuất bản được website"
            action={
              <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
                Xem gói
              </Link>
            }
          >
            Bạn vẫn dựng và xem trước trang được; nâng cấp để đưa trang lên mạng.
          </Callout>
        ))}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Stack>
          <Section
            icon={Globe}
            title="Địa chỉ trang"
            desc="Tên miền khách gõ để mở trang của bạn."
            actions={<DomainStateBadge state={pub.domainState} saved={!!pub.savedSub} />}
          >
            <div className="flex flex-col gap-4">
              <div className="-my-2">
                <Switch
                  checked={pub.published}
                  onChange={() => void pub.togglePublish()}
                  disabled={pub.busy || !canPublish}
                  label="Công khai trang"
                  desc={pub.published ? "Khách đang mở được trang." : "Tắt — khách chưa mở được trang."}
                />
              </div>
              <div className="h-px" style={{ background: "var(--bd2)" }} />
              <SubdomainField pub={pub} mainHost={mainHost} />
              {canCustomDomain ? (
                <div className="-mt-4">
                  <CustomDomain
                    initialDomain={site.custom_domain ?? null}
                    initialVerified={!!site.custom_domain_verified}
                  />
                </div>
              ) : (
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  Tên miền riêng (vd studio.com) có ở gói Photographer Plus và Studio.
                </p>
              )}
            </div>
          </Section>

          <Section icon={Search} title="SEO & chia sẻ" desc="Chữ hiện trên Google và khi dán link vào Facebook, Zalo.">
            <SeoFields site={site} supabase={supabase} onFlash={flash} host={host} />
          </Section>
        </Stack>

        <Stack>
          <Section
            icon={Bot}
            title="Trợ lý chatbox"
            desc="Trả lời khách 24/7 theo kịch bản của bạn."
            actions={
              <Link href="/dashboard/studio/chatbox" className={btn("secondary", "sm")}>
                {rules.length ? "Sửa kịch bản" : "Dạy bot"}
              </Link>
            }
          >
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Lời chào mở đầu</p>
                <div className="flex items-end gap-2">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    <Bot size={15} />
                  </span>
                  <p
                    className="max-w-[90%] rounded-[14px] px-3 py-2 text-[13.5px] leading-relaxed"
                    style={{ background: "var(--sf2)", color: "var(--tx)", borderBottomLeftRadius: 4, textWrap: "pretty" }}
                  >
                    {greeting.trim() || DEFAULT_GREETING}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
                  Kịch bản trả lời{rules.length ? ` · ${rules.length}` : ""}
                </p>
                {rules.length === 0 ? (
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Chưa dạy bot điều gì. Bot vẫn biết dịch vụ &amp; bảng giá của studio, nhưng chưa có chính sách cọc, thời gian giao ảnh hay giọng văn riêng.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {rules.slice(0, 6).map((r, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                        <MessageSquareText size={15} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} />
                        <span className="min-w-0">{r}</span>
                      </li>
                    ))}
                    {rules.length > 6 && (
                      <li className="pl-[25px] text-[12.5px]" style={{ color: "var(--tx3)" }}>… và {rules.length - 6} dòng nữa</li>
                    )}
                  </ol>
                )}
              </div>
            </div>
          </Section>

          <Section
            icon={LayoutTemplate}
            title="Nội dung trang"
            desc={blocks.length ? `${shown}/${blocks.length} khối đang hiện` : "Ảnh bìa, bộ sưu tập, bảng giá, liên hệ…"}
            actions={
              blocks.length ? (
                <Link href="/dashboard/site/builder" className={btn("ghost", "sm")}>
                  Sắp xếp
                </Link>
              ) : undefined
            }
            flush
          >
            {blocks.length === 0 ? (
              <Empty
                compact
                icon={LayoutTemplate}
                title="Trang chưa có khối nào"
                hint="Mở trình dựng để chọn mẫu sẵn hoặc xếp từng khối."
              />
            ) : (
              <ul className="grid gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-2 sm:px-5">
                {blocks.map((b) => {
                  const Icon = blockIcon(b.type);
                  return (
                    <li key={b.id} className="flex min-w-0 items-center gap-2.5 py-1.5" title={b.visible ? undefined : "Đang ẩn khỏi trang"}>
                      <span
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                        style={{ background: "var(--sf2)", color: b.visible ? "var(--tx2)" : "var(--tx3)" }}
                      >
                        {b.visible ? <Icon size={14} /> : <EyeOff size={14} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]" style={{ color: b.visible ? "var(--tx)" : "var(--tx3)" }}>
                        {b.label}
                        {b.visible ? null : <span className="text-[12px]"> · đang ẩn</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </Stack>
      </div>

      {toast && <ToastV2>{toast}</ToastV2>}
    </Stack>
  );
}
