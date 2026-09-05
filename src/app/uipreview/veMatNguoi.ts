/**
 * VẼ "NGƯỜI" BẰNG HÌNH HỌC — chỉ dùng cho các màn xem trước.
 *
 * Bốn nhân dạng khác nhau về khoảng cách mắt, bề ngang mặt, độ dài mũi, bề rộng
 * miệng, tông da, kiểu tóc; mỗi người vài biến thể về nét mặt, nghiêng đầu, độ
 * sáng. Đủ để đường ống thật (MediaPipe tìm mặt → căn theo hai mắt → mạng 128
 * chiều) có cái để chạy mà không cần một tấm ảnh cưới thật nào trong repo.
 *
 * Đây KHÔNG phải mặt người thật. Kết quả chạy trên chúng là bằng chứng đường ống
 * đúng, KHÔNG phải thước đo độ chính xác trên ảnh thật — xem ghi chú dài ở
 * FaceGroupDemo.
 *
 * Tách ra file riêng vì hai màn dùng chung: FaceGroupDemo (gom cụm) và
 * FaceFinderDemo (khách tải ảnh mình lên để tìm).
 */
const W = 900;
const H = 900;

/** Hình học của một "người". */
type Identity = {
  name: string;
  skin: string;
  hair: string;
  /** Nửa khoảng cách hai mắt, px. */
  eyeGap: number;
  eyeR: number;
  faceW: number;
  faceH: number;
  noseLen: number;
  mouthW: number;
  browY: number;
};

const PEOPLE: Identity[] = [
  { name: "A", skin: "#e8bd93", hair: "#2b2118", eyeGap: 76, eyeR: 23, faceW: 195, faceH: 255, noseLen: 58, mouthW: 62, browY: 92 },
  { name: "B", skin: "#c98f61", hair: "#4a2f1c", eyeGap: 96, eyeR: 18, faceW: 225, faceH: 235, noseLen: 40, mouthW: 84, browY: 76 },
  { name: "C", skin: "#f2d3b3", hair: "#7a6a52", eyeGap: 62, eyeR: 27, faceW: 168, faceH: 285, noseLen: 76, mouthW: 48, browY: 108 },
  { name: "D", skin: "#8d5f3d", hair: "#12100e", eyeGap: 86, eyeR: 20, faceW: 210, faceH: 262, noseLen: 50, mouthW: 72, browY: 84 },
];

type Variant = { label: string; tilt: number; smile: number; light: number };
const VARIANTS: Variant[] = [
  { label: "thẳng", tilt: 0, smile: 0.4, light: 1 },
  { label: "nghiêng", tilt: -0.14, smile: 0, light: 1 },
  { label: "sáng+cười", tilt: 0.09, smile: 1, light: 1.22 },
];

function draw(p: Identity, v: Variant): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const cx = W / 2;
  const cy = H / 2;

  g.fillStyle = "#6d7b88";
  g.fillRect(0, 0, W, H);
  g.translate(cx, cy);
  g.rotate(v.tilt);
  g.translate(-cx, -cy);

  g.fillStyle = p.hair;
  g.beginPath();
  g.ellipse(cx, cy - 30, p.faceW + 55, p.faceH + 55, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = p.skin;
  g.fillRect(cx - 80, cy + p.faceH - 75, 160, 220);
  g.beginPath();
  g.ellipse(cx, cy, p.faceW, p.faceH, 0, 0, Math.PI * 2);
  g.fill();

  const sh = g.createRadialGradient(cx, cy, 60, cx, cy, p.faceH);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,.3)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx, cy, p.faceW, p.faceH, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "#3a2c20";
  g.lineWidth = 14;
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * (p.eyeGap - 36), cy - p.browY);
    g.quadraticCurveTo(cx + s * p.eyeGap, cy - p.browY - 18, cx + s * (p.eyeGap + 36), cy - p.browY + 4);
    g.stroke();
  }

  for (const s of [-1, 1]) {
    const ex = cx + s * p.eyeGap;
    const ey = cy - 34;
    g.fillStyle = "#fdfaf5";
    g.beginPath();
    g.ellipse(ex, ey, p.eyeR * 1.85, p.eyeR, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4a3a2a";
    g.beginPath();
    g.arc(ex, ey, p.eyeR * 0.82, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#100c08";
    g.beginPath();
    g.arc(ex, ey, p.eyeR * 0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#2c2119";
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(ex, ey, p.eyeR * 1.85, p.eyeR, 0, 0, Math.PI * 2);
    g.stroke();
  }

  g.strokeStyle = "rgba(90,60,40,.75)";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx - 4, cy - 12);
  g.lineTo(cx - 20, cy + p.noseLen);
  g.quadraticCurveTo(cx, cy + p.noseLen + 18, cx + 20, cy + p.noseLen);
  g.stroke();

  g.strokeStyle = "#8d4a45";
  g.lineWidth = 12;
  g.beginPath();
  const my = cy + p.noseLen + 64;
  g.moveTo(cx - p.mouthW, my);
  g.quadraticCurveTo(cx, my + 20 + v.smile * 30, cx + p.mouthW, my);
  g.stroke();

  g.setTransform(1, 0, 0, 1, 0, 0);
  if (v.light !== 1) {
    g.globalCompositeOperation = "lighter";
    g.fillStyle = `rgba(255,255,255,${(v.light - 1) * 0.9})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }
  return c.toDataURL("image/jpeg", 0.94);
}


export { draw, PEOPLE as IDENTITIES, VARIANTS };
export type { Identity, Variant };
