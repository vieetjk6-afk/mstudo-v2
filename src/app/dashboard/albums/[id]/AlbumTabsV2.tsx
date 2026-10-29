"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Copy, Download, ExternalLink, Eye, FileText, FolderInput,
  FolderOpen, HardDrive, HardDriveDownload, Heart, Info, Link2, Lock, MessageCircle, MessageSquareText, MousePointerClick,
  PackageCheck, Printer, Send, Share2, Trash2, Users,
} from "lucide-react";
import ZaloSendButton from "@/components/ZaloSendButton";
import { useShareLink } from "@/components/share/useShareLink";
import { stripExtension } from "@/lib/drive";
import { studioUrl } from "@/lib/hosts";
import { CATEGORY_PRESETS, slugifyVi } from "@/lib/category";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { albumShareMessage } from "@/lib/share-messages";
import { storageLabel, storageState, STORAGE_EXTEND_CHOICES } from "@/lib/storage-lifecycle";
import { Avatar, Badge, Callout, Empty, Field, Section, Stack, Toolbar, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, Segmented, Switch } from "@/components/v2/kit-client";
import type { Album, AlbumPhase, Photo } from "@/lib/types";
import type { AlbumEditorState, AlbumPick, CustomerShare } from "./useAlbumEditor";
import { Thumb, codesText, copyText, downloadText, shortCode } from "./album-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Các tab còn lại của màn album (giao diện mới): Khách chọn · Chia sẻ ·
   Giao khách · Cài đặt. Logic ở ./useAlbumEditor — file này chỉ vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Khách chọn ──────────────────────────────────────────────────────────── */
