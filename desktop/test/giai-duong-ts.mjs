/* Cho phép kiểm thử Node nhập những file src/ có `import "./mo-dun"` KHÔNG đuôi.
 *
 * Quy ước sẵn có của repo là: thư viện nào muốn test bằng Node thì đừng nhập gì
 * cả (face-people.ts, face-group.ts, photo-ai.ts đều thế). Quy ước đó vỡ ngay khi
 * một thư viện phải DÙNG LẠI thư viện khác — face-node.ts cần `laplacianVariance`
 * của photo-ai.ts, và chép lại 40 dòng đo nét thành hai bản là cách chắc chắn để
 * hai bản trôi khỏi nhau.
 *
 * Webpack/TS phân giải `./photo-ai` sang `./photo-ai.ts` sẵn; Node ESM thì không.
 * Móc dưới đây vá đúng khoảng cách đó, chỉ cho đường dẫn TƯƠNG ĐỐI (gói npm giữ
 * nguyên cách phân giải chuẩn).
 *
 * Dùng: node --experimental-strip-types --import ./desktop/test/giai-duong-ts.mjs …
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Bí danh `@/` của tsconfig (`@/*` → `src/*`) — Node không biết, nên đổi nó
// thành đường dẫn tuyệt đối rồi phân giải như đường dẫn tương đối.
const SRC = new URL("../../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      specifier = new URL(specifier.slice(2), SRC).href;
    }
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        const base = new URL(specifier, context.parentURL);
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          const cand = new URL(base.href + ext);
          if (existsSync(fileURLToPath(cand))) return { url: cand.href, shortCircuit: true };
        }
      } catch {
        /* để Node báo lỗi như thường */
      }
    }
    return nextResolve(specifier, context);
  },
});
