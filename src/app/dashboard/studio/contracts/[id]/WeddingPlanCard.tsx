"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, Camera, Check, Copy, MapPin, Phone, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/date";
import { plannerMessage } from "@/lib/share-messages";
import { SIDE_LABEL, budgetCatLabel, daysUntil, guestSummary, mergeDay, normalizePlan, type WeddingPlanData } from "@/lib/wedding-plan";
import MessengerButton from "@/components/MessengerButton";

/**
 * KẾ HOẠCH CƯỚI CỦA KHÁCH — thẻ phía studio trên màn hợp đồng.
 *
 * Khách tự lập kế hoạch ở /portal/<token>/ke-hoach; studio chỉ ĐỌC ở đây phần
 * ê-kíp cần: ngày cưới, lịch trình ngày cưới, đội hỗ trợ (ai là phù dâu, gọi ai),
 * nhà cung cấp đã chốt (số nhà hàng, MC), ảnh khách muốn có, bảng màu. Ngân
 * sách, báo giá, tiền mừng của khách cố ý không hiện: đó là tiền của cặp đôi,
 * không phải việc của studio.
 *
 * Công tắc "Hiện trên cổng khách" là cột `studio_contracts.wedding_planner`
 * (null = theo gói: gói cưới thì bật), cùng kiểu với tự tặng thiệp.
 */
