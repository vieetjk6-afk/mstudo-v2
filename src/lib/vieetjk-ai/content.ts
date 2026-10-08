// ────────────────────────────────────────────────────────────────────────────
//  NỘI DUNG TRANG AI.VIEETJK.COM — Công ty giải pháp công nghệ Vieetjk
//  Mọi chữ, số liệu, dịch vụ, câu hỏi thường gặp nằm ở đây — sửa ở đây là đủ.
//
//  Trang được phục vụ khi request tới host ai.vieetjk.com (middleware rewrite
//  tên miền riêng → /site/ai.vieetjk.com/...). Không đọc bảng `sites`, không
//  cần cấu hình gì trong dashboard; chỉ cần trỏ DNS + thêm domain vào Vercel.
//
//  File thuần dữ liệu (không import server-only) để robots.txt / sitemap.xml
//  và component client đọc chung được.
// ────────────────────────────────────────────────────────────────────────────

export const AI_HOST = "ai.vieetjk.com";
export const AI_ORIGIN = `https://${AI_HOST}`;

/** Trang này có phải trang công ty công nghệ (theo host / khoá route)? */
export function isVieetjkAiHost(key: string | null | undefined): boolean {
  const k = (key || "").toLowerCase().split(":")[0];
  return k === AI_HOST || k === `www.${AI_HOST}`;
}

export const COMPANY = {
  /** Tên đầy đủ — dùng ở tiêu đề, chân trang, dữ liệu có cấu trúc. */
  legalName: "Công ty giải pháp công nghệ Vieetjk",
  shortName: "Vieetjk",
  brandSuffix: "Tech",
  englishName: "Vieetjk Technology Solutions",
  /** Ngày thành lập: 18/07/2024. */
  founded: "2024-07-18",
  foundedLabel: "18/07/2024",
  tagline: "Phát triển ứng dụng · Giải pháp AI · AI Agent · SEO",
  address: {
    locality: "Bình Sơn",
    region: "Quảng Ngãi",
    country: "Việt Nam",
    full: "Bình Sơn, Quảng Ngãi, Việt Nam",
  },
  phone: "0974 374 744",
  phoneHref: "tel:0974374744",
  zalo: "https://zalo.me/0974374744",
  email: "vieetjk@gmail.com",
  facebook: "https://fb.com/vieetjk",
  hours: "Thứ 2 – Thứ 7 · 8:00 – 17:30",
  mapEmbed: "https://www.google.com/maps?q=B%C3%ACnh%20S%C6%A1n%2C%20Qu%E1%BA%A3ng%20Ng%C3%A3i&output=embed",
  mapLink: "https://www.google.com/maps/search/?api=1&query=B%C3%ACnh%20S%C6%A1n%2C%20Qu%E1%BA%A3ng%20Ng%C3%A3i",
};

export const SEO = {
  title: "Vieetjk — Công ty giải pháp công nghệ: phát triển app, AI, AI Agent, SEO",
  description:
    "Công ty giải pháp công nghệ Vieetjk (thành lập 18/07/2024, Bình Sơn, Quảng Ngãi) — phát triển ứng dụng di động & web, tích hợp AI, xây dựng AI Agent tự động hoá và SEO tổng thể cho doanh nghiệp Việt.",
  keywords: [
    "Vieetjk",
    "công ty công nghệ Quảng Ngãi",
    "phát triển app",
    "làm ứng dụng di động",
    "thiết kế website",
    "giải pháp AI",
    "AI Agent",
    "chatbot AI",
    "tự động hoá quy trình",
    "dịch vụ SEO",
    "chuyển đổi số",
  ],
};

export const HERO = {
  eyebrow: `Thành lập ${COMPANY.foundedLabel} · ${COMPANY.address.locality}, ${COMPANY.address.region}`,
  title: "Công nghệ & AI\nlàm việc cho doanh nghiệp của bạn",
  sub:
    "Vieetjk thiết kế và phát triển ứng dụng, đưa AI vào vận hành và xây dựng các AI Agent biết tự xử lý công việc — để doanh nghiệp Việt bán hàng tốt hơn, phục vụ khách nhanh hơn và tiết kiệm chi phí.",
};

/** Số liệu nổi bật — cập nhật theo thực tế. */
export const STATS = [
  { value: "2024", label: "Năm thành lập" },
  { value: "30+", label: "Dự án đã triển khai" },
  { value: "12+", label: "Kỹ sư & chuyên gia" },
  { value: "24/7", label: "Giám sát & hỗ trợ vận hành" },
];

