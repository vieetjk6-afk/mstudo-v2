"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ClipboardPaste, Copy, Download, Gift, Heart, LayoutGrid, Link2, List, Loader2, Mail, MailCheck, Plus, QrCode, Send,
  TriangleAlert, Upload, UserPlus, Users,
} from "lucide-react";
import { Badge, Callout, Card, Empty, Field, PageHead, Section, Stack, StatGrid, Stat, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { parseGuestFile } from "@/lib/guest-import";
import { downloadGuestQr, downloadGuestQrZip } from "@/lib/guest-qr";
import { fmtDayMonth } from "@/lib/date";
import { vnd } from "@/lib/types";
import {
  GUEST_GROUP_LABEL, RSVP_LABEL, guestCount, guestRsvp, guestSummary, inviteGuestLink, tableSummary, tablesNeeded,
  type GuestGroup, type PlanGuest, type Rsvp,
} from "@/lib/wedding-plan";
import { CommitInput, MoneyField, listOps, type Ctx } from "../ui";
import { BadgeBtn, FormDrawer, RowMenu, SelectV2 } from "../uiV2";

type View = "list" | "tables";
type GroupFilter = "all" | GuestGroup;
const RSVP_TONE: Record<Rsvp, Tone> = { pending: "gray", yes: "green", no: "red" };
const NEXT_RSVP: Record<Rsvp, Rsvp> = { pending: "yes", yes: "no", no: "pending" };
const PAGE = 100;

const key = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
/** Link thiệp dán sang Zalo phải là link đầy đủ — "/thiep/…" người nhận bấm không ra đâu. */
const absUrl = (u: string) => (u.startsWith("http") || typeof window === "undefined" ? u : window.location.origin + u);
const QR_ACCENT = "#b08968";

/**
 * KHÁCH MỜI (giao diện mới) — bốn con số, gửi thiệp (chế độ Quà cưới), rồi
 * Danh sách / Sơ đồ bàn. Một nút chính "Thêm khách"; "Thêm nhiều" (dán danh
 * sách, nhập Excel, chép từ thiệp) mở ngăn kéo; sửa một khách mở ngăn kéo;
 * link thiệp riêng từng khách nằm trong menu ⋯ của dòng. Cùng dữ liệu và thao
 * tác với tabs/Guests.tsx.
 */
export default function GuestsTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const [view, setView] = useState<View>(ctx.guestView ?? "list");
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const s = guestSummary(plan.guests, replies);
  const tables = tableSummary(plan.guests, replies, plan.settings.table_size);
  const over = tables.filter((t) => t.over).length;

  // Tên trong thiệp chưa có ở đây — để nút "Nhập từ thiệp" biết còn bao nhiêu.
  const have = new Set(plan.guests.map((g) => key(g.name)));
  const fromInvite = (data.invite?.names ?? []).filter((n) => !have.has(key(n)));

  return (
    <Stack>
      <PageHead
        desc="Mỗi dòng là một lời mời — một người hoặc cả gia đình. Phản hồi qua thiệp online tự cập nhật vào danh sách."
        actions={!readOnly && (
          <>
            <button type="button" onClick={() => setBulk(true)} className={btn("secondary", "md", "flex-1 sm:flex-none")}>
              <ClipboardPaste size={16} /> Thêm nhiều
            </button>
            <button type="button" onClick={() => setAdding(true)} className={btn("primary", "md", "flex-1 sm:flex-none")}>
              <Plus size={16} /> Thêm khách
            </button>
          </>
        )}
      />

      <StatGrid cols={4}>
        <Stat label="Sẽ đến" value={`${s.people}`} sub={`${s.entries} lời mời`} icon={Users} />
        <Stat label="Đã xác nhận" value={`${s.yes}`} valueTone="green" sub={`${s.pending} chưa phản hồi · ${s.no} không dự`} icon={Check} tone="green" />
        <Stat
          label="Bàn cần đặt"
          value={`~${tablesNeeded(s.people, plan.settings.table_size)}`}
          sub={over ? `${over} bàn vượt sức chứa` : s.unseated ? `${s.unseated} người chưa xếp bàn` : `${plan.settings.table_size} người / bàn`}
          icon={LayoutGrid}
          tone={over ? "red" : "blue"}
        />
        <Stat label="Tiền mừng" value={vnd(s.gifts)} sub={`${s.thanked}/${s.entries} đã gửi lời cảm ơn`} icon={Gift} tone="amber" />
      </StatGrid>

      {plan.guests.length === 0 && !readOnly && (
        <Card>
          <label className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <span className="font-medium">Chưa có danh sách — dự kiến khoảng</span>
            <input
              type="number"
              min={0}
              max={5000}
              className={`${inputCls} !w-[96px] text-center`}
              defaultValue={plan.settings.guests_expected || ""}
              onBlur={(e) => onOp({ op: "set_settings", guests_expected: Number(e.target.value) || 0 })}
              aria-label="Số khách dự kiến"
            />
            <span style={{ color: "var(--tx2)" }}>khách (để tính bàn và chi phí mỗi khách).</span>
          </label>
        </Card>
      )}

      {data.invite && ctx.unmatched.length > 0 && !readOnly && (
        <Callout tone="blue" icon={Heart} title={`${ctx.unmatched.length} người đã phản hồi qua thiệp nhưng chưa có trong danh sách`}>
          <p>{ctx.unmatched.slice(0, 4).map((r) => r.guest_name).join(", ")}{ctx.unmatched.length > 4 ? "…" : ""}</p>
          <button
            type="button"
            onClick={() => onOp({
              op: "add_many",
              list: "guests",
              items: ctx.unmatched.map((r) => ({ name: r.guest_name, count: Math.max(1, r.num_guests || 1), rsvp: r.attending ? "yes" : "no", invited: true })),
            })}
            className={btn("secondary", "sm", "mt-2")}
          >
            <UserPlus size={15} /> Thêm vào danh sách
          </button>
        </Callout>
      )}

      {data.combo && data.invite && <InviteLinks ctx={ctx} />}

      <div className="flex">
        <Segmented<View>
          value={view}
          onChange={setView}
          label="Cách xem"
          options={[
            { value: "list", label: <><List size={15} /> Danh sách</>, count: plan.guests.length },
            { value: "tables", label: <><LayoutGrid size={15} /> Sơ đồ bàn</>, count: tables.length },
          ]}
        />
      </div>

      {view === "list" ? <GuestList ctx={ctx} /> : <TableView ctx={ctx} />}

      {adding && <QuickAdd onClose={() => setAdding(false)} onAdd={(item) => ops.add("guests", item)} />}
      {bulk && <BulkAdd ctx={ctx} fromInvite={fromInvite} onClose={() => setBulk(false)} />}
    </Stack>
  );
}

