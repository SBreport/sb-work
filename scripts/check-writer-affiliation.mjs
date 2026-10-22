import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/writer-affiliation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2020 },
});
const { writerAffiliation } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const editor = { role: 'editor', employee_type: 'internal' };
assert.equal(writerAffiliation(editor), 'employee');
assert.equal(editor.role, 'editor');
assert.equal(writerAffiliation({ role: 'admin', employee_type: 'internal' }), 'employee');
assert.equal(writerAffiliation({ role: 'freelancer', employee_type: 'freelancer' }), 'freelancer');
assert.equal(writerAffiliation({ role: 'employee', employee_type: 'partner' }), 'partner');
assert.equal(writerAffiliation({ role: 'freelancer', employee_type: 'internal' }), 'employee');
assert.equal(writerAffiliation({ role: 'editor', employee_type: null }), 'employee');
assert.equal(writerAffiliation({ role: 'freelancer' }), 'freelancer');
assert.equal(writerAffiliation({ role: 'partner' }), 'partner');
console.log('PASS: affiliation filters use employee_type, preserve editor permission and support legacy accounts');
