import assert from 'node:assert/strict';
import test from 'node:test';
import { retrieveLearningReferences, attachLearningReferences } from './learningReferences.module.mjs';
import { sanitizeLearningReferences } from '../functions/_lib/learningReferences.js';

test('未选领域包和无匹配材料不硬配默认知识',()=>{
  assert.deepEqual(retrieveLearningReferences('主动回忆与目标',undefined),[]);
  assert.deepEqual(retrieveLearningReferences('The planet is visible.','learning-science-v1'),[]);
});
test('泛词解释或反馈不再错配联空及先失败条目',()=>{
  const refs=retrieveLearningReferences('重读时觉得熟悉，不代表离开资料后仍能解释。','learning-science-v1');
  assert.ok(refs.some(item=>item.id==='learning-science-j-01'));
  assert.ok(refs.every(item=>item.id!=='learning-science-c-01'));
  assert.ok(retrieveLearningReferences('回忆之后核对反馈。','learning-science-v1').every(item=>item.id!=='learning-science-v-03'));
});
test('中英文词面检索可追溯，保留来源、暂行状态和适用限制',()=>{
  for(const text of ['合上资料主动回忆，然后核对反馈。','Retrieval and feedback help us review.']) {
    const refs=retrieveLearningReferences(text,'learning-science-v1');
    assert.ok(refs.length>0 && refs.length<=3);
    assert.ok(refs.some(item=>item.id==='learning-science-j-03'));
    assert.ok(refs.every(item=>item.source && item.evidenceLimit && item.evidenceLocator && item.reviewStatus==='provisional' && item.matchedTerms.length));
  }
});
test('附加参考不改变主空、摘要、原文或人工确认状态',()=>{
  const suggestion={id:'s',materialId:'m',primaryVoid:null,secondaryVoids:[],summary:'需要主动回忆',evidence:{excerpt:'先回忆，再核对反馈。',start:0},reviewState:'pending'};
  const material={id:'m',referencePack:'learning-science-v1'};
  const [result]=attachLearningReferences(material,[suggestion]);
  const {references,...rest}=result;
  assert.deepEqual(rest,suggestion);
  assert.ok(references.length);
  assert.equal(suggestion.references,undefined);
});
test('服务端限量限长并剔除未允许字段与任意用户记录',()=>{
  assert.deepEqual(sanitizeLearningReferences(null),[]);
  assert.deepEqual(sanitizeLearningReferences([{id:'private-entry',summary:'私人笔记'}]),[]);
  const refs=sanitizeLearningReferences(Array.from({length:20},()=>({id:'learning-science-f-01',summary:'字'.repeat(900),reviewStatus:'reviewed',apiKey:'do-not-forward',body:'不传'})));
  assert.equal(refs.length,6);
  assert.equal(refs[0].summary.length,600);
  assert.equal(refs[0].reviewStatus,'provisional');
  assert.equal(refs[0].apiKey,undefined);
  assert.equal(refs[0].body,undefined);
});