export const ABOUT = {
  title: "Đội ngũ công nghệ trẻ, xuất phát từ Quảng Ngãi",
  paragraphs: [
    `${COMPANY.legalName} được thành lập ngày ${COMPANY.foundedLabel} tại ${COMPANY.address.locality}, ${COMPANY.address.region} — vùng đất của Khu kinh tế Dung Quất, nơi doanh nghiệp đang chuyển mình mạnh mẽ và cần những công cụ số thật sự hữu ích.`,
    "Chúng tôi bắt đầu từ việc tự xây dựng sản phẩm cho chính mình: một nền tảng quản lý studio dùng hằng ngày, một trợ lý AI tư vấn khách trên website, một hệ thống nhận diện khuôn mặt giúp khách tìm ảnh trong vài giây. Những bài học vận hành thật đó trở thành cách chúng tôi làm dự án cho khách hàng: ít lý thuyết, nhiều kết quả đo được.",
  ],
  pillars: [
    {
      title: "Sứ mệnh",
      text: "Đưa công nghệ và trí tuệ nhân tạo đến gần doanh nghiệp vừa và nhỏ, với chi phí hợp lý và hiệu quả rõ ràng.",
    },
    {
      title: "Tầm nhìn",
      text: "Trở thành đối tác công nghệ & AI đáng tin cậy hàng đầu khu vực miền Trung, vươn ra thị trường cả nước và quốc tế.",
    },
    {
      title: "Giá trị cốt lõi",
      text: "Tận tâm — Minh bạch — Sáng tạo — Cam kết kết quả. Mỗi dòng code đều phục vụ một mục tiêu kinh doanh cụ thể.",
    },
  ],
};

// ── Dịch vụ ─────────────────────────────────────────────────────────────────
export type IconKey =
  | "app"
  | "web"
  | "ai"
  | "agent"
  | "seo"
  | "cloud";

export type Feature = { title: string; text: string };
export type Step = { title: string; text: string; time: string };
export type QA = { q: string; a: string };

export type Service = {
  slug: string;
  icon: IconKey;
  /** Tên ngắn trên menu & thẻ. */
  name: string;
  /** H1 của trang chi tiết. */
  title: string;
  short: string;
  intro: string;
  /** Mô tả SEO của trang chi tiết. */
  seoDescription: string;
  highlights: string[];
  features: Feature[];
  steps: Step[];
  tech: string[];
  faq: QA[];
};

