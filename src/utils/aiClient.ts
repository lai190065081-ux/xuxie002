import { buildContinuePrompt, buildRewritePrompt } from "./promptBuilder";

export const fetchAIContinueStream = async (
  systemConfig: any,
  payload: any
) => {
  const isCapacitor = !!(window as any).Capacitor || window.location.protocol === "file:" || window.location.protocol === "capacitor:";
  
  if (isCapacitor && (!systemConfig.apiKey || systemConfig.apiKey.trim() === "")) {
    throw new Error("在移动端（APP）独立运行模式下，系统默认网关无法直接被访问。请前往底部的【系统配置】独立填写您的 API Key！");
  }

  // 1. If backend proxy is needed (No API key provided by user, meaning they want to use our server's internal key)
  if (!systemConfig.apiKey || systemConfig.apiKey.trim() === "") {
    return await fetch("/api/generate/continue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  // 2. Direct Frontend fetch for standard OpenAI format
  let baseUrl = systemConfig.apiUrl ? systemConfig.apiUrl.trim() : "https://generativelanguage.googleapis.com/v1beta/openai";
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  let requestUrl = "";
  if (baseUrl.includes("/chat/completions")) {
    requestUrl = baseUrl;
  } else if (baseUrl === "https://generativelanguage.googleapis.com/v1beta/openai") {
    requestUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
  } else if (baseUrl.endsWith("/v1") || baseUrl.endsWith("/v1/")) {
    requestUrl = `${baseUrl}/chat/completions`;
  } else {
    requestUrl = `${baseUrl}/v1/chat/completions`;
  }

  const effectiveApiKey = systemConfig.apiKey.trim();
  const effectiveModel = systemConfig.apiModel && systemConfig.apiModel.trim() ? systemConfig.apiModel.trim() : "gemini-3.5-flash";

  const prompt = buildContinuePrompt(
    payload.settings,
    payload.recentText,
    payload.targetPlot,
    payload.generateLength,
    payload.isNewChapter
  );

  const systemPrompt = systemConfig.systemPrompt && systemConfig.systemPrompt.trim()
    ? systemConfig.systemPrompt
    : "你是一位专心致志、文笔行云流水的小说创作助手。严禁输出任何 markdown 格式或旁白解释，只输出小说正文段落。";

  return await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${effectiveApiKey}`,
    },
    body: JSON.stringify({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.85,
      stream: true,
    }),
  });
};

export const fetchAIRewrite = async (
  systemConfig: any,
  payload: any
) => {
  const isCapacitor = !!(window as any).Capacitor || window.location.protocol === "file:" || window.location.protocol === "capacitor:";
  
  if (isCapacitor && (!systemConfig.apiKey || systemConfig.apiKey.trim() === "")) {
    throw new Error("在移动端（APP）独立运行模式下，系统默认网关无法直接被访问。请前往底部的【系统配置】独立填写您的 API Key！");
  }

  // 1. Backend API Proxy fallback
  if (!systemConfig.apiKey || systemConfig.apiKey.trim() === "") {
    const res = await fetch("/api/generate/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Endpoint Error: ${errTxt}`);
    }
    const data = await res.json();
    return data; // Returns JSON object { success: true, rewrittenText: ... }
  }

  // 2. Direct Frontend Promise
  let baseUrl = systemConfig.apiUrl ? systemConfig.apiUrl.trim() : "https://generativelanguage.googleapis.com/v1beta/openai";
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  let requestUrl = "";
  if (baseUrl.includes("/chat/completions")) {
    requestUrl = baseUrl;
  } else if (baseUrl === "https://generativelanguage.googleapis.com/v1beta/openai") {
    requestUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
  } else if (baseUrl.endsWith("/v1") || baseUrl.endsWith("/v1/")) {
    requestUrl = `${baseUrl}/chat/completions`;
  } else {
    requestUrl = `${baseUrl}/v1/chat/completions`;
  }

  const effectiveApiKey = systemConfig.apiKey.trim();
  const effectiveModel = systemConfig.apiModel && systemConfig.apiModel.trim() ? systemConfig.apiModel.trim() : "gemini-3.5-flash";

  const prompt = buildRewritePrompt(
    payload.settings,
    payload.selectedText,
    payload.instruction,
    `【前文】：\n${payload.parentParagraphsBefore}\n\n【后文】：\n${payload.parentParagraphsAfter}`
  );

  const systemPrompt = systemConfig.systemPrompt && systemConfig.systemPrompt.trim()
    ? systemConfig.systemPrompt
    : "您是一位精雕细琢的小说润色与改写大师，请直接输出修改后的小说正文纯文本。不要解释或包含多余格式。";

  const res = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${effectiveApiKey}`,
    },
    body: JSON.stringify({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.75,
    }),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`OpenAI-compatible Endpoint Error: ${errTxt}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { success: true, rewrittenText: content };
};
