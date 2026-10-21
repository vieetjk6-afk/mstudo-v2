/**
 * VIỆC TỰ ĐỘNG THEO TRẠNG THÁI HỢP ĐỒNG.
 *
 * Vấn đề: mọi nhắc nhở trong app đang do NGƯỜI nhớ. Hợp đồng ký rồi thì ai nhắc
 * đặt cọc, giao ảnh rồi thì ai xin đánh giá, còn ba ngày tới buổi chụp thì ai
 * gọi khách xác nhận. Studio quên một việc là mất một khoản thu hoặc một đánh giá.
 *
 * CỐ Ý KHÔNG LÀM TRÌNH DỰNG LUẬT TỰ DO. Studio không cần Zapier — họ cần đúng
 * chín việc, bật/tắt bằng công tắc, sửa được số ngày và câu chữ. Nên:
 *
 *   • tập "KHI" là ĐÓNG (`TriggerKind`) — không có trình chọn điều kiện,
 *   • tập "THÌ" là ĐÓNG (`ActionKind`) — không có trình soạn hành động,
 *   • và cả chín luật được khai sẵn ở `AUTOMATION_RULES` dưới đây.
 *
 * File này là LUẬT THUẦN: không đọc DB, không gọi mạng. `dueActions()` nhận một
 * ảnh chụp hợp đồng + cấu hình + những gì ĐÃ chạy, rồi trả về danh sách việc
 * phải làm. Cron chỉ việc thi hành. Kiểm thử bằng node:
 * `npm run test:automations`.
 *
 * ĐIỀU QUAN TRỌNG NHẤT ở đây là CHẠY MỘT LẦN. Cron chạy mỗi ngày; một luật ghi
 * đè lặp sẽ đẻ ra 30 việc giống nhau trong một tháng và studio sẽ tắt cả tính
 * năng. Mọi việc sinh ra đều có KHOÁ CHỐNG LẶP (`dedupeKey`) và cron ghi khoá đó
 * xuống `studio_automation_log` — xem `dedupeKey()` và migration automations.sql.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Tập KHI và tập THÌ — cả hai đều ĐÓNG
   ───────────────────────────────────────────────────────────────────────────── */

export type TriggerKind =
  /** Khách vừa ký hợp đồng. */
  | "signed"
  /** Còn đúng N ngày tới buổi chụp. */
  | "before_shoot"
  /** Một đợt thanh toán quá hạn N ngày. */
  | "payment_overdue"
  /** Khách bấm "đã chọn xong ảnh". */
  | "selection_done"
  /** Album đã chuyển sang giao khách. */
  | "delivered"
  /** Hợp đồng chuyển sang hoàn thành. */
  | "completed";

export type ActionKind =
  /** Tạo một dòng việc trong `contract_tasks` của hợp đồng. */
  | "task"
  /** Chuông trong dashboard + web-push tới điện thoại chủ studio. */
  | "notify"
  /** Gửi Zalo cho KHÁCH theo câu chữ của luật (best-effort). */
  | "zalo"
  /**
   * Gửi email cho KHÁCH. Không luật nào lấy đây làm kênh CHÍNH — email là kênh
   * DỰ PHÒNG của ba luật nhắn khách (xem `fallback` bên dưới).
   *
   * Vì sao không phải kênh chính: khách Việt đọc Zalo, hộp thư thì nhiều người
   * không mở hàng tuần. Vì sao vẫn phải có: gửi Zalo đòi studio kết nối OA hoặc
   * phiên cá nhân, mà phần lớn studio chưa làm — không có kênh dự phòng thì ba
   * luật nhắn khách bật lên vẫn không tới được ai, và studio tưởng đã nhắn rồi.
   */
  | "email"
  /**
   * Tạo THIỆP CƯỚI ONLINE cho hợp đồng (điền sẵn tên, ngày, địa điểm) rồi gửi
   * khách link để tự sửa — Zalo, không được thì email. Không có đường nào tới
   * khách thì vẫn tạo thiệp (khách thấy nó trong trang hợp đồng của mình) và
   * giao studio một việc "gửi link cho khách".
   */
  | "invitation";

