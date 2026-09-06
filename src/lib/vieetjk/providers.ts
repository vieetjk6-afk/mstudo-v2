import "server-only";
import type { ChatTurn } from "./assistant";
import { noStoreFetch } from "@/lib/no-store-fetch";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Nhiều nhà cung cấp AI cho chatbox — cấu hình danh sách, bot thử lần lượt, cái
 * nào lỗi/hết hạn mức thì tự chuyển sang cái kế tiếp (dự phòng, gộp quota).
 *
 * Cấu hình qua biến môi trường CHAT_PROVIDERS (JSON mảng), vd:
 * [
 *   {"type":"gemini","key":"AIza...","model":"gemini-flash-latest"},
 *   {"type":"openai","key":"sk-or-...","model":"deepseek/deepseek-chat","baseUrl":"https://openrouter.ai/api/v1"},
 *   {"type":"openai","key":"sk-...","model":"gpt-4o-mini"}
 * ]
 * Nếu không đặt CHAT_PROVIDERS → dùng GEMINI_API_KEY (+ GEMINI_MODEL) như 1 provider.
 *
 * - type "gemini": Google Gemini (generativelanguage.googleapis.com).
 * - type "openai": mọi API chuẩn OpenAI Chat Completions (OpenAI, OpenRouter,
 *   DeepSeek, Groq, Together…). baseUrl mặc định https://api.openai.com/v1.
 * - type "anthropic": Claude API trực tiếp (api.anthropic.com Messages API).
 * - type "responses": OpenAI **Responses API** (/v1/responses, wire_api="responses")
 *   — dùng cho Codex & các reseller (vd base_url https://codex.../v1). Hỗ trợ
 *   reasoning effort + store:false. Field "effort" tuỳ chọn (low|medium|high|xhigh).
 */

export type ChatProvider = {
  type: "gemini" | "openai" | "anthropic" | "responses";
  key: string;
  model: string;
  baseUrl?: string;
  effort?: string;
  label: string;
};

function normalize(p: any): ChatProvider | null {
  const type =
    p?.type === "openai"
      ? "openai"
      : p?.type === "gemini"
      ? "gemini"
      : p?.type === "anthropic"
      ? "anthropic"
      : p?.type === "responses"
      ? "responses"
      : null;
  const key = typeof p?.key === "string" ? p.key.trim() : "";
  if (!type || !key) return null;
  const model =
    typeof p?.model === "string" && p.model.trim()
      ? p.model.trim()
      : type === "gemini"
      ? "gemini-flash-latest"
      : type === "anthropic"
      ? "claude-haiku-4-5"
      : "gpt-4o-mini";
  const baseUrl = typeof p?.baseUrl === "string" && p.baseUrl.trim() ? p.baseUrl.trim().replace(/\/+$/, "") : undefined;
  const effort = typeof p?.effort === "string" && p.effort.trim() ? p.effort.trim() : undefined;
  const label = typeof p?.label === "string" && p.label.trim() ? p.label.trim() : `${type}:${model}`;
  return { type, key, model, baseUrl, effort, label };
}

/** Danh sách provider theo thứ tự ưu tiên. */
export function loadProviders(): ChatProvider[] {
  const raw = process.env.CHAT_PROVIDERS;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const out = arr.map(normalize).filter((p): p is ChatProvider => !!p);
        if (out.length) return out;
      }
    } catch {
      /* JSON hỏng → rơi xuống fallback bên dưới */
    }
  }
  const gk = process.env.GEMINI_API_KEY;
  if (gk) {
    return [{ type: "gemini", key: gk, model: process.env.GEMINI_MODEL || "gemini-flash-latest", label: "gemini" }];
  }
  return [];
}

/** Gọi provider ở chế độ streaming; trả về Response thô để đọc SSE. */
export function requestProvider(p: ChatProvider, systemText: string, turns: ChatTurn[]): Promise<Response> {
  if (p.type === "gemini") {
    const base = p.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    const generationConfig: Record<string, unknown> = { temperature: 0.6, maxOutputTokens: 2048 };
    // Chỉ model 2.5-* chắc chắn nhận thinkingConfig (tắt suy nghĩ, tránh rỗng).
    if (p.model.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return noStoreFetch(`${base}/models/${encodeURIComponent(p.model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": p.key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
        generationConfig,
      }),
      cache: "no-store",
    });
  }
  if (p.type === "responses") {
    // OpenAI Responses API (/v1/responses) — Codex & reseller (wire_api="responses").
    const base = p.baseUrl || "https://api.openai.com/v1";
    const bodyResp: Record<string, unknown> = {
      model: p.model,
      instructions: systemText,
      input: turns.map((t) => ({ role: t.role, content: t.content })),
      stream: true,
      store: false, // disable_response_storage
      max_output_tokens: 4096,
      reasoning: { effort: p.effort || "medium" },
    };
    return noStoreFetch(`${base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify(bodyResp),
      cache: "no-store",
    });
  }

  if (p.type === "anthropic") {
    // Claude API trực tiếp (Messages API, streaming SSE).
    const base = p.baseUrl || "https://api.anthropic.com/v1";
    return noStoreFetch(`${base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": p.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 2048,
        system: systemText,
        messages: turns.map((t) => ({ role: t.role, content: t.content })),
        stream: true,
      }),
      cache: "no-store",
    });
  }

  // OpenAI-compatible Chat Completions.
  const base = p.baseUrl || "https://api.openai.com/v1";
  return noStoreFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({
      model: p.model,
      stream: true,
      temperature: 0.6,
      max_tokens: 2048,
      messages: [{ role: "system", content: systemText }, ...turns.map((t) => ({ role: t.role, content: t.content }))],
    }),
    cache: "no-store",
  });
}

/** Rút đoạn text tăng dần từ một chunk JSON SSE (khác nhau theo provider). */
export function extractDelta(p: ChatProvider, json: any): string {
  if (p.type === "gemini") {
    const parts = json?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((x: any) => (typeof x?.text === "string" ? x.text : "")).join("") : "";
  }
  if (p.type === "anthropic") {
    // Anthropic SSE: text nằm ở content_block_delta / text_delta.
    if (json?.type === "content_block_delta" && json?.delta?.type === "text_delta") {
      return typeof json.delta.text === "string" ? json.delta.text : "";
    }
    return "";
  }
  if (p.type === "responses") {
    // Responses API SSE: text tăng dần ở response.output_text.delta.
    if (json?.type === "response.output_text.delta") {
      return typeof json.delta === "string" ? json.delta : "";
    }
    return "";
  }
  return typeof json?.choices?.[0]?.delta?.content === "string" ? json.choices[0].delta.content : "";
}

/** Lý do dừng khi không có text (chẩn đoán) — chủ yếu cho Gemini. */
export function finishReason(p: ChatProvider, json: any): string {
  if (p.type === "gemini") return json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || "";
  if (p.type === "anthropic") return json?.delta?.stop_reason || (json?.type === "message_stop" ? "stop" : "");
  if (p.type === "responses") {
    if (json?.type === "response.failed" || json?.type === "response.incomplete") {
      return json?.response?.status || json?.type;
    }
    if (json?.type === "error") return json?.error?.message || "error";
    return "";
  }
  return json?.choices?.[0]?.finish_reason || "";
}
