// ────────────────────────────────────────────────────────────────────────────
//  NỘI DUNG TRANG AI.VIEETJK.COM — Công ty giải pháp công nghệ Vieetjk
//  Trang hiển thị bằng TIẾNG ANH. Mọi chữ, số liệu, dịch vụ, câu hỏi thường gặp
//  nằm ở đây — sửa ở đây là đủ.
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
  /** Tên tiếng Anh — dùng ở tiêu đề, chân trang, dữ liệu có cấu trúc. */
  legalName: "Vieetjk Technology Solutions Company",
  /** Tên đăng ký tiếng Việt. */
  nativeName: "Công ty giải pháp công nghệ Vieetjk",
  shortName: "Vieetjk",
  brandSuffix: "Tech",
  /** Ngày thành lập: 18/07/2024. */
  founded: "2024-07-18",
  foundedLabel: "July 18, 2024",
  tagline: "App development · AI solutions · AI agents · SEO",
  address: {
    locality: "Binh Son",
    region: "Quang Ngai",
    country: "Vietnam",
    full: "Binh Son, Quang Ngai, Vietnam",
  },
  phone: "+84 974 374 744",
  phoneHref: "tel:+84974374744",
  zalo: "https://zalo.me/0974374744",
  email: "vieetjk@gmail.com",
  facebook: "https://fb.com/vieetjk",
  hours: "Mon – Sat · 8:00 AM – 5:30 PM (GMT+7)",
  mapEmbed: "https://www.google.com/maps?q=B%C3%ACnh%20S%C6%A1n%2C%20Qu%E1%BA%A3ng%20Ng%C3%A3i&output=embed",
  mapLink: "https://www.google.com/maps/search/?api=1&query=B%C3%ACnh%20S%C6%A1n%2C%20Qu%E1%BA%A3ng%20Ng%C3%A3i",
};

export const SEO = {
  title: "Vieetjk — Technology Solutions: App Development, AI, AI Agents & SEO",
  description:
    "Vieetjk Technology Solutions Company (founded July 18, 2024 in Binh Son, Quang Ngai, Vietnam) builds mobile and web apps, integrates AI, develops autonomous AI agents and delivers SEO for growing businesses.",
  keywords: [
    "Vieetjk",
    "technology company Vietnam",
    "software development Vietnam",
    "mobile app development",
    "web development",
    "AI solutions",
    "AI agents",
    "AI chatbot",
    "business process automation",
    "SEO services",
    "digital transformation",
  ],
};

export const HERO = {
  eyebrow: `Founded ${COMPANY.foundedLabel} · ${COMPANY.address.locality}, ${COMPANY.address.region}`,
  title: "Technology & AI\nthat work for your business",
  sub:
    "Vieetjk designs and builds apps, puts AI to work in your operations and develops AI agents that get real tasks done — so your business sells more, serves customers faster and spends less.",
};

/** Số liệu nổi bật — cập nhật theo thực tế. */
export const STATS = [
  { value: "2024", label: "Year founded" },
  { value: "30+", label: "Projects delivered" },
  { value: "12+", label: "Engineers & specialists" },
  { value: "24/7", label: "Monitoring & support" },
];

export const ABOUT = {
  title: "A young technology team from Quang Ngai, Vietnam",
  paragraphs: [
    `${COMPANY.legalName} (${COMPANY.nativeName}) was founded on ${COMPANY.foundedLabel} in ${COMPANY.address.locality}, ${COMPANY.address.region} — home of the Dung Quat Economic Zone, where businesses are transforming fast and need digital tools that genuinely help.`,
    "We started by building products for ourselves: a studio management platform used every day, an AI assistant that answers customers on our website, and a face-recognition system that lets guests find their photos in seconds. Those real-world lessons shape how we deliver for clients: less theory, more measurable results.",
  ],
  pillars: [
    {
      title: "Mission",
      text: "Bring technology and artificial intelligence within reach of small and mid-sized businesses — at a fair cost and with clear returns.",
    },
    {
      title: "Vision",
      text: "Become the most trusted technology and AI partner in Central Vietnam, serving clients nationwide and around the world.",
    },
    {
      title: "Core values",
      text: "Dedication — Transparency — Creativity — Accountability for results. Every line of code serves a concrete business goal.",
    },
  ],
};

