"use client";

import { useState } from "react";
import { AlertTriangle, Camera, CalendarHeart, Check, ChevronRight, Copy, Link2, MapPin, Phone, UserRound } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import { Badge, Callout, GroupLabel, btn } from "@/components/v2/kit";
import { Drawer, Switch } from "@/components/v2/kit-client";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { SIDE_LABEL, budgetCatLabel } from "@/lib/wedding-plan";
import { useWeddingPlan, type WeddingPlanProps } from "./WeddingPlanCard";
import { GiftBlock, LinkRow } from "./ContractV2Shared";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI CỦA KHÁCH — giao diện mới (khối Quà tặng, tab Sản phẩm). Cùng
   logic với thẻ bản cũ (useWeddingPlan): công tắc hiện trên cổng khách, link
   gửi khách, bốn con số tóm tắt; phần ê-kíp cần đọc (lịch trình ngày cưới,
   đội hỗ trợ, nhà cung cấp, ảnh cần chụp, phong cách) mở trong ngăn kéo.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WeddingPlanCardV2(props: WeddingPlanProps) {
  const { clientMessenger, packageOn, comingSoon = false, combo = false } = props;
  const w = useWeddingPlan(props);
  const [open, setOpen] = useState(false);
  const title = combo ? "Quà cưới của khách" : "Kế hoạch cưới của khách";
  const desc = comingSoon
    ? "Tính năng đang được hoàn thiện, sẽ sớm có mặt."
    : combo
      ? "Một link cho cả kế hoạch cưới lẫn thiệp cưới online: khách lên kế hoạch, sửa thiệp, thêm khách là có link thiệp ghi tên từng người."
      : "Khách tự lên kế hoạch ở cổng khách — studio đọc lịch trình, đội hỗ trợ, ảnh cần chụp ở đây (không thấy ngân sách của khách).";

  if (comingSoon) return <GiftBlock icon={CalendarHeart} tone="red" title={title} badge={<Badge tone="brand">Sắp ra mắt</Badge>} desc={desc} muted />;
  if (w.state === "loading") return null;
  const { plan } = w;

  return (
    <GiftBlock
      icon={CalendarHeart}
      tone="red"
      title={title}
      badge={
        w.state === "missing" ? undefined : w.on ? (
          <Badge tone="green" dot>
            Đang hiện trên cổng khách
          </Badge>
        ) : (
          <Badge tone="gray" dot>
            Đang tắt
          </Badge>
        )
      }
      desc={desc}
    >
      {w.state === "missing" ? (
        <Callout tone="amber" icon={AlertTriangle}>
          Cần cập nhật cơ sở dữ liệu (chạy supabase/cap-nhat.sql) để bật kế hoạch cưới.
        </Callout>
      ) : (
        <>
          <div className="rounded-[12px] px-3 py-1" style={{ background: "var(--sf2)" }}>
            <Switch
              checked={w.on}
              disabled={w.saving}
              onChange={() => w.flip()}
              label="Hiện kế hoạch cưới trên cổng khách"
              desc={packageOn ? "Gói cưới — bật sẵn. Tắt nếu hợp đồng này không cần." : "Gói này không phải gói cưới — bật để mở kế hoạch cưới cho khách."}
            />
          </div>

          {w.on && w.url && (
            <LinkRow icon={Link2} label={combo ? "Link Quà cưới gửi khách" : "Link kế hoạch cưới gửi khách"} url={w.url}>
              <MessengerButton link={clientMessenger} label="Gửi khách" message={w.message} className={btn("secondary", "sm")} />
              <button type="button" onClick={w.copyMessage} className={btn("ghost", "sm")}>
                {w.copied ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />} {w.copied ? "Đã chép" : "Chép kèm lời nhắn"}
              </button>
            </LinkRow>
          )}

          {plan ? (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini label="Ngày cưới" value={plan.wedding_date ? fmtDate(plan.wedding_date) : "Chưa chọn"} sub={w.left !== null && w.left > 0 ? `còn ${w.left} ngày` : undefined} />
                <Mini label="Việc khách đã xong" value={`${w.done}/${plan.tasks.length}`} />
                <Mini label="Khách mời" value={w.guests > 0 ? `~${w.guests}` : "—"} />
                <Mini label="Cập nhật" value={fmtDateTime(plan.updated_at)} small />
              </dl>
              <button type="button" className={btn("secondary", "md", "w-full !justify-between")} onClick={() => setOpen(true)}>
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <CalendarHeart size={16} /> Xem lịch trình & ghi chú của khách
                </span>
                <span className="flex flex-none items-center gap-1 text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
                  {w.rows.length} mốc · {w.shots.length} ảnh <ChevronRight size={16} />
                </span>
              </button>
            </>
          ) : (
            w.on && (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Khách chưa mở kế hoạch cưới. Kế hoạch được tạo khi khách mở trang lần đầu.
              </p>
            )
          )}
        </>
      )}
      {w.err && <Callout tone="red">{w.err}</Callout>}

      {plan && (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title={title}
          desc={`Khách cập nhật ${fmtDateTime(plan.updated_at)} · chỉ phần ê-kíp cần, không có ngân sách`}
          width={520}
        >
          <div className="flex flex-col gap-5">
            <div>
              <GroupLabel count={w.rows.length || undefined}>Lịch trình ngày cưới</GroupLabel>
              {w.rows.length === 0 ? (
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--tx3)" }}>
                  Khách chưa lập lịch trình.
                </p>
              ) : (
                <ol className="mt-1.5 flex flex-col">
                  {w.rows.map((r) => (
                    <li key={r.id} className="flex gap-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <span className="v2-num w-[48px] flex-none text-[13.5px] font-bold" style={{ color: r.time ? "var(--ac)" : "var(--tx3)" }}>
                        {r.time || "--:--"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-[13.5px] font-semibold">{r.title}</span>
                        {r.side && (
                          <span className="ml-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                            · {SIDE_LABEL[r.side]}
                          </span>
                        )}
                        {(r.place || r.who) && (
                          <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                            {r.place && (
                              <span className="flex items-start gap-1">
                                <MapPin size={13} className="mt-[2px] flex-none" /> {r.place}
                              </span>
                            )}
                            {r.who && (
                              <span className="flex items-start gap-1">
                                <UserRound size={13} className="mt-[2px] flex-none" /> {r.who}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {plan.people.length > 0 && (
              <div>
                <GroupLabel count={plan.people.length}>Đội hỗ trợ ngày cưới</GroupLabel>
                <ul className="mt-1.5 flex flex-col">
                  {plan.people.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                        {(p.role || p.side) && (
                          <span className="block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                            {[p.role, p.side && `bên ${SIDE_LABEL[p.side].toLowerCase()}`].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className={btn("ghost", "sm")}>
                          <Phone size={14} /> {p.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {w.booked.length > 0 && (
              <div>
                <GroupLabel count={w.booked.length}>Nhà cung cấp khách đã chốt</GroupLabel>
                <ul className="mt-1.5 flex flex-col">
                  {w.booked.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{v.name}</span>
                        <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {budgetCatLabel(v.cat)}
                        </span>
                      </span>
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className={btn("ghost", "sm")}>
                          <Phone size={14} /> {v.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {w.shots.length > 0 && (
              <div>
                <GroupLabel count={`${w.shots.filter((x) => x.must).length} bắt buộc`}>Ảnh khách muốn có</GroupLabel>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {w.shots.map((x) => (
                    <li key={x.id} className="flex items-start gap-2 text-[13.5px]">
                      <Camera size={15} className="mt-[2px] flex-none" style={{ color: x.must ? "var(--ac)" : "var(--tx3)" }} />
                      <span className={x.must ? "font-semibold" : ""} style={{ color: x.must ? "var(--tx)" : "var(--tx2)" }}>
                        {x.title}
                      </span>
                      {!x.must && (
                        <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                          (nếu kịp)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(plan.style.colors.length > 0 || plan.style.concept) && (
              <div>
                <GroupLabel>Phong cách</GroupLabel>
                {plan.style.colors.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plan.style.colors.map((c) => (
                      <span key={c} title={c} className="h-[24px] w-[36px] rounded-[7px]" style={{ background: c, border: "1px solid var(--bd)" }} />
                    ))}
                  </div>
                )}
                {plan.style.concept && (
                  <p className="mt-2 whitespace-pre-line text-[13px]" style={{ color: "var(--tx2)" }}>
                    {plan.style.concept}
                  </p>
                )}
              </div>
            )}
          </div>
        </Drawer>
      )}
    </GiftBlock>
  );
}

function Mini({ label, value, sub, small = false }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-[10px] px-3 py-2" style={{ background: "var(--sf2)" }}>
      <dt className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
        {label}
      </dt>
      <dd className={`truncate font-semibold ${small ? "text-[12.5px]" : "text-[14px]"}`}>{value}</dd>
      {sub ? (
        <dd className="truncate text-[11.5px]" style={{ color: "var(--am)" }}>
          {sub}
        </dd>
      ) : null}
    </div>
  );
}