function GuestList({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [editing, setEditing] = useState<PlanGuest | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const k = key(q);
    return plan.guests.filter((g) => (group === "all" || g.group === group) && (!k || key(g.name).includes(k) || (g.table ?? "").toLowerCase() === k));
  }, [plan.guests, q, group]);
  const groups = (Object.keys(GUEST_GROUP_LABEL) as GuestGroup[]).filter((g) => plan.guests.some((x) => x.group === g));

  if (plan.guests.length === 0) {
    return (
      <Card>
        <Empty
          icon={Users}
          title="Chưa có khách mời nào"
          hint="Thêm từng người, dán cả danh sách, hoặc nhập file Excel. Mỗi dòng là một lời mời — một người hoặc cả gia đình."
        />
      </Card>
    );
  }

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm tên khách hoặc số bàn…" className="min-w-[200px] flex-1" />
        {groups.length > 1 && (
          <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value as GroupFilter)} aria-label="Lọc theo nhóm">
            <option value="all">Tất cả nhóm ({plan.guests.length})</option>
            {groups.map((g) => (
              <option key={g} value={g}>{GUEST_GROUP_LABEL[g]} ({plan.guests.filter((x) => x.group === g).length})</option>
            ))}
          </select>
        )}
      </Toolbar>
      <Section
        title={`Danh sách khách mời · ${shown.length}`}
        desc={!readOnly ? `Chạm vào trạng thái để đổi: chưa phản hồi → sẽ dự → không dự. ${ctx.data.combo ? "Khách bấm xác nhận trên thiệp thì trạng thái và số người tự cập nhật." : "Phản hồi gửi qua thiệp tự cập nhật."}` : undefined}
        flush
      >
        {shown.slice(0, limit).map((g) => <GuestRow key={g.id} g={g} ctx={ctx} onEdit={() => setEditing(g)} />)}
        {shown.length === 0 && <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>Không có khách nào khớp.</p>}
        {shown.length > limit && (
          <div className="px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={btn("secondary", "md", "w-full")}>
              Xem thêm {Math.min(PAGE, shown.length - limit)} khách
            </button>
          </div>
        )}
      </Section>
      {editing && (
        <GuestEdit
          g={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => ops.set("guests", editing.id, patch)}
          onRemove={() => ops.remove("guests", editing.id)}
        />
      )}
    </>
  );
}

