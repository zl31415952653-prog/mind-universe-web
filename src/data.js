export const VOIDS = [
  ['void','∅₁','虚空','未知的世界','#4559c9','这里有什么？'],
  ['silence','∅₂','寂空','已理解的世界','#2477c9','我知道什么？'],
  ['fracture','∅₃','裂空','冲突的世界','#e04f57','什么在撕裂我？'],
  ['flow','∅₄','流空','变化的世界','#29b89b','什么正在形成？'],
  ['mirror','∅₅','映空','自我的世界','#b8c6dc','我是怎样思考的？'],
  ['nexus','∅₆','联空','连接的世界','#e9ba4a','什么与什么相关？'],
  ['limit','∅₇','极空','极限的世界','#a462dd','边缘在哪里？']
].map(([id,symbol,name,meaning,color,question])=>({id,symbol,name,meaning,color,question}));
export const voidById = id => VOIDS.find(v=>v.id===id) || VOIDS[0];
export const TYPES = { emotional:'情感经历', knowledge:'知识经历', daily:'日常经历' };
export const COLORS = [
  ['靛青','#1a1a4e','沉静、未知'],['朱砂','#d32f2f','热烈、冲突'],['青碧','#00897b','生长、流动'],['月白','#d8e6ef','映照、澄明'],['明黄','#f9a825','连接、启发'],['紫檀','#7b1fa2','边界、深邃']
];
