/* Bắt lỗi "Cannot access 'X' before initialization" (TDZ) trong route máy chủ.
 *
 * Vì sao có bài này: /api/c/[token] gọi SỚM một hàm khai báo kiểu
 * `function loadPortalData() {…}` (để chạy song song), rồi một lượt sửa thêm
 * vào trong hàm đó một biến `const` khai báo PHÍA DƯỚI chỗ gọi. tsc, eslint,
 * build đều qua; lên production thì mọi lượt khách mở hợp đồng ném 500.
 *
 * Luật: trong cùng một khối, nếu hàm khai báo `f` được GỌI TRỰC TIẾP (không
 * nằm trong callback chạy sau) ở vị trí P, thì thân `f` không được đọc biến
 * const/let của khối đó khai báo SAU P. Đọc AST bằng TypeScript, không chạy code.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(import.meta.dirname, "../..");
const ts = createRequire(import.meta.url)(join(ROOT, "node_modules/typescript"));

const files = [];
const walkDir = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walkDir(p);
    else if (/\.(ts|tsx)$/.test(n)) files.push(p);
  }
};
walkDir(join(ROOT, "src/app/api"));
walkDir(join(ROOT, "src/lib"));

const isFnLike = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const problems = [];
for (const f of files) {
  const src = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true,
    f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const line = (pos) => src.getLineAndCharacterOfPosition(pos).line + 1;

  const visitBlock = (block) => {
    const stmts = block.statements || [];
    const decl = new Map(); // tên const/let của khối → vị trí khai báo
    for (const s of stmts) {
      if (!ts.isVariableStatement(s) || !(s.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))) continue;
      for (const d of s.declarationList.declarations) {
        const add = (n) => {
          if (ts.isIdentifier(n)) decl.set(n.text, s.getStart());
          else n.elements?.forEach((e) => e.name && add(e.name));
        };
        add(d.name);
      }
    }
    for (const s of stmts) {
      if (!ts.isFunctionDeclaration(s) || !s.name || !s.body) continue;
      const name = s.name.text;
      // Lời gọi TRỰC TIẾP đầu tiên (bỏ qua lời gọi nằm trong hàm/callback khác).
      let first = Infinity;
      const find = (n, nested) => {
        if (n === s) return;
        if (!nested && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) {
          first = Math.min(first, n.getStart());
        }
        ts.forEachChild(n, (c) => find(c, nested || isFnLike(n)));
      };
      stmts.forEach((st) => find(st, false));
      if (first === Infinity) continue;
      // Tên tự khai trong thân hàm (tham số, biến cục bộ) che biến bên ngoài.
      const local = new Set();
      const collectLocal = (n) => {
        if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) local.add(n.name.text);
        ts.forEachChild(n, collectLocal);
      };
      s.parameters.forEach(collectLocal);
      collectLocal(s.body);
      const used = new Set();
      const walk = (n) => {
        // Bỏ tên thuộc tính (obj.x, { x: … }) — không phải đọc biến.
        if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
            && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) used.add(n.text);
        ts.forEachChild(n, walk);
      };
      walk(s.body);
      for (const u of used) {
        const p = decl.get(u);
        if (p !== undefined && p > first && !local.has(u)) {
          problems.push(`${f.slice(ROOT.length + 1)}: ${name}() gọi ở dòng ${line(first)} nhưng đọc '${u}' khai báo ở dòng ${line(p)}`);
        }
      }
    }
    ts.forEachChild(block, function rec(n) { if (n.statements) visitBlock(n); else ts.forEachChild(n, rec); });
  };
  visitBlock(src);
}

if (problems.length) {
  console.log("✗ Hàm được gọi trước khi biến nó dùng được khai báo (lỗi TDZ lúc chạy):");
  for (const p of problems) console.log("   " + p);
  process.exit(1);
}
console.log(`✓ ${files.length} file route/lib: không hàm nào gọi sớm đọc biến khai báo sau\n\nTất cả đạt.`);
