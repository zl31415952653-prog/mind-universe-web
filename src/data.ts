import type { ColorBlock, ExperienceType, VoidDef, VoidId } from './types';

// 七空 —— 颜色严格采用《重构方案分析 v3》第八节定义的色值
export const VOIDS: VoidDef[] = [
  { id: 'void',     symbol: '∅₁', name: '虚空', meaning: '未知的世界',   color: '#1a1a4e', question: '这里有什么？' },
  { id: 'silence',  symbol: '∅₂', name: '寂空', meaning: '已理解的世界', color: '#0d47a1', question: '我已经知道了什么？' },
  { id: 'fracture', symbol: '∅₃', name: '裂空', meaning: '冲突的世界',   color: '#d32f2f', question: '什么在撕裂我？' },
  { id: 'flow',     symbol: '∅₄', name: '流空', meaning: '变化的世界',   color: '#00897b', question: '什么正在形成？' },
  { id: 'mirror',   symbol: '∅₅', name: '映空', meaning: '自我的世界',   color: '#b0bec5', question: '我是怎么想的？' },
  { id: 'nexus',    symbol: '∅₆', name: '联空', meaning: '连接的世界',   color: '#f9a825', question: '什么和什么有关？' },
  { id: 'limit',    symbol: '∅₇', name: '极空', meaning: '极限的世界',   color: '#7b1fa2', question: '极限在哪里？' },
];

export const voidById = (id: VoidId): VoidDef => VOIDS.find(v => v.id === id) ?? VOIDS[0];

export const TYPES: Record<ExperienceType, string> = {
  emotional: '情感经历',
  knowledge: '知识经历',
  daily: '日常经历',
};

// 基础色卡 —— 第 3 轮将扩充为 30–60 色的完整中式色卡；
// 此处色值刻意不与七空色重复，避免"色块编码"与"空归属"视觉混淆
export const COLORS: ColorBlock[] = [
  { name: '胭脂', hex: '#c04851', meaning: '热烈、情感' },
  { name: '黛蓝', hex: '#425066', meaning: '沉静、深邃' },
  { name: '竹青', hex: '#789262', meaning: '生长、清雅' },
  { name: '月白', hex: '#d6ecf0', meaning: '澄明、映照' },
  { name: '藤黄', hex: '#e6b422', meaning: '明亮、启发' },
  { name: '黛紫', hex: '#6b4e71', meaning: '神秘、内敛' },
];
