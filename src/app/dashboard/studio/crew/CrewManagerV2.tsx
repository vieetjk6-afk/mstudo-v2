"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Link2, Phone, Search, Trash2, UserCheck, UserPen, UserPlus, UsersRound, X } from "lucide-react";
import { Avatar, Badge, Callout, Empty, Field, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { normalizeCrewPhone } from "@/lib/crew-phone";
import { crewRoleLabel, crewRolesFor } from "@/lib/crew-roles";
import { noAccent } from "@/lib/studio-nav";
import type { StudioCrew, CrewRole } from "@/lib/types";
import { PROFILE_FIELDS, type CrewState } from "./useCrew";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỘI NGŨ THỢ — giao diện mới (tab 2 của StaffAndCrewV2). Cùng logic với
   CrewManager (bản cũ, ./useCrew); khác ở cách sắp xếp:
     • Thợ tự đăng ký đang chờ nằm thành khối riêng ở đầu: Nhận / Từ chối.
     • Một bảng gọn: thợ · vai trò · chi nhánh · số buổi đã nhận. Lọc theo tên,
       vai trò, chi nhánh.
     • Bấm một thợ mở NGĂN KÉO hồ sơ: đổi vai trò / chi nhánh (lưu ngay), sửa
       hồ sơ + đổi SĐT (nút Lưu), xoá khỏi sổ.
     • Thêm thợ bằng ngăn kéo; link đăng ký cho thợ là dải cuối danh sách.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CrewPanelProps = {
  registerUrl: string;
  registerError: string | null;
  branches: { id: string; name: string }[];
};

const statLine = (s: { total: number; accepted: number; declined: number } | null) => {
  if (!s || s.total === 0) return null;
  return { accepted: s.accepted, total: s.total, declined: s.declined, rate: Math.round((s.accepted / s.total) * 100) };
};

export function CrewPanelV2({ c, registerUrl, registerError, branches, hideErr }: { c: CrewState; hideErr?: boolean } & CrewPanelProps) {
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [branchF, setBranchF] = useState("all");
  const [copied, setCopied] = useState(false);

  const branchOf = (x: StudioCrew) => branches.find((b) => b.id === x.branch_id)?.name ?? "Toàn studio";
  const rolesInUse = useMemo(() => {
    const keys = [...new Set(c.list.map((x) => x.role))];
    return keys.map((k) => ({ key: k, label: crewRoleLabel(k, c.roles) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [c.list, c.roles]);

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return c.list.filter((x) => {
      if (roleF !== "all" && x.role !== roleF) return false;
      if (branchF !== "all" && (x.branch_id ?? "") !== branchF) return false;
      return !n || noAccent(`${x.name} ${x.phone} ${x.phone.replace(/\D/g, "")} ${x.note ?? ""}`).includes(n);
    });
  }, [c.list, q, roleF, branchF]);
  const filtering = q.trim() !== "" || roleF !== "all" || branchF !== "all";

  function copyLink() {
    navigator.clipboard?.writeText(registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rowMenu = (x: StudioCrew) => (
    <Menu
      label={`Thao tác với ${x.name || x.phone}`}
      items={[
        { label: "Hồ sơ & phân công", icon: UserPen, onClick: () => c.beginEdit(x) },
        ...(x.status === "pending" ? [{ label: "Nhận vào sổ", icon: UserCheck, onClick: () => void c.approve(x.id) }] : []),
        { label: "Gọi điện", hint: x.phone, icon: Phone, href: `tel:${x.phone}`, external: true },
        "divider",
        {
          label: "Xoá khỏi sổ",
          icon: Trash2,
          danger: true,
          onClick: () => {
            if (confirm(`Xoá ${x.name || x.phone} khỏi sổ thợ?`)) void c.remove(x.id);
          },
        },
      ]}
    />
  );

  const acceptCell = (x: StudioCrew) => {
    const s = statLine(c.statFor(x.phone));
    if (!s) return <span className="text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có lời mời</span>;
    return (
      <div>
        <p className="v2-num text-[13.5px] font-semibold">
          {s.accepted} buổi <span className="font-normal" style={{ color: "var(--tx3)" }}>/ {s.total} lời mời</span>
        </p>
        <p className="text-[12px]" style={{ color: s.rate >= 70 ? "var(--gn)" : s.rate >= 40 ? "var(--am)" : "var(--rd)" }}>
          nhận {s.rate}%{s.declined ? ` · từ chối ${s.declined}` : ""}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {!registerUrl && registerError ? (
        <Callout tone="amber" icon={AlertTriangle} title="Chưa cấp được link đăng ký cho thợ">
          Chưa ghi được mã link vào hồ sơ studio. Thường là do chưa chạy <code className="break-all">supabase/migrations/crew_profile_show.sql</code>. Chạy xong tải lại trang.
          <span className="mt-1 block break-all font-mono text-[12px]">{registerError}</span>
        </Callout>
      ) : null}

      {c.err && !hideErr ? (
        <Callout tone="red" icon={AlertTriangle} action={<button type="button" className={btn("ghost", "sm")} onClick={() => c.setErr(null)}>Đóng</button>}>
          {c.err}
        </Callout>
      ) : null}

      {c.pending.length > 0 ? (
        <section className="v2-card overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--am) 35%, var(--bd))" }}>
          <header className="v2-section-head" style={{ background: "var(--amS)" }}>
            <span className="v2-section-icon" style={{ background: "var(--sf)", color: "var(--am)" }}>
              <UserPlus size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="v2-section-title">{c.pending.length} thợ xin vào sổ</h3>
              <p className="v2-section-desc">Thợ tự đăng ký qua link riêng của studio — nhận để gán được vào hợp đồng.</p>
            </div>
          </header>
          {c.pending.map((x) => (
            <div key={x.id} className="v2-row flex-wrap">
              <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-3">
                <Avatar name={x.name || x.phone} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title">{x.name || x.phone}</p>
                  <p className="v2-row-sub">{x.phone} · {crewRoleLabel(x.role, c.roles)}</p>
                </div>
              </div>
              <div className="ml-auto flex flex-none gap-2">
                <button type="button" onClick={() => void c.remove(x.id)} className={btn("ghost", "sm")}>
                  <X size={15} /> Từ chối
                </button>
                <button type="button" onClick={() => void c.approve(x.id)} className={btn("soft", "sm")}>
                  <Check size={15} /> Nhận vào sổ
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {c.list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={UsersRound}
            title="Chưa có thợ nào trong sổ"
            hint="Bấm “Thêm thợ” ở đầu trang, hoặc gửi link đăng ký để thợ tự khai thông tin."
            action={
              registerUrl ? (
                <button type="button" onClick={copyLink} className={btn("secondary")}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Đã chép link" : "Chép link đăng ký"}
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tên, số điện thoại, ghi chú…" className="w-full" />
              </div>
              <select aria-label="Lọc theo vai trò" className={inputCls} value={roleF} onChange={(e) => setRoleF(e.target.value)}>
                <option value="all">Mọi vai trò</option>
                {rolesInUse.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              {branches.length > 0 ? (
                <select aria-label="Lọc theo chi nhánh" className={inputCls} value={branchF} onChange={(e) => setBranchF(e.target.value)}>
                  <option value="all">Mọi chi nhánh</option>
                  <option value="">Toàn studio</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : null}
            </Toolbar>
            {filtering ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {shown.length}/{c.list.length} thợ ·{" "}
                <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setRoleF("all"); setBranchF("all"); }}>
                  Xoá lọc
                </button>
              </p>
            ) : null}
          </div>

          {shown.length === 0 ? (
            <Empty compact icon={Search} title="Không có thợ nào khớp" hint="Thử bỏ bớt bộ lọc hoặc gõ ít chữ hơn." />
          ) : (
            <>
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Thợ</th>
                      <th style={{ width: 170 }}>Vai trò</th>
                      {branches.length > 0 ? <th style={{ width: 170 }}>Chi nhánh</th> : null}
                      <th style={{ width: 190 }}>Nhận việc</th>
                      <th style={{ width: 56 }} aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.id} className="cursor-pointer" onClick={() => c.beginEdit(x)}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={x.name || x.phone} size={36} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-semibold">
                                <span className="truncate">{x.name || "(chưa đặt tên)"}</span>
                                {x.status === "pending" ? <Badge tone="amber" dot>Chờ duyệt</Badge> : null}
                              </p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                                <span className="v2-num">{x.phone}</span>
                                {x.note ? ` · ${x.note}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td><Badge tone="brand">{crewRoleLabel(x.role, c.roles)}</Badge></td>
                        {branches.length > 0 ? (
                          <td className="text-[13.5px]" style={{ color: x.branch_id ? "var(--tx)" : "var(--tx3)" }}>{branchOf(x)}</td>
                        ) : null}
                        <td>{acceptCell(x)}</td>
                        <td onClick={(e) => e.stopPropagation()}>{rowMenu(x)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden">
                {shown.map((x) => {
                  const s = statLine(c.statFor(x.phone));
                  return (
                    <button key={x.id} type="button" onClick={() => c.beginEdit(x)} className="v2-row v2-row-link w-full text-left">
                      <Avatar name={x.name || x.phone} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="v2-row-title">{x.name || "(chưa đặt tên)"}</p>
                        <p className="v2-row-sub">
                          {crewRoleLabel(x.role, c.roles)} · {x.phone}
                        </p>
                        {branches.length > 0 && x.branch_id ? (
                          <span className="mt-1 inline-flex"><Badge tone="gray">{branchOf(x)}</Badge></span>
                        ) : null}
                      </div>
                      <div className="flex-none text-right">
                        {x.status === "pending" ? (
                          <Badge tone="amber" dot>Chờ duyệt</Badge>
                        ) : s ? (
                          <>
                            <p className="v2-num text-[14px] font-semibold">{s.accepted} buổi</p>
                            <p className="text-[12px]" style={{ color: "var(--tx3)" }}>nhận {s.rate}%</p>
                          </>
                        ) : (
                          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>chưa có lời mời</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {registerUrl ? (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
              <span className="v2-section-icon" style={{ background: "var(--sf)" }}>
                <Link2 size={16} />
              </span>
              <div className="min-w-0 flex-1 basis-[220px]">
                <p className="text-[13.5px] font-semibold">Link cho thợ tự đăng ký</p>
                <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }} title={registerUrl}>{registerUrl}</p>
              </div>
              <button type="button" onClick={copyLink} className={btn("secondary", "sm")}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép link"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Ngăn kéo hồ sơ thợ: phân công (lưu ngay) + hồ sơ (nút Lưu) + xoá. */
export function CrewDrawerV2({ c, branches }: { c: CrewState; branches: { id: string; name: string }[] }) {
  const x = c.editId ? c.list.find((y) => y.id === c.editId) ?? null : null;
  const close = () => c.setEditId(null);
  const s = x ? statLine(c.statFor(x.phone)) : null;
  const phoneChanged = x ? normalizeCrewPhone(c.draft.phone) !== normalizeCrewPhone(x.phone) : false;

  return (
    <Drawer
      open={!!x}
      onClose={close}
      width={540}
      title={x ? x.name || x.phone : "Hồ sơ thợ"}
      desc={x ? `${x.phone} · ${crewRoleLabel(x.role, c.roles)}` : undefined}
      footer={
        x ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Xoá ${x.name || x.phone} khỏi sổ thợ?`)) void c.remove(x.id);
              }}
              className={btn("danger", "md", "mr-auto")}
            >
              <Trash2 size={16} /> <span className="hidden sm:inline">Xoá khỏi sổ</span>
            </button>
            <button type="button" onClick={close} className={btn("ghost")}>Đóng</button>
            <button type="button" onClick={() => void c.saveEdit(x)} disabled={c.savingEdit} className={btn("primary")}>
              {c.savingEdit ? "Đang lưu…" : "Lưu hồ sơ"}
            </button>
          </>
        ) : null
      }
    >
      {x ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <Avatar name={x.name || x.phone} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{x.name || "(chưa đặt tên)"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="brand">{crewRoleLabel(x.role, c.roles)}</Badge>
                {x.status === "pending" ? <Badge tone="amber" dot>Chờ duyệt</Badge> : null}
              </div>
            </div>
            <a href={`tel:${x.phone}`} className={btn("secondary", "md")}>
              <Phone size={16} /> Gọi
            </a>
          </div>

          {x.status === "pending" ? (
            <Callout tone="amber" icon={UserPlus} title="Thợ tự đăng ký, chờ bạn duyệt" action={<button type="button" className={btn("soft", "sm")} onClick={() => void c.approve(x.id)}><Check size={15} /> Nhận vào sổ</button>} />
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "Đã nhận", v: s ? `${s.accepted} buổi` : "0" },
              { k: "Lời mời", v: s ? String(s.total) : "0" },
              { k: "Tỉ lệ nhận", v: s ? `${s.rate}%` : "—" },
            ].map((m) => (
              <div key={m.k} className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
                <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{m.k}</p>
                <p className="v2-num text-[16px] font-bold">{m.v}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <p className="v2-section-title">Phân công</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vai trò" hint="Đổi là lưu ngay.">
                <select
                  className={inputCls}
                  value={x.role}
                  onChange={(e) => void c.setCrewRole(x.id, e.target.value)}
                  aria-label={`Vai trò của ${x.name || x.phone}`}
                >
                  {crewRolesFor(null, c.roles, x.role).map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </Field>
              {branches.length > 0 ? (
                <Field label="Chi nhánh" hint="Đổi là lưu ngay.">
                  <select
                    className={inputCls}
                    value={x.branch_id ?? ""}
                    onChange={(e) => void c.setCrewBranch(x.id, e.target.value)}
                    aria-label={`Chi nhánh của ${x.name || x.phone}`}
                  >
                    <option value="">Toàn studio</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
            {c.err ? <Callout tone="red">{c.err}</Callout> : null}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="v2-section-title">Hồ sơ thợ</p>
              <p className="v2-section-desc">
                Cùng bộ thông tin thợ tự khai ở trang /crew.
                {x.self_filled_at ? ` Thợ tự cập nhật lần cuối ${fmtDate(x.self_filled_at)}.` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Số điện thoại"
                hint={phoneChanged ? "Thợ sẽ đăng nhập /crew bằng số mới; phân công, lịch và chấm công ở studio này chuyển theo." : undefined}
              >
                <input
                  className={inputCls}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={c.draft.phone ?? ""}
                  onChange={(e) => c.setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </Field>
              {PROFILE_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} className={f.key === "note" || f.key === "address" ? "sm:col-span-2" : undefined}>
                  <input
                    className={inputCls}
                    type={f.type ?? "text"}
                    value={c.draft[f.key] ?? ""}
                    onChange={(e) => c.setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
            {c.editErr ? <Callout tone="red">{c.editErr}</Callout> : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

/** Ngăn kéo thêm thợ vào sổ. */
export function CrewAddDrawerV2({
  c,
  open,
  onClose,
  branches,
}: {
  c: CrewState;
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string }[];
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Thêm thợ vào sổ"
      desc="Lưu thợ theo số điện thoại để gán nhanh vào hợp đồng."
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button
            type="button"
            disabled={c.busy}
            onClick={async () => {
              if (await c.add()) onClose();
            }}
            className={btn("primary")}
          >
            <UserPlus size={16} /> {c.busy ? "Đang thêm…" : "Thêm vào sổ"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên">
            <input className={inputCls} value={c.name} onChange={(e) => c.setName(e.target.value)} />
          </Field>
          <Field label="Số điện thoại" hint="Thợ đăng nhập trang /crew bằng số này.">
            <input className={inputCls} type="tel" inputMode="tel" value={c.phone} onChange={(e) => c.setPhone(e.target.value)} />
          </Field>
          <Field label="Vai trò">
            <select className={inputCls} value={c.role} onChange={(e) => c.setRole(e.target.value as CrewRole)}>
              {crewRolesFor(null, c.roles, c.role).map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </Field>
          {branches.length > 0 ? (
            <Field label="Chi nhánh">
              <select className={inputCls} value={c.branchId} onChange={(e) => c.setBranchId(e.target.value)}>
                <option value="">Toàn studio (không gán)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Ghi chú" className="sm:col-span-2">
            <input className={inputCls} value={c.note} onChange={(e) => c.setNote(e.target.value)} placeholder="VD: chuyên phóng sự, có flycam…" />
          </Field>
        </div>
        {c.err ? <Callout tone="red">{c.err}</Callout> : null}
      </div>
    </Drawer>
  );
}
