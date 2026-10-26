"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { matchesVapidKey, urlBase64ToUint8Array } from "@/lib/vapid-key";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

type State = "unsupported" | "default" | "denied" | "subscribed" | "loading" | "ios-install";

// iOS (iPhone/iPad). iPadOS reports as MacIntel with touch points.
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// True when the app was opened from the Home Screen icon (PWA standalone).
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Reject if a promise doesn't settle in time, so the UI never hangs on "loading".
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Hết thời gian: ${label}`)), ms)),
  ]);
}

/** Đăng ký này có dùng đúng khoá VAPID hiện tại của máy chủ không? Xem
 * `@/lib/vapid-key` — `null` nghĩa là không kết luận được, cứ để nguyên. */
function usesCurrentVapidKey(sub: PushSubscription): boolean | null {
  return matchesVapidKey(sub.options?.applicationServerKey, VAPID_PUBLIC);
}

/**
 * Đăng ký nhận thông báo trên máy này rồi lưu lên máy chủ.
 *
 * Huỷ đăng ký cũ trước là BẮT BUỘC, không phải dọn dẹp cho sạch: gọi
 * `subscribe()` với `applicationServerKey` khác trong khi vẫn còn đăng ký cũ sẽ
 * ném `InvalidStateError`. Xoá luôn dòng cũ ở máy chủ để bảng đăng ký không
 * đọng lại endpoint đã chết.
 */
async function subscribeAndSave(reg: ServiceWorkerRegistration): Promise<void> {
  const old = await reg.pushManager.getSubscription();
  if (old) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: old.endpoint }),
    }).catch(() => {});
    await old.unsubscribe().catch(() => {});
  }

  const sub = await withTimeout(
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    }),
    15000,
    "đăng ký nhận thông báo"
  );

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub }),
  });
  if (!res.ok) throw new Error("Lưu đăng ký thất bại");
}

type TestResult = {
  ok: boolean;
  reason: string;
  hint: string;
  devices: number;
  sent?: number;
  results?: { service: string; ok: boolean; statusCode?: number; pruned?: boolean }[];
};

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // On iPhone/iPad, Web Push works ONLY when the app is opened from the Home
    // Screen icon (standalone). In a Safari tab the Push API is hidden entirely,
    // so detect this first and give precise instructions instead of "unsupported".
    if (isIOS() && !isStandalone()) { setState("ios-install"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }

    // Hard safety net: never let the UI sit on "loading" — if the check below
    // doesn't settle quickly, fall back to an actionable state.
    let settled = false;
    const fallback = setTimeout(() => {
      if (!settled) setState((s) => (s === "loading" ? "default" : s));
    }, 5000);
    const done = (s: State) => { settled = true; clearTimeout(fallback); setState(s); };

    // Check whether this device is already subscribed.
    // Use getRegistration() instead of .ready so we don't hang if no SW is registered yet.
    withTimeout(navigator.serviceWorker.getRegistration("/sw.js"), 4000, "kiểm tra service worker")
      .then(async (reg) => {
        if (!reg) { done("default"); return; }
        const sub = await reg.pushManager.getSubscription();
        if (!sub) { done("default"); return; }

        // Máy chủ đã đổi cặp khoá VAPID ⇒ đăng ký này đã chết. Tự đăng ký lại
        // ngay, không phiền người dùng: quyền thông báo đã được cấp từ trước nên
        // subscribe() không cần thao tác bấm nào. Thất bại thì lùi về "chưa bật"
        // để họ tự bấm, chứ không để nút báo "đang bật" dối.
        if (usesCurrentVapidKey(sub) === false) {
          try {
            await subscribeAndSave(reg);
            done("subscribed");
          } catch {
            done("default");
          }
          return;
        }

        done("subscribed");
      })
      .catch(() => done("default"));

    return () => clearTimeout(fallback);
  }, []);

  async function enable() {
    setErr(null);
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }

      const reg = await withTimeout(navigator.serviceWorker.register("/sw.js"), 10000, "đăng ký service worker");
      await withTimeout(navigator.serviceWorker.ready, 10000, "kích hoạt service worker");

      await subscribeAndSave(reg);

      setState("subscribed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không bật được thông báo");
      setState("default");
    }
  }

  /**
   * Gửi thử một thông báo thật tới chính máy này.
   *
   * Nút này tồn tại vì "không nhận được thông báo" là lời than KHÔNG CHẨN ĐOÁN
   * ĐƯỢC: máy chủ thiếu khoá, đăng ký hết hạn, hay hệ điều hành chặn — cả ba
   * đều im lặng như nhau. Bấm một cái là biết mình đang ở trường hợp nào.
   */
  async function sendTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTest((await res.json()) as TestResult);
    } catch {
      setTest({ ok: false, reason: "network", hint: "Không gọi được máy chủ. Kiểm tra kết nối mạng rồi thử lại.", devices: 0 });
    } finally {
      setTesting(false);
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await withTimeout(
        navigator.serviceWorker.getRegistration("/sw.js"),
        10000,
        "lấy service worker"
      );
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tắt được thông báo");
      setState("subscribed");
    }
  }

  if (state === "ios-install") {
    return (
      <div className="card p-4 text-sm" style={{ color: "var(--text2)" }}>
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Bell size={18} style={{ color: "var(--text2)" }} />
          Bật thông báo trên iPhone
        </div>
        <p className="mb-2 text-xs" style={{ color: "var(--text3)" }}>
          iPhone chỉ cho phép thông báo đẩy khi mở từ icon ngoài màn hình chính (cần iOS 16.4 trở lên):
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-xs" style={{ color: "var(--text2)" }}>
          <li>Mở trang này trong <b>Safari</b>, bấm nút Chia sẻ (ô vuông có mũi tên ↑).</li>
          <li>Chọn <b>“Thêm vào MH chính” / “Add to Home Screen”</b>.</li>
          <li><b>Đóng Safari</b>, mở app mstudo từ <b>icon ngoài màn hình chính</b>.</li>
          <li>Vào lại trang Thông báo và bấm <b>“Bật thông báo”</b>.</li>
        </ol>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="card flex items-center gap-3 p-4 text-sm" style={{ color: "var(--text3)" }}>
        <BellOff size={18} />
        Thiết bị/trình duyệt này chưa hỗ trợ thông báo đẩy. Trên iPhone, hãy &quot;Tạo Webapp&quot; (thêm ra màn hình chính) trước.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="card flex items-center gap-3 p-4 text-sm" style={{ color: "var(--text2)" }}>
        <BellOff size={18} style={{ color: "var(--danger)" }} />
        Bạn đã chặn thông báo. Vào cài đặt trình duyệt/điện thoại để bật lại quyền cho mstudo.
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      {state === "subscribed" ? (
        <BellRing size={20} style={{ color: "var(--accent)" }} />
      ) : (
        <Bell size={20} style={{ color: "var(--text2)" }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {state === "subscribed" ? "Thông báo đẩy đang bật" : "Bật thông báo đẩy"}
        </p>
        <p className="text-xs" style={{ color: "var(--text3)" }}>
          {state === "subscribed"
            ? "Bạn sẽ nhận thông báo trên thiết bị này khi có đặt lịch / hợp đồng mới."
            : "Nhận thông báo trên điện thoại kể cả khi không mở app."}
        </p>
        {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
      {state === "subscribed" ? (
        <>
          <button onClick={sendTest} disabled={testing} className="btn-ghost flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs">
            <Send size={13} /> {testing ? "Đang gửi…" : "Gửi thử"}
          </button>
          <button onClick={disable} className="btn-ghost shrink-0 px-3 py-2 text-xs">Tắt</button>
        </>
      ) : (
        <button onClick={enable} disabled={state === "loading"} className="btn-primary shrink-0 px-3 py-2 text-xs">
          {state === "loading" ? "Đang xử lý…" : "Bật thông báo"}
        </button>
      )}

      {test && (
        <div
          className="w-full rounded-[10px] px-3 py-2.5 text-xs"
          style={{
            background: test.ok ? "var(--gnS)" : "var(--amS)",
            color: test.ok ? "var(--gn)" : "var(--am)",
          }}
        >
          <p className="font-semibold">
            {test.ok
              ? `Đã gửi tới ${test.sent}/${test.devices} thiết bị`
              : test.reason === "vapid_missing"
                ? "Máy chủ chưa cấu hình thông báo đẩy"
                : test.reason === "no_subscription"
                  ? "Thiết bị này chưa đăng ký"
                  : "Gửi không thành công"}
          </p>
          <p className="mt-0.5" style={{ color: "var(--text2)" }}>{test.hint}</p>
          {/* Mã lỗi của từng dịch vụ push — thứ duy nhất phân biệt được "khoá
              sai" với "máy đã gỡ đăng ký" khi cần hỏi kỹ thuật. */}
          {test.results && test.results.length > 0 && (
            <ul className="mt-1.5 space-y-0.5" style={{ color: "var(--text2)" }}>
              {test.results.map((r, i) => (
                <li key={i}>
                  {r.ok ? "✓" : "✗"} {r.service}
                  {!r.ok && r.statusCode ? ` — lỗi ${r.statusCode}` : ""}
                  {r.pruned ? " (đăng ký đã hết hạn, vừa gỡ)" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
