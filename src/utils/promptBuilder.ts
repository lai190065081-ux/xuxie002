export const buildContinuePrompt = (settings: any, recentText: string, targetPlot: string, generateLength: string, isNewChapter: boolean) => {
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

  return `你就是这位天才原创作者。现在，请衔接最后的小说正文，撰写一个完整连贯、引人入胜的后续段落。

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
};

export const buildRewritePrompt = (settings: any, originalText: string, instruction: string, context: string) => {
  const charactersStr = settings?.characters
    ?.map((c: any) => `- ${c.name}: ${c.personality}`)
    .join("\n") || "无";

  return `你是一位技艺精湛的小说修音与润色大师。请帮我对小说片段进行**局部重写/润色**。

【小说基本设定】：
题材：${settings?.genre || "未设定"}。基调：${settings?.tone || ""}
角色参考：
${charactersStr}

【当前文本的上下文提示 (仅供参考定位)】：
${context}

【待修饰的原段落】：
"""
${originalText}
"""

【作者给出的局部修改指令】：
${instruction && instruction.trim() !== "" ? instruction : "（无具体指令，请自动对该段落进行文笔润色，提升辞藻美感和表现力，或使对话更符合角色性格。）"}

【规则约束】：
1. 你的返回结果将被**直接替换**到原文对应的位置。因此，**绝对不可**输出任何客套话、解释说明、Markdown代码块符号，以及“修改后段落：”之类的多余内容。
2. 必须保留这段文本基本的情节骨架和物理实体，但根据指令修改其情感、描写厚度、对话腔调、文字画卷度、张力或结构。
3. 请直接输出改写润色后的**小说正文纯文本**。不要包含任何“修改前”、“修改后”或“收到，以下是修改”之类的附言。`;
};
