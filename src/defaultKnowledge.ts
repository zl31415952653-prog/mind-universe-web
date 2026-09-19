import type { KnowledgeEntry } from './domain';

/** 首次可选导入的离线认知脚手架。内容刻意保持小而可审查。 */
export const defaultKnowledgePack: KnowledgeEntry[] = [
  { id:'default-seven-voids', title:'七空不是答案，而是起始坐标', summary:'七空帮助把未知、已理解、冲突、过程、反思、连接与边界区分开。每个条目可有一个主空和附属空，并能随理解改变位置。', voidType:'mirror', tags:['七空','使用指南','元认知'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['使用规则'] },
  { id:'default-void', title:'虚空：把未知说清楚', summary:'遇到陌生术语、无法描述的问题或前置知识缺口时，先放入虚空。它的任务不是立刻填满，而是提出可探索的问题。', voidType:'void', tags:['七空','未知','学习起点'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-silence', title:'寂空：已理解不等于不再回顾', summary:'能用自己的话解释并在新情境调用的知识，才暂时进入寂空。它仍需要通过回忆和应用检验。', voidType:'silence', tags:['七空','掌握','回顾'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-fracture', title:'裂空：把冲突当作辨析入口', summary:'相互矛盾的观点、容易混淆的定义、预期落空的结果，值得被明确记录。比较证据和适用条件，而非急着消除冲突。', voidType:'fracture', tags:['七空','冲突','辨析'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-flow', title:'流空：给尚未稳定的理解一个过程', summary:'正在学习、正在形成、暂时说不清的内容属于流空。用小步骤、阶段记录和下一步任务避免把过程误判为失败。', voidType:'flow', tags:['七空','过程','学习'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-mirror', title:'映空：记录自己是怎样学的', summary:'映空关注“我为什么在这里卡住”“什么策略有效”“我的把握度如何”。它服务于元认知，而不对人贴标签。', voidType:'mirror', tags:['七空','反思','学习策略'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-nexus', title:'联空：关系需要证据与解释', summary:'跨概念的类比、因果、前置与对比关系是创造力来源。每条关系应能说明来自哪些材料，以及为什么成立。', voidType:'nexus', tags:['七空','关系','图谱'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-limit', title:'极空：为边界和开放问题留位置', summary:'理论的适用范围、尚无定论的前沿和无法确定之处都值得保留。边界不是失败，而是更诚实的理解。', voidType:'limit', tags:['七空','边界','开放问题'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-retrieval', title:'主动回忆：先尝试调用，再查看资料', summary:'学习后合上资料，用自己的话解释、画图或回答问题。卡住的地方会暴露真正需要补充的知识，而不是简单重复阅读。', voidType:'silence', tags:['学习科学','主动回忆','练习'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'学习科学', taxonomy:['学习策略'] },
  { id:'default-spacing', title:'间隔回顾：让理解在时间中再次被调用', summary:'把回顾分散到不同日期，并在回顾前先尝试回忆。系统的任务是提醒可行动的下一步，而不是制造完成焦虑。', voidType:'flow', tags:['学习科学','间隔复习','回顾'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'学习科学', taxonomy:['学习策略'] }
];