function GuestRow({ g, ctx, onEdit }: { g: PlanGuest; ctx: Ctx; onEdit: () => void }) {
  const { data, readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const reply = replies[g.id];
  const rsvp = guestRsvp(g, reply);
  const n = guestCount(g, reply);
  // Quà cưới: phản hồi đã nằm trong dòng (`replied`), sửa tay được — sửa thì bỏ dấu "qua thiệp".
  const combo = data.combo;
  const viaInvite = combo ? !!g.replied : !!reply;
  const invite = useGuestInvite(g, ctx);
  const extra: MenuItem[] = combo && data.invite
    ? [
        { label: invite.copied ? "Đã chép link" : "Chép link thiệp", icon: invite.copied ? Check : Link2, onClick: invite.copy, hint: "Tự đánh dấu đã gửi thiệp" },
        ...(invite.canShare ? [{ label: "Gửi qua ứng dụng khác", icon: Send, onClick: invite.share }] : []),
        { label: "Tải mã QR", icon: QrCode, onClick: invite.qr },
      ]
    : [];
  return (
    <div className="v2-row items-start">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => ops.set("guests", g.id, { invited: !g.invited })}
        aria-pressed={g.invited}
        aria-label={g.invited ? `Bỏ đánh dấu đã gửi thiệp: ${g.name}` : `Đánh dấu đã gửi thiệp: ${g.name}`}
        title={g.invited ? "Đã gửi thiệp" : "Chưa gửi thiệp"}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] disabled:cursor-default"
        style={g.invited ? { background: "var(--acS)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
      >
        {g.invited ? <MailCheck size={17} /> : <Mail size={17} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty", color: rsvp === "no" ? "var(--tx3)" : "var(--tx)" }}>
          {readOnly ? g.name : <button type="button" onClick={onEdit} className="text-left">{g.name}</button>}
          {n > 1 && <span className="tnum ml-1.5 text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>· {n} người</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px]" style={{ color: "var(--tx3)" }}>{GUEST_GROUP_LABEL[g.group]}</span>
          <BadgeBtn
            tone={RSVP_TONE[rsvp]}
            onClick={readOnly || (!combo && reply) ? undefined : () => ops.set("guests", g.id, { rsvp: NEXT_RSVP[g.rsvp], ...(combo ? { replied: "" } : {}) })}
            title={
              combo
                ? g.replied ? `Khách tự xác nhận qua thiệp ngày ${fmtDayMonth(g.replied)} — chạm để sửa` : "Chạm để đổi"
                : reply ? "Khách đã phản hồi qua thiệp online" : "Chạm để đổi"
            }
          >
            {RSVP_LABEL[rsvp]}{viaInvite ? " · qua thiệp" : ""}
          </BadgeBtn>
          {g.table && <Badge tone="blue">Bàn {g.table}</Badge>}
          {g.gift > 0 && <Badge tone="amber">Mừng {vnd(g.gift)}</Badge>}
          {g.thanked && <Badge tone="green">Đã cảm ơn</Badge>}
        </div>
        {g.note && <p className="mt-1 whitespace-pre-line text-[12.5px]" style={{ color: "var(--tx2)" }}>{g.note}</p>}
      </div>
      {(!readOnly || extra.length > 0) && (
        <RowMenu label={g.name} onEdit={readOnly ? undefined : onEdit} onRemove={readOnly ? undefined : () => ops.remove("guests", g.id)} extra={extra} />
      )}
    </div>
  );
}

/** Link thiệp của MỘT khách (chế độ Quà cưới): chép (tự đánh dấu đã gửi), gửi qua app khác, tải QR. */
function useGuestInvite(g: PlanGuest, ctx: Ctx) {
  const { data, readOnly, onOp } = ctx;
  // Tính lúc bấm: link tuyệt đối cần `window`, dựng sẵn lúc render thì lệch bản máy chủ.
  const link = () => inviteGuestLink(absUrl(data.invite!.public_href), g.name);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const sent = () => {
    if (!readOnly && !g.invited) listOps(onOp).set("guests", g.id, { invited: true });
  };
  return {
    copied,
    canShare,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(link());
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        sent();
      } catch { /* trình duyệt chặn clipboard */ }
    },
    share: async () => {
      try {
        await navigator.share({ title: "Thiệp cưới", text: `Trân trọng kính mời ${g.name}`, url: link() });
        sent();
      } catch { /* khách đóng bảng chia sẻ */ }
    },
    qr: () => void downloadGuestQr(g.name, link(), QR_ACCENT),
  };
}

function GuestEdit({ g, onClose, onSave, onRemove }: { g: PlanGuest; onClose: () => void; onSave: (patch: Record<string, unknown>) => void; onRemove: () => void }) {
  const [name, setName] = useState(g.name);
  const [group, setGroup] = useState<GuestGroup>(g.group);
  const [count, setCount] = useState(g.count);
  const [phone, setPhone] = useState(g.phone ?? "");
  const [rsvp, setRsvp] = useState<Rsvp>(g.rsvp);
  const [table, setTable] = useState(g.table ?? "");
  const [gift, setGift] = useState(g.gift);
  const [invited, setInvited] = useState(g.invited);
  const [thanked, setThanked] = useState(g.thanked);
  const [note, setNote] = useState(g.note ?? "");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Sửa khách mời"
      canSubmit={!!name.trim()}
      onRemove={onRemove}
      onSubmit={() => {
        // Sửa tay xác nhận → không còn là "khách tự xác nhận qua thiệp".
        onSave({ name, group, count, phone, rsvp, table, gift, invited, thanked, note, ...(rsvp !== g.rsvp ? { replied: "" } : {}) });
        onClose();
      }}
    >
      <Field label="Tên khách" className="sm:col-span-2">
        <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Nhóm">
        <SelectV2 value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} ariaLabel="Nhóm" />
      </Field>
      <Field label="Số người">
        <input type="number" min={1} max={50} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
      </Field>
      <Field label="Xác nhận">
        <SelectV2 value={rsvp} options={RSVP_LABEL} onChange={(v) => setRsvp((v || "pending") as Rsvp)} ariaLabel="Xác nhận" />
      </Field>
      <Field label="Bàn">
        <input className={inputCls} value={table} maxLength={24} onChange={(e) => setTable(e.target.value)} placeholder="1, VIP…" />
      </Field>
      <Field label="Số điện thoại">
        <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Tiền mừng">
        <MoneyField className={inputCls} value={gift} onCommit={setGift} live ariaLabel="Tiền mừng" />
      </Field>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="flex items-center gap-2.5 py-1 text-[14px]">
          <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--ac)]" checked={invited} onChange={(e) => setInvited(e.target.checked)} /> Đã gửi thiệp
        </label>
        <label className="flex items-center gap-2.5 py-1 text-[14px]">
          <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--ac)]" checked={thanked} onChange={(e) => setThanked(e.target.checked)} /> Đã gửi lời cảm ơn
        </label>
      </div>
      <Field label="Ghi chú" className="sm:col-span-2">
        <textarea className={inputCls} rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ăn chay, đi cùng con nhỏ, cần đưa đón…" />
      </Field>
    </FormDrawer>
  );
}

