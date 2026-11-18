/* LƯU LƯỢNG — đếm egress Supabase (ước tính) + số liệu Vercel, cảnh báo trước
 * khi chạm hạn mức gói Free. Dự án từng bị khoá vì vượt egress, nên các con số
 * này phải đúng và các bộ đếm không bao giờ được làm hỏng request thật.
 *
 *   1. Luật thuần: ngày UTC, nhận diện request Supabase, bộ đếm, đọc FOCUS,
 *      tóm tắt tháng (dự báo cuối tháng, tỉ lệ so với trần).
 *   2. Bộ đếm phía máy chủ: đếm đúng byte, bỏ qua request không phải Supabase,
 *      xả đúng một lượt usage_add, không đổi trả lời cho người gọi.
 *   3. Postgres thật: usage_add cộng dồn + chặn số bẩn + chỉ service-role;
 *      script Vercel (đọc file) ghi đè, chạy lại không nhân đôi.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dungPostgres } from "./pg-tam.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `nhận ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`);

const R = await import("../../src/lib/luu-luong-rules.ts");

/* ── 1. Luật thuần ─────────────────────────────────────────────────────────── */
eq("ngày UTC", R.ngayUtc(Date.parse("2026-11-18T23:30:00+07:00")), "2026-11-18");
eq("tháng UTC", R.thangUtc(Date.parse("2026-12-01T03:00:00+07:00")), "2026-11");
ok("nhận ra request tới Supabase của app", R.laSupabase("https://abc.supabase.co/rest/v1/photos?x=1", "https://abc.supabase.co"));
ok("…không đếm Supabase của dự án khác / Google", !R.laSupabase("https://khac.supabase.co/rest/v1/x", "https://abc.supabase.co") && !R.laSupabase("https://lh3.googleusercontent.com/d/x", "https://abc.supabase.co"));
eq("độ dài theo header", R.doDaiTheoHeader(new Headers({ "content-length": "1234" })), 1234);
eq("…không có header → null", R.doDaiTheoHeader(new Headers()), null);
{
  const d = new R.BoDem();
  d.cong(100, 1, "2026-11-01");
  d.cong(50, 2, "2026-11-01");
  d.cong(7, 1, "2026-11-02");
  d.cong(-5, 1, "2026-11-02"); // số âm bị bỏ
  eq("bộ đếm cộng theo ngày", d.layRa(), [{ ngay: "2026-11-01", bytes: 150, requests: 3 }, { ngay: "2026-11-02", bytes: 7, requests: 1 }]);
  ok("…lấy ra xong thì về 0", d.rong());
  d.traLai([{ ngay: "2026-11-03", bytes: 9, requests: 1 }]);
  eq("…xả hỏng thì trả lại được", d.tong(), 9);
}
eq("số đếm trình duyệt hợp lệ", R.kiemSoDem({ bytes: 1000.4, requests: 3 }), { bytes: 1000, requests: 3 });
ok("…chặn số âm / quá lớn / rác / toàn 0", [{ bytes: -1, requests: 1 }, { bytes: 3 * 1024 ** 3, requests: 1 }, { bytes: "x" }, { bytes: 0, requests: 0 }, null].every((x) => R.kiemSoDem(x) === null));

