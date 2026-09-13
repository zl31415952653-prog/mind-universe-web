import type { Entry, ExperienceType, VoidId } from './types';

/**
 * 默认知识库（前端打包版）。
 * 与 server/defaultKnowledge.js 内容一致：正常登录后由服务器快照覆盖（id 带 userId 后缀）；
 * 本文件仅作为"首次使用且离线、本地无数据"时的兜底种子（纲领 1.6：默认知识库离线可用）。
 * 第 4 轮将重构默认知识库体系（各学科框架等）。
 */
type DefaultRow = [key: string, title: string, kind: ExperienceType, primaryVoid: VoidId, tags: string[], content: string];

const ROWS: DefaultRow[] = [
  ['kb-seven-voids', '七空使用指南', 'knowledge', 'mirror', ['认知模型', '七空'],
    '七空不是普通标签，而是观察经验的七种基本视角：未知、已理解、冲突、变化、自我、连接与边界。每条记录选择一个主空，附空只用于辅助关联。'],
  ['kb-encoding', '编码规则手册', 'knowledge', 'nexus', ['编码', '方法'],
    '记录服务于编码。先选择主空，再按需要补充情绪、色块、感官线索、标签和关系。编码应忠实于当下感受，而非追求唯一正确答案。'],
  ['kb-emotion', '情感观察词汇', 'knowledge', 'flow', ['情感', '自我观察'],
    '可使用愉悦度（-1 到 1）、强度（0 到 1）与自定义标签描述感受。情绪记录用于理解自己，不构成医学诊断。'],
  ['kb-learning', '学习科学：降低认知负荷', 'knowledge', 'silence', ['学习科学', '知识'],
    '把大目标拆成可回顾的小单元；显式记录前置知识；交替练习、主动回忆和间隔复习通常比反复浏览更有效。'],
  ['kb-colors', '中式色卡编码说明', 'knowledge', 'nexus', ['色卡', '视觉记忆'],
    '颜色是视觉记忆的编码线索，不是装饰。使用熟悉的色名、色值和联想，并允许同一颜色在不同经历中拥有不同含义。'],
];

export function buildDefaultEntries(now = Date.now()): Entry[] {
  return ROWS.map(([key, title, kind, primaryVoid, tags, content]) => ({
    id: key,
    kind,
    title,
    content,
    primaryVoid,
    secondaryVoids: [],
    tags,
    emotion: {},
    encoding: { color: null },
    knowledge: {},
    privacy: { aiVisible: false },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  }));
}