export type AutomationRule = {
  /** Khoá bền — lưu xuống DB, KHÔNG đổi sau khi phát hành. */
  key: string;
  label: string;
  /** Một câu giải thích cho studio đọc trên màn cấu hình. */
  hint: string;
  trigger: TriggerKind;
  action: ActionKind;
  /**
   * Số ngày mặc định cho luật có mốc ngày. `null` = luật không dùng số ngày;
   * màn cấu hình sẽ không hiện ô nhập.
   */
  days: number | null;
  /** Câu chữ mặc định. Studio ghi đè được. Xem `renderMessage` cho các ô thay. */
  message: string;
  /** Bật sẵn khi studio chưa cấu hình gì? Chỉ bật những luật KHÔNG gửi gì ra ngoài. */
  onByDefault: boolean;
  /**
   * Kênh DỰ PHÒNG khi kênh chính không đi được (studio chưa nối Zalo, hoặc
   * khách không có số). Gửi MỘT trong hai, không bao giờ cả hai: một lời nhắc
   * tới khách hai lần trông như studio làm ăn cẩu thả.
   */
  fallback?: ActionKind;
};

/**
 * CHÍN LUẬT. Thứ tự ở đây là thứ tự hiện trên màn cấu hình, và nó kể lại vòng đời
 * một hợp đồng: ký → trước ngày cưới → trước buổi chụp → tiền → chọn ảnh → giao → xong.
 *
 * Chỉ luật sinh VIỆC hoặc CHUÔNG trong nhà được bật sẵn. Ba luật gửi Zalo cho
 * KHÁCH đều tắt sẵn: một tin nhắn tự động gửi sai tên hoặc sai lúc là chuyện
 * khách nhìn thấy, nên studio phải tự bật sau khi đọc lại câu chữ.
 *
 * NGOẠI LỆ: luật TẶNG THIỆP CƯỚI bật sẵn. Đó là một món quà chứ không phải lời
 * nhắc, và mstudo chủ động tặng khách của các gói phóng sự cưới — studio vẫn tắt
 * được, hoặc tắt riêng từng hợp đồng.
 */
