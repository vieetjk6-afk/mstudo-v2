"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Khung ẢNH PHÓNG TO ĐƯỢC của trang xem ảnh khách — chụm hai ngón, kéo, lăn
 * chuột, nhấp/chạm đúp, và vuốt ngang để sang ảnh khác.
 *
 * Vì sao phải tự viết thay vì để trình duyệt lo: khung xem ảnh là lớp phủ
 * `fixed inset-0`, muốn vuốt ngang đổi ảnh thì phải khoá cử chỉ mặc định
 * (`touch-action`) — mà khoá xong là mất luôn chụm-ngón phóng to của trình
 * duyệt. Nên đã khoá thì phải làm lại cho đủ bộ.
 *
 * Vì sao MỌI thứ chạy bằng ref + rAF chứ không state React: hai trang dùng
 * khung này (CustomerAlbum, GalleryView) render cả lưới hàng trăm thẻ <img>
 * trong CÙNG một component với khung xem. Đặt một `setState` trong pointermove
 * nghĩa là mỗi lần nhích ngón tay lại dựng lại từng ấy thẻ ảnh — đó chính là
 * cái giật khi kéo/phóng to. Ở đây cử chỉ ghi thẳng vào `style.transform` trong
 * một khung hình rAF; React chỉ được báo khi cử chỉ kết thúc (để bật/tắt nút
 * thu nhỏ).
 *
 * Cử chỉ bắt trên `stageRef` — cả vùng nền đen quanh ảnh — chứ không riêng thẻ
 * ảnh: ảnh dọc trên điện thoại chừa hai dải đen hai bên, đó lại đúng chỗ ngón
 * cái quẹt.
 */

export type PhotoZoomHandle = {
  /** Nhân mức phóng với `k` (1.5 = phóng to, 1/1.5 = thu nhỏ), lấy tâm ảnh. */
  zoomBy: (k: number) => void;
  /** Về mức 1 và bỏ dịch chuyển. */
  reset: () => void;
};

type Props = {
  /** Vùng nền quanh ảnh — nơi bắt cử chỉ. */
  stageRef: React.RefObject<HTMLElement | null>;
  /** Vuốt ngang khi CHƯA phóng to: 1 = ảnh sau, -1 = ảnh trước. */
  onSwipe?: (dir: 1 | -1) => void;
  /** Báo mức phóng — chỉ gọi khi kết thúc cử chỉ hoặc khi vượt/về mức 1. */
  onZoomChange?: (scale: number) => void;
  className?: string;
  maxScale?: number;
  children: React.ReactNode;
};

/** Quãng vuốt tối thiểu để tính là đổi ảnh (px). */
const SWIPE_MIN = 50;
/** Nhích quá ngần này mới tính là đã di chuyển (px) — dưới mức đó là một cú chạm. */
const SLOP = 8;
/** Mức phóng khi chạm/nhấp đúp. */
const TAP_ZOOM = 2.5;
/** Hai lần chạm cách nhau dưới ngần này (ms) là chạm đúp. */
const DOUBLE_TAP_MS = 300;
const TRANSITION = "transform .18s ease";

