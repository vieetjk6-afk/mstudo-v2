#!/usr/bin/env node
/**
 * ĐO LƯU LƯỢNG VERCEL — workflow GitHub "Đo lưu lượng" chạy mỗi ngày.
 *
 * Đọc chi phí / lượng dùng theo ngày từ API của Vercel (định dạng FOCUS v1.3,
 * mỗi dòng một JSON — GET /v1/billing/charges) cho tháng này và tháng trước,
 * gộp theo ngày + dịch vụ, rồi GHI ĐÈ vào bảng system_usage (source 'vercel')
 * để trang Sức khoẻ hệ thống so với hạn mức gói Hobby (Fast Data Transfer
 * 100 GB, Fast Origin Transfer 10 GB…).
 *
 * Cần: VERCEL_TOKEN, VERCEL_ORG_ID (đã có cho deploy), SUPABASE_DB_URL, psql.
 * Thiếu thì báo bỏ qua và thoát 0. Đọc API hỏng (vd tài khoản cá nhân không có
 * quyền) → ghi một dòng metric '_loi' kèm lý do để trang Sức khoẻ nói ra, thoát 0.
 *
 *   node --experimental-strip-types scripts/do-luu-luong-vercel.mjs
 *   node --experimental-strip-types scripts/do-luu-luong-vercel.mjs --file mau.jsonl   # đọc file thay API (kiểm thử)
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { docFocus, ngayUtc } from "../src/lib/luu-luong-rules.ts";
import { pgEnv, tachUrl } from "./pg-url.mjs";

const args = process.argv.slice(2);
const iFile = args.indexOf("--file");
const FILE = iFile >= 0 ? args[iFile + 1] : null;
const TOKEN = (process.env.VERCEL_TOKEN || "").trim();
const TEAM = (process.env.VERCEL_ORG_ID || "").trim();
const DB = (process.env.SUPABASE_DB_URL || "").trim();

if (!DB) {
  console.log("⏭  Chưa có SUPABASE_DB_URL — bỏ qua.");
  process.exit(0);
}
if (!FILE && !TOKEN) {
  console.log("⏭  Chưa có VERCEL_TOKEN — bỏ qua.");
  process.exit(0);
}
const ket = tachUrl(DB);
if (!ket) {
  console.error("✗ SUPABASE_DB_URL không đúng dạng.");
  process.exit(1);
}
const env = pgEnv(ket, "mstudo-luu-luong");
const che = (s) => (ket.password ? String(s).split(ket.password).join("***") : String(s));

function psql(sql) {
  const r = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-1", "-c", sql], { env, encoding: "utf8", timeout: 60_000 });
  if (r.error?.code === "ENOENT") {
    console.error("✗ Không có lệnh psql.");
    process.exit(1);
  }
  return { ok: r.status === 0, err: che(r.stderr || "") };
}
const lit = (v) => (v == null ? "null" : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "0") : `'${String(v).replace(/'/g, "''")}'`);

// Tháng trước + tháng này, tới hết hôm nay (to là mốc LOẠI TRỪ).
const now = new Date();
const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
const fromDay = from.toISOString().slice(0, 10);

async function docApi() {
  const q = (team) =>
    `https://api.vercel.com/v1/billing/charges?${new URLSearchParams({ ...(team ? { teamId: team } : {}), from: from.toISOString(), to: to.toISOString() })}`;
  let lastErr = "";
  // Có teamId trước; tài khoản cá nhân thì thử không kèm teamId.
  for (const team of TEAM ? [TEAM, ""] : [""]) {
    try {
      const r = await fetch(q(team), { headers: { Authorization: `Bearer ${TOKEN}`, "Accept-Encoding": "gzip" } });
      if (r.ok) return { ok: true, text: await r.text() };
      lastErr = `HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`;
    } catch (e) {
      lastErr = String(e?.message || e).slice(0, 160);
    }
  }
  return { ok: false, err: lastErr };
}

const nguon = FILE ? { ok: true, text: readFileSync(FILE, "utf8") } : await docApi();
if (!nguon.ok) {
  console.log(`⚠ Không đọc được số liệu Vercel: ${nguon.err}`);
  const r = psql(
    `insert into public.system_usage (day, source, metric, quantity, unit) values (${lit(ngayUtc())}, 'vercel', '_loi', 0, ${lit(nguon.err.slice(0, 200))}) ` +
      `on conflict (day, source, metric) do update set unit = excluded.unit, updated_at = now();`,
  );
  if (!r.ok) console.log(`⚠ Không ghi được dòng lỗi: ${r.err.trim().split("\n").pop()}`);
  process.exit(0);
}

const rows = docFocus(nguon.text);
const values = rows
  .map((x) => `(${lit(x.day)}, 'vercel', ${lit(x.service.slice(0, 120))}, ${lit(x.quantity)}, ${lit(x.unit)}, ${lit(x.cost)})`)
  .join(",\n");
// Ghi ĐÈ cả khoảng đã đọc trong MỘT transaction (psql -1): số Vercel của một
// ngày còn được cập nhật thêm vài giờ sau, nên lần đọc sau thay lần đọc trước.
const sql =
  `delete from public.system_usage where source = 'vercel' and day >= ${lit(fromDay)};\n` +
  (values ? `insert into public.system_usage (day, source, metric, quantity, unit, cost) values\n${values};` : "");
const r = psql(sql);
if (!r.ok) {
  console.error(`✗ Ghi số liệu hỏng:\n${r.err.trim().split("\n").slice(-4).join("\n")}`);
  process.exit(1);
}
console.log(`✓ Đã ghi ${rows.length} dòng số liệu Vercel (${fromDay} → hôm nay).`);
