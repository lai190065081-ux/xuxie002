/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Plus, Trash2, Users, BookOpen, ChevronRight, UserMinus } from "lucide-react";
import { NovelSettings as SettingsType, Character } from "../types";

interface NovelSettingsProps {
  settings: SettingsType;
  onSettingsUpdate: (updated: SettingsType) => void;
}

export default function NovelSettings({ settings, onSettingsUpdate }: NovelSettingsProps) {
  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("主角");
  const [newCharPersonality, setNewCharPersonality] = useState("");
  const [newCharDesc, setNewCharDesc] = useState("");
  const [isAddingChar, setIsAddingChar] = useState(false);

  const handleAddCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;

    const newChar: Character = {
      id: crypto.randomUUID(),
      name: newCharName.trim(),
      role: newCharRole,
      personality: newCharPersonality.trim() || "未知",
      description: newCharDesc.trim() || "背景待定",
    };

    onSettingsUpdate({
      ...settings,
      characters: [...settings.characters, newChar],
    });

    // Reset input fields
    setNewCharName("");
    setNewCharRole("主角");
    setNewCharPersonality("");
    setNewCharDesc("");
    setIsAddingChar(false);
  };

  const handleRemoveCharacter = (id: string) => {
    onSettingsUpdate({
      ...settings,
      characters: settings.characters.filter((c) => c.id !== id),
    });
  };

  const updateCharacterField = (id: string, field: keyof Character, value: string) => {
    onSettingsUpdate({
      ...settings,
      characters: settings.characters.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: value };
        }
        return c;
      }),
    });
  };

  return (
    <div className="space-y-6" id="novel_settings_container">
      {/* Basic Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-600" />
            小说与世界观基本设定 (Novel info)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            配置你的小说名称与大世界观，任何生成的情节都将围绕这个背景展开。
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              小说名称 (Title)：
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => onSettingsUpdate({ ...settings, title: e.target.value })}
              placeholder="书名，例如：《大明风骨录》、《云深忘忧录》"
              className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition"
              id="novel_title_input"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              故事背景大纲与主线剧情设定 (Background Setting)：
            </label>
            <textarea
              rows={4}
              value={settings.background}
              onChange={(e) => onSettingsUpdate({ ...settings, background: e.target.value })}
              placeholder="设定你故事里的规则、核心主线、世界的运行状态等。举例：主角苏临深身负重伤来到竹林避祸。此地是武林隐侠归处。主线：苏临深想隐藏身手重整旗鼓，而江湖恩怨不肯放过他。"
              className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition resize-none leading-relaxed"
              id="novel_backstory_textarea"
            />
          </div>
        </div>
      </div>

      {/* Characters Settings */}
      <div className="border-t border-gray-100 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              登场角色配置 ({settings.characters.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              设计参与续写的小说核心人设，确保AI续写时说话风格、行事思维不崩塌。
            </p>
          </div>
          <button
            onClick={() => setIsAddingChar(!isAddingChar)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-medium border border-amber-200 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAddingChar ? "取消添加" : "添加角色"}
          </button>
        </div>

        {/* Character Form */}
        {isAddingChar && (
          <form
            onSubmit={handleAddCharacter}
            className="bg-amber-50/45 border border-amber-100 rounded-xl p-4 space-y-3 animate-fade-in"
          >
            <p className="text-xs font-bold text-amber-900">设计新角色人设：</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">姓名 / 称号：</label>
                <input
                  type="text"
                  required
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="如：苏临深"
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">身份地位 (Role)：</label>
                <select
                  value={newCharRole}
                  onChange={(e) => setNewCharRole(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="核心主角">核心主角 (Protagonist)</option>
                  <option value="重要反派">重要反派 (Antagonist)</option>
                  <option value="配角/师友">配角/师友 (Supporting)</option>
                  <option value="神秘人/刺客">神秘人/游侠</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">性格底色（一言蔽之）：</label>
              <input
                type="text"
                value={newCharPersonality}
                onChange={(e) => setNewCharPersonality(e.target.value)}
                placeholder="如：孤傲、面冷心热、爱美酒、重誓言"
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">生平轶事 / 人物动机 / 隐秘：</label>
              <input
                type="text"
                value={newCharDesc}
                onChange={(e) => setNewCharDesc(e.target.value)}
                placeholder="如：原是名震中原的少年剑客，因遭暗算隐姓埋名"
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                确认录入人设
              </button>
            </div>
          </form>
        )}

        {/* Characters display */}
        {settings.characters.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/30 text-gray-400 text-xs text-balance px-4">
            还没有录入角色人设。点击右上角“添加角色”录入主要演员，否则续写可能出现NPC神游哦。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {settings.characters.map((char) => (
              <div
                key={char.id}
                className="group border border-gray-100 rounded-xl p-4 bg-white shadow-xs hover:border-amber-100 transition duration-150 space-y-2 relative"
              >
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveCharacter(char.id)}
                  className="absolute right-3 top-3.5 p-1 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  title="删除此人物"
                >
                  <UserMinus className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">{char.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full scale-95 border border-gray-200/50">
                    {char.role}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-[11px] pt-1">
                  <div>
                    <span className="text-gray-400 font-medium">性格：</span>
                    <input
                      type="text"
                      value={char.personality}
                      onChange={(e) => updateCharacterField(char.id, "personality", e.target.value)}
                      className="text-gray-700 border-b border-transparent hover:border-gray-200 focus:border-amber-500 bg-transparent py-0.5 outline-none w-5/6"
                    />
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">备注：</span>
                    <input
                      type="text"
                      value={char.description}
                      onChange={(e) => updateCharacterField(char.id, "description", e.target.value)}
                      className="text-gray-600 border-b border-transparent hover:border-gray-200 focus:border-amber-500 bg-transparent py-0.5 outline-none w-5/6"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
