"use client";

import TimeInput from "@/components/TimeInput";

import { Check, Loader2, Send, Pencil } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { useIntakeForm, type IntakeFormProps } from "./useIntakeForm";

/* Form thông tin buổi chụp — BẢN CŨ. Trạng thái và lời gọi máy chủ nằm ở
   ./useIntakeForm (dùng chung với ./IntakeFormV2); file này chỉ vẽ. */

export default function IntakeForm(props: IntakeFormProps) {
  const { token, clientName, title, studio, submitted } = props;
  const {
    isPsc, done, setDone, busy, err, setErr,
    brideName, setBrideName, bridePhone, setBridePhone, brideMakeup, setBrideMakeup, brideCeremony, setBrideCeremony, brideLoc, setBrideLoc,
    groomName, setGroomName, groomPhone, setGroomPhone, groomDepart, setGroomDepart, groomCeremony, setGroomCeremony, groomLoc, setGroomLoc,
    receptionTime, setReceptionTime, receptionLoc, setReceptionLoc,
    contactName, setContactName, contactPhone, setContactPhone, startTime, setStartTime, genLoc, setGenLoc,
    note, setNote,
    submit,
  } = useIntakeForm(props);

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
      <p className="mt-2 text-center text-[11px] opacity-50">— {studio || "Studio"} —</p>
    </div>
  );
}
