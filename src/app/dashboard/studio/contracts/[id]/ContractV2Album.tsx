"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink, Gift, Images, Link2, Package, PackageCheck, Plus, Star, Trash2 } from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import EmailButton from "@/components/EmailButton";
import { Badge, Callout, Field, Section, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu } from "@/components/v2/kit-client";
import { PRODUCT_STATUS_LABEL, vnd, type ProductStatus } from "@/lib/types";
import { albumOptionLabel } from "@/lib/contract-album";
import { isWeddingReportage } from "@/lib/automations";
import { isWeddingPackage } from "@/lib/wedding-plan";
import ContractAlbumModeCardV2 from "./ContractAlbumModeCardV2";
import WeddingPlanCardV2 from "./WeddingPlanCardV2";
import WeddingInvitationCardV2 from "./WeddingInvitationCardV2";
import LoveStoryCardV2 from "./LoveStoryCardV2";
import { GiftBlock, type V2Ctx } from "./ContractV2Shared";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab SẢN PHẨM (giao diện mới): chế độ album → album khách đang thấy + hạn
   giao + ảnh in tặng → link ngoài (thu gọn) → xử lý ảnh / video / in ấn →
   quà tặng khách & xin đánh giá (thu gọn).
   ═══════════════════════════════════════════════════════════════════════════ */

const PROD_TONE: Record<ProductStatus, Tone> = { ordered: "gray", in_progress: "blue", done: "green" };
const PROD_PRESETS = ["Xử lý hình ảnh", "Xử lý video", "In ấn album", "In ấn ảnh", "Ép gỗ / khung"];

