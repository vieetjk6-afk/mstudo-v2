"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/studio/Toast";
import { fmtDate } from "@/lib/date";
import type { ContractCrew, ContractIntake } from "@/lib/types";
import type { CrewRoleRow } from "@/lib/crew-roles";
import { intakeSections, type IntakeSection, type IntakeSectionKey } from "@/lib/intake-text";

/* Logic màn "Thông tin buổi chụp" — dùng chung cho bản cũ (SessionInfoView) và
   giao diện mới (SessionInfoViewV2). File riêng để hai bản cùng nhập mà không
   vòng import qua lớp bọc chọn bản. */

export type SessionCrewRow = Pick<ContractCrew, "id" | "name" | "phone" | "role" | "side" | "event_id">;

export type SessionInfoProps = {
  contract: {
    id: string;
    title: string;
    clientName: string;
    eventDate: string | null;
    eventTime: string | null;
    location: string | null;
    intake: ContractIntake | null;
    submittedAt: string | null;
  };
  formUrl: string | null;
  crew: SessionCrewRow[];
  studioName: string;
  /** Vai trò thợ studio tự đặt — để ra đúng tên vai trò. */
  crewRoles?: CrewRoleRow[];
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function useSessionInfo(contract: SessionInfoProps["contract"]) {
  const { toast, toastNode } = useToast();
  const sections = useMemo(() => intakeSections(contract.intake), [contract.intake]);
  const date = contract.eventDate ? fmtDate(contract.eventDate) : null;
  // Web Share chỉ có trên trình duyệt (chủ yếu điện thoại) — dò sau khi mount
  // để bản vẽ server và client khớp nhau.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy(text: string, what = "Đã chép") {
    toast((await copyText(text)) ? what : "Không chép được — hãy chọn chữ và chép tay");
  }
  async function share(text: string) {
    try {
      await navigator.share({ text });
    } catch {
      /* người dùng đóng bảng chia sẻ */
    }
  }

  return { toast, toastNode, sections, date, canShare, copy, share };
}

/** Một người nhận: các phần đang chọn + tin nhắn ghép từ đúng các phần đó. */
export function useSendRow(sections: IntakeSection[], initialKeys: IntakeSectionKey[], buildMessage: (keys: IntakeSectionKey[]) => string) {
  const [keys, setKeys] = useState<IntakeSectionKey[]>(initialKeys);
  // Giữ thứ tự hiển thị của các phần, không theo thứ tự bấm.
  const picked = sections.map((s) => s.key).filter((k) => keys.includes(k));
  const message = buildMessage(picked);
  const toggle = (k: IntakeSectionKey) => setKeys((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  return { keys, picked, message, toggle };
}
