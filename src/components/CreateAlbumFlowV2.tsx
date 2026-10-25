"use client";

import Link from "next/link";
import {
  ArrowRight, Check, CheckCircle2, Copy, Download, Droplets, Eye, FolderOpen, FolderTree, Hash, ImageIcon, Info, Link2,
  Lock, MessageSquareText, MousePointerClick, Pencil, Plus, QrCode, Send, X,
} from "lucide-react";
import PlanUsage from "@/components/PlanUsage";
import { isFolderLink } from "@/lib/drive";
import { Badge, Callout, Field, PageHead, Stack, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { useCreateAlbum, type CreateAlbumProps } from "@/components/useCreateAlbum";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO ALBUM TỪ GOOGLE DRIVE — giao diện mới. Cùng logic với CreateAlbumFlow
   (bản cũ, ./useCreateAlbum); khác ở cách sắp xếp:
     • Một cột các bước đánh số: 1 Đặt tên · 2 Thư mục Google Drive · 3 Tuỳ
       chọn cho khách. Mỗi link Drive báo ngay là thư mục, ảnh lẻ hay link sai.
     • MỘT nút chính "Tạo album" cuối form. Tạo xong, khối các bước nhường chỗ
       cho thẻ "Gửi cho khách": link, mã QR, xem như khách, mở album.
     • Cột phải: tóm tắt khách sẽ nhận được gì + hạn mức gói.
   ═══════════════════════════════════════════════════════════════════════════ */

type LinkKind = { label: string; tone: Tone } | null;
function linkKind(url: string): LinkKind {
  const u = url.trim();
  if (!u) return null;
  if (isFolderLink(u)) return { label: "Thư mục Drive", tone: "green" };
  if (/drive\.google\.com|docs\.google\.com/.test(u)) return { label: "Ảnh lẻ trên Drive", tone: "blue" };
  return { label: "Chưa phải link Google Drive", tone: "amber" };
}

export default function CreateAlbumFlowV2(props: CreateAlbumProps) {
  const c = useCreateAlbum(props);
  const links = c.drives.map((d) => d.trim()).filter(Boolean);
  const nameOk = !!c.name.trim();
  const kindLabel = c.isDelivery ? "Album giao khách" : "Album chọn ảnh";
  const cta = c.busy ? "Đang tạo…" : c.loggedIn === false ? "Đăng nhập Google và tạo" : "Tạo album";

  return (
    <Stack>
      <PageHead
        desc={
          c.isDelivery
            ? "Gửi ảnh đã chỉnh cho khách xem và tải về. Dán thư mục Google Drive, đặt khoá nếu cần, xong là có link gửi khách."
            : "Khách chọn ảnh ngay trên điện thoại. Dán thư mục Google Drive, đặt vài tuỳ chọn, xong là có link và mã QR gửi khách."
        }
        actions={
          <Badge tone={c.isDelivery ? "blue" : "brand"} icon={c.isDelivery ? Send : MousePointerClick}>
            {kindLabel}
          </Badge>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {c.result ? (
          <ResultCard c={c} />
        ) : (
          <form
            className="v2-card"
            onSubmit={(e) => {
              e.preventDefault();
              void c.create();
            }}
          >
            <div className="flex flex-col px-4 pt-5 sm:px-6 sm:pt-6">
              <Step n={1} done={nameOk} title="Đặt tên album" desc="Khách thấy tên này ở đầu trang album.">
                <input
                  value={c.name}
                  onChange={(e) => c.setName(e.target.value)}
                  placeholder="VD: Mai & Long · Đám cưới"
                  className={inputCls}
                  aria-label="Tên album"
                />
              </Step>

              <Step
                n={2}
                done={links.length > 0}
                title="Chọn thư mục Google Drive"
                desc="Dán link thư mục ảnh (hoặc link từng ảnh). Có thể thêm nhiều thư mục, mỗi thư mục thành một mục trong album."
              >
                <div className="flex flex-col gap-2.5">
                  {c.drives.map((d, i) => {
                    const k = linkKind(d);
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
                            <input
                              value={d}
                              onChange={(e) => c.setDrives((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                              placeholder={i === 0 ? "https://drive.google.com/drive/folders/…" : "Link Drive bổ sung…"}
                              className={inputCls}
                              style={{ paddingLeft: 36 }}
                              aria-label={`Link Google Drive ${i + 1}`}
                            />
                          </div>
                          {c.drives.length > 1 && (
                            <button
                              type="button"
                              onClick={() => c.setDrives((arr) => arr.filter((_, j) => j !== i))}
                              className={iconBtn()}
                              aria-label={`Bỏ link ${i + 1}`}
                              title="Bỏ link này"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        {k && (
                          <p className="flex items-center gap-1.5 pl-1 text-[12px]" style={{ color: `var(--${{ green: "gn", blue: "bl", amber: "am" }[k.tone as "green" | "blue" | "amber"]})` }}>
                            {k.tone === "amber" ? <Info size={13} /> : <Check size={13} strokeWidth={2.6} />} {k.label}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => c.setDrives((arr) => [...arr, ""])} className={btn("ghost", "sm", "-ml-2")}>
                      <Plus size={15} /> Thêm link Drive
                    </button>
                    <button type="button" onClick={c.splitSubfolders} disabled={c.splitting} className={btn("ghost", "sm")}>
                      <FolderTree size={15} /> {c.splitting ? "Đang tách…" : "Tách thư mục con từ link tổng"}
                    </button>
                  </div>
                  {c.splitMsg && <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>{c.splitMsg}</p>}
                  <div className="flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                    <FolderOpen size={16} className="mt-px flex-none" style={{ color: "var(--tx3)" }} />
                    <span>
                      Trên Drive: bấm <b>Chia sẻ</b> ở thư mục → chọn <b>“Bất kỳ ai có đường liên kết”</b> → <b>Sao chép đường liên kết</b>,
                      rồi dán vào ô trên.
                    </span>
                  </div>
                </div>
              </Step>

              <Step n={3} last title="Tuỳ chọn cho khách" desc="Không bắt buộc, sửa lại được sau trong trang album." optional>
                <div className="flex flex-col gap-4">
                  <div className={c.isDelivery ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
                    <Field label={<span className="inline-flex items-center gap-1.5"><Lock size={13} /> Mật khẩu</span>} hint="Để trống là ai có link cũng xem được.">
                      <input value={c.password} onChange={(e) => c.setPassword(e.target.value)} placeholder="Tuỳ chọn" className={inputCls} />
                    </Field>
                    {/* Album giao khách không có giới hạn chọn ảnh. */}
                    {!c.isDelivery && (
                      <Field label={<span className="inline-flex items-center gap-1.5"><Hash size={13} /> Số ảnh khách được chọn</span>} hint="Để trống là không giới hạn.">
                        <input
                          value={c.max}
                          onChange={(e) => c.setMax(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="VD: 50"
                          inputMode="numeric"
                          className={inputCls}
                        />
                      </Field>
                    )}
                  </div>
                  <div className="flex flex-col rounded-[12px] px-3.5" style={{ border: "1px solid var(--bd)" }}>
                    {c.canWatermark && (
                      <div>
                        <Switch
                          label="Đóng dấu chìm lên ảnh"
                          desc="Bật thì ảnh khách tải về đi qua máy chủ nên chậm hơn. Tắt thì tải thẳng từ Drive."
                          checked={c.wmOn}
                          onChange={c.setWmOn}
                        />
                        {c.wmOn && (
                          <div className="pb-3">
                            <input value={c.watermark} onChange={(e) => c.setWatermark(e.target.value)} placeholder="Tên studio" className={inputCls} aria-label="Chữ đóng dấu" />
                          </div>
                        )}
                      </div>
                    )}
                    {/* Ghi chú trên ảnh chỉ có nghĩa ở album CHỌN ẢNH. */}
                    {!c.isDelivery && (
                      <div style={c.canWatermark ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                        <Switch
                          label="Cho khách ghi chú trên ảnh"
                          desc={c.canNotes ? "Khách ghi yêu cầu chỉnh sửa ngay trên từng ảnh." : "Nâng cấp gói để bật."}
                          checked={c.allowNote}
                          disabled={!c.canNotes}
                          onChange={(v) => c.canNotes && c.setAllowNote(v)}
                        />
                      </div>
                    )}
                    <div style={c.canWatermark || !c.isDelivery ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                      <Switch
                        label="Cho khách tải ảnh xuống"
                        desc={c.canZip ? "Khách tải được ảnh về máy." : "Nâng cấp gói để bật."}
                        checked={c.allowDownload}
                        disabled={!c.canZip}
                        onChange={(v) => c.canZip && c.setAllowDownload(v)}
                      />
                    </div>
                  </div>
                </div>
              </Step>
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6" style={{ borderTop: "1px solid var(--bd2)" }}>
              <div className="min-w-0 flex-1 text-[12.5px]">
                {c.error ? (
                  <p style={{ color: "var(--rd)" }}>{c.error}</p>
                ) : c.notice ? (
                  <p style={{ color: "var(--ac)" }}>{c.notice}</p>
                ) : c.loggedIn === false ? (
                  <p style={{ color: "var(--tx3)" }}>Cần đăng nhập Google để tạo và quản lý album.</p>
                ) : (
                  <p style={{ color: "var(--tx3)" }}>Album được xuất bản ngay, ảnh tự đồng bộ từ Drive.</p>
                )}
              </div>
              <button type="submit" disabled={c.busy} className={btn("primary", "lg", "w-full sm:w-auto")}>
                {cta} <ArrowRight size={17} />
              </button>
            </div>
          </form>
        )}

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="v2-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <span className="v2-section-icon"><Eye size={16} /></span>
              <div className="min-w-0">
                <p className="v2-section-title">Khách sẽ nhận</p>
                <p className="v2-section-desc truncate">{c.name.trim() || "Album chưa đặt tên"}</p>
              </div>
            </div>
            <ul className="flex flex-col px-4 py-1.5 text-[13px]">
              <SumRow icon={ImageIcon} label="Ảnh từ Drive" value={links.length ? `${links.length} link` : "Chưa có link"} warn={!links.length} />
              <SumRow icon={Lock} label="Mật khẩu" value={c.password.trim() ? "Có" : "Không"} />
              {!c.isDelivery && <SumRow icon={Hash} label="Chọn tối đa" value={c.max ? `${c.max} ảnh` : "Không giới hạn"} />}
              {c.canWatermark && <SumRow icon={Droplets} label="Đóng dấu chìm" value={c.wmOn && c.watermark.trim() ? "Bật" : "Tắt"} />}
              {!c.isDelivery && <SumRow icon={MessageSquareText} label="Ghi chú trên ảnh" value={c.allowNote ? "Cho phép" : "Tắt"} />}
              <SumRow icon={Download} label="Tải ảnh xuống" value={c.allowDownload ? "Cho phép" : "Tắt"} />
            </ul>
          </div>
          <PlanUsage />
        </aside>
      </div>
    </Stack>
  );
}

function Step({
  n,
  title,
  desc,
  done = false,
  last = false,
  optional = false,
  children,
}: {
  n: number;
  title: string;
  desc?: string;
  done?: boolean;
  last?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-3.5 sm:gap-4">
      <div className="flex flex-none flex-col items-center">
        <span
          className="v2-num flex h-8 w-8 items-center justify-center rounded-full text-[13.5px] font-bold"
          style={done ? { background: "var(--ac)", color: "#fff" } : { background: "var(--acS)", color: "var(--ac)" }}
          aria-hidden
        >
          {done ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        {!last && <span className="my-1.5 w-px flex-1" style={{ background: "var(--bd)" }} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "pb-6" : "pb-7"}`}>
        <h3 className="flex flex-wrap items-center gap-2 pt-1 text-[15px] font-semibold">
          {title}
          {optional ? <span className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>Tuỳ chọn</span> : null}
        </h3>
        {desc ? <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>{desc}</p> : null}
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function SumRow({ icon: Icon, label, value, warn = false }: { icon: typeof Lock; label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <Icon size={15} className="flex-none" style={{ color: "var(--tx3)" }} />
      <span className="min-w-0 flex-1" style={{ color: "var(--tx2)" }}>{label}</span>
      <span className="font-semibold" style={{ color: warn ? "var(--am)" : "var(--tx)" }}>{value}</span>
    </li>
  );
}

function ResultCard({ c }: { c: ReturnType<typeof useCreateAlbum> }) {
  const r = c.result!;
  return (
    <div className="v2-card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-6" style={{ borderBottom: "1px solid var(--bd2)", background: "var(--gnS)" }}>
        <CheckCircle2 size={22} className="mt-0.5 flex-none" style={{ color: "var(--gn)" }} />
        <div className="min-w-0">
          <p className="text-[15.5px] font-semibold">Đã tạo album “{c.name.trim()}”</p>
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
            {r.count > 0 ? `Đã lấy ${r.count} ảnh từ Drive. ` : ""}Gửi link hoặc mã QR cho khách qua Zalo, email, hoặc in vào thiệp.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5 px-4 py-5 sm:flex-row sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Field label="Link gửi khách">
            <div className="flex gap-2">
              <input readOnly value={c.shareLink} onFocus={(e) => e.currentTarget.select()} className={inputCls} aria-label="Link gửi khách" />
              <button type="button" onClick={c.copyLink} className={btn(c.copied ? "soft" : "secondary")} aria-label="Chép link">
                {c.copied ? <Check size={16} /> : <Copy size={16} />} {c.copied ? "Đã chép" : "Chép"}
              </button>
            </div>
          </Field>
          {c.warn && <Callout tone="amber" icon={Info} title="Chưa lấy được ảnh nào từ Drive">{c.warn}</Callout>}
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/albums/${r.id}`} className={btn("primary")}>
              <Pencil size={16} /> Mở album
            </Link>
            <a href={c.shareLink || `/a/${r.slug}`} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
              <Eye size={16} /> Xem như khách
            </a>
          </div>
        </div>
        <div className="flex flex-none flex-col items-center gap-2 rounded-[14px] p-4 sm:w-[200px]" style={{ background: "var(--sf2)" }}>
          {c.qr ? (
            <img src={c.qr} alt="Mã QR mở album của khách" className="rounded-[10px] bg-white p-2" width={160} height={160} />
          ) : (
            <QrCode size={64} strokeWidth={1.3} style={{ color: "var(--tx3)" }} />
          )}
          <span className="text-center text-[12px]" style={{ color: "var(--tx3)" }}>Quét để mở trang khách</span>
          {c.qr && (
            <a href={c.qr} download={`qr-${r.slug}.png`} className={btn("ghost", "sm")}>
              <Download size={15} /> Tải mã QR
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
