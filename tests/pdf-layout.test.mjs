import assert from 'node:assert/strict';
import test from 'node:test';
import { pdfItemsToText } from '../src/pdfLayout.ts';

test('PDF 同段自动换行合并，明显段落间隔保留', () => {
  const text = pdfItemsToText([
    { str: 'Planning starts with a goal', transform: [1, 0, 0, 1, 40, 700] },
    { str: 'and relevant prior knowledge.', transform: [1, 0, 0, 1, 40, 685] },
    { str: 'Monitoring checks progress.', transform: [1, 0, 0, 1, 40, 640] }
  ]);
  assert.equal(text, 'Planning starts with a goal and relevant prior knowledge.\n\nMonitoring checks progress.');
});