/**
 * Gửi thiệp (chế độ Quà cưới): link chung, chép link riêng của cả danh sách, tải
 * mã QR của cả danh sách. Link riêng từng người nằm trong menu ⋯ của dòng đó.
 */
function InviteLinks({ ctx }: { ctx: Ctx }) {
  const { data, plan, openInvite } = ctx;
  const inv = data.invite!;
  const [copied, setCopied] = useState<"all" | "one" | null>(null);
  const [zipping, setZipping] = useState(false);
  // Tính lúc bấm (cần `window`).
  const base = () => absUrl(inv.public_href);
  const links = () => plan.guests.map((g) => ({ name: g.name, link: inviteGuestLink(base(), g.name) }));
  const n = plan.guests.length;

  async function copy(text: string, k: "all" | "one") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(k);
      setTimeout(() => setCopied((c) => (c === k ? null : c)), 1600);
    } catch { /* trình duyệt chặn clipboard */ }
  }

  return (
    <Section
      title="Gửi thiệp cho khách"
      desc="Mỗi khách có link thiệp ghi đúng tên người đó. Khách bấm xác nhận trên thiệp là trạng thái, số người và số bàn ở đây tự cập nhật."
      icon={Heart}
    >
      {!inv.published && (
        <div className="mb-3">
          <Callout tone="amber" icon={TriangleAlert} title="Thiệp chưa xuất bản — khách mở link sẽ chưa xem được.">
            {openInvite && <button type="button" onClick={openInvite} className={btn("secondary", "sm", "mt-2")}>Mở thiệp để xuất bản</button>}
          </Callout>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {openInvite && (
          <button type="button" onClick={openInvite} className={btn("soft", "sm")}>
            <Heart size={15} /> Sửa thiệp
          </button>
        )}
        <button type="button" onClick={() => copy(base(), "one")} className={btn("secondary", "sm")}>
          {copied === "one" ? <Check size={15} /> : <Link2 size={15} />} {copied === "one" ? "Đã chép" : "Chép link chung"}
        </button>
        {n > 0 && (
          <button type="button" onClick={() => copy(links().map((l) => `${l.name}: ${l.link}`).join("\n"), "all")} className={btn("secondary", "sm")}>
            {copied === "all" ? <Check size={15} /> : <Copy size={15} />} {copied === "all" ? "Đã chép" : `Chép ${n} link riêng`}
          </button>
        )}
        {n > 0 && (
          <button
            type="button"
            disabled={zipping}
            onClick={async () => {
              setZipping(true);
              try { await downloadGuestQrZip(links(), QR_ACCENT); } finally { setZipping(false); }
            }}
            className={btn("secondary", "sm")}
          >
            {zipping ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Tải {n} mã QR (.zip)
          </button>
        )}
      </div>
    </Section>
  );
}

function QuickAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<GuestGroup>("bride_family");
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(0);
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm khách mời"
      desc={added ? `Đã thêm ${added} khách — nhập tiếp người khác hoặc đóng.` : "Mỗi dòng là một lời mời — một người hoặc cả gia đình."}
      submitLabel="Thêm khách"
      canSubmit={!!name.trim()}
      onSubmit={() => {
        onAdd({ name, group, count });
        setName("");
        setCount(1);
        setAdded((n) => n + 1);
      }}
    >
      <Field label="Tên khách" className="sm:col-span-2">
        <input className={inputCls} placeholder="Ví dụ: Gia đình chú Ba" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Nhóm">
        <SelectV2 value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} ariaLabel="Nhóm khách" />
      </Field>
      <Field label="Số người">
        <input type="number" min={1} max={50} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} aria-label="Số người" />
      </Field>
    </FormDrawer>
  );
}

