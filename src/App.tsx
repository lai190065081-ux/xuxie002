/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BookOpen, Sparkles, Sliders, PenTool, Wifi, Battery, Signal, ChevronRight, Cpu, Save, Trash2, Library, Plus, Settings as SettingsIcon, Globe, Terminal, Eye, EyeOff, Download, RefreshCw } from "lucide-react";
import { NovelSettings as SettingsType, Chapter, StyleModel, Project, SystemConfig } from "./types";
import NovelSettings from "./components/NovelSettings";
import NovelEditor from "./components/NovelEditor";
import { motion, AnimatePresence } from "motion/react";
import { fetchAIContinueStream } from "./utils/aiClient";

// Current software client version
const CURRENT_VERSION = "v1.0.0";

// Custom semver validation checker
function isNewerVersion(current: string, latest: string): boolean {
  const cleanCurr = current.replace(/^v/i, "").trim();
  const cleanLate = latest.replace(/^v/i, "").trim();

  if (cleanCurr === cleanLate) return false;

  const currParts = cleanCurr.split(".").map(Number);
  const lateParts = cleanLate.split(".").map(Number);

  for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
    const currVal = currParts[i] || 0;
    const lateVal = lateParts[i] || 0;
    if (lateVal > currVal) return true;
    if (lateVal < currVal) return false;
  }
  return false;
}

// Default preset values for easy onboarding
const DEFAULT_STYLE: StyleModel = {
  hasLearned: false,
  tone: "传统武侠古风",
  description: "意境深远，冷暖衬托；叙事句子长短结合，对环境风物有细致的白描渲染；人物对话含蓄节制，带有经典的古典江湖留白快感，动作描写具有爆发性力量感。",
  wordLength: "长句用于叙述铺陈，短句或四字成语用于动作对拆与冲突爆发点。",
  dialogStyle: "言辞简练，留白丰富，多寄情于江湖风物或叹息神态之中。",
  customKeywords: ["竹林", "残剑", "烟雨", "寒芒", "斑驳", "琴声", "执念"],
};

const DEFAULT_SETTINGS: SettingsType = {
  title: "竹林风雨录",
  background: "这是一个古风传统武侠背景。主角苏临深曾是江湖第一杀手组织听风楼之魁首，因被同门构陷出卖而重伤，重出重围后，隐姓埋名客居于幽偏竹林的草堂中。竹林木屋的主人林晚晚将其救起，为其疗伤。此时平静之下暗流涌动，听风楼的黑衣追兵和各派寻仇之人正暗中朝此处靠拢...",
  characters: [
    {
      id: "char-1",
      name: "苏临深",
      role: "核心主角",
      personality: "性格孤冷隐忍、言简意赅、心思缜密",
      description: "听风楼前首领，白衣残剑。重伤未愈但威慑力极强，厌恶江湖厮杀却深陷泥沼。"
    },
    {
      id: "char-2",
      name: "林晚晚",
      role: "重要配角",
      personality: "古灵精怪、心思单纯、医术超高",
      description: "竹林草药医馆女儿。平日上山采药，生性善良，对苏临深的过去充满好奇但并不点破。"
    }
  ],
  style: DEFAULT_STYLE,
};

