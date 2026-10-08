// Stylesheet tự chứa cho trang ai.vieetjk.com. Mọi rule nằm dưới .va-root để
// không đụng tới theme của phần còn lại của app. Render 1 lần trong AiChrome.
export const VA_CSS = `
.va-root{
  --bg:#060912; --bg2:#0a0f1d; --bg3:#0f1528;
  --card:rgba(255,255,255,.028); --card2:rgba(255,255,255,.05);
  --line:rgba(160,175,255,.12); --line2:rgba(160,175,255,.22);
  --ink:#eef1fb; --ink2:rgba(222,228,250,.70); --ink3:rgba(222,228,250,.46);
  --a1:#38bdf8; --a2:#6366f1; --a3:#a855f7; --ok:#34d399;
  --grad:linear-gradient(120deg,#38bdf8 0%,#6366f1 52%,#a855f7 100%);
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:var(--font-be-vietnam),var(--font-hanken),system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  line-height:1.65; overflow-x:clip;
}
.va-root *,.va-root *::before,.va-root *::after{box-sizing:border-box;}
/* Reset bọc trong :where() (độ ưu tiên 0) để mọi class bên dưới thắng được. */
:where(.va-root) :where(img){max-width:100%;display:block;}
:where(.va-root) :where(a){color:inherit;text-decoration:none;}
:where(.va-root) :where(h1,h2,h3,h4,p){margin:0;}
:where(.va-root) :where(ul,ol){margin:0;padding:0;list-style:none;}
.va-root ::selection{background:rgba(99,102,241,.45);color:#fff;}
.va-root :focus-visible{outline:2px solid var(--a1);outline-offset:3px;border-radius:6px;}
.va-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
.va-grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.va-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;letter-spacing:.16em;
  text-transform:uppercase;color:var(--a1);}
.va-eyebrow::before{content:"";width:18px;height:2px;border-radius:2px;background:var(--grad);}
.va-h2{font-weight:700;font-size:clamp(28px,4vw,44px);line-height:1.15;letter-spacing:-.02em;margin-top:14px;text-wrap:balance;}
.va-lead{font-size:clamp(15.5px,1.5vw,18px);color:var(--ink2);max-width:64ch;margin-top:16px;text-wrap:pretty;}
.va-head{max-width:760px;}
.va-head.center{text-align:center;margin:0 auto;}
.va-head.center .va-lead{margin-left:auto;margin-right:auto;}
.va-root section[id]{scroll-margin-top:72px;}
.va-section{position:relative;padding:104px 0;}
.va-section.alt{background:var(--bg2);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.va-section.tight{padding:72px 0;}

/* ── Buttons ─────────────────────────────────────────── */
.va-btnrow{display:flex;flex-wrap:wrap;gap:12px;}
.va-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:13px 22px;border-radius:12px;
  font-size:15px;font-weight:600;line-height:1.2;border:1px solid transparent;cursor:pointer;
  transition:transform .18s,box-shadow .18s,background .18s,border-color .18s;font-family:inherit;}
.va-btn:hover{transform:translateY(-1px);}
.va-btn-primary{background:var(--grad);color:#fff !important;box-shadow:0 10px 30px -10px rgba(99,102,241,.7);}
.va-btn-primary:hover{box-shadow:0 14px 36px -10px rgba(99,102,241,.9);}
.va-btn-ghost{background:rgba(255,255,255,.04);color:var(--ink) !important;border-color:var(--line2);}
.va-btn-ghost:hover{background:rgba(255,255,255,.08);border-color:rgba(160,175,255,.4);}
.va-btn-sm{padding:9px 16px;font-size:14px;border-radius:10px;}
.va-link{display:inline-flex;align-items:center;gap:6px;font-size:14.5px;font-weight:600;color:var(--a1);}
.va-link svg{transition:transform .18s;}
.va-link:hover svg{transform:translateX(3px);}

/* ── Header ─────────────────────────────────────────── */
.va-header{position:sticky;top:0;z-index:60;background:rgba(6,9,18,.72);
  backdrop-filter:saturate(1.3) blur(16px);-webkit-backdrop-filter:saturate(1.3) blur(16px);border-bottom:1px solid var(--line);}
.va-headin{display:flex;align-items:center;justify-content:space-between;gap:20px;height:72px;}
.va-logo{display:inline-flex;align-items:center;gap:11px;flex-shrink:0;}
.va-logo-text{display:flex;flex-direction:column;line-height:1.05;}
.va-logo-name{font-weight:800;font-size:20px;letter-spacing:-.01em;}
.va-logo-sub{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin-top:3px;}
.va-nav{display:flex;align-items:center;gap:28px;}
.va-nav a{font-size:14.5px;color:var(--ink2);font-weight:500;transition:color .15s;position:relative;padding:6px 0;}
.va-nav a:hover,.va-nav a.active{color:var(--ink);}
.va-nav a.active::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;border-radius:2px;background:var(--grad);}
.va-head-cta{display:flex;align-items:center;gap:10px;}
.va-burger{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:10px;
  background:rgba(255,255,255,.04);border:1px solid var(--line2);color:var(--ink);cursor:pointer;}
.va-mobnav{display:none;}

/* ── Hero ───────────────────────────────────────────── */
.va-hero{position:relative;padding:clamp(64px,9vw,112px) 0 clamp(64px,8vw,104px);overflow:hidden;}
.va-hero::before{content:"";position:absolute;inset:0;z-index:0;
  background-image:linear-gradient(rgba(160,175,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(160,175,255,.07) 1px,transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(70% 70% at 50% 30%,#000 30%,transparent 75%);mask-image:radial-gradient(70% 70% at 50% 30%,#000 30%,transparent 75%);}
.va-glow{position:absolute;z-index:0;border-radius:50%;filter:blur(90px);opacity:.55;pointer-events:none;}
.va-glow.g1{width:520px;height:520px;background:#4f46e5;top:-180px;right:-120px;opacity:.35;}
.va-glow.g2{width:420px;height:420px;background:#0ea5e9;bottom:-220px;left:-140px;opacity:.22;}
.va-hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.08fr .92fr;gap:56px;align-items:center;}
.va-badge{display:inline-flex;align-items:center;gap:10px;padding:7px 14px 7px 8px;border-radius:999px;
  background:rgba(255,255,255,.04);border:1px solid var(--line2);font-size:13px;color:var(--ink2);font-weight:500;}
.va-badge-dot{display:inline-flex;align-items:center;justify-content:center;padding:3px 9px;border-radius:999px;background:var(--grad);
  color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;}
.va-hero h1{font-weight:800;font-size:clamp(36px,5.2vw,60px);line-height:1.08;letter-spacing:-.03em;margin-top:22px;white-space:pre-line;text-wrap:balance;}
.va-hero-sub{margin-top:22px;font-size:clamp(16px,1.6vw,18.5px);color:var(--ink2);max-width:58ch;text-wrap:pretty;}
.va-hero .va-btnrow{margin-top:32px;}
.va-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:48px;border:1px solid var(--line);border-radius:16px;
  background:rgba(255,255,255,.02);overflow:hidden;}
.va-stat{padding:18px 18px 16px;border-left:1px solid var(--line);}
.va-stat:first-child{border-left:0;}
.va-stat-v{font-size:clamp(22px,2.4vw,28px);font-weight:800;letter-spacing:-.02em;}
.va-stat-l{font-size:12.5px;color:var(--ink3);margin-top:2px;line-height:1.35;}

/* Console minh hoạ agent */
.va-console{position:relative;border-radius:18px;padding:1px;background:linear-gradient(140deg,rgba(56,189,248,.55),rgba(99,102,241,.25) 40%,rgba(168,85,247,.5));
  box-shadow:0 40px 90px -30px rgba(79,70,229,.55);}
.va-console-in{border-radius:17px;background:#0a0e1c;overflow:hidden;}
.va-console-bar{display:flex;align-items:center;gap:7px;padding:13px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02);}
.va-console-bar i{width:10px;height:10px;border-radius:50%;background:#2a3150;display:block;}
.va-console-bar i:nth-child(1){background:#f87171;} .va-console-bar i:nth-child(2){background:#fbbf24;} .va-console-bar i:nth-child(3){background:#34d399;}
.va-console-title{margin-left:10px;font-family:var(--mono);font-size:12px;color:var(--ink3);}
.va-console-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--ok);letter-spacing:.08em;text-transform:uppercase;}
.va-console-live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 rgba(52,211,153,.6);animation:va-pulse 1.8s infinite;}
.va-console-body{padding:18px 18px 20px;font-family:var(--mono);font-size:13px;line-height:1.6;min-height:262px;}
.va-cl{display:flex;gap:10px;opacity:0;transform:translateY(4px);animation:va-in .45s ease forwards;}
.va-cl + .va-cl{margin-top:9px;}
.va-cl .k{flex-shrink:0;width:16px;text-align:center;font-weight:700;}
.va-cl.cmd .k{color:var(--a3);} .va-cl.cmd{color:#c7d2fe;}
.va-cl.ok .k{color:var(--ok);} .va-cl.ok{color:var(--ink2);}
.va-cl.done .k{color:var(--a1);} .va-cl.done{color:var(--a1);font-weight:600;}
.va-cursor{display:inline-block;width:8px;height:15px;background:var(--a1);vertical-align:-2px;margin-left:4px;animation:va-blink 1s steps(1) infinite;}
.va-tools{display:flex;flex-wrap:wrap;gap:8px;padding:14px 18px;border-top:1px solid var(--line);background:rgba(255,255,255,.015);}
.va-tool{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--line);}
.va-tool::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok);}
@keyframes va-in{to{opacity:1;transform:none;}}
@keyframes va-blink{50%{opacity:0;}}
@keyframes va-pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.55);}70%{box-shadow:0 0 0 8px rgba(52,211,153,0);}100%{box-shadow:0 0 0 0 rgba(52,211,153,0);}}

/* ── Cards / grids ─────────────────────────────────── */
.va-grid{display:grid;gap:18px;margin-top:52px;}
.va-grid.c2{grid-template-columns:repeat(2,1fr);}
.va-grid.c3{grid-template-columns:repeat(3,1fr);}
.va-grid.c4{grid-template-columns:repeat(4,1fr);}
.va-card{position:relative;border-radius:18px;border:1px solid var(--line);background:var(--card);padding:28px;
  transition:border-color .2s,transform .2s,background .2s;}
a.va-card:hover,.va-card.hover:hover{border-color:rgba(129,140,248,.45);background:rgba(255,255,255,.045);transform:translateY(-3px);}
.va-card h3{font-size:18.5px;font-weight:700;letter-spacing:-.01em;line-height:1.3;}
.va-card p{font-size:14.5px;color:var(--ink2);margin-top:10px;}
.va-ico{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;
  background:linear-gradient(140deg,rgba(56,189,248,.18),rgba(99,102,241,.18) 50%,rgba(168,85,247,.2));
  border:1px solid rgba(129,140,248,.3);color:#c7d2fe;margin-bottom:20px;}
.va-ico.sm{width:40px;height:40px;border-radius:11px;margin-bottom:16px;}
.va-card .va-link{margin-top:18px;}
.va-svc-num{position:absolute;top:24px;right:26px;font-family:var(--mono);font-size:12px;color:var(--ink3);}

/* About */
.va-about{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:start;}
.va-about p + p{margin-top:16px;}
.va-about-copy p{color:var(--ink2);font-size:16px;}
.va-founded{border-radius:20px;padding:1px;background:linear-gradient(150deg,rgba(56,189,248,.5),rgba(99,102,241,.15) 50%,rgba(168,85,247,.45));}
.va-founded-in{border-radius:19px;background:var(--bg3);padding:30px;}
.va-founded-label{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);font-weight:600;}
.va-founded-date{font-size:clamp(40px,5vw,56px);font-weight:800;letter-spacing:-.03em;line-height:1.05;margin-top:8px;}
.va-founded-rows{margin-top:22px;display:grid;gap:12px;}
.va-founded-row{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;color:var(--ink2);}
.va-founded-row svg{flex-shrink:0;color:var(--a1);margin-top:3px;}
.va-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px;}
.va-pillar{border-top:2px solid transparent;border-image:var(--grad) 1;padding-top:18px;}
.va-pillar h3{font-size:16px;font-weight:700;}
.va-pillar p{font-size:14.5px;color:var(--ink2);margin-top:8px;}

/* AI Agent */
.va-agent{position:relative;border-radius:28px;border:1px solid rgba(129,140,248,.28);overflow:hidden;
  background:radial-gradient(80% 120% at 100% 0%,rgba(99,102,241,.22),transparent 60%),radial-gradient(60% 90% at 0% 100%,rgba(14,165,233,.14),transparent 60%),var(--bg3);
  padding:clamp(32px,5vw,64px);}
.va-agent-top{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:end;}
.va-uses{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 18px;}
.va-check{display:flex;align-items:flex-start;gap:10px;font-size:14.5px;color:var(--ink2);}
.va-check svg{flex-shrink:0;color:var(--ok);margin-top:3px;}
.va-loop{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:48px;position:relative;}
.va-loop::before{content:"";position:absolute;top:22px;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(129,140,248,.6),transparent);}
.va-loop-step{position:relative;text-align:center;padding:0 6px;}
.va-loop-n{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;
  background:#0b1022;border:1px solid rgba(129,140,248,.5);font-family:var(--mono);font-size:13px;font-weight:700;color:#c7d2fe;
  box-shadow:0 0 0 6px rgba(99,102,241,.08);}
.va-loop-step h3{font-size:15.5px;font-weight:700;margin-top:14px;}
.va-loop-step p{font-size:13.5px;color:var(--ink2);margin-top:6px;}
.va-agent .va-btnrow{margin-top:40px;}

/* Products */
.va-tag{display:inline-flex;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--a1);
  padding:4px 10px;border-radius:999px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);}
.va-prod h3{margin-top:16px;}

/* Process */
.va-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-top:52px;counter-reset:st;}
.va-step{position:relative;padding:24px 22px;border-radius:16px;border:1px solid var(--line);background:var(--card);}
.va-step-n{font-family:var(--mono);font-size:13px;font-weight:700;}
.va-step h3{font-size:16.5px;font-weight:700;margin-top:10px;}
.va-step p{font-size:14px;color:var(--ink2);margin-top:8px;}
.va-step-time{display:inline-flex;margin-top:14px;font-size:12px;font-weight:600;color:var(--ink3);padding:3px 9px;border-radius:7px;background:rgba(255,255,255,.05);}

/* Tech */
.va-tech{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:52px;}
.va-tech-g h3{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:600;}
.va-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
.va-chip{font-size:13.5px;font-weight:500;padding:7px 12px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--ink);}

/* Commitments */
.va-commit{display:flex;gap:16px;align-items:flex-start;}
.va-commit .va-ico{margin-bottom:0;flex-shrink:0;}
.va-commit h3{font-size:16.5px;}
.va-commit p{margin-top:6px;}

/* FAQ */
.va-faq{max-width:860px;margin:44px auto 0;display:grid;gap:12px;}
.va-faq details{border:1px solid var(--line);border-radius:14px;background:var(--card);transition:border-color .2s,background .2s;}
.va-faq details[open]{border-color:rgba(129,140,248,.4);background:rgba(255,255,255,.04);}
.va-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;font-weight:600;font-size:16px;}
.va-faq summary::-webkit-details-marker{display:none;}
.va-faq summary svg{flex-shrink:0;color:var(--ink3);transition:transform .2s;}
.va-faq details[open] summary svg{transform:rotate(180deg);color:var(--a1);}
.va-faq details p{padding:0 22px 20px;color:var(--ink2);font-size:15px;}

/* Contact */
.va-contact{display:grid;grid-template-columns:.9fr 1.1fr;gap:28px;margin-top:52px;align-items:stretch;}
.va-info{display:flex;flex-direction:column;gap:14px;}
.va-info-row{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;border-radius:14px;border:1px solid var(--line);background:var(--card);}
.va-info-row .va-ico{margin:0;width:40px;height:40px;border-radius:11px;flex-shrink:0;}
.va-info-k{font-size:12.5px;color:var(--ink3);font-weight:600;letter-spacing:.04em;}
.va-info-v{font-size:15.5px;font-weight:600;margin-top:2px;word-break:break-word;}
a.va-info-row:hover{border-color:rgba(129,140,248,.45);}
.va-map{flex:1;min-height:220px;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--bg3);}
.va-map iframe{width:100%;height:100%;min-height:220px;border:0;display:block;filter:grayscale(.3) invert(.92) hue-rotate(185deg) contrast(.9);}
.va-form{border-radius:20px;border:1px solid var(--line2);background:var(--bg3);padding:clamp(22px,3vw,34px);}
.va-form h3{font-size:22px;font-weight:700;letter-spacing:-.01em;}
.va-form-sub{font-size:14.5px;color:var(--ink2);margin-top:6px;}
.va-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px;}
.va-field{display:flex;flex-direction:column;gap:7px;}
.va-field.full{grid-column:1/-1;}
.va-field label{font-size:13px;font-weight:600;color:var(--ink2);}
.va-field label b{color:#f472b6;font-weight:600;}
.va-input{width:100%;font:inherit;font-size:15px;color:var(--ink);background:rgba(255,255,255,.04);border:1px solid var(--line2);
  border-radius:11px;padding:12px 14px;outline:none;transition:border-color .15s,background .15s;}
.va-input::placeholder{color:var(--ink3);}
.va-input:focus{border-color:var(--a2);background:rgba(99,102,241,.07);}
select.va-input{appearance:none;-webkit-appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%23aab3d9' stroke-width='1.6'%3E%3Cpath d='m1 1.5 5 5 5-5'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;padding-right:38px;}
select.va-input option{background:#0f1528;color:var(--ink);}
textarea.va-input{min-height:120px;resize:vertical;}
.va-hp{position:absolute !important;left:-9999px !important;width:1px;height:1px;overflow:hidden;}
.va-form-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:20px;}
.va-form-note{font-size:12.5px;color:var(--ink3);max-width:36ch;}
.va-alert{margin-top:16px;padding:12px 14px;border-radius:11px;font-size:14px;}
.va-alert.err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.35);color:#fecaca;}
.va-sent{text-align:center;padding:28px 8px;}
.va-sent .va-ico{margin:0 auto 18px;color:var(--ok);}
.va-sent h3{font-size:22px;}
.va-sent p{color:var(--ink2);margin-top:10px;}

/* Service page */
.va-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13.5px;color:var(--ink3);}
.va-crumbs a:hover{color:var(--ink);}
.va-svc-hero{position:relative;padding:clamp(48px,7vw,88px) 0 clamp(56px,7vw,88px);overflow:hidden;}
.va-svc-hero::before{content:"";position:absolute;inset:0;z-index:0;
  background-image:linear-gradient(rgba(160,175,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(160,175,255,.06) 1px,transparent 1px);
  background-size:56px 56px;-webkit-mask-image:radial-gradient(60% 80% at 70% 20%,#000 20%,transparent 75%);mask-image:radial-gradient(60% 80% at 70% 20%,#000 20%,transparent 75%);}
.va-svc-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:center;margin-top:28px;}
.va-svc-hero h1{font-weight:800;font-size:clamp(32px,4.6vw,54px);line-height:1.1;letter-spacing:-.03em;margin-top:18px;text-wrap:balance;}
.va-svc-hero .va-lead{margin-top:20px;}
.va-svc-hero .va-btnrow{margin-top:30px;}
.va-hl{border-radius:20px;border:1px solid var(--line2);background:var(--bg3);padding:26px;}
.va-hl h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:600;}
.va-hl ul{display:grid;gap:13px;margin-top:16px;}
.va-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:52px;}
.va-others{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:36px;}
.va-other{display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:14px;border:1px solid var(--line);background:var(--card);font-size:14.5px;font-weight:600;transition:border-color .2s,transform .2s;}
.va-other:hover{border-color:rgba(129,140,248,.45);transform:translateY(-2px);}
.va-other .va-ico{margin:0;}

/* ── Footer ─────────────────────────────────────────── */
.va-footer{border-top:1px solid var(--line);background:#04060d;padding:64px 0 28px;}
.va-foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:36px;}
.va-foot-about{font-size:14px;color:var(--ink2);margin-top:16px;max-width:38ch;}
.va-footer h4{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin-bottom:16px;}
.va-foot-links{display:grid;gap:10px;font-size:14.5px;color:var(--ink2);}
.va-foot-links a:hover{color:var(--ink);}
.va-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:48px;padding-top:22px;border-top:1px solid var(--line);font-size:13px;color:var(--ink3);}
.va-social{display:flex;gap:10px;margin-top:20px;}
.va-social a{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid var(--line2);color:var(--ink2);transition:color .15s,border-color .15s;}
.va-social a:hover{color:var(--ink);border-color:rgba(160,175,255,.45);}

/* Nút Zalo nổi */
.va-float{position:fixed;right:18px;bottom:18px;z-index:70;display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;
  background:var(--grad);color:#fff !important;font-weight:700;font-size:14px;box-shadow:0 14px 34px -10px rgba(79,70,229,.8);}
.va-float:hover{transform:translateY(-2px);}

/* ── Responsive ─────────────────────────────────────── */
@media (max-width:1080px){
  .va-nav{gap:20px;}
  .va-nav a{font-size:14px;}
  .va-grid.c4,.va-tech{grid-template-columns:repeat(2,1fr);}
  .va-steps{grid-template-columns:repeat(3,1fr);}
  .va-others{grid-template-columns:repeat(3,1fr);}
  .va-foot-grid{grid-template-columns:1fr 1fr;}
}
@media (max-width:960px){
  .va-nav,.va-head-cta .va-btn-ghost{display:none;}
  .va-burger{display:inline-flex;}
  /* Nền đặc: header đã có backdrop-filter, lồng thêm một lớp nữa thì trình duyệt bỏ qua và chữ phía sau lộ ra. */
  .va-mobnav{display:block;position:fixed;inset:72px 0 auto 0;z-index:59;background:var(--bg);border-bottom:1px solid var(--line2);
    box-shadow:0 24px 48px -12px rgba(0,0,0,.7);padding:10px 24px 24px;max-height:calc(100vh - 72px);overflow-y:auto;}
  .va-mobnav a{display:block;padding:14px 2px;border-bottom:1px solid var(--line);font-size:16px;font-weight:500;color:var(--ink2);}
  .va-mobnav a.active{color:var(--ink);}
  .va-mobnav a.va-btn{display:flex;margin-top:18px;width:100%;padding:13px 22px;border-bottom:0;color:#fff;font-weight:600;}
  .va-hero-grid,.va-svc-grid,.va-about,.va-agent-top,.va-contact{grid-template-columns:1fr;}
  .va-hero-grid{gap:44px;}
  .va-grid.c3{grid-template-columns:repeat(2,1fr);}
  .va-loop{grid-template-columns:1fr;gap:0;margin-top:36px;}
  .va-loop::before{top:22px;bottom:22px;left:22px;right:auto;width:1px;height:auto;background:linear-gradient(180deg,rgba(129,140,248,.6),rgba(129,140,248,.15));}
  .va-loop-step{display:grid;grid-template-columns:44px 1fr;column-gap:16px;text-align:left;padding:0 0 22px;}
  .va-loop-step h3{margin-top:10px;}
  .va-loop-step p{grid-column:2;}
  .va-timeline{grid-template-columns:repeat(2,1fr);}
  .va-pillars{grid-template-columns:1fr;gap:22px;margin-top:36px;}
  /* Điện thoại: form lên trước, thông tin + bản đồ xuống sau. */
  .va-contact > .va-form{order:-1;}
}
@media (max-width:640px){
  .va-wrap{padding:0 16px;}
  .va-section{padding:72px 0;}
  .va-section.tight{padding:56px 0;}
  .va-headin{height:64px;}
  .va-mobnav{inset:64px 0 auto 0;max-height:calc(100vh - 64px);padding:6px 16px 20px;}
  .va-logo-sub{display:none;}
  .va-head-cta .va-btn-primary{padding:9px 14px;font-size:13.5px;}
  .va-stats{grid-template-columns:repeat(2,1fr);}
  .va-stat:nth-child(3){border-left:0;}
  .va-stat:nth-child(n+3){border-top:1px solid var(--line);}
  .va-grid.c2,.va-grid.c3,.va-grid.c4,.va-tech,.va-steps,.va-timeline,.va-uses{grid-template-columns:1fr;}
  .va-grid{margin-top:36px;gap:14px;}
  .va-steps,.va-tech,.va-timeline,.va-contact{margin-top:36px;}
  .va-others{grid-template-columns:1fr 1fr;}
  .va-card{padding:22px;}
  .va-fields{grid-template-columns:1fr;}
  .va-console-body{font-size:12px;min-height:0;padding:16px 14px 18px;}
  .va-foot-grid{grid-template-columns:1fr;gap:30px;}
  .va-btnrow .va-btn{flex:1 1 auto;}
  .va-float span{display:none;}
  .va-float{padding:14px;}
}
@media (prefers-reduced-motion:reduce){
  .va-root *{animation:none !important;transition:none !important;}
  .va-cl{opacity:1;transform:none;}
}
`;
