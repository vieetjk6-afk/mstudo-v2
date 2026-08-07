"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Navigation, CheckCircle2, PlayCircle, Circle,
  Square, CheckSquare, CalendarOff, Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { currentStepIndex, type FieldPlan } from "@/lib/field-mode";

export type FieldJob = {
  id: string;
  code: string | null;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  location: string | null;
  mapUrl: string | null;
  status: string;
  plan: FieldPlan;
};

/**
 * Màn hình dùng khi đang cầm máy ở hiện trường. Khác mọi màn khác trong khu
 * quản lý: chữ 16–28px, vùng bấm cao 52–60px, mỗi khối chỉ một việc — vì người
 * dùng đang đứng ngoài nắng, một tay cầm máy.
 *
 * Hai thứ được ghi vào localStorage theo id hợp đồng, KHÔNG lên máy chủ: ảnh đã
 * tick trong checklist và chặng đang chạy khi người dùng tự bấm. Ngoài hiện
 * trường sóng thường chập chờn, mà đây cũng là ghi chú thao tác của riêng thợ
 * — mất cũng không ảnh hưởng dữ liệu hợp đồng.
 */
const lsKey = (id: string) => `mstudo_field_${id}`;

type Saved = { shots: number[]; step: number | null };

function loadSaved(id: string): Saved {
  if (typeof window === "undefined") return { shots: [], step: null };
  try {
    const raw = window.localStorage.getItem(lsKey(id));
    const v = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    return { shots: Array.isArray(v?.shots) ? v!.shots! : [], step: typeof v?.step === "number" ? v!.step! : null };
  } catch {
    return { shots: [], step: null };
  }
}

/** Giờ hiện tại theo giờ Việt Nam, tính bằng phút từ nửa đêm. */
function nowMinutesVN(): number {
  const s = new Date(Date.now() + 7 * 3600 * 1000).toISOString();
  return Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
}

