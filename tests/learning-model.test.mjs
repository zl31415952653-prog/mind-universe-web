import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { normalizeLearningUnits, parseLearningJson } from '../src/learningModel.ts';
import * as domain from '../src/domain.ts';
import * as prompt from '../src/learningPrompt.ts';
import * as references from './learningReferences.module.mjs';
import * as modelOptions from '../functions/_lib/learningModelOptions.js';

const ids = ['void','silence','fracture','flow','mirror','nexus','limit'];
const material = {id:'m',projectId:'p',title:'测试',kind:'pdf',createdAt:0,content:'【第 18 页】\n先制定目标，再检查结果。'};
function unit() { return {title:'计划与检查',summary:'制定目标后检查结果。',excerpt:'先制定目标，再检查结果。',start:9,unitType:'method',primaryVoid:'flow',secondaryVoids:[],keywords:[],prerequisites:[],rationale:'有过程描述',nextAction:'写下一个目标',voidAssessments:ids.map(voidType=>({voidType,status:voidType==='flow'?'candidate':'no-evidence',cue:voidType==='flow'?'制定目标':''}))}; }

test('AI 单元保留原文与页码、七空状态，未自动确认',()=>{
  const [result]=normalizeLearningUnits({units:[unit()]},material);
  assert.equal(result.evidence.page,18);
  assert.equal(result.evidence.start,9);
  assert.equal(result.primaryVoid,'flow');
  assert.equal(result.voidAssessments.length,7);
  assert.equal(result.confirmedAt,undefined);
  assert.equal(result.analysisMode,'ai');
});
test('伪造引用、缺少七空或伪造判断依据拒绝整个批次',()=>{
  for(const patch of [{excerpt:'原文没有这一句话。'},{voidAssessments:[]},{voidAssessments:unit().voidAssessments.map(a=>a.voidType==='flow'?{...a,cue:'不存在'}:a)}]) {
    assert.throws(()=>normalizeLearningUnits({units:[unit(),{...unit(),...patch}]},material));
  }
});
test('重复摘录不能猜测位置，明确偏移可以定位',()=>{
  const repeated={...material,content:'先制定目标，再检查结果。先制定目标，再检查结果。'};
  assert.throws(()=>normalizeLearningUnits({units:[{...unit(),start:-1}]},repeated));
  assert.equal(normalizeLearningUnits({units:[{...unit(),start:12}]},repeated)[0].evidence.start,12);
});
test('没有依据的主空清空，需补充不升级为候选',()=>{
  const candidate={...unit(),primaryVoid:'mirror',secondaryVoids:['mirror','flow'],voidAssessments:unit().voidAssessments.map(a=>a.voidType==='mirror'?{...a,status:'needs-input',cue:'你如何检查自己的判断？'}:a)};
  const [result]=normalizeLearningUnits({units:[candidate]},material);
  assert.equal(result.primaryVoid,null);
  assert.deepEqual(result.secondaryVoids,['flow']);
});

// 在内存加载同一客户端模块，不改源文件、不发送网络请求。
const source=ts.transpileModule(readFileSync(new URL('../src/ai.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function('require','exports',source)(name=>name==='./domain'?domain:name==='./learningModel'?{normalizeLearningUnits,parseLearningJson}:name==='./learningReferences'?references:name.includes('learningModelOptions')?modelOptions:prompt,exports);
test('仅兼容完整JSON及单层围栏，不补造损坏响应',()=>{
  assert.deepEqual(parseLearningJson('```json\n{"units":[]}\n```'),{units:[]});
  assert.throws(()=>parseLearningJson(''),/空内容/);
  assert.throws(()=>parseLearningJson('{"units":['),/完整 JSON/);
  assert.throws(()=>parseLearningJson('说明\n{"units":[]}'),/完整 JSON/);
});
test('仅官方 DeepSeek 关闭默认推理，不影响任意兼容服务',()=>{
  assert.deepEqual(modelOptions.learningModelOptions('https://api.deepseek.com/v1'),{thinking:{type:'disabled'}});
  assert.deepEqual(modelOptions.learningModelOptions('https://example.invalid'),{});
  assert.deepEqual(modelOptions.learningModelOptions('/api'),{});
});
test('托管与个人模式均解析模型外壳，正文不截断且不发送其他记录',async()=>{
  const old=globalThis.fetch;
  try {
    const requests=[];
    globalThis.fetch=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({units:[unit()]})}}]}));};
    for(const mode of ['managed','personal']) {
      const result=await exports.analyseLearningWithModel({mode,endpoint:mode==='managed'?'/api':'https://example.invalid',model:'test',apiKey:'test-only'},material);
      assert.equal(result.length,1);
    }
    assert.equal(requests[0].url,'/api/learning/analyse');
    assert.equal(requests[0].options.headers.Authorization,undefined);
    assert.deepEqual(Object.keys(JSON.parse(requests[0].options.body)),['title','source','content']);
    assert.equal(JSON.parse(requests[0].options.body).content,material.content);
    assert.equal(JSON.parse(requests[1].options.body).max_tokens,7000);
    await exports.analyseLearningWithModel({mode:'managed',endpoint:'/api'}, {...material,referencePack:'learning-science-v1'});
    const selected = JSON.parse(requests[2].options.body).references;
    assert.ok(selected.length>0 && selected.length<=6);
    assert.ok(selected.every(item=>item.reviewStatus==='provisional' && item.evidenceLimit && item.source));
    await assert.rejects(()=>exports.analyseLearningWithModel({mode:'managed',endpoint:'/api'}, {...material,content:'字'.repeat(12001)}),/不会自动截断/);
    assert.equal(requests.length,3);
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}));
    await assert.rejects(()=>exports.analyseLearningWithModel({mode:'managed',endpoint:'/api'},material),/长度限制/);
  } finally { globalThis.fetch=old; }
});
