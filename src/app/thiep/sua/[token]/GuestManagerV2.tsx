"use client";

import { useMemo, useState } from "react";
import {
  Check, CheckCircle2, Clock, Copy, Download, ExternalLink, FileSpreadsheet, ListPlus, Loader2, MessageCircleHeart, Plus,
  QrCode, RefreshCw, Trash2, UserX, Users,
} from "lucide-react";
import { Badge, Empty, Field, GroupLabel, Stat, StatGrid, Toolbar, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { noAccent } from "@/lib/studio-nav";
import type { WeddingRsvp } from "@/lib/types";
import { useGuestManager, type GuestFilter, type GuestManagerProps } from "./useGuestManager";

/* ═══════════════════════════════════════════════════════════════════════════
   KHÁCH MỜI của thiệp — giao diện mới. Cùng logic với GuestManager (bản cũ,
   logic chung ở ./useGuestManager); khác ở cách sắp xếp:
     • Bốn số liệu phản hồi (mời · sẽ dự · không dự · chưa trả lời).
     • Ô thêm nhanh một tên; dán cả danh sách / nhập file nằm trong ngăn kéo.
     • Thanh lọc: tìm tên + nhóm trạng thái; thao tác hàng loạt trong menu ⋯.
     • Mỗi khách một dòng (mã QR · tên · trạng thái · lời chúc), nút chép link;
       bấm dòng mở ngăn kéo: mã QR lớn, link riêng, tải QR, mở thử, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export function RsvpBadgeV2({ rsvp }: { rsvp: WeddingRsvp | null }) {
  if (!rsvp) return <Badge tone="gray">Chưa phản hồi</Badge>;
  return rsvp.attending
    ? <Badge tone="green" icon={Check}>Tham dự · {rsvp.num_guests} người</Badge>
    : <Badge tone="red">Không dự</Badge>;
}

export default function GuestManagerV2(props: GuestManagerProps) {
  const { guests } = props;
  const g = useGuestManager(props);
  const { summary, rows, filter, setFilter, qrMap, copied, linkFor } = g;
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{ name: string; index: number } | null>(null);

  const list = useMemo(() => {
    const needle = noAccent(q.trim());
    return g.shown.filter((r) => !needle || noAccent(r.name).includes(needle));
  }, [g.shown, q]);

  const cur = detail ? rows.find((r) => r.index === detail.index && r.name === detail.name) ?? null : null;

  const bulkMenu = (
    <Menu
      label="Thêm thao tác với danh sách khách"
      width={260}
      items={[
        { label: "Dán cả danh sách tên", icon: ListPlus, onClick: () => g.setShowBulk(true) },
        { label: g.importing ? "Đang đọc file…" : "Nhập từ file Excel / CSV", hint: "Cột đầu (cột A) là tên khách", icon: FileSpreadsheet, onClick: () => g.fileRef.current?.click(), disabled: g.importing },
        "divider",
        { label: copied === "__all__" ? "Đã chép tất cả link" : "Chép tất cả link riêng", icon: copied === "__all__" ? Check : Copy, onClick: () => void g.copyAll(), disabled: !guests.length },
        { label: g.zipping ? "Đang nén mã QR…" : "Tải tất cả mã QR (.zip)", icon: Download, onClick: () => void g.downloadAll(), disabled: !guests.length || g.zipping },
        ...(summary ? (["divider", { label: "Tải phản hồi mới nhất", icon: RefreshCw, onClick: () => void g.refresh(), disabled: g.refreshing }] as const) : []),
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {summary && guests.length > 0 ? (
        <StatGrid cols={4}>
          <Stat icon={Users} tone="brand" label="Khách mời" value={guests.length} sub="Mỗi người một link + mã QR" />
          <Stat icon={CheckCircle2} tone="green" label="Sẽ tham dự" value={summary.attending} valueTone={summary.attending ? "green" : undefined} sub={`${summary.people} người sẽ đến`} />
          <Stat icon={UserX} tone="red" label="Không dự" value={summary.declined} sub="Đã báo bận" />
          <Stat icon={Clock} tone="amber" label="Chưa phản hồi" value={summary.pending} valueTone={summary.pending ? "amber" : undefined} sub="Nhắc lại qua Zalo" />
        </StatGrid>
      ) : null}

      <section className="v2-card overflow-hidden">
        <header className="v2-section-head">
          <span className="v2-section-icon"><Users size={17} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="v2-section-title">Danh sách khách mời</h3>
            <p className="v2-section-desc">Mỗi khách một link riêng + mã QR: thiệp mở ra ghi đúng tên người nhận.</p>
          </div>
          {bulkMenu}
        </header>

        <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
          {/* Thêm nhanh một tên — việc làm nhiều nhất. */}
          <div className="flex gap-2">
            <input
              value={g.one}
              onChange={(e) => g.setOne(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); g.addOne(); } }}
              placeholder="Tên khách mời (vd: Anh Nam & chị Lan)"
              aria-label="Tên khách mời"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <button type="button" onClick={g.addOne} disabled={!g.one.trim()} className={btn("secondary")}>
              <Plus size={16} /> Thêm
            </button>
          </div>
          <input ref={g.fileRef} type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void g.importFile(f); }} />

          {guests.length > 0 ? (
            <Toolbar>
              <div className="min-w-[180px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm khách…" className="w-full" />
              </div>
              {summary ? (
                <Segmented<GuestFilter>
                  size="sm"
                  label="Lọc theo phản hồi"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "Tất cả", count: guests.length },
                    { value: "yes", label: "Sẽ dự", count: summary.attending },
                    { value: "no", label: "Không dự", count: summary.declined },
                    { value: "pending", label: "Chưa trả lời", count: summary.pending },
                  ]}
                />
              ) : null}
            </Toolbar>
          ) : null}
        </div>

        {guests.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <Empty
              compact
              icon={QrCode}
              title="Chưa có khách mời nào"
              hint="Nhập tên ở ô trên, dán cả danh sách hoặc nhập từ file Excel — mỗi khách có ngay link riêng và mã QR."
              action={
                <>
                  <button type="button" onClick={() => g.setShowBulk(true)} className={btn("secondary", "sm")}><ListPlus size={15} /> Dán danh sách</button>
                  <button type="button" onClick={() => g.fileRef.current?.click()} disabled={g.importing} className={btn("ghost", "sm")}>
                    {g.importing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Nhập từ file
                  </button>
                </>
              }
            />
          </div>
        ) : list.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <Empty compact icon={Users} title="Không có khách nào ở mục này" hint="Thử tìm tên khác hoặc chọn lại nhóm." />
          </div>
        ) : (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            {list.map(({ name, index, rsvp }) => (
              <div key={`${name}-${index}`} className="v2-row" style={{ padding: "10px 12px 10px 16px" }}>
                <button type="button" onClick={() => setDetail({ name, index })} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Xem link và mã QR của ${name}`}>
                  {qrMap[name] ? (
                    <img src={qrMap[name]} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-[8px]" style={{ border: "1px solid var(--bd)", background: "#fff" }} />
                  ) : (
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[8px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}><QrCode size={18} /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="v2-row-title block">{name}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                      {summary ? <span className="flex-none"><RsvpBadgeV2 rsvp={rsvp} /></span> : null}
                      {rsvp?.wish ? <span className="truncate text-[12px] italic" style={{ color: "var(--tx3)" }} title={rsvp.wish}>“{rsvp.wish}”</span> : null}
                      {!summary && !rsvp?.wish ? <span className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>Bấm để xem link + mã QR</span> : null}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void g.copy(linkFor(name), name)}
                  className={iconBtn()}
                  aria-label={`Chép link riêng của ${name}`}
                  title="Chép link riêng"
                  style={copied === name ? { color: "var(--gn)" } : undefined}
                >
                  {copied === name ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <Menu
                  label={`Thêm thao tác với ${name}`}
                  width={220}
                  items={[
                    { label: "Tải mã QR", icon: Download, onClick: () => void g.downloadOne(name), disabled: !qrMap[name] },
                    { label: "Mở thử thiệp của khách", icon: ExternalLink, href: linkFor(name), external: true },
                    "divider",
                    { label: "Xoá khỏi danh sách", icon: Trash2, danger: true, onClick: () => g.remove(index) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mở link chung (không có ?guest) hoặc tự sửa tên → không khớp ai trong danh sách. */}
      {summary && summary.others.length > 0 && (
        <section className="v2-card overflow-hidden">
          <header className="v2-section-head">
            <span className="v2-section-icon"><MessageCircleHeart size={17} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="v2-section-title">Phản hồi từ khách ngoài danh sách</h3>
              <p className="v2-section-desc">Khách mở link chung, hoặc ghi tên khác với tên trong danh sách.</p>
            </div>
            {guests.length === 0 ? (
              <button type="button" onClick={() => void g.refresh()} disabled={g.refreshing} className={iconBtn()} aria-label="Tải phản hồi mới nhất" title="Tải phản hồi mới nhất">
                <RefreshCw size={16} className={g.refreshing ? "animate-spin" : ""} />
              </button>
            ) : null}
          </header>
          <div className="max-h-[320px] overflow-y-auto">
            {summary.others.map((r) => (
              <div key={r.id} className="v2-row" style={{ alignItems: "flex-start" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{r.guest_name}</span>
                    <RsvpBadgeV2 rsvp={r} />
                  </div>
                  {r.wish && <p className="mt-0.5 line-clamp-2 text-[12.5px] italic" style={{ color: "var(--tx2)" }} title={r.wish}>“{r.wish}”</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dán cả danh sách */}
      <Drawer
        open={g.showBulk}
        onClose={() => g.setShowBulk(false)}
        title="Thêm nhiều khách"
        desc="Dán danh sách — mỗi dòng (hoặc dấu phẩy) một tên. Tên trùng sẽ tự bỏ qua."
        footer={
          <>
            <button type="button" onClick={() => g.setShowBulk(false)} className={btn("secondary")}>Đóng</button>
            <button type="button" onClick={g.addBulk} disabled={!g.bulk.trim()} className={btn("primary")}>
              <ListPlus size={16} /> Thêm tất cả
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Danh sách tên">
            <textarea
              value={g.bulk}
              onChange={(e) => g.setBulk(e.target.value)}
              rows={9}
              className={inputCls}
              placeholder={"Anh Nam & chị Lan\nGia đình cô Ba\nBạn Minh"}
            />
          </Field>
          <div className="flex flex-col items-start gap-2 rounded-[12px] p-3.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            <p className="text-[13px] font-semibold">Có sẵn file Excel?</p>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Hỗ trợ .xlsx, .csv, .txt — cột đầu (cột A) chứa tên khách.</p>
            <button type="button" onClick={() => g.fileRef.current?.click()} disabled={g.importing} className={btn("secondary", "sm")}>
              {g.importing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Nhập từ file
            </button>
          </div>
        </div>
      </Drawer>

      {/* Một khách: mã QR lớn + link riêng */}
      <Drawer
        open={!!cur}
        onClose={() => setDetail(null)}
        title={cur?.name ?? ""}
        desc="Link riêng và mã QR — thiệp mở ra ghi đúng tên người này."
        footer={
          cur ? (
            <>
              <button type="button" onClick={() => { g.remove(cur.index); setDetail(null); }} className={btn("danger", "md", "mr-auto")}>
                <Trash2 size={16} /> Xoá khỏi danh sách
              </button>
              <button type="button" onClick={() => setDetail(null)} className={btn("secondary")}>Đóng</button>
            </>
          ) : null
        }
      >
        {cur ? (
          <div className="flex flex-col gap-4">
            {summary ? (
              <div className="flex flex-wrap items-center gap-2">
                <RsvpBadgeV2 rsvp={cur.rsvp} />
              </div>
            ) : null}
            {cur.rsvp?.wish ? (
              <blockquote className="rounded-[12px] px-3.5 py-3 text-[13.5px] italic" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                “{cur.rsvp.wish}”
              </blockquote>
            ) : null}
            <div className="flex justify-center">
              {qrMap[cur.name] ? (
                <img src={qrMap[cur.name]} alt={`Mã QR thiệp của ${cur.name}`} className="h-[200px] w-[200px] rounded-[14px] p-2" style={{ background: "#fff", border: "1px solid var(--bd)" }} />
              ) : (
                <span className="flex h-[200px] w-[200px] items-center justify-center rounded-[14px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}><Loader2 className="animate-spin" /></span>
              )}
            </div>
            <Field label="Link riêng">
              <div className="flex gap-2">
                <input readOnly value={linkFor(cur.name)} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1`} aria-label="Link riêng" />
                <button type="button" onClick={() => void g.copy(linkFor(cur.name), cur.name)} className={btn("secondary")}>
                  {copied === cur.name ? <Check size={16} /> : <Copy size={16} />} {copied === cur.name ? "Đã chép" : "Chép"}
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void g.downloadOne(cur.name)} disabled={!qrMap[cur.name]} className={btn("secondary")}>
                <Download size={16} /> Tải mã QR
              </button>
              <a href={linkFor(cur.name)} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
                <ExternalLink size={16} /> Mở thử
              </a>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

/** Danh sách mọi phản hồi + lời chúc (giống tab "Phản hồi" của bản cũ). */
export function RsvpListV2({ rsvps }: { rsvps: WeddingRsvp[] }) {
  if (rsvps.length === 0) {
    return <Empty compact icon={MessageCircleHeart} title="Chưa có phản hồi nào" hint="Khách bấm “Xác nhận tham dự” trên thiệp là phản hồi hiện ở đây." />;
  }
  return (
    <div className="max-h-[420px] overflow-y-auto">
      <div className="px-5 pt-3"><GroupLabel count={`${rsvps.length} phản hồi`}>Mới nhất trước</GroupLabel></div>
      {rsvps.map((r) => (
        <div key={r.id} className="v2-row" style={{ alignItems: "flex-start" }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{r.guest_name}</span>
              <RsvpBadgeV2 rsvp={r} />
            </div>
            {r.wish && <p className="mt-0.5 text-[13px] italic" style={{ color: "var(--tx2)" }}>“{r.wish}”</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