export default function ContractV2Album({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { f, finalLinks, products, prodForm, setProdForm } = ed;
  const { contract, selectionAlbums, galleries, albumPhotoCounts, studioHost, studioName, services, plannerComingSoon, giftCombo, storyComingSoon } = ed.props;

  // Album khách đang thấy: album giao riêng (nếu có) thắng, không thì album của
  // hợp đồng — cùng luật với cổng khách (@/lib/contract-album).
  const all = [...selectionAlbums, ...galleries];
  const find = (id: string) => (id ? all.find((a) => a.id === id) ?? null : null);
  const sel = find(f.selection_album_id);
  const gal = find(f.gallery_album_id);
  const shown = gal && gal.phase === "delivery" ? gal : sel ?? gal;
  const count = shown ? albumPhotoCounts[shown.id] : undefined;
  const hasLinks = !!(contract.final_album_url || contract.final_video_urls || contract.final_originals_url);
  const pkgInput = {
    shootType: f.shoot_type,
    intakeType: contract.intake?.type,
    title: f.title,
    serviceName: services.find((s) => s.id === f.service_id)?.name,
    itemNames: ed.items.map((it) => it.name),
  };
  const reviewMsg = `Cảm ơn ${f.client_name || "anh/chị"} đã tin tưởng ${studioName}! Anh/chị đánh giá giúp em tại: ${ed.shareUrl} (mục “Đánh giá studio”). Em cảm ơn ạ!`;

  return (
    <>
      <ContractAlbumModeCardV2
        contractId={contract.id}
        status={f.status}
        toast={ed.toast}
        onAlbumIds={ed.applyAlbumIds}
        onModeChange={ed.setAlbumMode}
        onDelivered={() => ed.setDeliveryDone(true)}
      />

      <Section
        title="Album của khách"
        icon={Images}
        desc="Khách chọn ảnh và nhận ảnh trên cùng một album, cùng một link."
        actions={
          shown ? (
            <Link href={`/dashboard/albums/${shown.id}`} className={btn("secondary", "sm")}>
              <ExternalLink size={15} /> Mở album
            </Link>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {shown && (
            <div className="flex items-center gap-3 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Images size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{shown.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  <Badge tone={shown.phase === "delivery" ? "green" : "blue"}>{shown.phase === "delivery" ? "Giao khách" : "Chọn ảnh"}</Badge>
                  {typeof count === "number" && <span>{count} ảnh/video</span>}
                  {!shown.published && <Badge tone="amber">Chưa xuất bản</Badge>}
                </div>
              </div>
            </div>
          )}

          {f.status === "completed" && !ed.deliveryDone && ed.albumMode !== "manual" && (
            <Callout
              tone="blue"
              icon={PackageCheck}
              title="Đang ở giai đoạn Chọn ảnh"
              action={
                <button type="button" className={btn("secondary", "sm")} onClick={ed.deliverNow} disabled={ed.deliverBusy}>
                  {ed.deliverBusy ? "Đang chuyển…" : "Giao khách ngay"}
                </button>
              }
            >
              Hợp đồng đã hoàn thành nhưng thư mục ảnh chỉnh sửa còn trống. Album tự chuyển sang Giao khách khi ảnh lên Drive — hoặc bấm giao ngay nếu đã xong.
            </Callout>
          )}

          <Field
            label="Album của hợp đồng"
            htmlFor="al-sel"
            hint={
              selectionAlbums.length === 0 ? (
                <>
                  Chưa có album nào.{" "}
                  <Link href="/dashboard/albums/new" className="font-semibold" style={{ color: "var(--ac)" }}>
                    Tạo album
                  </Link>{" "}
                  rồi quay lại gắn.
                </>
              )
                : "Khách chọn ảnh trên album này. Khi hợp đồng hoàn thành và ảnh chỉnh sửa đã lên (hoặc bấm “Giao khách ngay”), chính album này chuyển sang Giao khách — khách giữ nguyên link."
            }
          >
            <select
              id="al-sel"
              className={inputCls}
              value={f.selection_album_id}
              onChange={(e) => {
                const v = e.target.value;
                const opt = selectionAlbums.find((a) => a.id === v);
                ed.saveAlbumLink("selection_album_id", v);
                if (!f.gallery_album_id) ed.setDeliveryDone(opt?.phase === "delivery");
              }}
            >
              <option value="">— Chưa gắn —</option>
              {selectionAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  {albumOptionLabel(a)}
                </option>
              ))}
            </select>
          </Field>

          {/* Nhập link ảnh riêng = MỘT album cho cả chọn ảnh lẫn giao khách. */}
          {(ed.albumMode !== "manual" || !!f.gallery_album_id) && (
            <Field
              label="Album giao riêng (tuỳ chọn)"
              htmlFor="al-gal"
              hint="Chỉ gắn khi ảnh giao khách nằm ở một album KHÁC. Album phải ở giai đoạn Giao khách và đã xuất bản thì khách mới thấy."
            >
              <select
                id="al-gal"
                className={inputCls}
                value={f.gallery_album_id}
                onChange={(e) => {
                  const v = e.target.value;
                  const opt = galleries.find((a) => a.id === v);
                  ed.saveAlbumLink("gallery_album_id", v);
                  ed.setDeliveryDone(v ? opt?.phase === "delivery" : !!selectionAlbums.find((a) => a.id === f.selection_album_id && a.phase === "delivery"));
                }}
              >
                <option value="">— Không dùng —</option>
                {galleries.map((a) => (
                  <option key={a.id} value={a.id}>
                    {albumOptionLabel(a)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hạn giao ảnh">
              <DateInput className={inputCls} value={f.delivery_due} onChange={(v) => ed.set("delivery_due", v)} />
            </Field>
            <Field
              label={
                <span className="flex items-center gap-2">
                  Số ảnh in tặng khách
                  <span className="text-[12px] font-normal" style={{ color: ed.printSaved === "saved" ? "var(--gn)" : "var(--tx3)" }}>
                    {ed.printSaved === "saving" ? "Đang lưu…" : ed.printSaved === "saved" ? "Đã lưu" : ""}
                  </span>
                </span>
              }
              htmlFor="al-print"
              hint="Có số thì album giao khách thêm phần “Chọn ảnh in” (tối đa đúng số này). Để trống = không tặng in."
            >
              <div className="flex items-center gap-2">
                <input
                  id="al-print"
                  className={`${inputCls} !w-28`}
                  inputMode="numeric"
                  placeholder="0"
                  value={ed.printQuota}
                  onChange={(e) => ed.changePrintQuota(e.target.value)}
                />
                <span className="text-[13.5px]" style={{ color: "var(--tx2)" }}>
                  ảnh
                </span>
              </div>
            </Field>
          </div>

          {/* Link ngoài: album / video / file gốc gửi bằng nơi khác. Thu gọn mặc định. */}
          <details className="group rounded-[12px]" style={{ border: "1px solid var(--bd)" }} open={hasLinks}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3">
              <Link2 size={16} style={{ color: "var(--tx3)" }} />
              <span className="flex-1 text-[13.5px] font-semibold">Link ngoài (tuỳ chọn)</span>
              <span className="text-[12px]" style={{ color: ed.finalSaved === "saved" ? "var(--gn)" : "var(--tx3)" }}>
                {ed.finalSaved === "saving" ? "Đang lưu…" : ed.finalSaved === "saved" ? "Đã lưu" : "Google Photos, YouTube, Drive…"}
              </span>
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" style={{ color: "var(--tx3)" }} />
            </summary>
            <div className="flex flex-col gap-4 px-3.5 pb-4">
              <Field label="Link album hoàn thiện" htmlFor="al-f1">
                <input
                  id="al-f1"
                  className={inputCls}
                  inputMode="url"
                  placeholder="https://photos.app.goo.gl/… hoặc link Google Drive"
                  value={finalLinks.album}
                  onChange={(e) => ed.setFinal("album", e.target.value)}
                />
              </Field>
              <Field label="Link video hoàn thiện" htmlFor="al-f2" hint="Mỗi dòng một link. Có thể đặt tên: Phóng sự cưới | https://youtu.be/…">
                <textarea
                  id="al-f2"
                  className={inputCls}
                  placeholder={"https://youtu.be/…"}
                  value={finalLinks.videos}
                  onChange={(e) => ed.setFinal("videos", e.target.value)}
                />
              </Field>
              <Field
                label="Link toàn bộ file gốc"
                htmlFor="al-f3"
                hint="Các link này hiện trên trang riêng của khách (mục “Tải về”). Nhớ chia sẻ ở chế độ “Bất kỳ ai có đường liên kết”."
              >
                <input
                  id="al-f3"
                  className={inputCls}
                  inputMode="url"
                  placeholder="Thư mục Google Drive / Fshare chứa file gốc"
                  value={finalLinks.originals}
                  onChange={(e) => ed.setFinal("originals", e.target.value)}
                />
              </Field>
            </div>
          </details>
        </div>
      </Section>

      <Section title="Xử lý ảnh · video · in ấn" icon={Package} desc="Việc hậu kỳ và sản phẩm in — giao việc chi tiết ở mục “Xử lý hình ảnh”. Bấm trạng thái để chuyển bước." flush>
        {products.length === 0 ? (
          <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>
            Chưa có sản phẩm nào.
          </p>
        ) : (
          <ul>
            {products.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {it.name}
                    {it.qty > 1 ? <span style={{ color: "var(--tx3)" }}> × {it.qty}</span> : null}
                  </p>
                  {it.cost > 0 && (
                    <p className="v2-num text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      Chi phí {vnd(it.cost)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => ed.cycleProduct(it)} className="flex-none rounded-full" title="Bấm để chuyển sang bước tiếp theo">
                  <Badge tone={PROD_TONE[it.status]} dot>
                    {PRODUCT_STATUS_LABEL[it.status]}
                  </Badge>
                </button>
                <Menu
                  label={`Thao tác cho ${it.name}`}
                  items={[
                    {
                      label: "Xoá sản phẩm",
                      icon: Trash2,
                      danger: true,
                      onClick: () =>
                        ctx.ask({ title: "Xoá sản phẩm này?", desc: it.name, confirm: "Xoá sản phẩm", danger: true, run: () => ed.deleteProduct(it.id) }),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2.5 px-4 py-4 sm:px-5" style={{ borderTop: products.length ? undefined : "1px solid var(--bd2)" }}>
          <div className="flex flex-wrap gap-1.5">
            {PROD_PRESETS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setProdForm((p) => ({ ...p, name }))}
                className="max-w-full truncate rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                style={{ border: "1px dashed var(--bd)", color: prodForm.name === name ? "var(--ac)" : "var(--tx2)", background: prodForm.name === name ? "var(--acS)" : undefined }}
              >
                + {name}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_80px_160px_auto]">
            <input className={inputCls} placeholder="Tên sản phẩm" aria-label="Tên sản phẩm" value={prodForm.name} onChange={(e) => setProdForm((p) => ({ ...p, name: e.target.value }))} />
            <input
              type="number"
              className={`${inputCls} text-center`}
              placeholder="SL"
              aria-label="Số lượng"
              value={prodForm.qty}
              onChange={(e) => setProdForm((p) => ({ ...p, qty: Number(e.target.value) }))}
            />
            <MoneyInput className={inputCls} placeholder="Chi phí" ariaLabel="Chi phí" value={prodForm.cost} onChange={(n) => setProdForm((p) => ({ ...p, cost: n }))} />
            <button type="button" className={btn("secondary")} onClick={ed.addProduct} disabled={!prodForm.name.trim()}>
              <Plus size={16} /> Thêm
            </button>
          </div>
        </div>
      </Section>

      {/* Tiện ích tặng khách & xin đánh giá — thu gọn mặc định cho đỡ rối. */}
      <details className="v2-card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5">
          <span className="v2-section-icon">
            <Gift size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="v2-section-title">Quà tặng khách & xin đánh giá</p>
            <p className="v2-section-desc">Kế hoạch cưới · Thiệp cưới online · Love Story · Xin khách đánh giá</p>
          </div>
          <ChevronDown size={18} className="flex-none transition-transform group-open:rotate-180" style={{ color: "var(--tx3)" }} />
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", paddingTop: 16 }}>
          <WeddingPlanCardV2
            contractId={contract.id}
            clientToken={contract.client_token}
            studioHost={studioHost}
            clientMessenger={f.client_messenger}
            toggle={contract.wedding_planner}
            packageOn={isWeddingPackage(pkgInput)}
            comingSoon={plannerComingSoon}
            combo={giftCombo}
          />
          <WeddingInvitationCardV2
            contract={{ id: contract.id, owner_id: contract.owner_id, title: f.title, event_date: f.event_date || null, location: f.location || null }}
            clientName={f.client_name}
            clientMessenger={f.client_messenger}
            giftInvitation={contract.gift_invitation}
            combo={giftCombo && !plannerComingSoon}
            reportage={isWeddingReportage(pkgInput)}
          />
          <LoveStoryCardV2
            contract={{ id: contract.id, owner_id: contract.owner_id, title: f.title, event_date: f.event_date || null, location: f.location || null }}
            clientName={f.client_name}
            clientMessenger={f.client_messenger}
            studioHost={studioHost}
            comingSoon={storyComingSoon}
          />
          <GiftBlock icon={Star} tone="amber" title="Xin khách đánh giá" desc="Gửi sau khi giao ảnh — kèm link cổng khách, mục “Đánh giá studio”.">
            <div className="flex flex-wrap items-center gap-2">
              <MessengerButton link={f.client_messenger} label="Gửi cho khách" message={reviewMsg} className={btn("secondary", "sm")} />
              <ZaloSendButton
                phone={f.client_phone}
                name={f.client_name}
                audience="client"
                contractId={contract.id}
                savedName={contract.zalo_name}
                kind="review_request"
                message={reviewMsg}
                className={btn("secondary", "sm")}
                wrapClassName="w-auto"
              />
              <EmailButton to={f.client_email} label="Email" subject={`Xin đánh giá — ${studioName}`} message={reviewMsg} className={btn("secondary", "sm")} />
            </div>
          </GiftBlock>
        </div>
      </details>

    </>
  );
}
