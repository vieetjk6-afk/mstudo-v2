"use client";

import { useState } from "react";
import type { ContractIntake, IntakeLocation } from "@/lib/types";
import { cleanIntakeLocation } from "@/lib/intake-text";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   TRẠNG THÁI + GỬI của form thông tin buổi chụp (/form/<token>) — dùng CHUNG
   cho bản cũ (IntakeForm) và giao diện mới (IntakeFormV2). Điền sẵn thông tin
   khách đã gửi trước đó; gửi lên /api/form/<token> đúng hình dạng cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type IntakeFormProps = {
  token: string;
  isWedding: boolean;
  clientName: string | null;
  title: string | null;
  studio: string | null;
  submitted: boolean;
  initial: ContractIntake | null;
};

export function useIntakeForm({ token, isWedding, submitted, initial }: IntakeFormProps) {
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

  return {
    isPsc, done, setDone, busy, err, setErr,
    brideName, setBrideName, bridePhone, setBridePhone, brideMakeup, setBrideMakeup, brideCeremony, setBrideCeremony, brideLoc, setBrideLoc,
    groomName, setGroomName, groomPhone, setGroomPhone, groomDepart, setGroomDepart, groomCeremony, setGroomCeremony, groomLoc, setGroomLoc,
    receptionTime, setReceptionTime, receptionLoc, setReceptionLoc,
    contactName, setContactName, contactPhone, setContactPhone, startTime, setStartTime, genLoc, setGenLoc,
    note, setNote,
    submit,
  };
}

export type IntakeFormState = ReturnType<typeof useIntakeForm>;
