/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Download, Plus, Trash2, FileText, ChevronDown, Check, X, RefreshCw, Sparkles, BookOpen, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Chapter, NovelSettings, SystemConfig } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface NovelEditorProps {
  chapters: Chapter[];
  activeChapterId: string;
  onChaptersUpdate: (updatedList: Chapter[]) => void;
  onActiveChapterChange: (id: string) => void;
  settings: NovelSettings;
  isStreaming: boolean;
  onGenerateContinue: (targetPlot: string, generateLength: string) => void;
  systemConfig?: SystemConfig;
  isImmersive?: boolean;
  setIsImmersive?: (val: boolean) => void;
}

export default function NovelEditor({
  chapters,
  activeChapterId,
  onChaptersUpdate,
  onActiveChapterChange,
  settings,
  isStreaming,
  onGenerateContinue,
  systemConfig,
  isImmersive = false,
  setIsImmersive,
}: NovelEditorProps) {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriteResult, setRewriteResult] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);

  const textareaRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];

  useEffect(() => {
    // Clear selection state when switching chapters
    setSelectedText("");
    setSelectionRange(null);
    setRewriteResult("");
    setIsChapterDrawerOpen(false);

    // Clear scroll timeout when switching chapters
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Restore scroll position
    const targetScrollTop = activeChapter?.meta?.scrollTop || 0;
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = targetScrollTop;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeChapterId]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      onChaptersUpdate(
        chapters.map((c) =>
          c.id === activeChapterId
            ? {
                ...c,
                meta: {
                  ...(c.meta || {}),
                  scrollTop,
                },
              }
            : c
        )
      );
    }, 100);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const updatedContent = e.target.value;
    const wordCount = updatedContent.replace(/\s+/g, "").length;
    onChaptersUpdate(
      chapters.map((c) =>
        c.id === activeChapterId
          ? {
              ...c,
              content: updatedContent,
              wordCount,
              lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }),
            }
          : c
      )
    );
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedTitle = e.target.value;
    onChaptersUpdate(
      chapters.map((c) =>
        c.id === activeChapterId
          ? { ...c, title: updatedTitle, lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }) }
          : c
      )
    );
  };

  const handleSelectText = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (start !== end) {
      const selected = target.value.substring(start, end);
      setSelectedText(selected);
      setSelectionRange({ start, end });
    }
  };

  const handleAddChapter = () => {
    const title = newChapterTitle.trim() || `第 ${chapters.length + 1} 章 新篇章`;
    const newCap: Chapter = {
      id: crypto.randomUUID(),
      title,
      content: "",
      wordCount: 0,
      lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }),
    };
    onChaptersUpdate([...chapters, newCap]);
    onActiveChapterChange(newCap.id);
    setNewChapterTitle("");
    setIsChapterDrawerOpen(false);
  };

  const handleDeleteActiveChapter = () => {
    if (chapters.length <= 1) return; // Prevent deleting the last chapter
    const activeIndex = chapters.findIndex((c) => c.id === activeChapterId);
    const updatedList = chapters.filter((c) => c.id !== activeChapterId);
    onChaptersUpdate(updatedList);

    // Swap active chapter
    const nextActiveIndex = activeIndex > 1 ? activeIndex - 1 : 0;
    onActiveChapterChange(updatedList[nextActiveIndex].id);
    setIsChapterDrawerOpen(false);
  };

  const handleTriggerRewrite = async (presetInstruction?: string) => {
    const instructionToUse = presetInstruction || rewriteInstruction;
    if (!selectedText || !instructionToUse.trim()) return;

    setIsRewriting(true);
    setRewriteResult("");

    try {
      const text = activeChapter.content;
      const startIdx = selectionRange?.start || 0;
      const endIdx = selectionRange?.end || text.length;

      const beforeContext = text.substring(Math.max(0, startIdx - 300), startIdx);
      const afterContext = text.substring(endIdx, Math.min(text.length, endIdx + 300));

      const response = await fetch("/api/generate/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings,
          selectedText,
          instruction: instructionToUse,
          parentParagraphsBefore: beforeContext,
          parentParagraphsAfter: afterContext,
          customApiUrl: systemConfig?.apiUrl,
          customApiKey: systemConfig?.apiKey,
          customModel: systemConfig?.apiModel,
          customSystemPrompt: systemConfig?.systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("改写微调请求失败");
      }

      const data = await response.json();
      if (data.success && data.rewrittenText) {
        setRewriteResult(data.rewrittenText.trim());
      } else {
        throw new Error("没能成功润色生成替换文法");
      }
    } catch (err: any) {
      console.error(err);
      setRewriteResult(`润色出现系统异常: ${err.message || "请稍后重试"}`);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleReplaceSelection = () => {
    if (!selectionRange || !rewriteResult || rewriteResult.startsWith("润色出现系统异常")) return;

    const oldText = activeChapter.content;
    const newContent =
      oldText.substring(0, selectionRange.start) +
      rewriteResult +
      oldText.substring(selectionRange.end);

    const wordCount = newContent.replace(/\s+/g, "").length;

    onChaptersUpdate(
      chapters.map((c) =>
        c.id === activeChapterId
          ? {
              ...c,
              content: newContent,
              wordCount,
              lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }),
            }
          : c
      )
    );

    // Reset selection state
    setSelectedText("");
    setSelectionRange(null);
    setRewriteResult("");
    setRewriteInstruction("");
  };

  const handleWorkspaceClick = (e: React.MouseEvent) => {
    if (isImmersive && setIsImmersive) {
      setIsImmersive(false);
      return;
    }

    // Capture simple clicks to enter immersion mode, ignoring interactive widgets
    const target = e.target as HTMLElement;
    const isInteractive = target.closest("button") || target.closest("textarea") || target.closest("input") || target.closest("select") || target.closest("#mobile_precision_drawer") || target.closest("#chapters_drawer_sheet");
    if (!isInteractive && setIsImmersive) {
      setIsImmersive(true);
    }
  };

  const handleExportTxt = () => {
    if (!activeChapter) return;
    const bookTitle = settings.title || "小说续写成果";
    const blob = new Blob([`《${bookTitle}》\n\n${activeChapter.title}\n\n${activeChapter.content}`], {
      type: "text/plain;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${bookTitle}_${activeChapter.title}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className={
        isImmersive
          ? "fixed inset-0 z-[60] h-screen w-screen overflow-y-auto bg-theme-app text-theme-primary cursor-pointer selection:bg-amber-500/20"
          : "flex flex-col h-full bg-theme-app text-theme-primary relative cursor-pointer"
      }
      id="mobile_editor_workspace" 
      style={{ borderColor: "#888a8e" }}
      onClick={handleWorkspaceClick}
      onScroll={isImmersive ? handleScroll : undefined}
      ref={isImmersive ? textareaRef : undefined}
    >
      {isImmersive ? (
        <div className="relative min-h-screen py-16 flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Immersive Float Header details with absolute alignment */}
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between select-none z-30 max-w-3xl md:mx-auto">
            <span className="text-[10px] text-theme-secondary italic opacity-85">
              ✨ 沉浸写作模式 (双击正文或点击空白处退出)...
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsImmersive?.(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1 transition shadow-xs cursor-pointer z-40"
            >
              <Minimize2 className="w-3 h-3 text-amber-700" />
              退出沉浸
            </button>
          </div>

          {/* Immersive Reader Body: protected inside a centered layout with comfortable margin */}
          <article
            onDoubleClick={() => setIsImmersive?.(false)}
            className="w-full max-w-3xl mx-auto px-6 md:px-8 text-[15px] md:text-base leading-loose select-text outline-none text-theme-primary mt-1"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {activeChapter && activeChapter.content?.trim() ? (
              <div className="space-y-5 pr-1 selection:bg-amber-600/15">
                {activeChapter.content
                  .split("\n")
                  .map(p => p.trim())
                  .filter(p => p.length > 0)
                  .map((para, idx) => (
                    <p 
                      key={idx} 
                      className="text-theme-primary tracking-wide text-justify leading-loose"
                      style={{ textIndent: "2em" }}
                    >
                      {para}
                    </p>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-theme-secondary/70">
                <BookOpen className="w-8 h-8 text-amber-600/40 mb-2.5" />
                <span>
                  当前章节尚无文本段落。请在下方输入您的命题，手书契引 AI 一键撰砚。
                </span>
              </div>
            )}
          </article>

          {isStreaming && (
            <div className="fixed bottom-16 left-4 right-4 pointer-events-none z-30">
              <div className="bg-amber-600/95 text-white px-4 py-2 rounded-full text-[11px] font-bold shadow-md flex items-center justify-center gap-2 animate-bounce mx-auto max-w-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                正在将墨笔意象续接到最末一行...
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Dynamic Header with dropdown styled for Mobile */}
          <div className="bg-theme-header border-b border-theme/30 px-4 py-3 flex items-center justify-between" style={{ borderColor: "#888a8e" }}>
            <button
              onClick={() => setIsChapterDrawerOpen(true)}
              className="flex items-center gap-1 bg-amber-500/10 active:bg-amber-500/20 text-amber-900 px-3 py-1.5 rounded-full text-xs font-bold transition border border-amber-500/20"
              id="btn_trigger_chapters_drawer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span className="truncate max-w-[130px]">{activeChapter ? activeChapter.title : "无章节"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
            </button>

            {/* Info or Edit Title directly */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-amber-150/45 text-amber-800 font-mono px-3 py-1 rounded-full border border-amber-500/10">
                {activeChapter ? activeChapter.wordCount : 0} 字
              </span>
              <button
                onClick={() => setIsImmersive?.(true)}
                className="p-1.5 rounded-lg bg-theme-input-pure active:bg-theme-active border border-theme/35 transition flex items-center justify-center shrink-0 cursor-pointer hover:border-amber-500/50"
                title="一键开启沉浸专注"
              >
                <Maximize2 className="w-3.5 h-3.5 text-theme-secondary" />
              </button>
              <button
                onClick={handleExportTxt}
                disabled={!activeChapter || !activeChapter.content}
                className={`p-1.5 rounded-lg bg-theme-input-pure active:bg-theme-active border border-theme/35 transition flex items-center justify-center shrink-0 ${
                  !activeChapter || !activeChapter.content ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:border-amber-500/50"
                }`}
                title="导出TXT"
              >
                <Download className="w-3.5 h-3.5 text-theme-secondary" />
              </button>
            </div>
          </div>

          {/* Parchment styled Editing Canvas */}
          <div 
            className="flex-1 flex flex-col relative min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <article
              ref={textareaRef}
              onScroll={handleScroll}
              className="flex-1 w-full p-6 text-[15px] md:text-base leading-loose overflow-y-auto bg-transparent select-text outline-none text-theme-primary focus:ring-0 focus:outline-none selection:bg-amber-500/20"
              id="mobile_novel_editor_reader"
              style={{ fontFamily: "'Inter', sans-serif", outline: "none" }}
            >
              {activeChapter && activeChapter.content?.trim() ? (
                <div className="space-y-5 pr-1 selection:bg-amber-600/15 max-w-3xl mx-auto">
                  {activeChapter.content
                    .split("\n")
                    .map(p => p.trim())
                    .filter(p => p.length > 0)
                    .map((para, idx) => (
                      <p 
                        key={idx} 
                        className="text-theme-primary tracking-wide text-justify leading-loose"
                        style={{ textIndent: "2em" }}
                      >
                        {para}
                      </p>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-theme-secondary/70">
                  <BookOpen className="w-8 h-8 text-amber-600/40 mb-2.5" />
                  <span>
                    {isStreaming
                      ? "小墨正在斟酌局势字词，流式倾吐续写内容中..."
                      : "当前章节尚无文本段落。请在下方输入您的命题，手书契引 AI 一键撰砚。"}
                  </span>
                </div>
              )}
            </article>

            {isStreaming && (
              <div className="absolute bottom-16 left-4 right-4 pointer-events-none">
                <div className="bg-amber-600/95 text-white px-4 py-2 rounded-full text-[11px] font-bold shadow-md flex items-center justify-center gap-2 animate-bounce mx-auto max-w-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  正在将墨笔意象续接到最末一行...
                </div>
              </div>
            )}
            
            {/* Simple generation input bar */}
            <div
              className="bg-theme-card border-t border-theme/20 p-3 flex items-center gap-2 shrink-0"
              style={{
                height: '57px',
                borderWidth: '1px',
                paddingLeft: '6px',
                paddingRight: '10px',
                paddingTop: '12px',
                paddingBottom: '12px',
                marginTop: '0px',
                marginBottom: '-9px',
                borderRadius: '0px',
                borderStyle: 'inset',
                borderColor: '#888a8e',
              }}
            >
              <input
                type="text"
                placeholder="后续怎么写？(留空自由发挥)"
                className="flex-1 text-xs px-3 py-2.5 border border-theme/20 bg-theme-input-pure text-theme-primary rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans shadow-sm"
                style={{ borderColor: "#888a8e" }}
                id="input_target_plot"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const targetPlot = (document.getElementById('input_target_plot') as HTMLInputElement).value;
                    const generateLengthInput = document.getElementById('input_generate_length') as HTMLInputElement;
                    let val = parseInt(generateLengthInput.value, 10);
                    if (isNaN(val) || val < 50) val = 50;
                    if (val > 2000) val = 2000;
                    onGenerateContinue(targetPlot, val.toString());
                  }
                }}
              />
              <div 
                className="w-20 flex items-center gap-0.5 justify-center shrink-0 bg-theme-input-pure border border-theme/20 rounded-xl px-1 shadow-sm focus-within:ring-1 focus-within:ring-amber-500"
                style={{ borderColor: "#888a8e" }}
              >
                <input 
                  type="number"
                  id="input_generate_length" 
                  className="text-xs py-2.5 focus:outline-none bg-transparent w-10 outline-none font-bold text-theme-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  defaultValue="300"
                  min="50"
                  max="2000"
                  placeholder="300"
                  onBlur={(e) => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 50) {
                      e.target.value = "50";
                    } else if (val > 2000) {
                      e.target.value = "2000";
                    }
                  }}
                />
                <span className="text-xs text-theme-secondary font-bold shrink-0">字</span>
              </div>
              <button
                onClick={() => {
                  const targetPlot = (document.getElementById('input_target_plot') as HTMLInputElement).value;
                  const generateLengthInput = document.getElementById('input_generate_length') as HTMLInputElement;
                  let val = parseInt(generateLengthInput.value, 10);
                  if (isNaN(val) || val < 50) val = 50;
                  if (val > 2000) val = 2000;
                  onGenerateContinue(targetPlot, val.toString());
                }}
                disabled={isStreaming}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm ${
                  isStreaming ? "bg-gray-200 text-gray-400" : "bg-amber-600 text-white active:bg-amber-700 hover:bg-amber-700"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI续写
              </button>
            </div>
          </div>
        </>
      )}

      {/* Selection Precise Micro-Editor Sheet */}
      <AnimatePresence>
        {selectedText && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="bg-amber-50 border-t border-amber-900/20 p-4 space-y-3 z-30 absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-xl max-h-[90%] overflow-y-auto"
            id="mobile_precision_drawer"
          >
            <div className="flex items-center justify-between border-b border-amber-900/10 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-950">
                  句段微雕器 (选了{selectedText.length}字)
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedText("");
                  setSelectionRange(null);
                  setRewriteResult("");
                }}
                className="p-1 rounded-full bg-amber-950/5 active:bg-amber-950/10 transition"
              >
                <X className="w-4 h-4 text-amber-850" />
              </button>
            </div>

            {/* Selected preview snippet */}
            <div className="p-2.5 bg-white/50 rounded-lg text-[11px] text-gray-600 italic line-clamp-2 leading-relaxed">
              原句：“{selectedText}”
            </div>

            {/* Quick action chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold block">一键快修范式：</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "✨ 风格润色", prompt: "请模仿上述已学习的作品风格特色，对原句进行改写重写，保留核心本意，让文风完美融入此古典文墨基调。" },
                  { label: "🌸 唯美景景", prompt: "对该句进行细节描写和艺术扩增，加入丰富的环境景物描写、五感体验或动作细节，让读者身临其境。" },
                  { label: "⚡ 精炼浓缩", prompt: "精简原句段，剔除废话，以白描简洁干净的语法传达事件，增强文字的利落感。" },
                  { label: "❤️ 剖析内心", prompt: "重写原句，细致剖析当事人在该处的微妙心理波动或强烈的情感纠葛、神态反应。" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleTriggerRewrite(preset.prompt)}
                    disabled={isRewriting}
                    className="text-[10px] bg-white active:bg-amber-100 py-2 px-2.5 rounded-lg border border-amber-900/10 font-bold text-gray-700 flex items-center justify-center transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom inputs */}
            <div className="flex gap-2">
              <input
                type="text"
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder="自拟微雕要求，如‘多一点悲凉/狂妄’"
                className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none bg-white font-sans"
              />
              <button
                onClick={() => handleTriggerRewrite()}
                disabled={isRewriting || !rewriteInstruction.trim()}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  isRewriting || !rewriteInstruction.trim()
                    ? "bg-gray-200 text-gray-400"
                    : "bg-amber-600 text-white active:bg-amber-700"
                }`}
              >
                {isRewriting ? <RefreshCw className="w-3 h-3 animate-spin" /> : "改写"}
              </button>
            </div>

            {/* Rewrite Preview Output */}
            {(rewriteResult || isRewriting) && (
              <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                <span className="text-[10px] font-bold text-amber-800 block">改写效果：</span>
                <p className="text-xs text-gray-800 leading-relaxed italic">
                  {isRewriting ? (
                    <span className="text-gray-400 animate-pulse block">小墨提墨落笔中，请稍后...</span>
                  ) : (
                    rewriteResult
                  )}
                </p>

                {rewriteResult && !isRewriting && !rewriteResult.startsWith("润色出现系统异常") && (
                  <button
                    onClick={handleReplaceSelection}
                    className="w-full py-2 bg-emerald-600 active:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    采纳并替换到原文中
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapters Overlay Sliding Drawer */}
      <AnimatePresence>
        {isChapterDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChapterDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />

            {/* Bottom Drawer Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
              id="chapters_drawer_sheet"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-gray-900">章节目录</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    第 {chapters.length} 幕
                  </span>
                </div>
                <button
                  onClick={() => setIsChapterDrawerOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Chapters list layout */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {chapters.map((ch, idx) => {
                  const isActive = ch.id === activeChapterId;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onActiveChapterChange(ch.id);
                        setIsChapterDrawerOpen(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? "border-amber-600 bg-amber-50/20 text-amber-950 font-bold"
                          : "border-gray-100 active:bg-gray-50 bg-white text-gray-700"
                      }`}
                    >
                      <FileText className={`w-4 h-4 mt-0.5 ${isActive ? "text-amber-600" : "text-gray-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{ch.title}</p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-normal">
                          <span>{ch.wordCount} 字</span>
                          <span>{ch.lastUpdated || "刚刚"}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 self-center" />
                    </button>
                  );
                })}
              </div>

              {/* Add New Chapter segment */}
              <div className="border-t border-gray-150 pt-4 space-y-3">
                <p className="text-xs font-bold text-gray-800">新建后续章节：</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="请输入新章节名（如：第二章）"
                    className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleAddChapter}
                    className="px-4 py-2 bg-gray-950 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap active:bg-gray-850"
                  >
                    <Plus className="w-4 h-4" />
                    创建
                  </button>
                </div>

                {chapters.length > 1 && (
                  <button
                    onClick={handleDeleteActiveChapter}
                    className="w-full py-2.5 hover:bg-red-50 text-red-650 text-xs font-semibold rounded-lg border border-red-200/50 flex items-center justify-center gap-1 transition text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除当前查看章节 ({activeChapter ? activeChapter.title : ""})
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
