/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// High limit for copy-pasted or uploaded text chunks
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Initialize Gemini API Key safely
const apiKey = process.env.GEMINI_API_KEY;

// Helper: safe JSON parsing
const parseSafeJson = (text: string) => {
  try {
    // Regex clean in case model added ```json or other wrappers
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON string:", text, err);
    throw new Error("模型返回的JSON格式不正确，请重试");
  }
};

// Helper: handle API rate limits and temporary unavailability with retry
const withRetry = async <T>(operationName: string, operation: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const isRetryable = err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
      if (isRetryable && attempt < maxRetries) {
        const delayMs = attempt * 1500;
        console.warn(`[${operationName}] API Error (${err?.status || err?.message}), retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      console.error(`[${operationName}] Final error after ${attempt} attempts:`, err);
      throw err;
    }
  }
  throw new Error(`Failed operation ${operationName} after ${maxRetries} retries`);
};

// API: Generate narrative continuation using Server-Sent Events (SSE)
app.post("/api/generate/continue", async (req, res) => {
  try {
    const { 
      settings, 
      recentText, 
      targetPlot, 
      generateLength = "中等", 
      isNewChapter,
      customApiUrl,
      customApiKey,
      customModel,
      customSystemPrompt
    } = req.body;

    const effectiveApiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : apiKey;
    if (!effectiveApiKey) {
      return res.status(500).json({ error: "API KEY 未配置。请在系统设置中设置 API Key，或联系管理员配置服务器 GEMINI_API_KEY。" });
    }

    const effectiveBaseUrl = customApiUrl && customApiUrl.trim() ? customApiUrl.trim() : undefined;
    const effectiveModel = customModel && customModel.trim() ? customModel.trim() : "gemini-3.5-flash";

    const charactersStr = settings?.characters
      ?.map((c: any) => `- ${c.name} (${c.role}): 性格：${c.personality}。备注：${c.description}`)
      .join("\n") || "未设定具体人物";

    const styleStr = settings?.style?.hasLearned
      ? `【语气基调】: ${settings.style.tone}\n【句风描述】: ${settings.style.description}\n【句式组合】: ${settings.style.wordLength}\n【对话美学】: ${settings.style.dialogStyle}\n【核心意象】: ${settings.style.customKeywords?.join(", ")}`
      : `风格分类: ${settings?.style?.tone || "常规纯真叙事"}`;

    let lengthInstruction = "";
    const numLimit = parseInt(generateLength, 10);
    if (!isNaN(numLimit) && numLimit > 0) {
      lengthInstruction = `请续写接下来的情节，字数严格控制在 ${numLimit} 字左右。`;
    } else {
      const lengthGuides: Record<string, string> = {
        "短": "续写300字左右，情节紧凑、直接切入。",
        "中等": "续写600-800字，注重感官动作、穿插优雅对话。",
        "长": "续写1200-1500字，描写细腻，有环境景物渲染与心理深度分析。",
        "简短": "续写300字左右，情节紧凑、直接切入。",
        "很长": "续写1200-1500字，描写细腻，有环境景物渲染与心理深度分析。"
      };
      lengthInstruction = lengthGuides[generateLength] || lengthGuides["中等"];
    }

    const transitionInstruction = isNewChapter
      ? "当前是新的一章，请在以上所给『前文最后的内容』的情节基础上，以合理的时间或场景跨度过渡开篇，自然衔接上文并开启新的一章的情节。"
      : "请必须从『前文最后的内容』的最末一个字符严密顺承下去，可以直接继续写下一句话或者下一个段落。";

    const prompt = `你就是这位天才原创作者。现在，请衔接最后的小说正文，撰写一个完整连贯、引人入胜的后续段落。

【小说名称】: ${settings?.title || "未命名故事"}
【世界背景】: 
${settings?.background || "未设定背景"}

【登场人物】:
${charactersStr}

【专属写作风格（你必须完全模仿这种句式、描写密度 and 语气）】:
${styleStr}

【当前前文最后的内容】:
"""
${recentText || "（由于没有前文，请直接作为第一章、第一小节开篇创作）"}
"""

【新章节与顺承提示】:
${transitionInstruction}

【本次续写走向大纲与设定】:
${targetPlot || "自由发挥，顺其自然地推进剧情。"}

【续写篇幅要求】:
${lengthInstruction}

【创作指南与铁律】:
1. 延续性：语气腔调不突兀，不要写任何“上集回顾”、“承接上文”、“第X章”之类的引语，直接输出小说正文内容！
2. 风格契合度：深度运用上述写作风格词汇、句长偏好与对话质感（如是古风则用半文半白，如是阴郁纪实则多白描细节描写）。在文中可以自然流露高频意象。
3. 纯净内容：严禁输出任何 markdown 格式（如不需要用 # , * , - 或 \`\`\` 符号等，除非文本本身需要标点，但一定不要输出markdown标题等），只输出纯粹的小说段落文字本身！`;

    const systemPrompt = customSystemPrompt && customSystemPrompt.trim()
      ? customSystemPrompt
      : "你是一位专心致志、文笔行云流水的小说创作助手。严禁输出任何 markdown 格式或旁白解释，只输出小说正文段落。";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ];

    // Determine target OpenAI Url
    let baseUrl = effectiveBaseUrl ? effectiveBaseUrl.trim() : "https://generativelanguage.googleapis.com/v1beta/openai";
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${effectiveApiKey}`,
    };

    const performStreamRequest = async () => {
      const apiResponse = await fetch(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          temperature: 0.85,
          stream: true,
        }),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`OpenAI-compatible Endpoint Error (${apiResponse.status}): ${errorText}`);
      }
      return apiResponse;
    };

    let apiResponse;
    try {
      apiResponse = await withRetry("generate/continue", performStreamRequest);
    } catch (err: any) {
      // Automatic stability fallback to Gemini 3.5 if custom fails on default baseUrl
      if (!effectiveBaseUrl && effectiveModel !== "gemini-3.5-flash") {
        console.warn(`[generate/continue] Model ${effectiveModel} failed, auto falling back to gemini-3.5-flash...`);
        const fallbackUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
        apiResponse = await withRetry("generate/continue (fallback)", () => fetch(fallbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "gemini-3.5-flash",
            messages,
            temperature: 0.85,
            stream: true,
          }),
        }));
      } else {
        throw err;
      }
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = apiResponse.body?.getReader();
    if (!reader) {
      throw new Error("服务端响应主体无法实现数据流模式转换");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finished = false;

    while (!finished) {
      const { value, done } = await reader.read();
      if (done) {
        finished = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;

        if (cleaned.startsWith("data:")) {
          const dataStr = cleaned.slice(5).trim();
          if (dataStr === "[DONE]") {
            res.write("data: [DONE]\n\n");
          } else {
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
              }
            } catch (e: any) {
              // Ignore partial chunk syntax errors or other exceptions
            }
          }
        }
      }
    }

    // Process leftover buffer
    if (buffer.trim()) {
      const cleaned = buffer.trim();
      if (cleaned.startsWith("data:")) {
        const dataStr = cleaned.slice(5).trim();
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("SSE stream error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "流式续写失败" })}\n\n`);
    res.end();
  }
});