export const AUTOMATION_RULES: readonly AutomationRule[] = [
  {
    key: "deposit_after_sign",
    label: "Ký xong → nhắc thu cọc",
    hint: "Khách vừa ký hợp đồng thì tạo ngay một việc nhắc thu tiền cọc.",
    trigger: "signed",
    action: "task",
    days: null,
    message: "Thu cọc hợp đồng {hopdong} — khách {khach}",
    onByDefault: true,
  },
  {
    key: "gift_invitation",
    label: "Trước ngày cưới → tặng thiệp cưới online",
    hint:
      "Còn N ngày tới ngày thực hiện thì tự tạo thiệp cưới online (điền sẵn tên, ngày, địa điểm) và gửi khách link để tự sửa rồi gửi quan khách. " +
      "Áp dụng cho hợp đồng gói phóng sự cưới, và hợp đồng studio bật “Tặng thiệp” (mục Tiện ích tặng khách trong hợp đồng).",
    trigger: "before_shoot",
    action: "invitation",
    days: 30,
    message:
      "Chào {khach}, studio tặng mình thiệp cưới online cho ngày cưới {ngay}. Mình bấm vào link để điền tên, ảnh, địa điểm rồi gửi cho quan khách nhé: {link}",
    onByDefault: true,
    fallback: "email",
  },
  {
    key: "crew_before_shoot",
    label: "Trước buổi chụp → chốt ê-kíp & thiết bị",
    hint: "Còn N ngày tới buổi chụp thì tạo việc chốt người và đồ nghề.",
    trigger: "before_shoot",
    action: "task",
    days: 7,
    message: "Chốt ê-kíp & thiết bị cho buổi chụp {ngay} — {khach}",
    onByDefault: true,
  },
  {
    key: "confirm_before_shoot",
    label: "Sát buổi chụp → gọi khách xác nhận",
    hint: "Còn N ngày tới buổi chụp thì báo chuông để gọi khách xác nhận giờ và địa điểm.",
    trigger: "before_shoot",
    action: "notify",
    days: 3,
    message: "Còn {conlai} ngày tới buổi chụp của {khach} ({ngay}) — gọi xác nhận giờ & địa điểm",
    onByDefault: true,
  },
  {
    key: "remind_client_before_shoot",
    label: "Sát buổi chụp → nhắn khách",
    hint: "Gửi Zalo nhắc khách trước buổi chụp N ngày. Đọc lại câu chữ trước khi bật.",
    trigger: "before_shoot",
    action: "zalo",
    days: 2,
    message:
      "Chào {khach}, studio nhắc buổi chụp của mình vào {ngay}. Mình chuẩn bị trang phục và tới đúng giờ nhé. Cần đổi gì thì nhắn lại giúp studio ạ!",
    onByDefault: false,
    fallback: "email",
  },
  {
    key: "payment_overdue",
    label: "Quá hạn thanh toán → báo chuông",
    hint: "Một đợt thanh toán quá hạn N ngày mà chưa thu thì báo chuông.",
    trigger: "payment_overdue",
    action: "notify",
    days: 1,
    message: "Quá hạn {quahan} ngày: đợt “{dot}” của {khach} — {tien}",
    onByDefault: true,
  },
  {
    key: "start_post_after_selection",
    label: "Khách chọn xong ảnh → bắt đầu hậu kỳ",
    hint: "Khách bấm “đã chọn xong” thì tạo việc lọc ảnh và bắt đầu hậu kỳ.",
    trigger: "selection_done",
    action: "task",
    days: null,
    message: "Lọc ảnh khách đã chọn & bắt đầu hậu kỳ — {khach}",
    onByDefault: true,
  },
  {
    key: "ask_review_after_deliver",
    label: "Giao ảnh xong → xin đánh giá",
    hint: "Album chuyển sang giao khách thì gửi Zalo xin một dòng cảm nhận.",
    trigger: "delivered",
    action: "zalo",
    days: null,
    message:
      "Chào {khach}, studio đã giao album của mình rồi ạ. Nếu mình thấy hài lòng, cho studio xin một dòng cảm nhận ở cuối trang album nhé. Cảm ơn mình nhiều!",
    onByDefault: false,
    fallback: "email",
  },
  {
    key: "thanks_after_complete",
    label: "Hoàn thành → cảm ơn & xin giới thiệu",
    hint: "Hợp đồng hoàn thành thì gửi Zalo cảm ơn kèm lời mời giới thiệu bạn bè.",
    trigger: "completed",
    action: "zalo",
    days: null,
    message:
      "Cảm ơn {khach} đã tin studio cho dịp này! Nếu có bạn bè cần chụp, mình giới thiệu giúp studio nhé — studio có ưu đãi riêng cho khách được giới thiệu ạ.",
    onByDefault: false,
    fallback: "email",
  },
];

export const RULE_BY_KEY: Record<string, AutomationRule> = Object.fromEntries(
  AUTOMATION_RULES.map((r) => [r.key, r])
);

/** Cấu hình của studio cho MỘT luật (một dòng trong `studio_automations`). */
export type AutomationConfig = {
  rule: string;
  enabled: boolean;
  /** `null` = dùng số ngày mặc định của luật. */
  days: number | null;
  /** `null`/rỗng = dùng câu chữ mặc định của luật. */
  message: string | null;
};

