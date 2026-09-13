import type { ColorBlock, ExperienceType, VoidDef, VoidId } from './types';

// 七空 —— 颜色严格采用《重构方案分析 v3》第八节定义的色值；
// 世界观/编码特征/典型经历来自纲领 8.2–8.3（丰满化进产品）
export const VOIDS: VoidDef[] = [
  {
    id: 'void', symbol: '∅₁', name: '虚空', meaning: '未知的世界', color: '#1a1a4e', question: '这里有什么？',
    worldview: '尚未被认知照亮的领域——虚空不是"没有"，而是"还没有被看见"。',
    shape: '弥散的云团，无明确边界', texture: '雾状、半透明',
    examples: ['我今天听到一个词，完全不知道什么意思', '我感觉有什么不对劲，但说不出来', '这个领域我完全是零基础'],
    guidance: '虚空是探索的起点，不是终点。',
  },
  {
    id: 'silence', symbol: '∅₂', name: '寂空', meaning: '已理解的世界', color: '#0d47a1', question: '我已经知道了什么？',
    worldview: '被消化、被整合的确定性——它不是遗忘，是归档后的宁静。',
    shape: '规则的几何体，稳定', texture: '光滑、沉静',
    examples: ['我终于理解了这个概念', '那件事我已经放下了', '这个知识点我已经掌握了'],
    guidance: '寂空是你的"确定性仓库"。',
  },
  {
    id: 'fracture', symbol: '∅₃', name: '裂空', meaning: '冲突的世界', color: '#d32f2f', question: '什么在撕裂我？',
    worldview: '认知崩塌、矛盾、断裂之处——它们不是坏事，是结构重组的前兆，裂缝也是光进来的地方。',
    shape: '尖锐的碎片、裂纹', texture: '粗糙、破碎、高对比',
    examples: ['我一直相信的东西被推翻了', '这两个观点完全矛盾，我不知道该信哪个', '我失败了，但不知道为什么'],
    guidance: '裂空是成长的信号，不是失败的标记。',
  },
  {
    id: 'flow', symbol: '∅₄', name: '流空', meaning: '变化的世界', color: '#00897b', question: '什么正在形成？',
    worldview: '正在发生、尚未定型的过程——世界不是静态的，一切都在流动。',
    shape: '曲线、波浪、渐变', texture: '流动、柔软、连续',
    examples: ['我正在学习一个新技能，还在摸索中', '我的想法最近在变化', '这段关系正在发展中'],
    guidance: '流空是动态的，不要试图固定它。',
  },
  {
    id: 'mirror', symbol: '∅₅', name: '映空', meaning: '自我的世界', color: '#b0bec5', question: '我是怎么想的？',
    worldview: '对自身思维过程的观察——知道自己怎么想的、为什么这样反应，这是元认知的领域。',
    shape: '对称、镜像、自指结构', texture: '清澈、反射、透明',
    examples: ['我意识到我总是回避冲突', '我发现自己对这个话题特别敏感', '我在想我为什么会这样想'],
    guidance: '映空是自我认知的镜子。',
  },
  {
    id: 'nexus', symbol: '∅₆', name: '联空', meaning: '连接的世界', color: '#f9a825', question: '什么和什么有关？',
    worldview: '万物相连——两个看似无关的东西之间，可能存在深层的结构相似性。',
    shape: '网络、节点、辐射状', texture: '连接、发光、跳跃',
    examples: ['原来这个和那个是一回事！', '我突然想到了一个类比', '这两个领域的结构好像'],
    guidance: '联空是创造力的源泉。',
  },
  {
    id: 'limit', symbol: '∅₇', name: '极空', meaning: '极限的世界', color: '#7b1fa2', question: '极限在哪里？',
    worldview: '边界之外——极限体验、超越性感受、不可言说之物。',
    shape: '分形、无限延伸、超越边界', texture: '深邃、无限、超越',
    examples: ['那种体验无法用语言描述', '我感觉到了某种超越日常的东西', '我触及了自己的极限'],
    guidance: '极空是追求的终点，也是新起点。',
  },
];

export const voidById = (id: VoidId): VoidDef => VOIDS.find(v => v.id === id) ?? VOIDS[0];

export const TYPES: Record<ExperienceType, string> = {
  emotional: '情感经历',
  knowledge: '知识经历',
  daily: '日常经历',
};

