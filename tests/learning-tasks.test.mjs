import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmationTasks } from '../src/learning.ts';

const project = { id: 'test-project' };
const suggestion = { title: '测试知识', nextAction: '模型建议不应被自动执行' };
test('只确认知识不创建任务，也不采用模型建议', () => {
  assert.deepEqual(confirmationTasks(project, suggestion, { mode: 'none', action: suggestion.nextAction }), []);
});
test('基础练习仅在明确选择后创建三项', () => {
  const tasks = confirmationTasks(project, suggestion, { mode: 'starter', action: '' });
  assert.deepEqual(tasks.map(task => task.kind), ['preview', 'recall', 'review']);
  assert.ok(tasks.every(task => task.projectId === project.id && !task.doneAt));
});
test('自选下一步只创建用户改写的一项任务', () => {
  const tasks = confirmationTasks(project, suggestion, { mode: 'action', action: '  用自己的话解释并举例  ' });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, '用自己的话解释并举例');
  assert.ok(tasks[0].note.includes(suggestion.title));
  assert.equal(tasks[0].doneAt, undefined);
});
test('空白或过长下一步不会创建任务', () => {
  for (const action of ['   ', '字'.repeat(501)]) assert.throws(() => confirmationTasks(project, suggestion, { mode: 'action', action }));
});
