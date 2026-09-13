import type { RelationType } from './types';

/**
 * 八类关系定义（方案书 2.3）：
 * 线型按关系类型区分——因果实线箭头、相似双线、冲突锯齿、启发星光、
 * 转化环形箭头、对照双箭头、包含实线、前置虚线箭头。
 * cytoscape 样式字段由图谱页消费。
 */
export interface RelationDef {
  id: RelationType;
  label: string;
  desc: string;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  curveStyle: 'bezier' | 'taxi' | 'straight';
  sourceArrow: boolean;
  targetArrow: boolean;
  color: string;
}

export const RELATION_TYPES: RelationDef[] = [
  { id: 'causal', label: '因果', desc: '一个导致了另一个', lineStyle: 'solid', curveStyle: 'bezier', sourceArrow: false, targetArrow: true, color: '#e04f57' },
  { id: 'similar', label: '相似', desc: '结构或感受相似', lineStyle: 'double', curveStyle: 'bezier', sourceArrow: false, targetArrow: false, color: '#9bc7ff' },
  { id: 'conflict', label: '冲突', desc: '互相矛盾、撕裂', lineStyle: 'dashed', curveStyle: 'taxi', sourceArrow: true, targetArrow: true, color: '#ff6b6b' },
  { id: 'inspiration', label: '启发', desc: '一个点亮了另一个', lineStyle: 'dotted', curveStyle: 'bezier', sourceArrow: false, targetArrow: true, color: '#f3c969' },
  { id: 'transform', label: '转化', desc: '一个变成了另一个', lineStyle: 'solid', curveStyle: 'bezier', sourceArrow: true, targetArrow: true, color: '#29b89b' },
  { id: 'contrast', label: '对照', desc: '并列比较、互为参照', lineStyle: 'dashed', curveStyle: 'bezier', sourceArrow: true, targetArrow: true, color: '#b8c6dc' },
  { id: 'contains', label: '包含', desc: '一个包含另一个', lineStyle: 'solid', curveStyle: 'straight', sourceArrow: false, targetArrow: false, color: '#a462dd' },
  { id: 'prerequisite', label: '前置', desc: '前者是后者的前提', lineStyle: 'dashed', curveStyle: 'straight', sourceArrow: false, targetArrow: true, color: '#8ecae6' },
];

export const relationById = (id: string): RelationDef => RELATION_TYPES.find(r => r.id === id) ?? RELATION_TYPES[1];