const FOCUS = [
  JSON.stringify({ BilledCost: 0, ChargePeriodStart: "2026-11-02T00:00:00Z", ServiceName: "Fast Data Transfer", ConsumedQuantity: 1.5, ConsumedUnit: "GB" }),
  JSON.stringify({ BilledCost: 0, ChargePeriodStart: "2026-11-02T00:00:00Z", ServiceName: "Fast Data Transfer", ConsumedQuantity: 0.5, ConsumedUnit: "GB" }),
  "{ dòng hỏng",
  JSON.stringify({ BilledCost: 0.4, ChargePeriodStart: "2026-11-03T00:00:00Z", ServiceName: "Fast Origin Transfer", ConsumedQuantity: 9, ConsumedUnit: "GB" }),
  JSON.stringify({ BilledCost: 0, ChargePeriodStart: "2026-11-03T00:00:00Z", ServiceName: "Edge Requests", ConsumedQuantity: 12000, ConsumedUnit: "Requests" }),
  JSON.stringify({ ChargePeriodStart: "không phải ngày", ServiceName: "X", ConsumedQuantity: 1 }),
].join("\n");
{
  const f = R.docFocus(FOCUS);
  eq("đọc FOCUS: gộp theo ngày + dịch vụ, bỏ dòng hỏng", f.map((x) => [x.day, x.service, x.quantity, x.unit]), [
    ["2026-11-02", "Fast Data Transfer", 2, "GB"],
    ["2026-11-03", "Fast Origin Transfer", 9, "GB"],
    ["2026-11-03", "Edge Requests", 12000, "Requests"],
  ]);
  eq("đổi đơn vị byte", [R.doiRaByte(2, "GB"), R.doiRaByte(1, "MiB"), R.doiRaByte(1, "Requests")], [2e9, 1048576, null]);
}
{
  const now = Date.parse("2026-11-10T12:00:00Z"); // ngày 10 / 30 ngày
  const rows = [
    { day: "2026-11-01", source: "supabase-may-chu", metric: "egress", quantity: 1 * 1024 ** 3, unit: "byte", cost: null, requests: 10 },
    { day: "2026-11-05", source: "supabase-trinh-duyet", metric: "egress", quantity: 1 * 1024 ** 3, unit: "byte", cost: null, requests: 5 },
    { day: "2026-10-30", source: "supabase-may-chu", metric: "egress", quantity: 9 * 1024 ** 3, unit: "byte", cost: null, requests: 1 }, // tháng trước
    { day: "2026-11-03", source: "vercel", metric: "Fast Origin Transfer", quantity: 9, unit: "GB", cost: 0, requests: 0 },
    { day: "2026-11-03", source: "vercel", metric: "Edge Requests", quantity: 12000, unit: "Requests", cost: 0, requests: 0 },
  ];
  const t = R.tomTatThang(rows, "2026-11", now);
  eq("tháng này: chỉ cộng số của tháng này, tách máy chủ / trình duyệt", [t.supabase.bytes, t.supabase.mayChu, t.supabase.trinhDuyet], [2 * 1024 ** 3, 1024 ** 3, 1024 ** 3]);
  ok("dự báo cuối tháng theo tốc độ trung bình (2 GB sau 10 ngày → ~6 GB, vượt 5 GB)", Math.abs(t.supabase.duBao - 6 * 1024 ** 3) < 1 && t.supabase.tiLeDuBao > 1);
  const fot = t.vercel.find((v) => v.service === "Fast Origin Transfer");
  ok("Vercel Fast Origin Transfer có trần 10 GB, tỉ lệ đúng", fot && fot.tran === 10 * 1024 ** 3 && Math.abs(fot.tiLe - 9e9 / (10 * 1024 ** 3)) < 1e-9);
  ok("mục Vercel không có trần vẫn hiện, xếp sau", t.vercel[t.vercel.length - 1].service === "Edge Requests" && t.vercel[t.vercel.length - 1].tran === null);
  const loi = R.tomTatThang([{ day: "2026-11-10", source: "vercel", metric: "_loi", quantity: 0, unit: "HTTP 403", cost: null, requests: 0 }], "2026-11", now);
  ok("dòng lỗi Vercel → báo lý do, không thành một dịch vụ", loi.vercelLoi === "HTTP 403" && loi.vercel.length === 0);
}

/* ── 2. Bộ đếm phía máy chủ ───────────────────────────────────────────────── */
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "khoa-gia";
  const L = await import("../../src/lib/luu-luong.ts");
  const base = async (url) => {
    if (String(url).includes("/rest/v1/a")) return new Response("x".repeat(1000), { headers: { "content-length": "1000" } });
    if (String(url).includes("/rest/v1/b")) return new Response(new Blob(["y".repeat(500)]).stream()); // không có content-length
    return new Response("z".repeat(9999), { headers: { "content-length": "9999" } });
  };
  const f = L.demFetch(base);
  const r1 = await f("https://abc.supabase.co/rest/v1/a");
  const r2 = await f("https://abc.supabase.co/rest/v1/b");
  await f("https://www.googleapis.com/drive/v3/files"); // không phải Supabase → không đếm
  ok("người gọi vẫn đọc được trả lời nguyên vẹn", (await r1.text()).length === 1000 && (await r2.text()).length === 500);
  await new Promise((r) => setTimeout(r, 20)); // phần đo thân (không có header) chạy nền
  const goi = [];
  const fetchCu = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    goi.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  };
  await L.xa();
  globalThis.fetch = fetchCu;
  const rpc = goi.filter((g) => g.url.includes("/rpc/usage_add"));
  eq("xả đúng một lượt usage_add: 1.500 byte, 2 request, nguồn máy chủ", rpc.map((g) => [g.body.p_bytes, g.body.p_requests, g.body.p_source]), [[1500, 2, "supabase-may-chu"]]);
}

