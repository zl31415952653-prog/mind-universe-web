import type { ExperienceType } from './types';

/**
 * 三类经历的默认模板（方案书 2.2 表格）：
 * 情感经历→事件/身体感受/情绪/需要/反思；知识经历→概念/来源/前置/自己的解释/关联问题；
 * 日常经历→事件/观察/片段/可选感受。
 */
export const TEMPLATES: Record<ExperienceType, string> = {
  emotional: `## 事件\n\n\n\n## 身体感受\n\n\n\n## 情绪\n\n（情绪标签：）\n\n## 需要\n\n\n\n## 反思\n\n`,
  knowledge: `## 概念\n\n\n\n## 来源\n\n\n\n## 前置知识\n\n\n\n## 我自己的解释\n\n\n\n## 关联问题\n\n`,
  daily: `## 事件\n\n\n\n## 观察\n\n\n\n## 片段\n\n\n\n## 感受（可选）\n\n`,
};
