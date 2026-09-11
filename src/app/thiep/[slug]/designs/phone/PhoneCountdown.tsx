"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Parts = { d: string; h: string; m: string; s: string };

const ZERO: Parts = { d: "00", h: "00", m: "00", s: "00" };
const two = (n: number) => String(n).padStart(2, "0");

function diff(target: number): Parts {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return { d: two(Math.floor(s / 86400)), h: two(Math.floor((s % 86400) / 3600)), m: two(Math.floor((s % 3600) / 60)), s: two(s % 60) };
}

/**
 * Đếm ngược 4 ô (ngày · giờ · phút · giây) dùng chung cho 10 mẫu thiệp điện
 * thoại. Mỗi mẫu truyền style riêng nên hình thức khác nhau hoàn toàn mà logic
 * chỉ viết một lần. Chưa nhập ngày cưới thì hiện 00 để bố cục không sụp.
 */
export default function PhoneCountdown({
  date, labels = ["Ngày", "Giờ", "Phút", "Giây"], wrap, box, boxes, num, lab,
}: {
  date?: string;
  labels?: [string, string, string, string];
  wrap?: CSSProperties;
  box?: CSSProperties;
  /** Style riêng cho từng ô (mẫu scrapbook xoay lệch mỗi ô một kiểu). */
  boxes?: CSSProperties[];
  num?: CSSProperties;
  lab?: CSSProperties;
}) {
  const target = date ? new Date(date).getTime() : NaN;
  const [parts, setParts] = useState<Parts>(ZERO);

  useEffect(() => {
    if (Number.isNaN(target)) { setParts(ZERO); return; }
    setParts(diff(target));
    const id = setInterval(() => setParts(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const values = [parts.d, parts.h, parts.m, parts.s];

  return (
    <div style={wrap}>
      {values.map((v, i) => (
        <div key={i} style={{ ...box, ...(boxes?.[i] ?? {}) }}>
          <div style={num}>{v}</div>
          <div style={lab}>{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}