/* ── 3. Postgres thật ─────────────────────────────────────────────────────── */
const pg = dungPostgres({ port: "5464" });
if (!pg.ok) {
  console.log(`⏭  BỎ QUA phần Postgres: ${pg.lyDo}`);
} else {
  pg.newDb("ll");
  pg.runFile("ll", pg.supa("setup-all.sql"));
  pg.runFile("ll", pg.supa("migrations/luu_luong.sql")); // chạy lại an toàn
  const sv = (sql) => pg.asService("ll", sql);
  sv("select public.usage_add('2026-11-05','supabase-may-chu','egress',1000,3); select public.usage_add('2026-11-05','supabase-may-chu','egress',500,1);");
  eq("usage_add cộng dồn trong ngày", pg.q("ll", "select quantity::bigint || '/' || requests from public.system_usage where day='2026-11-05'"), "1500/4");
  sv("select public.usage_add('2026-11-05','vercel','egress',1,1); select public.usage_add('2026-11-05','supabase-may-chu','egress',-5,1); select public.usage_add('2026-11-05','supabase-may-chu','egress',99999999999,1);");
  eq("…chặn nguồn lạ, số âm, số quá lớn", pg.q("ll", "select count(*) || ':' || sum(quantity)::bigint from public.system_usage"), "1:1500");
  ok("anon / tài khoản thường KHÔNG gọi được usage_add", !pg.asUser("ll", "00000000-0000-4000-8000-000000000001", "select public.usage_add('2026-11-05','supabase-may-chu','egress',1,1);").ok);
  ok("…và KHÔNG đọc được bảng", !pg.asUser("ll", "00000000-0000-4000-8000-000000000001", "select count(*) from public.system_usage;").ok);

  // Script Vercel đọc file thay API, ghi qua psql bằng đúng chuỗi kết nối.
  const tam = mkdtempSync(join(tmpdir(), "mstudo-ll-"));
  const homNay = new Date().toISOString().slice(0, 7);
  const file = join(tam, "focus.jsonl");
  // Nhiều dòng như số liệu thật hai tháng (câu SQL dài hơn giới hạn dòng lệnh
  // của hệ điều hành — lần chạy thật đầu tiên hỏng đúng vì thế).
  const nhieu = [];
  for (let d = 1; d <= 28; d++)
    for (let k = 0; k < 120; k++)
      nhieu.push(JSON.stringify({ ChargePeriodStart: `${homNay}-${String(d).padStart(2, "0")}T00:00:00Z`, ServiceName: `Dịch vụ phụ ${k} — mô tả dài cho đủ độ dài thật của tên mục`, ConsumedQuantity: 0, ConsumedUnit: "Requests", BilledCost: 0 }));
  writeFileSync(
    file,
    [
      JSON.stringify({ ChargePeriodStart: `${homNay}-01T00:00:00Z`, ServiceName: "Fast Data Transfer", ConsumedQuantity: 2, ConsumedUnit: "GB", BilledCost: 0 }),
      JSON.stringify({ ChargePeriodStart: `${homNay}-01T00:00:00Z`, ServiceName: "Bob's Service", ConsumedQuantity: 1, ConsumedUnit: "GB-Hrs", BilledCost: 0.1 }),
      ...nhieu,
    ].join("\n"),
  );
  const chay = () =>
    spawnSync("node", ["--experimental-strip-types", join(ROOT, "scripts/do-luu-luong-vercel.mjs"), "--file", file], {
      env: { ...process.env, SUPABASE_DB_URL: pg.url("ll"), VERCEL_TOKEN: "" },
      encoding: "utf8",
    });
  const a = chay();
  ok("script Vercel ghi số liệu nhiều dòng (câu SQL rất dài, cả tên có dấu nháy)", a.status === 0 && pg.q("ll", "select count(*) from public.system_usage where source='vercel'") === String(2 + 28 * 120), (a.stdout || "") + (a.stderr || ""));
  chay();
  eq("…chạy lại thì GHI ĐÈ, không nhân đôi", pg.q("ll", "select count(*) || ':' || sum(quantity) from public.system_usage where source='vercel'"), `${2 + 28 * 120}:3`);
  const b = spawnSync("node", ["--experimental-strip-types", join(ROOT, "scripts/do-luu-luong-vercel.mjs")], { env: { ...process.env, SUPABASE_DB_URL: "", VERCEL_TOKEN: "" }, encoding: "utf8" });
  ok("thiếu secret → bỏ qua, thoát 0", b.status === 0 && /bỏ qua/.test(b.stdout));
  rmSync(tam, { recursive: true, force: true });
  pg.stop();
}

console.log(fail ? `\n${fail} lỗi` : "\nTẤT CẢ ĐẠT");
process.exit(fail ? 1 : 0);