export const SERVICES: Service[] = [
  {
    slug: "phat-trien-ung-dung",
    icon: "app",
    name: "Phát triển ứng dụng",
    title: "Phát triển ứng dụng di động iOS & Android",
    short: "App iOS/Android đa nền tảng, từ ý tưởng tới khi lên App Store và Google Play.",
    intro:
      "Chúng tôi thiết kế và lập trình ứng dụng di động mượt, đẹp và dễ dùng — từ app bán hàng, đặt lịch, thành viên, tới app quản lý nội bộ cho đội ngũ. Một mã nguồn chạy cả iOS và Android giúp tiết kiệm đến 40% chi phí.",
    seoDescription:
      "Dịch vụ phát triển ứng dụng di động iOS & Android trọn gói tại Vieetjk: thiết kế UI/UX, lập trình Flutter/React Native, tích hợp thanh toán, đưa app lên App Store & Google Play, bảo trì dài hạn.",
    highlights: [
      "Thiết kế UI/UX riêng, chuẩn trải nghiệm người Việt",
      "Một mã nguồn cho cả iOS & Android",
      "Tích hợp thanh toán, Zalo, thông báo đẩy",
      "Hỗ trợ đưa app lên App Store & Google Play",
    ],
    features: [
      { title: "App bán hàng & thương mại điện tử", text: "Danh mục sản phẩm, giỏ hàng, mã giảm giá, thanh toán QR/ví điện tử, theo dõi đơn hàng." },
      { title: "App đặt lịch & dịch vụ", text: "Đặt lịch spa, phòng khám, studio, sửa chữa… kèm nhắc lịch tự động và thanh toán cọc." },
      { title: "App thành viên & tích điểm", text: "Thẻ thành viên số, tích điểm đổi quà, ưu đãi theo hạng, chăm sóc khách hàng thân thiết." },
      { title: "App quản lý nội bộ", text: "Chấm công, giao việc, báo cáo hiện trường có ảnh & định vị, duyệt đề xuất ngay trên điện thoại." },
      { title: "Tích hợp AI trong app", text: "Trợ lý ảo trong ứng dụng, nhận diện hình ảnh, quét giấy tờ (OCR), gợi ý sản phẩm thông minh." },
      { title: "Ứng dụng máy tính (desktop)", text: "Phần mềm Windows/macOS nhẹ, đồng bộ dữ liệu với hệ thống web, chạy được cả khi mất mạng." },
    ],
    steps: [
      { title: "Khảo sát & phác thảo", text: "Làm rõ mục tiêu, người dùng, tính năng cốt lõi và lên phạm vi phiên bản đầu (MVP).", time: "1 tuần" },
      { title: "Thiết kế UI/UX", text: "Wireframe, giao diện chi tiết và bản mẫu bấm thử được trước khi lập trình.", time: "1–2 tuần" },
      { title: "Lập trình theo sprint", text: "Mỗi 2 tuần bàn giao một bản chạy thử để bạn trải nghiệm và góp ý.", time: "4–10 tuần" },
      { title: "Kiểm thử & phát hành", text: "Kiểm thử trên nhiều dòng máy, nộp duyệt App Store/Google Play.", time: "1–2 tuần" },
    ],
    tech: ["Flutter", "React Native", "Swift", "Kotlin", "Firebase", "Supabase", "Node.js", "PostgreSQL", "Tauri"],
    faq: [
      { q: "Làm một ứng dụng di động mất bao lâu?", a: "Phiên bản đầu (MVP) thường hoàn thành trong 6–12 tuần tuỳ số lượng tính năng. Chúng tôi chia nhỏ theo sprint 2 tuần để bạn thấy tiến độ liên tục." },
      { q: "Chi phí làm app được tính thế nào?", a: "Báo giá dựa trên phạm vi tính năng và số màn hình cụ thể sau buổi khảo sát miễn phí. Bạn luôn nhận bảng chi tiết từng hạng mục, không có chi phí ẩn." },
      { q: "Tôi có được sở hữu mã nguồn không?", a: "Có. Toàn bộ mã nguồn, tài khoản và tài liệu kỹ thuật được bàn giao cho doanh nghiệp khi nghiệm thu." },
    ],
  },
  {
    slug: "phat-trien-web",
    icon: "web",
    name: "Website & phần mềm",
    title: "Thiết kế website & phát triển phần mềm doanh nghiệp",
    short: "Website chuẩn SEO, web app, nền tảng SaaS, CRM/ERP may đo theo quy trình riêng.",
    intro:
      "Từ website giới thiệu tải nhanh dưới 2 giây tới hệ thống quản lý phức tạp nhiều chi nhánh — chúng tôi xây phần mềm vừa khít với cách doanh nghiệp bạn đang làm việc, thay vì bắt bạn đổi quy trình theo phần mềm.",
    seoDescription:
      "Thiết kế website chuẩn SEO, phát triển web app, phần mềm quản lý CRM/ERP và nền tảng SaaS theo yêu cầu tại Vieetjk. Tốc độ cao, bảo mật, dễ mở rộng.",
    highlights: [
      "Website tải nhanh, chuẩn SEO, đẹp trên mọi thiết bị",
      "Phần mềm may đo theo quy trình thực tế",
      "Phân quyền, nhiều chi nhánh, báo cáo trực quan",
      "Hạ tầng đám mây ổn định, sao lưu tự động",
    ],
    features: [
      { title: "Website doanh nghiệp", text: "Giới thiệu công ty, sản phẩm, tin tức, đa ngôn ngữ; quản trị nội dung dễ như soạn văn bản." },
      { title: "Website bán hàng", text: "Giỏ hàng, thanh toán, quản lý tồn kho, kết nối đơn vị vận chuyển và sàn thương mại điện tử." },
      { title: "CRM & quản lý khách hàng", text: "Lưu trữ khách hàng, lịch sử giao dịch, chăm sóc tự động qua Zalo/email, phễu bán hàng." },
      { title: "ERP & quản trị vận hành", text: "Hợp đồng, kho, nhân sự, kế toán nội bộ, phê duyệt nhiều cấp trong một hệ thống thống nhất." },
      { title: "Nền tảng SaaS", text: "Thiết kế kiến trúc nhiều khách thuê (multi-tenant), gói cước, thanh toán định kỳ, trang quản trị." },
      { title: "Tích hợp hệ thống", text: "Kết nối ngân hàng, cổng thanh toán, hoá đơn điện tử, Google Workspace và các API sẵn có." },
    ],
    steps: [
      { title: "Phân tích nghiệp vụ", text: "Ngồi cùng đội ngũ của bạn, vẽ lại quy trình hiện tại và chỉ ra điểm có thể tự động hoá.", time: "1–2 tuần" },
      { title: "Thiết kế giải pháp", text: "Kiến trúc hệ thống, cơ sở dữ liệu và giao diện được duyệt trước khi lập trình.", time: "1–2 tuần" },
      { title: "Phát triển & bàn giao từng phần", text: "Ra mắt dần từng phân hệ để đội ngũ dùng sớm và góp ý.", time: "4–16 tuần" },
      { title: "Đào tạo & vận hành", text: "Hướng dẫn sử dụng, chuyển dữ liệu cũ, theo dõi hệ thống sau khi chạy thật.", time: "Liên tục" },
    ],
    tech: ["Next.js", "React", "TypeScript", "Node.js", "Python", "PostgreSQL", "Supabase", "Tailwind CSS", "Vercel"],
    faq: [
      { q: "Website có chuẩn SEO ngay từ đầu không?", a: "Có. Mọi website đều được tối ưu tốc độ, cấu trúc tiêu đề, dữ liệu có cấu trúc (schema), sitemap và hiển thị tốt trên di động ngay khi bàn giao." },
      { q: "Tôi có tự sửa nội dung được không?", a: "Được. Chúng tôi xây trang quản trị đơn giản để bạn tự cập nhật bài viết, sản phẩm, hình ảnh mà không cần biết lập trình." },
      { q: "Phần mềm có mở rộng được về sau không?", a: "Kiến trúc được thiết kế theo mô-đun nên có thể bổ sung tính năng, chi nhánh hay ứng dụng di động mà không phải làm lại từ đầu." },
    ],
  },
  {
    slug: "giai-phap-ai",
    icon: "ai",
    name: "Giải pháp AI",
    title: "Giải pháp trí tuệ nhân tạo (AI) cho doanh nghiệp",
    short: "Chatbot AI, trợ lý tra cứu tài liệu, thị giác máy tính, phân tích dữ liệu & dự báo.",
    intro:
      "AI không còn là thứ xa xỉ. Chúng tôi giúp doanh nghiệp chọn đúng bài toán, đúng mô hình và tích hợp AI vào công việc hằng ngày — từ trả lời khách hàng, đọc hoá đơn chứng từ tới dự báo doanh số — với dữ liệu được bảo mật tuyệt đối.",
    seoDescription:
      "Giải pháp AI cho doanh nghiệp tại Vieetjk: chatbot AI tư vấn khách hàng, trợ lý tra cứu tài liệu nội bộ (RAG), nhận diện hình ảnh, OCR chứng từ, phân tích dữ liệu và dự báo.",
    highlights: [
      "Tư vấn chọn đúng bài toán AI mang lại lợi nhuận",
      "Làm việc với dữ liệu tiếng Việt",
      "Dữ liệu doanh nghiệp được bảo mật, không dùng để huấn luyện công khai",
      "Đo lường hiệu quả bằng chỉ số cụ thể",
    ],
    features: [
      { title: "Chatbot AI tư vấn khách hàng", text: "Trả lời khách 24/7 trên website, Zalo, Facebook theo đúng giọng thương hiệu; tự xin số điện thoại và chuyển cho nhân viên." },
      { title: "Trợ lý tri thức nội bộ (RAG)", text: "Hỏi đáp trên chính tài liệu, quy trình, hợp đồng của công ty — có trích dẫn nguồn, phân quyền theo phòng ban." },
      { title: "Thị giác máy tính", text: "Nhận diện khuôn mặt, đếm sản phẩm, kiểm tra lỗi trên dây chuyền, phân loại hình ảnh tự động." },
      { title: "Đọc chứng từ (OCR + AI)", text: "Trích xuất dữ liệu từ hoá đơn, CCCD, hợp đồng, phiếu kho và nhập thẳng vào phần mềm." },
      { title: "Phân tích dữ liệu & dự báo", text: "Bảng điều khiển trực quan, dự báo doanh số, tồn kho, phát hiện bất thường trong giao dịch." },
      { title: "Tạo nội dung bằng AI", text: "Viết mô tả sản phẩm, bài quảng cáo, kịch bản video, hình ảnh minh hoạ theo bộ nhận diện thương hiệu." },
    ],
    steps: [
      { title: "Đánh giá bài toán", text: "Xác định quy trình tốn thời gian nhất và ước lượng hiệu quả nếu áp dụng AI.", time: "3–5 ngày" },
      { title: "Bản thử nghiệm (PoC)", text: "Dựng nhanh một bản chạy được trên dữ liệu thật để kiểm chứng độ chính xác.", time: "2–3 tuần" },
      { title: "Tích hợp vào hệ thống", text: "Kết nối AI với phần mềm, kênh chat và quy trình làm việc hiện có.", time: "3–8 tuần" },
      { title: "Giám sát & cải thiện", text: "Theo dõi chất lượng câu trả lời, chi phí vận hành và tinh chỉnh định kỳ.", time: "Liên tục" },
    ],
    tech: ["Claude", "GPT", "Gemini", "Python", "LangChain", "pgvector", "TensorFlow", "MediaPipe", "OpenCV"],
    faq: [
      { q: "Dữ liệu của tôi có bị lộ khi dùng AI không?", a: "Chúng tôi dùng các gói API doanh nghiệp không lấy dữ liệu để huấn luyện, mã hoá dữ liệu khi lưu trữ và có thể triển khai mô hình trên máy chủ riêng khi cần." },
      { q: "AI có trả lời sai không?", a: "Mọi hệ thống đều được giới hạn trong nguồn dữ liệu của bạn, có cơ chế trích dẫn và chuyển cho người thật khi không chắc chắn. Chúng tôi đo độ chính xác trước khi đưa vào sử dụng." },
      { q: "Doanh nghiệp nhỏ có nên dùng AI?", a: "Rất nên. Một chatbot tư vấn hoặc trợ lý đọc chứng từ thường hoàn vốn chỉ sau vài tháng nhờ tiết kiệm thời gian của nhân viên." },
    ],
  },
  {
    slug: "ai-agent",
    icon: "agent",
    name: "AI Agent",
    title: "AI Agent — nhân viên số tự động hoá công việc",
    short: "Agent tự lập kế hoạch, dùng công cụ và hoàn thành trọn vẹn công việc thay con người.",
    intro:
      "Khác với chatbot chỉ biết trả lời, AI Agent có thể hành động: đọc email, tra cứu hệ thống, tạo đơn hàng, gửi tin nhắn, cập nhật báo cáo… và chỉ hỏi ý kiến con người ở những bước quan trọng. Chúng tôi thiết kế, xây dựng và vận hành các AI Agent như những nhân viên số làm việc 24/7.",
    seoDescription:
      "Xây dựng AI Agent cho doanh nghiệp tại Vieetjk: agent chăm sóc khách hàng, agent bán hàng, agent kế toán – vận hành, hệ thống đa agent, kết nối CRM/ERP/Zalo qua công cụ và MCP, có kiểm soát của con người.",
    highlights: [
      "Tự xử lý trọn quy trình nhiều bước",
      "Kết nối CRM, ERP, Zalo, email, Google Sheets…",
      "Con người duyệt ở các bước quan trọng",
      "Nhật ký minh bạch từng hành động của agent",
    ],
    features: [
      { title: "Agent chăm sóc khách hàng", text: "Tiếp nhận yêu cầu từ mọi kênh, tra đơn hàng, đổi lịch, xử lý khiếu nại đơn giản và báo cáo cuối ngày." },
      { title: "Agent bán hàng", text: "Tư vấn sản phẩm, báo giá tự động, nhắc khách chưa chốt đơn, cập nhật cơ hội vào CRM." },
      { title: "Agent vận hành & kế toán", text: "Đối soát giao dịch ngân hàng, nhập liệu chứng từ, nhắc công nợ, lập báo cáo định kỳ." },
      { title: "Agent nhân sự", text: "Sàng lọc hồ sơ ứng viên, đặt lịch phỏng vấn, trả lời câu hỏi chính sách cho nhân viên." },
      { title: "Agent marketing & SEO", text: "Nghiên cứu từ khoá, lên kế hoạch nội dung, viết nháp bài và theo dõi thứ hạng tự động." },
      { title: "Hệ thống đa agent", text: "Nhiều agent chuyên môn phối hợp với nhau dưới một agent điều phối để xử lý quy trình phức tạp." },
    ],
    steps: [
      { title: "Chọn quy trình", text: "Tìm quy trình lặp lại, nhiều bước, tốn nhiều giờ công nhất để tự động hoá trước.", time: "1 tuần" },
      { title: "Thiết kế agent", text: "Định nghĩa vai trò, công cụ được phép dùng, giới hạn quyền và điểm cần con người duyệt.", time: "1–2 tuần" },
      { title: "Xây dựng & kiểm thử", text: "Chạy agent trên tình huống thật trong môi trường thử nghiệm, đo tỉ lệ hoàn thành.", time: "3–6 tuần" },
      { title: "Vận hành có giám sát", text: "Theo dõi nhật ký, chi phí, chất lượng và mở rộng dần phạm vi công việc.", time: "Liên tục" },
    ],
    tech: ["Claude Agent SDK", "MCP", "LangGraph", "OpenAI Agents", "Python", "Node.js", "Supabase", "n8n", "Zalo API"],
    faq: [
      { q: "AI Agent khác chatbot thế nào?", a: "Chatbot chủ yếu trả lời câu hỏi. AI Agent lập kế hoạch và thực hiện hành động thật trên hệ thống — tạo đơn, gửi tin, cập nhật dữ liệu — để hoàn thành trọn một công việc." },
      { q: "Agent có tự ý làm sai không?", a: "Agent chỉ được dùng những công cụ và quyền hạn đã cấp. Các thao tác quan trọng như chuyển tiền, gửi hợp đồng luôn chờ người duyệt, và mọi hành động đều được ghi nhật ký." },
      { q: "Agent có thay thế nhân viên không?", a: "Agent đảm nhận phần việc lặp lại, giúp nhân viên tập trung vào khách hàng và công việc sáng tạo. Phần lớn doanh nghiệp dùng agent để tăng năng suất chứ không phải cắt giảm người." },
    ],
  },
  {
    slug: "seo",
    icon: "seo",
    name: "SEO & Marketing số",
    title: "Dịch vụ SEO tổng thể & Marketing số",
    short: "Đưa website lên top Google bền vững: SEO kỹ thuật, nội dung, SEO địa phương.",
    intro:
      "Khách hàng tìm bạn trên Google mỗi ngày. Chúng tôi kết hợp SEO kỹ thuật, nội dung chất lượng và sức mạnh của AI để website của bạn xuất hiện đúng lúc khách cần — kể cả trên Google Maps và trong câu trả lời của các công cụ tìm kiếm AI.",
    seoDescription:
      "Dịch vụ SEO tổng thể tại Vieetjk: audit & SEO kỹ thuật, nghiên cứu từ khoá, sản xuất nội dung chuẩn SEO, SEO local Google Maps, tối ưu hiển thị trên công cụ tìm kiếm AI, báo cáo minh bạch hằng tháng.",
    highlights: [
      "Audit kỹ thuật toàn diện miễn phí",
      "Nội dung chuyên sâu, viết cho người đọc thật",
      "SEO địa phương trên Google Maps",
      "Báo cáo thứ hạng & lượt truy cập hằng tháng",
    ],
    features: [
      { title: "SEO kỹ thuật", text: "Tối ưu tốc độ (Core Web Vitals), cấu trúc URL, sitemap, dữ liệu có cấu trúc, khắc phục lỗi lập chỉ mục." },
      { title: "Nghiên cứu từ khoá", text: "Phân tích hành vi tìm kiếm của khách hàng và đối thủ để chọn bộ từ khoá mang lại đơn hàng." },
      { title: "Nội dung chuẩn SEO", text: "Kế hoạch nội dung theo cụm chủ đề, bài viết chuyên sâu kết hợp AI và biên tập viên." },
      { title: "SEO địa phương (Local SEO)", text: "Tối ưu Google Business Profile, đánh giá, bản đồ — hút khách quanh khu vực của bạn." },
      { title: "Tối ưu cho tìm kiếm AI", text: "Giúp thương hiệu được nhắc tới trong câu trả lời của các trợ lý và công cụ tìm kiếm dùng AI." },
      { title: "Quảng cáo & đo lường", text: "Google Ads, Facebook Ads, thiết lập Google Analytics 4 và theo dõi chuyển đổi chính xác." },
    ],
    steps: [
      { title: "Audit & đặt mục tiêu", text: "Đánh giá hiện trạng website, đối thủ và thống nhất chỉ số cần đạt.", time: "1 tuần" },
      { title: "Sửa nền tảng kỹ thuật", text: "Khắc phục lỗi kỹ thuật, tối ưu tốc độ và cấu trúc trang.", time: "2–4 tuần" },
      { title: "Nội dung & liên kết", text: "Triển khai kế hoạch nội dung hằng tháng, xây dựng uy tín tên miền.", time: "3–6 tháng" },
      { title: "Đo lường & tối ưu", text: "Báo cáo minh bạch hằng tháng, điều chỉnh chiến lược theo dữ liệu.", time: "Liên tục" },
    ],
    tech: ["Google Search Console", "GA4", "Google Business Profile", "Ahrefs", "Screaming Frog", "PageSpeed Insights", "Schema.org", "Looker Studio"],
    faq: [
      { q: "Bao lâu thì website lên top Google?", a: "Với từ khoá cạnh tranh vừa phải, kết quả rõ rệt thường xuất hiện sau 3–6 tháng. SEO địa phương có thể nhanh hơn, chỉ vài tuần." },
      { q: "Vieetjk có cam kết thứ hạng không?", a: "Chúng tôi cam kết bằng kế hoạch, khối lượng công việc và báo cáo minh bạch. Không đơn vị nào kiểm soát được thuật toán của Google, nên hãy cẩn trọng với lời hứa 'top 1 trong 7 ngày'." },
      { q: "Dùng AI viết bài có bị Google phạt không?", a: "Google đánh giá chất lượng nội dung chứ không phải công cụ tạo ra nó. Bài viết của chúng tôi luôn được chuyên gia biên tập, kiểm chứng thông tin và bổ sung kinh nghiệm thực tế." },
    ],
  },
  {
    slug: "chuyen-doi-so",
    icon: "cloud",
    name: "Chuyển đổi số & Cloud",
    title: "Tư vấn chuyển đổi số, Cloud & tự động hoá quy trình",
    short: "Lộ trình chuyển đổi số thực tế, hạ tầng đám mây, bảo mật và tự động hoá.",
    intro:
      "Chuyển đổi số không bắt đầu bằng phần mềm đắt tiền mà bằng việc hiểu đúng cách doanh nghiệp vận hành. Chúng tôi cùng bạn xây lộ trình từng bước, chọn công cụ phù hợp ngân sách, đưa hệ thống lên đám mây an toàn và tự động hoá những việc lặp lại.",
    seoDescription:
      "Tư vấn chuyển đổi số cho doanh nghiệp vừa và nhỏ tại Vieetjk: lộ trình số hoá, triển khai hạ tầng Cloud, DevOps, bảo mật – sao lưu dữ liệu, tự động hoá quy trình với AI.",
    highlights: [
      "Lộ trình số hoá phù hợp quy mô & ngân sách",
      "Hạ tầng đám mây ổn định, chi phí tối ưu",
      "Bảo mật, phân quyền và sao lưu tự động",
      "Đào tạo đội ngũ sử dụng thành thạo",
    ],
    features: [
      { title: "Đánh giá mức độ số hoá", text: "Khảo sát quy trình, công cụ và dữ liệu hiện có; xác định ưu tiên đầu tư mang lại hiệu quả nhanh nhất." },
      { title: "Hạ tầng Cloud", text: "Thiết kế, di chuyển và vận hành hệ thống trên AWS, Google Cloud hoặc máy chủ trong nước." },
      { title: "DevOps & giám sát", text: "Triển khai tự động (CI/CD), giám sát hệ thống 24/7, cảnh báo sự cố trước khi khách hàng phát hiện." },
      { title: "Bảo mật & sao lưu", text: "Phân quyền truy cập, mã hoá dữ liệu, sao lưu định kỳ và kế hoạch khôi phục khi có sự cố." },
      { title: "Tự động hoá quy trình", text: "Kết nối các ứng dụng rời rạc, tự động gửi báo cáo, nhắc việc, đồng bộ dữ liệu giữa các phòng ban." },
      { title: "Đào tạo & chuyển giao", text: "Đào tạo đội ngũ sử dụng công cụ số và AI vào công việc hằng ngày, kèm tài liệu hướng dẫn." },
    ],
    steps: [
      { title: "Khảo sát hiện trạng", text: "Phỏng vấn các bộ phận, đo thời gian xử lý từng quy trình chính.", time: "1–2 tuần" },
      { title: "Xây lộ trình", text: "Đề xuất lộ trình 3–12 tháng, ưu tiên các hạng mục hoàn vốn nhanh.", time: "1 tuần" },
      { title: "Triển khai theo giai đoạn", text: "Làm từng phần, đo kết quả sau mỗi giai đoạn trước khi mở rộng.", time: "Theo lộ trình" },
      { title: "Đồng hành vận hành", text: "Hỗ trợ kỹ thuật, bảo trì và cải tiến liên tục.", time: "Liên tục" },
    ],
    tech: ["AWS", "Google Cloud", "Docker", "GitHub Actions", "Cloudflare", "Vercel", "Google Workspace", "n8n", "Zapier"],
    faq: [
      { q: "Doanh nghiệp nhỏ nên bắt đầu chuyển đổi số từ đâu?", a: "Thường là từ quản lý khách hàng, bán hàng và tài chính — những nơi dữ liệu đang nằm rải rác trong sổ sách, Excel và tin nhắn. Số hoá những phần này mang lại hiệu quả nhanh nhất." },
      { q: "Đưa dữ liệu lên đám mây có an toàn không?", a: "Có, nếu được cấu hình đúng: mã hoá, phân quyền chặt chẽ, xác thực hai lớp và sao lưu nhiều nơi. Chúng tôi áp dụng đầy đủ các lớp bảo vệ này cho mọi hệ thống." },
      { q: "Có hỗ trợ sau khi triển khai không?", a: "Có. Chúng tôi cung cấp gói bảo trì, giám sát và hỗ trợ kỹ thuật theo tháng hoặc theo năm." },
    ],
  },
];