export default function WeddingPlanCard({
  contractId, clientToken, studioHost, clientMessenger, toggle, packageOn, comingSoon = false,
}: {
  contractId: string;
  clientToken: string | null;
  studioHost: string | null;
  clientMessenger: string;
  /** Lựa chọn riêng của hợp đồng: true bật, false tắt, null/undefined theo gói. */
  toggle?: boolean | null;
  /** Gói của hợp đồng là gói cưới (mặc định bật). */
  packageOn: boolean;
  comingSoon?: boolean;
}) {
  const [plan, setPlan] = useState<(WeddingPlanData & { updated_at: string }) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [value, setValue] = useState<boolean | null>(toggle ?? null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const on = value ?? packageOn;

  useEffect(() => {
    if (comingSoon) return;
    let alive = true;
    void (async () => {
      const db = createClient();
      const base = "wedding_date, budget_total, tasks, budget, day_plan, updated_at";
      // Thử kèm cột `extra` (khách mời, đội hỗ trợ, ảnh cần chụp…); database chưa
      // chạy ke_hoach_cuoi_mo_rong.sql thì đọc phần gốc.
      let res = await db.from("wedding_plans").select(`${base}, extra`).eq("contract_id", contractId).maybeSingle();
      if (res.error && phanLoaiLoi(res.error) === "thieu-cot") res = await db.from("wedding_plans").select(base).eq("contract_id", contractId).maybeSingle();
      if (!alive) return;
      if (res.error) {
        setState(phanLoaiLoi(res.error) === "thieu-bang" ? "missing" : "ready");
        return;
      }
      const data = res.data as (NonNullable<Parameters<typeof normalizePlan>[0]> & { updated_at: string }) | null;
      setPlan(data ? { ...normalizePlan(data), updated_at: data.updated_at } : null);
      setState("ready");
    })();
    return () => { alive = false; };
  }, [contractId, comingSoon]);

  /** Chọn trùng mặc định của gói thì lưu null ("theo gói") — đổi gói sau này là theo. */
  async function flip() {
    const next = !on;
    const v = next === packageOn ? null : next;
    setSaving(true);
    setErr(null);
    const { error } = await createClient().from("studio_contracts").update({ wedding_planner: v }).eq("id", contractId);
    setSaving(false);
    if (error) {
      setErr(isMissingColumn(error, "wedding_planner") ? "Cần cập nhật cơ sở dữ liệu (chạy supabase/cap-nhat.sql) để lưu lựa chọn này." : error.message);
      return;
    }
    setValue(v);
  }

  const head = (
    <div className="flex flex-wrap items-center gap-3">
      <CalendarHeart size={16} style={{ color: "#d96e8f" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>💍 Kế hoạch cưới của khách</p>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          {comingSoon
            ? "Tính năng đang được hoàn thiện, sẽ sớm có mặt."
            : "Khách tự lên kế hoạch ở cổng khách — studio đọc lịch trình, đội hỗ trợ, ảnh cần chụp ở đây (không thấy ngân sách của khách)."}
        </p>
      </div>
      {comingSoon && (
        <span className="rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--brand)", background: "var(--brandSoft)" }}>
          Sắp ra mắt
        </span>
      )}
    </div>
  );

  if (comingSoon) return <div className="card mb-6 p-4" style={{ opacity: 0.85 }}>{head}</div>;
  if (state === "loading") return null;

  const url = clientToken ? studioUrl(studioHost, `/portal/${clientToken}/ke-hoach`) : "";
  const rows = plan ? mergeDay(plan.day, []) : [];
  const left = plan ? daysUntil(plan.wedding_date, todayVN()) : null;
  const done = plan ? plan.tasks.filter((t) => t.done).length : 0;
  const guests = plan && plan.guests.length ? guestSummary(plan.guests).people : plan?.settings.guests_expected ?? 0;
  const booked = plan ? plan.vendors.filter((v) => v.status === "booked") : [];
  const shots = plan ? [...plan.shots].sort((a, b) => Number(b.must) - Number(a.must)) : [];

  return (
    <div className="card mb-6 p-4">
      {head}

      {state === "missing" ? (
        <p className="mt-3 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--s-amber)" }}>
          Cần cập nhật cơ sở dữ liệu (chạy supabase/cap-nhat.sql) để bật kế hoạch cưới.
        </p>
      ) : (
        <>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--border)" }}>
            <input type="checkbox" className="mt-0.5" checked={on} disabled={saving} onChange={flip} />
            <span>
              <span className="font-semibold" style={{ color: "var(--text)" }}>Hiện kế hoạch cưới trên cổng khách</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
                {packageOn
                  ? "Gói cưới — bật sẵn. Bỏ chọn nếu hợp đồng này không cần."
                  : "Gói này không phải gói cưới — chọn để mở kế hoạch cưới cho khách."}
              </span>
            </span>
          </label>

          {on && url && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text2)" }}>{url}</span>
              <MessengerButton link={clientMessenger} label="Gửi khách" message={plannerMessage(url)} />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(plannerMessage(url));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="btn-ghost px-2.5 py-1.5 text-xs"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Đã chép lời nhắn" : "Chép link kèm lời nhắn"}
              </button>
            </div>
          )}

          {plan ? (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: "var(--text2)" }}>
                <span>
                  Ngày cưới:{" "}
                  <b style={{ color: "var(--text)" }}>{plan.wedding_date ? fmtDate(plan.wedding_date) : "khách chưa chọn"}</b>
                  {left !== null && left > 0 ? ` · còn ${left} ngày` : ""}
                </span>
                <span>Khách đã đánh dấu <b style={{ color: "var(--text)" }}>{done}/{plan.tasks.length}</b> việc</span>
                {guests > 0 && <span>Khoảng <b style={{ color: "var(--text)" }}>{guests}</b> khách</span>}
                <span style={{ color: "var(--text3)" }}>Cập nhật {fmtDateTime(plan.updated_at)}</span>
              </p>
              <Sub title="Lịch trình ngày cưới khách lập" />
              {rows.length === 0 ? (
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text3)" }}>Khách chưa lập lịch trình.</p>
              ) : (
                <ul className="mt-1">
                  {rows.map((r) => (
                    <li key={r.id} className="flex gap-3 py-1.5 text-[13px]">
                      <span className="tnum w-[46px] flex-none font-bold" style={{ color: r.time ? "var(--text)" : "var(--text3)" }}>{r.time || "--:--"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{r.title}</span>
                        {r.side && <span className="ml-1.5 text-[11.5px]" style={{ color: "var(--text3)" }}>· {SIDE_LABEL[r.side]}</span>}
                        {(r.place || r.who) && (
                          <span className="flex flex-wrap gap-x-3 text-[12px]" style={{ color: "var(--text3)" }}>
                            {r.place && <span className="flex items-start gap-1"><MapPin size={12} className="mt-[3px] flex-none" /> {r.place}</span>}
                            {r.who && <span className="flex items-start gap-1"><UserRound size={12} className="mt-[3px] flex-none" /> {r.who}</span>}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {plan.people.length > 0 && (
                <>
                  <Sub title="Đội hỗ trợ ngày cưới" />
                  <ul className="mt-1">
                    {plan.people.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-2 py-1 text-[13px]">
                        <span className="font-semibold">{p.name}</span>
                        {(p.role || p.side) && <span className="text-[12px]" style={{ color: "var(--text3)" }}>{[p.role, p.side && `bên ${SIDE_LABEL[p.side].toLowerCase()}`].filter(Boolean).join(" · ")}</span>}
                        {p.phone && <a href={`tel:${p.phone}`} className="tnum ml-auto flex items-center gap-1 text-[12.5px]" style={{ color: "var(--brand)" }}><Phone size={12} /> {p.phone}</a>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {booked.length > 0 && (
                <>
                  <Sub title="Nhà cung cấp khách đã chốt" />
                  <ul className="mt-1">
                    {booked.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-x-2 py-1 text-[13px]">
                        <span className="text-[12px]" style={{ color: "var(--text3)" }}>{budgetCatLabel(v.cat)}</span>
                        <span className="font-semibold">{v.name}</span>
                        {v.phone && <a href={`tel:${v.phone}`} className="tnum ml-auto flex items-center gap-1 text-[12.5px]" style={{ color: "var(--brand)" }}><Phone size={12} /> {v.phone}</a>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {shots.length > 0 && (
                <>
                  <Sub title={`Ảnh khách muốn có · ${shots.filter((x) => x.must).length} bắt buộc`} />
                  <ul className="mt-1">
                    {shots.map((x) => (
                      <li key={x.id} className="flex items-start gap-2 py-1 text-[13px]">
                        <Camera size={13} className="mt-[3px] flex-none" style={{ color: x.must ? "var(--brand)" : "var(--text3)" }} />
                        <span className={x.must ? "font-semibold" : ""} style={{ color: x.must ? "var(--text)" : "var(--text2)" }}>{x.title}</span>
                        {!x.must && <span className="text-[11.5px]" style={{ color: "var(--text3)" }}>(nếu kịp)</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {(plan.style.colors.length > 0 || plan.style.concept) && (
                <>
                  <Sub title="Phong cách" />
                  {plan.style.colors.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {plan.style.colors.map((c) => <span key={c} title={c} className="h-[22px] w-[34px] rounded-[6px]" style={{ background: c, border: "1px solid var(--border)" }} />)}
                    </div>
                  )}
                  {plan.style.concept && <p className="mt-1.5 whitespace-pre-line text-[12.5px]" style={{ color: "var(--text2)" }}>{plan.style.concept}</p>}
                </>
              )}
            </div>
          ) : (
            on && (
              <p className="mt-3 text-[12px]" style={{ color: "var(--text3)" }}>
                Khách chưa mở kế hoạch cưới. Kế hoạch được tạo khi khách mở trang lần đầu.
              </p>
            )
          )}
        </>
      )}

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
    </div>
  );
}

function Sub({ title }: { title: string }) {
  return <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text3)" }}>{title}</p>;
}