// ── Dịch vụ ─────────────────────────────────────────────────────────────────
export type IconKey = "app" | "web" | "ai" | "agent" | "seo" | "cloud";

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

/** Slug trang AI Agent — trang này có thêm khối console & vòng làm việc. */
export const AGENT_SLUG = "ai-agents";

export const SERVICES: Service[] = [
  {
    slug: "app-development",
    icon: "app",
    name: "App Development",
    title: "iOS & Android mobile app development",
    short: "Cross-platform iOS/Android apps — from first idea to launch on the App Store and Google Play.",
    intro:
      "We design and build mobile apps that are fast, beautiful and easy to use — from shopping, booking and loyalty apps to internal tools for your team. One codebase for both iOS and Android can save up to 40% of the cost.",
    seoDescription:
      "End-to-end iOS & Android app development by Vieetjk: UI/UX design, Flutter/React Native engineering, payment integration, App Store & Google Play publishing and long-term maintenance.",
    highlights: [
      "Custom UI/UX designed around your users",
      "One codebase for both iOS & Android",
      "Payments, messaging and push notifications built in",
      "Full support publishing to the App Store & Google Play",
    ],
    features: [
      { title: "E-commerce & shopping apps", text: "Product catalogs, carts, vouchers, QR and e-wallet payments, and real-time order tracking." },
      { title: "Booking & service apps", text: "Bookings for spas, clinics, studios and repair services with automatic reminders and deposits." },
      { title: "Membership & loyalty apps", text: "Digital member cards, points and rewards, tiered offers and loyal-customer care." },
      { title: "Internal team apps", text: "Attendance, task assignment, field reports with photos and location, and on-the-go approvals." },
      { title: "AI inside your app", text: "In-app assistants, image recognition, document scanning (OCR) and smart product recommendations." },
      { title: "Desktop applications", text: "Lightweight Windows/macOS software that syncs with your web system and works offline." },
    ],
    steps: [
      { title: "Discovery & scoping", text: "Clarify goals, users and core features, and define the first release (MVP).", time: "1 week" },
      { title: "UI/UX design", text: "Wireframes, detailed screens and a clickable prototype before any code is written.", time: "1–2 weeks" },
      { title: "Sprint-based development", text: "A working build every two weeks so you can try it and give feedback.", time: "4–10 weeks" },
      { title: "Testing & release", text: "Testing across many devices and submission to the App Store/Google Play.", time: "1–2 weeks" },
    ],
    tech: ["Flutter", "React Native", "Swift", "Kotlin", "Firebase", "Supabase", "Node.js", "PostgreSQL", "Tauri"],
    faq: [
      { q: "How long does it take to build a mobile app?", a: "A first version (MVP) usually takes 6–12 weeks depending on scope. We work in two-week sprints so you see progress continuously." },
      { q: "How is the cost of an app calculated?", a: "We quote based on the exact features and screens agreed after a free discovery session. You always get an itemized breakdown with no hidden costs." },
      { q: "Do I own the source code?", a: "Yes. All source code, accounts and technical documentation are handed over to you at acceptance." },
    ],
  },
  {
    slug: "web-development",
    icon: "web",
    name: "Web & Software",
    title: "Website design & custom business software",
    short: "SEO-ready websites, web apps, SaaS platforms and CRM/ERP tailored to your workflow.",
    intro:
      "From a company website that loads in under two seconds to a complex multi-branch management system — we build software that fits the way your business already works, instead of forcing you to change your process to fit the software.",
    seoDescription:
      "SEO-ready website design, web app development, custom CRM/ERP and SaaS platforms by Vieetjk. Fast, secure and built to scale.",
    highlights: [
      "Fast, SEO-ready websites that look great on every device",
      "Software tailored to your real-world processes",
      "Role-based access, multiple branches, clear dashboards",
      "Reliable cloud hosting with automatic backups",
    ],
    features: [
      { title: "Company websites", text: "Company profile, products, news and multiple languages, with a CMS as easy as writing a document." },
      { title: "Online stores", text: "Carts, payments, inventory, shipping integrations and connections to marketplaces." },
      { title: "CRM & customer management", text: "Customer records, purchase history, automated follow-ups via messaging and email, and sales pipelines." },
      { title: "ERP & operations", text: "Contracts, inventory, HR, internal accounting and multi-level approvals in one unified system." },
      { title: "SaaS platforms", text: "Multi-tenant architecture, subscription plans, recurring billing and admin consoles." },
      { title: "System integration", text: "Connect banks, payment gateways, e-invoicing, Google Workspace and existing APIs." },
    ],
    steps: [
      { title: "Business analysis", text: "Sit with your team, map the current process and pinpoint what can be automated.", time: "1–2 weeks" },
      { title: "Solution design", text: "System architecture, database and UI approved before development starts.", time: "1–2 weeks" },
      { title: "Build & ship in stages", text: "Launch module by module so your team can start using it early and give feedback.", time: "4–16 weeks" },
      { title: "Training & operations", text: "User training, migration of existing data and close monitoring after go-live.", time: "Ongoing" },
    ],
    tech: ["Next.js", "React", "TypeScript", "Node.js", "Python", "PostgreSQL", "Supabase", "Tailwind CSS", "Vercel"],
    faq: [
      { q: "Is the website SEO-ready from day one?", a: "Yes. Every site ships optimized for speed, heading structure, structured data (schema), sitemaps and mobile display." },
      { q: "Can I update the content myself?", a: "Yes. We build a simple admin panel so you can update posts, products and images without any coding." },
      { q: "Can the software grow with my business?", a: "It is built in modules, so new features, branches or a mobile app can be added later without starting over." },
    ],
  },
  {
    slug: "ai-solutions",
    icon: "ai",
    name: "AI Solutions",
    title: "Artificial intelligence (AI) solutions for business",
    short: "AI chatbots, knowledge assistants, computer vision, data analytics and forecasting.",
    intro:
      "AI is no longer a luxury. We help you pick the right problem and the right model, then weave AI into everyday work — from answering customers and reading invoices to forecasting sales — with your data kept strictly private.",
    seoDescription:
      "AI solutions for business by Vieetjk: customer-service AI chatbots, internal knowledge assistants (RAG), image recognition, document OCR, data analytics and forecasting.",
    highlights: [
      "Advice on which AI use cases actually pay off",
      "Works with Vietnamese and English content",
      "Your data stays private — never used for public model training",
      "Impact measured with concrete metrics",
    ],
    features: [
      { title: "Customer-service AI chatbots", text: "Answer customers 24/7 on your website and messaging channels in your brand voice, collect contact details and hand over to staff." },
      { title: "Internal knowledge assistant (RAG)", text: "Ask questions over your own documents, procedures and contracts — with cited sources and per-department access." },
      { title: "Computer vision", text: "Face recognition, product counting, defect detection on production lines and automatic image classification." },
      { title: "Document reading (OCR + AI)", text: "Extract data from invoices, IDs, contracts and warehouse slips straight into your software." },
      { title: "Analytics & forecasting", text: "Clear dashboards, sales and inventory forecasts, and anomaly detection in transactions." },
      { title: "AI content generation", text: "Product descriptions, ad copy, video scripts and on-brand illustrations." },
    ],
    steps: [
      { title: "Use-case assessment", text: "Find the most time-consuming process and estimate the gain from applying AI.", time: "3–5 days" },
      { title: "Proof of concept", text: "Build a working prototype on your real data to validate accuracy.", time: "2–3 weeks" },
      { title: "Integration", text: "Connect AI to your software, chat channels and existing workflows.", time: "3–8 weeks" },
      { title: "Monitor & improve", text: "Track answer quality and running costs, and fine-tune regularly.", time: "Ongoing" },
    ],
    tech: ["Claude", "GPT", "Gemini", "Python", "LangChain", "pgvector", "TensorFlow", "MediaPipe", "OpenCV"],
    faq: [
      { q: "Will my data leak when using AI?", a: "We use enterprise API plans that do not train on your data, encrypt data at rest and can deploy models on private servers when required." },
      { q: "Can the AI give wrong answers?", a: "Every system is grounded in your own data, cites its sources and hands over to a human when unsure. We measure accuracy before going live." },
      { q: "Should a small business use AI?", a: "Absolutely. A customer-service chatbot or a document-reading assistant often pays for itself within a few months through time saved." },
    ],
  },
  {
    slug: AGENT_SLUG,
    icon: "agent",
    name: "AI Agents",
    title: "AI agents — digital workers that automate your operations",
    short: "Agents that plan, use your tools and complete whole tasks end to end.",
    intro:
      "Unlike a chatbot that only answers, an AI agent takes action: it reads email, looks things up in your systems, creates orders, sends messages and updates reports — and only checks with a human at the steps that matter. We design, build and operate AI agents that work like digital employees, 24/7.",
    seoDescription:
      "Custom AI agent development by Vieetjk: customer-service agents, sales agents, finance and operations agents, multi-agent systems, CRM/ERP/messaging integrations via tools and MCP — always with human oversight.",
    highlights: [
      "Handles complete multi-step workflows",
      "Connects to CRM, ERP, messaging, email, Google Sheets…",
      "Humans approve the critical steps",
      "Transparent log of every action the agent takes",
    ],
    features: [
      { title: "Customer-service agent", text: "Takes requests from every channel, looks up orders, reschedules, resolves simple complaints and reports at the end of the day." },
      { title: "Sales agent", text: "Recommends products, sends quotes automatically, follows up on undecided leads and updates opportunities in your CRM." },
      { title: "Operations & finance agent", text: "Reconciles bank transactions, enters document data, chases receivables and prepares periodic reports." },
      { title: "HR agent", text: "Screens CVs, schedules interviews and answers employees' policy questions." },
      { title: "Marketing & SEO agent", text: "Researches keywords, plans content, drafts articles and tracks rankings automatically." },
      { title: "Multi-agent systems", text: "Specialist agents collaborating under an orchestrator agent to handle complex processes." },
    ],
    steps: [
      { title: "Pick the workflow", text: "Find repetitive, multi-step processes that consume the most hours and automate those first.", time: "1 week" },
      { title: "Design the agent", text: "Define its role, the tools it may use, permission limits and human-approval checkpoints.", time: "1–2 weeks" },
      { title: "Build & test", text: "Run the agent on real scenarios in a sandbox and measure its completion rate.", time: "3–6 weeks" },
      { title: "Supervised operation", text: "Monitor logs, cost and quality, and gradually widen what the agent handles.", time: "Ongoing" },
    ],
    tech: ["Claude Agent SDK", "MCP", "LangGraph", "OpenAI Agents", "Python", "Node.js", "Supabase", "n8n", "Zalo API"],
    faq: [
      { q: "How is an AI agent different from a chatbot?", a: "A chatbot mostly answers questions. An AI agent plans and performs real actions in your systems — creating orders, sending messages, updating data — to complete a whole task." },
      { q: "Could an agent do something it shouldn't?", a: "Agents can only use the tools and permissions you grant. Critical actions such as payments or sending contracts always wait for human approval, and every action is logged." },
      { q: "Will agents replace my employees?", a: "Agents take over repetitive work so your people can focus on customers and creative tasks. Most businesses use agents to boost productivity, not to cut staff." },
    ],
  },
  {
    slug: "seo",
    icon: "seo",
    name: "SEO & Digital Marketing",
    title: "Full-service SEO & digital marketing",
    short: "Sustainable top Google rankings: technical SEO, content and local SEO.",
    intro:
      "Customers search for you on Google every day. We combine technical SEO, quality content and the power of AI so your website shows up exactly when customers need you — on Google Maps and in the answers of AI-powered search engines too.",
    seoDescription:
      "Full-service SEO by Vieetjk: technical audits, keyword research, SEO content production, local SEO on Google Maps, optimization for AI search and transparent monthly reporting.",
    highlights: [
      "Free, comprehensive technical audit",
      "In-depth content written for real readers",
      "Local SEO on Google Maps",
      "Monthly ranking & traffic reports",
    ],
    features: [
      { title: "Technical SEO", text: "Speed (Core Web Vitals), URL structure, sitemaps, structured data and indexing fixes." },
      { title: "Keyword research", text: "Analyze how your customers and competitors search to choose keywords that bring in orders." },
      { title: "SEO content", text: "Topic-cluster content plans and in-depth articles produced with AI and human editors." },
      { title: "Local SEO", text: "Optimize your Google Business Profile, reviews and map presence to win nearby customers." },
      { title: "AI search optimization", text: "Help your brand get mentioned in the answers of AI assistants and AI-powered search engines." },
      { title: "Ads & analytics", text: "Google Ads, Facebook Ads, Google Analytics 4 setup and accurate conversion tracking." },
    ],
    steps: [
      { title: "Audit & goals", text: "Assess your website and competitors, and agree on the metrics to hit.", time: "1 week" },
      { title: "Technical foundation", text: "Fix technical issues and optimize speed and page structure.", time: "2–4 weeks" },
      { title: "Content & links", text: "Execute the monthly content plan and build domain authority.", time: "3–6 months" },
      { title: "Measure & optimize", text: "Transparent monthly reports and strategy adjustments based on data.", time: "Ongoing" },
    ],
    tech: ["Google Search Console", "GA4", "Google Business Profile", "Ahrefs", "Screaming Frog", "PageSpeed Insights", "Schema.org", "Looker Studio"],
    faq: [
      { q: "How long until my website ranks on Google?", a: "For moderately competitive keywords, clear results usually appear within 3–6 months. Local SEO can be faster — sometimes just a few weeks." },
      { q: "Do you guarantee rankings?", a: "We commit to a plan, a volume of work and transparent reporting. Nobody controls Google's algorithm, so be wary of promises like \"#1 in 7 days\"." },
      { q: "Will Google penalize AI-written content?", a: "Google evaluates content quality, not the tool that produced it. Our articles are always edited by specialists, fact-checked and enriched with real experience." },
    ],
  },
  {
    slug: "digital-transformation",
    icon: "cloud",
    name: "Digital Transformation & Cloud",
    title: "Digital transformation, cloud & process automation",
    short: "Practical digital roadmaps, cloud infrastructure, security and automation.",
    intro:
      "Digital transformation doesn't start with expensive software — it starts with understanding how your business really runs. We build a step-by-step roadmap with you, pick tools that fit your budget, move your systems safely to the cloud and automate the repetitive work.",
    seoDescription:
      "Digital transformation consulting for SMEs by Vieetjk: digitalization roadmaps, cloud infrastructure, DevOps, security and backups, and AI-powered process automation.",
    highlights: [
      "A roadmap sized to your scale & budget",
      "Stable, cost-optimized cloud infrastructure",
      "Security, access control and automatic backups",
      "Hands-on training for your team",
    ],
    features: [
      { title: "Digital maturity assessment", text: "Review processes, tools and data, and prioritize the investments with the fastest payback." },
      { title: "Cloud infrastructure", text: "Design, migrate and operate systems on AWS, Google Cloud or local data centers." },
      { title: "DevOps & monitoring", text: "Automated deployments (CI/CD) and 24/7 monitoring that flags incidents before customers notice." },
      { title: "Security & backup", text: "Access control, data encryption, scheduled backups and a disaster-recovery plan." },
      { title: "Process automation", text: "Connect disconnected apps, auto-send reports and reminders, and sync data across departments." },
      { title: "Training & handover", text: "Train your team to use digital tools and AI in daily work, with written guides." },
    ],
    steps: [
      { title: "Current-state review", text: "Interview each department and time the key processes.", time: "1–2 weeks" },
      { title: "Roadmap", text: "Propose a 3–12 month roadmap, prioritizing quick-payback items.", time: "1 week" },
      { title: "Phased rollout", text: "Deliver in phases and measure results before scaling up.", time: "Per roadmap" },
      { title: "Ongoing partnership", text: "Technical support, maintenance and continuous improvement.", time: "Ongoing" },
    ],
    tech: ["AWS", "Google Cloud", "Docker", "GitHub Actions", "Cloudflare", "Vercel", "Google Workspace", "n8n", "Zapier"],
    faq: [
      { q: "Where should a small business start its digital transformation?", a: "Usually with customer management, sales and finance — where data is scattered across notebooks, spreadsheets and chat messages. Digitizing these brings the fastest gains." },
      { q: "Is moving data to the cloud safe?", a: "Yes, when configured properly: encryption, strict access control, two-factor authentication and backups in multiple locations. We apply all of these layers to every system." },
      { q: "Do you provide support after rollout?", a: "Yes. We offer monthly or yearly maintenance, monitoring and technical support plans." },
    ],
  },
];

