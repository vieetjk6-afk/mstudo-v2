"use client";

import { useEffect, useState } from "react";
import { Clock, Play, Square, CalendarCheck } from "lucide-react";
import { humanHours, sessionHours, type TimesheetRow } from "@/lib/timesheet";

/* ═══════════════════════════════════════════════════════════════════════════
   CHẤM CÔNG Ở CỔNG THỢ — hai cái nút, không hơn.

   Thợ mở cổng này trên điện thoại, ở phim trường, một tay đang cầm máy. Nên màn
   này chỉ có ĐÚNG MỘT nút lớn: "Đã đến" khi tới, "Đã xong" khi rời. Mọi thứ
   khác (chọn hợp đồng, ghi chú) là tuỳ chọn.

   Studio nào: thợ chạy nhiều studio, nên phải chọn — nhưng nếu chỉ thuộc MỘT sổ
   thợ thì chọn sẵn luôn và không hỏi.

   Đồng hồ đếm chạy ở client chỉ để NHÌN. Giờ tính tiền do server chốt (mốc
   started_at/ended_at), và số giờ do @/lib/timesheet tính — đồng hồ máy thợ lệch
   thì tiền không lệch theo.
   ═══════════════════════════════════════════════════════════════════════════ */

export type OpenEntry = { id: string; started_at: string | null; work_date: string; contract_id: string | null } | null;

export default function CrewTimeClock({
  open,
  recent,
  studios,
  jobs,
  busy,
  onClockIn,
  onClockOut,
}: {
  open: OpenEntry;
  recent: TimesheetRow[];
  /** Studio đã nhận thợ này vào sổ. */
  studios: { id: string; name: string }[];
  /** Việc đang được phân — để gắn giờ làm vào đúng hợp đồng. */
  jobs: { id: string; label: string }[];
  busy: boolean;
  onClockIn: (v: { studioId: string; contractId: string }) => void;
  onClockOut: (note: string) => void;
}) {
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [contractId, setContractId] = useState("");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Chỉ chạy đồng hồ khi ĐANG có buổi mở — không đặt một setInterval sống mãi
  // trên trang mà thợ để mở cả ngày trong túi.
  useEffect(() => {
    if (!open?.started_at) return;
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [open?.started_at]);

  useEffect(() => {
    if (!studioId && studios[0]) setStudioId(studios[0].id);
  }, [studios, studioId]);

  if (studios.length === 0) return null;

  const elapsed = open?.started_at ? (now - Date.parse(open.started_at)) / 3_600_000 : 0;

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
        <Clock size={18} style={{ color: "var(--gold)" }} /> Chấm công
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
        Bấm <b>Đã đến</b> khi tới nơi và <b>Đã xong</b> khi rời. Studio dùng số giờ này để đối soát tiền công,
        nên bạn không phải nhắc lại bằng tin nhắn.
      </p>

      {open ? (
        <div className="mt-4">
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--brandSoft, var(--surface2))", border: "1px solid var(--border)" }}
          >
            <p className="text-[13px] font-bold" style={{ color: "var(--brand, var(--gold))" }}>
              Đang làm · {humanHours(Math.max(0, elapsed))}
            </p>
            <p className="tnum mt-0.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
              Bắt đầu {open.started_at ? new Date(open.started_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              {" · "}
              {open.work_date.split("-").reverse().join("/")}
            </p>
          </div>
          <input
            className="input mt-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú (không bắt buộc): phát sinh, đi thêm điểm…"
          />
          <button onClick={() => onClockOut(note)} disabled={busy} className="btn-primary mt-3 w-full py-3">
            <Square size={16} /> {busy ? "Đang lưu…" : "Đã xong"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {studios.length > 1 && (
            <select className="input" value={studioId} onChange={(e) => setStudioId(e.target.value)}>
              {studios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {jobs.length > 0 && (
            <select
              className={`input ${studios.length > 1 ? "mt-2" : ""}`}
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">— Không gắn việc cụ thể —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => onClockIn({ studioId, contractId })}
            disabled={busy || !studioId}
            className="btn-primary mt-3 w-full py-3"
          >
            <Play size={16} /> {busy ? "Đang lưu…" : "Đã đến"}
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text2)" }}>
            <CalendarCheck size={13} /> Buổi gần đây
          </p>
          <div className="mt-1.5 flex flex-col">
            {recent.slice(0, 6).map((r) => {
              const h = sessionHours(r);
              return (
                <div
                  key={r.id}
                  className="tnum flex items-center justify-between py-1.5 text-[12px]"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--text2)" }}>{r.workDate.split("-").reverse().join("/")}</span>
                  <span className="font-semibold">
                    {/* `null` = dòng còn hở hoặc dữ liệu sai. Nói thẳng, đừng
                        hiện "0 phút" — thợ sẽ tưởng mình mất công. */}
                    {h === null ? <span style={{ color: "var(--warn, var(--gold))" }}>cần studio sửa giờ</span> : humanHours(h)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
