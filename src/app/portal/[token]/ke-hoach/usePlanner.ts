"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/studio/Toast";
import { forgetDevice, readPhone, rememberPhone } from "@/lib/portal-device";
import { matchGuestRsvps } from "@/lib/wedding-guests";
import { applyPlanOp, planErrorText, type GuestReply, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import type { PlannerTab, SaveState } from "./ui";
import type { PlannerOpResponse, PlannerPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của trang kế hoạch cưới — bản cũ (WeddingPlanner +
   PlannerView) và bản giao diện mới (WeddingPlannerV2 + PlannerViewV2) gọi
   CÙNG các hook ở đây: cổng SĐT, hàng đợi lưu từng thao tác, trình sửa thiệp
   nhúng (#thiep), khớp phản hồi qua thiệp, xuất Excel. Chỉ phần vẽ là khác.

   Lưu: mỗi thao tác hiện NGAY (áp `applyPlanOp` lên bản máy chủ), rồi gửi lên
   lần lượt từng cái một. Gửi song song thì phản hồi về lệch thứ tự và bản cũ
   đè lên bản mới. Mỗi phản hồi là bản máy chủ mới nhất; các thao tác còn chờ
   được áp lại lên trên nó — nên hai máy cùng sửa vẫn thấy việc của nhau.
   ═══════════════════════════════════════════════════════════════════════════ */

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

export function useWeddingPlanner(token: string) {
  const [phone, setPhone] = useState("");
  const [unlocked, setUnlocked] = useState("");
  const [data, setData] = useState<PlannerPayload | null>(null);
  const [plan, setPlan] = useState<WeddingPlanData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoTrying, setAutoTrying] = useState(() => !!readPhone(token));
  const [saving, setSaving] = useState<SaveState>("idle");
  const { toast, toastNode } = useToast();
  const [view, setView] = useState<"plan" | "invite">("plan");
  const [returnTab, setReturnTab] = useState<PlannerTab>("overview");

  /** Bản máy chủ mới nhất + các thao tác chưa lưu xong (theo thứ tự). */
  const server = useRef<WeddingPlanData | null>(null);
  const queue = useRef<PlanOp[]>([]);
  const busy = useRef(false);
  /** Tab kế hoạch đang mở — quay về từ thiệp thì về đúng tab đó. */
  const tabNow = useRef<PlannerTab>("overview");
  /** Trình sửa thiệp còn thay đổi chưa lưu. */
  const editorDirty = useRef(false);
  /** Mục "#thiep" trong lịch sử trình duyệt do chính trang này thêm vào. */
  const pushed = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

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
        // Mở bằng link "…/ke-hoach#thiep" → vào thẳng thiệp.
        if (j.combo && j.invite && window.location.hash === "#thiep") setView("invite");
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

  /** Về kế hoạch: tải lại để thấy thiệp vừa xuất bản, phản hồi mới (trừ khi còn thao tác chưa lưu). */
  const toPlan = useCallback(() => {
    setView("plan");
    window.scrollTo(0, 0);
    if (!busy.current && !queue.current.length && unlockedRef.current) void open(unlockedRef.current, false);
  }, [open]);

  const openInvite = useCallback(() => {
    if (window.location.hash !== "#thiep") {
      window.history.pushState(null, "", "#thiep");
      pushed.current = true;
    }
    setView("invite");
    window.scrollTo(0, 0);
  }, []);

  /** Rời thiệp (trình sửa đã hỏi lại nếu còn thay đổi chưa lưu). */
  const closeInvite = useCallback((tab?: PlannerTab) => {
    setReturnTab(tab ?? tabNow.current);
    editorDirty.current = false;
    if (pushed.current) {
      // Lùi đúng một mục lịch sử — popstate bên dưới đưa về kế hoạch.
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    toPlan();
  }, [toPlan]);

  // Nút quay lại / tiến tới của trình duyệt.
  useEffect(() => {
    const onPop = () => {
      const wantInvite = window.location.hash === "#thiep";
      if (wantInvite) {
        if (viewRef.current !== "invite") setView("invite");
        return;
      }
      if (viewRef.current !== "invite") return;
      if (editorDirty.current && !window.confirm("Thiệp còn thay đổi chưa lưu. Rời đi và bỏ các thay đổi đó?")) {
        window.history.pushState(null, "", "#thiep");
        pushed.current = true;
        return;
      }
      pushed.current = false;
      editorDirty.current = false;
      toPlan();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [toPlan]);

  const onEditorDirty = useCallback((d: boolean) => { editorDirty.current = d; }, []);

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

  return {
    phone, setPhone, data, plan, err, loading, autoTrying, saving, toast, toastNode, view, returnTab,
    unlock, onOp, openInvite, closeInvite, onEditorDirty,
    /** Báo tab kế hoạch đang mở (quay về từ thiệp thì về đúng tab đó). */
    setTab: (t: PlannerTab) => { tabNow.current = t; },
  };
}

/**
 * Phản hồi qua thiệp → khách trong danh sách, khớp theo tên (bỏ dấu, hoa /
 * thường). Tính lại mỗi lần danh sách đổi, để khách vừa thêm cũng khớp ngay.
 * Chế độ Quà cưới: máy chủ đã ghi phản hồi vào danh sách — không phủ thêm.
 */
export function usePlannerReplies(data: PlannerPayload, plan: WeddingPlanData) {
  return useMemo(() => {
    const r: Record<string, GuestReply> = {};
    if (data.combo || !data.invite?.replies.length) return { replies: r, unmatched: [] };
    const m = matchGuestRsvps(plan.guests.map((g) => g.name), data.invite.replies.map((x) => ({ ...x, wish: null })));
    for (const s of m.guests) if (s.rsvp) r[plan.guests[s.index].id] = { attending: s.rsvp.attending, num_guests: s.rsvp.num_guests };
    return { replies: r, unmatched: m.others };
  }, [plan.guests, data.invite, data.combo]);
}

/**
 * Tải cả kế hoạch về một file Excel (mỗi phần một sheet) — khách giữ một bản,
 * in ra, gửi bố mẹ. Dựng ngay trong trình duyệt từ đúng dữ liệu đang hiện, kể
 * cả thao tác chưa lưu xong; bộ ghi Excel chỉ nạp lúc bấm.
 */
export function usePlanExport({
  data, plan, today, replies,
}: { data: PlannerPayload; plan: WeddingPlanData; today: string; replies: Record<string, GuestReply> }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { downloadPlanXlsx } = await import("@/lib/wedding-plan-export");
      await downloadPlanXlsx({
        plan,
        couple: data.contract.client_name || data.contract.title,
        studio: { name: data.studio_name, phone: data.studio_phone },
        auto: data.auto,
        studioLine: data.studio_line,
        studioDay: data.studio_day,
        replies,
        today,
        ext: data.ext,
      });
    } catch {
      window.alert("Chưa tạo được file Excel — bạn thử lại sau giây lát nhé.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
