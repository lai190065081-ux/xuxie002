/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, MessageSquare, ChevronRight, HelpCircle, Edit3, ArrowRight } from "lucide-react";
import { Branch, NovelSettings } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface BranchSelectorProps {
  settings: NovelSettings;
  recentText: string;
  onApplyBranch: (branchPlot: string, length: string) => void;
  isStreaming: boolean;
}

export default function BranchSelector({
  settings,
  recentText,
  onApplyBranch,
  isStreaming,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [generateLength, setGenerateLength] = useState<string>("中等");
  const [customPlot, setCustomPlot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async () => {
    setIsLoading(true);
    setSelectedBranchId(null);
    setError(null);
    try {
      const response = await fetch("/api/generate/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings,
          recentText: recentText || "这是故事的开篇，尚未描写剧情。",
        }),
      });

      if (!response.ok) {
        const errVal = await response.json();
        throw new Error(errVal.error || "生成失败");
      }

      const data = await response.json();
      if (data.success && data.branches && data.branches.length > 0) {
        setBranches(data.branches);
      } else {
        throw new Error("模型未返回合规的剧情分支选项，请重新生成。");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "请求异常，请稍等重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyBranch = (plotText: string) => {
    if (isStreaming) return;
    onApplyBranch(plotText, generateLength);
  };

  const handleApplyCustom = () => {
    if (!customPlot.trim() || isStreaming) return;
    onApplyBranch(customPlot.trim(), generateLength);
    setCustomPlot("");
  };

  return (
    <div className="space-y-6" id="branch_selector_widget">
      {/* Parameters */}
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">续写期望篇幅：</span>
          <div className="flex gap-1.5 transition">
            {["短", "中等", "长"].map((len) => (
              <button
                key={len}
                onClick={() => setGenerateLength(len)}
                className={`px-3 py-1 text-xs rounded-md font-medium border transition cursor-pointer ${
                  generateLength === len
                    ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {len === "短" ? "短 (约300字)" : len === "中等" ? "中等 (约700字)" : "长长 (约1200字)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main trigger */}
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-bold text-gray-700 block">选项一：生成3种剧情分岔线 (Divergent branches)</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            AI将根据您的角色配置及前文，构想3种性质完全不同的剧本转折或情感互动。
          </p>
        </div>

        <button
          onClick={fetchBranches}
          disabled={isLoading || isStreaming}
          className={`w-full py-3 px-4 font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-2 transition cursor-pointer ${
            isLoading || isStreaming
              ? "bg-amber-100 text-amber-700/60 cursor-not-allowed"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
          id="btn_trigger_divergent_branches"
        >
          <Sparkles className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "正在洞悉人设、精构剧情转折中..." : "多分支重写/智能生成后续发展"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs leading-normal">
          {error}
        </div>
      )}

      {/* Branch cards container */}
      <div className="space-y-4" id="branches_list_display">
        {branches.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {branches.map((br, index) => {
                const isSelected = selectedBranchId === br.title;
                return (
                  <motion.div
                    key={br.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    onClick={() => setSelectedBranchId(br.title)}
                    className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer text-left relative overflow-hidden ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/15 shadow-sm"
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/30"
                    }`}
                  >
                    {/* Index Indicator */}
                    <div className="absolute right-0 top-0 bg-gray-50 border-bl border-gray-100 text-[10px] text-gray-400 font-bold px-2.5 py-1 rounded-bl-lg">
                      分支 {index + 1}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 pr-12">
                        <span className="text-xs font-bold text-gray-900 group-hover:text-amber-700">
                          {br.title}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed font-normal">
                        {br.outline}
                      </p>

                      {/* Dialogue preview */}
                      {br.dialoguePreview && (
                        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                          <div className="text-[11px] text-gray-500 italic leading-normal">
                            “ {br.dialoguePreview} ”
                          </div>
                        </div>
                      )}

                      {/* Momentum description */}
                      <div className="text-[11px] text-emerald-700 font-medium">
                        后续影响：{br.nextPlot}
                      </div>

                      {/* Selection control */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-2"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyBranch(br.outline);
                            }}
                            disabled={isStreaming}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            开始流式撰写此分支正文
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Manual direct prompt fallback */}
      <div className="border-t border-gray-100 pt-6 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-gray-700 block">选项二：由您设定自由续写大纲 (Custom plot instruction)</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            跳过AI推荐，直接写下你心中预想的情节发展（如：“苏临深终于忍不住反击了，用他成名的快剑...”）
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            rows={2}
            value={customPlot}
            onChange={(e) => setCustomPlot(e.target.value)}
            placeholder="在这里详尽描绘你想要安排的下一个具体情境、说话倾向、动作走向..."
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/30 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition resize-none leading-relaxed"
          />

          <button
            onClick={handleApplyCustom}
            disabled={!customPlot.trim() || isStreaming || isLoading}
            className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              !customPlot.trim() || isStreaming || isLoading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-950 hover:bg-gray-800 text-white"
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            生成此特定情节续写
          </button>
        </div>
      </div>
    </div>
  );
}
