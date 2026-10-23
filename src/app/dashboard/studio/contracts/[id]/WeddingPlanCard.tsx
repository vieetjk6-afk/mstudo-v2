"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, Check, Copy, MapPin, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/date";
import { plannerMessage } from "@/lib/share-messages";
import { daysUntil, mergeDay, normalizePlan, type WeddingPlanData } from "@/lib/wedding-plan";
import MessengerButton from "@/components/MessengerButton";

/**
 * KẾ HOẠCH CƯỚI CỦA KHÁCH — thẻ phía studio trên màn hợp đồng.
 *
 * Khách tự lập kế hoạch ở /portal/<token>/ke-hoach; studio chỉ ĐỌC ở đây: ngày
 * cưới, tiến độ việc cần làm và lịch trình ngày cưới — thứ ê-kíp cần để biết
 * giờ đón dâu, giờ làm lễ. Ngân sách của khách cố ý không hiện: đó là tiền của
 * cặp đôi, không phải việc của studio.
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
    void createClient()
      .from("wedding_plans")
      .select("wedding_date, budget_total, tasks, budget, day_plan, updated_at")
      .eq("contract_id", contractId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setState(phanLoaiLoi(error) === "thieu-bang" ? "missing" : "ready");
          return;
        }
        setPlan(data ? { ...normalizePlan(data), updated_at: data.updated_at as string } : null);
        setState("ready");
      });
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
            : "Khách tự lên việc cần làm, ngân sách và lịch trình ngày cưới ở cổng khách — studio đọc lịch trình ở đây."}
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
                <span style={{ color: "var(--text3)" }}>Cập nhật {fmtDateTime(plan.updated_at)}</span>
              </p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text3)" }}>Lịch trình ngày cưới khách lập</p>
              {rows.length === 0 ? (
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text3)" }}>Khách chưa lập lịch trình.</p>
              ) : (
                <ul className="mt-1">
                  {rows.map((r) => (
                    <li key={r.id} className="flex gap-3 py-1.5 text-[13px]">
                      <span className="tnum w-[46px] flex-none font-bold" style={{ color: r.time ? "var(--text)" : "var(--text3)" }}>{r.time || "--:--"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{r.title}</span>
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
