"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Trạng thái + thao tác của nút "Gửi Zalo" — dùng chung cho bản cũ
   (ZaloSendButton) và bản giao diện mới (ZaloSendButtonV2). Xem ghi chú đầu
   ZaloSendButton.tsx về ba cách xác định người nhận và việc nhớ người nhận. */

const ERROR_VI: Record<string, string> = {
  not_connected: "Chưa kết nối Zalo. Vào Tin nhắn → kết nối trước.",
  no_personal_session: "Phiên Zalo hết hạn — kết nối lại ở trang Tin nhắn.",
  not_personal: "Chọn bạn Zalo chỉ dùng cho kênh tài khoản cá nhân.",
  recipient_not_found: "Không tìm thấy Zalo của số này. Thử 'Chọn bạn Zalo' nếu đã kết bạn.",
  missing_recipient: "Thiếu người nhận.",
  personal_needs_body: "Thiếu nội dung tin.",
  zca_js_not_installed: "Máy chủ chưa bật gửi Zalo — liên hệ hỗ trợ.",
  list_failed: "Không tải được danh sách bạn Zalo.",
};
const mapErr = (e: string) => ERROR_VI[e] || e || "Lỗi";

// Báo cho các nút khác của CÙNG hợp đồng/album khi người nhận vừa được nhớ/quên
// (vd bảng "Gửi khách" có nút gửi và nút chọn bạn là hai phiên bản riêng).
const REMEMBER_EVENT = "mstudo:zalo-remembered";
type RememberDetail = { contractId: string | null; albumId: string | null; name: string };

// Cache danh sách bạn bè ở cấp module → nhiều nút không phải tải lại.
let _friendsCache: Array<{ uid: string; name: string; avatar: string }> | null = null;
function cacheFriends(list: Array<{ uid: string; name: string; avatar: string }>) {
  _friendsCache = list;
  return list;
}

export type ZaloSendProps = {
  phone?: string | null;
  name?: string | null;
  message: string;
  /** Ảnh gửi kèm tin (mã QR thanh toán). Máy chủ chỉ nhận ảnh từ máy chủ VietQR. */
  imageUrl?: string | null;
  label?: string;
  audience?: "client" | "crew";
  contractId?: string | null;
  kind?: string;
  askPhone?: boolean;
  className?: string;
  /** Lớp cho nút "chọn bạn Zalo". Mặc định theo `className` để hai nút cùng
   *  hình khối; truyền riêng khi nút gửi dùng lớp giãn hết chiều ngang. */
  friendsBtnClass?: string;
  /** Hiện nút nào. Mặc định "both" (gửi theo SĐT + nút chọn bạn cạnh nhau).
   *  Dùng "send" / "friends" khi hai cách gửi phải nằm ở hai dòng riêng —
   *  ví dụ bảng chọn "Gửi khách" liệt kê từng cách một dòng. */
  show?: "both" | "send" | "friends";
  /** Nhãn cạnh icon của nút chọn bạn. Bỏ trống = chỉ hiện icon (mặc định cũ). */
  friendsLabel?: string;
  /** Lớp cho khung ngoài. Mặc định giãn hết hàng; truyền "w-auto" khi nút phải
   *  đứng chung hàng với các nút khác (vd hàng thao tác của đợt thanh toán). */
  wrapClassName?: string;
  /** Tên bạn Zalo đã nhớ cho hợp đồng/album này (cột zalo_name). Chỉ có nghĩa
   *  với audience="client" kèm contractId/albumId. */
  savedName?: string | null;
  /** Album đang gửi — để máy chủ nhớ người nhận cho album (kể cả album lẻ). */
  albumId?: string | null;
};

