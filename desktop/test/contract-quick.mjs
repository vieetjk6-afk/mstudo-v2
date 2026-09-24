/* Kiểm thử bộ đọc "Tạo hợp đồng nhanh" (src/lib/contract-quick.ts).
 *
 * Vì sao đáng test: đây là tầng LUÔN chạy — studio chưa cấu hình AI thì chỉ có
 * nó, còn có AI thì nó vá trường AI bỏ sót. Đọc sai SĐT/tiền/ngày là hợp đồng
 * điền sẵn sai mà trông vẫn rất hợp lý. Và `normalizeDraft` là chốt chặn duy
 * nhất giữa JSON AI tự do và form: id bịa phải bị loại.
 */
import {
  heuristicParse,
  normalizeDraft,
  mergeDrafts,
  parseMoney,
  parseDateText,
  normalizeTime,
  normalizePhone,
  missingFields,
  draftTotal,
  extractJson,
  QUICK_EXAMPLE,
  buildTranscript,
} from "../../src/lib/contract-quick.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};

const ctx = {
  today: "2026-09-24",
  packages: [
    { id: "p-cuoi", name: "Trọn gói cưới", price: 12_000_000 },
    { id: "p-cuoi-vip", name: "Trọn gói cưới VIP", price: 20_000_000 },
    { id: "p-album", name: "Album 30x30", price: 1_500_000 },
    { id: "p-flycam", name: "Flycam", price: 2_000_000 },
  ],
  services: [{ id: "s-cuoi", name: "Cưới" }, { id: "s-kyyeu", name: "Kỷ yếu" }],
  crew: [{ id: "c-minh", name: "Minh" }, { id: "c-tuan", name: "Tuấn Anh" }],
};

// ── Tiền ──
check("15tr", parseMoney("15tr"), 15_000_000);
check("15 triệu", parseMoney("15 triệu"), 15_000_000);
check("1tr5", parseMoney("1tr5"), 1_500_000);
check("2,5tr", parseMoney("2,5tr"), 2_500_000);
check("500k", parseMoney("500k"), 500_000);
check("15.000.000đ", parseMoney("15.000.000đ"), 15_000_000);
check("15000000", parseMoney("15000000"), 15_000_000);
check("chữ không phải tiền", parseMoney("abc"), undefined);

// ── Ngày / giờ / SĐT ──
check("12/10 → năm nay", parseDateText("12/10", ctx.today), "2026-10-12");
check("5/3 đã qua → năm sau", parseDateText("5/3", ctx.today), "2027-03-05");
check("12/10/27", parseDateText("12/10/27", ctx.today), "2027-10-12");
check("ngày 3 tháng 11", parseDateText("ngày 3 tháng 11", ctx.today), "2026-11-03");
check("31/2 không hợp lệ", parseDateText("31/2/2027", ctx.today), undefined);
check("7h", normalizeTime("7h"), "07:00");
check("7h30", normalizeTime("7h30"), "07:30");
check("17:05", normalizeTime("17:05"), "17:05");
check("25h sai", normalizeTime("25h"), undefined);
check("SĐT có cách", normalizePhone("0901 234 567"), "0901234567");
check("SĐT +84", normalizePhone("+84901234567"), "0901234567");
check("SĐT thiếu số", normalizePhone("090123"), undefined);

// ── Đoạn mẫu hiện trên màn ──
const ex = heuristicParse(QUICK_EXAMPLE, ctx);
check("mẫu: tên", ex.clientName, "Nguyễn Thu Lan");
check("mẫu: SĐT", ex.clientPhone, "0901234567");
check("mẫu: gói chính", ex.mainPkgId, "p-cuoi");
check("mẫu: giá chốt", ex.mainPrice, 15_000_000);
check("mẫu: thêm album", ex.extraIds, ["p-album"]);
check("mẫu: ngày", ex.eventDate, "2026-10-12");
check("mẫu: giờ", [ex.startTime, ex.endTime], ["07:00", "17:00"]);
check("mẫu: địa điểm", ex.location, "nhà hàng Riverside Q7");
check("mẫu: cọc", ex.deposit, 5_000_000);
check("mẫu: hạn cọc", ex.depositDue, "2026-09-30");
check("mẫu: dịch vụ", ex.serviceId, "s-cuoi");
check("mẫu: đủ thông tin", missingFields(ex), []);
check("mẫu: tổng", draftTotal(ex, ctx), 16_500_000);

