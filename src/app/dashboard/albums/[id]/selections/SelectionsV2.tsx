"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Copy, ExternalLink, FileText, Heart, HeartOff, ListChecks,
  MessageSquareText, Radio, Trash2, Unplug, Users,
} from "lucide-react";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import { stripExtension } from "@/lib/drive";
import { fmtDateTime } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import {
  Avatar, Badge, Callout, Empty, GroupLabel, PageHead, Stack, Stat, StatGrid, Toolbar, btn, inputCls,
} from "@/components/v2/kit";
import { Menu, Modal, SearchInput, Segmented, Switch, type MenuItem } from "@/components/v2/kit-client";
import type { Selection } from "@/lib/types";
import { Thumb, Toast, shortCode } from "../album-v2-parts";
import { useSelections, type Group, type SelectionsProps } from "./useSelections";

/* ═══════════════════════════════════════════════════════════════════════════
   LỰA CHỌN CỦA KHÁCH — giao diện mới. Cùng dữ liệu, cùng thao tác với
   SelectionsView (bản cũ, logic chung ở ./useSelections); khác ở cách sắp xếp:
     • 4 số liệu: ảnh đã chọn · mã chọn · có ghi chú · khách không thích.
     • Một thanh lọc: tìm (tên file, ghi chú) · Đã chọn / Có ghi chú / Không
       thích · mã chọn. Chép/tải mã ảnh của mọi nhóm gom vào MỘT menu.
     • Lưới ảnh gọn theo từng mã chọn, ghi chú khách nổi bật, ô ghi chú của
       studio ngay dưới ảnh.
     • Ảnh không thích: tick chọn, xoá trên Drive qua hộp thoại xác nhận.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "liked" | "notes" | "disliked";

const groupName = (g: Group) => g.clientName || (g.sessionId === "shared" ? "Lựa chọn của khách" : `Mã ${shortCode(g.sessionId)}`);
const hasNote = (s: Selection) => !!(s.client_note || s.photographer_note || "").trim();

export default function SelectionsV2(props: SelectionsProps) {
  const { album } = props;
  const s = useSelections(props);
  const [view, setView] = useState<View>("liked");
  const [q, setQ] = useState("");
  const [session, setSession] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  function note(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }

  const totalPicks = s.groups.reduce((n, g) => n + g.items.length, 0);
  const uniquePhotos = useMemo(() => new Set(s.groups.flatMap((g) => g.items.map((i) => i.photo_id))).size, [s.groups]);
  const notedCount = s.groups.reduce((n, g) => n + g.items.filter(hasNote).length, 0);
  const latest = s.groups.reduce<string | null>((m, g) => {
    const last = g.items[g.items.length - 1]?.created_at ?? g.createdAt;
    return !m || last > m ? last : m;
  }, null);

  // Nhóm đang hiện: lọc mã chọn, chế độ (có ghi chú), ô tìm.
  const shownGroups = useMemo(() => {
    const needle = noAccent(q.trim());
    return s.groups
      .filter((g) => session === "all" || g.sessionId === session)
      .map((g) => ({
        g,
        items: g.items.filter((i) => {
          if (view === "notes" && !hasNote(i)) return false;
          if (needle && !noAccent(`${i.photo_name} ${i.client_note ?? ""} ${i.photographer_note ?? ""}`).includes(needle)) return false;
          return true;
        }),
      }))
      .filter((x) => x.items.length > 0);
  }, [s.groups, session, view, q]);

  const shownDislikes = useMemo(() => {
    const needle = noAccent(q.trim());
    return needle ? s.dislikeItems.filter((d) => noAccent(`${d.photo_name} ${d.client_note ?? ""}`).includes(needle)) : s.dislikeItems;
  }, [s.dislikeItems, q]);

  const copyGroups = session === "all" ? s.groups : s.groups.filter((g) => g.sessionId === session);
  const copyItems: MenuItem[] = [
    ...copyGroups.flatMap((g): MenuItem[] => [
      {
        label: `Chép mã · ${groupName(g)}`,
        hint: `${g.items.length} ảnh, mỗi ảnh một dòng`,
        icon: Copy,
        onClick: () => {
          s.copyList(g);
          note(`Đã chép ${g.items.length} mã ảnh của ${groupName(g)}`);
        },
      },
      { label: `Tải .txt · ${groupName(g)}`, hint: "Kèm ghi chú, gửi thợ chỉnh ảnh", icon: FileText, onClick: () => s.exportList(g) },
    ]),
    ...(s.dislikeItems.length
      ? ([
          ...(copyGroups.length ? ["divider" as const] : []),
          {
            label: "Chép mã ảnh không thích",
            hint: `${s.dislikeItems.length} ảnh`,
            icon: HeartOff,
            onClick: () => {
              s.copyDislikeList();
              note(`Đã chép ${s.dislikeItems.length} mã ảnh không thích`);
            },
          },
          { label: "Tải .txt ảnh không thích", icon: FileText, onClick: s.exportDislikeList },
        ] as MenuItem[])
      : []),
  ];

  const empty = s.groups.length === 0 && s.dislikeItems.length === 0;
  const allPicked = s.picked.size === s.dislikeItems.length && s.dislikeItems.length > 0;

  return (
    <Stack>
      <Link href={`/dashboard/albums/${album.id}`} className="inline-flex w-fit max-w-full items-center gap-1.5 truncate text-[13px] font-medium" style={{ color: "var(--tx3)" }}>
        <ArrowLeft size={15} className="flex-none" /> <span className="truncate">{album.title}</span>
      </Link>

      <PageHead
        title="Lựa chọn của khách"
        desc={
          <span className="inline-flex flex-wrap items-center gap-2">
            Ảnh khách bấm tim, gom theo từng mã chọn. Chép mã để lọc ảnh hoặc gửi thợ chỉnh.
            {s.live ? <Badge tone="green" icon={Radio}>Đang cập nhật trực tiếp</Badge> : null}
          </span>
        }
        actions={<FilterPhotosButton albumId={album.id} albumTitle={album.title} className={btn("primary")} iconSize={16} />}
      />

      <StatGrid>
        <Stat icon={Heart} tone="brand" label="Ảnh đã chọn" value={uniquePhotos} sub={`${totalPicks} lượt chọn`} />
        <Stat icon={Users} tone="blue" label="Mã chọn" value={s.groups.length} sub={latest ? `Gần nhất ${fmtDateTime(latest)}` : "Chưa có ai chọn"} />
        <Stat icon={MessageSquareText} tone="amber" label="Có ghi chú" value={notedCount} sub="Khách hoặc studio ghi" />
        <Stat
          icon={HeartOff}
          tone="red"
          label="Khách không thích"
          value={s.dislikeItems.length}
          valueTone={s.dislikeItems.length ? "red" : undefined}
          sub={s.dislikeItems.length ? "Cần xoá khỏi Drive gốc" : "Không có ảnh nào"}
        />
      </StatGrid>

      {empty ? (
        <div className="v2-card">
          <Empty
            icon={Heart}
            title="Khách chưa chọn ảnh nào"
            hint="Gửi link album cho khách. Mỗi người mở link và bấm tim là một mã chọn, hiện ngay ở đây."
            action={
              <Link href={`/dashboard/albums/${album.id}?tab=shares`} className={btn("secondary")}>
                Gửi link cho khách
              </Link>
            }
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad flex flex-col gap-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên file hoặc ghi chú…" className="w-full" />
              </div>
              <Segmented<View>
                label="Xem"
                value={view}
                onChange={setView}
                options={[
                  { value: "liked", label: "Đã chọn", count: totalPicks },
                  { value: "notes", label: "Có ghi chú", count: notedCount },
                  ...(s.dislikeItems.length ? [{ value: "disliked" as const, label: "Không thích", count: s.dislikeItems.length }] : []),
                ]}
              />
              {s.groups.length > 1 && view !== "disliked" && (
                <select aria-label="Mã chọn" className={inputCls} value={session} onChange={(e) => setSession(e.target.value)}>
                  <option value="all">Mọi mã chọn ({s.groups.length})</option>
                  {s.groups.map((g) => (
                    <option key={g.sessionId} value={g.sessionId}>
                      {groupName(g)} · {g.items.length} ảnh
                    </option>
                  ))}
                </select>
              )}
              <Menu
                width={280}
                trigger={({ toggle, open }) => (
                  <button type="button" onClick={toggle} aria-expanded={open} className={btn("secondary")}>
                    <Copy size={16} /> Chép mã ảnh <ChevronDown size={15} className="-mr-1 opacity-70" />
                  </button>
                )}
                items={copyItems}
              />
            </Toolbar>
          </div>

          {view === "disliked" ? (
            <DislikedPanel s={s} items={shownDislikes} allPicked={allPicked} />
          ) : shownGroups.length === 0 ? (
            <Empty compact icon={ListChecks} title="Không có ảnh nào khớp" hint="Thử từ khoá khác, hoặc chọn mã chọn khác." />
          ) : (
            <div className="v2-card-pad flex flex-col gap-6">
              {shownGroups.map(({ g, items }) => (
                <section key={g.sessionId} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Avatar name={groupName(g)} size={30} />
                    <GroupLabel count={`${items.length} ảnh · ${fmtDateTime(g.createdAt)}`}>{groupName(g)}</GroupLabel>
                    {g.clientName && g.sessionId !== "shared" ? (
                      <span className="v2-num text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>{shortCode(g.sessionId)}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 min-[1000px]:grid-cols-4 min-[1300px]:grid-cols-5">
                    {items.map((item) => (
                      <PickCard key={item.id} item={item} fileId={s.fileIdByPhoto.get(item.photo_id)} onNote={(v) => void s.saveNote(item.id, v)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && <Toast>{toast}</Toast>}
    </Stack>
  );
}

function PickCard({ item, fileId, onNote }: { item: Selection; fileId?: string; onNote: (v: string) => void }) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
      <div className="relative aspect-[3/2]" style={{ background: "var(--sf2)" }}>
        <Thumb fileId={fileId} alt={item.photo_name} />
        <span
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: "var(--ac)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}
          title="Khách đã chọn"
        >
          <Heart size={12} fill="currentColor" />
        </span>
      </div>
      <figcaption className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="v2-num truncate text-[12.5px] font-semibold" title={item.photo_name}>{stripExtension(item.photo_name)}</p>
        {item.client_note && (
          <p className="rounded-[8px] px-2 py-1.5 text-[12px] leading-snug" style={{ background: "var(--amS)", color: "var(--tx)" }} title={item.client_note}>
            “{item.client_note}”
          </p>
        )}
        <input
          defaultValue={item.photographer_note ?? ""}
          placeholder="Ghi chú của studio…"
          onBlur={(e) => onNote(e.target.value)}
          className={`${inputCls} mt-auto`}
          style={{ height: 32, fontSize: 12.5, padding: "0 10px" }}
          aria-label={`Ghi chú cho ${item.photo_name}`}
        />
      </figcaption>
    </figure>
  );
}

function DislikedPanel({
  s,
  items,
  allPicked,
}: {
  s: ReturnType<typeof useSelections>;
  items: ReturnType<typeof useSelections>["dislikeItems"];
  allPicked: boolean;
}) {
  const n = s.pickedItems.length;
  return (
    <div className="v2-card-pad flex flex-col gap-4">
      <Callout tone="red" icon={HeartOff} title="Khách yêu cầu bỏ những ảnh này khỏi album">
        Tick ảnh muốn xoá rồi bấm xoá trên Drive: file gốc vào Thùng rác Drive (mặc định) và ảnh bị gỡ khỏi album.
      </Callout>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => s.setPicked(new Set(allPicked ? [] : s.dislikeItems.map((d) => d.photo_id)))}
          className={btn("ghost", "sm")}
        >
          <CheckCircle2 size={15} /> {allPicked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
        </button>
        <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          Đã chọn {n}/{s.dislikeItems.length} ảnh
        </span>
        <button type="button" onClick={() => s.setConfirming(true)} disabled={n === 0} className={btn("danger", "sm", "ml-auto")}>
          <Trash2 size={15} /> Xoá {n} ảnh trên Drive
        </button>
      </div>

      {s.delMsg && (
        <Callout
          tone="blue"
          title={s.delMsg}
          action={
            !s.permanent ? (
              <a href="https://drive.google.com/drive/trash" target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>
                <ExternalLink size={15} /> Thùng rác Drive
              </a>
            ) : null
          }
        />
      )}
      {s.delFailed.length > 0 && (
        <Callout tone="red" icon={AlertTriangle} title={`Không xoá được ${s.delFailed.length} ảnh`}>
          <ul className="mt-1 flex flex-col gap-0.5">
            {s.delFailed.slice(0, 12).map((f) => (
              <li key={f.name}>
                {stripExtension(f.name)}: {f.error}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {items.length === 0 ? (
        <Empty compact icon={HeartOff} title="Không có ảnh nào khớp" />
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 min-[1000px]:grid-cols-4 min-[1300px]:grid-cols-5">
          {items.map((item) => {
            const on = s.picked.has(item.photo_id);
            return (
              <label
                key={item.id}
                className="flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[12px]"
                style={{ border: on ? "1.5px solid var(--rd)" : "1px solid var(--bd)", background: "var(--sf)" }}
              >
                <span className="relative block aspect-[3/2]" style={{ background: "var(--sf2)" }}>
                  <Thumb fileId={item.fileId} alt={item.photo_name} />
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ background: on ? "var(--rd)" : "rgba(255,255,255,.92)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
                    <input type="checkbox" checked={on} onChange={() => s.togglePick(item.photo_id)} className="h-4 w-4" style={{ accentColor: "var(--rd)" }} aria-label={`Chọn xoá ${item.photo_name}`} />
                  </span>
                </span>
                <span className="flex flex-col gap-1.5 p-2.5">
                  <span className="v2-num truncate text-[12.5px] font-semibold" title={item.photo_name}>{stripExtension(item.photo_name)}</span>
                  {item.client_note && (
                    <span className="rounded-[8px] px-2 py-1.5 text-[12px] leading-snug" style={{ background: "var(--rdS)", color: "var(--tx)" }} title={item.client_note}>
                      “{item.client_note}”
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <Modal
        open={s.confirming}
        onClose={() => s.setConfirming(false)}
        icon={AlertTriangle}
        title={`Xoá ${n} ảnh khỏi link Drive gốc?`}
        desc="Ảnh cũng bị gỡ khỏi album nên khách không còn thấy nữa."
        footer={
          s.driveConn && !s.driveConn.connected ? (
            <a href="/api/filter/drive/connect" className={btn("primary")}>
              <Unplug size={16} /> Kết nối Google Drive (1 lần)
            </a>
          ) : (
            <>
              <button type="button" onClick={() => s.setConfirming(false)} className={btn("ghost")}>
                Huỷ
              </button>
              <button type="button" onClick={() => void s.deleteDisliked()} disabled={s.deleting || n === 0} className={btn("danger")}>
                <Trash2 size={16} />
                {s.deleting ? "Đang xoá…" : s.permanent ? `Xoá hẳn ${n} ảnh` : `Chuyển ${n} ảnh vào Thùng rác`}
              </button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
            Tài khoản Google đã kết nối phải là <b>chủ sở hữu</b> các file đó. File của người khác sẽ báo lỗi và được giữ nguyên.
          </p>
          {s.driveConn && !s.driveConn.connected ? (
            <Callout tone="amber" icon={Unplug}>
              Kết nối <b>một lần duy nhất</b> bằng tài khoản Google sở hữu link ảnh gốc. Sau đó xoá/chép đều tự động, không cần
              đăng nhập lại.
            </Callout>
          ) : (
            <div className="rounded-[12px] px-3" style={{ border: "1px solid var(--bd)" }}>
              <Switch
                label="Xoá hẳn, không đưa vào Thùng rác"
                desc="Không phục hồi được."
                checked={s.permanent}
                onChange={s.setPermanent}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
