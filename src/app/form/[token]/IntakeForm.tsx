"use client";

import TimeInput from "@/components/TimeInput";

import { useState } from "react";
import { Check, Loader2, Send, Pencil } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import type { ContractIntake, IntakeLocation } from "@/lib/types";
import { cleanIntakeLocation } from "@/lib/intake-text";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function IntakeForm({
  token,
  isWedding,
  clientName,
  title,
  studio,
  submitted,
  initial,
}: {
  token: string;
  isWedding: boolean;
  clientName: string | null;
  title: string | null;
  studio: string | null;
  submitted: boolean;
  initial: ContractIntake | null;
}) {
  const isPsc = isWedding;
  const [done, setDone] = useState(submitted);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Nhà gái — điền sẵn nếu khách đã gửi trước đó (để sửa/bổ sung).
  const [brideName, setBrideName] = useState(initial?.bride?.name ?? "");
  const [bridePhone, setBridePhone] = useState(initial?.bride?.phone ?? "");
  const [brideMakeup, setBrideMakeup] = useState(initial?.bride?.makeup_time ?? "");
  const [brideCeremony, setBrideCeremony] = useState(initial?.bride?.ceremony_time ?? "");
  const [brideLoc, setBrideLoc] = useState<IntakeLocation | null>(cleanIntakeLocation(initial?.bride?.location));
  // Nhà trai
  const [groomName, setGroomName] = useState(initial?.groom?.name ?? "");
  const [groomPhone, setGroomPhone] = useState(initial?.groom?.phone ?? "");
  const [groomDepart, setGroomDepart] = useState(initial?.groom?.depart_time ?? "");
  const [groomCeremony, setGroomCeremony] = useState(initial?.groom?.ceremony_time ?? "");
  const [groomLoc, setGroomLoc] = useState<IntakeLocation | null>(cleanIntakeLocation(initial?.groom?.location));
  // Tiệc cưới / địa điểm chung
  const [receptionTime, setReceptionTime] = useState(initial?.reception?.time ?? "");
  const [receptionLoc, setReceptionLoc] = useState<IntakeLocation | null>(cleanIntakeLocation(initial?.reception?.location));
  // Chung (loại khác)
  const [contactName, setContactName] = useState(initial?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? "");
  const [startTime, setStartTime] = useState(initial?.start_time ?? "");
  const [genLoc, setGenLoc] = useState<IntakeLocation | null>(cleanIntakeLocation(initial?.location));
  const [note, setNote] = useState(initial?.note ?? "");

  async function submit() {
    setBusy(true);
    setErr("");
    const payload: any = isPsc
      ? {
          type: "psc",
          bride: { name: brideName, phone: bridePhone, makeup_time: brideMakeup, ceremony_time: brideCeremony, location: brideLoc },
          groom: { name: groomName, phone: groomPhone, depart_time: groomDepart, ceremony_time: groomCeremony, location: groomLoc },
          reception: { time: receptionTime, location: receptionLoc },
          note,
        }
      : { type: "generic", contact_name: contactName, contact_phone: contactPhone, start_time: startTime, location: genLoc, note };

    try {
      const res = await fetch(`/api/form/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((x) => x.json());
      if (res.ok) setDone(true);
      else setErr(res.error || "Gửi thất bại, thử lại.");
    } catch {
      setErr("Lỗi mạng, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Check size={28} />
        </div>
        <h1 className="mt-4 font-serif text-2xl font-medium">Đã gửi thông tin</h1>
        <p className="mt-2 text-sm opacity-70">
          Cảm ơn {clientName || "anh/chị"} đã cung cấp thông tin. Studio đã nhận và sẽ chuẩn bị chu đáo cho buổi chụp ạ!
        </p>
        <p className="mt-4 text-sm opacity-70">Nếu điền chưa xong hoặc có sai sót, anh/chị có thể chỉnh sửa &amp; gửi lại:</p>
        <button onClick={() => { setErr(""); setDone(false); }} className="btn-ghost mx-auto mt-3 px-4 py-2 text-sm">
          <Pencil size={15} /> Chỉnh sửa / bổ sung thông tin
        </button>
      </div>
    );
  }

  const field = "input w-full";
  const lbl = "mb-1 block text-xs font-medium opacity-80";

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-serif text-2xl font-medium">Thông tin buổi chụp</h1>
      <p className="mt-1 text-sm opacity-70">
        {title ? `${title} — ` : ""}Kính gửi {clientName || "anh/chị"}, vui lòng điền giúp studio một số thông tin để chuẩn bị chu đáo.
      </p>

      {isPsc ? (
        <>
          <section className="card mt-6 p-5">
            <h2 className="font-serif text-lg font-medium">Phần 1 · Nhà gái (cô dâu)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Tên cô dâu</label>
                <input className={field} value={brideName} onChange={(e) => setBrideName(e.target.value)} placeholder="Họ và tên cô dâu" />
              </div>
              <div>
                <label className={lbl}>SĐT cô dâu</label>
                <input className={field} inputMode="tel" value={bridePhone} onChange={(e) => setBridePhone(e.target.value)} placeholder="09xxxxxxxx" />
              </div>
              <div>
                <label className={lbl}>Giờ makeup</label>
                <TimeInput className={field} value={brideMakeup} onChange={setBrideMakeup} />
              </div>
              <div>
                <label className={lbl}>Giờ làm lễ nhà gái</label>
                <TimeInput className={field} value={brideCeremony} onChange={setBrideCeremony} />
              </div>
            </div>
            <div className="mt-3">
              <label className={lbl}>Vị trí nhà gái</label>
              <LocationPicker token={token} value={brideLoc} onChange={setBrideLoc} />
            </div>
          </section>

          <section className="card mt-4 p-5">
            <h2 className="font-serif text-lg font-medium">Phần 2 · Nhà trai (chú rể)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Tên chú rể</label>
                <input className={field} value={groomName} onChange={(e) => setGroomName(e.target.value)} placeholder="Họ và tên chú rể" />
              </div>
              <div>
                <label className={lbl}>SĐT chú rể</label>
                <input className={field} inputMode="tel" value={groomPhone} onChange={(e) => setGroomPhone(e.target.value)} placeholder="09xxxxxxxx" />
              </div>
              <div>
                <label className={lbl}>Giờ nhà trai xuất phát</label>
                <TimeInput className={field} value={groomDepart} onChange={setGroomDepart} />
              </div>
              <div>
                <label className={lbl}>Giờ làm lễ nhà trai</label>
                <TimeInput className={field} value={groomCeremony} onChange={setGroomCeremony} />
              </div>
            </div>
            <div className="mt-3">
              <label className={lbl}>Vị trí nhà trai</label>
              <LocationPicker token={token} value={groomLoc} onChange={setGroomLoc} />
            </div>
          </section>

          <section className="card mt-4 p-5">
            <h2 className="font-serif text-lg font-medium">Phần 3 · Tiệc cưới / địa điểm khác</h2>
            <div className="mt-3">
              <label className={lbl}>Giờ đãi tiệc</label>
              <TimeInput className={field} value={receptionTime} onChange={setReceptionTime} />
            </div>
            <div className="mt-3">
              <label className={lbl}>Vị trí nơi đãi tiệc</label>
              <LocationPicker token={token} value={receptionLoc} onChange={setReceptionLoc} />
            </div>
          </section>
        </>
      ) : (
        <section className="card mt-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Tên người làm việc trực tiếp</label>
              <input className={field} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Người studio liên hệ tại buổi chụp" />
            </div>
            <div>
              <label className={lbl}>Số điện thoại liên hệ</label>
              <input className={field} inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="09xxxxxxxx" />
            </div>
          </div>
          <div className="mt-3">
            <label className={lbl}>Thời gian bắt đầu</label>
            <TimeInput className={field} value={startTime} onChange={setStartTime} />
          </div>
          <div className="mt-3">
            <label className={lbl}>Vị trí</label>
            <LocationPicker token={token} value={genLoc} onChange={setGenLoc} />
          </div>
        </section>
      )}

      <div className="card mt-4 p-5">
        <label className={lbl}>Ghi chú thêm cho studio (nếu có)</label>
        <textarea className={field} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yêu cầu riêng, lưu ý về địa điểm, giờ giấc…" />
      </div>

      {err && <p className="mt-3 text-sm" style={{ color: "var(--s-red)" }}>{err}</p>}

      <button onClick={submit} disabled={busy} className="btn-primary mt-4 w-full py-3">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {submitted ? "Cập nhật thông tin" : "Gửi thông tin cho studio"}
      </button>
      <p className="mt-2 text-center text-[11px] opacity-50">— {studio || "MStudo"} —</p>
    </div>
  );
}
