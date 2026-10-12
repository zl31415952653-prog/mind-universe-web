import type { KnowledgeEntry, VoidId } from './domain';

/** 首次可选导入的离线认知脚手架。内容刻意保持小而可审查。 */
const coreFramework: KnowledgeEntry[] = [
  { id:'default-seven-voids', title:'七空不是答案，而是起始坐标', summary:'七空帮助把未知、已理解、冲突、过程、反思、连接与边界区分开。每个条目可有一个主空和附属空，并能随理解改变位置。', voidType:'mirror', tags:['七空','使用指南','元认知'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['使用规则'] },
  { id:'default-void', title:'虚空：把未知说清楚', summary:'遇到陌生术语、无法描述的问题或前置知识缺口时，先放入虚空。它的任务不是立刻填满，而是提出可探索的问题。', voidType:'void', tags:['七空','未知','学习起点'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-silence', title:'寂空：已理解不等于不再回顾', summary:'能用自己的话解释并在新情境调用的知识，才暂时进入寂空。它仍需要通过回忆和应用检验。', voidType:'silence', tags:['七空','掌握','回顾'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-fracture', title:'裂空：把冲突当作辨析入口', summary:'相互矛盾的观点、容易混淆的定义、预期落空的结果，值得被明确记录。比较证据和适用条件，而非急着消除冲突。', voidType:'fracture', tags:['七空','冲突','辨析'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-flow', title:'流空：给尚未稳定的理解一个过程', summary:'正在学习、正在形成、暂时说不清的内容属于流空。用小步骤、阶段记录和下一步任务避免把过程误判为失败。', voidType:'flow', tags:['七空','过程','学习'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-mirror', title:'映空：记录自己是怎样学的', summary:'映空关注“我为什么在这里卡住”“什么策略有效”“我的把握度如何”。它服务于元认知，而不对人贴标签。', voidType:'mirror', tags:['七空','反思','学习策略'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-nexus', title:'联空：关系需要证据与解释', summary:'跨概念的类比、因果、前置与对比关系是创造力来源。每条关系应能说明来自哪些材料，以及为什么成立。', voidType:'nexus', tags:['七空','关系','图谱'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] },
  { id:'default-limit', title:'极空：为边界和开放问题留位置', summary:'理论的适用范围、尚无定论的前沿和无法确定之处都值得保留。边界不是失败，而是更诚实的理解。', voidType:'limit', tags:['七空','边界','开放问题'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'认知框架', taxonomy:['七空'] }
];

const learningStrategies: KnowledgeEntry[] = [
  { id:'default-retrieval', title:'主动回忆：先尝试调用，再查看资料', summary:'学习后合上资料，用自己的话解释、画图或回答问题。卡住的地方会暴露真正需要补充的知识，而不是简单重复阅读。', voidType:'silence', tags:['学习科学','主动回忆','练习'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'学习科学', taxonomy:['学习策略'] },
  { id:'default-spacing', title:'间隔回顾：让理解在时间中再次被调用', summary:'把回顾分散到不同日期，并在回顾前先尝试回忆。系统的任务是提醒可行动的下一步，而不是制造完成焦虑。', voidType:'flow', tags:['学习科学','间隔复习','回顾'], linkedEntryIds:[], createdAt:0, isDefault:true, domain:'学习科学', taxonomy:['学习策略'] }
];

function candidate(id: string, title: string, summary: string, voidType: VoidId, source: string, evidenceLocator: string, evidenceLimit: string, suggestedAction: string, tags: string[] = []): KnowledgeEntry {
  return {
    id: `learning-science-${id.toLowerCase()}`,
    title,
    summary,
    voidType,
    source,
    tags: ['学习科学', '暂行素材', '待复核', ...tags],
    linkedEntryIds: [],
    createdAt: 0,
    isDefault: true,
    domain: '学习科学',
    taxonomy: ['首发领域素材包', '学习科学', '暂行待复核'],
    reviewStatus: 'provisional',
    evidenceType: source.split(';').map(item => {
      if (item.includes('ACRL')) return '高等教育信息素养框架';
      if (item.includes('Kapur')) return '课堂学习研究与理论论证';
      if (item.includes('Roediger')) return '提取练习研究';
      if (item.includes('IES')) return '教育实践指南';
      if (item.includes('Chi (2008)')) return '概念改变理论章节';
      if (item.includes('Potvin')) return '概念改变综述';
      if (item.includes('National Academies')) return '共识研究报告';
      if (item.includes('EEF')) return '教育证据指南';
      if (item.includes('Panadero')) return '自我调节学习综述';
      if (item.includes('Fleming')) return '年度综述与综合';
      if (item.includes('Chi & Wylie')) return '理论框架与研究综合';
      if (item.includes('Nesbit')) return '元分析';
      if (item.includes('心智宇宙')) return '产品规则（非实证研究）';
      return '来源类型待核';
    }).join('；'),
    evidenceLocator,
    evidenceLimit,
    suggestedAction
  };
}

/**
 * 学习科学 × 七空的首批 21 条候选素材。
 * 所有条目均带 provisional 状态：用于试用，不表示逐条同行式审核完成，
 * 也不表示文献验证了七空整体。全文 PDF 不随产品包分发。
 */
const learningScienceCandidates: KnowledgeEntry[] = [
  candidate('V-01', '先辨认“我不知道”的类型', '不确定时，先辨认自己缺的是定义、前置概念、机制、证据还是应用条件；这些是产品提供的工作标签，不是经过验证的心理分类。', 'void', 'ACRL (2016), Framework for Information Literacy for Higher Education', 'PDF 第 4、7 页：Authority Is Constructed and Contextual；Research as Inquiry', 'ACRL 是高等教育信息素养框架；五类未知是产品工作标签，尚未作为分类工具验证。', '选择一种暂时的缺口类型，写下“我想弄清的是……”；仍说不清时可跳过。', ['问题形成']),
  candidate('V-02', '把模糊困惑改写成可追问的问题', '把“这个我不懂”改成能检索或向资料追问的问题，例如概念指什么、为什么发生、在哪些条件下成立。', 'void', 'ACRL (2016), Framework for Information Literacy for Higher Education', 'PDF 第 7、9 页：Research as Inquiry；Searching as Strategic Exploration', '框架支持探究和迭代检索的理念，不证明固定问句模板能普遍提高学习成绩。', '自己写一个问题；系统可提供句式提示，但不替用户决定真正的困惑。', ['问题形成','检索']),
  candidate('V-03', '先尝试，再对照讲解', '对适合探索的复杂问题，可以先写初步尝试，再看示例、解释或不同方案；不能把没有支持的反复受挫称为有效学习。', 'void', 'Kapur (2008), Productive Failure, DOI 10.1080/07370000802212669', 'PDF 第 2–4 页、第 38 页（刊内页码 415）', '研究情境是 11 年级学生在计算机支持协作环境中学习牛顿运动学；不能直接推广为所有成人自学都应先失败。', '写一个初步解释或解法，然后对照解释，标出遗漏或需要修正处。', ['反馈','先尝试']),
  candidate('J-01', '熟悉感不等于能回忆', '重读时觉得熟悉，不等于之后能自己说出来；可合上资料，用自己的话回忆重点，再回去核对。', 'silence', 'Roediger & Karpicke (2006), Test-Enhanced Learning', 'PDF 第 13 页、第 20–22 页；第 13 页报告 2 天及 1 周延迟测验结果', '所报百分比只属于原研究条件；不同材料、测试方式和延迟时间的效果会变化。', '关掉材料，写出一个定义、步骤或核心解释，再对照原文补漏。', ['主动回忆','延迟保持']),
  candidate('J-02', '把回忆分散到不同时间', '对以后仍希望调用的内容，隔开时间再次回忆通常比同一时段连续重复更适合延迟保持；具体间隔需随任务调整。', 'silence', 'IES (2007), Organizing Instruction and Study to Improve Student Learning', 'PDF 第 15–16 页；概览见 PDF 第 4–5 页', '指南以学校学习为主，不给出适合所有成人自学者的唯一间隔表。', '自行选一个稍后回顾时间；届时先回忆，再查资料补正。', ['间隔练习','回顾']),
  candidate('J-03', '回忆之后核对并订正', '回忆练习后把答案与可靠资料核对，修正遗漏或误解；资料没有答案时标为待查，不猜。', 'silence', 'Roediger & Karpicke (2006); IES (2007), NCER 2007-2004', 'Roediger & Karpicke PDF 第 20–22 页；IES PDF 第 32–33 页（刊内页码 21–22）', '提取练习的反馈格式属产品设计；IES 提醒未订正错误可能持续，反馈建议应结合任务。', '标出遗漏、错误与出处；如预期错误较多，优先准备可核对的正确解释。', ['主动回忆','反馈']),
  candidate('L-01', '区分知识缺口与已有理解的改变', '新资料与原理解不一致时，辨认是缺少信息，还是旧解释、心智模型或类别判断需要修正；不要把所有不懂都叫认知冲突。', 'fracture', 'Chi (2008), Three Types of Conceptual Change', 'PDF 第 3–12 页，重点第 5–10 页', '这是理论分类与概念分析，不是七空验证研究；不可据此自动推断用户心理过程。', '并列写出旧说法、新说法及各自依据。', ['概念改变','辨析']),
  candidate('L-02', '观点冲突本身不会自动带来理解', '发现矛盾后先保留双方，补充证据和条件；只接触互相冲突的说法，不足以保证理解会改变。', 'fracture', 'Potvin & Bélanger (2024), Conceptual Change Review, DOI 10.3389/fcomm.2024.1404875', 'PDF 第 2–5 页', '综述聚焦科学教育与公众理解科学，不能等同于所有领域的冲突处理效果。', '分别记录双方来源、论据、情境及仍待查证处；允许暂时无法判断。', ['认知冲突','概念改变']),
  candidate('L-03', '比较证据时也比较方法与情境', '两个结论不一致时，不只比标题或结论句；还看研究问题、方法、数据、分析和情境是否可比。', 'fracture', 'National Academies (2019), Reproducibility and Replicability in Science, DOI 10.17226/25303', 'PDF 第 50–60 页：Scientific Methods and Knowledge', '报告讨论科学研究实践；并列表是产品模板，不能保证比较后分歧一定消失。', '用主张、来源、对象/情境、方法、未解决差异做简短并列；资料未报告则注明。', ['研究方法','证据比较']),
  candidate('F-01', '先写本轮具体目标', '开始学习前明确本轮希望理解或完成什么，尽量写成可观察结果，而不是“多学一点”。', 'flow', 'EEF (2025), Metacognition and Self-Regulated Learning; Panadero (2017), DOI 10.3389/fpsyg.2017.00422', 'EEF PDF 第 16–23 页（Recommendation 2）；Panadero PDF 第 3、19–21 页', 'EEF 指南主要依据学校教育证据；目标句是产品提示，不保证越具体越有效。', '写一句“学完后我能……”，并允许编辑或跳过。', ['目标','自我调节']),
  candidate('F-02', '学习中途检查当前证据', '学习过程中用一次回忆、解释、例题或小应用检查自己目前能做到什么，再决定继续、回看还是求助。', 'flow', 'EEF (2025), Metacognition and Self-Regulated Learning; Panadero (2017), DOI 10.3389/fpsyg.2017.00422', 'EEF PDF 第 16–23 页；Panadero PDF 第 19–21 页', '检查方式必须匹配目标；一次表现不能代表整体掌握水平。', '选一种适合材料的检查方式，记录结果和待补部分；不合适时可换方式。', ['监控','自我调节']),
  candidate('F-03', '下一步根据检查结果调整', '若检查发现缺口，可补前置、再练习或查证；若能解释和应用，可转入间隔回顾或下一个目标。', 'flow', 'EEF (2025), Metacognition and Self-Regulated Learning; Panadero (2017), DOI 10.3389/fpsyg.2017.00422', 'EEF PDF 第 16–23 页；Panadero PDF 第 19–21 页', '建议动作是产品脚手架；不代表未完成就是缺乏自律，调整由用户决定。', '从补概念、再练习、查证、暂停、继续中选一项，并写下依据。', ['调整','自我调节']),
  candidate('M-01', '把“我觉得会”与实际表现分开', '记录理解把握度时，同时保留可观察依据，例如能否回忆、解释或应用；主观感觉不是表现本身。', 'mirror', 'Fleming (2023), Metacognition and Confidence: A Review and Synthesis', 'PDF 第 3–5、14–15 页', '综述涵盖多类任务；不能仅凭自评推导能力准确度或个人诊断。', '可跳过评分；若愿意评分，再记录一次具体表现或证据。', ['元认知','把握度']),
  candidate('M-02', '用结果校准把握度，不是强迫更自信', '愿意时可比较多次把握度判断与实际检查结果；目标是看清哪些判断可靠，不是把信心调高。', 'mirror', 'Fleming (2023), Metacognition and Confidence: A Review and Synthesis; Roediger & Karpicke (2006)', 'Fleming PDF 第 14–15 页；Roediger & Karpicke PDF 第 20–22 页', '需要足够且可比的判断与反馈；少量记录不能代表稳定能力。', '先回看同类任务的把握度与表现，不计算人格化或跨领域总分。', ['校准','把握度']),
  candidate('M-03', '复盘策略及其适用情境', '复盘哪种方法在什么任务里帮到了自己，比给自己贴“擅长/不擅长学习”的标签更有行动价值。', 'mirror', 'Panadero (2017), A Review of Self-Regulated Learning; EEF (2025)', 'Panadero PDF 第 19–21 页；EEF PDF 第 16–23 页', '记录格式由自我调节研究启发；没有重复、可比较的结果时不推断长期有效性。', '记录策略、任务、观察到的结果，以及下一次想调整的一点。', ['反思','策略']),
  candidate('C-01', '连接知识时写出自己的解释', '连接两个知识点时说明它们为什么相关；只有相同关键词，不足以证明关系有意义。', 'nexus', 'Chi & Wylie (2014), ICAP Framework, DOI 10.1080/00461520.2014.965823', 'PDF 第 2–6 页', 'ICAP 是认知参与框架，不是自动判定知识关系真假的算法；解释活动也不保证结论正确。', '写一句“它们的关系是……，因为……”，并选择前置、对比、例证、应用或待确认。', ['解释','关系']),
  candidate('C-02', '概念图不等于连线越多越好', '概念图可用于组织知识关系；关注关系是否清楚、准确，不以节点或连线数量评价学习质量。', 'nexus', 'Nesbit & Adesope (2006), Learning with Concept and Knowledge Maps: A Meta-Analysis', 'PDF 第 1、25、28–30 页', '元分析汇总不同任务、地图和比较条件；研究间存在异质性，不能推广到所有用户与任务。', '选少量关键概念并标出关系词；无法说明的连线标为待确认。', ['概念图','关系']),
  candidate('C-03', '关系类型是提示，不是系统替你下结论', '系统可以建议可能的前置、对比或应用关系，但应展示理由并等待用户确认；也可保留“关系未明”。', 'nexus', '心智宇宙产品规则（非论文直接验证）', '产品原则；无直接实证页码', '人工确认机制是项目治理规则，效果仍需可用性测试；不能标成研究发现。', '对每条关系候选选择确认、修改、拒绝或暂缓，并可补充理由。', ['产品规则','人工确认']),
  candidate('E-01', '给结论附上研究对象、任务与情境', '读到研究结论时，记下它研究了谁、做了什么任务、在什么环境中；迁移到其他对象或任务时先标待验证。', 'limit', 'National Academies (2019), Reproducibility and Replicability in Science; IES (2007), NCER 2007-2004', 'NASEM PDF 第 50–60 页；IES PDF 第 15–22 页', '四个字段是阅读辅助模板，不足以单独判断外部效度；字段缺失不等于研究无效。', '记录对象、任务、情境、结果；原文没有报告的字段写“未说明”。', ['适用范围','迁移']),
  candidate('E-02', '把“不确定”保存成状态', '证据不足、结果不一致或适用范围不清时，可以标为待确认，并记录下一项要查的证据。', 'limit', 'National Academies (2019), Reproducibility and Replicability in Science; ACRL (2016)', 'NASEM PDF 第 166–184 页；ACRL PDF 第 4、7 页', '保存未知是产品信息设计原则；来源不是对该界面标签效果的直接测试。', '选择证据不足、来源待核、结果冲突、超出研究范围或暂无结论，并可添加查证任务。', ['不确定性','待确认']),
  candidate('E-03', '来源权威要结合问题与情境判断', '不只看来源名气；还看它是否适合当前问题、作者/机构的专长、资料类型和出处是否可追溯。', 'limit', 'ACRL (2016), Framework for Information Literacy for Higher Education', 'PDF 第 4、8 页：Authority Is Constructed and Contextual；Scholarship as Conversation', 'ACRL 是高等教育信息素养框架；来源质量不能简化成统一等级或仅由 AI 裁定真伪。', '保存来源名、作者/机构、资料类型、链接及它适合支持的主张。', ['来源判断','信息素养'])
];

export const defaultKnowledgePack: KnowledgeEntry[] = [
  ...coreFramework,
  ...learningStrategies,
  ...learningScienceCandidates
];
