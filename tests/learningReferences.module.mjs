import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as knowledge from '../src/defaultKnowledge.ts';
const source = ts.transpileModule(readFileSync(new URL('../src/learningReferences.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports = {};
new Function('require','exports',source)(name => {
  if(name === './defaultKnowledge') return knowledge;
  throw new Error(`Unexpected test import: ${name}`);
},exports);
export const { retrieveLearningReferences, attachLearningReferences } = exports;
