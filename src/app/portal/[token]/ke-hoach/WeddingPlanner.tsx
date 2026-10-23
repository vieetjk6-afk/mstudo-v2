"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { forgetDevice, readPhone, rememberPhone } from "@/lib/portal-device";
import { todayVN } from "@/lib/date";
import { applyPlanOp, planErrorText, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import PlannerView, { type SaveState } from "./PlannerView";
import type { PlannerOpResponse, PlannerPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — trang thật: cổng SĐT, tải dữ liệu, lưu từng thao tác.

   Cổng SĐT giống hệt /portal/<token> và dùng chung số đã nhớ trên máy: khách
   bấm từ trang hợp đồng sang thì vào thẳng, không phải gõ lại số.

   Lưu: mỗi thao tác hiện NGAY (áp `applyPlanOp` lên bản máy chủ), rồi gửi lên
   lần lượt từng cái một. Gửi song song thì phản hồi về lệch thứ tự và bản cũ
   đè lên bản mới. Mỗi phản hồi là bản máy chủ mới nhất; các thao tác còn chờ
   được áp lại lên trên nó — nên hai máy cùng sửa vẫn thấy việc của nhau.
   ═══════════════════════════════════════════════════════════════════════════ */

const card: React.CSSProperties = { background: "var(--sf)", border: "1px solid var(--bd)" };

/** Mã lỗi mở trang → câu cho khách. */
function openErrorText(code?: string): string {
  switch (code) {
    case "wrong_phone": return "Số điện thoại không khớp. Vui lòng kiểm tra lại.";
    case "not_found": return "Không tìm thấy hợp đồng.";
    case "disabled": return "Studio chưa mở kế hoạch cưới cho hợp đồng này.";
    case "coming_soon": return "Kế hoạch cưới sắp ra mắt — studio sẽ báo bạn khi mở.";
    case "not_ready": return "Studio đang cài đặt tính năng này. Bạn quay lại sau nhé.";
    case "rate_limited": return "Bạn thử quá nhiều lần. Đợi một phút rồi thử lại.";
    case "offline": return "Đang mất mạng. Hãy thử lại khi có mạng.";
    default: return "Có lỗi xảy ra, thử lại sau.";
  }
}

export default function WeddingPlanner({ token }: { token: string }) {
  const [phone, setPhone] = useState("");
  const [unlocked, setUnlocked] = useState("");
  const [data, setData] = useState<PlannerPayload | null>(null);
  const [plan, setPlan] = useState<WeddingPlanData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoTrying, setAutoTrying] = useState(() => !!readPhone(token));
  const [saving, setSaving] = useState<SaveState>("idle");
  const { toast, toastNode } = useToast();

  /** Bản máy chủ mới nhất + các thao tác chưa lưu xong (theo thứ tự). */
  const server = useRef<WeddingPlanData | null>(null);
  const queue = useRef<PlanOp[]>([]);
  const busy = useRef(false);

  const replay = useCallback((): WeddingPlanData | null => {
    if (!server.current) return null;
    return queue.current.reduce<WeddingPlanData>((p, o) => {
      const r = applyPlanOp(p, o);
      return r.ok ? r.plan : p;
    }, server.current);
  }, []);

  const open = useCallback(
    async (p: string, remember: boolean): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/c/${token}/ke-hoach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: p }),
        });
        const j = (await res.json().catch(() => ({}))) as PlannerPayload & { error?: string };
        if (!res.ok) {
          if (j.error === "wrong_phone") forgetDevice(token);
          return { ok: false, error: j.error };
        }
        server.current = j.plan;
        queue.current = [];
        setData(j);
        setPlan(j.plan);
        setUnlocked(p);
        if (remember) rememberPhone(token, p);
        return { ok: true };
      } catch {
        return { ok: false, error: "offline" };
      }
    },
    [token],
  );

  useEffect(() => {
    const saved = readPhone(token);
    if (!saved) return;
    let alive = true;
    void open(saved, false).then((r) => {
      if (!alive) return;
      setAutoTrying(false);
      if (!r.ok) setErr(r.error === "wrong_phone" ? "Studio đã cập nhật số điện thoại. Vui lòng nhập lại số mới." : openErrorText(r.error));
    });
    return () => { alive = false; };
  }, [token, open]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await open(phone, true);
    setLoading(false);
    if (!r.ok) setErr(openErrorText(r.error));
  }

  async function flush() {
    if (busy.current) return;
    busy.current = true;
    setSaving("saving");
    let failed = false;
    let reload = false;
    while (queue.current.length) {
      const o = queue.current[0];
      let res: Response | null = null;
      try {
        res = await fetch(`/api/c/${token}/ke-hoach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: unlocked, op: o }),
        });
      } catch {
        res = null;
      }
      if (!res) {
        // Mất mạng: bỏ hết thao tác chờ, trả về bản máy chủ — không để khách
        // tưởng đã lưu một thứ chưa lên tới đâu.
        queue.current = [];
        failed = true;
        toast(planErrorText("offline"));
        break;
      }
      const j = (await res.json().catch(() => ({}))) as Partial<PlannerOpResponse>;
      queue.current.shift();
      if (j.plan) server.current = j.plan;
      if (!res.ok) {
        failed = true;
        toast(planErrorText(j.error ?? ""));
      } else if (o.op === "set_date") {
        // Ngày cưới đổi thì lịch hẹn studio trong ngày cưới cũng đổi theo.
        reload = true;
      }
      setPlan(replay());
    }
    setPlan(replay());
    busy.current = false;
    setSaving(failed ? "error" : "saved");
    if (reload && !queue.current.length) void open(unlocked, false);
  }

  function onOp(o: PlanOp) {
    const shown = replay();
    if (!shown) return;
    // Thao tác hỏng ngay ở máy khách (ô trống, quá dài…) thì khỏi gửi.
    const r = applyPlanOp(shown, o);
    if (!r.ok) {
      toast(planErrorText(r.error));
      return;
    }
    queue.current.push(o);
    setPlan(r.plan);
    void flush();
  }

  if (!data || !plan) {
    if (autoTrying) {
      return (
        <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Đang mở kế hoạch cưới của bạn…</p>
        </div>
      );
    }
    return (
      <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
        <form onSubmit={unlock} className="w-full max-w-[400px] rounded-[16px] px-7 py-8 text-center" style={card}>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <CalendarHeart size={21} />
          </span>
          <h1 className="mt-3.5 text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>Kế hoạch cưới của bạn</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            Nhập số điện thoại đã đăng ký với studio để mở việc cần làm, ngân sách và lịch trình ngày cưới.
          </p>
          <input
            className="mt-5 w-full rounded-[11px] px-3.5 py-3 text-center text-[15px] font-semibold tracking-wide"
            style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
            inputMode="numeric"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {err && <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-3.5 w-full rounded-[11px] py-3 text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {loading ? "Đang mở…" : "Mở kế hoạch cưới"}
          </button>
          <Link href={`/portal/${token}`} className="mt-3 block text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            ← Trang hợp đồng của bạn
          </Link>
        </form>
      </div>
    );
  }

  return (
    <>
      <PlannerView data={data} plan={plan} today={todayVN()} backHref={`/portal/${token}`} onOp={onOp} saving={saving} />
      {toastNode}
    </>
  );
}