export function getService(slug: string | undefined): Service | null {
  if (!slug) return null;
  return SERVICES.find((s) => s.slug === slug) ?? null;
}

// ── AI Agent nổi bật ở trang chủ ───────────────────────────────────────────
export const AGENT = {
  eyebrow: "Trọng tâm 2026",
  title: "AI Agent — nhân viên số làm việc không nghỉ",
  lead:
    "Một AI Agent không chỉ trả lời câu hỏi. Nó hiểu yêu cầu, tự lập kế hoạch, sử dụng phần mềm của bạn như một nhân viên thật và báo lại kết quả — chỉ dừng lại xin ý kiến ở những bước quan trọng.",
  loop: [
    { title: "Tiếp nhận", text: "Nhận yêu cầu từ Zalo, website, email, điện thoại hay lịch hẹn." },
    { title: "Hiểu ngữ cảnh", text: "Đọc dữ liệu, tài liệu và lịch sử khách hàng của doanh nghiệp." },
    { title: "Lập kế hoạch", text: "Chia công việc thành từng bước và chọn công cụ phù hợp." },
    { title: "Hành động", text: "Thao tác trên CRM, ERP, bảng tính, gửi tin nhắn, tạo chứng từ." },
    { title: "Kiểm soát", text: "Con người duyệt bước quan trọng; mọi hành động đều ghi nhật ký." },
  ],
  uses: [
    "Chăm sóc khách hàng đa kênh 24/7",
    "Báo giá & chốt đơn tự động",
    "Đối soát ngân hàng, nhắc công nợ",
    "Nhập liệu hoá đơn, chứng từ",
    "Lên lịch hẹn & nhắc lịch",
    "Viết nội dung & theo dõi SEO",
  ],
};

