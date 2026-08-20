/* Kiểm thử luật TÁCH THƯ MỤC CON của album (src/lib/album-subfolders.ts).
 *
 * Gốc lỗi đang vá: dán link thư mục giao khách mà thư mục đó CHỈ CHỨA THƯ MỤC
 * CON thì album không ra ảnh nào, và cũng không đẻ ra tab thư mục con.
 *
 * Hai nguyên nhân:
 *  1. Bước tách chỉ chạy cho nguồn có `kind === "folder"`. Mà `kind` do
 *     isFolderLink() ĐOÁN từ dạng URL lúc lưu, chỉ khớp ".../folders/…" —
 *     studio dán link "open?id=…" là nguồn thành "file" và bị bỏ qua hoàn toàn,
 *     dù nó là thư mục thật. Thư mục cha không có ảnh trực tiếp ⇒ trống trơn.
 *  2. Chỉ tách MỘT tầng mỗi lần đồng bộ. Thư mục giao khách hay là
 *     "File ChinhSua / Ngày 1 / Sáng" nên phải bấm đồng bộ nhiều lần mới đủ.
 *
 * Nạp thẳng code thật; listSubFolders được thay bằng cây thư mục giả.
 */
import { planSubFolderSources, folderIdForExpand } from "../../src/lib/album-subfolders.ts";
import { extractFolderId } from "../../src/lib/drive.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const FOLDER = (id) => `https://drive.google.com/drive/folders/${id}`;
const src = (o) => ({ id: o.id, drive_url: o.url, kind: o.kind ?? "folder", stage: o.stage ?? "selection", position: o.position ?? 0 });
// Cây thư mục giả: id cha → danh sách thư mục con.
const tree = (map) => async (fid) => map[fid] ?? [];
const names = (rows) => rows.map((r) => r.name);

// ── 1. Link /folders/ có thư mục con → mỗi thư mục con một nguồn ───────────
{
  const { rows } = await planSubFolderSources("alb", [src({ id: "s1", url: FOLDER("P"), stage: "delivery" })],
    tree({ P: [{ id: "A", name: "Ngày 1" }, { id: "B", name: "Ngày 2" }] }));
  check("thư mục cha có 2 thư mục con → tạo 2 nguồn", names(rows), ["Ngày 1", "Ngày 2"]);
  check("thư mục con kế thừa giai đoạn của cha", rows.map((r) => r.stage), ["delivery", "delivery"]);
  check("thư mục con luôn lưu kind = folder", rows.map((r) => r.kind), ["folder", "folder"]);
  check("link thư mục con dựng đúng dạng /folders/", rows[0].drive_url, FOLDER("A"));
}

// ── 2. GỐC LỖI: link thư mục nhưng bị lưu kind "file" ──────────────────────
{
  const openLink = "https://drive.google.com/open?id=P";
  const { rows, fixKindIds } = await planSubFolderSources("alb",
    [src({ id: "s1", url: openLink, kind: "file", stage: "delivery" })],
    tree({ P: [{ id: "A", name: "Ngày 1" }] }));
  check("link 'open?id=' lưu nhầm kind file VẪN được tách (lỗi vừa vá)", names(rows), ["Ngày 1"]);
  check("và nguồn đó được sửa lại kind = folder", fixKindIds, ["s1"]);
}

// ── 3. Thư mục con của thư mục con — tách hết trong MỘT lần đồng bộ ────────
{
  const { rows } = await planSubFolderSources("alb", [src({ id: "s1", url: FOLDER("P"), stage: "delivery" })],
    tree({ P: [{ id: "A", name: "Ngày 1" }], A: [{ id: "A1", name: "Sáng" }, { id: "A2", name: "Chiều" }] }));
  check("tách cả tầng hai trong một lần", names(rows), ["Ngày 1", "Sáng", "Chiều"]);
  check("tầng hai vẫn giữ đúng giai đoạn", rows.map((r) => r.stage), ["delivery", "delivery", "delivery"]);
}

// ── 4. Không tạo trùng nguồn đã có ────────────────────────────────────────
{
  const { rows } = await planSubFolderSources("alb", [
    src({ id: "s1", url: FOLDER("P"), stage: "delivery", position: 0 }),
    src({ id: "s2", url: FOLDER("A"), stage: "delivery", position: 1 }),
  ], tree({ P: [{ id: "A", name: "Ngày 1" }, { id: "B", name: "Ngày 2" }] }));
  check("thư mục con đã có nguồn rồi → không tạo lại", names(rows), ["Ngày 2"]);
}