/** Gộp cấu hình studio với bản khai mặc định. */
export function effectiveConfig(rule: AutomationRule, cfg?: AutomationConfig | null): {
  enabled: boolean;
  days: number;
  message: string;
} {
  return {
    enabled: cfg ? cfg.enabled : rule.onByDefault,
    // Số ngày phải là số nguyên KHÔNG âm: "còn -3 ngày tới buổi chụp" không có
    // nghĩa, và một số âm lọt vào sẽ làm luật never/always fire.
    days: clampDays(cfg?.days ?? rule.days ?? 0),
    message: (cfg?.message ?? "").trim() || rule.message,
  };
}

export function clampDays(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(365, n));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ảnh chụp hợp đồng — đúng những gì bộ luật cần biết
   ───────────────────────────────────────────────────────────────────────────── */

export type DueRow = {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paid: boolean;
};

export type ContractSnapshot = {
  id: string;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  status: string;
  /** `client_signed_at` — có giá trị là đã ký. */
  signedAt: string | null;
  /** 'YYYY-MM-DD' */
  eventDate: string | null;
  /** `albums.selection_done_at` của album chọn ảnh. */
  selectionDoneAt: string | null;
  /** `albums.delivered_at` của album giao khách. */
  deliveredAt: string | null;
  /** Email khách — kênh dự phòng khi không gửi Zalo được. */
  clientEmail?: string | null;
  dues: DueRow[];
  /** Gói phóng sự cưới (xem `isWeddingReportage`) — luật tặng thiệp. */
  reportage?: boolean;
  /**
   * Studio chọn riêng cho hợp đồng này (`studio_contracts.gift_invitation`):
   * true = tặng thiệp, false = không tặng, null = theo gói (phóng sự thì tặng).
   */
  giftInvitation?: boolean | null;
  /** Hợp đồng đã có thiệp cưới online (studio tạo tay, hoặc lượt trước đã tạo). */
  hasInvitation?: boolean;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Gói phóng sự cưới — ai được tặng thiệp
   ───────────────────────────────────────────────────────────────────────────── */

/** Bỏ dấu, thường hoá — để so "Phóng Sự" với "phong su". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

export type PackageInfo = {
  /** `studio_contracts.shoot_type` */
  shootType?: string | null;
  /** `studio_contracts.intake.type` — form điền thông tin kiểu phóng sự cưới ("psc"). */
  intakeType?: string | null;
  title?: string | null;
  /** Tên dịch vụ studio tự đặt (`studio_services.name`). */
  serviceName?: string | null;
  /** Tên các hạng mục trong hợp đồng (`contract_items.name`). */
  itemNames?: (string | null | undefined)[];
};

/**
 * Hợp đồng này là GÓI PHÓNG SỰ CƯỚI?
 *
 * Không có cờ riêng nào nói điều này, nên đọc từ nhiều chỗ:
 *   · loại dịch vụ "Quay chụp PSC" (psc) hoặc "Trọn gói ngày cưới" (wedding);
 *   · form điền thông tin kiểu phóng sự cưới;
 *   · chữ "phóng sự" / "PSC" trong tên hợp đồng, tên dịch vụ studio tự đặt, hoặc
 *     tên hạng mục ("Phóng sự x2", "Gói chụp phóng sự") — vì chọn dịch vụ tự đặt
 *     thì loại dịch vụ bị ghi đè thành "other".
 * "Phóng sự" của sự kiện khác (sinh nhật, hội nghị, kỷ yếu…) KHÔNG tính — trừ khi
 * cũng có chữ cưới.
 */
export function isWeddingReportage(p: PackageInfo): boolean {
  if (p.shootType === "psc" || p.shootType === "wedding") return true;
  if (p.intakeType === "psc") return true;
  const hay = fold([p.title, p.serviceName, ...(p.itemNames ?? [])].filter(Boolean).join(" | "));
  if (/pre[\s-]?wedding|pre[\s-]?wed/.test(hay) && !/phong su/.test(hay)) return false;
  if (!/phong su|\bpsc\b/.test(hay)) return false;
  if (/cuoi|wedding|vu quy|thanh hon|an hoi|don dau|ruoc dau/.test(hay)) return true;
  return !/su kien|sinh nhat|thoi noi|day thang|hoi nghi|ky yeu|doanh nghiep|cong ty|khai truong|ra mat|gia dinh|tot nghiep/.test(hay);
}

