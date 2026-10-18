"use client";

import AiProvidersEditor from "@/components/AiProvidersEditor";

/**
 * Ô nhập key AI với dữ liệu giả: key chung của admin (đã lưu 2 nguồn) và key
 * riêng của studio (chưa nhập, đang dùng AI chung).
 *
 * Component tự gọi /api/…/ai-providers khi mở, nên ở đây chặn fetch của ĐÚNG
 * các đường đó và trả dữ liệu mẫu — đường khác đi như thường.
 */
const SHARED = {
  providers: [
    { id: "a1", type: "anthropic", model: "claude-haiku-5-5", effort: "low", label: "", keyMask: "sk-ant…a1b2" },
    { id: "b2", type: "gemini", model: "gemini-flash-latest", label: "Gemini miễn phí", keyMask: "AIzaSy…9xYz" },
  ],
  error: null,
  envCount: 1,
};

const w = typeof window !== "undefined" ? (window as Window & { __aiProvidersDemo?: boolean }) : null;
if (w && !w.__aiProvidersDemo) {
  w.__aiProvidersDemo = true;
  const real = w.fetch.bind(w);
  w.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/\/api\/(admin|studio)\/ai-providers\/test$/.test(url)) {
      return Response.json({ ok: true, ms: 1240, sample: "Xin chào! Mình là trợ lý của studio, rất vui được hỗ trợ bạn." });
    }
    if (/\/api\/admin\/ai-providers$/.test(url)) {
      return Response.json(init?.method === "POST" ? { providers: SHARED.providers } : SHARED);
    }
    if (/\/api\/studio\/ai-providers$/.test(url)) {
      return Response.json(init?.method === "POST" ? { providers: [] } : { providers: [], error: null, sharedCount: 2 });
    }
    return real(input, init);
  };
}

export default function AiProvidersDemo() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AiProvidersEditor scope="shared" />
      <AiProvidersEditor scope="studio" />
    </div>
  );
}