// ── Dạng có nhãn ──
const lab = heuristicParse(
  "Tên khách: Trần Văn B\nSĐT: 0912.345.678\nGói: Trọn gói cưới VIP\nNgày: 01/12\nGiờ: 8h\nĐịa điểm: Nhà thờ Đức Bà\nCọc: 30%\nThợ: Minh, Tuấn Anh",
  ctx
);
check("nhãn: tên", lab.clientName, "Trần Văn B");
check("nhãn: SĐT", lab.clientPhone, "0912345678");
check("nhãn: VIP thắng gói thường", lab.mainPkgId, "p-cuoi-vip");
check("nhãn: giá bảng giá giữ nguyên", lab.mainPrice, undefined);
check("nhãn: giờ", lab.startTime, "08:00");
check("nhãn: cọc 30%", lab.deposit, 6_000_000);
check("nhãn: thợ", lab.crewIds, ["c-minh", "c-tuan"]);
check("nhãn: địa điểm", lab.location, "Nhà thờ Đức Bà");

// ── Gói không có trong bảng giá → gói riêng ──
const custom = heuristicParse("Gói: Chụp gia đình\nGiá: 3tr\nSĐT 0987654321", ctx);
check("gói riêng", custom.customLines, [{ name: "Chụp gia đình", qty: 1, unit_price: 3_000_000 }]);
check("gói riêng: không có gói chính", custom.mainPkgId, undefined);

// ── Giá không có chữ "giá", SĐT có dấu chấm không bị đọc thành tiền ──
const loose = heuristicParse("Khách: Phạm Mai - 0909.888.777\nTrọn gói cưới 11,5tr\n15-12 7h30 - 11h\nMinh đi chụp", ctx);
check("giá rời: 11,5tr", loose.mainPrice, 11_500_000);
check("giá rời: tên", loose.clientName, "Phạm Mai");
check("giá rời: SĐT", loose.clientPhone, "0909888777");
check("giá rời: khung giờ", [loose.startTime, loose.endTime], ["07:30", "11:00"]);
check("giá rời: thợ nhắc tên", loose.crewIds, ["c-minh"]);

// ── Gói không có trong bảng giá, không có nhãn → tên lấy từ câu ──
const noPkg = heuristicParse("Chị Hoa 0901234567, gói chụp gia đình ngoại cảnh, giá chốt 4tr5", { ...ctx, packages: [] });
check("gói riêng từ câu", noPkg.customLines, [{ name: "gói chụp gia đình ngoại cảnh", qty: 1, unit_price: 4_500_000 }]);

// ── normalizeDraft: AI bịa id / sai định dạng thì bị loại ──
const ai = normalizeDraft(
  {
    clientName: "  Lê C ",
    clientPhone: "84-987-654-321",
    shootType: "wedding",
    serviceId: "khong-co",
    mainPkgId: "p-cuoi",
    mainPrice: 12_000_000,
    extraIds: ["p-album", "p-bia", "p-cuoi"],
    eventDate: "2026-02-30",
    startTime: "7h",
    crewIds: ["c-minh", "c-ma"],
    deposit: "3tr",
  },
  ctx
);
check("AI: chuẩn hoá", ai, {
  clientName: "Lê C",
  clientPhone: "0987654321",
  shootType: "wedding",
  mainPkgId: "p-cuoi",
  extraIds: ["p-album"],
  startTime: "07:00",
  crewIds: ["c-minh"],
  deposit: 3_000_000,
});
check("AI: rác", normalizeDraft("xin chào", ctx), {});