const PhotoZoom = forwardRef<PhotoZoomHandle, Props>(function PhotoZoom(
  { stageRef, onSwipe, onZoomChange, className, maxScale = 5, children },
  ref
) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Hàm cha truyền vào thường là arrow function mới mỗi lần render. Giữ qua ref
  // để effect KHÔNG phải gắn lại listener theo mỗi lần render của cha — gắn lại
  // giữa chừng là mất luôn cử chỉ đang dở.
  const cb = useRef({ onSwipe, onZoomChange });
  cb.current = { onSwipe, onZoomChange };

  // Cầu nối cho ref của cha: effect nạp hàm thật vào đây khi gắn xong listener.
  const handle = useRef<PhotoZoomHandle>({ zoomBy: () => {}, reset: () => {} });
  useImperativeHandle(ref, () => ({
    zoomBy: (k: number) => handle.current.zoomBy(k),
    reset: () => handle.current.reset(),
  }), []);

  // Toàn bộ trạng thái cử chỉ nằm trong ref: đổi giá trị ở đây KHÔNG render lại.
  const g = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
    // Tâm hình học của khung khi chưa dịch chuyển (toạ độ màn hình). Thu phóng
    // quanh tâm không làm tâm chạy, nên tâm hiện tại = tâm này + dịch chuyển.
    cx: 0,
    cy: 0,
    // Cỡ khung (chưa thu phóng) và cỡ vùng nền — đo MỘT LẦN mỗi cử chỉ, để
    // không vừa đọc layout vừa ghi transform trong cùng một khung hình.
    bw: 0,
    bh: 0,
    sw: 0,
    sh: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    pinch: 0,
    midX: 0,
    midY: 0,
    panning: false,
    swiping: false,
    horizontal: false,
    moved: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    swipeDx: 0,
    lastTap: 0,
    lastTouch: 0,
    raf: 0,
    notified: 1,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const box = boxRef.current;
    if (!stage || !box) return;
    const s = g.current;

    // Cử chỉ do mình lo hết → cấm trình duyệt cuộn/chụm trên vùng này. Khung xem
    // ảnh là lớp phủ toàn màn hình nên phía sau chẳng có gì để cuộn.
    const prevTouch = stage.style.touchAction;
    stage.style.touchAction = "none";

    const draw = () => {
      if (s.raf) return;
      s.raf = requestAnimationFrame(() => {
        s.raf = 0;
        box.style.transform = `translate3d(${s.tx + s.swipeDx}px, ${s.ty}px, 0) scale(${s.scale})`;
        box.style.cursor = s.scale > 1 ? (s.panning ? "grabbing" : "grab") : "zoom-in";
      });
    };

    /** Đo lại tâm khung + cỡ khung & nền. Gọi khi BẮT ĐẦU một cử chỉ. */
    const measure = () => {
      const r = box.getBoundingClientRect();
      s.cx = r.left + r.width / 2 - s.tx - s.swipeDx;
      s.cy = r.top + r.height / 2 - s.ty;
      s.bw = box.offsetWidth;
      s.bh = box.offsetHeight;
      const sr = stage.getBoundingClientRect();
      s.sw = sr.width;
      s.sh = sr.height;
    };

    /** Không cho kéo ảnh ra khỏi vùng nhìn: hết mép là dừng. */
    const clampPan = () => {
      const mx = Math.max(0, (s.bw * s.scale - s.sw) / 2);
      const my = Math.max(0, (s.bh * s.scale - s.sh) / 2);
      s.tx = Math.min(mx, Math.max(-mx, s.tx));
      s.ty = Math.min(my, Math.max(-my, s.ty));
    };

    const notify = (force = false) => {
      const wasZoomed = s.notified > 1.001;
      const isZoomed = s.scale > 1.001;
      if (force || wasZoomed !== isZoomed) {
        s.notified = s.scale;
        cb.current.onZoomChange?.(s.scale);
      }
    };

    /** Thu phóng quanh một điểm trên màn hình — điểm đó đứng yên dưới ngón tay. */
    const zoomAt = (k: number, fx: number, fy: number) => {
      const next = Math.min(maxScale, Math.max(1, s.scale * k));
      const kk = next / s.scale;
      if (Math.abs(kk - 1) < 0.0001) return;
      s.tx += (fx - (s.cx + s.tx)) * (1 - kk);
      s.ty += (fy - (s.cy + s.ty)) * (1 - kk);
      s.scale = next;
      if (next <= 1.001) {
        s.scale = 1;
        s.tx = 0;
        s.ty = 0;
      }
      clampPan();
      draw();
      notify();
    };

    /** Bật/tắt phóng to tại một điểm (chạm đúp, nhấp đúp). */
    const toggleZoomAt = (fx: number, fy: number) => {
      box.style.transition = TRANSITION;
      measure();
      zoomAt(s.scale > 1 ? 1 / s.scale : TAP_ZOOM, fx, fy);
      notify(true);
    };

    handle.current = {
      zoomBy: (k: number) => {
        box.style.transition = TRANSITION;
        measure();
        zoomAt(k, s.cx + s.tx, s.cy + s.ty);
        notify(true);
      },
      reset: () => {
        box.style.transition = TRANSITION;
        s.scale = 1;
        s.tx = 0;
        s.ty = 0;
        s.swipeDx = 0;
        draw();
        notify(true);
      },
    };

    /** Nút bấm / link / video: để chúng nhận thao tác, đừng nuốt làm cử chỉ. */
    const isControl = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("button, a, iframe, input, textarea, label, select");

    const onDown = (e: PointerEvent) => {
      if (isControl(e.target)) return;
      if (s.pointers.size === 0) measure();
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* trình duyệt từ chối bắt con trỏ — cử chỉ vẫn chạy, chỉ kém mượt ở mép */
      }
      box.style.transition = "none";
      if (s.pointers.size === 1) {
        s.startX = e.clientX;
        s.startY = e.clientY;
        s.panX = s.tx;
        s.panY = s.ty;
        s.panning = s.scale > 1;
        s.swiping = !s.panning;
        s.horizontal = false;
        s.moved = false;
      } else if (s.pointers.size === 2) {
        // Sang chụm hai ngón: bỏ dở việc vuốt đổi ảnh.
        s.swiping = false;
        s.panning = false;
        s.swipeDx = 0;
        s.moved = true;
        const [a, b] = [...s.pointers.values()];
        s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        s.midX = (a.x + b.x) / 2;
        s.midY = (a.y + b.y) / 2;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!s.pointers.has(e.pointerId)) return;
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (s.pointers.size >= 2) {
        const [a, b] = [...s.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (s.pinch > 0) {
          // Hai ngón vừa phóng vừa kéo: dời theo trung điểm rồi thu phóng quanh
          // chính trung điểm đó.
          s.tx += mx - s.midX;
          s.ty += my - s.midY;
          zoomAt(d / s.pinch, mx, my);
        }
        s.pinch = d;
        s.midX = mx;
        s.midY = my;
        return;
      }

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.moved && Math.hypot(dx, dy) >= SLOP) {
        s.moved = true;
        s.horizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!s.moved) return;
      if (s.panning) {
        s.tx = s.panX + dx;
        s.ty = s.panY + dy;
        clampPan();
        draw();
      } else if (s.swiping && s.horizontal) {
        s.swipeDx = dx;
        draw();
      }
    };

    const endGesture = (e: PointerEvent) => {
      if (!s.pointers.delete(e.pointerId)) return;
      if (s.pointers.size < 2) s.pinch = 0;

      if (s.pointers.size === 1) {
        // Nhấc một ngón khi đang chụm: ngón còn lại chuyển sang kéo ảnh.
        const [p] = [...s.pointers.values()];
        measure();
        s.startX = p.x;
        s.startY = p.y;
        s.panX = s.tx;
        s.panY = s.ty;
        s.panning = s.scale > 1;
        s.swiping = !s.panning;
        s.moved = true;
        return;
      }
      if (s.pointers.size > 0) return;

      box.style.transition = TRANSITION;
      const swiped = s.swiping && s.moved && s.horizontal ? s.swipeDx : 0;
      const tapped = !s.moved;
      s.swipeDx = 0;
      s.panning = false;
      s.swiping = false;
      s.moved = false;
      draw();

      if (e.pointerType !== "mouse") s.lastTouch = Date.now();

      if (swiped <= -SWIPE_MIN) cb.current.onSwipe?.(1);
      else if (swiped >= SWIPE_MIN) cb.current.onSwipe?.(-1);
      else if (tapped && e.pointerType !== "mouse") {
        // Chạm đúp trên cảm ứng (chuột đã có sự kiện dblclick riêng).
        const now = Date.now();
        if (now - s.lastTap < DOUBLE_TAP_MS) {
          s.lastTap = 0;
          toggleZoomAt(e.clientX, e.clientY);
          return;
        }
        s.lastTap = now;
      }
      notify(true);
    };

    const onDouble = (e: MouseEvent) => {
      if (isControl(e.target)) return;
      // Chạm đúp trên cảm ứng đã được xử lý ở endGesture, NHƯNG trình duyệt còn
      // dựng thêm một `dblclick` giả từ chính cú chạm đó — để nguyên là phóng
      // to rồi thu nhỏ ngay, hoá ra bấm đúp không ăn thua.
      if (Date.now() - s.lastTouch < 800) return;
      toggleZoomAt(e.clientX, e.clientY);
    };

    // Lăn chuột / chụm trên bàn di: phải là listener THƯỜNG (không passive) mới
    // chặn được cuộn trang; onWheel của React luôn passive nên không dùng được.
    const onWheel = (e: WheelEvent) => {
      if (isControl(e.target)) return;
      e.preventDefault();
      box.style.transition = "none";
      measure();
      // Bàn di gửi ctrlKey khi chụm hai ngón — bước nhỏ cho mượt; con lăn chuột
      // nhảy nấc lớn nên đi theo dấu của deltaY.
      zoomAt(e.ctrlKey ? Math.exp(-e.deltaY / 100) : e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
      notify(true);
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", endGesture);
    stage.addEventListener("pointercancel", endGesture);
    stage.addEventListener("dblclick", onDouble);
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", endGesture);
      stage.removeEventListener("pointercancel", endGesture);
      stage.removeEventListener("dblclick", onDouble);
      stage.removeEventListener("wheel", onWheel);
      stage.style.touchAction = prevTouch;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.pointers.clear();
    };
  }, [stageRef, maxScale]);

  return (
    <div
      ref={boxRef}
      className={className}
      style={{
        transform: "translate3d(0,0,0) scale(1)",
        transformOrigin: "center",
        transition: TRANSITION,
        cursor: "zoom-in",
        willChange: "transform",
        touchAction: "none",
      }}
    >
      {children}
    </div>
  );
});

export default PhotoZoom;
