import { ArrowRight, Check } from "lucide-react";
import { AGENT, CONSOLE_LINES } from "@/lib/vieetjk-ai/content";

const CONSOLE_MARK = { cmd: "›", ok: "✓", done: "◆" } as const;

/** Khung "console" minh hoạ một AI Agent đang xử lý yêu cầu (chỉ CSS, không JS). */
export function AgentConsole() {
  return (
    <div className="va-console" aria-label="Minh hoạ một AI Agent đang xử lý yêu cầu của khách hàng" role="img">
      <div className="va-console-in">
        <div className="va-console-bar" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="va-console-title">vieetjk-agent · cskh</span>
          <span className="va-console-live">Live</span>
        </div>
        <div className="va-console-body" aria-hidden="true">
          {CONSOLE_LINES.map((l, i) => (
            <div key={i} className={`va-cl ${l.kind}`} style={{ animationDelay: `${0.35 + i * 0.7}s` }}>
              <span className="k">{CONSOLE_MARK[l.kind]}</span>
              <span>
                {l.text}
                {i === CONSOLE_LINES.length - 1 && <span className="va-cursor" />}
              </span>
            </div>
          ))}
        </div>
        <div className="va-tools" aria-hidden="true">
          {["Zalo OA", "CRM", "Google Sheets", "Email", "Lịch giao hàng"].map((t) => (
            <span key={t} className="va-tool">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Khối giới thiệu AI Agent: vòng làm việc 5 bước + ứng dụng tiêu biểu. */
export function AgentPanel({ showLearnMore = true }: { showLearnMore?: boolean }) {
  return (
    <div className="va-agent">
      <div className="va-agent-top">
        <div>
          <span className="va-eyebrow">{AGENT.eyebrow}</span>
          <h2 className="va-h2">{AGENT.title}</h2>
          <p className="va-lead">{AGENT.lead}</p>
        </div>
        <ul className="va-uses">
          {AGENT.uses.map((u) => (
            <li key={u} className="va-check">
              <Check size={17} /> {u}
            </li>
          ))}
        </ul>
      </div>
      <ol className="va-loop">
        {AGENT.loop.map((s, i) => (
          <li key={s.title} className="va-loop-step">
            <span className="va-loop-n">0{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="va-btnrow">
        {showLearnMore && (
          <a href="/ai-agent" className="va-btn va-btn-primary">
            Tìm hiểu AI Agent <ArrowRight size={17} />
          </a>
        )}
        <a href="#lien-he" className={`va-btn ${showLearnMore ? "va-btn-ghost" : "va-btn-primary"}`}>
          Đặt lịch demo
        </a>
      </div>
    </div>
  );
}
