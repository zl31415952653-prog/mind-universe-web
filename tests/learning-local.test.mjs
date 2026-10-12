import assert from 'node:assert/strict';
import test from 'node:test';
import { analyseMaterial } from '../src/learning.ts';

test('本地分析不把整句当关键词，也不凭关键词编造前置知识', () => {
  const result = analyseMaterial({
    id: 'sample', projectId: 'sample', title: '先尝试再对照讲解', kind: 'text', createdAt: 0,
    content: '对适合探索的复杂问题，可以先写下自己的尝试。随后要看示例，获得解释或比较不同方案。不能把没有支持的反复受挫称为有效学习。'
  });
  assert.equal(result.length, 3);
  assert.ok(result.every(item => item.keywords.every(word => word.length <= 12)));
  assert.ok(result[0].keywords.includes('尝试'));
  assert.ok(result[1].keywords.includes('示例'));
  assert.ok(result.every(item => !item.keywords.includes('可以')));
  assert.ok(result.every(item => item.prerequisites.length === 0));
  assert.ok(result.every(item => item.evidence.excerpt === item.summary));
  assert.ok(result.every(item => item.voidAssessments.length === 7));
  assert.deepEqual(result.map(item => item.evidence.start), [0, 22, 41]);
});

test('没有字面线索时保持未分类，不猜测七空', () => {
  const [item] = analyseMaterial({ id: 'neutral', projectId: 'sample', title: '中性材料', kind: 'text', createdAt: 0, content: '这是一段待核对的材料陈述。' });
  assert.equal(item.primaryVoid, null);
  assert.ok(item.voidAssessments.every(assessment => assessment.status === 'no-evidence'));
});

test('过长材料不静默截断', () => {
  const material = { id: 'long', projectId: 'sample', title: '长材料', kind: 'text', createdAt: 0, content: '这是一个需要阅读的句段。'.repeat(31) };
  assert.throws(() => analyseMaterial(material), /最多分析 30 个句段/);
});

test('英文 PDF 换行合并为句段，七空只依据完整英文词线索', () => {
  const content = 'Planning asks learners to set a goal,\nactivate prior knowledge, and select strategies. Monitoring asks them to assess progress.\nEvaluating asks whether the plan worked.';
  const result = analyseMaterial({ id: 'english', projectId: 'sample', title: 'English excerpt', kind: 'pdf', createdAt: 0, content });
  assert.equal(result.length, 3);
  assert.equal(result[0].evidence.excerpt, content.slice(result[0].evidence.start, result[0].evidence.start + result[0].evidence.excerpt.length));
  assert.equal(result[0].primaryVoid, 'flow');
  assert.equal(result[1].primaryVoid, 'mirror');
  assert.equal(result[2].voidAssessments.find(item => item.voidType === 'mirror').status, 'candidate');
  const [neutral] = analyseMaterial({ id: 'planet', projectId: 'sample', title: 'Neutral', kind: 'text', createdAt: 0, content: 'A planet is visible.' });
  assert.equal(neutral.primaryVoid, null);
});

test('PDF 页标记用于定位，不被当成学习候选', () => {
  const [item] = analyseMaterial({ id: 'page', projectId: 'sample', title: 'PDF', kind: 'pdf', createdAt: 0, content: '【第 18 页】\nPlanning helps learners choose a strategy.' });
  assert.equal(item.evidence.page, 18);
  assert.equal(item.evidence.excerpt, 'Planning helps learners choose a strategy.');
  assert.equal(item.evidence.start, 9);
});