/** Dòng chạy trong khung "console" ở hero — minh hoạ một agent đang làm việc. */
export const CONSOLE_LINES = [
  { kind: "cmd", text: 'agent.run("Yêu cầu đổi lịch giao hàng #2481")' },
  { kind: "ok", text: "Đọc tin nhắn Zalo của khách: “Cho mình dời sang thứ Sáu nhé”" },
  { kind: "ok", text: "Tra đơn hàng ĐH-2481 trên CRM · trạng thái: chờ giao" },
  { kind: "ok", text: "Kiểm tra lịch xe giao hàng · còn trống Thứ Sáu 14:00" },
  { kind: "ok", text: "Cập nhật đơn hàng & gửi xác nhận cho khách" },
  { kind: "done", text: "Hoàn tất trong 4,2 giây · không cần người can thiệp" },
] as const;

// ── Sản phẩm do Vieetjk tự phát triển (đang vận hành thật) ─────────────────
export const PRODUCTS = [
  {
    name: "mstudo",
    tag: "Nền tảng SaaS",
    text: "Phần mềm quản lý studio ảnh: hợp đồng điện tử, báo giá, lịch chụp, đội ngũ, thanh toán và album gửi khách — trong một nơi.",
    href: "https://mstudo.com",
  },
  {
    name: "Tìm ảnh bằng khuôn mặt",
    tag: "Thị giác máy tính",
    text: "Khách chỉ cần một ảnh selfie là AI tự lọc ra mọi tấm ảnh có mình trong album hàng nghìn ảnh của sự kiện.",
    href: null,
  },
  {
    name: "Trợ lý AI tư vấn khách",
    tag: "AI Agent",
    text: "Agent trò chuyện tư vấn dịch vụ trên website, tra cứu bảng giá thật, xin số điện thoại và báo lead về Zalo của chủ doanh nghiệp.",
    href: null,
  },
  {
    name: "MStudo Desktop",
    tag: "Ứng dụng máy tính",
    text: "Ứng dụng Windows tự lưu hợp đồng PDF/Word ngay khi khách ký và xuất Excel dữ liệu hằng ngày để chống mất dữ liệu.",
    href: null,
  },
];

