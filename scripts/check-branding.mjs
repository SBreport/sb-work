import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'sb-branding-'));
try {
  for (const name of ['csv-import', 'blog-assignment', 'stats']) {
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    writeFileSync(join(dir, `${name}.cjs`), ts.transpileModule(source.replaceAll("'./blog-assignment'", "'./blog-assignment.cjs'"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText);
  }
  const require = createRequire(import.meta.url);
  const { parseCSVRows, importCsvForMonth } = require(join(dir, 'csv-import.cjs'));
  const { workRolesFor, summarizeWork, isBranding, assignmentWriterFilter } = require(join(dir, 'blog-assignment.cjs'));
  const { calcWriterStats, totalQty } = require(join(dir, 'stats.cjs'));
  const header = ['갱신월','갱신일','과목/병원명','지점명','N 정보성','수량','N 임상/논문','수량','비고','블로그 총 수량','SEO 컨텐츠','비고','수량','최적배포','수량','인블','구분','연결','진행여부','패키지'];
  const row = ['11월','1일','피부과, 유앤아이','테스트','A',6,'B',2,'메모',8,'B','SEO 메모',8,'C',10,8,'직','','','브랜딩'];
  const csv = rows => rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const parsed = parseCSVRows(csv([header, row]))[0];
  assert.equal(parsed.mainWriter, 'A'); assert.equal(parsed.clinicalWriter, 'B');
  assert.equal(parsed.informationQuantity, 6); assert.equal(parsed.clinicalQuantity, 2);
  assert.equal(parsed.mainQuantity, 8); assert.equal(parsed.subWriter, 'B'); assert.equal(parsed.subQuantity, 8);
  assert.equal(parsed.optimalQuantity, 10); assert.equal(parsed.inblQuantity, 8);
  const split = { month:'2026-11', package_name:'브랜딩', main_writer_id:'A', main_writer_name:'A', main_quantity:8,
    clinical_writer_id:'B', clinical_writer_name:'B', information_quantity:6, clinical_quantity:2,
    sub_writer_id:'B', sub_writer_name:'B', sub_quantity:8 };
  assert.deepEqual(workRolesFor(split, 'A'), [{label:'정보형', qty:6}]);
  assert.deepEqual(workRolesFor(split, 'B'), [{label:'임상/논문형', qty:2},{label:'SEO 콘텐츠', qty:8}]);
  assert.equal(summarizeWork([split], 'A').total, 6);
  assert.equal(summarizeWork([split], 'B').total, 10);
  assert.equal(summarizeWork([split], 'unrelated').total, 0);
  const stats = calcWriterStats([split]);
  assert.equal(totalQty(stats.A), 6); assert.equal(totalQty(stats.B), 10);
  const same = { ...split, main_writer_id:'B', main_writer_name:'B', information_quantity:null, clinical_quantity:null };
  assert.deepEqual(workRolesFor(same, 'B'), [{label:'블로그 · 유형 미구분',qty:8},{label:'SEO 콘텐츠',qty:8}]);
  assert.equal(summarizeWork([same], 'B').total, 16);
  assert.equal(totalQty(calcWriterStats([same]).B), 16);
  const sameSplit = { ...split, main_writer_id:'B', main_writer_name:'B' };
  assert.equal(totalQty(calcWriterStats([sameSplit]).B), 16);
  assert.equal(calcWriterStats([sameSplit]).B.branchCount, 1);
  const old = { ...split, month:'2026-10' };
  assert.equal(isBranding(old), false);
  assert.deepEqual(workRolesFor(old, 'A'), [{label:'작성',qty:8},{label:'검토',qty:8}]);
  assert.equal(summarizeWork([old], 'A').blogTotal, 8);
  assert.equal(summarizeWork([split], 'A').blogTotal, 6);
  assert.equal(isBranding({...split,package_name:null}), false);
  assert.equal(assignmentWriterFilter('B').includes('clinical_writer_id.eq.B'), true);
  const empty = [...row]; empty[5]=''; empty[7]=''; empty[6]='A';
  assert.equal(parseCSVRows(csv([header,empty]))[0].informationQuantity, null);
  const invalid = [...empty]; invalid[6]='B';
  assert.throws(() => parseCSVRows(csv([header,invalid])), /두 담당자가 같아야/);
  for (const quantity of [3, -1, 'abc', 1.5]) {
    const bad = [...row]; bad[7]=quantity;
    assert.throws(() => parseCSVRows(csv([header,bad])));
  }
  const missing = [...row]; missing[7]='';
  assert.throws(() => parseCSVRows(csv([header,missing])), /일치해야/);
  const zero = [...row]; zero[5]=8; zero[7]=0;
  assert.equal(parseCSVRows(csv([header,zero]))[0].clinicalQuantity, 0);
  const legacyHeaders = ['갱신월','갱신일','과목/병원명','지점명','사수','비고','수량','부사수','비고','수량','최적배포','수량','인블','구분','연결','진행여부','패키지'];
  const legacyRow = ['10월','1일','피부과','테스트','A','비고',8,'B','',8,'C',10,8,'직','','','브랜딩'];
  const legacy = parseCSVRows(csv([legacyHeaders,legacyRow]))[0];
  assert.equal(legacy.format,'v2'); assert.equal(legacy.mainQuantity,8); assert.equal(legacy.subQuantity,8);
  const v1Headers = legacyHeaders.slice(0,12).concat(['최적배포 비고','인블','진행여부']);
  const v1 = parseCSVRows(csv([v1Headers,legacyRow.slice(0,12).concat(['최적 메모',8,'중단'])]))[0];
  assert.equal(v1.format,'v1'); assert.equal(v1.optimalNote,'최적 메모'); assert.equal(v1.inblQuantity,8); assert.equal(v1.progressStatus,'중단');
  let writes = 0;
  const noWrites = { from() { writes++; throw new Error('unexpected DB call'); } };
  await assert.rejects(importCsvForMonth(noWrites,csv([header,row]),'2026-10'), /11월부터/);
  await assert.rejects(importCsvForMonth(noWrites,csv([header,invalid]),'2026-11'), /두 담당자/);
  assert.equal(writes,0);
  const noSchema = { from() { return { select() { return { limit() { return {error:{message:'missing column'}}; } }; } }; } };
  await assert.rejects(importCsvForMonth(noSchema,csv([header,row]),'2026-11'), /마이그레이션/);
  let imported;
  const fakeDb = {
    from(table) {
      const filters = {};
      const builder = {
        select() { return builder; }, eq(key,value) { filters[key]=value; return builder; },
        update() { return builder; }, insert() { return builder; },
        limit() { return Promise.resolve({error:null}); },
        maybeSingle() { return Promise.resolve({data:{id:table === 'profiles' ? filters.name : 'same-branch'}}); },
        then(resolve) { resolve({error:null}); },
      };
      return builder;
    },
    rpc(name, args) { assert.equal(name,'replace_month_assignments'); imported=args; return Promise.resolve({error:null}); },
  };
  const second = [...row]; second[3]='테스트 (2)'; second[6]='C';
  await importCsvForMonth(fakeDb,csv([header,row,second]),'2026-11');
  assert.equal(imported.new_assignments.length,2);
  assert.deepEqual(imported.new_assignments.map(a=>a.slot),[1,2]);
  assert.deepEqual(imported.new_assignments.map(a=>a.clinical_writer_id),['B','C']);
  assert.equal(imported.new_assignments[0].main_quantity,8);
  assert.equal(imported.new_assignments[0].information_quantity,6);
  console.log('PASS: legacy formats, split/common ownership, no double count/review leakage, invalid quantities, month/schema guards');
  if (process.argv[2]) {
    const values = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const rows = parseCSVRows(csv(values));
    const brand = rows.filter(r => r.packageName === '브랜딩');
    const splitRows = brand.filter(r => r.informationQuantity != null);
    console.log(JSON.stringify({liveRows:rows.length, branding:brand.length, split:splitRows.length, common:brand.length-splitRows.length,
      blogTotal:rows.reduce((n,r)=>n+r.mainQuantity,0),seoTotal:rows.reduce((n,r)=>n+r.subQuantity,0)}));
  }
} finally { rmSync(dir,{recursive:true,force:true}); }