export function getService(slug: string | undefined): Service | null {
  if (!slug) return null;
  return SERVICES.find((s) => s.slug === slug) ?? null;
}

// ── AI Agent nổi bật ở trang chủ ───────────────────────────────────────────
export const AGENT = {
  eyebrow: "Our 2026 focus",
  title: "AI agents — digital workers that never clock out",
  lead:
    "An AI agent doesn't just answer questions. It understands the request, makes a plan, uses your software like a real employee and reports back — pausing to ask a human only at the steps that matter.",
  loop: [
    { title: "Receive", text: "Takes requests from messaging apps, your website, email, phone or calendar." },
    { title: "Understand", text: "Reads your business data, documents and customer history." },
    { title: "Plan", text: "Breaks the job into steps and picks the right tools." },
    { title: "Act", text: "Works in your CRM, ERP and spreadsheets, sends messages, creates documents." },
    { title: "Control", text: "Humans approve key steps; every action is logged." },
  ],
  uses: [
    "24/7 omnichannel customer service",
    "Automatic quotes & order closing",
    "Bank reconciliation & payment reminders",
    "Invoice & document data entry",
    "Appointment booking & reminders",
    "Content writing & SEO tracking",
  ],
};

/** Dòng chạy trong khung "console" ở hero — minh hoạ một agent đang làm việc. */
export const CONSOLE_LINES = [
  { kind: "cmd", text: 'agent.run("Reschedule delivery for order #2481")' },
  { kind: "ok", text: "Read customer's message: “Can we move it to Friday?”" },
  { kind: "ok", text: "Looked up order #2481 in CRM · status: awaiting delivery" },
  { kind: "ok", text: "Checked delivery schedule · Friday 2:00 PM is free" },
  { kind: "ok", text: "Updated the order & sent confirmation to the customer" },
  { kind: "done", text: "Done in 4.2 seconds · no human needed" },
] as const;

