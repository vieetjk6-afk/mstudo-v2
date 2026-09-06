import next from "eslint-config-next";

/**
 * ESLint 9 "flat config".
 *
 * `eslint-config-next@16` đã tự phát hành ở định dạng flat (nó gói sẵn
 * typescript-eslint, react-hooks, jsx-a11y…), nên nhập thẳng — KHÔNG bọc qua
 * FlatCompat. Bọc qua FlatCompat sẽ nổ "circular structure" vì nó cố đọc cấu
 * hình flat như cấu hình cũ.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".claude/**",
      "desktop/**",
      "scripts/**",
      "supabase/**",
      "public/**",
    ],
  },
  ...next,
  {
    // Luật của typescript-eslint chỉ áp cho file TS: ở flat config, rule phải
    // nằm trong khối áp cho ĐÚNG loại file mà plugin đó được nạp, nếu không
    // ESLint báo "could not find plugin".
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // `next/typescript` của Next 16 KHÔNG bật luật này nữa. Bật lại để giữ
      // đúng mức chặt như trước khi nâng — nếu không, mọi dòng
      // `/* eslint-disable @typescript-eslint/no-explicit-any */` rải trong repo
      // thành thừa và `any` lặng lẽ quay lại.
      "@typescript-eslint/no-explicit-any": "error",
      // Biến/tham số cố ý bỏ trống thì đặt tên mở đầu bằng "_" — cách nói rõ
      // "tôi biết nó không dùng" thay vì tắt cả luật.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    rules: {
      // TẮT CÓ CHỦ Ý — không phải vì lười.
      // next/image đòi khai trước hostname trong next.config (remotePatterns).
      // Nhưng phần lớn ảnh ở đây là URL do CHÍNH STUDIO dán vào: logo, ảnh bìa,
      // ảnh khối trang web, ảnh thiệp. Không thể biết trước hostname của hàng
      // trăm studio, nên next/image sẽ chặn ảnh của họ. Ảnh Drive thì đã đi qua
      // /api/img (tự resize + cache CDN), đúng việc mà next/image làm.
      "@next/next/no-img-element": "off",

      /*
       * BỘ LUẬT REACT COMPILER — TẮT CÓ CHỦ Ý, KHÔNG PHẢI VÌ NGẠI SỬA.
       *
       * eslint-plugin-react-hooks@7 (đi kèm Next 16) thêm một họ luật hoàn toàn
       * mới, kiểm tra code có "an toàn với React Compiler" không. Trên repo này
       * chúng báo 189 lỗi — nhưng KHÔNG phải 189 lỗi mới xuất hiện: code không
       * đổi một dòng nào, chỉ là thước đo đổi.
       *
       * Chúng bị tắt ở đây vì việc nâng Next phải LÀ việc nâng Next: trộn thêm
       * một đợt tái cấu trúc 189 chỗ vào cùng một nhánh thì không ai soi nổi
       * đâu là thay đổi của bản nâng, đâu là của đợt dọn.
       *
       * Đây là VIỆC CÒN NỢ, không phải việc đã xong. Bật lại từng luật một,
       * mỗi luật một nhánh riêng, khi nào thực sự định dùng React Compiler:
       *   refs · set-state-in-effect · static-components · purity ·
       *   immutability · use-memo
       *
       * Hai luật kinh điển `rules-of-hooks` và `exhaustive-deps` VẪN BẬT.
       */
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/use-memo": "off",
    },
  },
];

export default config;