/** Ít nhất bấy nhiêu ngày trước ngày cưới mới tặng thiệp — sát ngày thì khách không kịp gửi quan khách. */
export const INVITATION_MIN_DAYS = 7;

/**
 * Hợp đồng có được tự TẶNG thiệp không (chưa xét ngày).
 *   · đã có thiệp → không (studio đã tạo tay thì đã tự gửi; tạo thêm là trùng);
 *   · khách chưa ký / chưa duyệt → không (hợp đồng còn có thể không thành);
 *   · studio chọn riêng cho hợp đồng thì theo đó, không thì theo gói phóng sự.
 */
export function invitationEligible(c: ContractSnapshot): boolean {
  if (c.hasInvitation) return false;
  if (!c.signedAt && c.status !== "approved" && c.status !== "in_progress") return false;
  if (c.giftInvitation === true) return true;
  if (c.giftInvitation === false) return false;
  return !!c.reportage;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Câu chữ
   ───────────────────────────────────────────────────────────────────────────── */

export type MessageVars = {
  khach?: string;
  hopdong?: string;
  ngay?: string;
  conlai?: string | number;
  quahan?: string | number;
  dot?: string;
  tien?: string;
  /** Link sửa thiệp cưới (luật tặng thiệp) — cron điền sau khi đã tạo thiệp. */
  link?: string;
};

/**
 * Thay các ô `{khach}`, `{hopdong}`, `{ngay}`… trong câu chữ của luật.
 *
 * Ô KHÔNG có dữ liệu thì bị xoá cùng khoảng trắng quanh nó, chứ không để lại
 * chuỗi "{khach}" trần: câu này gửi thẳng cho khách qua Zalo, và một tin nhắn
 * ghi "Chào {khach}" là thứ studio không bao giờ muốn khách nhìn thấy.
 */
export function renderMessage(template: string, vars: MessageVars): string {
  let out = String(template ?? "");
  const keys: (keyof MessageVars)[] = ["khach", "hopdong", "ngay", "conlai", "quahan", "dot", "tien", "link"];
  for (const k of keys) {
    const v = vars[k];
    const val = v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
    out = val
      ? out.replaceAll(`{${k}}`, val)
      : out.replace(new RegExp(`\\s*\\{${k}\\}`, "g"), "");
  }
  // Ô lạ (studio gõ tay sai tên) cũng phải biến mất, không lọt ra ngoài.
  out = out.replace(/\s*\{[a-zA-Z_]+\}/g, "");
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

/**
 * Câu gửi khách kèm link thiệp. Studio sửa câu chữ mà lỡ xoá ô `{link}` thì link
 * vẫn được nối vào cuối — tin tặng thiệp mà không có link là tin vô dụng.
 * Link được điền SAU khi render: dấu chấm ngay sau link không được dính vào link.
 */
export function invitationText(template: string, vars: MessageVars, link: string): string {
  const mark = "@@LINK@@";
  const msg = renderMessage(template, { ...vars, link: mark });
  return msg.includes(mark) ? msg.replace(mark, link) : `${msg}\n${link}`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bộ luật
   ───────────────────────────────────────────────────────────────────────────── */

export type PendingAction = {
  rule: string;
  action: ActionKind;
  contractId: string;
  message: string;
  /**
   * Khoá CHỐNG LẶP. Cron ghi khoá này xuống `studio_automation_log` sau khi làm
   * xong, và bỏ qua mọi việc có khoá đã tồn tại. Đây là thứ giữ cho cron chạy
   * mỗi ngày không đẻ ra 30 việc giống nhau.
   */
  dedupeKey: string;
  /** Số điện thoại nhận Zalo (chỉ cho action `zalo`). */
  toPhone?: string | null;
  /** Email nhận thư dự phòng (chỉ cho luật có `fallback: "email"`). */
  toEmail?: string | null;
  /** Kênh dự phòng của luật, chép sẵn để cron không phải tra lại bảng luật. */
  fallback?: ActionKind | null;
  /**
   * Luật tặng thiệp: câu chữ GỐC + các ô đã có, để cron render lại khi đã có
   * link (`invitationText`). `message` khi đó là bản không có link, dùng để báo.
   */
  template?: string;
  vars?: MessageVars;
};

/** Số ngày giữa hai mốc 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Khoá chống lặp: một luật × một hợp đồng × một "lần" (đợt thanh toán…). */
export function dedupeKey(rule: string, contractId: string, ref = ""): string {
  return ref ? `${rule}:${contractId}:${ref}` : `${rule}:${contractId}`;
}

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}₫`;
const dmy = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "");

/**
 * Những việc luật đòi phải làm cho MỘT hợp đồng, tính tại ngày `today`.
 *
 * `fired` là tập khoá chống lặp đã chạy. Truyền vào (chứ không tự đọc DB) để bộ
 * luật vẫn là hàm thuần và kiểm thử được — cron lo phần đọc/ghi.
 *
 * Hợp đồng đã HUỶ thì không sinh việc gì: không ai muốn app nhắc gọi khách xác
 * nhận một buổi chụp đã huỷ.
 */
export function dueActions(
  c: ContractSnapshot,
  configs: Record<string, AutomationConfig | undefined>,
  fired: ReadonlySet<string>,
  today: string
): PendingAction[] {
  const out: PendingAction[] = [];
  if (c.status === "cancelled") return out;

  const base: MessageVars = {
    khach: c.clientName ?? "",
    hopdong: c.title ?? "",
    ngay: dmy(c.eventDate),
  };

  for (const rule of AUTOMATION_RULES) {
    const cfg = effectiveConfig(rule, configs[rule.key]);
    if (!cfg.enabled) continue;
    // Luật nhắn khách mà không có ĐƯỜNG NÀO tới khách thì bỏ qua. Xét cả kênh
    // dự phòng: khách chỉ để email (khách công ty, khách nước ngoài) vẫn nhắn
    // được, và trước khi có `fallback` thì những hợp đồng đó im lặng tuột mất.
    if (rule.action === "zalo" && !c.clientPhone && !(rule.fallback === "email" && c.clientEmail)) continue;
    // Tặng thiệp: chỉ hợp đồng đủ điều kiện. KHÔNG đòi có số/email khách — không
    // gửi được thì thiệp vẫn được tạo (khách thấy trong trang hợp đồng) và studio
    // nhận việc gửi link tay.
    if (rule.action === "invitation" && !invitationEligible(c)) continue;

    const push = (vars: MessageVars, ref = "") => {
      const key = dedupeKey(rule.key, c.id, ref);
      if (fired.has(key)) return;
      const message = renderMessage(cfg.message, { ...base, ...vars });
      if (!message) return; // studio xoá trắng câu chữ → coi như tắt luật đó
      const toClient = rule.action === "zalo" || rule.action === "invitation";
      out.push({
        rule: rule.key,
        action: rule.action,
        contractId: c.id,
        message,
        dedupeKey: key,
        toPhone: toClient ? c.clientPhone : null,
        toEmail: rule.fallback === "email" ? c.clientEmail ?? null : null,
        fallback: rule.fallback ?? null,
        ...(rule.action === "invitation" ? { template: cfg.message, vars: { ...base, ...vars } } : {}),
      });
    };

    switch (rule.trigger) {
      case "signed":
        if (c.signedAt) push({});
        break;

      case "before_shoot": {
        if (!c.eventDate) break;
        const left = daysBetween(today, c.eventDate);
        // `<= cfg.days` chứ không `=== cfg.days`: cron có thể không chạy đúng
        // một ngày (Vercel lỗi, project mới bật). Nếu đòi khớp CHÍNH XÁC thì
        // việc đó mất hẳn. Khoá chống lặp lo phần "chỉ một lần".
        // Và `left >= 0`: buổi chụp đã qua thì không nhắc chuẩn bị nữa.
        // Tặng thiệp thì còn ÍT NHẤT một tuần mới tặng: sát ngày khách không kịp
        // gửi quan khách, thiệp thành thừa. (Studio đặt số ngày < 7 thì lấy đúng số đó.)
        const min = rule.action === "invitation" ? Math.min(INVITATION_MIN_DAYS, cfg.days) : 0;
        if (left !== null && left >= min && left <= cfg.days) push({ conlai: left });
        break;
      }

      case "payment_overdue":
        for (const d of c.dues) {
          if (d.paid || !d.dueDate) continue;
          const over = daysBetween(d.dueDate, today);
          if (over === null || over < cfg.days) continue;
          // `ref` là id của ĐỢT: hợp đồng chia 4 đợt thì mỗi đợt quá hạn là một
          // việc riêng, không phải một việc chung bị chống lặp mất ba.
          push({ quahan: over, dot: d.label, tien: vnd(d.amount) }, d.id);
        }
        break;

      case "selection_done":
        if (c.selectionDoneAt) push({});
        break;

      case "delivered":
        if (c.deliveredAt) push({});
        break;

      case "completed":
        if (c.status === "completed") push({});
        break;
    }
  }

  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Chọn kênh gửi
   ───────────────────────────────────────────────────────────────────────────── */

/** Studio này gửi được bằng gì, tại thời điểm cron chạy. */
export type Reach = {
  /** Zalo đã nối VÀ có số khách. */
  zalo: boolean;
  /** Máy chủ gửi được email VÀ có địa chỉ khách. */
  email: boolean;
};

/**
 * Kênh sẽ dùng cho một việc nhắn khách: kênh chính nếu đi được, nếu không thì
 * kênh dự phòng, nếu không nữa thì `null`.
 *
 * `null` phải được cron hiểu là "CHƯA làm", không phải "đã làm mà hỏng": việc
 * này chưa được đánh dấu chống lặp, để ngày mai — khi studio đã nối Zalo hoặc
 * đã điền email khách — nó gửi được. Đánh dấu một việc không có đường nào đi ra
 * chính là cách làm mất hẳn nó.
 */
export function deliveryFor(
  action: ActionKind,
  fallback: ActionKind | null | undefined,
  reach: Reach
): ActionKind | null {
  if (action !== "zalo" && action !== "email") return action;
  const can = (k: ActionKind) => (k === "zalo" ? reach.zalo : k === "email" ? reach.email : false);
  if (can(action)) return action;
  if (fallback && fallback !== action && can(fallback)) return fallback;
  return null;
}

/**
 * Tiêu đề thư cho kênh dự phòng.
 *
 * Câu chữ của luật là câu NHẮN — viết cho khung chat, không có tiêu đề. Nên
 * tiêu đề lấy theo luật chứ không cắt từ thân thư: một dòng "Chào chị Lan,
 * studio nhắc buổi chụp…" làm tiêu đề thì hộp thư nào cũng cắt cụt.
 */
export function emailSubject(ruleKey: string, studioName: string): string {
  const studio = (studioName || "Studio").trim();
  switch (ruleKey) {
    case "remind_client_before_shoot":
      return `Nhắc lịch chụp sắp tới — ${studio}`;
    case "ask_review_after_deliver":
      return `Album của bạn đã sẵn sàng — ${studio}`;
    case "thanks_after_complete":
      return `Cảm ơn bạn — ${studio}`;
    case "gift_invitation":
      return `Thiệp cưới online tặng bạn — ${studio}`;
    default:
      return studio;
  }
}