const DEFAULT_CHAPTERS: Chapter[] = [
  {
    id: "chap-1",
    title: "第一章：碎雨廊下",
    content: "雨，从薄暮时分起便没停过。深秋的翠竹林在这连绵雨脚中，摇曳出一片凄迷的冷白之色。\n\n苏临深正静立在一堵柴木廊下。他身上披着一件洗得发白的青布长衫，两袖空荡，手里正按着一柄无鞘的长剑。那剑身早已卷了刃，上面还黏着小半块干涸了不知道多久的深红血渍，在雨滴飞溅的微光里，隐现寒芒。\n\n林晚晚抱着一筐刚晒干的黄连穿过长廊，在距离他两步远的地方停了下来。她看了看那把剑，又看了看他苍白如纸的侧脸。\n\n“你这把破烂铁片，别摆在廊下淋雨了，医馆可没有多余的铁屑给你补。”晚晚咬着下唇，声音在雨声里显得清脆，却掩不住其中的忐忑。\n\n苏临深没有回头。他的手指在斑驳的剑柄上微微摩挲了一瞬，眼神比这深秋的冷风还要平静，“雨脚变沉了。今晚，不会有上山采药的路客了。”",
    wordCount: 304,
    lastUpdated: "14:02",
  },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const savedProjects = localStorage.getItem("xiaomo-projects");
      if (savedProjects) {
        return JSON.parse(savedProjects);
      }
    } catch {}

    // Fallback: try migrating legacy data
    try {
      const oldSettings = localStorage.getItem("xiaomo-settings");
      const oldChapters = localStorage.getItem("xiaomo-chapters");
      const oldActiveChapterId = localStorage.getItem("xiaomo-active-chapter");
      
      if (oldSettings && oldChapters) {
         const settings = JSON.parse(oldSettings);
         const chapters = JSON.parse(oldChapters);
         const activeChapterId = oldActiveChapterId || "chap-1";
         const p: Project = {
           id: "migrated-legacy",
           title: settings.title || "未命名故事",
           settings,
           chapters,
           activeChapterId,
           lastUpdated: Date.now()
         };
         return [p];
      }
    } catch {}

    // Default Fallback
    return [{
      id: `proj-${Date.now()}`,
      title: DEFAULT_SETTINGS.title,
      settings: DEFAULT_SETTINGS,
      chapters: DEFAULT_CHAPTERS,
      activeChapterId: "chap-1",
      lastUpdated: Date.now()
    }];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    const saved = localStorage.getItem("xiaomo-current-project");
    return saved || projects[0]?.id || "default";
  });

  // Current Working Variables
  const initialProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const [settings, setSettings] = useState<SettingsType>(initialProject.settings);
  const [chapters, setChapters] = useState<Chapter[]>(initialProject.chapters);
  const [activeChapterId, setActiveChapterId] = useState<string>(initialProject.activeChapterId);
  const [mainTab, setMainTab] = useState<"write" | "library" | "system">("write");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => {
    const saved = localStorage.getItem("xiaomo-system-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          githubRepo: parsed.githubRepo || "lai190065081/react-example",
        };
      } catch {}
    }
    return {
      apiUrl: "",
      apiKey: "",
      apiModel: "gemini-3.5-flash",
      systemPrompt: "",
      theme: "parchment",
      githubRepo: "lai190065081/react-example",
    };
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    tagName: string;
    title: string;
    body: string;
    downloadUrl: string;
  } | null>(null);

  // Persist system configuration changes
  useEffect(() => {
    localStorage.setItem("xiaomo-system-config", JSON.stringify(systemConfig));
  }, [systemConfig]);

  // Sync back to projects list automatically
  useEffect(() => {
    if (!currentProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id === currentProjectId) {
        return {
          ...p,
          title: settings.title || "未命名书目",
          settings,
          chapters,
          activeChapterId,
          lastUpdated: Date.now()
        };
      }
      return p;
    }));
  }, [settings, chapters, activeChapterId, currentProjectId]);

  // Persist projects to local storage
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem("xiaomo-projects", JSON.stringify(projects));
      localStorage.setItem("xiaomo-current-project", currentProjectId);
    }
  }, [projects, currentProjectId]);

  const handleSwitchProject = (id: string) => {
    const p = projects.find(pr => pr.id === id);
    if (p) {
      setCurrentProjectId(id);
      setSettings(p.settings);
      setChapters(p.chapters);
      setActiveChapterId(p.activeChapterId);
      setMainTab("write");
    }
  };

  const handleCreateNewProject = () => {
    const newId = `proj-${Date.now()}`;
    const newProj: Project = {
      id: newId,
      title: "新故事",
      settings: { title: "新故事", background: "", characters: [], style: { hasLearned: false, tone: "常规", description: "", wordLength: "适中", dialogStyle: "自然", customKeywords: [] } },
      chapters: [{ id: "chap-1", title: "第一章", content: "", wordCount: 0, lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }) }],
      activeChapterId: "chap-1",
      lastUpdated: Date.now()
    };
    setProjects(prev => [newProj, ...prev]);
    setCurrentProjectId(newId);
    setSettings(newProj.settings);
    setChapters(newProj.chapters);
    setActiveChapterId(newProj.activeChapterId);
    setMainTab("write");
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== id);
      // Auto switch or fallback
      if (currentProjectId === id) {
        if (remaining.length > 0) {
          const nextP = remaining[0];
          setTimeout(() => {
            setCurrentProjectId(nextP.id);
            setSettings(nextP.settings);
            setChapters(nextP.chapters);
            setActiveChapterId(nextP.activeChapterId);
          }, 0);
          return remaining;
        } else {
          // No projects left, we MUST create one synchronously in the list to prevent empty render crashes
          const newId = `proj-${Date.now()}`;
          const newProj: Project = {
            id: newId,
            title: "新故事",
            settings: { title: "新故事", background: "", characters: [], style: { hasLearned: false, tone: "常规", description: "", wordLength: "适中", dialogStyle: "自然", customKeywords: [] } },
            chapters: [{ id: "chap-1", title: "第一章", content: "", wordCount: 0, lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }) }],
            activeChapterId: "chap-1",
            lastUpdated: Date.now()
          };
          
          setTimeout(() => {
            setCurrentProjectId(newId);
            setSettings(newProj.settings);
            setChapters(newProj.chapters);
            setActiveChapterId(newProj.activeChapterId);
          }, 0);
          
          return [newProj];
        }
      }
      return remaining;
    });
    setProjectToDelete(null);
  };

  const [isStreaming, setIsStreaming] = useState(false);
  
  // Mobile active lower tab switcher
  const [activeTab, setActiveTab] = useState<"settings" | "editor">("editor");

  // System time clock for native smartphone top bar
  const [systemTime, setSystemTime] = useState("09:41");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hrs = now.getHours().toString().padStart(2, "0");
      let mins = now.getMinutes().toString().padStart(2, "0");
      setSystemTime(`${hrs}:${mins}`);
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 30000);
    return () => clearInterval(clockTimer);
  }, []);

  // Automatic version update checking from GitHub Releases
  useEffect(() => {
    let active = true;
    const checkUpdates = async () => {
      let repo = systemConfig.githubRepo || "lai190065081/react-example";
      repo = repo.trim();
      
      // Auto-parse full GitHub URLs if provided (e.g., https://github.com/user/repo/releases)
      const githubUrlMatch = repo.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i);
      if (githubUrlMatch && githubUrlMatch[1] && githubUrlMatch[2]) {
        repo = `${githubUrlMatch[1]}/${githubUrlMatch[2].replace(/\.git$/, '')}`;
      }
      
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        if (data && data.tag_name) {
          const latestTag = data.tag_name;
          if (isNewerVersion(CURRENT_VERSION, latestTag)) {
            // Locate direct .apk download url from assets
            let apkUrl = "";
            if (data.assets && Array.isArray(data.assets)) {
              const apkAsset = data.assets.find((asset: any) => asset.name?.toLowerCase().endsWith(".apk"));
              if (apkAsset) {
                apkUrl = apkAsset.browser_download_url;
              }
            }
            if (!apkUrl) {
              apkUrl = data.html_url || `https://github.com/${repo}/releases/latest`;
            }

            setUpdateInfo({
              tagName: latestTag,
              title: data.name || latestTag,
              body: data.body || "当前版本无具体的描述日志。",
              downloadUrl: apkUrl,
            });
          }
        }
      } catch (err) {
        console.warn("自动检测 GitHub Releases 更新失败:", err);
      }
    };

    checkUpdates();
    return () => {
      active = false;
    };
  }, [systemConfig.githubRepo]);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];

  const handleApplyContinuationStream = async (targetPlot: string, generateLength: string, isNewChapter: boolean = false) => {
    if (isStreaming) return;
    setIsStreaming(true);
    
    // Automatically switch tabs to the Editor view so the user can watch the stream flow down in real time!
    setActiveTab("editor");

    try {
      let text = activeChapter.content.trim();
      let recentText = "";

      if (text.length > 0) {
        recentText = text.slice(-2000);
      } else {
        const activeIdx = chapters.findIndex(c => c.id === activeChapterId);
        if (activeIdx > 0) {
          const prevChapter = chapters[activeIdx - 1];
          recentText = prevChapter.content.trim().slice(-2000);
        }
      }

      const payload = {
        settings,
        recentText,
        targetPlot,
        generateLength,
        isNewChapter,
        customApiUrl: systemConfig.apiUrl,
        customApiKey: systemConfig.apiKey,
        customModel: systemConfig.apiModel,
        customSystemPrompt: systemConfig.systemPrompt,
      };

      const response = await fetchAIContinueStream(systemConfig, payload);

      if (!response.ok) {
        throw new Error("续写流请求失败");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) throw new Error("无法读取流数据");

      let buffer = "";
      let hasStartedSegment = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;

          if (cleaned.startsWith("data:")) {
            const dataContent = cleaned.slice(5).trim();

            if (dataContent === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(dataContent);
              if (parsed.error) {
                alert(`流式续写失败: ${parsed.error}`);
                break;
              }

              const appendTxt = parsed.text || parsed.choices?.[0]?.delta?.content || "";
              
              if (appendTxt) {
                setChapters((prevList) =>
                  prevList.map((chap) => {
                    if (chap.id === activeChapterId) {
                      let newContent = chap.content;
                      if (!hasStartedSegment) {
                        newContent += "\n\n";
                        hasStartedSegment = true;
                      }
                      newContent += appendTxt;
                      const wordCount = newContent.replace(/\s+/g, "").length;

                      return {
                        ...chap,
                        content: newContent,
                        wordCount,
                        lastUpdated: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' }),
                      };
                    }
                    return chap;
                  })
                );
              }
            } catch (err) {
              // ignore JSON parsing issues for partial chunks
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(`续写异常: ${error.message || "请稍后再试"}`);
    } finally {
      setIsStreaming(false);
    }
  };

  const isDark = systemConfig.theme === "dark";

  return (
    <div className={`fixed inset-0 flex flex-col select-none overflow-hidden font-sans bg-theme-app text-theme-primary ${isDark ? "theme-dark" : "theme-parchment"}`}>
      
      {/* Dynamic header row of the app */}
      {!isImmersive && (
        <header className="bg-theme-header border-b border-theme/20 py-3 px-4 flex items-center justify-between shrink-0" id="app_brand_statusbar" style={{ borderColor: "#888a8e" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white">
              <PenTool className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-theme-primary tracking-tight flex items-center gap-1 leading-none">
                小墨续笔 
                <span className="text-[9px] bg-amber-500/10 text-amber-600 font-bold px-1.5 py-0.5 rounded border border-amber-500/20 leading-none">
                  智笔版
                </span>
              </h2>
              <p className="text-[10px] text-theme-secondary font-medium mt-0.5 truncate max-w-[180px]">
                {mainTab === "write" ? `《${settings.title || "自定义书目"}》` : mainTab === "library" ? "书库本卷" : "系统设定本卷"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-1 rounded font-mono font-bold border border-amber-500/20">
              <span>{systemConfig.apiModel || "gemini-3.5-flash"}</span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col relative bg-theme-app" id="mobile_content_container">
        <AnimatePresence mode="wait">
          {mainTab === "write" && (
            <motion.div
              key="write-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col min-h-0"
            >
              {/* Embedded Sleek Segmented Sub-tabs for Current Creation */}
              {!isImmersive && (
                <div className="px-4 pt-4 pb-2.5 bg-theme-header border-b border-theme/20 flex items-center justify-center shrink-0" style={{ borderColor: "#888a8e" }}>
                  <div className="flex bg-theme-app p-0.5 rounded-lg w-full max-w-xs border border-theme/25" style={{ borderColor: "#888a8e" }}>
                    <button
                      onClick={() => setActiveTab("editor")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        activeTab === "editor"
                          ? "bg-theme-card text-theme-primary shadow-sm"
                          : "text-theme-secondary hover:text-theme-primary"
                      }`}
                    >
                      <PenTool className={`w-3.5 h-3.5 ${activeTab === "editor" ? "text-amber-600" : "text-theme-muted"}`} />
                      正文创作
                    </button>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        activeTab === "settings"
                          ? "bg-theme-card text-theme-primary shadow-sm"
                          : "text-theme-secondary hover:text-theme-primary"
                      }`}
                    >
                      <BookOpen className={`w-3.5 h-3.5 ${activeTab === "settings" ? "text-amber-600" : "text-theme-muted"}`} />
                      人设与世界观
                    </button>
                  </div>
                </div>
              )}

              {/* Sub Tab View rendering */}
              <div className="flex-1 min-h-0 flex flex-col relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="w-full h-full flex flex-col min-h-0"
                  >
                    {activeTab === "editor" ? (
                      <div className={`flex-1 min-h-0 flex flex-col ${isImmersive ? "pb-0" : "pb-14"}`}>
                        <NovelEditor
                          chapters={chapters}
                          activeChapterId={activeChapterId}
                          onChaptersUpdate={setChapters}
                          onActiveChapterChange={setActiveChapterId}
                          settings={settings}
                          isStreaming={isStreaming}
                          onGenerateContinue={(targetPlot, generateLength) => handleApplyContinuationStream(targetPlot, generateLength, activeChapter.content.trim().length === 0)}
                          systemConfig={systemConfig}
                          isImmersive={isImmersive}
                          setIsImmersive={setIsImmersive}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto px-4 py-4 pb-16 space-y-4 scroll-smooth animate-fade-in bg-theme-app">
                        <div className="bg-theme-card rounded-2xl border border-theme/20 p-4 space-y-4 shadow-xs">
                          <NovelSettings
                            settings={settings}
                            onSettingsUpdate={setSettings}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {mainTab === "library" && (
            <motion.div
              key="library-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col min-h-0 bg-theme-app p-4 pb-16"
            >
              {/* Library Scroll Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
                {/* Section title & count */}
                <div className="flex items-center justify-between pb-1 mt-1">
                  <h3 className="font-bold text-theme-primary flex items-center gap-2 text-base">
                    <Library className="w-5 h-5 text-amber-600" />
                    我的小说书库
                    <span className="text-xs font-normal text-theme-secondary">({projects.length} 本)</span>
                  </h3>
                </div>

                {/* List of book cards */}
                <div className="space-y-3">
                  {projects.map((p) => {
                    const isActive = p.id === currentProjectId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSwitchProject(p.id)}
                        className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          isActive 
                            ? "bg-theme-card border-amber-600 shadow-sm ring-1 ring-amber-500/30" 
                            : "bg-theme-card border-theme/20 hover:border-amber-500/50"
                        }`}
                      >
                        {/* Book Spine Color Accent */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${isActive ? "bg-amber-600" : "bg-theme-secondary/30"}`} />

                        <div className="flex-1 min-w-0 pl-3 pr-4">
                          <h4 className={`text-sm font-bold truncate flex items-center gap-2 ${isActive ? "text-amber-600" : "text-theme-primary"}`}>
                            {p.title || "未命名故事"}
                            {isActive && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 font-extrabold px-1.5 py-0.5 rounded-full leading-none border border-amber-500/20">
                                正在创作
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-theme-secondary font-medium">
                            <span>{p.chapters.length} 章节</span>
                            <span>•</span>
                            <span>更新于 {new Date(p.lastUpdated).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {projectToDelete === p.id ? (
                            <div className="flex items-center gap-1 bg-red-500/10 p-1.5 rounded-xl border border-red-500/20">
                              <button
                                onClick={() => setProjectToDelete(null)}
                                className="px-2 py-1 text-[10px] rounded-md bg-theme-input border border-theme/30 text-theme-secondary hover:bg-theme-active font-bold active:scale-95 transition-all outline-none"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleDeleteProject(p.id)}
                                className="px-2 py-1 text-[10px] rounded-md bg-red-600 text-white font-bold active:scale-95 transition-all hover:bg-red-700 outline-none"
                              >
                                确认删除
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setProjectToDelete(p.id)}
                              className={`p-2 rounded-full transition-colors outline-none ${
                                isActive 
                                  ? "text-amber-400 hover:text-red-500 hover:bg-red-500/10" 
                                  : "text-theme-muted hover:text-red-500 hover:bg-red-500/10"
                              }`}
                              title="删除此小说"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Create button area pinned to bottom of library view */}
              <div className="pt-4 shrink-0 mt-auto">
                <button
                  onClick={handleCreateNewProject}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-amber-700 active:scale-95 transition-all cursor-pointer outline-none"
                >
                  <Plus className="w-4 h-4" />
                  新建小说故事
                </button>
              </div>
            </motion.div>
          )}

          {mainTab === "system" && (
            <motion.div
              key="system-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col min-h-0 bg-theme-app p-4 pb-16 overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 mt-1 shrink-0">
                <h3 className="font-bold text-theme-primary flex items-center gap-2 text-base">
                  <SettingsIcon className="w-5 h-5 text-amber-600 animate-[spin_8s_linear_infinite]" />
                  系统配置
                  <span className="text-xs font-normal text-theme-secondary">(System Settings)</span>
                </h3>
              </div>

              <div className="space-y-4 pb-6 mt-2">
                {/* Section 1: API Config */}
                <div className="bg-theme-card rounded-2xl border border-theme/20 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-theme/10">
                    <Globe className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-extrabold text-theme-primary">API 接口配置 (API Provider)</h4>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-theme-secondary block mb-1">
                        API 基础地址 (Base URL)：
                      </label>
                      <input
                        type="text"
                        placeholder="留空即使用官方默认网关"
                        value={systemConfig.apiUrl}
                        onChange={(e) => setSystemConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                        className="w-full text-xs px-3 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-theme-primary"
                      />
                      <span className="text-[9px] text-theme-secondary mt-1 block leading-relaxed">
                        兼容标准 OpenAI 格式。例如 DeepSeek 使用 <code className="bg-amber-500/10 px-1 text-amber-800">https://api.deepseek.com/v1</code> ；硅基流动使用 <code className="bg-amber-500/10 px-1 text-amber-800">https://api.siliconflow.cn/v1</code> ；留空则默认使用保底的官方网关。
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-theme-secondary block mb-1">
                        API 密钥鉴权 (API Key)：
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showApiKey ? "text" : "password"}
                          placeholder="请输入 API Key (如 sk-... 或官方 Gemini Key)"
                          value={systemConfig.apiKey}
                          onChange={(e) => setSystemConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                          className="w-full text-xs pl-3 pr-10 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-theme-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 text-theme-secondary hover:text-theme-primary focus:outline-none"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-[9px] text-theme-secondary mt-1 block">
                        设置此项即优先使用您的专属 Key，无需等待。
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-theme-secondary block mb-1">
                        API 模型选择 (Model)：
                      </label>
                      <div className="space-y-2">
                        <select
                          value={["gemini-3.5-flash", "gemini-2.5-flash", "deepseek-v4-flash"].includes(systemConfig.apiModel) ? systemConfig.apiModel : "custom"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "custom") {
                              setSystemConfig(prev => ({ ...prev, apiModel: "" }));
                            } else {
                              setSystemConfig(prev => ({ ...prev, apiModel: val }));
                            }
                          }}
                          className="w-full text-xs px-3 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 text-theme-primary cursor-pointer"
                        >
                          <option value="gemini-3.5-flash">gemini-3.5-flash (推荐，超级稳定的保底 Gemini 模型)</option>
                          <option value="gemini-2.5-flash">gemini-2.5-flash (经典极速流畅创作)</option>
                          <option value="deepseek-v4-flash">deepseek-v4-flash (DeepSeek 极速最新大模型)</option>
                          <option value="custom">✍️ 手动输入自定义模型名称...</option>
                        </select>

                        {!["gemini-3.5-flash", "gemini-2.5-flash", "deepseek-v4-flash"].includes(systemConfig.apiModel) && (
                          <input
                            type="text"
                            placeholder="请输入自定义模型名称，例如：deepseek-ai/DeepSeek-V3 或 ep-202506..."
                            value={systemConfig.apiModel}
                            onChange={(e) => setSystemConfig(prev => ({ ...prev, apiModel: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-theme-primary"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Prompts Control */}
                <div className="bg-theme-card rounded-2xl border border-theme/20 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-theme/10">
                    <Terminal className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-extrabold text-theme-primary">底层逻辑提示词控制 (System instruction)</h4>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-theme-secondary block mb-1">
                      自定义全局系统提示词 (最高优先级)：
                    </label>
                    <textarea
                      rows={4}
                      placeholder="设置后将作为 System Instruction 写入模型中，拥有至高无上的控制权。留空则采用系统内置的智能天才小说家设定。"
                      value={systemConfig.systemPrompt}
                      onChange={(e) => setSystemConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      className="w-full text-xs px-3 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-theme-primary resize-none leading-relaxed"
                    />
                    <span className="text-[9px] text-theme-secondary mt-1 block leading-normal">
                      建议填写：用于强制控制小说的背景和发展方向。如：‘请保持角色冷酷理智，尽量多作武术白描描写，禁止大团圆结局。’
                    </span>
                  </div>
                </div>

                {/* Section 3: Aesthetics Appearance */}
                <div className="bg-theme-card rounded-2xl border border-theme/20 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-theme/10">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-extrabold text-theme-primary">个性化外观与排版 (Appearance Theme)</h4>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-theme-secondary block mb-2">
                      切换全局护眼主题色：
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSystemConfig(prev => ({ ...prev, theme: "parchment" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer flex flex-col items-center gap-1 ${
                          systemConfig.theme === "parchment"
                            ? "bg-amber-100/30 border-amber-600 text-amber-900 shadow-sm"
                            : "bg-[#FAF7F0] border-gray-200 text-gray-750 hover:border-amber-200"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#FAF7F0] border border-amber-900/10 shadow-xs" />
                        复古羊皮纸
                      </button>

                      <button
                        type="button"
                        onClick={() => setSystemConfig(prev => ({ ...prev, theme: "dark" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer flex flex-col items-center gap-1 ${
                          systemConfig.theme === "dark"
                            ? "bg-amber-950/20 border-amber-500 text-amber-200 shadow-sm"
                            : "bg-[#0b0b0d] border-zinc-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#0b0b0d] border border-zinc-750 shadow-xs" />
                        经典深黑
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 4: GitHub Update Config */}
                <div className="bg-theme-card rounded-2xl border border-theme/20 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-theme/10">
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-extrabold text-theme-primary">应用更新与版本检测 (Client Update)</h4>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-theme-secondary block mb-1">
                        GitHub 仓库配置 (Owner/Repo)：
                      </label>
                      <input
                        type="text"
                        placeholder="例如：lai190065081/react-example"
                        value={systemConfig.githubRepo || ""}
                        onChange={(e) => setSystemConfig(prev => ({ ...prev, githubRepo: e.target.value }))}
                        className="w-full text-xs px-3 py-2 border border-theme/20 rounded-lg bg-theme-input-pure focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-theme-primary"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            let repo = systemConfig.githubRepo || "lai190065081/react-example";
                            repo = repo.trim();
                            const githubUrlMatch = repo.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i);
                            if (githubUrlMatch && githubUrlMatch[1] && githubUrlMatch[2]) {
                              repo = `${githubUrlMatch[1]}/${githubUrlMatch[2].replace(/\.git$/, '')}`;
                            }
                            const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { cache: 'no-store' });
                            if (!res.ok) {
                              if (res.status === 404) alert("检测失败：找不到对应的开源仓库，请检查输入地址是否正确！");
                              else alert("检测失败：网络请求错误，可能是 GitHub API 限制，请稍后再试！");
                              return;
                            }
                            const data = await res.json();
                            const latestTag = data.tag_name;
                            if (latestTag) {
                              const currClean = CURRENT_VERSION.replace(/^v/i, "").trim();
                              const lateClean = latestTag.replace(/^v/i, "").trim();
                              if (currClean === lateClean) {
                                alert(`当前版本（${CURRENT_VERSION}）已经是最新版，无需更新。`);
                                return;
                              }
                              // Trigger auto effect popup by manually calling set update (same logic)
                              let apkUrl = "";
                              if (data.assets && Array.isArray(data.assets)) {
                                const apkAsset = data.assets.find((asset: any) => asset.name?.toLowerCase().endsWith(".apk"));
                                if (apkAsset) apkUrl = apkAsset.browser_download_url;
                              }
                              if (!apkUrl) apkUrl = data.html_url || `https://github.com/${repo}/releases/latest`;
                              setUpdateInfo({
                                tagName: latestTag,
                                title: data.name || latestTag,
                                body: data.body || "当前版本无具体的描述日志。",
                                downloadUrl: apkUrl,
                              });
                            } else {
                              alert("检测失败：该仓库暂未发布任何 Release。");
                            }
                          } catch (err: any) {
                            alert("检测报错：" + err.message);
                          }
                        }}
                        className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" /> 点击立即手动检测最新版本
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-theme/10">
                      <span className="text-[11px] text-theme-secondary font-bold">
                        当前应用本地版本：
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                        {CURRENT_VERSION}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Persistent Touch navigation Dock (Compact height & padding matching requests) */}
      {!isImmersive && (
        <nav
          className="fixed bottom-0 left-0 right-0 bg-theme-nav border-t border-theme/20 px-4 pt-1.5 pb-1 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-40"
          id="bottom_floating_tabs"
          style={{ borderColor: "#888a8e" }}
        >
          <button
            onClick={() => setMainTab("library")}
            className="flex flex-col items-center gap-0.5 flex-1 relative py-0.5 cursor-pointer outline-none"
            id="tab_click_library"
          >
            {mainTab === "library" && (
              <motion.div
                layoutId="active_main_tab_highlight"
                className="absolute -top-1.5 w-8 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
            
            <Library
              className={`w-4 h-4 transition-transform active:scale-90 duration-150 ${
                mainTab === "library" ? "text-amber-600 scale-105" : "text-theme-muted/50 hover:text-theme-secondary"
              }`}
            />
            
            <span
              className={`text-[10px] font-bold tracking-tight transition-colors ${
                mainTab === "library" ? "text-amber-600" : "text-theme-muted/65"
              }`}
            >
              小说书库
            </span>
          </button>

          <button
            onClick={() => setMainTab("write")}
            className="flex flex-col items-center gap-0.5 flex-1 relative py-0.5 cursor-pointer outline-none"
            id="tab_click_write"
          >
            {mainTab === "write" && (
              <motion.div
                layoutId="active_main_tab_highlight"
                className="absolute -top-1.5 w-8 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
            
            <PenTool
              className={`w-4 h-4 transition-transform active:scale-90 duration-150 ${
                mainTab === "write" ? "text-amber-600 scale-105" : "text-theme-muted/50 hover:text-theme-secondary"
              }`}
            />
            
            <span
              className={`text-[10px] font-bold tracking-tight transition-colors ${
                mainTab === "write" ? "text-amber-600" : "text-theme-muted/65"
              }`}
            >
              当前创作
            </span>
          </button>

          <button
            onClick={() => setMainTab("system")}
            className="flex flex-col items-center gap-0.5 flex-1 relative py-0.5 cursor-pointer outline-none"
            id="tab_click_system"
          >
            {mainTab === "system" && (
              <motion.div
                layoutId="active_main_tab_highlight"
                className="absolute -top-1.5 w-8 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
            
            <SettingsIcon
              className={`w-4 h-4 transition-transform active:scale-90 duration-150 ${
                mainTab === "system" ? "text-amber-600 scale-105" : "text-theme-muted/50 hover:text-theme-secondary"
              }`}
            />
            
            <span
              className={`text-[10px] font-bold tracking-tight transition-colors ${
                mainTab === "system" ? "text-amber-600" : "text-theme-muted/65"
              }`}
            >
              系统设置
            </span>
          </button>
        </nav>
      )}

      {/* GitHub Releases New Version Update Modal Backdrop & Card */}
      <AnimatePresence>
        {updateInfo && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-hidden">
            {/* Backdrop Mask */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUpdateInfo(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            
            {/* Modal Card content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="relative w-full max-w-sm rounded-2xl border border-theme/20 shadow-2xl p-5 bg-theme-app text-theme-primary overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center gap-2.5 pb-2 border-b border-theme/15 shrink-0">
                <div className="w-9 h-9 rounded-full bg-amber-600/10 flex items-center justify-center text-amber-600 shrink-0">
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-theme-primary leading-tight">发现更佳版本</h3>
                  <p className="text-[10px] text-theme-secondary font-medium mt-0.5">
                    最新版本已由 GitHub Actions 打包发布
                  </p>
                </div>
              </div>

              {/* Version & log details */}
              <div className="mt-4 flex-1 overflow-y-auto space-y-3 min-w-0 pr-1 select-text scroll-smooth" id="release_changelog_body">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-theme-secondary">最新线上版本:</span>
                    <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      {updateInfo.tagName}
                    </span>
                  </div>
                  <div className="text-[10px] text-theme-muted font-semibold">
                    当前: {CURRENT_VERSION}
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-[11px] font-extrabold text-theme-secondary mb-1">《新版更新日志》：</h4>
                  <div className="text-xs p-3 rounded-xl border border-theme/12 bg-theme-card leading-relaxed text-theme-secondary whitespace-pre-wrap max-h-[160px] overflow-y-auto font-sans break-all">
                    {updateInfo.body}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 pt-3.5 border-t border-theme/15 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setUpdateInfo(null)}
                  className="flex-1 py-2 px-3 border border-theme/20 rounded-xl text-xs font-bold text-theme-secondary bg-theme-card active:scale-95 transition-all outline-none cursor-pointer hover:text-theme-primary hover:bg-theme-active"
                >
                  稍后再说
                </button>
                <a
                  href={updateInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setUpdateInfo(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black text-white bg-amber-600 shadow-sm active:scale-95 hover:bg-amber-700 transition-all outline-none cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  立即下载
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