export function PicksTabV2({
  e,
  albumId,
  selections,
  onShare,
}: {
  e: AlbumEditorState;
  albumId: string;
  selections: AlbumPick[];
  onShare: () => void;
}) {
  if (selections.length === 0) {
    return (
      <div className="v2-card">
        <Empty
          icon={Heart}
          title="Khách chưa chọn ảnh nào"
          hint="Gửi link album cho khách. Mỗi lần một người mở link và bấm tim là một mã chọn riêng, hiện ngay ở đây."
          action={
            <button type="button" onClick={onShare} className={btn("secondary")}>
              <Send size={16} /> Gửi cho khách
            </button>
          }
        />
      </div>
    );
  }

  const multi = e.pickSessions.length > 1;
  const one = e.pickSessions[0];
  const n = e.visiblePicks.length;

  return (
    <>
      {/* Mã chọn: mỗi người mở link và bấm tim là một mã. Nhiều mã thì bấm để lọc. */}
      {multi && (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Mã chọn">
          <SessionCard
            on={e.pickSession === "all"}
            onClick={() => e.setPickSession("all")}
            lead={
              <span className="v2-section-icon" style={{ width: 34, height: 34 }}>
                <Users size={16} />
              </span>
            }
            title="Tất cả mã chọn"
            sub={`${selections.length} lượt · ${e.pickSessions.length} mã`}
          />
          {e.pickSessions.map((g) => (
            <SessionCard
              key={g.id}
              on={e.pickSession === g.id}
              onClick={() => e.setPickSession(g.id)}
              lead={<Avatar name={g.name || shortCode(g.id)} size={34} />}
              title={g.name || `Mã ${shortCode(g.id)}`}
              sub={`${g.count} ảnh · ${fmtDateTime(g.at)}`}
              code={g.name ? shortCode(g.id) : undefined}
            />
          ))}
        </div>
      )}

      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <Segmented<"all" | "notes">
              label="Lọc ghi chú"
              value={e.notesOnly ? "notes" : "all"}
              onChange={(v) => e.setNotesOnly(v === "notes")}
              options={[
                { value: "all", label: "Mọi ảnh chọn" },
                { value: "notes", label: "Có ghi chú", count: e.notedCount },
              ]}
            />
            <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {!multi && one ? <>{one.name || `Mã ${shortCode(one.id)}`} · </> : null}
              Đang hiện {n} ảnh
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Menu
                width={260}
                trigger={({ toggle, open }) => (
                  <button type="button" onClick={toggle} aria-expanded={open} className={btn("secondary")} disabled={n === 0}>
                    <Copy size={16} /> Chép mã ảnh <ChevronDown size={15} className="-mr-1 opacity-70" />
                  </button>
                )}
                items={[
                  {
                    label: `Chép ${n} mã ảnh`,
                    hint: "Dán vào ô lọc Lightroom / công cụ Lọc ảnh",
                    icon: Copy,
                    onClick: () => {
                      e.copyPickList();
                      e.flash(`Đã chép ${n} mã ảnh khách chọn`);
                    },
                  },
                  { label: "Tải .txt kèm ghi chú", hint: "Gửi thợ chỉnh ảnh", icon: FileText, onClick: e.exportPickList },
                ]}
              />
              <Link href={`/dashboard/albums/${albumId}/selections`} className={btn("ghost")}>
                Chi tiết <ArrowUpRight size={15} />
              </Link>
            </div>
          </Toolbar>
        </div>

        <div className="v2-card-pad">
          {n === 0 ? (
            <Empty
              compact
              icon={MessageSquareText}
              title={e.notesOnly ? "Không có ảnh nào kèm ghi chú" : "Mã chọn này chưa có ảnh nào"}
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 min-[560px]:grid-cols-3 min-[860px]:grid-cols-4 min-[1200px]:grid-cols-5">
              {e.visiblePicks.map((s) => {
                const p = e.photoById.get(s.photo_id);
                const note = (s.client_note || s.photographer_note || "").trim();
                return (
                  <figure key={s.id} className="min-w-0">
                    <div className="relative aspect-[3/2] overflow-hidden rounded-[10px]" style={{ background: "var(--sf2)" }}>
                      {p ? (
                        <Thumb fileId={p.drive_file_id} alt={s.photo_name} />
                      ) : e.photosLoading ? null : (
                        <span className="flex h-full items-center justify-center text-[12px]" style={{ color: "var(--tx3)" }}>
                          Ảnh đã bị gỡ
                        </span>
                      )}
                      {note && (
                        <span
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ background: "var(--ac)", color: "#fff" }}
                          title={note}
                        >
                          <MessageSquareText size={13} />
                        </span>
                      )}
                    </div>
                    <figcaption className="mt-1.5 min-w-0">
                      <p className="v2-num truncate text-[12.5px] font-semibold">{stripExtension(s.photo_name)}</p>
                      {note ? (
                        <p className="line-clamp-2 text-[12px] leading-snug" style={{ color: "var(--tx2)" }} title={note}>
                          “{note}”
                        </p>
                      ) : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SessionCard({
  on,
  onClick,
  lead,
  title,
  sub,
  code,
}: {
  on: boolean;
  onClick: () => void;
  lead: React.ReactNode;
  title: string;
  sub: string;
  code?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className="v2-card flex w-[230px] flex-none items-center gap-3 px-3.5 py-3 text-left"
      style={on ? { borderColor: "var(--ac)", background: "var(--acS)" } : undefined}
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold" style={{ color: on ? "var(--ac)" : undefined }}>{title}</span>
          {code ? <span className="v2-num flex-none text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>{code}</span> : null}
        </span>
        <span className="block truncate text-[12px]" style={{ color: "var(--tx3)" }}>{sub}</span>
      </span>
    </button>
  );
}

const noSubscribe = () => () => {};

/* ── Chia sẻ ─────────────────────────────────────────────────────────────── */
export function ShareTabV2({
  e,
  album,
  customerShares,
  studioHost,
  clientPhone,
  clientName,
  contractId,
  zaloSavedName,
}: {
  e: AlbumEditorState;
  album: Album;
  customerShares: CustomerShare[];
  studioHost: string | null;
  clientPhone: string | null;
  clientName: string | null;
  contractId: string | null;
  zaloSavedName: string | null;
}) {
  const link = e.clientLink;
  // Link có thể tương đối (chưa bật tên miền riêng) — hiện & chép bản đầy đủ.
  // Gốc trang chỉ biết ở trình duyệt; máy chủ dựng bản tương đối, không lệch hydrate.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const absolute = /^https?:\/\//i.test(link) ? link : `${origin}${link}`;
  const message = albumShareMessage(clientName || album.client_name, absolute);
  const share = useShareLink(absolute, e.form.title, message);
  const isDelivery = e.phase === "delivery";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <Stack gap={16}>
        <Section
          icon={Link2}
          title="Link gửi khách"
          desc={isDelivery ? "Khách mở link để xem và tải ảnh hoàn thiện." : "Khách mở link để chọn ảnh ngay trên điện thoại."}
          actions={
            e.savedForm.status === "published" ? <Badge tone="green" dot>Khách mở được</Badge> : <Badge tone="amber" dot>Album đang là nháp</Badge>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={absolute} aria-label="Link gửi khách" onFocus={(ev) => ev.currentTarget.select()} className={inputCls} style={{ color: "var(--tx2)" }} />
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(absolute)) e.flash("Đã chép link album");
                }}
                className={btn("secondary", "md", "w-full sm:w-auto")}
              >
                <Copy size={16} /> Chép link
              </button>
            </div>

            <div className="flex flex-col gap-2 rounded-[12px] p-3.5" style={{ background: "var(--sf2)" }}>
              <p className="v2-label">Lời nhắn gửi kèm</p>
              <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>{message}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => void share.copy()} className={btn("soft", "sm")}>
                  {share.copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {share.copied ? "Đã chép" : "Chép lời nhắn kèm link"}
                </button>
                {share.canNativeShare && (
                  <button type="button" onClick={() => void share.nativeShare()} className={btn("ghost", "sm")}>
                    <Share2 size={15} /> Chia sẻ nhanh
                  </button>
                )}
                <a href={link} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
                  <Eye size={15} /> Xem như khách
                </a>
              </div>
            </div>
            {e.savedForm.status !== "published" && (
              <p className="text-[12.5px]" style={{ color: "var(--am)" }}>
                Khách chưa mở được link khi album còn là nháp. Bật “Xuất bản” ở tab Cài đặt.
              </p>
            )}
          </div>
        </Section>

        <Section icon={MessageCircle} title="Gửi qua Zalo" desc="Gửi tự động bằng tài khoản Zalo studio đã kết nối, kèm lời nhắn ở trên.">
          <ZaloSendButton
            phone={clientPhone || album.client_phone}
            name={clientName || album.client_name}
            contractId={contractId}
            albumId={album.id}
            savedName={zaloSavedName}
            audience="client"
            kind="album_share"
            askPhone
            className={btn("secondary")}
            wrapClassName="w-full"
            message={albumShareMessage(clientName || album.client_name, link)}
          />
        </Section>

        <CustomerSharesV2 e={e} shares={customerShares} slug={album.slug} baseUrl={studioUrl(studioHost, `/${isDelivery ? "album" : "a"}/${e.form.slug}`)} />
      </Stack>

      <PasswordCardV2 e={e} />
    </div>
  );
}

function PasswordCardV2({ e }: { e: AlbumEditorState }) {
  const removing = e.hasPassword && !e.newPassword;
  return (
    <Section
      icon={Lock}
      title="Mật khẩu album"
      desc="Khách phải nhập đúng mật khẩu mới xem được album."
      actions={e.hasPassword ? <Badge tone="green" dot>Đang bật</Badge> : <Badge tone="gray" dot>Chưa đặt</Badge>}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void e.savePassword();
        }}
      >
        <Field label={e.hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"} hint={e.hasPassword ? "Để trống rồi bấm Gỡ để bỏ mật khẩu." : "Để trống là ai có link cũng xem được."}>
          <input
            type="text"
            className={inputCls}
            placeholder={e.hasPassword ? "•••••• (đã đặt)" : "Nhập mật khẩu"}
            value={e.newPassword}
            onChange={(ev) => e.setNewPassword(ev.target.value)}
          />
        </Field>
        <button
          type="submit"
          disabled={!e.hasPassword && !e.newPassword}
          className={btn(removing ? "danger" : "secondary", "md", "w-full")}
        >
          {removing ? <><Trash2 size={16} /> Gỡ mật khẩu</> : <><Lock size={16} /> Lưu mật khẩu</>}
        </button>
      </form>
    </Section>
  );
}

function CustomerSharesV2({ e, shares, slug, baseUrl }: { e: AlbumEditorState; shares: CustomerShare[]; slug: string; baseUrl: string }) {
  const byId = new Map<string, Photo>();
  for (const p of e.photos) {
    byId.set(p.id, p);
    if (p.drive_file_id) byId.set(p.drive_file_id, p);
  }
  return (
    <Section
      icon={Users}
      title="Link khách tự chia sẻ"
      desc="Khách chọn vài ảnh rồi bấm “Chia sẻ ảnh đã chọn” để gửi người thân, thợ in…"
      flush
      actions={shares.length ? <Badge tone="blue">{shares.length} link</Badge> : null}
    >
      {shares.length === 0 ? (
        <Empty compact icon={Share2} title="Khách chưa tạo link chia sẻ nào" hint="Link khách tạo và mã các ảnh trong link sẽ hiện ở đây." />
      ) : (
        shares.map((sh) => {
          const list = sh.photoIds.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
          const missing = sh.photoIds.length - list.length;
          const url = `${baseUrl}?s=${sh.token}`;
          const names = list.map((p) => p.name);
          const moreCls = `v2-num h-10 w-10 items-center justify-center rounded-[9px] text-[12px] font-semibold ${list.length > 4 ? "flex" : "flex sm:hidden"}`;
          const moreStyle = { border: "2px solid var(--sf)", background: "var(--sf2)", color: "var(--tx2)" };
          return (
            <div key={sh.token} className="v2-row flex-wrap sm:flex-nowrap">
              <div className="flex flex-none -space-x-2">
                {/* Điện thoại 2 ảnh, máy tính 4 ảnh — phần còn lại gộp thành "+N". */}
                {list.slice(0, 4).map((p, i) => (
                  <span
                    key={p.id}
                    className={`h-10 w-10 overflow-hidden rounded-[9px] ${i >= 2 ? "hidden sm:block" : "block"}`}
                    style={{ border: "2px solid var(--sf)", background: "var(--sf2)" }}
                  >
                    <Thumb fileId={p.drive_file_id} alt={p.name} w={120} />
                  </span>
                ))}
                {list.length > 2 && (
                  <span className={moreCls} style={moreStyle}>
                    <span className="sm:hidden">+{list.length - 2}</span>
                    {list.length > 4 && <span className="hidden sm:inline">+{list.length - 4}</span>}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="v2-row-title">Link chia sẻ · {list.length} ảnh</p>
                <p className="v2-row-sub">
                  {fmtDateTime(sh.createdAt)}
                  {missing > 0 && ` · ${missing} ảnh không còn trong album`}
                </p>
              </div>
              <div className="flex flex-none items-center gap-1">
                <a href={url} target="_blank" rel="noopener noreferrer" className={iconBtn()} aria-label="Mở link chia sẻ" title="Mở link">
                  <ExternalLink size={16} />
                </a>
                <Menu
                  label="Thao tác với link chia sẻ"
                  width={230}
                  items={[
                    {
                      label: `Chép ${names.length} mã ảnh`,
                      icon: Copy,
                      disabled: names.length === 0,
                      onClick: async () => {
                        if (await copyText(codesText(names))) e.flash(`Đã chép ${names.length} mã ảnh`);
                      },
                    },
                    { label: "Tải danh sách .txt", icon: FileText, disabled: names.length === 0, onClick: () => downloadText(codesText(names), `${slug}-chia-se-${sh.token}`) },
                    "divider",
                    { label: "Mở link", icon: ExternalLink, href: url, external: true },
                  ]}
                />
              </div>
            </div>
          );
        })
      )}
    </Section>
  );
}

/* ── Giao khách ──────────────────────────────────────────────────────────── */
export function DeliverTabV2({
  e,
  album,
  canDelivery,
  onPrint,
}: {
  e: AlbumEditorState;
  album: Album;
  canDelivery: boolean;
  onPrint?: () => void;
}) {
  const isDelivery = e.phase === "delivery";
  const showLink = isDelivery || e.manualContract;
  return (
    <Stack gap={16}>
      <Section icon={PackageCheck} title="Giai đoạn album" desc="Link khách hiện bộ ảnh của giai đoạn đang chọn.">
        <div className="grid gap-3 sm:grid-cols-2">
          <PhaseCard
            on={!isDelivery}
            icon={MousePointerClick}
            title="Chọn ảnh"
            desc="Khách xem ảnh gốc và bấm tim chọn ảnh."
            action={
              isDelivery ? (
                <button type="button" onClick={() => void e.switchPhase("selection")} disabled={e.phaseBusy} className={btn("secondary", "sm")}>
                  {e.phaseBusy ? "Đang chuyển…" : "Về Chọn ảnh"}
                </button>
              ) : null
            }
          />
          <PhaseCard
            on={isDelivery}
            icon={Send}
            title="Giao khách"
            desc="Khách xem và tải ảnh hoàn thiện."
            action={
              isDelivery ? null : canDelivery ? (
                <button type="button" onClick={() => void e.switchPhase("delivery")} disabled={e.phaseBusy} className={btn("soft", "sm")}>
                  {e.phaseBusy ? "Đang chuyển…" : <>Chuyển sang Giao khách <ArrowRight size={15} /></>}
                </button>
              ) : (
                <Link href="/dashboard/upgrade" className={btn("secondary", "sm")} title="Nâng cấp để dùng giao khách">
                  <Lock size={14} /> Nâng cấp gói
                </Link>
              )
            }
          />
        </div>
        {!showLink && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Hậu kỳ xong thì chuyển sang Giao khách để dán link thư mục ảnh hoàn thiện.
          </p>
        )}
      </Section>

      {showLink && (
        <Section icon={FolderInput} title="Ảnh hoàn thiện" desc="Link thư mục Drive ảnh đã chỉnh sửa, hiện cho khách ở album giao.">
          <div className="flex flex-col gap-3">
            {!isDelivery && (
              <Callout tone="blue" icon={Info}>
                Dán link ảnh hoàn thiện trước, rồi bấm <b>“Chuyển sang Giao khách”</b> ở trên. Khách nhận ảnh trên chính album này.
              </Callout>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
                <input
                  className={inputCls}
                  style={{ paddingLeft: 36 }}
                  placeholder="Dán link thư mục Google Drive ảnh đã chỉnh sửa…"
                  value={e.editedUrl}
                  onChange={(ev) => e.setEditedUrl(ev.target.value)}
                  aria-label="Link ảnh đã chỉnh sửa"
                />
              </div>
              <button
                type="button"
                onClick={() => void e.saveDeliveryLink()}
                disabled={e.deliveryBusy || e.syncing || !e.editedUrl.trim()}
                className={btn("soft", "md", "w-full sm:w-auto")}
              >
                {e.deliveryBusy ? "Đang lưu…" : "Lưu & đồng bộ"}
              </button>
            </div>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Ảnh gốc khách đã chọn tự thành nút <b>“Ảnh gốc”</b> để khách xem/tải trên Drive. Thư mục cần chia sẻ “ai có link xem
              được”. Thư mục con tự thành từng mục riêng ở album giao khách.
            </p>

            {e.deliveryFolders.length > 1 && (
              <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
                <p className="px-3.5 pb-1 pt-2.5 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                  Thư mục giao khách đã tách riêng ({e.deliveryFolders.length})
                </p>
                {e.deliveryFolders.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3.5 py-2 text-[13px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <FolderOpen size={14} className="flex-none" style={{ color: "var(--tx3)" }} />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="v2-num flex-none font-semibold" style={{ color: "var(--tx2)" }}>
                      {e.photos.filter((ph) => ph.source_id === f.id).length} ảnh
                    </span>
                  </div>
                ))}
              </div>
            )}

            {e.deliveryMissing.length ? (
              <Callout tone="amber" title="Nút “Tải file chỉnh sửa” chưa hiện với khách">
                Còn thiếu: {e.deliveryMissing.join("; ")}.
              </Callout>
            ) : (
              <Callout tone="green" icon={CheckCircle2} title="Nút “Tải file chỉnh sửa” đang hiện ở đầu album giao khách" />
            )}
          </div>
        </Section>
      )}

      {isDelivery && e.deliveryFolders.length > 0 && (
        <Section icon={HardDriveDownload} title="Tải album gốc từ Drive" desc="Chất lượng gốc, không nén, không watermark. Google phục vụ trực tiếp, không tốn băng thông máy chủ.">
          <div className="flex flex-wrap gap-2">
            {e.deliveryFolders.map((s) => (
              <a
                key={s.id}
                href={s.drive_url}
                target="_blank"
                rel="noreferrer"
                className={btn("secondary", "sm")}
                title="Mở thư mục trên Google Drive để tải trực tiếp"
              >
                <Download size={15} /> Mở thư mục Drive{e.deliveryFolders.length > 1 ? ` · ${s.name}` : ""}
              </a>
            ))}
          </div>
        </Section>
      )}

      {album.delivered_at && <StorageCardV2 e={e} deliveredAt={album.delivered_at} />}

      {onPrint && (
        <button type="button" onClick={onPrint} className="v2-card v2-card-link flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="v2-section-icon"><Printer size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Ảnh in tặng khách</span>
            <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>Số ảnh tặng, ảnh khách chọn in, chép vào thư mục in</span>
          </span>
          <ArrowRight size={16} style={{ color: "var(--tx3)" }} />
        </button>
      )}
    </Stack>
  );
}

function PhaseCard({
  on,
  icon: Icon,
  title,
  desc,
  action,
}: {
  on: boolean;
  icon: typeof Send;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] p-4"
      style={on ? { border: "1.5px solid var(--ac)", background: "var(--acS)" } : { border: "1px solid var(--bd)", background: "var(--sf)" }}
    >
      <div className="flex items-start gap-3">
        <span className="v2-section-icon" style={on ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", color: "var(--tx2)" }}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            {title}
            {on ? <Badge tone="brand">Đang dùng</Badge> : null}
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>{desc}</p>
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function StorageCardV2({ e, deliveredAt }: { e: AlbumEditorState; deliveredAt: string }) {
  const st = storageState(e.storageDate);
  const tone: Tone = st === "expired" ? "red" : st === "warn" ? "amber" : st === "none" ? "gray" : "green";
  return (
    <Section
      icon={HardDrive}
      title="Lưu trữ ảnh gốc trên Drive"
      desc={`Giao khách ngày ${fmtDate(deliveredAt)}${e.storageDate ? ` · dự kiến dọn ảnh gốc ngày ${fmtDate(e.storageDate)}` : ""}`}
      actions={<Badge tone={tone} dot>{storageLabel(e.storageDate)}</Badge>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          mstudo không tự xoá ảnh. Tới hạn bạn sẽ được nhắc để tự dọn thư mục gốc trên Drive, hoặc gia hạn thêm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">Gia hạn:</span>
          {STORAGE_EXTEND_CHOICES.map((m) => (
            <button key={m} type="button" onClick={() => void e.extendStorage(m)} disabled={e.storageBusy} className={btn("secondary", "sm")}>
              + {m} tháng
            </button>
          ))}
          {e.storageDate && (
            <button type="button" onClick={() => void e.clearStorage()} disabled={e.storageBusy} className={btn("ghost", "sm")}>
              Giữ vô thời hạn
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ── Cài đặt ─────────────────────────────────────────────────────────────── */
export function SettingsTabV2({
  e,
  phase,
  canDelivery,
  canPinHome,
  canWatermark,
  studioCats,
  studioHost,
}: {
  e: AlbumEditorState;
  phase: AlbumPhase;
  canDelivery: boolean;
  canPinHome: boolean;
  canWatermark: boolean;
  studioCats: { slug: string; label: string }[];
  studioHost: string | null;
}) {
  const { form, setForm } = e;
  const prefix = studioUrl(studioHost, "/a/").replace(/^https?:\/\//, "");
  const row = { borderTop: "1px solid var(--bd2)" };
  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <Section icon={Info} title="Thông tin album" desc="Tên, mô tả và đường dẫn khách nhìn thấy.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên album" className="sm:col-span-2">
            <input className={inputCls} value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} />
          </Field>
          <Field label="Mô tả" className="sm:col-span-2" hint="Hiện dưới tên album ở trang khách.">
            <textarea className={inputCls} value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} />
          </Field>
          <Field label="Đường dẫn" hint="Đổi đường dẫn thì link cũ đã gửi khách sẽ không mở được nữa.">
            <div className="flex min-w-0">
              <span
                className="v2-num flex max-w-[55%] flex-none items-center truncate rounded-l-[10px] px-2.5 text-[13px]"
                style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRight: 0, color: "var(--tx3)" }}
                title={prefix}
              >
                {prefix}
              </span>
              <input
                className={inputCls}
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, minWidth: 0 }}
                value={form.slug}
                onChange={(ev) => setForm({ ...form, slug: ev.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })}
                aria-label="Đường dẫn album"
              />
            </div>
          </Field>
          <Field
            label="Loại album"
            hint={
              <>
                Gõ loại mới là tự lưu để dùng lại.{" "}
                <Link href="/dashboard/studio/album-categories" className="font-semibold" style={{ color: "var(--ac)" }}>
                  Quản lý loại album
                </Link>
              </>
            }
          >
            <input
              className={inputCls}
              list="album-category-presets-v2"
              placeholder="VD: Cưới, Sự kiện, Doanh nghiệp…"
              value={form.category_label}
              onChange={(ev) => {
                const label = ev.target.value;
                setForm({ ...form, category_label: label, category: slugifyVi(label) });
              }}
            />
            <datalist id="album-category-presets-v2">
              {/* Loại của CHÍNH studio đã dùng (ưu tiên), rồi tới gợi ý mẫu. */}
              {studioCats.map((c) => (
                <option key={`s-${c.slug}`} value={c.label} />
              ))}
              {CATEGORY_PRESETS.filter((p) => !studioCats.some((c) => c.slug === p.slug)).map((c) => (
                <option key={`p-${c.slug}`} value={c.label} />
              ))}
            </datalist>
          </Field>
        </div>
      </Section>

      <Section icon={Users} title="Khách xem và chọn ảnh" desc="Khách được làm gì trên trang album.">
        <div className="flex flex-col">
          <Field label="Số ảnh khách được chọn tối đa" hint="Để trống là không giới hạn." className="pb-3">
            <input
              type="number"
              min={0}
              className={inputCls}
              style={{ maxWidth: 220 }}
              placeholder="Không giới hạn"
              value={form.selection_limit}
              onChange={(ev) => setForm({ ...form, selection_limit: ev.target.value })}
            />
          </Field>
          <div style={row}>
            <Switch
              label="Cho phép khách tải ảnh xuống"
              desc="Tắt thì khách chỉ xem được, không tải về máy."
              checked={form.download_enabled}
              onChange={(v) => setForm({ ...form, download_enabled: v })}
            />
          </div>
          {canWatermark ? (
            <>
              <div style={row}>
                <Switch
                  label="Đóng dấu watermark"
                  desc="Chữ tự gắn lên ảnh khi khách xem (kể cả phóng to), chống chụp màn hình."
                  checked={form.watermark_enabled}
                  onChange={(v) => setForm({ ...form, watermark_enabled: v })}
                />
                {form.watermark_enabled && (
                  <div className="pb-3 pl-0 sm:pl-0">
                    <input
                      className={inputCls}
                      placeholder="Chữ watermark, VD tên studio"
                      value={form.watermark_text}
                      onChange={(ev) => setForm({ ...form, watermark_text: ev.target.value })}
                      aria-label="Chữ watermark"
                    />
                  </div>
                )}
              </div>
              {canDelivery && (
                <div style={row}>
                  <Switch
                    label="Watermark cả ở giai đoạn Giao khách"
                    desc="Ảnh hoàn thiện khách xem cũng có watermark."
                    checked={form.watermark_delivery}
                    onChange={(v) => setForm({ ...form, watermark_delivery: v })}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="pt-3" style={row}>
              <Callout tone="gray" icon={Lock} title="Watermark có ở gói Photographer Plus và Studio">
                Ảnh không watermark được tải thẳng từ Google Drive nên nhanh hơn và không giới hạn lượt tải.
              </Callout>
            </div>
          )}
        </div>
      </Section>

      <Section icon={Eye} title="Hiển thị" desc="Ai nhìn thấy album này.">
        <div className="flex flex-col">
          <Switch
            label="Xuất bản"
            desc={form.status === "published" ? "Khách mở được link album." : "Đang là nháp, khách chưa mở được link."}
            checked={form.status === "published"}
            onChange={(v) => setForm({ ...form, status: v ? "published" : "draft" })}
          />
          {/* "Hiện ở trang chủ" chỉ có nghĩa ở giai đoạn giao khách. */}
          {phase === "delivery" && canPinHome && (
            <div style={row}>
              <Switch
                label="Hiện ở trang chủ công khai"
                desc="Khách xem không cần mật khẩu."
                checked={form.gallery_pinned}
                onChange={(v) => setForm({ ...form, gallery_pinned: v })}
              />
            </div>
          )}
          {phase === "delivery" && canDelivery && !canPinHome && (
            <div className="flex items-center gap-3 py-2.5" style={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">Hiện ở trang chủ công khai</span>
                <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>Có ở gói Photographer / Studio.</span>
              </span>
              <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
                <Lock size={14} /> Nâng cấp
              </Link>
            </div>
          )}
        </div>
      </Section>

      <div className="v2-card v2-card-pad flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold" style={{ color: "var(--rd)" }}>Xoá album</p>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Xoá album và mọi lựa chọn của khách, không hoàn tác được. Số album đã tạo trong tháng vẫn được tính.
          </p>
        </div>
        <button type="button" onClick={() => void e.deleteAlbum()} disabled={e.deleting} className={btn("danger", "md", "self-start sm:self-auto")}>
          <Trash2 size={16} /> {e.deleting ? "Đang xoá…" : "Xoá album này"}
        </button>
      </div>

      {!e.dirty && (
        <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          <CheckCircle2 size={14} /> Mọi cài đặt đã được lưu. Sửa gì là thanh “Lưu thay đổi” hiện ở đáy màn.
        </p>
      )}
    </div>
  );
}
