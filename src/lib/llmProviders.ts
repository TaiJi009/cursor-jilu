/** 自定义 Key 时可选择的服务商（站点默认仍为智谱） */
export type LlmProviderId = "zhipu" | "deepseek" | "openai" | "dashscope";

export const DEFAULT_LLM_PROVIDER: LlmProviderId = "zhipu";

/** 展示顺序：智谱 → DeepSeek → OpenAI → 其他 */
export const LLM_PROVIDER_OPTIONS: { id: LlmProviderId; name: string; hint: string }[] = [
  { id: "zhipu", name: "智谱 GLM", hint: "glm-4v 视觉，国内常用" },
  {
    id: "deepseek",
    name: "DeepSeek",
    hint: "官方 api.deepseek.com，OpenAI 兼容接口；图片识别能力以平台当前支持为准"
  },
  { id: "openai", name: "OpenAI", hint: "gpt-4o-mini，需国际网络；浏览器可能受 CORS 限制" },
  { id: "dashscope", name: "阿里云通义", hint: "DashScope qwen-vl" }
];

export function isLlmProviderId(v: string): v is LlmProviderId {
  return v === "zhipu" || v === "deepseek" || v === "openai" || v === "dashscope";
}
