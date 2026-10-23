import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
}).outputText).toString('base64')}`;
const blogUrl = moduleUrl(readFileSync(new URL('../src/lib/blog-assignment.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/preview-visibility.ts', import.meta.url), 'utf8')
  .replace("'./blog-assignment'", JSON.stringify(blogUrl));
const { eligiblePreviewWriterIds, PREVIEW_WORK_START_MONTH } = await import(moduleUrl(source));

assert.equal(PREVIEW_WORK_START_MONTH, '2026-08');
const assignments = [
  { month: '2026-07', main_writer_id: 'old', main_quantity: 10 },
  { month: '2026-08', main_writer_id: 'main', main_quantity: 2, sub_writer_id: 'sub', sub_quantity: 3,
    optimal_writer_id: 'optimal', optimal_quantity: 4, inbl_writer_id: 'inbl', inbl_quantity: 5 },
  { month: '2026-11', package_name: '브랜딩', main_writer_id: 'zero-info', main_quantity: 8,
    information_quantity: 0, clinical_writer_id: 'clinical', clinical_quantity: 8 },
  { month: '2026-09', main_writer_id: 'zero', main_quantity: 0 },
  { main_writer_id: 'no-month', main_quantity: 10 },
  { month: '2026-11', main_writer_id: 'future', main_quantity: 1 },
  { month: '2026-08', main_writer_id: null, main_quantity: 8 },
];
assert.deepEqual([...eligiblePreviewWriterIds(assignments)].sort(), ['main', 'sub', 'optimal', 'inbl', 'clinical', 'future'].sort());
assert.deepEqual([...eligiblePreviewWriterIds([])], []);
assert.deepEqual([...eligiblePreviewWriterIds([
  { month: '2026-08', main_writer_id: 'same', main_quantity: 2, sub_writer_id: 'same', sub_quantity: 3 },
])], ['same']);
console.log('PASS: August cutoff, all work categories, positive quantities, split branding ownership, future assignments and duplicate IDs');
