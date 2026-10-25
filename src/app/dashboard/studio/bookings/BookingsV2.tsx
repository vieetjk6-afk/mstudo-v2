"use client";

import { useMemo, useState } from "react";
import {
  Archive, CalendarCheck, CalendarDays, Check, CheckCircle, Copy, ExternalLink, FilePlus, Gift, Inbox, Landmark,
  MessageCircle, MessageSquare, Pencil, Phone, Save, Search, Trash2, UserPlus, XCircle, FileCheck2,
} from "lucide-react";
import { DEPOSIT_STATUS_LABEL, DEPOSIT_STATUS_TONE } from "@/lib/booking-deposit";
import { messengerUrl } from "@/components/MessengerButton";
import DateInput from "@/components/DateInput";
import { vnd, type StudioBooking } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { sourceLabel } from "@/lib/lead-source";
import { noAccent } from "@/lib/studio-nav";
import {
  Avatar, Badge, Callout, Empty, Field, InfoList, PageHead, Stack, Stat, StatGrid, Toolbar, btn, iconBtn, inputCls, toneFg, type Tone,
} from "@/components/v2/kit";
import { Drawer, Menu, Modal, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { useBookings, editStateOf, type BookingsProps } from "./useBookings";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐẶT LỊCH KHÁCH — giao diện mới. Cùng dữ liệu, cùng thao tác với
   BookingsView (bản cũ, logic chung ở ./useBookings); khác ở cách sắp xếp:
     • Đầu trang: link đặt lịch + MỘT nút chính "Chép link".
     • 4 số liệu: cần xử lý · cọc chờ xác nhận · đã nhận · đã tạo hợp đồng.
     • Thanh lọc: tìm · trạng thái · sắp xếp.
     • Bảng gọn / thẻ gọn: mỗi dòng một nút "Tạo HĐ" + menu ⋯ (nhận, từ chối,
       xác nhận cọc, sửa, lưu trữ, xoá). Bấm dòng mở NGĂN KÉO đầy đủ chi tiết:
       ghi chú, cọc + biên lai, voucher, người giới thiệu, gọi/Zalo/Messenger.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "Mới", tone: "blue" },
  accepted: { label: "Đã nhận", tone: "green" },
  pending: { label: "Chờ", tone: "amber" },
  declined: { label: "Từ chối", tone: "red" },
  handled: { label: "Đã tạo HĐ", tone: "brand" },
  archived: { label: "Lưu trữ", tone: "gray" },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, tone: "gray" as Tone };
const depositTone = (s: StudioBooking["deposit_status"]): Tone => {
  const t = s ? DEPOSIT_STATUS_TONE[s] : "neutral";
  return t === "neutral" ? "gray" : t;
};
const hasDeposit = (b: StudioBooking) => !!b.deposit_status && b.deposit_status !== "none";
const zaloUrl = (phone: string) => `https://zalo.me/${phone.replace(/\D/g, "")}`;
const canAnswer = (b: StudioBooking) => b.status === "new" || b.status === "pending";
const canContract = (b: StudioBooking) => b.status === "accepted" || b.status === "new";