export function useZaloSend({
  phone,
  name,
  message,
  imageUrl,
  label = "Gửi Zalo",
  audience,
  contractId,
  kind = "manual",
  askPhone = false,
  className: classNameProp,
  friendsBtnClass,
  show = "both",
  friendsLabel,
  wrapClassName = "w-full",
  savedName,
  albumId,
}: ZaloSendProps, defaultClass: string) {
  const className = classNameProp ?? defaultClass;

  const [state, setState] = useState<null | "sending" | "ok" | "fail">(null);
  const [err, setErr] = useState("");
  // Tin gửi được nhưng thiếu ảnh đính kèm (mã QR) — im lặng thì studio đinh
  // ninh khách đã có mã, nên phải nói ra.
  const [imgWarn, setImgWarn] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  // Người nhận đã nhớ theo lần gửi gần nhất: undefined = chưa biết (dùng
  // savedName từ trang), "" = máy chủ báo không còn nhớ ai, chuỗi = tên.
  const [memName, setMemName] = useState<string | undefined>(undefined);
  // Gợi ý hiện trong bảng chọn bạn khi gửi theo SĐT không tìm thấy.
  const [pickHint, setPickHint] = useState("");
  // Picker bạn bè
  const [pickOpen, setPickOpen] = useState(false);
  const [friends, setFriends] = useState<Array<{ uid: string; name: string; avatar: string }>>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsErr, setFriendsErr] = useState("");
  const [q, setQ] = useState("");
  // Popover rộng 260px: neo cứng trái hay phải đều tràn khỏi màn hình điện
  // thoại tùy nút nằm đâu trong hàng (hàng nút wrap nên vị trí không đoán
  // được). Đo rồi kẹp vào trong viewport — main của shell clip trục ngang nên
  // phần tràn sẽ bị cắt mất, không cuộn tới được.
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popLeft, setPopLeft] = useState(0);

  useLayoutEffect(() => {
    if (!pickOpen) return;
    const place = () => {
      const wrap = wrapRef.current;
      const pop = popRef.current;
      if (!wrap || !pop) return;
      const pad = 12;
      const { left: wrapLeft } = wrap.getBoundingClientRect();
      const maxLeft = window.innerWidth - pad - pop.offsetWidth;
      // Mặc định thẳng mép trái của nút, rồi kẹp cả hai đầu.
      setPopLeft(Math.max(pad, Math.min(wrapLeft, maxLeft)) - wrapLeft);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pickOpen]);

  const canRemember = audience === "client" && !!(contractId || albumId);
  const remembered = canRemember ? ((memName ?? savedName ?? "").trim() || null) : null;
  const shortName = remembered && remembered.length > 22 ? remembered.slice(0, 21) + "…" : remembered;
  const mainLabel = !shortName ? label : label === "Gửi Zalo" ? `Gửi Zalo cho ${shortName}` : `${label} · ${shortName}`;

  useEffect(() => {
    if (!canRemember) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<RememberDetail>).detail;
      if (!d) return;
      if ((contractId && d.contractId === contractId) || (albumId && d.albumId === albumId)) setMemName(d.name);
    };
    window.addEventListener(REMEMBER_EVENT, on);
    return () => window.removeEventListener(REMEMBER_EVENT, on);
  }, [canRemember, contractId, albumId]);

  function remember(name: string) {
    setMemName(name);
    window.dispatchEvent(
      new CustomEvent<RememberDetail>(REMEMBER_EVENT, {
        detail: { contractId: contractId ?? null, albumId: albumId ?? null, name },
      })
    );
  }

  const fixed = (phone || "").trim();
  const inputMode = !fixed && askPhone;
  // Nút chọn bạn mặc định mang cùng lớp với nút gửi để hai cái cao bằng nhau.
  // Với lớp .act-btn (giãn 100% trên điện thoại) thì phải kèm .act-btn-auto,
  // không thì nút icon cũng chiếm cả hàng.
  const friendsClass =
    friendsBtnClass ??
    (className.includes("act-btn") ? "act-btn act-btn-auto" : className);

  async function doSend(payload: { toPhone?: string; toUid?: string; toName?: string | null }) {
    setState("sending");
    setErr("");
    setImgWarn("");
    try {
      const res = await fetch("/api/studio/zalo/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          body: message,
          imageUrl: imageUrl ?? null,
          audience,
          contractId,
          albumId: albumId ?? null,
          kind,
        }),
      }).then((x) => x.json());
      if (res.ok) {
        setState("ok");
        setPickHint("");
        if (canRemember && typeof res.saved === "boolean") {
          remember(res.saved ? String(res.name || payload.toName || "").trim() || "bạn Zalo" : "");
        }
        if (res.imageError) setImgWarn("Đã gửi nhưng KHÔNG kèm được ảnh QR — khách bấm link QR trong tin.");
        setTimeout(() => setState(null), 2500);
      } else if (res.error === "recipient_not_found" && !payload.toUid) {
        // Không tìm được theo SĐT (khách tắt tìm-bằng-SĐT / số không đăng ký
        // Zalo) → mở luôn danh sách bạn để chọn, máy chủ sẽ nhớ cho lần sau.
        setState(null);
        if (canRemember) remember("");
        setPickHint("Không tìm thấy qua SĐT — chọn bạn Zalo để lưu cho lần sau");
        if (!pickOpen) void togglePicker();
      } else {
        setState("fail");
        setErr(mapErr(res.error));
      }
    } catch {
      setState("fail");
      setErr("Lỗi mạng, thử lại.");
    }
  }

  function sendByPhone() {
    const to = fixed || manualPhone.trim();
    // Đã nhớ người nhận → không cần SĐT, máy chủ gửi thẳng theo uid đã lưu.
    if (!to && remembered) {
      doSend({ toName: remembered });
      return;
    }
    if (!to) {
      setState("fail");
      setErr("Nhập số điện thoại trước.");
      return;
    }
    doSend({ toPhone: to, toName: name ?? null });
  }

  async function togglePicker() {
    const next = !pickOpen;
    setPickOpen(next);
    if (!next) setPickHint("");
    if (next && !_friendsCache && !loadingFriends) {
      setLoadingFriends(true);
      setFriendsErr("");
      try {
        const r = await fetch("/api/studio/zalo/friends", { cache: "no-store" }).then((x) => x.json());
        if (r.ok) {
          setFriends(cacheFriends(r.friends || []));
        } else setFriendsErr(mapErr(r.error));
      } catch {
        setFriendsErr("Lỗi mạng, thử lại.");
      }
      setLoadingFriends(false);
    } else if (next && _friendsCache) {
      setFriends(_friendsCache);
    }
  }

  function pickFriend(f: { uid: string; name: string }) {
    setPickOpen(false);
    setPickHint("");
    setQ("");
    doSend({ toUid: f.uid, toName: f.name });
  }

  const shown = q.trim()
    ? friends.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
    : friends;

  return {
    state, err, imgWarn, manualPhone, setManualPhone, pickHint, pickOpen, friends, loadingFriends, friendsErr, q, setQ,
    wrapRef, popRef, popLeft, remembered, mainLabel, inputMode, friendsClass, sendByPhone, togglePicker, pickFriend, shown,
    label, className, show, friendsLabel, wrapClassName,
  };
}