// ── Sản phẩm do Vieetjk tự phát triển (đang vận hành thật) ─────────────────
export const PRODUCTS = [
  {
    name: "mstudo",
    tag: "SaaS platform",
    text: "Management software for photo studios: e-contracts, quotes, shoot scheduling, team, payments and client galleries — all in one place.",
    href: "https://mstudo.com",
  },
  {
    name: "Find photos by face",
    tag: "Computer vision",
    text: "Guests upload one selfie and AI instantly finds every photo of them in an event album of thousands of images.",
    href: null,
  },
  {
    name: "AI sales assistant",
    tag: "AI agent",
    text: "An agent that chats with website visitors, quotes from the live price list, collects phone numbers and sends leads to the owner's Zalo.",
    href: null,
  },
  {
    name: "MStudo Desktop",
    tag: "Desktop app",
    text: "A Windows app that saves signed contracts as PDF/Word the moment clients sign and exports a daily Excel backup of all data.",
    href: null,
  },
];

// ── Lĩnh vực phục vụ ────────────────────────────────────────────────────────
export type IndustryKey = "retail" | "edu" | "health" | "realestate" | "travel" | "industry";
export const INDUSTRIES: { key: IndustryKey; name: string; text: string }[] = [
  { key: "retail", name: "Retail & e-commerce", text: "Shopping apps, inventory management and omnichannel order-closing chatbots." },
  { key: "edu", name: "Education & training", text: "E-learning platforms, student management and AI tutors that answer questions." },
  { key: "health", name: "Healthcare & beauty", text: "Appointment booking, client records and automatic follow-up reminders." },
  { key: "realestate", name: "Real estate & construction", text: "Broker CRMs, project management and mobile site reporting." },
  { key: "travel", name: "Travel & hospitality", text: "Room booking, food ordering and AI-powered guest care." },
  { key: "industry", name: "Manufacturing & industry", text: "Digitized factory workflows, AI quality inspection and maintenance management." },
];

