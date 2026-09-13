import type { SensoryEncoding } from './types';

// 感官编码选项（第 3 轮）：形状/质感/角度/线条，可多选
export const SENSORY_OPTIONS: { key: keyof SensoryEncoding; label: string; values: string[] }[] = [
  { key: 'shapes', label: '形状', values: ['圆形', '方形', '三角形', '螺旋', '波纹', '点状', '云团', '碎片', '网状', '对称'] },
  { key: 'textures', label: '质感', values: ['光滑', '粗糙', '柔软', '尖锐', '流动', '雾状', '镜面', '颗粒'] },
  { key: 'angles', label: '角度', values: ['0°', '45°', '90°', '120°', '180°', '270°', '360°'] },
  { key: 'lines', label: '线条', values: ['直线', '曲线', '波浪', '锯齿', '虚线', '同心圆', '放射'] },
];