// ── Lĩnh vực phục vụ ────────────────────────────────────────────────────────
export type IndustryKey = "retail" | "edu" | "health" | "realestate" | "travel" | "industry";
export const INDUSTRIES: { key: IndustryKey; name: string; text: string }[] = [
  { key: "retail", name: "Bán lẻ & thương mại điện tử", text: "App bán hàng, quản lý kho, chatbot chốt đơn đa kênh." },
  { key: "edu", name: "Giáo dục & đào tạo", text: "Nền tảng học trực tuyến, quản lý học viên, trợ lý AI giải đáp." },
  { key: "health", name: "Y tế & chăm sóc sắc đẹp", text: "Đặt lịch khám, hồ sơ khách hàng, nhắc lịch tái khám tự động." },
  { key: "realestate", name: "Bất động sản & xây dựng", text: "CRM môi giới, quản lý dự án, báo cáo công trình qua di động." },
  { key: "travel", name: "Du lịch, nhà hàng & khách sạn", text: "Đặt phòng, gọi món, chăm sóc khách lưu trú bằng AI." },
  { key: "industry", name: "Sản xuất & công nghiệp", text: "Số hoá quy trình nhà máy, AI kiểm tra chất lượng, quản lý bảo trì." },
];

// ── Quy trình hợp tác chung ────────────────────────────────────────────────
export const PROCESS = [
  { title: "Lắng nghe", text: "Buổi tư vấn miễn phí để hiểu mục tiêu, ngân sách và thời hạn của bạn." },
  { title: "Đề xuất giải pháp", text: "Phương án kỹ thuật, phạm vi, tiến độ và báo giá minh bạch từng hạng mục." },
  { title: "Thiết kế & phát triển", text: "Làm theo sprint 2 tuần, bạn xem và góp ý trên bản chạy thật." },
  { title: "Kiểm thử & bàn giao", text: "Kiểm thử kỹ lưỡng, đào tạo sử dụng, bàn giao mã nguồn và tài liệu." },
  { title: "Đồng hành dài hạn", text: "Bảo trì, giám sát, tối ưu và phát triển thêm tính năng khi doanh nghiệp lớn lên." },
];