// ── Gộp: AI thắng, quy tắc vá chỗ trống, không tính tiền hai lần ──
const merged = mergeDrafts({ mainPkgId: "p-cuoi" }, { customLines: [{ name: "Gói dịch vụ", qty: 1, unit_price: 9e6 }], clientPhone: "0901234567" });
check("gộp: bỏ gói riêng đoán khi AI đã chọn gói", merged, { clientPhone: "0901234567", mainPkgId: "p-cuoi" });

// ── "tại" trong tên gói không phải địa điểm ──
const locT = heuristicParse("Gói: Trọn gói cưới\nThêm: Makeup cô dâu tại nhà\nNgày 15/12 tại Nhà hàng Riverside", ctx);
check("địa điểm: bỏ 'tại' trong dòng Thêm", locT.location, "Nhà hàng Riverside");

// ── Đoạn chat hộp thư ──
const tr = buildTranscript({ name: "Mai Anh", phone: "+84 912 000 111" }, [
  { direction: "in", body: "Chào shop, mình hỏi gói cưới" },
  { direction: "out", body: "Dạ gọi hotline 0281234567 nhé" },
  { direction: "in", body: "   " },
  { direction: "in", body: "Chốt trọn gói cưới 11tr ngày 20/12 nha" },
]);
check("chat: đầu đoạn có tên + SĐT chuẩn hoá", tr.split("\n").slice(0, 2), ["Tên khách: Mai Anh", "SĐT: 0912000111"]);
check("chat: bỏ tin rỗng, gắn nhãn", tr.split("\n").slice(3), [
  "[Khách] Chào shop, mình hỏi gói cưới",
  "[Studio] Dạ gọi hotline 0281234567 nhé",
  "[Khách] Chốt trọn gói cưới 11tr ngày 20/12 nha",
]);
const trParsed = heuristicParse(tr, ctx);
check("chat: SĐT khách, tên, gói, giá", [trParsed.clientPhone, trParsed.clientName, trParsed.mainPkgId, trParsed.mainPrice], ["0912000111", "Mai Anh", "p-cuoi", 11_000_000]);
const noPhone = heuristicParse(buildTranscript({ name: "X" }, [{ direction: "out", body: "Hotline 0281234567" }]), ctx);
check("chat: không lấy hotline studio làm SĐT khách", noPhone.clientPhone, undefined);
const long = buildTranscript({ name: "A" }, Array.from({ length: 200 }, (_, i) => ({ direction: "in", body: `tin số ${i} ` + "x".repeat(50) })), 1000);
check("chat: quá dài thì giữ tin MỚI nhất", [long.length <= 1000, long.includes("tin số 199"), long.includes("tin số 0 ")], [true, true, false]);

// ── Ghi chú nội bộ tách khỏi yêu cầu của khách ──
const notes = heuristicParse("SĐT 0901234567\nYêu cầu: tông ảnh film\nNội bộ: khách quen, đã bớt 1tr", ctx);
check("ghi chú: yêu cầu khách", notes.note, "tông ảnh film");
check("ghi chú: nội bộ", notes.internalNote, "khách quen, đã bớt 1tr");
check("ghi chú: tiền trong ghi chú không thành giá", notes.customLines, undefined);
check("AI: internalNote giữ lại", normalizeDraft({ internalNote: " nhớ đèn " }, ctx), { internalNote: "nhớ đèn" });

// ── JSON bọc markdown ──
check("extractJson", extractJson('Đây:\n```json\n{"a":1}\n```'), { a: 1 });
check("extractJson hỏng", extractJson("không có"), null);

if (fail) {
  console.log(`\n${fail} kiểm thử HỎNG`);
  process.exit(1);
}
console.log("\nTất cả đều qua.");
