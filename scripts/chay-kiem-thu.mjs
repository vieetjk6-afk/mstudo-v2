#!/usr/bin/env node
/**
 * Chạy TẤT CẢ các bài kiểm thử `test:*` trong package.json — `npm test`.
 *
 * Vì sao cần. Repo có hơn trăm bài kiểm thử, mỗi bài một dòng script riêng, và
 * trước đây KHÔNG có gì chạy cả bộ: bài nào đỏ là chỉ người tình cờ chạy đúng
 * bài đó mới biết. Đã xảy ra thật: `main` mang một bài đỏ (công tắc tìm theo
 * khuôn mặt làm vỡ test:face-cong-goi) mà không ai hay cho tới lượt deploy sau.
 * Script này là thứ GitHub Actions gọi trước mỗi lần deploy và trên mỗi pull
 * request (.github/workflows/kiem-thu.yml).
 *
 * Cách dùng:
 *   npm test                         # chạy hết, vài bài cùng lúc
 *   npm test -- face                 # chỉ các bài có chữ "face" trong tên
 *   npm test -- --tuan-tu            # từng bài một (dễ đọc log khi lần lỗi)
 *   npm test -- --khong-bo-qua=sql-chay-that,rls-luu-nguoi
 *        # các bài này mà tự BỎ QUA (thiếu Postgres…) thì tính là HỎNG — dùng
 *        # trên CI, nơi chắc chắn có Postgres, để một bài "bỏ qua" không giả
 *        # làm bài "đạt".
 *
 * Mỗi bài chạy trong tiến trình riêng (đúng lệnh ghi ở package.json). Bài in
 * dòng "BỎ QUA" và thoát 0 được đếm riêng. Bài hỏng thì in 60 dòng cuối của nó.
 * Mã thoát ≠ 0 khi có bất kỳ bài nào hỏng.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const args = process.argv.slice(2);
const tuanTu = args.includes("--tuan-tu");
const batBuoc = new Set(
  (args.find((a) => a.startsWith("--khong-bo-qua="))?.split("=")[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const loc = args.filter((a) => !a.startsWith("--"));

const tatCa = Object.keys(pkg.scripts)
  .filter((k) => k.startsWith("test:"))
  .map((k) => k.slice(5));
const ten = tatCa.filter((t) => loc.length === 0 || loc.some((l) => t.includes(l)));
if (ten.length === 0) {
  console.error(`Không có bài nào khớp: ${loc.join(", ")}`);
  process.exit(1);
}
const thieu = [...batBuoc].filter((t) => !tatCa.includes(t));
if (thieu.length) {
  // Gõ sai tên ở --khong-bo-qua thì luật ấy lặng lẽ không áp cho bài nào.
  console.error(`--khong-bo-qua nhắc tới bài không tồn tại: ${thieu.join(", ")}`);
  process.exit(1);
}

/** Mỗi bài tối đa 10 phút — bài treo không được giữ cả lượt deploy. */
const HAN_MS = 10 * 60_000;

function chay(t) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const con = spawn("npm", ["run", "-s", `test:${t}`], { cwd: ROOT, env: process.env });
    let out = "";
    const gom = (d) => {
      out += d;
      if (out.length > 400_000) out = out.slice(-200_000);
    };
    con.stdout.on("data", gom);
    con.stderr.on("data", gom);
    const hen = setTimeout(() => {
      out += `\n[chay-kiem-thu] quá ${HAN_MS / 60_000} phút — dừng bài này.\n`;
      con.kill("SIGKILL");
    }, HAN_MS);
    con.on("close", (code) => {
      clearTimeout(hen);
      const boQua = code === 0 && /BỎ QUA/.test(out);
      resolve({ t, code, out, ms: Date.now() - t0, boQua, ok: code === 0 && !(boQua && batBuoc.has(t)) });
    });
  });
}

const soLuong = tuanTu ? 1 : Math.max(1, Math.min(4, cpus().length));
const hang = [...ten];
const kq = [];
const batDau = Date.now();

async function tho() {
  for (;;) {
    const t = hang.shift();
    if (!t) return;
    const r = await chay(t);
    kq.push(r);
    const giay = (r.ms / 1000).toFixed(1);
    if (!r.ok) console.log(`✗ ${t}  (${giay}s)${r.boQua ? "  — bài này KHÔNG được phép bỏ qua ở đây" : ""}`);
    else if (r.boQua) console.log(`⏭ ${t}  (bỏ qua)`);
    else console.log(`✓ ${t}  (${giay}s)`);
  }
}
await Promise.all(Array.from({ length: soLuong }, tho));

const hong = kq.filter((r) => !r.ok);
const boQua = kq.filter((r) => r.ok && r.boQua);
for (const r of hong) {
  console.log(`\n──────── ✗ test:${r.t} (mã thoát ${r.code}) ────────`);
  console.log(r.out.trimEnd().split("\n").slice(-60).join("\n"));
}
console.log(
  `\n${kq.length - hong.length - boQua.length} đạt · ${boQua.length} bỏ qua · ${hong.length} hỏng — ${((Date.now() - batDau) / 1000).toFixed(0)} giây` +
    (boQua.length ? `\nBỏ qua: ${boQua.map((r) => r.t).join(", ")}` : "") +
    (hong.length ? `\nHỎNG: ${hong.map((r) => r.t).join(", ")}` : ""),
);
process.exit(hong.length ? 1 : 0);