// ── Công nghệ ───────────────────────────────────────────────────────────────
export const TECH_GROUPS = [
  { name: "Di động", items: ["Flutter", "React Native", "Swift", "Kotlin"] },
  { name: "Web & Backend", items: ["Next.js", "React", "TypeScript", "Node.js", "Python", "FastAPI"] },
  { name: "AI & Agent", items: ["Claude", "GPT", "Gemini", "MCP", "LangGraph", "RAG", "TensorFlow"] },
  { name: "Dữ liệu & Cloud", items: ["PostgreSQL", "Supabase", "Redis", "Docker", "AWS", "Google Cloud", "Vercel"] },
];

// ── Vì sao chọn Vieetjk ─────────────────────────────────────────────────────
export const COMMITMENTS = [
  { title: "Tư vấn & khảo sát miễn phí", text: "Hiểu rõ bài toán trước khi báo giá — không phát sinh chi phí nếu bạn chưa đồng ý." },
  { title: "Báo giá minh bạch", text: "Chi tiết từng hạng mục, cam kết tiến độ trong hợp đồng, không chi phí ẩn." },
  { title: "Bàn giao mã nguồn", text: "Doanh nghiệp sở hữu toàn bộ mã nguồn, dữ liệu và tài khoản hệ thống." },
  { title: "Bảo mật thông tin", text: "Ký thoả thuận bảo mật (NDA), dữ liệu được mã hoá và phân quyền chặt chẽ." },
  { title: "Bảo hành 12 tháng", text: "Sửa lỗi miễn phí trong thời gian bảo hành, phản hồi sự cố nhanh chóng." },
  { title: "Gần gũi, đồng hành", text: "Đội ngũ ngay tại Quảng Ngãi — gặp trực tiếp được, hỗ trợ trực tuyến toàn quốc." },
];