// ── Quy trình hợp tác chung ────────────────────────────────────────────────
export const PROCESS = [
  { title: "Listen", text: "A free consultation to understand your goals, budget and timeline." },
  { title: "Propose", text: "Technical approach, scope, timeline and a transparent, itemized quote." },
  { title: "Design & build", text: "Two-week sprints — you review and give feedback on a working build." },
  { title: "Test & hand over", text: "Thorough testing, user training, and handover of source code and docs." },
  { title: "Grow together", text: "Maintenance, monitoring, optimization and new features as your business grows." },
];

// ── Công nghệ ───────────────────────────────────────────────────────────────
export const TECH_GROUPS = [
  { name: "Mobile", items: ["Flutter", "React Native", "Swift", "Kotlin"] },
  { name: "Web & Backend", items: ["Next.js", "React", "TypeScript", "Node.js", "Python", "FastAPI"] },
  { name: "AI & Agents", items: ["Claude", "GPT", "Gemini", "MCP", "LangGraph", "RAG", "TensorFlow"] },
  { name: "Data & Cloud", items: ["PostgreSQL", "Supabase", "Redis", "Docker", "AWS", "Google Cloud", "Vercel"] },
];

// ── Vì sao chọn Vieetjk ─────────────────────────────────────────────────────
export const COMMITMENTS = [
  { title: "Free consultation & discovery", text: "We understand the problem before quoting — no charge unless you decide to go ahead." },
  { title: "Transparent pricing", text: "Itemized quotes, timelines committed in the contract, no hidden costs." },
  { title: "You own the code", text: "Your business owns all source code, data and system accounts." },
  { title: "Confidentiality", text: "We sign an NDA; data is encrypted and access is tightly controlled." },
  { title: "12-month warranty", text: "Free bug fixes during the warranty period and fast incident response." },
  { title: "Close partnership", text: "A team based in Quang Ngai you can meet in person, with remote support worldwide." },
];