// ── 5. Không đụng tới link FILE lẻ ────────────────────────────────────────
{
  check("link /file/d/ không phải thư mục để tách", folderIdForExpand("https://drive.google.com/file/d/XYZ/view"), null);
  const { rows } = await planSubFolderSources("alb",
    [src({ id: "s1", url: "https://drive.google.com/file/d/XYZ/view", kind: "file" })], tree({}));
  check("album ghép từ file lẻ → không đẻ nguồn nào", rows.length, 0);
}

// ── 6. Không có thư mục con → không thêm gì, không sửa kind ───────────────
{
  const { rows, fixKindIds } = await planSubFolderSources("alb",
    [src({ id: "s1", url: FOLDER("P"), stage: "delivery" })], tree({}));
  check("thư mục phẳng (chỉ có ảnh) → không thêm nguồn", rows.length, 0);
  check("thư mục phẳng → không sửa kind lung tung", fixKindIds, []);
}

// ── 7. Vị trí (position) tăng dần, không đè lên nguồn đang có ─────────────
{
  const { rows } = await planSubFolderSources("alb",
    [src({ id: "s1", url: FOLDER("P"), position: 7 })],
    tree({ P: [{ id: "A", name: "A" }, { id: "B", name: "B" }] }));
  check("position nối tiếp nguồn lớn nhất đang có", rows.map((r) => r.position), [8, 9]);
}

// ── 8. Cây lặp vòng / trỏ lại chính nó → phải dừng, không treo ────────────
{
  // A trỏ ngược lại P, mà P đã là nguồn sẵn có ⇒ không được tạo nguồn trùng.
  const { rows } = await planSubFolderSources("alb", [src({ id: "s1", url: FOLDER("P") })],
    tree({ P: [{ id: "A", name: "A" }], A: [{ id: "P", name: "P lặp lại" }] }));
  check("vòng lặp trỏ về nguồn đã có → không tạo trùng, dừng đúng lúc", names(rows), ["A"]);

  // Vòng lặp giữa hai thư mục CHƯA phải nguồn: mỗi thư mục chỉ được quét một
  // lần nên vẫn phải dừng, không lặp vô tận.
  const { rows: r2 } = await planSubFolderSources("alb", [src({ id: "s1", url: FOLDER("P") })],
    tree({ P: [{ id: "A", name: "A" }], A: [{ id: "B", name: "B" }], B: [{ id: "A", name: "A lần hai" }] }));
  check("vòng lặp giữa hai thư mục con → mỗi thư mục chỉ tạo một nguồn", names(r2), ["A", "B"]);
}

// ── 9. Drive lỗi ở một thư mục → các thư mục khác vẫn tách được ───────────
{
  const flaky = async (fid) => {
    if (fid === "P") return [{ id: "A", name: "A" }, { id: "B", name: "B" }];
    if (fid === "A") throw new Error("Drive 403");
    return [];
  };
  const { rows } = await planSubFolderSources("alb", [src({ id: "s1", url: FOLDER("P") })], flaky);
  check("một thư mục lỗi không làm hỏng cả lượt tách", names(rows), ["A", "B"]);
}

// ── 10. folderIdForExpand phải khớp extractFolderId thật (chống lệch code) ─
{
  const LINKS = [
    "https://drive.google.com/drive/folders/1AbC_dEf-123",
    "https://drive.google.com/drive/folders/1AbC_dEf-123?usp=sharing",
    "https://drive.google.com/drive/u/0/folders/1AbC_dEf-123",
    "https://drive.google.com/open?id=1AbC_dEf-123",
    "https://drive.google.com/uc?export=view&id=1AbC_dEf-123",
    "1AbC_dEf-1234567890abcdef",
    "khong-phai-link",
  ];
  for (const link of LINKS) {
    check(`cùng kết quả với extractFolderId: ${link.slice(0, 52)}`, folderIdForExpand(link), extractFolderId(link));
  }
  check("chỉ khác ở link FILE lẻ — cố ý bỏ qua", [folderIdForExpand("https://drive.google.com/file/d/XYZ/view"), extractFolderId("https://drive.google.com/file/d/XYZ/view")], [null, null]);
}

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