// ── Câu hỏi thường gặp (trang chủ) ──────────────────────────────────────────
export const FAQ: QA[] = [
  {
    q: "Vieetjk nhận dự án ở những tỉnh thành nào?",
    a: `Chúng tôi đặt trụ sở tại ${COMPANY.address.full} và làm việc với khách hàng trên toàn quốc. Khách ở khu vực Quảng Ngãi và miền Trung có thể gặp trực tiếp; các nơi khác làm việc trực tuyến xuyên suốt dự án.`,
  },
  {
    q: "Tôi chỉ có ý tưởng, chưa có tài liệu yêu cầu thì có làm được không?",
    a: "Hoàn toàn được. Buổi tư vấn đầu tiên sẽ giúp bạn biến ý tưởng thành danh sách tính năng, ưu tiên và lộ trình cụ thể — hoàn toàn miễn phí.",
  },
  {
    q: "Chi phí một dự án khoảng bao nhiêu?",
    a: "Tuỳ phạm vi: một website giới thiệu, một chatbot AI hay một hệ thống quản lý có chi phí rất khác nhau. Sau khi khảo sát, bạn nhận báo giá chi tiết từng hạng mục và có thể chọn làm theo từng giai đoạn để phù hợp ngân sách.",
  },
  {
    q: "Sau khi bàn giao, ai sẽ bảo trì hệ thống?",
    a: "Mọi dự án được bảo hành 12 tháng. Sau đó bạn có thể chọn gói bảo trì định kỳ của Vieetjk hoặc tự vận hành với tài liệu và mã nguồn đã được bàn giao đầy đủ.",
  },
  {
    q: "AI Agent có phù hợp với doanh nghiệp nhỏ không?",
    a: "Có. Doanh nghiệp nhỏ thường được lợi nhiều nhất vì mỗi giờ công tiết kiệm đều rất đáng giá. Chúng tôi thường bắt đầu với một agent cho một quy trình cụ thể, đo hiệu quả rồi mới mở rộng.",
  },
];

/** Lựa chọn ngân sách trong form liên hệ. */
export const BUDGETS = ["Chưa xác định", "Dưới 30 triệu", "30 – 100 triệu", "100 – 300 triệu", "Trên 300 triệu"];

/** Đường dẫn công khai cho sitemap.xml. */
export function aiSitemapPaths(): { path: string; priority: string }[] {
  return [{ path: "/", priority: "1.0" }, ...SERVICES.map((s) => ({ path: `/${s.slug}`, priority: "0.8" }))];
}