/** Thêm nhiều khách một lúc: dán danh sách, nhập file Excel/CSV, chép từ thiệp. */
function BulkAdd({ ctx, fromInvite, onClose }: { ctx: Ctx; fromInvite: string[]; onClose: () => void }) {
  const { onOp } = ctx;
  const [text, setText] = useState("");
  const [group, setGroup] = useState<GuestGroup>("bride_family");
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const addNames = (names: string[]) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) return;
    onOp({ op: "add_many", list: "guests", items: clean.map((name) => ({ name, group })) });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Thêm nhiều khách"
      desc="Dán danh sách, nhập file Excel / CSV, hoặc chép tên từ thiệp."
      width={500}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Đóng</button>
          <button
            type="button"
            disabled={!lines}
            onClick={() => {
              addNames(text.split(/\r?\n/));
              setText("");
              onClose();
            }}
            className={btn("primary")}
          >
            <Plus size={16} /> Thêm {lines || ""} khách
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Dán danh sách" hint="Mỗi dòng một khách.">
          <textarea
            className={inputCls}
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Ví dụ:\nGia đình chú Ba\nBạn Minh\nCô Lan"}
          />
        </Field>
        <Field label="Nhóm cho cả danh sách">
          <SelectV2 value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} ariaLabel="Nhóm cho cả danh sách" />
        </Field>
        <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--bd2)" }}>
          <p className="v2-label">Hoặc</p>
          <button type="button" onClick={() => file.current?.click()} className={btn("secondary", "md", "justify-start")}>
            <Upload size={16} /> Nhập file Excel / CSV
          </button>
          {fromInvite.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onOp({ op: "add_many", list: "guests", items: fromInvite.map((name) => ({ name, invited: true })) });
                onClose();
              }}
              className={btn("secondary", "md", "justify-start")}
            >
              <UserPlus size={16} /> Nhập {fromInvite.length} khách từ thiệp
            </button>
          )}
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>File Excel: lấy tên ở cột A của trang đầu tiên, nhóm theo ô chọn ở trên.</p>
          {err && <p className="text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
          <input
            ref={file}
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setErr(null);
              try {
                const names = await parseGuestFile(f);
                if (!names.length) setErr("File không có tên nào ở cột đầu tiên.");
                else {
                  addNames(names);
                  onClose();
                }
              } catch {
                setErr("Không đọc được file. Hãy lưu thành .xlsx hoặc .csv rồi thử lại.");
              }
            }}
          />
        </div>
      </div>
    </Drawer>
  );
}

