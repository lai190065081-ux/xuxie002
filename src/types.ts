/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Character {
  id: string;
  name: string;
  role: string;       // e.g., Protagonist, Antagonist, Supporting
  personality: string; // e.g., Proud, quiet, impulsive
  description: string; // Backstory or notes
}

export interface StyleModel {
  hasLearned: boolean;
  sourceFileName?: string;
  tone: string;         // e.g., Witty, grim, poetic, colloquial
  description: string;  // Learned writing patterns details
  wordLength: string;   // e.g., Short concise sentences, flowery long phrases
  dialogStyle: string;  // e.g., Frequent banter, theatrical, minimalistic
  customKeywords: string[];
}

export interface Branch {
  id: string;
  title: string;        // e.g., Chapter 2 Branch A: Hidden Trap
  outline: string;      // What happens in this branch
  dialoguePreview: string; // Dynamic example dialogue in learned style
  nextPlot: string;     // Short description of next plot points
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastUpdated: string;
}

export interface NovelSettings {
  title: string;
  background: string;
  characters: Character[];
  style: StyleModel;
}

export interface Project {
  id: string;
  title: string;
  settings: NovelSettings;
  chapters: Chapter[];
  activeChapterId: string;
  lastUpdated: number;
}

export interface SystemConfig {
  apiUrl: string;
  apiKey: string;
  apiModel: string;
  systemPrompt: string;
  theme: "parchment" | "dark";
}