// API: Contextual Selection Rewrite
app.post("/api/generate/rewrite", async (req, res) => {
  try {
    const { 
      settings, 
      selectedText, 
      instruction, 
      parentParagraphsBefore, 
      parentParagraphsAfter,
      customApiUrl,
      customApiKey,
      customModel,
      customSystemPrompt
    } = req.body;

    if (!selectedText) {
      return res.status(400).json({ error: "选中的文本为空" });
    }

    const effectiveApiKey = (customApiKey && customApiKey.trim()) ? customApiKey.trim() : apiKey;
    if (!effectiveApiKey) {
      return res.status(500).json({ error: "API KEY 未配置。请在系统设置中设置 API Key，或联系管理员配置服务器 GEMINI_API_KEY。" });
    }

    const effectiveBaseUrl = customApiUrl && customApiUrl.trim() ? customApiUrl.trim() : undefined;
    const effectiveModel = customModel && customModel.trim() ? customModel.trim() : "gemini-3.5-flash";

    const charactersStr = settings?.characters
      ?.map((c: any) => `- ${c.name}: ${c.personality}`)
      .join(", ") || "";

    const styleStr = settings?.style?.hasLearned
      ? `语气: ${settings.style.tone}。句式: ${settings.style.wordLength}。描写倾向: ${settings.style.description}`
      : `风格: ${settings?.style?.tone || "常规叙事"}`;

    const prompt = `您是一位精雕细琢的小说润色与改写大师。这里有一段故事文本中 user 挑选出的局部分支段落，我们需要根据特定指令对其进行“局部改写（重写）”。

【整部分背景与角色】:
- 人物列表: ${charactersStr}
- 模仿的写作风格: ${styleStr}

【上下文环境（以便保持剧情衔接自然）】:
前文: ... ${parentParagraphsBefore || "（无）"} ...
后文: ... ${parentParagraphsAfter || "（无）"} ...

【选中的需要改写的片段】:
"""
${selectedText}
"""

【改写指令】:
"${instruction}"

【改写要求】:
1. 请完全在小说风格的约束下改写这一段文本。
2. 必须保留这段文本基本的情节骨架和物理实体，但根据指令修改其情感、描写厚度、对话腔调、文字画卷度、张力或结构。
3. 请直接输出改写润色后的**小说正文纯文本**。不要包含任何“修改前”、“修改后”或“收到，以下是修改”之类的附言。`;

    const systemPrompt = customSystemPrompt && customSystemPrompt.trim()
      ? customSystemPrompt
      : "您是一位精雕细琢的小说润色与改写大师，请直接输出修改后的小说正文纯文本。不要解释或包含多余格式。";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ];

    // Determine target OpenAI Url
    let baseUrl = effectiveBaseUrl ? effectiveBaseUrl.trim() : "https://generativelanguage.googleapis.com/v1beta/openai";
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${effectiveApiKey}`,
    };

    const performRequest = async () => {
      const apiResponse = await fetch(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          temperature: 0.75,
        }),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`OpenAI-compatible Endpoint Error (${apiResponse.status}): ${errorText}`);
      }
      return apiResponse;
    };

    let apiResponse;
    try {
      apiResponse = await withRetry("generate/rewrite", performRequest);
    } catch (err: any) {
      if (!effectiveBaseUrl && effectiveModel !== "gemini-3.5-flash") {
        console.warn(`[generate/rewrite] Model ${effectiveModel} failed, auto falling back to gemini-3.5-flash...`);
        const fallbackUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
        apiResponse = await withRetry("generate/rewrite (fallback)", () => fetch(fallbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "gemini-3.5-flash",
            messages,
            temperature: 0.75,
          }),
        }));
      } else {
        throw err;
      }
    }

    const data = await apiResponse.json() as any;
    const content = data.choices?.[0]?.message?.content || "";

    return res.json({
      success: true,
      rewrittenText: content.trim()
    });
  } catch (error: any) {
    console.error("Rewrite error:", error);
    return res.status(500).json({ error: error.message || "改写失败" });
  }
});


// Dev & Production Middleware setup
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT}`);
  });
};

startServer();