/** Sơ đồ bàn: mỗi bàn bao nhiêu người, bàn nào vượt sức chứa, ai chưa có bàn. */
function TableView({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const size = plan.settings.table_size;
  const tables = tableSummary(plan.guests, replies, size);
  const unseated = plan.guests.filter((g) => !g.table && guestRsvp(g, replies[g.id]) !== "no");

  return (
    <>
      <Card>
        <label className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
          Sức chứa mỗi bàn
          <input
            type="number"
            min={2}
            max={30}
            className={`${inputCls} !w-[80px] text-center`}
            defaultValue={size}
            readOnly={readOnly}
            onBlur={(e) => Number(e.target.value) !== size && onOp({ op: "set_settings", table_size: Number(e.target.value) || 10 })}
            aria-label="Số người mỗi bàn"
          />
          <span style={{ color: "var(--tx2)" }}>người</span>
        </label>
      </Card>

      {tables.length === 0 ? (
        <Card>
          <Empty compact icon={LayoutGrid} title="Chưa xếp bàn nào" hint="Gõ số bàn cho từng khách ở danh sách (hoặc ở ô bên dưới) — bàn tự hiện ở đây." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => (
            <Card key={t.table} style={t.over ? { borderColor: "var(--rd)" } : undefined}>
              <div className="flex items-center gap-2">
                <h4 className="min-w-0 flex-1 truncate text-[15px] font-semibold">Bàn {t.table}</h4>
                <Badge tone={t.over ? "red" : t.people === size ? "green" : "gray"}>{t.people}/{size}</Badge>
              </div>
              {t.over && (
                <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>
                  <TriangleAlert size={14} /> Vượt {t.people - size} chỗ
                </p>
              )}
              <ul className="mt-2 text-[13px]" style={{ color: "var(--tx2)" }}>
                {t.guests.map((g) => (
                  <li key={g.id} className="flex justify-between gap-2 py-1" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <span className="min-w-0 truncate">{g.name}</span>
                    <span className="tnum flex-none" style={{ color: "var(--tx3)" }}>{guestCount(g, replies[g.id])}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {unseated.length > 0 && (
        <Section title={`Chưa xếp bàn · ${unseated.reduce((n, g) => n + guestCount(g, replies[g.id]), 0)} người`} desc="Gõ số bàn rồi rời ô là lưu." flush>
          {unseated.slice(0, 200).map((g) => (
            <div key={g.id} className="v2-row">
              <div className="min-w-0 flex-1">
                <p className="v2-row-title">{g.name}</p>
                <p className="v2-row-sub">{GUEST_GROUP_LABEL[g.group]} · {guestCount(g, replies[g.id])} người</p>
              </div>
              <CommitInput
                className={`${inputCls} !w-[80px] flex-none text-center`}
                value=""
                placeholder="Bàn"
                readOnly={readOnly}
                maxLength={24}
                ariaLabel={`Bàn cho ${g.name}`}
                onCommit={(v) => v.trim() && ops.set("guests", g.id, { table: v })}
              />
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
