import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePdfSelection } from '../src/pdfSelection.ts';

test('长 PDF 可以选择后部页段，非法页段不会被静默修改', () => {
  assert.doesNotThrow(() => validatePdfSelection(50, 45, 50));
  for (const [from, to] of [[0, 1], [18, 17], [18, 51], [1.5, 2], [NaN, 2], [1, 41]]) {
    assert.throws(() => validatePdfSelection(50, from, to));
  }
});
