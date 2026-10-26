"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, FolderOpen, FolderSync, ImagePlus, Images, Loader2, PackageCheck, Plus, RefreshCw } from "lucide-react";
import AlbumModePicker from "@/components/AlbumModePicker";
import { Badge, Callout, Field, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";
import { ALBUM_MODE_LABEL, needsDesktopWarning, readinessHints, type AlbumMode } from "@/lib/album-mode";
import { ALBUM_MODE_MANUAL_CONFIRM, useContractAlbumMode, type AlbumSource, type ContractAlbumModeProps } from "./ContractAlbumModeCard";

/* ═══════════════════════════════════════════════════════════════════════════
   "ALBUM ẢNH CỦA HỢP ĐỒNG" — giao diện mới (tab Sản phẩm). Cùng logic với thẻ
   bản cũ (useContractAlbumMode): chọn chế độ album; chế độ nhập link riêng thì
   một album duy nhất — dán link ảnh chọn, link ảnh hoàn thiện, rồi giao khách.
   Bỏ album mặc định đang chạy thì hỏi lại bằng hộp thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractAlbumModeCardV2(props: ContractAlbumModeProps) {
  const { contractId, onDelivered } = props;
  const h = useContractAlbumMode(props);
  const { snap, setSnap, loadErr, busy, post } = h;
  const [askMode, setAskMode] = useState<AlbumMode | null>(null);

  function setMode(m: AlbumMode) {
    if (!snap || m === snap.mode) return;
    if (h.modeNeedsConfirm(m)) setAskMode(m);
    else void h.applyMode(m);
  }

  const shell = (children: React.ReactNode, desc?: React.ReactNode) => (
    <Section title="Album ảnh của hợp đồng" icon={FolderSync} desc={desc ?? "Cách ảnh của buổi chụp lên album cho khách chọn và nhận."}>
      {children}
    </Section>
  );

  if (loadErr)
    return shell(
      <Callout tone="red" icon={AlertTriangle} title="Không tải được album của hợp đồng">
        {loadErr}
      </Callout>,
    );
  if (!snap)
    return shell(
      <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--tx3)" }}>
        <Loader2 size={15} className="animate-spin" /> Đang tải album của hợp đồng…
      </p>,
    );
  if (!snap.migrated)
    return shell(
      <Callout tone="amber" icon={AlertTriangle} title="Cần cập nhật cơ sở dữ liệu">
        Muốn chọn “Album mặc định” hay “Nhập link ảnh riêng” cho từng hợp đồng: chạy <code>supabase/migrations/che_do_album_hop_dong.sql</code> (hoặc{" "}
        <code>cap-nhat.sql</code>) trên Supabase.
      </Callout>,
    );

  const al = snap.album;
  const completed = snap.status === "completed";
  const selSources = al?.sources.filter((s) => s.stage === "selection") ?? [];
  const delSources = al?.sources.filter((s) => s.stage === "delivery") ?? [];

  return (
    <>
      {shell(
        <div className="flex flex-col gap-4">
          {/* Album mặc định mà điều kiện đã mất (gỡ máy desktop, ngắt Drive…). */}
          {needsDesktopWarning(snap.mode, snap.readiness) && (
            <Callout
              tone="amber"
              icon={AlertTriangle}
              title="Album mặc định đang không đồng bộ được"
              action={
                <button type="button" className={btn("secondary", "sm")} disabled={!!busy} onClick={() => setMode("manual")}>
                  Chuyển sang nhập link riêng
                </button>
              }
            >
              {readinessHints(snap.readiness).map((x) => (
                <p key={x.key}>• {x.text}</p>
              ))}
            </Callout>
          )}

          <AlbumModePicker
            name={`album-mode-${contractId}`}
            value={snap.mode}
            status={snap.readiness}
            onStatus={(r) => setSnap((p) => (p ? { ...p, readiness: { ...p.readiness, ...r, ready: !!r.ready } } : p))}
            disabled={!!busy}
            onChange={setMode}
          />

          {snap.mode === "manual" &&
            (!al ? (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--sf)", color: "var(--tx3)" }}>
                  <Images size={18} />
                </span>
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="text-[14px] font-semibold">Chưa có album</p>
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Album tự tạo khi khách xác nhận hợp đồng (ký, chuyển cọc hoặc bạn chuyển sang “Khách đã duyệt”). Cần sớm hơn thì tạo ngay.
                  </p>
                </div>
                <button type="button" className={btn("secondary", "sm")} disabled={!!busy} onClick={() => post("create_album", {}, "Đã tạo album cho hợp đồng")}>
                  <Plus size={15} /> {busy === "create_album" ? "Đang tạo…" : "Tạo album"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    <Images size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{al.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      <Badge tone={al.phase === "delivery" ? "green" : "blue"}>{al.phase === "delivery" ? "Giao khách" : "Chọn ảnh"}</Badge>
                      <span>{al.photoCount} ảnh/video</span>
                    </div>
                  </div>
                  <Link href={`/dashboard/albums/${al.id}`} className={btn("secondary", "sm")}>
                    <ExternalLink size={15} /> <span className="hidden sm:inline">Mở album</span>
                  </Link>
                </div>

                {/* Link ảnh chọn (stage 'selection'). */}
                <LinkStage
                  id="am-sel"
                  label="Link Drive ảnh để khách chọn"
                  placeholder="https://drive.google.com/drive/folders/…"
                  hint="Thư mục cần chia sẻ “Bất kỳ ai có đường liên kết”. Thư mục con tự tách thành từng mục trong album."
                  sources={selSources}
                  value={h.selUrl}
                  onChange={h.setSelUrl}
                  busy={busy === "add_link:selection"}
                  disabled={!!busy}
                  icon={<ImagePlus size={15} />}
                  onAdd={async () => {
                    if (await post("add_link", { stage: "selection", url: h.selUrl.trim() }, "Đã thêm link ảnh chọn")) h.setSelUrl("");
                  }}
                />

                {/* Hoàn thành mà chưa giao: nhắc dán link hoàn thiện, KHÔNG tạo album mới. */}
                {completed && al.phase !== "delivery" && (
                  <Callout tone="amber" icon={AlertTriangle} title="Dán link ảnh hoàn thiện để giao khách">
                    Hợp đồng đã hoàn thành — album vẫn ở giai đoạn Chọn ảnh tới khi có ảnh hoàn thiện, rồi chuyển sang Giao khách trên cùng link khách đang
                    giữ.
                  </Callout>
                )}

                {/* Link ảnh hoàn thiện (stage 'delivery') + chuyển giai đoạn. */}
                <LinkStage
                  id="am-del"
                  label="Link ảnh hoàn thiện (giao khách)"
                  placeholder="Link thư mục Google Drive ảnh đã chỉnh sửa…"
                  hint={
                    completed
                      ? "Hợp đồng đã hoàn thành: dán link xong là album tự chuyển sang Giao khách và báo khách."
                      : "Dán sẵn được; album chỉ chuyển sang Giao khách khi hợp đồng hoàn thành hoặc khi bạn bấm chuyển."
                  }
                  sources={delSources}
                  value={h.delUrl}
                  onChange={h.setDelUrl}
                  busy={busy === "add_link:delivery"}
                  disabled={!!busy}
                  icon={<RefreshCw size={15} className={busy === "add_link:delivery" ? "animate-spin" : ""} />}
                  onAdd={async () => {
                    if (await post("add_link", { stage: "delivery", url: h.delUrl.trim() }, "Đã thêm link ảnh hoàn thiện")) h.setDelUrl("");
                  }}
                />
                {al.phase !== "delivery" && delSources.length > 0 && (
                  <div>
                    <button
                      type="button"
                      className={btn("soft")}
                      disabled={!!busy}
                      onClick={async () => {
                        if (await post("deliver", {}, "Đã chuyển sang giai đoạn Giao khách")) onDelivered?.();
                      }}
                    >
                      <PackageCheck size={16} />{" "}
                      {busy === "deliver" ? "Đang chuyển…" : `Chuyển sang giao khách${al.deliveryPhotos ? ` (${al.deliveryPhotos} ảnh)` : ""}`}
                    </button>
                  </div>
                )}
              </>
            ))}
        </div>,
        snap.mode ? (
          <>
            Đang dùng: <b style={{ color: "var(--tx2)" }}>{ALBUM_MODE_LABEL[snap.mode]}</b>
          </>
        ) : (
          "Hợp đồng cũ — đang theo cách tự động trước đây. Chọn một chế độ để cố định."
        ),
      )}

      <Modal
        open={!!askMode}
        onClose={() => setAskMode(null)}
        icon={FolderSync}
        title="Chuyển sang nhập link ảnh riêng?"
        desc={ALBUM_MODE_MANUAL_CONFIRM.replace(/^[^?]*\?\s*/, "")}
        width={460}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setAskMode(null)}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("primary")}
              onClick={() => {
                const m = askMode;
                setAskMode(null);
                if (m) void h.applyMode(m);
              }}
            >
              Chuyển sang link riêng
            </button>
          </>
        }
      />
    </>
  );
}

/* ── Một ô dán link (ảnh chọn / ảnh hoàn thiện) + các thư mục đã thêm ── */
function LinkStage({
  id,
  label,
  placeholder,
  hint,
  sources,
  value,
  onChange,
  onAdd,
  busy,
  disabled,
  icon,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
  sources: AlbumSource[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  busy: boolean;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {sources.length > 0 && (
        <ul className="mb-1 flex flex-col overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--bd2)" }}>
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px] last:!border-b-0" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <FolderOpen size={15} className="flex-none" style={{ color: "var(--tx3)" }} />
              <span className="min-w-0 flex-1 truncate" style={{ color: "var(--tx2)" }}>
                {s.name}
              </span>
              <a href={s.url} target="_blank" rel="noreferrer" className={iconBtn("!h-8 !w-8")} aria-label={`Mở thư mục ${s.name}`} title="Mở thư mục">
                <ExternalLink size={15} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={id} className={`${inputCls} min-w-0 sm:flex-1`} inputMode="url" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={btn("secondary", "md", "whitespace-nowrap")} disabled={disabled || !value.trim()} onClick={onAdd}>
          {icon} {busy ? "Đang đồng bộ…" : "Thêm & đồng bộ"}
        </button>
      </div>
    </Field>
  );
}