// 中式色卡（第 3 轮扩充至 40 色）——颜色是编码工具，不是装饰；
// 部分色与七空呼应（voidId 字段）；启发式建议使用的色名（胭脂/竹青/月白/黛蓝）必须保留
export const COLORS: ColorBlock[] = [
  // 红
  { name: '胭脂', hex: '#c04851', meaning: '热烈、情感', category: '红', voidId: 'fracture' },
  { name: '朱砂', hex: '#e34234', meaning: '浓烈、警示', category: '红' },
  { name: '绯红', hex: '#cf2943', meaning: '明艳、激昂', category: '红' },
  { name: '桃红', hex: '#f47983', meaning: '娇嫩、亲近', category: '红' },
  { name: '银红', hex: '#e77f8e', meaning: '柔和、温存', category: '红' },
  { name: '枣红', hex: '#8c2e35', meaning: '沉稳、内敛', category: '红' },
  { name: '石榴红', hex: '#d63333', meaning: '旺盛、炽热', category: '红' },
  { name: '海棠红', hex: '#e05263', meaning: '明媚、娇艳', category: '红' },
  // 橙黄
  { name: '藤黄', hex: '#e6b422', meaning: '明亮、启发', category: '橙黄', voidId: 'nexus' },
  { name: '鹅黄', hex: '#f1c40f', meaning: '稚嫩、轻快', category: '橙黄' },
  { name: '缃色', hex: '#e8b004', meaning: '典雅、古意', category: '橙黄' },
  { name: '秋香', hex: '#d9a62e', meaning: '丰盈、成熟', category: '橙黄' },
  { name: '杏黄', hex: '#f5c97b', meaning: '温润、柔和', category: '橙黄' },
  { name: '蜜合', hex: '#f0d6a8', meaning: '甜蜜、浅淡', category: '橙黄' },
  // 绿
  { name: '竹青', hex: '#789262', meaning: '生长、清雅', category: '绿', voidId: 'flow' },
  { name: '松花', hex: '#b6ce72', meaning: '清新、明快', category: '绿' },
  { name: '豆绿', hex: '#9acd9b', meaning: '平和、生发', category: '绿' },
  { name: '葱绿', hex: '#6fbf73', meaning: '鲜嫩、活力', category: '绿' },
  { name: '苍绿', hex: '#3b7a57', meaning: '幽深、山林', category: '绿' },
  { name: '石绿', hex: '#16a085', meaning: '明净、流动', category: '绿' },
  { name: '铜绿', hex: '#549688', meaning: '古朴、沉淀', category: '绿' },
  { name: '碧色', hex: '#1d7a6c', meaning: '澄澈、深远', category: '绿' },
  // 青蓝
  { name: '黛蓝', hex: '#425066', meaning: '沉静、深邃', category: '青蓝', voidId: 'silence' },
  { name: '靛青', hex: '#1a1a4e', meaning: '未知、夜空', category: '青蓝', voidId: 'void' },
  { name: '月白', hex: '#d6ecf0', meaning: '澄明、映照', category: '青蓝', voidId: 'mirror' },
  { name: '天青', hex: '#8ecae6', meaning: '开阔、明朗', category: '青蓝' },
  { name: '宝蓝', hex: '#1f4e9c', meaning: '贵重、信赖', category: '青蓝' },
  { name: '藏青', hex: '#2c3e66', meaning: '稳重、深藏', category: '青蓝' },
  { name: '鸦青', hex: '#4a536b', meaning: '寂静、暮色', category: '青蓝' },
  { name: '青白', hex: '#c8d9e6', meaning: '清冷、素净', category: '青蓝' },
  // 紫
  { name: '黛紫', hex: '#6b4e71', meaning: '神秘、内敛', category: '紫', voidId: 'limit' },
  { name: '青莲', hex: '#7b68ae', meaning: '清雅、禅意', category: '紫' },
  { name: '藕荷', hex: '#a678a8', meaning: '温婉、朦胧', category: '紫' },
  { name: '丁香', hex: '#b695c0', meaning: '幽香、淡雅', category: '紫' },
  { name: '紫檀', hex: '#5a3d55', meaning: '深邃、沉稳', category: '紫' },
  // 白灰褐
  { name: '玉色', hex: '#e8f0e3', meaning: '温润、洁净', category: '白灰褐' },
  { name: '缁色', hex: '#3a3a3a', meaning: '沉黑、庄重', category: '白灰褐' },
  { name: '墨灰', hex: '#5d6470', meaning: '素朴、克制', category: '白灰褐' },
  { name: '茶色', hex: '#a9825b', meaning: '温暖、烟火', category: '白灰褐' },
  { name: '赭石', hex: '#955539', meaning: '大地、敦厚', category: '白灰褐' },
];

export const COLOR_CATEGORIES = [...new Set(COLORS.map(c => c.category))];