export default function BookingsV2(props: BookingsProps) {
  const {
    list, copied, copyLink, busy, bookingUrl, editState, setEditState, editBusy, filterStatus, setFilterStatus,
    updateStatus, confirmDeposit, deleteBooking, saveEdit, toContract, filtered, counts,
  } = useBookings(props);
  const { tokenSaved = true } = props;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"created" | "date">("created");
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? list.find((b) => b.id === peekId) ?? null : null;

  const visible = useMemo(() => {
    const needle = noAccent(q.trim());
    const out = filtered.filter((b) => !needle || noAccent(`${b.name} ${b.phone} ${b.service ?? ""} ${b.package_name ?? ""}`).includes(needle));
    if (sort === "date")
      return [...out].sort((a, b) => (a.preferred_date || "9999").localeCompare(b.preferred_date || "9999"));
    return out;
  }, [filtered, q, sort]);

  const toDo = (counts.new ?? 0) + (counts.pending ?? 0);
  const depositWaiting = list.filter((b) => b.deposit_status === "paid" && b.status !== "archived").length;

  const menuFor = (b: StudioBooking): MenuItem[] => [
    ...(canAnswer(b)
      ? ([
          { label: "Nhận lịch", icon: CheckCircle, disabled: busy === b.id, onClick: () => void updateStatus(b.id, "accepted") },
          { label: "Từ chối", icon: XCircle, disabled: busy === b.id, onClick: () => void updateStatus(b.id, "declined") },
        ] as MenuItem[])
      : []),
    ...(b.deposit_status === "paid"
      ? ([{ label: "Xác nhận đã nhận cọc", hint: "Sau khi đối chiếu sao kê", icon: Landmark, disabled: busy === b.id, onClick: () => void confirmDeposit(b.id) }] as MenuItem[])
      : []),
    ...(canAnswer(b) || b.deposit_status === "paid" ? (["divider"] as MenuItem[]) : []),
    { label: "Xem chi tiết", icon: Inbox, onClick: () => setPeekId(b.id) },
    { label: "Sửa", icon: Pencil, onClick: () => setEditState(editStateOf(b)) },
    ...(b.status !== "archived"
      ? ([{ label: "Lưu trữ", icon: Archive, onClick: () => void updateStatus(b.id, "archived") }] as MenuItem[])
      : []),
    "divider",
    { label: "Xoá", icon: Trash2, danger: true, onClick: () => void deleteBooking(b.id) },
  ];

  const contractBtn = (b: StudioBooking, size: "sm" | "md" = "sm", variant: "soft" | "primary" = "soft") =>
    canContract(b) ? (
      <button type="button" onClick={() => toContract(b)} disabled={!!busy} className={btn(variant, size)}>
        <FilePlus size={size === "sm" ? 14 : 16} /> {busy === b.id ? "Đang tạo…" : "Tạo HĐ"}
      </button>
    ) : null;

  const depositBadge = (b: StudioBooking) =>
    hasDeposit(b) ? (
      <Badge tone={depositTone(b.deposit_status)} icon={Landmark}>
        {b.deposit_amount ? `${vnd(b.deposit_amount)} · ` : ""}
        {DEPOSIT_STATUS_LABEL[b.deposit_status!]}
      </Badge>
    ) : null;

  const set = (k: keyof NonNullable<typeof editState>) => (v: string) => setEditState((s) => (s ? { ...s, [k]: v } : s));

  return (
    <Stack>
      <PageHead
        desc="Khách gửi yêu cầu qua link đặt lịch. Nhận lịch, tạo hợp đồng hoặc từ chối ngay tại đây."
        actions={
          <>
            <a href={bookingUrl} target="_blank" rel="noreferrer" className={btn("secondary")}>
              <ExternalLink size={16} /> Xem form
            </a>
            <button type="button" onClick={copyLink} className={btn("primary")}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Đã chép link" : "Chép link đặt lịch"}
            </button>
          </>
        }
      >
        <p className="mt-1.5 flex min-w-0 flex-col gap-x-1.5 text-[12.5px] sm:flex-row sm:items-center" style={{ color: "var(--tx3)" }}>
          <span className="flex-none">Link chia sẻ cho khách / gắn lên Facebook:</span>
          <span className="truncate font-medium" style={{ color: "var(--tx2)" }}>{bookingUrl}</span>
        </p>
      </PageHead>

      {!tokenSaved && (
        <Callout tone="red" title="Không lưu được mã đặt lịch.">
          Kiểm tra biến <code>SUPABASE_SERVICE_ROLE_KEY</code> trên Vercel và cột <code>booking_token</code> trong bảng <code>profiles</code>.
        </Callout>
      )}

      <StatGrid>
        <Stat icon={Inbox} tone="blue" label="Cần xử lý" value={toDo} valueTone={toDo ? "blue" : undefined} sub={toDo ? "Yêu cầu mới hoặc đang chờ" : "Đã xử lý hết"} />
        <Stat icon={Landmark} tone="amber" label="Cọc chờ xác nhận" value={depositWaiting} valueTone={depositWaiting ? "amber" : undefined} sub="Khách báo đã chuyển" />
        <Stat icon={CalendarCheck} tone="green" label="Đã nhận lịch" value={counts.accepted ?? 0} sub="Chờ tạo hợp đồng" />
        <Stat icon={FileCheck2} tone="brand" label="Đã tạo hợp đồng" value={counts.handled ?? 0} />
      </StatGrid>

      {list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={MessageCircle}
            title="Chưa có yêu cầu đặt lịch nào"
            hint="Chép link đặt lịch ở trên gửi cho khách hoặc gắn lên Facebook để khách gửi yêu cầu thẳng vào đây."
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              {/* .v2-search tự đặt min-width: 0, nên giữ bề rộng tối thiểu ở lớp bọc. */}
              <div className="min-w-[220px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, số điện thoại, dịch vụ…" className="w-full" />
              </div>
              <Segmented
                label="Lọc yêu cầu đặt lịch"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: "all", label: "Tất cả", count: list.length },
                  { value: "new", label: "Mới", count: counts.new ?? 0 },
                  { value: "accepted", label: "Đã nhận", count: counts.accepted ?? 0 },
                  { value: "handled", label: "Đã tạo HĐ", count: counts.handled ?? 0 },
                  { value: "declined", label: "Từ chối", count: counts.declined ?? 0 },
                  { value: "archived", label: "Lưu trữ", count: counts.archived ?? 0 },
                ]}
              />
              <select aria-label="Sắp xếp" className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as "created" | "date")}>
                <option value="created">Mới gửi nhất</option>
                <option value="date">Ngày chụp gần nhất</option>
              </select>
            </Toolbar>
          </div>

          {visible.length === 0 ? (
            <Empty compact icon={Search} title="Không có yêu cầu nào ở nhóm này" hint="Chuyển sang nhóm khác hoặc bỏ bớt từ khoá." />
          ) : (
            <>
              {/* Máy tính: bảng */}
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Khách</th>
                      <th>Dịch vụ</th>
                      <th style={{ width: 116 }}>Ngày chụp</th>
                      <th style={{ width: 170 }}>Cọc</th>
                      <th style={{ width: 118 }}>Trạng thái</th>
                      <th style={{ width: 160 }} aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((b) => (
                      <tr key={b.id} className="cursor-pointer" onClick={() => setPeekId(b.id)}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={b.name} size={36} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5">
                                <span className="truncate font-semibold">{b.name}</span>
                                {b.voucher_code ? <Gift size={13} className="flex-none" style={{ color: "var(--ac)" }} aria-label="Có voucher" /> : null}
                              </p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                                {b.phone} · {fmtDateTime(b.created_at)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="truncate" style={{ maxWidth: 260 }}>{b.service || <span style={{ color: "var(--tx3)" }}>—</span>}</p>
                          {b.package_name ? (
                            <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)", maxWidth: 260 }}>
                              {b.package_name}{b.package_price ? ` · ${vnd(b.package_price)}` : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="v2-num whitespace-nowrap" style={{ color: b.preferred_date ? "var(--tx)" : "var(--tx3)" }}>
                          {b.preferred_date ? fmtDate(b.preferred_date) : "—"}
                        </td>
                        <td>
                          {hasDeposit(b) ? (
                            <>
                              <p className="v2-num font-semibold">{b.deposit_amount ? vnd(b.deposit_amount) : "Cọc"}</p>
                              <p className="mt-0.5 text-[12px] font-medium" style={{ color: toneFg(depositTone(b.deposit_status)) }}>
                                {DEPOSIT_STATUS_LABEL[b.deposit_status!]}
                              </p>
                            </>
                          ) : (
                            <span style={{ color: "var(--tx3)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={statusOf(b.status).tone} dot>{statusOf(b.status).label}</Badge>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {contractBtn(b)}
                            <Menu label="Thêm thao tác" width={230} items={menuFor(b)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Điện thoại: thẻ gọn */}
              <div className="md:hidden">
                {visible.map((b) => (
                  <div key={b.id} className="flex flex-col gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setPeekId(b.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <Avatar name={b.name} size={38} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold">{b.name}</p>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--tx2)" }}>
                            {[b.service, b.preferred_date ? fmtDate(b.preferred_date) : null].filter(Boolean).join(" · ") || b.phone}
                          </p>
                          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Gửi {fmtDateTime(b.created_at)}</p>
                          {hasDeposit(b) ? <div className="mt-1.5">{depositBadge(b)}</div> : null}
                        </div>
                      </button>
                      <Badge tone={statusOf(b.status).tone} dot>{statusOf(b.status).label}</Badge>
                    </div>
                    <div className="-mt-1 flex items-center justify-end gap-1.5">
                      {contractBtn(b)}
                      <Menu label="Thêm thao tác" width={230} items={menuFor(b)} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Ngăn kéo chi tiết ─────────────────────────────────────────── */}
      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={peek?.name ?? ""}
        desc={peek ? `Gửi lúc ${fmtDateTime(peek.created_at)}` : undefined}
        footer={
          peek ? (
            <>
              {/* Menu ⋯ ở chân ngăn kéo sẽ bung xuống khuất màn — dùng nút icon. */}
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEditState(editStateOf(peek))} className={iconBtn()} aria-label="Sửa yêu cầu" title="Sửa">
                  <Pencil size={16} />
                </button>
                {peek.status !== "archived" ? (
                  <button type="button" onClick={() => updateStatus(peek.id, "archived")} className={iconBtn()} aria-label="Lưu trữ yêu cầu" title="Lưu trữ">
                    <Archive size={16} />
                  </button>
                ) : null}
                <button type="button" onClick={() => deleteBooking(peek.id)} className={iconBtn()} aria-label="Xoá yêu cầu" title="Xoá" style={{ color: "var(--rd)" }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {canAnswer(peek) ? (
                  <>
                    <button type="button" onClick={() => updateStatus(peek.id, "declined")} disabled={busy === peek.id} className={btn("ghost")}>
                      <XCircle size={16} /> Từ chối
                    </button>
                    <button type="button" onClick={() => updateStatus(peek.id, "accepted")} disabled={busy === peek.id} className={btn("secondary")}>
                      <CheckCircle size={16} /> Nhận
                    </button>
                  </>
                ) : null}
                {contractBtn(peek, "md", "primary")}
              </div>
            </>
          ) : null
        }
      >
        {peek ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar name={peek.name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{peek.phone}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={statusOf(peek.status).tone} dot>{statusOf(peek.status).label}</Badge>
                  {peek.source ? <Badge tone="gray">{sourceLabel(peek.source)}</Badge> : null}
                </div>
              </div>
            </div>

            <div className={`grid gap-2 ${peek.facebook ? "grid-cols-3" : "grid-cols-2"}`}>
              <a href={`tel:${peek.phone}`} className={btn("secondary", "md", "w-full")}>
                <Phone size={16} /> Gọi
              </a>
              <a href={zaloUrl(peek.phone)} target="_blank" rel="noopener noreferrer" className={btn("secondary", "md", "w-full")}>
                <MessageCircle size={16} /> Zalo
              </a>
              {peek.facebook ? (
                <a href={messengerUrl(peek.facebook)} target="_blank" rel="noreferrer" className={btn("secondary", "md", "w-full")}>
                  <MessageSquare size={16} /> Nhắn FB
                </a>
              ) : null}
            </div>

            <InfoList
              items={[
                { label: "Dịch vụ", value: peek.service || "—" },
                ...(peek.package_name
                  ? [{ label: "Gói", value: `${peek.package_name}${peek.package_price ? ` · ${vnd(peek.package_price)}` : ""}` }]
                  : []),
                { label: "Ngày mong muốn", value: peek.preferred_date ? fmtDate(peek.preferred_date) : "Chưa chọn" },
                ...(peek.facebook
                  ? [{ label: "Facebook", value: <a href={messengerUrl(peek.facebook)} target="_blank" rel="noreferrer" className="break-all hover:underline" style={{ color: "var(--ac)" }}>{peek.facebook}</a> }]
                  : []),
                ...(peek.referrer_phone ? [{ label: "Người giới thiệu", value: peek.referrer_phone }] : []),
              ]}
            />

            {peek.note ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Khách ghi chú</p>
                <p className="whitespace-pre-wrap rounded-[10px] px-3 py-2.5 text-[13.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>{peek.note}</p>
              </div>
            ) : null}

            {/* Cọc giữ ngày. "Khách báo đã chuyển" KHÁC "đã nhận" — ảnh chụp
                chuyển khoản làm giả được, studio phải tự đối chiếu sao kê. */}
            {hasDeposit(peek) ? (
              <div className="v2-card v2-card-pad flex flex-col gap-2.5" style={{ boxShadow: "none" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Landmark size={16} style={{ color: "var(--tx3)" }} />
                  <p className="flex-1 text-[14px] font-semibold">
                    Cọc {peek.deposit_amount ? vnd(peek.deposit_amount) : ""}
                  </p>
                  <Badge tone={depositTone(peek.deposit_status)} dot>{DEPOSIT_STATUS_LABEL[peek.deposit_status!]}</Badge>
                </div>
                {peek.deposit_code ? (
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Nội dung chuyển khoản: <b style={{ color: "var(--tx2)" }}>{peek.deposit_code}</b></p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {peek.deposit_proof_url ? (
                    <a href={peek.deposit_proof_url} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
                      <ExternalLink size={14} /> Xem biên lai
                    </a>
                  ) : null}
                  {peek.deposit_status === "paid" ? (
                    <button type="button" onClick={() => confirmDeposit(peek.id)} disabled={busy === peek.id} className={btn("soft", "sm")}>
                      <Check size={14} /> Đã đối chiếu — xác nhận
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {peek.voucher_code ? (
              <Callout tone="brand" icon={Gift}>
                Dùng voucher <b className="font-mono">{peek.voucher_code}</b> — tự áp khi tạo hợp đồng.
              </Callout>
            ) : null}
            {peek.referrer_phone ? (
              <Callout tone="blue" icon={UserPlus}>
                Được giới thiệu bởi <b>{peek.referrer_phone}</b>.
              </Callout>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {/* ── Sửa yêu cầu ───────────────────────────────────────────────── */}
      <Modal
        open={!!editState}
        onClose={() => setEditState(null)}
        title="Sửa yêu cầu đặt lịch"
        icon={CalendarDays}
        footer={
          <>
            <button type="button" onClick={() => setEditState(null)} className={btn("ghost")}>Huỷ</button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={editBusy || !editState?.name.trim() || !editState?.phone.trim()}
              className={btn("primary")}
            >
              <Save size={16} /> {editBusy ? "Đang lưu…" : "Lưu"}
            </button>
          </>
        }
      >
        {editState ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Họ tên *">
              <input className={inputCls} value={editState.name} onChange={(e) => set("name")(e.target.value)} />
            </Field>
            <Field label="Điện thoại *">
              <input className={inputCls} inputMode="tel" value={editState.phone} onChange={(e) => set("phone")(e.target.value)} />
            </Field>
            <Field label="Dịch vụ">
              <input className={inputCls} value={editState.service} onChange={(e) => set("service")(e.target.value)} />
            </Field>
            <Field label="Ngày mong muốn">
              <DateInput className={inputCls} value={editState.preferred_date} onChange={set("preferred_date")} />
            </Field>
            <Field label="Facebook / Messenger" className="sm:col-span-2">
              <input className={inputCls} value={editState.facebook} onChange={(e) => set("facebook")(e.target.value)} />
            </Field>
            <Field label="Ghi chú" className="sm:col-span-2">
              <textarea className={`${inputCls} resize-none`} style={{ height: "auto", padding: "8px 12px" }} rows={3} value={editState.note} onChange={(e) => set("note")(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </Stack>
  );
}
