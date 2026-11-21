import "server-only";

export function getModelConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseURL = process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "");
  if (!apiKey || !model || baseURL !== "https://openrouter.ai/api/v1")
    throw new Error("模型服务配置不完整，请联系管理员。");
  return { apiKey, model, configuration: { baseURL } };
}
