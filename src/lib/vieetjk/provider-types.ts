/**
 * Kiểu & danh mục nhà cung cấp AI — phần DÙNG CHUNG cho máy chủ lẫn giao diện.
 *
 * Cố ý không import gì: ô nhập khoá AI (client component) cần danh mục loại +
 * model gợi ý, còn máy chủ cần đúng các kiểu ấy để kiểm dữ liệu. Thêm import
 * máy chủ vào đây là kéo nó sang trình duyệt.
 */

export type ProviderType = "gemini" | "openai" | "anthropic" | "responses";

export type ChatProvider = {
  type: ProviderType;
  key: string;
  model: string;
  baseUrl?: string;
  effort?: string;
  label: string;
  /**
   * Nguồn này của ai — để key hết tiền thì báo ĐÚNG người trả tiền
   * (provider-alert): "studio" = key riêng → chủ studio; "shared" / "env" =
   * key chung / biến môi trường → admin. Chỉ loadProviders điền.
   */
  scope?: "studio" | "shared" | "env";
};

/** Một nguồn AI lưu trong DB (trang quản trị / trang chatbox của studio). */
export type StoredProvider = ChatProvider & { id: string };

/** Bản gửi xuống trình duyệt — KHÔNG có khoá, chỉ có khoá đã che. */
export type PublicProvider = Omit<StoredProvider, "key"> & { keyMask: string };

/** Chỗ nhập key AI — thông báo "key hết tiền" (provider-alert) trỏ thẳng tới đây. */
export const AI_KEY_ADMIN_URL = "/dashboard/admin/system";
export const AI_KEY_STUDIO_URL = "/dashboard/studio/chatbox";

/** Mỗi nơi lưu tối đa bấy nhiêu nguồn — bot thử lần lượt, nhiều hơn chỉ chậm. */
export const MAX_PROVIDERS = 10;

/** Mức suy nghĩ hợp lệ (Claude: output_config.effort · Responses: reasoning.effort). */
export const EFFORTS = ["low", "medium", "high", "xhigh"] as const;

export const EFFORT_LABEL: Record<string, string> = {
  low: "Thấp — nhanh, rẻ (khuyên dùng)",
  medium: "Vừa",
  high: "Cao",
  xhigh: "Rất cao",
};

export interface ProviderPreset {
  type: ProviderType;
  name: string;
  /** Model điền sẵn khi chọn loại này. */
  model: string;
  models: string[];
  baseUrlHint: string;
  /** Mức suy nghĩ điền sẵn ("" = không gửi). */
  effort: string;
  efforts: string[];
  keyHint: string;
  keyUrl?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: "anthropic",
    name: "Claude (Anthropic)",
    model: "claude-haiku-5-5",
    models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
    baseUrlHint: "Để trống = https://api.anthropic.com/v1",
    effort: "low",
    efforts: ["low", "medium", "high"],
    keyHint: "sk-ant-…",
    keyUrl: "https://platform.claude.com",
  },
  {
    type: "gemini",
    name: "Google Gemini",
    model: "gemini-flash-latest",
    models: ["gemini-flash-latest"],
    baseUrlHint: "Để trống = máy chủ của Google",
    effort: "",
    efforts: [],
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com",
  },
  {
    type: "openai",
    name: "Chuẩn OpenAI (OpenAI, OpenRouter, DeepSeek, Groq, Meta…)",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "deepseek/deepseek-chat"],
    baseUrlHint: "Để trống = https://api.openai.com/v1 · OpenRouter: https://openrouter.ai/api/v1",
    effort: "",
    efforts: [],
    keyHint: "sk-…",
  },
  {
    type: "responses",
    name: "OpenAI Responses (Codex / bên bán lại)",
    model: "",
    models: [],
    baseUrlHint: "Vd https://api.openai.com/v1",
    effort: "medium",
    efforts: ["low", "medium", "high", "xhigh"],
    keyHint: "sk-…",
  },
];

export function presetOf(type: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.type === type) ?? PROVIDER_PRESETS[0];
}
