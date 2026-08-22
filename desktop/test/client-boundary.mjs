/* Kiểm thử RANH GIỚI SERVER ↔ CLIENT của App Router.
 *
 * Vì sao đáng test: đây là code SAI ÂM THẦM và không công cụ nào bắt được.
 * Next biến MỌI export của một file `"use client"` thành "client reference".
 * Import một COMPONENT từ đó về server component là đúng — nó chỉ được render
 * ở trình duyệt. Nhưng import một HÀM hay một HẰNG rồi dùng ở server thì:
 *
 *   • hàm  → nổ lúc chạy: "readTab is not a function" (500 trắng màn),
 *   • hằng → không nổ, chỉ trả về một object rỗng — sai âm thầm, tệ hơn.
 *
 * `tsc --noEmit` xanh (kiểu vẫn khớp), `next build` xanh (route động không được
 * dựng sẵn nên không ai gọi hàm đó lúc build). Lỗi chỉ lộ khi người dùng bấm
 * vào — đúng như lần gộp ba màn lịch: page.tsx gọi readTab() nhập từ
 * CalendarTabs.tsx ("use client") và cả màn Lịch làm việc chết trên production.
 *
 * Cách phân biệt component với giá trị thường: theo quy ước đặt tên của React.
 *   PascalCase  → component, hợp lệ (Panel, EmptyState, CalendarTabs…)
 *   camelCase   → hàm/biến, CẤM
 *   TÊN_HẰNG    → hằng, CẤM
 * Import kiểu (`import { type X }` / `import type { X }`) luôn hợp lệ: kiểu bị
 * xoá lúc biên dịch nên không còn gì để gọi.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "../../src");

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got, null, 2)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Quét cây nguồn ──────────────────────────────────────────────────────── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** File có chỉ thị "use client" ở đầu (bỏ qua comment và dòng trống phía trước). */
const isClient = (f) => /^\s*(?:\/\*[\s\S]*?\*\/|\/\/.*\n|\s)*["']use client["']/.test(source.get(f) ?? "");

/** Đưa một đặc tả import về đường dẫn file thật, hoặc null nếu ngoài src/. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // gói npm
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (source.has(cand)) return cand;
  }
  return null;
}

const IMPORT_RE = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
const violations = [];

for (const file of files) {
  if (isClient(file)) continue; // file client gọi nhau thoải mái
  const text = source.get(file);
  for (const [, clause, spec] of text.matchAll(IMPORT_RE)) {
    if (/^\s*type\s/.test(clause)) continue; // import type { … }
    const target = resolveImport(spec, file);
    if (!target || !isClient(target)) continue;

    const braces = clause.match(/\{([\s\S]*)\}/);
    if (!braces) continue; // chỉ import mặc định → chắc chắn là component
    for (const raw of braces[1].split(",")) {
      const part = raw.trim();
      if (!part || /^type\s/.test(part)) continue;
      const name = part.split(/\s+as\s+/)[0].trim();
      if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) continue; // PascalCase → component
      violations.push(`${file.slice(SRC.length + 1)} nhập { ${name} } từ "${spec}" (file "use client")`);
    }
  }
}

check("không server component nào nhập hàm/hằng từ file \"use client\"", violations, []);

/* ── Chốt riêng cho màn Lịch làm việc — nơi lỗi này từng xảy ra ──────────── */
const calendarPage = join(SRC, "app/dashboard/studio/calendar/page.tsx");
check("page.tsx của màn lịch không \"use client\"", isClient(calendarPage), false);
check("readTab nhập từ ./tabs (module thường), không phải ./CalendarTabs",
  /import\s*\{[^}]*\breadTab\b[^}]*\}\s*from\s*["']\.\/tabs["']/.test(source.get(calendarPage)), true);
check("./tabs.ts không \"use client\"", isClient(join(SRC, "app/dashboard/studio/calendar/tabs.ts")), false);

/* ── Luật đọc ?tab= ──────────────────────────────────────────────────────── */
const { readTab, tabHref, CALENDAR_TABS } = await import("../../src/app/dashboard/studio/calendar/tabs.ts");
check("ba tab đúng thứ tự", [...CALENDAR_TABS], ["shoot", "studio", "team"]);
check("?tab=studio", readTab("studio"), "studio");
check("?tab=team", readTab("team"), "team");
check("thiếu ?tab= → tab buổi chụp", readTab(undefined), "shoot");
check("?tab= giá trị lạ → tab buổi chụp, không màn trắng", readTab("khong-co-that"), "shoot");
check("?tab=studio&tab=team (mảng) → lấy giá trị đầu", readTab(["studio", "team"]), "studio");
check("tab mặc định để URL sạch", tabHref("shoot"), "/dashboard/studio/calendar");
check("tab khác đeo ?tab=", tabHref("team"), "/dashboard/studio/calendar?tab=team");

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