// ── Câu hỏi thường gặp (trang chủ) ──────────────────────────────────────────
export const FAQ: QA[] = [
  {
    q: "Do you work with clients outside Vietnam?",
    a: `Yes. We are based in ${COMPANY.address.full} and work with clients across Vietnam and abroad. Clients nearby can meet us in person; everyone else works with us remotely throughout the project, in English or Vietnamese.`,
  },
  {
    q: "I only have an idea, no requirements document. Can you still help?",
    a: "Absolutely. Our first consultation turns your idea into a prioritized feature list and a concrete roadmap — completely free.",
  },
  {
    q: "How much does a project cost?",
    a: "It depends on scope: a company website, an AI chatbot and a management system cost very different amounts. After discovery you get an itemized quote, and you can choose to build in phases to fit your budget.",
  },
  {
    q: "Who maintains the system after handover?",
    a: "Every project includes a 12-month warranty. After that you can choose a Vieetjk maintenance plan or run it yourself with the full source code and documentation we hand over.",
  },
  {
    q: "Are AI agents a good fit for small businesses?",
    a: "Yes. Small businesses often benefit most, because every hour saved really counts. We usually start with one agent for one specific workflow, measure the impact, then expand.",
  },
];

/** Lựa chọn ngân sách trong form liên hệ. */
export const BUDGETS = ["Not sure yet", "Under $2,000", "$2,000 – $5,000", "$5,000 – $15,000", "Over $15,000"];

/** Đường dẫn công khai cho sitemap.xml. */
export function aiSitemapPaths(): { path: string; priority: string }[] {
  return [{ path: "/", priority: "1.0" }, ...SERVICES.map((s) => ({ path: `/${s.slug}`, priority: "0.8" }))];
}