export default function FieldMode({
  jobs,
  initialId,
  today,
}: {
  jobs: FieldJob[];
  initialId: string | null;
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [jobId, setJobId] = useState<string | null>(initialId);
  const [shots, setShots] = useState<number[]>([]);
  const [manualStep, setManualStep] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const job = useMemo(() => jobs.find((j) => j.id === jobId) ?? null, [jobs, jobId]);

  // Đồng hồ chỉ chạy ở trình duyệt — render trên máy chủ không có giờ của người
  // dùng, đọc trong lúc render sẽ lệch giữa hai lần vẽ (hydration mismatch).
  useEffect(() => {
    setNow(nowMinutesVN());
    const t = setInterval(() => setNow(nowMinutesVN()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Đổi buổi thì nạp lại phần đã tick của buổi đó.
  useEffect(() => {
    if (!jobId) return;
    const saved = loadSaved(jobId);
    setShots(saved.shots);
    setManualStep(saved.step);
  }, [jobId]);

  function persist(next: Partial<Saved>) {
    if (!jobId) return;
    const cur = { shots, step: manualStep, ...next };
    try {
      window.localStorage.setItem(lsKey(jobId), JSON.stringify(cur));
    } catch {
      /* chế độ riêng tư chặn localStorage — vẫn dùng được trong phiên này */
    }
  }

  function toggleShot(i: number) {
    const next = shots.includes(i) ? shots.filter((x) => x !== i) : [...shots, i];
    setShots(next);
    persist({ shots: next });
  }

  function pickStep(i: number) {
    // Bấm lại đúng chặng đang sáng = bỏ ghim, quay về bám theo đồng hồ.
    const next = manualStep === i ? null : i;
    setManualStep(next);
    persist({ step: next });
  }

  /**
   * "Xong buổi chụp" — buổi đã diễn ra thật, nên đưa hợp đồng sang **đang thực
   * hiện** nếu nó còn ở nháp/đã gửi/đã duyệt. Bước "Chụp" trong vòng đời 7 bước
   * được suy ra từ trạng thái này (xem ContractStepper), không có cột riêng nên
   * đây là chỗ duy nhất cần chạm tới.
   *
   * Xong thì Ở LẠI màn này chứ không nhảy sang chi tiết hợp đồng: người bấm nút
   * đang cầm điện thoại ngoài hiện trường, và nếu hôm nay còn buổi nữa thì họ
   * chuyển thẳng sang buổi kế ngay trên đây.
   */
  async function finish() {
    if (!job) return;
    setFinishing(true);
    if (job.status !== "in_progress" && job.status !== "completed") {
      const { error } = await supabase.from("studio_contracts").update({ status: "in_progress" }).eq("id", job.id);
      if (error) {
        setFinishing(false);
        setMsg("Không lưu được, kiểm tra sóng rồi thử lại.");
        setTimeout(() => setMsg(null), 3000);
        return;
      }
    }
    setFinishing(false);
    setDone((p) => [...new Set([...p, job.id])]);
    router.refresh();
  }

  /* ── Hôm nay không có buổi nào ──────────────────────────────────────── */
  if (!job) {
    return (
      <div className="page-in mx-auto flex max-w-[860px] flex-col gap-4">
        <FieldHeader />
        <div className="rounded-[16px] px-6 py-12 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
          <CalendarOff size={30} style={{ color: "var(--tx3)", margin: "0 auto" }} />
          <p className="mt-3 text-[17px] font-bold">Hôm nay không có buổi chụp nào</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Chế độ này lấy các hợp đồng có ngày chụp là hôm nay ({today}). Mở Lịch làm việc để xem những ngày tới.
          </p>
          <Link
            href="/dashboard/studio/calendar"
            className="mt-5 inline-flex items-center gap-1.5 rounded-[12px] px-5 py-3 text-[14px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            Mở Lịch làm việc
          </Link>
        </div>
      </div>
    );
  }

  const { plan } = job;
  // Chặng đang chạy: ưu tiên chặng thợ tự ghim, không thì bám theo đồng hồ.
  const clockStep = now === null ? 0 : currentStepIndex(plan, now);
  const activeStep = manualStep ?? clockStep;
  const doneShots = shots.length;

  return (
    <div className="page-in mx-auto flex max-w-[860px] flex-col gap-4">
      {msg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold" style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}>
          {msg}
        </div>
      )}

      <FieldHeader kindLabel={plan.kindLabel} />

      {/* Nhiều buổi trong ngày — chọn buổi đang làm. */}
      {jobs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {jobs.map((j) => (
            <button
              key={j.id}
              onClick={() => setJobId(j.id)}
              className="flex flex-none items-center gap-1.5 rounded-[12px] px-4 py-2.5 text-[14px] font-semibold"
              style={
                j.id === jobId
                  ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid var(--acM)" }
                  : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
              }
            >
              {done.includes(j.id) && <CheckCircle2 size={16} style={{ color: "var(--gn)" }} />}
              <span className="tnum">{j.plan.start}</span> · {j.clientName || j.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Buổi chụp: giờ, tên, khách, hai nút to ─────────────────────── */}
      <div className="rounded-[16px] px-6 py-[22px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="tnum text-[13px] font-bold" style={{ color: "var(--ac)", letterSpacing: ".4px" }}>{plan.timeLabel}</p>
        <h2 className="mt-1.5 text-[28px] font-bold leading-[1.15]" style={{ letterSpacing: "-.7px", textWrap: "pretty" }}>{job.title}</h2>
        <p className="mt-1.5 text-[16px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          {job.clientName || "Chưa có tên khách"}
          {job.location ? ` · ${job.location}` : ""}
        </p>

        <div className="mt-[18px] flex gap-2.5">
          <a
            href={job.clientPhone ? `tel:${job.clientPhone}` : undefined}
            aria-disabled={!job.clientPhone}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[13px] p-4 text-[16px] font-bold"
            style={{
              background: "var(--ac)", color: "#fff",
              opacity: job.clientPhone ? 1 : 0.45,
              pointerEvents: job.clientPhone ? "auto" : "none",
            }}
          >
            <Phone size={22} /> Gọi khách
          </a>
          <a
            href={job.mapUrl || (job.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}` : undefined)}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!job.mapUrl && !job.location}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[13px] p-4 text-[16px] font-bold"
            style={{
              background: "var(--sf2)", color: "var(--tx)", border: "1px solid var(--bd)",
              opacity: job.mapUrl || job.location ? 1 : 0.45,
              pointerEvents: job.mapUrl || job.location ? "auto" : "none",
            }}
          >
            <Navigation size={22} /> Chỉ đường
          </a>
        </div>
      </div>

      {/* ── Lịch trình buổi chụp ───────────────────────────────────────── */}
      <div className="rounded-[16px] px-[22px] py-5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>
            Lịch trình buổi chụp
          </p>
          {manualStep !== null && (
            <button onClick={() => pickStep(manualStep)} className="text-[11.5px] font-semibold" style={{ color: "var(--ac)" }}>
              Bám theo đồng hồ
            </button>
          )}
        </div>

        {plan.run.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          const Icon = done ? CheckCircle2 : active ? PlayCircle : Circle;
          return (
            <button
              key={`${step.at}-${i}`}
              onClick={() => pickStep(i)}
              className="mb-[9px] flex min-h-[56px] w-full items-center gap-3.5 rounded-[12px] px-[15px] py-[13px] text-left last:mb-0"
              style={{
                background: done ? "var(--gnS)" : active ? "var(--acS)" : "transparent",
                border: `1px solid ${active ? "var(--ac)" : "var(--bd)"}`,
              }}
            >
              <Icon size={24} className="flex-none" style={{ color: done ? "var(--gn)" : active ? "var(--ac)" : "var(--tx3)" }} />
              <span
                className="tnum w-[62px] flex-none text-[17px] font-bold"
                style={{ color: done ? "var(--gn)" : active ? "var(--ac)" : "var(--tx3)" }}
              >
                {step.at}
              </span>
              <span className="min-w-0 flex-1 text-[16px]" style={{ fontWeight: active ? 750 : 550, textWrap: "pretty" }}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Ảnh bắt buộc phải có ───────────────────────────────────────── */}
      <div className="rounded-[16px] px-[22px] py-5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>
            Ảnh bắt buộc phải có
          </p>
          <span
            className="tnum ml-auto flex-none rounded-[20px] px-[11px] py-[4px] text-[12px] font-bold"
            style={
              doneShots === plan.shots.length
                ? { background: "var(--gnS)", color: "var(--gn)" }
                : { background: "var(--sf2)", color: "var(--tx3)" }
            }
          >
            {doneShots}/{plan.shots.length}
          </span>
        </div>

        {plan.shots.map((s, i) => {
          const done = shots.includes(i);
          return (
            <button
              key={s.label}
              onClick={() => toggleShot(i)}
              className="flex min-h-[52px] w-full items-center gap-3.5 py-[13px] text-left"
              style={{ borderBottom: i < plan.shots.length - 1 ? "1px solid var(--bd2)" : "none" }}
            >
              {done
                ? <CheckSquare size={26} className="flex-none" style={{ color: "var(--gn)" }} />
                : <Square size={26} className="flex-none" style={{ color: "var(--tx3)" }} />}
              <span
                className="min-w-0 flex-1 text-[16px] font-semibold"
                style={{ textWrap: "pretty", color: done ? "var(--tx3)" : "var(--tx)", textDecoration: done ? "line-through" : "none" }}
              >
                {s.label}
              </span>
              <span className="flex-none whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--tx3)" }}>{s.count}</span>
            </button>
          );
        })}
      </div>

      {done.includes(job.id) ? (
        <div className="rounded-[14px] px-5 py-[18px] text-center" style={{ background: "var(--gnS)" }}>
          <p className="flex items-center justify-center gap-2 text-[17px] font-bold" style={{ color: "var(--gn)" }}>
            <CheckCircle2 size={24} /> Đã ghi nhận xong buổi chụp
          </p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
            Hợp đồng chuyển sang <b>đang thực hiện</b> — bước tiếp theo là hậu kỳ.
          </p>
          <Link
            href={`/dashboard/studio/contracts/${job.id}`}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-[12px] px-5 py-3 text-[14px] font-semibold"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
          >
            Mở hợp đồng
          </Link>
        </div>
      ) : (
        <button
          onClick={finish}
          disabled={finishing}
          className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[14px] p-[18px] text-[17px] font-bold disabled:opacity-60"
          style={{ background: "var(--gn)", color: "#fff" }}
        >
          <CheckCircle2 size={24} /> {finishing ? "Đang lưu…" : "Xong buổi chụp"}
        </button>
      )}
    </div>
  );
}

/** Hàng đầu màn: nút thoát 44px, pill loại buổi, câu nhắc màn này để làm gì. */
function FieldHeader({ kindLabel }: { kindLabel?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard/studio"
        aria-label="Thoát chế độ ngày chụp"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px]"
        style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
      >
        <ArrowLeft size={24} />
      </Link>
      {kindLabel ? (
        <span className="flex-none rounded-[20px] px-[13px] py-1.5 text-[12.5px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          {kindLabel}
        </span>
      ) : (
        <span className="flex flex-none items-center gap-1.5 rounded-[20px] px-[13px] py-1.5 text-[12.5px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <Camera size={15} /> Chế độ ngày chụp
        </span>
      )}
      <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
        Chữ to, chỉ hiện thứ cần khi đang cầm máy
      </p>
    </div>
  );
}
